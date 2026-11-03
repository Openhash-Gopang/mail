// 게이트웨이(/v1/ticket)가 발급한 세션 티켓 검증. 형식: "<payload b64url>.<HMAC-SHA256 b64url>", payload = { sub, exp(초), jti }.
import crypto from 'node:crypto';

export function sign(payload, secret) {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return body + '.' + crypto.createHmac('sha256', secret).update(body).digest('base64url');
}

const used = new Map(); // jti -> exp (한 번만 쓸 수 있다)
export function verify(ticket, secret, now = Math.floor(Date.now() / 1000)) {
  if (!secret || typeof ticket !== 'string') return null;
  const [body, sig] = ticket.split('.');
  if (!body || !sig) return null;
  const want = crypto.createHmac('sha256', secret).update(body).digest('base64url');
  const a = Buffer.from(sig), b = Buffer.from(want);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  let p; try { p = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')); } catch { return null; }
  if (!p || !p.sub || !p.jti || typeof p.exp !== 'number' || p.exp < now) return null;
  for (const [k, e] of used) if (e < now) used.delete(k);
  if (used.has(p.jti)) return null;
  used.set(p.jti, p.exp);
  return p;
}
