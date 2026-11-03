// 원격 브라우저 세션 하나: 격리된 Chromium 컨텍스트 + 화면 스트림 + 사용자 입력 중계 + 에이전트 루프.
// 에이전트 루프·도구 정의·정책은 확장 프로그램과 같은 파일(../extension)을 그대로 쓴다.
import fs from 'node:fs';
import { runAgent } from '../extension/agent-core.js';
import { classify, hostAllowed, DEFAULT_HOSTS } from '../extension/policy.js';
import { PLAYBOOKS } from '../extension/playbooks.js';
import { DOM_TOOLS } from '../extension/tools.js';

const CONTENT_SRC = fs.readFileSync(new URL('../extension/content.js', import.meta.url), 'utf8');
// content.js 는 chrome.runtime.onMessage 로 도구 요청을 받는다. 원격에서는 이 자리에 얇은 대용품을 두고 직접 부른다.
const INIT = `window.chrome=window.chrome||{};window.chrome.runtime={onMessage:{addListener:function(f){window.__naviL=f;}}};\n${CONTENT_SRC}`;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const VIEW = { width: 1280, height: 800 };
// 사용자가 직접 로그인하는 동안 열릴 수 있는 간편인증 업체 주소(처음 추정값). 막힌 주소는 로그에 남으니 운영자가 ALLOW_HOSTS 로 추가한다.
export const AUTH_HOSTS = ['kakao.com', 'kakaocorp.com', 'naver.com', 'toss.im', 'payco.com', 'nhn.com', 'dreamsecurity.com', 'mobileid.go.kr', 'pass.or.kr', 'kt.com', 'sktelecom.com', 'lguplus.co.kr', 'banksign.co.kr', 'signgate.com', 'kica.co.kr', 'crosscert.com', 'yessign.or.kr', 'koscom.or.kr', 'kftc.or.kr', 'mois.go.kr', 'scourt.go.kr', 'iros.go.kr', 'gov.kr'];

export class RemoteSession {
  constructor({ browser, send, sendFrame, cfg, sub }) {
    this.browser = browser; this.send = send; this.sendFrame = sendFrame; this.cfg = cfg; this.sub = sub;
    this.abort = false; this.control = false; this.waiter = null; this.closed = false;
    this.page = null; this.cdp = null; this.blocked = new Set();
    this.hosts = [...DEFAULT_HOSTS, ...AUTH_HOSTS, ...(cfg.allowHosts || [])];
  }

  hostOk(url) {
    try {
      const u = new URL(url);
      if (u.protocol === 'about:' || u.protocol === 'data:' || u.protocol === 'blob:') return true;
      if (this.cfg.allowHttpHosts && this.cfg.allowHttpHosts.includes(u.hostname)) return true;
      if (u.protocol !== 'https:') return false;
      return this.hosts.some((d) => u.hostname === d || u.hostname.endsWith('.' + d));
    } catch { return false; }
  }

