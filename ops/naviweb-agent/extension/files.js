// 도우미가 받아 온 서류 파일을 나비웹 화면으로 보내기 전의 검사와 변환(브라우저 API 없이 시험할 수 있게 따로 둔다).
// 파일 내용과 주소는 AI 모델로 보내지 않는다. 확장이 직접 받아 나비웹 탭으로만 넘기고, 서류에 넣을지는 나비웹 화면이 사용자에게 묻는다.
export const MAX_BYTES = 10 * 1024 * 1024;   // 나비웹 다리(bridge.js)의 14MB(base64) 한도 안쪽

const SECOND_LEVEL = new Set(['go', 'co', 'or', 'ne', 're', 'pe', 'ac', 'hs', 'ms', 'es', 'sc', 'kg']);
// 같은 기관 사이트인지(예: www.gov.kr 과 file.gov.kr) 대략 가린다. 서로 다른 기관의 주소로는 보내지 않는다.
export function baseDomain(host) {
  const p = String(host || '').toLowerCase().split('.').filter(Boolean);
  if (p.length <= 2) return p.join('.');
  const n = p[p.length - 1] === 'kr' && SECOND_LEVEL.has(p[p.length - 2]) ? 3 : 2;
  return p.slice(-n).join('.');
}
export function checkFileUrl(fileUrl, tabUrl) {
  let u, t;
  try { u = new URL(fileUrl); } catch { return { ok: false, msg: '파일 주소를 읽지 못했습니다.' }; }
  if (u.protocol !== 'https:') return { ok: false, msg: u.protocol === 'blob:' || u.protocol === 'data:' ? '이 사이트는 화면 안에서 만든 파일(blob/data)로 내려 주어 자동으로 가져올 수 없습니다.' : 'https 주소의 파일만 가져올 수 있습니다.' };
  try { t = new URL(tabUrl); } catch { return { ok: false, msg: '작업 중인 탭의 주소를 확인하지 못했습니다.' }; }
  if (baseDomain(u.hostname) !== baseDomain(t.hostname)) return { ok: false, msg: `작업 중인 사이트(${t.hostname})와 다른 사이트(${u.hostname})의 파일은 가져오지 않습니다.` };
  return { ok: true, url: u.href, host: u.hostname };
}

const OK_MIME = /^(application\/pdf|image\/(png|jpe?g|gif|webp|tiff?|bmp)|application\/(x-hwp|haansofthwp|vnd\.hancom\.hwp|vnd\.hancom\.hwpx|msword|vnd\.ms-[a-z.]+|vnd\.openxmlformats-officedocument\.[a-z.]+|zip|octet-stream)|binary\/octet-stream)$/i;
const OK_EXT = /\.(pdf|png|jpe?g|gif|webp|tiff?|bmp|hwp|hwpx|docx?|xlsx?|pptx?|zip)$/i;

export function parseDisposition(h) {
  const s = String(h || '');
  const star = /filename\*\s*=\s*(?:UTF-8|utf-8)''([^;]+)/.exec(s);
  if (star) { try { return decodeURIComponent(star[1].trim()); } catch { /* 아래로 */ } }
  const q = /filename\s*=\s*"([^"]+)"/.exec(s) || /filename\s*=\s*([^;]+)/.exec(s);
  return q ? q[1].trim() : '';
}
export function safeName(name, mime, url) {
  let n = String(name || '').replace(/[\\/:*?"<>|\u0000-\u001f]+/g, '_').trim();
  if (!n) { try { n = decodeURIComponent(new URL(url).pathname.split('/').pop() || ''); } catch { n = ''; } n = n.replace(/[\\/:*?"<>|\u0000-\u001f]+/g, '_').trim(); }
  if (!n) n = '서류';
  if (!OK_EXT.test(n)) n += /pdf/i.test(mime) ? '.pdf' : /png/i.test(mime) ? '.png' : /jpe?g/i.test(mime) ? '.jpg' : '';
  return n.slice(0, 120);
}
export function toBase64(u8) {
  let s = ''; const step = 0x8000;
  for (let i = 0; i < u8.length; i += step) s += String.fromCharCode.apply(null, u8.subarray(i, i + step));
  return btoa(s);
}

// 로그인한 사용자의 브라우저 세션(쿠키)으로 파일을 받는다. 화면(HTML)이나 오류 응답은 서류가 아니므로 돌려보낸다.
export async function fetchForNavi(fileUrl, tabUrl, fetchImpl = fetch) {
  const c = checkFileUrl(fileUrl, tabUrl);
  if (!c.ok) return c;
  let r;
  try { r = await fetchImpl(c.url, { credentials: 'include', redirect: 'follow' }); } catch (e) { return { ok: false, msg: '파일을 받지 못했습니다: ' + (e && e.message ? e.message : e) }; }
  if (!r.ok) return { ok: false, msg: `파일을 받지 못했습니다(응답 ${r.status}).` };
  const rc = checkFileUrl(r.url || c.url, tabUrl);   // 다른 사이트로 넘어갔으면 거부
  if (!rc.ok) return rc;
  const mime = String((r.headers && r.headers.get && r.headers.get('content-type')) || '').split(';')[0].trim().toLowerCase();
  const name = safeName(parseDisposition(r.headers && r.headers.get && r.headers.get('content-disposition')), mime, c.url);
  if (!OK_MIME.test(mime) && !(mime === '' && OK_EXT.test(name))) return { ok: false, msg: `서류 파일이 아닌 응답입니다(${mime || '형식 없음'}). 로그인이 풀렸거나 오류 화면일 수 있습니다.` };
  const len = Number(r.headers && r.headers.get && r.headers.get('content-length')) || 0;
  if (len > MAX_BYTES) return { ok: false, msg: `파일이 너무 큽니다(${Math.round(len / 1048576)}MB, 최대 10MB).` };
  const buf = new Uint8Array(await r.arrayBuffer());
  if (!buf.length) return { ok: false, msg: '받은 파일이 비어 있습니다.' };
  if (buf.length > MAX_BYTES) return { ok: false, msg: `파일이 너무 큽니다(${Math.round(buf.length / 1048576)}MB, 최대 10MB).` };
  if (/pdf/i.test(mime) && String.fromCharCode(...buf.subarray(0, 5)) !== '%PDF-') return { ok: false, msg: 'PDF 로 표시됐지만 PDF 파일이 아닙니다.' };
  return { ok: true, name, mime: mime || 'application/octet-stream', b64: toBase64(buf), size: buf.length };
}

// 방금 받은 파일(내려받기 기록)에서 주소를 고른다. 10분 안에 끝난 것 중 가장 최근 것.
export function pickDownload(items, now = Date.now()) {
  const list = (Array.isArray(items) ? items : []).filter((d) => d && d.state === 'complete' && !d.error && now - Date.parse(d.endTime || d.startTime || 0) < 10 * 60 * 1000);
  list.sort((a, b) => Date.parse(b.endTime || b.startTime || 0) - Date.parse(a.endTime || a.startTime || 0));
  const d = list[0];
  if (!d) return { ok: false, msg: '최근 10분 안에 내려받은 파일이 없습니다. 내려받기 단추나 링크를 먼저 누르거나, 링크 요소의 ref 를 주세요.' };
  const url = d.finalUrl || d.url || '';
  if (!/^https:/i.test(url)) return { ok: false, msg: '내려받은 파일이 화면 안에서 만든 파일(blob/data)이라 자동으로 가져올 수 없습니다. 사용자가 저장한 파일을 나비웹에 직접 올려야 합니다.' };
  return { ok: true, url, name: String(d.filename || '').split(/[\\/]/).pop() };
}
