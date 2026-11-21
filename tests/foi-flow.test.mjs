// 정보 공개 청구 — 데스크톱 대화 SP·청구서 칸 단추·도우미 절차(open-go-kr-foi) 연결 검사
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PLAYBOOKS } from '../ops/naviweb-agent/extension/playbooks.js';
const html = readFileSync(new URL('../desktop.html', import.meta.url), 'utf8');
const sp = (html.match(/const _FOI_SP = \[([\s\S]*?)\]\.join\('\\n'\);/) || [])[1] || '';
describe('정보 공개 청구', () => {
  it('대화 SP 가 사전 공표 확인·범위 좁히기·부서별 나누기·이의신청서를 담는다', () => {
    for (const k of ['사전 공표', '최신 시행본', '부서별', '이의신청서', '~~~foi', '지어내지']) assert.ok(sp.includes(k), k);
  });
  it('청구 일자는 모르면 [대괄호]로 비워 둔다(날짜를 지어내지 않는다)', () => assert.ok(sp.includes('[청구 일자]')));
  it('청구서 칸에 복사·파일로 받기·도우미에게 맡기기·포털 열기 단추가 있다', () => {
    for (const k of ['_foiDocCopy()', '_foiDocSave()', '_foiDocAgent()', "https://www.open.go.kr"]) assert.ok(html.includes(k), k);
  });
  it('도우미 절차 open-go-kr-foi 가 open.go.kr 만 허용하고 로그인·제출 확인을 사용자에게 넘긴다', () => {
    const p = PLAYBOOKS['open-go-kr-foi'];
    assert.deepEqual(p.allowedHosts, ['open.go.kr']);
    assert.match(p.guide, /handoff_to_user/); assert.match(p.guide, /제출·접수 단추 앞에서 멈추고/); assert.match(p.guide, /주민등록번호/);
  });
  it('화면의 맡기기 함수가 그 절차를 부른다', () => assert.ok(/NaviAgent\.queue\(\{ playbook: 'open-go-kr-foi'/.test(html)));
});
