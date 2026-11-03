// 안전 규칙: 도구 호출을 실행 전에 분류한다. 모델이 무엇을 요청하든 이 규칙이 우선한다.
// 결과: { act: 'auto' | 'confirm' | 'handoff' | 'deny', reason }
export const DEFAULT_HOSTS = ['iros.go.kr', 'ecfs.scourt.go.kr', 'gov.kr', 'hondi.net', 'naviweb.kr'];

const RRN = /\d{6}\s*-?\s*[1-8]\d{6}/;
const SECRET_NAME = /passw|passwd|pwd|비밀번호|card|카드번호|cvc|cvv|otp|보안카드|계좌번호|주민|rrn|ssn/i;
const HANDOFF_TEXT = /로그인|login|sign.?in|인증서|공동인증|간편인증|본인인증|캡차|captcha|자동입력\s*방지|결제|payment|pay\b|이체|송금|계좌이체|카드\s*결제|전자서명/i;
const CONFIRM_TEXT = /제출|접수|신청서|발급|전송|삭제|확정|동의|보내기|send|submit|delete/i;
// 메뉴 이동처럼 되돌릴 수 있는 항목은 묻지 않는다.
const NAV_OK = /^(열람[·\s]*발급|등기상호검색|신청결과|법인\s*열람|결제대상목록|처음으로|이전|다음)/;

export function hostAllowed(url, extra = []) {
  try {
    const h = new URL(url).hostname;
    if (new URL(url).protocol !== 'https:') return false;
    return [...DEFAULT_HOSTS, ...extra].some((d) => h === d || h.endsWith('.' + d));
  } catch { return false; }
}

// info: 대상 요소 설명 {tag,type,name,autocomplete,text}
export function classify(tool, input = {}, info = {}, extraHosts = []) {
  if (tool === 'navigate') {
    return hostAllowed(input.url, extraHosts)
      ? { act: 'auto' } : { act: 'deny', reason: '허용되지 않은 사이트입니다.' };
  }
  if (tool === 'handoff_to_user') return { act: 'handoff', reason: input.reason || '직접 진행이 필요합니다.' };
  if (tool === 'type') {
    const t = String(input.text ?? '');
    if (RRN.test(t)) return { act: 'deny', reason: '주민등록번호는 에이전트가 입력하지 않습니다.' };
    if (info.type === 'password' || SECRET_NAME.test(`${info.name || ''} ${info.autocomplete || ''} ${info.label || ''}`) || /^cc-/.test(info.autocomplete || ''))
      return { act: 'handoff', reason: '비밀번호·카드·인증 정보 입력칸입니다. 직접 입력해 주세요.' };
    return { act: 'auto' };
  }
  if (tool === 'click' || tool === 'select_option') {
    const label = `${info.text || ''} ${info.name || ''}`;
    if (HANDOFF_TEXT.test(label)) return { act: 'handoff', reason: `"${(info.text || info.name || '').trim().slice(0, 30)}" 단계는 직접 진행해 주세요.` };
    if (tool === 'click' && !NAV_OK.test((info.text || info.name || '').trim()) && CONFIRM_TEXT.test(label)) return { act: 'confirm', reason: `"${(info.text || info.name || '').trim().slice(0, 30)}" 을(를) 누를까요?` };
  }
  return { act: 'auto' };
}
