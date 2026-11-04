/* ═════════════════════════════════════════════════
   myforms.js — 내 서류함의 "양식 만들기·고치기" 편집기 (desktop.html 왼쪽 메뉴 서류 ▸ 내 서류함)
   2026-11-05. Material Design 3 모양의 편집기. 양식을 만드는 길은 세 가지이고 서로 섞어 쓸 수 있다.
     ① 처음부터 — 묶음·항목을 하나씩 추가하고 종류(짧은 글·긴 글·날짜·금액·선택)·필수·안내 문구를 고른다.
     ② 양식 파일(이미지·PDF)을 올려 — AI 가 항목 구조를 읽어 초안을 만들고, 그 위에서 고친다.
     ③ AI 와 대화로 — 말로 설명하면 AI 가 초안을 만들고, 이어서 "항목 더 넣어 줘"처럼 말로 계속 고친다.
   AI 는 서류 사이트(navi-pro)의 숨은 틀에 navi-form-ai 로 부탁하고 navi-form-ai-result 로 양식 JSON 을 받는다(서류 화면과 따로).
   저장은 PDV(kind='form', box='mine') — 본문은 {title, sections:[{h,f:[{l,t,h,o?,u?,req?}]}], attach:[]} JSON.
   순수 함수(_pure)는 DOM 없이 Node 에서 테스트한다.
   ═════════════════════════════════════════════════ */
