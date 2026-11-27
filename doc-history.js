// doc-history.js — '서류 탭의 작성·제출 이력' (2026-11-26)
// 이력은 이 기기의 PDV(kind='history')에만 둔다. 서류·업무 이름, 기관, 상태, 경과 시각, 받은 파일만 담고 사용자가 입력한 값은 넣지 않는다.
// proc 는 새로 수립해 쓴 절차(개인 자료 없음) — 접수가 확인되면 공용 절차 DB 에 초안으로 올리는 데만 쓴다.
(function (root) {
  'use strict';
  var STATES = {
    running: '도우미 진행 중', upload: '올리기를 도우미에 맡김', issued: '발급 완료',
    reported: '제출·접수 (도우미 보고)', filed: '제출·접수 (직접 표시)', failed: '마치지 못함', written: '작성 완료'
  };
  var DONE = { issued: 1, reported: 1, filed: 1 };
  function parse(body) {
    try { var d = JSON.parse(body || '{}'); if (d && STATES[d.state]) { d.events = Array.isArray(d.events) ? d.events : []; return d; } } catch (e) { /* 아래 기본값 */ }
    return { type: 'filing', state: 'running', events: [] };
  }
  function make(id, o, now) {
    var data = { type: o.type === 'issue' || o.type === 'upload' ? o.type : 'filing', state: o.state || 'running', events: [{ t: now, s: o.state || 'running' }] };
    if (o.proc) data.proc = o.proc;
    return { id: id, kind: 'history', title: String(o.title || '서류').slice(0, 120), subject: String(o.agency || '').slice(0, 300), body: JSON.stringify(data) };
  }
  // 끝난 일(발급·접수)은 뒤늦은 '실패'나 '진행 중'으로 되돌리지 않는다. 바뀐 것이 없으면 null.
  function advance(data, state, now) {
    if (!STATES[state] || data.state === state || (DONE[data.state] && !DONE[state])) return null;
    return Object.assign({}, data, { state: state, events: data.events.concat([{ t: now, s: state }]).slice(-30) });
  }
  function canMarkFiled(data) { return data.type !== 'issue' && !DONE[data.state] && data.state !== 'written'; }
  // PDV 목록(요약)에는 body 가 없으므로, 부른 쪽이 전체 항목(full)을 넘긴다. 작성한 서류(kind=doc, done)도 이력에 함께 보인다.
  function rows(full, doneDocs) {
    var a = (full || []).map(function (it) { var d = parse(it.body); return { id: it.id, source: 'history', title: it.title, agency: it.subject || '', state: d.state, label: STATES[d.state], at: it.updated || 0, hasFile: !!it.fileData, canMark: canMarkFiled(d) }; });
    var b = (doneDocs || []).map(function (it) { return { id: it.id, source: 'doc', title: it.title, agency: '', state: 'written', label: STATES.written, at: it.updated || 0, hasFile: !!(it.hasFile || it.extraCount), canMark: false }; });
    return a.concat(b).sort(function (x, y) { return y.at - x.at; });
  }
  var api = { STATES: STATES, parse: parse, make: make, advance: advance, canMarkFiled: canMarkFiled, rows: rows };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.DocHistory = api;
})(typeof window !== 'undefined' ? window : null);
