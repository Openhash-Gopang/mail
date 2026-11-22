/* emergency-app.js — 나비웹 응급(인프라 AI · 응급). desktop.html 안에 직접 그려 넣는다(iframe 없음).
 * 사용: NaviEmergency.mount(요소, { view }) · .nav(조작) · .view(이름) · .on('ask'|'result', 함수)
 * 모양은 emergency.css(.emg 범위). 전역은 NaviEmergency 하나만 쓴다.
 *
 * 응급 화면의 특징(주피터 지시, 설계 원칙): 나비웹 응급은 개인마다 제공된 스마트워치, 기관·장소마다 부착된 CCTV 등 각종 센서를 기반으로 한다.
 *  위급·재난·이상 상황은 이상 탐지(anomaly detection)로 감지하고, 사건의 종류는 AI가 영상·센서 데이터로 판단하며, 사건 카테고리마다 다른 대응 절차가 자동으로 동작한다.
 *  예) 개인의 심박수가 급격히 낮아지면 그 사람의 현재 위치·나이·성별·과거 질병 이력을 가까운 119 구조팀에 보내고 출동을 지시한다.
 *      건물에서 연기가 기준치 이상 감지되면 화재 등을 의심해 그 건물의 추가 센서(온도·영상 등)에서 데이터를 더 얻고, 사건 종류를 확정한 뒤 정해진 절차의 대응이 자동으로 전개된다.
 * 무엇이 실제이고 무엇이 아닌가(화면에도 그대로 적는다):
 *  - 위 원칙은 아직 설계 단계다. 지금은 센서·스마트워치·CCTV가 연결되어 있지 않고, 이 화면은 119 등에 어떤 정보도 보내거나 출동을 지시하지 않는다. 실제 위급 상황은 119에 직접 전화해야 한다.
 *  - '대응 시뮬레이션'은 사용자가 넣은 값으로 감지·대응 순서를 보여 주는 연습용이다. 기준값은 예시이며 의학·안전 기준이 아니다.
 *  - 응급 정보 카드·내 장치·공개 범위는 사용자가 직접 적는 기록이고 이 브라우저(localStorage)에만 저장된다.
 */
