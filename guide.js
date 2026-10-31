/* ═════════════════════════════════════════════════
   guide.js — 사용법 단계별 안내 + 퀴즈 (desktop.html 왼쪽 메뉴 "사용법")
   2026-11-01. 기본 → 활용 → 고급 순서로 페이지를 나누고, 페이지마다 퀴즈를 모두 맞혀야 다음 페이지로 넘어간다.
   맨 위에 1 — 2 — 3 … 진행 상태를 표시한다(완료 ✓, 현재, 잠김). 진행은 이 브라우저에 저장(localStorage, 없어도 동작).
   내용 근거: manual.html(K-Mail 사용법). 수치(한도·요금)는 테스트 기간 기준이라 해당 페이지에 그렇게 적는다.
   "업무(Case)" 페이지는 기능 플래그(CaseUI.enabled)가 켜졌을 때만 끝에 붙는다.
   순수 함수(_pure)는 DOM 없이 Node 에서 테스트한다.
   ═════════════════════════════════════════════════ */
(function (root) {
  'use strict';
  var KEY = 'kmail_guide_done';

  // answer = 정답 보기의 index. hint = 틀렸을 때 보여 줄 단서(정답을 그대로 말하지 않음).
  var PAGES = [
    { level: '기본', title: '시작하기', body: [
      'K-Mail은 <b>말로 시키면 메일 일을 대신 해 주는 비서</b>입니다. 받을 사람을 찾고, 글을 쓰고, 보내기 전에 한 번 더 물어봅니다.',
      '메일 주소는 <b>메일ID@naviweb.kr</b> 형태의 <b>개인 메일</b>입니다. 회사·학교 메일을 대신하지 않습니다.',
      '접속하면 <b>테스트 아이디</b>(단어로 된 아이디)가 자동으로 만들어져 바로 써 볼 수 있습니다. 테스트 아이디에는 <b>실제 개인정보를 입력하지 마세요.</b>',
      '정식 아이디로 로그인하려면 오른쪽 위 아이디를 눌러 <b>정식 아이디로 로그인</b> → 전화번호 <b>뒷 8자리</b> 입력 → 스마트폰 알림에서 <b>본인 확인</b>을 누릅니다.'],
      quiz: [
        { q: 'K-Mail에서 내가 받는 메일 주소는 어떤 모양인가요?', opts: ['이름@회사.co.kr', '메일ID@naviweb.kr', '전화번호@hondi.net'], answer: 1, hint: '“개인 메일”이라는 설명을 다시 읽어 보세요.' },
        { q: '테스트 아이디를 쓸 때 주의할 점은?', opts: ['실제 개인정보를 입력하지 않는다', '반드시 전화 인증을 먼저 한다', '메일을 보낼 수 없다'], answer: 0, hint: '테스트 아이디 설명의 굵은 글씨를 보세요.' },
        { q: '정식 아이디 로그인에 필요한 것은?', opts: ['주민등록번호', '전화번호 뒷 8자리와 스마트폰의 본인 확인', '비밀번호 6자리'], answer: 1, hint: '입력은 번호 일부, 승인은 스마트폰에서 합니다.' }] },

    { level: '기본', title: '화면 둘러보기', body: [
      '컴퓨터에서는 <b>mail.hondi.net/desktop.html</b> 한 화면에 모든 기능이 모여 있습니다. 스마트폰용 <b>webapp.html</b>은 대화 중심으로 단순합니다.',
      '왼쪽 메뉴에서 기능을 고릅니다: <b>작성·발송</b>(새 캠페인, 빠른 발송, 메일), <b>관리</b>(주소록, 내 캠페인), <b>행정 업무</b>(정보 공개 청구).',
      '<b>설정</b>은 왼쪽 메뉴 맨 아래 톱니바퀴입니다(메일 아이디, 보내는 이름, 서명, 부재중 자동응답).',
      '<b>캠페인</b>이란 같은 목적으로 여러 사람에게 보내는 메일 한 묶음입니다. 한 명에게 보내는 메일도 같은 방식으로 기록됩니다.'],
      quiz: [
        { q: '설정(메일 아이디·서명 등)은 어디에 있나요?', opts: ['왼쪽 메뉴 맨 아래 톱니바퀴', '홈 화면 가운데', '주소록 안'], answer: 0, hint: '메뉴 아래쪽 끝을 보세요.' },
        { q: '“캠페인”의 뜻으로 맞는 것은?', opts: ['광고 전용 메일', '같은 목적으로 보내는 메일 한 묶음(한 명에게 보내는 것도 포함)', '주소록의 한 그룹'], answer: 1, hint: '한 명에게 보내는 메일도 같은 방식으로 기록됩니다.' },
        { q: '스마트폰에서 쓰는 대화 중심 화면 주소는?', opts: ['desktop.html', 'manual.html', 'webapp.html'], answer: 2, hint: '컴퓨터용이 아닌 쪽입니다.' }] },

    { level: '기본', title: '첫 메일 보내기', body: [
      '가장 추천하는 방법은 <b>새 캠페인</b>에서 <b>대화로 보내기</b>입니다. 평소 말투로 하고 싶은 일을 적으면 K-Mail이 받는 사람·제목·본문을 정리합니다.',
      '대화로 보내는 메일은 <b>항상 최종 확인</b>(받는 사람, 제목, 본문, 시각)을 보여 주고, <b>내가 “보내 주세요”라고 확인한 뒤에만</b> 나갑니다.',
      '<b>빠른 발송</b>은 확인 단계 없이 <b>입력한 그대로 즉시</b> 나가고, 받는 사람은 이메일 주소 하나만 넣을 수 있습니다.',
      '이미 보낸 메일은 <b>되돌릴 수 없습니다.</b> 보내기 전 확인 화면에서 받는 사람 주소와 날짜·금액·장소를 꼭 읽어 보세요.'],
      quiz: [
        { q: '대화로 메일을 보낼 때, 실제로 메일이 나가는 때는?', opts: ['요청을 입력하자마자', '최종 확인 화면에서 내가 보내라고 확인한 뒤', '10분 뒤 자동으로'], answer: 1, hint: '“항상 최종 확인” 항목을 보세요.' },
        { q: '빠른 발송의 특징으로 맞는 것은?', opts: ['여러 사람에게 한 번에 보낼 수 있다', '확인 단계 없이 입력한 그대로 즉시 나간다', '받은 메일함을 함께 볼 수 있다'], answer: 1, hint: '“확인 단계”가 있는지 생각해 보세요.' },
        { q: '받는 사람을 잘못 넣고 이미 보냈다면?', opts: ['보낸메일함에서 취소할 수 있다', '1시간 안에는 회수된다', '되돌릴 수 없다'], answer: 2, hint: '마지막 항목을 다시 읽어 보세요.' }] },

    { level: '기본', title: '비서와 대화하는 요령', body: [
      '한 번에 다 말하지 않아도 됩니다. <b>부족한 부분은 K-Mail이 되묻습니다.</b> 마음이 바뀌면 “받는 사람에서 박OO 님은 빼 주세요”처럼 그냥 말하면 됩니다.',
      '요청에는 <b>누구에게, 무엇을, 언제까지</b>를 넣으면 더 정확합니다. 예약도 말로 합니다(“내일 오전 9시에 보내도록 예약해 주세요”).',
      '받을 사람 주소는 <b>지어내지 않습니다.</b> 검색으로 확인한 주소만 후보로 보여 주고, 못 찾으면 못 찾았다고 말하고 나에게 묻습니다. 웹에서 찾은 주소는 한 번 더 확인하세요.',
      '웹페이지 주소를 붙여 넣으면 내용을 읽어 본문에 반영합니다. 단 <b>로그인이 필요한 페이지는 읽을 수 없습니다.</b>'],
      quiz: [
        { q: 'K-Mail이 받을 사람의 주소를 찾지 못하면?', opts: ['비슷한 주소를 지어서 보낸다', '못 찾았다고 말하고 나에게 묻는다', '메일 발송을 자동 취소한다'], answer: 1, hint: '“주소는 지어내지 않습니다.”' },
        { q: '요청을 한 번에 완벽하게 말해야 하나요?', opts: ['그렇다', '아니다, 부족하면 되묻는다', '짧게 한 단어만 말해야 한다'], answer: 1, hint: '첫 항목을 보세요.' },
        { q: '웹페이지 주소를 줬는데 내용을 못 읽는 경우는?', opts: ['로그인이 필요한 페이지', '한글로 된 페이지', '짧은 주소'], answer: 0, hint: '마지막 항목의 굵은 글씨.' }] },

    { level: '활용', title: '주소록', body: [
      '메일을 보내면 받는 사람이 <b>자동으로 주소록에 저장</b>됩니다. 이름, 이메일, 직업, 소속 기관, 메모, 관계, <b>태그</b>(묶음 이름표)를 저장할 수 있습니다.',
      '엑셀·CSV 파일에 연락처가 있다면 <b>주소록 화면에서 파일을 골라 업로드</b>하면 한꺼번에 등록됩니다.',
      '연락처가 많아지면 <b>소속 기관 트리</b>(학교 &gt; 대학 &gt; 제주대학교 &gt; 컴퓨터공학과)로 정리합니다. 소속이 비어 있는 연락처는 <b>자동 분류 마법사</b>가 경로를 제안합니다.',
      '마법사의 제안은 <b>바로 적용되지 않습니다.</b> 목록을 훑어보고 틀린 것을 고친 뒤 한꺼번에 적용합니다.'],
      quiz: [
        { q: '메일을 보낸 상대는 주소록에 어떻게 저장되나요?', opts: ['직접 입력해야 한다', '자동으로 저장된다', '저장되지 않는다'], answer: 1, hint: '첫 항목을 보세요.' },
        { q: '자동 분류 마법사의 제안은 언제 적용되나요?', opts: ['제안 즉시', '내가 검토하고 고친 뒤 한꺼번에 적용할 때', '매일 밤 자동으로'], answer: 1, hint: '마지막 항목을 보세요.' },
        { q: '이미 엑셀·CSV로 가진 연락처를 한꺼번에 넣으려면?', opts: ['주소록 화면에서 파일을 골라 업로드', '메일 본문에 붙여 넣기', '불가능하다'], answer: 0, hint: '“한꺼번에 등록” 항목.' }] },

    { level: '활용', title: '메일함과 임시보관함', body: [
      '왼쪽 메뉴 <b>메일</b> 안에 편지쓰기, 임시보관함, 보낸메일함, 받은메일함, 태그별 보관함이 있습니다.',
      '<b>임시저장</b>한 글은 임시보관함에서 <b>이어 쓰기</b>로 편지쓰기 화면에 채워집니다. 보내고 나면 임시보관함에서 사라집니다.',
      '파일은 <b>한 개당 25MB</b>까지 첨부할 수 있고, 보낸·받은 메일함은 최근 <b>최대 200건</b>을 보여 줍니다.',
      '받은 메일은 <b>메일 → 받은메일함</b>에서 봅니다(빠른 발송에는 받은 메일함이 없습니다). 받은 메일에 <b>라벨</b>을 달면 태그별 보관함에서 모아 봅니다.'],
      quiz: [
        { q: '임시저장한 글을 이어서 쓰려면?', opts: ['임시보관함에서 이어 쓰기', '보낸메일함에서 다시 보내기', '새 캠페인에서 처음부터'], answer: 0, hint: '두 번째 항목.' },
        { q: '첨부 파일은 한 개당 얼마까지 가능한가요?', opts: ['5MB', '25MB', '무제한'], answer: 1, hint: '세 번째 항목의 숫자.' },
        { q: '받은 메일을 보는 곳은?', opts: ['빠른 발송', '정보 공개 청구', '메일 → 받은메일함'], answer: 2, hint: '마지막 항목.' }] },

    { level: '활용', title: '캠페인: 여러 사람에게 보내고 답장 모으기', body: [
      '캠페인은 목적 확인 → 받을 사람 찾기 → 주소록 반영 → 발송 → 답장 모으기 → 보고 → 종료 순서로 진행합니다. 보내기를 <b>확정하는 순간</b> 기록됩니다.',
      '정한 시각까지의 답장은 <b>다이제스트</b>(요약)로 정리해 줍니다. 기관별 응답률 표나 긍정적인 답장만 모아 보기도 말로 요청합니다.',
      '본문에 <b>추적 링크</b>를 넣도록 요청하면 받은 사람이 링크를 눌렀는지 사람별로 알 수 있습니다.',
      '<b>내 캠페인</b>에서 제목으로 검색하고, <b>이어서 대화하기</b>를 누르면 정리된 핵심(받는 사람·제목·본문)만 불러와 빠르게 이어갑니다.'],
      quiz: [
        { q: '여러 답장을 한데 모아 정리한 요약을 무엇이라 부르나요?', opts: ['라벨', '다이제스트', '태그'], answer: 1, hint: '두 번째 항목의 굵은 글씨.' },
        { q: '받은 사람이 링크를 눌렀는지 알려면?', opts: ['본문에 추적 링크를 넣도록 요청한다', '받은메일함을 확인한다', '알 방법이 없다'], answer: 0, hint: '세 번째 항목.' },
        { q: '예전 캠페인을 빠르게 이어가려면?', opts: ['내 캠페인에서 이어서 대화하기', '새 캠페인을 열고 처음부터 설명', '보낸메일함에서 복사'], answer: 0, hint: '마지막 항목.' }] },

    { level: '활용', title: '설정: 메일 아이디·보내는 이름·자동응답', body: [
      '메일 아이디는 <b>3~30자, 영문 소문자·숫자·하이픈(-)·밑줄(_)</b>만 쓸 수 있고(한글·대문자·숫자만으로는 불가), 영문 또는 숫자로 시작하고 끝나야 합니다. 시스템을 사칭할 수 있는 이름은 쓸 수 없습니다.',
      '아이디는 <b>30일에 3번</b>까지 바꿀 수 있습니다. 바꾸면 <b>이전 아이디로는 받을 수 없습니다.</b>',
      '<b>보내는 이름</b>을 정하면 “도 영민 &lt;아이디@naviweb.kr&gt;”처럼 보입니다. 바꾸면 <b>이후에 보내는 메일부터</b> 적용됩니다. <b>서명</b>은 본문 끝에 자동으로 붙습니다.',
      '<b>부재중 자동응답</b>은 같은 사람에게 <b>24시간에 한 번</b>만 보냅니다. 마지막 날을 정하면 그날 밤 11시 59분(한국 시간)까지만 보냅니다.'],
      quiz: [
        { q: '메일 아이디로 쓸 수 있는 것은?', opts: ['한글 이름', '영문 소문자·숫자·하이픈·밑줄', '대문자와 공백'], answer: 1, hint: '첫 항목의 규칙.' },
        { q: '아이디는 얼마나 자주 바꿀 수 있나요?', opts: ['30일에 3번까지', '하루에 3번까지', '한 번도 바꿀 수 없다'], answer: 0, hint: '두 번째 항목.' },
        { q: '부재중 자동응답은 같은 사람에게 얼마나 자주 가나요?', opts: ['메일마다 매번', '1시간에 한 번', '24시간에 한 번'], answer: 2, hint: '마지막 항목.' }] },

    { level: '고급', title: '정보 공개 청구', body: [
      '공공기관이 가진 자료를 법에 따라 요청하는 절차를 도와 줍니다. 왼쪽 메뉴 <b>정보 공개 청구</b>에는 새 청구서, 내 청구 건, 공유 아카이브, 안내가 있습니다.',
      '청구하기 전에 K-Mail이 <b>이미 얻을 수 있는 정보</b>(공유 아카이브, 웹에 공개된 자료)를 먼저 찾아 보여 주고, 그래도 없는 것만 청구 항목으로 채웁니다.',
      '보관한 청구 건은 공유 아카이브에 공개할지 <b>선택</b>합니다. 선택하지 않으면 <b>비공개</b>입니다.',
      '청구 목적에 “SP”·“프롬프트” 같은 내부 용어는 쓰지 말고, <b>개인정보는 넣지 마세요.</b>'],
      quiz: [
        { q: '청구서를 만들기 전에 K-Mail이 먼저 하는 일은?', opts: ['곧바로 기관에 발송', '이미 얻을 수 있는 정보가 있는지 찾아 보여 준다', '내 주소록을 공개한다'], answer: 1, hint: '두 번째 항목.' },
        { q: '보관한 청구 건을 공유 아카이브에 공개하지 않으면?', opts: ['자동으로 공개된다', '비공개로 남는다', '삭제된다'], answer: 1, hint: '세 번째 항목.' },
        { q: '청구 목적에 넣으면 안 되는 것은?', opts: ['개인정보', '알고 싶은 내용', '청구 기관 이름'], answer: 0, hint: '마지막 항목.' }] },

    { level: '고급', title: '자동 규칙·위임 규칙과 안전하게 쓰기', body: [
      '자동 삭제·부재중 답장 같은 규칙은 말로 설정할 수 있습니다. 자동 삭제는 되돌리기 어려우니 <b>처음에는 범위를 좁게</b> 정하세요.',
      '<b>위임 규칙</b>(“이런 요청이면 내 확인 없이 알아서 답장해”)은 편리하지만 K-Mail이 나 대신 답장을 보내게 됩니다. <b>익숙해진 뒤에</b>, <b>구체적이고 좁게</b> 만드세요. 금액·계약·확정적인 약속이 걸린 일은 규칙 밖에 두세요.',
      '발송 한도(테스트 기간 기준): 이번 1통을 포함한 <b>최근 5일 평균이 하루 100통</b>을 넘으면 초과분은 <b>1통당 10 GDC</b>가 부과됩니다. 발송이 막히지는 않습니다.',
      '비밀번호·주민등록번호·카드 번호 같은 <b>민감한 정보는 메일 본문에 넣지 마세요.</b>'],
      quiz: [
        { q: '위임 규칙은 언제 만드는 것이 좋나요?', opts: ['처음 시작할 때 바로', '대화 방식에 충분히 익숙해진 뒤, 구체적이고 좁게', '금액이 걸린 일부터'], answer: 1, hint: '두 번째 항목.' },
        { q: '발송 한도를 넘으면 어떻게 되나요?', opts: ['발송이 막힌다', '초과분에 1통당 10 GDC가 부과되고 발송은 막히지 않는다', '계정이 삭제된다'], answer: 1, hint: '세 번째 항목.' },
        { q: '메일 본문에 넣으면 안 되는 것은?', opts: ['행사 날짜', '비밀번호·카드 번호 같은 민감한 정보', '회의 장소'], answer: 1, hint: '마지막 항목.' }] },

    // 기능 플래그(CaseUI.enabled)가 켜졌을 때만 붙는 페이지
    { level: '고급', title: '업무(Case): 맡은 일 · 맡긴 일 · 나 홀로', flag: 'case', body: [
      '<b>업무</b>는 한 건의 일을 처음부터 끝까지 담는 그릇입니다. 세 관점이 있습니다: <b>맡은 일</b>(내가 서비스 제공자로 맡은 일), <b>맡긴 일</b>(내가 전문가에게 맡긴 일), <b>나 홀로</b>(내가 나 자신의 일을 직접 처리).',
      '모든 기록은 <b>이 기기에만</b> 저장되고, 네트워크에는 <b>해시(지문)만</b> 기록됩니다. 진행 기록은 한번 쓰면 고치지 않고 정정은 새 항목으로 남기며, 화면에서 무결성을 확인할 수 있습니다.',
      '<b>소통 이력</b>에는 누가·누구와·언제·어디서·어떻게·무엇을·왜를 기록합니다. 대면은 장소가 필수입니다.',
      '맡은 일·맡긴 일은 상대방이 확인해야 합의가 완료되고, 상대에게 <b>공유</b>로 표시한 항목만 상대 화면에 보입니다. 나 홀로는 합의 없이 시작하고 결과를 적으면 스스로 종료합니다.'],
      quiz: [
        { q: '“나 홀로”는 어떤 경우인가요?', opts: ['전문가에게 일을 맡긴 경우', '한 사람이 스스로 공급자이자 소비자인 경우(예: 본인 소송)', '여러 명이 함께 하는 경우'], answer: 1, hint: '첫 항목의 세 번째 관점.' },
        { q: '업무 기록은 어디에 저장되나요?', opts: ['서버에 전부 저장', '이 기기에만 저장하고 네트워크에는 해시만 기록', '메일로 전송'], answer: 1, hint: '두 번째 항목.' },
        { q: '맡은 일에서 상대에게 보이는 기록은?', opts: ['모든 기록', '공유로 표시한 항목만', '소통 이력만'], answer: 1, hint: '마지막 항목.' }] },
  ];

  // 정답 위치를 고르게 분산한다(찍기 방지). 보기를 순환 이동해 문항 번호 % 3 위치에 정답이 오게 한다 — 결정적이라 매번 같다.
  (function balance() {
    var n = 0;
    PAGES.forEach(function (p) { p.quiz.forEach(function (q) {
      var target = (n++) % q.opts.length, shift = (target - q.answer + q.opts.length) % q.opts.length;
      if (shift) { q.opts = q.opts.slice(q.opts.length - shift).concat(q.opts.slice(0, q.opts.length - shift)); q.answer = target; }
    }); });
  })();

  // ── 순수 함수 ───────────────────────────────────────────
  function pages(caseOn) { return PAGES.filter(function (p) { return !p.flag || (p.flag === 'case' && caseOn); }); }
  // answers: 문항별 선택 index(없으면 null). 반환 { ok:[bool], all:boolean }
  function grade(page, answers) {
    var ok = page.quiz.map(function (q, i) { return answers && answers[i] === q.answer; });
    return { ok: ok, all: ok.every(Boolean) };
  }
  // done = 통과한 페이지 수. 열람 가능한 최대 index = done (다음 한 페이지까지).
  function canOpen(done, idx, total) { return idx >= 0 && idx < total && idx <= done; }
  function clampDone(n, total) { n = parseInt(n, 10); return isFinite(n) && n > 0 ? Math.min(n, total) : 0; }
  function nextAfterPass(idx, total) { return idx + 1 < total ? idx + 1 : -1; }   // -1 = 마지막(완료 화면)

  // ── 화면 ───────────────────────────────────────────────
  var S = { idx: null, done: 0, answers: {}, result: null, timer: null };   // idx null = 아직 화면을 연 적 없음
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function $(id) { return document.getElementById(id); }
  function caseOn() { try { return !!(root.CaseUI && root.CaseUI.enabled()); } catch (_) { return false; } }
  function load() { try { return parseInt(localStorage.getItem(KEY) || '0', 10) || 0; } catch (_) { return 0; } }
  function save(n) { try { localStorage.setItem(KEY, String(n)); } catch (_) { /* 저장 불가여도 계속 */ } }

  function render() {
    var el = $('tab-guide'); if (!el) return;
    var list = pages(caseOn()), total = list.length;
    S.done = clampDone(Math.max(S.done, load()), total);
    if (S.idx >= total) S.idx = total - 1;
    var finished = S.done >= total && S.idx === -1;
    var steps = list.map(function (p, i) {
      var st = i < S.done ? 'done' : (i === S.idx ? 'cur' : (i === S.done ? 'next' : 'lock'));
      if (i === S.idx) st = (i < S.done ? 'done cur' : 'cur');
      var can = canOpen(S.done, i, total);
      return '<button class="gd-step ' + st + '" ' + (can ? '' : 'disabled ') + 'data-act="go" data-i="' + i + '" aria-label="' + (i + 1) + '단계 ' + esc(p.title) + (i < S.done ? ' (완료)' : can ? '' : ' (잠김)') + '"' + (i === S.idx ? ' aria-current="step"' : '') + '>' + (i < S.done ? '✓' : (i + 1)) + '</button>';
    }).join('<span class="gd-bar' + '"></span>');
    var head = '<div class="gd-top"><div class="gd-steps" role="navigation" aria-label="사용법 진행 상태">' + steps + '</div>' +
      '<div class="gd-prog">' + S.done + ' / ' + total + ' 단계 완료</div></div>';

    if (S.idx === -1) {
      el.innerHTML = head + '<div class="gd-card gd-end"><h2>🎉 모든 단계를 마쳤습니다</h2><p>이제 K-Mail의 기본부터 고급 기능까지 알게 되셨습니다. 궁금한 점은 전체 사용법 문서에서 찾아볼 수 있습니다.</p>' +
        '<p><a class="gd-btn gd-pri" href="manual.html" target="_blank" rel="noopener">전체 사용법 문서 열기</a> <button class="gd-btn" data-act="restart">처음부터 다시 보기</button></p></div>';
      return;
    }
    var p = list[S.idx], res = S.result, locked = S.idx < S.done;
    var quiz = p.quiz.map(function (q, qi) {
      var r = res ? res.ok[qi] : null, sel = S.answers[qi];
      return '<fieldset class="gd-q ' + (r === true ? 'ok' : r === false ? 'bad' : '') + '"><legend>Q' + (qi + 1) + '. ' + esc(q.q) + '</legend>' +
        q.opts.map(function (o, oi) {
          return '<label class="gd-o"><input type="radio" name="gd-q' + qi + '" value="' + oi + '" data-act="pick" data-q="' + qi + '" ' + (sel === oi ? 'checked ' : '') + '> ' + esc(o) + '</label>';
        }).join('') +
        (r === true ? '<div class="gd-fb ok">✓ 정답입니다</div>' : r === false ? '<div class="gd-fb bad">✗ 다시 생각해 보세요 — ' + esc(q.hint) + '</div>' : '') + '</fieldset>';
    }).join('');
    var allPicked = p.quiz.every(function (q, i) { return S.answers[i] != null; });
    var foot;
    if (res && res.all) foot = '<div class="gd-pass" role="status">🎉 모두 맞혔습니다! ' + (nextAfterPass(S.idx, total) >= 0 ? '곧 다음 페이지로 이동합니다…' : '마지막 단계를 마쳤습니다…') + '</div>' +
      '<button class="gd-btn gd-pri" data-act="advance">' + (nextAfterPass(S.idx, total) >= 0 ? '다음 페이지로 →' : '완료') + '</button>';
    else foot = '<button class="gd-btn gd-pri" data-act="check" ' + (allPicked ? '' : 'disabled') + '>정답 확인</button>' +
      (locked ? ' <button class="gd-btn" data-act="advance">다음 페이지로 →</button>' : '') +
      (res && !res.all ? '<span class="gd-sub"> 틀린 문제를 고쳐서 다시 확인하세요.</span>' : (allPicked ? '' : '<span class="gd-sub"> 모든 문제에 답하면 확인할 수 있습니다.</span>'));
    el.innerHTML = head + '<div class="gd-card"><div class="gd-lv gd-lv-' + esc(p.level) + '">' + esc(p.level) + '</div>' +
      '<h2 class="gd-h">' + (S.idx + 1) + '. ' + esc(p.title) + '</h2><ul class="gd-body">' + p.body.map(function (b) { return '<li>' + b + '</li>'; }).join('') + '</ul></div>' +
      '<div class="gd-card"><h3 class="gd-qh">확인 퀴즈 <span class="gd-sub">(모두 맞히면 다음 페이지로 넘어갑니다)</span></h3>' + quiz + '<div class="gd-foot">' + foot + '</div></div>' +
      '<div class="gd-sub gd-nav">' + (S.idx > 0 ? '<button class="gd-link" data-act="go" data-i="' + (S.idx - 1) + '">← 이전 페이지</button>' : '') + '</div>';
  }

  function go(i) { var total = pages(caseOn()).length; if (!canOpen(S.done, i, total)) return; clearTimeout(S.timer); S.idx = i; S.answers = {}; S.result = null; render(); window.scrollTo && $('tab-guide') && $('tab-guide').scrollIntoView && $('tab-guide').scrollIntoView({ block: 'start' }); }
  function passAndAdvance() {
    var total = pages(caseOn()).length;
    if (S.idx >= S.done) { S.done = Math.min(S.idx + 1, total); save(S.done); }
    var n = nextAfterPass(S.idx, total);
    clearTimeout(S.timer); S.answers = {}; S.result = null; S.idx = n; render();
  }
  function el0() { return $('tab-guide'); }
  function onClick(ev) {
    var t = ev.target.closest('[data-act]'); if (!t) return;
    var act = t.getAttribute('data-act'), list = pages(caseOn()), p = list[S.idx];
    if (act === 'pick') {   // 전체를 다시 그리지 않는다 — 키보드(화살표) 선택이 끊기지 않게 필요한 부분만 갱신
      S.answers[+t.getAttribute('data-q')] = +t.value; S.result = null;
      el0().querySelectorAll('fieldset.gd-q').forEach(function (f) { f.className = 'gd-q'; var fb = f.querySelector('.gd-fb'); if (fb) fb.remove(); });   // 결과 표시는 한꺼번에 지운다
      var all = p.quiz.every(function (q, i) { return S.answers[i] != null; }), ck = el0().querySelector('[data-act=check]');
      if (ck) ck.disabled = !all;
      var sub = el0().querySelector('.gd-foot .gd-sub'); if (sub) sub.textContent = all ? ' 정답 확인을 눌러 주세요.' : ' 모든 문제에 답하면 확인할 수 있습니다.';
    }
    else if (act === 'check') {
      S.result = grade(p, S.answers); render();
      if (S.result.all) { clearTimeout(S.timer); S.timer = setTimeout(passAndAdvance, 1600); }
    }
    else if (act === 'advance') { if (S.result && S.result.all) passAndAdvance(); else if (S.idx < S.done) go(S.idx + 1); }
    else if (act === 'go') go(+t.getAttribute('data-i'));
    else if (act === 'restart') { S.idx = 0; S.answers = {}; S.result = null; render(); }
  }
  function show() {
    var el = $('tab-guide'); if (!el) return;
    if (!el.__gdBound) { el.__gdBound = true; el.addEventListener('click', onClick); }
    var total = pages(caseOn()).length; S.done = clampDone(load(), total);
    // 처음 열면 이어서 할 곳(첫 미완료 페이지)으로, 모두 마쳤으면 완료 화면으로. 이미 보던 중이면 그 자리 유지.
    if (S.idx === null) S.idx = S.done >= total ? -1 : S.done;
    else if (S.idx > S.done && S.idx !== -1) S.idx = Math.min(S.done, total - 1);
    render();
  }

  root.GuideUI = { show: show, _pure: { PAGES: PAGES, pages: pages, grade: grade, canOpen: canOpen, clampDone: clampDone, nextAfterPass: nextAfterPass }, _state: S };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.GuideUI;
})(typeof window !== 'undefined' ? window : globalThis);
