/* naviweb-qna — 사용법 질문·답변·댓글 게시판 서버 (Cloudflare Worker + KV). 2026-11-06.
 *
 * 흐름: 이용자가 질문 → SP-NAVIWEB-MANUAL 이 매뉴얼 발췌를 근거로 먼저 답 → 그래도 해결되지 않으면 이용자가 "관리자에게 질의"
 *       → 관리자 대시보드 "사용법 질의"에 나타남 → 관리자가 링크로 열어 읽고 답 → (선택) 공개 게시판에 올려 다른 이용자도 보고 댓글.
 * 상태: open(질문 받음) → sp_answered(SP 답함) → escalated(관리자에게 질의) → answered(관리자 답함) ↔ escalated(이용자가 다시 물음) · closed(해결됨)
 * 이용자 식별: 기기가 만든 비밀 토큰(X-Qna-Owner) — 서버에는 해시만 저장한다. 계정 정보를 받지 않는다.
 * 관리자: Authorization: Bearer <ADMIN_TOKEN>(Worker secret). 토큰이 없거나 틀리면 401.
 * 개인정보: 이메일·전화·주민번호 모양·긴 숫자는 저장 전에 지운다. 이용자 글은 관리자와 본인만 본다(관리자가 공개한 글 제외).
 */
import { composeSP, LANG_NAME, SP_ID, SP_VERSION } from './SP-NAVIWEB-MANUAL.v2.js';
import { DIGEST } from './manual-digest.js';

export const LIMITS = { title: 80, text: 1200, adminText: 4000, perDayThreads: 10, perDayMsgs: 60, perDayChat: 80, chatTurns: 12, listMax: 100, spTimeoutMs: 20000 };
const ORIGINS = /^https?:\/\/([a-z0-9-]+\.)*(naviweb\.kr|hondi\.net)$|^http:\/\/localhost(:\d+)?$/i;

/** 개인정보로 보이는 것을 지우고 길이를 줄인다(feedback-kit.js 와 같은 규칙). */
export function clean(s, max) {
  let t = String(s == null ? '' : s).normalize('NFKC').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]+/g, ' ');
  t = t.replace(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g, '[이메일]').replace(/https?:\/\/\S+/gi, '[주소]')
    .replace(/\b\d{6}\s*-?\s*[1-8]\d{6}\b/g, '[번호]').replace(/\b0\d{1,2}[-\s]?\d{3,4}[-\s]?\d{4}\b/g, '[전화]').replace(/\d{7,}/g, '[번호]');
  return t.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim().slice(0, max || LIMITS.text);
}

// ── 매뉴얼 발췌 찾기 ──────────────────────────────────────
const STOP = new Set(['어떻게', '무엇', '어디', '있나요', '있어요', '하나요', '해요', '합니다', '입니다', '그리고', '그런데', '때문', '에서', '으로', '에게', '하려면', '하고', '싶어요', '알려', '주세요']);
export function shingles(s) {
  const t = String(s).normalize('NFKC').toLowerCase().replace(/[^0-9a-z가-힣]+/g, ' ').trim();
  const out = new Set();
  for (const w of t.split(' ')) {
    if (!w || STOP.has(w)) continue;
    if (w.length <= 2) { out.add(w); continue; }
    for (let i = 0; i + 2 <= w.length; i++) out.add(w.slice(i, i + 2));
  }
  return out;
}
/** 질문과 가장 겹치는 장 k개. 제목에서 겹치면 가중치 3배. 겹침이 없으면 빈 배열. */
export function retrieve(question, digest, k) {
  const q = shingles(question); if (!q.size) return [];
  const scored = (digest || DIGEST).map((c) => {
    const body = shingles(c.text), title = shingles(c.title); let s = 0;
    for (const x of q) { if (title.has(x)) s += 3; else if (body.has(x)) s += 1; }
    return { c, s };
  }).filter((x) => x.s >= 3).sort((a, b) => b.s - a.s || a.c.n - b.c.n);
  return scored.slice(0, k || 3).map((x) => x.c);
}
/** history: [{ role: 'user'|'sp'|'assistant'|'admin', text }]. ctx 는 composeSP 입력. */
export function buildMessages(history, ctx) {
  const msgs = [{ role: 'system', content: composeSP(ctx) }];
  for (const m of history) {
    if (m.role === 'user') msgs.push({ role: 'user', content: '<질문>' + m.text + '</질문>' });
    else if (m.role === 'sp' || m.role === 'assistant') msgs.push({ role: 'assistant', content: m.text });
    else if (m.role === 'admin') msgs.push({ role: 'assistant', content: '[관리자 답변] ' + m.text });
  }
  return msgs;
}
export const validLang = (l) => (Object.prototype.hasOwnProperty.call(LANG_NAME, l) ? l : 'ko');
export const chapterOf = (n) => { n = parseInt(n, 10); return n >= 1 && n <= DIGEST.length ? DIGEST[n - 1] : null; };

