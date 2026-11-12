/**
 * naviweb-proxy — naviweb.kr 주소로 나비웹(mail.hondi.net 의 GitHub Pages)을 그대로 보여 주는 Cloudflare Worker.
 *
 *   naviweb.kr/            → mail.hondi.net/desktop.html  (폰이면 hondi.net/webapp.html 을 같은 주소 naviweb.kr 아래에서 그대로 제공 — isPhone·phoneRoute 참조)
 *   naviweb.kr/<파일>      → mail.hondi.net/<파일>
 *   naviweb.kr/_h/<경로>   → hondi.net/<경로>   (PDV·GDC·기능 개선 제안 등 끼워 넣는 hondi.net 페이지를 같은 출처로 만든다)
 *   naviweb.kr/src|auth|lib/… → hondi.net/… (hondi.net 페이지가 절대경로로 부르는 공용 스크립트)
 *
 * 쿠키는 전달하지 않는다(정적 파일이라 필요 없고, 로그인 쿠키가 원본 서버로 새지 않게 한다).
 * mail.hondi.net 은 이 Worker 의 원본 서버로 계속 남겨 둔다(리다이렉트로 바꾸면 순환한다).
 */
const APP_ORIGIN = 'https://mail.hondi.net';
const HONDI_ORIGIN = 'https://hondi.net';
const HONDI_PREFIXES = ['/src/', '/auth/', '/lib/'];

// 폰 접속은 hondi.net/webapp.html(나비 앱 화면)을 쓴다. 2026-11-12(주피터 지시)부터는 이동(302)시키지 않고,
// 폰으로 판별된 요청은 모든 경로를 hondi.net 에서 받아 naviweb.kr 주소 그대로 보여 준다(주소창이 hondi.net 으로 바뀌지 않는다).
// 폰 요청만 hondi.net 으로 보내므로 PC 요청과 엣지 캐시 키(원본 주소)가 섞이지 않는다.
const PHONE_URL = 'https://hondi.net/webapp.html';
const PHONE_UA = /iPhone|iPod|Android.*Mobile|Windows Phone|BlackBerry|IEMobile|Opera Mini|webOS/i;

// 단말 판별 순서: ① ?view=mobile|desktop ② Sec-CH-UA-Mobile(Chrome·Android) ③ User-Agent.
// iPad·안드로이드 태블릿은 PC 화면(②가 ?0 이거나 ③에 안 걸린다).
export function viewCookie(headers) {
  const m = /(?:^|;\s*)navi_view=(mobile|desktop)/.exec(headers.get('cookie') || '');
  return m ? m[1] : null;
}
export function isPhone(url, headers) {
  const view = url.searchParams.get('view') || viewCookie(headers);   // ?view= 가 우선, 없으면 직전에 고른 값(쿠키) — 하위 파일 요청에도 같은 화면을 유지한다
  if (view === 'mobile') return true;
  if (view === 'desktop') return false;
  const hint = headers.get('sec-ch-ua-mobile');
  if (hint === '?1') return true;
  if (hint === '?0') return false;
  return PHONE_UA.test(headers.get('user-agent') || '');
}

export function phoneRedirect(url) {
  const to = PHONE_URL + (url.searchParams.get('view') === 'mobile' ? '?view=mobile' : '');
  return new Response(null, {
    status: 302,
    headers: { Location: to, 'Cache-Control': 'private, no-store', Vary: 'User-Agent, Sec-CH-UA-Mobile' },
  });
}

export function edgeTtl(pathname) { return /\.(png|jpe?g|gif|webp|svg|ico|woff2?|ttf)$/i.test(pathname) ? 86400 : 120; }

