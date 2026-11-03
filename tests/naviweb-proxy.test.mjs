import test from 'node:test';
import assert from 'node:assert/strict';
import { route, isPhone } from '../ops/naviweb-proxy/worker.js';
import worker from '../ops/naviweb-proxy/worker.js';
const r = (p) => route(new URL('https://naviweb.kr' + p));
test('naviweb-proxy 라우팅', () => {
  assert.equal(r('/').target, 'https://mail.hondi.net/desktop.html');
  assert.equal(r('/manual.html?embed=mail').target, 'https://mail.hondi.net/manual.html?embed=mail');
  assert.deepEqual(r('/_h/pdv.html?embed=mail'), { target: 'https://hondi.net/pdv.html?embed=mail', hondi: true });
  assert.equal(r('/src/gopang/services/push.js').target, 'https://hondi.net/src/gopang/services/push.js');
  assert.equal(r('/icons/a.png').target, 'https://mail.hondi.net/icons/a.png');
});

import { readFileSync as _rf } from 'node:fs';
test('mail.hondi.net 직접 접속은 naviweb.kr 로 보낸다(desktop·webapp)', () => {
  for (const f of ['desktop.html', 'webapp.html']) {
    const s = _rf(new URL('../' + f, import.meta.url), 'utf8');
    assert.ok(s.includes("location.hostname === 'mail.hondi.net'"), f);
    assert.ok(s.includes("location.replace('https://naviweb.kr'"), f);
  }
});

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1';
const PIXEL = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/120.0 Mobile Safari/537.36';
const TABLET = 'Mozilla/5.0 (Linux; Android 14; SM-X710) AppleWebKit/537.36 Chrome/120.0 Safari/537.36';
const WIN = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0 Safari/537.36';
const ph = (path, h) => isPhone(new URL('https://naviweb.kr' + path), new Headers(h));
test('단말 판별: UA·클라이언트 힌트·?view=', () => {
  assert.equal(ph('/', { 'user-agent': IPHONE }), true);
  assert.equal(ph('/', { 'user-agent': PIXEL }), true);
  assert.equal(ph('/', { 'user-agent': TABLET }), false);
  assert.equal(ph('/', { 'user-agent': WIN }), false);
  assert.equal(ph('/', { 'user-agent': WIN, 'sec-ch-ua-mobile': '?1' }), true);
  assert.equal(ph('/', { 'user-agent': PIXEL, 'sec-ch-ua-mobile': '?0' }), false);
  assert.equal(ph('/?view=mobile', { 'user-agent': WIN }), true);
  assert.equal(ph('/?view=desktop', { 'user-agent': IPHONE }), false);
  assert.equal(ph('/', {}), false);
});
test('폰이 / 또는 /webapp.html 을 열면 hondi.net/webapp.html 로 이동(이동 없이 중계하지 않음)', async () => {
  for (const path of ['/', '/webapp.html']) {
    const res = await worker.fetch(new Request('https://naviweb.kr' + path, { headers: { 'user-agent': IPHONE } }));
    assert.equal(res.status, 302, path);
    assert.equal(res.headers.get('location'), 'https://hondi.net/webapp.html', path);
    assert.match(res.headers.get('vary'), /User-Agent/);
  }
  const pv = await worker.fetch(new Request('https://naviweb.kr/?view=mobile', { headers: { 'user-agent': WIN } }));
  assert.equal(pv.headers.get('location'), 'https://hondi.net/webapp.html?view=mobile');
});
test('desktop.html 의 안전망 분기는 hondi.net/webapp.html 로 보낸다', () => {
  const s = _rf(new URL('../desktop.html', import.meta.url), 'utf8');
  assert.ok(s.includes("location.replace('https://hondi.net/webapp.html'"));
});

// 나비 숫자 코드 칩: desktop.html 의 변환 함수가 hondi-digit-code.js 규칙과 같은 결과를 낸다.
test('desktop.html 에 나비 숫자 코드 칩이 있고 전화번호 변환이 맞다', () => {
  const s = _rf(new URL('../desktop.html', import.meta.url), 'utf8');
  assert.ok(s.includes('id="cmp-nabi-btn"') && s.includes("key: 'nabicode'") && !s.includes('id="nc-phone"'));
  const a = s.indexOf("const _NC_AREA"), b = s.indexOf('let _ncCur');
  assert.ok(a > 0 && b > a);
  const f = new Function(s.slice(a, b) + '; return _ncPhoneToDigits;')();
  assert.equal(f('064-980-1234').digits, '0649801234');
  assert.ok(f('02-123-4567').err); // 모듈 규칙: 지역번호+가입자번호 9~10자리
  assert.equal(f('02-1234-5678').digits, '0212345678');
  assert.equal(f('010-1234-5678').digits, '0012345678');
  assert.equal(f('+82 10 1234 5678').digits, '0012345678');
  assert.ok(f('099-123-4567').err);
  assert.ok(f('064-980').err);
  assert.ok(f('abc').err);
  assert.equal(f('').empty, true);
});

import { edgeTtl as _edgeTtl } from '../ops/naviweb-proxy/worker.js';
test('엣지 캐시 시간: 이미지·글꼴은 길게, 나머지는 짧게', () => {
  assert.equal(_edgeTtl('/icons/naviweb-logo.png'), 86400);
  assert.equal(_edgeTtl('/favicon.ico'), 86400);
  assert.equal(_edgeTtl('/guide.js'), 120);
  assert.equal(_edgeTtl('/'), 120);
});