(function () {
'use strict';
function h(tag, attrs, kids) {
  var e = document.createElement(tag), k;
  for (k in (attrs || {})) { var v = attrs[k]; if (v == null || v === false) continue; if (k === 'text') e.textContent = v; else if (k.slice(0, 2) === 'on') e[k] = v; else e.setAttribute(k, v === true ? '' : v); }
  (kids || []).forEach(function (c) { if (c == null || c === false) return; e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
  return e;
}
function $(id) { return M ? M.querySelector('#' + id) : null; }
function emit(t, p) { (LS[t] || []).slice().forEach(function (f) { try { f(p); } catch (e) {} }); }
function ask(text) { emit('ask', text || ''); }
function won(n) { return Math.round(Number(n) || 0).toLocaleString('ko-KR'); }
function sgn(n) { return (n > 0 ? '+' : n < 0 ? '−' : '') + won(Math.abs(n)); }
function pct(n, d) { var v = Math.round(n * 100 * Math.pow(10, d == null ? 1 : d)) / Math.pow(10, d == null ? 1 : d); return (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v).toFixed(d == null ? 1 : d) + '%'; }
function cls(n) { return n > 0 ? 'up' : n < 0 ? 'dn' : ''; }
function pill(t, k) { return h('span', { class:'pill ' + (k || ''), text:t }); }
function btn(t, c, fn) { return h('button', { type:'button', class:'btn ' + (c || ''), text:t, onclick:fn }); }
function kst() { return new Intl.DateTimeFormat('en-CA', { timeZone:'Asia/Seoul' }).format(new Date()); }
function numOf(v) { var s = String(v == null ? '' : v).replace(/[,\s원]/g, ''); if (s === '' || !/^\d*\.?\d+$|^\d+\.?$/.test(s)) return NaN; return Number(s); }
function snum(v) { var s = String(v == null ? '' : v).replace(/[,\s원]/g, '').replace(/^[−–-]/, '-'); return /^-?\d*\.?\d+$|^-?\d+\.?$/.test(s) ? Number(s) : NaN; }
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
function clean(s, n) { return String(s == null ? '' : s).replace(/[\u0000-\u001f<>]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n); }

// ── 저장 ──
var KEY = 'navi-emg-v1', MAXD = 50;
var TABS = [['contact', '응급 연락'], ['principle', '대응 원리'], ['sim', '대응 시뮬레이션'], ['devices', '내 장치'], ['consent', '공개 범위']];
var VIEWS = TABS.map(function (t) { return t[0]; });
var INFO = [['name', '이름', 20, '홍길동'], ['age', '연령대', 10, '40대'], ['sex', '성별', 6, '여'], ['blood', '혈액형', 8, 'A형'], ['cond', '지병·과거 질병', 60, '예: 고혈압'], ['meds', '복용 약', 60, ''], ['allergy', '알레르기', 60, ''], ['kin', '비상 연락처(이름·전화)', 40, '예: 배우자 010-0000-0000']];
/** 응급 상황에 보내는 데이터 항목(예시). 사용자가 항목마다 보낼지 정한다. */
var SEND = [['loc', '현재 위치'], ['age', '나이(연령대)'], ['sex', '성별'], ['cond', '과거 질병 이력'], ['meds', '복용 약·알레르기'], ['blood', '혈액형'], ['kin', '비상 연락처']];
/** 사건 카테고리: 감지 센서, 이상 기준(예시), 추가 확인 데이터, 확정, 자동 대응 절차, 받는 곳. */
var CATS = {
  cardiac: { name:'개인 위급(심박 이상)', sensor:'스마트워치 · 심박수', unit:'bpm', dir:'lt', th:'40', thHelp:'이 값보다 낮으면 이상(예시 기준)', extra:['움직임 없음 여부', '산소포화도', '쓰러짐 감지'], confirm:'AI가 심박·움직임으로 위급을 판단하고, 본인이 알림에 응답하지 않으면 확정', to:'가까운 119 구조팀', send:['loc', 'age', 'sex', 'cond', 'meds', 'blood', 'kin'],
    steps:['스마트워치가 심박수의 급격한 저하를 이상으로 감지', '본인 앱에 확인 알림을 보내고 잠시 응답을 기다림', '추가 데이터(움직임·산소포화도·쓰러짐)를 얻어 AI가 위급 여부 판단', '확정되면 아래 데이터를 가까운 119 구조팀에 전송하고 출동 지시', '비상 연락처에 알림, 구조 진행 상황을 본인 기록에 남김'] },
  fire: { name:'건물 화재', sensor:'건물 연기 센서', unit:'ppm', dir:'gt', th:'300', thHelp:'이 값보다 높으면 이상(예시 기준)', extra:['온도 센서', '영상(CCTV)', '다른 층 연기 센서'], confirm:'연기 + 온도 상승 + 영상에서 불꽃·연기가 함께 확인되면 화재로 확정', to:'119 소방 · 건물 관리자', send:['loc'],
    steps:['건물 연기 센서가 기준치 이상을 이상으로 감지', '화재 등을 의심하고 같은 건물의 추가 센서(온도·영상 등)에서 데이터 획득', 'AI가 사건 종류를 화재로 확정', '정해진 절차 전개: 건물 경보와 대피 안내, 119 신고·출동 지시', '건물 관리자에게 알리고, 설비가 연동되어 있으면 방화·배연 설비를 작동'] },
  fall: { name:'쓰러짐·낙상', sensor:'CCTV 영상 · 스마트워치 가속도', unit:'초(움직임 없는 시간)', dir:'gt', th:'30', thHelp:'움직임이 없는 시간이 이보다 길면 이상(예시 기준)', extra:['영상 확인', '심박수', '충격 감지'], confirm:'영상에서 쓰러진 자세가 유지되고 반응이 없으면 확정', to:'가까운 119 구조팀 · 장소 관리자', send:['loc', 'age', 'sex', 'cond'],
    steps:['영상·가속도에서 쓰러짐과 움직임 없음을 이상으로 감지', '그 사람 워치의 심박·충격 데이터와 주변 영상을 추가로 확인', 'AI가 낙상으로 확정', '현장 관리자에게 즉시 알리고 119 구조팀에 위치와 필요한 정보 전송', '구조 완료까지 진행 상황 기록'] },
  gas: { name:'가스 누출', sensor:'가스 센서', unit:'ppm', dir:'gt', th:'100', thHelp:'이 값보다 높으면 이상(예시 기준)', extra:['다른 구역 가스 센서', '환기 설비 상태', '영상'], confirm:'여러 센서에서 같은 방향으로 농도가 높으면 누출로 확정', to:'119 · 가스 안전 기관 · 건물 관리자', send:['loc'],
    steps:['가스 센서가 기준치 이상을 이상으로 감지', '인접 센서와 환기 설비 상태를 추가로 확인', 'AI가 누출로 확정', '밸브 차단·환기 안내와 대피 안내를 내보내고 119와 가스 안전 기관에 통보', '조치가 끝날 때까지 농도를 계속 기록'] },
  flood: { name:'침수·수해', sensor:'수위 센서', unit:'cm', dir:'gt', th:'50', thHelp:'이 값보다 높으면 이상(예시 기준)', extra:['강우량', '영상', '주변 지역 수위'], confirm:'수위 상승이 계속되고 주변 지역에서도 확인되면 침수로 확정', to:'지자체 재난 부서 · 119', send:['loc'],
    steps:['수위 센서가 기준치 이상을 이상으로 감지', '강우량·영상·주변 수위를 추가로 확인', 'AI가 침수로 확정', '해당 지역 사용자에게 대피 안내, 지자체와 119에 통보', '수위 변화와 대응 상황 기록'] }
};
var CAT_KEYS = Object.keys(CATS);
var M = null, LS = {};
var S = { view:'contact', info:{}, share:{}, dev:[], form:{ kind:'스마트워치' }, err:{}, msg:'', sim:{ cat:'cardiac', th:'', val:'', base:'', k:'3' }, simRan:false };
var DEVKINDS = ['스마트워치', 'CCTV', '연기 센서', '가스 센서', '수위 센서', '온도 센서', '기타'];

function field(id, label, val, o) {
  o = o || {}; var e = o.err, inp = h('input', { id:id, type:'text', value:val == null ? '' : val, placeholder:o.ph || '', maxlength:o.max || '60', inputmode:o.mode || '', autocomplete:'off', 'aria-invalid':e ? 'true' : 'false' });
  inp.oninput = function () { if (o.set) o.set(inp.value); };
  return h('div', { class:'field' }, [h('label', { for:id, text:label }), inp, h('div', { id:id + '-h', class:e ? 'err' : 'help', text:e || o.help || '' })]);
}

function empty(t, b) { return h('div', { class:'card', style:'margin-top:16px' }, [h('div', { class:'empty', text:t }), b ? h('div', { class:'rowf', style:'justify-content:center' }, [b]) : null]); }

function head(title, lead) { return [h('h1', { text:title }), lead ? h('p', { class:'lead', text:lead }) : null]; }
function go(v) { S.view = v; S.err = {}; S.msg = ''; render(); try { M.scrollIntoView({ block:'start' }); } catch (e) {} }
function load() {
  try {
    var v = JSON.parse(localStorage.getItem(KEY) || 'null'); if (!v || typeof v !== 'object') return;
    if (v.info && typeof v.info === 'object') INFO.forEach(function (f) { if (typeof v.info[f[0]] === 'string') S.info[f[0]] = clean(v.info[f[0]], f[2]); });
    if (v.share && typeof v.share === 'object') SEND.forEach(function (f) { if (v.share[f[0]]) S.share[f[0]] = 1; });
    S.dev = (Array.isArray(v.dev) ? v.dev : []).map(fixDev).filter(Boolean).slice(0, MAXD);
  } catch (e) {}
}
function fixDev(x) {
  if (!x || typeof x !== 'object') return null;
  var name = clean(x.name, 40); if (!name || DEVKINDS.indexOf(x.kind) < 0 || (x.chk && !/^\d{4}-\d{2}-\d{2}$/.test(x.chk))) return null;
  return { id:clean(x.id, 20) || uid(), kind:x.kind, name:name, place:clean(x.place, 40), chk:x.chk || '' };
}
function save() { try { localStorage.setItem(KEY, JSON.stringify({ info:S.info, share:S.share, dev:S.dev })); } catch (e) {} }

/** 기준값 감지: dir 'lt' 는 값이 기준보다 낮을 때, 'gt' 는 높을 때 이상. 숫자가 아니면 null. */
function detect(dir, value, th) {
  var v = numOf(value), t = numOf(th); if (!isFinite(v) || !isFinite(t) || v > 1e9 || t > 1e9) return null;
  return { hit:dir === 'lt' ? v < t : v > t, value:v, th:t };
}
/** 평소 값 대비 감지: 최근 평소 측정값(5개 이상)의 평균·표준편차로 지금 값이 k 표준편차 이상 벗어났는지 본다. */
function anomaly(readings, latest, k) {
  var xs = (readings || []).map(numOf), v = numOf(latest), kk = numOf(k);
  if (xs.length < 5 || xs.some(function (x) { return !isFinite(x); }) || !isFinite(v) || !(kk > 0) || kk > 20) return null;
  var mean = xs.reduce(function (a, b) { return a + b; }, 0) / xs.length, sd = Math.sqrt(xs.reduce(function (a, b) { return a + (b - mean) * (b - mean); }, 0) / xs.length);
  if (sd === 0) return { mean:mean, sd:0, z:null, abnormal:v !== mean };
  var z = (v - mean) / sd; return { mean:mean, sd:sd, z:z, abnormal:Math.abs(z) >= kk };
}
/** 사건 카테고리의 자동 대응 계획. 사용자가 공개를 허용한 항목만 보낼 데이터에 넣고, 나머지는 막힌 항목으로 따로 돌려준다. */
function plan(cat, share) {
  var c = CATS[cat]; if (!c) return null; var allow = [], block = [];
  c.send.forEach(function (k) { var f = SEND.filter(function (x) { return x[0] === k; })[0]; if (!f) return; (k === 'loc' || share[k] ? allow : block).push(f[1]); });
  return { name:c.name, steps:c.steps.slice(), to:c.to, send:allow, blocked:block, confirm:c.confirm, extra:c.extra.slice() };
}
function devSummary(list, today) {
  var t0 = today ? Date.parse(today + 'T00:00:00Z') : NaN, due = 0, by = {};
  list.forEach(function (x) { by[x.kind] = (by[x.kind] || 0) + 1; if (x.chk && isFinite(t0) && Date.parse(x.chk + 'T00:00:00Z') <= t0) due++; });
  return { count:list.length, by:by, due:due };
}

function topbar() {
  return h('div', { class:'topin' }, [
    h('div', { class:'brand' }, [h('div', {}, [h('b', { text:'나비웹 응급' }), h('span', { text:'인프라 AI · 응급' })])]),
    h('div', { class:'tabs', role:'tablist' }, TABS.map(function (t) { return h('button', { type:'button', class:'tab', role:'tab', 'aria-selected':String(S.view === t[0]), text:t[1], onclick:function () { go(t[0]); } }); }))]);
}
function warn() {
  return h('div', { class:'note', role:'alert', style:'margin:16px 0', id:'emg-warn' }, [h('b', { text:'지금 위급하다면 119에 전화하세요. ' }), '이 화면은 센서나 119에 연결되어 있지 않아 정보를 보내거나 출동을 부르지 않습니다. 범죄·폭력은 112입니다.']);
}
function tile(k, v, s, id) { return h('div', { class:'tile' }, [h('div', { class:'k', text:k }), h('div', { class:'num', id:id, style:'font-size:20px;font-weight:700', text:v }), s ? h('div', { class:'sub', text:s }) : null]); }
function sel(id, label, val, opts, set) {
  var s = h('select', { id:id, 'aria-label':label }, opts.map(function (c) { return h('option', { value:c[0], text:c[1] }); })); s.value = val; s.onchange = function () { set(s.value); };
  return h('div', { class:'field' }, [h('label', { for:id, text:label }), s, h('div', { class:'help', text:'' })]);
}

// ── 응급 연락 ──
function viewContact() {
  var kids = head('응급 연락', '위급할 때 바로 걸 번호와, 구조대에 알려 줄 내 응급 정보를 적어 두는 곳입니다.'); kids.push(warn());
  kids.push(h('div', { class:'g2' }, [['119', '응급·화재·구조', '쓰러짐, 호흡 곤란, 화재, 사고 등'], ['112', '범죄·폭력 신고', '위협, 폭행, 도난 등']].map(function (x) {
    return h('div', { class:'card col' }, [h('div', { class:'num', style:'font-size:34px;font-weight:700', text:x[0] }), h('b', { text:x[1] }), h('span', { class:'sub', text:x[2] }), h('a', { class:'btn fill', href:'tel:' + x[0], text:x[0] + ' 전화 걸기', style:'text-decoration:none;align-self:flex-start' })]); })));
  var card = h('div', { class:'card col', style:'margin-top:16px' }, [h('b', { style:'font-size:17px', text:'내 응급 정보 카드' }), h('div', { class:'sub', text:'구조대나 주변 사람에게 보여 줄 수 있게 적어 둡니다. 이 브라우저에만 저장되며 119에 자동으로 보내지지 않아요(연결 전).' }),
    h('div', { class:'frm' }, INFO.map(function (f) { return field('emg-i-' + f[0], f[1], S.info[f[0]] || '', { ph:f[3], max:f[2], set:function (v) { S.info[f[0]] = clean(v, f[2]); save(); } }); })),
    h('div', { class:'rowf', style:'margin-top:16px' }, [btn('모두 지우기', 'quiet', function () { S.info = {}; S.msg = '지웠어요.'; save(); render(); }), S.msg ? h('span', { class:'sub', role:'status', text:S.msg }) : null])]);
  kids.push(card);
  kids.push(h('div', { class:'rowf', style:'margin-top:16px' }, [btn('응급 AI에게 묻기', 'quiet', function () { ask('응급 상황에서 119에 무엇을 알려야 하나요?'); })]));
  return kids;
}

// ── 대응 원리 ──
function viewPrinciple() {
  var kids = head('대응 원리', '나비웹 응급이 위급·재난 상황을 감지하고 대응하는 방식입니다.');
  var st = [['센서가 계속 지켜봅니다', '개인은 스마트워치, 기관과 장소는 부착된 CCTV와 각종 센서(연기·가스·수위·온도 등)가 데이터를 보냅니다.'], ['이상 탐지로 감지합니다', '평소와 다른 값이나 기준을 넘는 값을 이상 탐지(anomaly detection)로 잡아냅니다.'], ['AI가 사건 종류를 판단합니다', '영상과 센서 데이터로 어떤 사건인지(위급, 화재, 가스, 침수 등) 판단합니다. 필요하면 같은 장소의 추가 센서에서 데이터를 더 얻어요.'], ['사건 종류에 맞는 대응이 자동으로 동작합니다', '카테고리마다 정해진 절차가 다릅니다. 확정되면 사전에 정해진 절차대로 119 등에 필요한 데이터를 보내고 출동을 지시합니다.']];
  kids.push(h('div', { class:'card col', style:'margin-top:16px' }, [h('b', { style:'font-size:17px', text:'감지부터 대응까지' }), h('div', {}, st.map(function (x, i) { return h('div', { class:'stp' }, [h('i', { text:String(i + 1) }), h('div', {}, [h('b', { text:x[0] }), h('span', { text:x[1] })])]); })),
    h('div', { class:'note info', text:'설계 원칙입니다. 지금은 스마트워치·CCTV·센서가 연결되어 있지 않고 이 화면은 119에 아무것도 보내지 않아요. 대응 시뮬레이션에서 순서를 연습해 볼 수 있습니다.' })]));
  kids.push(h('div', { class:'g2', style:'margin-top:16px' }, CAT_KEYS.map(function (k) {
    var c = CATS[k]; return h('div', { class:'card col' }, [h('b', { style:'font-size:17px', text:c.name }), h('div', { class:'kv' }, [h('span', { text:'감지' }), h('b', { text:c.sensor })]), h('div', { class:'kv' }, [h('span', { text:'추가 확인' }), h('b', { text:c.extra.join(' · ') })]), h('div', { class:'kv' }, [h('span', { text:'받는 곳' }), h('b', { text:c.to })]), h('div', { class:'sub', text:'확정: ' + c.confirm })]); })));
  kids.push(h('div', { class:'rowf', style:'margin-top:16px' }, [btn('대응 시뮬레이션 해 보기', 'fill', function () { go('sim'); })]));
  return kids;
}

// ── 대응 시뮬레이션 ──
function viewSim() {
  var kids = head('대응 시뮬레이션', '사건 종류와 측정값을 넣으면 감지되는지, 그 뒤 어떤 순서로 대응이 전개되는지 보여 줍니다. 연습용이며 실제 출동은 일어나지 않아요.'); kids.push(warn());
  var s = S.sim, c = CATS[s.cat] || CATS.cardiac, th = s.th === '' ? c.th : s.th;
  var form = h('div', { class:'card col' }, [h('b', { style:'font-size:17px', text:'상황 넣기' }), h('div', { class:'frm' }, [
    sel('emg-s-cat', '사건 종류', s.cat, CAT_KEYS.map(function (k) { return [k, CATS[k].name]; }), function (v) { s.cat = v; s.th = ''; s.val = ''; s.simRan = false; render(); }),
    field('emg-s-th', '이상 기준(' + c.unit + ')', th, { mode:'decimal', max:10, help:c.thHelp + '. 의학·안전 기준이 아니에요.', set:function (v) { s.th = v; upd(); } }),
    field('emg-s-val', '지금 측정값(' + c.unit + ')', s.val, { ph:c.dir === 'lt' ? '예: 35' : '예: 450', mode:'decimal', max:10, help:c.sensor, set:function (v) { s.val = v; upd(); } })])]);
  var out = h('div', { class:'col', id:'emg-s-out', style:'gap:16px' });
  function upd() {
    out.textContent = ''; var th2 = s.th === '' ? c.th : s.th, d = detect(c.dir, s.val, th2);
    if (!d) { out.appendChild(h('div', { class:'card' }, [h('div', { class:'empty', text:'측정값을 넣으면 감지 결과가 나와요.' })])); return; }
    if (!d.hit) { out.appendChild(h('div', { class:'note info', id:'emg-s-res', text:'이상이 아니에요: 측정값 ' + won(d.value) + c.unit + '은(는) 기준 ' + won(d.th) + c.unit + (c.dir === 'lt' ? ' 이상' : ' 이하') + '입니다. 대응은 시작되지 않아요.' })); return; }
    var P = plan(s.cat, S.share);
    out.appendChild(h('div', { class:'note', role:'alert', id:'emg-s-res', text:'이상 감지: 측정값 ' + won(d.value) + c.unit + '이(가) 기준 ' + won(d.th) + c.unit + '보다 ' + (c.dir === 'lt' ? '낮아요' : '높아요') + '. ' + P.name + ' 대응이 시작됩니다(연습).' }));
    out.appendChild(h('div', { class:'card col' }, [h('b', { text:'대응 순서' }), h('div', {}, P.steps.map(function (x, i) { return h('div', { class:'stp' }, [h('i', { text:String(i + 1) }), h('div', {}, [h('span', { text:x })])]); })), h('div', { class:'sub', text:'확정: ' + P.confirm })]));
    out.appendChild(h('div', { class:'card col' }, [h('b', { text:'받는 곳과 보내는 데이터' }), h('div', { class:'kv' }, [h('span', { text:'받는 곳' }), h('b', { text:P.to })]), h('div', { class:'kv' }, [h('span', { text:'보낼 데이터' }), h('b', { id:'emg-s-send', text:P.send.join(', ') || '없음' })]),
      P.blocked.length ? h('div', { class:'sub', id:'emg-s-block', text:'공개 안 함으로 막힌 항목: ' + P.blocked.join(', ') + ' (공개 범위 탭에서 바꿀 수 있어요)' }) : null]));
  }
  upd(); kids.push(h('div', { class:'g2', style:'margin-top:16px;align-items:start' }, [form, out]));
  if (s.cat === 'cardiac' || s.cat === 'fall') kids.push(baseCard());
  return kids;
}
function baseCard() {
  var s = S.sim, out = h('div', { id:'emg-b-out', style:'margin-top:12px' });
  function upd() {
    out.textContent = ''; var xs = s.base.split(/[\s,]+/).filter(Boolean), r = anomaly(xs, s.val, s.k);
    out.appendChild(!r ? h('div', { class:'sub', text:'평소 값 5개 이상과 지금 값을 넣으면 평소와 얼마나 다른지 알려 줘요.' }) : h('div', { class:r.abnormal ? 'note' : 'note info', id:'emg-b-res', text:'평소 평균 ' + (Math.round(r.mean * 10) / 10) + ', 지금 값은 평소에서 ' + (r.z == null ? (r.abnormal ? '벗어나 있어요(평소 값이 모두 같아요).' : '벗어나지 않았어요.') : Math.abs(Math.round(r.z * 10) / 10) + '표준편차 ' + (r.z < 0 ? '낮아요' : '높아요') + (r.abnormal ? ' → 평소와 다른 이상으로 봅니다.' : ' → 평소 범위예요.')) }));
  }
  var c = h('div', { class:'card col', style:'margin-top:16px' }, [h('b', { style:'font-size:17px', text:'평소 값과 비교(이상 탐지 원리)' }), h('div', { class:'sub', text:'고정 기준 대신 그 사람의 평소 값과 비교하는 방식입니다. 위 “지금 측정값”을 함께 씁니다.' }),
    h('div', { class:'frm' }, [field('emg-b-base', '평소 측정값(쉼표로 구분, 5개 이상)', s.base, { ph:'예: 68, 72, 70, 66, 71, 69', max:120, set:function (v) { s.base = v; upd(); } }), field('emg-b-k', '이상으로 볼 표준편차 배수', s.k, { mode:'decimal', max:4, help:'클수록 더 크게 벗어나야 이상', set:function (v) { s.k = v; upd(); } })]), out]);
  upd(); return c;
}

// ── 내 장치 ──
function addDev() {
  var f = S.form, e = {}, name = clean(f.name, 40);
  if (!name) e.name = '장치 이름을 적어 주세요.';
  if (f.chk && !/^\d{4}-\d{2}-\d{2}$/.test(f.chk)) e.chk = '점검일은 2026-11-23 모양으로 적어 주세요.';
  if (S.dev.length >= MAXD) e.name = '기록은 최대 ' + MAXD + '개까지예요.';
  S.err = e; if (Object.keys(e).length) { S.msg = ''; return render(); }
  S.dev.push({ id:uid(), kind:DEVKINDS.indexOf(f.kind) >= 0 ? f.kind : '기타', name:name, place:clean(f.place, 40), chk:f.chk || '' }); S.form = { kind:f.kind }; S.msg = '기록했어요.'; save(); render();
}
function viewDevices() {
  var kids = head('내 장치', '내가 쓰는 스마트워치와 내 집·가게·사무실에 설치한 센서·CCTV를 적어 두고 점검일을 챙깁니다.'); kids.push(warn());
  var m = devSummary(S.dev, kst());
  kids.push(h('div', { class:'g4' }, [tile('등록한 장치', m.count + '개', '', 'emg-d0'), tile('점검일 지남·오늘', m.due + '개', '', 'emg-d1')]));
  var f = S.form, e = S.err;
  kids.push(h('div', { class:'card col', style:'margin-top:16px' }, [h('b', { style:'font-size:17px', text:'장치 적기' }), h('div', { class:'sub', text:'직접 적는 기록입니다. 장치가 나비웹에 연결되는 기능은 아직 없어요.' }),
    h('div', { class:'frm' }, [sel('emg-dk', '종류', f.kind, DEVKINDS.map(function (k) { return [k, k]; }), function (v) { f.kind = v; }), field('emg-dn', '장치 이름', f.name, { err:e.name, ph:'예: 현관 CCTV', max:40, set:function (v) { f.name = v; } }), field('emg-dp', '설치 장소(선택)', f.place, { ph:'예: 1층 주방', max:40, set:function (v) { f.place = v; } }), field('emg-dc', '다음 점검일(선택)', f.chk, { err:e.chk, ph:'2027-01-31', mode:'numeric', max:10, set:function (v) { f.chk = v.trim(); } })]),
    h('div', { class:'rowf', style:'margin-top:16px' }, [btn('기록하기', 'fill', addDev), S.msg ? h('span', { class:'sub', role:'status', text:S.msg }) : null])]));
  if (!S.dev.length) { kids.push(empty('아직 등록한 장치가 없어요.')); return kids; }
  kids.push(h('div', { class:'card', style:'margin-top:16px;padding:0' }, [h('div', { class:'tbw' }, [h('table', { class:'tbl' }, [h('thead', {}, [h('tr', {}, ['종류', '이름', '장소', '점검일', ''].map(function (t) { return h('th', { text:t }); }))]),
    h('tbody', {}, S.dev.map(function (x) { return h('tr', {}, [h('td', {}, [pill(x.kind)]), h('td', {}, [h('b', { text:x.name })]), h('td', { text:x.place || '—' }), h('td', { class:'num', text:x.chk || '—' }), h('td', { class:'r' }, [btn('삭제', 'sm quiet', function () { S.dev = S.dev.filter(function (y) { return y.id !== x.id; }); S.msg = '삭제했어요.'; save(); render(); })])]); }))])])]));
  return kids;
}

// ── 공개 범위 ──
function viewConsent() {
  var kids = head('공개 범위', '응급 상황에서 구조 기관에 보낼 데이터를 항목마다 직접 정합니다.');
  kids.push(h('div', { class:'note info', style:'margin:16px 0', text:'설계 원칙: 위급 상황에서만, 구조에 필요한 항목만 보냅니다. 현재 위치는 구조에 꼭 필요해 항상 포함됩니다. 지금은 아무것도 전송되지 않으며, 고른 상태는 이 브라우저에만 저장돼요. 대응 시뮬레이션이 이 선택을 따릅니다.' }));
  var n = h('span', { class:'sub', id:'emg-c-n' });
  function tally() { n.textContent = '보내기로 고른 항목 ' + Object.keys(S.share).length + ' / ' + (SEND.length - 1) + ' (현재 위치 제외)'; }
  kids.push(h('div', { class:'card col' }, [h('b', { style:'font-size:17px', text:'구조 기관에 보낼 데이터' }), n,
    h('div', {}, SEND.map(function (f) { var id = 'emg-sh-' + f[0], cb = h('input', { type:'checkbox', id:id, checked:f[0] === 'loc' || S.share[f[0]] ? true : false, disabled:f[0] === 'loc' ? true : null });
      cb.onchange = function () { if (cb.checked) S.share[f[0]] = 1; else delete S.share[f[0]]; save(); tally(); }; return h('label', { class:'chk', for:id }, [cb, h('span', { text:f[1] + (f[0] === 'loc' ? ' (항상 포함)' : '') })]); })),
    h('div', { class:'rowf' }, [btn('모두 해제', 'quiet', function () { S.share = {}; save(); render(); })])]));
  tally();
  kids.push(h('div', { class:'rowf', style:'margin-top:16px' }, [btn('응급 AI에게 묻기', 'quiet', function () { ask('응급 상황에서 내 정보는 누구에게 전달되나요?'); })]));
  return kids;
}

function render() {
  var root = $('emg-root'), tp = $('emg-top'); if (!root || !tp) return; root.textContent = ''; tp.textContent = ''; tp.className = 'top'; tp.appendChild(topbar());
  var kids = S.view === 'principle' ? viewPrinciple() : S.view === 'sim' ? viewSim() : S.view === 'devices' ? viewDevices() : S.view === 'consent' ? viewConsent() : viewContact();
  kids.forEach(function (k) { if (k) root.appendChild(k); });
}
function reply(ok, msg) { emit('result', { ok:ok, msg:msg, view:S.view }); }
function nav(a) {
  var d = a && typeof a['do'] === 'string' ? a['do'] : '';
  if (VIEWS.indexOf(d) >= 0) { go(d); return reply(true, TABS[VIEWS.indexOf(d)][1] + ' 화면으로 이동했습니다.'); }
  return reply(false, '지원하지 않는 요청입니다.');
}
function mount(el, o) {
  if (!el) return; o = o || {};
  M = el; el.textContent = ''; el.classList.add('emg'); S.info = {}; S.share = {}; S.dev = []; S.err = {}; S.msg = ''; load();
  [h('div', { id:'emg-top' }), h('div', { class:'wrap', id:'emg-root' })].forEach(function (x) { el.appendChild(x); });
  S.view = VIEWS.indexOf(o.view) >= 0 ? o.view : 'contact'; render();
}
window.NaviEmergency = {
  mount:mount,
  nav:function (a) { if (M && a && typeof a === 'object') nav(a); },
  view:function (v) { if (M && VIEWS.indexOf(v) >= 0) go(v); },
  detect:detect, anomaly:anomaly, plan:plan, devSummary:devSummary,
  on:function (t, f) { if (typeof f === 'function') (LS[t] = LS[t] || []).push(f); }
};
})();