/**
 * 순수 함수 — 정적 파일(스크립트·이미지)을 원본(mail.hondi.net, GitHub Pages)에서 직접 받게 하는 주소 변환.
 * 2026-11-04 측정: 이 PC 의 naviweb.kr 요청은 Cloudflare 서울(ICN)이 아니라 LA(LAX)에서 처리되어(RTT 약 0.4초, 파일마다 2.5~8초),
 * 같은 파일을 mail.hondi.net 에서 받으면 13ms 였다. 그래서 HTML 안의 상대 경로 정적 파일만 원본 주소로 바꿔 LA 를 거치지 않게 한다.
 * 절대 주소(https:, //, data:, blob:)·#·빈 값은 그대로 둔다. 상대 경로는 해당 페이지 경로를 기준으로 푼다.
 */
export function directAsset(value, pagePath, origin) {
  const v = String(value == null ? '' : value).trim();
  if (!v || v[0] === '#' || /^([a-z][a-z0-9+.-]*:|\/\/)/i.test(v)) return null;
  try { const u = new URL(v, origin + (pagePath || '/')); return u.origin === origin ? u.href : null; } catch (e) { return null; }
}

/** 순수 함수 — If-None-Match 가 원본 ETag 와 같은지(약한 표시 W/ 는 무시). 같으면 본문 없이 304 로 답한다(새로고침 때 550KB 를 다시 받지 않는다). */
export function etagMatches(ifNoneMatch, etag) {
  if (!ifNoneMatch || !etag) return false;
  const norm = (x) => String(x).trim().replace(/^W\//, '');
  const e = norm(etag);
  return ifNoneMatch.split(',').some((t) => { const n = norm(t); return n === '*' || n === e; });
}

export function route(url) {
  const p = url.pathname;
  if (p.startsWith('/_h/')) return { target: HONDI_ORIGIN + p.slice(3) + url.search, hondi: true };
  if (HONDI_PREFIXES.some(x => p.startsWith(x))) return { target: HONDI_ORIGIN + p + url.search, hondi: false };
  return { target: APP_ORIGIN + (p === '/' ? '/desktop.html' : p) + url.search, hondi: false };
}

/** 순수 함수 — 폰 요청: '/' 는 hondi.net/webapp.html, 그 밖의 경로는 모두 hondi.net 의 같은 경로(/_h/ 는 기존 규칙). */
export function phoneRoute(url) {
  const p = url.pathname;
  if (p.startsWith('/_h/')) return route(url);
  return { target: HONDI_ORIGIN + (p === '/' ? '/webapp.html' : p) + url.search, hondi: false, phone: true };
}

export default {
  async fetch(request) {
    const url = new URL(request.url);
    if (url.hostname === 'www.naviweb.kr') return Response.redirect('https://naviweb.kr' + url.pathname + url.search, 301);
    if (request.method !== 'GET' && request.method !== 'HEAD') return new Response('Method Not Allowed', { status: 405 });
    const phone = isPhone(url, request.headers);
    const { target, hondi } = phone ? phoneRoute(url) : route(url);
    const headers = new Headers(request.headers);
    headers.delete('cookie'); headers.delete('host');
    // 원본(GitHub Pages)까지 매번 다녀오면 파일마다 0.4~2초가 걸린다. Cloudflare 엣지에 잠깐 캐시한다(사진·글꼴은 길게, 나머지는 2분).
    headers.delete('if-none-match'); headers.delete('if-modified-since'); headers.delete('range');
    const res = await fetch(target, { method: request.method, headers, redirect: 'manual', cf: { cacheEverything: true, cacheTtl: edgeTtl(url.pathname), cacheTtlByStatus: { '200-299': edgeTtl(url.pathname), '300-399': 0, '400-599': 0 } } });
    // 새로고침(F5)은 If-None-Match 를 보낸다. 원본과 같으면 본문 없이 304 — LA 경유 550KB 전송을 건너뛴다.
    const etag = res.headers.get('etag');
    if (res.status === 200 && etagMatches(request.headers.get('if-none-match'), etag)) {
      return new Response(null, { status: 304, headers: { ETag: etag, 'Cache-Control': url.pathname === '/' ? 'public, max-age=60' : (res.headers.get('cache-control') || 'public, max-age=120') } });
    }
    const out = new Headers(res.headers);
    out.delete('set-cookie');
    // ?view=mobile|desktop 로 고른 화면은 쿠키로 기억해 하위 파일 요청에도 같은 쪽(hondi.net / mail.hondi.net)을 쓰게 한다.
    const _pick = url.searchParams.get('view');
    if (_pick === 'mobile' || _pick === 'desktop') out.append('Set-Cookie', `navi_view=${_pick}; Path=/; Max-Age=86400; Secure; SameSite=Lax`);
    if (phone) out.set('Vary', 'User-Agent, Sec-CH-UA-Mobile, Cookie');
    // '/' 는 폰이면 hondi.net 화면, 아니면 PC 화면이라 단말에 따라 달라진다(Vary). 짧게만 브라우저에 둔다.
    if (url.pathname === '/') { out.set('Vary', 'User-Agent, Sec-CH-UA-Mobile, Cookie'); out.set('Cache-Control', 'public, max-age=60'); }
    const loc = out.get('location');
    if (loc) out.set('location', loc.replace(APP_ORIGIN, '').replace(HONDI_ORIGIN, '/_h'));
    const ct = out.get('content-type') || '';
    if (hondi && ct.includes('text/html')) {
      // hondi.net 페이지 안의 루트 상대 경로(/pdv-store.js 등)를 /_h/ 아래로 돌린다.
      const fix = (attr) => ({ element(el) { const v = el.getAttribute(attr); if (v && v.startsWith('/') && !v.startsWith('//') && !v.startsWith('/_h/') && !HONDI_PREFIXES.some(x => v.startsWith(x))) el.setAttribute(attr, '/_h' + v); } });
      return new HTMLRewriter().on('script[src]', fix('src')).on('link[href]', fix('href')).on('a[href]', fix('href')).on('img[src]', fix('src')).transform(new Response(res.body, { status: res.status, headers: out }));
    }
    if (phone && !hondi && ct.includes('text/html') && res.status === 200) {
      // 폰 화면(hondi.net/webapp.html)의 스크립트·스타일·이미지는 주소창과 무관하므로 hondi.net 에서 직접 받게 한다.
      // 지금까지는 파일마다 이 Worker(LA 경유, 파일당 0.4초+)를 거쳐 첫 화면이 느렸다. manifest·서비스워커는 같은 출처에 남긴다.
      const pagePath = target.slice(HONDI_ORIGIN.length).split('?')[0] || '/';
      const fix = (attr) => ({ element(el) { const d = directAsset(el.getAttribute(attr), pagePath, HONDI_ORIGIN); if (d) el.setAttribute(attr, d); } });
      return new HTMLRewriter().on('script[src]', fix('src')).on('img[src]', fix('src')).on('link[rel~="stylesheet"]', fix('href')).on('link[rel~="icon"]', fix('href')).on('link[rel="apple-touch-icon"]', fix('href')).transform(new Response(res.body, { status: res.status, headers: out }));
    }
    if (!hondi && !phone && ct.includes('text/html') && res.status === 200) {
      // 앱 페이지 안의 상대 경로 스크립트·이미지·아이콘은 mail.hondi.net 에서 직접 받게 한다(위 directAsset 설명 참조).
      const pagePath = target.slice(APP_ORIGIN.length).split('?')[0] || '/';
      const fix = (attr) => ({ element(el) { const d = directAsset(el.getAttribute(attr), pagePath, APP_ORIGIN); if (d) el.setAttribute(attr, d); } });
      return new HTMLRewriter().on('script[src]', fix('src')).on('img[src]', fix('src')).on('link[rel~="icon"]', fix('href')).on('link[rel="apple-touch-icon"]', fix('href')).on('link[rel="stylesheet"]', fix('href')).transform(new Response(res.body, { status: res.status, headers: out }));
    }
    return new Response(res.body, { status: res.status, headers: out });
  },
};
