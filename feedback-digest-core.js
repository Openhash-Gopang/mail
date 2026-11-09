/* 사용자 제보 집계 코어 — Node(scripts/feedback-digest.mjs)와 브라우저(admin.html 제보 보고함)가 함께 쓴다.
 * 각 기록의 raw_text 첫머리가 "[naviweb:<종류>]" 인 것만 쓴다. 종류: attach · newdoc · bug · report · auto(도우미가 가져오지 못했을 때의 자동 보고: 서류 이름·사유 코드만). */
(function (root) {
  'use strict';
  var norm = function (s) { return String(s == null ? '' : s).normalize('NFKC').toLowerCase().replace(/[\s·.,:;!?()[\]{}<>\-_/\\'"“”‘’~]/g, ''); };
  function parse(raw) {
    var m = /^\[naviweb:(attach|newdoc|bug|report|auto)\]\s*([\s\S]*)$/.exec(String(raw || '')); if (!m) return null;
    var f = { kind: m[1] };
    m[2].split(' | ').forEach(function (part) { var i = part.indexOf('='); if (i > 0) f[part.slice(0, i).trim()] = part.slice(i + 1).trim(); });
    return f;
  }
  function digest(records, opts) {
    var min = (opts && opts.min) || 3, groups = new Map(), autos = new Map(), bugs = [], ideas = [];
    var list = (Array.isArray(records) ? records : records && records.items) || [];
    list.forEach(function (r) {
      var f = parse(r.raw_text); if (!f) return;
      var dev = /(?:^|; )dev=([^;]+)/.exec(r.context_summary || '');
      var who = (dev && dev[1]) || r.guid || r.id || Math.random().toString(36);
      if (f.kind === 'report') {   // 서류 화면의 "오류 신고와 제안" 버튼 — 유형이 idea 면 제안, 아니면 오류 신고
        var item = { text: (f['서류'] ? '[' + f['서류'] + '] ' : '') + (f['내용'] || ''), ctx: r.context_summary || '', id: r.id || '', at: r.created || '' };
        (f['유형'] === 'idea' ? ideas : bugs).push(item); return;
      }
      if (f.kind === 'bug') { bugs.push({ text: f['내용'] || '', ctx: r.context_summary || '', id: r.id || '', at: r.created || '' }); return; }
      var label = f['서류'] || ''; if (!label) return;
      if (f.kind === 'auto') {   // 도우미가 가져오지 못한 서류(자동 보고) — 서류 이름·사유 코드·규칙만
        var reason = f['사유'] || 'FETCH_FAILED', ak = ['auto', norm(label), reason].join('\n');
        var a = autos.get(ak) || { label: label, reason: reason, rule: f['규칙'] || '', agency: f['기관'] || '', users: new Set() };
        a.users.add(who); autos.set(ak, a); return;
      }
      var key = [f.kind, norm(label), f['문제'] || ''].join('\n');
      var g = groups.get(key) || { kind: f.kind, label: label, problem: f['문제'] || '', users: new Set(), rights: new Map(), notes: [] };
      g.users.add(who);
      if (f['올바른기관']) g.rights.set(f['올바른기관'], (g.rights.get(f['올바른기관']) || 0) + 1);
      if (f['내용'] && g.notes.length < 3) g.notes.push(f['내용']);
      groups.set(key, g);
    });
    var rows = Array.from(groups.values()).map(function (g) { return Object.assign({}, g, { n: g.users.size, action: g.users.size >= min }); }).sort(function (a, b) { return b.n - a.n; });
    var auto = Array.from(autos.values()).map(function (g) { return Object.assign({}, g, { n: g.users.size, action: g.reason === 'FETCH_FAILED' && g.users.size >= min }); }).sort(function (a, b) { return b.n - a.n; });
    return { attach: rows.filter(function (g) { return g.kind === 'attach'; }), newdoc: rows.filter(function (g) { return g.kind === 'newdoc'; }), bugs: bugs, ideas: ideas, auto: auto, min: min };
  }
  var api = { parse: parse, digest: digest, norm: norm };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.FeedbackDigest = api;
})(typeof window !== 'undefined' ? window : this);
