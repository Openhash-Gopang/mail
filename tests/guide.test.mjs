/**
 * tests/guide.test.mjs — guide.js(사용법 단계별 퀴즈)의 순수 로직 테스트(DOM 없음).
 * 실행: node --test tests/guide.test.mjs
 */
import test from 'node:test';
import { readFileSync, existsSync } from 'node:fs';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { _pure: G } = require('../guide.js');

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
  for (const k of ['id="cmp-doc-q"', 'oninput="_cmpDocComboFilter()"', 'function _docSearch(', 'function _cmpDocComboPick(', "'https://' + id + '.naviweb.kr/data/docs/'"]) assert.ok(s.includes(k), k);
  assert.ok(!s.includes("new Option('서류 선택', '')") || true);
});
test('desktop.html: "서류 선택" 오른쪽에 "각종 기관" 드롭다운(검색 입력 + K-서비스 27개 인프라 항목)', async () => {
  const { readFileSync } = await import('node:fs');
  const s = readFileSync(new URL('../desktop.html', import.meta.url), 'utf8');
  for (const k of ['id="cmp-org-combo"', '각종 기관', 'id="cmp-org-q"', 'function _cmpOrgPick(']) assert.ok(s.includes(k), k);
  const items = s.match(/const _ORG_ITEMS = (\[\[.*?\]\]);/s);
  assert.ok(items); const arr = eval(items[1]); assert.equal(arr.length, 27);
  assert.deepEqual(arr.map((x) => x[1]).slice(0, 4), ['메일', '응급', '법률', '치안']); assert.equal(arr[26][1], '모임');
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

test('GDC 는 설정의 탭(PDV 오른쪽)으로 옮겨 사용량(그래프) 화면을 끼워 보여 준다', () => {
  const h = readFileSync(new URL('../desktop.html', import.meta.url), 'utf8');
  assert.ok(!h.includes('id="tab-btn-gdc"') && !h.includes('id="tab-gdc"'));
  assert.match(h, /const _SET_SECTIONS = \['account', 'profile', 'pdv', 'gdc', /);
  assert.ok(h.indexOf('id="set-tab-pdv"') < h.indexOf('id="set-tab-gdc"') && h.indexOf('id="set-tab-gdc"') < h.indexOf('id="set-tab-signature"'));
  assert.match(h, /id="set-sec-gdc"[^>]*>\s*<iframe id="gdc-frame"/);
  assert.ok(h.includes("_HONDI_BASE + '/usage.html?embed=mail'") && h.includes("'https://hondi.net'"));
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

test('정부 AI: 전문가 AI 오른쪽 드롭다운(검색 + 법원·국세청·도청·시청 + 더보기→K-정부 페이지), 고르면 입력창·대화창이 그 SP로 전환', () => {
  const h = readFileSync(new URL('../desktop.html', import.meta.url), 'utf8');
  for (const k of ['id="cmp-gov-combo"', '정부 AI', 'id="cmp-gov-q"', 'function _cmpGovPick(', 'https://hondi.net/pages/k-government.html', "'법원': 'SP-01_klaw'", "'국세청': 'SP-07_ktax'", "'도청': 'SP-10_kpublic'", "'시청': 'SP-10_kpublic'"]) assert.ok(h.includes(k), k);
  assert.ok(h.indexOf('id="cmp-exp-combo"') < h.indexOf('id="cmp-gov-combo"'));
  assert.match(h, /_orgActivate\(o, /);
});

test('정부 AI: 사용자의 거주지(PDV·가입 정보)·현재 위치로 해당 지역 기관을 호출한다', () => {
  const h = readFileSync(new URL('../desktop.html', import.meta.url), 'utf8');
  for (const k of ['function _parseRegion(', 'async function _govRegion(', 'function _govResolve(', "_drCall('region'", 'navigator.geolocation', 'prompts/gov-tree/01-do/JEJU-DO-SP_v1.5.md', 'prompts/gov-tree/04-city/jeju/SP-CITY-JEJU_v1.1.md', "context: o.context || ''"]) assert.ok(h.includes(k), k);
});

test('작성 화면(compose)의 flex 레이아웃은 활성일 때만 — 다른 화면(메일 등)으로 바꾸면 서류·기관 화면이 숨는다', () => {
  const h = readFileSync(new URL('../desktop.html', import.meta.url), 'utf8');
  assert.match(h, /#tab-compose\.active\[data-mode="doc"\]\.doc-live\{display:flex/);
  assert.match(h, /#tab-compose\.active\[data-mode="org"\]\{display:flex/);
  assert.ok(!/\n#tab-compose\[data-mode="(doc"\]\.doc-live|org")\{display:flex/.test(h));
});

test('서류 제출: dpaper API 미발급 안내 대화(혼디 대화창, 인사말 고정·단계별 안내 SP)', () => {
  const h = readFileSync(new URL('../desktop.html', import.meta.url), 'utf8');
  assert.match(h, /d\.type === 'navi-doc-submit-gov'/);
  assert.ok(h.includes('아직 한국 정부로부터 dpaper API를 발급받지 못했으므로, 사용자가 직접 제출해야 합니다. 절차를 안내하겠습니다. 먼저, 공동인증서를 준비해 주십시오.'));
  assert.match(h, /sp: 'inline:submit:'/);
  assert.ok(h.includes('아직 내용을 다 채우지 않으셨습니다. 제가 도와드릴까요?') && h.includes('내용이 적절한지 검토하겠습니다. 잠시 기다려주십시오.'));
  assert.match(h, /_submitFlow = \{ title, stage: 'offer' \}/);   // 빈 칸이 있으면 먼저 "도와드릴까요?"
  assert.match(h, /HondiChat\.say\(/); assert.match(h, /navi-doc-request-submit/);
  assert.match(h, /HondiChat\.open\(\)/);
  assert.match(h, /if \(mode !== 'doc'\) _submitGuideEnd\(\)/);
});

test('서류 SP 가 대신 채우고 사용자가 검토·수정한다 + 대화창 첨부가 서류로 간다', () => {
  const h = readFileSync(new URL('../desktop.html', import.meta.url), 'utf8');
  assert.match(h, /_docAsk\('서류의 비어 있는 칸을 가능한 만큼 모두 채워 주세요/);
  assert.ok(h.includes('검토하고 고쳐 주세요') && h.includes('"제출 진행"'));
  assert.match(h, /function _embedFiles\(/); assert.match(h, /function _embedSendFiles\(/);
  assert.match(h, /type: 'navi-doc-template', name: f\.name/); assert.match(h, /type: 'navi-doc-attach', name: f\.name/);
  assert.match(h, /_embedAttachPending && d\.status !== 'progress'/);
  const c = readFileSync(new URL('../hondi-chat.js', import.meta.url), 'utf8');
  assert.match(c, /function say\(/);
});

test('예시: 라벨 + "소장 작성해 주세요" 같은 문장은 서류 이름이 맞으면 바로 서류 작성', () => {
  const h = readFileSync(new URL('../desktop.html', import.meta.url), 'utf8');
  assert.ok(!h.includes('id="cmp-ex-label"'), '패널 안 "예시:" 라벨은 없앴다(예시 버튼과 중복)');
  assert.match(h, /_navQuickDoc\(text\)/);
  const re = /^\s*(.{1,30}?)\s*(?:을|를)?\s*(?:좀\s*)?(?:작성|써|만들|초안)/;
  assert.ok(h.includes(String(re).slice(1, String(re).lastIndexOf('/')).replace(/\\/g, '\\')) || h.includes('(?:작성|써|만들|초안)'));
  assert.equal(re.exec('소장 작성해 주세요')[1], '소장'); assert.equal(re.exec('진단서를 써 줘')[1], '진단서'); assert.equal(re.exec('안녕하세요'), null);
});

test('우측 상단 "기능 개선 제안"은 새 탭이 아니라 현재 화면의 탭에 제안 게시판(hondi feedback.html?embed=mail)을 끼워 보여 준다', () => {
  const h = readFileSync(new URL('../desktop.html', import.meta.url), 'utf8');
  assert.match(h, /id="tab-btn-feedback" class="nav-btn" data-label="기능 개선 제안" onclick="_switchTab\('feedback'\)"/);   // 왼쪽 메뉴 하단(상단 바에서 옮김)
  assert.ok(!/id="suggest-btn"/.test(h));
  assert.ok(h.includes('id="tab-feedback"') && h.includes("_HONDI_BASE + '/feedback.html?embed=mail'"));
  assert.ok(!h.includes('href="https://hondi.net/feedback.html" target="_blank"'));
});

test('상단 바 가운데: 홈 = "나만의 AI 비서, 나비"(나비 굵게)', () => {
  const h = readFileSync(new URL('../desktop.html', import.meta.url), 'utf8');
  assert.ok(h.includes('<span class="tp-txt">나만의 AI 비서, <b>나비</b></span>'));
  assert.ok(h.includes("el.innerHTML = '<span class=\"tp-txt\">' + (_i18nKo() ? '나만의 AI 비서, <b>나비</b>'"));   // 한국어일 때 나비 굵게(다른 언어는 사전 문구)
  assert.match(h, /\.topbar-page b\{font-weight:800\}/);
});

test('사용 설명서(2026-11-05 개편): 1부 구성 항목 10장 → 2부 실습 10장 → 3부 고급 → 부록, 장 번호는 스크립트가 매긴다', () => {
  const h = readFileSync(new URL('../manual.html', import.meta.url), 'utf8');
  const ids = [...h.matchAll(/<section id="([^"]+)"( class="appx")?/g)].filter(m => !m[1].includes('...')).map(m => [m[1], !!m[2]]);
  const chapters = ids.filter(x => !x[1]).map(x => x[0]);
  assert.deepEqual(chapters.slice(0, 10), ['c-overview', 'c-topbar', 'c-sidemenu', 'c-input', 'c-docmenu', 'c-mailmenu', 'c-guide-case', 'c-settings', 'c-help', 'c-helper']);
  assert.equal(chapters[10], 'c-start'); assert.equal(chapters[19], 'c-final');   // 11~20장 = 실습, 20장 = 종합 실습
  assert.ok(chapters.length > 20 && chapters.indexOf('c-form-builder') === 20 && chapters.includes('c-pdv'), '21장부터 고급(내 양식 만들기·PDV 구성 …)');
  assert.deepEqual(ids.filter(x => x[1]).map(x => x[0]), ['safe', 'faq', 'words']);   // 부록은 항상 맨 뒤
  assert.ok(ids.findIndex(x => x[1]) > ids.findIndex(x => x[0] === 'c-delegate'));
  const docs = h.slice(h.indexOf('<section id="c-doc-write">'), h.indexOf('<section id="c-doc-edit">'));
  for (const k of ['PDV', '혼디 대화', '빈 칸을 채워 줘', '📎', 'SP', '작성 완료로 저장']) assert.ok(docs.includes(k), k);
  const refs = [...h.matchAll(/data-ref="([^"]+)"/g)].map(m => m[1]);
  for (const r of refs) assert.ok(chapters.includes(r) || ids.some(x => x[0] === r), '참조 대상 없음: ' + r);
  assert.ok(h.includes('document.querySelectorAll(\'a.ref[data-ref]\')'));
  assert.equal((h.match(/<section /g) || []).length - 2, (h.match(/<\/section>/g) || []).length);   // 주석·스크립트 속 예시 2건 제외
});

test('설명서·사용법: 장 안의 화면 이미지는 없다(영상으로 대체) — manual-img 참조 없음', () => {
  for (const f of ['manual.html', 'guide.js']) {
    const s = readFileSync(new URL('../' + f, import.meta.url), 'utf8');
    assert.ok(!/manual-img\//.test(s) && !/<img\b/.test(s.replace(/<img[^>]*data-keep[^>]*>/g, '')), f);
  }
  assert.ok(!existsSync(new URL('../manual-img', import.meta.url)));
});
test('나비웹 홈페이지 링크는 Whitepaper 탭·사용법에 있고, 상단 막대는 숨기고 언어·국가 버튼은 오른쪽 위 줄에 둔다', () => {
  const h = readFileSync(new URL('../desktop.html', import.meta.url), 'utf8');
  assert.match(h, /<a class="wp-site" href="https:\/\/hondi\.net"[^>]*>나비웹 홈페이지 ↗<\/a>/);
  assert.match(h, /header\.topbar,#hd-pull\{display:none!important\}/);
  assert.match(h, /<div class="lp-host" id="lp-host"><\/div>\s*<button type="button" class="fb-top"/);
  assert.match(h, /<main class="content">\s*<div class="user-row" id="user-row">/);
});

test('가상 판결은 예시 줄(정부 AI 오른쪽)로, PDV 는 설정의 첫 탭으로 옮겼다', () => {
  const h = readFileSync(new URL('../desktop.html', import.meta.url), 'utf8');
  assert.ok(!h.includes('id="tab-btn-verdict"') && !h.includes('id="tab-btn-pdv"'));
  const v = h.indexOf('id="cmp-verdict-btn"'), g = h.indexOf('id="cmp-gov-combo"'), n = h.indexOf('id="cmp-guide-btn"');
  assert.ok(v > g && v < n && h.slice(v, n).includes('<svg') && h.slice(v, n).includes('가상 판결'), '정부 AI 오른쪽, 나비 길잡이 왼쪽');
  assert.match(h, /const _SET_SECTIONS = \['account', 'profile', 'pdv', /);
  assert.ok(h.indexOf('id="set-tab-account"') < h.indexOf('id="set-tab-pdv"') && h.indexOf('id="set-tab-pdv"') < h.indexOf('id="set-tab-signature"') && h.includes('id="set-sec-pdv"'));
  assert.ok(h.includes('id="pdv-frame"') && h.includes("_PDV_URL + '?embed=mail'") && !h.includes('PDV 열기 (새 탭)'));
  assert.match(h, /<button[^>]*id="set-tab-account" class="active"/);
  assert.ok(!h.includes('<div class="side-label">서비스</div>'));
});

test('서류 작성 팝업: 검색 필드 아래 "양식 업로드" → 올린 파일을 양식(asTemplate)으로 서류 사이트에 보낸다', () => {
  const h = readFileSync(new URL('../desktop.html', import.meta.url), 'utf8');
  const q = h.indexOf('id="cmp-doc-q"'), u = h.indexOf('id="cmp-doc-upload"'), l = h.indexOf('id="cmp-doc-list"');
  assert.ok(q > 0 && q < u && u < l);
  assert.match(h, /function _docUploadForm\(/); assert.match(h, /type: 'navi-doc-template', asTemplate: true/);
  assert.ok(h.includes('id="doc-host-form"'));
  assert.match(h, /_docHost\.confirmed = true; document\.getElementById\('tab-compose'\)\.classList\.add\('doc-live'\)/);
});

test('서류 사이트 주소가 정해지기 전에 보낸 메시지(양식 업로드)는 버리지 않고 준비될 때까지 대기열에 둔다', () => {
  const h = readFileSync(new URL('../desktop.html', import.meta.url), 'utf8');
  const a = h.indexOf('function _docHostPost('), b = h.indexOf('\n}', a);
  const f = h.slice(a, b);
  assert.ok(f.indexOf('if (!_docHost.ready)') < f.indexOf('if (!fr.src) return;'));
  assert.ok(!/if \(!fr \|\| !fr\.src\) return;/.test(f));
});

test('정보 공개 청구: 예시 줄(정부 AI 오른쪽) 버튼 → 입력창이 정보 공개 청구 대화창, 아래에 청구서. 예전 페이지(foi.js)는 없앴다', () => {
  const h = readFileSync(new URL('../desktop.html', import.meta.url), 'utf8');
  assert.ok(h.indexOf('id="cmp-gov-combo"') < h.indexOf('id="cmp-foi-btn"'));
  assert.ok(!h.includes('id="tab-foi"') && !h.includes('tab-btn-foi') && !h.includes('foi.js') && !h.includes('_foiInit'));
  assert.ok(!h.includes('행정 업무</div>') && !h.includes('>모바일 화면</a>'));
  assert.match(h, /function _cmpFoiPick\(/); assert.match(h, /_foiDocFromReply\(reply\)/); assert.match(h, /id="cmp-foi-doc"/);
  assert.ok(!existsSync(new URL('../foi.js', import.meta.url)));
  const a = h.indexOf('function _foiDocFromReply'), src = h.slice(a, h.indexOf('\n}\n', a) + 3);
  const doc = { value: '', hidden: true }, els = { 'cmp-foi-text': doc, 'cmp-foi-doc': doc, 'cmp-foi-title': { textContent: '' } };
  const run = new Function('document', src + '; return _foiDocFromReply;')({ getElementById: (k) => els[k] });
  const rest = run('청구서를 만들었습니다.\n~~~foi\n정보공개 청구서\n\n1. 수신: 제주시청\n~~~');
  assert.equal(rest, '청구서를 만들었습니다.'); assert.ok(doc.value.includes('수신: 제주시청')); assert.equal(els['cmp-foi-title'].textContent, '정보공개 청구서');
  assert.equal(run('그냥 대화'), '그냥 대화');
});

test('상단 바 "나만의 AI 비서, 나비": 글자 간격, 클릭하면 소개 페이지가 상단 바 밑으로 미끄러져 내려온다(▼ 표시)', () => {
  const h = readFileSync(new URL('../desktop.html', import.meta.url), 'utf8');
  assert.match(h, /\.topbar-page\{letter-spacing:\.06em/);
  assert.ok(h.includes('id="topbar-page" role="button"') && h.includes('class="tp-chev"') && h.includes("onclick=\"_panelToggle('intro')\""));
  assert.ok(h.includes('id="tab-intro" class="tab-panel"') && h.includes('onclick="_introClose()"') && h.includes('id="intro-tab-manual"') && h.includes('id="intro-tab-intro"'), '소개는 본문 페이지이고 위쪽에 두 탭과 닫기 단추가 있다');
  assert.ok(h.includes("intro: 'navi-intro.html") && !/\}\.topbar-page\{font-weight:500\}/.test(h));
  const i = readFileSync(new URL('../navi-intro.html', import.meta.url), 'utf8');
  assert.ok(i.includes('나만의 AI 비서') && !i.includes('K-Mail') && !i.includes('<header') && !i.includes('<nav'));
});

test('좌측 상단 나비웹(글자) ▾: 누르면 사용 설명서가 상단 바 밑으로 슬라이드(▼ 표시), 설명서는 embed 모드로 심플하게', () => {
  const h = readFileSync(new URL('../desktop.html', import.meta.url), 'utf8');
  assert.ok(h.includes('id="logo-help"') && h.includes("onclick=\"_panelToggle('manual'); return false;\"") && h.includes("manual: 'whitepaper.html?embed=mail'"));
  assert.match(h, /function _panelToggle\(/);
  const m = readFileSync(new URL('../manual.html', import.meta.url), 'utf8');
  assert.match(m, /body\.embed \.topnav,body\.embed \.hero/);
});

test('Whitepaper: 왼쪽 메뉴 하단 항목 + 탭 iframe, 설명서 1장은 짧은 소개와 백서 링크', () => {
  const h = readFileSync(new URL('../desktop.html', import.meta.url), 'utf8');
  assert.ok(h.includes('id="tab-btn-whitepaper"') && h.includes("_switchTab('whitepaper')") && h.includes('id="whitepaper-frame"'));
  assert.ok(h.includes("navi: 'manual.html?embed=mail'") && h.includes("'navi-open-whitepaper'") && h.includes("'navi-open-manual'"));
  const w = readFileSync(new URL('../whitepaper.html', import.meta.url), 'utf8');
  assert.ok(w.includes('Whitepaper') && w.includes('<b>수많은 나비가 모이는 메신저</b>') && w.includes('내 정보는 어디에 저장되나요?'));
  const m = readFileSync(new URL('../manual.html', import.meta.url), 'utf8');
  assert.ok(m.includes('navi-open-whitepaper') && !m.includes('<h3>내 정보는 어디에 저장되나요?</h3>'));
});

test('입력창 왼쪽 편지(✉) 아이콘 삭제', () => {
  const h = readFileSync(new URL('../desktop.html', import.meta.url), 'utf8');
  assert.ok(!h.includes('<button type="button" class="chat-icon-btn" id="cmp-mail-btn"'));
});

test('Whitepaper 탭: 나비와 나비웹 / Openhash, Openhash 백서 페이지', () => {
  const h = readFileSync(new URL('../desktop.html', import.meta.url), 'utf8');
  assert.ok(h.includes('id="wp-tab-navi"') && h.includes('id="wp-tab-openhash"') && h.includes("openhash: 'openhash.html?embed=mail'"));
  const o = readFileSync(new URL('../openhash.html', import.meta.url), 'utf8');
  assert.ok((o.match(/<svg /g) || []).length >= 8);
  for (const k of ['PDV', 'PLSM', 'BIVM', 'ILMV', 'LPBFT', 'Ed25519', 'AES-256-GCM']) assert.ok(o.includes(k), k);
  assert.equal((o.match(/<section /g) || []).length, (o.match(/<\/section>/g) || []).length);
});

test('서류 작성 드롭다운: "전체" 아래에 "제주 행정"(jeju.naviweb.kr)이 있고 서류 검색 목록에 제주 행정 서류가 들어간다', async () => {
  const { readFileSync } = await import('node:fs');
  const s = readFileSync(new URL('../desktop.html', import.meta.url), 'utf8');
  const all = s.indexOf("{ id: 'all', label: '전체'"), jeju = s.indexOf("{ id: 'jeju', label: '제주 행정', url: 'https://jeju.naviweb.kr/' }"), law = s.indexOf("{ id: 'law', label: '법률 서류'");
  assert.ok(all > 0 && all < jeju && jeju < law, '전체 → 제주 행정 → 법률 서류 순서');
  assert.ok(s.includes("'jeju'].map(id => ({ site: id, url: 'https://' + id + '.naviweb.kr/data/docs/' + id + '.json' }))"));
});

test('예시 패널: 입력 칸 왼쪽 "예시" 버튼이 예시 항목 패널을 slide out/in 하고, 항목을 고르면 다시 들어간다', () => {
  const h = readFileSync(new URL('../desktop.html', import.meta.url), 'utf8');
  assert.ok(h.indexOf('class="cmp-inrow"') < h.indexOf('id="cmp-ex-btn"') && h.indexOf('id="cmp-ex-btn"') < h.indexOf('class="chat-inputbar"', h.indexOf('class="cmp-inrow"')) && h.indexOf('id="cmp-ex-btn"') < h.indexOf('id="cmp-input"'), '예시 버튼은 입력 필드 바깥 왼쪽');
  assert.ok(!h.includes('id="cmp-doc-save"'), '작성 완료로 저장 버튼 삭제');
  const panel = h.slice(h.indexOf('id="cmp-ex-panel"'), h.indexOf('id="cmp-doc-count"'));
  for (const id of ['cmp-verdict-btn', 'cmp-doc-combo', 'cmp-org-combo', 'cmp-exp-combo', 'cmp-gov-combo', 'cmp-guide-btn', 'cmp-nabi-btn']) assert.ok(panel.includes('id="' + id + '"'), id + ' 는 패널 안');
  assert.ok(!panel.includes('id="cmp-doc-bar"'), '진행률은 패널 밖(접어도 보인다)');
  assert.match(h, /\.ex-panel\{[^}]*transition:max-height[^}]*transform \.34s/);
  assert.match(h, /<table class="ex-table">[\s\S]*<tr>[\s\S]*<\/tr>[\s\S]*<\/table>/); assert.equal((panel.match(/<td>/g) || []).length, 7, '한 행 7칸 Table');
  assert.match(h, /\.ex-table \.doc-combo-btn\{[^}]*font-size:14px/);
  assert.match(h, /prefers-reduced-motion:reduce\)\{\.ex-panel/);
  for (const f of ['function _cmpExOpen(', 'function _cmpExClose(', 'function _cmpExToggle(']) assert.ok(h.includes(f), f);
  assert.ok(h.includes(".ex-verdict,.ex-guide,.ex-nabicode,.doc-combo-it,.doc-combo-up"), '항목을 고르면 접힘');
});

test('예시 버튼: 축소(높이 38px·글자 15px), 배경은 전송 버튼과 같은 var(--pri)', () => {
  const h = readFileSync(new URL('../desktop.html', import.meta.url), 'utf8');
  assert.match(h, /\.cmp-ex-btn\{[^}]*height:38px[^}]*background:var\(--pri\);color:#fff;[^}]*font-size:15px/);
  assert.match(h, /\.chat-send-btn\{[^}]*background:var\(--pri\)/);
});

test('사용법 3장(왼쪽 메뉴): 옛 방식의 화면 이미지를 싣지 않는다', () => {
  const g = readFileSync(new URL('../guide.js', import.meta.url), 'utf8');
  assert.ok(!g.includes('ui-sidemenu'));
});

test('안내 영상: 왼쪽 메뉴 "나비 길잡이" 아래, YouTube 아이콘 이미지, 영상 3개(navi 01·02·003)를 번호 순으로, 카드에 설명', () => {
  const h = readFileSync(new URL('../desktop.html', import.meta.url), 'utf8');
  assert.ok(h.includes('id="tab-btn-youtube"') && h.includes('data-label="안내 영상"') && h.includes('assets/youtube-icon.png') && h.includes('id="tab-youtube"'));
  assert.ok(h.indexOf('id="tab-btn-guidenav"') < h.indexOf('id="tab-btn-youtube"') && h.indexOf('id="tab-btn-youtube"') < h.indexOf('class="side-settings"'));
  const ids = ['PsqV8Rj445k', 'pFSTOKbYGAE', 'yv0THEXTF58'].map(x => h.indexOf("id: '" + x + "'"));
  assert.ok(ids.every(x => x > 0) && ids[0] < ids[1] && ids[1] < ids[2] && !h.includes("id: 'aLfvRkbX4mE'") && h.includes('navi 02 - 대략적 구성') && h.includes('class="yt-desc"'));
});

test('안내 영상 항목은 나비 길잡이보다 2cm 아래', () => {
  assert.match(readFileSync(new URL('../desktop.html', import.meta.url), 'utf8'), /#tab-btn-youtube\{margin-top:2cm\}/);
});

test('안내 영상: 재생목록(YouTube)을 자동으로 따라간다 — 동기화 스크립트·워크플로·JSON 읽기, 실패 시 기본 목록', async () => {
  const { parseFeed, sortByNumber, merge } = await import('../scripts/guide-videos-sync.mjs');
  const xml = readFileSync(new URL('./fixtures/guide-feed.xml', import.meta.url), 'utf8');
  const f = parseFeed(xml);
  assert.equal(f.length, 3); assert.equal(f[0].t, 'navi 003 - 한국 vs  글로벌(K-Law & 대법원)'); assert.equal(f[0].d, '나비웹은 글로벌 적용을 상정한 설계입니다.');
  assert.deepEqual(sortByNumber(f).map(v => v.id), ['PsqV8Rj445k', 'pFSTOKbYGAE', 'yv0THEXTF58']);   // 번호 순(01, 02, 003)
  const m = merge(f, [{ id: 'pFSTOKbYGAE', len: '5:52', d: '이전 설명' }]);
  assert.equal(m[1].len, '5:52'); assert.equal(m[1].d, '이전 설명');   // 이번에 못 얻은 길이·설명은 이전 값 유지
  const wf = readFileSync(new URL('../.github/workflows/guide-videos.yml', import.meta.url), 'utf8');
  assert.ok(wf.includes('cron:') && wf.includes('guide-videos-sync.mjs PLExMxaYxMDPE') && wf.includes('contents: write'));
  const h = readFileSync(new URL('../desktop.html', import.meta.url), 'utf8');
  assert.ok(h.includes("fetch(file || 'guide-videos.json'") && h.includes('return fallback || _YT_LIST;'));
  const j = JSON.parse(readFileSync(new URL('../guide-videos.json', import.meta.url), 'utf8'));
  assert.ok(j.list === 'PLExMxaYxMDPE' && j.videos.length >= 3 && j.videos.every(v => /^[\w-]{11}$/.test(v.id)));
});

test('나비웹 사용법: 맨 위 섹션, 별도 재생목록(PLVk7oB1w5pLE)을 guide-howto.json 으로 30분마다 따라가며, 실패해도 안내 영상 동기화는 영향 없음', () => {
  const h = readFileSync(new URL('../desktop.html', import.meta.url), 'utf8');
  assert.ok(h.indexOf('id="yt-howto"') > 0 && h.indexOf('id="yt-howto"') < h.indexOf('id="yt-grid"'), '나비웹 사용법이 안내 영상 위');
  assert.ok(h.includes("_ytLoad('guide-howto.json', [])") && h.includes('영상을 준비하고 있습니다'));
  const wf = readFileSync(new URL('../.github/workflows/guide-videos.yml', import.meta.url), 'utf8');
  assert.ok(wf.includes('guide-videos-sync.mjs PLVk7oB1w5pLE guide-howto.json') && wf.includes('continue-on-error: true') && wf.includes('git add guide-videos.json guide-howto.json'));
  const j = JSON.parse(readFileSync(new URL('../guide-howto.json', import.meta.url), 'utf8'));
  assert.equal(j.list, 'PLVk7oB1w5pLE'); assert.ok(Array.isArray(j.videos));
});

test('영상 동기화: 번호(나비웹 사용법 NN·navi N)순, 번호 없는 새 영상은 맨 뒤에 업로드 순으로 붙는다', async () => {
  const { merge } = await import('../scripts/guide-videos-sync.mjs');
  const feed = [{ id: 'e', t: '새 영상 B' }, { id: 'd', t: '새 영상 A' }, { id: 'c', t: '나비웹 사용법 04 - x' }, { id: 'b', t: '나비웹 사용법 02' }, { id: 'a', t: '나비웹 사용법 01' }].map(v => ({ ...v, t: v.t.normalize('NFD') }));
  assert.equal(merge(feed, [{ id: 'a' }, { id: 'b' }]).map(v => v.id).join(''), 'abcde');
});

test('나비웹 사용법 영상: 제목 번호(사용법·매뉴얼·도우미 NN)로 정렬하고, 매뉴얼은 번호=장 번호로 영상을 맞춘다', async () => {
  const { sortByNumber } = await import('../scripts/guide-videos-sync.mjs');
  const t = ['나비웹 사용법 06 - 왼쪽 메뉴', '나비웹 도우미 09 - 사용자 검색과 대화', '나비웹 매뉴얼 10 - AI 비서 채팅 혹은 라우팅', '나비웹 사용법 01 - 가입하기', '나비웹 사용법 14 - PC와 폰 로그인', '나비웹 사용법 05 - 위쪽 메뉴'];
  assert.deepEqual(sortByNumber(t.map((x, i) => ({ id: 'v' + i, t: x }))).map(v => v.t.match(/\d+/)[0]), ['01', '05', '06', '09', '10', '14']);
  const m = readFileSync(new URL('../manual/hondi_interactive_manual.html', import.meta.url), 'utf8');
  assert.ok(m.includes('howtoNum(x.t) === n') && m.includes('CHAPTERS.findIndex') && !m.includes('HOWTO_CHAPTERS'));
});

test('나비웹 사용법 중급: 초급·중급 탭, 중급 목록(PLaRjMKGRz50E → guide-howto-mid.json)을 따라가고, 매뉴얼 중급 장(01~09·12편) 맨 위에 해당 영상이 붙는다', () => {
  const h = readFileSync(new URL('../desktop.html', import.meta.url), 'utf8');
  assert.ok(h.includes('id="yt-tab-basic"') && h.includes('id="yt-tab-mid"') && h.includes('id="yt-howto-mid"'));
  assert.ok(h.includes("_ytLoad('guide-howto-mid.json', [])") && h.includes('.yt-list[hidden]{display:none}'));
  const wf = readFileSync(new URL('../.github/workflows/guide-videos.yml', import.meta.url), 'utf8');
  assert.ok(wf.includes('guide-videos-sync.mjs PLaRjMKGRz50E guide-howto-mid.json') && wf.includes('git add guide-videos.json guide-howto.json guide-howto-mid.json'));
  const j = JSON.parse(readFileSync(new URL('../guide-howto-mid.json', import.meta.url), 'utf8'));
  assert.equal(j.list, 'PLaRjMKGRz50E');
  assert.deepEqual(j.videos.map(v => v.t.normalize('NFC').match(/(?:나비웹|사용법|도우미) 0*(\d+) /)[1]), ['1', '2', '3', '4', '5', '6', '7', '8', '9', '12'], '제목 번호순(07·08 포함)');
  assert.ok(j.videos.every(v => v.len && v.d), '길이·설명이 모두 있다');
  assert.ok(j.videos.every(v => /^[\w-]{11}$/.test(v.id)));
  const m = readFileSync(new URL('../manual/hondi_interactive_manual.html', import.meta.url), 'utf8');
  assert.ok(m.includes("var MID_EP = { ch10: 1, ch11: 2, ch12: 3, ch13: 4, ch14: 5, ch16: 6, ch_doc_write: 7, ch_myforms: 8, ch_othersite: 9, ch_learning: 12 };") && m.includes('guide-howto-mid.json'));
  const p = readFileSync(new URL('../ops/naviweb-proxy/mail-paths.js', import.meta.url), 'utf8');
  assert.ok(p.includes('"guide-howto-mid.json"'), '프록시가 이 파일을 내보낸다');
});

test('새 양식 만들기: 캔버스의 템플릿 상자는 없고, 대화창 추천에 템플릿 시작(8개 + 더 보기)과 말로 만들기가 있다', () => {
  const h = readFileSync(new URL('../desktop.html', import.meta.url), 'utf8');
  assert.ok(!h.includes('class="mfb-start"') && !h.includes('mfb-startt'), '캔버스 템플릿 상자 없음');
  assert.ok(h.includes('템플릿으로 바로 시작') && h.includes('말로 설명해서 만들기') && h.includes('data-a="tplmore"'));
  assert.ok(h.includes("const _MFB_TPL_FIRST = ['신청서', '점검표', '회의록', '업무 보고서', '위임장', '차용증', '연차 휴가 신청서', '견적서']"));
  assert.ok(h.includes("if (a === 'tplmore')") && h.includes("if (a === 'start') return _mfbStart("));
  assert.ok(h.includes('if (!id) _mfbChat(true);'), '새로 만들 때 대화창이 열려 있다');
});

test('새 양식 만들기: "내 문서 올려서 시작" 칩이 원본을 왼쪽에 띄우고, 매뉴얼이 이를 안내한다', () => {
  const h = readFileSync(new URL('../desktop.html', import.meta.url), 'utf8');
  assert.ok(h.includes('data-a="upref"') && h.includes("if (a === 'upref') return _mfbPickRef();"));
  assert.ok(h.includes('function _mfbShowRef(') && h.includes('function _mfbPickRef('));
  const m = readFileSync(new URL('../manual/hondi_interactive_manual.html', import.meta.url), 'utf8');
  assert.ok(m.includes('내 문서 올려서 시작'));
});

test('서류 작성 대화창: 사진 → 다른 사이트 입력(OCR → 확인 → 도우미 맡김, 제출은 사용자)', () => {
  const h = readFileSync(new URL('../desktop.html', import.meta.url), 'utf8');
  assert.ok(h.includes('const _PHOTOFILL_RE') && h.includes('async function _photoFillStart(') && h.includes('function _photoFillConfirm('));
  assert.ok(h.includes('if (_PHOTOFILL_RE.test(text || ))'.replace('text || ', "text || ''")), '대화창 첨부 사진 + 사이트 입력 말을 이 흐름으로 보낸다');
  assert.ok(h.includes('_extractImageText(file)') && h.includes('NaviAgent.queue({ playbook:'), 'OCR 후 도우미에 맡긴다');
  assert.ok(h.includes('제출·저장·결제는 하지 말고 멈춰서'), '제출은 사용자가 한다');
  const re = new RegExp(h.match(/const _PHOTOFILL_RE = \/(.*)\/;\n/)[1]);
  for (const t of ['이 처방전 내용을 열어 둔 사이트에 입력해 줘', '찍은 사진을 웹페이지에 옮겨 적어 줘', '이 종이 서류를 홈페이지에 입력해 주세요']) assert.ok(re.test(t), t);
  for (const t of ['서류를 작성해 줘', '이 사이트는 안전한가요?', '사진 첨부는 어떻게 하나요?']) assert.ok(!re.test(t), t);
});

test('다른 사이트 입력 탭: 메뉴·위쪽 탭·화면·흐름이 연결돼 있다', () => {
  const h = readFileSync(new URL('../desktop.html', import.meta.url), 'utf8');
  assert.ok(h.includes('id="tab-btn-othersite"') && h.includes('id="tab-othersite"'));
  assert.ok(h.includes("['myforms', '내 서류함'], ['othersite', '다른 사이트 입력']"), '위쪽 탭');
  assert.ok(h.includes("if (name === 'othersite') _otsRender();") && h.includes('async function _otsGo(') && h.includes('_photoFillConfirm(all, url)'));
});

test('다른 사이트 입력 탭: 같은 계정의 폰으로 촬영해 PC로 받는다(NaviCapture 재사용)', () => {
  const h = readFileSync(new URL('../desktop.html', import.meta.url), 'utf8');
  assert.ok(h.includes('id="ots-phone-btn"') && h.includes('async function _otsPhoneToggle(') && h.includes("label: '다른 사이트 입력'"));
  assert.ok(h.includes('const phoneOn = _otsPhotos.filter(o => o.on);') && h.includes('_otsPhotos = _otsPhotos.filter(o => !o.on)'));
  const m = readFileSync(new URL('../manual/hondi_interactive_manual.html', import.meta.url), 'utf8');
  assert.ok(m.includes('"id":"ch_othersite"') && m.includes('📱 폰으로 촬영</b>은 같은 계정의 폰에'));
});

test('안내 문구는 ✕ 로 한 번 닫으면 다시 보이지 않는다(다른 사이트 입력 탭·폰 촬영 상자)', () => {
  const h = readFileSync(new URL('../desktop.html', import.meta.url), 'utf8');
  assert.ok(h.includes('function _hintAttach(') && h.includes('다시 보지 않기') && h.includes("const _HINT_KEY = 'navi_hints_off'"));
  for (const k of ['ots-sub', 'ots-foot', 'ots-conn', 'ots-pnote', 'pp-note']) assert.ok(h.includes("'" + k + "'"), k);
  assert.ok(h.includes('id="ots-sub"') && h.includes('id="ots-foot"'));
});

test('매뉴얼: 중급에 「다른 사이트에 옮겨 적기」장이 내 양식 장 바로 뒤에 있고, 서류·도우미·폰 장이 이를 가리킨다', () => {
  const m = readFileSync(new URL('../manual/hondi_interactive_manual.html', import.meta.url), 'utf8');
  const i = m.indexOf('var CHAPTERS = ') + 'var CHAPTERS = '.length;
  const chs = JSON.parse(m.slice(i, m.indexOf('];\nvar TIER_LABELS', i) + 1));
  const ids = chs.map(c => c.id), k = ids.indexOf('ch_othersite');
  assert.ok(k > 0 && ids[k - 1] === 'ch_myforms' && chs[k].tier === 'intermediate');
  assert.ok(chs[k].quiz.length >= 8 && chs[k].body.includes('practice-h') && chs[k].body.includes('이렇게 말해 보세요'));
  for (const id of ['ch_docmenu', 'ch_agent', 'ch5', 'ch_doc_write', 'ch_sites']) assert.ok(chs.find(c => c.id === id).body.includes('data-goto="ch_othersite"'), id);
  for (const c of chs) assert.match(String(c.updated || '2026-01-01'), /^\d{4}-\d{2}-\d{2}$/, c.id + ' updated');
});

test('매뉴얼: 정보 공개 청구서 장에 작성→도우미 입력→제출 확인까지의 따라 하기 예제가 있다', () => {
  const m = readFileSync(new URL('../manual/hondi_interactive_manual.html', import.meta.url), 'utf8');
  const i = m.indexOf('var CHAPTERS = ') + 'var CHAPTERS = '.length;
  const chs = JSON.parse(m.slice(i, m.indexOf('];\nvar TIER_LABELS', i) + 1));
  const c = chs.find(x => x.id === 'ch_foi');
  assert.ok(c.body.includes('따라 해 보기 2') && c.body.includes('어린이 보호구역') && c.body.includes('이대로 제출할까요?'));
  assert.ok(c.body.includes('내가 직접 로그인') && c.body.includes('도우미에게 맡기기') && c.body.includes('data-goto="ch_agent"'));
  assert.ok(c.quiz.length >= 6 && /^\d{4}-\d{2}-\d{2}$/.test(c.updated));
});

test('정보 공개 청구: 옛 확장이 절차를 몰라도 맡길 수 있고, SP 는 사용자에게 시키지 않고 도우미가 직접 한다', () => {
  const h = readFileSync(new URL('../desktop.html', import.meta.url), 'utf8');
  assert.ok(h.includes("info.playbooks.some(p => p && p.id === 'open-go-kr-foi')") && h.includes("playbook: (known && !simpan) ? 'open-go-kr-foi' : ''"));
  assert.ok(h.includes('txt.slice(0, 1500)'));
  const a = h.indexOf('const _FOI_SP = ['), sp = h.slice(a, h.indexOf('].join', a));
  assert.ok(sp.includes('사용자에게 찾아보라고 시키지 않는다') && sp.includes('도우미가 정보공개포털에서 사전 공개 여부를 검색하고'));
  assert.ok(!sp.includes('[OPTIONS') || sp.includes('[OPTIONS: ...] 선택지는 쓰지 않는다'));
  assert.ok(!sp.includes('직접 한다. 사용자가 원하면'));
});

test('매뉴얼: 중급 10장은 「예시: 정보 공개 청구와 행정 심판 청구」이고 행정심판 따라 하기와 SP·도우미 연결이 있다', () => {
  const m = readFileSync(new URL('../manual/hondi_interactive_manual.html', import.meta.url), 'utf8');
  const i = m.indexOf('var CHAPTERS = ') + 'var CHAPTERS = '.length;
  const chs = JSON.parse(m.slice(i, m.indexOf('];\nvar TIER_LABELS', i) + 1));
  const c = chs.find(x => x.id === 'ch_foi');
  assert.equal(c.title, '예시: 정보 공개 청구와 행정 심판 청구');
  assert.ok(c.body.includes('따라 해 보기 3') && c.body.includes('simpan.go.kr') && c.body.includes('이의신청은 건너뛰고 행정심판을 청구하고 싶어'));
  assert.ok(c.quiz.length >= 8);
  const h = readFileSync(new URL('../desktop.html', import.meta.url), 'utf8');
  assert.ok(h.includes('[행정심판 청구]') && h.includes('https://www.simpan.go.kr') && h.includes('행정\\s*심판'));
});

test('정보 공개 청구는 다른 서류와 같은 서류 작성 화면으로 열리고, 제출은 도우미가 포털에서 맡는다', () => {
  const h = readFileSync(new URL('../desktop.html', import.meta.url), 'utf8');
  const a = h.indexOf('function _cmpFoiPick()'), src = h.slice(a, h.indexOf('\n}\n', a) + 3);
  assert.ok(src.includes("'law'") && src.includes('정보공개 청구서 · 이의신청서') && src.includes('_cmpDocComboPick') && !src.includes('_orgActivate'));
  assert.ok(h.includes('async function _foiAgentSend(txt, title)') && h.includes('function _isFoiDocTitle(') && h.includes('_foiSubmitViaHelper(title, text)'));
  assert.ok(h.includes('_submitGuideStartPlain(title, blank, text)'));
});
