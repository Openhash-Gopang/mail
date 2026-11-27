// 성공한 절차 기록(record_procedure)을 다듬는다. 공용 절차에는 순서와 "항목 이름"만 남기고, 사용자가 넣은 값은 담지 않는다.
const OFFICIAL_ORG = ['nps.or.kr', 'nhis.or.kr', 'comwel.or.kr', 'kcomwel.or.kr', 'koroad.or.kr', 'kotsa.or.kr', 'ts2020.kr', 'lbsc.kr'];
export function isOfficial(u) {
  let x; try { x = new URL(String(u || '')); } catch { return false; }
  const h = x.hostname.toLowerCase();
  return x.protocol === 'https:' && !x.username && !x.password && !x.port && (h === 'gov.kr' || h.endsWith('.gov.kr') || h.endsWith('.go.kr') || OFFICIAL_ORG.some((d) => h === d || h.endsWith('.' + d)));
}
const USER_ONLY = /로그인|본인\s*(인증|확인)|인증서|간편\s*인증|전자\s*서명|서명|결제|납부|동의|승인|보안\s*문자/;
const PERSONAL = /\d{6}\s*-?\s*[1-8]\d{6}|01[016789][\s.-]?\d{3,4}[\s.-]?\d{4}|[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}|\b\d{3}-\d{2}-\d{5}\b|\b\d{6}-\d{7}\b|(?:\d{4}[\s-]){3}\d{4}|\b\d{15,16}\b/;
const text = (v, n) => { const s = typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, n) : ''; return PERSONAL.test(s) ? '' : s; };
const list = (v, n) => (Array.isArray(v) ? v.slice(0, 40).map((x) => text(x, n)).filter(Boolean) : []);
// 주소의 ? 뒤에는 접수번호·세션 값이 붙을 수 있어 뗀다. 화면을 고르는 데 필요한 주소는 도우미가 단계 설명으로 남긴다.
const bare = (u) => { try { const x = new URL(u); return x.origin + x.pathname; } catch { return ''; } };
export function cleanProcedure(input) {
  const agency = text(input && input.agency, 100), entry = isOfficial(input && input.entry_url) ? bare(input.entry_url) : '';
  const steps = (Array.isArray(input && input.steps) ? input.steps.slice(0, 30) : []).map((s) => {
    const action = text(typeof s === 'string' ? s : s && s.action, 200); if (!action) return null;
    return { actor: USER_ONLY.test(action) ? 'user' : 'helper', action, submit: !!(s && s.submit === true), ...(s && isOfficial(s.url) ? { url: bare(s.url) } : {}) };
  }).filter(Boolean);
  if (!agency || !entry || !steps.length) return null;
  return { official_name: text(input.official_name, 100), agency, entry_url: entry, legal_kind: text(input.legal_kind, 40), steps, required_fields: list(input.required_fields, 60), documents: list(input.documents, 100) };
}
