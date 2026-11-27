// task-flow.js — 표준 절차(승인된 것 또는 새로 수립한 것)를 사용자 안내와 도우미 작업으로 바꾼다 (2026-11-26, 3단계)
(function (root) {
  'use strict';
  function steps(p) { return Array.isArray(p && p.steps) ? p.steps : []; }
  // 사용자가 직접 하는 일은 로그인·본인인증·서명·결제·동의·승인뿐이다. 계획에 '직접'이라고 적혀 와도 이 밖의 단계는 도우미가 한다(2026-11-27: 모든 단계가 '직접'으로 표시된 계획이 있었다).
  var USER_ONLY = /로그인|본인\s*(인증|확인)|인증서|간편\s*인증|전자\s*서명|서명|결제|납부|동의|승인|보안\s*문자/;
  function actorOf(s) { return USER_ONLY.test(String(s.action || '')) ? 'user' : 'helper'; }
  function line(s, i) { return (i + 1) + '. [' + (actorOf(s) === 'user' ? '직접' : '도우미') + '] ' + s.action + (s.submit ? ' (제출 전 확인)' : ''); }
  // res: { source:'db'|'mine'|'web', procedure, term_note?, questions?, reused? }
  function planMarkdown(res) {
    var p = res.procedure, out = [];
    out.push(res.source === 'db'
      ? '**저장된 절차를 사용합니다** (관리자 승인, ' + p.version + '판, 확인일 ' + (p.verified_at || '기록 없음') + ')' + (p.needs_recheck ? '\n\n접수가 확인되지 않았거나 확인한 지 오래된 절차입니다. 진행하면서 공식 화면과 다른지 확인합니다.' : '')
      : res.source === 'mine' ? '**전에 이 기기에서 성공한 절차를 다시 씁니다.** 화면이 달라졌으면 도우미가 달라진 곳만 새로 확인합니다.'
      : res.reused ? '**조금 전에 조사한 계획을 다시 씁니다**(다시 조사하지 않습니다). 아직 검토되지 않았고 접수까지 확인되지 않은 계획입니다.'
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
    var head = '처리 기관: ' + p.agency + '. 아래는 ' + (res.source === 'db' ? '저장된' : res.source === 'mine' ? '전에 성공한' : '아직 검토되지 않은') + ' 절차이며 참고용입니다. 실제 공식 화면과 다르면 화면을 따르고 차이를 사용자에게 알리세요.'
      + ((res.questions || []).length ? '\n먼저 사용자에게 확인: ' + res.questions.join(' / ') : '') + '\n';
    var body = steps(p).map(line).join('\n') + ((p.required_fields || []).length ? '\n입력 항목: ' + p.required_fields.join(', ') : '') + ((p.documents || []).length ? '\n첨부서류: ' + p.documents.join(', ') : '');
    return (head + body + '\n업무: ').slice(0, 1200);
  }
  function toPlan(res) { return { playbook: '', url: res.procedure.entry_url, goal: planGoal(res), agency: res.procedure.agency, proc: res.source === 'web' ? res.procedure : null }; }
  // 같은 업무를 다르게 말한 것("○○사업자 신고해 줘" · "○○ 등록")을 하나로 본다
  function stem(name) {
    var s = String(name || '').replace(/[?？!.,·ㆍ()'"“”‘’]/g, ' ').trim();
    s = s.replace(/\s*(?:좀\s*)?(?:해\s*(?:줘|주세요|줄래|주십시오|달라)|해줘|부탁(?:해|해요|합니다|드려요)?|하고\s*싶(?:어|어요|습니다)|하려고\s*(?:해|합니다)|할래)\s*$/, '').replace(/\s+/g, '');
    s = s.replace(/(?:등록|신고|신청)(?:하기|절차|방법)?$/, '');
    return s.replace(/^(.{4,}?)사업자?$/, '$1').replace(/사업$/, '').toLowerCase().slice(0, 100);
  }
  // 이 기기의 절차 기억: 성공한 절차는 계속, 조사만 한 계획은 하루 동안 다시 쓴다. 업무 이름·기관·단계만 담는다.
  var MEM_KEY = 'navi_proc_memory_v1', MEM_FRESH = 24 * 3600 * 1000;
  function memRead(store) { try { var m = JSON.parse(store.getItem(MEM_KEY) || '{}'); return m && typeof m === 'object' ? m : {}; } catch (e) { return {}; } }
  function remember(store, task, procedure, ok, now) {
    var k = stem(task); if (k.length < 2 || !procedure || !steps(procedure).length) return;
    var m = memRead(store); if (m[k] && m[k].ok && !ok) return;   // 성공한 기록은 조사만 한 계획으로 덮지 않는다
    m[k] = { procedure: procedure, ok: !!ok, at: now };
    var keys = Object.keys(m).sort(function (a, b) { return m[b].at - m[a].at; }); keys.slice(60).forEach(function (x) { delete m[x]; });
    try { store.setItem(MEM_KEY, JSON.stringify(m)); } catch (e) { /* 기억만 빠진다 */ }
  }
  function recall(store, task, now) { var e = memRead(store)[stem(task)]; return e && (e.ok || now - e.at < MEM_FRESH) ? e : null; }
  function forget(store, task) { var m = memRead(store); delete m[stem(task)]; try { store.setItem(MEM_KEY, JSON.stringify(m)); } catch (e) { /* 저장 불가 */ } }
  // 도우미가 성공한 뒤 보낸 절차 기록(record_procedure)을 공용 초안 모양으로 만든다. prev: 처음에 쓴 계획(있으면 근거·출처를 잇는다)
  function recorded(task, r, prev, today) {
    if (!r || typeof r !== 'object' || !r.agency || !/^https:\/\//.test(r.entry_url || '') || !steps(r).length) return null;
    prev = prev || {};
    var str = function (v, n) { return String(v || '').slice(0, n); };
    var arr = function (v) { return Array.isArray(v) ? v.slice(0, 40).map(function (x) { return str(x, 100); }) : []; };
    return {
      title: str(task, 100), aliases: r.official_name && r.official_name !== task ? [str(r.official_name, 100)] : [], agency: str(r.agency, 100), entry_url: str(r.entry_url, 500),
      legal_kind: str(r.legal_kind || prev.legal_kind, 40), legal_basis: str(prev.legal_basis, 500), conditions: arr(prev.conditions),
      steps: steps(r).slice(0, 30).map(function (s) { var o = { actor: actorOf(s), action: str(s.action, 300), submit: s.submit === true }; if (s.url) o.url = str(s.url, 500); return o; }),
      required_fields: arr(r.required_fields), documents: arr(r.documents),
      sources: (prev.sources && prev.sources.length) ? prev.sources : [{ title: str(r.agency, 100), url: str(r.entry_url, 500) }], verified_at: today || ''
    };
  }
  var api = { planMarkdown: planMarkdown, planGoal: planGoal, toPlan: toPlan, stem: stem, remember: remember, recall: recall, forget: forget, recorded: recorded };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.TaskFlow = api;
})(typeof window !== 'undefined' ? window : null);
