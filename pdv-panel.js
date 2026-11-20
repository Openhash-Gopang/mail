/* PDV(내 기록) 패널 — 2026-11-21: 설정 > 내 기록을 iframe(pdv.html) 없이 이 화면에 직접 그린다.
   hondi 의 pdv.html 을 #pdv-root 아래로 옮긴 것이다(마크업·동작 그대로, 스타일은 pdv-panel.css 가 #pdv-root 아래로만 적용).
   자료 저장소(pdv-store.js)·지갑(gopang-wallet.js)은 hondi 와 같은 출처(naviweb.kr/_h)에서 읽어 같은 기록을 본다. */
(function () {
  var MARKUP = "<div class=\"app\">\n<div class=\"mainc\">\n<div class=\"wrap\">\n\n  <div class=\"head\">\n    <div class=\"sp\"></div>\n    <div class=\"seg\" role=\"group\" aria-label=\"보기 대상\">\n      <button type=\"button\" aria-pressed=\"true\"><svg class=\"ic\" viewBox=\"0 0 24 24\" aria-hidden=\"true\"><circle cx=\"12\" cy=\"8\" r=\"4\"/><path d=\"M4 20c1-4 4-6 8-6s7 2 8 6\"/></svg>개인</button>\n      <button type=\"button\" aria-pressed=\"false\"><svg class=\"ic\" viewBox=\"0 0 24 24\" aria-hidden=\"true\"><rect x=\"5\" y=\"3\" width=\"14\" height=\"18\" rx=\"1.5\"/><path d=\"M9 8h2M13 8h2M9 12h2M13 12h2M10 21v-4h4v4\"/></svg>조직</button>\n    </div>\n    <div class=\"dd\" id=\"rp-dd\"><button type=\"button\" class=\"btn\" id=\"rp-btn\" aria-haspopup=\"menu\" aria-expanded=\"false\" aria-controls=\"rp-menu\"><svg class=\"ic\" viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M7 3h7l4 4v14H7z\"/><path d=\"M14 3v4h4M10 12h5M10 16h5\"/></svg>보고서<svg class=\"ic dd-cv\" viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"m6 9 6 6 6-6\"/></svg></button>\n      <div class=\"menu\" id=\"rp-menu\" role=\"menu\" aria-labelledby=\"rp-btn\" hidden></div></div>\n  </div>\n\n  <div class=\"tabs\" role=\"tablist\" aria-label=\"금고 보기\">\n    <button class=\"tab\" role=\"tab\" id=\"t-vault\" aria-selected=\"true\" aria-controls=\"p-vault\" type=\"button\"><svg class=\"ic\" viewBox=\"0 0 24 24\" aria-hidden=\"true\"><rect x=\"3\" y=\"3.5\" width=\"18\" height=\"15.5\" rx=\"2.8\"/><circle cx=\"12.5\" cy=\"11.2\" r=\"3\"/><circle cx=\"12.5\" cy=\"11.2\" r=\".6\"/><path d=\"M15.5 11.2H18\"/><path d=\"M6.5 19v1.8M17.5 19v1.8\"/></svg>기록 금고</button>\n    <button class=\"tab\" role=\"tab\" id=\"t-tx\" title=\"금전 거래 기록\" aria-selected=\"false\" aria-controls=\"p-tx\" type=\"button\" tabindex=\"-1\"><svg class=\"ic\" viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M7 7h12m0 0-3-3m3 3-3 3M17 17H5m0 0 3-3m-3 3 3 3\"/></svg>트랜잭션</button>\n    <button class=\"tab\" role=\"tab\" id=\"t-is\" title=\"포괄손익계산서 (K-IFRS 1001)\" aria-selected=\"false\" aria-controls=\"p-is\" type=\"button\" tabindex=\"-1\"><svg class=\"ic\" viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"m4 16 5-5 4 4 7-8\"/><path d=\"M15 7h5v5\"/></svg>손익계산서</button>\n    <button class=\"tab\" role=\"tab\" id=\"t-bs\" title=\"재무상태표 (K-IFRS 1001)\" aria-selected=\"false\" aria-controls=\"p-bs\" type=\"button\" tabindex=\"-1\"><svg class=\"ic\" viewBox=\"0 0 24 24\" aria-hidden=\"true\"><rect x=\"3.5\" y=\"4.5\" width=\"17\" height=\"15\" rx=\"2.5\"/><path d=\"M12 4.5v15M7 9h2.5M7 12.5h2.5M14.5 9H17M14.5 12.5H17\"/></svg>대차대조표</button>\n    <button class=\"tab\" role=\"tab\" id=\"t-cf\" title=\"현금흐름표 (K-IFRS 1007)\" aria-selected=\"false\" aria-controls=\"p-cf\" type=\"button\" tabindex=\"-1\"><svg class=\"ic\" viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M4 7h14a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z\"/><path d=\"M4 7l11-3v3M16 14h2\"/></svg>현금흐름표</button>\n    <button class=\"tab\" role=\"tab\" id=\"t-fa\" title=\"재무분석 보고서\" aria-selected=\"false\" aria-controls=\"p-fa\" type=\"button\" tabindex=\"-1\"><svg class=\"ic\" viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M5 20V10M12 20V4M19 20v-7\"/></svg>재무분석 보고서</button>\n    <button class=\"tab\" role=\"tab\" id=\"t-docs\" title=\"발급받아 보관한 서류와 유효 기간\" aria-selected=\"false\" aria-controls=\"p-docs\" type=\"button\" tabindex=\"-1\"><svg class=\"ic\" viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M7 3h7l4 4v14H7z\"/><path d=\"M14 3v4h4M10 13h5M10 17h5\"/></svg>보관 서류</button>\n  </div>\n  <div id=\"p-vault\" role=\"tabpanel\" aria-labelledby=\"t-vault\">\n  <!-- 일기·메모 -->\n  <section class=\"card diary\" aria-label=\"일기와 메모\">\n    <div class=\"dy-h\"><h2>일기 · 메모</h2><span class=\"pill\">검색 가능</span><span class=\"sp\"></span>\n      <label class=\"dy-search\"><svg viewBox=\"0 0 24 24\"><circle cx=\"11\" cy=\"11\" r=\"7\"/><path d=\"m20 20-4-4\"/></svg><input id=\"dy-q\" type=\"search\" placeholder=\"메모 검색 (내용·날짜)\" aria-label=\"메모 검색\"></label></div>\n    <form class=\"dy-comp\" id=\"dy-form\"><div class=\"ibar-att\" hidden></div>\n      <div class=\"ibar\"><input type=\"file\" class=\"ib-file\" multiple hidden><input type=\"file\" class=\"ib-cam\" accept=\"image/*\" capture=\"environment\" hidden>\n        <button type=\"button\" class=\"ib-btn\" data-k=\"clip\" aria-label=\"파일 첨부\" title=\"파일 첨부\"><svg width=\"18\" height=\"18\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48\"/></svg></button>\n        <textarea id=\"dy-text\" rows=\"1\" placeholder=\"오늘 있었던 일, 떠오른 생각을 바로 적어 두세요\" aria-label=\"새 메모\"></textarea>\n        <button type=\"button\" class=\"ib-btn\" data-k=\"cam\" aria-label=\"카메라\" title=\"사진 촬영\"><svg width=\"18\" height=\"18\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z\"/><circle cx=\"12\" cy=\"13\" r=\"4\"/></svg></button>\n        <button type=\"button\" class=\"ib-btn\" data-k=\"mic\" aria-label=\"음성 입력\" title=\"음성 입력\"><svg width=\"18\" height=\"18\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z\"/><path d=\"M19 10v2a7 7 0 0 1-14 0v-2\"/><line x1=\"12\" y1=\"19\" x2=\"12\" y2=\"23\"/><line x1=\"8\" y1=\"23\" x2=\"16\" y2=\"23\"/></svg></button>\n        <button type=\"submit\" class=\"ib-send\" aria-label=\"입력\" title=\"입력\" disabled><svg width=\"16\" height=\"16\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><line x1=\"12\" y1=\"19\" x2=\"12\" y2=\"5\"/><polyline points=\"5 12 12 5 19 12\"/></svg></button></div>\n</form>\n    <div class=\"dy-list\" id=\"dy-list\" aria-live=\"polite\"></div>\n  </section>\n  <!-- 3열 — 기록 목록 -->\n  <section class=\"card tcard\" aria-label=\"기록 목록\">\n    <div class=\"t-h\">\n      <h2>기록 목록</h2>\n    </div>\n    <div class=\"cols\" role=\"row\">\n      <span>언제 <svg viewBox=\"0 0 12 12\"><path d=\"M6 2v8M3 7l3 3 3-3\"/></svg></span><span>누가</span><span>어디서</span><span>무엇을</span><span>왜 · 어떻게</span><span></span>\n    </div>\n    <div id=\"rec-list\" aria-live=\"polite\"></div>\n    <div class=\"t-f\"><span class=\"num\" id=\"rec-count\"></span><span>행을 누르면 아래로 6하원칙과 기록 정보가 펼쳐집니다</span></div>\n  </section>\n\n  <section class=\"card keep\" aria-label=\"보관 위치\">\n    <div class=\"it\"><span class=\"tile\"><svg class=\"ic\" viewBox=\"0 0 24 24\"><rect x=\"7\" y=\"2.5\" width=\"10\" height=\"19\" rx=\"2.5\"/><path d=\"M11 18.5h2\"/></svg></span><div><b>원본: 폰</b><small>PC에서는 클라우드 백업으로 불러옵니다</small></div></div>\n    <div class=\"it\"><span class=\"tile\"><svg class=\"ic\" viewBox=\"0 0 24 24\"><path d=\"M7 18a4 4 0 0 1-.6-7.96A6 6 0 0 1 18 9a4.5 4.5 0 0 1 0 9z\"/></svg></span><div><b>백업: 나비 L1 (기본)</b><small>직접 지정도 가능 · 복구 문구 12자</small></div></div>\n    <div class=\"sp\"></div>\n    <button class=\"btn\" type=\"button\" id=\"btn-src\" aria-expanded=\"false\" aria-controls=\"srcbar\"><svg class=\"ic\" viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M4 20h4L19 9l-4-4L4 16z\"/><path d=\"m13 7 4 4\"/></svg>저장소 변경</button>\n  </section>\n\n  <section class=\"card srcpanel\" id=\"srcbar\" aria-label=\"저장소 변경\" hidden>\n  <div class=\"row\">\n    <span>PDV 원본 보관</span>\n    <label><input type=\"radio\" name=\"pdv-mode\" value=\"phone\" checked disabled> <b>폰</b> (원본)</label>\n    <span class=\"st\">· 백업 저장소</span>\n    <label><input type=\"radio\" name=\"pdv-cloud\" value=\"l1\" checked> <b>나비 L1</b> (기본)</label>\n    <label><input type=\"radio\" name=\"pdv-cloud\" value=\"par\"> 직접 지정</label>\n    <input id=\"cl-url\" type=\"url\" style=\"width:min(340px,90%)\" placeholder=\"Oracle PAR URL 등 (https://…/o/)\" hidden aria-label=\"백업 저장소 주소\">\n  </div>\n  <div class=\"row\">\n    <input id=\"cl-phrase\" type=\"password\" autocomplete=\"off\" style=\"width:190px\" placeholder=\"복구 문구 (12자 이상)\" aria-label=\"복구 문구\">\n    <input id=\"cl-phrase2\" type=\"password\" autocomplete=\"off\" style=\"width:190px\" placeholder=\"복구 문구 확인\" aria-label=\"복구 문구 확인\" hidden>\n    <button type=\"button\" id=\"btn-cl-restore\" hidden>클라우드에서 불러오기</button>\n    <button type=\"button\" id=\"btn-cl-backup\" hidden>지금 백업</button>\n    <span class=\"st\" id=\"cl-state\"></span>\n  </div>\n  <div class=\"row\"><span class=\"st\">백업은 폰에서 암호화되어 저장소에 올라가며, 복구 문구는 서버로 전송·저장되지 않습니다. 문구를 잃으면 복구할 수 없습니다.</span></div>\n  <div class=\"row\" id=\"src-pc\" hidden>\n    <span class=\"st\">대안(불안정할 수 있음): 폰과 직접 연결</span>\n    <input id=\"src-phone\" inputmode=\"numeric\" maxlength=\"8\" placeholder=\"폰 번호 뒷자리 8자\" hidden aria-label=\"010을 제외한 폰 번호 뒷자리 8자\">\n    <button type=\"button\" id=\"btn-phone-fetch\">폰에서 불러오기</button>\n    <span class=\"st\" id=\"src-state\"></span>\n  </div>\n</section>\n\n\n  </div>\n  <div id=\"p-tx\" role=\"tabpanel\" aria-labelledby=\"t-tx\" hidden>\n    <div class=\"kps\" id=\"tx-kp\"></div>\n    <section class=\"card txcard\" aria-label=\"트랜잭션 목록\">\n      <div class=\"tx-h\"><h2>트랜잭션</h2><span class=\"sp\"></span>\n        <label class=\"dy-search\"><svg viewBox=\"0 0 24 24\"><circle cx=\"11\" cy=\"11\" r=\"7\"/><path d=\"m20 20-4-4\"/></svg><input id=\"tx-q\" type=\"search\" placeholder=\"거래처·내용·계정·결제수단 검색\" aria-label=\"트랜잭션 검색\"></label></div>\n      <div class=\"dy-tags\" id=\"tx-f\" role=\"group\" aria-label=\"구분\"><button class=\"chip\" type=\"button\" data-f=\"\" aria-pressed=\"true\">전체</button><button class=\"chip\" type=\"button\" data-f=\"수입\" aria-pressed=\"false\">수입</button><button class=\"chip\" type=\"button\" data-f=\"지출\" aria-pressed=\"false\">지출</button><button class=\"chip\" type=\"button\" data-f=\"이체\" aria-pressed=\"false\">이체</button></div>\n      <div class=\"tx-cols\"><span>언제</span><span>누가(상대)</span><span>무엇을</span><span>계정</span><span class=\"r\">금액(원)</span><span></span></div>\n      <div id=\"tx-list\" aria-live=\"polite\"></div>\n    </section></div>\n  <div id=\"p-is\" role=\"tabpanel\" aria-labelledby=\"t-is\" hidden><div class=\"mo\" data-m=\"org\"><section class=\"card fscard\" aria-label=\"포괄손익계산서\"><div class=\"fs-h\"><div><h2>포괄손익계산서</h2></div></div><div class=\"dy-empty\">아직 기록된 거래가 없습니다. 거래가 기록되면 자동으로 작성됩니다.</div></section></div><div class=\"mo\" data-m=\"person\"><section class=\"card fscard\" aria-label=\"소득·지출 계산서\"><div class=\"fs-h\"><div><h2>소득·지출 계산서</h2></div></div><div class=\"dy-empty\">아직 기록된 거래가 없습니다. 거래가 기록되면 자동으로 작성됩니다.</div></section></div>\n  </div>\n  <div id=\"p-bs\" role=\"tabpanel\" aria-labelledby=\"t-bs\" hidden><div class=\"mo\" data-m=\"org\"><section class=\"card fscard\" aria-label=\"재무상태표\"><div class=\"fs-h\"><div><h2>재무상태표</h2></div></div><div class=\"dy-empty\">아직 기록된 거래가 없습니다. 거래가 기록되면 자동으로 작성됩니다.</div></section></div><div class=\"mo\" data-m=\"person\"><section class=\"card fscard\" aria-label=\"순자산 대차대조표\"><div class=\"fs-h\"><div><h2>순자산 대차대조표</h2></div></div><div class=\"dy-empty\">아직 기록된 거래가 없습니다. 거래가 기록되면 자동으로 작성됩니다.</div></section></div>\n  </div>\n  <div id=\"p-cf\" role=\"tabpanel\" aria-labelledby=\"t-cf\" hidden><div class=\"mo\" data-m=\"org\"><section class=\"card fscard\" aria-label=\"현금흐름표\"><div class=\"fs-h\"><div><h2>현금흐름표</h2></div></div><div class=\"dy-empty\">아직 기록된 거래가 없습니다. 거래가 기록되면 자동으로 작성됩니다.</div></section></div><div class=\"mo\" data-m=\"person\"><section class=\"card fscard\" aria-label=\"현금흐름표 (개인)\"><div class=\"fs-h\"><div><h2>현금흐름표 (개인)</h2></div></div><div class=\"dy-empty\">아직 기록된 거래가 없습니다. 거래가 기록되면 자동으로 작성됩니다.</div></section></div>\n  </div>\n  <div id=\"p-docs\" role=\"tabpanel\" aria-labelledby=\"t-docs\" hidden>\n    <section class=\"card\" aria-label=\"보관 서류\">\n      <div class=\"t-h\"><h2>보관 서류</h2><span class=\"pill\">이 기기에만 보관</span><span class=\"sp\"></span></div>\n      <p class=\"mut\" style=\"margin:4px 0 12px;font-size:13px\">나비웹 도우미가 발급받았거나 서류에 첨부해 보관한 파일입니다. 유효 기간이 지나면 자동으로 지워지며, 언제든 직접 내려받거나 삭제할 수 있습니다.</p>\n      <div id=\"kd-list\" aria-live=\"polite\"><div class=\"mut\">불러오는 중…</div></div>\n    </section>\n  </div>\n  <div id=\"p-fa\" role=\"tabpanel\" aria-labelledby=\"t-fa\" hidden><div class=\"mo\" data-m=\"org\"><section class=\"card fscard\" aria-label=\"재무분석 보고서\"><div class=\"fs-h\"><div><h2>재무분석 보고서</h2></div></div><div class=\"dy-empty\">아직 기록된 거래가 없습니다. 거래가 기록되면 자동으로 작성됩니다.</div></section></div><div class=\"mo\" data-m=\"person\"><section class=\"card fscard\" aria-label=\"재무분석 보고서 (개인)\"><div class=\"fs-h\"><div><h2>재무분석 보고서 (개인)</h2></div></div><div class=\"dy-empty\">아직 기록된 거래가 없습니다. 거래가 기록되면 자동으로 작성됩니다.</div></section></div>\n  </div>\n  <div id=\"p-rep\" role=\"region\" aria-label=\"보고서\" hidden>\n    <section class=\"card rep-h\">\n      <div class=\"rep-top\"><div><div class=\"cap\" id=\"rp-kind\">주간 보고서</div><h2 id=\"rp-title\">2026.10.26 ~ 2026.11.01</h2></div><div class=\"sp\"></div><span class=\"pill\" id=\"rp-auto\">자동 작성</span><button class=\"btn\" type=\"button\"><svg class=\"ic\" viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M12 3v12m0 0 4-4m-4 4-4-4M5 21h14\"/></svg>내보내기</button></div>\n      <div class=\"chips rep-sw\" id=\"rp-sw\" role=\"group\" aria-label=\"보고서 종류\"></div>\n    </section>\n    <div class=\"kps\" id=\"rp-kp\"></div>\n    <div class=\"rep-grid\">\n      <section class=\"card rep-c\"><h2>한눈에 보기</h2><ul class=\"sum\" id=\"rp-sum\"></ul></section>\n      <section class=\"card rep-c\"><h2>누가 활동했나</h2><div id=\"rp-mix\"></div></section>\n      <section class=\"card rep-c\"><h2>주요 활동</h2><div id=\"rp-act\"></div></section>\n      <section class=\"card rep-c\"><h2>돈의 흐름</h2><div id=\"rp-fin\"></div></section>\n    </div>\n    <section class=\"card rep-c rep-auto\"><div class=\"rep-ah\"><h2>자동 작성</h2><span class=\"cap\">보고서는 이 기기에서 정해진 시각에 자동으로 만들어집니다. 원문은 밖으로 나가지 않습니다.</span></div>\n      <div id=\"rp-sch\" class=\"sch\"></div></section>\n  </div>\n</div>\n</div></div>\n\n<!-- 나만의 AI 비서 (우측 하단) -->\n\n<section class=\"bot\" id=\"bot\" role=\"dialog\" aria-label=\"나만의 AI 비서\" hidden>\n  <div class=\"bot-h\"><span class=\"bot-av\"><svg class=\"ic\" viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M12 12c-2-5-6-7-8-5s0 7 5 7c-3 1-3 5-1 6s4-2 4-5\"/><path d=\"M12 12c2-5 6-7 8-5s0 7-5 7c3 1 3 5 1 6s-4-2-4-5\"/><path d=\"M12 8v10\"/></svg></span><div><b>나비</b><small id=\"bot-st\">나만의 AI 비서 · 불러오는 중…</small></div><span class=\"sp\"></span><button class=\"ib\" type=\"button\" id=\"bot-x\" aria-label=\"닫기\"><svg class=\"ic\" viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"m6 6 12 12M18 6 6 18\"/></svg></button></div>\n  <div class=\"bot-b\" id=\"bot-msgs\" aria-live=\"polite\"></div>\n  <div class=\"bot-sg\" id=\"bot-sg\"></div>\n  <form class=\"bot-f\" id=\"bot-form\"><div class=\"ibar-att\" hidden></div>\n      <div class=\"ibar\"><input type=\"file\" class=\"ib-file\" multiple hidden><input type=\"file\" class=\"ib-cam\" accept=\"image/*\" capture=\"environment\" hidden>\n        <button type=\"button\" class=\"ib-btn\" data-k=\"clip\" aria-label=\"파일 첨부\" title=\"파일 첨부\"><svg width=\"18\" height=\"18\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48\"/></svg></button>\n        <input id=\"bot-in\" type=\"text\" autocomplete=\"off\" placeholder=\"나비에게 지시하거나 검색하세요\" aria-label=\"나비에게 메시지\">\n        <button type=\"button\" class=\"ib-btn\" data-k=\"cam\" aria-label=\"카메라\" title=\"사진 촬영\"><svg width=\"18\" height=\"18\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z\"/><circle cx=\"12\" cy=\"13\" r=\"4\"/></svg></button>\n        <button type=\"button\" class=\"ib-btn\" data-k=\"mic\" aria-label=\"음성 입력\" title=\"음성 입력\"><svg width=\"18\" height=\"18\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z\"/><path d=\"M19 10v2a7 7 0 0 1-14 0v-2\"/><line x1=\"12\" y1=\"19\" x2=\"12\" y2=\"23\"/><line x1=\"8\" y1=\"23\" x2=\"16\" y2=\"23\"/></svg></button>\n        <button type=\"submit\" class=\"ib-send\" aria-label=\"입력\" title=\"입력\" disabled><svg width=\"16\" height=\"16\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><line x1=\"12\" y1=\"19\" x2=\"12\" y2=\"5\"/><polyline points=\"5 12 12 5 19 12\"/></svg></button></div></form>\n</section>\n\n";
  var PARTS = [
function(){
(function(){
  var $=function(id){return document.getElementById(id)};
  var esc=function(x){return String(x==null?'':x).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})};
  var CHEV='<svg class="chev" viewBox="0 0 12 12" aria-hidden="true"><path d="m2 4 4 4 4-4"/></svg>';
  var R=[], list=$('rec-list');
  function P2(n){return String(n).padStart(2,'0')}
  function when(iso){var d=new Date(iso); if(isNaN(d))return '';var n=new Date(),y=new Date(n);y.setDate(n.getDate()-1);
    var k=function(x){return x.getFullYear()+'-'+x.getMonth()+'-'+x.getDate()},hm=P2(d.getHours())+':'+P2(d.getMinutes());
    return k(d)===k(n)?'오늘 '+hm:k(d)===k(y)?'어제 '+hm:P2(d.getMonth()+1)+'.'+P2(d.getDate())+' '+hm}
  function full(iso){var d=new Date(iso);return isNaN(d)?'확인불가':d.getFullYear()+'-'+P2(d.getMonth()+1)+'-'+P2(d.getDate())+' '+P2(d.getHours())+':'+P2(d.getMinutes())+' KST'}
  function high(r){var t=(window.GopangAuth&&window.GopangAuth.tier)||'L0';return r.risk_level==='high'&&!(t==='L2'||t==='L3')}
  window.renderList=function(){
    $('rec-count').textContent=R.length.toLocaleString('ko-KR')+'건';
    if(!R.length){list.innerHTML='<div class="dy-empty">아직 기록이 없습니다. 나비와 나눈 대화와 서비스 이용 내역이 자동으로 쌓입니다.</div>';return;}
    list.innerHTML=R.map(function(r,i){
      var w=r.summary_6w_view||{},lk=high(r),svc=r.service||r.serviceId||'기록',ts=r.ts||r.when;
      var what=lk?'민감도 높은 기록 — 인증 후 열람':(w.what||r.summary||'(요약 없음)');
      var row='<button class="row" type="button" aria-expanded="false" aria-controls="rp-r'+i+'"><span class="num">'+esc(when(ts))+'</span>'+
        '<span>'+esc(lk?'—':(w.who||'나'))+'<div class="sub2">'+esc(r.category_label||'')+'</div></span><span>'+esc(lk?'—':(w.where||svc))+'</span>'+
        '<span class="what">'+esc(what)+'</span><span><span class="why">'+esc(lk?'':(w.why||''))+'</span><div class="sub2">'+esc(lk?'':(w.how||''))+'</div></span>'+
        '<span class="stc">'+CHEV+'</span></button>';
      var rows=[['누가',w.who||'나'],['언제',w.when||full(ts)],['어디서',w.where||svc],['무엇을',w.what||r.summary||'확인불가'],['어떻게',w.how||'확인불가'],['왜',w.why||'확인불가']];
      var body=lk?'<div><h3>열람 제한</h3><p class="full">위험도가 높은 기록입니다. 인증 등급이 올라간 뒤(L2 이상) 열람할 수 있습니다.</p></div>':
        '<div><h3>6하원칙</h3><dl class="w6">'+rows.map(function(x){return '<div><dt>'+x[0]+'</dt><dd>'+esc(x[1])+'</dd></div>'}).join('')+'</dl></div>'+
        '<div><h3>기록 정보</h3><div class="proof"><div><span>기록 시각</span><span>'+esc(full(ts))+'</span></div><div><span>원본 위치</span><span>이 기기</span></div></div></div>';
      return row+'<div class="rp" id="rp-r'+i+'" role="region" aria-label="'+esc(what)+' — 6하원칙과 기록 정보"><div class="rp-in"><div class="rp-body">'+body+'</div></div></div>';
    }).join('');
  };
  list.addEventListener('click',function(e){var b=e.target.closest('button.row'); if(!b)return; var open=b.getAttribute('aria-expanded')==='true';
    [].forEach.call(list.querySelectorAll('button.row'),function(o){o.setAttribute('aria-expanded','false');$(o.getAttribute('aria-controls')).classList.remove('open')});
    if(!open){b.setAttribute('aria-expanded','true');$(b.getAttribute('aria-controls')).classList.add('open')}});
  $('btn-src').addEventListener('click',function(){var p=$('srcbar'),o=p.hidden;p.hidden=!o;this.setAttribute('aria-expanded',o)});
  window.__setRecords=function(a){R=a||[];window.renderList()};
  window.PDV=window.PDV||{};window.PDV.records=function(){return R};
  (async function(){
    if(!window.GopangPDV){list.innerHTML='<div class="dy-empty">PDV 저장소 모듈(pdv-store.js)을 불러오지 못했습니다.</div>';return;}
    try{window.__setRecords(await window.GopangPDV.list())}catch(e){list.innerHTML='<div class="dy-empty">기록을 불러오지 못했습니다.</div>'}
  })();
})();
},
function(){
// ── PDV 원본 보관: 폰(기본) — PC 는 폰의 승인을 받아 불러온다(2026-11-07) ──
(function () {
  const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || '');
  const $ = (id) => document.getElementById(id);
  const WORKER = (window.GOPANG_WORKER || 'https://hondi-proxy.tensor-city.workers.dev').replace(/\/$/, '');
  if (isMobile) return;
  const user = (() => { try { return JSON.parse(localStorage.getItem('gopang_user_v4') || 'null'); } catch (e) { return null; } })();
  let e164 = user && user.e164 ? String(user.e164) : '';
  if (!e164) $('src-phone').hidden = false;
  const st = (m, c) => { const el = $('src-state'); el.textContent = m || ''; el.className = 'st' + (c ? ' ' + c : ''); };
  $('btn-phone-fetch').addEventListener('click', async () => {
    const btn = $('btn-phone-fetch'); btn.disabled = true; st('');
    try {
      if (!e164) {
        const d = ($('src-phone').value || '').replace(/\D/g, '');
        if (d.length !== 8) throw new Error('010을 제외한 폰 번호 뒷자리 8자를 입력하십시오.');
        e164 = '+8210' + d;
      }
      const { requestFromPhone } = await import('/src/gopang/pdv/phone-fetch.js');
      const keyPair = await GopangWallet.generateX25519KeyPair();
      const label = (/Windows/.test(navigator.userAgent) ? 'Windows PC' : /Mac/.test(navigator.userAgent) ? 'Mac' : '이 PC') + ' (' + location.hostname + ')';
      const data = await requestFromPhone({
        worker: WORKER, e164, keyPair, pcLabel: label,
        openWithKey: (sealed, priv) => GopangWallet.openSealedWithKey(priv, sealed),
        onState: (s) => st(s === 'pushed' ? '폰으로 승인 요청을 보냈습니다. 폰에서 확인해 주세요…' : s === 'no-push' ? '폰에 알림을 보내지 못했습니다. 폰에서 푸시 알림을 켜 주세요.' : s === 'receiving' ? '폰에서 받는 중…' : '폰의 승인을 기다리는 중…'),
      });
      const r = await window.GopangPDV.importRecords(data.records);
      st('불러왔습니다: ' + r.added + '건 추가' + (r.skipped ? ' (' + r.skipped + '건은 이미 있음)' : ''), 'ok');
      window.__setRecords(await window.GopangPDV.list());
    } catch (e) { st(e.message || '불러오지 못했습니다.', 'err'); e164 = user && user.e164 ? String(user.e164) : ''; }
    finally { btn.disabled = false; }
  });
})();

// ── PDV 클라우드 백업(방식 C): 기본 나비 L1 PocketBase, 사용자 지정 가능. PC 는 클라우드에서 불러온다(2026-11-08) ──
(function () {
  const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || '');
  const $ = (id) => document.getElementById(id);
  const WORKER = (window.GOPANG_WORKER || 'https://hondi-proxy.tensor-city.workers.dev').replace(/\/$/, '');
  const KEY = 'gopang_pdv_cloud';
  const load = () => { try { return JSON.parse(localStorage.getItem(KEY) || 'null') || { kind: 'l1', url: '' }; } catch (e) { return { kind: 'l1', url: '' }; } };
  const cfg = load();
  const radios = document.querySelectorAll('input[name="pdv-cloud"]');
  radios.forEach((r) => { r.checked = r.value === cfg.kind; });
  $('cl-url').value = cfg.url || ''; $('cl-url').hidden = cfg.kind !== 'par';
  radios.forEach((r) => r.addEventListener('change', () => {
    cfg.kind = r.value; $('cl-url').hidden = cfg.kind !== 'par';
    try { localStorage.setItem(KEY, JSON.stringify(cfg)); } catch (e) { /* 저장 불가여도 이번 세션은 동작 */ }
  }));
  $('cl-url').addEventListener('change', () => { cfg.url = $('cl-url').value.trim(); try { localStorage.setItem(KEY, JSON.stringify(cfg)); } catch (e) {} });
  $('btn-cl-restore').hidden = isMobile; $('btn-cl-backup').hidden = !isMobile; $('cl-phrase2').hidden = !isMobile;
  const st = (m, c) => { const el = $('cl-state'); el.textContent = m || ''; el.className = 'st' + (c ? ' ' + c : ''); };
  async function adapter(B) {
    if (cfg.kind === 'par') {
      const u = $('cl-url').value.trim();
      if (!/^https:\/\//.test(u)) throw new Error('저장소 주소(https://…)를 입력하십시오.');
      return new B.ParUrlAdapter(u);
    }
    const wallet = await GopangWallet.load();
    return new B.HondiL1Adapter({ worker: WORKER, wallet });
  }
  async function run(btn, fn) {
    btn.disabled = true; st('');
    try { await fn(await import('/src/gopang/pdv/backup.js')); }
    catch (e) { st(e.message || '실패했습니다.', 'err'); }
    finally { btn.disabled = false; }
  }
  $('btn-cl-backup').addEventListener('click', () => run($('btn-cl-backup'), async (B) => {
    const phrase = $('cl-phrase').value, c = B.checkPhrase(phrase);
    if (!c.ok) throw new Error(c.reason);
    const ad = await adapter(B);
    let header = null;
    try { header = JSON.parse(new TextDecoder().decode(await ad.get(B.HEADER_KEY))); } catch (e) { header = null; }
    let dek;
    if (header) dek = (await B.unlockDek(header, phrase)).dek;
    else {
      if (phrase !== $('cl-phrase2').value) throw new Error('복구 문구 확인이 일치하지 않습니다.');
      st('복구 문구로 키를 만드는 중…'); dek = (await B.initBackup(ad, phrase)).dek;
    }
    st('암호화해 올리는 중…');
    const r = await B.backupSnapshot(ad, dek, await window.GopangPDV.exportAll());
    st('백업했습니다: ' + r.count + '건', 'ok');
  }));
  $('btn-cl-restore').addEventListener('click', () => run($('btn-cl-restore'), async (B) => {
    const phrase = $('cl-phrase').value;
    if (!phrase) throw new Error('복구 문구를 입력하십시오.');
    st('클라우드에서 받는 중…');
    const r = await B.restoreLatest(await adapter(B), phrase);
    const m = await window.GopangPDV.importRecords(r.records, 'cloud');
    st('불러왔습니다: ' + m.added + '건 추가' + (m.skipped ? ' (' + m.skipped + '건은 이미 있음)' : '') + ' · 백업 시각 ' + new Date(r.ts).toLocaleString(), 'ok');
    window.__setRecords(await window.GopangPDV.list());
  }));
  if (!isMobile) $('src-pc').hidden = false;
})();
},
function(){
// 월별 기록 선 그래프 — 시안용 그리기 (실제 화면에서는 기록 수 집계를 넣는다)
(function(){
  var svg=document.getElementById('lc'); if(!svg) return; var NS='http://www.w3.org/2000/svg', W=460,H=210, L=34,R=14,T=26,B=28;
  var months=['5월','6월','7월','8월','9월','10월'], cur=[150,210,170,300,360,412], prev=[110,140,130,190,230,250], max=500, sel=5;
  var x=function(i){return L+i*(W-L-R)/(months.length-1)}, y=function(v){return T+(H-T-B)*(1-v/max)};
  function el(n,a,t){var e=document.createElementNS(NS,n);for(var k in a)e.setAttribute(k,a[k]);if(t!=null)e.textContent=t;svg.appendChild(e);return e}
  function path(vs){var p=vs.map(function(v,i){return [x(i),y(v)]}),d='M'+p[0][0]+' '+p[0][1];
    for(var i=0;i<p.length-1;i++){var p0=p[i-1]||p[i],p1=p[i],p2=p[i+1],p3=p[i+2]||p2,t=.18;
      d+=' C'+(p1[0]+(p2[0]-p0[0])*t)+' '+(p1[1]+(p2[1]-p0[1])*t)+' '+(p2[0]-(p3[0]-p1[0])*t)+' '+(p2[1]-(p3[1]-p1[1])*t)+' '+p2[0]+' '+p2[1];}
    return d}
  [0,200,400].forEach(function(v){ el('line',{x1:L,x2:W-R,y1:y(v),y2:y(v),stroke:'var(--line)','stroke-dasharray':'4 5'}); el('text',{x:L-8,y:y(v)+4,'text-anchor':'end','font-size':11,fill:'var(--faint)'},v); });
  months.forEach(function(m,i){ el('text',{x:x(i),y:H-8,'text-anchor':'middle','font-size':11,fill:i===sel?'var(--teal)':'var(--faint)','font-weight':i===sel?700:400},m); });
  el('path',{d:path(prev),fill:'none',stroke:'var(--sky)','stroke-width':2.5,'stroke-linecap':'round'});
  el('path',{d:path(cur),fill:'none',stroke:'var(--teal)','stroke-width':3,'stroke-linecap':'round'});
  var cx=x(sel), cy=y(cur[sel]);
  el('rect',{x:cx-34,y:cy-46,width:68,height:34,rx:10,fill:'var(--sky)'});
  el('text',{x:cx,y:cy-31,'text-anchor':'middle','font-size':11,fill:'var(--teal-d)','font-weight':700},cur[sel]+'건');
  el('text',{x:cx,y:cy-18,'text-anchor':'middle','font-size':10.5,fill:'var(--teal-d)'},months[sel]);
  el('circle',{cx:cx,cy:cy,r:5.5,fill:'var(--card)',stroke:'var(--teal)','stroke-width':3});
})();

// 보관 서류: 서류 작성 중 PDV 에 보관된 첨부서류(kind=attach)를 보여 준다. 같은 hondi.net 의 draft 중계(pdv-draft-bridge.html)를 숨은 iframe 으로 열어 읽는다.
(function(){
  var fr=null,seq=0,pend={},ready=false,q=[];
  function open(){ if(fr) return; fr=document.createElement('iframe'); fr.src=(typeof _HONDI_BASE==='string'?_HONDI_BASE:'')+'/pdv-draft-bridge.html'; fr.hidden=true; fr.title='PDV 중계';
    fr.addEventListener('load',function(){ ready=true; q.splice(0).forEach(function(f){f()}); }); document.body.appendChild(fr); }
  window.addEventListener('message',function(e){ var d=e.data; if(e.origin!==location.origin||!d||d.type!=='pdv-draft-result'||!pend[d.reqId]) return; var f=pend[d.reqId]; delete pend[d.reqId]; f(d); });
  function call(op,p){ return new Promise(function(res,rej){ open(); var id=++seq, t=setTimeout(function(){delete pend[id];rej(new Error('TIMEOUT'))},15000);
    pend[id]=function(r){clearTimeout(t); r.ok?res(r):rej(new Error(r.error||'FAILED'))};
    var send=function(){ fr.contentWindow.postMessage(Object.assign({type:'pdv-draft',reqId:id,op:op},p||{}),location.origin) }; ready?send():q.push(send); }); }
  var L=document.getElementById('kd-list');
  function esc(x){return String(x==null?'':x).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})}
  function dt(ms){ if(!ms) return '-'; var d=new Date(ms); return d.getFullYear()+'.'+('0'+(d.getMonth()+1)).slice(-2)+'.'+('0'+d.getDate()).slice(-2); }
  function render(items){
    var now=Date.now();
    items=items.filter(function(x){return x.kind==='attach'}).sort(function(a,b){return (b.issued||0)-(a.issued||0)});
    if(!items.length){ L.innerHTML='<div class="mut">보관된 서류가 없습니다. 도우미가 발급받은 서류는 여기에 자동으로 보관됩니다.</div>'; return; }
    L.innerHTML=items.map(function(it){
      var left=it.expires?Math.ceil((it.expires-now)/86400000):null, st=left==null?'':left<=0?'<span class="pill" style="background:#fde8e8;color:#b3261e">만료됨</span>':left<=7?'<span class="pill" style="background:#fff3d6;color:#8a5a00">'+left+'일 남음</span>':'<span class="pill">'+left+'일 남음</span>';
      return '<div class="row" style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:10px 4px;border-top:1px solid var(--line,#e3e8ec)"><div style="flex:1;min-width:200px"><b>'+esc(it.title||it.fileName||'서류')+'</b><div class="mut" style="font-size:12.5px">'+esc(it.fileName||'')+' · 발급 '+dt(it.issued)+' · <b>'+dt(it.expires)+'까지 유효</b> '+st+'</div></div>'
        +'<button type="button" class="btn" data-kd="dl" data-id="'+esc(it.id)+'">내려받기</button><button type="button" class="btn" data-kd="del" data-id="'+esc(it.id)+'">삭제</button></div>';
    }).join('');
  }
  function load(){ L.innerHTML='<div class="mut">불러오는 중…</div>'; call('purge').catch(function(){}).then(function(){ return call('list',{kind:'attach'}); }).then(function(r){ render(r.items||[]); }).catch(function(){ L.innerHTML='<div class="mut">보관 서류를 불러오지 못했습니다. 잠시 뒤 다시 열어 주세요.</div>'; }); }
  document.getElementById('t-docs').addEventListener('click',load);
  L.addEventListener('click',function(e){
    var b=e.target.closest&&e.target.closest('[data-kd]'); if(!b) return; var id=b.getAttribute('data-id');
    if(b.getAttribute('data-kd')==='del'){ (window.mpConfirm||function(m){return Promise.resolve(confirm(m));})('이 보관 서류를 삭제할까요? 되돌릴 수 없습니다.').then(function(ok){ if(!ok) return; call('delete',{id:id}).then(load).catch(function(){ alert('삭제하지 못했습니다.'); }); }); return; }
    call('get',{id:id}).then(function(r){ var it=r.item; if(!it||!it.fileData) throw new Error('NO_FILE'); var u=URL.createObjectURL(new Blob([it.fileData],{type:it.fileMime||'application/octet-stream'})); var a=document.createElement('a'); a.href=u; a.download=it.fileName||'서류'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(function(){URL.revokeObjectURL(u)},4000); }).catch(function(){ alert('내려받지 못했습니다.'); });
  });
})();

