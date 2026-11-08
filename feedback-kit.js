/* 사용자 제보 도구 — 서류 화면의 "문제 알리기"(⚑)·서류 요청·오류 신고를 한 곳에서 받는다.
 * 보내는 곳은 기존 혼디 제보 창구(POST /user-feedback/submit — 익명 허용). 받은 제보는 scripts/feedback-digest.mjs 로 묶어 카탈로그·서식 개선에 쓴다.
 * 원칙: 사용자가 쓴 글과 서류 이름만 보낸다. 주민번호·전화·이메일·긴 숫자는 보내기 전에 지운다. 하루 보낼 수 있는 건수를 제한한다.
 */
(function (root) {
  'use strict';
  var ENDPOINT = 'https://hondi-proxy.tensor-city.workers.dev';
  var DAILY_LIMIT = 10, TEXT_MAX = 600, LABEL_MAX = 80;
  // 종류 → 말머리(분류용)·제보 분류(서버: bug | feature_request | complaint | praise | question)
  var KINDS = {
    attach: { tag: 'attach', cat: 'bug', title: '첨부서류 문제 알리기' },
    newdoc: { tag: 'newdoc', cat: 'feature_request', title: '찾는 서류가 없어요' },
    bug:    { tag: 'bug', cat: 'bug', title: '오류·불편 신고' },
    report: { tag: 'report', cat: 'bug', title: '오류 신고와 제안' }   // 서류 화면 위·아래 오른쪽 버튼 — 유형(bug|idea)을 고른다
  };
  var PROBLEMS = [
    ['agency', '기관이 달라요(다른 곳에서 발급해요)'],
    ['fail', '도우미가 가져오지 못해요(오류)'],
    ['own', '이 서류는 직접 준비하는 서류예요'],
    ['missing', '버튼이 없는데 도우미가 가져올 수 있어요'],
    ['other', '그 밖의 문제']
  ];

  /** 개인정보로 보이는 것(이메일·전화·긴 숫자·주민번호 모양)을 지우고 길이를 줄인다. */
  function clean(s, max) {
    var t = String(s == null ? '' : s).normalize('NFKC').replace(/[\u0000-\u001f]+/g, ' ');
    t = t.replace(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g, '[이메일]').replace(/https?:\/\/\S+/gi, '[주소]')
         .replace(/\b\d{6}\s*-?\s*[1-8]\d{6}\b/g, '[번호]').replace(/\b0\d{1,2}[-\s]?\d{3,4}[-\s]?\d{4}\b/g, '[전화]').replace(/\d{7,}/g, '[번호]');
    return t.replace(/\s+/g, ' ').trim().slice(0, max || TEXT_MAX);
  }
  /** 보낼 본문을 만든다. 첫머리의 "[naviweb:<종류>]" 말머리로 digest 가 묶는다. */
  function build(kind, f, ctx) {
    var k = KINDS[kind]; if (!k) return null;
    f = f || {}; ctx = ctx || {};
    var parts = [];
    var label = clean(f.label, LABEL_MAX); if (label) parts.push('서류=' + label);
    if (kind === 'attach') { var p = PROBLEMS.filter(function (x) { return x[0] === f.problem; })[0]; if (!p) return null; parts.push('문제=' + p[0]); }
    if (kind === 'report') { if (f.type !== 'bug' && f.type !== 'idea') return null; parts.push('유형=' + f.type); }
    var right = clean(f.right, LABEL_MAX); if (right) parts.push('올바른기관=' + right);
    var use = clean(f.use, 200); if (use) parts.push('용도=' + use);
    var text = clean(f.text, TEXT_MAX); if (text) parts.push('내용=' + text);
    if (kind === 'newdoc' && !label) return null;
    if ((kind === 'bug' || kind === 'report') && !text) return null;
    if (kind === 'attach' && !label) return null;
    var cs = [];
    ['doc', 'rule', 'ext', 'screen', 'dev'].forEach(function (n) { var v = clean(ctx[n], 80); if (v) cs.push(n + '=' + v); });
    var cat = (kind === 'attach' && f.problem === 'missing') || (kind === 'report' && f.type === 'idea') ? 'feature_request' : k.cat;
    return { raw_text: '[naviweb:' + k.tag + '] ' + parts.join(' | '), context_sp: 'naviweb-feedback', context_summary: cs.join('; ').slice(0, 480), category: cat, guid: null };
  }
  /** 기기마다 무작위로 만든 제보자 표식(개인정보 아님) — 한 사람이 같은 제보를 여러 번 보내도 집계에서 1명으로 센다. */
  function devId(store) {
    try { var v = store.getItem('navi_fb_dev'); if (!v) { v = Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4); store.setItem('navi_fb_dev', v); } return v; } catch (e) { return ''; }
  }
  function today() { return new Date().toISOString().slice(0, 10); }
  function quotaOk(store) {
    try { var d = JSON.parse(store.getItem('navi_fb_q') || '{}'); if (d.d !== today()) d = { d: today(), n: 0 }; return d.n < DAILY_LIMIT; } catch (e) { return true; }
  }
  function quotaUse(store) {
    try { var d = JSON.parse(store.getItem('navi_fb_q') || '{}'); if (d.d !== today()) d = { d: today(), n: 0 }; d.n++; store.setItem('navi_fb_q', JSON.stringify(d)); } catch (e) { /* 저장 불가 */ }
  }
  /** 제보 보내기 → Promise<{ ok, code }>. code: sent | invalid | limit | fail */
  function send(kind, fields, ctx, opts) {
    opts = opts || {};
    var body = build(kind, fields, ctx); if (!body) return Promise.resolve({ ok: false, code: 'invalid' });
    var store = opts.store || (typeof localStorage !== 'undefined' ? localStorage : { getItem: function () { return null; }, setItem: function () {} });
    if (!quotaOk(store)) return Promise.resolve({ ok: false, code: 'limit' });
    var f = opts.fetch || (typeof fetch !== 'undefined' ? fetch : null); if (!f) return Promise.resolve({ ok: false, code: 'fail' });
    ctx = Object.assign({}, ctx || {}); ctx.dev = devId(store);
    body = build(kind, fields, ctx);
    return f((opts.endpoint || ENDPOINT) + '/user-feedback/submit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      .then(function (r) { if (r && r.ok) { quotaUse(store); return { ok: true, code: 'sent' }; } return { ok: false, code: 'fail' }; })
      .catch(function () { return { ok: false, code: 'fail' }; });
  }

  // ── 화면: 작은 대화상자 ──
  var box = null;
  function el(tag, attrs, kids) {
    var e = document.createElement(tag), k;
    for (k in (attrs || {})) { if (k === 'text') e.textContent = attrs[k]; else if (k === 'class') e.className = attrs[k]; else e.setAttribute(k, attrs[k]); }
    (kids || []).forEach(function (c) { e.appendChild(c); });
    return e;
  }
  function close() { if (box) { box.remove(); box = null; } }
  /** opts: { kind:'attach'|'newdoc'|'bug', label?, text?, ctx?:{doc,rule,ext,screen}, onSent? } */
  function open(opts) {
    opts = opts || {}; close();
    var kind = KINDS[opts.kind] ? opts.kind : 'bug', k = KINDS[kind], ctx = opts.ctx || {};
    var wrap = el('div', { class: 'nfb-wrap', role: 'dialog', 'aria-modal': 'true', 'aria-label': k.title });
    var card = el('div', { class: 'nfb-card' });
    var st = document.createElement('style');
    st.textContent = '.nfb-wrap{position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center;padding:16px}.nfb-card{background:#fff;color:#1b1f24;border-radius:12px;max-width:440px;width:100%;padding:20px;box-shadow:0 12px 40px rgba(0,0,0,.25);font:14px/1.5 system-ui,"Malgun Gothic",sans-serif;max-height:90vh;overflow:auto}.nfb-card h2{margin:0 0 4px;font-size:17px}.nfb-card p{margin:0 0 12px;color:#5a6472;font-size:13px}.nfb-card label{display:block;margin:10px 0 4px;font-weight:600;font-size:13px}.nfb-card input[type=text],.nfb-card textarea{width:100%;box-sizing:border-box;border:1px solid #c9d1db;border-radius:8px;padding:8px 10px;font:inherit}.nfb-card .r{display:flex;gap:8px;align-items:flex-start;margin:4px 0;font-weight:400}.nfb-card .r input{margin-top:3px}.nfb-row{display:flex;gap:8px;justify-content:flex-end;margin-top:16px}.nfb-row button{font:inherit;border-radius:8px;padding:8px 16px;cursor:pointer;border:1px solid #c9d1db;background:#fff}.nfb-row button.p{background:#2f6bc4;border-color:#2f6bc4;color:#fff}.nfb-msg{margin-top:10px;font-size:13px;color:#b42318}.nfb-ok{color:#15803d}@media(prefers-color-scheme:dark){.nfb-card{background:#1f242b;color:#e8ebef}.nfb-card input[type=text],.nfb-card textarea{background:#171b21;color:#e8ebef;border-color:#3b4450}.nfb-row button{background:#1f242b;color:#e8ebef;border-color:#3b4450}}';
    card.appendChild(st);
    card.appendChild(el('h2', { text: k.title }));
    card.appendChild(el('p', { text: kind === 'attach' ? '“' + clean(opts.label, LABEL_MAX) + '” 항목에 대해 알려 주세요. 개인정보는 적지 마세요.' : kind === 'newdoc' ? '작성하고 싶은 서류 이름과 쓰임새를 알려 주세요. 많이 요청된 서류부터 추가합니다.'       : kind === 'report' ? '오류가 있었는지, 바라는 점이 있는지 골라서 적어 주세요. 주민번호·전화번호 등 개인정보는 적지 마세요.' : '무슨 일이 있었는지 적어 주세요. 주민번호·전화번호 등 개인정보는 적지 마세요.' }));
    var inputs = {};
    if (kind === 'attach') {
      PROBLEMS.forEach(function (p, i) { var rb = el('input', { type: 'radio', name: 'nfb-problem', value: p[0] }); if (opts.problem ? opts.problem === p[0] : i === 0) rb.checked = true; inputs['p_' + p[0]] = rb; card.appendChild(el('label', { class: 'r' }, [rb, el('span', { text: p[1] })])); });
      card.appendChild(el('label', { text: '올바른 발급 기관 (아시면)' })); inputs.right = el('input', { type: 'text', maxlength: '80', placeholder: '예) 정부24, 대법원 전자가족관계등록시스템' }); inputs.right.value = clean(opts.right, LABEL_MAX); card.appendChild(inputs.right);
    }
    if (kind === 'report') {
      [['bug', '오류 신고 — 잘못되었거나 안 되는 것'], ['idea', '제안 — 바라는 점·아이디어']].forEach(function (p, i) { var rb = el('input', { type: 'radio', name: 'nfb-type', value: p[0] }); if (i === 0) rb.checked = true; inputs['t_' + p[0]] = rb; card.appendChild(el('label', { class: 'r' }, [rb, el('span', { text: p[1] })])); });
    }
    if (kind === 'newdoc') {
      card.appendChild(el('label', { text: '서류 이름' })); inputs.label = el('input', { type: 'text', maxlength: '80', placeholder: '예) 지급명령 신청서' }); inputs.label.value = clean(opts.label, LABEL_MAX); card.appendChild(inputs.label);
      card.appendChild(el('label', { text: '어디에 제출하나요? (선택)' })); inputs.use = el('input', { type: 'text', maxlength: '120', placeholder: '예) 법원, 구청, 세무서' }); card.appendChild(inputs.use);
    }
    card.appendChild(el('label', { text: kind === 'bug' || kind === 'report' ? '내용' : '자세한 설명 (선택)' }));
    inputs.text = el('textarea', { rows: '3', maxlength: String(TEXT_MAX) }); inputs.text.value = clean(opts.text, TEXT_MAX); card.appendChild(inputs.text);
    var msg = el('div', { class: 'nfb-msg', role: 'status' }); card.appendChild(msg);
    card.appendChild(el('p', { text: '베타 테스트 기간에는 제보가 채택되면 중요도에 따라 GDC로 보상합니다.' }));
    var cancel = el('button', { type: 'button', text: '닫기' }), go = el('button', { type: 'button', class: 'p', text: '보내기' });
    cancel.onclick = close;
    go.onclick = function () {
      var f = { label: kind === 'newdoc' ? inputs.label.value : opts.label, text: inputs.text.value, right: inputs.right && inputs.right.value, use: inputs.use && inputs.use.value };
      if (kind === 'report') f.type = inputs.t_bug.checked ? 'bug' : 'idea';
      if (kind === 'attach') { PROBLEMS.forEach(function (p) { if (inputs['p_' + p[0]].checked) f.problem = p[0]; }); }
      go.disabled = true; msg.className = 'nfb-msg'; msg.textContent = '보내는 중…';
      send(kind, f, ctx).then(function (r) {
        if (r.ok) { msg.className = 'nfb-msg nfb-ok'; msg.textContent = '알려 주셔서 감사합니다. 살펴보고 반영하겠습니다.'; if (opts.onSent) try { opts.onSent(r); } catch (e) {} setTimeout(close, 1600); return; }
        go.disabled = false; msg.textContent = r.code === 'invalid' ? (kind === 'bug' || kind === 'report' ? '내용을 적어 주세요.' : kind === 'newdoc' ? '서류 이름을 적어 주세요.' : '항목을 선택해 주세요.') : r.code === 'limit' ? '오늘 보낼 수 있는 제보 수를 넘었습니다. 내일 다시 알려 주세요.' : '보내지 못했습니다. 잠시 뒤 다시 시도해 주세요.';
      });
    };
    card.appendChild(el('div', { class: 'nfb-row' }, [cancel, go]));
    wrap.appendChild(card); wrap.addEventListener('click', function (e) { if (e.target === wrap) close(); });
    wrap.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });
    document.body.appendChild(wrap); box = wrap;
    var first = card.querySelector('input,textarea'); if (first) first.focus();
  }
  /** 대화창에 "신고:", "서류 요청:", "제안:" 으로 시작해 쓴 말 → 제보 창구로(AI 를 거치지 않는다). 해당하지 않으면 null. */
  function fromChat(text) {
    var m = /^\s*(신고|오류\s*신고|버그|서류\s*요청|서류\s*추가|제안)\s*[:：]\s*([\s\S]*)$/.exec(String(text || ''));
    if (!m) return null;
    var w = m[1].replace(/\s+/g, '');
    return { kind: /서류/.test(w) ? 'newdoc' : w === '제안' ? 'idea' : 'bug', text: clean(m[2], TEXT_MAX) };
  }

  var api = { build: build, clean: clean, send: send, open: open, close: close, fromChat: fromChat, KINDS: KINDS, PROBLEMS: PROBLEMS, DAILY_LIMIT: DAILY_LIMIT };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.NaviFeedback = api;
})(typeof window !== 'undefined' ? window : this);
