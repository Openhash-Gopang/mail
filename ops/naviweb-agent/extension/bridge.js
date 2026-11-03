// 나비웹(naviweb.kr, *.hondi.net) 최상위 페이지와 확장 프로그램을 잇는 다리.
// 페이지가 window.postMessage 로 묻고, 같은 창·같은 출처의 메시지만 받는다. 작업은 "맡기기"만 하고 시작은 사용자가 누른다.
(() => {
  if (window.__naviBridge || window.top !== window) return;
  window.__naviBridge = true;
  const reply = (id, type, data) => window.postMessage({ source: 'navi-agent', type, id, ...data }, location.origin);
  window.addEventListener('message', async (e) => {
    const m = e.data;
    if (e.source !== window || e.origin !== location.origin || !m || m.source !== 'navi-web') return;
    try {
      if (m.type === 'agent-ping') { const info = await chrome.runtime.sendMessage({ type: 'info' }); reply(m.id, 'agent-pong', { ok: true, ...info }); }
      else if (m.type === 'agent-queue') {
        const job = m.job || {};
        const r = await chrome.runtime.sendMessage({ type: 'queue', job: { playbook: String(job.playbook || '').slice(0, 60), goal: String(job.goal || '').slice(0, 2000), title: String(job.title || '').slice(0, 120), token: String(job.token || '').slice(0, 4000) } });
        reply(m.id, 'agent-queued', r || { ok: false });
      }
    } catch (err) { reply(m.id, 'agent-error', { ok: false, error: String(err && err.message || err) }); }
  });
})();