// 탭 전환 + 기록 행 펼침(아코디언: 한 번에 하나, 같은 행을 다시 누르면 접힘)
(function(){
  var tabs=[].slice.call(document.querySelectorAll('.tab'));
  function show(t){ tabs.forEach(function(b){var on=b===t; b.setAttribute('aria-selected',on); b.tabIndex=on?0:-1; var p=document.getElementById(b.getAttribute('aria-controls')); if(on){p.hidden=false; p.classList.remove('panel-in'); void p.offsetWidth; p.classList.add('panel-in');} else p.hidden=true;}); }
  tabs.forEach(function(b,i){ b.addEventListener('click',function(){show(b)}); b.addEventListener('keydown',function(e){ var j=e.key==='ArrowRight'?i+1:e.key==='ArrowLeft'?i-1:-1; if(j<0) return; j=(j+tabs.length)%tabs.length; tabs[j].focus(); show(tabs[j]); e.preventDefault(); }); });
  var rows=[].slice.call(document.querySelectorAll('.row'));
  rows.forEach(function(r){ r.addEventListener('click',function(){
    var open=r.getAttribute('aria-expanded')==='true';
    rows.forEach(function(o){ o.setAttribute('aria-expanded','false'); document.getElementById(o.getAttribute('aria-controls')).classList.remove('open'); });   // 이전 패널은 접히고
    if(!open){ r.setAttribute('aria-expanded','true'); document.getElementById(r.getAttribute('aria-controls')).classList.add('open'); }   // 새 패널이 펼쳐진다
  }); });
})();

