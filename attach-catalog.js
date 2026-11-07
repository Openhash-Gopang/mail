/* 첨부서류 카탈로그 — 서류 이름 → "누가 발급하나 / 도우미가 가져올 수 있나"를 AI 없이 정한다.
 *
 * 종류(kind)
 *   agency     공공기관 사이트에서 발급받는 서류. 서류 화면에 "도우미가 가져오기"를 붙이고, 도우미가 그 사이트를 바로 연다.
 *   thirdparty 회사·병원·학교·시험기관 등 개별 기관이 발급하는 서류. 도우미가 가져올 수 없다(사용자가 요청해 받는다).
 *   user       사용자가 직접 만들거나 이미 가진 자료(사본·계획서·도면·사진·위임장 등).
 *   unknown    카탈로그에 없다 → 예전처럼 도우미 AI(SP)가 판단한다.
 * 입력(input): none = 로그인한 본인 명의로 바로 발급 가능 → AI를 거치지 않고 즉시 시작 / ask = 대상(법인 이름·주소·사건번호 등)을 물어야 함.
 *
 * 갱신 방법: docs/attach-catalog.md. 서류 양식에서 아직 분류되지 않은 이름은 `node scripts/catalog-coverage.mjs --forms <폴더>` 로 빈도순으로 뽑고,
 * 기관 사이트 주소는 `node scripts/catalog-check.mjs` 로 점검한다. 규칙은 위에서부터 처음 맞는 것이 이긴다(구체적인 것을 위에).
 */
