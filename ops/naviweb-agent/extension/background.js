import { runAgent } from './agent-core.js';
import { PLAYBOOKS } from './playbooks.js';
import { DOM_TOOLS } from './tools.js';
import { fetchForNavi, pickDownload } from './files.js';
import { hostAllowed } from './policy.js';

chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});
let state = { running: false, abort: false, tabId: null, waiter: null, inbox: [] };
const say = (m) => chrome.runtime.sendMessage(m).catch(() => {});

// 스토어 설치본은 설정 없이 동작한다: 게이트웨이 주소는 기본값을 쓰고, 인증은 나비웹 로그인 토큰(나비웹 화면에서 작업을 맡길 때 받음, 브라우저를 닫으면 사라짐)을 쓴다.
// 설정에 운영자 토큰을 직접 넣으면 그것을 우선한다(개발·시험용).
const DEFAULT_GATEWAY = 'https://naviweb-agent-gateway.tensor-city.workers.dev';
async function cfg() {
  const o = await chrome.storage.local.get(['gateway', 'token', 'provider']);
  const s = (chrome.storage.session && await chrome.storage.session.get('userToken')) || {};
  return { gateway: (o.gateway || DEFAULT_GATEWAY).replace(/\/$/, ''), token: o.token || '', userToken: s.userToken || '', provider: o.provider || '' };
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// 사이트별 접근 허용: 처음 가는 사이트는 브라우저의 허용 창(사용자 승인)을 거쳐야 읽고 조작할 수 있다.
async function ensureHost(tabId) {
  const tab = await chrome.tabs.get(tabId);
  let u; try { u = new URL(tab.url); } catch { throw new Error('이 화면은 조작할 수 없습니다.'); }
  if (u.protocol !== 'https:') throw new Error('https 사이트만 조작할 수 있습니다.');
  const origins = [`https://${u.hostname}/*`];
  if (await chrome.permissions.contains({ origins })) return;
  if (!(await ask('permit', u.hostname))) { state.abort = true; throw new Error(`${u.hostname} 접근을 허용하지 않아 중단합니다.`); }
  if (!(await chrome.permissions.contains({ origins }))) { state.abort = true; throw new Error(`${u.hostname} 접근 권한을 받지 못해 중단합니다.`); }
}
async function ensureContent(tabId) {
  await ensureHost(tabId);
  // 주 화면(frame 0)의 연결을 확인한다. 확장 프로그램을 새로 불러온 뒤에는 열려 있던 탭에 연결이 없으므로 모든 프레임에 다시 붙인다.
  try { const r = await chrome.tabs.sendMessage(tabId, { __navi: 'ping' }, { frameId: 0 }); if (r && r.ok) return; } catch { /* 아래에서 주입 */ }
  await chrome.scripting.executeScript({ target: { tabId, allFrames: true }, files: ['content.js'] });
  try { await chrome.tabs.sendMessage(tabId, { __navi: 'ping' }, { frameId: 0 }); }
  catch { throw new Error('이 화면에 연결하지 못했습니다. 인터넷등기소 탭을 새로고침(F5)한 뒤 다시 시작하세요.'); }
}
// 프레임이 여럿이면 각 프레임에 보내고, 하위 프레임의 ref 는 "f<번호>.ref_N" 로 구분한다.
async function frames(tabId) {
  try { return (await chrome.webNavigation.getAllFrames({ tabId })).filter((f) => /^https?:/.test(f.url)).map((f) => f.frameId); } catch { return [0]; }
}
// 화면(탭)이 25초 안에 답하지 않으면 멈춘 것으로 보고 오류로 알린다(예전에는 영원히 기다렸다).
const send1 = (tabId, frameId, msg) => Promise.race([chrome.tabs.sendMessage(tabId, msg, { frameId }), new Promise((_, rej) => setTimeout(() => rej(new Error('화면이 25초 넘게 응답하지 않습니다. 탭을 새로고침(F5)한 뒤 다시 맡겨 주세요.')), 25000))]);
async function mainClick(frameId) {
  // javascript: 링크는 확장 프로그램 환경에서 막히므로 페이지 자체 환경(MAIN)에서 누른다.
  await chrome.scripting.executeScript({ target: { tabId: state.tabId, frameIds: [frameId] }, world: 'MAIN', func: () => { const e = document.querySelector('[data-navi-click]'); if (e) { e.removeAttribute('data-navi-click'); e.click(); } } });
}
async function toTab(name, input, describe) {
  await ensureContent(state.tabId);
  const m = input && input.ref && /^f(\d+)\.(ref_\d+)$/.exec(input.ref);
  const one = async (frameId, inp) => {
    const r = await send1(state.tabId, frameId, { __navi: 'tool', name, input: inp, describe });
    if (!r || !r.ok) throw new Error((r && r.error) || '페이지 응답 없음');
    if (!describe && name === 'click' && String(r.text).startsWith('@@MAIN@@')) { await mainClick(frameId); r.text = String(r.text).slice(8) + ' (페이지 환경에서 실행)'; }
    return r;
  };
  if (m) return one(Number(m[1]), { ...input, ref: m[2] });
  if (input && input.ref) return one(0, input);
  if (name === 'read_page' || name === 'find' || name === 'get_text') {
    const ids = await frames(state.tabId); const parts = [];
    for (const id of ids) {
      try { const r = await send1(state.tabId, id, { __navi: 'tool', name, input, describe });
        if (r && r.ok && r.text && !/^\(보이는 요소 없음\)$/.test(r.text)) parts.push(id === 0 ? r.text : `[프레임 ${id}]\n` + r.text.replace(/\bref_(\d+)/g, `f${id}.ref_$1`)); } catch { /* 응답 없는 프레임 */ }
    }
    if (!parts.length) throw new Error('화면에서 읽을 요소가 없습니다. 탭을 새로고침(F5)하거나 로딩이 끝난 뒤 다시 시도하세요.');
    return { ok: true, text: parts.join('\n') };
  }
  return one(0, input);
}
// 작업 탭 위의 안내 띠(content.js). 탭이 바뀌거나 새로 불러와도 다시 붙인다.
async function overlay(mode, text, options) {
  state.ov = mode === 'off' ? null : { mode, text, options };
  if (state.tabId == null) return;
  const msg = { __navi: 'overlay', mode, text, options };
  try { await chrome.tabs.sendMessage(state.tabId, msg, { frameId: 0 }); }
  catch { try { await chrome.scripting.executeScript({ target: { tabId: state.tabId, allFrames: true }, files: ['content.js'] }); await chrome.tabs.sendMessage(state.tabId, msg, { frameId: 0 }); } catch { /* 주입할 수 없는 화면 */ } }
}
chrome.tabs.onUpdated.addListener((id, info) => { if (info.status === 'complete' && state.running && id === state.tabId && state.ov) overlay(state.ov.mode, state.ov.text, state.ov.options); });
function choose(question, options) { say({ type: 'prompt', kind: 'choice', text: question, options }); overlay('choice', question, options); return new Promise((res) => { state.waiter = (ok, value) => { overlay('busy', ''); res(ok ? value : null); }; }); }
// 나비웹 탭(내 데이터 금고 중계가 있는 곳)에 금고 읽기·쓰기를 부탁한다. 안 열려 있거나 늦으면 null.
const pdvWait = new Map();
async function pdvCall(op, data) {
  try {
    const { naviTabId } = (chrome.storage.session && await chrome.storage.session.get('naviTabId')) || {};
    if (naviTabId == null) return null;
    const rid = 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const p = new Promise((res) => { const t = setTimeout(() => { pdvWait.delete(rid); res(null); }, 8000); pdvWait.set(rid, (r) => { clearTimeout(t); res(r); }); });
    await chrome.tabs.sendMessage(naviTabId, { type: 'pdv', rid, op, ...data });
    return await p;
  } catch { return null; }
}
function inputAsk(question, label, saveAs) {
  say({ type: 'prompt', kind: 'input', text: question }); overlay('input', question, [label, saveAs || '']);
  return new Promise((res) => {
    state.waiter = async (ok, value, manual) => {
      overlay('busy', ''); if (!ok) return res(null); if (manual) return res({ manual: true });
      if (saveAs && value) { const r = await pdvCall('set', { values: { [saveAs]: value } }); if (r && r.ok && Array.isArray(r.saved) && r.saved.includes(saveAs)) say({ type: 'prompt', kind: 'saved', text: '내 데이터 금고에 저장했습니다.' }); }
      res(value);
    };
  });
}
// 사용자가 할 일이 생기면 작업 탭을 앞으로 가져온다(나비웹 탭을 보고 있어도 알아챌 수 있게).
async function focusTab() {
  try { if (state.tabId == null) return; const t = await chrome.tabs.update(state.tabId, { active: true }); if (t && t.windowId != null) await chrome.windows.update(t.windowId, { focused: true }); } catch { /* 탭이 없으면 건너뛴다 */ }
}
// 사용자 직접 입력 단계의 안내는 같은 틀로: 무엇을 한 뒤 "완료"를 누르는지, 그다음은 도우미가 이어서 한다는 것.
function handoffText(t) {
  let s = String(t || '').replace(/"?직접 했어요"?/g, '"완료"').replace(/\s+/g, ' ').trim();
  if (!/완료/.test(s)) s += ' 마치면 "완료"를 눌러 주세요.';
  if (/로그인/.test(s) && !/자동/.test(s)) s += ' (로그인된 것이 확인되면 자동으로 이어 갑니다.)';
  if (!/이어서 진행/.test(s)) s += ' 그 다음은 제가 이어서 진행하겠습니다.';
  return s;
}
// 로그인 안내(handoff)를 띄운 동안 작업 탭 묶음을 살펴, 화면에 "로그아웃"이 새로 나타나면 로그인된 것으로 보고 사용자가 완료를 누른 것처럼 이어 간다.
// 화면에 보이는 "로그아웃" 단추·링크 유무만 보며(이름·번호 등 내용은 읽지 않는다), 시작할 때 이미 보이던 탭은 새 신호가 아니므로 제외한다.
function loginProbe() {   // 페이지 안에서 실행된다(자체 완결)
  // 신호 1: 화면에 보이는 "로그아웃" 단추·링크("로그아웃 (29:59)"처럼 뒤에 남은 시간이 붙는 것 포함)
  const re = /^(로그\s*아웃|log\s*out|logout|sign\s*out)(?:\s*[(\[]?[\d:\s분초]*[)\]]?)?$/i;
  const vis = (el) => { const r = el.getBoundingClientRect(), cs = getComputedStyle(el); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none'; };
  for (const el of document.querySelectorAll('a,button,[role=button],input[type=button],input[type=submit]')) {
    const t = (el.tagName === 'INPUT' ? el.value : el.textContent || '').replace(/\s+/g, ' ').trim();
    if (t.length > 20 || !re.test(t)) continue;
    if (vis(el)) return true;
  }
  // 신호 2: 로그인한 사람에게만 보이는 문구 — "○○○ 님의 MyGOV"(정부24 첫 화면), "로그인 시간 연장". 문구가 있는지만 보며 이름은 읽지 않는다.
  try { if (/님의\s*MyGOV|(로그인|세션)\s*(시간\s*)?연장/.test(document.body ? document.body.innerText : '')) return true; } catch { /* 읽을 수 없는 화면 */ }
  return false;
}
async function loggedInTabs() {
  const ids = new Set([state.tabId, ...(state.family || [])].filter((x) => x != null)), out = new Set();
  for (const id of ids) {
    try { const rs = await chrome.scripting.executeScript({ target: { tabId: id, allFrames: true }, func: loginProbe }); if (rs.some((r) => r && r.result === true)) out.add(id); } catch { /* 닫혔거나 읽을 수 없는 탭 */ }
  }
  return out;
}
function watchLogin(waiter) {
  let base = null, hits = 0, stop = false;
  (async () => {
    base = await loggedInTabs();
    while (!stop && state.waiter === waiter && !state.abort) {
      await wait(1500);
      if (stop || state.waiter !== waiter) break;
      const now = await loggedInTabs();
      const fresh = [...now].some((id) => !base.has(id));
      hits = fresh ? hits + 1 : 0;
      if (hits >= 2 && state.waiter === waiter) { say({ type: 'prompt', kind: 'info', text: '로그인을 확인했습니다. 이어서 진행합니다.' }); const w = state.waiter; state.waiter = null; w(true); break; }   // 두 번 연속 확인되면 진행
    }
  })().catch(() => {});
  return () => { stop = true; };
}
function ask(kind, text) {
  say({ type: 'prompt', kind, text }); if (kind !== 'permit') overlay(kind, text);
  return new Promise((res) => {
    let unwatch = null;
    const w = (ok, v) => { if (unwatch) unwatch(); overlay('busy', ''); res(v === '__say' ? 'say' : ok); };
    state.waiter = w;
    if (kind === 'handoff' && /로그인/.test(String(text || '')) && !/회원\s*가입|결제|납부|인증서\s*비밀번호/.test(String(text || ''))) unwatch = watchLogin(w);
  });
}

// 진행 중인 작업을 멈춘다(답을 기다리던 것도 풀어 준다). 몇 초 안에 끝나지 않아도 새 작업은 시작한다.
async function stopCurrent() {
  if (!state.running) return;
  state.abort = true;
  if (state.waiter) { const w = state.waiter; state.waiter = null; try { w(false); } catch { /* 이미 끝남 */ } }
  for (let i = 0; i < 40 && state.running; i++) await wait(100);
}
// 작업하던 탭을 닫으면 그 작업도 끝낸다(남아 있으면 다음 "도우미가 가져오기"가 막힌다).
// 작업 탭 묶음: 작업 중 열린 탭(로그인·회원가입 창, 문서 보기 창 등)을 한 묶음으로 보고, 사용자가 그 사이를 오가거나 닫아도 안내 띠가 따라다닌다.
// 묶음 안의 탭을 사용자가 보면 그 탭이 작업 탭이 되고, 작업 탭이 닫히면 남은 탭으로 옮긴다. 모두 닫히면 작업을 끝낸다.
const famHas = (id) => !!(state.family && state.family.has(id));
function followTab(id, activate) {
  state.tabId = id;
  if (state.ov) overlay(state.ov.mode, state.ov.text, state.ov.options); else overlay('busy', '');
  if (activate) chrome.tabs.update(id, { active: true }).catch(() => {});
}
chrome.tabs.onCreated.addListener((t) => {
  if (!state.running || t.openerTabId == null || !famHas(t.openerTabId)) return;
  state.family.add(t.id);
  if (t.openerTabId === state.tabId) followTab(t.id, true);
});
chrome.tabs.onActivated.addListener(({ tabId }) => { if (state.running && famHas(tabId) && tabId !== state.tabId) followTab(tabId, false); });
chrome.tabs.onRemoved.addListener((id) => {
  if (!state.running || !famHas(id)) return;
  state.family.delete(id);
  if (id !== state.tabId) return;
  const next = [...state.family].pop();
  if (next != null) { followTab(next, true); return; }
  state.abort = true; if (state.waiter) { const w = state.waiter; state.waiter = null; try { w(false); } catch { /* */ } }
});

// 게이트웨이 호출: 네트워크 끊김·서버 5xx 는 두 번까지 다시 시도한다(2초, 5초 뒤). 90초 무응답은 다시 시도하지 않고 알린다.
async function postStep(c, body, onRetry) {
  const send = () => fetch(c.gateway + '/v1/step', { method: 'POST', headers: { 'content-type': 'application/json', ...(c.token ? { authorization: 'Bearer ' + c.token } : {}), ...(c.userToken ? { 'x-navi-token': encodeURIComponent(c.userToken) } : {}) }, body: JSON.stringify({ ...body, provider: c.provider || undefined }), signal: AbortSignal.timeout(90000) });
  let last;
  for (let i = 0; i < 3; i++) {
    try {
      const r = await send();
      if (r.status < 500 || i === 2) return r;
      last = new Error('서버 응답 ' + r.status);
    } catch (e) {
      if (e && e.name === 'TimeoutError') throw new Error('AI 응답이 90초가 넘도록 없습니다. 잠시 뒤 나비웹에서 "도우미가 가져오기"를 다시 눌러 주세요.');
      last = e;
    }
    if (i < 2) { if (onRetry) onRetry(i + 2); await wait(i === 0 ? 2000 : 5000); }
  }
  throw new Error('도우미 서버에 연결하지 못했습니다(3번 시도): ' + (last && last.message || last));
}
async function host(playbook) {
  const c = await cfg();
  const mine = state;
  return {
    progress: (t) => { if (!mine.abort) overlay('busy', t); },
    fetchJob: () => !!mine.slot,   // "도우미가 가져오기"(항목 지정)로 시작한 작업
    aborted: () => mine.abort,   // 이 작업의 중단 표시(새 작업이 state 를 바꿔도 옛 작업은 자기 표시를 본다)
    inbox: () => state.inbox.shift() || null,
    log: (e) => say({ type: 'log', e }),
    async callModel(body) {
      const r = await postStep(c, body, (n) => { if (!mine.abort) overlay('busy', `도우미 서버 연결을 다시 시도하는 중입니다 (${n}/3)`); });
      const j = await r.json().catch(() => ({}));
      if (r.status === 401) throw new Error((j && j.reason ? '[게이트웨이 거절 사유: ' + String(j.reason).slice(0, 60) + '] ' : '') + (c.userToken
        ? '사이트는 열었습니다. 나비웹 로그인 확인이 거절됐습니다(로그인이 만료됐거나, 도우미 설정의 토큰 칸에 옛 값이 남아 있을 수 있습니다). 나비웹을 새로고침해 다시 로그인된 것을 확인한 뒤 서류 작성 화면에서 다시 맡겨 주세요.'
        : '사이트는 열었습니다. 나비웹 로그인 정보를 받지 못했습니다. 나비웹 화면에서 "도우미가 가져오기"를 다시 눌러 주세요(나비웹에 로그인되어 있어야 합니다). 급하면 열린 사이트에서 직접 진행해 주세요.'));
      if (r.status === 429) throw new Error('오늘 사용할 수 있는 도우미 단계 수를 모두 썼습니다. 내일 다시 이용해 주세요.');
      if (!r.ok) throw new Error('모델 호출 실패: ' + (j.error || r.status)); return j;
    },
    async describe(name, input) { return DOM_TOOLS.has(name) && input && input.ref ? (await toTab(name, input, true)).info : {}; },
    async execTool(name, input) {
      if (DOM_TOOLS.has(name)) return toTab(name, input, false);
      if (name === 'screenshot') { await ensureHost(state.tabId); await chrome.tabs.update(state.tabId, { active: true }); const w = (await chrome.tabs.get(state.tabId)).windowId; const d = await chrome.tabs.captureVisibleTab(w, { format: 'jpeg', quality: 60 }); return { text: '스크린샷', image: d.split(',')[1] }; }
      if (name === 'navigate') { await chrome.tabs.update(state.tabId, { url: input.url }); notifyOpened(input.url); await wait(2500); return { text: '이동: ' + input.url }; }
      if (name === 'report_status') {
        if (!state.slot) return { text: '나비웹에서 맡긴 항목이 없어 나비웹 화면에는 표시하지 않았습니다.' };
        const st = ['sent', 'pending', 'failed'].includes(input.state) ? input.state : 'pending';
        await deliverToNavi({ kind: 'status', label: state.slot, state: st, note: String(input.note || '').slice(0, 200) });
        return { text: '나비웹 화면에 알렸습니다: ' + st };
      }
      if (name === 'pdv_get') {
        const r = await pdvCall('get', { keys: Array.isArray(input.keys) ? input.keys.slice(0, 5) : [] });
        if (!r || !r.ok) return { text: '내 데이터 금고를 읽지 못했습니다(나비웹 화면이 닫혀 있거나 금고 중계가 아직 지원하지 않습니다). 사용자에게 ask_input 으로 물으세요.' };
        const L = { name: '성명', sido: '거주지 시도', address: '주소', phone: '전화번호', email: '이메일' }, v = r.values || {};
        const lines = Object.keys(v).filter((k) => L[k]).map((k) => `${L[k]}(${k}): ${String(v[k]).slice(0, 200)}`);
        return { text: lines.length ? lines.join('\n') : '금고에 보관된 값이 없습니다.' };
      }
      if (name === 'send_file_to_navi') {   // 받은 서류 파일을 나비웹 탭으로 보낸다(파일·주소는 AI 에게 보내지 않는다)
        if (!state.slot) return { text: '나비웹에서 맡긴 항목이 없어 파일을 보낼 곳이 없습니다.' };
        const tabUrl = (await chrome.tabs.get(state.tabId)).url || '';
        let fileUrl = '';
        if (input && input.ref) fileUrl = String((await toTab('link_href', { ref: input.ref }, false)).text || '');
        else { const p = pickDownload(await chrome.downloads.search({ orderBy: ['-startTime'], limit: 10 })); if (!p.ok) return { text: p.msg }; fileUrl = p.url; }
        let fhost = ''; try { fhost = new URL(fileUrl).hostname; } catch { return { text: '파일 주소를 읽지 못했습니다.' }; }
        const origins = [`https://${fhost}/*`];
        if (!(await chrome.permissions.contains({ origins }))) {
          if (!(await ask('permit', fhost))) return { text: `${fhost} 접근을 허용하지 않아 파일을 가져오지 못했습니다.` };
          if (!(await chrome.permissions.contains({ origins }))) return { text: `${fhost} 접근 권한을 받지 못했습니다.` };
        }
        const f = await fetchForNavi(fileUrl, tabUrl);
        if (!f.ok) { await deliverToNavi({ kind: 'status', label: state.slot, state: 'failed', note: f.msg.slice(0, 120) }).catch(() => {}); return { text: '파일을 보내지 못했습니다: ' + f.msg }; }
        await deliverToNavi({ kind: 'file', label: state.slot, name: f.name, mime: f.mime, b64: f.b64 });
        await deliverToNavi({ kind: 'status', label: state.slot, state: 'pending', note: '파일을 나비웹으로 보냈습니다. 서류에 넣을지 확인해 주세요.' }).catch(() => {});
        return { text: `나비웹으로 보냈습니다: ${f.name} (${Math.round(f.size / 1024)}KB). 사용자가 나비웹 화면에서 서류에 넣을지 확인합니다.` };
      }
      if (name === 'wait') { await wait(Math.min(10, Number(input.seconds) || 1) * 1000); return { text: '대기 완료' }; }
      throw new Error('알 수 없는 도구: ' + name);
    },
    ask: (t) => ask('confirm', t),
    choose: async (q, o) => { await focusTab(); return choose(q, o); },
    input: async (q, l, k) => { await focusTab(); return inputAsk(q, l, k); },
    handoff: async (t) => { await focusTab(); const r = await ask('handoff', handoffText(t)); return r === 'say' ? 'say' : 'done'; },
  };
}

// 받아 온 파일을 나비웹 탭으로 돌려준다(확장 자신의 화면에서 온 요청만). 3단계에서 인터넷등기소 작업이 이 함수를 부른다.
async function deliverToNavi(msg) {
  const { naviTabId } = (chrome.storage.session && await chrome.storage.session.get('naviTabId')) || {};
  if (naviTabId == null) throw new Error('나비웹 화면을 찾지 못했습니다. 나비웹에서 다시 맡겨 주세요.');
  await chrome.tabs.sendMessage(naviTabId, { type: msg.kind === 'status' ? 'status' : 'deliver', label: msg.label, name: msg.name, mime: msg.mime, b64: msg.b64, state: msg.state, note: msg.note });
}
// 기관 사이트(정부24 등)를 열었다고 나비웹 서류 화면에 알린다. 작업 하나에 한 번만.
function notifyOpened(url) {
  try {
    if (!state.slot || state.openedNotified) return;
    const h = new URL(url).hostname; if (!/^https?:/.test(url) || h === 'about:blank') return;
    state.openedNotified = true;
    deliverToNavi({ kind: 'status', label: state.slot, state: 'opened', note: h }).catch(() => {});
  } catch { /* 주소가 아니면 알리지 않는다 */ }
}
async function runJob(m) {
    state = { running: true, abort: false, tabId: null, waiter: null, ov: null, inbox: [], slot: String(m.slot || '').slice(0, 120) };
    const me = state;
    const keep = setInterval(() => { try { chrome.runtime.getPlatformInfo(); } catch { /* 살아 있음 확인용 호출 */ } }, 20000);   // 서비스 워커가 긴 대기 중에 잠들어 작업이 끊기지 않게
    try {
      const pb = m.playbook ? PLAYBOOKS[m.playbook] : null;
      const okHost = (u) => /^https:/.test(u || '') && (!pb || pb.allowedHosts.some((h) => { try { const x = new URL(u).hostname; return x === h || x.endsWith('.' + h); } catch { return false; } }));
      // 나비웹 화면 자체를 조작하지 않는다. 자유 작업은 사용자가 보고 있는 외부 사이트 탭만 쓰고, 없으면 새 탭을 연다.
      const isNavi = (u) => { try { const h = new URL(u).hostname; return h === 'naviweb.kr' || h.endsWith('.naviweb.kr') || h.endsWith('.hondi.net'); } catch { return false; } };
      const usable = (t) => t && /^https:/.test(t.url || '') && !isNavi(t.url) && okHost(t.url);
      let [tab] = await chrome.tabs.query({ active: true, windowId: m.windowId });
      if (!usable(tab) && pb) { const all = (await chrome.tabs.query({})).filter(usable).sort((a, b) => (b.lastAccessed || 0) - (a.lastAccessed || 0)); if (all[0]) tab = all[0]; }
      if (!usable(tab)) { tab = await chrome.tabs.create({ url: pb && pb.start ? pb.start : (hostAllowed(m.url) ? m.url : 'about:blank'), active: true }); await wait(2500); }
      state.tabId = tab.id; state.family = new Set([tab.id]);
      notifyOpened(tab.url || (pb && pb.start) || m.url);
      await overlay('busy', '');
      say({ type: 'log', e: { kind: 'say', text: tab.url ? `대상 탭: ${tab.title || '(제목 없음)'} (${tab.url})` : '대상 탭: 새 빈 탭에서 시작합니다. 첫 이동 뒤 사이트가 정해집니다.' } });
      const goal = pb ? `${m.goal}\n(절차: ${pb.title})` : m.goal;
      const res = await runAgent({ goal, playbook: pb, host: await host(pb) });
      say({ type: 'done', res });
      if (res && res.done) await overlay('done', String(res.text || '작업을 마쳤습니다.').replace(/[#*`]/g, '').slice(0, 300));
      else await overlay(res && res.reason === 'aborted' ? 'off' : 'error', '작업을 끝내지 못했습니다. 나비웹 화면에서 다시 맡겨 주세요.');
    } catch (e) { say({ type: 'error', text: e.message }); await overlay('error', e.message); }
    clearInterval(keep); me.running = false;   // 새 작업이 이미 state 를 바꿨다면 그 작업의 표시는 건드리지 않는다
  }
// 설치·업데이트·브라우저 시작 때 이미 열려 있는 나비웹 탭에도 다리(bridge.js)를 바로 넣는다.
// 콘텐츠 스크립트는 "페이지를 새로 열 때"만 들어가므로, 이게 없으면 설치 직후 열려 있던 탭은 새로고침하기 전까지 도우미를 못 본다(2026-11-08).
const NAVI_TABS = ['https://naviweb.kr/*', 'https://*.naviweb.kr/*', 'https://*.hondi.net/*'];
async function injectBridgeIntoOpenTabs() {
  let tabs = [];
  try { tabs = await chrome.tabs.query({ url: NAVI_TABS }); } catch { return 0; }
  let n = 0;
  for (const t of tabs) {
    try { await chrome.scripting.executeScript({ target: { tabId: t.id }, files: ['bridge.js'] }); n++; } catch { /* 닫히는 중이거나 주입할 수 없는 탭 */ }
  }
  return n;
}
chrome.runtime.onInstalled.addListener(() => { injectBridgeIntoOpenTabs(); });
chrome.runtime.onStartup.addListener(() => { injectBridgeIntoOpenTabs(); });
chrome.runtime.onMessage.addListener((m, sender, send) => {
  if (m && m.type === 'deliver-file' && sender.id === chrome.runtime.id && !sender.tab) { deliverToNavi(m).then(() => send({ ok: true }), (e) => send({ ok: false, error: e.message })); return true; }
  if (m && m.type === 'info') { send({ version: chrome.runtime.getManifest().version, playbooks: Object.entries(PLAYBOOKS).map(([id, p]) => ({ id, title: p.title })) }); return; }
  if (m && m.type === 'queue') {
    const j = m.job || {};
    if (j.playbook && !PLAYBOOKS[j.playbook]) { send({ ok: false, error: '알 수 없는 절차' }); return; }
    // 나비웹 로그인 토큰은 나비웹 화면(다리 스크립트)에서 온 것만 받는다.
    let fromNavi = false; try { const h = new URL(sender.url || sender.tab?.url || '').hostname; fromNavi = h === 'naviweb.kr' || h.endsWith('.naviweb.kr') || h.endsWith('.hondi.net'); } catch { /* 아님 */ }
    if (fromNavi && typeof j.token === 'string' && j.token && chrome.storage.session) chrome.storage.session.set({ userToken: j.token.slice(0, 4000) });
    if (fromNavi && sender.tab && sender.tab.id != null && chrome.storage.session) chrome.storage.session.set({ naviTabId: sender.tab.id });   // 받아 온 파일을 돌려줄 나비웹 탭
    // 이미 시작한 작업에 나중에 알려 주는 정보(예: 로그인하는 동안 사용자에게 물어 얻은 법인 이름)
    if (j.update) {
      if (fromNavi && state.running && state.slot && state.slot === String(j.slot || '').slice(0, 120) && typeof j.text === 'string' && j.text.trim()) { state.inbox.push(j.text.trim().slice(0, 1000)); send({ ok: true }); }
      else send({ ok: false });
      return;
    }
    // 나비웹에서 맡기면 바로 시작한다(도구 모음 아이콘·옆 창을 열 필요 없음). 로그인·인증서·결제는 작업 탭의 안내에 따라 사용자가 직접 한다.
    if (j.autostart && fromNavi && sender.tab && (j.goal || j.playbook)) {
      // 사용자가 다시 맡기면 하던 작업(예: 닫힌 정부24 탭을 기다리던 작업)을 끝내고 새로 시작한다 — 예전에는 '이미 진행 중'으로 아무 일도 안 했다.
      const pb = j.playbook ? PLAYBOOKS[j.playbook] : null, winId = sender.tab.windowId;
      (async () => {
        await stopCurrent();
        runJob({ url: String(j.url || ''), playbook: j.playbook || '', goal: String(j.goal || (pb && pb.title) || '').slice(0, 2000), slot: String(j.slot || '').slice(0, 120), windowId: winId });
        send({ ok: true });
      })();
      return true;
    }
    chrome.storage.local.set({ pending: { playbook: j.playbook || '', goal: j.goal || '', title: j.title || '', slot: String(j.slot || '').slice(0, 120), at: Date.now() } })
      .then(() => { chrome.action.setBadgeText({ text: '1' }); chrome.action.setBadgeBackgroundColor({ color: '#2f5bd8' }); send({ ok: true }); });
    return true;
  }
  const mine = sender.id === chrome.runtime.id && (!sender.tab || sender.tab.id === state.tabId || famHas(sender.tab.id));
  if (m.type === 'pdv-result' && sender.tab && pdvWait.has(m.rid)) { const f = pdvWait.get(m.rid); pdvWait.delete(m.rid); f(m); return; }
  if (m.type === 'reply' && state.waiter && mine) { const w = state.waiter; state.waiter = null; w(m.ok !== false, m.value, m.manual); }
  if (m.type === 'say' && mine && state.running && typeof m.text === 'string' && m.text.trim()) {
    const txt = m.text.trim().slice(0, 500);
    state.inbox.push('[사용자 메시지] ' + txt); say({ type: 'prompt', kind: 'saved', text: '사용자: ' + txt });
    if (state.waiter && state.ov && state.ov.mode === 'handoff') { const w = state.waiter; state.waiter = null; w(true, '__say'); }   // 직접 입력을 기다리던 중이면 메시지로 깨워 판단하게 한다
  }
  if (m.type === 'stop' && mine) { state.abort = true; if (state.waiter) { state.waiter(false); state.waiter = null; } }
  if (m.type === 'start' && !state.running) runJob(m);
  send && send({ ok: true });
});