// 일기·메모: 즉시 추가 + 실시간 검색 + 상세가 있는 메모만 행 아래 패널(slide out) 제공
(function(){
  var M=[];try{M=JSON.parse(localStorage.getItem('pdv_diary_v1')||'[]')||[]}catch(e){M=[]}
  function saveM(){try{localStorage.setItem('pdv_diary_v1',JSON.stringify(M.map(function(m){return {d:m.d,t:m.t,att:m.att}})))}catch(e){}}
  var id=0,q=document.getElementById('dy-q'),L=document.getElementById('dy-list'),T=document.getElementById('dy-text'),F=document.getElementById('dy-form'),TG=null;
  var chips=[].slice.call(F.querySelectorAll('.chip'));
  M.forEach(function(m){m.id=++id});
  function esc(x){return x.replace(/[&<>]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;'}[c]})}
  function hl(x,ws){x=esc(x); ws.forEach(function(w){ if(!w) return; var r=new RegExp('('+w.replace(/[.*+?^${}()|[\\]\\\\]/g,'\\\\$&')+')','gi'); x=x.replace(r,'<mark>$1</mark>'); }); return x;}
  var WD=['일','월','화','수','목','금','토'];
  function P2(n){return String(n).padStart(2,'0')}
  function dt(d){var a=d.split(/[- :]/);return new Date(+a[0],+a[1]-1,+a[2],+a[3],+a[4],0)}
  function ymd(x){return x.getFullYear()+'-'+P2(x.getMonth()+1)+'-'+P2(x.getDate())}
  function brief(d){var x=dt(d),n=new Date(),y=new Date(n);y.setDate(n.getDate()-1),hm=d.slice(11,16);
    if(ymd(x)===ymd(n))return '오늘 '+hm; if(ymd(x)===ymd(y))return '어제 '+hm; return (x.getFullYear()===n.getFullYear()?'':x.getFullYear()+'.')+P2(x.getMonth()+1)+'.'+P2(x.getDate())+' '+hm}
  function full(m){var x=dt(m.d),sec=m.sec||'00';return x.getFullYear()+'년 '+(x.getMonth()+1)+'월 '+x.getDate()+'일 ('+WD[x.getDay()]+') '+m.d.slice(11,16)+':'+sec+' KST'}
  function rec(m){var s=+(m.sec||0)+1,x=dt(m.d);return m.d.slice(11,16)+':'+P2(s)+' · 변조 방지 기록 완료 (입력 1초 뒤)'}
  var CH='<svg class="chev" viewBox="0 0 12 12" aria-hidden="true"><path d="m2 4 4 4 4-4"/></svg>';
  function render(newFirst){
    var ws=q.value.trim().toLowerCase().split(/\s+/).filter(Boolean);
    var r=M.filter(function(m){var hay=(m.d+' '+m.t+' '+(m.det?m.det.full+' '+m.det.where+' '+m.det.how+' '+m.det.why:'')).toLowerCase(); return ws.every(function(w){return hay.indexOf(w)>-1})});
    if(!r.length){L.innerHTML='<div class="dy-empty">'+(M.length?'일치하는 메모가 없습니다':'아직 메모가 없습니다. 떠오른 생각을 위 입력창에 바로 적어 두세요.')+'</div>';return;}
    L.innerHTML=r.map(function(m,i){ var tags=(m.t.match(/#[^\s#]+/g)||[]); var body=m.t.replace(/\s*#[^\s#]+/g,'').trim();
      var attH=(m.att&&m.att.length)?'<span class="tg">첨부 '+m.att.map(esc).join(', ')+'</span>':'';var inner='<time title="'+m.d+'">'+brief(m.d)+'</time><div><p>'+hl(body,ws)+'</p>'+tags.map(function(t){return '<span class="tg">'+hl(t,ws)+'</span>'}).join('')+attH+'</div><span class="hs">'+(m.det?CH:'<i class="chev-sp"></i>')+'</span>';
      var cls='dy-item'+(newFirst&&i===0?' new':'');
      if(!m.det) return '<div class="dyw"><div class="'+cls+' plain">'+inner+'</div></div>';
      var d=m.det;
      return '<div class="dyw"><button type="button" class="'+cls+'" aria-expanded="false" aria-controls="dyp-'+m.id+'">'+inner+'</button>'+
       '<div class="rp" id="dyp-'+m.id+'" role="region" aria-label="메모 상세"><div class="rp-in"><div class="rp-body"><div><h3>전체 내용</h3><p class="full">'+hl(d.full,ws)+'</p></div>'+
       '<div><h3>6하원칙</h3><dl class="w6"><div><dt>누가</dt><dd>나</dd></div><div><dt>입력</dt><dd class="num">'+full(m)+'</dd></div><div><dt>기록</dt><dd class="num">'+rec(m)+'</dd></div><div><dt>어디서</dt><dd>'+esc(d.where)+'</dd></div><div><dt>무엇을</dt><dd>'+esc(body)+'</dd></div><div><dt>어떻게</dt><dd>'+esc(d.how)+'</dd></div><div><dt>왜</dt><dd>'+esc(d.why)+'</dd></div></dl>'+(d.rel?'<div class="verify"><span class="pill">연결된 기록</span><span class="cap">'+esc(d.rel)+'</span></div>':'')+'</div></div></div></div></div>';
    }).join('');
  }
  function tagbar(){ if(!TG) return; var all={}; M.forEach(function(m){(m.t.match(/#[^\s#]+/g)||[]).forEach(function(t){all[t]=(all[t]||0)+1})});
    TG.innerHTML=Object.keys(all).map(function(t){return '<button class="chip" type="button" data-q="'+t+'">'+t+' <span class="cap">'+all[t]+'</span></button>'}).join(''); }
  
  L.addEventListener('click',function(e){var b=e.target.closest('button.dy-item'); if(!b) return; var open=b.getAttribute('aria-expanded')==='true';
    [].forEach.call(L.querySelectorAll('button.dy-item'),function(o){o.setAttribute('aria-expanded','false');document.getElementById(o.getAttribute('aria-controls')).classList.remove('open')});
    if(!open){b.setAttribute('aria-expanded','true');document.getElementById(b.getAttribute('aria-controls')).classList.add('open')}});
  q.addEventListener('input',function(){render()});
  chips.forEach(function(c){c.addEventListener('click',function(){var on=c.getAttribute('aria-pressed')!=='true'; c.setAttribute('aria-pressed',on);})});
  F.addEventListener('submit',function(e){e.preventDefault(); var v=T.value.trim(); if(!v&&!(F._att&&F._att.length)) return; if(!v) v='(첨부)';
    chips.forEach(function(c){ if(c.getAttribute('aria-pressed')==='true'&&v.indexOf(c.dataset.t)<0) v+=' '+c.dataset.t; c.setAttribute('aria-pressed','false'); });
    var d=new Date(),p=function(n){return String(n).padStart(2,'0')};
    M.unshift({att:(F._att||[]).slice(),id:++id,d:d.getFullYear()+'-'+p(d.getMonth()+1)+'-'+p(d.getDate())+' '+p(d.getHours())+':'+p(d.getMinutes()),t:v});
    saveM(); T.value=''; q.value=''; F._att=[];F._sync&&F._sync(); tagbar(); render(true); });
  
  window.PDV=window.PDV||{};
  window.PDV.memo={all:function(){return M},search:function(ws){return M.filter(function(m){var h=(m.d+' '+m.t).toLowerCase();return ws.some(function(w){return h.indexOf(w)>-1})})},
    add:function(text){T.value=text;F.requestSubmit()},show:function(k){q.value=k||'';render()}};
  tagbar(); render();
})();

// 트랜잭션: 목록 + 검색 + 구분 필터 + 행 아래 6하원칙 패널(slide out/in, 한 번에 하나)
(function(){
  var X=[];
  var Q=document.getElementById('tx-q'),L=document.getElementById('tx-list'),F=document.getElementById('tx-f'),K=document.getElementById('tx-kp'),flt='';
  var won=function(n){return (n<0?'−':'+')+Math.abs(n).toLocaleString('ko-KR')};
  var W=function(n){return n.toLocaleString('ko-KR')};
  function esc(x){return String(x).replace(/[&<>]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;'}[c]})}
  function hl(x,ws){x=esc(x);ws.forEach(function(w){if(!w)return;var r=new RegExp('('+w.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+')','gi');x=x.replace(r,'<mark>$1</mark>')});return x}
  function render(){
    var ws=Q.value.trim().toLowerCase().split(/\s+/).filter(Boolean);
    var r=X.filter(function(t){if(flt&&t.k!==flt)return false;var hay=[t.d,t.k,t.who,t.ac,t.what,t.where,t.how,t.why].join(' ').toLowerCase();return ws.every(function(w){return hay.indexOf(w)>-1})});
    var inn=0,out=0;r.forEach(function(t){t.amt>0?inn+=t.amt:out+=t.amt});
    K.innerHTML=[['수입 합계','+'+W(inn)+'원'],['지출 합계','−'+W(-out)+'원'],['순현금 증감',(inn+out<0?'−':'+')+W(Math.abs(inn+out))+'원'],['거래 건수',r.length+'건']].map(function(a){return '<div class="kp"><div class="l">'+a[0]+'</div><div class="v num">'+a[1]+'</div></div>'}).join('');
    if(!r.length){L.innerHTML='<div class="dy-empty">일치하는 거래가 없습니다</div>';return}
    L.innerHTML=r.map(function(t){return '<div class="txd"><button class="txrow" type="button" aria-expanded="false" aria-controls="txp-'+t.id+'"><span class="num">'+hl(t.d.slice(5,10)+' '+t.d.slice(11),ws)+'</span><span>'+hl(t.who.split(' → ')[t.amt>0?0:1],ws)+'<span class="sub">'+t.k+'</span></span><span>'+hl(t.what,ws)+'<span class="sub">'+hl(t.how,ws)+'</span></span><span>'+hl(t.ac,ws)+'</span><span class="amt num '+(t.amt>0?'in':'')+'">'+won(t.amt)+'</span><svg class="chev" viewBox="0 0 12 12" aria-hidden="true"><path d="m2 4 4 4 4-4"/></svg></button>'+
     '<div class="rp" id="txp-'+t.id+'" role="region" aria-label="'+esc(t.what)+' — 6하원칙"><div class="rp-in"><div class="rp-body"><div><h3>6하원칙</h3><dl class="w6"><div><dt>누가</dt><dd>'+esc(t.who)+'</dd></div><div><dt>언제</dt><dd class="num">'+t.d+' KST</dd></div><div><dt>어디서</dt><dd>'+esc(t.where)+'</dd></div><div><dt>무엇을</dt><dd>'+esc(t.what)+' · '+won(t.amt)+'원</dd></div><div><dt>어떻게</dt><dd>'+esc(t.how)+'</dd></div><div><dt>왜</dt><dd>'+esc(t.why)+'</dd></div></dl></div>'+
     '<div><h3>기록 정보 · 분개</h3><div class="proof"><div><span>원본 위치</span><span>이 기기(폰)</span></div></div><table class="jn"><tr><th>구분</th><th>계정</th><th class="n">금액</th></tr><tr><td>차변</td><td>'+t.dr[0]+'</td><td class="n num">'+W(t.dr[1])+'</td></tr><tr><td>대변</td><td>'+t.cr[0]+'</td><td class="n num">'+W(t.cr[1])+'</td></tr></table><div class="verify"><button class="btn pri" type="button">원본과 대조</button><span class="cap">분개는 재무제표 계정에 자동 반영됩니다</span></div></div></div></div></div></div>'}).join('');
  }
  Q.addEventListener('input',render);
  window.PDV=window.PDV||{};
  window.PDV.tx={search:function(ws){return X.filter(function(t){var h=[t.d,t.k,t.who,t.ac,t.what,t.how,t.why].join(' ').toLowerCase();return ws.some(function(w){return h.indexOf(w)>-1})})},
    show:function(k){Q.value=k||'';render()},all:function(){return X}};
  F.addEventListener('click',function(e){var b=e.target.closest('[data-f]');if(!b)return;flt=b.dataset.f;[].forEach.call(F.children,function(c){c.setAttribute('aria-pressed',c===b)});render()});
  L.addEventListener('click',function(e){var b=e.target.closest('.txrow');if(!b)return;var open=b.getAttribute('aria-expanded')==='true';
    [].forEach.call(L.querySelectorAll('.txrow'),function(o){o.setAttribute('aria-expanded','false');document.getElementById(o.getAttribute('aria-controls')).classList.remove('open')});
    if(!open){b.setAttribute('aria-expanded','true');document.getElementById(b.getAttribute('aria-controls')).classList.add('open')}});
  render();
})();

// 썸네일 그래프: 눌러서 펼치기(한 번에 하나, 다시 누르면 접힘)
(function(){
  var th=[].slice.call(document.querySelectorAll('.thumb'));
  th.forEach(function(t){t.addEventListener('click',function(){var open=t.getAttribute('aria-expanded')==='true';
    th.forEach(function(o){o.setAttribute('aria-expanded','false');document.getElementById(o.getAttribute('aria-controls')).classList.remove('open')});
    if(!open){t.setAttribute('aria-expanded','true');document.getElementById(t.getAttribute('aria-controls')).classList.add('open')}})});
})();

// 물결 효과(ripple) — 버튼·칩·탭·메뉴·행 공통
(function(){
  document.addEventListener('pointerdown',function(e){
    var t=e.target.closest('.btn,.chip,.tab,.seg button,.ib,.nv,.sm button,.thumb,.row,.txrow'); if(!t) return;
    var r=t.getBoundingClientRect(),d=Math.max(r.width,r.height)*2,x=document.createElement('span');
    x.className='rip';x.style.cssText='width:'+d+'px;height:'+d+'px;left:'+(e.clientX-r.left-d/2)+'px;top:'+(e.clientY-r.top-d/2)+'px';
    t.appendChild(x);setTimeout(function(){x.remove()},520);
  });
})();

// 개인/조직 전환: 재무제표 양식이 바뀐다
(function(){
  var seg=document.querySelector('.seg'),bs=[].slice.call(seg.querySelectorAll('button'));
  function set(m){document.getElementById('pdv-root').setAttribute('data-mode',m);bs.forEach(function(b){b.setAttribute('aria-pressed',b.dataset.m===m)})}
  bs[0].dataset.m='person';bs[1].dataset.m='org';
  bs.forEach(function(b){b.addEventListener('click',function(){set(b.dataset.m)})});
  set('person');
})();

// 보고서: 일일·주간·월간·분기·반기·연간 — 기간 활동을 자동으로 요약 (시안: 가상 데이터)
(function(){
  var T=new Date(),WK=['일','월','화','수','목','금','토'],P2=function(n){return String(n).padStart(2,'0')};
  function ymd(d){return d.getFullYear()+'.'+P2(d.getMonth()+1)+'.'+P2(d.getDate())}
  function addD(d,n){var x=new Date(d);x.setDate(x.getDate()+n);return x}
  var wm=addD(T,-((T.getDay()+6)%7)),q=Math.floor(T.getMonth()/3),hf=T.getMonth()<6?0:1;
  var R={day:{n:'일일',rng:ymd(T)+' ('+WK[T.getDay()]+')',when:'매일 06:00',next:'내일 06:00'},
   week:{n:'주간',rng:ymd(wm)+' ~ '+ymd(addD(wm,6)),when:'매주 월요일 06:00',next:'다음 월요일 06:00'},
   month:{n:'월간',rng:T.getFullYear()+'년 '+(T.getMonth()+1)+'월',when:'매월 1일 06:00',next:'다음 달 1일 06:00'},
   qtr:{n:'분기',rng:T.getFullYear()+'년 '+(q+1)+'분기 ('+(q*3+1)+'~'+(q*3+3)+'월)',when:'분기 첫날 06:00',next:'다음 분기 첫날 06:00'},
   half:{n:'반기',rng:T.getFullYear()+'년 '+(hf?'하반기 (7~12월)':'상반기 (1~6월)'),when:'1월 1일 · 7월 1일 06:00',next:'다음 반기 첫날 06:00'},
   year:{n:'연간',rng:T.getFullYear()+'년',when:'1월 1일 06:00',next:'내년 1월 1일 06:00'}};
  Object.keys(R).forEach(function(k){var r=R[k];r.last='아직 없음';r.rec=0;r.anc=0;r.tx=0;r.memo=0;r.inn=0;r.out=0;r.pv={rec:0,inn:0,out:0};r.mix=[0,0,0,0];r.sum=[];r.act=[]});
  var ORDER=['day','week','month','qtr','half','year'];
  var IC={day:'<circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2"/>',week:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 10h18M8 14h2M12 14h2M16 14h2"/>',month:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 10h18"/>',qtr:'<path d="M12 12V4a8 8 0 1 1-8 8z"/>',half:'<path d="M12 4a8 8 0 1 0 0 16z"/>',year:'<circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 2"/>'};
  var W=function(n){return n.toLocaleString('ko-KR')};
  var dd=document.getElementById('rp-dd'),btn=document.getElementById('rp-btn'),menu=document.getElementById('rp-menu'),panel=document.getElementById('p-rep');
  menu.innerHTML=ORDER.map(function(k){var r=R[k];return '<button type="button" class="mi" role="menuitem" data-k="'+k+'"><svg class="ic" viewBox="0 0 24 24" aria-hidden="true">'+IC[k]+'</svg><span><b>'+r.n+' 보고서</b><small>'+r.rng+'</small></span></button>'}).join('')+'<div class="dv"></div><button type="button" class="mi" role="menuitem" data-k="auto"><svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1"/></svg><span><b>자동 작성 설정</b><small>종류별 켜기·끄기</small></span></button>';
  function open(o){menu.hidden=!o;btn.setAttribute('aria-expanded',o);if(o)menu.querySelector('.mi').focus()}
  btn.addEventListener('click',function(e){e.stopPropagation();open(menu.hidden)});
  document.addEventListener('click',function(e){if(!dd.contains(e.target))open(false)});
  dd.addEventListener('keydown',function(e){var it=[].slice.call(menu.querySelectorAll('.mi')),i=it.indexOf(document.activeElement);
    if(e.key==='Escape'){open(false);btn.focus()}else if(e.key==='ArrowDown'&&!menu.hidden){it[(i+1)%it.length].focus();e.preventDefault()}else if(e.key==='ArrowUp'&&!menu.hidden){it[(i-1+it.length)%it.length].focus();e.preventDefault()}});
  var cur='week',on={day:1,week:1,month:1,qtr:1,half:1,year:1};
  function delta(v,unit){return v===0?'':(v>0?'▲ ':'▼ ')+W(Math.abs(v))+unit}
  function render(k){
    var r=R[k];cur=k;
    document.getElementById('rp-kind').textContent=r.n+' 보고서';document.getElementById('rp-title').textContent=r.rng;
    document.getElementById('rp-auto').textContent='자동 작성 · '+r.when+' · 마지막 '+r.last;
    document.getElementById('rp-sw').innerHTML=ORDER.map(function(x){return '<button class="chip" type="button" data-k="'+x+'" aria-pressed="'+(x===k)+'">'+R[x].n+'</button>'}).join('');
    var net=r.inn-r.out,sr=r.inn?(net/r.inn*100).toFixed(1)+'%':'–';
    var kp=function(l,v,d,ok){return '<div class="kp"><div class="l">'+l+'</div><div class="v num">'+v+'</div>'+(d?'<span class="chipst '+(ok?'ok':'wait')+'">'+d+'</span>':'')+'</div>'};
    document.getElementById('rp-kp').innerHTML=kp('기록',W(r.rec)+'건',delta(r.pv.rec,'건'),r.pv.rec>0)+kp('거래',r.tx+'건',r.memo?'메모 '+r.memo+'건':'',true)+kp('수입','+'+W(r.inn)+'원','지출 −'+W(r.out)+'원',false)+kp('순저축',(net<0?'−':'+')+W(Math.abs(net))+'원','저축률 '+sr,net>=0);
    document.getElementById('rp-sum').innerHTML=r.sum.map(function(t){return '<li>'+t+'</li>'}).join('');
    var nm=['공용 AI 전문가','사람','사물','기관'];
    document.getElementById('rp-mix').innerHTML=r.mix.map(function(v,i){var p=Math.round(v/r.rec*100);return '<div class="mixrow"><span>'+nm[i]+'</span><i style="--w:'+p+'%"></i><span class="num">'+W(v)+'건 · '+p+'%</span></div>'}).join('')+'<p class="cap" style="margin:8px 0 0">기록 '+W(r.anc)+'건 모두 변조 방지 기록 완료 · 변조 감지 0건</p>';
    document.getElementById('rp-act').innerHTML=r.act.map(function(a){return '<div class="actrow"><time>'+a[0]+'</time><div>'+a[1]+'<small>'+a[2]+'</small></div></div>'}).join('');
    document.getElementById('rp-fin').innerHTML='<div class="finrow"><span>수입</span><b class="num">+'+W(r.inn)+'원'+(r.pv.inn?'<span class="d">'+delta(r.pv.inn,'원')+'</span>':'')+'</b></div><div class="finrow"><span>지출</span><b class="num">−'+W(r.out)+'원'+(r.pv.out?'<span class="d">'+delta(r.pv.out,'원')+'</span>':'')+'</b></div><div class="finrow"><span>순저축</span><b class="num">'+(net<0?'−':'+')+W(Math.abs(net))+'원</b></div><p class="cap" style="margin:8px 0 0">자세한 내역은 트랜잭션·재무제표 탭에서 볼 수 있습니다.</p>';
    if(!r.rec){var E='<p class="cap">이 기간에 기록된 활동이 없습니다.</p>';document.getElementById('rp-sum').innerHTML='<li>이 기간에 기록된 활동이 없습니다.</li>';document.getElementById('rp-mix').innerHTML=E;document.getElementById('rp-act').innerHTML=E}
  }
  function sched(){document.getElementById('rp-sch').innerHTML=ORDER.map(function(k){var r=R[k];return '<div class="schr"><span class="k">'+r.n+'</span><span>'+r.when+'<small>작성 시각</small></span><span>'+r.last+'<small>마지막 작성</small></span><span>'+(on[k]?r.next:'꺼짐')+'<small>다음 작성</small></span><button type="button" class="sw" role="switch" aria-checked="'+(!!on[k])+'" aria-label="'+r.n+' 보고서 자동 작성" data-k="'+k+'"></button></div>'}).join('')}
  function showRep(k){
    document.querySelectorAll('[role=tabpanel]').forEach(function(p){p.hidden=true});
    document.querySelectorAll('.tab').forEach(function(t){t.setAttribute('aria-selected','false');t.tabIndex=-1});
    document.querySelectorAll('#sm [data-go]').forEach(function(b){b.setAttribute('aria-current','false')});
    panel.hidden=false;panel.classList.remove('panel-in');void panel.offsetWidth;panel.classList.add('panel-in');
    if(k!=='auto')render(k);sched();
    if(k==='auto')document.getElementById('rp-sch').scrollIntoView({behavior:'smooth',block:'center'});else window.scrollTo({top:0,behavior:'smooth'});
  }
  menu.addEventListener('click',function(e){var b=e.target.closest('.mi');if(!b)return;open(false);showRep(b.dataset.k)});
  window.PDV=window.PDV||{};window.PDV.openReport=function(k){showRep(k)};
  window.PDV.openTab=function(id){document.getElementById(id).click()};
  panel.addEventListener('click',function(e){var c=e.target.closest('#rp-sw [data-k]');if(c){render(c.dataset.k);return}
    var w=e.target.closest('.sw');if(w){on[w.dataset.k]=!on[w.dataset.k];sched()}});
  // 탭을 누르면 보고서 화면은 닫힌다
  document.querySelectorAll('.tab').forEach(function(t){t.addEventListener('click',function(){panel.hidden=true})});
  render('week');sched();
})();

// 나만의 AI 비서(나비): PDV 갱신·관리 담당. 시안에서는 가상 응답으로 지시·검색 흐름을 보여준다.
(function(){
  var bot=document.getElementById('bot'),box=document.getElementById('bot-msgs'),st=document.getElementById('bot-st'),
      sg=document.getElementById('bot-sg'),form=document.getElementById('bot-form'),inp=document.getElementById('bot-in'),ready=false,greeted=false;
  // 페이지가 열리면 비서를 미리 불러온다(로딩 표시 → 준비됨)
  setTimeout(function(){ready=true;st.textContent='나만의 AI 비서 · PDV 관리 중'},1400);
  function add(cls,html){var d=document.createElement('div');d.className='msg '+cls;d.innerHTML=html;box.appendChild(d);box.scrollTop=box.scrollHeight;return d}
  function esc(x){return String(x).replace(/[&<>]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;'}[c]})}
  function say(html,acts,delay){var t=add('bot','<span class="typing"><i></i><i></i><i></i></span>');
    setTimeout(function(){t.innerHTML=html+(acts?'<div class="acts">'+acts.map(function(a,i){return '<button type="button" class="chip" data-a="'+i+'">'+a[0]+'</button>'}).join('')+'</div>':'');
      if(acts)t._acts=acts;box.scrollTop=box.scrollHeight},delay||600);return t}
  box.addEventListener('click',function(e){var b=e.target.closest('[data-a]');if(!b)return;var m=b.closest('.msg');m._acts[b.dataset.a][1]()});
  function suggestions(){var S=['이번 주 보고서 만들어 줘','등기 관련 기록 찾아줘','이번 달 지출 얼마야?','메모: 내일 등기소 방문','오늘 PDV에서 뭘 정리했어?'];
    sg.innerHTML=S.map(function(t){return '<button type="button" class="chip">'+t+'</button>'}).join('')}
  sg.addEventListener('click',function(e){var b=e.target.closest('.chip');if(b)send(b.textContent)});
  function open(o){bot.hidden=!o;if(!o)return;place();
    if(!greeted){greeted=true;suggestions();
      var l=add('bot','<span class="typing"><i></i><i></i><i></i></span>');
      setTimeout(function(){l.remove();
        say('안녕하세요. 저는 나만의 AI 비서 나비입니다. 내 데이터 금고의 기록·메모·보고서를 갱신하고 관리합니다. 기록 검색, 메모 남기기, 보고서 만들기를 말로 시키세요.',null,500)},ready?500:1100)}
    setTimeout(function(){inp.focus()},50)}
  // 우측 하단 대화창 아이콘은 나비웹(부모 페이지)의 것을 쓴다. 눌리면 부모가 이 비서를 열고 닫으라고 알려 준다.
  var VP={top:0,height:window.innerHeight};
  function place(){ if(!document.documentElement.classList.contains('embed')||bot.hidden)return;
    var h=bot.offsetHeight||640;bot.style.top=Math.max(VP.top+8,VP.top+VP.height-h-88)+'px'}
  window.addEventListener('message',function(e){ if(e.source!==parent||!e.data||typeof e.data!=='object')return;
    if(e.data.type==='pdv:bot-toggle')open(bot.hidden);
    else if(e.data.type==='pdv:viewport'){VP={top:+e.data.top||0,height:+e.data.height||window.innerHeight};place()} });
  window.PDV=window.PDV||{};window.PDV.bot={open:open,toggle:function(){open(bot.hidden)}};
  document.getElementById('bot-x').addEventListener('click',function(){open(false)});
  document.addEventListener('keydown',function(e){if(e.key==='Escape'&&!bot.hidden)open(false)});
  // 사이드바 "나만의 비서(나비)"도 같은 대화창을 연다
  [].forEach.call([],function(b){if(b.textContent.indexOf('나만의 비서')>-1)b.addEventListener('click',function(){open(true)})});
  var STOP=/(검색|검색해|찾아줘|찾아|찾아봐|보여줘|보여|알려줘|알려|해줘|해 줘|줘|관련|기록|에서|에 대해|대해|좀|전부|모두|내|나의|이번|지난|얼마야|얼마|뭐야|\?)/g;
  function kws(t){return t.replace(STOP,' ').split(/\s+/).map(function(x){return x.replace(/[을를은는이가의로]$/,'')}).filter(function(x){return x.length>1})}
  function toTab(id,fn){return function(){PDV.openTab(id);if(fn)fn();window.scrollTo({top:0,behavior:'smooth'})}}
  function send(text){text=text.trim();if(!text)return;add('me',esc(text));inp.value='';
    var t=text.replace(/\s+/g,' ');
    var per={'일일':'day','오늘':'day','주간':'week','이번 주':'week','월간':'month','이번 달 보고':'month','분기':'qtr','반기':'half','연간':'year'};
    if(/보고서/.test(t)){var k='week',nm='주간';Object.keys(per).forEach(function(x){if(t.indexOf(x)>-1){k=per[x];nm=x}});if(/이번 주|주간/.test(t)){k='week';nm='주간'}
      var tm=say('좋아요. '+nm.replace('오늘','일일').replace('이번 주','주간')+' 보고서를 열었습니다. 해당 기간의 기록과 거래를 모아 요약했어요. 매번 자동으로 작성되고 있으니 설정은 "자동 작성"에서 바꿀 수 있습니다.',null,700);setTimeout(function(){PDV.openReport(k)},900);return}
    if(/^(메모|일기)\s*[:：]?/.test(t)||/(메모해|적어 ?줘|기록해 ?줘)/.test(t)){var body=t.replace(/^(메모|일기)\s*[:：]?\s*/,'').replace(/(메모해|적어 ?줘|기록해 ?줘).*/,'').trim()||t;
      PDV.memo.add(body);say('메모를 저장했고 변조 방지 기록도 남겼습니다.\n“'+esc(body)+'”',[['메모 보기',toTab('t-vault',function(){PDV.memo.show('')})]],600);return}
    if(/(손익|대차|현금흐름|재무)/.test(t)){var map=[['손익','t-is','손익계산서'],['대차','t-bs','대차대조표'],['현금흐름','t-cf','현금흐름표'],['재무분석','t-fa','재무분석 보고서']],hit=map.filter(function(m){return t.indexOf(m[0])>-1})[0]||map[3];
      say(hit[2]+'를 열어 드릴게요.',null,500);setTimeout(toTab(hit[1]),700);return}
    if(/(뭘 정리|뭐 했|무슨 일|오늘 PDV|정리했)/.test(t)){var td=new Date().toDateString(),n=(PDV.records?PDV.records():[]).filter(function(r){return new Date(r.ts||r.when).toDateString()===td}).length;
      say(n?'오늘 기록된 활동은 '+n+'건입니다.':'오늘은 아직 기록된 활동이 없습니다.',[['일일 보고서 보기',function(){PDV.openReport('day')}]],600);return}
    var ws=kws(t),isMoney=/(지출|수입|얼마|거래|결제|입금|돈)/.test(t);
    var ws2=ws.filter(function(x){return !/^(지출|수입|거래|결제|입금|돈|달|월|이번달)$/.test(x)});
    if(isMoney&&!ws2.length){var all=PDV.tx.all(),inn=0,out=0;all.forEach(function(x){x.amt>0?inn+=x.amt:out+=x.amt});
      say('이번 달 거래 '+all.length+'건입니다.\n수입 +'+inn.toLocaleString('ko-KR')+'원 · 지출 −'+(-out).toLocaleString('ko-KR')+'원 · 순 '+(inn+out>=0?'+':'−')+Math.abs(inn+out).toLocaleString('ko-KR')+'원',[['트랜잭션 보기',toTab('t-tx',function(){PDV.tx.show('')})]],700);return}
    if(ws.length){var mm=PDV.memo.search(ws),tt=PDV.tx.search(ws),h='',rr=(PDV.records?PDV.records():[]).filter(function(r){var w=r.summary_6w_view||{},hay=[r.service,r.category_label,r.summary,w.who,w.where,w.what,w.how,w.why].join(' ').toLowerCase();return ws.some(function(x){return hay.indexOf(x)>-1})});
      rr.slice(0,3).forEach(function(r){var w=r.summary_6w_view||{};h+='<span class="hit">'+esc(w.what||r.summary||r.service||'기록')+'<small>기록 · '+esc(String(r.ts||'').slice(0,10))+'</small></span>'});
      mm.slice(0,3).forEach(function(m){h+='<span class="hit">'+esc(m.t.replace(/\s*#\S+/g,''))+'<small>메모 · '+m.d.slice(0,10)+'</small></span>'});
      tt.slice(0,3).forEach(function(x){h+='<span class="hit">'+esc(x.what)+' · '+(x.amt>0?'+':'−')+Math.abs(x.amt).toLocaleString('ko-KR')+'원<small>거래 · '+x.d.slice(0,10)+' · '+esc(x.who)+'</small></span>'});
      var acts=[];if(mm.length)acts.push(['메모에서 보기',toTab('t-vault',function(){PDV.memo.show(ws[0])})]);if(tt.length)acts.push(['트랜잭션에서 보기',toTab('t-tx',function(){PDV.tx.show(ws[0])})]);if(rr.length)acts.push(['기록 목록에서 보기',toTab('t-vault')]);
      say(mm.length+tt.length+rr.length?'“'+esc(ws.join(' '))+'” 관련해서 기록 '+rr.length+'건, 메모 '+mm.length+'건, 거래 '+tt.length+'건을 찾았어요.'+h:'“'+esc(ws.join(' '))+'”와 일치하는 기록을 찾지 못했어요. 다른 단어로 다시 말씀해 주세요.',acts.length?acts:null,800);return}
    say('이런 일을 도와드릴 수 있어요.\n· “등기 관련 기록 찾아줘” 검색\n· “메모: 내일 등기소 방문” 메모 남기기\n· “월간 보고서 만들어 줘” 보고서 열기\n· “이번 달 지출 얼마야?” 돈의 흐름 확인',null,500)}
  form.addEventListener('submit',function(e){e.preventDefault();var a=(form._att||[]).slice();form._att=[];form._sync&&form._sync();if(a.length)add('me','첨부: '+esc(a.join(', ')));if(inp.value.trim())send(inp.value);else if(a.length)say('첨부하신 파일 '+a.length+'건을 받았어요. 어떻게 정리할까요? “이 파일을 소장 사건에 연결해 줘”처럼 말씀해 주세요.',null,600)});
})();

// 입력줄 공통: 파일 첨부 · 카메라 · 음성 입력 · 보내기 활성화 · Enter 전송
(function(){
  [].forEach.call(document.querySelectorAll('form:has(.ibar)'),function(F){
    var bar=F.querySelector('.ibar'),att=F.querySelector('.ibar-att'),ctl=bar.querySelector('textarea,input[type=text]'),send=bar.querySelector('.ib-send'),
        file=bar.querySelector('.ib-file'),cam=bar.querySelector('.ib-cam'),micb=bar.querySelector('[data-k=mic]'),rec=null;
    F._att=[];
    function sync(){send.disabled=!(ctl.value.trim()||F._att.length);
      att.hidden=!F._att.length;att.innerHTML=F._att.map(function(n,i){return '<span class="att-chip">'+n.replace(/[&<>]/g,'')+'<button type="button" data-i="'+i+'" aria-label="첨부 제거">×</button></span>'}).join('')}
    F._sync=sync;
    function grow(){if(ctl.tagName==='TEXTAREA'){ctl.style.height='auto';ctl.style.height=Math.min(ctl.scrollHeight,200)+'px'}}
    ctl.addEventListener('input',function(){grow();sync()});
    ctl.addEventListener('keydown',function(e){if(e.key==='Enter'&&!e.shiftKey&&!e.isComposing){e.preventDefault();if(!send.disabled)F.requestSubmit()}});
    F.addEventListener('submit',function(){setTimeout(function(){grow();sync()},0)},true);
    bar.querySelector('[data-k=clip]').addEventListener('click',function(){file.click()});
    bar.querySelector('[data-k=cam]').addEventListener('click',function(){cam.click()});
    [file,cam].forEach(function(inp){inp.addEventListener('change',function(){[].forEach.call(inp.files,function(f){F._att.push(f.name)});inp.value='';sync()})});
    att.addEventListener('click',function(e){var b=e.target.closest('[data-i]');if(!b)return;F._att.splice(+b.dataset.i,1);sync()});
    micb.addEventListener('click',function(){
      var SR=window.SpeechRecognition||window.webkitSpeechRecognition;
      if(rec){rec.stop();return}
      if(!SR){micb.classList.toggle('rec');return}
      rec=new SR();rec.lang='ko-KR';rec.interimResults=false;micb.classList.add('rec');
      rec.onresult=function(e){ctl.value=(ctl.value+' '+e.results[0][0].transcript).trim();grow();sync()};
      rec.onend=function(){rec=null;micb.classList.remove('rec')};rec.start()});
    sync();
  });
})();
}
  ];
  var mounted = false;
  function base() { return (typeof _HONDI_BASE === 'string') ? _HONDI_BASE : 'https://hondi.net'; }
  function load(src) {
    return new Promise(function (res) {
      if (document.querySelector('script[data-pdv-dep="' + src + '"]')) return res();
      var s = document.createElement('script'); s.src = src; s.async = false; s.setAttribute('data-pdv-dep', src);
      s.onload = function () { res(); }; s.onerror = function () { res(); };   // 못 읽어도 화면은 열고, 기록 칸에 안내를 보인다
      document.head.appendChild(s);
    });
  }
  window._pdvMount = function () {
    if (mounted) return; mounted = true;
    var root = document.getElementById('pdv-root'); if (!root) return;
    root.innerHTML = MARKUP;
    var b = base();
    load(b + '/pdv-store.js').then(function () { return load(b + '/gopang-wallet.js'); }).then(function () {
      PARTS.forEach(function (f) { try { f(); } catch (e) { if (window.console) console.error('[pdv-panel]', e); } });
    });
  };
})();
