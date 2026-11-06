/* 사용법·설명서의 유튜브 영상 자리 — 장(chapter) 일련번호 → 유튜브 주소 (2026-11-06)
 *
 * 각 장의 제목 바로 아래, 본문이 시작하는 곳에 "영상 NN" 자리가 있다. 번호는 장 번호(1~25)와 같다.
 * 영상을 넣으려면 아래 VIDEOS 의 해당 번호에 유튜브 주소(또는 영상 ID 11자)만 적으면 된다. 비어 있으면 "준비 중" 자리만 보인다.
 *   watch?v=ID · youtu.be/ID · /embed/ID · /shorts/ID 어느 형태든 된다. 광고·추적을 줄이려고 youtube-nocookie.com 으로 연다.
 * 사용법 화면(guide.js)과 설명서(manual.html)가 같은 표를 쓴다. */
(function (root) {
  'use strict';
  var VIDEOS = {
     1: '',  2: '',  3: '',  4: '',  5: '',
     6: '',  7: '',  8: '',  9: '', 10: '',
    11: '', 12: '', 13: '', 14: '', 15: '',
    16: '', 17: '', 18: '', 19: '', 20: '',
    21: '', 22: '', 23: '', 24: '', 25: ''
  };
  var CSS = '.nv-slot{margin:6px 0 14px;border:1.5px dashed #b9c0d4;border-radius:12px;background:#f6f8fc;color:#5b6478;font-size:14px;overflow:hidden}' +
    '.nv-slot .nv-wait{display:flex;align-items:center;gap:10px;justify-content:center;height:112px;padding:10px;text-align:center}' +
    '.nv-slot .nv-no{display:inline-block;min-width:2.6em;padding:3px 9px;border-radius:999px;background:#e4e9f5;color:#34406b;font-weight:700;font-variant-numeric:tabular-nums}' +
    '.nv-slot.has{border:0;background:#000;border-radius:12px}.nv-slot iframe{display:block;width:100%;aspect-ratio:16/9;border:0}';
  function pad(n) { n = Number(n) || 0; return (n < 10 ? '0' : '') + n; }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  /** 유튜브 주소·ID → 영상 ID(11자) 또는 '' */
  function idOf(u) {
    u = String(u == null ? '' : u).trim(); if (!u) return '';
    if (/^[A-Za-z0-9_-]{11}$/.test(u)) return u;
    var m = /^(?:https?:\/\/)?(?:www\.|m\.|music\.)?(?:youtube(?:-nocookie)?\.com\/(?:watch\?(?:[^#]*&)?v=|embed\/|shorts\/|live\/|v\/)|youtu\.be\/)([A-Za-z0-9_-]{11})(?![A-Za-z0-9_-])/i.exec(u);
    return m ? m[1] : '';
  }
  /** 장 번호 n 의 영상 자리 HTML */
  function slot(n) {
    var id = idOf(VIDEOS[n]), no = pad(n);
    if (id) return '<div class="nv-slot has" data-vid="' + n + '"><iframe src="https://www.youtube-nocookie.com/embed/' + id + '?rel=0" title="나비웹 사용법 영상 ' + no + '" loading="lazy" allow="accelerometer; encrypted-media; picture-in-picture; fullscreen" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe></div>';
    return '<div class="nv-slot" data-vid="' + n + '" role="note" aria-label="영상 ' + no + ' 준비 중"><div class="nv-wait"><span class="nv-no">영상 ' + no + '</span><span>▶ 준비 중입니다</span></div></div>';
  }
  /** 문서 안의 <div class="nv-slot" data-vid="N"> 자리를 채운다(설명서용) + 스타일을 한 번 넣는다 */
  function mount(doc) {
    doc = doc || root.document; if (!doc || !doc.head) return;
    if (!doc.getElementById('nv-style')) { var st = doc.createElement('style'); st.id = 'nv-style'; st.textContent = CSS; doc.head.appendChild(st); }
    Array.prototype.forEach.call(doc.querySelectorAll('.nv-slot[data-vid]'), function (el) {
      if (el.getAttribute('data-ready')) return;
      var t = doc.createElement('div'); t.innerHTML = slot(Number(el.getAttribute('data-vid')));
      var n = t.firstChild; n.setAttribute('data-ready', '1'); el.parentNode.replaceChild(n, el);
    });
  }
  var api = { VIDEOS: VIDEOS, idOf: idOf, slot: slot, mount: mount, CSS: CSS, pad: pad };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.NaviVideos = api;
})(typeof window !== 'undefined' ? window : globalThis);
