/**
 * learn-sp.js — 나비웹 학습 화면의 "교육 SP" (2026-11-22, 주피터 지시)
 *
 * 인프라 AI → 교육을 고르면 학습 포털(learn.html)이 바로 열리고, 우하단 대화 아이콘의 대화창이 이 교육 SP 로 바뀐다.
 * 사용자는 "경제학 3주차 학습 페이지로 가자", "미적분 3주차 시험 문제 풀래", "수학 교수 불러줘" 처럼 말하고,
 * SP 는 답변 끝에 ~~~learn 블록(JSON)을 붙여 화면 조작을 요청한다. 화면(desktop.html)은 그 블록을 검증한 뒤에만 learn.html 에 전한다.
 * SP 가 늦거나 실패하면 localIntent() 가 같은 명령을 규칙으로 해석한다(이동 명령에 한함).
 *
 * 전역: window.LearnSP = { LEARN_SP, DOS, parseReply, cleanAct, localIntent, buildAsk, EXAMPLES }
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(); else root.LearnSP = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  var DOS = ['subjects', 'history', 'course', 'week', 'quiz', 'add', 'prof', 'endprof', 'report', 'career', 'submit'];
  var MAX_WEEK = 40;

  var LEARN_SP = [
    '당신은 나비웹 "교육 SP"다. 나비웹 학습 포털(내 수업·과목 상세·주차 학습·확인 문제·학습 기록) 옆 대화창에서 학습자의 지시를 받아 화면을 옮기고, 학습 계획을 돕는다. 학습자는 초등학생부터 대학원생까지이며 과목도 다양하다. 말투는 존댓말로, 학습자의 수준에 맞춰 짧고 쉽게 쓴다.',
    '',
    '[매 질문 앞에 붙는 정보]',
    '질문 앞에 "[학습 화면]" 줄이 붙는다. 지금 화면(view), 보고 있는 과목, 내가 가진 과목 목록(id·이름·과목·수준·주차 수), 호출된 교수(있으면)가 JSON 으로 들어 있다. 목록에 없는 과목·주차를 지어내지 않는다.',
    '',
    '[화면 조작 — 답변 맨 끝에 한 번만]',
    '화면을 옮기거나 바꿔야 하면 설명 한두 문장 뒤에 아래 블록을 붙인다. 블록이 없으면 화면은 바뀌지 않는다. 블록 없이 "이동했습니다"라고 말하지 않는다.',
    '~~~learn',
    '{"do":"week","subject":"경제학","week":3}',
    '~~~',
    'do 의 종류와 필요한 값:',
    '- subjects : 내 수업(과목 목록)',
    '- history : 학습 기록(연도별 이력·과목별 숙달도)',
    '- course : 과목 상세(주차별 마스터리). subject',
    '- week : 그 과목의 주차 학습 페이지. subject, week(1~40의 정수)',
    '- quiz : 그 주차의 확인 문제(시험) 페이지. subject, week',
    '- add : 과목 추가. subject(과목 이름, 12자 이내), level(초등·중등·고등·대학·대학원 중 하나, 모르면 생략)',
    '- prof : 그 과목 교수 호출. subject. 이후 질문부터는 그 과목 교수로서 답한다.',
    '- endprof : 교수 호출 끝내고 교육 SP 로 돌아온다.',
    '- report : 학습 보고서 화면(과목별 평가). subject 는 생략 가능',
    '- career : 진로 추천 화면(진로 지도 교수가 제출된 보고서를 모아 추천한 결과)',
    '- submit : 과목 보고서를 진로 지도 교수에게 제출. subject 를 생략하면 학습 기록이 있는 모든 과목을 제출한다.',
    'subject 는 [학습 화면]의 과목 목록에 있는 id 나 이름, 또는 사용자가 말한 과목 이름을 그대로 쓴다. 한 번에 블록은 하나만 낸다(여러 화면을 한꺼번에 열지 않는다).',
    '주차를 말하지 않고 "이어서 학습"이라고 하면, 보고 있는 과목의 다음 주차(주차별 단계가 연습 중이거나 시작 전인 첫 주차)로 week 를 낸다.',
    '과목이 둘 이상 가능하거나 주차·과목이 분명하지 않으면 블록 없이 짧게 되묻는다.',
    '',
    '[교수 호출]',
    '"교수 불러줘" 하면 prof 블록을 낸다. [학습 화면]에 교수가 있으면 그 과목 교수로서 개념 설명·질문 답변·풀이 힌트·학습 계획 조언을 한다. 교수 모드에서도 "시험 보자", "3주차로 가자" 같은 이동 지시는 블록으로 처리한다. "교수님 그만", "처음으로" 하면 endprof 를 낸다.',
    '',
    '[학습 평가와 진로 추천]',
    '질문 앞 정보에 "reports"(과목별 평가 요약: 종합 score·진도 prog·성취도 avg·처음 통과율 first·학습 속도 pace·기록 횟수·제출 여부)와 "career"(추천 상위 진로)가 들어 있을 수 있다. 이 수치는 화면이 계산한 값이다. 과목 교수로서 보고서 소견을 쓸 때는 반드시 이 수치만 근거로 하고, 없는 값(null)은 "자료 부족"이라고 말한다. 점수·적성·진로를 지어내거나 바꿔 말하지 않는다.',
    '과목 교수는 진도(prog), 성취도(avg), 학습 속도(pace), 학습 능력(처음 통과율·재확인 숙달)과 적성(그 과목에서의 상대적 강점)을 평가하고 강점 한두 가지, 보완점 한두 가지, 다음 학습 제안을 짧게 쓴다. "보고서 보여줘" 하면 report 블록, "보고서 제출해줘" 하면 submit 블록을 낸다.',
    '진로 지도 교수는 prof 로 subject "진로"를 호출하면 된다. 이 모드에서는 제출된 보고서(reports 중 submitted 가 true)와 career 만 근거로 진로를 설명한다. 제출된 보고서가 없거나 기록이 적으면(attempts 가 적으면) 추천이 불확실하다고 분명히 말하고 먼저 보고서 제출을 안내한다. 진로는 참고 의견이며 정하는 것은 학습자라고 밝힌다. "진로 추천해줘" 하면 career 블록을 낸다.',
    '',
    '[하지 않는 것]',
    '- 확인 문제의 정답을 미리 알려 주지 않는다. 힌트와 풀이 방향만 준다. 채점과 단계(통과·숙달) 판정은 확인 문제 페이지가 한다. 점수·진도·숙달 단계를 대신 정하거나 지어내지 않는다.',
    '- 학습 데이터(점수·시간·기록)는 [학습 화면]에 없는 것을 말하지 않는다. 모르면 학습 기록 화면을 열어 드린다.',
    '- 개인정보(주민번호·연락처·학교 이름 등)를 묻지 않는다.',
    '- 의료·법률·투자 판단은 하지 않고 해당 인프라 AI 를 안내한다.',
    '',
    '[첫 인사]',
    '시스템이 인사를 이미 보여 주므로 다시 인사하지 않고 곧장 요청을 처리한다.'
  ].join('\n');

  var EXAMPLES = [
    '경제학 3주차 학습 페이지로 가자',
    '미적분 3주차 시험 문제 풀래',
    '내 학습 기록 보여줘',
    '수학 교수님 불러줘',
    '영어 과목 추가해줘 (고등 수준)',
    '이어서 학습할래',
    '내 학습 보고서 보여줘',
    '수학 보고서 제출해줘',
    '진로 추천해줘'
  ];

  /** 순수 함수 — 답변에서 ~~~learn 블록을 떼어 낸다. 블록 속 JSON 이 깨졌으면 acts 는 비고 글만 남는다. */
  function parseReply(raw) {
    var t = String(raw == null ? '' : raw), acts = [];
    var re = /~~~learn[ \t]*\r?\n([\s\S]*?)\r?\n?~~~/g, m;
    while ((m = re.exec(t))) {
      try { var j = JSON.parse(m[1]); (Array.isArray(j) ? j : [j]).forEach(function (x) { var a = cleanAct(x); if (a) acts.push(a); }); } catch (e) { /* 깨진 블록은 무시 */ }
    }
    var text = t.replace(/~~~learn[ \t]*\r?\n[\s\S]*?\r?\n?~~~/g, '').replace(/~~~learn[\s\S]*$/, '').trim();
    return { text: text, acts: acts.slice(0, 1) };   // 한 번에 하나만 실행한다
  }

  function numOrNull(v) { return typeof v === 'number' && isFinite(v) ? v : null; }  function str(v, n) { return typeof v === 'string' ? v.trim().replace(/[\r\n]+/g, ' ').slice(0, n) : ''; }

  /** 순수 함수 — 화면 조작 한 건을 검증해 정리한다. 허용되지 않으면 null. */
  function cleanAct(x) {
    if (!x || typeof x !== 'object') return null;
    var d = str(x['do'], 12); if (DOS.indexOf(d) < 0) return null;
    var a = { 'do': d }, subj = str(x.subject, 24);
    if (d === 'course' || d === 'week' || d === 'quiz' || d === 'prof' || d === 'add') { if (!subj) return null; a.subject = subj; }
    if (d === 'week' || d === 'quiz') {
      var w = typeof x.week === 'string' && /^\d{1,2}$/.test(x.week.trim()) ? Number(x.week) : x.week;
      if (typeof w !== 'number' || !isFinite(w) || Math.floor(w) !== w || w < 1 || w > MAX_WEEK) return null;
      a.week = w;
    }
    if ((d === 'report' || d === 'submit') && subj) a.subject = subj;
    if (d === 'add') {
      if (subj.length > 12) return null;
      var lv = str(x.level, 6); if (['초등', '중등', '고등', '대학', '대학원'].indexOf(lv) >= 0) a.level = lv;
    }
    return a;
  }

  var KO_NUM = { 일: 1, 이: 2, 삼: 3, 사: 4, 오: 5, 육: 6, 칠: 7, 팔: 8, 구: 9, 십: 10 };
  function weekOf(s) {
    var m = /(\d{1,2})\s*주\s*차/.exec(s); if (m) return Number(m[1]);
    m = /(일|이|삼|사|오|육|칠|팔|구|십)\s*주\s*차/.exec(s); return m ? KO_NUM[m[1]] : 0;
  }
  var STOP = /(을|를|은|는|이|가|의|으로|로|에서|에|좀|한번|그럼|우선|지금|다시|바로|하고|해서|해줘|해주세요|보여줘|가자|가줘|열어줘|열어|이동|전환|페이지|학습|시험|문제|퀴즈|테스트|풀래|풀어|풀기|볼래|보자|볼게요|과목|수업)$/;
  function subjectBefore(s, idx) {   // "경제학 3주차" 처럼 주차 앞의 마지막 낱말을 과목으로 본다
    var head = s.slice(0, idx).trim().split(/\s+/), w = '';
    while (head.length) { w = head.pop(); if (w) break; }
    w = (w || '').replace(/[.,!?~]+$/g, '');
    for (var i = 0; i < 3 && STOP.test(w) && w.length > 2; i++) w = w.replace(STOP, '');
    return w.length >= 1 && w.length <= 12 ? w : '';
  }

  /** 순수 함수 — 사용자의 말에서 분명한 이동 명령만 규칙으로 읽는다(SP 가 늦을 때의 보조). 없으면 null. */
  function localIntent(text) {
    var s = String(text == null ? '' : text).trim().slice(0, 200); if (!s) return null;
    var wk = weekOf(s), m = /(\d{1,2})\s*주\s*차|(일|이|삼|사|오|육|칠|팔|구|십)\s*주\s*차/.exec(s);
    if (wk && m) {
      var subj = subjectBefore(s, m.index);
      if (subj && wk >= 1 && wk <= MAX_WEEK) return { 'do': /시험|문제|퀴즈|테스트|확인/.test(s) ? 'quiz' : 'week', subject: subj, week: wk };
    }
    if (/진로/.test(s) && /(추천|상담|알려|보여|분석|맞는|열어|가자)/.test(s)) return { 'do': 'career' };
    if (/보고서|평가서/.test(s) && /(제출|보내)/.test(s)) {
      var sb = /([가-힣A-Za-z]{1,12}?)\s*(과목\s*)?(보고서|평가서)/.exec(s), sj = sb && sb[1].replace(/(의|을|를)$/, '');
      return cleanAct({ 'do': 'submit', subject: sj && !/^(내|제|나의|학습|모든|전체|전부|과목|과목별)$/.test(sj) ? sj : '' });
    }
    if (/보고서|평가서/.test(s) && /(보여|열어|보자|가자|확인|전환|이동)/.test(s)) return { 'do': 'report' };
    if (/학습\s*(기록|이력)|공부\s*(기록|이력)|이력|히스토리/.test(s)) return { 'do': 'history' };
    if (/내\s*수업|과목\s*(목록|보기)|수업\s*목록|처음으로|홈으로/.test(s)) return { 'do': 'subjects' };
    var p = /([가-힣A-Za-z]{1,12}?)\s*교수(님|를|께)?\s*(불러|호출|연결|만나|와\s*대화|랑\s*대화|하고\s*대화)/.exec(s);
    if (p) return { 'do': 'prof', subject: p[1].replace(/(의|한테|에게)$/, '') };
    if (/교수(님)?\s*(그만|끝|종료)|교수\s*호출\s*(종료|끝)/.test(s)) return { 'do': 'endprof' };
    var a = /([가-힣A-Za-z]{1,12}?)\s*(과목\s*)?(추가|등록)/.exec(s);
    if (a && !/주\s*차/.test(s)) {
      var lv = (/(초등|중등|고등|대학원|대학)/.exec(s) || [])[1];
      var act = { 'do': 'add', subject: a[1].replace(/(을|를|도|좀)$/, '') };
      if (lv) act.level = lv;
      return cleanAct(act);
    }
    return null;
  }

  /** 순수 함수 — SP 에 보낼 글. 현재 화면·과목 목록·교수 모드를 JSON 한 줄로 앞에 붙인다. */
  function buildAsk(text, state, prof) {
    var st = state && typeof state === 'object' ? state : {};
    var ctx = {
      view: str(st.view, 12) || 'subjects',
      current: st.cur ? { id: str(st.cur.id, 24), name: str(st.cur.name, 40), week: Number(st.cur.week) || undefined } : undefined,
      courses: (Array.isArray(st.courses) ? st.courses : []).slice(0, 30).map(function (c) { return { id: str(c.id, 24), name: str(c.name, 40), subject: str(c.subj, 24), level: str(c.level, 24), weeks: Number(c.weeks) || 0, next: Number(c.next) || undefined }; }),
      professor: prof ? str(prof, 24) : undefined,
      reports: (Array.isArray(st.reports) ? st.reports : []).slice(0, 30).map(function (r) { return { id: str(r.id, 24), name: str(r.name, 40), score: numOrNull(r.score), progress: numOrNull(r.prog), avg: numOrNull(r.avg), firstPass: numOrNull(r.first), pace: numOrNull(r.pace), attempts: Number(r.attempts) || 0, submitted: !!r.submitted }; }),
      career: (Array.isArray(st.career) ? st.career : []).slice(0, 3).map(function (k) { return { name: str(k.name, 40), fit: numOrNull(k.fit) }; })
    };
    return '[학습 화면]\n' + JSON.stringify(ctx) + '\n\n[사용자 말]\n' + String(text == null ? '' : text).slice(0, 600);
  }

  return { LEARN_SP: LEARN_SP, DOS: DOS, MAX_WEEK: MAX_WEEK, EXAMPLES: EXAMPLES, parseReply: parseReply, cleanAct: cleanAct, localIntent: localIntent, buildAsk: buildAsk };
});
