import { PLAYBOOKS } from './playbooks.js';
const $ = (id) => document.getElementById(id);
$('pb').innerHTML = '<option value="">(절차 없음)</option>' + Object.entries(PLAYBOOKS).map(([k, v]) => `<option value="${k}">${v.title}</option>`).join('');
chrome.storage.local.get(['gateway', 'token', 'provider']).then((o) => { $('gw').value = o.gateway || ''; $('tk').value = o.token || ''; $('pv').value = o.provider || ''; });
$('save').onclick = () => chrome.storage.local.set({ gateway: $('gw').value.trim(), token: $('tk').value.trim(), provider: $('pv').value });
const add = (cls, t) => { const d = document.createElement('div'); d.className = 'row ' + cls; d.textContent = t; $('log').appendChild(d); d.scrollIntoView(); };
$('go').onclick = async () => { $('log').innerHTML = ''; const w = await chrome.windows.getCurrent(); chrome.runtime.sendMessage({ type: 'start', goal: $('goal').value.trim(), playbook: $('pb').value, windowId: w.id }); };
$('stop').onclick = () => chrome.runtime.sendMessage({ type: 'stop' });
let permitHost = '';
const reply = (ok) => { $('ask').hidden = true; permitHost = ''; chrome.runtime.sendMessage({ type: 'reply', ok }); };
// 사이트 접근 허용은 사용자가 이 버튼을 직접 눌러야 브라우저의 허용 창이 뜬다.
$('yes').onclick = async () => {
  if (!permitHost) return reply(true);
  let ok = false; try { ok = await chrome.permissions.request({ origins: [`https://${permitHost}/*`] }); } catch { ok = false; }
  reply(ok);
};
$('no').onclick = () => reply(false);
chrome.runtime.onMessage.addListener((m) => {
  if (m.type === 'log') add(m.e.kind === 'say' ? 'say' : 'tool', m.e.kind === 'say' ? m.e.text : `· ${m.e.name} ${JSON.stringify(m.e.input)} [${m.e.act}]`);
  if (m.type === 'prompt') {
    permitHost = m.kind === 'permit' ? m.text : '';
    $('asktext').textContent = m.kind === 'permit' ? `"${m.text}" 사이트의 화면을 읽고 조작하도록 허용할까요? (브라우저 허용 창이 한 번 더 나옵니다)` : (m.kind === 'handoff' ? '직접 진행이 필요합니다: ' : '확인: ') + m.text;
    $('yes').textContent = m.kind === 'permit' ? '이 사이트 허용' : m.kind === 'handoff' ? '직접 했어요' : '진행';
    $('ask').hidden = false;
  }
  if (m.type === 'done') add('say', m.res.done ? '완료' : '중단됨(' + m.res.reason + ')');
  if (m.type === 'error') add('warn', '오류: ' + m.text);
});

// 나비웹에서 맡긴 작업: 절차와 지시문을 미리 채워 두고, 시작은 사용자가 누른다.
async function showPending() {
  const { pending } = await chrome.storage.local.get('pending');
  if (!pending) { $('pending').hidden = true; return; }
  if (pending.playbook) $('pb').value = pending.playbook;
  if (pending.goal) $('goal').value = pending.goal;
  $('pendtitle').textContent = pending.title || '맡긴 작업';
  $('pending').hidden = false;
  chrome.action.setBadgeText({ text: '' });
}
$('pendclear').onclick = async () => { await chrome.storage.local.remove('pending'); $('pending').hidden = true; };
chrome.storage.onChanged.addListener((c) => { if (c.pending) showPending(); });
showPending();
