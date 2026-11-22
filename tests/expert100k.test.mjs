import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { MAIL_FILES } from '../ops/naviweb-proxy/mail-paths.js';
const R = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');

test('10만 AI 전문가: 왼쪽 메뉴 항목이 안내 영상 아래에 있고 화면 전환 코드에 연결돼 있다', () => {
  const h = R('desktop.html');
  const yt = h.indexOf('id="tab-btn-youtube"'), ex = h.indexOf('id="tab-btn-expert100k"');
  assert.ok(yt > 0 && ex > yt, '메뉴 항목이 안내 영상 뒤에 있어야 한다');
  assert.match(h, /<button id="tab-btn-expert100k" class="nav-btn" data-label="10만 AI 전문가" onclick="_switchTab\('expert100k'\)">/);
  assert.ok(h.includes('<div id="tab-expert100k" class="tab-panel">'));
  assert.ok(h.includes("if (name === 'expert100k') _exSwitch("), '_switchTab 이 화면을 열 때 탭을 맞춘다');
  assert.ok(!/#tab-expert100k iframe/.test(h), 'iframe 스타일을 더 쓰지 않는다');
});

test('10만 AI 전문가: 위쪽 탭은 개요와 12개 분야이고, 탭 전환은 .wp-tab 전체를 훑어 새 탭을 더해도 고칠 곳이 없다', () => {
  const h = R('desktop.html');
  const panel = /<div id="tab-expert100k"[\s\S]*?<div id="expert100k-doc"/.exec(h)[0];
  const tabs = [...panel.matchAll(/class="wp-tab[^"]*" id="ex-tab-([a-z0-9]+)"/g)].map((m) => m[1]);
  assert.deepEqual(tabs, ['overview', 'law', 'medical', 'edu', 'finance', 'market', 'legis', 'judicial', 'admin', 'transport', 'logistics', 'culture', 'living']);
  assert.ok(panel.includes('>개요</button>'));
  assert.match(h, /const _EX_KEYS = \['overview', 'law'/);
  assert.ok(h.includes("document.querySelectorAll('#tab-expert100k .wp-tab')"));
});

test('10만 AI 전문가: 개요 문서의 배분 합계가 100,000명이고 묶음 소계·근거 비율이 맞는다', () => {
  const d = R('expert100k-overview.html');
  const rows = [...d.matchAll(/<tr data-g="([a-e])" data-n="(\d+)" data-b="(산식|단위|가정)">/g)].map((m) => ({ g: m[1], n: +m[2], b: m[3] }));
  assert.ok(rows.length >= 25);
  const total = rows.reduce((s, r) => s + r.n, 0);
  assert.equal(total, 100000);
  const by = (k, key) => rows.filter((r) => r[key] === k).reduce((s, r) => s + r.n, 0);
  for (const m of d.matchAll(/<tr class="sub" data-sub="([a-e])"><td>[^<]*<\/td><td class="num">([\d,]+)<\/td>/g)) {
    assert.equal(+m[2].replace(/,/g, ''), by(m[1], 'g'), '소계 ' + m[1]);
  }
  const pct = (k) => (by(k, 'b') / total * 100).toFixed(1) + '%';
  const line = /id="alloc-basis">([\s\S]*?)<\/td>/.exec(d)[1];
  for (const k of ['산식', '단위', '가정']) assert.ok(line.includes(pct(k)), k + ' 비율 ' + pct(k));
});

test('10만 AI 전문가: 개요 문서는 출처 10건을 갖고, 버린 용어(혼디)를 쓰지 않는다', () => {
  const d = R('expert100k-overview.html');
  assert.equal([...d.matchAll(/<li id="r\d+">/g)].length, 10);
  assert.ok(!d.includes('혼디'));
  assert.ok(d.includes('초안 v0.1'));
});

test('10만 AI 전문가: 개요 문서가 naviweb.kr 프록시의 mail 파일 목록(mail-paths.js)에 등록돼 있다', () => {
  assert.ok(MAIL_FILES.has('expert100k-overview.html'), '등록하지 않으면 naviweb.kr 에서 이 문서가 app 쪽으로 가 열리지 않는다');
});

test('10만 AI 전문가: 12개 분야 탭이 모두 분야 문서와 연결되고 각 분야에 필수 항목이 있다', () => {
  const h = R('desktop.html'), d = R('expert100k-doc.js');
  assert.ok(h.includes('id="expert100k-doc"') && !h.includes('expert100k-frame'), 'iframe 없이 화면에 바로 그린다');
  const keys = [...d.matchAll(/^(\w+):\{t:'([^']+)'/gm)].map((m) => m[1]);
  assert.deepEqual(keys, ['law', 'medical', 'edu', 'finance', 'market', 'legis', 'judicial', 'admin', 'transport', 'logistics', 'culture', 'living']);
  for (const k of keys) assert.ok(h.includes(`id="ex-tab-${k}"`), k + ' 탭');
  const body = d.split('var F = {')[1].split('var K =')[0];
  for (const f of ['def:', 'pain:', 'layers:', 'flow:', 'l3:', 'gate:', 'ref:', 'ask:']) assert.equal(body.split(f).length - 1, 12, f + ' 12개');
  assert.ok(!/혼디/.test(d));
  assert.ok([...MAIL_FILES].includes('expert100k-doc.js'));
});
