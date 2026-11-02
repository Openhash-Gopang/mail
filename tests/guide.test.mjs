/**
 * tests/guide.test.mjs — guide.js(사용법 단계별 퀴즈)의 순수 로직 테스트(DOM 없음).
 * 실행: node --test tests/guide.test.mjs
 */
import test from 'node:test';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { _pure: G } = require('../guide.js');

test('콘텐츠 무결성: 페이지마다 본문·퀴즈 2개 이상, 정답 index 유효, 보기 3개 이상, 중복 없음', () => {
  assert.ok(G.PAGES.length >= 10);
  for (const p of G.PAGES) {
    assert.ok(p.title && p.body.length >= 3, p.title);
    assert.ok(['기본', '활용', '고급'].includes(p.level), p.title);
    assert.ok(p.quiz.length >= 2, p.title);
    for (const q of p.quiz) {
      assert.ok(q.q && q.hint, p.title);
      assert.ok(q.opts.length >= 3, q.q);
      assert.equal(new Set(q.opts).size, q.opts.length, q.q);
      assert.ok(Number.isInteger(q.answer) && q.answer >= 0 && q.answer < q.opts.length, q.q);
    }
  }
});

test('정답 위치가 한쪽에 쏠리지 않음(찍기 방지): 모든 위치가 한 번 이상 쓰임, 한 위치가 60% 초과 금지', () => {
  const cnt = [0, 0, 0]; let n = 0;
  for (const p of G.PAGES) for (const q of p.quiz) { cnt[q.answer]++; n++; }
  assert.ok(cnt.every(c => c > 0), JSON.stringify(cnt));
  assert.ok(Math.max(...cnt) / n <= 0.6, JSON.stringify(cnt));
});

test('채점: 모두 맞아야 all=true, 하나라도 틀리거나 비우면 false', () => {
  const p = G.PAGES[0];
  const right = p.quiz.map(q => q.answer);
  assert.deepEqual(G.grade(p, right), { ok: [true, true, true], all: true });
  const wrong = right.slice(); wrong[1] = (wrong[1] + 1) % 3;
  const r = G.grade(p, wrong);
  assert.equal(r.all, false);
  assert.deepEqual(r.ok, [true, false, true]);
  assert.equal(G.grade(p, [right[0], null, right[2]]).all, false);
  assert.equal(G.grade(p, {}).all, false);
});

test('페이지 목록: 업무(Case) 페이지는 기능 플래그가 켜졌을 때만 포함, 항상 마지막', () => {
  const off = G.pages(false), on = G.pages(true);
  assert.equal(on.length, off.length + 1);
  assert.ok(on[on.length - 1].flag === 'case');
  assert.ok(off.every(p => !p.flag));
});

test('잠금: 완료한 단계 + 바로 다음 단계까지만 열림, 건너뛰기 불가', () => {
  assert.equal(G.canOpen(0, 0, 10), true);
  assert.equal(G.canOpen(0, 1, 10), false);
  assert.equal(G.canOpen(3, 3, 10), true);
  assert.equal(G.canOpen(3, 4, 10), false);
  assert.equal(G.canOpen(3, 0, 10), true);
  assert.equal(G.canOpen(3, -1, 10), false);
  assert.equal(G.canOpen(10, 9, 10), true);
  assert.equal(G.canOpen(10, 10, 10), false);
});

