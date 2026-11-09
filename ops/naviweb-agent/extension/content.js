// 페이지 안에서 도구를 실행한다. 요소는 ref_N 으로만 가리킨다(좌표 클릭을 쓰지 않는다).
(() => {
  if (window.__naviAgentV === 5) return;
  const refs = new Map(); let seq = 0;
  const SEL = 'a,button,input,select,textarea,label,area,img[alt],[role=button],[role=link],[role=checkbox],[role=radio],[role=tab],[tabindex],[onclick]';
  const PTR = 'span,div,li,td,img,i';
  const clean = (s) => String(s || '').replace(/\s+/g, ' ').trim();
  const visible = (el) => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none'; };
  const nameOf = (el) => clean(el.getAttribute('aria-label') || (el.labels && el.labels[0] && el.labels[0].innerText) || el.placeholder || el.title || el.alt
    || (el.tagName === 'INPUT' && /button|submit/.test(el.type) ? el.value : '') || el.innerText || el.textContent || (el.querySelector && el.querySelector('img') && (el.querySelector('img').alt || el.querySelector('img').title)) || el.getAttribute('value') || el.name || el.id).slice(0, 80);
  const kind = (el) => el.tagName === 'INPUT' ? `input[${el.type}]` : el.tagName === 'SELECT' ? 'select' : (el.getAttribute('role') || el.tagName.toLowerCase());
  function refOf(el) { for (const [k, v] of refs) if (v === el) return k; const k = 'ref_' + (++seq); refs.set(k, el); return k; }
  function describe(el) {
    return { tag: el.tagName.toLowerCase(), type: el.type || '', name: el.name || el.id || '', label: nameOf(el), text: nameOf(el), autocomplete: el.autocomplete || '', host: location.hostname };
  }
  function candidates(root) {
    const base = root || document;
    const set = new Set(base.querySelectorAll(SEL));
    for (const el of base.querySelectorAll(PTR)) {
      if (set.has(el) || el.closest('a,button,[onclick]')) continue;
      if ((el.innerText || '').length > 30 && el.tagName !== 'IMG') continue;
      try { if (getComputedStyle(el).cursor === 'pointer') set.add(el); } catch (e) { /* skip */ }
    }
    return [...set];
  }
  // 화면 가운데를 덮은 팝업(고정 위치 + 큰 크기)이 있으면 그 문구 앞부분을 돌려준다. 없으면 ''.
  function overlayText() {
    try {
      let el = document.elementFromPoint(innerWidth / 2, innerHeight / 2);
      for (let i = 0; el && el !== document.body && el !== document.documentElement && i < 30; i++, el = el.parentElement) {
        const cs = getComputedStyle(el);
        if ((cs.position === 'fixed' || el.getAttribute('role') === 'dialog' || el.getAttribute('aria-modal') === 'true') && el.offsetWidth >= innerWidth * 0.3 && el.offsetHeight >= innerHeight * 0.2) return clean(el.innerText).slice(0, 80);
      }
    } catch (e) { /* skip */ }
    return '';
  }
  function list(filter, root) {
    const vh = window.innerHeight; const inView = []; const rest = [];
    for (const el of candidates(root)) {
      if (!visible(el)) continue;
      const n = nameOf(el);
      if (filter && !(n.toLowerCase().includes(filter) || (el.name || '').toLowerCase().includes(filter) || (el.id || '').toLowerCase().includes(filter))) continue;
      const r = el.getBoundingClientRect();
      (r.bottom > 0 && r.top < vh ? inView : rest).push([el, n]);
    }
    const out = []; let chars = 0; let skipped = 0;
    for (const [el, n] of [...inView, ...rest]) {
      let line = `${refOf(el)} ${kind(el)} "${n}"`;
      if (el.tagName === 'INPUT' && /checkbox|radio/.test(el.type)) line += el.checked ? ' [선택됨]' : ' [해제]';
      else if (el.tagName === 'SELECT') line += ` 값="${clean(el.options[el.selectedIndex] && el.options[el.selectedIndex].text)}" 옵션=[${[...el.options].slice(0, 40).map((o) => clean(o.text)).join(' | ')}]`;
      else if (el.tagName === 'INPUT' && el.type !== 'password' && el.value && !/button|submit|radio|checkbox/.test(el.type)) line += ` 값="${clean(el.value).slice(0, 60)}"`;
      if (el.id) line += ` #${el.id}`;
      const tr = el.closest && el.closest('tr'); if (tr && /checkbox|radio|button|submit/.test(el.type || el.tagName.toLowerCase() === 'a' && 'button')) line += ` 행="${clean(tr.innerText).slice(0, 140)}"`;
      if (chars + line.length > 9000) { skipped++; continue; }
      out.push(line); chars += line.length + 1;
    }
    if (skipped) out.push(`… 화면 아래쪽 ${skipped}개 생략. scroll 하거나 find 로 좁혀 찾으세요.`);
    return out.join('\n') || '(보이는 요소 없음)';
  }
  const need = (ref) => { const el = refs.get(ref); if (!el || !el.isConnected) throw new Error('ref 가 만료되었습니다. read_page 를 다시 호출하세요.'); return el; };
  function setValue(el, v) {
    const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const d = Object.getOwnPropertyDescriptor(proto, 'value');
    d && d.set ? d.set.call(el, v) : (el.value = v);
    el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true }));
  }
  const run = {
    read_page: () => { const ov = overlayText(); return `URL: ${location.href}\n제목: ${document.title}\n` + (ov ? `⚠ 화면 위에 팝업이 떠 있어 뒤쪽 화면이 가려져 있을 수 있습니다: "${ov}"\n` : '') + list(); },
    form_controls: ({ ref }) => { const el = need(ref); let box = el.closest('form') || el.parentElement;
      for (let i = 0; i < 8 && box && !(box.querySelectorAll(SEL).length >= 6 && box.querySelector('a.btn,button,input[type=button],input[type=submit],input[type=image],[id*=search],[id*=btn]')); i++) box = box.parentElement;
      return `입력칸 ${nameOf(el)} 주변 요소(화면 위쪽 메뉴·통합검색은 제외):\n` + list('', box || document); },
    find: ({ query }) => list(clean(query).toLowerCase().replace(/(버튼|입력칸|링크)$/, '').trim()),
    click: ({ ref }) => { const el = need(ref); el.scrollIntoView({ block: 'center' });
      const a = el.closest && el.closest('a[href]');
      if (a && /^\s*javascript:/i.test(a.getAttribute('href') || '')) { a.setAttribute('data-navi-click', '1'); return `@@MAIN@@클릭: ${nameOf(el)}`; }
      el.click(); return `클릭: ${nameOf(el)}`; },
    type: ({ ref, text, submit }) => { const el = need(ref); el.scrollIntoView({ block: 'center' }); el.focus(); setValue(el, String(text));
      if (submit) { el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true })); el.form && el.form.requestSubmit && el.form.requestSubmit(); }
      return `입력 완료: ${nameOf(el)}`; },
    select_option: ({ ref, option }) => { const el = need(ref); const o = [...el.options].find((x) => clean(x.text) === clean(option)) || [...el.options].find((x) => clean(x.text).includes(clean(option)));
      if (!o) throw new Error('옵션을 찾지 못했습니다: ' + option); el.value = o.value; el.dispatchEvent(new Event('change', { bubbles: true })); return `선택: ${clean(o.text)}`; },
    scroll: ({ direction, amount }) => { window.scrollBy(0, (direction === 'up' ? -1 : 1) * (Number(amount) || 3) * 200); return '스크롤'; },
    get_text: () => clean(document.body.innerText).slice(0, 6000),
    // 내려받기 링크의 주소는 확장(배경)만 받는다. AI 에게는 돌려주지 않는다(주소에 세션 값이 들어 있을 수 있다).
    link_href: ({ ref }) => { const el = need(ref); const a = el.closest && el.closest('a[href]'); if (!a) throw new Error('링크 요소가 아닙니다.'); return a.href; },
  };
  // 작업 중인 탭 위쪽에 안내 띠를 띄운다(사용자에게는 단계 기록을 보이지 않고, 필요한 안내·확인만 보인다). 닫힌 shadow DOM 이라 페이지·요소 목록과 섞이지 않는다.
  let ovHost = null, ovRoot = null, ovLast = null, ovWd = null;
  function overlay(mode, text, options) {
    if (window !== window.top) return;
    if (mode === 'off') { ovLast = null; if (ovWd) { clearInterval(ovWd); ovWd = null; } if (ovHost) { ovHost.remove(); ovHost = null; ovRoot = null; } return; }
    ovLast = { mode, text, options };
    // 사이트가 화면을 다시 그려 띠가 사라져도 1초 안에 되살린다(로그인·가입으로 화면이 바뀌어도 띠가 남도록).
    if (!ovWd) ovWd = setInterval(() => { if (ovLast && (!ovHost || !ovHost.isConnected)) overlay(ovLast.mode, ovLast.text, ovLast.options); }, 1000);
    if (!ovHost || !ovHost.isConnected) {
      ovHost = document.createElement('div'); ovHost.style.cssText = 'all:initial;position:fixed;top:0;left:0;right:0;z-index:2147483647';
      ovRoot = ovHost.attachShadow({ mode: 'closed' }); document.documentElement.appendChild(ovHost);
    }
    const st = document.createElement('style');
    st.textContent = '.r2{flex-basis:100%;display:flex;gap:8px}input.i2{flex:1;min-width:120px}.b{flex-wrap:wrap}.b{font:14px/1.5 system-ui,"Malgun Gothic",sans-serif;display:flex;gap:12px;align-items:center;justify-content:space-between;padding:10px 16px;color:#fff;background:#2f5bd8;box-shadow:0 2px 10px rgba(0,0,0,.3)}.b.w{background:#b45309}.b.e{background:#b91c1c}.b.d{background:#15803d}.t{flex:1}.k{display:flex;gap:8px;flex-wrap:wrap;align-items:center}input.i,input.i2{font:inherit;border:0;border-radius:6px;padding:6px 10px;min-width:200px;background:#fff;color:#111}button{font:inherit;cursor:pointer;border:0;border-radius:6px;padding:6px 14px;background:#fff;color:#111}button.s{background:transparent;color:#fff;border:1px solid #fff}.bar{height:3px;background:rgba(255,255,255,.35);position:absolute;left:0;right:0;bottom:0;overflow:hidden}.bar i{display:block;height:100%;width:30%;background:#fff;animation:m 1.2s ease-in-out infinite}@keyframes m{0%{margin-left:-30%}100%{margin-left:100%}}@media(prefers-reduced-motion:reduce){.bar i{animation:none;width:100%}}';
    const box = document.createElement('div'); box.className = 'b' + (mode === 'handoff' || mode === 'confirm' || mode === 'choice' || mode === 'input' ? ' w' : mode === 'error' ? ' e' : mode === 'done' ? ' d' : ''); box.style.position = 'relative';
    const t = document.createElement('div'); t.className = 't'; t.textContent = '나비웹 도우미 · ' + String(text || (mode === 'busy' ? '작업 중입니다. 잠시만 기다려 주세요.' : '')).slice(0, 400); box.appendChild(t);
    const k = document.createElement('div'); k.className = 'k';
    const btn = (label, cls, fn) => { const b = document.createElement('button'); b.textContent = label; if (cls) b.className = cls; b.onclick = fn; k.appendChild(b); };
    const rep = (ok) => () => { chrome.runtime.sendMessage({ type: 'reply', ok }); overlay('busy', ''); };
    if (mode === 'confirm') { btn('진행', '', rep(true)); btn('취소', 's', rep(false)); }
    else if (mode === 'input') {
      const inp = document.createElement('input'); inp.placeholder = (options && options[0]) || '입력'; inp.className = 'i'; inp.maxLength = 100; inp.autocomplete = 'off';
      const go = () => { const v = inp.value.trim(); if (!v) return; chrome.runtime.sendMessage({ type: 'reply', ok: true, value: v }); overlay('busy', ''); };
      inp.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') go(); }, true);
      ['keyup', 'keypress'].forEach((n) => inp.addEventListener(n, (e) => e.stopPropagation(), true));
      k.appendChild(inp); btn(options && options[1] ? '보내기 · 금고에 저장' : '보내기', '', go);
      btn('직접 입력할게요', 's', () => { chrome.runtime.sendMessage({ type: 'reply', ok: true, manual: true }); overlay('busy', ''); });
      btn('중단', 's', () => chrome.runtime.sendMessage({ type: 'stop' }));
      setTimeout(() => inp.focus(), 0);
    }
    else if (mode === 'choice') { (options || []).forEach((o) => btn(String(o), '', () => { chrome.runtime.sendMessage({ type: 'reply', ok: true, value: o }); overlay('busy', ''); })); btn('중단', 's', () => chrome.runtime.sendMessage({ type: 'stop' })); }
    else if (mode === 'handoff') { btn('완료', '', rep(true)); btn('중단', 's', () => chrome.runtime.sendMessage({ type: 'stop' })); }
    else if (mode === 'busy') btn('중단', 's', () => { chrome.runtime.sendMessage({ type: 'stop' }); });
    else btn('닫기', '', () => overlay('off'));
    box.appendChild(k);
    if (mode === 'busy') { const bar = document.createElement('div'); bar.className = 'bar'; bar.appendChild(document.createElement('i')); box.appendChild(bar); }
    // 도우미에게 말하기: 작업 중·직접 입력 대기 중에 사용자가 한 줄을 보낼 수 있다(진행 표시가 갱신돼도 쓰던 글은 유지).
    const old = ovRoot.querySelector && ovRoot.querySelector('input.i2'), keep = old ? { v: old.value, f: ovRoot.activeElement === old, p: old.placeholder } : null;
    if (mode === 'busy' || mode === 'handoff') {
      const row = document.createElement('div'); row.className = 'r2';
      const inp = document.createElement('input'); inp.className = 'i2'; inp.maxLength = 300; inp.autocomplete = 'off'; inp.placeholder = (keep && keep.p) || '도우미에게 말하기 (예: 회원가입도 같이 해 줘)';
      const go = () => { const v = inp.value.trim(); if (!v) return; chrome.runtime.sendMessage({ type: 'say', text: v }); inp.value = ''; inp.placeholder = '전달했습니다. 도우미가 다음 단계에서 반영합니다.'; };
      inp.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') go(); }, true);
      ['keyup', 'keypress'].forEach((n) => inp.addEventListener(n, (e) => e.stopPropagation(), true));
      const sb = document.createElement('button'); sb.textContent = '보내기'; sb.className = 's'; sb.onclick = go;
      row.append(inp, sb); box.appendChild(row);
      if (keep) { inp.value = keep.v; if (keep.f) setTimeout(() => inp.focus(), 0); }
    }
    ovRoot.replaceChildren(st, box);
  }
  chrome.runtime.onMessage.addListener((msg, _s, send) => {
    if (msg && msg.__navi === 'ping') { send({ ok: true }); return; }
    if (msg && msg.__navi === 'overlay') { overlay(msg.mode, msg.text, msg.options); send({ ok: true }); return; }
    if (!msg || msg.__navi !== 'tool') return;
    try {
      if (msg.describe) { const el = msg.input && msg.input.ref ? refs.get(msg.input.ref) : null; send({ ok: true, info: el ? describe(el) : {} }); }
      else send({ ok: true, text: String(run[msg.name](msg.input || {})) });
    } catch (e) { send({ ok: false, error: e.message }); }
  });
  window.__naviAgentV = 5;
})();
