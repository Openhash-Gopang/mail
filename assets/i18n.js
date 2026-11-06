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
    var ui = regionName(code, state.lang), en = regionName(code, 'en');   // 화면에는 영어 이름만 보이고, 검색은 화면 언어·한국어·그 나라 말·코드로도 된다
    var hay = [en, ui, regionName(code, 'ko'), regionName(code, nl), code].map(norm);
    return (COUNTRY_CACHE[key] = { code: code, name: en, lang: lang, langName: LANG_OF[lang].n, hay: hay, cho: cho(regionName(code, 'ko')) });
  }
  /** 입력한 글자로 국가를 찾는다(화면 언어·영어·한국어·그 나라 말·코드·한글 초성). 글자가 없으면 이름순 전체. */
  function searchCountries(query) {
    var rows = REGIONS.map(countryRow), q = norm(query), raw = String(query == null ? '' : query).replace(/\s+/g, ''), out;
    var loc = state.lang;
    if (!q) return rows.slice().sort(function (a, b) { return a.name.localeCompare(b.name, 'en'); });
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
    out.sort(function (a, b) { return a.s - b.s || a.r.name.localeCompare(b.r.name, 'en'); });
    return out.map(function (x) { return x.r; });
  }

  /* ── 상단 바의 언어/국가 선택 ──────────────────────────── */
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  var GLOBE = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.6 2.7 3.9 5.7 3.9 9s-1.3 6.3-3.9 9c-2.6-2.7-3.9-5.7-3.9-9S9.4 5.7 12 3z"/></svg>';
  /* 국기(시안 C): 상단 바 버튼에만 쓴다. 나라마다 색 덩어리 2~3개로 줄인 3:2 그림이라 모양이 단순하다.
     (윈도우는 국기 이모지를 그리지 못하므로 그림으로 직접 그린다.) 목록의 국가 이름 줄에는 국기를 넣지 않는다.
     표기: 'H 색,색:비율' 가로줄 · 'V …' 세로줄 · 'bg 색' 바탕 · 'r x,y,w,h,색' 사각 · 'c x,y,r,색' 원 · 'o x,y,r,색' 고리 · 's x,y,r,색' 별
           'p x,y x,y … ,색' 다각형 · 'l x1,y1,x2,y2,굵기,색' 선 · 'K x,y,w,h' … '/' 그 안만 보이게 · 'T' 태극 · 'Z 색' 톱니 */
  var FC = { r: '#d62d36', b: '#2a5db0', n: '#14306e', s: '#4aa3df', w: '#ffffff', g: '#0a9a50', y: '#fcd116', k: '#16181d', o: '#f58220', m: '#8a1538' };
  var JACK = 'l0,0,14,9.5,2,w;l14,0,0,9.5,2,w;l7,0,7,9.5,3.4,w;l0,4.75,14,4.75,3.4,w;l7,0,7,9.5,1.8,r;l0,4.75,14,4.75,1.8,r';
  var FLAGS = {
    KR: 'bg w;T', KP: 'H b:3,w:.7,r:12.6,w:.7,b:3;c8,10,4.4,w;s8,10,3.4,r', JP: 'bg w;c15,10,5.6,r', CN: 'bg r;s6,6,3.6,y',
    ES: 'H r,y:2,r', MX: 'V g,w,r;c15,10,2.4,#8b6b3c', AR: 'H s,w,s;c15,10,2.2,y', CO: 'H y:2,b,r', CL: 'H w,r;r0,0,10,10,b;s5,5,2.8,w',
    PE: 'V r,w,r', VE: 'H y,b,r', EC: 'H y:2,b,r', GT: 'V s,w,s', CU: 'H b,w,b,w,b;p0,0 0,20 11,10,r;s3.8,10,2.4,w', BO: 'H r,y,g',
    DO: 'bg w;r0,0,13,8.5,b;r17,0,13,8.5,r;r0,11.5,13,8.5,r;r17,11.5,13,8.5,b', HN: 'H b,w,b', PY: 'H r,w,b', SV: 'H b,w,b', NI: 'H b,w,b',
    CR: 'H b,w,r:2,w,b', PA: 'bg w;r15,0,15,10,r;r0,10,15,10,b', UY: 'H w,b,w,b,w,b;r0,0,10,10,w;c5,5,2.4,y',
    PR: 'H r,w,r,w,r;p0,0 0,20 11,10,b;s3.8,10,2.4,w', GQ: 'H g,w,r;p0,0 0,20 8,10,b',
    FR: 'V b,w,r', BE: 'V k,y,r', LU: 'H r,w,s', MC: 'H r,w', SN: 'V g,y,r;s15,10.4,3.2,g', CI: 'V o,w,g', CM: 'V g,r,y;s15,10.4,3.2,y',
    CD: 'bg s;p0,17 0,20 3,20 30,3 30,0 27,0,r;s5,5,3,y', MG: 'bg w;r10,0,20,10,r;r10,10,20,10,g', ML: 'V g,y,r', BF: 'H r,g;s15,10.4,4.4,y',
    NE: 'H o,w,g;c15,10,2.6,o', TG: 'H g,y,g,y,g;r0,0,12,12,r;s6,6,3,w', BJ: 'bg g;r10,0,20,10,y;r10,10,20,10,r', GA: 'H g,y,b', HT: 'H b,r',
    DJ: 'H s,g;p0,0 0,20 13,10,w;s4.5,10,2.4,r',
    DE: 'H k,r,y', AT: 'H r,w,r', LI: 'H b,r;c6,5,2.2,y', CH: 'bg r;r12.5,4,5,12,w;r7,7.5,16,5,w',
    VN: 'bg r;s15,10.4,6,y', ID: 'H r,w',
    US: 'bg w;r0,0,30,6.7,r;r0,13.3,30,6.7,r;r0,0,13,10.7,n',
    GB: 'bg n;l0,0,30,20,3.6,w;l30,0,0,20,3.6,w;l15,0,15,20,6,w;l0,10,30,10,6,w;l15,0,15,20,3.4,r;l0,10,30,10,3.4,r',
    AU: 'bg n;K0,0,14,9.5;' + JACK + ';/;s22,14,2.6,w;s22,5,1.6,w', NZ: 'bg n;K0,0,14,9.5;' + JACK + ';/;s21,14,1.8,r;s25,8,1.5,r',
    CA: 'V r,w:2,r;p15,4 18,10 15,16 12,10,r', IE: 'V g,w,o', SG: 'H r,w;c6,5,3.4,w;c7.4,5,2.8,r', IN: 'H o,w,g;o15,10,2.2,n',
    PH: 'H b,r;p0,0 0,20 17,10,w;s4,10,2.6,y', ZA: 'H r,n;p0,0 0,20 12,10,k;r10,8.7,20,2.6,g',
    NG: 'V g,w,g', KE: 'H k,r,g;r13,7,4,6,k', GH: 'H r,y,g;s15,10.4,3.4,k', UG: 'H k,y,r,k,y,r;c15,10,3.4,w',
    TZ: 'bg g;p30,0 30,20 0,20,s;l0,20,30,0,6.4,y;l0,20,30,0,4,k', ET: 'H g,y,r;c15,10,4,b;s15,10.4,2.8,y',
    PK: 'bg g;r0,0,7.5,20,w;c19,10,4,w;c20.4,9,3.4,g', BD: 'bg g;c13.5,10,5.4,r',
    LK: 'bg y;r1.4,1.4,27.2,17.2,m;r2.8,2.8,3.6,14.4,g;r6.4,2.8,3.6,14.4,o',
    NP: 'bg w;p1,0 19,9.6 10.5,9.6 19,20 1,20,b;p2.6,2 15.4,8.2 8,8.2 15.4,18 2.6,18,r',
    MY: 'H r,w,r,w,r,w,r;r0,0,15,10.7,n;c6.5,5.3,2.8,y', TH: 'H r,w,n:2,w,r', MM: 'H y,g,r;s15,11,5.6,w', KH: 'H n,r:2,n;r10,7.5,10,5,w',
    LA: 'H r,n:2,r;c15,10,4.4,w', BN: 'bg y;l0,16,30,4,3.4,w;l0,19.5,30,7.5,2.2,k;c15,10,3.6,r', MN: 'V r,n,r;r2.4,6,3,8,y',
    KZ: 'bg s;c15,10,4,y', UZ: 'H s,w,g;r0,6.4,30,.7,r;r0,12.9,30,.7,r', KG: 'bg r;c15,10,5,y', TJ: 'H r,w:1.5,g;c15,10,2.4,y',
    TM: 'bg g;r3,0,4.5,20,#a52a2a', AF: 'V k,r,g',
    IR: 'H g,w,r', IQ: 'H r,w,k;r11,8.5,8,3,g', SA: 'bg g;r7,12.4,16,1.6,w', AE: 'H g,w,k;r0,0,8,20,r', QA: 'bg m;Z w',
    KW: 'H g,w,r;p0,0 9,6.7 9,13.3 0,20,k', BH: 'bg r;Z w', OM: 'H w,r,g;r0,0,9,20,r', JO: 'H k,w,g;p0,0 0,20 13,10,r',
    LB: 'H r,w:2,r;c15,10,3,g', SY: 'H r,w,k;s11,10,2,g;s19,10,2,g', YE: 'H r,w,k', IL: 'bg w;r0,3,30,2.4,n;r0,14.6,30,2.4,n;o15,10,3.2,n',
    TR: 'bg r;c11.5,10,5,w;c13,10,4,r;s17.5,10,2,w', EG: 'H r,w,k;r13.5,8.5,3,3,y', MA: 'bg r;s15,10.4,5.4,g', DZ: 'V g,w;s15,10,4.4,r',
    TN: 'bg r;c15,10,6,w;c14.5,10,3.8,r;c15.6,10,3,w', LY: 'H r,k:2,g;c15,10,2.6,w;c15.8,10,2.1,k', SD: 'H r,w,k;p0,0 0,20 12,10,g',
    IT: 'V g,w,r', PT: 'V g:2,r:3;c12,10,3.4,y', BR: 'bg g;p15,2.2 27.4,10 15,17.8 2.6,10,y;c15,10,4.4,n',
    NL: 'H r,w,n', SE: 'bg n;r9,0,4,20,y;r0,8,30,4,y', NO: 'bg r;r8,0,5.4,20,w;r0,7.3,30,5.4,w;r9.5,0,2.4,20,n;r0,8.8,30,2.4,n',
    DK: 'bg r;r9,0,4,20,w;r0,8,30,4,w', FI: 'bg w;r8,0,5,20,n;r0,7.5,30,5,n', IS: 'bg n;r8,0,5.4,20,w;r0,7.3,30,5.4,w;r9.5,0,2.4,20,r;r0,8.8,30,2.4,r',
    PL: 'H w,r', CZ: 'H w,r;p0,0 0,20 15,10,n', SK: 'H w,n,r;c9,10,3,r', HU: 'H r,w,g', RO: 'V n,y,r', BG: 'H w,g,r',
    GR: 'H n,w,n,w,n,w,n,w,n;r0,0,11.1,11.1,n;r4.4,0,2.2,11.1,w;r0,4.4,11.1,2.2,w', HR: 'H r,w,n', RS: 'H r,n,w', SI: 'H w,n,r',
    BA: 'bg n;p9,0 24,0 24,20,y', ME: 'bg y;r1.2,1.2,27.6,17.6,r', AL: 'bg r;c15,10,4,k',
    MK: 'bg r;l0,10,30,10,1.4,y;l15,0,15,20,1.4,y;l0,0,30,20,1.4,y;l30,0,0,20,1.4,y;c15,10,3.4,y',
    UA: 'H b,y', BY: 'H r:2,g;r0,0,3.5,20,w', RU: 'H w,b,r', LT: 'H y,g,r', LV: 'H #9e3039:2,w:1,#9e3039:2', EE: 'H b,k,w',
    GE: 'bg w;r13,0,4,20,r;r0,8,30,4,r', AM: 'H r,n,o', AZ: 'H s,r,g;c14,10,2.8,w;c14.8,10,2.3,r',
    TW: 'bg r;r0,0,15,10,n;c7.5,5,2.6,w', HK: 'bg r;s15,10.4,5.6,w', MO: 'bg g;c15,12,3.4,w;s15,5,2,y',
    FJ: 'bg s;K0,0,14,9.5;' + JACK + ';/;r18,6,7,8,w;r18,6,7,3,r', PG: 'bg k;p0,0 30,0 30,20,r;s7,14,2.4,w'
  };
  function fc(c) { return FC[c] || c; }
  function starPath(cx, cy, r) {
    var p = '', i, a, rr;
    for (i = 0; i < 10; i++) { a = -Math.PI / 2 + i * Math.PI / 5; rr = i % 2 ? r * 0.4 : r; p += (i ? 'L' : 'M') + (cx + rr * Math.cos(a)).toFixed(2) + ' ' + (cy + rr * Math.sin(a)).toFixed(2); }
    return p + 'Z';
  }
  function flagBody(spec) {
    var out = '', open = false;
    spec.split(';').forEach(function (tk) {
      var a, i, tot, y, x, c, t = tk.trim();
      if (!t) return;
      if (t === '/') { if (open) out += '</svg>'; open = false; return; }
      if (t === 'T') { out += '<g transform="rotate(-33.7 15 10)"><path d="M9 10a6 6 0 0 1 12 0a3 3 0 0 1-6 0a3 3 0 0 0-6 0z" fill="#cd2e3a"/><path d="M21 10a6 6 0 0 1-12 0a3 3 0 0 1 6 0a3 3 0 0 0 6 0z" fill="#0047a0"/></g>'; return; }
      if (t.indexOf('bg ') === 0) { out += '<rect width="30" height="20" fill="' + fc(t.slice(3).trim()) + '"/>'; return; }
      if (t.charAt(0) === 'Z') { out += '<path d="M0 0H9L12 2L9 4L12 6L9 8L12 10L9 12L12 14L9 16L12 18L9 20H0z" fill="' + fc(t.slice(1).trim()) + '"/>'; return; }
      if (t.charAt(0) === 'H' || t.charAt(0) === 'V') {
        a = t.slice(1).trim().split(',').map(function (s) { var m = s.split(':'); return [m[0], m[1] ? parseFloat(m[1]) : 1]; });
        tot = a.reduce(function (s, v) { return s + v[1]; }, 0); x = 0;
        for (i = 0; i < a.length; i++) {
          y = (a[i][1] / tot) * (t.charAt(0) === 'H' ? 20 : 30);
          out += t.charAt(0) === 'H' ? '<rect y="' + x.toFixed(2) + '" width="30" height="' + (y + 0.05).toFixed(2) + '" fill="' + fc(a[i][0]) + '"/>' : '<rect x="' + x.toFixed(2) + '" width="' + (y + 0.05).toFixed(2) + '" height="20" fill="' + fc(a[i][0]) + '"/>';
          x += y;
        }
        return;
      }
      c = t.charAt(0); a = t.slice(1).split(',');
      if (c === 'K') { out += '<svg x="' + a[0] + '" y="' + a[1] + '" width="' + a[2] + '" height="' + a[3] + '" viewBox="' + a.join(' ') + '">'; open = true; return; }
      if (c === 'r') out += '<rect x="' + a[0] + '" y="' + a[1] + '" width="' + a[2] + '" height="' + a[3] + '" fill="' + fc(a[4]) + '"/>';
      else if (c === 'c') out += '<circle cx="' + a[0] + '" cy="' + a[1] + '" r="' + a[2] + '" fill="' + fc(a[3]) + '"/>';
      else if (c === 'o') out += '<circle cx="' + a[0] + '" cy="' + a[1] + '" r="' + a[2] + '" fill="none" stroke="' + fc(a[3]) + '" stroke-width="1"/>';
      else if (c === 's') out += '<path d="' + starPath(+a[0], +a[1], +a[2]) + '" fill="' + fc(a[3]) + '"/>';
      else if (c === 'l') out += '<path d="M' + a[0] + ' ' + a[1] + 'L' + a[2] + ' ' + a[3] + '" stroke="' + fc(a[5]) + '" stroke-width="' + a[4] + '" fill="none"/>';
      else if (c === 'p') {
        var pts = t.slice(1).trim().split(' '), last = pts.pop().split(',');
        pts.push(last[0] + ',' + last[1]);
        out += '<polygon points="' + pts.join(' ') + '" fill="' + fc(last[2]) + '"/>';
      }
    });
    return out + (open ? '</svg>' : '');
  }
  var FLAG_CACHE = {};
  function flagHtml(code) {
    if (FLAG_CACHE[code]) return FLAG_CACHE[code];
    if (!FLAGS[code]) return GLOBE;
    return (FLAG_CACHE[code] = '<svg class="lp-flag" focusable="false" viewBox="0 0 30 20" width="30" height="20" aria-hidden="true">' + flagBody(FLAGS[code]) +
      '<rect x=".3" y=".3" width="29.4" height="19.4" rx="1" fill="none" stroke="rgba(0,0,0,.22)" stroke-width=".6"/></svg>');
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
      cur.textContent = regionName(state.country, 'en');
      btn.setAttribute('aria-label', t('언어·국가 선택') + ': ' + regionName(state.country, 'en') + ', ' + LANG_OF[state.lang].n);
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
        return '<li role="option" id="' + id + '-o' + i + '" data-c="' + r.code + '" aria-selected="' + (r.code === state.country) + '"><span class="lp-name">' + esc(r.name) + '</span></li>';
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
