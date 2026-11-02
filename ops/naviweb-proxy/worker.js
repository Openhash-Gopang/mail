/**
 * naviweb-proxy — naviweb.kr 주소로 나비웹(mail.hondi.net 의 GitHub Pages)을 그대로 보여 주는 Cloudflare Worker.
 *
 *   naviweb.kr/            → mail.hondi.net/desktop.html
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
    const { target, hondi } = route(url);
    const headers = new Headers(request.headers);
    headers.delete('cookie'); headers.delete('host');
    const res = await fetch(target, { method: request.method, headers, redirect: 'manual' });
    const out = new Headers(res.headers);
    out.delete('set-cookie');
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
