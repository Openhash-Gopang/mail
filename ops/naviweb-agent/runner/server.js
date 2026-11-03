// 원격 브라우저 러너. 게이트웨이가 발급한 티켓으로 WebSocket 에 접속하면 세션 하나를 연다.
//  서버 → 클라이언트: 바이너리 = JPEG 화면 조각, 텍스트 = JSON({type: meta|prompt|log|status|blocked|done|error})
//  클라이언트 → 서버: {type:'start',playbook,goal} {type:'reply',ok} {type:'stop'} {type:'input',kind,...}
import http from 'node:http';
import { WebSocketServer } from 'ws';
import { verify } from './ticket.js';
import { RemoteSession } from './session.js';

async function loadChromium() {
  for (const n of ['playwright-core', 'playwright']) { try { return (await import(n)).chromium; } catch { /* 다음 후보 */ } }
  throw new Error('playwright-core 가 설치되어 있지 않습니다.');
}

export async function createRunner(env = process.env, overrides = {}) {
  const cfg = {
    ticketSecret: env.TICKET_SECRET,
    gatewayUrl: (env.GATEWAY_URL || '').replace(/\/$/, ''),
    runnerToken: env.RUNNER_TOKEN,
    origins: (env.ALLOWED_ORIGINS || 'https://naviweb.kr').split(',').map((s) => s.trim()).filter(Boolean),
    allowHosts: (env.ALLOW_HOSTS || '').split(',').map((s) => s.trim()).filter(Boolean),
    allowHttpHosts: (env.ALLOW_HTTP_HOSTS || '').split(',').map((s) => s.trim()).filter(Boolean), // 시험용
    startUrl: env.START_URL || 'https://www.iros.go.kr/',
    maxSessions: Number(env.MAX_SESSIONS || 10),
    maxPerUser: Number(env.MAX_PER_USER || 1),
    sessionMs: Number(env.SESSION_MS || 20 * 60 * 1000),
    maxSteps: Number(env.MAX_STEPS || 40),
    promptMs: Number(env.PROMPT_MS || 5 * 60 * 1000),
    provider: env.PROVIDER || '',
    chromePath: '',
    ...overrides,
  };
  if (!cfg.ticketSecret || !cfg.gatewayUrl || !cfg.runnerToken) throw new Error('TICKET_SECRET, GATEWAY_URL, RUNNER_TOKEN 이 필요합니다.');
  const chromium = await loadChromium();
  const browser = await chromium.launch({ executablePath: cfg.chromePath || env.CHROME_PATH || undefined, args: ['--no-sandbox', '--disable-dev-shm-usage', '--lang=ko-KR'] });
  const live = new Map(); // sub -> 세션 수
  let total = 0;

  const server = http.createServer((req, res) => {
    if (req.url === '/health') { res.writeHead(200, { 'content-type': 'application/json' }); return res.end(JSON.stringify({ ok: true, sessions: total })); }
    res.writeHead(404); res.end();
  });
  const wss = new WebSocketServer({ noServer: true, maxPayload: 16 * 1024 });
  server.on('upgrade', (req, socket, head) => {
    const deny = (code, msg) => { socket.write(`HTTP/1.1 ${code} ${msg}\r\nConnection: close\r\n\r\n`); socket.destroy(); };
    const origin = req.headers.origin || '';
    if (cfg.origins.length && !cfg.origins.includes(origin)) return deny(403, 'Forbidden');
    const t = new URL(req.url, 'http://x').searchParams.get('t');
    const claims = verify(t, cfg.ticketSecret);
    if (!claims) return deny(401, 'Unauthorized');
    if (total >= cfg.maxSessions || (live.get(claims.sub) || 0) >= cfg.maxPerUser) return deny(429, 'Too Many Requests');
    wss.handleUpgrade(req, socket, head, (ws) => attach(ws, claims));
  });

  function attach(ws, claims) {
    total++; live.set(claims.sub, (live.get(claims.sub) || 0) + 1);
    const send = (o) => { if (ws.readyState === 1) ws.send(JSON.stringify(o)); };
    const sendFrame = (b) => { if (ws.readyState === 1 && ws.bufferedAmount < 1_500_000) ws.send(b, { binary: true }); }; // 느린 접속이면 프레임을 버린다
    const s = new RemoteSession({ browser, send, sendFrame, cfg, sub: claims.sub });
    let started = false, ended = false;
    const end = async () => { if (ended) return; ended = true; clearTimeout(timer); await s.close(); total--; const n = (live.get(claims.sub) || 1) - 1; n ? live.set(claims.sub, n) : live.delete(claims.sub); };
    const timer = setTimeout(() => { send({ type: 'error', text: '세션 시간이 끝났습니다.' }); ws.close(); }, cfg.sessionMs);
    ws.on('close', end); ws.on('error', end);
    s.open(cfg.startUrl).then(() => send({ type: 'ready' })).catch((e) => { send({ type: 'error', text: e.message }); ws.close(); });
    ws.on('message', (data, isBinary) => {
      if (isBinary) return;
      let m; try { m = JSON.parse(data.toString()); } catch { return; }
      if (m.type === 'input') s.input(m);
      else if (m.type === 'reply') s.reply(!!m.ok);
      else if (m.type === 'stop') s.stop();
      else if (m.type === 'start' && !started) {
        started = true;
        s.run({ playbook: typeof m.playbook === 'string' ? m.playbook : '', goal: String(m.goal || '').slice(0, 2000) })
          .catch((e) => send({ type: 'error', text: e.message })).finally(() => { started = false; });
      }
    });
  }

  return {
    server, cfg,
    listen: (port = Number(env.PORT || 8787), host = env.HOST || '0.0.0.0') => new Promise((r) => server.listen(port, host, () => r(server.address().port))),
    close: async () => { for (const c of wss.clients) c.terminate(); await new Promise((r) => server.close(r)); await browser.close(); },
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const r = await createRunner();
  const port = await r.listen();
  console.log(`runner listening on :${port}`);
}