// ── 순수 함수: 상태·권한 ──────────────────────────────────
export const STATUS = ['open', 'sp_answered', 'escalated', 'answered', 'closed'];
/** 관리자에게 질의할 수 있는가: SP 가 먼저 답했거나(sp 메시지가 있음), SP 를 쓸 수 없었던 경우에만. 이미 접수된 건은 중복 접수하지 않는다. */
export function canEscalate(thread) {
  if (!thread || thread.status === 'escalated' || thread.status === 'closed') return false;
  return thread.msgs.some((m) => m.role === 'sp') || thread.spStatus === 'unavailable' || thread.spStatus === 'error' || thread.status === 'answered';
}
export function summary(t) {
  return { id: t.id, title: t.title, status: t.status, vis: t.vis, created: t.created, updated: t.updated, n: t.msgs.filter((m) => !m.hidden).length, escalated: t.escalated || null };
}
/** 보는 사람에게 맞춰 다듬은 글타래. owner 해시는 절대 내보내지 않는다. */
export function view(t, who) {
  const msgs = t.msgs.filter((m) => who.admin || !m.hidden).map((m) => ({ id: m.id, role: m.role, text: m.text, at: m.at, name: m.name || null, hidden: !!m.hidden }));
  return { ...summary(t), spStatus: t.spStatus || null, mine: !!who.mine, canEscalate: !!who.mine && canEscalate(t), msgs };
}

// ── 저장소 ────────────────────────────────────────────────
const keyOf = (id) => 't:' + id;
async function load(env, id) { return env.QNA.get(keyOf(id), 'json'); }
async function save(env, t) {
  await env.QNA.put(keyOf(t.id), JSON.stringify(t), { metadata: { s: t.status, u: t.updated, v: t.vis, o: t.owner.slice(0, 16), t: t.title.slice(0, 60), c: t.created, e: t.escalated || '' } });
}
async function listAll(env, pred) {
  const out = []; let cursor;
  for (let i = 0; i < 20; i++) {
    const r = await env.QNA.list({ prefix: 't:', cursor });
    for (const k of r.keys) { const m = k.metadata || {}; if (pred(m)) out.push({ id: k.name.slice(2), m }); }
    if (r.list_complete) break; cursor = r.cursor;
  }
  return out;
}
export async function hashOwner(token) {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('naviweb-qna:' + token));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
async function quota(env, owner, kind, limit, today) {
  const k = 'r:' + owner.slice(0, 16) + ':' + today + ':' + kind, n = parseInt((await env.QNA.get(k)) || '0', 10) || 0;
  if (n >= limit) return false;
  await env.QNA.put(k, String(n + 1), { expirationTtl: 172800 }); return true;
}

// ── SP 호출(OpenAI 호환 chat completions) ─────────────────
/** 반환: { ok, text } | { ok:false, why:'unavailable'|'error' }. SP_API_URL·SP_API_KEY 가 없으면 unavailable. */
export async function callLLM(env, messages, deps) {
  if (!env.SP_API_URL || !env.SP_API_KEY) return { ok: false, why: 'unavailable' };
  const body = { model: env.SP_MODEL || 'deepseek-chat', temperature: 0.2, max_tokens: 700, messages };
  try {
    const f = (deps && deps.fetch) || fetch;
    const res = await f(env.SP_API_URL, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + env.SP_API_KEY }, body: JSON.stringify(body), signal: AbortSignal.timeout(LIMITS.spTimeoutMs) });
    if (!res.ok) return { ok: false, why: 'error' };
    const j = await res.json(); const text = clean(j && j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content, 2000);
    return text ? { ok: true, text } : { ok: false, why: 'error' };
  } catch (e) { return { ok: false, why: 'error' }; }
}
/** 질문·답변 게시판 글의 도우미 답. 질문과 겹치는 장을 찾아 붙인다. */
export async function askSP(env, thread, deps) {
  const users = thread.msgs.filter((m) => m.role === 'user').map((m) => m.text).join(' ');
  const chapters = retrieve(users, DIGEST, 3);
  const r = await callLLM(env, buildMessages(thread.msgs, { lang: thread.lang, chapter: null, escalated: thread.status === 'escalated' || thread.status === 'answered', chapters }), deps);
  return r.ok ? { ok: true, text: r.text, ref: chapters.map((c) => c.n) } : r;
}

