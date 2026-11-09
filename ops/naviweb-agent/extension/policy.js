// 안전 규칙: 도구 호출을 실행 전에 분류한다. 모델이 무엇을 요청하든 이 규칙이 우선한다.
// 결과: { act: 'auto' | 'confirm' | 'handoff' | 'deny', reason }
// 사이트 제한은 없다(2026-11-08 결정): 나비웹 도우미는 사용자가 작업에 필요로 하는 모든 https 사이트를 다룬다.
// 지켜야 할 것은 사이트가 아니라 동작이다 — 로그인·인증·결제·보안문자는 사용자가 직접(handoff), 주민등록번호·비밀번호·카드번호는 입력하지 않고(deny), 제출·발급·전송·삭제는 확인(confirm)을 받는다.

const RRN = /\d{6}\s*-?\s*[1-8]\d{6}/;
const SECRET_NAME = /passw|passwd|pwd|비밀번호|card|카드번호|cvc|cvv|otp|보안카드|계좌번호|주민|rrn|ssn/i;
const HANDOFF_TEXT = /로그인|login|sign.?in|인증서|공동인증|간편인증|본인인증|캡차|captcha|자동입력\s*방지|결제|payment|pay\b|이체|송금|계좌이체|카드\s*결제|전자서명/i;
const CONFIRM_TEXT = /제출|접수|신청서|발급|전송|삭제|확정|동의|보내기|다운로드|내려받기|send|submit|delete|download/i;
// 메뉴 이동처럼 되돌릴 수 있는 항목은 묻지 않는다.
const NAV_OK = /^(열람[·\s]*발급|등기상호검색|신청결과|법인\s*열람|결제대상목록|처음으로|이전|다음)/;

/** https 주소이면 어느 사이트든 허용한다. (http 는 열지 않는다) extra 인자는 예전 호출과의 호환을 위해 받지만 쓰지 않는다. */
export function hostAllowed(url, extra = []) {
  try { return new URL(url).protocol === 'https:'; } catch { return false; }
}

// info: 대상 요소 설명 {tag,type,name,autocomplete,text}
// 어느 사이트든 다룬다. 이동은 https 이면 바로 하고, 입력·클릭은 아래 동작 규칙(classifyKnown)만 따른다.
// opts.fetchJob: 나비웹의 "도우미가 가져오기"로 시작한 작업 — 사용자가 이미 그 서류를 받아 오라고 맡겼으므로 발급·다운로드 단추는 다시 묻지 않는다(제출·전송·삭제·동의·결제는 그대로 묻거나 직접).
export function classify(tool, input = {}, info = {}, extraHosts = [], opts = {}) {
  if (tool === 'navigate') {
    return hostAllowed(input.url) ? { act: 'auto' } : { act: 'deny', reason: 'https 주소만 열 수 있습니다.' };
  }
  return classifyKnown(tool, input, info, opts);
}
// 요소 글자에 보이는 글과 숨은 글이 겹쳐 "발급 발급하기" 처럼 나오는 것을 다듬는다.
const tidy = (t) => String(t || '').replace(/\s+/g, ' ').trim().replace(/(\S{2,}) (?=\1)/g, '');
const ISSUE_ONLY = /발급|다운로드|내려받기|download/i;
const STRONG_CONFIRM = /제출|접수|신청서|전송|삭제|확정|동의|보내기|send|submit|delete/i;
function classifyKnown(tool, input = {}, info = {}, opts = {}) {
  if (tool === 'handoff_to_user') return { act: 'handoff', reason: input.reason || '직접 진행이 필요합니다.' };
  if (tool === 'type') {
    const t = String(input.text ?? '');
    if (RRN.test(t)) return { act: 'deny', reason: '주민등록번호는 에이전트가 입력하지 않습니다.' };
    if (info.type === 'password' || SECRET_NAME.test(`${info.name || ''} ${info.autocomplete || ''} ${info.label || ''}`) || /^cc-/.test(info.autocomplete || ''))
      return { act: 'handoff', reason: '비밀번호·카드·인증 정보 입력칸입니다. 직접 입력해 주세요.' };
    return { act: 'auto' };
  }
  // 화면의 "로그인" 링크는 로그인 창(팝업)을 여는 일일 뿐이라 도우미가 직접 눌러 연다. 아이디·인증서 입력과 인증은 계속 사용자가 한다.
  if (tool === 'click' && info.tag === 'a' && /^(로그인|login)$/i.test(String(info.text || '').trim())) return { act: 'auto' };
  if (tool === 'click' || tool === 'select_option') {
    const label = `${info.text || ''} ${info.name || ''}`;
    if (HANDOFF_TEXT.test(label)) return { act: 'handoff', reason: `"${(info.text || info.name || '').trim().slice(0, 30)}" 단계는 직접 진행해 주세요.` };
    if (tool === 'click' && opts.fetchJob && ISSUE_ONLY.test(label) && !STRONG_CONFIRM.test(label)) return { act: 'auto' };
    if (tool === 'click' && !NAV_OK.test((info.text || info.name || '').trim()) && CONFIRM_TEXT.test(label)) return { act: 'confirm', reason: `"${tidy(info.text || info.name).slice(0, 30)}" 을(를) 누를까요?` };
  }
  return { act: 'auto' };
}
