// 사용법 고급 과정의 앞쪽 13장(10만 AI 전문가: 개요 + 분야 12개)을 만든다.
// 원문: expert100k-doc.js 의 분야 초안(F), 개요 장은 expert100k-overview.html 을 요약해 아래 OVERVIEW 에 둔다.
// 분야 초안을 고친 뒤:  node scripts/build-expert-chapters.mjs
// 갱신하는 곳: manual/hondi_interactive_manual.html 의 CHAPTERS(ex_*), sim-howto.js 의 EXPERT-GEN 구간.
import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import vm from 'node:vm';

const root = new URL('../', import.meta.url);
const rd = (p) => readFileSync(new URL(p, root), 'utf8');
export const UPDATED = '2026-11-28';

export function loadFields() {
  const s = rd('expert100k-doc.js'), a = s.indexOf('var F = {'), b = s.indexOf('\n};', a) + 3;
  return JSON.parse(JSON.stringify(vm.runInNewContext('(function(){' + s.slice(a, b) + ';return F})()')));
}

const SAY = {
  law: ['이 계약서에 위험한 특약이 있는지 봐 줘.', '서명하기 전에 변호사 AI 검토를 받고 싶어.', '인간 변호사 연결은 언제 필요해?'],
  medical: ['요즘 혈압 기록이 어떻게 변했는지 정리해 줘.', '진료 전에 증상과 복약을 요약해 줘.', '지금 응급실에 가야 하는 증상이야?'],
  edu: ['아이가 분수에서 어디서 막히는지 알려 줘.', '이번 주 학습 요약을 보여 줘.', '정답 말고 푸는 과정을 도와줘.'],
  finance: ['이 보험 약관에서 불리한 조건을 찾아 줘.', '이 송금이 사기는 아닌지 확인해 줘.', '연말정산 증빙을 모아 줘.'],
  market: ['이 업체의 환불 조건을 요약해 줘.', '결제하기 전에 총비용을 알려 줘.', '거래 기록으로 분쟁 조정을 요청하고 싶어.'],
  legis: ['우리 동네 불편을 익명으로 제안하고 싶어.', '이 문제와 관련된 법령이 있는지 알려 줘.', '내 의견이 법안에 반영됐는지 보여 줘.'],
  judicial: ['상대와 합의해서 중재 사건을 열고 싶어.', '다툼이 없는 사실부터 같이 정리해 줘.', 'K-Law 1차 판단은 법원 판결이야?'],
  admin: ['내가 받을 수 있는 지원이 있는지 알려 줘.', '신청서를 작성하고 요건을 미리 확인해 줘.', '왜 거절됐는지 근거를 설명해 줘.'],
  transport: ['약속에 맞춰 출발할 시각을 알려 줘.', '버스가 드문 곳에서 갈 방법을 찾아 줘.', '방금 사고 기록을 증빙으로 묶어 줘.'],
  logistics: ['발송한 상품의 인수인계 기록을 보여 줘.', '냉장 상품은 어떤 규정을 확인해야 해?', '파손이 어느 구간에서 생겼는지 알려 줘.'],
  culture: ['이 사진을 올려도 저작권 문제가 없는지 봐 줘.', '내 글의 창작 시점을 기록해 줘.', '이번 주 우리 지역 행사를 알려 줘.'],
  living: ['집 계약 전에 확인할 서류를 알려 줘.', '이 식품 표시를 읽어 줘.', '퇴거할 때 입주 사진과 비교해 줘.'],
};

const ICON = ['<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/>', '<rect x="5" y="6" width="14" height="12" rx="3"/><path d="M9 11h.01M15 11h.01M12 3v3"/>',
  '<path d="M12 3l8 3v6c0 5-4 8-8 9-4-1-8-4-8-9V6z"/><path d="M9 12l2 2 4-4"/>', '<path d="M10 14a4 4 0 0 0 6 0l3-3a4 4 0 0 0-6-6l-1 1M14 10a4 4 0 0 0-6 0l-3 3a4 4 0 0 0 6 6l1-1"/>'];
