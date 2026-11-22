/* 10만 AI 전문가 — 문서 그리기(iframe 없이 화면에 바로 넣는다). Material Design 3 기준의 카드·칩·목록.
 * window.ExDoc.show(키, 요소)  — 키: 'overview' 이면 expert100k-overview.html 의 본문을, 그 밖의 키는 아래 F 의 분야 초안을 그린다.
 * 새 분야는 F 에 항목을 더하고 desktop.html 의 위쪽 탭·_EX_KEYS 에 같은 키를 더한다. */
(function () {
var CSS = `
.exd{--exp:var(--pri,#1A73E8);--exs:#F3F6FC;--exc:#E8F0FE;--exo:#DADCE0;--ext:#202124;--ext2:#5F6368;font-family:'Pretendard',Roboto,-apple-system,'Noto Sans KR',sans-serif;color:var(--ext);font-size:14px;line-height:1.7;word-break:keep-all;max-width:880px;margin:0 auto;padding:24px 16px 72px}
.exd h1{font-size:28px;line-height:36px;font-weight:400;letter-spacing:0;margin:0}
.exd h1 small{display:block;font-size:12px;line-height:16px;font-weight:500;letter-spacing:.5px;color:var(--exp);margin-bottom:8px}
.exd .lead{font-size:16px;line-height:24px;color:var(--ext2);margin:8px 0 0}
.exd .meta{display:inline-flex;align-items:center;font-size:12px;line-height:16px;font-weight:500;color:var(--ext2);border:1px solid var(--exo);border-radius:8px;padding:6px 12px;margin-top:16px}
.exd .toc{display:flex;gap:8px;flex-wrap:wrap;margin:16px 0 8px}
.exd .toc a{display:inline-flex;align-items:center;height:32px;padding:0 16px;border:1px solid var(--exo);border-radius:8px;font-size:14px;font-weight:500;color:var(--ext);text-decoration:none;cursor:pointer}
.exd .toc a:hover{background:var(--exc);border-color:var(--exc);color:var(--exp)}
.exd section{background:#fff;border:1px solid var(--exo);border-radius:16px;padding:24px;margin-top:16px;scroll-margin-top:12px}
.exd h2{display:flex;align-items:center;gap:12px;font-size:22px;line-height:28px;font-weight:400;margin:0 0 16px}
.exd h2 .n{flex:none;min-width:32px;height:32px;padding:0 6px;border-radius:8px;background:var(--exp);color:#fff;font-size:14px;font-weight:500;display:flex;align-items:center;justify-content:center;margin:0}
.exd h3{font-size:16px;line-height:24px;font-weight:500;margin:20px 0 4px}
.exd p{color:var(--ext2);margin:0 0 12px}.exd p b,.exd li b,.exd td b{color:var(--ext);font-weight:600}
.exd ul,.exd ol{margin:0 0 12px 20px;color:var(--ext2)}.exd li{margin:4px 0}
.exd a{color:var(--exp)}.exd sup a{text-decoration:none;font-size:11px}
.exd .callout{background:var(--exc);border:0;border-radius:12px;padding:16px 20px;margin:0 0 16px}.exd .callout p{color:var(--ext);margin:0 0 8px}.exd .callout p:last-child{margin:0}
.exd .key{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin:0 0 16px}
.exd .key div{background:var(--exs);border-radius:12px;padding:16px;color:var(--ext2);font-size:12px;line-height:18px}
.exd .key div b{display:block;color:var(--ext);font-size:24px;line-height:32px;font-weight:400}
.exd .tbl{overflow-x:auto;margin:8px 0 16px;border:1px solid var(--exo);border-radius:12px}
.exd table{width:100%;border-collapse:collapse;font-size:14px}
.exd th,.exd td{padding:12px 16px;text-align:left;vertical-align:top;color:var(--ext2);border-top:1px solid var(--exo)}
.exd tr:first-child th,.exd tr:first-child td{border-top:0}
.exd th{color:var(--ext);font-weight:500;background:var(--exs)}
.exd td.num,.exd th.num{text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums}.exd td.num{color:var(--ext);font-weight:500}
.exd tr.sub td{background:var(--exs);color:var(--ext);font-weight:600}.exd tr.tot td{color:var(--ext);font-weight:700;border-top:2px solid var(--ext2)}
.exd .tag{display:inline-block;font-size:11px;line-height:20px;padding:0 8px;border:1px solid var(--exo);border-radius:8px;margin-right:6px;font-weight:500;white-space:nowrap}.exd .tag.s{color:var(--exp);border-color:var(--exp)}
.exd .bar{display:block;height:6px;border-radius:3px;background:var(--exp);opacity:.75;min-width:2px}.exd td.bc{width:18%;min-width:90px;vertical-align:middle}
.exd .small{font-size:12px;line-height:18px}.exd .src li{font-size:12px;word-break:break-all}
.exd .pipe{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:0 0 12px}.exd .pipe span{background:var(--exs);border-radius:8px;padding:4px 12px;font-size:13px;font-weight:500;color:var(--ext)}.exd .pipe i{color:var(--ext2);font-style:normal}
.exd .li{display:flex;gap:12px;align-items:flex-start;padding:12px 0;border-top:1px solid var(--exo)}.exd .li:first-child{border-top:0;padding-top:0}.exd .li:last-child{padding-bottom:0}
.exd .sn{flex:none;min-width:32px;font-style:normal;font-size:13px;line-height:24px;font-weight:500;color:var(--exp);font-variant-numeric:tabular-nums}
.exd .li b{display:block;font-size:16px;line-height:24px;font-weight:500;color:var(--ext)}.exd .li span{color:var(--ext2)}
.exd ol.steps{list-style:none;margin:0;padding:0}.exd ol.steps li{display:flex;gap:12px;align-items:flex-start;margin:0;padding:10px 0;border-top:1px solid var(--exo);color:var(--ext2)}.exd ol.steps li:first-child{border-top:0;padding-top:0}
.exd .st-err{color:#B3261E}
@media (max-width:700px){.exd .key{grid-template-columns:repeat(2,minmax(0,1fr))}.exd h1{font-size:24px;line-height:32px}.exd section{padding:16px}}
`;
var F = {
law:{t:'법률',sub:'일상에 법치를 구현한다',
 def:'나만의 AI 비서(나비)가 사용자의 일상과 업무를 기록하다가 법적 다툼의 여지가 있는 대화나 문서를 발견하면, 행위 전에 변호사 AI를 호출해 법적 검토를 거치고, 필요하면 인간 변호사를 연결합니다. 나비웹을 쓰는 모든 개인과 조직이 법과 규정을 생활화하는 것이 목표입니다.',
 pain:['법은 분쟁이 생긴 뒤에야 찾게 됩니다. 계약서의 특약 한 줄, 메시지 한 통이 분쟁의 씨앗인 줄 모르고 서명하고 보냅니다.','변호사 상담은 비용과 문턱이 높아 대부분의 계약과 약속이 검토 없이 이루어집니다.','조직도 규정 준수를 담당자 개인의 기억과 경험에 의존합니다.'],
 layers:[['나비(기록·감지)','사용자가 허락한 범위의 대화·문서에서 계약, 금전, 고용, 임대차, 약속 같은 쟁점 신호를 찾습니다. 원문은 본인의 PDV에만 두고, 감지 결과만 다음 단계로 넘깁니다.'],['변호사 AI(사전 검토)','서명·송금·발송 같은 행위 전에 위험 조항과 근거 법령·법리, 대안 문구를 제시합니다. K-Law를 활용하고, 확신이 낮으면 낮다고 표시합니다.'],['L3 변호사(인간 연결)','위험이 높거나 사용자가 원하거나 AI가 불확실할 때 인간 변호사를 연결합니다. 비용과 소요 시간을 먼저 보여 줍니다.'],['OpenHash(사실 기록)','"이 시점에 이 버전을 검토했다"는 사실을 해시로 남깁니다. 내용은 공개하지 않고, 필요할 때 본인이 제출해 입증합니다.']],
 flow:['임대차 계약서 사진을 찍어 두면 나비가 특약 조항을 찾아냅니다.','서명 전에 "보증금 반환 조건이 불리한 특약이 있습니다"라고 알립니다.','변호사 AI가 근거와 수정안을 제시합니다.','위험이 높으면 인간 변호사 연결을 제안합니다(예상 비용·시간 표시).','서명한 뒤 검토 사실이 기록으로 남습니다.'],
 l3:['변호사 AI 결과를 검토·승인하고 최종 책임을 집니다.','고위험 사안을 직접 상담합니다.','AI가 틀린 사례를 모아 K-Law와 검토 기준에 되돌립니다.'],
 gate:['변호사법상 법률사무의 범위를 확인해야 합니다. AI 검토를 "참고 정보"로 두고 인간 변호사로 이어지는 구조가 필요합니다.','기록 범위는 사용자 동의와 최소 수집이 원칙입니다. 기본값을 어디까지 열지 정해야 합니다.','경고가 너무 잦으면 무시하게 됩니다. 알림 기준(임계값)을 정해야 합니다.'],
 ref:'법률 상담·ADR 1,200명(개요 가정), 서류 직역(법무사·행정사·변리사) 3,500명. 사법 탭과 인력 일부를 공유합니다.',
 ask:['어떤 유형의 계약·문서부터 사전 검토하면 분쟁 예방 효과가 가장 큽니까?','AI 검토를 "법률 자문"으로 보지 않게 하는 고지 방식은 무엇입니까?']},
medical:{t:'의료',sub:'기록으로 이어지는 진료',
 def:'나비가 증상·복약·수면·검진 기록을 본인의 PDV에 모으고, 이상 패턴이 보이면 의사 AI가 문진과 진료 참고 자료를 정리합니다. 만성질환 재처방과 경증은 L3 의사가 검토하고, 필요하면 대면 진료로 연결합니다.',
 pain:['진료 시간이 짧아 환자의 최근 경과를 설명하기 어렵습니다.','진료와 진료 사이의 기록이 없어 변화를 놓칩니다.','여러 병원·약국을 오가며 중복 처방과 약물 상호작용을 확인하기 어렵습니다.'],
 layers:[['나비(기록·감지)','본인이 남긴 증상, 복약, 수면, 혈압·혈당 기록을 시간순으로 정리하고, 평소와 다른 변화를 알립니다.'],['의사 AI(사전 정리)','진료 전 문진 요약과 감별 참고 정보, 복약 점검을 만듭니다. 진단을 확정하지 않고 "진료 참고"로만 제시합니다.'],['L3 의사(검토·책임)','AI가 준비한 재처방·경증 건을 검토·승인하고, 위험 징후가 있으면 대면 진료로 연결합니다. 응급 징후는 즉시 119·응급실을 안내합니다.'],['OpenHash(무결성)','처방·동의·열람 이력을 위·변조 없이 남깁니다. 병원 간 공유는 본인이 건별로 허락합니다.']],
 flow:['혈압 기록이 2주째 높아지면 나비가 알립니다.','의사 AI가 최근 기록과 복약을 정리해 진료 요약을 만듭니다.','L3 의사가 검토해 재처방이 가능하다고 판단하면 승인합니다.','위험 징후가 있으면 가까운 병원 예약으로 연결합니다.','본인의 허락 아래 병원에 요약을 보냅니다.'],
 l3:['AI 준비 결과를 검토하고 처방 책임을 집니다(개요 산식: 외래 업무의 30%를 건당 3분 검토).','한의사·약사·간호 L3와 역할을 나눕니다.','오진·누락 사례를 방법론에 되돌립니다.'],
 gate:['의료법상 진단·처방은 의사의 행위입니다. 원격 진료의 허용 범위와 책임 소재를 확인해야 합니다.','건강 정보는 가장 민감합니다. 수집은 본인 선택으로 하고 저장은 로컬을 기본으로 합니다.','응급 오판을 막는 규칙을 인간이 정하고, AI는 그 규칙을 넘지 못하게 해야 합니다.'],
 ref:'의사 9,000명(산식), 한의사·약사·간호 5,000명, 공중보건·식의약·환경 2,000명(가정).',
 ask:['AI가 준비하고 의사가 검토하기에 안전한 진료 유형의 경계는 어디입니까?','L3 의사가 건당 3분 안에 책임 있게 검토하려면 AI가 무엇을 반드시 보여 줘야 합니까?']},
edu:{t:'교육',sub:'학습 기록 위의 개별 지도',
 def:'나비가 학생의 질문과 막힌 지점을 기록하고, 교과 AI 튜터가 개별 설명과 연습을 제공합니다. 교사(L3)는 학습 계획을 승인하고 정서와 평가의 책임을 집니다.',
 pain:['한 교실의 한 가지 속도로는 학생마다 다른 이해 수준을 맞추기 어렵습니다.','어디서 막혔는지 기록이 남지 않아 같은 곳에서 반복해 막힙니다.','교사는 행정과 평가 업무에 시간을 많이 씁니다.'],
 layers:[['나비(기록·감지)','과제, 질문, 오답, 학습 시간을 학생 본인의 기록으로 모으고, 반복해서 막히는 개념을 찾습니다.'],['AI 튜터(개별 지도)','교육과정에 맞춰 설명 수준과 연습 문제를 조절합니다. 정답을 대신 쓰지 않고 풀이 과정을 돕습니다.'],['L3 교사(승인·책임)','학습 계획과 평가 기준을 승인하고, 정서·관계·진로처럼 사람이 맡아야 할 부분을 직접 지도합니다.'],['OpenHash(이력·인증)','학습 이력과 이수·자격 기록의 위·변조를 막습니다. 학부모·학교와의 공유는 본인(미성년은 보호자)이 정합니다.']],
 flow:['학생이 분수 단원에서 같은 유형을 세 번 틀립니다.','나비가 막힌 지점을 정리하고 튜터를 호출합니다.','튜터가 한 단계 낮은 문제부터 다시 시작합니다.','교사가 주간 요약을 보고 보충 지도를 정합니다.','학부모에게는 보호자가 허락한 범위의 요약만 갑니다.'],
 l3:['교과 AI의 설명과 평가 기준을 검토·승인합니다.','AI가 대신할 수 없는 정서·관계·진로 지도를 맡습니다.','교육과정 변화에 맞춰 AI 교재를 갱신합니다.'],
 gate:['미성년자 정보 보호가 최우선입니다. 수집 항목과 보관 기간을 최소로 정해야 합니다.','평가의 공정성과 부정행위 기준을 새로 정해야 합니다.','AI 과의존을 막는 설계와, 교사 역할의 재정의가 필요합니다.'],
 ref:'유·초·중·고 8,500명(학생 약 650명당 1명), 고등·평생교육·연구 2,500명(가정).',
 ask:['개별 지도에서 AI가 맡아도 되는 것과 반드시 교사가 맡아야 하는 것을 어떻게 나눕니까?','학생 기록의 보관 범위와 기간은 어떻게 정해야 합니까?']},
finance:{t:'금융',sub:'거래 전에 점검하는 금융 생활',
 def:'나비가 수입·지출·계약(보험, 대출, 세금)을 본인의 기록으로 모으고, 금융 AI가 거래 전에 수수료·약관·세금 영향을 점검합니다. 신고와 감사는 L3 세무·회계 전문가가 검토합니다.',
 pain:['약관과 수수료는 복잡해서 가입 후에야 불리한 조건을 알게 됩니다.','세금 신고와 공제는 놓치기 쉽고 증빙이 흩어져 있습니다.','보이스피싱 같은 사기 거래는 송금 직전에 막아야 합니다.'],
 layers:[['나비(기록·감지)','본인이 허락한 거래·영수증·계약 기록을 모아 정리하고, 평소와 다른 큰 송금이나 낯선 수취인을 감지합니다.'],['금융 AI(사전 점검)','가입·송금 전에 약관, 총비용, 세금 영향을 설명하고 사기 의심 신호를 경고합니다. 특정 상품을 권유하지 않습니다.'],['L3 세무사·회계사(검토·책임)','신고서와 장부 자동 작성 결과를 검토·승인합니다. 고위험 거래는 사람이 확인합니다.'],['OpenHash(증빙)','거래·신고 증빙을 위·변조 없이 보관해 감사와 분쟁에 대응합니다. GDC 결제 내역도 같은 방식으로 기록합니다.']],
 flow:['낯선 계좌로 큰 금액을 송금하려 하면 나비가 멈춥니다.','금융 AI가 사기 유형과 일치하는 점을 설명합니다.','사용자가 계속하려면 한 번 더 확인합니다.','연말에는 증빙이 정리되어 L3 세무사가 신고서를 검토합니다.','신고 근거 자료가 해시로 보관됩니다.'],
 l3:['AI가 만든 신고서·장부를 검토하고 책임을 집니다.','복잡한 보험·상속·사업 자금 문제를 상담합니다.','금융 AI의 설명이 소비자에게 불리하게 기울지 않는지 감사합니다.'],
 gate:['투자자문·유사수신 규제 때문에 AI는 정보 제공 범위에서 멈추고 개별 투자 권유를 하지 않아야 합니다.','금융 정보 보안과 금융기관 연계 방식을 정해야 합니다.','금융사의 이해관계가 나비의 점검에 영향을 주지 않도록 독립성을 지켜야 합니다.'],
 ref:'회계·세무·금융·보험 8,000명(가정, 신고·감사 자동화 감독).',
 ask:['정보 제공과 투자 권유를 나누는 선은 어디입니까?','사기 의심 거래를 멈추는 기준을 어떻게 정해야 오탐이 적습니까?']},
market:{t:'시장',sub:'공정하고 투명한 거래',
 def:'나비가 구매와 계약 기록을 모으고, 시장 AI가 가격·약관·광고 표시를 점검합니다. 나비웹에 입점한 사업자의 상품과 서비스는 GDC로 결제하며, 입점 심사와 불공정 약관 점검은 L3 전문가가 맡습니다.',
 pain:['판매자와 소비자의 정보가 비대칭이어서 가격과 품질을 비교하기 어렵습니다.','광고·후기가 조작되어 있어도 소비자가 알기 어렵습니다.','분쟁이 나면 거래 증빙이 흩어져 있어 입증이 어렵습니다.'],
 layers:[['나비(기록·감지)','주문, 결제, 약관, 대화 내용을 거래 단위로 묶어 둡니다.'],['시장 AI(사전 점검)','가격 비교, 약관의 불리한 조항, 과장 광고 여부를 거래 전에 알립니다.'],['L3 공정거래·소비자 전문가','입점 사업자의 심사, 불공정 약관 점검, 분쟁 조정을 맡습니다.'],['OpenHash(거래 증빙)','주문·결제·인도·환불 이력을 위·변조 없이 남깁니다. 입점 사업자의 이행 기록도 함께 쌓입니다.']],
 flow:['사용자가 입점 업체의 서비스를 구매하려 합니다.','시장 AI가 가격·환불 조건·약관을 요약해 보여 줍니다.','GDC로 결제하면 주문과 결제 기록이 묶입니다.','문제가 생기면 기록으로 분쟁 조정을 요청합니다.','반복된 문제는 입점 심사에 반영됩니다.'],
 l3:['입점 사업자를 심사하고 약관을 점검합니다.','분쟁 조정안을 검토합니다.','시장 AI의 추천이 특정 사업자에 치우치지 않는지 감사합니다.'],
 gate:['플랫폼 중립성이 핵심입니다. 나비웹 자체의 이해관계와 추천을 분리하는 장치가 필요합니다.','입점 사업자와 나비웹의 책임 범위를 약관에 명확히 해야 합니다.','후기 조작을 막는 방법이 필요합니다.'],
 ref:'소상공인·창업 지원 2,000명, 산업·농수산·제조 5,000명 일부(가정). 개요에는 "시장" 항목이 따로 없어 다음 버전에서 조정이 필요합니다.',
 ask:['입점 심사에서 반드시 확인해야 할 최소 항목은 무엇입니까?','AI 추천의 중립성을 외부에서 검증하려면 무엇을 공개해야 합니까?']},
legis:{t:'입법',sub:'시민의 불편에서 시작하는 법안',
 def:'나비가 시민이 남긴 불편·민원·제안을 (동의와 익명화를 거쳐) 모으고, 입법 AI가 기존 법령과의 충돌·중복, 영향 범위를 점검해 법안 초안을 만듭니다. 입법권은 의원에게 있으며 AI와 L3는 보조합니다.',
 pain:['시민의 불편이 법안까지 이어지는 경로가 멀고 불투명합니다.','새 법안이 기존 법령과 충돌하는지 확인하는 데 시간이 많이 듭니다.','법안이 누구에게 얼마나 영향을 주는지 사전에 알기 어렵습니다.'],
 layers:[['나비(의견 수집)','본인이 공개를 허락한 불편·제안을 익명화해 모읍니다. 개인을 식별할 수 있는 정보는 올리지 않습니다.'],['입법 AI(검토·초안)','유사 민원을 묶고, 관련 법령과의 충돌·중복을 찾고, 신구조문대비표와 영향 시뮬레이션을 만듭니다.'],['L3 입법조사관·보좌진','AI 초안을 검토하고 책임집니다. 의원의 판단을 대신하지 않습니다.'],['OpenHash(이력 공개)','의견 수렴과 법안 수정 이력을 위·변조 없이 공개해 어느 의견이 어떻게 반영됐는지 추적하게 합니다.']],
 flow:['같은 불편이 지역에서 반복해 올라옵니다.','입법 AI가 관련 법령과 빈틈을 정리합니다.','영향 시뮬레이션으로 수혜자·부담자를 추정합니다.','의원실이 검토해 법안 또는 조례 초안으로 발의합니다.','수정 이력이 공개되어 시민이 반영 여부를 확인합니다.'],
 l3:['AI 초안과 영향 분석을 검토합니다.','상임위·예산 검증을 지원합니다.','시뮬레이션 가정을 공개하고 검증받습니다.'],
 gate:['특정 집단의 조직적 입력(봇)을 막고 대표성을 확인해야 합니다.','정치적 중립과 AI 편향을 점검하는 체계가 필요합니다.','AI는 보조이며 결정은 선출직과 의회가 한다는 선을 분명히 해야 합니다.'],
 ref:'국회 1,200명, 지방의회 1,000명(개요: 의원 300명×2, 상임위 17개×20, 입법조사·예산 검증 260명, 지방의회 243곳×4명).',
 ask:['시민 의견이 법안이 되는 과정에서 AI가 개입하지 말아야 할 단계는 어디입니까?','영향 시뮬레이션의 가정을 누가 어떻게 검증해야 합니까?']},
judicial:{t:'사법',sub:'소송 이전에 갈등을 푼다',
 def:'다툼의 두 당사자가 상호 합의해 먼저 "다툼이 없는 사실"을 기술하고, 이어서 "구체적인 다툼 내용"을 제출하면, AI가 K-Law로 1차 법적 판단(법리 포함)을 제시합니다. 이어 법원이 아니라 상호 합의나 변호사 중재를 권해 소송 남발을 줄입니다. 소송으로 가는 경우에는 법학자와 AI 전문가가 협업해 법리를 검토하고 K-Law를 계속 갱신합니다. 법률 분야가 일상의 법치를 맡는다면, 사법 분야는 갈등을 시스템으로 신속하게 해소합니다.',
 pain:['소송은 시간과 비용이 크고, 당사자가 사실관계를 정리하는 데만 많은 노력이 듭니다.','민사 1심의 상당수가 소액·단독 사건이며 대리인 없이 제출되는 비율도 높습니다(개요 2절).','판결 결과를 예측하기 어려워 합의 기회를 놓칩니다.'],
 layers:[['당사자 합의','양측이 동의해야 사건이 열립니다. 일방이 강요할 수 없습니다.'],['K-Law(1차 판단)','양측이 확인한 사실과 각자의 쟁점을 바탕으로 법리를 포함한 1차 판단과 예상 범위를 제시합니다. "법원 판결이 아님"을 항상 표시합니다.'],['변호사 중재(L3)','합의 권고와 중재를 맡고, 이의가 제기되면 3인 합의로 심사합니다(개요 산식).'],['OpenHash(기록)','사건 개설, 사실 확인, 제출 시각, 판단 버전, 합의 내용을 위·변조 없이 남깁니다.']],
 flow:['양측이 중재 사건을 열기로 동의합니다.','다툼이 없는 사실을 함께 작성하고 양측이 확인합니다.','각자 구체적인 다툼 내용과 증거를 제출합니다.','K-Law가 1차 판단과 법리를 제시하고, 합의 또는 변호사 중재를 권합니다.','합의가 되면 합의서를 만들고, 안 되면 정리된 사실관계와 쟁점표를 가지고 소송으로 갑니다.'],
 l3:['중재 변호사가 합의를 돕고 책임집니다.','이의 심사를 3인이 합의해 처리합니다.','법학자와 AI 전문가가 판결·이의 결과를 K-Law와 비교하고 법리를 갱신합니다.'],
 gate:['중재 결과의 법적 효력과 집행력에 대한 제도적 근거가 먼저 필요합니다(개요에서 가장 큰 선결 과제).','K-Law 판단의 법적 성격과 한계를 당사자에게 정확히 알려야 합니다.','이의율(개요 가정 15%)과 판단 품질을 계속 측정하고 공개해야 합니다.'],
 ref:'중재 전환 900명(산식), 법률 상담·ADR·형사 지원·품질 2,300명, 준사법·분쟁조정 600명, 교정·보호관찰 400명(가정).',
 ask:['당사자 합의로 만든 합의서에 집행력을 주려면 어떤 제도 변경이 필요합니까?','K-Law 갱신에 법학자가 참여하는 절차를 어떻게 설계해야 합니까?']},
admin:{t:'행정',sub:'신청하기 전에 알려 주는 행정',
 def:'나비가 신청, 서류, 기한을 기록하고, 행정 AI가 자격 요건을 미리 안내하고 서류를 작성합니다. 처분의 책임은 공무원(L3)이 지며, 취약계층에는 현장 지원 인력이 함께합니다.',
 pain:['받을 수 있는 급여와 보조금을 몰라서 신청하지 못합니다.','같은 정보를 부서마다 반복해 제출합니다.','고령자·장애인·외국인은 디지털 신청에서 소외됩니다.'],
 layers:[['나비(기록·알림)','사용자의 상황(가구, 소득 구간, 거주지 등 본인이 허락한 정보)을 바탕으로 신청 가능한 제도와 기한을 알립니다.'],['행정 AI(서류·사전 판단)','신청서를 작성하고 요건 충족 여부를 사전에 안내합니다. 결정을 대신하지 않습니다.'],['L3 공무원(검토·처분 책임)','AI가 준비한 건을 검토하고 처분합니다. 예외와 복잡한 사안을 직접 판단합니다.'],['OpenHash(처리 이력)','접수·검토·처분 이력을 위·변조 없이 남겨 민원의 진행과 근거를 투명하게 합니다.']],
 flow:['나비가 "이번 달까지 신청 가능한 지원이 있습니다"라고 알립니다.','행정 AI가 필요한 서류와 요건을 점검하고 신청서를 작성합니다.','본인이 확인하고 제출합니다.','공무원이 검토해 처분하고, 거절하면 근거를 설명합니다.','디지털이 어려운 분은 기초자치단체의 지원 인력이 함께 신청합니다.'],
 l3:['AI 준비 결과를 검토하고 처분 책임을 집니다.','예외·복합 사안을 판단합니다.','취약계층 접근 지원과 통계·공공데이터 품질을 맡습니다.'],
 gate:['처분은 법적 책임이 있는 공무원의 행위입니다. 자동 처리의 법적 근거와 범위를 정해야 합니다.','부처 간 개인정보 이용은 본인 동의 방식으로 정해야 합니다.','디지털 격차를 줄이는 현장 지원이 함께 가야 합니다.'],
 ref:'일반 행정 중앙 3,500명·지방 7,700명, 취약계층 접근 지원 3,000명, 통계·공공데이터 700명.',
 ask:['AI가 사전 판단까지 해도 되는 행정 업무와 그렇지 않은 업무를 어떻게 나눕니까?','부처 간 정보 이용에서 본인 동의를 어떻게 간편하게 받을 수 있습니까?']},
transport:{t:'교통',sub:'이동을 안전하게 기록하고 조율한다',
 def:'나비가 일정과 이동 기록을 본인의 PDV에 두고, 교통 AI가 경로와 수단을 추천하며, 사고·위반 상황에서는 증빙을 정리해 법률·보험과 연결합니다. 신호·노선·수요응답교통의 운영은 지자체 교통 L3가 감독합니다.',
 pain:['이동 수단이 여러 가지인데 통합된 정보가 없습니다.','사고가 났을 때 증빙을 모으는 일이 사고 직후의 가장 큰 부담입니다.','농어촌과 고령자는 대중교통 접근이 어렵습니다.'],
 layers:[['나비(기록·일정)','일정과 이동 이력을 본인 기기에 두고, 약속 시간에 맞춘 출발 시각을 알립니다. 위치 정보는 외부로 보내지 않는 것이 기본입니다.'],['교통 AI(경로·수단)','실시간 정보를 바탕으로 경로와 수단을 추천하고, 수요응답교통 같은 대안을 연결합니다.'],['L3 교통 전문가(운영 감독)','신호·노선·수요응답교통 운영안을 검토합니다. 안전과 직결된 판단은 사람이 최종 결정합니다.'],['OpenHash(사고 증빙)','사고 시각, 현장 기록, 제출 이력을 위·변조 없이 남겨 보험·법률 처리를 돕습니다.']],
 flow:['나비가 일정에 맞춰 출발을 알리고 경로를 제안합니다.','대중교통이 어려운 지역은 수요응답 차량을 연결합니다.','사고가 나면 나비가 사진과 시각을 정리해 증빙으로 묶습니다.','필요하면 법률·보험 안내로 이어집니다.','지자체는 집계된 익명 통계로 노선을 개선합니다.'],
 l3:['신호·노선 운영안과 AI 추천 기준을 검토합니다.','수요응답교통의 운영 규칙을 정합니다.','사고 데이터를 분석해 위험 구간을 개선합니다.'],
 gate:['위치정보는 매우 민감합니다. 수집을 최소화하고 집계 통계만 지자체에 보내야 합니다.','안전 임계 시스템(신호, 자율주행)의 최종 책임은 사람이 집니다.','자율주행 사고의 책임 소재를 제도로 정해야 합니다.'],
 ref:'SOC(전력·통신·교통·상하수도·폐기물) 4,000명(가정)에 포함되며 교통만의 별도 인원은 정하지 않았습니다.',
 ask:['AI가 맡아도 되는 교통 운영 판단과 사람만 해야 할 판단의 경계는 어디입니까?','위치정보를 쓰지 않고도 가능한 서비스는 어디까지입니까?']},
logistics:{t:'물류',sub:'인수인계를 기록하는 흐름',
 def:'나비가 주문·배송·재고 기록을 모으고, 물류 AI가 배송 경로, 보관, 통관 서류를 준비합니다. 파손·지연 분쟁은 인수인계 기록으로 입증하고, 규정 검토는 물류 L3가 맡습니다.',
 pain:['여러 업체를 거치는 물류에서 파손·분실의 책임이 누구인지 가리기 어렵습니다.','소상공인은 통관·보관·냉장 규정을 혼자 챙기기 어렵습니다.','업체마다 데이터 형식이 달라 추적이 끊깁니다.'],
 layers:[['나비(기록)','개인과 소상공인의 주문, 발송, 재고를 기록하고 지연을 알립니다.'],['물류 AI(준비)','배송 경로와 보관 조건을 제안하고 통관·운송 서류 초안을 만듭니다.'],['L3 물류 전문가(검토)','통관, 위험물, 냉장·냉동 같은 규정 준수를 검토하고 분쟁 판단을 돕습니다.'],['OpenHash(인수인계 이력)','화물이 넘어갈 때마다 시각과 상태를 위·변조 없이 남겨 책임 구간을 확인합니다.']],
 flow:['소상공인이 상품을 발송하면 나비가 송장과 포장 상태를 기록합니다.','물류 AI가 적합한 운송 방식과 서류를 준비합니다.','인수인계마다 사진·시각이 기록됩니다.','파손이 생기면 기록을 따라 책임 구간이 드러납니다.','보상 판단은 L3 전문가가 확인합니다.'],
 l3:['통관·위험물·콜드체인 규정을 검토합니다.','분쟁의 책임 구간을 판단합니다.','데이터 표준을 정해 업체 간 연동을 돕습니다.'],
 gate:['업체 간 데이터 표준과 참여 유인을 마련해야 합니다.','인수인계 기록을 현장에서 쉽게 남기는 방법이 필요합니다.','통관 등 법정 서류는 사람의 확인 없이는 제출하지 않습니다.'],
 ref:'개요에는 물류 항목이 따로 없고 산업·농수산·제조 5,000명과 SOC 4,000명에 포함됩니다. 다음 버전에서 분리 여부를 정해야 합니다.',
 ask:['소규모 업체가 부담 없이 쓸 수 있는 인수인계 기록 방식은 무엇입니까?','책임 구간 판정에서 AI가 맡을 수 있는 부분은 어디까지입니까?']},
culture:{t:'문화',sub:'창작의 출처와 이용을 기록한다',
 def:'나비가 창작물과 콘텐츠 이용 기록을 모으고, 문화 AI가 저작권·초상권을 점검하며, 창작 시점과 출처를 OpenHash에 남깁니다. 지역 문화·체육·관광 정보를 연결하고, L3 문화 전문가가 검토합니다.',
 pain:['창작물의 선후와 출처를 입증하기 어렵습니다.','AI로 만든 콘텐츠와 허위 정보가 섞여 무엇을 믿을지 알기 어렵습니다.','지역 문화와 관광 정보가 흩어져 있어 접근하기 어렵습니다.'],
 layers:[['나비(기록)','사용자가 만든 글·그림·영상의 작성 시점을 기록하고, 이용한 외부 저작물의 출처를 함께 남깁니다.'],['문화 AI(점검)','게시 전에 저작권·초상권 위험과 출처 표기를 점검하고, 지역 행사·시설·관광 정보를 안내합니다.'],['L3 문화 전문가(검토)','저작권·콘텐츠·체육·관광 전문가가 점검 기준을 정하고 분쟁이나 애매한 사례를 판단합니다.'],['OpenHash(출처·시점)','창작 시점과 파일 해시를 남겨 선후를 입증합니다. AI 생성 여부 표시도 함께 기록합니다.']],
 flow:['사용자가 사진과 글을 올리기 전에 나비가 이용한 외부 자료를 확인합니다.','문화 AI가 초상권·저작권 위험을 알립니다.','게시하면 창작 시점과 출처가 기록됩니다.','분쟁이 생기면 기록으로 선후를 입증합니다.','지역 행사와 관광 정보가 개인 취향에 맞춰 안내됩니다.'],
 l3:['저작권·초상권 판단 기준을 정하고 갱신합니다.','AI 생성물 표시와 정보 무결성을 점검합니다.','지역 문화·체육·관광 콘텐츠를 큐레이션합니다.'],
 gate:['표현의 자유와 검열의 경계를 분명히 하고, 점검은 게시 전 "안내"에 머물러야 합니다.','저작권 판단은 사례마다 달라 AI 판단의 한계를 알려야 합니다.','창작자에게 정당한 보상이 돌아가는 구조가 필요합니다.'],
 ref:'미디어·정보 무결성·문화·체육·관광 2,000명(가정).',
 ask:['게시 전 점검이 검열로 느껴지지 않게 하려면 어떤 방식이 좋습니까?','창작 시점 기록이 저작권 분쟁에서 증거로 인정되려면 무엇이 필요합니까?']},
living:{t:'의식주',sub:'생활의 기본을 점검한다',
 def:'나비가 식생활, 구매, 거주 계약과 관리비 기록을 모으고, 생활 AI가 식품 표시, 임대차·하자, 의류 교환·환불 규정을 점검합니다. 영양사, 공인중개사, 감정평가사, 건축·안전 전문가 L3가 검토합니다.',
 pain:['주거는 일생에서 가장 큰 거래인데 검토 없이 계약하는 경우가 많습니다.','식품 표시와 영양 정보는 복잡해서 선택에 활용하기 어렵습니다.','의류·생활용품은 품질과 교환·환불 규정이 업체마다 다릅니다.'],
 layers:[['나비(기록)','식단, 구매 영수증, 임대차 계약, 관리비, 하자 사진을 생활 기록으로 모읍니다.'],['생활 AI(점검)','계약 전 시세와 권리 관계 점검을 돕고(K-Estate 연계), 식품 표시를 읽어 주고, 교환·환불 규정을 안내합니다.'],['L3 전문가(검토·책임)','공인중개사·감정평가사·건축 안전 전문가·영양사가 고위험 사안을 검토합니다.'],['OpenHash(증빙)','계약 시점의 상태 사진, 하자 신고, 보증금 반환 이력을 위·변조 없이 남깁니다.']],
 flow:['집을 계약하기 전 나비가 등기·시세 점검을 호출합니다.','생활 AI가 위험 신호와 확인할 서류를 알립니다.','입주 때 상태 사진이 시점과 함께 기록됩니다.','퇴거 때 하자 분쟁이 생기면 기록으로 비교합니다.','식품은 본인이 정한 기준(알레르기, 식단)에 맞춰 표시를 확인합니다.'],
 l3:['고위험 거래를 검토하고 책임집니다.','AI의 추천이 광고에 치우치지 않는지 감시합니다.','건축 안전·식품 위생 같은 안전 기준을 최신으로 유지합니다.'],
 gate:['상업적 추천 편향을 막아야 합니다. 광고와 추천을 구분해 표시해야 합니다.','건강·식이 정보는 민감하므로 본인 선택으로만 쓰고 저장은 로컬을 기본으로 합니다.','부동산 거래 책임은 자격 있는 전문가가 지는 구조를 유지해야 합니다.'],
 ref:'부동산·감정·건설·안전 4,500명(주), 식은 산업·농수산·제조 5,000명에 포함, 의(衣)는 별도 항목이 없습니다(가정). 다음 버전에서 분리 여부를 정해야 합니다.',
 ask:['주거 계약에서 사전 점검이 가장 큰 피해를 막는 항목은 무엇입니까?','식·의 분야의 L3 전문가는 어떤 자격으로 정의해야 합니까?']}
};
function ul(a, sec) { return sec ? '<ol class="steps">' + a.map(function (x, i) { return '<li><em class="sn">' + sec + '.' + (i + 1) + '</em><span>' + x + '</span></li>'; }).join('') + '</ol>' : '<ul>' + a.map(function (x) { return '<li>' + x + '</li>'; }).join('') + '</ul>'; }
function field(K) {
  var D = F[K] || F.law;
  var lay = D.layers.map(function (r, i) { return '<div class="li"><em class="sn">2.' + (i + 1) + '</em><div><b>' + r[0] + '</b><span>' + r[1] + '</span></div></div>'; }).join('');
  return '<h1><small>10만 AI 전문가 · ' + D.t + '</small>' + D.t + ' — ' + D.sub + '</h1>'
  + '<p class="lead">AI와 OpenHash 기반 재구성 초안</p><span class="meta">초안 v0.1 · 2026-11-22 · 전문가 검토 전 사고 실험이며 확정안이 아닙니다</span>'
  + '<div class="toc"><a href="#a0">요약</a><a href="#a1">현재의 문제</a><a href="#a2">재구성 구조</a><a href="#a3">일상의 흐름</a><a href="#a4">L3의 역할</a><a href="#a5">선결 과제</a><a href="#a6">개요와의 연결</a><a href="#a7">전문가에게 묻는 질문</a></div>'
  + '<section id="a0"><h2><span class="n">0</span>요약</h2><div class="callout"><p>' + D.def + '</p></div>'
  + '<div class="pipe"><span>나만의 AI 비서(나비)</span><i>→</i><span>전문가 AI</span><i>→</i><span>L3 전문가</span><i>→</i><span>인간 전문가 연결</span><i>·</i><span>OpenHash 기록</span></div>'
  + '<p class="small">모든 분야에 같은 틀을 적용합니다. 원문 기록은 본인의 PDV에만 두고, 행위 전에 AI가 점검하며, 책임은 L3 전문가가 집니다.</p></section>'
  + '<section id="a1"><h2><span class="n">1</span>현재의 문제</h2>' + ul(D.pain) + '</section>'
  + '<section id="a2"><h2><span class="n">2</span>재구성 구조</h2>' + lay + '</section>'
  + '<section id="a3"><h2><span class="n">3</span>일상의 흐름(예시)</h2>' + ul(D.flow, 3) + '</section>'
  + '<section id="a4"><h2><span class="n">4</span>L3 전문가의 역할</h2>' + ul(D.l3) + '</section>'
  + '<section id="a5"><h2><span class="n">5</span>선결 과제와 위험</h2>' + ul(D.gate) + '<p class="small">제도·자격과 관련된 항목은 해당 분야의 법령과 담당 기관의 확인이 필요합니다.</p></section>'
  + '<section id="a6"><h2><span class="n">6</span>개요와의 연결</h2><p>' + D.ref + '</p><p class="small">숫자는 개요 문서의 배분을 그대로 가져온 것이며, 이 탭에서 새로 정한 인원이 아닙니다.</p></section>'
  + '<section id="a7"><h2><span class="n">7</span>전문가에게 묻는 질문</h2>' + ul(D.ask) + '</section>';
}
function style() { if (document.getElementById('exd-style')) return; var s = document.createElement('style'); s.id = 'exd-style'; s.textContent = CSS; document.head.appendChild(s); }
function wire(host) {   // 문서 안의 #링크는 화면 안에서만 이동한다(주소의 #탭 이름을 바꾸지 않는다)
  host.onclick = function (e) { var a = e.target.closest && e.target.closest('a[href^="#"]'); if (!a) return; var t = host.querySelector('[id="' + a.getAttribute('href').slice(1) + '"]'); e.preventDefault(); if (t) t.scrollIntoView({ behavior: 'smooth', block: 'start' }); };
}
var _ov = null;
function overview(host) {
  var p = _ov || (_ov = fetch('expert100k-overview.html?v=' + Date.now()).then(function (r) { if (!r.ok) throw 0; return r.text(); }));
  return p.then(function (t) {
    var d = new DOMParser().parseFromString(t, 'text/html'), w = d.querySelector('.wrap');
    host.innerHTML = w ? w.innerHTML : '';
    var sc = d.querySelectorAll('body > script:not([src])');   // 배분 합계·막대를 그리는 문서 안 스크립트
    sc.forEach(function (x) { if (/alloc/.test(x.textContent)) { try { (new Function(x.textContent))(); } catch (e) {} } });
  }, function () { _ov = null; host.innerHTML = '<p class="st-err">문서를 불러오지 못했습니다. 잠시 뒤 다시 열어 주세요.</p>'; });
}
window.ExDoc = {
  fields: Object.keys(F),
  show: function (k, host) {
    style(); host.classList.add('exd'); wire(host);
    if (k === 'overview') return overview(host);
    host.innerHTML = field(k); return Promise.resolve();
  }
};
})();
