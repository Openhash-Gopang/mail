/* ═════════════════════════════════════════════════
   case-seal.js — 우편함 봉투 종단 암호화 (S2, G2 해결)
   2026-11-01. 방식: 보내는 쪽이 일회용 X25519 키를 만들어 받는 사람의 정적 X25519 공개키와 ECDH →
   HKDF-SHA256 → AES-256-GCM. 서버(KV)에는 암호문만 남고 평문·키는 없다.
   · 서명 키(Ed25519, case-sync)와 봉인 키(X25519)는 분리한다. 봉인 공개키는 서명 키로 서명해 서버에 등록한다.
   · AAD 로 from·to·kind·case_id_hash·content_hash 를 묶어, 봉투 겉면을 바꿔치기하면 복호화가 실패한다.
   · ciphertext = base64( 일회용공개키(32B) ‖ AES-GCM 암호문+태그 ), nonce = base64(12B)
   의존: case-core.js (canonical, sha256Hex), case-sync.js (b64u 등)
   ═════════════════════════════════════════════════ */
(function (root) {
  'use strict';
  var subtle = function () { return root.crypto.subtle; };
  var enc = new TextEncoder(), dec = new TextDecoder();
  var INFO = 'hondi-case/v1:seal';

  function b64(bytes) { var s = ''; for (var i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]); return btoa(s); }
  function unb64(str) { var bin = atob(str), o = new Uint8Array(bin.length); for (var i = 0; i < bin.length; i++) o[i] = bin.charCodeAt(i); return o; }
  function aad(env) { return enc.encode(JSON.stringify([env.from, env.to, env.kind, env.case_id_hash, env.content_hash])); }

  async function generateBoxKey() {
    var kp = await subtle().generateKey({ name: 'X25519' }, true, ['deriveBits']);
    return { pub: b64(new Uint8Array(await subtle().exportKey('raw', kp.publicKey))), _priv: kp.privateKey };
  }
  async function aesKey(privateKey, peerPubRaw, usage) {
    var peer = await subtle().importKey('raw', peerPubRaw, { name: 'X25519' }, false, []);
    var bits = await subtle().deriveBits({ name: 'X25519', public: peer }, privateKey, 256);
    var hk = await subtle().importKey('raw', bits, 'HKDF', false, ['deriveKey']);
    return subtle().deriveKey({ name: 'HKDF', hash: 'SHA-256', salt: new Uint8Array(32), info: enc.encode(INFO) }, hk, { name: 'AES-GCM', length: 256 }, false, usage);
  }

  // 봉인 공개키를 서명 키로 묶는다(서버·상대가 "이 봉인키는 이 서명키 주인 것"을 확인)
  function bindMsg(boxPub) { return 'hondi-case/v1:boxkey:' + boxPub; }
  async function bindBoxKey(identity, boxPub) { return { sign_pub: identity.pub, box_pub: boxPub, sig: await identity.sign(bindMsg(boxPub)) }; }
  async function verifyBoxKey(rec) { return !!rec && await root.CaseSync.verifySig(rec.sign_pub, bindMsg(rec.box_pub), rec.sig); }

  // meta: { from, to, kind, case_id_hash } → 서버 계약(case-server validateEnvelope)에 맞는 봉투
  async function seal(meta, plaintextObj, recipientBoxPub, nowIso) {
    var C = root.CaseCore, text = C.canonical(plaintextObj);
    var content_hash = await C.sha256Hex(text);
    var eph = await subtle().generateKey({ name: 'X25519' }, true, ['deriveBits']);
    var epub = new Uint8Array(await subtle().exportKey('raw', eph.publicKey));
    var key = await aesKey(eph.privateKey, unb64(recipientBoxPub), ['encrypt']);
    var nonce = root.crypto.getRandomValues(new Uint8Array(12));
    var env = { to: meta.to, from: meta.from, kind: meta.kind, nonce: b64(nonce), ciphertext: '', content_hash: content_hash, case_id_hash: meta.case_id_hash, created_at: nowIso || new Date().toISOString() };
    var ct = new Uint8Array(await subtle().encrypt({ name: 'AES-GCM', iv: nonce, additionalData: aad(env) }, key, enc.encode(text)));
    var all = new Uint8Array(32 + ct.length); all.set(epub, 0); all.set(ct, 32);
    env.ciphertext = b64(all);
    return env;
  }

  // 복호화 + content_hash 확인. 실패하면 { ok:false, code }.
  async function open(env, myBox) {
    try {
      var all = unb64(env.ciphertext);
      if (all.length < 32 + 16) return { ok: false, code: 'BAD_CIPHERTEXT' };
      var key = await aesKey(myBox._priv, all.slice(0, 32), ['decrypt']);
      var pt = new Uint8Array(await subtle().decrypt({ name: 'AES-GCM', iv: unb64(env.nonce), additionalData: aad(env) }, key, all.slice(32)));
      var text = dec.decode(pt);
      if (await root.CaseCore.sha256Hex(text) !== env.content_hash) return { ok: false, code: 'HASH_MISMATCH' };
      return { ok: true, value: JSON.parse(text) };
    } catch (_) { return { ok: false, code: 'DECRYPT_FAILED' }; }
  }

  root.CaseSeal = { generateBoxKey: generateBoxKey, bindBoxKey: bindBoxKey, verifyBoxKey: verifyBoxKey, seal: seal, open: open };
})(typeof window !== 'undefined' ? window : globalThis);
