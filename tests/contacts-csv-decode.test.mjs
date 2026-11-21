// 주소록 CSV 업로드 — BOM 없는 UTF-8 한글 CSV 가 깨지지 않도록 글자 파일은 직접 해독한다(2026-11-21).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../desktop.html', import.meta.url), 'utf8');

test('_ctCsvFileSelected: .csv 는 UTF-8(엄격) → EUC-KR 순으로 해독해 type:string 으로 읽는다', () => {
  const i = html.indexOf('async function _ctCsvFileSelected');
  assert.ok(i > 0);
  const body = html.slice(i, i + 2500);
  assert.match(body, /new TextDecoder\('utf-8', \{ fatal: true \}\)/);
  assert.match(body, /new TextDecoder\('euc-kr'\)/);
  assert.match(body, /XLSX\.read\(text\.replace\(\/\^\\uFEFF\/, ''\), \{ type: 'string' \}\)/);
  assert.match(body, /XLSX\.read\(buf, \{ type: 'array' \}\)/);   // .xlsx/.xls 는 그대로
});

test('UTF-8 한글 헤더와 CP949 한글 헤더를 모두 되살린다', () => {
  const utf8 = new TextEncoder().encode('이름,이메일');
  assert.equal(new TextDecoder('utf-8', { fatal: true }).decode(utf8), '이름,이메일');
  const cp949 = Uint8Array.from([0xC0, 0xCC, 0xB8, 0xA7]);   // "이름"
  assert.throws(() => new TextDecoder('utf-8', { fatal: true }).decode(cp949));
  assert.equal(new TextDecoder('euc-kr').decode(cp949), '이름');
});