  async open(startUrl) {
    this.ctx = await this.browser.newContext({ viewport: VIEW, locale: 'ko-KR', timezoneId: 'Asia/Seoul', acceptDownloads: false, serviceWorkers: 'block', permissions: [] });
    await this.ctx.addInitScript(INIT);
    // 주 화면 이동은 허용 사이트만. 하위 요청(이미지·스크립트)은 막지 않는다. 열린 프록시로 쓰이는 것을 막기 위함.
    await this.ctx.route('**/*', (route) => {
      const r = route.request();
      if (r.isNavigationRequest() && r.frame() && !r.frame().parentFrame() && !this.hostOk(r.url())) {
        try { this.blocked.add(new URL(r.url()).hostname); } catch { /* 무시 */ }
        this.send({ type: 'blocked', host: (() => { try { return new URL(r.url()).hostname; } catch { return ''; } })() });
        return route.abort('blockedbyclient');
      }
      return route.continue();
    });
    this.ctx.on('page', (p) => this.setPage(p));
    const page = await this.ctx.newPage();
    await this.setPage(page);
    if (startUrl) await page.goto(startUrl, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch((e) => this.send({ type: 'status', text: '시작 화면을 열지 못했습니다: ' + e.message }));
  }

  async setPage(p) {
    if (this.closed) return;
    if (this.cdp) { try { await this.cdp.send('Page.stopScreencast'); await this.cdp.detach(); } catch { /* 이미 닫힘 */ } }
    this.page = p;
    p.on('close', () => { if (this.page === p) { const rest = this.ctx.pages(); if (rest.length) this.setPage(rest[rest.length - 1]); } });
    try {
      this.cdp = await this.ctx.newCDPSession(p);
      this.cdp.on('Page.screencastFrame', async (f) => {
        try { this.sendFrame(Buffer.from(f.data, 'base64')); await this.cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }); } catch { /* 닫힘 */ }
      });
      await this.cdp.send('Page.startScreencast', { format: 'jpeg', quality: this.cfg.quality || 55, maxWidth: VIEW.width, maxHeight: VIEW.height, everyNthFrame: 1 });
    } catch (e) { this.send({ type: 'status', text: '화면 스트림을 시작하지 못했습니다: ' + e.message }); }
    this.send({ type: 'meta', width: VIEW.width, height: VIEW.height });
  }

  // 사용자 입력은 "직접 진행" 단계에서만 받는다. 에이전트가 움직일 때는 무시해 서로 방해하지 않는다.
  async input(m) {
    if (!this.control || !this.page || this.closed) return;
    const clampX = (x) => Math.max(0, Math.min(VIEW.width - 1, Number(x) || 0));
    const clampY = (y) => Math.max(0, Math.min(VIEW.height - 1, Number(y) || 0));
    try {
      if (m.kind === 'mouse') {
        const x = clampX(m.x), y = clampY(m.y), button = ['left', 'right', 'middle'].includes(m.button) ? m.button : 'left';
        if (m.action === 'move') await this.page.mouse.move(x, y);
        else if (m.action === 'down') { await this.page.mouse.move(x, y); await this.page.mouse.down({ button }); }
        else if (m.action === 'up') await this.page.mouse.up({ button });
        else if (m.action === 'click') await this.page.mouse.click(x, y, { button });
      } else if (m.kind === 'wheel') {
        await this.page.mouse.move(clampX(m.x), clampY(m.y)); await this.page.mouse.wheel(Number(m.dx) || 0, Number(m.dy) || 0);
      } else if (m.kind === 'key' && typeof m.key === 'string' && m.key.length < 20) {
        await this.page.keyboard.press(m.key);
      } else if (m.kind === 'text' && typeof m.text === 'string') {
        await this.page.keyboard.insertText(m.text.slice(0, 200));
      }
    } catch { /* 페이지가 바뀌는 중 */ }
  }

  reply(ok) { if (this.waiter) { const w = this.waiter; this.waiter = null; w(ok !== false); } }
  stop() { this.abort = true; this.reply(false); }

  prompt(kind, text) {
    this.send({ type: 'prompt', kind, text });
    if (kind === 'handoff') this.control = true;
    return new Promise((res) => {
      const t = setTimeout(() => { this.abort = true; res(false); }, this.cfg.promptMs || 5 * 60 * 1000);
      this.waiter = (v) => { clearTimeout(t); this.control = false; res(v); };
    });
  }

  // 도구 실행: 화면(프레임)마다 content.js 를 불러 결과를 모은다. 하위 프레임의 ref 는 "f<번호>.ref_N" 로 구분한다.
  async domCall(name, input, describe) {
    const frames = this.page.frames().filter((f) => /^https?:/.test(f.url()) || f === this.page.mainFrame());
    const call = (frame, inp) => frame.evaluate(({ name, inp, describe }) => new Promise((res) => { window.__naviL({ __navi: 'tool', name, input: inp, describe }, null, res); setTimeout(() => res({ ok: false, error: '응답 없음' }), 8000); }), { name, inp, describe });
    const m = input && input.ref && /^f(\d+)\.(ref_\d+)$/.exec(input.ref);
    const fin = async (frame, inp) => {
      const r = await call(frame, inp);
      if (!r || !r.ok) throw new Error((r && r.error) || '페이지 응답 없음');
      if (!describe && name === 'click' && String(r.text).startsWith('@@MAIN@@')) { // javascript: 링크는 페이지 자체 환경에서 누른다(원격은 이미 같은 환경)
        await frame.evaluate(() => { const e = document.querySelector('[data-navi-click]'); if (e) { e.removeAttribute('data-navi-click'); e.click(); } });
        r.text = String(r.text).slice(8);
      }
      return r;
    };
    if (m) return fin(frames[Number(m[1])] || this.page.mainFrame(), { ...input, ref: m[2] });
    if (input && input.ref) return fin(this.page.mainFrame(), input);
    if (name === 'read_page' || name === 'find' || name === 'get_text' || name === 'form_controls') {
      const parts = [];
      for (let i = 0; i < frames.length; i++) {
        try {
          const r = await call(frames[i], input);
          if (r && r.ok && r.text && r.text !== '(보이는 요소 없음)') parts.push(i === 0 ? r.text : `[프레임 ${i}]\n` + r.text.replace(/\bref_(\d+)/g, `f${i}.ref_$1`));
        } catch { /* 이동 중인 프레임 */ }
      }
      if (!parts.length) throw new Error('화면에서 읽을 요소가 없습니다. 로딩이 끝난 뒤 다시 시도하세요.');
      return { ok: true, text: parts.join('\n') };
    }
    return fin(this.page.mainFrame(), input);
  }

  host() {
    const self = this;
    return {
      aborted: () => self.abort || self.closed,
      log: (e) => self.send({ type: 'log', e }),
      async callModel(body) {
        const r = await fetch(self.cfg.gatewayUrl + '/v1/step', { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + self.cfg.runnerToken }, body: JSON.stringify({ ...body, provider: self.cfg.provider || undefined }) });
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error('모델 호출 실패: ' + (j.error || r.status));
        return j;
      },
      async describe(name, input) { return DOM_TOOLS.has(name) && input && input.ref ? (await self.domCall(name, input, true)).info : {}; },
      async execTool(name, input) {
        if (DOM_TOOLS.has(name)) return self.domCall(name, input, false);
        if (name === 'screenshot') { const b = await self.page.screenshot({ type: 'jpeg', quality: 60 }); return { text: '스크린샷', image: b.toString('base64') }; }
        if (name === 'navigate') {
          if (!hostAllowed(input.url)) throw new Error('허용되지 않은 사이트입니다.');
          await self.page.goto(input.url, { waitUntil: 'domcontentloaded', timeout: 30000 }); await wait(1500); return { text: '이동: ' + input.url };
        }
        if (name === 'wait') { await wait(Math.min(10, Number(input.seconds) || 1) * 1000); return { text: '대기 완료' }; }
        throw new Error('알 수 없는 도구: ' + name);
      },
      ask: (t) => self.prompt('confirm', t),
      handoff: async (t) => { await self.prompt('handoff', t); },
    };
  }

  async run({ playbook, goal }) {
    const pb = playbook ? PLAYBOOKS[playbook] : null;
    if (playbook && !pb) throw new Error('알 수 없는 절차입니다.');
    const g = pb ? `${goal}\n(절차: ${pb.title})` : goal;
    if (!String(goal || '').trim() && !pb) throw new Error('할 일을 적어 주세요.');
    const res = await runAgent({ goal: g, playbook: pb, host: this.host(), maxSteps: this.cfg.maxSteps || 40 });
    this.send({ type: 'done', res });
  }

  async close() {
    if (this.closed) return; this.closed = true; this.abort = true; this.reply(false);
    try { if (this.cdp) await this.cdp.send('Page.stopScreencast'); } catch { /* 무시 */ }
    try { await this.ctx.close(); } catch { /* 무시 */ }   // 쿠키·저장소는 컨텍스트와 함께 사라진다
  }
}
export { classify };