const svg = (d) => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' + d + '</svg>';
const QICON = svg('<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1 .9-1 1.7M12 17h.01"/>');
const hero = '\n<div class="ch-hero"><svg viewBox="0 0 240 140" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:360px;display:block;margin:0 auto" role="img" aria-label="나비, 전문가 AI, 사람 전문가, OpenHash 네 층">'
  + [0, 1, 2, 3].map((i) => '<rect x="' + (14 + i * 56) + '" y="' + (74 - i * 16) + '" width="46" height="' + (42 + i * 16) + '" rx="8" fill="' + ['#d3e3fd', '#a8c7fa', '#7cacf8', '#c4eed0'][i] + '"/><circle cx="' + (37 + i * 56) + '" cy="' + (92 - i * 16) + '" r="9" fill="#fff"/>').join('')
  + '<path d="M16 126h208" stroke="#74777f" stroke-width="2" stroke-linecap="round"/></svg></div>\n';
const ul = (a, tag = 'ul') => '<' + tag + '>' + a.map((x) => '<li>' + x + '</li>').join('') + '</' + tag + '>';
const steps = (rows) => '<div class="step-list">' + rows.map((r, i) => '<div class="step-row"><div class="step-icon">' + svg(ICON[i % 4]) + '</div><div class="step-body"><div class="step-title">' + r[0] + '</div><div class="step-desc">' + r[1] + '</div></div></div>').join('') + '</div>';
const box = (title, text) => '<div class="md-container tonal-primary"><div class="mc-body"><div class="mc-title">' + title + '</div><div>' + text + '</div></div></div>';
const tail = (scope, say) => '\n\n<div class="md-container tonal-primary hw-note"><div class="mc-body"><div class="mc-title">🧪 시뮬레이션 — 이 장에서 따로 연습하기</div><div>화면 오른쪽 위 <b>시뮬레이션</b> 버튼을 누르면 가상 상황에서 연습합니다. 저장·전송이 없고 완료에 반영되지 않습니다. 시뮬레이션이 맡는 것: ' + scope + '</div></div></div><h4>시뮬레이션에서 다루는 말 (예)</h4><ul>' + say.map((x) => '<li>“' + x + '”</li>').join('') + '</ul>';

// 정답 위치가 한 자리에 몰리지 않게 장마다 돌린다
function q(text, right, wrong, explain, shift) {
  const options = wrong.slice(); const at = shift % (wrong.length + 1); options.splice(at, 0, right);
  return { q: text, icon: QICON, options, answer: at, explain };
}

function fieldChapter(key, d, n) {
  const scope = '「' + d.t + '」 재구성 초안의 네 층을 나누고, 일상의 흐름을 순서대로 맞추고, L3 전문가의 역할을 가려 봅니다. 초안의 예시이며 실제 서비스 화면이 아닙니다.';
  const body = hero + '<h2>10만 AI 전문가 · ' + d.t + ' — ' + d.sub + '</h2>\n'
    + box('AI와 OpenHash 기반 재구성 초안', '전문가 검토 전의 사고 실험이며 확정안이 아닙니다. 지금 모두 제공하는 서비스를 설명하는 장이 아닙니다. 원문은 <b>왼쪽 메뉴 → 10만 AI 전문가 → ' + d.t + '</b> 탭에 있습니다.')
    + '\n<p>' + d.def + '</p>\n<h3>현재의 문제</h3>' + ul(d.pain)
    + '\n<h3>재구성 구조</h3>' + steps(d.layers)
    + '\n<h3>일상의 흐름(예시)</h3>' + ul(d.flow, 'ol')
    + '\n<h3>L3 전문가의 역할</h3>' + ul(d.l3)
    + '\n<h3>선결 과제와 위험</h3>' + ul(d.gate) + '<p>제도·자격과 관련된 항목은 해당 분야의 법령과 담당 기관의 확인이 필요합니다.</p>'
    + '\n<h3>개요와의 연결</h3><p>' + d.ref + '</p>'
    + '\n<h3>전문가에게 묻는 질문</h3>' + ul(d.ask)
    + tail(scope, SAY[key]);
  const quiz = [
    q('「' + d.t + '」 장의 일상의 흐름(예시)에서 가장 먼저 일어나는 일은?', d.flow[0], [d.flow[2], d.flow[3], d.flow[4]], '예시 흐름은 “' + d.flow[0] + '”에서 시작합니다.', n),
    q('「' + d.t + '」 장에서 L3 전문가의 역할로 적힌 것은?', d.l3[0], ['AI 결과를 확인하지 않고 그대로 확정한다', '본인 허락 없이 원문 기록을 외부에 공개한다', '책임은 AI에게 넘기고 이름만 올린다'], '사람 전문가는 AI가 준비한 것을 검토하고 책임지는 쪽을 맡습니다.', n + 1),
    q('「' + d.t + '」 장의 선결 과제·위험에 해당하는 것은?', d.gate[0], ['해결할 과제가 없어 지금 바로 전면 시행할 수 있다', '사람 전문가를 모두 없애는 것이 목표라 확인할 것이 없다', '모든 원문 기록을 한곳의 중앙 서버에 모으기만 하면 된다'], '이 장은 확정안이 아니라 초안이며, 먼저 풀어야 할 과제를 함께 적었습니다.', n + 2),
  ];
  return { tier: 'advanced', id: 'ex_' + key, title: '10만 AI 전문가 · ' + d.t + ' — ' + d.sub, body, quiz, sp: [], updated: UPDATED };
}

