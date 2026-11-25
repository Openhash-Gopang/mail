// task-flow.js — 표준 절차(승인된 것 또는 새로 수립한 것)를 사용자 안내와 도우미 작업으로 바꾼다 (2026-11-26, 3단계)
(function (root) {
  'use strict';
  function steps(p) { return Array.isArray(p && p.steps) ? p.steps : []; }
  function line(s, i) { return (i + 1) + '. [' + (s.actor === 'user' ? '직접' : '도우미') + '] ' + s.action + (s.submit ? ' (제출 전 확인)' : ''); }
  // res: { source:'db'|'web', procedure, term_note?, questions? }
  function planMarkdown(res) {
    var p = res.procedure, out = [];
    out.push(res.source === 'db'
      ? '**저장된 절차를 사용합니다** (관리자 승인, ' + p.version + '판, 확인일 ' + (p.verified_at || '기록 없음') + ')' + (p.needs_recheck ? '\n\n접수가 확인되지 않았거나 확인한 지 오래된 절차입니다. 진행하면서 공식 화면과 다른지 확인합니다.' : '')
      : '**새로 수립한 계획입니다.** 웹의 공공기관 자료로 만든 것이며 아직 검토되지 않았습니다. 실제 화면과 다를 수 있습니다.');
    if (res.term_note) out.push(res.term_note);
    out.push('- 처리 기관: ' + p.agency + (p.legal_kind ? ' (' + p.legal_kind + ')' : ''));
    if (p.legal_basis) out.push('- 근거: ' + p.legal_basis);
    if ((p.required_fields || []).length) out.push('- 입력할 항목: ' + p.required_fields.join(', '));
    if ((p.documents || []).length) out.push('- 첨부서류: ' + p.documents.join(', '));
    out.push(steps(p).map(line).join('\n'));
    if ((res.questions || []).length) out.push('**확인할 사항** (답을 입력하시면 도우미에게 전달합니다)\n' + res.questions.map(function (q) { return '- ' + q; }).join('\n'));
    if ((p.sources || []).length) out.push('출처\n' + p.sources.slice(0, 5).map(function (s) { return '- ' + (s.title ? s.title + ' — ' : '') + s.url; }).join('\n'));
    return out.join('\n\n');
  }
  // 도우미 작업 목표(확장이 2000자에서 자르므로 절차 부분은 1200자 안에 담는다)
  function planGoal(res) {
    var p = res.procedure;
    var head = '처리 기관: ' + p.agency + '. 아래는 ' + (res.source === 'db' ? '저장된' : '아직 검토되지 않은') + ' 절차이며 참고용입니다. 실제 공식 화면과 다르면 화면을 따르고 차이를 사용자에게 알리세요.'
      + ((res.questions || []).length ? '\n먼저 사용자에게 확인: ' + res.questions.join(' / ') : '') + '\n';
    var body = steps(p).map(line).join('\n') + ((p.required_fields || []).length ? '\n입력 항목: ' + p.required_fields.join(', ') : '') + ((p.documents || []).length ? '\n첨부서류: ' + p.documents.join(', ') : '');
    return (head + body + '\n업무: ').slice(0, 1200);
  }
  function toPlan(res) { return { playbook: '', url: res.procedure.entry_url, goal: planGoal(res), agency: res.procedure.agency, proc: res.source === 'web' ? res.procedure : null }; }
  var api = { planMarkdown: planMarkdown, planGoal: planGoal, toPlan: toPlan };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.TaskFlow = api;
})(typeof window !== 'undefined' ? window : null);
