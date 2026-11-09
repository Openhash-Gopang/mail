/* 첨부서류 카탈로그 — 서류 이름 → "누가 발급하나 / 도우미가 가져올 수 있나"를 AI 없이 정한다.
 *
 * 종류(kind)
 *   agency     공공기관 사이트에서 발급받는 서류. 서류 화면에 "도우미가 가져오기"를 붙이고, 도우미가 그 사이트를 바로 연다.
 *   thirdparty 회사·병원·학교·시험기관 등 개별 기관이 발급하는 서류. 도우미가 가져올 수 없다(사용자가 요청해 받는다).
 *   user       사용자가 직접 만들거나 이미 가진 자료(사본·계획서·도면·사진·위임장 등).
 *   unknown    카탈로그에 없다 → 예전처럼 도우미 AI(SP)가 판단한다.
 * 입력(input): none = 로그인한 본인 명의로 바로 발급 가능 → AI를 거치지 않고 즉시 시작 / ask = 대상(법인 이름·주소·사건번호 등)을 물어야 함.
 *
 * v4(2026-11-08): 조사 결과 반영 — 홈택스 서류를 서류별 규칙으로 분리(사업자등록증·폐업사실·원천징수영수증·세금계산서), 제적등본은 전자가족관계등록시스템, 법인 인감증명서는 등기소,
 *   타인 회사의 사업자등록증(제조사·임대사업자 등)은 기관 서류가 아님, 결제가 드는 서류(paid)·대체 경로(fallback)·실행 중 사유(REASONS) 표시.
 * v3(2026-11-08): 사본·원본·접두어(신청인·대표자·기존 등)를 떼고 분류하며 형태(form: 사본/원본/정본)를 따로 돌려준다.
 *   사유 코드(reason): AGENCY / THIRD_PARTY / USER_OWNED / USER_HELD(가진 서류의 사본) / GENERIC(통칭 이름 — 서식 문맥 필요) / UNKNOWN.
 *   unverified:true 규칙은 이름만 보고 정한 후보다(발급 방법·수수료는 조사 후 확정). 기관 서류는 upload:true(이미 가진 경우 올리기 허용).
 *
 * 갱신 방법: docs/attach-catalog.md. 서류 양식에서 아직 분류되지 않은 이름은 `node scripts/catalog-coverage.mjs --forms <폴더>` 로 빈도순으로 뽑고,
 * 기관 사이트 주소는 `node scripts/catalog-check.mjs` 로 점검한다. 규칙은 위에서부터 처음 맞는 것이 이긴다(구체적인 것을 위에).
 */
