import { PLAYBOOKS } from './playbooks.js';
const $ = (id) => document.getElementById(id);
$('pb').innerHTML = '<option value="">자유 작업 — 어느 사이트든</option>' + Object.entries(PLAYBOOKS).map(([k, v]) => `<option value="${k}">${v.title}</option>`).join('');
chrome.storage.local.get(['gateway', 'token', 'provider']).then((o) => { $('gw').value = o.gateway || ''; $('tk').value = o.token || ''; $('pv').value = o.provider || ''; });
$('save').onclick = () => chrome.storage.local.set({ gateway: $('gw').value.trim(), token: $('tk').value.trim(), provider: $('pv').value });
// 마크다운 기호가 그대로 보이지 않게: **굵게** 만 굵은 글씨로, 나머지 #·` 는 지운다(텍스트 노드만 만들어 HTML 삽입 없음).
const plain = (t) => String(t).replace(/^#{1,6}\s+/gm, '').replace(/`/g, '');
const fill = (el, t) => { plain(t).split(/(\*\*[^*]+\*\*)/).forEach((p) => { if (/^\*\*[^*]+\*\*$/.test(p)) { const b = document.createElement('b'); b.textContent = p.slice(2, -2); el.appendChild(b); } else el.appendChild(document.createTextNode(p.replace(/\*\*/g, ''))); }); };
let lastSay = null;
const add = (cls, t) => { const d = document.createElement('div'); d.className = 'row ' + cls; fill(d, t); $('log').appendChild(d); d.scrollIntoView(); if (cls === 'say') lastSay = d; return d; };
$('go').onclick = async () => { $('log').innerHTML = ''; lastSay = null; const w = await chrome.windows.getCurrent(); chrome.runtime.sendMessage({ type: 'start', goal: $('goal').value.trim(), playbook: $('pb').value, windowId: w.id, slot: curSlot }); };
$('stop').onclick = () => chrome.runtime.sendMessage({ type: 'stop' });
let permitHost = '';
let curSlot = '';   // 나비웹에서 맡긴 첨부서류 항목(결과를 그 항목에 표시한다)
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
  if (m.type === 'done') {
    if (m.res.done && lastSay && m.res.text) { lastSay.classList.add('final'); const h = document.createElement('div'); h.className = 'fh'; h.textContent = '결과'; lastSay.prepend(h); lastSay.scrollIntoView(); }
    add('tool', m.res.done ? '— 완료 —' : '중단됨(' + m.res.reason + ')');
  }
  if (m.type === 'error') add('warn', '오류: ' + m.text);
});

// 나비웹에서 맡긴 작업: 절차와 지시문을 미리 채워 두고, 시작은 사용자가 누른다.
async function showPending() {
  const { pending } = await chrome.storage.local.get('pending');
  if (!pending) { $('pending').hidden = true; curSlot = ''; return; }
  curSlot = pending.slot || '';
  if (pending.playbook) $('pb').value = pending.playbook;
  if (pending.goal) $('goal').value = pending.goal;
  $('pendtitle').textContent = pending.title || '맡긴 작업';
  $('pending').hidden = false;
  chrome.action.setBadgeText({ text: '' });
}
$('pendclear').onclick = async () => { await chrome.storage.local.remove('pending'); $('pending').hidden = true; curSlot = ''; };
chrome.storage.onChanged.addListener((c) => { if (c.pending) showPending(); });
showPending();
