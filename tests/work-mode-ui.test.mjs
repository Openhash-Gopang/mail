import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../desktop.html', import.meta.url), 'utf8');
const chat = readFileSync(new URL('../hondi-chat.js', import.meta.url), 'utf8');

test('작업 중(서류가 열린 동안) 상단 막대·탭 줄을 위로 숨기고, 손잡이를 끌면 잠시 보인다', () => {
  assert.match(html, /body\.hd-hidden\{--hd:0px\}/);
  assert.match(html, /body\.hd-hidden header\.topbar\{position:fixed;[^}]*translateY\(-100%\)/);
  assert.match(html, /id="hd-pull"/);
  assert.match(html, /tab\.getAttribute\('data-docopen'\) === '1'/);
  assert.match(html, /body\.hd-hidden \.pg-bar\{display:none\}/);
  assert.equal((html.match(/top:54px/g) || []).length, 1, '위쪽 간격은 var(--hd) 를 따른다(고정 54px 는 펼쳐 볼 때의 탭 줄 하나뿐)');
});

test('나비웹 도우미 설치 안내: 연결 안 됨이면 안내 창, 연결되면 닫힘, 서류 화면이 요청하면 연다', () => {
  assert.match(html, /function _agentGuideOpen\(\)/);
  assert.match(html, /agent\/naviweb-agent-extension\.zip/);
  assert.match(html, /if \(_agentInfo && window\._agentGuideClose\) window\._agentGuideClose\(\);/);
  assert.match(html, /d\.type === 'navi-doc-need-agent'/);
});

test('혼디 대화창: 혼디 페이지가 직접 답하는 동안(hondi-embed-busy)에도 진행 막대를 켜고 끈다', () => {
  assert.match(chat, /d\.type !== 'hondi-embed-busy'/);
  assert.match(chat, /if \(d\.on\) busy\(/);
});
