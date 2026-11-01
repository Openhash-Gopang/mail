// 수동 e2e: NODE_PATH=$(npm root -g) node tests/e2e/doc-edit-host.e2e.cjs  (desktop.html + 가짜 서류 페이지/서버)
const { chromium } = require('playwright'); const fs = require('fs'); const path = require('path');
const ROOT = '/home/claude/mail';
const FAKE_DOC = `<!doctype html><meta charset=utf-8><body><script>
let rev=0;
const f=[{k:'price',l:'매매대금',t:'short',state:'user',value:'3억'},{k:'reason',l:'신청 사유',t:'long',state:'ai',value:'매매'}];
function toHost(m){parent.postMessage(m,'*')}
addEventListener('message',e=>{const d=e.data||{};
 if(d.type==='navi-doc-host') return;
 if(d.type==='navi-doc-snapshot-request') toHost({type:'navi-doc-snapshot',ok:true,busy:false,rev,title:'등기신청서',fields:f});
 if(d.type==='navi-doc-revise'){ window.__last=d; rev++; toHost({type:'navi-doc-revise-result',id:d.id,status:'ok',rev,applied:[{k:'reason',l:'신청 사유',from:'매매',to:'매매에 의함'}],conflicts:[{k:'price',l:'매매대금',from:'3억',to:'4억'}],skipped:[]}); }
 if(d.type==='navi-doc-resolve'){ window.__res=d; toHost({type:'navi-doc-revise-result',id:d.id,status:'resolved',rev,k:d.k,accepted:d.accept===true,applied:d.accept?[{k:d.k,l:'매매대금',from:'3억',to:'4억'}]:[],conflicts:[],skipped:[]}); }
 if(d.type==='navi-doc-undo'){ window.__undo=d; toHost({type:'navi-doc-revise-result',id:d.id,status:'undone',rev,applied:[],conflicts:[],skipped:[]}); }
 if(d.type==='navi-doc-submit'){ window.__submit=d; }
});
toHost({type:'navi-doc-ready',v:3});
</script>`;
(async () => {
  const b = await chromium.launch(); const pg = await b.newPage(); const errs = []; pg.on('pageerror', e => errs.push(e.message));
  const posted = [];
  await pg.route('**/*', async r => {
    const u = new URL(r.request().url());
    if (u.hostname === 'mail.hondi.net') { const p = path.join(ROOT, u.pathname === '/' ? 'desktop.html' : u.pathname); return fs.existsSync(p) ? r.fulfill({ path: p }) : r.fulfill({ status: 404, body: '' }); }
    if (u.hostname === 'law.hondi.net') return r.fulfill({ contentType: 'text/html', body: FAKE_DOC });
    if (u.pathname.endsWith('k-service-auth-client.js')) return r.fulfill({ contentType: 'text/javascript', body: 'window.KAuth={fetchWithAuth:(u,o)=>fetch(u,o),getGuid:()=>"g",isLoggedIn:()=>true,ensure:async()=>true};' });
    if (u.pathname.endsWith('/kmail/assist')) { const body = JSON.parse(r.request().postData()); posted.push(body); const edit = /고쳐|바꿔|정중/.test(body.messages.slice(-1)[0].content);
      return r.fulfill({ contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(edit ? { ok: true, reply: '고쳐 드릴게요.', route: { type: 'doc_edit', instruction: body.messages.slice(-1)[0].content, keys: ['reason'], explicit: [] } } : { ok: true, reply: '', route: { type: 'assistant' } }) }); }
    if (u.hostname.includes('hondi.net') || u.hostname === 'localhost') return r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{}' });
    return r.fulfill({ status: 200, body: '' });
  });
  await pg.goto('https://mail.hondi.net/desktop.html'); await pg.waitForTimeout(800);
  await pg.evaluate(() => { const s = document.getElementById('cmp-doc-site'); s.value = 'law'; _cmpSetMode('doc'); _docHostSite('law'); });
  await pg.waitForFunction(() => _docHost.ready && _docHost.v3, null, { timeout: 8000 });
  const ck = (n, c) => console.log((c ? 'OK  ' : 'FAIL') + ' ' + n);
  await pg.fill('#cmp-input', '신청 사유를 더 정중하게 고쳐 줘'); await pg.evaluate(() => _cmpChatSend());
  await pg.waitForSelector('.doc-edit-card button', { timeout: 6000 });
  ck('assist body has doc fields', posted.length === 1 && posted[0].doc && posted[0].doc.fields.length === 2);
  const fr = pg.frames().find(f => f.url().includes('law.hondi.net'));
  ck('revise posted w/ keys', (await fr.evaluate(() => window.__last)).keys[0] === 'reason');
  ck('input cleared', (await pg.inputValue('#cmp-input')) === '');
  ck('card lists applied', /신청 사유: 매매 → 매매에 의함/.test(await pg.textContent('.doc-edit-card')));
  ck('conflict prompt', /직접 쓰신 "매매대금"/.test(await pg.textContent('.doc-edit-card')));
  await pg.click('.doc-edit-card button:has-text("바꾸기")');
  await pg.waitForTimeout(300);
  ck('resolve accept', (await fr.evaluate(() => window.__res)).accept === true);
  await pg.click('.doc-edit-card button:has-text("되돌리기")'); await pg.waitForTimeout(300);
  ck('undo sent + shown', (await fr.evaluate(() => window.__undo)).rev === 1 && /되돌렸습니다/.test(await pg.textContent('.doc-edit-card')));
  // non-edit → falls through to doc page submit
  await pg.fill('#cmp-input', '오늘 날씨'); await pg.evaluate(() => _cmpChatSend()); await pg.waitForTimeout(500);
  ck('non-edit falls through', (await fr.evaluate(() => window.__submit)).text === '오늘 날씨');
  ck('no page errors', errs.length === 0); if (errs.length) console.log(errs);
  await b.close();
})();
