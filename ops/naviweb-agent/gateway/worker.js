// naviweb-agent-gateway — 에이전트(브라우저 확장)와 LLM 사이의 얇은 중계.
// 확장은 항상 Anthropic Messages 형식(content 블록: text / tool_use / tool_result / image)으로 말하고,
// 여기서 provider 에 따라 Claude(그대로) 또는 Gemma 4 31B(OpenAI 호환 /chat/completions)로 바꿔 보낸다.
// 키는 Worker 비밀값에만 둔다. 확장에는 절대 넣지 않는다.
//
// 환경변수(wrangler secret / vars)
//   AGENT_TOKEN        확장이 보내는 Bearer 토큰(필수)
//   ALLOWED_ORIGINS    쉼표 구분. 예: chrome-extension://<확장ID>  (비우면 Origin 검사 생략)
//   DEFAULT_PROVIDER   claude | gemma  (기본 claude)
//   ANTHROPIC_API_KEY, CLAUDE_MODEL(기본 claude-haiku-5-5)
//   MAX_INPUT_TOKENS   요청 1건의 입력 상한(기본 90000, 최대 95000). Haiku 5.5 는 10만 토큰을 넘으면 모든 요율이 5배라 반드시 아래로 유지한다.
//   GEMMA_BASE_URL (예: https://<호스트>/v1), GEMMA_API_KEY, GEMMA_MODEL(기본 google/gemma-4-31B-it)

const MAX_BODY = 6 * 1024 * 1024;
const MAX_MESSAGES = 120;
const MAX_TOKENS_CAP = 4096;
export const HARD_LIMIT = 95000;      // 어떤 설정에서도 이 값을 넘기지 않는다(10만 토큰 경계 아래 여유)
export const DEFAULT_LIMIT = 90000;
const IMG_TOKENS = 1600;
const TOOL_TEXT_CAP = 3000, LAST_TOOL_TEXT_CAP = 6000;

const json = (o, status = 200, h = {}) =>
  new Response(JSON.stringify(o), { status, headers: { 'content-type': 'application/json; charset=utf-8', ...h } });

// ---- 입력 크기 강제 ----------------------------------------------------------
const tok = (str) => { let a = 0, n = 0; for (const ch of String(str)) (ch.charCodeAt(0) < 128 ? a++ : n++); return a * 0.4 + n; };
export function estimateTokens(req) {
  let t = tok(req.system || '') + tok(JSON.stringify(req.tools || []));
  for (const m of req.messages || []) {
    if (typeof m.content === 'string') { t += tok(m.content) + 4; continue; }
    for (const b of m.content) {
      if (b.type === 'text') t += tok(b.text);
      else if (b.type === 'image') t += IMG_TOKENS;
      else if (b.type === 'tool_use') t += tok(JSON.stringify(b.input || {})) + tok(b.name) + 8;
      else if (b.type === 'tool_result') {
        const c = Array.isArray(b.content) ? b.content : [{ type: 'text', text: String(b.content ?? '') }];
        for (const x of c) t += x.type === 'image' ? IMG_TOKENS : tok(x.text || '');
        t += 8;
      }
    }
    t += 4;
  }
  return Math.ceil(t);
}
const limitOf = (env) => Math.min(Number(env && env.MAX_INPUT_TOKENS) || DEFAULT_LIMIT, HARD_LIMIT);
const clone = (o) => JSON.parse(JSON.stringify(o));
function shrinkResults(messages, capLast, capOld) {
  messages.forEach((m, mi) => {
    if (!Array.isArray(m.content)) return;
    const last = mi === messages.length - 1;
    for (const b of m.content) {
      if (b.type !== 'tool_result' || !Array.isArray(b.content)) continue;
      b.content = b.content.map((x) => {
        if (x.type === 'image') return last ? x : { type: 'text', text: '[이전 스크린샷 생략]' };
        const cap = last ? capLast : capOld;
        return x.text && x.text.length > cap ? { ...x, text: x.text.slice(0, cap) + '\n…(잘림)' } : x;
      });
    }
  });
}
// 한도 안으로 줄인다: 오래된 결과 자르기 → 오래된 스크린샷 제거 → 가장 오래된 (assistant,user) 쌍부터 삭제 → 마지막 결과 더 자르기.
// 줄일 수 없으면 { error } 를 돌려준다.
export function fitToLimit(req, limit = DEFAULT_LIMIT) {
  limit = Math.min(limit, HARD_LIMIT);
  const r = clone(req); let dropped = 0;
  shrinkResults(r.messages, LAST_TOOL_TEXT_CAP, TOOL_TEXT_CAP);
  while (estimateTokens(r) > limit && r.messages.length > 3) { r.messages.splice(1, 2); dropped += 2; }
  if (dropped && Array.isArray(r.messages[0].content)) r.messages[0].content.push({ type: 'text', text: `[이전 단계 ${dropped / 2}개는 크기 제한으로 생략됨. 필요하면 read_page 로 다시 확인하세요.]` });
  if (estimateTokens(r) > limit) shrinkResults(r.messages, 2000, 800);
  const est = estimateTokens(r);
  if (est > limit) return { error: 'context_too_large', est, limit };
  return { req: r, est, dropped, limit };
}

