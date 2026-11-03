import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import { WebSocket } from '../ops/naviweb-agent/runner/node_modules/ws/wrapper.mjs';
import gw from '../ops/naviweb-agent/gateway/worker.js';
import { sign, verify } from '../ops/naviweb-agent/runner/ticket.js';
import { createRunner } from '../ops/naviweb-agent/runner/server.js';

const CHROME = process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1243/chrome-linux64/chrome';
const now = () => Math.floor(Date.now() / 1000);

test('티켓: 게이트웨이(WebCrypto)가 서명한 것을 러너(node:crypto)가 검증, 재사용·만료·변조 거부', async () => {
  const env = { AGENT_TOKEN: 'tok', TICKET_SECRET: 's3cret', RUNNER_WS_URL: 'wss://r.example/ws', ALLOWED_ORIGINS: 'chrome-extension://abc' };
  const ask = (h, e = env) => gw.fetch(new Request('https://g/v1/ticket', { method: 'POST', headers: h }), e);
  assert.equal((await ask({ origin: 'https://naviweb.kr' })).status, 401);
  assert.equal((await ask({ origin: 'https://naviweb.kr', authorization: 'Bearer tok' }, { AGENT_TOKEN: 'tok' })).status, 503);
  const r = await ask({ origin: 'https://naviweb.kr', authorization: 'Bearer tok' });
  assert.equal(r.status, 200);
  const j = await r.json();
  assert.equal(j.ws, 'wss://r.example/ws'); assert.ok(j.exp > now());
  const p = verify(j.ticket, 's3cret');
  assert.equal(p.sub, 'operator');
  assert.equal(verify(j.ticket, 's3cret'), null, '한 번만');
  assert.equal(verify(sign({ sub: 'a', jti: 'x1', exp: now() + 60 }, 'other'), 's3cret'), null, '다른 비밀키');
  assert.equal(verify(sign({ sub: 'a', jti: 'x2', exp: now() - 1 }, 's3cret'), 's3cret'), null, '만료');
  const t = sign({ sub: 'a', jti: 'x3', exp: now() + 60 }, 's3cret');
  assert.equal(verify(t.slice(0, -2) + 'AA', 's3cret'), null, '변조');
});

const PAGE = `<!doctype html><meta charset=utf-8><title>가짜 등기소</title>
<select id=kind><option>전체</option><option>본점</option></select>
<input id=sbx_conm___input aria-label="등기상호">
<a id=btn_conm_search href="javascript:show()"><img alt="검색"></a>
<div id=out></div><button id=login>로그인</button><a id=ext href="http://127.0.0.2:%PORT%/">밖으로</a>
<script>function show(){document.getElementById('out').textContent='결과: '+document.getElementById('sbx_conm___input').value+' 1건';}
document.getElementById('login').onclick=function(){document.title='clicked';window.__clicked=(window.__clicked||0)+1;}</script>`;

function listen(handler) { return new Promise((r) => { const s = http.createServer(handler); s.listen(0, '127.0.0.1', () => r(s)); }); }
const textOf = (m) => JSON.stringify(m.content);