const OVERVIEW_SCOPE = 'L3 인원을 구하는 산식을 계산하고, 근거 표기(산식·단위·가정)를 가리고, “AI가 하는 일과 사람이 하는 일”을 나눠 봅니다. 숫자는 사고 실험의 가정입니다.';
const OVERVIEW_SAY = ['L3 전문가 10만 명은 어떤 분야에 배치돼?', '의사 L3 9,000명은 어떻게 계산했어?', '이 숫자 중 가정인 것은 얼마나 돼?'];

function overviewChapter() {
  const body = hero + '<h2>10만 AI 전문가 · 개요 — L3 전문가 10만 명은 어디에 필요한가</h2>\n'
    + box('초안 v0.2 · 사고 실험', '확정안이 아닙니다. 출처와 전체 표는 <b>왼쪽 메뉴 → 10만 AI 전문가 → 개요</b> 탭에 있습니다.')
    + '\n<p>인구 5,000만 명 가운데 10만 명(0.2%, 500명당 1명)이 L3 인증을 받아 사회 인프라를 운영한다고 <b>가정</b>합니다. L3는 AI가 준비한 결과를 검토·승인하고 최종 책임을 지는 분야별 감독자로 계산했습니다.</p>'
    + '\n<h3>일이 갈라지는 방식</h3><p>업종마다 하던 일이 “정보를 모으고 서류를 옮기는 일”과 “판단하고 책임지는 일”로 갈라진다고 봅니다. 앞의 일은 AI가 옮겨 가고, 뒤의 일은 사람에게 남습니다. 해외 기관의 “AI 노출도” 추정은 업무 중 AI가 할 수 있는 몫이며 곧바로 일자리 대체를 뜻하지 않습니다.</p>'
    + steps([['지금', '사람 → 재래식 웹·창구 → 기관. 사이트를 찾고, 로그인하고, 서류를 발급·제출하고, 보정을 받아 다시 냅니다.'], ['전환 후(목표)', '사람 → 나비(내 AI) → 기관 AI → 기관. 사람은 목적을 말하고 승인합니다. 로그인·결제·서명·제출처럼 되돌리기 어려운 일은 승인 뒤에만 실행합니다.']])
    + '\n<h3>사례: 개인 파산·회생</h3><p>서류 준비·제출·형식 심사를 <b>10초 내외</b>로 줄이는 것이 <b>목표</b>입니다(측정한 결과가 아닙니다). 전제는 세 가지입니다. 자료가 본인의 PDV에 쌓여 있고, 법원·금융기관이 공통 규격(SP)의 AI를 운영하며, 전자 서명·제출의 효력이 인정돼야 합니다. 법원 결정 구간까지 AI 비서가 수행하고 사람이 검토·승인하는 시나리오는 <b>현행 법으로는 불가능</b>합니다.</p>'
    + '\n<h3>인원 산정</h3><p>L3 1명이 이 업무에 쓰는 시간을 연 1,500시간으로 봅니다. <b>필요 인원 = 전환 업무량 × 건당 검토 시간 ÷ 1,500시간</b>입니다.</p><ul><li><b>의료 의사 9,000명</b>: 외래 연 약 9억 회 중 30%(2.7억 건)를 AI가 준비하고 의사가 건당 3분 검토</li><li><b>유·초·중·고 교사 8,500명</b>: 학생 약 650명당 1명</li><li><b>사법 중재 900명</b>: 민사 1심의 38%를 중재로 전환한다는 가정(범위 400~1,400명)</li></ul>'
    + '\n<h3>전체 배분(합계 100,000명)</h3><ul><li>국가 기능·민주 20,500명</li><li>안보·안전·디지털 방어 11,500명</li><li>사회서비스(의료·교육·복지 중심) 38,000명</li><li>경제·산업 27,000명</li><li>메타(L3 양성·인증·윤리, 예비·갱신) 3,000명</li></ul>'
    + '<p>근거 표기는 <b>산식</b>(업무량 자료로 계산) 18.4%, <b>단위</b>(기관 수 × 기관당 인원) 16.4%, <b>가정</b>(자료 없이 비중으로 배정) 65.2%입니다.</p>'
    + '\n<h3>지역 배분 원칙</h3><p>수도권 쏠림을 막으려고 광역 17곳에 최소 비율을 먼저 보장하고, 나머지를 인구와 업무량으로 나눕니다.</p>'
    + '\n<h3>한계</h3><ul><li>건당 시간, 전환율, AI 처리 비중은 모두 가정입니다.</li><li>국방·SOC·환경·복지는 업무량 자료를 확보하지 못했습니다.</li><li>파산·회생의 “기존” 처리 기간은 법원 공식 통계로 다시 확인해야 합니다.</li></ul>'
    + '\n<p>이어지는 12개 장은 법률부터 의식주까지 분야별 재구성 초안입니다. 모든 분야에 같은 틀(나비 → 전문가 AI → L3 사람 전문가, 그리고 OpenHash 기록)을 적용하며, 사법 분야만 당사자 합의에서 시작합니다.</p>'
    + tail(OVERVIEW_SCOPE, OVERVIEW_SAY);
  const quiz = [
    q('이 개요에서 L3 10만 명이라는 인원은 어떤 성격인가요?', '가정을 밝힌 사고 실험이며 확정안이 아니다', ['정부가 확정한 채용 계획이다', '이미 인증을 마친 전문가 수다', '모든 항목을 업무량 자료로 계산한 값이다'], '전체의 65.2%는 업무량 자료 없이 비중으로 배정한 가정입니다.', 1),
    q('필요 인원을 구하는 산식은?', '전환 업무량 × 건당 검토 시간 ÷ 1,500시간', ['인구 ÷ 1,500', '전환 업무량 ÷ 건당 검토 시간', '기관 수 × 1,500시간'], 'L3 1명이 이 업무에 쓰는 시간을 연 1,500시간으로 봅니다.', 2),
    q('개인 파산·회생 사례의 “10초 내외”는 무엇인가요?', '전제가 갖춰졌을 때 서류·제출·형식 심사의 목표', ['지금 측정된 법원의 평균 처리 시간', '법원의 최종 결정까지 걸리는 시간', '현행 법 아래에서 보장되는 처리 시간'], '목표이며, 법원 결정 구간과 법정 기간은 따로 남습니다.', 3),
  ];
  return { tier: 'advanced', id: 'ex_overview', title: '10만 AI 전문가 · 개요 — L3 전문가 10만 명은 어디에 필요한가', body, quiz, sp: [], updated: UPDATED };
}