export function toOpenAI(req, model) {
  const msgs = [];
  if (req.system) msgs.push({ role: 'system', content: req.system });
  for (const m of req.messages || []) {
    if (typeof m.content === 'string') { msgs.push({ role: m.role, content: m.content }); continue; }
    if (m.role === 'assistant') {
      const text = m.content.filter((b) => b.type === 'text').map((b) => b.text).join('\n');
      const calls = m.content.filter((b) => b.type === 'tool_use').map((b) => ({
        id: b.id, type: 'function', function: { name: b.name, arguments: JSON.stringify(b.input || {}) },
      }));
      const o = { role: 'assistant', content: text || null };
      if (calls.length) o.tool_calls = calls;
      msgs.push(o);
      continue;
    }
    const parts = [];
    const img = (im) => ({ type: 'image_url', image_url: { url: `data:${im.source.media_type};base64,${im.source.data}` } });
    for (const b of m.content) {
      if (b.type === 'tool_result') {
        const c = Array.isArray(b.content) ? b.content : [{ type: 'text', text: String(b.content ?? '') }];
        const text = c.filter((x) => x.type === 'text').map((x) => x.text).join('\n');
        msgs.push({ role: 'tool', tool_call_id: b.tool_use_id, content: text || '(ok)' });
        for (const im of c.filter((x) => x.type === 'image')) parts.push(img(im));
      } else if (b.type === 'text') parts.push({ type: 'text', text: b.text });
      else if (b.type === 'image') parts.push(img(b));
    }
    if (parts.length) msgs.push({ role: 'user', content: parts });
  }
  const body = { model, messages: msgs, max_tokens: Math.min(req.max_tokens || 2048, MAX_TOKENS_CAP) };
  if (req.tools && req.tools.length) {
    body.tools = req.tools.map((t) => ({ type: 'function', function: { name: t.name, description: t.description, parameters: t.input_schema } }));
    body.tool_choice = 'auto';
  }
  return body;
}

export function fromOpenAI(resp) {
  const ch = resp && resp.choices && resp.choices[0];
  if (!ch) return { content: [{ type: 'text', text: '' }], stop_reason: 'end_turn' };
  const msg = ch.message || {};
  const content = [];
  if (msg.content) content.push({ type: 'text', text: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content) });
  for (const c of msg.tool_calls || []) {
    let input = {};
    try { input = JSON.parse(c.function.arguments || '{}'); } catch { input = { _raw: c.function.arguments }; }
    content.push({ type: 'tool_use', id: c.id, name: c.function.name, input });
  }
  if (!content.length) content.push({ type: 'text', text: '' });
  return { content, stop_reason: (msg.tool_calls || []).length ? 'tool_use' : 'end_turn', usage: resp.usage };
}

function cors(req, env) {
  const origin = req.headers.get('Origin') || '';
  const allowed = (env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
  const ok = !allowed.length || allowed.includes(origin);
  return { ok, headers: ok && origin ? { 'access-control-allow-origin': origin, vary: 'Origin' } : {} };
}

async function countClaude(req, env) {
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages/count_tokens', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: env.CLAUDE_MODEL || 'claude-haiku-5-5', system: req.system, messages: req.messages, tools: req.tools }),
    });
    const j = await r.json();
    return r.ok && Number.isFinite(j.input_tokens) ? j.input_tokens : null;
  } catch { return null; }
}

