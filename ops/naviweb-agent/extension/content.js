// 페이지 안에서 도구를 실행한다. 요소는 ref_N 으로만 가리킨다(좌표 클릭을 쓰지 않는다).
(() => {
  if (window.__naviAgent) return;
  const refs = new Map(); let seq = 0;
  const SEL = 'a[href],button,input,select,textarea,label,[role=button],[role=link],[role=checkbox],[role=radio],[role=tab],[onclick]';
  const clean = (s) => String(s || '').replace(/\s+/g, ' ').trim();
  const visible = (el) => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none'; };
  const nameOf = (el) => clean(el.getAttribute('aria-label') || (el.labels && el.labels[0] && el.labels[0].innerText) || el.placeholder || el.title || el.alt
    || (el.tagName === 'INPUT' && /button|submit/.test(el.type) ? el.value : '') || el.innerText || el.textContent).slice(0, 80);
  const kind = (el) => el.tagName === 'INPUT' ? `input[${el.type}]` : el.tagName === 'SELECT' ? 'select' : (el.getAttribute('role') || el.tagName.toLowerCase());
  function refOf(el) { for (const [k, v] of refs) if (v === el) return k; const k = 'ref_' + (++seq); refs.set(k, el); return k; }
  function describe(el) {
    return { tag: el.tagName.toLowerCase(), type: el.type || '', name: el.name || el.id || '', label: nameOf(el), text: nameOf(el), autocomplete: el.autocomplete || '' };
  }
  function list(filter) {
    const out = [];
    for (const el of document.querySelectorAll(SEL)) {
      if (!visible(el)) continue;
      const n = nameOf(el);
      if (filter && !(n.toLowerCase().includes(filter) || (el.name || '').toLowerCase().includes(filter))) continue;
      let line = `${refOf(el)} ${kind(el)} "${n}"`;
      if (el.tagName === 'INPUT' && /checkbox|radio/.test(el.type)) line += el.checked ? ' [선택됨]' : ' [해제]';
      else if (el.tagName === 'SELECT') line += ` 값="${clean(el.options[el.selectedIndex] && el.options[el.selectedIndex].text)}" 옵션=[${[...el.options].slice(0, 40).map((o) => clean(o.text)).join(' | ')}]`;
      else if (el.tagName === 'INPUT' && el.type !== 'password' && el.value && !/button|submit|radio|checkbox/.test(el.type)) line += ` 값="${clean(el.value).slice(0, 60)}"`;
      out.push(line);
      if (out.length >= 220) break;
    }
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
    read_page: () => `URL: ${location.href}\n제목: ${document.title}\n${list()}`,
    find: ({ query }) => list(clean(query).toLowerCase().replace(/(버튼|입력칸|링크)$/, '').trim()),
    click: ({ ref }) => { const el = need(ref); el.scrollIntoView({ block: 'center' }); el.click(); return `클릭: ${nameOf(el)}`; },
    type: ({ ref, text, submit }) => { const el = need(ref); el.scrollIntoView({ block: 'center' }); el.focus(); setValue(el, String(text));
      if (submit) { el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true })); el.form && el.form.requestSubmit && el.form.requestSubmit(); }
      return `입력 완료: ${nameOf(el)}`; },
    select_option: ({ ref, option }) => { const el = need(ref); const o = [...el.options].find((x) => clean(x.text) === clean(option)) || [...el.options].find((x) => clean(x.text).includes(clean(option)));
      if (!o) throw new Error('옵션을 찾지 못했습니다: ' + option); el.value = o.value; el.dispatchEvent(new Event('change', { bubbles: true })); return `선택: ${clean(o.text)}`; },
    scroll: ({ direction, amount }) => { window.scrollBy(0, (direction === 'up' ? -1 : 1) * (Number(amount) || 3) * 200); return '스크롤'; },
    get_text: () => clean(document.body.innerText).slice(0, 6000),
  };
  chrome.runtime.onMessage.addListener((msg, _s, send) => {
    if (msg && msg.__navi === 'ping') { send({ ok: true }); return; }
    if (!msg || msg.__navi !== 'tool') return;
    try {
      if (msg.describe) { const el = msg.input && msg.input.ref ? refs.get(msg.input.ref) : null; send({ ok: true, info: el ? describe(el) : {} }); }
      else send({ ok: true, text: String(run[msg.name](msg.input || {})) });
    } catch (e) { send({ ok: false, error: e.message }); }
  });
  window.__naviAgent = true;
})();