(function (root) {
  'use strict';
  var VERIFIED = '2026-11-06', REVISED = '2026-11-08';   // 초안: 지식 기반으로 작성, 사람이 검토하기 전(reviewed:false). 기관 화면은 바뀔 수 있다.
  var AGENCIES = {
    gov24:   { name: '정부24', url: 'https://www.gov.kr', login: '간편인증·공동인증서 등' },
    iros:    { name: '인터넷등기소', url: 'https://www.iros.go.kr', login: '공동인증서·간편인증', fee: '열람 700원·발급 1,000원', reviewAfter: '2026-11-23' },   // 수수료 인상 예고(열람 1,100원·발급 1,400원, 시행 예정일)
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
    efamily: { name: '대법원 전자가족관계등록시스템', url: 'https://efamily.scourt.go.kr', login: '공동인증서·금융인증서·간편인증', fee: '인터넷 발급 무료' },
    unipass: { name: '유니패스(관세청)', url: 'https://unipass.customs.go.kr', login: '공동인증서' }
  };
  // [id, 이름에 들어 있는 말(정규식), kind, agency, 발급받을 서류, input, 덧붙임(playbook·early)]
  var R = [
    // ── 기관에서 발급 ──
    ['idcard', '주민등록증|신분증|운전면허|여권|외국인등록증|장애인등록증|국가유공자증', 'user', '', '', '', {}],
    // ── v3: 법원·등기 서류(2026-11-08). 집행권원·판결문이 사용자 자료로, 법원 결정문 등본이 주민등록으로 분류되던 것을 바로잡는다 ──
    ['court-copy', '집행문|집행력\\s*있는|집행권원|(판결|결정|심판|재판|조정|화해|중재|재결|명령|조서|판정|기록).{0,8}(정본|등본)|재판서', 'agency', 'ecfs', '재판서·집행문 정본/등본(전자소송)', 'ask', { unverified: true, note: '전자소송으로 최초의 집행문과 함께 재판서 정본을 받으면 교부 수수료가 무료입니다. 사건번호가 필요합니다', conf: '중간' }],
    ['court-decision', '(개시|허가|확정)(결정문|심판문)|^(판결문|결정문|결정서|심판서|재결서|약식명령)|(사건|소송)기록(?!.*목록)', 'agency', 'ecfs', '재판서·사건기록(전자소송)', 'ask', { unverified: true, note: '전자소송에서 사건번호로 신청합니다. 최초 교부는 무료인 경우가 있습니다', conf: '중간' }],
    ['court-fee', '^인지(?!.*영수)|송달료(?!.*영수)', 'agency', 'ecfs', '송달료·인지 납부(전자소송)', 'ask', { unverified: true }],
    ['registry-misc', '등록부등본|등록원부등본|광업원부|전유부등본', 'agency', 'iros', '등기·등록부 등본(종류 검토 필요)', 'ask', { unverified: true, note: '등기·등록부 종류를 먼저 확인합니다', conf: '낮음' }],
    // ── 전수조사 보정(2026-11-07): 기관을 특정해 즉시 연다 ──
    ['acq-tax', '취득세.*(영수|납부|확인)|지방세.*(영수|납부)', 'agency', 'wetax', '취득세 영수필확인서·납부확인서', 'none', { note: '위택스에서 납부확인서를 받습니다. 지방세 시스템 장애·점검 때는 지자체 세무부서에 문의하세요', conf: '중간' }],
    ['localtax-extra', '(지방세|자동차세|재산세|부담금|과태료).*(고지서|납세|납부확인|납부내역)|체납', 'agency', 'wetax', '지방세·부담금 고지·납부 내역', 'none', { unverified: true, note: '위택스에서 조회합니다. 시스템 장애·점검 때는 지자체 세무부서에 문의하세요', conf: '중간' }],
    ['housing-bond', '국민주택채권|주택채권', 'agency', 'nhuf', '국민주택채권 매입 필증', 'ask', { note: '주택도시기금 발급(조사 전)', conf: '미조사' }],
    // ── v4: 홈택스 서류를 서류별로 나눈다(메뉴가 서로 다르다). 타인 회사(제조사·임대사업자 등)의 사업자등록증은 본인 발급이 아니라 사용자가 받아 둔 자료다 ──
    ['biz-reg', '^(?!.*(?:제조사|임대사업자|거래처|입찰|상대방|양도인|양수인|납품)).*사업자등록증', 'agency', 'hometax', '사업자등록증 재발급·사업자등록증명', 'none', { note: '홈택스에서 사업자등록증 재발급(무료). 은행·거래처가 “증명”을 요구하면 사업자등록증명(무료)이 다른 서류입니다', conf: '중간' }],
    ['biz-closure', '폐업사실|휴업사실', 'agency', 'hometax', '폐업사실증명·휴업사실증명', 'none', { note: '홈택스에서 무료로 즉시 발급됩니다', conf: '중간' }],
    ['withholding', '원천징수영수증|지급명세', 'agency', 'hometax', '원천징수영수증(지급명세서) 조회·출력', 'none', { fallback: '지급자(회사)가 홈택스에 제출하지 않았으면 회사에 발급을 요청하세요', note: '홈택스 지급명세서 조회·출력(무료). 회사가 홈택스에 제출하지 않았으면 조회되지 않습니다', conf: '중간' }],
    ['tax-invoice', '세금계산서', 'agency', 'hometax', '세금계산서 조회·출력', 'ask', { unverified: true, fallback: '없으면 거래 상대방에게 발급을 요청하세요', note: '홈택스 조회·출력 범위는 아직 조사하지 못했습니다', conf: '낮음' }],
    ['income-cert', '소득증명원|납세사실', 'agency', 'hometax', '소득금액증명·납세사실증명', 'none', { note: '홈택스·정부24 무료. 소득이 없으면 소득금액증명은 발급되지 않습니다(납세사실증명)', conf: '중간' }],
    ['criminal', '범죄경력|수사경력', 'agency', 'police', '범죄·수사경력회보서', 'none', { note: '경찰민원포털 발급 절차는 아직 조사하지 못했습니다(지문 확인이 필요할 수 있음)', conf: '미조사' }],
    ['traffic-acc', '교통사고사실확인|사고사실확인', 'agency', 'efine', '교통사고사실확인원', 'ask', { note: '발급 절차는 아직 조사하지 못했습니다', conf: '미조사' }],
    ['vaccine', '예방접종증명|접종증명', 'agency', 'nip', '예방접종증명서', 'none', { note: '발급 절차는 아직 조사하지 못했습니다', conf: '미조사' }],
    ['customs', '수출신고필증|수입신고필증|수출입신고|통관', 'agency', 'unipass', '수출입 신고필증', 'ask', { note: '발급 절차는 아직 조사하지 못했습니다', conf: '미조사' }],
    ['trust-reg', '신탁원부', 'agency', 'iros', '신탁원부(등기소)', 'ask', { note: '등기소 발급, 수수료는 등기사항증명서와 같을 수 있습니다(조사 전)', conf: '미조사' }],
    ['entry-record', '출입국(사실|기록)', 'agency', 'gov24', '출입국사실증명서', 'none', { note: '온라인 무료(국문·영문 선택). 정부24가 점검·장애일 때는 출입국·외국인청을 방문하세요', conf: '높음' }],
    ['move-in', '전입세대', 'agency', 'gov24', '전입세대 열람내역', 'none', { note: '정부24, 본인·세대원만(조사 전)', conf: '미조사' }],
    ['farmland', '농지원부', 'agency', 'gov24', '농지원부', 'ask', { note: '정부24 인터넷 무료로 안내되지만 확신도가 낮습니다', conf: '낮음' }],
    ['health-check', '건강검진결과', 'agency', 'nhis', '건강검진 결과통보서', 'none', { note: '건강보험공단 발급(조사 전)', conf: '미조사' }],
    ['patent-cert', '특허증|상표등록증|디자인등록증|실용신안등록증', 'agency', 'patent', '등록증(특허로)', 'ask', { paid: true, note: '수수료가 있습니다(온라인 5,000~7,000원대, 항목별로 확인). 결제 전에 금액을 확인하세요. 전자등록증은 특허로에서 PDF로 받습니다', conf: '중간' }],
    ['corp-seal', '법인인감', 'agency', 'iros', '법인 인감증명서(등기소)', 'ask', { unverified: true, note: '법인 인감증명서는 등기소에서 발급합니다(인터넷 신청 1,100원). 절차는 미확인', conf: '낮음' }],
    ['corp-registry', '법인.*등기|법인등기', 'agency', 'iros', '법인 등기사항증명서', 'ask', { playbook: 'iros-corp-ecourt', early: true, note: '인터넷 열람 700원·발급 1,000원. 열람 1,100원·발급 1,400원으로 올리는 안이 예고되어 있어(2026-11-23 시행 예정) 결제 화면에서 금액을 확인하세요', conf: '높음' }],
    ['estate-registry', '(토지|건물|부동산|건축물).*등기|등기.*(토지|건물|부동산)', 'agency', 'iros', '부동산 등기사항증명서', 'ask', { note: '인터넷 열람 700원·발급 1,000원(인상 예고 있음). 본인 소유 부동산의 인터넷 전자증명서는 수수료 면제 규정이 있습니다', conf: '높음' }],
    ['registry-generic', '등기부|등기사항|등기필', 'agency', 'iros', '등기사항증명서', 'ask', { note: '법인인지 부동산인지 먼저 정합니다. 인터넷 열람 700원·발급 1,000원(인상 예고 있음)', conf: '높음' }],
    ['family-old', '제적', 'agency', 'efamily', '제적등본·제적등초본(전자가족관계등록시스템)', 'none', { unverified: true, note: '제적등본은 대법원 전자가족관계등록시스템에서 발급합니다', conf: '중간' }],
    ['family', '가족관계|혼인관계|기본증명|입양관계|친양자', 'agency', 'gov24', '가족관계등록부 증명서', 'none', { note: '인터넷 발급 무료(전자가족관계등록시스템·정부24). 일반·상세·특정 중 제출처가 요구한 것을 고르세요', conf: '높음' }],
    ['seal', '인감증명', 'agency', 'gov24', '인감증명서', 'none', { review: true, note: '개인 인감증명서의 온라인 발급 가능 여부와 수수료(600원·면제)는 출처가 엇갈립니다. 본인 신청만 가능(대리 불가)', conf: '낮음' }],
    ['building', '건축물대장|건축물현황', 'agency', 'gov24', '건축물대장', 'ask', { note: '정부24·세움터 인터넷은 무료로 안내됩니다(출처 상충). 창구는 열람 300원·발급 500원. 집합건물은 전유부가 필요한지 확인하세요', conf: '중간' }],
    ['land', '토지대장|임야대장|지적도|임야도|지적공부', 'agency', 'gov24', '토지(임야)대장·지적도', 'ask', { note: '창구 토지대장 열람 300원·발급 500원, 지적도 열람 400원·발급 700원. 인터넷 수수료는 출처가 엇갈려 결제 화면에서 확인하세요', conf: '중간' }],
    ['landuse', '토지이용계획확인', 'agency', 'gov24', '토지이용계획확인서', 'ask', { note: '발급 1,000원(컬러 1,500원)이며 지자체 조례에 따라 다를 수 있습니다. 결제 화면에서 확인하세요', conf: '중간' }],
    ['landprice', '공시지가', 'agency', 'gov24', '개별공시지가 확인서', 'ask', {}],
    ['localtax', '지방세|세목별과세', 'agency', 'gov24', '지방세 납세증명서', 'none', { note: '지방세 납세증명서는 무료이며 유효기간은 30일입니다(위택스·정부24)', conf: '높음' }],
    ['nationaltax', '국세|납세증명|완납증명|소득금액|사업자등록증명|부가가치세|표준재무|소득증명서', 'agency', 'hometax', '국세 증명서(납세·소득금액·사업자등록증명 등)', 'none', { note: '홈택스·정부24 무료. 온라인은 대리 신청이 안 됩니다', conf: '중간' }],
    ['nhis', '건강보험|자격득실|보험료납부', 'agency', 'nhis', '건강보험 자격득실확인서·납부확인서', 'none', { note: '건강보험 자격득실확인서는 정부24·건강보험공단에서 무료로 받습니다', conf: '중간' }],
    ['nps', '국민연금', 'agency', 'nps', '국민연금 가입증명서', 'none', { note: '국민연금공단 발급(조사 전)', conf: '미조사' }],
    ['insure4', '고용보험|산재보험|4대보험', 'agency', 'insure4', '고용·산재보험 가입(납부)증명', 'none', { note: '4대사회보험 정보연계센터에서 무료. 사업장용(가입자 명부)인지 개인용(자격득실확인서)인지 먼저 정합니다', conf: '중간' }],
    ['military', '병적증명|병적기록', 'agency', 'gov24', '병적증명서', 'none', { note: '정부24에서 무료로 발급합니다(병무청 공식 안내). 현역 복무 중인 사람은 발급 대상이 아니며 군경력증명서는 다른 서류입니다', conf: '높음' }],
    ['foreigner', '외국인등록사실', 'agency', 'gov24', '외국인등록사실증명', 'none', { note: '온라인 무료. 외국인은 하이코리아에서 외국인등록번호로 발급합니다. 정부24가 점검·장애일 때는 출입국·외국인청을 방문하세요', conf: '높음' }],
    ['vehicle-reg', '자동차등록원부|차량등록원부', 'agency', 'gov24', '자동차등록원부', 'ask', { note: '자동차등록원부는 갑부·을부 각 1,000원이며 온라인도 같습니다(결제 필요)', conf: '중간', paid: true }],
    ['court-service', '송달증명|확정증명', 'agency', 'ecfs', '송달증명원·확정증명원', 'ask', { note: '사건에 관한 증명서는 1건 500원이며 전자소송은 감액됩니다(자동 발급은 무료). 사건번호가 필요합니다', conf: '높음' }],
    ['patent-reg', '특허등록원부|상표등록원부|디자인등록원부', 'agency', 'patent', '등록원부(특허로)', 'ask', { paid: true, note: '등록원부 발급은 수수료가 있습니다. 결제 전에 금액을 확인하세요', conf: '중간' }],
    ['resident', '주민등록|^(등본|초본)', 'agency', 'gov24', '주민등록표 등본·초본', 'none', { note: '온라인 무료. 본인·세대원만 발급할 수 있고(대리 불가) 말소자(사망자) 초본은 주민센터 방문이 필요합니다', conf: '높음' }],
    // ── 개별 기관(회사·병원·학교·시험기관)이 발급 ──
    ['employer', '재직증명|경력증명|근무확인|복무확인|급여명세|임금명세|원천징수|소득증빙', 'thirdparty', '', '', '', { who: '소속 회사(인사·총무 부서)' }],
    ['medical', '진단서|진료|처방전|진료비|치료비|소견서|출생증명', 'thirdparty', '', '', '', { who: '진료받은 병원' }],
    ['medical-rec', '입원|퇴원|수술기록|투약|활력징후|경과기록|간호기록|마취|의사지시|응급실|처방기록|치료경과', 'thirdparty', '', '', '', { who: '진료받은 병원' }],
    ['insurer', '보험가입증명|보험증권', 'thirdparty', '', '', '', { who: '가입한 보험사' }],
    ['school', '졸업증명|성적증명|재학증명|학위증명|교육이수|수료증|이수증|원산지증명', 'thirdparty', '', '', '', { who: '다닌 학교' }],
    ['testing', '시험성적|검사성적|수질검사|검사결과|공인시험', 'thirdparty', '', '', '', { who: '시험·검사 기관' }],
    ['appraisal', '감정평가서', 'thirdparty', '', '', '', { who: '감정평가법인' }],
    ['finance', '금융거래내역|송금내역|입금내역|거래내역|공과금납부|잔액증명', 'thirdparty', '', '', '', { who: '거래 은행·증권사' }],
    ['analysis', '분석서|분석표|측정결과|측정성적|성적서|검토서|영향평가|조사결과|선박검사|선박국적|석면', 'thirdparty', '', '', '', { who: '검사·분석을 한 기관' }],
    // ── 사용자가 직접 만들거나 이미 가진 자료 ──
    ['user-list', '명단|대장|일지|회의록|결의서|규약|선임서|출근부|출퇴근|공정표|구역도|조서|초안|계획안|자기소개서|탄원서|반성문|차용증|합의서|추천서|초청장|송장|번역', 'user', '', '', '', {}],
    ['user-own', '사본|원본|사업계획서|위임장|사진|통장|계획서|도면|배치도|평면도|견적|계약서|영수증|진술서|확인서|동의서|각서|자격증|이력서|증빙|명세|현황표|설명서|사양서|재무제표|재무상태표|정관|신분증|서명|서약|목록|보고서|신청서|소명|기술서|내역서|명부|조직도|의사록|규정|대조표|대비표|도서|공정도|위치도|사유서|재산목록|사업자등록증|진술|통지서|증명사진|규칙|선언서|승낙서|산출|증명하는서류|증명서류|증명자료|입증|경위서|개요서|자료|계산서|일정표|예산서|손익|제원|성분표|안전|기준서|편성표|노선도|등록증|전역증|허가증|면허증|인증서|지정서|현황도|흐름도|증명서', 'user', '', '', '', {}]
  ];
  var RULES = R.map(function (r) {
    var x = r[6] || {};
    return { id: r[0], re: new RegExp(r[1]), kind: r[2], agency: r[3], doc: r[4], input: r[5], playbook: x.playbook || '', early: !!x.early, review: !!x.review, unverified: !!x.unverified, paid: !!x.paid, fallback: x.fallback || '', note: x.note || '', conf: x.conf || '', who: x.who || '' };
  });
  function norm(label) { return String(label || '').replace(/\s+/g, ''); }
  var PRE = /^(신청인의?|신청자의?|대표자의?|대리인의?|본인의?|기존|종전|변경전|변경후|최근|해당|제출|각|소유자의?|채권자의?|채무자의?|양도인의?|양수인의?|상대방의?|당사자의?|공동)/;
  var GEN = /(증빙|증명|입증|소명|근거)(하는|할|을|를|하기위한|할수있는)?(서류|자료)$|증빙서류|증명서류|증빙자료|증명자료|입증자료|입증서류|소명자료|관련서류|관련자료|근거서류|근거자료/;
  var HELD = /(등록증|허가증|면허증|신고증|인증서|자격증|증서|허가서|승인서|통지서|신고필증|등록원부|인가서)$/;
  var FORM_DOC = /신청서|동의서|의뢰서|위임장/;   // 사용자가 쓰는 양식은 기관 서류가 아니다(예: 인감증명서발급신청서)

  /** 이름 → { form: '사본'|'원본'|'정본'|'', base } — 괄호 안 말·부수(1부 등)·사본/원본·접두어(신청인·기존 등)를 뗀다. 정본은 사본과 합치지 않는다. */
  function split(label) {
    var t0 = norm(label), t = t0.replace(/\(.*?\)|\[.*?\]/g, '').replace(/\d+\s*(부|통|매|장|건)$/, '') || t0, form = '', base = t;
    if (/(복사본|사본)$/.test(base)) { form = '사본'; base = base.replace(/(복사본|사본)$/, ''); }
    else if (/원본$/.test(base)) { form = '원본'; base = base.slice(0, -2); }
    else if (/정본/.test(base)) form = '정본';
    var b2 = base.replace(PRE, ''); if (b2) base = b2;
    return { form: form, base: base };
  }
  function firstRule(t) {
    for (var i = 0; i < RULES.length; i++) { var r = RULES[i]; if (r.re.test(t) && !(r.kind === 'agency' && FORM_DOC.test(t))) return r; }
    return null;
  }

  /** 서류 이름 → { kind, reason, form, base, id, agency, doc, input, playbook, early, unverified, upload, instant, goal } (모르면 kind:'unknown') */
  function classify(label) {
    var s = split(label), t = s.base;
    if (!t) return { kind: 'unknown', reason: 'UNKNOWN', form: '', base: '' };
    var r = firstRule(t), out;
    if (r) {
      var ag = r.agency ? AGENCIES[r.agency] : null;
      out = { kind: r.kind, id: r.id, agency: r.agency, doc: r.doc, input: r.input, playbook: r.playbook, early: r.early, review: r.review, unverified: r.unverified, paid: r.paid, fallback: r.fallback, note: r.note, conf: r.conf, who: r.who };
      if (ag) {
        out.site = ag.name; out.url = ag.url; out.login = ag.login; out.upload = true;
        out.instant = r.input === 'none' && !r.playbook;
        out.goal = ag.name + '(' + ag.url + ')에서 “' + String(label).trim().slice(0, 60) + '”(' + r.doc + ')을(를) 발급받아 나비웹으로 보내 주세요. 사이트를 먼저 열고 로그인 안내를 하세요. 서류: ';
      }
    } else if (s.form === '사본' || s.form === '원본') {
      out = { kind: 'user', id: 'held-copy' };     // 종류를 모르는 서류의 사본 = 사용자가 가진 서류를 올리는 것
    } else out = { kind: 'unknown' };
    out.form = s.form; out.base = s.base;
    if ((out.kind === 'user' || out.kind === 'unknown') && GEN.test(t)) out.reason = 'GENERIC';
    else if (out.kind === 'agency') out.reason = 'AGENCY';
    else if (out.kind === 'thirdparty') out.reason = 'THIRD_PARTY';
    else if (out.kind === 'user') out.reason = (out.id === 'held-copy' || ((s.form === '사본' || s.form === '원본') && HELD.test(t))) ? 'USER_HELD' : 'USER_OWNED';
    else out.reason = 'UNKNOWN';
    return out;
  }
  /** 서류 화면이 "도우미가 가져오기" 버튼을 붙일 항목의 정규식 문자열 — 기관 발급 + (모르는 것) 에서 개별 기관·사용자 자료는 뺀다. */
  function patterns() {
    var ag = [], other = [];
    RULES.forEach(function (r) { (r.kind === 'agency' ? ag : other).push(r.re.source); });
    /* 서류 화면(navi-pro)은 식 20개·식당 200자까지만 받는다. 기관 규칙은 200자 이하 묶음으로 합쳐 개수를 줄인다(규칙이 늘어도 뒤쪽 항목의 버튼이 사라지지 않게).
     * 묶음마다 신청서·동의서 같은 양식은 제외하는 앞머리(약 36자)를 붙이므로 본문은 150자까지만 담는다. */
    var HEAD = '^(?!.*(?:' + FORM_DOC.source + ')).*(?:', TAIL = ')', LIM = 190 - HEAD.length - TAIL.length;
    var chunks = [], cur = '';
    ag.forEach(function (src) {
      if (cur && (cur + '|' + src).length > LIM) { chunks.push(cur); cur = src; } else cur = cur ? cur + '|' + src : src;
    });
    if (cur) chunks.push(cur);
    return chunks.map(function (c) { return HEAD + c + TAIL; }).concat(['^(?!.*(?:' + other.join('|') + ')).+']);
  }
  /** 서류 이름 → 서류 화면에 보여 줄 안내 { reason, text, note, conf, paid, fallback } — 기관 서류는 text 가 없고(note 만), 그 밖은 “어떻게 마련하나”를 text 로 돌려준다. 규칙이 없으면 null. */
  function explain(label) {
    var c = classify(label), text = '';
    if (c.reason === 'THIRD_PARTY') text = (c.who ? c.who + '에' : '발급한 기관에') + ' 요청해 받은 서류를 올려 주세요.';
    else if (c.reason === 'USER_HELD') text = '가지고 계신 서류의 사본을 올려 주세요.';
    else if (c.reason === 'USER_OWNED') text = '직접 작성하거나 가지고 있는 자료를 올려 주세요.';
    else if (c.reason === 'GENERIC') text = '어떤 서류가 필요한지 도우미에게 물어보세요.';
    else if (c.reason !== 'AGENCY') return null;
    return { reason: c.reason, text: text, note: c.note || '', conf: c.conf || '', paid: !!c.paid, fallback: c.fallback || '' };
  }
  /** 사유 코드 설명. 앞의 6개는 classify() 가 돌려주고, 뒤의 2개는 도우미가 실행하다 만난 사유라 서류 화면·관리자 보고함이 쓴다. */
  var REASONS = {
    AGENCY: '기관에서 발급', THIRD_PARTY: '개별 기관·사람이 발급', USER_OWNED: '사용자가 작성·준비', USER_HELD: '사용자가 가진 서류의 사본',
    GENERIC: '통칭 이름(서식 문맥 필요)', UNKNOWN: '규칙 없음',
    SYSTEM_OUTAGE: '기관 시스템 장애로 발급할 수 없음(실행 중)', FETCH_FAILED: '가져오기에 실패함(실행 중)'
  };
  function stats() { var k = {}; RULES.forEach(function (r) { k[r.kind] = (k[r.kind] || 0) + 1; }); return { rules: RULES.length, byKind: k, verified: VERIFIED, reviewed: false }; }

  var api = { classify: classify, split: split, explain: explain, patterns: patterns, stats: stats, AGENCIES: AGENCIES, RULES: RULES, VERIFIED: VERIFIED, REVISED: REVISED, REASONS: REASONS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.AttachCatalog = api;
})(typeof window !== 'undefined' ? window : this);
