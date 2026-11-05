// 페이지 안에서 도구를 실행한다. 요소는 ref_N 으로만 가리킨다(좌표 클릭을 쓰지 않는다).
(() => {
  if (window.__naviAgentV === 4) return;
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
  chrome.runtime.onMessage.addListener((msg, _s, send) => {
    if (msg && msg.__navi === 'ping') { send({ ok: true }); return; }
    if (!msg || msg.__navi !== 'tool') return;
    try {
      if (msg.describe) { const el = msg.input && msg.input.ref ? refs.get(msg.input.ref) : null; send({ ok: true, info: el ? describe(el) : {} }); }
      else send({ ok: true, text: String(run[msg.name](msg.input || {})) });
    } catch (e) { send({ ok: false, error: e.message }); }
  });
  window.__naviAgentV = 4;
})();
