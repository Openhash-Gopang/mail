import { PLAYBOOKS } from './playbooks.js';
const $ = (id) => document.getElementById(id);
$('pb').innerHTML = '<option value="">(절차 없음)</option>' + Object.entries(PLAYBOOKS).map(([k, v]) => `<option value="${k}">${v.title}</option>`).join('');
chrome.storage.local.get(['gateway', 'token', 'provider']).then((o) => { $('gw').value = o.gateway || ''; $('tk').value = o.token || ''; $('pv').value = o.provider || ''; });
$('save').onclick = () => chrome.storage.local.set({ gateway: $('gw').value.trim(), token: $('tk').value.trim(), provider: $('pv').value });
const add = (cls, t) => { const d = document.createElement('div'); d.className = 'row ' + cls; d.textContent = t; $('log').appendChild(d); d.scrollIntoView(); };
$('go').onclick = () => { $('log').innerHTML = ''; chrome.runtime.sendMessage({ type: 'start', goal: $('goal').value.trim(), playbook: $('pb').value }); };
$('stop').onclick = () => chrome.runtime.sendMessage({ type: 'stop' });
const reply = (ok) => { $('ask').hidden = true; chrome.runtime.sendMessage({ type: 'reply', ok }); };
$('yes').onclick = () => reply(true); $('no').onclick = () => reply(false);
chrome.runtime.onMessage.addListener((m) => {
  if (m.type === 'log') add(m.e.kind === 'say' ? 'say' : 'tool', m.e.kind === 'say' ? m.e.text : `· ${m.e.name} ${JSON.stringify(m.e.input)} [${m.e.act}]`);
  if (m.type === 'prompt') { $('asktext').textContent = (m.kind === 'handoff' ? '직접 진행이 필요합니다: ' : '확인: ') + m.text; $('ask').hidden = false; }
  if (m.type === 'done') add('say', m.res.done ? '완료' : '중단됨(' + m.res.reason + ')');
  if (m.type === 'error') add('warn', '오류: ' + m.text);
});