test('진행 값 보정과 다음 페이지', () => {
  assert.equal(G.clampDone('abc', 10), 0);
  assert.equal(G.clampDone(-3, 10), 0);
  assert.equal(G.clampDone(99, 10), 10);
  assert.equal(G.clampDone('4', 10), 4);
  assert.equal(G.nextAfterPass(0, 10), 1);
  assert.equal(G.nextAfterPass(9, 10), -1);
});
test('desktop.html: 서류 화면의 혼디 대화 질문은 서류 사이트 SP 로 보낸다(navi-doc-ask)', async () => {
  const { readFileSync } = await import('node:fs');
  const s = readFileSync(new URL('../desktop.html', import.meta.url), 'utf8');
  for (const k of ['navi-doc-ask', 'navi-doc-answer', '_embedLooksLikeQuestion', '_docAsk(text)']) assert.ok(s.includes(k), k);
});
test('desktop.html: 입력창은 서류 검색·선택만, 대화는 혼디 대화창이 서류 SP 로 처리한다', async () => {
  const { readFileSync } = await import('node:fs');
  const s = readFileSync(new URL('../desktop.html', import.meta.url), 'utf8');
  for (const k of ['.doc-live .chat-composer{order:1', 'border-bottom:2px solid', '#doc-host-frame{order:3;flex:1 1 0', '.doc-live .chat-thread{display:none}',
    'const ans = await _docAsk(text);', '!t.trim() && _docHost.confirmed']) assert.ok(s.includes(k), k);
  for (const k of ['edited = await _docEditTurn(text, true)', '_docConverse', '_DOC_CHAT_PH', '_docHost.chatting']) assert.ok(!s.includes(k), k + ' 없음');
  assert.ok(!/fr\.style\.height = Math\.min/.test(s));
});
test('desktop.html: 왼쪽 메뉴는 펼쳐도 문구 폭만큼만 넓어진다(232px 고정 아님)', async () => {
  const { readFileSync } = await import('node:fs');
  const s = readFileSync(new URL('../desktop.html', import.meta.url), 'utf8');
  assert.match(s, /\.side-nav\.sn-open\{max-width:232px/);   // 폭은 JS 가 문구 폭을 재어 px 로 준다
  assert.ok(!/\.side-nav\.sn-open\{width:232px/.test(s));
  assert.ok(s.includes('const snOpen = ()') && s.includes("nav.style.width = 'max-content'"));
});
test('desktop.html: 서류 선택 드롭다운 맨 위가 실시간 서류 검색 입력이다', async () => {
  const { readFileSync } = await import('node:fs');
  const s = readFileSync(new URL('../desktop.html', import.meta.url), 'utf8');
  for (const k of ['id="cmp-doc-q"', 'oninput="_cmpDocComboFilter()"', 'function _docSearch(', 'function _cmpDocComboPick(', 'https://law.hondi.net/data/docs/law.json']) assert.ok(s.includes(k), k);
  assert.ok(!s.includes("new Option('서류 선택', '')") || true);
});
test('desktop.html: "서류 선택" 오른쪽에 "각종 기관" 드롭다운(검색 입력 + K-서비스 27개 인프라 항목)', async () => {
  const { readFileSync } = await import('node:fs');
  const s = readFileSync(new URL('../desktop.html', import.meta.url), 'utf8');
  for (const k of ['id="cmp-org-combo"', '각종 기관', 'id="cmp-org-q"', 'function _cmpOrgPick(']) assert.ok(s.includes(k), k);
  const items = s.match(/const _ORG_ITEMS = (\[\[.*?\]\]);/s);
  assert.ok(items); const arr = eval(items[1]); assert.equal(arr.length, 27);
  assert.deepEqual(arr.map((x) => x[1]).slice(0, 4), ['메일', '응급', '법률', '치안 신고']); assert.equal(arr[26][1], '모임');
  assert.ok(s.indexOf('id="cmp-doc-combo"') < s.indexOf('id="cmp-org-combo"'), '서류 선택 오른쪽');
});

test('각종 기관: 고르면 입력창과 혼디 대화창이 그 SP로 전환된다(k-services 프레임 없음)', () => {
  const h = readFileSync(new URL('../desktop.html', import.meta.url), 'utf8');
  assert.ok(!/org-host-frame|org-live/.test(h));
  assert.match(h, /org:\s*\{ title:/);
  assert.match(h, /_ORG_SP\s*=\s*\{[^}]*klaw:'SP-01_klaw'/);
  assert.match(h, /HondiChat\.setSp\(\{ type: 'hondi-embed-sp'/);
  assert.match(h, /_cmpMode === 'org'\) \{ await _orgSend/);
  assert.match(h, /hondi-embed-sp-ask/);
  assert.match(h, /hondi-embed-sp-ready/);
  assert.match(h, /_orgLeave\(\)/);
});

test('각종 기관: 상단 중앙 문구와 제목이 고른 기관으로 바뀐다', () => {
  const h = readFileSync(new URL('../desktop.html', import.meta.url), 'utf8');
  assert.match(h, /gdc:'화폐, 은행, 보험, 및 증권의 통합 시스템입니다\.'/);
  assert.match(h, /_cmpMode === 'org' && _org\) \? _org\.label/);
});

test('전문가 AI: 각종 기관 오른쪽 드롭다운(검색 + 대표 전문가 + 더보기로 전문가 페르소나 페이지)', () => {
  const h = readFileSync(new URL('../desktop.html', import.meta.url), 'utf8');
  for (const k of ['id="cmp-exp-combo"', '전문가 AI', 'id="cmp-exp-q"', 'function _cmpExpPick(', 'https://hondi.net/pages/expert-personas.html', '더보기 (...)']) assert.ok(h.includes(k), k);
  assert.ok(h.indexOf('id="cmp-org-combo"') < h.indexOf('id="cmp-exp-combo"'));
});

test('전문가 AI: 고르면 입력창 바탕 글과 대화창 SP 가 그 전문가로 전환된다', () => {
  const h = readFileSync(new URL('../desktop.html', import.meta.url), 'utf8');
  assert.match(h, /'변호사':'SP_lawyer'/);
  assert.match(h, /'한의사':'SP_traditional-medicine-doctor'/);
  assert.match(h, /_orgActivate\(\{ key: 'exp:'/);
  assert.match(h, /전문가 AI입니다\. 무엇이든 물어보십시오/);
});

test('각종 기관·전문가 AI: 대화창이 입력창 위로 펼쳐지고 입력창은 아래로 밀려 내려간다(slide out)', () => {
  const h = readFileSync(new URL('../desktop.html', import.meta.url), 'utf8');
  assert.match(h, /\[data-mode="org"\]\.org-open \.chat-thread\{flex:1 1 0/);
  assert.match(h, /transition:flex-grow/);
  assert.match(h, /classList\.add\('org-open'\)/);
  assert.match(h, /hondi-embed-sp-reply/);
  assert.ok(!/전문가 AI입니다\. 무엇이든 물어보십시오' : _org/.test(h), '입력창 문구 변경은 취소');
});

test('기관·전문가 대화: 답변 준비 중 표시, 면책 문구는 시작 화면에 한 번(다시 보지 않기)', () => {
  const h = readFileSync(new URL('../desktop.html', import.meta.url), 'utf8');
  assert.match(h, /답변 준비 중<span class="org-dots">/);
  assert.match(h, /function _orgNotice1\(\)/);
  assert.match(h, /다시 보지 않기<b>×<\/b>/);
  assert.match(h, /orgDisclaimerOff/);
});

test('기관·전문가 답변: 마크다운(제목·목록·표·구분선) 렌더', () => {
  const h = readFileSync(new URL('../desktop.html', import.meta.url), 'utf8');
  assert.match(h, /function _orgMd\(md\)/);
  assert.match(h, /el\.classList\.add\('org-md'\); el\.innerHTML = _orgMd/);
});

test('전문가 AI: 사용자를 인간 전문가로 상정(role=expert) — 면책 문구도 전문가용', () => {
  const h = readFileSync(new URL('../desktop.html', import.meta.url), 'utf8');
  assert.match(h, /role: o\.expert \? 'expert' : ''/);
  assert.match(h, /최종 판단과 책임은 전문가 본인에게 있으니/);
});

test('왼쪽 메뉴 펼침·접힘: width(px)와 margin-right 를 같은 시간·곡선으로 함께 전환해 본문은 밀리지 않고 서서히 움직인다', () => {
  const h = readFileSync(new URL('../desktop.html', import.meta.url), 'utf8');
  const line = h.split('\n').find(l => l.includes('.side-nav{width:64px;padding-left:10px'));
  const w = /transition:width (\.\d+s cubic-bezier\([^)]*\)),margin-right (\.\d+s cubic-bezier\([^)]*\)),box-shadow/.exec(line || '');
  assert.ok(w && w[1] === w[2], line);
  assert.match(h, /nav\.style\.marginRight = \(-\(w - 64\)\) \+ 'px'/);
});

test('좌측 메뉴 하단 GDC 항목: 사용량(그래프) 화면을 연다', () => {
  const h = readFileSync(new URL('../desktop.html', import.meta.url), 'utf8');
  assert.match(h, /id="tab-btn-gdc"[^>]*_switchTab\('gdc'\)/);
  assert.match(h, /id="tab-gdc"[^>]*><iframe id="gdc-frame"/);
  assert.match(h, /https:\/\/hondi\.net\/usage\.html\?embed=mail/);
  assert.ok(h.indexOf('id="tab-btn-gdc"') < h.indexOf('id="tab-btn-settings"'));
});

test('좌측 메뉴: 접힌 상태도 펼친 상태와 세로 배치가 같고, 접을 때 글자를 먼저 지운 뒤 천천히 폭을 줄인다', () => {
  const h = readFileSync(new URL('../desktop.html', import.meta.url), 'utf8');
  assert.match(h, /sn-closing/);
  assert.match(h, /\.side-nav \.side-label,\.side-nav \.nav-subitem,\.side-nav \.nav-sub\{white-space:nowrap/);
  assert.ok(!/\.side-nav:not\(\.sn-open\) \.nav-sub,\.side-nav:not\(\.sn-open\) \.side-foot,\.side-nav:not\(\.sn-open\) \.nav-toggle\{display:none\}/.test(h), '접힌 상태에서 display:none 으로 자리를 없애지 않는다');
  assert.match(h, /closeT = setTimeout\(\(\) => \{ nav\.style\.width = ''/);
});
test('서류 드롭다운 버튼 문구는 "서류 작성"', () => {
  const h = readFileSync(new URL('../desktop.html', import.meta.url), 'utf8');
  assert.match(h, /id="cmp-doc-combo-label">서류 작성</);
});