// 추정치로 줄인 뒤, 한도에 가까우면 정확한 토큰 수로 다시 확인하고 부족하면 더 줄인다(Claude 만 해당).
export async function enforceLimit(req, env, provider, count = countClaude) {
  const limit = limitOf(env);
  let fit = fitToLimit(req, limit);
  if (fit.error) return fit;
  if (provider !== 'claude' || fit.est < limit * 0.6) return fit;
  for (let i = 0; i < 3; i++) {
    const exact = await count(fit.req, env);
    if (exact === null) return fit.est < limit * 0.85 ? fit : { error: 'count_unavailable', est: fit.est, limit };
    fit.exact = exact;
    if (exact <= limit) return fit;
    const next = fitToLimit(fit.req, Math.floor(fit.est * (limit / exact) * 0.95));
    if (next.error) return { error: 'context_too_large', est: exact, limit };
    next.dropped += fit.dropped; fit = next;
  }
  return { error: 'context_too_large', est: fit.exact, limit };
}

// Anthropic 프롬프트 캐시: 도구 목록, 시스템 지시문, 그리고 대화의 마지막 두 사용자 메시지 끝에 경계(cache_control)를 둔다.
// 에이전트는 매 단계 같은 앞부분에 새 내용만 덧붙이므로, 이전 단계의 경계까지 캐시가 적중한다(읽기 요금은 입력의 1/10).
// 경계는 최대 4개: tools 1 + system 1 + messages 2. 원본은 바꾸지 않고 복사해서 돌려준다.
export function withCache(req) {
  const mark = { type: 'ephemeral' };
  const out = { system: req.system, tools: req.tools, messages: req.messages };
  if (Array.isArray(req.tools) && req.tools.length) out.tools = req.tools.map((t, i, a) => (i === a.length - 1 ? { ...t, cache_control: mark } : t));
  if (typeof req.system === 'string' && req.system) out.system = [{ type: 'text', text: req.system, cache_control: mark }];
  const msgs = (req.messages || []).map((m) => ({ ...m }));
  const users = msgs.map((m, i) => (m.role === 'user' ? i : -1)).filter((i) => i >= 0);
  for (const i of users.slice(-2)) {
    const m = msgs[i];
    const blocks = typeof m.content === 'string' ? [{ type: 'text', text: m.content }] : (m.content || []).map((b) => ({ ...b }));
    let k = blocks.length - 1;
    while (k >= 0 && blocks[k].type === 'text' && !blocks[k].text) k--;
    if (k < 0) continue;
    blocks[k] = { ...blocks[k], cache_control: mark };
    m.content = blocks;
  }
  out.messages = msgs;
  return out;
}

async function callClaude(req, env) {
  const cached = env.PROMPT_CACHE === 'off' ? { system: req.system, tools: req.tools, messages: req.messages } : withCache(req);
  const body = {
    model: env.CLAUDE_MODEL || 'claude-haiku-5-5',
    max_tokens: Math.min(req.max_tokens || 2048, MAX_TOKENS_CAP),
    system: cached.system, messages: cached.messages, tools: cached.tools,
  };
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify(body),
  });
  const j = await r.json();
  if (!r.ok) return { error: j, status: r.status };
  const u = j.usage || {};
  const cache = { read: u.cache_read_input_tokens || 0, write: u.cache_creation_input_tokens || 0, fresh: u.input_tokens || 0 };
  return { out: { content: j.content, stop_reason: j.stop_reason, usage: j.usage, cache } };
}

async function callGemma(req, env) {
  const base = (env.GEMMA_BASE_URL || '').replace(/\/$/, '');
  if (!base) return { error: { message: 'GEMMA_BASE_URL 미설정' }, status: 500 };
  const r = await fetch(base + '/chat/completions', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: 'Bearer ' + (env.GEMMA_API_KEY || '') },
    body: JSON.stringify(toOpenAI(req, env.GEMMA_MODEL || 'google/gemma-4-31B-it')),
  });
  const j = await r.json();
  if (!r.ok) return { error: j, status: r.status };
  return { out: fromOpenAI(j) };
}