export function buildChapters(F = loadFields()) {
  return [overviewChapter()].concat(Object.keys(F).map((k, i) => {
    if (!SAY[k]) throw new Error('SAY 에 없는 분야: ' + k);
    return fieldChapter(k, F[k], i);
  }));
}

/* 시뮬레이션 — first: ex_overview 의 장 번호(1부터) */
export function buildScenarios(first, F = loadFields()) {
  const j = JSON.stringify;
  const out = [];
  out.push("S('ex_overview', { n: " + first + ", short: '10만 AI 전문가 개요', focus: " + j('시뮬레이션이 맡는 것: ' + OVERVIEW_SCOPE) + ", say: " + j(OVERVIEW_SAY) + ", steps: [\n"
    + "    { k: 'calc', name: 'L3 인원 계산', gen: function (r) { var p = shuf([15, 30, 45], r)[0], n = 900000000 * p / 100 * 3 / 60 / 1500; return { q: '외래 진료 연 약 9억 회 중 ' + p + '%를 AI가 준비하고 L3 의사가 건당 3분 검토합니다. L3 1명이 연 1,500시간을 쓴다면 필요한 인원은?', facts: '필요 인원 = 업무량 × 건당 검토 시간 ÷ 1,500시간. 비율은 가정입니다.', a: n, tol: 0, unit: '명', why: '9억 × ' + p + '% × 3분 ÷ 60 ÷ 1,500 = ' + won(n) + '명. 개요는 30%일 때 9,000명으로 잡았습니다.', hint: '검토에 드는 총 시간을 먼저 구한 뒤 1,500으로 나눕니다.' }; } },\n"
    + "    { k: 'sort', name: '근거 표기 가리기', q: '이 인원은 어떤 근거로 정했을까요?', buckets: ['산식(업무량 자료)', '단위(기관 수 × 인원)', '가정(비중 배정)'], items: [['의료 L3 의사 9,000명', 0], ['유·초·중·고 L3 교사 8,500명', 0], ['지방 행정 7,700명', 1], ['지방의회 1,000명', 1], ['국방 2,500명', 2], ['복지·돌봄·노동 6,000명', 2]], why: '전체 10만 명 중 산식 18.4%, 단위 16.4%, 가정 65.2%입니다.' },\n"
    + "    { k: 'sort', name: 'AI 몫 · 사람 몫', q: '전환 후 이 일은 누구의 몫일까요?', buckets: ['AI(나비)로 옮겨 가는 일', '사람(L3 포함)이 맡는 일'], items: [['서류 수집·작성·제출', 0], ['요건 확인과 절차 안내', 0], ['판단과 최종 승인', 1], ['이해관계 조정과 책임', 1]], why: '정보를 모으고 서류를 옮기는 일은 AI로, 판단하고 책임지는 일은 사람에게 남는다고 봅니다.' }\n  ] });\n");
  Object.keys(F).forEach((k, i) => {
    const d = F[k], names = d.layers.map((r) => r[0]);
    const scope = '「' + d.t + '」 재구성 초안의 네 층을 나누고, 일상의 흐름을 순서대로 맞추고, L3 전문가의 역할을 가려 봅니다. 초안의 예시이며 실제 서비스 화면이 아닙니다.';
    out.push("S('ex_" + k + "', { n: " + (first + 1 + i) + ", short: " + j('10만 AI 전문가 · ' + d.t) + ", focus: " + j('시뮬레이션이 맡는 것: ' + scope) + ", say: " + j(SAY[k]) + ", steps: [\n"
      + "    { k: 'sort', name: '네 층 나누기', q: " + j('이 설명은 「' + d.t + '」 재구성 구조의 어느 층일까요?') + ", buckets: " + j(names) + ", items: " + j(d.layers.map((r, n) => [r[1].split(/(?<=다\.)\s/)[0], n])) + ", why: " + j('네 층은 ' + names.join(' → ') + ' 순서입니다.') + " },\n"
      + "    { k: 'order', name: '일상의 흐름', q: '예시 흐름을 일어나는 순서대로 눌러 보세요.', items: " + j(d.flow) + ", why: " + j(d.def) + " },\n"
      + "    { k: 'pick', name: 'L3의 역할', q: " + j('「' + d.t + '」 분야에서 L3 전문가가 맡는 일로 알맞은 것은?') + ", opts: " + j([d.l3[0], 'AI 결과를 확인하지 않고 그대로 확정한다', '책임은 AI에게 넘기고 이름만 올린다']) + ", a: 0, why: " + j(d.l3.join(' ')) + " }\n  ] });\n");
  });
  return out.join('\n');
}

