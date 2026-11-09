// 나비웹(naviweb.kr, *.hondi.net) 최상위 페이지와 확장 프로그램을 잇는 다리.
// 페이지가 window.postMessage 로 묻고, 같은 창·같은 출처의 메시지만 받는다. 작업은 "맡기기"만 하고 시작은 사용자가 누른다.
(() => {
  if (window.top !== window) return;
  // 확장을 새로고침(↻)하면 이미 열려 있던 탭의 옛 다리는 연결이 끊긴 채 남는다. 예전에는 '이미 있다'며 새 다리를 막아 확장이 계속 안 보였다.
  // 이제는 새 다리가 자리를 이어받고, 옛 다리는 자기 번호가 다르면 아무 것도 하지 않는다(같은 확장이 두 번 주입돼도 한 번만 답한다).
  const myId = Math.random().toString(36).slice(2); window.__naviBridgeId = myId;
  const live = () => window.__naviBridgeId === myId;
  // 확장(서비스 워커)이 받아 온 파일을 나비웹 화면으로 넘긴다. 같은 출처로만 보내고, 넣을지는 화면이 사용자에게 묻는다.
  chrome.runtime.onMessage.addListener((m) => {
    if (!live()) return;
    if (m && m.type === 'status' && ['sent', 'pending', 'failed'].includes(m.state)) window.postMessage({ source: 'navi-agent', type: 'agent-status', label: String(m.label || '').slice(0, 120), state: m.state, note: String(m.note || '').slice(0, 200) }, location.origin);
    if (m && m.type === 'pdv' && typeof m.rid === 'string') { window.postMessage({ source: 'navi-agent', type: 'agent-pdv', rid: m.rid.slice(0, 40), op: m.op === 'set' ? 'set' : 'get', keys: Array.isArray(m.keys) ? m.keys.slice(0, 5) : [], values: m.values && typeof m.values === 'object' ? m.values : {} }, location.origin); return; }
    if (!m || m.type !== 'deliver' || typeof m.b64 !== 'string' || m.b64.length > 14 * 1024 * 1024) return;
    try {
      const bin = atob(m.b64), u8 = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
      window.postMessage({ source: 'navi-agent', type: 'agent-file', label: String(m.label || '').slice(0, 120), name: String(m.name || '').slice(0, 120), mime: String(m.mime || ''), data: u8.buffer }, location.origin);
    } catch (e) { /* 깨진 데이터는 버린다 */ }
  });
  const reply = (id, type, data) => window.postMessage({ source: 'navi-agent', type, id, ...data }, location.origin);
  window.addEventListener('message', async (e) => {
    const m = e.data;
    if (!live() || e.source !== window || e.origin !== location.origin || !m || m.source !== 'navi-web') return;
    if (m.type === 'agent-pdv-result') { chrome.runtime.sendMessage({ type: 'pdv-result', rid: String(m.rid || '').slice(0, 40), ok: !!m.ok, values: m.values || {}, saved: m.saved || [] }); return; }
    try {
      if (m.type === 'agent-ping') { const info = await chrome.runtime.sendMessage({ type: 'info' }); reply(m.id, 'agent-pong', { ok: true, ...info }); }
      else if (m.type === 'agent-queue') {
        const job = m.job || {};
        const r = await chrome.runtime.sendMessage({ type: 'queue', job: { playbook: String(job.playbook || '').slice(0, 60), goal: String(job.goal || '').slice(0, 2000), title: String(job.title || '').slice(0, 120), slot: String(job.slot || '').slice(0, 120), token: String(job.token || '').slice(0, 4000), autostart: job.autostart === true, url: String(job.url || '').slice(0, 300), update: job.update === true, text: String(job.text || '').slice(0, 2000) } });
        reply(m.id, 'agent-queued', r || { ok: false });
      }
    } catch (err) { reply(m.id, 'agent-error', { ok: false, error: String(err && err.message || err) }); }
  });
})();