// 누가 요청했는지 확인한다. 운영자 토큰이면 운영자, 아니면 AUTH_VERIFY_URL(나비웹 로그인 확인 주소)에 같은 Authorization 을 보내
// 200 이면 로그인한 사용자. AUTH_VERIFY_URL 이 없으면 운영자 토큰만 통과한다(기본 거부). 응답 JSON 의 id/guid/user_id/sub/mail_id 중 첫 값이 사용자 식별자.
export async function whoIs(request, env, why) {   // why: 거절 이유를 받을 빈 객체(선택) — { r: 'no_verify_url' | 'no_token_header' | … }. 값(토큰)은 담지 않는다
  const auth = request.headers.get('authorization') || '';
  if (env.AGENT_TOKEN && auth === 'Bearer ' + env.AGENT_TOKEN) return { sub: 'operator', operator: true };
  // 나비웹 로그인 토큰은 한글이 섞여 있어 HTTP 헤더에 그대로 못 싣는다. 확장이 encodeURIComponent 한 값을 X-Navi-Token 으로 보내고,
  // 여기서 풀어 나비웹 인증 서버에 쿼리(phone_verify_token)로 전달한다(나비웹 KAuth 와 같은 방식).
  const enc = request.headers.get('x-navi-token') || '';
  const no = (r) => { if (why) why.r = r; return null; };
  if (!env.AUTH_VERIFY_URL) return no('no_verify_url');
  if (!enc) return no(auth ? 'operator_token_mismatch_and_no_user_token' : 'no_token_header');
  if (enc.length > 6000) return no('token_too_long');
  let tok; try { tok = decodeURIComponent(enc); } catch { return no('bad_token_encoding'); }
  try {
    const u = new URL(env.AUTH_VERIFY_URL); u.searchParams.set(env.AUTH_VERIFY_PARAM || 'phone_verify_token', tok);
    const r = await fetch(u.toString());
    if (!r.ok) return no('verify_http_' + r.status);
    const j = await r.json().catch(() => ({}));
    const sub = j.id || j.guid || j.user_id || j.sub || j.mail_id || j.kmail_address || (j.user && (j.user.id || j.user.guid));
    return sub ? { sub: String(sub).slice(0, 80) } : no('verify_no_id');
  } catch (e) { return no('verify_fetch_error'); }
}
// 사용자별 하루 단계 수 제한(이 실행 환경 안에서의 최선 노력. 전체 상한은 Cloudflare 속도 제한 규칙과 Anthropic 지출 한도로 둔다).
const usage = new Map();
function overQuota(sub, env) {
  const day = new Date().toISOString().slice(0, 10), max = Number(env.USER_DAILY_STEPS || 400);
  const u = usage.get(sub);
  if (!u || u.day !== day) { if (usage.size > 5000) usage.clear(); usage.set(sub, { day, n: 1 }); return false; }
  return ++u.n > max;
}

export default {
  async fetch(request, env) {
    const c = cors(request, env);
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: c.ok ? 204 : 403, headers: { ...c.headers, 'access-control-allow-headers': 'authorization, content-type, x-navi-token', 'access-control-allow-methods': 'POST, OPTIONS', 'access-control-max-age': '86400' } });
    }
    const url = new URL(request.url);
    if (url.pathname === '/health') return json({ ok: true, provider: env.DEFAULT_PROVIDER || 'claude', auth_verify: !!env.AUTH_VERIFY_URL, operator_token: !!env.AGENT_TOKEN, v: 2 }, 200, c.headers);   // 설정 여부(참/거짓)만 — 값은 내보내지 않는다
    if (url.pathname !== '/v1/step' || request.method !== 'POST') return json({ error: 'not_found' }, 404, c.headers);
    if (!c.ok) return json({ error: 'origin_not_allowed' }, 403);
    const why = {};
    const who = await whoIs(request, env, why);
    if (!who) return json({ error: 'unauthorized', reason: why.r || '' }, 401, c.headers);
    if (!who.operator && overQuota(who.sub, env)) return json({ error: 'daily_limit' }, 429, c.headers);
    const len = Number(request.headers.get('content-length') || 0);
    if (len > MAX_BODY) return json({ error: 'too_large' }, 413, c.headers);
    let req;
    try { req = await request.json(); } catch { return json({ error: 'bad_json' }, 400, c.headers); }
    if (!Array.isArray(req.messages) || !req.messages.length || req.messages.length > MAX_MESSAGES) return json({ error: 'bad_messages' }, 400, c.headers);
    const provider = req.provider || env.DEFAULT_PROVIDER || 'claude';
    if (provider !== 'claude' && provider !== 'gemma') return json({ error: 'bad_provider' }, 400, c.headers);
    const fit = await enforceLimit(req, env, provider);
    if (fit.error) return json({ error: fit.error, estimate: fit.est, limit: fit.limit }, 413, c.headers);
    req = fit.req;
    const res = provider === 'gemma' ? await callGemma(req, env) : await callClaude(req, env);
    if (res.error) return json({ error: 'upstream', status: res.status, detail: res.error }, 502, c.headers);
    return json({ ...res.out, provider, input_estimate: fit.exact ?? fit.est, trimmed: fit.dropped }, 200, c.headers);
  },
};