// ── HTTP ──────────────────────────────────────────────────
export function corsHeaders(origin) {
  const h = { Vary: 'Origin' };
  if (origin && ORIGINS.test(origin)) { h['Access-Control-Allow-Origin'] = origin; h['Access-Control-Allow-Headers'] = 'Content-Type, Authorization, X-Qna-Owner'; h['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS'; h['Access-Control-Max-Age'] = '86400'; }
  return h;
}
function json(data, status, origin) { return new Response(JSON.stringify(data), { status: status || 200, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...corsHeaders(origin) } }); }
const err = (code, status, origin) => json({ ok: false, error: code }, status, origin);
function safeEq(a, b) { a = String(a); b = String(b); if (a.length !== b.length) return false; let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i); return d === 0; }
function isAdmin(request, env) { const m = /^Bearer (.+)$/.exec(request.headers.get('Authorization') || ''); return !!(env.ADMIN_TOKEN && m && safeEq(m[1], env.ADMIN_TOKEN)); }
const newId = (now) => 'q' + now.toString(36) + Math.random().toString(36).slice(2, 6);
const mid = () => 'm' + Math.random().toString(36).slice(2, 8);
const anon = (owner) => '이용자 ' + owner.slice(0, 4);

/** 대화창이 보낸 대화를 검사·정리한다. 마지막이 user 여야 하는 /chat 과 달리 escalate-chat 은 assistant 로 끝나도 된다. 형식이 틀리면 null. */
export function chatHistory(arr) {
  if (!Array.isArray(arr)) return null;
  const out = [];
  for (const m of arr.slice(-LIMITS.chatTurns)) {
    if (!m || (m.role !== 'user' && m.role !== 'assistant')) return null;
    const text = clean(m.content != null ? m.content : m.text, m.role === 'assistant' ? 2000 : LIMITS.text); if (!text) return null;
    out.push({ role: m.role, text });
  }
  while (out.length && out[0].role !== 'user') out.shift();
  return out.length && out.some((x) => x.role === 'user') ? out : null;
}

