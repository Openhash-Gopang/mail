/* ═════════════════════════════════════════════════
   case-invite.js — M2 초대권 메일 · 가입 알림 · 소통 채널(chat room) 개설 (순수 로직)
   2026-11-01. 흐름
     1) 공급자 또는 소비자가 상대에게 초대권 메일을 보낸다(K-Mail). 링크 = naviweb.kr 가입 화면.
     2) 상대가 그 링크로 가입하면 [가입 사실 · 아이디 · 메일 아이디]가 초청자에게 전달된다.
     3) 전달과 함께 둘 사이의 chat room 이 열린다.
   원칙: 서버(네트워크)에는 token 해시·초청자 id·만료·상태만 둔다. 초대 받는 사람의 메일 주소,
         Case 제목·내용은 서버에 두지 않는다(초청자 PDV에만). 저장소·네트워크는 호출자가 주입.
   ⚠ naviweb.kr 가입 화면과 가입→알림 서버 처리는 아직 없다(미검증). 이 파일은 그 계약만 정한다.
   ═════════════════════════════════════════════════ */
(function (root) {
  'use strict';
  var SIGNUP_BASE = 'https://naviweb.kr/signup';
  var TTL_DAYS = 14;
  var MAIL_DOMAIN = 'naviweb.kr';
  var STATES = ['issued', 'signed_up', 'connected', 'expired', 'revoked'];
  var TRANSITIONS = { issued: { signup: 'signed_up', expire: 'expired', revoke: 'revoked' }, signed_up: { connect: 'connected' }, connected: {}, expired: {}, revoked: {} };

  function b64url(bytes) {
    var s = ''; for (var i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
    return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  async function sha256Hex(str) {
    var buf = await root.crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
    return Array.prototype.map.call(new Uint8Array(buf), function (b) { return ('0' + b.toString(16)).slice(-2); }).join('');
  }
  function newToken() { return b64url(root.crypto.getRandomValues(new Uint8Array(16))); }
  function inviteLink(token) { return SIGNUP_BASE + '?inv=' + encodeURIComponent(token); }
  function emailOk(e) { return typeof e === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) && e.length <= 254; }
  function other(side) { return side === 'provider' ? 'consumer' : side === 'consumer' ? 'provider' : null; }

  // 초대 만들기. 반환 invitation 은 초청자 PDV 에, server_record 만 네트워크에(token 자체는 메일에만).
  async function createInvitation(i, nowIso) {
    i = i || {};
    var errs = [];
    if (!i.case_id) errs.push('case_id 필수');
    if (!i.inviter_id) errs.push('초청자 id 필수');
    if (i.inviter_side !== 'provider' && i.inviter_side !== 'consumer') errs.push('inviter_side 는 provider|consumer');
    if (!emailOk(i.invitee_email)) errs.push('초대받는 사람 메일 주소 오류');
    if (errs.length) return { ok: false, errors: errs };
    var now = nowIso || new Date().toISOString();
    var token = newToken(), token_hash = await sha256Hex('inv:' + token);
    var expires_at = new Date(Date.parse(now) + TTL_DAYS * 864e5).toISOString();
    return {
      ok: true, token: token, link: inviteLink(token),
      invitation: { token_hash: token_hash, case_id: i.case_id, inviter_id: i.inviter_id, inviter_side: i.inviter_side,
        invitee_side: other(i.inviter_side), invitee_email: i.invitee_email, created_at: now, expires_at: expires_at, state: 'issued' },
      server_record: { token_hash: token_hash, inviter_id: i.inviter_id, expires_at: expires_at, state: 'issued' },
    };
  }

  function transitionInvite(state, event) {
    var row = TRANSITIONS[state];
    if (!row || !Object.prototype.hasOwnProperty.call(row, event)) return { ok: false, error: state + ' 에서 ' + event + ' 불가' };
    return { ok: true, to: row[event] };
  }

  function expired(rec, nowIso) { return Date.parse(nowIso || new Date().toISOString()) >= Date.parse(rec.expires_at); }

  // 가입 처리(서버/초청자 쪽 공통 규칙). signup = { token, user_id, mail_id, email }
  // 성공 시 초청자에게 보낼 notice 와 채팅방 정의를 돌려준다. 토큰은 1회용.
  async function onSignup(rec, signup, nowIso) {
    signup = signup || {};
    if (!signup.token || !signup.user_id || !signup.mail_id) return { ok: false, error: 'token, user_id, mail_id 필수' };
    if ((await sha256Hex('inv:' + signup.token)) !== rec.token_hash) return { ok: false, error: '초대 토큰 불일치' };
    if (rec.state === 'revoked') return { ok: false, error: '취소된 초대' };
    if (rec.state !== 'issued') return { ok: false, error: '이미 사용된 초대(' + rec.state + ')' };
    if (expired(rec, nowIso)) return { ok: false, error: '만료된 초대' };
    if (signup.user_id === rec.inviter_id) return { ok: false, error: '자기 자신은 초대할 수 없음' };
    var room = await chatRoomFor(rec.case_id, rec.inviter_id, signup.user_id);
    return {
      ok: true, state: 'signed_up',
      notice: { type: 'invite_signed_up', signed_up: true, invitee_user_id: signup.user_id,
        invitee_mail_id: signup.mail_id + '@' + MAIL_DOMAIN, signed_up_at: nowIso || new Date().toISOString(),
        // 초대받은 주소와 가입 메일이 다르면 알려 준다(다른 사람이 링크를 쓴 경우를 초청자가 판단)
        email_match: rec.invitee_email ? String(signup.email || '').toLowerCase() === rec.invitee_email.toLowerCase() : null },
      room: room,
    };
  }

  // 방 id 는 (case, 두 사람)에서 결정적으로 만든다 — 같은 둘이 같은 일로 다시 열어도 같은 방.
  async function chatRoomFor(case_id, a, b) {
    var members = [a, b].sort();
    var room_id = (await sha256Hex('room:' + case_id + ':' + members.join('|'))).slice(0, 32);
    return { room_id: room_id, case_id: case_id, members: members, kind: 'case_chat' };
  }

  // 채팅 한 줄은 곧 소통 이력(자동 수집) 입력이 된다.
  function chatToCommunication(msg, room) {
    return { recorder_side: msg.side, who: msg.from, with: msg.to, occurred_at: msg.at, channel: 'chat', how: 'auto',
      summary: msg.text, purpose: msg.purpose || 'info', link: { room_id: room.room_id } };
  }

  var API = { TTL_DAYS: TTL_DAYS, STATES: STATES, SIGNUP_BASE: SIGNUP_BASE, createInvitation: createInvitation,
    transitionInvite: transitionInvite, onSignup: onSignup, chatRoomFor: chatRoomFor, chatToCommunication: chatToCommunication, inviteLink: inviteLink };
  root.CaseInvite = API;
})(typeof window !== 'undefined' ? window : globalThis);
