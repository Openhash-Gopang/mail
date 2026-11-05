import { runAgent } from './agent-core.js';
import { PLAYBOOKS } from './playbooks.js';
import { DOM_TOOLS } from './tools.js';
import { fetchForNavi, pickDownload } from './files.js';

chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});
let state = { running: false, abort: false, tabId: null, waiter: null };
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
const send1 = (tabId, frameId, msg) => chrome.tabs.sendMessage(tabId, msg, { frameId });
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
function ask(kind, text) { say({ type: 'prompt', kind, text }); return new Promise((res) => { state.waiter = res; }); }

async function host(playbook) {
  const c = await cfg();
  return {
    aborted: () => state.abort,
    log: (e) => say({ type: 'log', e }),
    async callModel(body) {
      const r = await fetch(c.gateway + '/v1/step', { method: 'POST', headers: { 'content-type': 'application/json', ...(c.token ? { authorization: 'Bearer ' + c.token } : { 'x-navi-token': encodeURIComponent(c.userToken) }) }, body: JSON.stringify({ ...body, provider: c.provider || undefined }) });
      const j = await r.json().catch(() => ({}));
      if (r.status === 401) throw new Error('나비웹 로그인이 확인되지 않았습니다. 나비웹에 로그인한 뒤 서류 작성 화면에서 다시 맡겨 주세요.');
      if (r.status === 429) throw new Error('오늘 사용할 수 있는 도우미 단계 수를 모두 썼습니다. 내일 다시 이용해 주세요.');
      if (!r.ok) throw new Error('모델 호출 실패: ' + (j.error || r.status)); return j;
    },
    async describe(name, input) { return DOM_TOOLS.has(name) && input && input.ref ? (await toTab(name, input, true)).info : {}; },
    async execTool(name, input) {
      if (DOM_TOOLS.has(name)) return toTab(name, input, false);
      if (name === 'screenshot') { await ensureHost(state.tabId); await chrome.tabs.update(state.tabId, { active: true }); const w = (await chrome.tabs.get(state.tabId)).windowId; const d = await chrome.tabs.captureVisibleTab(w, { format: 'jpeg', quality: 60 }); return { text: '스크린샷', image: d.split(',')[1] }; }
      if (name === 'navigate') { await chrome.tabs.update(state.tabId, { url: input.url }); await wait(2500); return { text: '이동: ' + input.url }; }
      if (name === 'report_status') {
        if (!state.slot) return { text: '나비웹에서 맡긴 항목이 없어 나비웹 화면에는 표시하지 않았습니다.' };
        const st = ['sent', 'pending', 'failed'].includes(input.state) ? input.state : 'pending';
        await deliverToNavi({ kind: 'status', label: state.slot, state: st, note: String(input.note || '').slice(0, 200) });
        return { text: '나비웹 화면에 알렸습니다: ' + st };
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
    handoff: async (t) => { await ask('handoff', t); },
  };
}

// 받아 온 파일을 나비웹 탭으로 돌려준다(확장 자신의 화면에서 온 요청만). 3단계에서 인터넷등기소 작업이 이 함수를 부른다.
async function deliverToNavi(msg) {
  const { naviTabId } = (chrome.storage.session && await chrome.storage.session.get('naviTabId')) || {};
  if (naviTabId == null) throw new Error('나비웹 화면을 찾지 못했습니다. 나비웹에서 다시 맡겨 주세요.');
  await chrome.tabs.sendMessage(naviTabId, { type: msg.kind === 'status' ? 'status' : 'deliver', label: msg.label, name: msg.name, mime: msg.mime, b64: msg.b64, state: msg.state, note: msg.note });
}
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
    chrome.storage.local.set({ pending: { playbook: j.playbook || '', goal: j.goal || '', title: j.title || '', slot: String(j.slot || '').slice(0, 120), at: Date.now() } })
      .then(() => { chrome.action.setBadgeText({ text: '1' }); chrome.action.setBadgeBackgroundColor({ color: '#2f5bd8' }); send({ ok: true }); });
    return true;
  }
  if (m.type === 'reply' && state.waiter) { const w = state.waiter; state.waiter = null; w(m.ok !== false); }
  if (m.type === 'stop') { state.abort = true; if (state.waiter) { state.waiter(false); state.waiter = null; } }
  if (m.type === 'start' && !state.running) (async () => {
    state = { running: true, abort: false, tabId: null, waiter: null, slot: String(m.slot || '').slice(0, 120) };
    try {
      const pb = m.playbook ? PLAYBOOKS[m.playbook] : null;
      const okHost = (u) => /^https:/.test(u || '') && (!pb || pb.allowedHosts.some((h) => { try { const x = new URL(u).hostname; return x === h || x.endsWith('.' + h); } catch { return false; } }));
      // 나비웹 화면 자체를 조작하지 않는다. 자유 작업은 사용자가 보고 있는 외부 사이트 탭만 쓰고, 없으면 새 탭을 연다.
      const isNavi = (u) => { try { const h = new URL(u).hostname; return h === 'naviweb.kr' || h.endsWith('.naviweb.kr') || h.endsWith('.hondi.net'); } catch { return false; } };
      const usable = (t) => t && /^https:/.test(t.url || '') && !isNavi(t.url) && okHost(t.url);
      let [tab] = await chrome.tabs.query({ active: true, windowId: m.windowId });
      if (!usable(tab) && pb) { const all = (await chrome.tabs.query({})).filter(usable).sort((a, b) => (b.lastAccessed || 0) - (a.lastAccessed || 0)); if (all[0]) tab = all[0]; }
      if (!usable(tab)) { tab = await chrome.tabs.create({ url: pb && pb.start ? pb.start : 'about:blank', active: true }); await wait(2500); }
      state.tabId = tab.id;
      say({ type: 'log', e: { kind: 'say', text: tab.url ? `대상 탭: ${tab.title || '(제목 없음)'} (${tab.url})` : '대상 탭: 새 빈 탭에서 시작합니다. 첫 이동 뒤 사이트가 정해집니다.' } });
      const goal = pb ? `${m.goal}\n(절차: ${pb.title})` : m.goal;
      const res = await runAgent({ goal, playbook: pb, host: await host(pb) });
      say({ type: 'done', res });
    } catch (e) { say({ type: 'error', text: e.message }); }
    state.running = false;
  })();
  send && send({ ok: true });
});
