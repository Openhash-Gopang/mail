/* 나비웹 다국어(i18n) — 언어/국가 선택, 사전 불러오기, 화면 갱신.
   - 원문(한국어)이 곧 키다: t('내 서류 목록'). 사전에 없으면 영어 → 한국어 원문 순으로 대신한다.
   - 사전은 src/i18n/<언어>.json → (빌드) public/i18n/<언어>.js 로 만들어지고, 선택한 언어 것만 불러온다.
   - 국가마다 법규·기관이 다른 현지화(localization)는 이 모듈의 일이 아니다: 여기서는 화면 언어와 국가 선택만 다룬다.
   - <head>에서 동기로 불러야 한다(boot.js 가 불러 준다): 본문이 그려지기 전에 사전이 준비되어 한국어가 번쩍이지 않는다. */
(function (root) {
  'use strict';

  var KEY = 'navi_locale';
  /* 사전이 있는 화면 언어. ko 는 원문이라 사전이 없다. 언어를 더하려면 src/i18n/<코드>.json 을 만들고 여기에 한 줄을 더한다. */
  var LANGS = [
    { c: 'ko', n: '한국어', tag: 'ko-KR' }, { c: 'en', n: 'English', tag: 'en-US' }, { c: 'ja', n: '日本語', tag: 'ja-JP' },
    { c: 'zh', n: '简体中文', tag: 'zh-CN' }, { c: 'es', n: 'Español', tag: 'es-ES' }, { c: 'fr', n: 'Français', tag: 'fr-FR' },
    { c: 'de', n: 'Deutsch', tag: 'de-DE' }, { c: 'vi', n: 'Tiếng Việt', tag: 'vi-VN' }, { c: 'id', n: 'Bahasa Indonesia', tag: 'id-ID' }
  ];
  var LANG_OF = {};
  LANGS.forEach(function (l) { LANG_OF[l.c] = l; });

  /* 국가 → 기본 화면 언어. 그 언어의 사전이 없는 나라는 영어로 보여 준다(고르는 줄에 실제 언어 이름이 적힌다). */
  var G = {
    ko: 'KR KP',
    ja: 'JP',
    zh: 'CN',
    es: 'ES MX AR CO CL PE VE EC GT CU BO DO HN PY SV NI CR PA UY PR GQ',
    fr: 'FR BE LU MC SN CI CM CD MG ML BF NE TG BJ GA HT DJ',
    de: 'DE AT LI CH',
    vi: 'VN',
    id: 'ID',
    en: 'US GB AU CA NZ IE SG IN PH ZA NG KE GH UG TZ ET PK BD LK NP MY TH MM KH LA BN MN KZ UZ KG TJ TM AF IR IQ SA AE QA KW BH OM JO LB SY YE IL TR EG MA DZ TN LY SD IT PT BR NL SE NO DK FI IS PL CZ SK HU RO BG GR HR RS SI BA ME AL MK UA BY RU LT LV EE GE AM AZ TW HK MO FJ PG'
  };
  var DEFAULT_LANG = {};
  Object.keys(G).forEach(function (l) { G[l].split(' ').forEach(function (r) { if (r && !DEFAULT_LANG[r]) DEFAULT_LANG[r] = l; }); });
  var REGIONS = Object.keys(DEFAULT_LANG);

  /* ── 문자열 처리 ───────────────────────────────────────── */
  function norm(s) { return String(s == null ? '' : s).normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[\s·.,'’\-]/g, ''); }
  var CHO = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ';
  function cho(s) {   // 한글 초성 열(예: 미국 → ㅁㄱ). 한글이 아닌 글자는 그대로 둔다.
    var o = '';
    for (var i = 0; i < s.length; i++) {
      var c = s.charCodeAt(i);
      o += (c >= 0xAC00 && c <= 0xD7A3) ? CHO.charAt(Math.floor((c - 0xAC00) / 588)) : s.charAt(i);
    }
    return o;
  }
  function isJamo(s) { return /^[ㄱ-ㅎ]+$/.test(s); }

  var DN = {};
  function regionName(code, lang) {
    try {
      if (!DN[lang]) DN[lang] = new Intl.DisplayNames([lang], { type: 'region' });
      return DN[lang].of(code) || code;
    } catch (e) { return code; }
  }
  function nativeLang(code) {   // 그 나라 사람들이 주로 쓰는 언어(예: TH → th) — 자기 나라 말로 검색할 수 있게 한다
    try { return new Intl.Locale('und-' + code).maximize().language; } catch (e) { return 'en'; }
  }

  /* ── 상태 ──────────────────────────────────────────────── */
  var dicts = {};            // 불러온 사전: { en: {...}, ja: {...} }
  var state = { country: 'KR', lang: 'ko' };

  function effectiveLang(l) { return LANG_OF[l] ? l : 'en'; }
  function pickLang(tag) {   // 'ja-JP' 같은 브라우저 언어 → 지원 언어 코드(없으면 null). 번체 중국어는 아직 사전이 없어 영어로 보낸다.
    var p = String(tag || '').toLowerCase().split('-'), l = p[0];
    if (l === 'zh' && /^(tw|hk|mo|hant)$/.test(p[1] || '')) return 'en';
    return LANG_OF[l] ? l : null;
  }
  function regionOf(tag) { var m = /-([a-z]{2})(?:-|$)/i.exec(String(tag || '').replace(/-(hans|hant)/i, '')); return m ? m[1].toUpperCase() : ''; }

  function detect() {
    var q = {}, s = null, i, tags;
    try { new URLSearchParams(location.search).forEach(function (v, k) { q[k] = v; }); } catch (e) {}
    try { s = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) {}
    if (q.lang) {   // ?lang=ja 또는 ?lang=ja-JP (미리보기·메일에서 넘길 때)
      var ql = pickLang(q.lang), qr = (q.country || regionOf(q.lang) || '').toUpperCase();
      if (ql) return { lang: ql, country: DEFAULT_LANG[qr] ? qr : (s && s.country) || firstRegion(ql) };
    }
    if (s && LANG_OF[s.lang] && DEFAULT_LANG[s.country]) return { lang: s.lang, country: s.country };
    tags = (typeof navigator !== 'undefined' && (navigator.languages || [navigator.language])) || [];
    for (i = 0; i < tags.length; i++) {
      var l = pickLang(tags[i]);
      if (l) { var r = regionOf(tags[i]); return { lang: l, country: DEFAULT_LANG[r] ? r : firstRegion(l) }; }
    }
    return { lang: 'en', country: 'US' };
  }
  function firstRegion(lang) { return (G[lang] || 'US').split(' ')[0]; }

  /* ── 번역 ──────────────────────────────────────────────── */
  function dict(l) { return dicts[l] || (root.NAVI_I18N && root.NAVI_I18N[l] ? (dicts[l] = root.NAVI_I18N[l]) : null); }
  function lookup(src) {
    var l = state.lang, d;
    if (l !== 'ko') {
      d = dict(l); if (d && d[src] != null) return d[src];
      d = dict('en'); if (d && d[src] != null) return d[src];
    }
    return src;
  }
  function t(src, vars) {
    var s = lookup(src);
    if (vars) s = String(s).replace(/\{(\w+)\}/g, function (m, k) { return vars[k] != null ? vars[k] : m; });
    return s;
  }

  /* data-i18n(글자) · data-i18n-attr="placeholder aria-label"(속성): 처음 본 한국어 원문을 기억해 두고 거기서 번역한다 */
  function apply(scope) {
    if (typeof document === 'undefined') return;
    var r = scope || document, i, el, nodes, attrs, j, a;
    nodes = r.querySelectorAll('[data-i18n]');
    for (i = 0; i < nodes.length; i++) {
      el = nodes[i];
      if (!el.hasAttribute('data-i18n-src')) el.setAttribute('data-i18n-src', el.getAttribute('data-i18n') || el.textContent.trim());
      el.textContent = t(el.getAttribute('data-i18n-src'));
    }
    nodes = r.querySelectorAll('[data-i18n-attr]');
    for (i = 0; i < nodes.length; i++) {
      el = nodes[i]; attrs = el.getAttribute('data-i18n-attr').split(/\s+/);
      for (j = 0; j < attrs.length; j++) {
        a = attrs[j]; if (!a) continue;
        if (!el.hasAttribute('data-i18n-src-' + a)) el.setAttribute('data-i18n-src-' + a, el.getAttribute(a) || '');
        el.setAttribute(a, t(el.getAttribute('data-i18n-src-' + a)));
      }
    }
  }
  function applyDocument() {
    var d = document.documentElement;
    d.setAttribute('lang', state.lang === 'zh' ? 'zh-CN' : state.lang);
    d.setAttribute('dir', 'ltr');
    d.setAttribute('data-locale', state.country + '-' + state.lang);
    apply(document);
  }

  /* ── 사전 불러오기 ─────────────────────────────────────── */
  var BASE = '', VER = '';
  try {
    var cs = document.currentScript;
    if (cs && cs.src) { BASE = cs.src.replace(/assets\/i18n\.js.*$/, ''); VER = (cs.src.split('?')[1] || ''); }
  } catch (e) {}
  function dictUrl(l) { return BASE + 'i18n/' + l + '.js' + (VER ? '?' + VER : ''); }
  function need(l) { return l !== 'ko' && !dict(l); }
  root.NAVI_I18N = root.NAVI_I18N || {};
  function adopt() { Object.keys(root.NAVI_I18N).forEach(function (k) { dicts[k] = root.NAVI_I18N[k]; }); }

  function loadDicts(lang, done) {   // 선택 언어와 영어(대체용) 사전을 받는다. 이미 있으면 바로 끝낸다.
    var want = [lang, 'en'].filter(function (l, i, a) { return need(l) && a.indexOf(l) === i; }), left = want.length;
    if (!left) { done(); return; }
    want.forEach(function (l) {
      var s = document.createElement('script');
      s.src = dictUrl(l);
      s.onload = s.onerror = function () { adopt(); if (--left === 0) done(); };
      document.head.appendChild(s);
    });
  }

  /* ── 바꾸기 ────────────────────────────────────────────── */
  function save() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {} }
  function fire() {
    applyDocument();
    try { document.dispatchEvent(new CustomEvent('navi:locale', { detail: { country: state.country, lang: state.lang } })); } catch (e) {}
  }
  /** 국가를 고르면 그 나라의 기본 언어로, 언어만 고르면 국가는 그대로 둔다. */
  function set(next) {
    var country = next.country && DEFAULT_LANG[next.country] ? next.country : state.country;
    var lang = next.lang ? effectiveLang(next.lang) : (next.country ? effectiveLang(DEFAULT_LANG[country]) : state.lang);
    state = { country: country, lang: lang };
    save();
    loadDicts(lang, fire);
  }

  /* ── 국가 검색 ─────────────────────────────────────────── */
  var COUNTRY_CACHE = {};
  function countryRow(code) {
    var lang = effectiveLang(DEFAULT_LANG[code]), nl = nativeLang(code);
    var key = code + '|' + state.lang;
    if (COUNTRY_CACHE[key]) return COUNTRY_CACHE[key];
    var ui = regionName(code, state.lang);
    var hay = [ui, regionName(code, 'en'), regionName(code, 'ko'), regionName(code, nl), code].map(norm);
    return (COUNTRY_CACHE[key] = { code: code, name: ui, lang: lang, langName: LANG_OF[lang].n, hay: hay, cho: cho(regionName(code, 'ko')) });
  }
  /** 입력한 글자로 국가를 찾는다(화면 언어·영어·한국어·그 나라 말·코드·한글 초성). 글자가 없으면 이름순 전체. */
  function searchCountries(query) {
    var rows = REGIONS.map(countryRow), q = norm(query), raw = String(query == null ? '' : query).replace(/\s+/g, ''), out;
    var loc = state.lang;
    if (!q) return rows.slice().sort(function (a, b) { return a.name.localeCompare(b.name, loc); });
    out = [];
    rows.forEach(function (r) {
      var score = -1, i, h;
      for (i = 0; i < r.hay.length; i++) {
        h = r.hay[i];
        if (h === q) { score = 0; break; }
        if (h.indexOf(q) === 0) score = score < 0 || score > 1 ? 1 : score;
        else if (h.indexOf(q) > 0) score = score < 0 ? 2 : score;
      }
      if (score < 0 && isJamo(raw) && r.cho.indexOf(raw) === 0) score = 1;
      if (score >= 0) out.push({ r: r, s: score });
    });
    out.sort(function (a, b) { return a.s - b.s || a.r.name.localeCompare(b.r.name, loc); });
    return out.map(function (x) { return x.r; });
  }

  /* ── 상단 바의 언어/국가 선택 ──────────────────────────── */
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  var GLOBE = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.6 2.7 3.9 5.7 3.9 9s-1.3 6.3-3.9 9c-2.6-2.7-3.9-5.7-3.9-9S9.4 5.7 12 3z"/></svg>';
  /* 국기: 한국은 태극기 그림(윈도우는 국기 이모지를 그리지 못해 글자로 보인다), 다른 나라는 국기 이모지(그리지 못하는 환경에서는 국가 코드 글자로 보인다) */
  var FLAG_KR = '<svg class="lp-flag" focusable="false" viewBox="0 0 36 24" width="30" height="20" aria-hidden="true"><rect width="36" height="24" rx="2" fill="#fff" stroke="#c9ced6" stroke-width=".8"/><g transform="rotate(-33.7 18 12)"><path d="M12 12a6 6 0 0 1 12 0a3 3 0 0 1-6 0a3 3 0 0 0-6 0z" fill="#cd2e3a"/><path d="M24 12a6 6 0 0 1-12 0a3 3 0 0 1 6 0a3 3 0 0 0 6 0z" fill="#0047a0"/></g><g fill="#111"><g transform="translate(10.84 7.23) rotate(-56.3)"><rect x="-3.2" y="-2.55" width="6.4" height="1.1"/><rect x="-3.2" y="-0.55" width="6.4" height="1.1"/><rect x="-3.2" y="1.45" width="6.4" height="1.1"/></g><g transform="translate(25.16 16.77) rotate(123.7)"><rect x="-3.2" y="-2.55" width="2.7" height="1.1"/><rect x="0.5" y="-2.55" width="2.7" height="1.1"/><rect x="-3.2" y="-0.55" width="2.7" height="1.1"/><rect x="0.5" y="-0.55" width="2.7" height="1.1"/><rect x="-3.2" y="1.45" width="2.7" height="1.1"/><rect x="0.5" y="1.45" width="2.7" height="1.1"/></g><g transform="translate(25.16 7.23) rotate(56.3)"><rect x="-3.2" y="-2.55" width="2.7" height="1.1"/><rect x="0.5" y="-2.55" width="2.7" height="1.1"/><rect x="-3.2" y="-0.55" width="6.4" height="1.1"/><rect x="-3.2" y="1.45" width="2.7" height="1.1"/><rect x="0.5" y="1.45" width="2.7" height="1.1"/></g><g transform="translate(10.84 16.77) rotate(236.3)"><rect x="-3.2" y="-2.55" width="6.4" height="1.1"/><rect x="-3.2" y="-0.55" width="2.7" height="1.1"/><rect x="0.5" y="-0.55" width="2.7" height="1.1"/><rect x="-3.2" y="1.45" width="6.4" height="1.1"/></g></g></svg>';
  function flagHtml(code) {
    if (code === 'KR') return FLAG_KR;
    if (!/^[A-Z]{2}$/.test(code)) return GLOBE;
    return '<span class="lp-flag lp-emoji" aria-hidden="true">' + String.fromCodePoint(0x1F1E6 + code.charCodeAt(0) - 65, 0x1F1E6 + code.charCodeAt(1) - 65) + '</span>';
  }
  var MAG = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/></svg>';
  var uid = 0;

  function mountPicker(host) {
    if (!host) return null;
    var id = 'lp' + (++uid);
    host.innerHTML =
      '<div class="lp">' +
        '<button type="button" class="lp-btn" aria-haspopup="dialog" aria-expanded="false" aria-controls="' + id + '-pop"><span class="lp-fl"></span><span class="lp-cur"></span></button>' +
        '<div class="lp-pop" id="' + id + '-pop" role="dialog" aria-label="" hidden>' +
          '<div class="lp-search">' + MAG + '<input type="search" class="lp-q" role="combobox" aria-autocomplete="list" aria-expanded="true" aria-controls="' + id + '-list" autocomplete="off" spellcheck="false"></div>' +
          '<div class="lp-langs" role="group"></div>' +
          '<ul class="lp-list" id="' + id + '-list" role="listbox"></ul>' +
          '<p class="lp-empty" role="status" hidden></p>' +
        '</div>' +
      '</div>';
    var box = host.firstChild, btn = box.querySelector('.lp-btn'), pop = box.querySelector('.lp-pop'), q = box.querySelector('.lp-q');
    var langs = box.querySelector('.lp-langs'), list = box.querySelector('.lp-list'), empty = box.querySelector('.lp-empty'), cur = box.querySelector('.lp-cur'), fl = box.querySelector('.lp-fl');
    var rows = [], active = -1;

    function label() {
      fl.innerHTML = flagHtml(state.country);
      cur.textContent = LANG_OF[state.lang].n;
      btn.setAttribute('aria-label', t('언어·국가 선택') + ': ' + regionName(state.country, state.lang) + ', ' + LANG_OF[state.lang].n);
      pop.setAttribute('aria-label', t('언어·국가 선택'));
      q.setAttribute('placeholder', t('국가 검색')); q.setAttribute('aria-label', t('국가 검색'));
      langs.setAttribute('aria-label', t('언어'));
      empty.textContent = t('일치하는 국가가 없습니다.');
    }
    function drawLangs() {
      langs.innerHTML = LANGS.map(function (l) { return '<button type="button" class="lp-chip" data-l="' + l.c + '" aria-pressed="' + (l.c === state.lang) + '" lang="' + l.tag + '">' + esc(l.n) + '</button>'; }).join('');
    }
    function setActive(i, scroll) {
      var opts = list.children;
      if (active >= 0 && opts[active]) opts[active].classList.remove('on');
      active = i;
      if (i >= 0 && opts[i]) { opts[i].classList.add('on'); q.setAttribute('aria-activedescendant', opts[i].id); if (scroll !== false) opts[i].scrollIntoView({ block: 'nearest' }); }
      else q.removeAttribute('aria-activedescendant');
    }
    function drawList() {
      rows = searchCountries(q.value);
      list.innerHTML = rows.map(function (r, i) {
        return '<li role="option" id="' + id + '-o' + i + '" data-c="' + r.code + '" aria-selected="' + (r.code === state.country) + '"><span class="lp-code">' + flagHtml(r.code) + '</span><span class="lp-name">' + esc(r.name) + '</span><span class="lp-l">' + esc(r.langName) + '</span></li>';
      }).join('');
      empty.hidden = rows.length > 0;
      var sel = -1; rows.forEach(function (r, i) { if (r.code === state.country) sel = i; });
      setActive(q.value ? (rows.length ? 0 : -1) : sel);
    }
    function open() {
      label(); drawLangs(); q.value = '';
      pop.hidden = false; btn.setAttribute('aria-expanded', 'true');
      drawList();   // 보이는 상태에서 그려야 현재 국가 줄로 스크롤된다
      q.focus();
    }
    function close(refocus) {
      pop.hidden = true; btn.setAttribute('aria-expanded', 'false');
      if (refocus) btn.focus();
    }
    function choose(next) { close(false); root.NaviI18n._refocus = true; set(next); }

    btn.addEventListener('click', function () { if (pop.hidden) open(); else close(true); });
    q.addEventListener('input', drawList);
    q.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowDown') { e.preventDefault(); if (rows.length) setActive(Math.min(active + 1, rows.length - 1)); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); if (rows.length) setActive(Math.max(active - 1, 0)); }
      else if (e.key === 'Home' && e.ctrlKey) { e.preventDefault(); setActive(0); }
      else if (e.key === 'End' && e.ctrlKey) { e.preventDefault(); setActive(rows.length - 1); }
      else if (e.key === 'Enter') { e.preventDefault(); var r = rows[active >= 0 ? active : 0]; if (r) choose({ country: r.code }); }
    });
    list.addEventListener('click', function (e) { var li = e.target.closest && e.target.closest('li[data-c]'); if (li) choose({ country: li.getAttribute('data-c') }); });
    list.addEventListener('mousemove', function (e) { var li = e.target.closest && e.target.closest('li[data-c]'); if (li) { var i = Array.prototype.indexOf.call(list.children, li); if (i !== active) setActive(i, false); } });
    langs.addEventListener('click', function (e) { var b = e.target.closest && e.target.closest('.lp-chip'); if (b) choose({ lang: b.getAttribute('data-l') }); });
    box.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !pop.hidden) { e.stopPropagation(); close(true); } });
    document.addEventListener('mousedown', function away(e) {
      if (!document.body.contains(box)) { document.removeEventListener('mousedown', away); return; }
      if (!pop.hidden && !box.contains(e.target)) close(false);
    });
    label();
    return { open: open, close: close };
  }

  /* ── 시작 ──────────────────────────────────────────────── */
  var api = {
    LANGS: LANGS, REGIONS: REGIONS, DEFAULT_LANG: DEFAULT_LANG, KEY: KEY,
    t: t, apply: apply, set: set, searchCountries: searchCountries, mountPicker: mountPicker, flagHtml: flagHtml, detect: detect, norm: norm, cho: cho,
    get: function () { return { country: state.country, lang: state.lang }; },
    lang: function () { return state.lang; },
    tag: function () { return LANG_OF[state.lang].tag; },
    _setDict: function (l, d) { dicts[l] = d; },
    _setState: function (s) { state = { country: s.country, lang: s.lang }; },
    _refocus: false
  };
  root.NaviI18n = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof document === 'undefined') return;

  state = detect();
  adopt();
  if (document.readyState === 'loading' && document.write) {   // 동기: 본문이 그려지기 전에 사전을 불러온다
    var w = [state.lang, 'en'].filter(function (l, i, a) { return need(l) && a.indexOf(l) === i; });
    w.forEach(function (l) { document.write('<script src="' + dictUrl(l) + '"><\/script>'); });
  }
  /* 메일(naviweb.kr)이 이 화면을 iframe 으로 끼워 넣은 경우: 메일 상단 바에서 고른 언어·국가를 따른다 */
  if (root.parent && root.parent !== root) {
    root.addEventListener('message', function (e) {
      var d = e.data || {};
      if (d.type !== 'navi-locale' || e.source !== root.parent) return;
      if (!/^https:\/\/([a-z0-9-]+\.)*(naviweb\.kr|hondi\.net)$/.test(e.origin) && !/^http:\/\/localhost(:\d+)?$/.test(e.origin)) return;
      if (d.lang && LANG_OF[d.lang] && (d.lang !== state.lang || d.country !== state.country)) set({ country: d.country, lang: d.lang });
    });
    try { root.parent.postMessage({ type: 'navi-locale-request' }, '*'); } catch (e) {}
  }
  function ready() { adopt(); applyDocument(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ready); else loadDicts(state.lang, ready);
})(typeof window !== 'undefined' ? window : globalThis);