test('원격 러너: 가짜 사이트에서 에이전트가 입력·검색하고, 로그인은 사용자에게 넘기며, 허용 밖 이동은 막는다', { skip: !fs.existsSync(CHROME) }, async () => {
  let gate;
  const site = await listen((q, s) => { s.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); s.end(PAGE.replace('%PORT%', gate)); });
  gate = site.address().port;
  const steps = []; const seen = []; let sawResult = false;
  const stub = await listen((q, s) => {
    let b = ''; q.on('data', (c) => (b += c)); q.on('end', () => {
      const body = JSON.parse(b); seen.push({ auth: q.headers.authorization, size: b.length });
      const last = body.messages[body.messages.length - 1];
      const txt = last.role === 'user' && Array.isArray(last.content) && last.content[0].type === 'tool_result' ? last.content.map((c) => textOf(c)).join('\n') : '';
      const ref = (id) => { const m = new RegExp('(ref_\\d+)[^#]*#' + id).exec(txt); return m && m[1]; };
      const n = steps.length; let content;
      if (n === 5) sawResult = txt.includes('결과: 한림농업협동조합');
      if (n === 0) content = [{ type: 'tool_use', id: 't0', name: 'read_page', input: {} }];
      else if (n === 1) content = [{ type: 'tool_use', id: 't1', name: 'type', input: { ref: ref('sbx_conm___input'), text: '한림농업협동조합' } }];
      else if (n === 2) content = [{ type: 'tool_use', id: 't2', name: 'read_page', input: {} }];
      else if (n === 3) content = [{ type: 'tool_use', id: 't3', name: 'click', input: { ref: ref('btn_conm_search') } }];
      else if (n === 4) content = [{ type: 'tool_use', id: 't4', name: 'get_text', input: {} }];
      else if (n === 5) content = [{ type: 'tool_use', id: 't5', name: 'navigate', input: { url: 'https://evil.example/' } }];
      else if (n === 6) content = [{ type: 'tool_use', id: 't6', name: 'handoff_to_user', input: { reason: '로그인은 직접 해 주세요' } }];
      else content = [{ type: 'text', text: '끝: ' + (sawResult ? '결과 확인' : '결과 없음') }];
      steps.push({ n, txt }); if (process.env.DBG) console.error('STEP', n, txt.slice(0, 400));
      s.writeHead(200, { 'content-type': 'application/json' }); s.end(JSON.stringify({ content }));
    });
  });
  const runner = await createRunner({}, { ticketSecret: 'k', gatewayUrl: `http://127.0.0.1:${stub.address().port}`, runnerToken: 'rt', origins: ['https://naviweb.kr'], allowHttpHosts: ['127.0.0.1'], startUrl: `http://127.0.0.1:${gate}/`, maxPerUser: 1, maxSessions: 2, promptMs: 20000, chromePath: CHROME });
  const port = await runner.listen(0, '127.0.0.1');
  try {
    const ticket = (sub = 'u1') => sign({ sub, jti: Math.random().toString(36), exp: now() + 60 }, 'k');
    const open = (t, origin = 'https://naviweb.kr') => new WebSocket(`ws://127.0.0.1:${port}/ws?t=${encodeURIComponent(t)}`, { headers: { origin } });
    const fails = (t, origin) => new Promise((res) => { const w = open(t, origin); w.on('error', () => res(true)); w.on('open', () => { w.close(); res(false); }); });
    assert.ok(await fails('bad.ticket'), '잘못된 티켓');
    assert.ok(await fails(ticket(), 'https://evil.example'), '허용 밖 출처');

    const ws = open(ticket());
    const msgs = []; let frames = 0, resolveDone, resolvePrompt;
    const done = new Promise((r) => (resolveDone = r));
    const gotPrompt = new Promise((r) => (resolvePrompt = r));
    ws.on('message', (d, bin) => {
      if (bin) { frames++; return; }
      const m = JSON.parse(d.toString()); msgs.push(m);
      if (m.type === 'prompt') resolvePrompt(m);
      if (m.type === 'done' || m.type === 'error') resolveDone(m);
    });
    await new Promise((r, j) => { ws.on('open', r); ws.on('error', j); });
    assert.ok(await fails(ticket('u1')), '같은 사용자 두 번째 세션 거부');
    await new Promise((r) => { const t = setInterval(() => msgs.some((m) => m.type === 'ready') && (clearInterval(t), r()), 50); });
    ws.send(JSON.stringify({ type: 'start', goal: '한림농업협동조합 등기상호 검색' }));
    const p = await gotPrompt;
    assert.equal(p.kind, 'handoff');
    ws.send(JSON.stringify({ type: 'input', kind: 'mouse', action: 'click', x: 5, y: 5 })); // 사용자 입력은 직접 진행 단계에서만 받는다
    ws.send(JSON.stringify({ type: 'reply', ok: true }));
    const fin = await done;
    assert.equal(fin.type, 'done', JSON.stringify(fin));
    assert.match(fin.res.text, /결과 확인/);
    assert.ok(frames > 0, '화면 조각이 흘러야 한다');
    assert.ok(seen.every((s) => s.auth === 'Bearer rt'), '서버 토큰으로 호출');
    assert.ok(msgs.some((m) => m.type === 'log' && m.e.name === 'navigate' && m.e.act === 'deny'), '허용 밖 이동 거부');
    ws.close();
    await new Promise((r) => setTimeout(r, 300));
    assert.equal((await (await fetch(`http://127.0.0.1:${port}/health`)).json()).sessions, 0, '종료 후 세션 정리');
  } finally { await runner.close(); site.close(); stub.close(); }
});