(function (root) {
  'use strict';
  var VERIFIED = '2026-11-06';   // 초안: 지식 기반으로 작성, 사람이 검토하기 전(reviewed:false). 기관 화면은 바뀔 수 있다.
  var AGENCIES = {
    gov24:   { name: '정부24', url: 'https://www.gov.kr', login: '간편인증·공동인증서 등' },
    iros:    { name: '인터넷등기소', url: 'https://www.iros.go.kr', login: '공동인증서·간편인증', fee: '열람 700원·발급 1,000원' },
    hometax: { name: '홈택스(국세청)', url: 'https://www.hometax.go.kr', login: '공동인증서·간편인증 등' },
    nhis:    { name: '국민건강보험공단', url: 'https://www.nhis.or.kr', login: '간편인증·공동인증서 등' },
    nps:     { name: '국민연금공단', url: 'https://www.nps.or.kr', login: '간편인증·공동인증서 등' },
    insure4: { name: '4대사회보험 정보연계센터', url: 'https://www.4insure.or.kr', login: '공동인증서·간편인증' },
    ecfs:    { name: '대한민국 법원 전자소송', url: 'https://ecfs.scourt.go.kr', login: '공동인증서' },
    patent:  { name: '특허로(특허청)', url: 'https://www.patent.go.kr', login: '공동인증서·특허고객번호' },
    wetax:   { name: '위택스(지방세 포털)', url: 'https://www.wetax.go.kr', login: '간편인증·공동인증서 등' },
    nhuf:    { name: '주택도시기금', url: 'https://nhuf.molit.go.kr', login: '공동인증서·간편인증' },
    police:  { name: '경찰민원포털', url: 'https://minwon.police.go.kr', login: '간편인증·공동인증서 등' },
    efine:   { name: '교통민원24(이파인)', url: 'https://www.efine.go.kr', login: '간편인증·공동인증서 등' },
    nip:     { name: '예방접종도우미', url: 'https://nip.kdca.go.kr', login: '간편인증·공동인증서 등' },
    unipass: { name: '유니패스(관세청)', url: 'https://unipass.customs.go.kr', login: '공동인증서' }
  };
  // [id, 이름에 들어 있는 말(정규식), kind, agency, 발급받을 서류, input, 덧붙임(playbook·early)]
  var R = [
    // ── 기관에서 발급 ──
    ['idcard', '주민등록증|신분증|운전면허|여권|외국인등록증|장애인등록증|국가유공자증', 'user', '', '', '', {}],
    // ── 전수조사 보정(2026-11-07): 기관을 특정해 즉시 연다 ──
    ['acq-tax', '취득세.*(영수|납부|확인)|지방세.*(영수|납부)', 'agency', 'wetax', '취득세 영수필확인서·납부확인서', 'none', {}],
    ['housing-bond', '국민주택채권|주택채권', 'agency', 'nhuf', '국민주택채권 매입 필증', 'ask', {}],
    ['hometax-biz', '사업자등록증|폐업사실|휴업사실|세금계산서|원천징수영수증|지급명세|소득증명원|납세사실', 'agency', 'hometax', '사업자등록증·폐업사실증명·세금계산서·원천징수영수증 등', 'none', {}],
    ['criminal', '범죄경력|수사경력', 'agency', 'police', '범죄·수사경력회보서', 'none', {}],
    ['traffic-acc', '교통사고사실확인', 'agency', 'efine', '교통사고사실확인원', 'ask', {}],
    ['vaccine', '예방접종증명|접종증명', 'agency', 'nip', '예방접종증명서', 'none', {}],
    ['customs', '수출신고필증|수입신고필증|수출입신고|통관', 'agency', 'unipass', '수출입 신고필증', 'ask', {}],
    ['trust-reg', '신탁원부', 'agency', 'iros', '신탁원부(등기소)', 'ask', {}],
    ['entry-record', '출입국(사실|기록)', 'agency', 'gov24', '출입국사실증명서', 'none', {}],
    ['move-in', '전입세대', 'agency', 'gov24', '전입세대 열람내역', 'none', {}],
    ['farmland', '농지원부', 'agency', 'gov24', '농지원부', 'ask', {}],
    ['health-check', '건강검진결과', 'agency', 'nhis', '건강검진 결과통보서', 'none', {}],
    ['patent-cert', '특허증|상표등록증|디자인등록증|실용신안등록증', 'agency', 'patent', '등록증(특허로)', 'ask', {}],
    ['corp-registry', '법인.*등기|법인등기', 'agency', 'iros', '법인 등기사항증명서', 'ask', { playbook: 'iros-corp-ecourt', early: true }],
    ['estate-registry', '(토지|건물|부동산|건축물).*등기|등기.*(토지|건물|부동산)', 'agency', 'iros', '부동산 등기사항증명서', 'ask', {}],
    ['registry-generic', '등기부|등기사항|등기필', 'agency', 'iros', '등기사항증명서', 'ask', {}],
    ['family', '가족관계|혼인관계|기본증명|입양관계|친양자|제적', 'agency', 'gov24', '가족관계등록부 증명서', 'none', {}],
    ['seal', '인감증명', 'agency', 'gov24', '인감증명서', 'none', { review: true }],
    ['building', '건축물대장|건축물현황', 'agency', 'gov24', '건축물대장', 'ask', {}],
    ['land', '토지대장|임야대장|지적도|임야도|지적공부', 'agency', 'gov24', '토지(임야)대장·지적도', 'ask', {}],
    ['landuse', '토지이용계획', 'agency', 'gov24', '토지이용계획확인서', 'ask', {}],
    ['landprice', '공시지가', 'agency', 'gov24', '개별공시지가 확인서', 'ask', {}],
    ['localtax', '지방세|세목별과세', 'agency', 'gov24', '지방세 납세증명서', 'none', {}],
    ['nationaltax', '국세|납세증명|완납증명|소득금액|사업자등록증명|부가가치세|표준재무|소득증명서', 'agency', 'hometax', '국세 증명서(납세·소득금액·사업자등록증명 등)', 'none', {}],
    ['nhis', '건강보험|자격득실|보험료납부', 'agency', 'nhis', '건강보험 자격득실확인서·납부확인서', 'none', {}],
    ['nps', '국민연금', 'agency', 'nps', '국민연금 가입증명서', 'none', {}],
    ['insure4', '고용보험|산재보험|4대보험', 'agency', 'insure4', '고용·산재보험 가입(납부)증명', 'none', {}],
    ['military', '병적증명|병적기록', 'agency', 'gov24', '병적증명서', 'none', {}],
    ['foreigner', '외국인등록사실', 'agency', 'gov24', '외국인등록사실증명', 'none', {}],
    ['vehicle-reg', '자동차등록원부|차량등록원부', 'agency', 'gov24', '자동차등록원부', 'ask', {}],
    ['court-service', '송달증명|확정증명', 'agency', 'ecfs', '송달증명원·확정증명원', 'ask', {}],
    ['patent-reg', '특허등록원부|상표등록원부|디자인등록원부', 'agency', 'patent', '등록원부(특허로)', 'ask', {}],
    ['resident', '주민등록(표|등본|초본)?|등본|초본', 'agency', 'gov24', '주민등록표 등본·초본', 'none', {}],
    // ── 개별 기관(회사·병원·학교·시험기관)이 발급 ──
    ['employer', '재직증명|경력증명|근무확인|복무확인|급여명세|임금명세|원천징수|소득증빙', 'thirdparty', '', '', '', {}],
    ['medical', '진단서|진료|처방전|진료비|치료비|소견서|출생증명', 'thirdparty', '', '', '', {}],
    ['insurer', '보험가입증명|보험증권', 'thirdparty', '', '', '', {}],
    ['school', '졸업증명|성적증명|재학증명|학위증명|교육이수|수료증|이수증|원산지증명', 'thirdparty', '', '', '', {}],
    ['testing', '시험성적|검사성적|수질검사|검사결과|공인시험', 'thirdparty', '', '', '', {}],
    ['appraisal', '감정평가서', 'thirdparty', '', '', '', {}],
    ['finance', '금융거래내역|송금내역|입금내역|거래내역|공과금납부|잔액증명', 'thirdparty', '', '', '', {}],
    ['analysis', '분석서|분석표|측정결과|측정성적|성적서|검토서|영향평가|조사결과|선박검사|선박국적|석면', 'thirdparty', '', '', '', {}],
    // ── 사용자가 직접 만들거나 이미 가진 자료 ──
    ['user-list', '명단|대장|일지|회의록|결의서|규약|선임서|출근부|출퇴근|공정표|구역도|조서|초안|계획안|자기소개서|탄원서|반성문|차용증|합의서|추천서|초청장|송장|번역', 'user', '', '', '', {}],
    ['user-own', '사본|원본|사업계획서|위임장|사진|통장|계획서|도면|배치도|평면도|견적|계약서|영수증|진술서|확인서|동의서|각서|자격증|이력서|증빙|명세|현황표|설명서|사양서|재무제표|재무상태표|정관|신분증|서명|서약|목록|보고서|신청서|소명|기술서|내역서|명부|조직도|의사록|규정|대조표|대비표|도서|공정도|위치도|사유서|재산목록|사업자등록증|진술|통지서|판결문|집행권원|증명사진|규칙|선언서|승낙서|산출|증명하는서류|증명서류|증명자료|입증|경위서|개요서|자료|계산서|일정표|예산서|손익|제원|성분표|안전|기준서|편성표|노선도|등록증|전역증|허가증|면허증|인증서|지정서|현황도|흐름도|증명서', 'user', '', '', '', {}]
  ];
  var RULES = R.map(function (r) {
    var x = r[6] || {};
    return { id: r[0], re: new RegExp(r[1]), kind: r[2], agency: r[3], doc: r[4], input: r[5], playbook: x.playbook || '', early: !!x.early, review: !!x.review };
  });
  function norm(label) { return String(label || '').replace(/\s+/g, ''); }

  /** 서류 이름 → { kind, id, agency, doc, input, playbook, early, instant, goal } (모르면 kind:'unknown') */
  function classify(label) {
    var t = norm(label);
    if (!t) return { kind: 'unknown' };
    for (var i = 0; i < RULES.length; i++) {
      var r = RULES[i];
      if (!r.re.test(t)) continue;
      var ag = r.agency ? AGENCIES[r.agency] : null;
      var out = { kind: r.kind, id: r.id, agency: r.agency, doc: r.doc, input: r.input, playbook: r.playbook, early: r.early, review: r.review };
      if (ag) {
        out.site = ag.name; out.url = ag.url; out.login = ag.login;
        out.instant = r.input === 'none' && !r.playbook;
        out.goal = ag.name + '(' + ag.url + ')에서 “' + String(label).trim().slice(0, 60) + '”(' + r.doc + ')을(를) 발급받아 나비웹으로 보내 주세요. 사이트를 먼저 열고 로그인 안내를 하세요. 서류: ';
      }
      return out;
    }
    return { kind: 'unknown' };
  }
  /** 서류 화면이 "도우미가 가져오기" 버튼을 붙일 항목의 정규식 문자열 — 기관 발급 + (모르는 것) 에서 개별 기관·사용자 자료는 뺀다. */
  function patterns() {
    var ag = [], other = [];
    RULES.forEach(function (r) { (r.kind === 'agency' ? ag : other).push(r.re.source); });
    /* 서류 화면(navi-pro)은 식 20개·식당 200자까지만 받는다. 기관 규칙은 200자 이하 묶음으로 합쳐 개수를 줄인다(규칙이 늘어도 뒤쪽 항목의 버튼이 사라지지 않게). */
    var chunks = [], cur = '';
    ag.forEach(function (src) {
      if (cur && (cur + '|' + src).length > 190) { chunks.push(cur); cur = src; } else cur = cur ? cur + '|' + src : src;
    });
    if (cur) chunks.push(cur);
    return chunks.concat(['^(?!.*(?:' + other.join('|') + ')).+']);
  }
  function stats() { var k = {}; RULES.forEach(function (r) { k[r.kind] = (k[r.kind] || 0) + 1; }); return { rules: RULES.length, byKind: k, verified: VERIFIED, reviewed: false }; }

  var api = { classify: classify, patterns: patterns, stats: stats, AGENCIES: AGENCIES, RULES: RULES, VERIFIED: VERIFIED };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.AttachCatalog = api;
})(typeof window !== 'undefined' ? window : this);