export function apply() {
  const F = loadFields(), manUrl = new URL('manual/hondi_interactive_manual.html', root), simUrl = new URL('sim-howto.js', root);
  const man = readFileSync(manUrl, 'utf8'), m = /var CHAPTERS = (\[.*\]);\n/.exec(man);
  const C = JSON.parse(m[1]).filter((c) => !c.id.startsWith('ex_'));
  const at = C.findIndex((c) => c.tier === 'advanced');
  C.splice(at < 0 ? C.length : at, 0, ...buildChapters(F));
  const ids = JSON.stringify(Object.fromEntries(C.map((c) => [c.id, 1])));
  const man2 = man.replace(m[0], () => 'var CHAPTERS = ' + JSON.stringify(C) + ';\n').replace(/window\.NAVI_HOWTO_IDS = \{[^}]*\};/, () => 'window.NAVI_HOWTO_IDS = ' + ids + ';');
  writeFileSync(manUrl, man2);
  const sim = readFileSync(simUrl, 'utf8'), B = '/* EXPERT-GEN 시작 — scripts/build-expert-chapters.mjs 가 만든다. 직접 고치지 않는다. */\n', E = '/* EXPERT-GEN 끝 */\n';
  const a = sim.indexOf(B), z = sim.indexOf(E);
  if (a < 0 || z < a) throw new Error('sim-howto.js 에 EXPERT-GEN 구간이 없습니다');
  writeFileSync(simUrl, sim.slice(0, a + B.length) + buildScenarios(C.findIndex((c) => c.id === 'ex_overview') + 1, F) + sim.slice(z));
  return C;
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) { const C = apply(); console.log('사용법 ' + C.length + '장, 고급 ' + C.filter((c) => c.tier === 'advanced').length + '장'); }
