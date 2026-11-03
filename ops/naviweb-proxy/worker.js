/**
 * naviweb-proxy — naviweb.kr 주소로 나비웹(mail.hondi.net 의 GitHub Pages)을 그대로 보여 주는 Cloudflare Worker.
 *
 *   naviweb.kr/            → mail.hondi.net/desktop.html  (폰이면 hondi.net/webapp.html 로 이동 — isPhone 참조)
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

// 폰 접속은 hondi.net/webapp.html(나비 앱 화면)을 그대로 쓴다.
// 이 화면은 hondi.net 출처에서 로그인·PDV 저장소·루트 경로 요청을 직접 쓰므로, naviweb.kr 안으로 중계하지 않고 이동시킨다.
const PHONE_URL = 'https://hondi.net/webapp.html';
const PHONE_UA = /iPhone|iPod|Android.*Mobile|Windows Phone|BlackBerry|IEMobile|Opera Mini|webOS/i;

// 단말 판별 순서: ① ?view=mobile|desktop ② Sec-CH-UA-Mobile(Chrome·Android) ③ User-Agent.
// iPad·안드로이드 태블릿은 PC 화면(②가 ?0 이거나 ③에 안 걸린다).
export function isPhone(url, headers) {
  const view = url.searchParams.get('view');
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

export function route(url) {
  const p = url.pathname;
  if (p.startsWith('/_h/')) return { target: HONDI_ORIGIN + p.slice(3) + url.search, hondi: true };
  if (HONDI_PREFIXES.some(x => p.startsWith(x))) return { target: HONDI_ORIGIN + p + url.search, hondi: false };
  return { target: APP_ORIGIN + (p === '/' ? '/desktop.html' : p) + url.search, hondi: false };
}

export default {
  async fetch(request) {
    const url = new URL(request.url);
    if (url.hostname === 'www.naviweb.kr') return Response.redirect('https://naviweb.kr' + url.pathname + url.search, 301);
    if (request.method !== 'GET' && request.method !== 'HEAD') return new Response('Method Not Allowed', { status: 405 });
    const entry = url.pathname === '/' || url.pathname === '/webapp.html';
    if (entry && isPhone(url, request.headers)) return phoneRedirect(url);
    const { target, hondi } = route(url);
    const headers = new Headers(request.headers);
    headers.delete('cookie'); headers.delete('host');
    // 원본(GitHub Pages)까지 매번 다녀오면 파일마다 0.4~2초가 걸린다. Cloudflare 엣지에 잠깐 캐시한다(사진·글꼴은 길게, 나머지는 2분).
    headers.delete('if-none-match'); headers.delete('if-modified-since'); headers.delete('range');
    const res = await fetch(target, { method: request.method, headers, redirect: 'manual', cf: { cacheEverything: true, cacheTtl: edgeTtl(url.pathname), cacheTtlByStatus: { '200-299': edgeTtl(url.pathname), '300-399': 0, '400-599': 0 } } });
    const out = new Headers(res.headers);
    out.delete('set-cookie');
    // 폰은 위에서 이동시키므로 여기까지 온 '/' 는 모두 PC 화면이다. 짧게만 브라우저에 둔다.
    if (url.pathname === '/') { out.set('Vary', 'User-Agent, Sec-CH-UA-Mobile'); out.set('Cache-Control', 'public, max-age=60'); }
    const loc = out.get('location');
    if (loc) out.set('location', loc.replace(APP_ORIGIN, '').replace(HONDI_ORIGIN, '/_h'));
    const ct = out.get('content-type') || '';
    if (hondi && ct.includes('text/html')) {
      // hondi.net 페이지 안의 루트 상대 경로(/pdv-store.js 등)를 /_h/ 아래로 돌린다.
      const fix = (attr) => ({ element(el) { const v = el.getAttribute(attr); if (v && v.startsWith('/') && !v.startsWith('//') && !v.startsWith('/_h/') && !HONDI_PREFIXES.some(x => v.startsWith(x))) el.setAttribute(attr, '/_h' + v); } });
      return new HTMLRewriter().on('script[src]', fix('src')).on('link[href]', fix('href')).on('a[href]', fix('href')).on('img[src]', fix('src')).transform(new Response(res.body, { status: res.status, headers: out }));
    }
    return new Response(res.body, { status: res.status, headers: out });
  },
};
