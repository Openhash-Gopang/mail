/* ═════════════════════════════════════════════════════════════════
   butterfly-landing.js — 첫 화면 "무엇을 도와드릴까요?" 위에 나비가 날아와 앉는 애니메이션 (2026-11-11 신설)
   · 나비 로고(icons/nb-*.png: 앞 날개·뒤 날개·몸통)를 조각으로 나눠, 두 날개가 몸통 쪽 한 점을 축으로 팔랑입니다.
   · 상단의 임의 지점에서 작고 흐릿하게 나타나 → 다가오며 앉은 크기로 커지고 → 문구 위 임의 자리에 걸터앉습니다.
   · 페이지를 연 뒤 이 화면이 처음 보일 때 한 번 날아오고, 이후 화면을 오가면 이미 앉은 모습으로 보입니다.
   · 문구가 다른 모드(캠페인·판결 등)로 바뀌거나 화면이 안 보이면 숨기고 멈춥니다(CPU 사용 없음).
   · 움직임 줄이기(prefers-reduced-motion)를 켠 기기에서는 날갯짓 없이 앉은 모습만 보여 줍니다.
   ═════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var TITLE_TEXT = '무엇을 도와드릴까요?';
  var TOTAL = 6200, S0 = 100, raf = 0, bf = null, lb = null, lf = null, started = false, running = false;
  var landT = Math.random(), startR = { x: Math.random(), y: Math.random() };
  var phase = 0, rot = 0, el = 0, last = 0, px = null, py = null, fo = null, pts = null, S = 70;
  var mq = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)');

  function lerp(a, b, t) { return a + (b - a) * t; }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function smooth(t) { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); }
  function easeIO(t) { return 0.5 - 0.5 * Math.cos(Math.PI * clamp(t, 0, 1)); }

  function titleEl() { return document.querySelector('#cmp-landing .chat-landing-title'); }
  function active() {
    var t = titleEl();
    if (!t || document.hidden) return false;
    if (String(t.textContent).trim() !== TITLE_TEXT) return false;
    var tab = document.getElementById('tab-compose');
    if (!tab || !tab.classList.contains('active')) return false;
    var r = t.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && t.offsetParent !== null;
  }
  function build() {
    if (bf) return;
    var st = document.createElement('style');
    st.textContent = '#nb-bf{position:fixed;left:0;top:0;z-index:30;pointer-events:none;opacity:0;will-change:transform;filter:drop-shadow(0 3px 3px rgba(0,0,0,.16))}' +
      '#nb-bf img{position:absolute;inset:0;width:100%;height:100%;display:block;will-change:transform;transform-origin:61% 65%}';
    document.head.appendChild(st);
    bf = document.createElement('div'); bf.id = 'nb-bf'; bf.setAttribute('aria-hidden', 'true');
    bf.innerHTML = '<img id="nb-lb" alt="" src="icons/nb-wing-back.png"><img id="nb-lf" alt="" src="icons/nb-wing-front.png"><img alt="" src="icons/nb-body.png">';
    document.body.appendChild(bf);
    lb = document.getElementById('nb-lb'); lf = document.getElementById('nb-lf');
  }
  // 문구의 현재 위치(화면 기준) — 글자 폭 안에서 임의 자리
  function geom() {
    var t = titleEl(), cs = getComputedStyle(t), fs = parseFloat(cs.fontSize) || 30;
    var lh = parseFloat(cs.lineHeight); if (!isFinite(lh)) lh = fs * 1.35;
    var rg = document.createRange(); rg.selectNodeContents(t);
    var tr = rg.getBoundingClientRect(), r = t.getBoundingClientRect();
    S = S0 * fs / 30;
    var left = tr.width > 0 ? tr.left : r.left, width = tr.width > 0 ? tr.width : r.width;
    var top = r.top + (lh - fs) / 2 - 1;                                  // 글자 윗선 근처
    return { x: left + width * (0.08 + 0.84 * landT), y: top - 0.361 * S * 0.72, top: top };
  }
  function buildPath(g) {
    var W = window.innerWidth, topMin = 64, avail = Math.max(g.top - topMin - 30, 60);
    var sx = W * (0.12 + 0.76 * startR.x), sy = topMin + avail * (0.05 + 0.2 * startR.y);
    var dir = sx < g.x ? -1 : 1, ex = g.x + dir * 130 * (S / S0), fr = [0.25, 0.1, 0.32, 0.18];
    pts = [{ x: sx, y: sy }];
    for (var i = 1; i <= 4; i++) pts.push({ x: lerp(sx, ex, i / 5), y: topMin + avail * fr[i - 1] });
    pts.push({ x: g.x + dir * 90 * (S / S0), y: g.y - 105 * (S / S0) });
    pts.push({ x: g.x + dir * 30 * (S / S0), y: g.y - 48 * (S / S0) });
    pts.push({ x: g.x, y: g.y });
  }
  function cr(p0, p1, p2, p3, t) { var t2 = t * t, t3 = t2 * t; return 0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3); }
  function at(u) {
    var n = pts.length - 1, f = clamp(u, 0, 0.99999) * n, i = Math.floor(f), t = f - i;
    var a = pts[Math.max(i - 1, 0)], b = pts[i], c = pts[i + 1], d = pts[Math.min(i + 2, n)];
    return { x: cr(a.x, b.x, c.x, d.x, t), y: cr(a.y, b.y, c.y, d.y, t) };
  }
  function pose(x, y, rotDeg, sc, o) {
    var fo2 = clamp(o, 0, 1);
    lf.style.transform = 'rotate(' + lerp(15, -13, fo2).toFixed(2) + 'deg)';
    lb.style.transform = 'rotate(' + lerp(-22, 24, fo2).toFixed(2) + 'deg)';
    bf.style.width = bf.style.height = S + 'px';
    bf.style.transform = 'translate3d(' + (x - S / 2).toFixed(2) + 'px,' + (y - S / 2).toFixed(2) + 'px,0) rotate(' + rotDeg.toFixed(2) + 'deg) scale(' + sc.toFixed(3) + ')';
  }

  function frame(now) {
    if (!active()) { running = false; if (bf) bf.style.opacity = 0; return; }       // 안 보이면 멈춤(다시 보이면 이어서)
    var dt = Math.min(now - last, 40); last = now; el += dt;
    var g = geom(); if (!pts) buildPath(g); else pts[pts.length - 1] = { x: g.x, y: g.y };
    var u = easeIO(el / TOTAL), p = at(u);
    var near = smooth((el / TOTAL - 0.66) / 0.34), fl = 1 - near, sec = el / 1000;
    var sc = lerp(0.14, 0.72, Math.pow(clamp(el / TOTAL, 0, 1), 0.85)), k = sc / 0.72;
    var x = p.x + Math.sin(sec * 2.3) * 9 * fl * k;
    var y = p.y + Math.sin(sec * 3.1 + 1) * 3 * fl * k + Math.sin(phase) * 1.5 * fl * k;
    var vx = px == null ? 0 : (x - px) / Math.max(dt, 1) * 1000, vy = py == null ? 0 : (y - py) / Math.max(dt, 1) * 1000;
    px = x; py = y;
    var target = clamp(vx * 0.035, -22, 22) + clamp(vy * 0.02, -12, 12) * 0.5 + Math.sin(sec * 1.7) * 4 * fl - 4 * near;
    rot += (target - rot) * (1 - Math.exp(-dt / 140));
    var hz = lerp(2.6, 0.4, smooth(near * 1.1)), amp = lerp(0.85, 0.18, smooth(near * 1.1)), mean = lerp(0.48, 0.62, smooth(near));
    phase += dt / 1000 * hz * Math.PI * 2;
    var o = clamp(mean + 0.5 * amp * (Math.sin(phase) - 0.12 * Math.sin(2 * phase)), 0, 1);
    fo = fo == null ? o : fo + (o - fo) * (1 - Math.exp(-dt / 45));
    pose(x, y, rot, sc, fo);
    bf.style.opacity = smooth(el / 900).toFixed(2);
    raf = requestAnimationFrame(frame);
  }
  function resume() {
    if (running || !active()) return;
    build();
    if (mq && mq.matches) {                                  // 움직임 줄이기: 앉은 모습만
      var g = geom(); pose(g.x, g.y, -4, 0.72, 0.6); bf.style.opacity = 1; return;
    }
    running = true; last = performance.now();
    if (!started) { started = true; el = 0; phase = 0; rot = 0; px = py = null; fo = null; pts = null; bf.style.opacity = 0; }
    raf = requestAnimationFrame(frame);
  }
  function watch() {
    var t = titleEl();
    if (t) new MutationObserver(resume).observe(t, { childList: true, characterData: true, subtree: true });
    var tab = document.getElementById('tab-compose');
    if (tab) new MutationObserver(resume).observe(tab, { attributes: true, attributeFilter: ['class', 'data-mode'] });
    document.addEventListener('visibilitychange', resume);
    window.addEventListener('resize', function () { pts = null; });
    window.addEventListener('hashchange', function () { setTimeout(resume, 50); });
    setInterval(resume, 1000);                               // 탭 전환 등 놓친 변화를 느슨하게 확인(멈춰 있을 때만 일을 한다)
    resume();
  }
  function init() { (document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve()).then(function () { setTimeout(watch, 400); }); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
