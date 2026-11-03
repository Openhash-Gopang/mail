import { runAgent } from './agent-core.js';
import { PLAYBOOKS } from './playbooks.js';
import { DOM_TOOLS } from './tools.js';

chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});
let state = { running: false, abort: false, tabId: null, waiter: null };
const say = (m) => chrome.runtime.sendMessage(m).catch(() => {});

async function cfg() { const o = await chrome.storage.local.get(['gateway', 'token', 'provider']); return { gateway: (o.gateway || '').replace(/\/$/, ''), token: o.token || '', provider: o.provider || '' }; }
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function ensureContent(tabId) {
  try { await chrome.tabs.sendMessage(tabId, { __navi: 'ping' }); }
  catch { await chrome.scripting.executeScript({ target: { tabId }, files: ['content.js'] }); }
}
async function toTab(name, input, describe) {
  await ensureContent(state.tabId);
  const r = await chrome.tabs.sendMessage(state.tabId, { __navi: 'tool', name, input, describe });
  if (!r || !r.ok) throw new Error((r && r.error) || '페이지 응답 없음');
  return r;
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
      if (name === 'screenshot') { const w = (await chrome.tabs.get(state.tabId)).windowId; const d = await chrome.tabs.captureVisibleTab(w, { format: 'jpeg', quality: 60 }); return { text: '스크린샷', image: d.split(',')[1] }; }
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
