/* ═════════════════════════════════════════════════
   task-links.js — 메일·서류를 과제에 연결한 기록(2026-11-28)
   - 연결은 이 기기(브라우저 localStorage)에만 둔다. 서버로 보내지 않으며 다른 기기와 맞추지 않는다.
   - 저장하는 것: 자료 번호, 과제 번호, 자료·과제 제목, 종류, 연결한 시각. 본문은 저장하지 않는다.
   - 자료 번호: 'mail:<메일 id>' · 'sdraft:<임시보관 id>' · 'doc:<PDV 서류 id>'
   ═════════════════════════════════════════════════ */
(function (root) {
  'use strict';
  var KEY = 'navi_task_links_v1', PKEY = 'navi_task_links_pending_v1', PEND_TTL = 10 * 60000;
  var mem = {};
  function read(k, fallback) {
    try { var v = JSON.parse(root.localStorage.getItem(k) || 'null'); if (v) return v; } catch (e) { if (mem[k]) return mem[k]; }
    return fallback;
  }
  function write(k, v) {
    try { root.localStorage.setItem(k, JSON.stringify(v)); delete mem[k]; return true; } catch (e) { mem[k] = v; return false; }
  }
  function all() { return read(KEY, {}); }
  function get(item) { return all()[item] || null; }
  /** 자료를 과제에 연결한다(자료 하나는 과제 하나에만). 반환 false = 저장하지 못해 이번에만 유지 */
  function set(item, task, info, now) {
    if (!item || !task) return false;
    var m = all();
    m[item] = { task: String(task), kind: (info && info.kind) || String(item).split(':')[0], label: String((info && info.label) || '').slice(0, 120), box: (info && info.box) || '', taskTitle: String((info && info.taskTitle) || '').slice(0, 120), at: now || Date.now() };
    return write(KEY, m);
  }
  function remove(item) { var m = all(); if (!m[item]) return; delete m[item]; write(KEY, m); }
  /** 한 과제에 연결된 자료 [{item, kind, label, box, at}] — 최근에 연결한 것이 먼저 */
  function forTask(task) {
    var m = all();
    return Object.keys(m).filter(function (k) { return m[k].task === task; }).map(function (k) { return Object.assign({ item: k }, m[k]); }).sort(function (a, b) { return b.at - a.at; });
  }
  function counts(task) {
    var c = { mail: 0, doc: 0 };
    forTask(task).forEach(function (x) { if (x.item.indexOf('doc:') === 0) c.doc++; else c.mail++; });
    return c;
  }
  /** 과제를 지우면 그 과제의 연결도 지운다(자료는 남는다). */
  function dropTask(task) { var m = all(), n = 0; Object.keys(m).forEach(function (k) { if (m[k].task === task) { delete m[k]; n++; } }); if (n) write(KEY, m); return n; }
  /** 보낸 직후에는 메일 번호를 모를 수 있다: 제목과 보낸 시각을 적어 두었다가 보낸메일함을 불러올 때 맞춘다. */
  function pend(task, subject, now) {
    if (!task || !subject) return;
    var t = now || Date.now(), list = read(PKEY, []).filter(function (p) { return t - p.at < PEND_TTL; });
    list.push({ task: task, subject: String(subject), at: t });
    write(PKEY, list.slice(-20));
  }
  /** items = [{id, subject, created}] (보낸메일함). 제목이 같고 보낸 시각이 2분 안인 메일 하나에만 연결한다. */
  function matchPending(items, now) {
    var t = now || Date.now(), list = read(PKEY, []), rest = [], done = 0;
    if (!list.length) return 0;
    list.forEach(function (p) {
      var hits = (items || []).filter(function (m) { var c = Date.parse(String(m.created || '').replace(' ', 'T')); return String(m.subject || '') === p.subject && !isNaN(c) && Math.abs(c - p.at) <= 2 * 60000 && !get('mail:' + m.id); });
      if (hits.length === 1) { set('mail:' + hits[0].id, p.task, { kind: 'mail', label: p.subject, box: 'sent' }, t); done++; }
      else if (t - p.at < PEND_TTL) rest.push(p);
    });
    write(PKEY, rest);
    return done;
  }
  var api = { get: get, set: set, remove: remove, forTask: forTask, counts: counts, dropTask: dropTask, pend: pend, matchPending: matchPending, all: all, _KEY: KEY };
  root.TaskLinks = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