(function (root) {
  'use strict';

  var KINDS = [['short', '짧은 글'], ['long', '긴 글'], ['date', '날짜'], ['amount', '금액'], ['select', '선택']];
  var KIND_OK = KINDS.map(function (k) { return k[0]; });
  var LIMITS = { sections: 12, fields: 40, total: 80, attach: 12 };

  /* ── 순수 함수 ─────────────────────────────────────────────── */
  function blank() { return { title: '', sections: [{ h: '기본 사항', f: [{ l: '', t: 'short', h: '', req: false }] }], attach: [] }; }
  function newField() { return { l: '', t: 'short', h: '', req: false }; }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function count(form) { var n = 0; (form.sections || []).forEach(function (s) { (s.f || []).forEach(function (f) { if (String(f.l || '').trim()) n++; }); }); return n; }
  function isEmpty(form) { return !form || (!String(form.title || '').trim() && count(form) === 0); }
  function move(arr, i, dir) { var j = i + dir; if (i < 0 || j < 0 || i >= arr.length || j >= arr.length) return false; var t = arr[i]; arr[i] = arr[j]; arr[j] = t; return true; }
  function splitOpts(s) { return String(s || '').split(/[\/,，、]/).map(function (x) { return x.trim().slice(0, 40); }).filter(Boolean).slice(0, 12); }
  /* 편집 중인 양식 → 저장·서류 화면용 양식. 이름 없는 항목·빈 묶음은 버리고, 선택지가 2개 미만인 '선택'은 짧은 글로 낮춘다. */
  function toStored(form) {
    var secs = [], total = 0;
    (form.sections || []).slice(0, LIMITS.sections).forEach(function (s) {
      var fs = [];
      (s.f || []).slice(0, LIMITS.fields).forEach(function (f) {
        var l = String(f.l || '').replace(/[|\r\n]/g, ' ').trim().slice(0, 60);
        if (!l || total >= LIMITS.total) return;
        total++;
        var t = KIND_OK.indexOf(f.t) >= 0 ? f.t : 'short', o = { l: l, t: t, h: String(f.h || '').trim().slice(0, 80) };
        if (t === 'select') { var opts = Array.isArray(f.o) ? f.o : splitOpts(f.oText); if (opts.length >= 2) o.o = opts; else o.t = 'short'; }
        if (o.t === 'amount' && f.u) o.u = String(f.u).trim().slice(0, 6);
        if (f.req) o.req = 1;
        fs.push(o);
      });
      if (fs.length) secs.push({ h: String(s.h || '').trim().slice(0, 40) || '내용', f: fs });
    });
    return { title: String(form.title || '').replace(/\s+/g, ' ').trim().slice(0, 80), sections: secs, attach: (form.attach || []).map(function (a) { return String(a).trim().slice(0, 60); }).filter(Boolean).slice(0, LIMITS.attach) };
  }
  /* 저장 전 점검 — 문제가 있으면 사용자에게 보일 문장을, 없으면 '' */
  function problem(form) {
    var st = toStored(form);
    if (!st.title) return '양식 이름을 적어 주세요.';
    if (!st.sections.length) return '항목을 한 개 이상 추가해 주세요.';
    var seen = {};
    for (var i = 0; i < st.sections.length; i++) for (var j = 0; j < st.sections[i].f.length; j++) {
      var k = st.sections[i].f[j].l; if (seen[k]) return '“' + k + '” 항목이 두 번 있습니다. 이름을 다르게 해 주세요.'; seen[k] = 1;
    }
    return '';
  }
  /* 저장된 양식(또는 AI 가 낸 양식) → 편집용 상태 */
  function fromStored(st) {
    var f = blank(); if (!st || typeof st !== 'object') return f;
    f.title = String(st.title || '');
    var secs = (st.sections || []).map(function (s) {
      return { h: String(s.h || ''), f: (s.f || []).map(function (x) { return { l: String(x.l || ''), t: KIND_OK.indexOf(x.t) >= 0 ? x.t : 'short', h: String(x.h || ''), req: !!x.req, u: x.u || '', o: Array.isArray(x.o) ? x.o.slice() : undefined, oText: Array.isArray(x.o) ? x.o.join(' / ') : '' }; }) };
    });
    f.sections = secs.length ? secs : f.sections; f.attach = Array.isArray(st.attach) ? st.attach.slice(0, LIMITS.attach) : [];
    return f;
  }

  var _pure = { KINDS: KINDS, LIMITS: LIMITS, blank: blank, newField: newField, count: count, isEmpty: isEmpty, move: move, splitOpts: splitOpts, toStored: toStored, problem: problem, fromStored: fromStored };
  if (typeof module !== 'undefined' && module.exports) { module.exports = { _pure: _pure }; return; }

  /* ── 화면 ─────────────────────────────────────────────────── */
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var $ = function (id) { return document.getElementById(id); };
  var S = null;       // { id, site, form, undo, chat:[], busy, tab, fromFile }
  var AI = { frame: null, origin: '', ready: false, queue: [], pending: {}, site: '' };

  var CSS = [
    '#mf-editor{--mfo:#79747E;--mfs:var(--sur,#fff);color:var(--txt,#1A202C)}',
    '#mf-editor .mx-bar{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:14px}',
    '#mf-editor .mx-bar h2{margin:0;font-size:20px;font-weight:700;flex:1;min-width:140px}',
    '.mx-btn{font:inherit;font-size:14px;font-weight:600;line-height:1;height:40px;padding:0 20px;border-radius:20px;border:1px solid transparent;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;gap:6px;white-space:nowrap;transition:box-shadow .15s,background .15s}',
    '.mx-btn.f{background:var(--pri,#0F8F7E);color:#fff}.mx-btn.f:hover{box-shadow:0 1px 3px rgba(0,0,0,.3)}',
    '.mx-btn.t{background:var(--pri-bg,#E6F4F1);color:var(--pri,#0F8F7E)}.mx-btn.t:hover{box-shadow:0 1px 2px rgba(0,0,0,.2)}',
    '.mx-btn.o{background:transparent;color:var(--pri,#0F8F7E);border-color:var(--mfo)}.mx-btn.o:hover{background:var(--pri-bg,#E6F4F1)}',
    '.mx-btn.x{background:transparent;color:var(--pri,#0F8F7E);padding:0 12px}.mx-btn.x:hover{background:var(--pri-bg,#E6F4F1)}',
    '.mx-btn.sm{height:32px;padding:0 14px;font-size:13px;border-radius:16px}',
    '.mx-btn[disabled]{opacity:.45;cursor:not-allowed;box-shadow:none}',
    '.mx-ic{font:inherit;width:36px;height:36px;border-radius:50%;border:0;background:transparent;color:var(--sub,#4A5568);cursor:pointer;font-size:16px;line-height:1;display:inline-flex;align-items:center;justify-content:center}',
    '.mx-ic:hover{background:rgba(0,0,0,.07)}.mx-ic[disabled]{opacity:.3;cursor:default}.mx-ic.del:hover{background:var(--bad-bg,#fde8e6);color:var(--bad,#b42318)}',
    '.mx-start{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:12px;margin:6px 0 18px}',
    '.mx-card-btn{font:inherit;text-align:left;border:1px solid var(--bdr,#DFE2ED);border-radius:16px;background:var(--mfs);padding:16px 18px;cursor:pointer;display:flex;flex-direction:column;gap:6px;color:inherit;transition:box-shadow .15s,border-color .15s}',
    '.mx-card-btn:hover{border-color:var(--pri,#0F8F7E);box-shadow:0 2px 8px rgba(0,0,0,.12)}',
    '.mx-card-btn b{font-size:15px}.mx-card-btn span{font-size:13px;color:var(--sub,#4A5568);line-height:1.5}.mx-card-btn i{font-style:normal;font-size:22px}',
    '.mx-cols{display:grid;grid-template-columns:minmax(0,1.25fr) minmax(0,1fr);gap:18px;align-items:start}',
    '@media (max-width:1000px){.mx-cols{grid-template-columns:minmax(0,1fr)}}',
    '@media (min-width:1001px){.mx-cols>div:last-child{position:sticky;top:70px}}',
    '.mx-panel{border:1px solid var(--bdr,#DFE2ED);border-radius:16px;background:var(--mfs);padding:16px 18px}',
    '.mx-panel+.mx-panel{margin-top:14px}',
    '.mx-sec-h{display:flex;align-items:center;gap:6px;margin-bottom:14px}',
    '.mx-sec-h .mx-fld{flex:1}',
    '.mx-fld{position:relative;display:block;min-width:0}',
    '.mx-fld>span{position:absolute;top:-8px;left:10px;padding:0 4px;background:var(--mfs);font-size:12px;line-height:16px;color:var(--sub,#4A5568);z-index:1;pointer-events:none}',
    '.mx-fld input,.mx-fld select,.mx-fld textarea{font:inherit;font-size:15px;width:100%;box-sizing:border-box;height:48px;padding:0 14px;border:1px solid var(--mfo);border-radius:4px;background:transparent;color:inherit;outline:none}',
    '.mx-fld textarea{height:auto;min-height:72px;padding:12px 14px;resize:vertical}',
    '.mx-fld input:hover,.mx-fld select:hover,.mx-fld textarea:hover{border-color:var(--txt,#1A202C)}',
    '.mx-fld input:focus,.mx-fld select:focus,.mx-fld textarea:focus{border-color:var(--pri,#0F8F7E);box-shadow:inset 0 0 0 1px var(--pri,#0F8F7E)}',
    '.mx-fld:focus-within>span{color:var(--pri,#0F8F7E)}',
    '.mx-fld.title input{font-size:18px;font-weight:600;height:56px}',
    '.mx-row{border:1px solid var(--bdr,#DFE2ED);border-radius:12px;padding:14px 12px 12px;margin-bottom:12px;background:var(--mfs)}',
    '.mx-row-main{display:grid;grid-template-columns:minmax(0,1fr) 130px auto;gap:10px;align-items:center}',
    '.mx-row-sub{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:10px;margin-top:12px;align-items:center}',
    '.mx-row-opt{margin-top:12px}',
    '@media (max-width:640px){.mx-row-main{grid-template-columns:minmax(0,1fr) 110px}.mx-row-main .mx-acts{grid-column:1/-1;justify-content:flex-end}.mx-row-sub{grid-template-columns:minmax(0,1fr)}}',
    '.mx-acts{display:flex;align-items:center;gap:0}',
    '.mx-sw{display:inline-flex;align-items:center;gap:8px;font-size:13px;color:var(--sub,#4A5568);cursor:pointer;user-select:none;white-space:nowrap}',
    '.mx-sw input{position:absolute;opacity:0;width:0;height:0}',
    '.mx-sw i{position:relative;width:40px;height:22px;border-radius:11px;border:2px solid var(--mfo);background:transparent;transition:background .15s,border-color .15s;flex:none}',
    '.mx-sw i::after{content:"";position:absolute;top:3px;left:3px;width:12px;height:12px;border-radius:50%;background:var(--mfo);transition:transform .15s,background .15s}',
    '.mx-sw input:checked+i{background:var(--pri,#0F8F7E);border-color:var(--pri,#0F8F7E)}',
    '.mx-sw input:checked+i::after{transform:translateX(18px);background:#fff;width:14px;height:14px;top:2px;left:2px}',
    '.mx-sw input:focus-visible+i{outline:2px solid var(--pri,#0F8F7E);outline-offset:2px}',
    '.mx-h3{font-size:12px;font-weight:700;letter-spacing:.04em;color:var(--sub,#4A5568);margin:0 0 10px}',
    '.mx-chips{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:10px}',
    '.mx-chip{display:inline-flex;align-items:center;gap:4px;height:32px;padding:0 6px 0 12px;border:1px solid var(--mfo);border-radius:8px;font-size:13px}',
    '.mx-chip button{border:0;background:transparent;cursor:pointer;color:var(--sub,#4A5568);font-size:15px;line-height:1;width:22px;height:22px;border-radius:50%}',
    '.mx-chip button:hover{background:rgba(0,0,0,.08)}',
    '.mx-chipbtn{font:inherit;font-size:13px;height:32px;padding:0 12px;border:1px solid var(--mfo);border-radius:8px;background:transparent;color:var(--sub,#4A5568);cursor:pointer}',
    '.mx-chipbtn:hover{background:var(--pri-bg,#E6F4F1);color:var(--pri,#0F8F7E)}',
    '.mx-tabs{display:flex;gap:4px;border-bottom:1px solid var(--bdr,#DFE2ED);margin:-4px -4px 14px}',
    '.mx-tab{font:inherit;font-size:14px;font-weight:600;padding:10px 16px;border:0;background:transparent;color:var(--sub,#4A5568);cursor:pointer;border-bottom:3px solid transparent;margin-bottom:-1px}',
    '.mx-tab[aria-selected=true]{color:var(--pri,#0F8F7E);border-bottom-color:var(--pri,#0F8F7E)}',
    '.mx-chat{display:flex;flex-direction:column;gap:10px;max-height:300px;overflow-y:auto;margin-bottom:12px;padding-right:2px}',
    '.mx-msg{max-width:92%;padding:10px 14px;border-radius:16px;font-size:14px;line-height:1.55;white-space:pre-wrap;word-break:break-word}',
    '.mx-msg.u{align-self:flex-end;background:var(--pri,#0F8F7E);color:#fff;border-bottom-right-radius:4px}',
    '.mx-msg.a{align-self:flex-start;background:var(--bg,#F5F6FA);border-bottom-left-radius:4px}',
    '.mx-msg.e{align-self:flex-start;background:var(--bad-bg,#fde8e6);color:var(--bad,#b42318)}',
    '.mx-compose{display:flex;gap:8px;align-items:flex-end}',
    '.mx-compose .mx-fld{flex:1}',
    '.mx-hint{font-size:12.5px;color:var(--hint,#718096);line-height:1.6;margin:8px 2px 0}',
    '.mx-spin{display:inline-block;width:14px;height:14px;border:2px solid currentColor;border-right-color:transparent;border-radius:50%;animation:mxspin .8s linear infinite;vertical-align:-2px}',
    '@keyframes mxspin{to{transform:rotate(360deg)}}',
    '.mx-pv-title{font-size:20px;font-weight:600;margin:0 0 4px}.mx-pv-sec{font-size:14px;font-weight:700;color:var(--pri,#0F8F7E);margin:18px 0 12px}',
    '.mx-pv-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:16px 12px}',
    '.mx-pv-grid .mx-fld.wide{grid-column:1/-1}',
    '.mx-pv-grid .mx-fld>div{min-height:48px;box-sizing:border-box;border:1px solid var(--mfo);border-radius:4px;display:flex;align-items:center;justify-content:flex-end;padding:0 14px;color:var(--hint,#718096);font-size:13px}',
    '.mx-pv-grid .mx-fld.wide>div{min-height:72px}',
    '.mx-pv-grid em{font-style:normal;color:var(--bad,#b42318);margin-left:2px}',
    '.mx-err{font-size:13px;color:var(--bad,#b42318);margin:8px 2px 0;min-height:18px}',
    '.mx-foot{display:flex;gap:10px;flex-wrap:wrap;margin-top:16px;align-items:center}',
    '.mx-from{display:flex;align-items:center;gap:8px;flex-wrap:wrap;font-size:13px;color:var(--sub,#4A5568);margin:-6px 0 12px}'
  ].join('\n');

  function injectCss() { if ($('mf-style')) return; var st = document.createElement('style'); st.id = 'mf-style'; st.textContent = CSS; document.head.appendChild(st); }
  function toast(m) { try { _drToast(m); } catch (e) {} }
  function siteOptions(cur) { return _DOC_SITES.map(function (s) { return '<option value="' + esc(s.id) + '"' + (s.id === cur ? ' selected' : '') + '>' + esc(s.label) + '</option>'; }).join(''); }

  /* ── AI 틀(보이지 않는 서류 사이트) ──────────────────────────── */
  function aiOrigin(url) { try { return new URL(url).origin; } catch (e) { return ''; } }
  function aiLoad(site) {
    var s = _DOC_SITES.filter(function (x) { return x.id === site; })[0] || _DOC_SITES[0];
    if (AI.frame && AI.site === s.id) return;
    if (AI.frame) AI.frame.remove();
    AI.ready = false; AI.site = s.id;
    var fr = document.createElement('iframe'); fr.id = 'mf-ai-frame'; fr.title = '양식 만들기 AI'; fr.setAttribute('aria-hidden', 'true'); fr.tabIndex = -1;
    fr.style.cssText = 'position:absolute;width:1px;height:1px;border:0;opacity:0;pointer-events:none';
    document.body.appendChild(fr); AI.frame = fr;
    var go = function (u) { AI.origin = aiOrigin(u); fr.src = u + '?embed=mail'; };
    if (s.id !== 'all') { go(s.url); return; }
    fetch(s.url, { mode: 'no-cors', cache: 'no-store' }).then(function () { go(s.url); }).catch(function () { var law = _DOC_SITES.filter(function (x) { return x.id === 'law'; })[0]; go(law.url); });
  }
  function aiPost(msg) {
    if (!AI.frame) return;
    if (!AI.ready || !AI.frame.src) { AI.queue.push(msg); return; }
    try { AI.frame.contentWindow.postMessage(msg, AI.origin); } catch (e) {}
  }
  window.addEventListener('message', function (e) {
    if (!AI.frame || e.source !== AI.frame.contentWindow || e.origin !== AI.origin) return;
    var d = e.data || {};
    if (d.type === 'navi-doc-ready') { AI.ready = true; var q = AI.queue; AI.queue = []; q.forEach(aiPost); }
    else if (d.type === 'navi-form-ai-result') { var p = AI.pending[d.id]; if (p) { delete AI.pending[d.id]; clearTimeout(p.t); p.res(d); } }
  });
  function aiAsk(o) {
    return new Promise(function (res) {
      aiLoad(S.site);
      var id = 'f' + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36);
      AI.pending[id] = { res: res, t: setTimeout(function () { if (AI.pending[id]) { delete AI.pending[id]; res({ ok: false, msg: 'AI 응답이 늦어지고 있습니다. 잠시 뒤 다시 시도해 주세요.' }); } }, 110000) };
      var msg = { type: 'navi-form-ai', id: id, prompt: o.prompt || '' };
      if (o.form) msg.form = o.form;
      if (o.file) msg.file = o.file;
      aiPost(msg);
    });
  }

  /* ── 편집기 그리기 ────────────────────────────────────────── */
  function fieldHtml(si, fi, f) {
    var kindOpts = KINDS.map(function (k) { return '<option value="' + k[0] + '"' + (f.t === k[0] ? ' selected' : '') + '>' + k[1] + '</option>'; }).join('');
    var sec = S.form.sections[si];
    return '<div class="mx-row" data-si="' + si + '" data-fi="' + fi + '">' +
      '<div class="mx-row-main">' +
        '<label class="mx-fld"><span>항목 이름</span><input type="text" data-f="l" maxlength="60" value="' + esc(f.l) + '" placeholder="예: 신청인 성명"></label>' +
        '<label class="mx-fld"><span>종류</span><select data-f="t">' + kindOpts + '</select></label>' +
        '<div class="mx-acts"><button type="button" class="mx-ic" data-a="fup" title="위로" aria-label="위로"' + (fi === 0 ? ' disabled' : '') + '>↑</button><button type="button" class="mx-ic" data-a="fdn" title="아래로" aria-label="아래로"' + (fi === sec.f.length - 1 ? ' disabled' : '') + '>↓</button><button type="button" class="mx-ic del" data-a="fdel" title="항목 삭제" aria-label="항목 삭제">✕</button></div>' +
      '</div>' +
      '<div class="mx-row-sub"><label class="mx-fld"><span>안내 문구 (선택)</span><input type="text" data-f="h" maxlength="80" value="' + esc(f.h) + '" placeholder="칸 아래에 보일 설명"></label>' +
        '<label class="mx-sw"><input type="checkbox" data-f="req"' + (f.req ? ' checked' : '') + '><i></i>필수</label></div>' +
      (f.t === 'select' ? '<div class="mx-row-opt"><label class="mx-fld"><span>선택지 (/ 로 구분, 2개 이상)</span><input type="text" data-f="oText" value="' + esc(f.oText || '') + '" placeholder="예: 신규 / 갱신 / 해지"></label></div>' : '') +
      (f.t === 'amount' ? '<div class="mx-row-opt"><label class="mx-fld" style="max-width:160px"><span>단위 (선택)</span><input type="text" data-f="u" maxlength="6" value="' + esc(f.u || '') + '" placeholder="원"></label></div>' : '') +
    '</div>';
  }
  function sectionHtml(si, s) {
    var n = S.form.sections.length;
    return '<section class="mx-panel" data-si="' + si + '"><div class="mx-sec-h">' +
      '<label class="mx-fld"><span>묶음 이름</span><input type="text" data-s="h" maxlength="40" value="' + esc(s.h) + '" placeholder="예: 신청인 정보"></label>' +
      '<button type="button" class="mx-ic" data-a="sup" title="묶음을 위로" aria-label="묶음을 위로"' + (si === 0 ? ' disabled' : '') + '>↑</button><button type="button" class="mx-ic" data-a="sdn" title="묶음을 아래로" aria-label="묶음을 아래로"' + (si === n - 1 ? ' disabled' : '') + '>↓</button>' +
      '<button type="button" class="mx-ic del" data-a="sdel" title="묶음 삭제" aria-label="묶음 삭제">✕</button></div>' +
      s.f.map(function (f, fi) { return fieldHtml(si, fi, f); }).join('') +
      '<button type="button" class="mx-btn x sm" data-a="fadd">＋ 항목 추가</button></section>';
  }
  function previewHtml() {
    var st = toStored(S.form);
    if (!st.title && !st.sections.length) return '<p class="mx-hint">항목을 추가하면 서류 화면에서 보일 모양이 여기에 나타납니다.</p>';
    return '<h3 class="mx-pv-title">' + esc(st.title || '(양식 이름)') + '</h3>' + st.sections.map(function (s) {
      return '<div class="mx-pv-sec">' + esc(s.h) + '</div><div class="mx-pv-grid">' + s.f.map(function (f) {
        return '<div class="mx-fld' + (f.t === 'long' ? ' wide' : '') + '"><span>' + esc(f.l) + (f.req ? '<em>*</em>' : '') + '</span><div>' + (f.t === 'select' ? esc((f.o || []).join(' · ')) : f.t === 'date' ? '연도 · 월 · 일' : f.t === 'amount' ? esc(f.u || '') : '') + '</div></div>';
      }).join('') + '</div>';
    }).join('') + (st.attach.length ? '<div class="mx-pv-sec">첨부서류</div><div class="mx-chips">' + st.attach.map(function (a) { return '<span class="mx-chip" style="padding-right:12px">' + esc(a) + '</span>'; }).join('') + '</div>' : '');
  }
  function chatHtml() {
    var empty = !S.chat.length;
    var sugg = _pure.count(S.form) ? ['항목을 더 추가해 줘', '꼭 필요한 항목에 필수 표시를 해 줘', '항목 순서를 자연스럽게 정리해 줘'] : ['임대차 계약 점검표', '회비 면제 신청서', '민원 접수 확인서'];
    return '<div class="mx-chat" id="mx-chat" aria-live="polite">' + S.chat.map(function (m) { return '<div class="mx-msg ' + m.r + '">' + esc(m.t) + '</div>'; }).join('') +
      (S.busy ? '<div class="mx-msg a"><span class="mx-spin"></span> 양식을 만들고 있습니다…</div>' : '') + '</div>' +
      (empty ? '<p class="mx-hint" style="margin-top:0">만들고 싶은 양식을 말로 설명하세요. AI가 초안을 만들어 왼쪽에 채워 드리고, 이어서 “항목 더 넣어 줘”처럼 말하면 계속 고칩니다.</p>' : '') +
      '<div class="mx-chips">' + sugg.map(function (s) { return '<button type="button" class="mx-chipbtn" data-a="sugg" data-t="' + esc(s) + '">' + esc(s) + '</button>'; }).join('') + '</div>' +
      '<div class="mx-compose"><label class="mx-fld"><span>AI에게 말하기</span><textarea id="mx-say" rows="2" maxlength="1000" placeholder="' + (_pure.count(S.form) ? '예: 보증금과 월세 항목을 추가해 줘' : '예: 사무실 임대차 계약 점검표를 만들어 줘') + '"' + (S.busy ? ' disabled' : '') + '></textarea></label>' +
      '<button type="button" class="mx-btn f" data-a="say"' + (S.busy ? ' disabled' : '') + '>보내기</button></div>' +
      '<div style="margin-top:10px"><button type="button" class="mx-btn o sm" data-a="file"' + (S.busy ? ' disabled' : '') + '>📎 양식 파일 올리기 (이미지·PDF)</button> <button type="button" class="mx-btn x sm" data-a="undo"' + (S.undo ? '' : ' disabled') + '>↶ AI 변경 되돌리기</button></div>' +
      '<p class="mx-hint">올린 양식 파일은 항목 구조만 읽어 빈 양식으로 옮깁니다. 파일에 적힌 이름·번호 같은 값은 옮기지 않습니다. AI가 만든 초안은 꼭 훑어보고 고쳐 쓰세요.</p>';
  }
  function render() {
    var el = $('mf-editor'); if (!el || !S) return;
    var f = S.form, start = _pure.isEmpty(f) && !S.chat.length && !S.started;
    el.innerHTML =
      '<div class="mx-bar"><button type="button" class="mx-btn x" data-a="back">← 목록</button><h2>' + (S.id ? '양식 고치기' : '새 양식 만들기') + '</h2>' +
        '<label class="mx-fld" style="min-width:170px"><span>분야</span><select data-s="site">' + siteOptions(S.site) + '</select></label>' +
        '<button type="button" class="mx-btn f" data-a="save">저장</button></div>' +
      (S.fromFile ? '<div class="mx-from">📎 올린 양식 파일 「' + esc(S.fromFile) + '」에서 시작했습니다.</div>' : '') +
      (start ? '<div class="mx-start">' +
        '<button type="button" class="mx-card-btn" data-a="scratch"><i>✏️</i><b>처음부터 만들기</b><span>묶음과 항목을 하나씩 추가하며 직접 구성합니다.</span></button>' +
        '<button type="button" class="mx-card-btn" data-a="file"><i>📎</i><b>양식 파일 올려 고치기</b><span>이미지·PDF 양식을 올리면 AI가 항목을 읽어 초안을 만들고, 그 위에서 고칩니다.</span></button>' +
        '<button type="button" class="mx-card-btn" data-a="aistart"><i>✨</i><b>AI와 대화로 만들기</b><span>어떤 양식인지 말로 설명하면 AI가 초안을 만들고, 대화로 계속 고칩니다.</span></button></div>' : '') +
      '<div class="mx-cols"><div>' +
        '<div class="mx-panel"><label class="mx-fld title"><span>양식 이름</span><input type="text" data-s="title" maxlength="80" value="' + esc(f.title) + '" placeholder="예: 사무실 임대차 점검표"></label></div>' +
        f.sections.map(function (s, i) { return sectionHtml(i, s); }).join('') +
        '<div class="mx-foot"><button type="button" class="mx-btn t" data-a="sadd"' + (f.sections.length >= LIMITS.sections ? ' disabled' : '') + '>＋ 묶음 추가</button></div>' +
        '<div class="mx-panel" style="margin-top:14px"><h4 class="mx-h3">첨부서류 (선택)</h4><div class="mx-chips">' +
          f.attach.map(function (a, i) { return '<span class="mx-chip">' + esc(a) + '<button type="button" data-a="adel" data-i="' + i + '" aria-label="삭제">✕</button></span>'; }).join('') + '</div>' +
          '<div class="mx-compose"><label class="mx-fld"><span>첨부서류 이름</span><input type="text" id="mx-att" maxlength="60" placeholder="예: 신분증 사본"></label><button type="button" class="mx-btn o" data-a="aadd">추가</button></div></div>' +
      '</div><div>' +
        '<div class="mx-panel"><div class="mx-tabs" role="tablist"><button type="button" class="mx-tab" role="tab" data-a="tab" data-t="ai" aria-selected="' + (S.tab === 'ai') + '">✨ AI 도우미</button><button type="button" class="mx-tab" role="tab" data-a="tab" data-t="pv" aria-selected="' + (S.tab === 'pv') + '">미리보기</button></div>' +
          '<div id="mx-tabbody">' + (S.tab === 'ai' ? chatHtml() : previewHtml()) + '</div></div>' +
      '</div></div>' +
      '<div class="mx-err" id="mx-err" role="alert"></div>' +
      '<div class="mx-foot"><button type="button" class="mx-btn f" data-a="save">저장</button><button type="button" class="mx-btn o" data-a="back">취소</button></div>' +
      '<input type="file" id="mx-file" accept="image/*,.pdf,application/pdf" hidden>';
    var c = $('mx-chat'); if (c) c.scrollTop = c.scrollHeight;
  }
  function refreshSide() { var b = $('mx-tabbody'); if (b) { b.innerHTML = S.tab === 'ai' ? chatHtml() : previewHtml(); var c = $('mx-chat'); if (c) c.scrollTop = c.scrollHeight; } }
  function setErr(m) { var e = $('mx-err'); if (e) e.textContent = m || ''; }

  /* ── 동작 ────────────────────────────────────────────────── */
  function applyAi(r, note) {
    S.undo = clone(S.form);
    var f = _pure.fromStored(r.form);
    if (!f.title && S.form.title) f.title = S.form.title;
    S.form = f; S.started = true;
    var secs = f.sections.length, items = _pure.count(f);
    S.chat.push({ r: 'a', t: '양식을 ' + (note || '만들었습니다') + ' (묶음 ' + secs + '개 · 항목 ' + items + '개)' + (r.note ? '\n' + r.note : '') });
    render();
  }
  async function aiTurn(prompt, file) {
    if (S.busy) return;
    if (!prompt && !file) return;
    S.busy = true; S.tab = 'ai'; setErr('');
    S.chat.push({ r: 'u', t: file ? '📎 ' + file.name + (prompt ? '\n' + prompt : '') : prompt });
    refreshSide();
    var cur = _pure.count(S.form) ? _pure.toStored(S.form) : null;
    var r = await aiAsk({ prompt: prompt, form: cur && cur.sections.length ? cur : null, file: file });
    S.busy = false;
    if (!S) return;
    if (r && r.ok && r.form) applyAi(r, file ? '파일에서 읽어 반영했습니다' : cur ? '고쳤습니다' : '만들었습니다');
    else { S.chat.push({ r: 'e', t: (r && r.msg) || '양식을 만들지 못했습니다.' }); refreshSide(); }
  }
  async function pickFile(f) {
    if (!f) return;
    var ok = /^image\//.test(f.type) || f.type === 'application/pdf' || /\.(png|jpe?g|webp|gif|pdf)$/i.test(f.name);
    if (!ok) { toast('양식은 이미지나 PDF 로 올려 주세요.'); return; }
    if (f.size > 8 * 1024 * 1024) { toast('양식은 8MB 이하만 올릴 수 있습니다.'); return; }
    var buf = await f.arrayBuffer();
    S.fromFile = S.fromFile || f.name; S.started = true;
    var mime = f.type || (/\.pdf$/i.test(f.name) ? 'application/pdf' : 'image/png');
    try { if (typeof _mfSaveUpload === 'function') _mfSaveUpload(f, buf.slice(0)); } catch (e) {}   // 올린 양식 파일도 '올려 둔 양식'에 함께 보관한다
    render();
    aiTurn('', { name: f.name.slice(0, 120), mime: mime, data: buf });
  }
  async function save() {
    var p = _pure.problem(S.form); if (p) { setErr(p); return; }
    if (typeof _dr === 'undefined' || !_dr.ready) { setErr('PDV 연결을 확인하지 못했습니다. 잠시 뒤 다시 시도해 주세요.'); return; }
    var st = _pure.toStored(S.form), id = S.id || ('form-mine-' + _mfHash(st.title + '|' + Date.now()));
    try {
      await _drCall('put', { item: { id: id, kind: 'form', box: 'mine', site: S.site, title: st.title, body: JSON.stringify(st) } });
      toast('내 서류함에 저장했습니다'); close(); try { _mfRender(); } catch (e) {}
    } catch (e) { setErr('저장하지 못했습니다. (PDV 연결 확인)'); }
  }
  function close() {
    var ed = $('mf-editor'), ls = $('mf-list');
    S = null; if (ed) { ed.hidden = true; ed.innerHTML = ''; } if (ls) ls.hidden = false;
  }
  function confirmLeave() {
    if (!S) return true;
    var dirty = !_pure.isEmpty(S.form) || S.chat.length;
    return !dirty || confirm('저장하지 않고 나갈까요? 만들던 내용이 사라집니다.');
  }

  function onClick(ev) {
    var b = ev.target.closest('[data-a]'); if (!b || !S) return;
    var a = b.getAttribute('data-a'), row = b.closest('[data-fi]'), sec = b.closest('[data-si]');
    var si = sec ? +sec.getAttribute('data-si') : -1, fi = row ? +row.getAttribute('data-fi') : -1, F = S.form;
    if (a === 'back') { if (confirmLeave()) close(); }
    else if (a === 'save') save();
    else if (a === 'scratch') { S.started = true; render(); var i = document.querySelector('#mf-editor [data-s="title"]'); if (i) i.focus(); }
    else if (a === 'aistart') { S.started = true; S.tab = 'ai'; render(); var t = $('mx-say'); if (t) t.focus(); }
    else if (a === 'file') { var fi2 = $('mx-file'); if (fi2) fi2.click(); }
    else if (a === 'tab') { S.tab = b.getAttribute('data-t'); render(); }
    else if (a === 'sadd') { if (F.sections.length < LIMITS.sections) { F.sections.push({ h: '', f: [_pure.newField()] }); S.started = true; render(); var hs = document.querySelectorAll('#mf-editor [data-s="h"]'); if (hs.length) hs[hs.length - 1].focus(); } }
    else if (a === 'sdel') { if (!F.sections[si].f.length || confirm('이 묶음과 안의 항목을 모두 지울까요?')) { F.sections.splice(si, 1); if (!F.sections.length) F.sections.push({ h: '', f: [_pure.newField()] }); render(); } }
    else if (a === 'sup') { _pure.move(F.sections, si, -1); render(); }
    else if (a === 'sdn') { _pure.move(F.sections, si, 1); render(); }
    else if (a === 'fadd') { if (_pure.count(F) < LIMITS.total && F.sections[si].f.length < LIMITS.fields) { F.sections[si].f.push(_pure.newField()); S.started = true; render(); var rows = document.querySelectorAll('#mf-editor [data-si="' + si + '"] [data-fi] [data-f="l"]'); if (rows.length) rows[rows.length - 1].focus(); } }
    else if (a === 'fdel') { F.sections[si].f.splice(fi, 1); render(); }
    else if (a === 'fup') { _pure.move(F.sections[si].f, fi, -1); render(); }
    else if (a === 'fdn') { _pure.move(F.sections[si].f, fi, 1); render(); }
    else if (a === 'aadd') { var inp = $('mx-att'), v = inp && inp.value.trim(); if (v && F.attach.length < LIMITS.attach) { F.attach.push(v.slice(0, 60)); render(); var n = $('mx-att'); if (n) n.focus(); } }
    else if (a === 'adel') { F.attach.splice(+b.getAttribute('data-i'), 1); render(); }
    else if (a === 'say') { var s = $('mx-say'), v2 = s && s.value.trim(); if (v2) { aiTurn(v2); } }
    else if (a === 'sugg') { aiTurn(b.getAttribute('data-t')); }
    else if (a === 'undo') { if (S.undo) { S.form = S.undo; S.undo = null; S.chat.push({ r: 'a', t: 'AI가 바꾼 내용을 되돌렸습니다.' }); render(); } }
  }
  function onInput(ev) {
    var t = ev.target; if (!S || !t.closest || !t.closest('#mf-editor')) return;
    var row = t.closest('[data-fi]'), sec = t.closest('[data-si]'), F = S.form;
    if (t.hasAttribute('data-f') && row) {
      var f = F.sections[+row.getAttribute('data-si')].f[+row.getAttribute('data-fi')], k = t.getAttribute('data-f');
      if (k === 'req') f.req = t.checked;
      else if (k === 't') { f.t = t.value; render(); return; }   // 종류가 바뀌면 선택지·단위 칸을 다시 그린다
      else f[k] = t.value;
      if (k === 'oText') f.o = undefined;
    } else if (t.getAttribute('data-s') === 'h' && sec) F.sections[+sec.getAttribute('data-si')].h = t.value;
    else if (t.getAttribute('data-s') === 'title') F.title = t.value;
    else if (t.getAttribute('data-s') === 'site') { S.site = t.value; }
    if (S.tab === 'pv') refreshSide();
  }
  function onKey(ev) {
    if (!S) return;
    if (ev.target.id === 'mx-say' && ev.key === 'Enter' && !ev.shiftKey && !ev.isComposing) { ev.preventDefault(); var v = ev.target.value.trim(); if (v) aiTurn(v); }
    else if (ev.target.id === 'mx-att' && ev.key === 'Enter' && !ev.isComposing) { ev.preventDefault(); var b = document.querySelector('#mf-editor [data-a="aadd"]'); if (b) b.click(); }
  }

  /* 편집기 열기 — opts.id 가 있으면 저장된 '내가 만든 양식'을, opts.upload 가 있으면 올려 둔 양식 파일을 AI 로 읽어 고친다 */
  async function open(opts) {
    opts = opts || {};
    injectCss();
    var ed = $('mf-editor'), ls = $('mf-list'); if (!ed) return;
    var site = (typeof _docHost !== 'undefined' && _docHost.id) || 'all';
    S = { id: '', site: site, form: blank(), undo: null, chat: [], busy: false, tab: 'ai', started: false, fromFile: '' };
    if (opts.id) {
      try {
        var it = (await _drCall('get', { id: opts.id })).item; var st = JSON.parse((it && it.body) || 'null');
        if (!st) throw new Error('empty');
        S.id = opts.id; S.site = it.site || site; S.form = _pure.fromStored(st); S.started = true; S.tab = 'pv';
      } catch (e) { S = null; toast('양식을 불러오지 못했습니다.'); return; }
    }
    if (ls) ls.hidden = true; ed.hidden = false;
    if (!ed.__bound) { ed.__bound = true; ed.addEventListener('click', onClick); ed.addEventListener('input', onInput); ed.addEventListener('change', function (e) { if (e.target.id === 'mx-file') { var f = (e.target.files || [])[0]; e.target.value = ''; pickFile(f); } else onInput(e); }); ed.addEventListener('keydown', onKey); }
    render();
    aiLoad(S.site);   // AI 틀을 미리 열어 둔다(첫 요청이 빨라진다)
    if (opts.upload && opts.upload.data) {
      var u = opts.upload; S.started = true; S.fromFile = u.name || '양식 파일'; render();
      aiTurn('', { name: String(u.name || '양식').slice(0, 120), mime: u.mime || 'application/pdf', data: u.data });
    }
  }

  root.MyForms = { open: open, close: function () { if (S && !confirmLeave()) return false; close(); return true; }, isOpen: function () { return !!S; }, _pure: _pure };
})(typeof window !== 'undefined' ? window : this);
