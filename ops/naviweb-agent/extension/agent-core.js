// 에이전트 루프. 브라우저/네트워크는 host 로 주입받아 Node 에서 시험할 수 있다.
import { TOOLS } from './tools.js';
import { classify } from './policy.js';

export function buildSystem(playbook) {
  const base = [
    '당신은 사용자의 브라우저에서 웹 사이트 작업을 대신 진행하는 범용 에이전트입니다(행정·법률 서류 절차를 포함해 어떤 사이트든). 한국어로 짧게 답합니다.',
    '- 현재 탭이 비어 있거나 about:blank 이면 먼저 navigate 로 필요한 사이트로 이동합니다(사용자 승인을 받습니다). 이동한 사이트는 사용자가 허용해야 읽을 수 있습니다.',
    '- 화면을 먼저 read_page 로 확인하고, ref 로만 요소를 조작합니다. 추측해서 누르지 않습니다.',
    '- 로그인, 인증서, 결제, 보안문자, 비밀번호·카드·주민등록번호 입력은 하지 않고 handoff_to_user 로 사용자에게 넘깁니다.',
    '- 제출·발급·삭제처럼 되돌리기 어려운 버튼은 사용자 확인을 거칩니다(시스템이 묻습니다).',
    '- 나비웹에서 맡긴 첨부서류가 파일로 발급되면(내려받기 링크·단추), 사용자 확인을 거쳐 내려받은 뒤 send_file_to_navi 로 나비웹에 보냅니다. 링크 요소가 보이면 그 ref 를, 단추로 내려받았으면 ref 없이 부릅니다. 파일이 아닌 결과(기관으로 바로 전송 등)와 진행 상황·실패는 report_status 로 알립니다.',
    '- 비슷한 이름이 여러 개면 고르기 전에 지역·번호 등으로 구별해 근거를 한 줄로 남깁니다.',
    '- read_page 결과에 "화면 위에 팝업" 경고가 있으면 가려진 영역은 읽지 못한 것으로 보고, 팝업 내용을 사용자에게 알립니다. 팝업을 닫을지는 사용자에게 묻고, 맘대로 누르지 않습니다.',
    '- 메뉴·목록을 묻는 질문은 화면 위쪽 주 메뉴부터 빠짐없이 답하고, 요소 목록에 없어서 확인하지 못한 부분은 "확인하지 못했다"고 씁니다. 보지 못한 내용을 추측해 적지 않습니다.',
    '- 보고는 마크다운 기호(**, #) 없이 일반 문장과 "- " 목록으로 씁니다.',
    '- 끝나면 한 일, 남은 일, 확인이 필요한 점을 짧게 보고합니다.',
  ].join('\n');
  return playbook ? `${base}\n\n[절차: ${playbook.title}]\n${playbook.guide}` : base;
}

function trimImages(messages, keep = 1) {
  let seen = 0;
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (!Array.isArray(m.content)) continue;
    for (const b of m.content) {
      if (b.type === 'tool_result' && Array.isArray(b.content)) {
        b.content = b.content.map((x) => {
          if (x.type !== 'image') return x;
          return ++seen > keep ? { type: 'text', text: '[이전 스크린샷 생략]' } : x;
        });
      }
    }
  }
}

export async function runAgent({ goal, playbook, host, maxSteps = 40 }) {
  const system = buildSystem(playbook);
  const extra = (playbook && playbook.allowedHosts) || [];
  const messages = [{ role: 'user', content: [{ type: 'text', text: goal }] }];
  for (let step = 0; step < maxSteps; step++) {
    if (host.aborted && host.aborted()) return { done: false, reason: 'aborted' };
    const resp = await host.callModel({ system, messages, tools: TOOLS, max_tokens: 1500 });
    messages.push({ role: 'assistant', content: resp.content });
    const text = resp.content.filter((b) => b.type === 'text').map((b) => b.text).join('\n').trim();
    if (text) host.log({ kind: 'say', text });
    const uses = resp.content.filter((b) => b.type === 'tool_use');
    if (!uses.length) return { done: true, text };
    const results = [];
    for (const u of uses) {
      const out = { type: 'tool_result', tool_use_id: u.id, content: [] };
      const say = (t) => out.content.push({ type: 'text', text: t });
      try {
        const info = (await host.describe(u.name, u.input)) || {};
        const verdict = classify(u.name, u.input, info, extra);
        host.log({ kind: 'tool', name: u.name, input: u.input, act: verdict.act });
        if (verdict.act === 'deny') say('거부됨: ' + verdict.reason);
        else if (verdict.act === 'handoff') { await host.handoff(verdict.reason); say('사용자가 직접 처리했습니다. 화면을 다시 확인하세요.'); }
        else if (verdict.act === 'confirm' && !(await host.ask(verdict.reason))) say('사용자가 거절했습니다. 진행하지 마세요.');
        else {
          const r = await host.execTool(u.name, u.input);
          say(String(r.text || '(ok)').slice(0, u.name === 'read_page' || u.name === 'find' ? 10000 : 6000));
          if (r.image) out.content.push({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: r.image } });
        }
      } catch (e) { say('오류: ' + (e && e.message ? e.message : e)); out.is_error = true; }
      results.push(out);
    }
    messages.push({ role: 'user', content: results });
    trimImages(messages, 1);
  }
  return { done: false, reason: 'max_steps' };
}
