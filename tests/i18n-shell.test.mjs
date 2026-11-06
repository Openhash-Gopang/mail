import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
const R = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const LANGS = ['en', 'ja', 'zh', 'es', 'fr', 'de', 'vi', 'id'];
const dict = (l) => { const w = { NAVI_I18N: {} }; new Function('window', R(`i18n/${l}.js`))(w); return w.NAVI_I18N[l]; };

test('다국어: 상단 바 오른쪽에 언어·국가 선택 자리가 있고 언어 모듈을 머리에서 동기로 불러온다', () => {
  const h = R('desktop.html');
  assert.ok(h.includes('<div class="lp-host" id="lp-host"></div>'));
  assert.ok(h.indexOf('id="lp-host"') < h.indexOf('id="pricing-btn"'), '요금제 단추 앞');
  assert.ok(h.includes('<script src="assets/i18n.js"></script>'));
  assert.ok(h.indexOf('assets/i18n.js') < h.indexOf('</head>'));
  assert.match(h, /mountPicker\(host\)/);
  assert.match(h, /document\.addEventListener\('navi:locale'/);
});

test('다국어: 한국이 기본(태극기 + South Korea)이고, 버튼은 선택한 나라의 국기(시안 C) + 영어 국가 이름, 목록은 영어 이름만', () => {
  const j = R('assets/i18n.js');
  assert.match(j, /cur\.textContent = regionName\(state\.country, 'en'\)/);
  assert.match(j, /return \{ lang: 'en', country: 'US' \}/);   // 브라우저 언어를 모를 때만 영어
  assert.ok(j.includes('#cd2e3a') && j.includes('#0047a0'));
  const row = /id="' \+ id \+ '-o'[\s\S]*?<\/li>';/.exec(j)[0];
  assert.ok(!/flagHtml/.test(row), '목록 줄에는 국기가 없음');
  assert.ok(!/fromCodePoint/.test(j), '국기 이모지는 쓰지 않음(윈도우에서 글자로 보임)');
});

test('다국어: 서류 화면(iframe)에 언어·국가를 넘기고, 요청에는 출처를 확인해 답한다', () => {
  const h = R('desktop.html');
  assert.ok(h.includes("frame.src = u + '?embed=mail' + _i18nQuery()"));
  assert.ok(h.includes("type: 'navi-locale'") && h.includes("d.type !== 'navi-locale-request'"));
  assert.match(h, /naviweb\\\.kr\|hondi\\\.net/);
});

test('다국어: 사전 8개 언어가 모두 있고 서로 같은 문구를 가진다(번역 빠짐 없음)', () => {
  const en = dict('en');
  assert.ok(Object.keys(en).length >= 30);
  for (const l of LANGS) {
    assert.ok(existsSync(new URL(`../i18n/${l}.js`, import.meta.url)), l);
    const d = dict(l);
    assert.deepEqual(Object.keys(d).sort(), Object.keys(en).sort(), l);
    for (const [k, v] of Object.entries(d)) assert.ok(typeof v === 'string' && v.length, `${l}: ${k}`);
  }
});

test('다국어: 화면에 쓰는 왼쪽 메뉴·상단 바 문구가 영어 사전에 있다', () => {
  const en = dict('en'), h = R('desktop.html');
  const nav = h.slice(h.indexOf('<nav class="side-nav"'), h.indexOf('</nav>'));
  const need = new Set();
  for (const m of nav.matchAll(/>\s*([^<>]*[가-힣][^<>]*?)\s*(?:<|$)/g)) {
    const t = m[1].trim();
    if (t && !t.includes('${')) need.add(t);
  }
  const skip = new Set(['하위 메뉴 펼치기/접기']);
  const missing = [...need].filter((k) => !(k in en) && !skip.has(k));
  assert.deepEqual(missing, [], '영어 사전에 없는 왼쪽 메뉴 문구: ' + JSON.stringify(missing));
  for (const k of ['나비웹', '나비웹 ↗', '기능 개선 제안', '요금제', '나만의 AI 비서, 나비']) assert.ok(k in en, k);
});

test('다국어: 언어를 바꿔도 메뉴·상단 바 판단은 한국어 원문으로 한다(_topbarOwnText)', () => {
  const h = R('desktop.html');
  assert.ok(h.includes('.map(n => _i18nOrig(n)).join'));
  assert.ok(h.includes("const _ikey = label + '\\u0001' + _i18nLang();"));
});

test('다국어: 드롭다운에는 언어 버튼 줄이 없다(국가만 고르면 그 나라의 기본 언어)', () => {
  assert.ok(!/lp-langs|lp-chip/.test(R('assets/i18n.js') + R('desktop.html')));
});
