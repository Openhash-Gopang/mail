// 실패에 대처하는 순수 로직: 모델 호출 원인·재시도, 막힌 화면 판별. 브라우저 없이 시험할 수 있다.
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
// 모델 호출이 실패한 원인을 사람이 읽을 수 있게 만든다. 예전에는 "upstream" 한 단어만 남아 원인을 알 수 없었다.
export const MODEL_NAME = { claude: 'Claude Haiku', 'deepseek-flash': 'DeepSeek Flash', 'deepseek-pro': 'DeepSeek Pro', gemma: 'Gemma' };
export function modelError(j, status) {
  const tried = Array.isArray(j && j.tried) ? j.tried : [];
  const old = j && j.detail && j.detail.error && j.detail.error.message;
  const why = tried.length ? tried.map((t) => `${MODEL_NAME[t.provider] || t.provider} ${t.status || ''} ${t.reason}`.replace(/\s+/g, ' ')).join(' / ')
    : [j && j.status, (j && j.reason) || old || (j && j.error) || status].filter(Boolean).join(' ');
  const code = Number((j && j.status) || status);
  const retryable = j && typeof j.retryable === 'boolean' ? j.retryable : [408, 429, 500, 502, 503, 504, 529].includes(code) || status >= 500 && !(code >= 400 && code < 500);
  return Object.assign(new Error('모델 호출 실패: ' + why.slice(0, 150) + (retryable ? '' : ' (서버 설정이나 AI 사용 한도 문제로 보입니다. 관리자 확인이 필요합니다)')), { retryable });
}
// 모델 호출이 실패해도 작업을 처음부터 다시 하지 않는다. 15초 뒤 한 번 저절로, 그다음은 사용자의 "다시 시도"로 하던 곳에서 이어 간다.
export const MODEL_RETRY = { pauseMs: 15000, asks: 2 };
export async function keepTrying(once, h) {
  for (let round = 0; ; round++) {
    try { return await once(); }
    catch (e) {
      if (!e.retryable || h.aborted() || round > MODEL_RETRY.asks) throw e;
      if (round === 0) { h.notice('AI 응답을 받지 못해 잠시 뒤 다시 시도합니다.'); await wait(MODEL_RETRY.pauseMs); }
      else if ((await h.choose(`AI 응답을 받지 못했습니다. ${e.message.slice(0, 160)}\n지금까지 진행한 곳에서 이어서 다시 시도할까요?`, ['다시 시도', '그만두기'])) !== '다시 시도') throw e;
      if (h.aborted()) throw e;
    }
  }
}
// 사이트 접속이 막혔거나 오류 화면이 뜨면 같은 주소를 다시 연다(처음 시도까지 모두 3번). 보안문자·로그인 화면은 막힌 것으로 보지 않는다.
const BLOCKED_TEXT = /ERR_[A-Z_]{4,}|access\s*denied|403\s*forbidden|502\s*bad\s*gateway|503\s*service|504\s*gateway|service\s*(temporarily\s*)?unavailable|request\s*(was\s*)?(rejected|blocked)|(접속|접근|요청)(이|가)?\s*(일시적으로\s*)?(차단|거부|제한)(되|됐|된|하)|비정상적인?\s*(접근|접속)|접속(이)?\s*원활(하지|치)\s*(않|못)|일시적인?\s*(시스템\s*)?(오류|장애)가?\s*발생/i;
export const looksBlocked = (title, text) => String(text || '').length < 1500 && BLOCKED_TEXT.test(`${title || ''} ${text || ''}`);
