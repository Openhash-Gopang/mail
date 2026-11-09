// 에이전트 루프. 브라우저/네트워크는 host 로 주입받아 Node 에서 시험할 수 있다.
import { TOOLS } from './tools.js';
import { classify } from './policy.js';

export function buildSystem(playbook) {
  const base = [
    '당신은 사용자의 브라우저에서 웹 사이트 작업을 대신 진행하는 범용 에이전트입니다(행정·법률 서류 절차를 포함해 어떤 사이트든). 한국어로 짧게 답합니다.',
    '- 현재 탭이 비어 있거나 about:blank 이면 먼저 navigate 로 필요한 사이트(https)로 이동합니다. 어느 사이트든 이동할 수 있습니다.',
    '- 화면을 먼저 read_page 로 확인하고, ref 로만 요소를 조작합니다. 추측해서 누르지 않습니다.',
    '- 로그인, 인증서, 결제, 보안문자, 비밀번호·카드·주민등록번호 입력은 하지 않고 handoff_to_user 로 사용자에게 넘깁니다.',
    '- 로그인이 필요하면 먼저 화면의 "로그인" 링크를 눌러 로그인 창을 직접 연 뒤, handoff_to_user 의 reason 에 사용자가 따를 절차를 한두 문장으로 적습니다(예: 로그인 창에서 간편인증 또는 공동인증서로 로그인한 뒤 "완료"를 누르세요). 아이디·비밀번호·인증 정보는 묻지도 입력하지도 않습니다. 사용자에게 확장 프로그램 아이콘을 누르라고 안내하지 않습니다(이미 시작된 상태입니다).',
    '- 목표에 "(곧 알려 드립니다)"처럼 아직 정해지지 않은 정보가 있으면, 그것 없이 할 수 있는 단계(사이트 열기·로그인 요청·검색 화면 준비)를 먼저 진행합니다. 그 정보가 꼭 필요한 시점이 되면 wait 로 기다리며(최대 약 5분) 대화에 "[추가 정보]"가 나타나기를 기다리고, 추측해서 채우지 않습니다.',
    '- 제출·발급·삭제처럼 되돌리기 어려운 버튼은 사용자 확인을 거칩니다(시스템이 묻습니다).',
    '- 나비웹에서 맡긴 첨부서류가 파일로 발급되면(내려받기 링크·단추), 사용자 확인을 거쳐 내려받은 뒤 send_file_to_navi 로 나비웹에 보냅니다. 링크 요소가 보이면 그 ref 를, 단추로 내려받았으면 ref 없이 부릅니다. 파일이 아닌 결과(기관으로 바로 전송 등)와 진행 상황·실패는 report_status 로 알립니다.',
    '- 서류 파일을 나비웹에 보낸 뒤에는 "서류에 넣을까요?"처럼 사용자에게 다시 묻지 않습니다(나비웹이 자동으로 넣습니다). 사용자가 이미 지시한 일은 되묻지 말고 끝까지 진행하며, 맡긴 항목 이름에 "등본(초본)"처럼 둘이 함께 적혀 있으면 사용자가 말한 쪽을 발급해 그대로 보냅니다.',
    '- 정부24처럼 처리완료 화면의 링크가 파일이 아니라 화면(text/html)이면 포기하지 말고, 처리완료 상세 화면에서 "문서출력"(또는 저장·다운로드·PDF 저장) 단추를 눌러 문서 보기 창을 열고 문서가 화면에 보이면 인쇄·저장 단추를 누르지 말고 바로 ref 없이 send_file_to_navi 를 부릅니다(열린 문서 보기 화면에서 PDF 를 직접 가져오거나, 인쇄만 되는 뷰어면 화면을 PDF 로 만들어 보냅니다). 가져오지 못했다는 답이 오면 그 창의 저장 단추로 내려받은 뒤 다시 부릅니다. 새 창이 열리면 도우미가 그 창을 이어서 조작합니다. 인쇄 대화상자만 나오고 저장할 방법이 없을 때만 report_status 로 실패 이유를 알립니다.',
    '- 비슷한 이름이 여러 개면 고르기 전에 지역·번호 등으로 구별해 근거를 한 줄로 남깁니다.',
    '- read_page 결과에 "화면 위에 팝업" 경고가 있으면 가려진 영역은 읽지 못한 것으로 보고, 팝업 내용을 사용자에게 알립니다. 팝업을 닫을지는 사용자에게 묻고, 맘대로 누르지 않습니다.',
    '- 메뉴·목록을 묻는 질문은 화면 위쪽 주 메뉴부터 빠짐없이 답하고, 요소 목록에 없어서 확인하지 못한 부분은 "확인하지 못했다"고 씁니다. 보지 못한 내용을 추측해 적지 않습니다.',
    '- 보고는 마크다운 기호(**, #) 없이 일반 문장과 "- " 목록으로 씁니다.',
    '- 사용자의 답이 필요하면 글로 \"알려 주세요\" 하고 끝내지 말고 반드시 ask_choice 도구로 질문과 선택지(2~6개)를 단추로 제시합니다. 사용자는 글을 입력할 수 없고 단추만 누를 수 있습니다. 답을 기다리며 작업을 끝내지 마세요.',
    '- 화면에 "로그아웃"·"마이페이지"·사용자 이름이 보이면 이미 로그인된 상태입니다. 로그인하라고 요청하지 말고 곧바로 다음 단계를 진행합니다. 보이지 않을 때만 로그인 안내를 합니다.',
    '- 서류 종류가 여럿으로 갈리면(예: 등본/초본) 목표에 이미 정해진 것은 묻지 말고, 정해지지 않았을 때만 ask_choice 로 고르게 합니다.',
    '- 사용자가 직접 하는 일은 로그인·본인인증(공동인증서·간편인증)·결제·보안문자뿐입니다. 그 밖의 모든 조작(메뉴 이동, 서비스·옵션 선택, 입력칸 채우기, 체크, 다음·신청·발급 단추 누르기)은 도우미가 직접 합니다. "화면에서 직접 선택해 주세요"라고 넘기지 마세요. 선택이 사용자 몫이면 ask_choice 로 단추를 보여 주고, 고른 값대로 도우미가 화면을 조작합니다. 인증·결제 단계가 오면 그 단계에서만 handoff_to_user 로 멈추고, 끝나면 이어서 진행합니다.',
    '- 입력칸에 넣을 개인 정보(성명·거주지 시도·주소·전화번호·이메일)는 먼저 pdv_get 으로 내 데이터 금고에서 찾아 쓰고, 없을 때만 ask_input(save_as 로 금고 항목을 지정)으로 물어 받아 직접 입력합니다. save_as 로 받은 값은 도우미가 금고에 보관합니다.',
    '- 입력칸에 넣을 그 밖의 개인 정보를 모르면 ask_input 으로 물어 받아 직접 입력합니다. 사용자가 직접 입력하겠다고 하면 건너뜁니다. 비밀번호·주민등록번호·카드·계좌·인증번호는 ask_input 으로 받지 말고 handoff_to_user 로 사용자가 직접 입력하게 합니다.',
    '- 처음 가는 사이트라 회원가입이 필요하면 가입 절차도 도우미가 진행합니다: 회원가입 화면으로 이동하고, 회원 유형(개인 등) 선택과 성명·전화번호·이메일 같은 일반 정보는 pdv_get 으로 찾아 채웁니다. 약관 동의, 본인인증, 아이디·비밀번호 만들기, 가입 완료 단추는 사용자가 직접 하도록 handoff_to_user 로 넘기고(어느 칸·단추인지 구체적으로 안내), 완료를 받으면 이어서 진행합니다. 가입·로그인이 끝나면 원래 하던 서류 작업으로 돌아갑니다.',
    '- 사용자가 직접 하는 단계 동안 사용자는 여러 페이지를 열고 닫을 수 있습니다. 사용자 메시지([사용자 메시지])가 오면 질문에는 짧게 답하고 필요한 행동을 이어 가세요. 작업을 마쳤다고 먼저 끝내지 말고, 로그인·가입이 끝나 원래 작업을 이어 갈 수 있을 때까지 완료 신호를 기다립니다.',
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

export const PDV_KEYS = ['name', 'sido', 'address', 'phone', 'email'];
export const needsAnswer = (t) => /알려\s*주세요|알려\s*주시|말씀해|선택해\s*주|정해\s*주|골라\s*주|어느\s*(것|쪽)|무엇을.*(할까요|드릴까요)|\?\s*$|까요\s*[?.]?\s*$/m.test(String(t || ''));

export async function runAgent({ goal, playbook, host, maxSteps = 70 }) {
  let nudges = 0;
  const system = buildSystem(playbook);
  const extra = (playbook && playbook.allowedHosts) || [];
  const messages = [{ role: 'user', content: [{ type: 'text', text: goal }] }];
  for (let step = 0; step < maxSteps; step++) {
    if (host.aborted && host.aborted()) return { done: false, reason: 'aborted' };
    // 작업 중에 나비웹이 알려 준 추가 정보(예: 법인 이름)를 마지막 사용자 메시지에 덧붙인다.
    const more = host.inbox && host.inbox();
    if (more) { const last = messages[messages.length - 1]; const blk = { type: 'text', text: '[추가 정보] ' + more }; if (last && last.role === 'user' && Array.isArray(last.content)) last.content.push(blk); else messages.push({ role: 'user', content: [blk] }); }
    if (host.progress) host.progress(`AI가 다음 단계를 정하는 중입니다 (${step + 1}단계)`);   // 멈춘 것처럼 보이지 않게 지금 하는 일을 띠에 알린다
    const resp = await host.callModel({ system, messages, tools: TOOLS, max_tokens: 1500 });
    messages.push({ role: 'assistant', content: resp.content });
    const text = resp.content.filter((b) => b.type === 'text').map((b) => b.text).join('\n').trim();
    if (text) host.log({ kind: 'say', text });
    const uses = resp.content.filter((b) => b.type === 'tool_use');
    if (!uses.length) {
      // 사용자 답이 필요한 질문을 글로만 던지고 끝내면 사용자가 답할 수 없다. 선택 단추로 다시 묻게 한다.
      if (nudges < 2 && needsAnswer(text) && host.choose) {
        nudges++;
        messages.push({ role: 'user', content: [{ type: 'text', text: '사용자는 글을 입력할 수 없습니다. 방금 보고에서 사용자의 답이 필요한 항목이 있으면, 항목마다 ask_choice 도구로 질문과 선택지를 단추로 제시하고, 고른 값으로 작업을 이어 가세요. 답이 필요한 항목이 정말 없으면 한 줄로 "완료"라고만 답하세요.' }] });
        continue;
      }
      return { done: true, text };
    }
    const results = [];
    for (const u of uses) {
      const out = { type: 'tool_result', tool_use_id: u.id, content: [] };
      const say = (t) => out.content.push({ type: 'text', text: t });
      try {
        const info = (await host.describe(u.name, u.input)) || {};
        const verdict = classify(u.name, u.input, info, extra, { fetchJob: !!(host.fetchJob && host.fetchJob()) });
        if (host.progress && verdict.act === 'auto') host.progress(`화면을 조작하는 중입니다 (${step + 1}단계 · ${({ click: '누르기', type: '입력', navigate: '이동', read_page: '화면 읽기', find: '찾기', screenshot: '화면 보기' })[u.name] || u.name})`);
        host.log({ kind: 'tool', name: u.name, input: u.input, act: verdict.act });
        if (verdict.act === 'input') {
          const v = await host.input(String(u.input.question || '값을 입력해 주세요.').slice(0, 300), String(u.input.label || '').slice(0, 40), PDV_KEYS.includes(u.input.save_as) ? u.input.save_as : '');
          say(v == null ? '사용자가 입력하지 않고 중단했습니다.' : v && v.manual ? '사용자가 페이지에 직접 입력했다고 알렸습니다. 화면을 다시 읽고 다음 단계로 가세요.' : '사용자가 입력한 값: ' + String(v).slice(0, 200));
        } else if (verdict.act === 'choice') {
          const opts = (Array.isArray(u.input.options) ? u.input.options : []).map((x) => String(x).slice(0, 60)).filter(Boolean).slice(0, 6);
          if (opts.length < 2) say('선택지가 2개 이상 필요합니다.');
          else { const v = await host.choose(String(u.input.question || '선택해 주세요.').slice(0, 300), opts); say(v == null ? '사용자가 선택하지 않고 중단했습니다.' : '사용자가 고른 항목: ' + v); }
        } else if (verdict.act === 'deny') say('거부됨: ' + verdict.reason);
        else if (verdict.act === 'handoff') { const h = await host.handoff(verdict.reason); say(h === 'say' ? '사용자가 완료를 누르지 않고 메시지를 보냈습니다. 아래 [사용자 메시지]를 보고 답하거나 행동하세요. 직접 입력이 아직 필요하면 handoff_to_user 를 다시 부르세요.' : '사용자가 직접 처리했습니다. 화면을 다시 확인하세요.'); }
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
