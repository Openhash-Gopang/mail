import { runAgent } from './agent-core.js';
import { PLAYBOOKS } from './playbooks.js';
import { DOM_TOOLS } from './tools.js';

chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});
let state = { running: false, abort: false, tabId: null, waiter: null };
const say = (m) => chrome.runtime.sendMessage(m).catch(() => {});

async function cfg() { const o = await chrome.storage.local.get(['gateway', 'token', 'provider']); return { gateway: (o.gateway || '').replace(/\/$/, ''), token: o.token || '', provider: o.provider || '' }; }
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function ensureContent(tabId) {
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
async function toTab(name, input, describe) {
  await ensureContent(state.tabId);
  const m = input && input.ref && /^f(\d+)\.(ref_\d+)$/.exec(input.ref);
  if (m) { const r = await send1(state.tabId, Number(m[1]), { __navi: 'tool', name, input: { ...input, ref: m[2] }, describe });
    if (!r || !r.ok) throw new Error((r && r.error) || '페이지 응답 없음'); return r; }
  if (input && input.ref) { const r = await send1(state.tabId, 0, { __navi: 'tool', name, input, describe });
    if (!r || !r.ok) throw new Error((r && r.error) || '페이지 응답 없음'); return r; }
  if (name === 'read_page' || name === 'find' || name === 'get_text') {
    const ids = await frames(state.tabId); const parts = [];
    for (const id of ids) {
      try { const r = await send1(state.tabId, id, { __navi: 'tool', name, input, describe });
        if (r && r.ok && r.text && !/^\(보이는 요소 없음\)$/.test(r.text)) parts.push(id === 0 ? r.text : `[프레임 ${id}]\n` + r.text.replace(/\bref_(\d+)/g, `f${id}.ref_$1`)); } catch { /* 응답 없는 프레임 */ }
    }
    if (!parts.length) throw new Error('화면에서 읽을 요소가 없습니다. 탭을 새로고침(F5)하거나 로딩이 끝난 뒤 다시 시도하세요.');
    return { ok: true, text: parts.join('\n') };
  }
  const r = await send1(state.tabId, 0, { __navi: 'tool', name, input, describe });
  if (!r || !r.ok) throw new Error((r && r.error) || '페이지 응답 없음'); return r;
}
function ask(kind, text) { say({ type: 'prompt', kind, text }); return new Promise((res) => { state.waiter = res; }); }

async function host(playbook) {
  const c = await cfg();
  return {
    aborted: () => state.abort,
    log: (e) => say({ type: 'log', e }),
    async callModel(body) {
      const r = await fetch(c.gateway + '/v1/step', { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + c.token }, body: JSON.stringify({ ...body, provider: c.provider || undefined }) });
      const j = await r.json(); if (!r.ok) throw new Error('모델 호출 실패: ' + (j.error || r.status)); return j;
    },
    async describe(name, input) { return DOM_TOOLS.has(name) && input && input.ref ? (await toTab(name, input, true)).info : {}; },
    async execTool(name, input) {
      if (DOM_TOOLS.has(name)) return toTab(name, input, false);
      if (name === 'screenshot') { await chrome.tabs.update(state.tabId, { active: true }); const w = (await chrome.tabs.get(state.tabId)).windowId; const d = await chrome.tabs.captureVisibleTab(w, { format: 'jpeg', quality: 60 }); return { text: '스크린샷', image: d.split(',')[1] }; }
      if (name === 'navigate') { await chrome.tabs.update(state.tabId, { url: input.url }); await wait(2500); return { text: '이동: ' + input.url }; }
      if (name === 'wait') { await wait(Math.min(10, Number(input.seconds) || 1) * 1000); return { text: '대기 완료' }; }
      throw new Error('알 수 없는 도구: ' + name);
    },
    ask: (t) => ask('confirm', t),
    handoff: async (t) => { await ask('handoff', t); },
  };
}

chrome.runtime.onMessage.addListener((m, _s, send) => {
  if (m.type === 'reply' && state.waiter) { const w = state.waiter; state.waiter = null; w(m.ok !== false); }
  if (m.type === 'stop') { state.abort = true; if (state.waiter) { state.waiter(false); state.waiter = null; } }
  if (m.type === 'start' && !state.running) (async () => {
    state = { running: true, abort: false, tabId: null, waiter: null };
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true }); state.tabId = tab.id;
      const pb = m.playbook ? PLAYBOOKS[m.playbook] : null;
      const goal = pb ? `${m.goal}\n(절차: ${pb.title})` : m.goal;
      const res = await runAgent({ goal, playbook: pb, host: await host(pb) });
      say({ type: 'done', res });
    } catch (e) { say({ type: 'error', text: e.message }); }
    state.running = false;
  })();
  send && send({ ok: true });
});
