/* ═════════════════════════════════════════════════
   guide.js — 사용법(desktop.html 왼쪽 메뉴 "사용법")
   2026-11-15 개편: 예전 25쪽 퀴즈 강의를 없애고 나비 사용자 매뉴얼(manual/) 한 곳으로 합쳤다.
   탭: 나비 사용자 매뉴얼 | 질문·답변 | Openhash | Navi Pro(두 탭은 준비 중 자리). 매뉴얼 장 아래에 사용법 도우미(manual-chat.js)가 붙어 현재 장을 안다.
   나비 온도는 매뉴얼 진행률(localStorage naviweb_manual_frac_v1)만으로 계산한다. 순수 함수(_pure)는 DOM 없이 Node 에서 테스트한다.
   ═════════════════════════════════════════════════ */
(function (root) {
  'use strict';
  // 나비 온도: 초급·중급·고급 단계별 구간 36.5 → 60 → 80 → 100. 단계마다 매뉴얼 진행률(0~1)만큼 오른다.
  var TEMP_SPAN = [23.5, 20, 20], CNS_AT = 95;
  function naviTemp(manualFr) {
    var t = 36.5;
    for (var i = 0; i < 3; i++) t += TEMP_SPAN[i] * Math.max(0, Math.min(1, (manualFr && +manualFr[i]) || 0));
    return Math.min(100, Math.round(t * 10) / 10);
  }
  function manualFr() { try { var m = JSON.parse(localStorage.getItem('naviweb_manual_frac_v1')); return m ? [m.beginner, m.intermediate, m.advanced] : null; } catch (_) { return null; } }
  function tempNow() { return naviTemp(manualFr()); }

  var TABS = [['manual', '나비 사용자 매뉴얼'], ['qna', '질문·답변'], ['openhash', 'Openhash'], ['navipro', 'Navi Pro']];
  var S = { mode: 'manual', mn: null, mnP: null, qn: null, mc: null, mcApi: null, api: null };
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function $(id) { return document.getElementById(id); }

  function modesHtml() {
    return '<div class="gd-modes" role="tablist" aria-label="사용법">' + TABS.map(function (t) {
      return '<button type="button" role="tab" class="gd-mode' + (S.mode === t[0] ? ' on' : '') + '" aria-selected="' + (S.mode === t[0]) + '" data-act="mode" data-m="' + t[0] + '">' + t[1] + '</button>';
    }).join('') + tempHtml() + '</div>';
  }
  function tempHtml() {
    var t = tempNow(), cns = t >= CNS_AT;
    return '<span class="gd-temp" title="초급·중급·고급을 마칠수록 36.5°에서 100°까지 올라갑니다. 95° 이상이면 나비웹 전문가 인증서(CNS)를 발급합니다.">🌡 나비 온도 <b>' + t.toFixed(1) + '°</b>' +
      (cns ? ' <button type="button" class="gd-cns" data-act="cns">인증서 발급</button>' : '') + '</span>';
  }

  // 나비 사용자 매뉴얼(2026-11-14): 같은 사이트의 manual/ 아래 매뉴얼을 틀 안에 넣는다. 한 번 만들어 두고 탭을 오가도 읽던 자리를 유지한다.
  // iframe 없이 같은 페이지 안에 직접 붙인다: 매뉴얼 HTML을 한 번만 받아 shadow root 안에서 실행한다(스타일 격리).
  function mountManual() {
    if (S.mnP) return S.mnP;
    var host = document.createElement('div');
    host.id = 'navi-manual-host'; host.className = 'gd-manual';
    host.innerHTML = '<div class="gd-manual-wait">매뉴얼을 불러오는 중…</div>';
    S.mn = host;
    S.mnP = fetch('manual/hondi_interactive_manual.html', { credentials: 'same-origin', cache: 'no-cache' }).then(function (r) {
      if (!r.ok) throw new Error('manual ' + r.status);
      return r.text();
    }).then(function (html) {
      var doc = new DOMParser().parseFromString(html, 'text/html');
      var root = host.attachShadow({ mode: 'open' });
      Array.prototype.forEach.call(doc.head.querySelectorAll('style, link[rel=stylesheet]'), function (n) { root.appendChild(n.cloneNode(true)); });
      var script = doc.body.querySelector('script');
      var code = script ? script.textContent : '';
      if (script) script.remove();
      var page = document.createElement('div');
      page.className = 'mn-page';
      page.innerHTML = doc.body.innerHTML;
      root.appendChild(page);
      host.querySelector('.gd-manual-wait') && host.querySelector('.gd-manual-wait').remove();
      window.__naviManualRoot = root; window.__naviManualBase = 'manual/';
      try {
        var sc = document.createElement('script');
        sc.textContent = '(function(){' + code + '\n})();';
        root.appendChild(sc);
      } finally { delete window.__naviManualRoot; delete window.__naviManualBase; }
      return window.NaviManual || null;
    }).catch(function (err) {
      host.innerHTML = '<div class="gd-manual-wait">매뉴얼을 불러오지 못했습니다. 새로고침해 주세요.</div>';
      S.mnP = null;
      throw err;
    });
    return S.mnP;
  }
  function renderManual(el) {
    el.innerHTML = modesHtml();
    var p = mountManual();
    el.appendChild(S.mn);
    attachChat(el);
    p.then(function (api) { if (api) { api.refresh(); S.api = api; } if (S.mcApi) S.mcApi.refresh(); }).catch(function () { /* 안내문이 이미 표시됨 */ });
  }

  function renderQna(el) {
    el.innerHTML = modesHtml();
    if (!root.QnaUI) { el.insertAdjacentHTML('beforeend', '<div class="gd-card">질문·답변을 불러오지 못했습니다. 페이지를 새로고침해 주세요.</div>'); return; }
    if (!S.qn) { S.qn = document.createElement('div'); S.qn.className = 'qn-host'; root.QnaUI.mount(S.qn); }
    el.appendChild(S.qn);
  }
  function renderSoon(el, name) {
    el.innerHTML = modesHtml() + '<div class="gd-card"><h2 class="gd-h">' + esc(name) + '</h2><p>이 안내는 준비 중입니다. 곧 이 자리에서 만나 보실 수 있습니다.</p></div>';
  }
  // 매뉴얼 장 아래에 사용법 도우미 대화창(manual-chat.js)을 붙인다. 한 번 만들어 두고 장을 옮겨도 대화가 이어진다. 현재 장은 매뉴얼(NaviManual.current)에서 읽는다.
  function attachChat(el) {
    if (!el || !root.ManualChat) return;
    if (!S.mc) {
      S.mc = document.createElement('div'); S.mc.className = 'mc-host';
      S.mcApi = root.ManualChat.mount(S.mc, { getChapter: function () { try { return S.api && S.api.current ? S.api.current() : null; } catch (_) { return null; } } });
    }
    el.appendChild(S.mc);
    if (S.mn && !S.mn.__chBound) { S.mn.__chBound = true; S.mn.addEventListener('click', function () { setTimeout(function () { if (S.mcApi) S.mcApi.refresh(); }, 60); }); }
  }
  function render() {
    var el = $('tab-guide'); if (!el) return;
    if (S.mode === 'manual') renderManual(el);
    else if (S.mode === 'qna') renderQna(el);
    else renderSoon(el, S.mode === 'openhash' ? 'Openhash' : 'Navi Pro');
  }
  function onClick(ev) {
    var t = ev.target.closest && ev.target.closest('[data-act]'); if (!t) return;
    var act = t.getAttribute('data-act');
    if (act === 'cns') {
      S.mode = 'manual'; render();
      mountManual().then(function (api) { if (api) api.openCns(); }).catch(function () { /* 못 열면 매뉴얼 안의 배너로 발급 */ });
    } else if (act === 'mode') {
      var m = t.getAttribute('data-m'); S.mode = TABS.some(function (x) { return x[0] === m; }) ? m : 'manual'; render();
    }
  }
  function show() {
    var el = $('tab-guide'); if (!el) return;
    if (!el.__gdBound) { el.__gdBound = true; el.addEventListener('click', onClick); }
    render();
  }

  root.GuideUI = { show: show, _pure: { naviTemp: naviTemp, CNS_AT: CNS_AT, TABS: TABS }, _state: S };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.GuideUI;
})(typeof window !== 'undefined' ? window : globalThis);