export async function handle(request, env, deps) {
  deps = deps || {};
  const now = deps.now ? deps.now() : Date.now(), iso = new Date(now).toISOString(), today = iso.slice(0, 10), origin = request.headers.get('Origin');
  const url = new URL(request.url), path = url.pathname.replace(/^\/api\/qna/, '').replace(/\/+$/, '') || '/';
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(origin) });
  const method = request.method;
  const body = method === 'POST' ? await request.json().catch(() => ({})) : {};
  let m;

  // ── 관리자 ──
  if (path.startsWith('/admin')) {
    if (!isAdmin(request, env)) return err('unauthorized', 401, origin);
    if (method === 'GET' && path === '/admin/threads') {
      const want = url.searchParams.get('status') || 'escalated';
      const rows = (await listAll(env, (x) => want === 'all' || x.s === want)).sort((a, b) => String(b.m.e || b.m.u).localeCompare(String(a.m.e || a.m.u))).slice(0, LIMITS.listMax);
      return json({ ok: true, threads: rows.map((r) => ({ id: r.id, title: r.m.t, status: r.m.s, vis: r.m.v, created: r.m.c, updated: r.m.u, escalated: r.m.e || null })) }, 200, origin);
    }
    if ((m = /^\/admin\/threads\/([\w-]+)$/.exec(path)) && method === 'GET') {
      const t = await load(env, m[1]); if (!t) return err('not_found', 404, origin);
      return json({ ok: true, thread: view(t, { admin: true }) }, 200, origin);
    }
    if ((m = /^\/admin\/threads\/([\w-]+)\/(answer|visibility|hide)$/.exec(path)) && method === 'POST') {
      const t = await load(env, m[1]); if (!t) return err('not_found', 404, origin);
      if (m[2] === 'answer') {
        const text = clean(body.text, LIMITS.adminText); if (!text) return err('empty', 400, origin);
        t.msgs.push({ id: mid(), role: 'admin', text, at: iso, name: '관리자' });
        t.status = 'answered'; t.updated = iso; if (body.publish) t.vis = 'public';
      } else if (m[2] === 'visibility') {
        if (body.vis !== 'public' && body.vis !== 'private') return err('invalid', 400, origin);
        t.vis = body.vis; t.updated = iso;
      } else {
        const msg = t.msgs.find((x) => x.id === body.msgId); if (!msg) return err('not_found', 404, origin);
        msg.hidden = body.hidden !== false; t.updated = iso;
      }
      await save(env, t); return json({ ok: true, thread: view(t, { admin: true }) }, 200, origin);
    }
    return err('not_found', 404, origin);
  }

  // ── 공개 게시판 ──
  if (method === 'GET' && path === '/public') {
    const rows = (await listAll(env, (x) => x.v === 'public')).sort((a, b) => String(b.m.u).localeCompare(String(a.m.u))).slice(0, LIMITS.listMax);
    return json({ ok: true, threads: rows.map((r) => ({ id: r.id, title: r.m.t, status: r.m.s, vis: 'public', created: r.m.c, updated: r.m.u })) }, 200, origin);
  }

  // ── 이용자(소유 토큰) ──
  const token = request.headers.get('X-Qna-Owner') || '';
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(token)) return err('owner_required', 401, origin);
  const owner = await hashOwner(token);

  if (method === 'POST' && path === '/chat') {   // 사용법 페이지 대화창 — 저장하지 않는다(대화는 브라우저 메모리에만)
    const hist = chatHistory(body.messages); if (!hist || hist[hist.length - 1].role !== 'user') return err('empty', 400, origin);
    if (!(await quota(env, owner, 'chat', LIMITS.perDayChat, today))) return err('limit', 429, origin);
    const ch = chapterOf(body.chapter), q = hist.filter((x) => x.role === 'user').slice(-2).map((x) => x.text).join(' ') + (ch ? ' ' + ch.title : '');
    const chapters = retrieve(q, DIGEST, 3);
    const r = await callLLM(env, buildMessages(hist, { lang: validLang(body.lang), chapter: ch, escalated: false, chapters }), deps);
    return r.ok ? json({ ok: true, reply: r.text, ref: chapters.map((c) => c.n) }, 200, origin) : err(r.why === 'unavailable' ? 'sp_unavailable' : 'sp_error', 503, origin);
  }
  if (method === 'POST' && path === '/threads/escalate-chat') {   // 대화창에서 "관리자에게 질의" — 지금까지의 대화를 글로 만들어 바로 접수
    const hist = chatHistory(body.messages); if (!hist || !hist.some((x) => x.role === 'assistant')) return err('cannot_escalate', 409, origin);
    if (!(await quota(env, owner, 'thread', LIMITS.perDayThreads, today))) return err('limit', 429, origin);
    const first = hist.find((x) => x.role === 'user');
    const t = { id: newId(now), owner, title: clean(first.text, LIMITS.title) || '(제목 없음)', status: 'escalated', vis: 'private', created: iso, updated: iso, escalated: iso, lang: validLang(body.lang), spStatus: 'ok', via: 'chat',
      msgs: hist.map((x) => ({ id: mid(), role: x.role === 'assistant' ? 'sp' : 'user', text: x.text, at: iso, name: x.role === 'assistant' ? '나비웹 도우미' : undefined })) };
    const note = clean(body.note, 600); if (note) t.msgs.push({ id: mid(), role: 'user', text: note, at: iso });
    t.msgs.push({ id: mid(), role: 'system', text: '관리자에게 질의했습니다.', at: iso });
    await save(env, t); return json({ ok: true, thread: view(t, { mine: true }) }, 200, origin);
  }
  if (method === 'GET' && path === '/threads/mine') {
    const rows = (await listAll(env, (x) => x.o === owner.slice(0, 16))).sort((a, b) => String(b.m.u).localeCompare(String(a.m.u))).slice(0, LIMITS.listMax);
    return json({ ok: true, threads: rows.map((r) => ({ id: r.id, title: r.m.t, status: r.m.s, vis: r.m.v, created: r.m.c, updated: r.m.u, escalated: r.m.e || null })) }, 200, origin);
  }
  if (method === 'POST' && path === '/threads') {
    const text = clean(body.text, LIMITS.text); if (text.length < 2) return err('empty', 400, origin);
    if (!(await quota(env, owner, 'thread', LIMITS.perDayThreads, today))) return err('limit', 429, origin);
    const title = clean(body.title || text, LIMITS.title) || '(제목 없음)';
    const t = { id: newId(now), owner, title, status: 'open', vis: 'private', created: iso, updated: iso, lang: validLang(body.lang), spStatus: null, msgs: [{ id: mid(), role: 'user', text, at: iso }] };
    await spRound(env, t, deps, iso, mid); await save(env, t);
    return json({ ok: true, thread: view(t, { mine: true }) }, 200, origin);
  }
  if ((m = /^\/threads\/([\w-]+)$/.exec(path)) && method === 'GET') {
    const t = await load(env, m[1]); if (!t) return err('not_found', 404, origin);
    const mine = t.owner === owner; if (!mine && t.vis !== 'public') return err('not_found', 404, origin);
    return json({ ok: true, thread: view(t, { mine }) }, 200, origin);
  }
  if ((m = /^\/threads\/([\w-]+)\/(messages|escalate|resolve|comments)$/.exec(path)) && method === 'POST') {
    const t = await load(env, m[1]); if (!t) return err('not_found', 404, origin);
    const mine = t.owner === owner;
    if (m[2] === 'comments') {   // 공개 글에는 누구나(소유 토큰이 있는 이용자) 댓글
      if (t.vis !== 'public') return err('not_found', 404, origin);
      const text = clean(body.text, 600); if (!text) return err('empty', 400, origin);
      if (!(await quota(env, owner, 'msg', LIMITS.perDayMsgs, today))) return err('limit', 429, origin);
      t.msgs.push({ id: mid(), role: 'comment', text, at: iso, name: anon(owner) }); t.updated = iso;
      await save(env, t); return json({ ok: true, thread: view(t, { mine }) }, 200, origin);
    }
    if (!mine) return err('not_found', 404, origin);
    if (m[2] === 'resolve') { t.status = 'closed'; t.updated = iso; await save(env, t); return json({ ok: true, thread: view(t, { mine }) }, 200, origin); }
    if (m[2] === 'escalate') {
      if (!canEscalate(t)) return err('cannot_escalate', 409, origin);
      const note = clean(body.note, 600);
      if (note) t.msgs.push({ id: mid(), role: 'user', text: note, at: iso });
      t.msgs.push({ id: mid(), role: 'system', text: '관리자에게 질의했습니다.', at: iso });
      t.status = 'escalated'; t.escalated = iso; t.updated = iso;
      await save(env, t); return json({ ok: true, thread: view(t, { mine }) }, 200, origin);
    }
    // messages — 추가 질문/답장
    const text = clean(body.text, LIMITS.text); if (!text) return err('empty', 400, origin);
    if (!(await quota(env, owner, 'msg', LIMITS.perDayMsgs, today))) return err('limit', 429, origin);
    t.msgs.push({ id: mid(), role: 'user', text, at: iso }); t.updated = iso;
    if (t.status === 'escalated') { /* 관리자 대기 중 — 글만 덧붙인다 */ }
    else if (t.status === 'answered') { t.status = 'escalated'; t.escalated = iso; }   // 관리자 답에 다시 물으면 다시 접수
    else await spRound(env, t, deps, iso, mid);
    await save(env, t); return json({ ok: true, thread: view(t, { mine }) }, 200, origin);
  }
  return err('not_found', 404, origin);
}

async function spRound(env, t, deps, iso, mid) {
  const r = await askSP(env, t, deps);
  if (r.ok) { t.msgs.push({ id: mid(), role: 'sp', text: r.text, at: new Date().toISOString(), name: '나비웹 도우미', ref: r.ref }); t.status = 'sp_answered'; t.spStatus = 'ok'; }
  else { t.spStatus = r.why; if (t.status === 'open') t.status = 'open'; }
  t.updated = iso;
}

export default { fetch: (request, env) => handle(request, env) };
export const meta = { SP_ID, SP_VERSION };
