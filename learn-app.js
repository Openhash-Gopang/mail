/* learn-app.js — 나비웹 학습 포털(인프라 AI · 교육). desktop.html 안에 직접 그려 넣는다(iframe 없음).
 * 사용: NaviLearn.mount(요소, { view }) · .nav(화면 조작) · .view(이름) · .on('ask'|'state'|'result', 함수)
 * 모양은 learn.css(.lrn 범위). 전역은 NaviLearn 하나만 쓴다. */
(function () {
'use strict';
// 나비웹 학습 — '인프라 AI · 교육'의 학습 포털. 홈(다음 할 일·주간 목표·복습) · 과목(단원·주차 경로) · 주차 학습 · 확인 문제 · 학습 기록 · 보고서 · 진로 추천.
// 설계 참고: 칸아카데미(기술별 숙달 단계·코스 숙달도·건너뛰기), Coursera(다음 할 일 안내·진행 막대·첫 주 채점), Duolingo(간격 복습·학습 습관), Brilliant(짧은 학습·교수 힌트).
// 나비웹이 더하는 것: 확인 문제 기록의 해시 체인(변조 검출, 이후 OpenHash 앵커링)과 과목 교수·진로 지도 교수 AI.
// 지금은 예시 데이터와 이 브라우저의 저장 공간(localStorage)만 쓴다. 실제 학습 기록은 PDV 로 옮길 때 DATA 부분만 바꾼다.
// 마스터리: 주차 확인 문제를 통과하면 '통과', 며칠 뒤 다시 풀어서도 맞히면 '숙달'. 통과해야 다음 주차가 열린다(기준 80%·재확인 간격은 가칭).
var KEY = 'navi-learn-v1', GATE = 80;
var SUBJECTS = ['수학','물리','화학','생명과학','영어','국어','역사','코딩','경제학'];
var LEVELS = ['초등','중등','고등','대학','대학원','성인'];
var ST = { M:'숙달', P:'통과', L:'연습 중', N:'시작 전' };
var EXAMPLE = [
  { id:'econ', name:'경제학 입문', subj:'경제학', level:'대학 · 교양', prof:'경제학 교수', seq:'N'.repeat(30), next:'1주차 · 희소성과 선택', example:true },
  { id:'calc', name:'미적분 기초', subj:'수학', level:'대학 · 수학', prof:'수학 교수', seq:'MMMPMMPL'+'N'.repeat(7), next:'8주차 · 미분의 응용', review:'3주차 극한 — 마지막 학습 21일 전', example:true }
];
var HIST = [ // 예시 데이터
  { y:'2026', lv:'대학 1학년', h:142, subs:[['미적분 기초','대학 · 수학','2026.09 ~ 진행 중',49,'7 / 15주',52,'ing'],['영어 독해','대학 · 영어','2026.03 ~ 2026.08',93,'12 / 12주',88,'done']] },
  { y:'2025', lv:'고등학교 3학년', h:480, subs:[['수학Ⅱ','고등 · 수학','2025.03 ~ 2025.11',210,'30 / 30주',91,'done'],['물리Ⅰ','고등 · 물리','2025.03 ~ 2025.11',150,'24 / 24주',84,'done'],['영어','고등 · 영어','2025.03 ~ 2025.11',120,'20 / 20주',86,'done']] },
  { y:'2024', lv:'고등학교 2학년', h:455, subs:[['수학Ⅰ','고등 · 수학','2024.03 ~ 2024.11',200,'28 / 28주',89,'done'],['화학Ⅰ','고등 · 화학','2024.03 ~ 2024.11',140,'22 / 22주',80,'done'],['영어','고등 · 영어','2024.03 ~ 2024.11',115,'18 / 18주',83,'done']] },
  { y:'2023', lv:'고등학교 1학년', h:210, subs:[['공통수학','고등 · 수학','2023.03 ~ 2023.11',120,'24 / 24주',85,'done'],['통합과학','고등 · 과학','2023.03 ~ 2023.11',90,'18 / 18주',79,'done']] }
];
var MAST = [['수학',79,'4개 과정'],['영어',86,'3개 과정'],['물리',84,'1개 과정'],['화학',80,'1개 과정'],['과학',79,'1개 과정']];
var RECHECK = 3 * 86400000; // 통과 뒤 이만큼 지나 다시 통과하면 '숙달'(가칭: 3일)
var GOALS = {
  econ:[['희소성: 자원은 한정되어 있어 선택이 필요하다','기회비용: 선택으로 포기한 것 중 가장 가치 큰 것','생산가능곡선과 효율적인 선택'],['수요법칙과 공급법칙','시장균형: 수요량 = 공급량','수요·공급의 변화와 가격 통제'],['수요의 가격탄력성의 뜻과 계산','탄력성과 총수입','탄력성을 정하는 요인'],['한계효용 체감','소비자 균형(1원당 한계효용)','예산선과 무차별곡선']],
  calc:[['극한의 뜻과 계산','좌극한·우극한','무한대에서의 극한'],['연속의 세 조건','불연속인 점','중간값 정리'],['미분계수의 정의','접선의 기울기','기본 도함수']]
};
// 예시 확인 문제: [문제, [보기 4개], 정답 번호(0부터), 풀이]. 없는 주차는 교수가 출제한다.
var QUIZ = {
  econ:{
    1:[['희소성의 뜻으로 가장 알맞은 것은?',['자원이 무한해 모든 욕구를 채울 수 있는 상태','욕구에 비해 자원이 한정되어 선택이 필요한 상태','가격이 매우 비싼 상태','정부가 공급을 제한한 상태'],1,'희소성은 욕구에 비해 자원이 부족해 선택이 불가피한 상태입니다.'],
       ['기회비용이란?',['선택하며 포기한 대안 중 가장 가치가 큰 것','실제로 지출한 돈','선택한 재화의 가격','포기한 모든 대안의 가치를 더한 것'],0,'기회비용은 포기한 대안들 중 가장 가치가 큰 것 하나입니다.'],
       ['한 학생이 시급 12,000원 아르바이트 2시간을 포기하고 영화를 본다. 이 2시간의 기회비용은?',['12,000원','24,000원','영화 관람료','0원'],1,'포기한 소득 12,000원 × 2시간 = 24,000원입니다.'],
       ['생산가능곡선 위의 한 점이 뜻하는 것은?',['주어진 자원을 모두 효율적으로 쓰는 생산 조합','지금 생산할 수 없는 조합','자원이 놀고 있는 상태','가장 바람직한 조합'],0,'곡선 위는 효율적, 안쪽은 비효율, 바깥쪽은 불가능한 조합입니다.'],
       ['합리적 선택에 대한 설명으로 알맞은 것은?',['가장 싼 것을 고른다','한계편익이 한계비용보다 큰 동안 선택을 늘린다','비용은 고려하지 않는다','가장 많이 소비한다'],1,'추가로 얻는 이득이 추가 비용보다 큰 동안 늘리는 것이 합리적입니다.']],
    2:[['다른 조건이 같을 때 가격이 오르면 수요량은?',['증가한다','감소한다','변함없다','알 수 없다'],1,'수요법칙: 가격과 수요량은 반대로 움직입니다.'],
       ['시장 균형 가격에서는?',['수요량 = 공급량','수요량 > 공급량','수요량 < 공급량','가격이 0이다'],0,'균형은 수요량과 공급량이 같아지는 점입니다.'],
       ['공급은 그대로이고 수요가 늘면 균형 가격과 거래량은?',['모두 하락','가격 상승, 거래량 증가','가격 하락, 거래량 증가','모두 불변'],1,'수요곡선이 오른쪽으로 이동하면 가격과 거래량이 모두 늘어납니다.'],
       ['균형 가격보다 낮게 정한 가격상한제 아래에서는?',['초과 공급','초과 수요(품귀)','변화 없음','공급 증가'],1,'가격이 낮으면 사려는 양이 팔려는 양보다 많아집니다.'],
       ['대체재의 가격이 오르면 이 재화의 수요는?',['증가','감소','불변','0'],0,'대체재가 비싸지면 이 재화로 수요가 옮겨 옵니다.']],
    3:[['수요의 가격탄력성은?',['가격 변화율 ÷ 수요량 변화율','수요량 변화율 ÷ 가격 변화율(절댓값)','수요량 변화량 ÷ 가격 변화량','가격 × 수요량'],1,'탄력성 = 수요량 변화율 ÷ 가격 변화율(절댓값)입니다.'],
       ['가격이 10% 오르자 수요량이 20% 줄었다. 탄력성은?',['0.5','1','2','10'],2,'20 ÷ 10 = 2로 탄력적입니다.'],
       ['수요가 탄력적일 때 가격을 올리면 총수입은?',['증가','감소','불변','알 수 없다'],1,'수요량이 더 크게 줄어 총수입이 감소합니다.'],
       ['다음 중 수요가 가장 비탄력적인 재화는?',['외식','생필품(쌀)·필수 의약품','여행','고급 시계'],1,'필수재는 가격이 올라도 사야 하므로 비탄력적입니다.'],
       ['대체재가 많을수록 수요의 탄력성은?',['커진다','작아진다','불변','0이 된다'],0,'갈아탈 곳이 많으면 가격에 민감해집니다.']],
    4:[['한계효용 체감의 법칙이란?',['소비가 늘수록 추가 1단위의 효용이 줄어든다','소비가 늘수록 총효용이 줄어든다','가격이 내리면 효용이 준다','소득이 늘면 효용이 준다'],0,'총효용은 늘어도 추가로 얻는 효용은 점점 줄어듭니다.'],
       ['소비자 균형의 조건은?',['모든 재화의 가격이 같다','재화별 1원당 한계효용이 같다','총효용이 0이다','소득이 가장 크다'],1,'MU₁/P₁ = MU₂/P₂ 일 때 예산을 가장 잘 쓴 것입니다.'],
       ['예산선이 나타내는 것은?',['소득과 가격으로 살 수 있는 조합','같은 만족을 주는 조합','생산 가능한 조합','가격의 변화'],0,'예산선은 주어진 소득으로 살 수 있는 조합의 경계입니다.'],
       ['재화 가격이 내리면 실질소득은?',['증가한다','감소한다','불변','0이 된다'],0,'같은 소득으로 더 살 수 있어 구매력이 늘어납니다(소득효과).'],
       ['무차별곡선에 대한 설명으로 알맞은 것은?',['원점에서 멀수록 효용이 낮다','같은 곡선 위의 조합은 만족이 같다','서로 교차한다','오른쪽 위로 향한다'],1,'한 곡선 위의 조합은 효용이 같고, 원점에서 멀수록 효용이 높습니다.']]
  },
  calc:{
    1:[['lim(x→2) (x²−4)/(x−2) 의 값은?',['0','2','4','존재하지 않는다'],2,'(x−2)(x+2)/(x−2) = x+2 → 4 입니다.'],
       ['lim(x→3) (2x+1) 의 값은?',['5','6','7','9'],2,'x에 3을 넣으면 7입니다.'],
       ['x=a에서 극한이 존재할 조건은?',['좌극한과 우극한이 같다','f(a)가 정의된다','함수가 연속이다','f(a)=0이다'],0,'좌극한과 우극한이 같으면 극한이 존재합니다.'],
       ['lim(x→∞) 1/x 의 값은?',['∞','1','0','존재하지 않는다'],2,'x가 커질수록 1/x 는 0에 가까워집니다.'],
       ['lim(x→1) (x²−1)/(x−1) 의 값은?',['0','1','2','존재하지 않는다'],2,'(x+1) → 2 입니다.']],
    2:[['함수 f가 x=a에서 연속이려면?',['극한이 존재한다','f(a)가 정의된다','극한값이 f(a)와 같다','위 세 가지 모두'],3,'극한 존재·함숫값 존재·두 값이 같음, 세 조건이 모두 필요합니다.'],
       ['f(x)=1/x 는 x=0에서?',['연속이다','정의되지 않아 연속이 아니다','극한이 0이다','미분 가능하다'],1,'x=0에서 함숫값이 없으므로 연속이 아닙니다.'],
       ['다항함수는?',['모든 실수에서 연속이다','x=0에서만 연속이다','불연속이다','정의역이 제한된다'],0,'다항함수는 실수 전체에서 연속입니다.'],
       ['f가 [a,b]에서 연속이고 f(a)<0<f(b) 이면?',['(a,b)에 f(c)=0 인 c가 존재한다','f는 증가한다','f(c)=0 인 c가 없다','f는 미분 가능하다'],0,'중간값 정리입니다.'],
       ['f(x)=x+1 (x<1), f(x)=3 (x≥1) 은 x=1에서?',['연속이다','좌극한 2, f(1)=3 이라 불연속이다','극한이 3이다','정의되지 않는다'],1,'좌극한 2와 f(1)=3 이 달라 불연속입니다.']],
    3:[['미분계수 f′(a)의 정의는?',['lim(h→0) (f(a+h)−f(a))/h','f(a)/a','f(a+1)−f(a)','lim(h→∞) f(a+h)'],0,'평균변화율의 극한입니다.'],
       ['f(x)=x² 의 x=3에서의 미분계수는?',['3','6','9','2'],1,'f′(x)=2x 이므로 f′(3)=6 입니다.'],
       ['미분계수의 기하적 의미는?',['곡선의 길이','접선의 기울기','곡선 아래 넓이','함숫값'],1,'그 점에서의 접선의 기울기입니다.'],
       ['상수함수의 도함수는?',['상수 자신','1','0','존재하지 않는다'],2,'상수는 변하지 않으므로 0입니다.'],
       ['f(x)=3x+2 의 도함수는?',['2','3','3x','5'],1,'기울기 3 입니다.']]
  }
};
var WEEK_TOPICS = { econ:['희소성과 선택','수요와 공급','탄력성','소비자 이론'], calc:['극한','연속','미분 기초','미분 공식','합성함수 미분','음함수 미분','미분의 응용(1)','미분의 응용(2)','적분 맛보기'] };

var UNIT = 4, DAY = 86400000;
var S = { view:'subjects', cur:null, week:1, q:null, open:'2026', added:[], prog:{}, sub:{}, goal:3, chk:{}, addSubj:'수학', addLevel:'중등', pf:{ q:'', field:'', st:'idle', err:'', list:null, total:0, res:null, sel:null, from:'', level:'', n:0, busy:false }, srch:{ q:'', st:'idle', cur:null, from:'', rel:[], err:'', list:null, n:0, open:false }, grain:'month', qz:{}, qst:null };
EXAMPLE[0].start = Date.now() - 3 * DAY; EXAMPLE[1].start = Date.now() - 58 * DAY;   // 예시 과목의 표준 일정 기준일(예시)
try {
  var sv = JSON.parse(localStorage.getItem(KEY) || 'null');
  if (sv && Array.isArray(sv.added)) S.added = sv.added.filter(function (a) { return a && typeof a.name === 'string'; }).map(fixCourse);
  if (sv && sv.prog && typeof sv.prog === 'object') for (var pk in sv.prog) { var pv = sv.prog[pk]; if (pv && typeof pv.seq === 'string' && /^[MPLN]{1,60}$/.test(pv.seq)) S.prog[pk] = { seq:pv.seq, pass:(pv.pass && typeof pv.pass === 'object') ? pv.pass : {}, log:Array.isArray(pv.log) ? pv.log.filter(function (e) { return Array.isArray(e) && isFinite(e[0]) && isFinite(e[1]) && isFinite(e[2]); }).slice(-200) : [], chain:Array.isArray(pv.chain) ? pv.chain.filter(function (x) { return typeof x === 'string' && /^[0-9a-f]{64}$/.test(x); }).slice(-200) : [] }; }
  if (sv && sv.sub && typeof sv.sub === 'object') for (var sk in sv.sub) { var su = sv.sub[sk]; if (su && isFinite(su.ts) && isFinite(su.score)) S.sub[sk] = { ts:su.ts, score:su.score, prog:isFinite(su.prog) ? su.prog : null, avg:isFinite(su.avg) ? su.avg : null, first:isFinite(su.first) ? su.first : null, pace:isFinite(su.pace) ? su.pace : null, tried:Number(su.tried) || 0, att:Number(su.att) || 0, basis:String(su.basis || '').slice(0, 60) }; }
  if (sv && [2, 3, 5, 7].indexOf(sv.goal) >= 0) S.goal = sv.goal;
  if (sv && sv.chk && typeof sv.chk === 'object') for (var ck in sv.chk) if (/^[0-9a-z]{1,24}:\d{1,2}$/.test(ck) && /^[01]{1,8}$/.test(sv.chk[ck])) S.chk[ck] = sv.chk[ck];
} catch (e) {}
try { var zq = JSON.parse(localStorage.getItem('navi-learn-qz') || 'null'); if (zq && typeof zq === 'object') for (var zk in zq) if (/^c[0-9a-f]{12}:\d{1,2}$/.test(zk) && okBank(zq[zk])) S.qz[zk] = zq[zk]; } catch (e) {}
function save() { try { localStorage.setItem(KEY, JSON.stringify({ added: S.added, prog: S.prog, sub: S.sub, goal: S.goal, chk: S.chk })); } catch (e) {} }
function all() { return EXAMPLE.concat(S.added); }
function find(id) { return all().filter(function (c) { return c.id === id; })[0]; }
function seqOf(c) { return (S.prog[c.id] && S.prog[c.id].seq) || c.seq || ''; }
function nextIdx(seq) { var i = seq.indexOf('L'); return i < 0 ? seq.indexOf('N') : i; }
function topicOf(c, n) { if (c.cur) return (c.cur.w[n - 1] || {}).t || ''; var t = WEEK_TOPICS[c.id]; return (t && t[n - 1]) || ''; }
function nextLabel(c) { var seq = seqOf(c), i = nextIdx(seq); if (i < 0) return ''; var t = topicOf(c, i + 1); return (i + 1) + '주차' + (t ? ' · ' + t : ''); }
function resolve(q) {
  q = String(q || '').trim().toLowerCase(); if (!q) return null;
  var a = all(), r = a.filter(function (c) { return c.id === q || c.name.toLowerCase() === q; })[0]; if (r) return r;
  var hits = a.filter(function (c) { var n = c.name.toLowerCase(), j = (c.subj || '').toLowerCase(); return n.indexOf(q) >= 0 || (j && (j.indexOf(q) >= 0 || q.indexOf(j) >= 0)); });
  hits.sort(function (x, y) { return (seqOf(y) ? 1 : 0) - (seqOf(x) ? 1 : 0); });
  return hits[0] || null;
}
function tally(seq) { var n = { M:0, P:0, L:0, N:0 }; seq.split('').forEach(function (c) { n[c]++; }); return n; }
function cpct(c) { var s = seqOf(c), n = tally(s); return s ? Math.round((n.M + n.P) / s.length * 100) : 0; }

// ── 커리큘럼(DB에서 받은 것) · 표준 일정 ──
// 커리큘럼 한 개: { id, title, sum, level, w:[{t:주 제목, g:[학습 목표], h:표준 학습 시간}], hours, hpw, web:웹 자료 기반 여부, src:[{title,url}] }
// 모든 과정은 Self-paced 이다. 표준 일정(시작일 + 주 1개 단원)은 참고선일 뿐 학습자를 막지 않는다. 학습 단위: 분기(13주) · 월(4주) · 주 · 일.
var QTR = 13, API = '/api/curriculum';
function cleanCur(x) {
  var src = x && typeof x === 'object' ? (x.weeks || x.w) : null; if (!Array.isArray(src) || src.length < 4 || src.length > 52) return null;
  var w = [];
  for (var i = 0; i < src.length; i++) {
    var k = src[i]; if (!k || typeof k.t !== 'string' || !k.t.trim() || !Array.isArray(k.g)) return null;
    var g = k.g.filter(function (v) { return typeof v === 'string' && v.trim(); }).map(function (v) { return v.slice(0, 90); }).slice(0, 4); if (g.length < 1) g = ['핵심 개념 읽기', '확인 문제로 점검'];
    w.push({ t:k.t.slice(0, 40), g:g, h:Math.min(40, Math.max(1, Math.round(Number(k.h) || 4))) });
  }
  var hours = w.reduce(function (a, k) { return a + k.h; }, 0), sr = x.sources || x.src, lv = typeof x.level === 'string' ? x.level.slice(0, 10) : '';
  return { id:/^c[0-9a-f]{12}$/.test(x.id) ? x.id : '', title:String(x.title || '').slice(0, 40), sum:String(x.summary || x.sum || '').slice(0, 220), level:lv, w:w, hours:hours, hpw:Math.round(hours / w.length * 10) / 10, web:!!(x.webBased || x.web),
    src:(Array.isArray(sr) ? sr : []).filter(function (r) { return r && typeof r.url === 'string' && /^https:\/\//.test(r.url) && typeof r.title === 'string'; }).slice(0, 8).map(function (r) { return { title:r.title.slice(0, 80), url:r.url.slice(0, 200) }; }) };
}
function fixCourse(a) {
  if (a.cur) { var cc = cleanCur(a.cur); if (cc) a.cur = cc; else delete a.cur; }
  a.pid = /^p[0-9a-f]{12}$/.test(a.pid) ? a.pid : undefined; a.start = isFinite(a.start) && a.start > 0 ? Number(a.start) : undefined; a.cid = /^c[0-9a-f]{12}$/.test(a.cid) ? a.cid : undefined;
  if (a.cur && !a.seq) a.seq = new Array(a.cur.w.length + 1).join('N');
  return a;
}
function okBank(b) { return Array.isArray(b) && b.length >= 4 && b.every(function (x) { return Array.isArray(x) && typeof x[0] === 'string' && Array.isArray(x[1]) && x[1].length === 4 && Number.isInteger(x[2]) && x[2] >= 0 && x[2] < 4 && typeof x[3] === 'string'; }); }
function saveQz() { try { var ks = Object.keys(S.qz); while (ks.length > 80) delete S.qz[ks.shift()]; localStorage.setItem('navi-learn-qz', JSON.stringify(S.qz)); } catch (e) {} }
function totalWeeks(c) { return seqOf(c).length; }
function hoursOf(c, n) { var w = c.cur && c.cur.w[n - 1]; return w ? w.h : 4; }
function totalHours(c) { var s = 0; for (var n = 1; n <= totalWeeks(c); n++) s += hoursOf(c, n); return s; }
function goalsOf(c, n) { var w = c.cur && c.cur.w[n - 1]; return w ? w.g : ((GOALS[c.id] || [])[n - 1] || ['핵심 개념 읽기', '예제 풀이', '확인 문제로 점검']); }
function doneWeeks(c) { var n = tally(seqOf(c)); return n.M + n.P; }
function elapsedWeeks(c, now) { return c.start ? Math.max(0, (now - c.start) / (7 * DAY)) : null; }
// 표준 일정 대비: 표준은 주 1개 단원. exp = 지금까지 끝났어야 할 주 수. 1주 안쪽 차이는 '일정대로'로 본다.
function schedule(c, now) {
  var W = totalWeeks(c), done = doneWeeks(c), e = elapsedWeeks(c, now), exp = e == null ? null : Math.min(W, Math.floor(e)), diff = exp == null ? null : done - exp;
  var st = !W ? 'none' : done >= W ? 'done' : exp == null ? 'none' : diff >= 1 ? 'ahead' : diff >= -1 ? 'on' : 'behind';
  var label = { done:'과정을 마쳤어요', none:'표준 일정 없음', ahead:'표준보다 ' + diff + '주 앞서요', on:'표준 일정대로예요', behind:'표준보다 ' + (diff == null ? 0 : -diff) + '주 늦었어요' }[st];
  return { W:W, done:done, exp:exp, diff:diff, st:st, label:label, week:e == null ? null : Math.min(W, Math.floor(e) + 1) };
}
function passTimes(c) { var p = S.prog[c.id], r = []; if (p && p.pass) for (var k in p.pass) if (isFinite(p.pass[k])) r.push(p.pass[k]); return r.sort(function (a, b) { return a - b; }); }
function courseLog(c) { var p = S.prog[c.id]; return ((p && p.log) || []).map(function (e) { return { n:e[0], pct:e[1], ts:e[2] }; }); }
function recent(c, days) { var t = Date.now() - days * DAY, l = courseLog(c).filter(function (e) { return e.ts >= t; }), d = {}; l.forEach(function (e) { d[dayKey(e.ts)] = 1; }); return { days:Object.keys(d).length, tries:l.length }; }
function dayPlan(c, n) {
  var g = goalsOf(c, n), m = Math.max(10, Math.round(hoursOf(c, n) * 60 / 5 / 5) * 5);
  return [['1일차', '학습 목표 확인 · 핵심 개념 읽기', m], ['2일차', g[0] ? '목표 학습 · ' + g[0] : '개념 학습', m], ['3일차', g[1] ? '목표 학습 · ' + g[1] : '예제 풀이', m], ['4일차', '연습 문제 · 막히면 교수에게 질문', m], ['5일차', '확인 문제 풀이 · 틀린 문제 복습', m]];
}
function planText(c) {
  var sc = schedule(c, Date.now()), r = recent(c, 7), W = sc.W, pct = W ? Math.round(sc.done / W * 100) : 0;
  var a = c.name + ': 표준 ' + W + '주 과정 중 ' + sc.done + '주를 통과했습니다(' + pct + '%).';
  var b = sc.st === 'none' ? '' : sc.st === 'done' ? ' 과정을 마쳤습니다.' : sc.st === 'ahead' ? ' 표준 일정보다 ' + sc.diff + '주 앞서 있습니다.' : sc.st === 'on' ? ' 표준 일정대로 진행 중입니다.' : ' 표준 일정보다 ' + (-sc.diff) + '주 늦어 있어 이번 주에 한 주 분량을 따라잡는 것을 권합니다.';
  return a + b + ' 최근 7일에는 ' + (r.tries ? r.days + '일 동안 확인 문제를 ' + r.tries + '회 풀었습니다.' : '확인 문제를 풀지 않았습니다.');
}

// ── 그리기 도구(문자열을 마크업으로 해석하지 않는다) ──
function h(tag, attrs, kids) {
  var e = document.createElement(tag);
  for (var k in (attrs || {})) { var v = attrs[k]; if (k === 'class') e.className = v; else if (k === 'text') e.textContent = v; else if (k.slice(0, 2) === 'on') e[k] = v; else if (v !== false && v != null) e.setAttribute(k, v); }
  [].concat(kids || []).forEach(function (c) { if (c != null) e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
  return e;
}
function sv2(tag, a, kids) { var e = document.createElementNS('http://www.w3.org/2000/svg', tag); for (var k in (a || {})) e.setAttribute(k, a[k]); [].concat(kids || []).forEach(function (c) { if (c) e.appendChild(c); }); return e; }
function ico(k, z) { // 숙달 단계 아이콘: 시작 전(빈 원) · 연습 중(반쪽) · 통과(확인) · 숙달(별)
  var s = sv2('svg', { width:z || 20, height:z || 20, viewBox:'0 0 20 20', role:'img', 'aria-label':ST[k] }), c = 'var(--' + k.toLowerCase() + ')';
  if (k === 'N') s.appendChild(sv2('circle', { cx:10, cy:10, r:7.2, fill:'none', stroke:c, 'stroke-width':1.8 }));
  else if (k === 'L') { s.appendChild(sv2('circle', { cx:10, cy:10, r:7.2, fill:'none', stroke:c, 'stroke-width':1.8 })); s.appendChild(sv2('path', { d:'M10 3.6a6.4 6.4 0 0 0 0 12.8z', fill:c })); }
  else if (k === 'P') { s.appendChild(sv2('circle', { cx:10, cy:10, r:8, fill:c })); s.appendChild(sv2('path', { d:'M6.2 10.3l2.5 2.5 5-5.3', fill:'none', stroke:'#fff', 'stroke-width':2, 'stroke-linecap':'round', 'stroke-linejoin':'round' })); }
  else { s.appendChild(sv2('circle', { cx:10, cy:10, r:8, fill:c })); s.appendChild(sv2('polygon', { points:'10,4.2 11.8,8 16,8.4 12.8,11.2 13.8,15.4 10,13.2 6.2,15.4 7.2,11.2 4,8.4 8.2,8', fill:'#fff' })); }
  return s;
}
function ring(pct, z, label, sub, color) {
  var r = z / 2 - 6, C = 2 * Math.PI * r, v = pct == null ? 0 : Math.max(0, Math.min(100, pct)), m = z / 2;
  var s = sv2('svg', { width:z, height:z, viewBox:'0 0 ' + z + ' ' + z, 'aria-hidden':'true' }, [
    sv2('circle', { cx:m, cy:m, r:r, fill:'none', stroke:'rgba(128,134,139,.25)', 'stroke-width':7 }),
    sv2('circle', { cx:m, cy:m, r:r, fill:'none', stroke:color || 'var(--pri)', 'stroke-width':7, 'stroke-linecap':'round', 'stroke-dasharray':(C * v / 100) + ' ' + C, transform:'rotate(-90 ' + m + ' ' + m + ')' })]);
  return h('div', { class:'ring', style:'width:' + z + 'px;height:' + z + 'px' }, [s, h('div', { class:'rv' }, [h('b', { text:label, style:z < 70 ? 'font-size:14px' : '' }), sub ? h('span', { text:sub }) : null])]);
}
function bar(seq) { return h('div', { class:'bar', role:'img', 'aria-label':'주차별 마스터리 단계' }, seq.split('').map(function (c) { return h('i', { class:c }); })); }
function count(seq) { var n = tally(seq); return '숙달 ' + n.M + ' · 통과 ' + n.P + ' · 연습 중 ' + n.L + ' · 시작 전 ' + n.N + '주'; }
function legend() { return h('div', { class:'legend' }, ['M','P','L','N'].map(function (k) { return h('span', {}, [ico(k, 16), ST[k]]); })); }
function pill(t, k) { return h('span', { class:'pill ' + (k || ''), text:t }); }
function btn(t, cls, fn) { return h('button', { class:'btn ' + (cls || ''), text:t, onclick:fn }); }
var M = null, LS = {};
function $(id) { return M ? M.querySelector('#' + id) : null; }
function emit(t, p) { (LS[t] || []).slice().forEach(function (f) { try { f(p); } catch (e) {} }); }
function ask(text) { emit('ask', text || ''); }
function go(v, id) { S.view = v; if (id !== undefined) S.cur = id; render(); try { M.scrollIntoView({ block:'start' }); } catch (e) {} }
function openWeek(c, n, v) { S.cur = c.id; S.week = n; S.q = null; go(v, c.id); }
function head(back, title, lead) {
  return [back ? h('button', { class:'back', text:'← ' + back[0], onclick:back[1] }) : null, h('h1', { text:title }), lead ? h('p', { class:'lead', text:lead }) : null];
}
var TABS = [['subjects','내 수업'],['plan','진행 현황'],['history','학습 기록'],['report','학습 보고서'],['career','진로 추천']];
function topbar() {
  var act = { course:'subjects', week:'subjects', quiz:'subjects' }[S.view] || S.view;
  return h('div', { class:'topin' }, [
    h('div', { class:'brand' }, [h('div', {}, [h('span', { text:'인프라 AI · 교육' })])]),
    h('div', { class:'tabs', role:'tablist' }, TABS.map(function (t) { return h('button', { class:'tab', role:'tab', 'aria-selected':String(act === t[0]), text:t[1], onclick:function () { go(t[0]); } }); }))]);
}

// ── 학습 습관·다음 할 일·복습 ──
function dayKey(ts) { var d = new Date(ts); return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate(); }
function allLog() { var r = []; all().forEach(function (c) { ((S.prog[c.id] && S.prog[c.id].log) || []).forEach(function (e) { r.push({ c:c, n:e[0], pct:e[1], ts:e[2] }); }); }); return r; }
function weekDone() { var t = Date.now() - 7 * DAY; return allLog().filter(function (e) { return e.ts >= t; }).length; }
function streak() { var days = {}, n = 0, t = Date.now(); allLog().forEach(function (e) { days[dayKey(e.ts)] = 1; }); if (!days[dayKey(t)]) t -= DAY; while (days[dayKey(t)]) { n++; t -= DAY; } return n; }
function nextUp() {
  var cs = all().filter(function (c) { return seqOf(c) && nextIdx(seqOf(c)) >= 0; });
  var c = cs.filter(function (x) { return seqOf(x).indexOf('L') >= 0; })[0] || cs.filter(function (x) { return tally(seqOf(x)).M + tally(seqOf(x)).P > 0; })[0] || cs[0];
  return c ? { c:c, i:nextIdx(seqOf(c)) } : null;
}
function reviews() {
  var r = [], now = Date.now();
  all().forEach(function (c) {
    var p = S.prog[c.id], seq = seqOf(c);
    if (c.review) { var m = /^(\d+)주차/.exec(c.review); r.push({ c:c, n:m ? Number(m[1]) : 0, t:c.review }); }
    if (p) seq.split('').forEach(function (k, i) { if (k === 'P' && p.pass && p.pass[i + 1] && now - p.pass[i + 1] >= RECHECK) r.push({ c:c, n:i + 1, t:(i + 1) + '주차 ' + topicOf(c, i + 1) + ' — 다시 풀면 숙달이 됩니다' }); });
  });
  return r.slice(0, 5);
}

// ── 과목 검색 · 커리큘럼 만들기(DB 공유) ──
var ERR = { not_found:'서버에서 이 커리큘럼을 찾지 못했어요. 교수에게 문제를 요청해 보세요.', short:'검색어를 두 글자 이상 써 주세요.', unavailable:'새 커리큘럼을 만드는 서버가 아직 준비되지 않았어요. 이미 만들어진 커리큘럼은 검색해서 바로 쓸 수 있어요.', limit:'오늘 새로 만들 수 있는 횟수를 모두 썼어요. 내일 다시 시도해 주세요.', busy:'지금 요청이 많아요. 잠시 뒤에 다시 시도해 주세요.', not_a_subject:'학습 과목으로 보기 어려운 검색어예요. 배우고 싶은 과목이나 주제 이름으로 검색해 주세요.', llm_error:'커리큘럼을 만들지 못했어요. 잠시 뒤에 다시 시도해 주세요.', bad_format:'만든 커리큘럼의 형식이 맞지 않아 저장하지 않았어요. 다시 시도해 주세요.', network:'서버에 연결하지 못했어요. 네트워크를 확인하고 다시 시도해 주세요.' };
function errMsg(code) { return ERR[code] || ERR.network; }
function rnd(n) { var a = new Uint8Array(n); try { crypto.getRandomValues(a); } catch (e) { for (var i = 0; i < n; i++) a[i] = Math.floor(Math.random() * 256); } return [].map.call(a, function (x) { return ('0' + x.toString(16)).slice(-2); }).join('').slice(0, n); }
function owner() { try { var t = localStorage.getItem('navi-learn-owner'); if (!t || t.length < 16) { t = rnd(24); localStorage.setItem('navi-learn-owner', t); } return t; } catch (e) { return S.tok || (S.tok = rnd(24)); } }
function api(path, body, ms) {
  if (typeof fetch !== 'function') return Promise.resolve({ ok:false, error:'network' });
  var ctl = typeof AbortController === 'function' ? new AbortController() : null, tm = ctl ? setTimeout(function () { ctl.abort(); }, ms || 20000) : 0;
  return fetch(API + path, { method:body ? 'POST' : 'GET', headers:{ 'Content-Type':'application/json', 'X-Qna-Owner':owner() }, body:body ? JSON.stringify(body) : undefined, signal:ctl ? ctl.signal : undefined })
    .then(function (r) { return r.json().catch(function () { return { ok:false, error:'network' }; }); })
    .then(function (j) { clearTimeout(tm); return j || { ok:false, error:'network' }; }, function () { clearTimeout(tm); return { ok:false, error:'network' }; });
}
function loadList() {
  if (S.srch.list !== null) return; S.srch.list = [];
  api('/list').then(function (j) { if (j.ok && Array.isArray(j.list)) { S.srch.list = j.list.filter(function (x) { return x && typeof x.title === 'string' && typeof x.id === 'string'; }).slice(0, 12); drawSearch(); } });
}
function doSearch(q) {
  q = String(q || '').trim().slice(0, 40); S.srch.q = q; if (!S.srch.open) { S.srch.open = true; render(); }
  var inp = $('lrn-srch-in'); if (inp) inp.value = q;
  if (q.replace(/\s/g, '').length < 2) { S.srch.st = 'err'; S.srch.err = ERR.short; return drawSearch(); }
  S.srch.st = 'search'; S.srch.cur = null; S.srch.rel = []; drawSearch();
  var my = ++S.srch.n;
  api('/search?q=' + encodeURIComponent(q)).then(function (j) {
    if (my !== S.srch.n) return;
    if (!j.ok) { S.srch.st = 'err'; S.srch.err = errMsg(j.error); }
    else if (j.found) { var cc = cleanCur(j.curriculum); if (cc) { S.srch.st = 'found'; S.srch.cur = cc; S.srch.from = 'db'; } else { S.srch.st = 'err'; S.srch.err = ERR.bad_format; } }
    else { S.srch.st = 'none'; S.srch.can = j.canBuild !== false; S.srch.rel = (j.related || []).filter(function (x) { return x && typeof x.title === 'string'; }).slice(0, 5); }
    drawSearch();
  });
}
function doBuild() {
  var q = S.srch.q; S.srch.st = 'build'; drawSearch(); var my = ++S.srch.n;
  api('/build', { q:q }, 90000).then(function (j) {
    if (my !== S.srch.n) return;
    var cc = j.ok ? cleanCur(j.curriculum) : null;
    if (cc) { S.srch.st = 'found'; S.srch.cur = cc; S.srch.from = j.created ? 'new' : 'db'; } else { S.srch.st = 'err'; S.srch.err = j.ok ? ERR.bad_format : errMsg(j.error); }
    drawSearch();
  });
}
function haveCur(id) { return id ? all().filter(function (c) { return c.cid === id; })[0] : null; }
function addCurriculum(cur) {
  var ex = haveCur(cur.id); if (ex) return go('course', ex.id);
  var lv = cur.level || '대학', c = { id:'u' + Date.now(), cid:cur.id || undefined, name:cur.title, subj:cur.title.slice(0, 12), level:lv + ' · ' + cur.title.slice(0, 12), prof:cur.title.slice(0, 10) + ' 교수', seq:new Array(cur.w.length + 1).join('N'), goal:'', start:Date.now(), cur:cur };
  S.added.push(c); save(); S.srch = { q:'', st:'idle', cur:null, from:'', rel:[], err:'', list:S.srch.list, n:S.srch.n + 1, open:false }; go('course', c.id);
}
function srcLinks(cur) {
  if (!cur.web || !cur.src.length) return h('div', { class:'sub', text:'웹에서 찾은 자료가 없어 AI가 일반적으로 알려진 표준 구성으로 작성했어요. 내용을 꼭 확인하세요.' });
  var d = h('div', { class:'sub srcs' }, ['웹 자료 ' + cur.src.length + '건을 바탕으로 AI가 작성했어요 · 참고: ']);
  cur.src.forEach(function (r, i) { if (i) d.appendChild(document.createTextNode(', ')); d.appendChild(h('a', { href:r.url, target:'_blank', rel:'noopener noreferrer', text:r.title })); });
  return d;
}
function curPreview(cur, from) {
  var have = haveCur(cur.id), q = Math.ceil(cur.w.length / QTR);
  var list = h('div', { class:'wlist', tabindex:'0', role:'region', 'aria-label':'주차별 구성' }, cur.w.map(function (k, i) { return h('div', {}, [h('b', { text:(i + 1) + '주' }), h('span', { text:k.t }), h('i', { text:k.h + '시간' })]); }));
  var flag = h('button', { class:'btn quiet sm', text:'내용이 이상해요', onclick:function (e) { var b = e.currentTarget; b.disabled = true; b.textContent = '신고했어요'; if (cur.id) api('/' + cur.id + '/flag', {}); } });
  return h('div', { class:'card col', style:'background:var(--bg);box-shadow:none;margin-top:14px;gap:12px' }, [
    h('div', { class:'rowf' }, [pill(from === 'new' ? '방금 새로 만들었어요' : '커리큘럼 DB에서 바로 불러왔어요', from === 'new' ? 'l' : 'm'), pill(cur.level || '')]),
    h('div', { style:'font-size:20px;font-weight:700;letter-spacing:-.01em', text:cur.title }),
    cur.sum ? h('div', { text:cur.sum }) : null,
    h('div', { class:'g4' }, [['표준 기간', cur.w.length + '주'], ['표준 학습 시간', '총 ' + cur.hours + '시간'], ['주당', cur.hpw + '시간'], ['구성', q + '개 분기 · ' + Math.ceil(cur.w.length / UNIT) + '개월']].map(function (x) { return h('div', { class:'tile', style:'background:var(--card)' }, [h('div', { class:'k', text:x[0] }), h('div', { class:'v', style:'font-size:18px', text:x[1] })]); })),
    h('div', { class:'sub', text:'Self-paced · 내 속도로 학습해요. 표준 기간은 그 과목을 처음 배우는 사람이 주당 ' + Math.round(cur.hpw) + '시간쯤 쓸 때를 기준으로 한 참고 일정이에요.' }),
    list, srcLinks(cur),
    h('div', { class:'rowf' }, [have ? btn('이미 내 수업에 있어요 · 열기', 'fill', function () { go('course', have.id); }) : btn('내 수업에 추가', 'fill', function () { addCurriculum(cur); }), btn('닫기', 'quiet', function () { S.srch.st = 'idle'; S.srch.cur = null; drawSearch(); }), flag]),
    h('div', { class:'sub', text:'AI가 만든 커리큘럼은 틀릴 수 있어요. 학교 교과나 자격시험 준비에는 공식 교재·강의 계획서와 함께 쓰세요.' })]);
}
function helpOn() {   // 검색 도움말은 처음 한 번만 보여 준다(다음부터 보지 않기)
  if (S.srch.help === undefined) { var seen = false; try { seen = localStorage.getItem('navi-learn-help-srch') === '1'; } catch (e) {} S.srch.help = !seen; if (!seen) try { localStorage.setItem('navi-learn-help-srch', '1'); } catch (e) {} }
  return S.srch.help;
}
function searchBtn() {
  var s = sv2('svg', { width:22, height:22, viewBox:'0 0 22 22', 'aria-hidden':'true' });
  s.appendChild(sv2('circle', { cx:9.5, cy:9.5, r:6, fill:'none', stroke:'currentColor', 'stroke-width':2 })); s.appendChild(sv2('path', { d:'M14 14l5 5', fill:'none', stroke:'currentColor', 'stroke-width':2, 'stroke-linecap':'round' }));
  var b = h('button', { class:'btn quiet', title:'과목 검색', 'aria-label':'과목 검색', 'aria-expanded':String(S.srch.open), style:'padding:10px 12px;flex:none', onclick:function () { S.srch.open = !S.srch.open; if (!S.srch.open) S.srch.help = false; render(); if (S.srch.open) setTimeout(function () { var i = $('lrn-srch-in'); if (i) i.focus(); }, 0); } }, [s]);
  return b;
}
function searchCard() {
  if (!S.srch.open) return null;
  var inp = h('input', { id:'lrn-srch-in', type:'search', placeholder:'배우고 싶은 과목이나 주제 (예: 거시경제학, 파이썬 기초, 중2 수학)', maxlength:'40', 'aria-label':'과목 검색', value:S.srch.q });
  inp.onkeydown = function (e) { if (e.key === 'Enter') doSearch(inp.value); };
  var help = helpOn() ? h('div', { class:'sub', id:'lrn-srch-help' }, ['온라인 강좌가 다루는 어떤 과목이든 검색해 보세요. 이미 만들어진 커리큘럼은 바로 열리고, 없으면 웹에서 자료를 찾아 새로 만들어 모든 학습자가 함께 쓰도록 저장해요. ', h('button', { class:'btn quiet sm', text:'다음부터 보지 않기', onclick:function () { S.srch.help = false; var e = $('lrn-srch-help'); if (e) e.remove(); } })]) : null;
  return h('div', { class:'card col', style:'margin-top:16px;gap:12px' }, [
    h('div', { class:'sh' }, [inp, h('button', { id:'lrn-srch-btn', class:'btn fill', text:'검색', onclick:function () { doSearch(inp.value); } })]),
    help, h('div', { id:'lrn-srch-out' }), h('div', { id:'lrn-srch-list' })]);
}
function drawSearch() {
  var out = $('lrn-srch-out'); if (!out) return; var s = S.srch; out.textContent = '';
  var b = $('lrn-srch-btn'); if (b) b.disabled = s.st === 'search' || s.st === 'build';
  if (s.st === 'search') out.appendChild(h('div', { class:'rowf', role:'status' }, [h('span', { class:'spin' }), h('span', { class:'sub', text:'커리큘럼 DB에서 찾는 중이에요…' })]));
  else if (s.st === 'build') out.appendChild(h('div', { class:'card col', role:'status', style:'background:var(--bg);box-shadow:none' }, [h('div', { class:'rowf' }, [h('span', { class:'spin' }), h('b', { text:'“' + s.q + '” 커리큘럼을 만들고 있어요' })]), h('div', { class:'sub', text:'웹에서 자료를 찾고 → 표준 기간과 주별 학습 목표를 짜고 → DB에 저장해요. 보통 30초에서 1분쯤 걸려요. 이 화면을 닫지 마세요.' })]));
  else if (s.st === 'err') out.appendChild(h('div', { class:'note', role:'alert', text:s.err }));
  else if (s.st === 'found' && s.cur) out.appendChild(curPreview(s.cur, s.from));
  else if (s.st === 'none') {
    var kids = [h('b', { text:'“' + s.q + '” 커리큘럼은 아직 DB에 없어요' })];
    if (s.rel.length) { kids.push(h('div', { class:'sub', text:'비슷한 과정이 있어요:' }), h('div', { class:'chips' }, s.rel.map(function (r) { return h('button', { class:'chip', text:r.title + ' · ' + r.weeks + '주', onclick:function () { doSearch(r.title); } }); }))); }
    kids.push(h('div', { class:'sub', text:s.can === false ? '새 커리큘럼을 만드는 서버가 아직 준비되지 않았어요. 아래 \'과목 추가\'로 교수와 상담해 시작할 수 있어요.' : '웹에서 자료를 찾아 새로 만들까요? 만든 커리큘럼은 DB에 저장되어 다음 학습자는 바로 쓸 수 있어요.' }));
    kids.push(h('div', { class:'rowf' }, [s.can === false ? null : btn('새로 만들기', 'fill', doBuild), btn('닫기', 'quiet', function () { s.st = 'idle'; drawSearch(); })]));
    out.appendChild(h('div', { class:'card col', style:'background:var(--bg);box-shadow:none' }, kids));
  }
  var ls = $('lrn-srch-list'); if (ls) { ls.textContent = ''; if (s.list && s.list.length) { ls.appendChild(h('div', { class:'sub', style:'margin-bottom:8px', text:'다른 학습자가 만든 과정' })); ls.appendChild(h('div', { class:'chips' }, s.list.map(function (r) { return h('button', { class:'chip', text:r.title + ' · ' + r.weeks + '주', onclick:function () { doSearch(r.title); } }); }))); } }
}

// ── 진행 현황(학부모·교사용): 표준 일정에 견준 진도를 분기·월·주·일로 ──
var GRAINS = [['qtr', '분기'], ['month', '월'], ['week', '주'], ['day', '일']];
function groupBars(c, size, unit) {
  var seq = seqOf(c), W = seq.length, e = schedule(c, Date.now()).exp, box = h('div', {}, []);
  for (var a = 0, k = 1; a < W; a += size, k++) (function (a, k) {
    var b = Math.min(a + size, W), n = tally(seq.slice(a, b)), len = b - a, ex = e == null ? null : Math.max(0, Math.min(len, e - a));
    box.appendChild(h('div', { class:'qb' }, [h('div', { class:'nm', text:k + unit + ' · ' + (a + 1) + '–' + b + '주' }),
      h('div', { class:'tr', role:'img', 'aria-label':k + unit + ' 통과 ' + (n.M + n.P) + '주 / ' + len + '주' + (ex == null ? '' : ', 표준 ' + ex + '주') }, [h('em', { class:'M', style:'width:' + (n.M / len * 100) + '%' }), h('em', { class:'P', style:'width:' + (n.P / len * 100) + '%' }), ex == null ? null : h('u', { style:'left:' + (ex / len * 100) + '%', title:'표준 일정' })]),
      h('div', { class:'v', text:(n.M + n.P) + '/' + len + '주' })]));
  })(a, k);
  return box;
}
function weekGrid(c) {
  var seq = seqOf(c), sc = schedule(c, Date.now());
  return h('div', { class:'wk' }, seq.split('').map(function (k, i) { return h('button', { class:k + (sc.week === i + 1 ? ' now' : ''), title:(i + 1) + '주차 ' + (topicOf(c, i + 1) || '') + ' · ' + ST[k], 'aria-label':(i + 1) + '주차 ' + ST[k], text:String(i + 1), onclick:function () { openWeek(c, i + 1, 'week'); } }); }));
}
function dayGrid(c) {
  var cnt = {}, now = Date.now(), cells = [];
  courseLog(c).forEach(function (e) { var k = dayKey(e.ts); cnt[k] = (cnt[k] || 0) + 1; });
  for (var i = 27; i >= 0; i--) { var t = now - i * DAY, n = cnt[dayKey(t)] || 0, d = new Date(t); cells.push(h('div', { class:(n ? 'd' + Math.min(n, 3) : '') + (i === 0 ? ' today' : ''), title:(d.getMonth() + 1) + '월 ' + d.getDate() + '일 · 확인 문제 ' + n + '회', text:String(d.getDate()) })); }
  return h('div', { class:'cal', role:'img', 'aria-label':'최근 28일 학습일' }, cells);
}
function trendChart(c) {
  var W = totalWeeks(c), e = elapsedWeeks(c, Date.now()); if (e == null) return null;
  var xm = Math.max(W, Math.ceil(e)), L = 34, R = 10, T = 12, B = 26, vw = 480, vh = 180, pw = vw - L - R, ph = vh - T - B;
  function X(w) { return L + w / xm * pw; } function Y(n) { return T + ph - n / W * ph; }
  var pts = passTimes(c).map(function (t, i) { return [Math.max(0, (t - c.start) / (7 * DAY)), i + 1]; }), done = doneWeeks(c);
  var g = [sv2('line', { x1:L, y1:Y(0), x2:vw - R, y2:Y(0), stroke:'var(--line)' }), sv2('line', { x1:L, y1:Y(W), x2:vw - R, y2:Y(W), stroke:'var(--line)', 'stroke-dasharray':'3 3' })];
  for (var q = QTR; q < xm; q += QTR) g.push(sv2('line', { x1:X(q), y1:T, x2:X(q), y2:Y(0), stroke:'var(--line)', 'stroke-dasharray':'2 4' }));
  g.push(sv2('line', { x1:X(0), y1:Y(0), x2:X(W), y2:Y(W), stroke:'var(--n)', 'stroke-width':2, 'stroke-dasharray':'6 4' }));
  g.push(sv2('line', { x1:X(Math.min(e, xm)), y1:T, x2:X(Math.min(e, xm)), y2:Y(0), stroke:'var(--on2)', 'stroke-width':1 }));
  var path = 'M' + X(0) + ' ' + Y(0); pts.forEach(function (p) { path += ' L' + X(Math.min(p[0], xm)) + ' ' + Y(p[1] - 1) + ' L' + X(Math.min(p[0], xm)) + ' ' + Y(p[1]); }); path += ' L' + X(Math.min(e, xm)) + ' ' + Y(pts.length ? pts.length : done);
  if (pts.length || !done) g.push(sv2('path', { d:path, fill:'none', stroke:'var(--pri)', 'stroke-width':2.5, 'stroke-linejoin':'round' }));
  g.push(sv2('circle', { cx:X(Math.min(e, xm)), cy:Y(done), r:5, fill:'var(--pri)' }));
  [[0, '0'], [W, W + '주']].forEach(function (t) { var tx = sv2('text', { x:L - 6, y:Y(t[0]) + 4, 'text-anchor':'end', 'font-size':12, fill:'var(--on2)' }); tx.textContent = t[1]; g.push(tx); });
  for (var xq = 0; xq <= xm; xq += QTR) { var xt = sv2('text', { x:X(xq), y:vh - 8, 'text-anchor':xq ? 'middle' : 'start', 'font-size':12, fill:'var(--on2)' }); xt.textContent = xq ? xq + '주' : '시작'; g.push(xt); }
  var ttl = sv2('title', {}); ttl.textContent = '시작 후 경과 주 수에 따른 통과한 주 수. 점선은 표준 일정, 파란 선은 실제.'; g.unshift(ttl);
  return h('div', {}, [h('div', { class:'rowf', style:'gap:16px;margin-top:6px' }, [h('span', { class:'sub' }, [h('span', { style:'color:var(--n)', text:'╌╌ ' }), '표준 일정']), h('span', { class:'sub' }, [h('span', { style:'color:var(--pri)', text:'━ ' }), '실제 통과한 주'])]), sv2('svg', { viewBox:'0 0 ' + vw + ' ' + vh, width:'100%', style:'max-width:720px;display:block;margin-top:6px', role:'img' }, g)]);
}
function planCard(c) {
  var seq = seqOf(c), now = Date.now();
  if (!seq) return h('div', { class:'card col', style:'margin-top:16px' }, [h('b', { text:c.name }), h('div', { class:'sub', text:'아직 커리큘럼이 없어 진행 현황이 없습니다. 교수와 상담하거나 과목을 검색해 커리큘럼을 받아 보세요.' })]);
  var sc = schedule(c, now), r = recent(c, 7), pct = Math.round(sc.done / sc.W * 100), hd = 0;
  for (var n = 1; n <= sc.W; n++) if (seq.charAt(n - 1) === 'P' || seq.charAt(n - 1) === 'M') hd += hoursOf(c, n);
  var body;
  if (S.grain === 'qtr') body = groupBars(c, QTR, '분기'); else if (S.grain === 'month') body = groupBars(c, UNIT, '개월'); else if (S.grain === 'week') body = h('div', {}, [weekGrid(c), h('div', { class:'sub', style:'margin-top:10px' }, [sc.week ? '▼ 표시는 표준 일정상 이번 주(' + sc.week + '주차)예요. 누르면 그 주 학습으로 가요. ' : '', legend()])]);
  else { var cw = Math.min(nextIdx(seq) < 0 ? sc.W : nextIdx(seq) + 1, sc.W); body = h('div', {}, [dayGrid(c), h('div', { class:'sub', style:'margin-top:8px', text:'최근 28일에 확인 문제를 푼 날이에요(진할수록 많이 푼 날).' }), h('div', { style:'margin-top:14px' }, [h('b', { text:cw + '주차 표준 일일 계획 · 주 ' + hoursOf(c, cw) + '시간' }), h('div', {}, dayPlan(c, cw).map(function (d) { return h('div', { class:'dp' }, [h('b', { text:d[0] }), h('span', { text:d[1] }), h('i', { text:'약 ' + d[2] + '분' })]); }))])]); }
  return h('div', { class:'card col', style:'margin-top:16px;gap:14px' }, [
    h('div', { class:'rowf', style:'justify-content:space-between;flex-wrap:nowrap;gap:12px' }, [h('div', { class:'col', style:'gap:6px;min-width:0' }, [h('div', { class:'rowf' }, [pill(c.level || ''), pill(sc.label, { done:'m', ahead:'m', on:'p', behind:'l', none:'' }[sc.st])]), h('div', { style:'font-size:20px;font-weight:700;letter-spacing:-.01em', text:c.name })]), ring(pct, 72, pct + '%', '진도')]),
    h('p', { text:planText(c) }),
    h('div', { class:'g4' }, [['진도', sc.done + ' / ' + sc.W + '주'], ['표준 위치', sc.exp == null ? '일정 없음' : (sc.week || sc.W) + '주차'], ['표준 시간 기준', hd + ' / ' + totalHours(c) + '시간'], ['최근 7일', r.tries ? r.days + '일 · ' + r.tries + '회' : '학습 없음']].map(function (x) { return h('div', { class:'tile' }, [h('div', { class:'k', text:x[0] }), h('div', { class:'v', style:'font-size:19px', text:x[1] })]); })),
    h('div', {}, [h('div', { class:'noprint', style:'margin-bottom:4px' }, [h('div', { class:'seg', role:'group', 'aria-label':'보기 단위' }, GRAINS.map(function (g) { return h('button', { 'aria-pressed':String(S.grain === g[0]), text:g[1], onclick:function () { S.grain = g[0]; render(); } }); }))]), body]),
    trendChart(c),
    h('div', { class:'rowf noprint' }, [btn('이 과목으로', 'sm', function () { go('course', c.id); }), btn('교수에게 진도 상담', 'sm quiet', function () { ask(c.name + ' 진도가 표준 일정에 비해 어떤지 상담하고 싶어요'); })])]);
}
function viewPlan() {
  var kids = head(null, '진행 현황', '학부모·교사가 한 눈에 볼 수 있게, 표준 일정에 견준 진도를 분기·월·주·일 단위로 보여 줍니다.');
  kids.push(h('div', { class:'rowf noprint', style:'margin-top:16px;justify-content:space-between' }, [h('span', { class:'sub', text:'모든 과정은 자기 속도(Self-paced)로 진행해요. 표준 일정은 참고선이라 늦어도 괜찮고, 길게 쉬었다면 다시 이어서 하면 돼요.' }), btn('인쇄 · PDF 저장', 'sm quiet', function () { try { window.print(); } catch (e) {} })]));
  all().forEach(function (c) { kids.push(planCard(c)); });
  kids.push(h('div', { class:'foot', text:'진도는 확인 문제를 통과한 주 수입니다. \'표준 시간 기준\'은 통과한 주의 표준 학습 시간을 더한 값이며 실제로 공부한 시간을 재는 것은 아닙니다. 경제학 입문·미적분 기초의 시작일과 기록은 예시입니다. 기록은 이 브라우저에만 저장됩니다.' }));
  return kids;
}

// ── 홈(내 수업) ──
function viewSubjects() {
  var nu = nextUp(), kids = head(null, '내 수업'); kids[1] = h('div', { class:'rowf', style:'justify-content:space-between;flex-wrap:nowrap;gap:12px' }, [kids[1], searchBtn()]);
  var hero = h('div', { class:'card hero col' });
  if (nu) {
    var c = nu.c, i = nu.i;
    hero.appendChild(h('div', { class:'rowf', style:'justify-content:space-between;gap:16px;flex-wrap:nowrap' }, [
      h('div', { class:'col', style:'flex:1;min-width:0' }, [h('div', { class:'sub', text:'다음 할 일 · ' + c.name }), h('div', { class:'big', text:(i + 1) + '주차 ' + (topicOf(c, i + 1) || '학습') }), h('div', { class:'sub', text:'약 15분 · 학습 목표 확인 → 확인 문제(' + GATE + '% 이상이면 통과)' })]),
      ring(cpct(c), 84, cpct(c) + '%', '코스 숙달도', '#fff')]));
    hero.appendChild(h('div', { class:'rowf', style:'margin-top:6px' }, [btn('학습 시작', 'white', function () { openWeek(c, i + 1, 'week'); }), btn('확인 문제 풀기', 'ghost', function () { openWeek(c, i + 1, 'quiz'); }), btn('교수에게 묻기', 'ghost', function () { ask(c.name + ' ' + (i + 1) + '주차에서 궁금한 점이 있어요'); })]));
  } else {
    hero.appendChild(h('div', { class:'big', text:'과목을 추가해 시작하세요' }));
    hero.appendChild(h('div', { class:'sub', text:'배우고 싶은 과목을 입력하면 그 과목의 AI 교수를 불러와 맞춤 커리큘럼을 만들어 줍니다.' }));
    hero.appendChild(h('div', { class:'rowf' }, [btn('과목 추가', 'white', openAdd)]));
  }
  var wd = weekDone(), st = streak(), gc = h('div', { class:'card col' }, [
    h('div', { class:'rowf', style:'gap:16px;flex-wrap:nowrap' }, [ring(Math.round(Math.min(wd, S.goal) / S.goal * 100), 84, wd + '/' + S.goal, '이번 주', wd >= S.goal ? 'var(--m)' : 'var(--pri)'),
      h('div', { class:'col', style:'gap:2px' }, [h('b', { text:'이번 주 확인 문제 목표' }), h('span', { class:'sub', text:wd >= S.goal ? '목표를 달성했습니다.' : '최근 7일에 ' + wd + '회 풀었습니다.' }), h('span', { class:'sub', text:st ? st + '일 연속 학습 중' : '오늘 첫 확인 문제를 풀어 보세요.' })])]),
    h('div', { class:'chips', role:'group', 'aria-label':'주간 목표 횟수' }, [2, 3, 5, 7].map(function (n) { return h('button', { class:'chip', 'aria-pressed':String(S.goal === n), text:'주 ' + n + '회', onclick:function () { S.goal = n; save(); render(); } }); }))]);
  kids.push(searchCard()); loadList(); setTimeout(drawSearch, 0);
  kids.push(h('div', { class:'g2' }, [hero, gc]));
  var rv = reviews();
  if (rv.length) {
    kids.push(h('h2', { text:'복습 대기열' }), h('div', { class:'card', style:'padding:6px 22px' }, rv.map(function (x) {
      return h('div', { class:'row' }, [ico('P', 20), h('div', { style:'flex:1;min-width:200px' }, [h('b', { text:x.c.name }), h('div', { class:'sub', text:x.t })]), btn('복습하기', 'sm', function () { x.n ? openWeek(x.c, x.n, 'quiz') : go('course', x.c.id); })]);
    })));
  }
  kids.push(h('div', { class:'rowf', style:'justify-content:space-between;margin-top:36px' }, [h('h2', { text:'내 과목', style:'margin:0' }), legend()]));
  var cards = all().map(function (c) {
    var seq = seqOf(c), nl = nextLabel(c);
    return h('div', { class:'card cc' }, [
      h('div', { class:'rowf', style:'justify-content:space-between;flex-wrap:nowrap;gap:12px' }, [h('div', { class:'col', style:'gap:6px;min-width:0' }, [pill(c.level || ''), h('div', { class:'nm', text:c.name })]), seq ? ring(cpct(c), 64, cpct(c) + '%', '') : null]),
      seq ? bar(seq) : null,
      seq ? h('div', { class:'sub', text:count(seq) }) : h('div', { class:'sub', text:'교수와 상담한 뒤 맞춤 커리큘럼이 만들어집니다.' }),
      nl ? h('div', { class:'sub' }, [h('b', { text:'이어서 ', style:'color:var(--on)' }), nl]) : null,
      c.review ? h('div', { class:'note', text:'복습 권장 · ' + c.review }) : null,
      h('div', { class:'rowf', style:'margin-top:auto;justify-content:space-between' }, [h('span', { class:'sub', text:'담당 · ' + c.prof }), btn(seq ? '이어서 학습 →' : '교수와 시작하기 →', 'sm', function () { go('course', c.id); })])]);
  });
  cards.push(h('button', { class:'card add', onclick:openAdd }, [h('span', { text:'+ 과목 추가' }), h('span', { class:'sub', style:'font-weight:400', text:'어떤 과목이든 · AI 교수 목록에서 찾거나 새로 만들어요' })]));
  kids.push(h('div', { class:'g3', style:'margin-top:12px' }, cards), h('div', { class:'foot', text:'경제학 입문·미적분 기초와 학습 기록은 예시 데이터입니다. 추가한 과목과 기록은 이 브라우저에만 저장됩니다.' }));
  return kids;
}

// ── 과목: 단원·주차 경로 ──
function profCard(c, msg) {
  return h('div', { class:'card col' }, [h('div', { class:'prof' }, [h('div', { class:'av', text:(c.subj || c.name).charAt(0) }), h('div', {}, [h('b', { text:c.prof }), h('div', { class:'sub', text:'이 과목 담당 AI 교수' })])]),
    h('p', { class:'sub', text:msg || '개념 설명·질문 답변·힌트·학습 계획 조언을 해 줍니다. 정답은 미리 알려 주지 않고 풀이 방향만 짚어 줍니다.' }), btn('교수에게 묻기', 'fill', function () { ask(''); })]);
}
function viewCourse() {
  var c = find(S.cur); if (!c) return viewSubjects();
  var seq = seqOf(c), kids = head(['내 수업', function () { go('subjects'); }], c.name, c.level + ' · 담당 ' + c.prof + (c.cur ? ' · 표준 ' + c.cur.w.length + '주 · 총 ' + c.cur.hours + '시간(주 ' + c.cur.hpw + '시간)' : ''));
  if (!seq) {
    kids.push(h('div', { class:'g2' }, [h('div', { class:'card col' }, [h('div', { class:'nm', style:'font-size:18px;font-weight:700', text:'아직 커리큘럼이 없습니다' }), h('p', { class:'sub', text:'교수에게 지금 수준과 목표를 말하면, 학습자에게 맞춘 주차별 커리큘럼과 일정표를 만들어 줍니다.' }), h('div', { class:'rowf' }, [btn('교수에게 말하기', 'fill', function () { ask(c.goal || (c.subj + ' 학습을 시작하고 싶어요')); })])]), profCard(c)]));
    return kids;
  }
  var i = nextIdx(seq); if (i < 0) i = seq.length - 1;
  var hero = h('div', { class:'card hero col' }, [
    h('div', { class:'rowf', style:'justify-content:space-between;flex-wrap:nowrap;gap:16px' }, [h('div', { class:'col', style:'flex:1;min-width:0' }, [h('div', { class:'sub', text:'이어서 학습하기' }), h('div', { class:'big', text:nextLabel(c) || ((i + 1) + '주차') }), h('div', { class:'sub', text:(i + 1) + '주차 확인 문제를 ' + GATE + '% 이상 맞히면 ' + (i + 2) + '주차로 넘어가길 권합니다.' })]), ring(cpct(c), 84, cpct(c) + '%', '코스 숙달도', '#fff')]),
    h('div', { class:'rowf' }, [btn('학습 시작', 'white', function () { openWeek(c, i + 1, 'week'); }), btn('확인 문제 풀기', 'ghost', function () { openWeek(c, i + 1, 'quiz'); })])]);
  var side = h('div', { class:'col', style:'gap:18px' }, [profCard(c), h('div', { class:'card col' }, [h('b', { text:'숙달 현황' }), bar(seq), h('div', { class:'sub', text:count(seq) }), legend(), c.review ? h('div', { class:'note', text:'복습 권장 · ' + c.review }) : null])]);
  var main = h('div', {}, [hero]);
  if (c.start) { var sc0 = schedule(c, Date.now()); main.appendChild(h('div', { class:'card col', style:'margin-top:14px' }, [h('div', { class:'rowf', style:'justify-content:space-between' }, [h('b', { text:'분기별 진도' }), pill(sc0.label, { done:'m', ahead:'m', on:'p', behind:'l', none:'' }[sc0.st])]), groupBars(c, QTR, '분기'), h('div', { class:'sub', text:'검은 막대는 표준 일정 위치예요. 월·주·일 그래프는 진행 현황에서 볼 수 있어요.' }), btn('진행 현황 보기', 'sm quiet', function () { go('plan'); })])); }
  if (c.cur) side.appendChild(h('div', { class:'card col' }, [h('b', { text:'이 과정에 대해' }), c.cur.sum ? h('div', { class:'sub', text:c.cur.sum }) : null, srcLinks(c.cur), h('div', { class:'sub', text:'AI가 만든 커리큘럼은 틀릴 수 있어요.' })]));
  var units = Math.ceil(seq.length / UNIT);
  for (var u = 0; u < units; u++) (function (u) {
    var a = u * UNIT, b = Math.min(a + UNIT, seq.length), part = seq.slice(a, b), n = tally(part), pct = Math.round((n.M + n.P) / part.length * 100);
    var open = part.split('').map(function (k, j) { return k === 'N' || k === 'L' ? a + j + 1 : 0; }).filter(Boolean)[0];
    var box = h('div', { class:'card unit' }, [h('div', { class:'uh' }, [h('b', { text:'단원 ' + (u + 1) + ' · ' + (a + 1) + '–' + b + '주차' }), pill('단원 숙달도 ' + pct + '%', pct === 100 ? 'm' : ''), open ? btn('건너뛰기 도전', 'sm quiet', function () { openWeek(c, open, 'quiz'); }) : null])]);
    part.split('').forEach(function (k, j) {
      var w = a + j + 1;
      box.appendChild(h('div', { class:'wrow' + (w === i + 1 ? ' cur' : '') }, [ico(k, 22), h('div', { class:'tt' }, [h('b', { text:w + '주차' + (topicOf(c, w) ? ' · ' + topicOf(c, w) : '') }), h('span', { class:'sub', text:ST[k] + (c.cur ? ' · 표준 ' + hoursOf(c, w) + '시간' : (bankOf(c, w) ? '' : ' · 예시 문제 없음')) })]), btn('학습', 'sm', function () { openWeek(c, w, 'week'); }), btn('확인 문제', 'sm quiet', function () { openWeek(c, w, 'quiz'); })]));
    });
    main.appendChild(box);
  })(u);
  kids.push(h('div', { class:'g2' }, [main, side]), h('div', { class:'foot', text:(c.cur ? 'AI가 웹 자료를 바탕으로 만든 커리큘럼이며 표준 일정은 참고용입니다.' : '주차 구성과 진도는 예시입니다.') + ' 건너뛰기 도전은 그 단원에서 아직 통과하지 않은 첫 주차의 확인 문제를 바로 풉니다.' + (c.cur ? '' : ' 실제 일정은 학습자에 맞춰 교수가 정합니다.') }));
  return kids;
}

// ── 주차 학습 ──
function chkOf(c, n, len) { var s = S.chk[c.id + ':' + n] || ''; while (s.length < len) s += '0'; return s.slice(0, len); }
function viewWeek() {
  var c = find(S.cur); if (!c || !seqOf(c)) return viewCourse();
  var seq = seqOf(c), n = Math.min(Math.max(S.week, 1), seq.length), st = seq.charAt(n - 1), topic = topicOf(c, n);
  var goals = goalsOf(c, n), ck = chkOf(c, n, goals.length), allck = ck.indexOf('0') < 0;
  var kids = head([c.name, function () { go('course', c.id); }], c.name + ' · ' + n + '주차' + (topic ? ' — ' + topic : ''), c.level + ' · 담당 ' + c.prof);
  kids.push(h('div', { class:'stepper' }, [
    h('div', { class:'step ' + (allck ? 'done' : 'on') }, [h('span', { class:'no', text:allck ? '✓' : '1' }), '학습 목표 확인']),
    h('div', { class:'step' }, [h('span', { class:'no', text:'2' }), '교수와 연습(선택)']),
    h('div', { class:'step ' + (st === 'P' || st === 'M' ? 'done' : (allck ? 'on' : '')) }, [h('span', { class:'no', text:st === 'P' || st === 'M' ? '✓' : '3' }), '확인 문제 · ' + ST[st]])]));
  var warn = n > 1 && st === 'N' && seq.charAt(n - 2) === 'N' ? h('div', { class:'note', style:'margin-top:16px', text:(n - 1) + '주차 확인 문제를 아직 통과하지 않았습니다. 앞 주차부터 순서대로 학습하길 권합니다.' }) : null;
  var list = h('div', { class:'card', style:'padding:8px 22px' }, goals.map(function (g, k) {
    return h('button', { class:'ck', 'aria-pressed':String(ck.charAt(k) === '1'), onclick:function () { var s = chkOf(c, n, goals.length); S.chk[c.id + ':' + n] = s.slice(0, k) + (s.charAt(k) === '1' ? '0' : '1') + s.slice(k + 1); save(); render(); } }, [h('span', { class:'box', text:ck.charAt(k) === '1' ? '✓' : '' }), h('span', { class:'tx', text:g })]);
  }));
  var main = h('div', {}, [warn, h('h2', { text:'이번 주 학습 목표', style:'margin-top:20px' }), h('p', { class:'sub', style:'margin:-6px 0 10px', text:'목표를 이해했으면 눌러서 체크하세요. 이 기기에만 저장됩니다.' }), list,
    h('div', { class:'rowf', style:'margin-top:18px' }, [btn('확인 문제 풀기', 'fill', function () { openWeek(c, n, 'quiz'); }), n > 1 ? btn('← ' + (n - 1) + '주차', 'quiet', function () { openWeek(c, n - 1, 'week'); }) : null, n < seq.length ? btn((n + 1) + '주차 →', 'quiet', function () { openWeek(c, n + 1, 'week'); }) : null])]);
  main.appendChild(h('h2', { text:'이번 주 표준 일정 · 주 ' + hoursOf(c, n) + '시간', style:'margin-top:28px' })); main.appendChild(h('div', { class:'card', style:'padding:8px 22px' }, dayPlan(c, n).map(function (d) { return h('div', { class:'dp' }, [h('b', { text:d[0] }), h('span', { text:d[1] }), h('i', { text:'약 ' + d[2] + '분' })]); })));
  var q = (topic ? n + '주차 ' + topic : n + '주차');
  var side = h('div', { class:'col', style:'gap:18px;margin-top:20px' }, [h('div', { class:'card col' }, [h('div', { class:'prof' }, [h('div', { class:'av', text:(c.subj || c.name).charAt(0) }), h('div', {}, [h('b', { text:c.prof }), h('div', { class:'sub', text:'막히면 물어보세요' })])]),
    h('div', { class:'chips' }, ['핵심 개념을 쉽게 설명해 줘', '연습 문제를 내 줘', '자주 하는 실수가 뭐야?'].map(function (t) { return h('button', { class:'chip', text:t, onclick:function () { ask(c.name + ' ' + q + ': ' + t); } }); }))]),
    h('div', { class:'card col' }, [h('div', { class:'rowf' }, [ico(st, 22), h('b', { text:'이 주차 ' + ST[st] })]), h('div', { class:'sub', text:'전체 ' + seq.length + '주 중 ' + n + '주차' })])]);
  kids.push(h('div', { class:'g2', style:'margin-top:0' }, [main, side]), h('div', { class:'foot', text:c.cur ? '주차 구성은 AI가 웹 자료를 바탕으로 만들었어요. 표준 일정은 참고용이며 내 속도로 해도 괜찮아요.' : '주차 학습 내용은 예시입니다. 실제 수업 자료는 교수가 이 주차에 맞춰 제공합니다.' }));
  return kids;
}

// ── 확인 문제 ──
function loadQuiz(c, n, key) {
  api('/' + c.cid + '/quiz', { week:n }, 90000).then(function (j) {
    var same = S.view === 'quiz' && S.cur === c.id && S.week === n;
    if (j.ok && okBank(j.quiz)) { S.qz[key] = j.quiz; saveQz(); if (S.qst && S.qst.key === key) S.qst = null; if (same) render(); }
    else { S.qst = { key:key, st:'err', msg:errMsg(j.ok ? 'bad_format' : j.error) }; if (same) render(); }
  });
}
function bankOf(c, n) { var b = ((QUIZ[c.id] || {})[n]) || null; if (b) return b; return (c.cid && S.qz[c.cid + ':' + n]) || null; }
function applyResult(c, n, pct) {
  var p = S.prog[c.id] || (S.prog[c.id] = { seq:seqOf(c), pass:{}, log:[], chain:[] }), i = n - 1, cur = p.seq.charAt(i), now = Date.now(), to = cur, msg = '';
  if (pct >= GATE) {
    if (cur === 'P' && p.pass[n] && now - p.pass[n] >= RECHECK) { to = 'M'; msg = '며칠 뒤 다시 풀어서도 통과했습니다. \'숙달\'이 되었습니다.'; }
    else if (cur === 'N' || cur === 'L') { to = 'P'; p.pass[n] = now; msg = '통과했습니다. ' + (n < p.seq.length ? (n + 1) + '주차가 열립니다. ' : '') + '며칠 뒤 다시 풀어서도 통과하면 \'숙달\'이 됩니다.'; }
    else if (cur === 'P') msg = '이미 통과한 주차입니다. 며칠 뒤 다시 풀어서도 통과하면 \'숙달\'이 됩니다.';
    else msg = '이미 숙달한 주차입니다.';
  } else { if (cur === 'N') to = 'L'; msg = '통과 기준(' + GATE + '%)에 조금 못 미쳤습니다. 풀이를 보고 다시 도전해 보세요.'; }
  p.seq = p.seq.slice(0, i) + to + p.seq.slice(i + 1);
  if (!p.log) p.log = []; if (!p.chain) p.chain = [];
  var ent = [n, pct, now], link = p.chain.length === p.log.length; p.log.push(ent); if (p.log.length > 200) { p.log.shift(); p.chain = []; }
  save(); if (link && p.log.length <= 200) chainAdd(p, ent);
  return { msg:msg, from:cur, to:to };
}
// 학습 원장: 확인 문제 기록을 SHA-256 해시 체인으로 묶어 중간 기록을 고치면 드러나게 한다(이 기기 안에서의 변조 검출). OpenHash 앵커링은 PDV 연동 단계에서 켠다.
function sha(s, cb) { try { var T = window.crypto && window.crypto.subtle; if (!T) return cb(null); T.digest('SHA-256', new TextEncoder().encode(s)).then(function (b) { cb([].map.call(new Uint8Array(b), function (x) { return ('0' + x.toString(16)).slice(-2); }).join('')); }, function () { cb(null); }); } catch (e) { cb(null); } }
function entStr(e, prev) { return prev + '|' + e[0] + ',' + e[1] + ',' + e[2]; }
function chainAdd(p, ent) { var ch = p.chain; sha(entStr(ent, ch.length ? ch[ch.length - 1] : 'genesis'), function (hx) { if (hx && ch === p.chain && ch.length === p.log.length - 1) { ch.push(hx); save(); } }); }
function verify(id, cb) {
  var p = S.prog[id], log = (p && p.log) || [], ch = (p && p.chain) || [];
  if (!log.length) return cb('none', 0); if (ch.length < log.length) return cb('part', ch.length);
  var i = 0, prev = 'genesis'; (function step() { if (i >= log.length) return cb('ok', ch.length); sha(entStr(log[i], prev), function (hx) { if (!hx) return cb('na', ch.length); if (hx !== ch[i]) return cb('bad', ch.length); prev = hx; i++; step(); }); })();
}
function ledgerRow(c) {
  var p = S.prog[c.id], ch = (p && p.chain) || [], st = h('b', { text:'확인 중…' }), row = h('div', { class:'ledger' }, [h('span', { text:'학습 원장' }), st, ch.length ? h('code', { text:'최신 ' + ch[ch.length - 1].slice(0, 10) + '…' }) : null, h('span', { text:'이 기기의 해시 체인(SHA-256) · OpenHash 앵커링은 PDV 연동 단계' })]);
  verify(c.id, function (r, n) { st.textContent = r === 'ok' ? '기록 ' + n + '건 · 변조 없음 ✓' : r === 'bad' ? '기록이 원장과 맞지 않습니다' : r === 'part' ? '원장 적용 이전 기록 포함' : r === 'na' ? '이 브라우저는 해시를 지원하지 않습니다' : '기록 없음'; });
  return row;
}
function viewQuiz() {
  var c = find(S.cur); if (!c || !seqOf(c)) return viewCourse();
  var seq = seqOf(c), n = Math.min(Math.max(S.week, 1), seq.length), bank = bankOf(c, n), topic = topicOf(c, n);
  var kids = head([n + '주차 학습', function () { openWeek(c, n, 'week'); }], n + '주차 확인 문제' + (topic ? ' — ' + topic : ''), c.name + ' · ' + GATE + '% 이상 맞히면 통과합니다.');
  if (!bank && c.cid) {
    var qk = c.cid + ':' + n; if (!S.qst || S.qst.key !== qk) { S.qst = { key:qk, st:'load' }; loadQuiz(c, n, qk); }
    kids.push(S.qst.st === 'err' ? h('div', { class:'card col', style:'margin-top:20px;max-width:640px', role:'alert' }, [h('b', { style:'font-size:18px', text:'확인 문제를 불러오지 못했어요' }), h('p', { class:'sub', text:S.qst.msg }), h('div', { class:'rowf' }, [btn('다시 시도', 'fill', function () { S.qst = null; render(); }), btn('교수에게 문제 요청', 'quiet', function () { ask(c.name + ' ' + n + '주차 확인 문제를 내 주세요'); })])]) : h('div', { class:'card col', style:'margin-top:20px;max-width:640px', role:'status' }, [h('div', { class:'rowf' }, [h('span', { class:'spin' }), h('b', { text:'확인 문제를 준비하고 있어요' })]), h('p', { class:'sub', text:'이 주차 문제는 처음 풀 때 만들어 DB에 저장해요. 다음 학습자는 바로 풀 수 있어요. 보통 10~30초 걸려요.' })]));
    return kids;
  }
  if (!bank) {
    kids.push(h('div', { class:'card col', style:'margin-top:20px;max-width:640px' }, [h('b', { style:'font-size:18px', text:'이 주차의 확인 문제는 아직 없습니다' }), h('p', { class:'sub', text:'예시 문제는 경제학 입문 1~4주차, 미적분 기초 1~3주차에만 있습니다. 교수에게 이 주차 문제를 내 달라고 할 수 있습니다.' }), h('div', { class:'rowf' }, [btn('교수에게 문제 요청', 'fill', function () { ask(c.name + ' ' + n + '주차 확인 문제를 내 주세요'); }), btn(n + '주차 학습으로', 'quiet', function () { openWeek(c, n, 'week'); })])]));
    return kids;
  }
  if (!S.q || S.q.id !== c.id || S.q.week !== n) S.q = { id:c.id, week:n, ans:{}, done:false };
  var q = S.q, submit, pgm;
  function sync() { var k = Object.keys(q.ans).length; submit.disabled = k < bank.length; pgm.style.width = Math.round(k / bank.length * 100) + '%'; cnt.textContent = k + ' / ' + bank.length + ' 답함'; }
  var cnt = h('span', { class:'sub', style:'min-width:84px' });
  if (q.done) {
    var right = 0; bank.forEach(function (b, k) { if (q.ans[k] === b[2]) right++; });
    var pct = Math.round(right / bank.length * 100), ok = pct >= GATE;
    kids.push(h('div', { class:'card', style:'margin-top:20px;display:flex;gap:20px;align-items:center;flex-wrap:wrap;' + (ok ? 'background:var(--mb)' : 'background:var(--lb)') }, [
      ring(pct, 96, pct + '%', ok ? '통과' : '도전 중', ok ? 'var(--m)' : 'var(--l)'),
      h('div', { class:'col', style:'flex:1;min-width:220px;gap:6px' }, [h('div', { class:'sub', text:'채점 결과' }), h('div', { style:'font-size:22px;font-weight:700', text:right + ' / ' + bank.length + '문제 · ' + pct + '%' }), h('div', { text:q.msg || '' }),
        q.from ? h('div', { class:'rowf', style:'gap:8px' }, [ico(q.from, 20), ST[q.from], '→', ico(q.to, 20), h('b', { text:ST[q.to] })]) : null])]));
    bank.forEach(function (b, k) {
      kids.push(h('div', { class:'card q' }, [h('div', { class:'qt', text:(k + 1) + '. ' + b[0] }), h('div', { class:'opts' }, b[1].map(function (o, j) { return h('div', { class:'opt' + (j === b[2] ? ' ok' : (j === q.ans[k] ? ' no' : '')), text:(j === b[2] ? '✓ ' : (j === q.ans[k] ? '✗ ' : '')) + o }); })), h('div', { class:'ex', text:'풀이 · ' + b[3] })]));
    });
    kids.push(h('div', { class:'rowf', style:'margin-top:20px' }, [
      btn('다시 풀기', 'fill', function () { S.q = null; render(); }),
      n < seq.length ? btn((n + 1) + '주차 학습으로', '', function () { openWeek(c, n + 1, 'week'); }) : null,
      btn('교수에게 묻기', 'quiet', function () { ask(c.name + ' ' + n + '주차 확인 문제 풀이에서 모르는 게 있어요'); }),
      btn('과목으로', 'quiet', function () { go('course', c.id); })]));
    return kids;
  }
  submit = h('button', { class:'btn fill', text:'제출하고 채점', disabled:'disabled', onclick:function () { var r = 0; bank.forEach(function (b, k) { if (q.ans[k] === b[2]) r++; }); var res = applyResult(c, n, Math.round(r / bank.length * 100)); q.msg = res.msg; q.from = res.from; q.to = res.to; q.done = true; render(); try { window.scrollTo(0, 0); } catch (e) {} } });
  pgm = h('em', {});
  bank.forEach(function (b, k) {
    var opts = h('div', { class:'opts' }, []);
    b[1].forEach(function (o, j) { opts.appendChild(h('button', { class:'opt', 'aria-pressed':String(q.ans[k] === j), text:o, onclick:function () { q.ans[k] = j; [].forEach.call(opts.children, function (x, y) { x.setAttribute('aria-pressed', String(y === j)); }); sync(); } })); });
    kids.push(h('div', { class:'card q' }, [h('div', { class:'qt', text:(k + 1) + '. ' + b[0] }), opts]));
  });
  kids.push(h('div', { class:'sbar' }, [cnt, h('div', { class:'pg' }, [pgm]), submit]));
  sync();
  kids.push(h('div', { class:'foot', text:(c.cid && !QUIZ[c.id] ? '확인 문제는 AI가 만들었어요(틀릴 수 있어요). ' : '확인 문제는 예시입니다. ') + '채점 결과는 이 브라우저에만 저장되고, 기록은 학습 원장 해시 체인에 이어 붙습니다.' }));
  return kids;
}

// ── 학습 기록 ──
function viewHistory() {
  var kids = head(null, '학습 기록', '언제, 어떤 과목을, 얼마나 학습했는지 연도별로 모았습니다. 초등부터 대학원까지 이어서 확인할 수 있습니다.');
  var tot = HIST.reduce(function (a, y) { return a + y.h; }, 0), cs = HIST.reduce(function (a, y) { return a + y.subs.length; }, 0), avg = Math.round(MAST.reduce(function (a, m) { return a + m[1]; }, 0) / MAST.length);
  kids.push(h('div', { class:'g4', style:'margin-top:20px' }, [['누적 학습 시간', tot + '시간'], ['학습한 과정', cs + '개'], ['평균 숙달도', avg + '%'], ['학습 기간', HIST.length + '개 학년']].map(function (x) { return h('div', { class:'tile' }, [h('div', { class:'k', text:x[0] }), h('div', { class:'v', text:x[1] })]); })));
  var ms = h('div', { class:'card', style:'margin-top:18px' }, [h('b', { style:'font-size:17px', text:'과목별 숙달도' }), h('div', { class:'sub', text:'여러 해에 걸쳐 학습한 같은 과목의 평균입니다. 숙달한 단원이 전체에서 차지하는 비율입니다.' })]);
  MAST.forEach(function (m) { ms.appendChild(h('div', { class:'mrow' }, [h('div', { class:'nm', text:m[0] }), h('div', { class:'tr' }, [h('em', { style:'width:' + m[1] + '%' })]), h('div', { class:'v', text:m[1] + '% · ' + m[2] })])); });
  var bars = h('div', { class:'card', style:'margin-top:18px' }, [h('b', { style:'font-size:17px', text:'연도별 학습 시간' })]);
  HIST.forEach(function (y) { bars.appendChild(h('div', { class:'mrow' }, [h('div', { class:'nm', text:y.y }), h('div', { class:'tr' }, [h('em', { style:'width:' + Math.round(y.h / 480 * 100) + '%;background:var(--p)' })]), h('div', { class:'v', text:y.h + '시간' })])); });
  kids.push(h('div', { class:'g2', style:'margin-top:0' }, [ms, bars]));
  HIST.forEach(function (y) {
    var open = S.open === y.y;
    var box = h('section', { class:'card yr' }, [h('button', { 'aria-expanded':String(open), onclick:function () { S.open = open ? '' : y.y; render(); } }, [h('span', { class:'y', text:y.y }), pill(y.lv), h('span', { class:'sub', style:'margin-left:auto', text:y.h + '시간 · ' + y.subs.length + '과목' }), h('span', { style:'color:var(--pri);font-weight:600;font-size:13px', text:open ? '접기' : '펼치기' })])]);
    if (open) box.appendChild(h('div', { class:'body' }, y.subs.map(function (s) {
      return h('div', { class:'row' }, [h('div', { style:'flex:1 1 200px;min-width:0' }, [h('b', { text:s[0] }), h('div', { class:'sub', text:s[1] + ' · ' + s[2] })]), h('div', { style:'flex:0 0 70px;font-size:14px', text:s[3] + '시간' }), h('div', { style:'flex:0 0 80px;font-size:14px', text:s[4] }), h('div', { class:'pb' }, [h('span', { class:'t' }, [h('em', { style:'width:' + s[5] + '%' })]), s[5] + '%']), pill(s[6] === 'ing' ? '진행 중' : '완료', s[6] === 'ing' ? 'p' : 'm')]);
    })));
    kids.push(box);
  });
  kids.push(h('div', { class:'foot', text:'화면의 과목·시간·숙달도는 예시 데이터입니다. 점수는 학습 점검용 참고 지표입니다.' }));
  return kids;
}

// ── 학습 보고서(과목 교수) · 진로 추천(진로 지도 교수) ──
// 과목 교수는 확인 문제 기록으로 진도·성취도·학습 속도·학습 능력을 평가한 보고서를 쓰고, 학습자가 제출하면
// 진로 지도 교수가 제출된 보고서를 모아 적성에 맞는 진로를 추천한다. 점수 기록이 없으면 수치를 지어내지 않고 '자료 부족'으로 둔다.
var DOMS = { '수학':['수리','컴퓨팅'], '물리':['수리','자연'], '화학':['자연'], '생명과학':['자연'], '영어':['언어'], '국어':['언어'], '역사':['인문사회'], '코딩':['컴퓨팅','수리'], '경제학':['사회경제','수리'] };
var DOMN = { '수리':'수리·논리', '컴퓨팅':'컴퓨팅', '자연':'자연과학', '언어':'언어', '인문사회':'인문·사회', '사회경제':'경제·사회' };
var CAREERS = [
  { n:'데이터·AI·소프트웨어', w:{ '수리':0.5, '컴퓨팅':0.5 }, d:'수학적 사고와 코딩으로 데이터를 다루고 문제를 푸는 일' },
  { n:'공학·기술 개발', w:{ '수리':0.5, '자연':0.3, '컴퓨팅':0.2 }, d:'물리·수학을 바탕으로 제품과 시스템을 설계하는 일' },
  { n:'자연과학 연구·생명과학', w:{ '자연':0.7, '수리':0.3 }, d:'실험과 관찰로 원리를 밝히는 연구·의생명 분야' },
  { n:'경제·금융·경영', w:{ '사회경제':0.6, '수리':0.4 }, d:'수치와 제도를 읽고 판단하는 분석·기획 분야' },
  { n:'언어·교육·콘텐츠', w:{ '언어':0.6, '인문사회':0.4 }, d:'말과 글로 가르치고 전달하고 만드는 분야' },
  { n:'법·행정·사회과학', w:{ '인문사회':0.5, '언어':0.3, '사회경제':0.2 }, d:'사회 제도와 사람을 이해하고 조율하는 분야' }
];
function lvOf(s) { return s == null ? '자료 부족' : s >= 85 ? '높음' : s >= 65 ? '보통' : '도움 필요'; }
function metricsOf(c) {
  var seq = seqOf(c), n = tally(seq);
  var log = (S.prog[c.id] && S.prog[c.id].log) || [], tried = n.M + n.P + n.L, done = n.M + n.P;
  var m = { id:c.id, name:c.name, subj:c.subj, prof:c.prof, weeks:seq.length, tried:tried, done:done, mast:n.M, lrn:n.L, att:log.length, prog:seq ? Math.round(done / seq.length * 100) : null, avg:null, first:null, pace:null, score:null, basis:'' };
  if (log.length) {
    var sum = 0, wk = {}, t0 = Infinity, t1 = 0;
    log.forEach(function (e) { sum += e[1]; if (!wk[e[0]]) wk[e[0]] = e[1]; if (e[2] < t0) t0 = e[2]; if (e[2] > t1) t1 = e[2]; });
    m.avg = Math.round(sum / log.length);
    var ks = Object.keys(wk), fp = ks.filter(function (k) { return wk[k] >= GATE; }).length; m.first = Math.round(fp / ks.length * 100);
    if (log.length >= 2 && done) m.pace = Math.round(done / Math.max((t1 - t0) / 604800000, 1) * 10) / 10;
    m.score = Math.round(0.6 * m.avg + 0.25 * m.first + 0.15 * (done ? n.M / done * 100 : 0)); m.basis = '확인 문제 ' + log.length + '회 기록';
  } else if (tried) { m.score = Math.round((n.M * 100 + n.P * 80 + n.L * 40) / tried); m.basis = '주차 단계 기록만(점수 기록 없음)'; }
  return m;
}
function notesOf(m) {
  var g = [], d = [];
  if (m.avg != null && m.avg >= 85) g.push('확인 문제 성취도가 높습니다(평균 ' + m.avg + '%).'); else if (m.avg != null && m.avg < 65) d.push('확인 문제 평균이 ' + m.avg + '%입니다. 풀이를 보고 개념을 다시 짚는 것이 좋습니다.');
  if (m.first != null && m.first >= 70) g.push('처음 풀 때 통과하는 비율이 높습니다(' + m.first + '%).'); else if (m.first != null && m.first < 50) d.push('처음 풀 때 통과하는 비율이 낮습니다(' + m.first + '%). 학습 내용을 읽은 뒤 문제를 풀어 보세요.');
  if (m.mast > 0) g.push('며칠 뒤 다시 풀어서도 통과한 주차가 ' + m.mast + '개 있어 기억이 오래 갑니다.');
  if (m.lrn >= 2) d.push('연습 중인 주차가 ' + m.lrn + '개 있습니다. 먼저 이 주차들을 통과하세요.');
  if (m.pace != null && m.pace < 0.5) d.push('주당 통과 속도가 느린 편입니다(' + m.pace + '주차/주). 학습 간격을 줄여 보세요.');
  if (m.pace != null && m.pace >= 1) g.push('꾸준히 진행하고 있습니다(주당 ' + m.pace + '주차).');
  if (!g.length && !d.length) d.push('기록이 아직 적어 강점과 보완점을 가리기 어렵습니다. 확인 문제를 더 풀어 보세요.');
  return { good:g, need:d };
}
function submitReport(c) { var m = metricsOf(c); if (m.score == null) return false; S.sub[c.id] = { ts:Date.now(), score:m.score, prog:m.prog, avg:m.avg, first:m.first, pace:m.pace, tried:m.tried, att:m.att, basis:m.basis }; save(); return true; }
function careerOf() {
  var ds = {}, dn = {}, subs = [], att = 0;
  all().forEach(function (c) { var r = S.sub[c.id]; if (!r) return; subs.push({ c:c, r:r }); att += r.att || 0; (DOMS[c.subj] || []).forEach(function (d) { ds[d] = (ds[d] || 0) + r.score; dn[d] = (dn[d] || 0) + 1; }); });
  var dom = Object.keys(dn).map(function (d) { return { d:d, n:DOMN[d], v:Math.round(ds[d] / dn[d]) }; }).sort(function (a, b) { return b.v - a.v; });
  var list = CAREERS.map(function (k) {
    var tot = 0, wt = 0, sw = 0, why = [];
    Object.keys(k.w).forEach(function (d) { sw += k.w[d]; if (dn[d]) { tot += k.w[d] * ds[d] / dn[d]; wt += k.w[d]; why.push(DOMN[d] + ' ' + Math.round(ds[d] / dn[d])); } });
    if (wt < 0.3) return null;
    var fit = tot / wt, cov = wt / sw; return { n:k.n, d:k.d, fit:Math.round(fit), rank:fit * (0.6 + 0.4 * cov), why:why, cov:cov };
  }).filter(Boolean).sort(function (a, b) { return b.rank - a.rank; });
  var conf = subs.length >= 3 && att >= 10 ? '높음' : subs.length >= 2 && att >= 4 ? '보통' : '낮음';
  return { subs:subs, list:list, conf:conf, dom:dom };
}
function fmtDate(ts) { var d = new Date(ts); return d.getFullYear() + '.' + (d.getMonth() + 1) + '.' + d.getDate(); }
function spark(vals) {
  var w = 220, ht = 48, pts = vals.slice(-12).map(function (v, i, a) { return (a.length < 2 ? w / 2 : 6 + i * (w - 12) / (a.length - 1)).toFixed(1) + ',' + (ht - 6 - (ht - 12) * v / 100).toFixed(1); });
  var s = sv2('svg', { width:w, height:ht, viewBox:'0 0 ' + w + ' ' + ht, role:'img', 'aria-label':'확인 문제 점수 추이' });
  s.appendChild(sv2('line', { x1:6, x2:w - 6, y1:ht - 6 - (ht - 12) * GATE / 100, y2:ht - 6 - (ht - 12) * GATE / 100, stroke:'var(--n)', 'stroke-dasharray':'3 3', 'stroke-width':1 }));
  if (pts.length > 1) s.appendChild(sv2('polyline', { points:pts.join(' '), fill:'none', stroke:'var(--pri)', 'stroke-width':2.2, 'stroke-linejoin':'round', 'stroke-linecap':'round' }));
  pts.forEach(function (p) { var q = p.split(','); s.appendChild(sv2('circle', { cx:q[0], cy:q[1], r:3, fill:'var(--pri)' })); });
  return s;
}
function viewReport() {
  var kids = head(null, '학습 보고서', '과목 교수가 확인 문제 기록으로 진도·성취도·학습 속도·학습 능력을 평가했습니다. 제출하면 진로 지도 교수가 모아서 진로를 추천합니다.');
  var cs = all(), ns = Object.keys(S.sub).length;
  kids.push(h('div', { class:'rowf', style:'margin-top:16px' }, [pill('제출한 보고서 ' + ns + '건', ns ? 'p' : ''), pill('평가 대상 과목 ' + cs.length + '개')]));
  cs.forEach(function (c) {
    var m = metricsOf(c), sb = S.sub[c.id], card = h('div', { class:'card col', style:'margin-top:18px' });
    card.appendChild(h('div', { class:'rowf', style:'justify-content:space-between' }, [h('div', { style:'font-size:18px;font-weight:700', text:c.name + ' · ' + c.prof }), sb ? pill(fmtDate(sb.ts) + ' 제출됨', 'm') : null]));
    if (m.score == null) {
      card.appendChild(h('p', { class:'sub', text:'아직 학습 기록이 없어 보고서를 쓸 수 없습니다. 확인 문제를 풀면 교수가 평가합니다.' }));
      card.appendChild(h('div', { class:'rowf' }, [btn('학습하러 가기', 'sm', function () { go('course', c.id); })]));
    } else {
      card.appendChild(h('div', { class:'rowf', style:'gap:20px' }, [ring(m.score, 92, String(m.score), '종합 ' + lvOf(m.score), m.score >= 85 ? 'var(--m)' : m.score >= 65 ? 'var(--pri)' : 'var(--l)'),
        h('div', { class:'g4', style:'flex:1;min-width:260px' }, [['진도', m.prog, m.done + ' / ' + m.weeks + '주 통과'], ['성취도', m.avg, m.avg == null ? '자료 부족' : '평균 ' + m.avg + '%'], ['처음 통과', m.first, m.first == null ? '자료 부족' : m.first + '%'], ['학습 속도', null, m.pace == null ? '자료 부족' : '주당 ' + m.pace + '주차']].map(function (x) {
          return h('div', { class:'tile' }, [h('div', { class:'k', text:x[0] }), h('div', { class:'v', style:'font-size:' + (x[1] == null ? '15px' : '22px') + ';min-height:34px;display:flex;align-items:center', text:x[1] == null ? x[2] : x[1] + '%' }), x[1] == null ? null : h('div', { class:'tr' }, [h('em', { style:'width:' + x[1] + '%' })]), x[1] == null ? null : h('div', { class:'sub', text:x[2] })]);
        }))]));
      var lg = ((S.prog[c.id] && S.prog[c.id].log) || []).map(function (e) { return e[1]; });
      if (lg.length) card.appendChild(h('div', { class:'rowf' }, [spark(lg), h('span', { class:'sub', text:'확인 문제 점수 추이(점선은 통과 기준 ' + GATE + '%) · 근거 ' + m.basis })]));
      else card.appendChild(h('div', { class:'sub', text:'근거 · ' + m.basis }));
      var nt = notesOf(m);
      nt.good.forEach(function (t) { card.appendChild(h('div', { class:'nl' }, [h('b', { style:'color:var(--m)', text:'강점' }), h('div', { text:t })])); });
      nt.need.forEach(function (t) { card.appendChild(h('div', { class:'nl' }, [h('b', { style:'color:var(--l)', text:'보완' }), h('div', { text:t })])); });
      card.appendChild(ledgerRow(c));
      card.appendChild(h('div', { class:'rowf' }, [btn(sb ? '다시 제출' : '진로 교수에게 제출', 'fill', function () { submitReport(c); render(); }), btn('교수 소견 받기', '', function () { ask(c.name + ' 학습 보고서에 대한 교수님 소견을 듣고 싶어요'); })]));
    }
    kids.push(card);
  });
  kids.push(h('div', { class:'foot', text:'점수는 확인 문제 기록으로 계산한 참고 지표입니다(종합 = 성취도 60% + 처음 통과 25% + 숙달 비중 15%). 기록이 없는 항목은 \'자료 부족\'으로 둡니다.' }));
  return kids;
}
function viewCareer() {
  var kids = head(null, '진로 추천', '진로 지도 교수가 제출된 과목 보고서를 모아 학습 성취가 잘 맞는 진로를 추천합니다. 참고 의견이며 선택은 학습자가 합니다.');
  var r = careerOf();
  if (!r.subs.length || !r.list.length) {
    kids.push(h('div', { class:'card col', style:'margin-top:20px;max-width:680px' }, [h('b', { style:'font-size:18px', text:'제출된 보고서가 없습니다' }), h('p', { class:'sub', text:'학습 보고서에서 과목 보고서를 제출하면, 진로 지도 교수가 그 보고서를 모아 분석합니다. 수학·물리·영어처럼 진로와 연결되는 과목의 기록이 필요합니다.' }), h('div', { class:'stepper', style:'margin-top:4px' }, [h('div', { class:'step on' }, [h('span', { class:'no', text:'1' }), '확인 문제 풀기']), h('div', { class:'step' }, [h('span', { class:'no', text:'2' }), '보고서 제출']), h('div', { class:'step' }, [h('span', { class:'no', text:'3' }), '진로 추천'])]), h('div', { class:'rowf' }, [btn('학습 보고서로', 'fill', function () { go('report'); })])]));
    return kids;
  }
  var cf = r.conf === '높음' ? 3 : r.conf === '보통' ? 2 : 1;
  kids.push(h('div', { class:'card rowf', style:'margin-top:20px;gap:18px' }, [h('div', { class:'col', style:'gap:2px;flex:1;min-width:220px' }, [h('b', { text:'추천 신뢰도 ' + r.conf }), h('span', { class:'sub', text:'제출된 보고서 ' + r.subs.length + '건' + (r.conf === '낮음' ? ' · 기록이 더 쌓이면 달라질 수 있습니다' : '') })]),
    h('div', { class:'rowf', style:'gap:4px', role:'img', 'aria-label':'신뢰도 ' + cf + '/3' }, [1, 2, 3].map(function (k) { return h('span', { style:'width:44px;height:8px;border-radius:4px;background:' + (k <= cf ? 'var(--pri)' : 'var(--nb)') }); }))]));
  var top = h('div', { class:'col', style:'gap:18px' });
  r.list.slice(0, 3).forEach(function (k, i) {
    top.appendChild(h('div', { class:'card col' }, [h('div', { class:'rowf', style:'flex-wrap:nowrap;gap:14px' }, [ring(k.fit, 72, String(k.fit), '적합도'), h('div', { class:'col', style:'gap:2px;min-width:0' }, [h('div', { style:'font-size:18px;font-weight:700', text:(i + 1) + '. ' + k.n }), h('span', { class:'sub', text:k.d })])]),
      h('p', { class:'sub', text:'근거 · ' + k.why.join(', ') + (k.cov < 0.7 ? ' (이 진로에 필요한 일부 영역의 기록은 아직 없습니다)' : '') })]));
  });
  var dc = h('div', { class:'card' }, [h('b', { style:'font-size:17px', text:'영역별 성취' }), h('div', { class:'sub', text:'제출된 보고서의 종합 점수를 영역별로 평균한 값입니다.' })]);
  r.dom.forEach(function (d) { dc.appendChild(h('div', { class:'mrow' }, [h('div', { class:'nm', text:d.n }), h('div', { class:'tr' }, [h('em', { style:'width:' + d.v + '%;background:var(--pri)' })]), h('div', { class:'v', text:d.v + '점' })])); });
  kids.push(h('div', { class:'g2', style:'margin-top:18px' }, [top, h('div', { class:'col', style:'gap:18px' }, [dc, h('div', { class:'card col' }, [h('b', { text:'반영한 보고서' }), h('p', { class:'sub', text:r.subs.map(function (x) { return x.c.name + ' ' + x.r.score + '점(' + fmtDate(x.r.ts) + ' 제출)'; }).join(' · ') }),
    h('div', { class:'rowf' }, [btn('진로 교수와 상담', 'fill', function () { ask('제 진로 추천 결과를 설명해 주세요'); }), btn('보고서 보기', '', function () { go('report'); })])])])]));
  kids.push(h('div', { class:'foot', text:'진로 추천은 학습 성취에 기반한 참고 의견입니다. 흥미·가치관·상담이 함께 반영되어야 하며, 선택은 학습자가 합니다.' }));
  return kids;
}
function render() {
  var root = $('lrn-root'), tp = $('lrn-top'); root.textContent = ''; tp.textContent = ''; tp.className = 'top'; tp.appendChild(topbar());
  var kids = S.view === 'course' ? viewCourse() : S.view === 'week' ? viewWeek() : S.view === 'quiz' ? viewQuiz() : S.view === 'history' ? viewHistory() : S.view === 'report' ? viewReport() : S.view === 'career' ? viewCareer() : S.view === 'plan' ? viewPlan() : viewSubjects();
  kids.forEach(function (k) { if (k) root.appendChild(k); });
  postState();
}

// ── 과목 추가 · AI 교수 찾기 ──
// 과목마다 AI 교수는 한 명이다. 어떤 과목이든 입력하면 교수 목록(서버 DB)에서 찾아 불러오고, 없으면 새 교수를 만들어 목록에 올린다(모든 학습자가 같은 교수를 쓴다).
// 목록에는 이름과 세부 내용(담당 범위·하위 분야·검색어)이 함께 있어 이름·분야·내용으로 찾을 수 있다. 교수를 고르면 수준·목표를 정해 그 과목의 커리큘럼을 불러오거나 만든다.
var PERR = { short:'과목 이름을 두 글자 이상 써 주세요.', not_a_subject:'학습 과목으로 보기 어려워요. 배우고 싶은 과목이나 주제를 써 주세요.', unavailable:'새 교수를 만드는 서버가 아직 준비되지 않았어요. 목록에서 고르거나, 아래 \'그냥 추가\'로 시작할 수 있어요.', limit:'오늘 새로 만들 수 있는 교수 수를 넘었어요. 내일 다시 시도하거나 목록에서 골라 주세요.', busy:'지금 새 교수를 만드는 요청이 많아요. 잠시 뒤 다시 시도해 주세요.', llm_error:'교수를 만들지 못했어요. 다시 시도해 주세요.', bad_format:'교수를 만들었지만 형식이 맞지 않아 저장하지 않았어요. 다시 시도해 주세요.', network:'서버에 연결하지 못했어요. 잠시 뒤 다시 시도하거나, 아래 \'그냥 추가\'로 시작할 수 있어요.' };
var FIELDS = ['인문', '사회과학', '자연과학', '공학·기술', '의학·보건', '예술·체육', '어학', '직업·자격', '기타'];
function cleanProf(x) {
  if (!x || typeof x !== 'object' || !/^p[0-9a-f]{12}$/.test(x.id) || typeof x.subject !== 'string' || !x.subject.trim()) return null;
  var arr = function (v, n, m) { return (Array.isArray(v) ? v : []).filter(function (t) { return typeof t === 'string' && t.trim(); }).map(function (t) { return t.slice(0, m); }).slice(0, n); };
  var lv = arr(x.levels, 6, 10).filter(function (l) { return LEVELS.indexOf(l) >= 0 || l === '성인'; });
  return { id:x.id, subject:x.subject.slice(0, 20), name:(typeof x.name === 'string' && x.name.trim() ? x.name : x.subject + ' 교수').slice(0, 26), field:FIELDS.indexOf(x.field) >= 0 ? x.field : '기타', summary:String(x.summary || '').slice(0, 220), levels:lv.length ? lv : ['대학'], topics:arr(x.topics, 8, 24), keywords:arr(x.keywords, 10, 20), learners:isFinite(x.learners) ? Math.max(0, Math.floor(x.learners)) : 0 };
}
function pfLoad() {
  var f = S.pf, my = ++f.n;
  api('/prof/list?q=' + encodeURIComponent(f.q.trim().slice(0, 40)) + (f.field ? '&field=' + encodeURIComponent(f.field) : '')).then(function (j) {
    if (my !== f.n && f.list !== null) return;
    if (j.ok && Array.isArray(j.list)) { f.list = j.list.map(cleanProf).filter(Boolean); f.total = isFinite(j.total) ? j.total : f.list.length; } else if (f.list === null) f.list = [];
    drawAdd();
  });
}
function pfSelect(p, from) { var f = S.pf; f.sel = p; f.from = from; f.st = 'idle'; f.err = ''; f.level = p.levels.indexOf(f.level) >= 0 ? f.level : p.levels[0]; drawAdd(); }
function pfSearch(q) {
  var f = S.pf; q = String(q || '').trim().slice(0, 40); f.q = q;
  if (q.replace(/\s/g, '').length < 2) { f.st = 'err'; f.err = PERR.short; return drawAdd(); }
  f.st = 'search'; f.res = null; var my = ++f.n; drawAdd();
  api('/prof/search?q=' + encodeURIComponent(q)).then(function (j) {
    if (my !== f.n) return;
    var p = j.ok && j.found ? cleanProf(j.professor) : null;
    if (p) return pfSelect(p, 'db');
    if (!j.ok) { f.st = 'err'; f.err = PERR[j.error] || PERR.network; } else { f.st = 'none'; f.res = { can:j.canBuild !== false, rel:(j.related || []).map(cleanProf).filter(Boolean).slice(0, 6) }; }
    drawAdd();
  });
}
function pfMake() {
  var f = S.pf, q = f.q; f.st = 'make'; var my = ++f.n; drawAdd();
  api('/prof/build', { q:q }, 90000).then(function (j) {
    if (my !== f.n) return;
    var p = j.ok ? cleanProf(j.professor) : null;
    if (p) { f.list = null; return pfSelect(p, j.created ? 'new' : 'db'); }
    f.st = 'err'; f.err = j.ok ? PERR.bad_format : (PERR[j.error] || PERR.network); drawAdd();
  });
}
function addCourseFor(p, level, cur, goal) {
  var c = { id:'u' + Date.now(), pid:p.id, name:cur ? cur.title : p.subject + ' · ' + level, subj:p.subject, level:level + ' · ' + p.subject, prof:p.name, seq:cur ? new Array(cur.w.length + 1).join('N') : '', goal:goal || '' };
  if (cur) { c.cid = cur.id || undefined; c.cur = cur; c.start = Date.now(); }
  S.added.push(c); save(); return c;
}
function pfStart() {
  var f = S.pf, p = f.sel, lv = f.level; if (!p || f.busy) return;
  var have = all().filter(function (c) { return c.pid === p.id && c.level.indexOf(lv + ' ·') === 0; })[0] || all().filter(function (c) { return !c.pid && c.subj === p.subject && c.level.indexOf(lv + ' ·') === 0; })[0];
  if (have) { closeAdd(); return go('course', have.id); }
  f.busy = true; drawAdd(); var goal = (S.goalDraft || '').trim();
  api('/build', { q:p.subject + ' ' + lv, level:lv, pid:p.id }, 90000).then(function (j) {
    f.busy = false; var cur = j.ok ? cleanCur(j.curriculum) : null, c;
    api('/prof/' + p.id + '/use', {});
    if (cur) { var ex = haveCur(cur.id); c = ex || addCourseFor(p, lv, cur, goal); if (ex && !ex.pid) { ex.pid = p.id; save(); } }
    else c = addCourseFor(p, lv, null, goal);   // 커리큘럼 서버를 쓸 수 없을 때: 교수와 상담해 시작한다
    closeAdd(); go('course', c.id);
    if (!cur) ask(goal || (lv + ' ' + p.subject + ' 학습을 시작하고 싶어요'));
  });
}
function pfPlain() {
  var q = S.pf.q.trim().slice(0, 12); if (q.replace(/\s/g, '').length < 2) return;
  var c = { id:'u' + Date.now(), name:q, subj:q, level:'수준 미정 · ' + q, prof:q + ' 교수', seq:'', goal:'' };
  S.added.push(c); save(); closeAdd(); go('course', c.id); ask(q + ' 학습을 시작하고 싶어요');
}
function linkProf(c) {   // 말로 추가한 과목도 교수 목록과 이어 준다(있으면 불러오고, 없으면 만들어 올린다). 실패하면 그대로 둔다.
  var done = function (j) { var p = j && j.ok ? cleanProf(j.professor) : null; if (p) { c.pid = p.id; c.prof = p.name; save(); if (S.view === 'subjects' || S.view === 'course') render(); api('/prof/' + p.id + '/use', {}); } return p; };
  api('/prof/search?q=' + encodeURIComponent(c.subj)).then(function (j) { if (done(j)) return; if (j && j.ok && j.canBuild !== false) api('/prof/build', { q:c.subj }, 90000).then(done); });
}
function pcard(p, onpick) {
  var sub = [p.levels.join('·')].concat(p.topics.slice(0, 3)).filter(Boolean).join(' · ');
  return h('button', { class:'pcard', type:'button', onclick:onpick, 'aria-label':p.name + ' 열기' }, [
    h('div', { class:'rowf', style:'flex-wrap:nowrap;justify-content:space-between;gap:8px' }, [h('b', { text:p.name }), pill(p.field)]),
    h('div', { class:'sub ps', text:p.summary }), h('div', { class:'sub', style:'font-size:12.5px', text:sub + (p.learners ? ' · 학습자 ' + p.learners + '명' : '') })]);
}
function drawAdd() {
  var d = $('lrn-dlg'); if (!d) return; var f = S.pf; d.textContent = ''; d.className = 'dlg wide';
  var kids = [h('div', { class:'rowf', style:'justify-content:space-between' }, [h('b', { style:'font-size:20px', text:f.sel ? '교수 선택' : '과목 추가 · AI 교수 찾기' }), h('button', { class:'btn quiet sm', 'aria-label':'닫기', text:'닫기', onclick:closeAdd })])];
  if (f.sel) kids = kids.concat(drawSel(f)); else kids = kids.concat(drawFind(f));
  kids.forEach(function (x) { if (x) d.appendChild(x); });
}
function drawFind(f) {
  var inp = h('input', { id:'lrn-pf-in', type:'search', placeholder:'배우고 싶은 과목 (예: 거시경제학, 파이썬, 한국사, 스페인어, 전기회로, 요리)', maxlength:'40', 'aria-label':'과목 검색', value:f.q });
  inp.oninput = function () { f.q = inp.value; }; inp.onkeydown = function (e) { if (e.key === 'Enter') pfSearch(inp.value); };
  var busy = f.st === 'search' || f.st === 'make', kids = [h('p', { class:'sub', style:'margin:6px 0 14px', text:'사회에 알려진 어떤 과목이든 입력하세요. 그 과목의 AI 교수가 이미 있으면 바로 불러오고, 없으면 새로 만들어 교수 목록에 올려요. 모든 학습자가 같은 교수에게 배워요.' }),
    h('div', { class:'sh' }, [inp, h('button', { class:'btn fill', text:'교수 찾기', disabled:busy ? 'disabled' : false, onclick:function () { pfSearch(inp.value); } })])];
  if (f.st === 'search') kids.push(h('div', { class:'rowf', role:'status', style:'margin-top:14px' }, [h('span', { class:'spin' }), h('span', { class:'sub', text:'교수 목록에서 찾는 중이에요…' })]));
  else if (f.st === 'make') kids.push(h('div', { class:'card col', role:'status', style:'background:var(--bg);box-shadow:none;margin-top:14px' }, [h('div', { class:'rowf' }, [h('span', { class:'spin' }), h('b', { text:'“' + f.q + '” 교수를 만들고 있어요' })]), h('div', { class:'sub', text:'담당 범위와 하위 분야를 정리해 목록에 올리는 중이에요. 보통 10~30초쯤 걸려요.' })]));
  else if (f.st === 'err') kids.push(h('div', { class:'note', role:'alert', style:'margin-top:14px', text:f.err }), (f.err === PERR.unavailable || f.err === PERR.network) && f.q.trim().length >= 2 ? h('div', { class:'rowf', style:'margin-top:10px' }, [btn('그냥 추가', '', pfPlain)]) : null);
  else if (f.st === 'none' && f.res) {
    var r = f.res, ck = [h('b', { text:'“' + f.q + '” 교수는 아직 목록에 없어요' })];
    if (r.rel.length) { ck.push(h('div', { class:'sub', text:'비슷한 교수가 있어요. 찾던 분이면 골라 주세요.' }), h('div', { class:'pl' }, r.rel.map(function (p) { return pcard(p, function () { pfSelect(p, 'db'); }); }))); }
    ck.push(h('div', { class:'sub', text:r.can ? '찾던 교수가 없다면 새로 만들어요. 만든 교수는 목록에 올라 다음 학습자도 바로 쓸 수 있어요.' : '새 교수를 만드는 서버가 아직 준비되지 않았어요.' }));
    ck.push(h('div', { class:'rowf' }, [r.can ? btn('“' + f.q.slice(0, 14) + '” 교수 새로 만들기', 'fill', pfMake) : btn('그냥 추가', '', pfPlain)]));
    kids.push(h('div', { class:'card col', style:'background:var(--bg);box-shadow:none;margin-top:14px;gap:12px' }, ck));
  }
  var fr = h('div', { class:'chips', style:'margin-top:18px' }, [['', '전체']].concat(FIELDS.map(function (x) { return [x, x]; })).map(function (x) { return h('button', { class:'chip', 'aria-pressed':String(f.field === x[0]), text:x[1], onclick:function () { f.field = x[0]; pfLoad(); } }); }));
  kids.push(h('div', { class:'lab', text:'AI 교수 목록' + (f.list ? ' · ' + f.total + '명' : '') }), fr);
  if (f.list === null) { kids.push(h('div', { class:'rowf', role:'status', style:'margin-top:12px' }, [h('span', { class:'spin' }), h('span', { class:'sub', text:'불러오는 중이에요…' })])); }
  else if (!f.list.length) kids.push(h('div', { class:'sub', style:'margin-top:12px', text:'아직 등록된 교수가 없어요. 위에서 과목을 입력하면 그 과목의 첫 교수가 만들어져요.' }));
  else kids.push(h('div', { class:'pl', style:'margin-top:12px' }, f.list.map(function (p) { return pcard(p, function () { pfSelect(p, 'db'); }); })));
  return kids;
}
function drawSel(f) {
  var p = f.sel, goal = h('textarea', { id:'lrn-goal', placeholder:'예: 중학교 1학년 수학 일차방정식이 어려워요', maxlength:'200', 'aria-label':'지금 어려운 점이나 목표' });
  if (S.goalDraft) goal.value = S.goalDraft; goal.oninput = function () { S.goalDraft = goal.value; };
  var chips = h('div', { class:'chips' }, p.levels.map(function (n) { return h('button', { class:'chip', 'aria-pressed':String(f.level === n), text:n, onclick:function () { f.level = n; drawAdd(); } }); }));
  var have = all().filter(function (c) { return c.pid === p.id && c.level.indexOf(f.level + ' ·') === 0; })[0];
  return [h('button', { class:'back', text:'← 교수 목록', onclick:function () { f.sel = null; f.st = 'idle'; drawAdd(); } }),
    h('div', { class:'card col', style:'background:var(--bg);box-shadow:none;gap:10px' }, [
      h('div', { class:'rowf' }, [pill(f.from === 'new' ? '방금 새로 만들었어요' : '교수 목록에서 불러왔어요', f.from === 'new' ? 'l' : 'm'), pill(p.field)]),
      h('div', { style:'font-size:20px;font-weight:700', text:p.name }), h('div', { text:p.summary }),
      p.topics.length ? h('div', { class:'chips' }, p.topics.map(function (t) { return h('span', { class:'pill', text:t }); })) : null,
      p.keywords.length ? h('div', { class:'sub', text:'검색어 · ' + p.keywords.join(', ') }) : null,
      h('div', { class:'sub', text:'지도 수준 ' + p.levels.join(' · ') + (p.learners ? ' · 학습자 ' + p.learners + '명' : '') + ' · 한 명의 AI 교수가 모든 학습자를 동시에 지도해요' })]),
    h('div', { class:'lab', text:'1. 수준' }), chips,
    h('div', { class:'lab', text:'2. 지금 어려운 점이나 목표 (선택)' }), goal,
    h('div', { class:'note info', style:'margin-top:16px', text:have ? '이미 이 수준으로 배우고 있어요. 수업을 열어 이어서 학습해요.' : p.name + '가 담당해요. ' + f.level + ' 수준 ' + p.subject + ' 커리큘럼이 이미 있으면 바로 불러오고, 없으면 새로 만들어요.' }),
    f.busy ? h('div', { class:'rowf', role:'status', style:'margin-top:16px' }, [h('span', { class:'spin' }), h('span', { class:'sub', text:'커리큘럼을 불러오거나 만드는 중이에요… (최대 1분)' })]) : null,
    h('div', { class:'rowf', style:'justify-content:flex-end;margin-top:20px' }, [h('button', { class:'btn quiet', text:'취소', onclick:closeAdd }), h('button', { class:'btn fill', text:have ? '수업 열기' : '수업 시작', disabled:f.busy ? 'disabled' : false, onclick:pfStart })])];
}
function openAdd() { S.goalDraft = ''; var f = S.pf; f.sel = null; f.st = 'idle'; f.err = ''; f.res = null; f.busy = false; f.list = null; drawAdd(); $('lrn-ov').hidden = false; pfLoad(); setTimeout(function () { var i = $('lrn-pf-in'); if (i) try { i.focus(); } catch (e) {} }, 0); }
function closeAdd() { var o = $('lrn-ov'); if (o) o.hidden = true; }
function postState() {
  var cur = find(S.cur);
  var st = { view:S.view, cur:(cur && (S.view === 'course' || S.view === 'week' || S.view === 'quiz')) ? { id:cur.id, name:cur.name, week:(S.view === 'course' ? undefined : S.week) } : null,
    courses:all().map(function (c) { var q = seqOf(c); return { id:c.id, name:c.name, subj:c.subj, level:c.level, prof:c.prof, weeks:q.length, next:q ? nextIdx(q) + 1 : 0, plan:q ? (function () { var z = schedule(c, Date.now()); return { done:z.done, expected:z.exp, status:z.st, std:totalHours(c) }; })() : undefined }; }),
    reports:all().map(function (c) { var m = metricsOf(c); return { id:c.id, name:c.name, prof:c.prof, score:m.score, prog:m.prog, avg:m.avg, first:m.first, pace:m.pace, attempts:m.att, basis:m.basis, submitted:!!S.sub[c.id] }; }).filter(function (x) { return x.score != null; }),
    career:(function () { var r = careerOf(); return r.list.slice(0, 3).map(function (k) { return { name:k.n, fit:k.fit }; }); })() };
  emit('state', st);
}
// 대화창(교육 SP)이 보낸 화면 조작 — 같은 출처의 부모 창에서 온 것만, 값은 다시 검증해서 쓴다. 결과는 navi-learn-result 로 알린다.
function reply(ok, msg) { emit('result', { ok:ok, msg:msg, view:S.view }); }
function names() { return all().map(function (c) { return c.name; }).join(', '); }
function nav(a) {
  var d = a && typeof a['do'] === 'string' ? a['do'] : '';
  if (d === 'subjects') { go('subjects'); return reply(true, '내 수업 화면으로 이동했습니다.'); }
  if (d === 'history') { go('history'); return reply(true, '학습 기록 화면으로 이동했습니다.'); }
  if (d === 'plan') { go('plan'); return reply(true, '진행 현황 화면으로 이동했습니다.'); }
  if (d === 'search') { go('subjects'); var sq = String(a.subject || '').trim().slice(0, 40); if (!sq) return reply(false, '검색할 과목 이름을 알려 주세요.'); doSearch(sq); return reply(true, '“' + sq + '” 커리큘럼을 검색하고 있습니다. 결과는 내 수업 화면의 검색 카드에 나옵니다.'); }
  if (d === 'report') { go('report'); return reply(true, '학습 보고서 화면으로 이동했습니다.'); }
  if (d === 'career') { go('career'); var cr = careerOf(); return reply(true, cr.list.length ? '진로 추천 화면으로 이동했습니다.' : '진로 추천 화면으로 이동했습니다. 제출된 보고서가 없어 먼저 학습 보고서를 제출해야 합니다.'); }
  if (d === 'submit') {
    var tg = a.subject ? [resolve(a.subject)].filter(Boolean) : all(); if (!tg.length) return reply(false, '“' + String(a.subject || '').slice(0, 20) + '” 과목을 찾지 못했습니다. 내 과목: ' + names());
    var ok = tg.filter(submitReport); go('report');
    return reply(ok.length > 0, ok.length ? ok.map(function (c) { return c.name; }).join(', ') + ' 보고서를 진로 지도 교수에게 제출했습니다.' : '제출할 보고서가 없습니다. 확인 문제를 풀어 학습 기록을 먼저 만들어 주세요.');
  }
  if (d === 'add') {
    var nm = String(a.subject || '').trim().slice(0, 12), lv = LEVELS.indexOf(a.level) >= 0 ? a.level : '';
    if (!nm) return reply(false, '추가할 과목 이름을 알려 주세요.');
    var dup = all().filter(function (c) { return c.subj === nm && (!lv || c.level.indexOf(lv) === 0); })[0];
    if (dup) { go('course', dup.id); return reply(true, '이미 있는 과목이라 ' + dup.name + ' 화면을 열었습니다.'); }
    var c = { id:'u' + Date.now(), name:nm + (lv ? ' · ' + lv : ''), subj:nm, level:(lv || '수준 미정') + ' · ' + nm, prof:nm + ' 교수', seq:'', goal:'' };
    S.added.push(c); save(); go('course', c.id); linkProf(c); return reply(true, c.name + ' 과목을 추가했습니다. 교수와 상담해 커리큘럼을 만들 수 있습니다.');
  }
  if (d !== 'course' && d !== 'week' && d !== 'quiz') return reply(false, '지원하지 않는 요청입니다.');
  var co = resolve(a.subject);
  if (!co) return reply(false, '“' + String(a.subject || '').slice(0, 20) + '” 과목을 찾지 못했습니다. 내 과목: ' + names());
  if (d === 'course') { go('course', co.id); return reply(true, co.name + ' 과목 화면으로 이동했습니다.'); }
  var seq = seqOf(co); if (!seq) { go('course', co.id); return reply(false, co.name + '은 아직 커리큘럼이 없어 과목 화면을 열었습니다. 교수와 상담해 커리큘럼을 만들어 보세요.'); }
  var w = Number(a.week); if (!isFinite(w) || Math.floor(w) !== w || w < 1) return reply(false, '몇 주차인지 알려 주세요.');
  if (w > seq.length) { go('course', co.id); return reply(false, co.name + '은 총 ' + seq.length + '주차입니다. 과목 화면을 열었습니다.'); }
  openWeek(co, w, d);
  reply(true, co.name + ' ' + w + '주차 ' + (d === 'quiz' ? '확인 문제' : '학습') + ' 페이지로 이동했습니다.' + (d === 'quiz' && !bankOf(co, w) ? ' 이 주차의 예시 문제는 아직 없습니다.' : ''));
}
var VIEWS = ['subjects', 'plan', 'history', 'report', 'career'];
function mount(el, o) {
  if (!el) return;
  o = o || {};
  M = el; el.textContent = '';
  el.classList.add('lrn');
  var ov = h('div', { class:'ov', id:'lrn-ov', hidden:'hidden', role:'dialog', 'aria-modal':'true', 'aria-label':'과목 추가' }, [h('div', { class:'dlg', id:'lrn-dlg' })]);
  [h('div', { id:'lrn-top' }), h('div', { class:'wrap', id:'lrn-root' }), ov].forEach(function (x) { el.appendChild(x); });
  ov.addEventListener('click', function (e) { if (e.target === ov) closeAdd(); });
  if (!mount.esc) { mount.esc = true; document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeAdd(); }); }
  S.view = VIEWS.indexOf(o.view) >= 0 ? o.view : 'subjects';
  render();
}
window.NaviLearn = {
  mount:mount,
  nav:function (a) { if (M && a && typeof a === 'object') nav(a); },
  view:function (v) { if (M && VIEWS.indexOf(v) >= 0) go(v); },
  on:function (t, f) { if (typeof f === 'function') (LS[t] = LS[t] || []).push(f); }
};
})();
