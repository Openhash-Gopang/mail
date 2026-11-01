/* ═════════════════════════════════════════════════
   guide.js — 사용법 단계별 안내 + 퀴즈 (desktop.html 왼쪽 메뉴 "사용법")
   2026-11-01. 기본 → 활용 → 고급 순서로 페이지를 나누고, 페이지마다 퀴즈를 모두 맞혀야 다음 페이지로 넘어간다.
   맨 위에 1 — 2 — 3 … 진행 상태를 표시한다(완료 ✓, 현재, 잠김). 진행은 이 브라우저에 저장(localStorage, 없어도 동작).
   내용 근거: manual.html(나비웹 사용 설명서, 2026-11-02 개정). 수치(한도·요금)는 테스트 기간 기준이라 해당 페이지에 그렇게 적는다.
   "업무(Case)" 페이지는 기능 플래그(CaseUI.enabled)가 켜졌을 때만 끝에 붙는다.
   순수 함수(_pure)는 DOM 없이 Node 에서 테스트한다.
   ═════════════════════════════════════════════════ */
(function (root) {
  'use strict';
  var KEY = 'kmail_guide_done';

  // answer = 정답 보기의 index. hint = 틀렸을 때 보여 줄 단서(정답을 그대로 말하지 않음).
  var PAGES = [
    { level: '기본', title: '시작하기', body: [
      '나비웹은 <b>말로 시키면 일을 대신 챙겨 주는 비서</b>입니다. 입력창 하나에 하고 싶은 일을 적으면 <b>나만의 AI 비서</b>가 메일·서류·전문가 상담 중 알맞은 곳으로 이어 줍니다. 메일은 받을 사람을 찾고 글을 쓴 뒤 보내기 전에 한 번 더 물어봅니다.',
      '메일 주소는 <b>메일ID@naviweb.kr</b> 형태의 <b>개인 메일</b>입니다. 회사·학교 메일을 대신하지 않습니다.',
      '<b>naviweb.kr</b>로 접속하면 컴퓨터는 컴퓨터 화면, 스마트폰은 스마트폰 화면이 자동으로 열립니다. 접속하면 <b>테스트 아이디</b>(단어로 된 아이디)가 자동으로 만들어져 바로 써 볼 수 있습니다. 테스트 아이디에는 <b>실제 개인정보를 입력하지 마세요.</b>',
      '정식 아이디로 로그인하려면 오른쪽 위 아이디를 눌러 <b>정식 아이디로 로그인</b> → 전화번호 <b>뒷 8자리</b> 입력 → 스마트폰 알림에서 <b>본인 확인</b>을 누릅니다.'],
      quiz: [
        { q: '나비웹에서 내가 받는 메일 주소는 어떤 모양인가요?', opts: ['이름@회사.co.kr', '메일ID@naviweb.kr', '전화번호@hondi.net'], answer: 1, hint: '“개인 메일”이라는 설명을 다시 읽어 보세요.' },
        { q: '테스트 아이디를 쓸 때 주의할 점은?', opts: ['실제 개인정보를 입력하지 않는다', '반드시 전화 인증을 먼저 한다', '메일을 보낼 수 없다'], answer: 0, hint: '테스트 아이디 설명의 굵은 글씨를 보세요.' },
        { q: '정식 아이디 로그인에 필요한 것은?', opts: ['주민등록번호', '전화번호 뒷 8자리와 스마트폰의 본인 확인', '비밀번호 6자리'], answer: 1, hint: '입력은 번호 일부, 승인은 스마트폰에서 합니다.' }] },

    { level: '기본', title: '화면 둘러보기', body: [
      '컴퓨터에서는 한 화면에 모든 기능이 모여 있습니다. 가운데 <b>입력창</b>에 말로 시작하고, 왼쪽 메뉴에서 <b>서류</b>(서류 작성·Draft·작성한 서류), <b>메일</b>(빠른 발송·내 캠페인·주소록·편지쓰기·보낸/받은메일함), <b>정보 공개 청구</b>, <b>사용법</b>을 고릅니다.',
      '입력창 왼쪽의 <b>모드 표시(칩)</b>는 지금 어느 비서와 대화 중인지 보여 줍니다. 칩의 <b>×</b>를 누르면 기본 비서인 <b>나만의 AI 비서</b>로 돌아옵니다. <b>✉ 메일 아이콘</b>으로 편지 작성·캠페인을 직접 고를 수도 있습니다.',
      '<b>설정</b>은 왼쪽 메뉴 맨 아래 톱니바퀴입니다(메일 아이디, 보내는 이름, 서명, 부재중 자동응답). 오른쪽 아래 <b>💬</b>는 사람과 직접 대화하는 혼디 대화 패널입니다.',
      '<b>캠페인</b>이란 같은 목적으로 여러 사람에게 보내는 메일 한 묶음입니다. 한 명에게 보내는 메일도 같은 방식으로 기록됩니다.'],
      quiz: [
        { q: '설정(메일 아이디·서명 등)은 어디에 있나요?', opts: ['왼쪽 메뉴 맨 아래 톱니바퀴', '홈 화면 가운데', '주소록 안'], answer: 0, hint: '메뉴 아래쪽 끝을 보세요.' },
        { q: '입력창 왼쪽 모드 표시(칩)의 ×를 누르면?', opts: ['대화가 모두 삭제된다', '기본 비서인 나만의 AI 비서로 돌아온다', '메일이 즉시 발송된다'], answer: 1, hint: '두 번째 항목.' },
        { q: '“캠페인”의 뜻으로 맞는 것은?', opts: ['광고 전용 메일', '같은 목적으로 보내는 메일 한 묶음(한 명에게 보내는 것도 포함)', '주소록의 한 그룹'], answer: 1, hint: '한 명에게 보내는 메일도 같은 방식으로 기록됩니다.' }] },

    { level: '기본', title: '나만의 AI 비서와 대화하기', body: [
      '입력창의 말은 먼저 <b>나만의 AI 비서</b>가 읽습니다. 메일이면 <b>메일</b>로, 서류 작성이면 <b>서류 작성</b>으로, 증상 같은 상담이면 <b>전문가 상담</b>으로 이어 주고, 이어 줄 곳이 없으면 직접 답합니다. 이어 줄 때는 “○○로 연결했습니다”가 나옵니다.',
      '메일인지 서류인지 정말 모를 때만 <b>선택 버튼</b>으로 되묻고, 한 번의 요청에서 <b>최대 2번</b>까지만 묻습니다. 선택지에는 항상 <b>“그냥 대화로 계속”</b>이 있습니다.',
      '비서에게 맡기지 않고 ✉ 메일 아이콘이나 서류 종류 줄에서 <b>직접 고를</b> 수도 있습니다. 어느 쪽이든 메일 발송 전 최종 확인 같은 안전장치는 그대로입니다.',
      '비서는 <b>지어내지 않습니다.</b> 확인된 주소만 후보로 보여 주고, 점검하지 못한 일을 점검했다고 말하지 않습니다.'],
      quiz: [
        { q: '메일인지 서류인지 애매할 때 비서는 한 번의 요청에서 몇 번까지 되묻나요?', opts: ['최대 2번', '횟수 제한 없이', '절대 묻지 않는다'], answer: 0, hint: '두 번째 항목의 굵은 글씨.' },
        { q: '비서가 이어 줄 곳이 없는 평범한 질문을 받으면?', opts: ['오류를 내고 멈춘다', '비서가 직접 답한다', '자동으로 메일을 보낸다'], answer: 1, hint: '첫 항목 끝부분.' },
        { q: '입력창 왼쪽의 칩(모드 표시)이 알려 주는 것은?', opts: ['지금 어느 비서와 대화 중인지', '남은 발송 한도', '받은 메일 수'], answer: 0, hint: '이전 페이지의 칩 설명을 떠올려 보세요.' }] },

    { level: '기본', title: '첫 메일 보내기', body: [
      '가장 추천하는 방법은 입력창에서 <b>대화로 보내기</b>입니다. 평소 말투로 하고 싶은 일을 적으면 비서가 메일로 이어 주고 받는 사람·제목·본문을 정리합니다(✉ 메일 아이콘에서 편지 작성·캠페인을 먼저 골라도 됩니다).',
      '대화로 보내는 메일은 <b>항상 최종 확인</b>(받는 사람, 제목, 본문, 시각)을 보여 주고, <b>내가 “보내 주세요”라고 확인한 뒤에만</b> 나갑니다.',
      '<b>빠른 발송</b>(메일 메뉴 안)은 확인 단계 없이 <b>입력한 그대로 즉시</b> 나가고, 받는 사람은 이메일 주소 하나만 넣을 수 있습니다.',
      '이미 보낸 메일은 <b>되돌릴 수 없습니다.</b> 보내기 전 확인 화면에서 받는 사람 주소와 날짜·금액·장소를 꼭 읽어 보세요.'],
      quiz: [
        { q: '대화로 메일을 보낼 때, 실제로 메일이 나가는 때는?', opts: ['요청을 입력하자마자', '최종 확인 화면에서 내가 보내라고 확인한 뒤', '10분 뒤 자동으로'], answer: 1, hint: '“항상 최종 확인” 항목을 보세요.' },
        { q: '빠른 발송의 특징으로 맞는 것은?', opts: ['여러 사람에게 한 번에 보낼 수 있다', '확인 단계 없이 입력한 그대로 즉시 나간다', '받은 메일함을 함께 볼 수 있다'], answer: 1, hint: '“확인 단계”가 있는지 생각해 보세요.' },
        { q: '받는 사람을 잘못 넣고 이미 보냈다면?', opts: ['보낸메일함에서 취소할 수 있다', '1시간 안에는 회수된다', '되돌릴 수 없다'], answer: 2, hint: '마지막 항목을 다시 읽어 보세요.' }] },

    { level: '기본', title: '비서와 대화하는 요령', body: [
      '한 번에 다 말하지 않아도 됩니다. <b>부족한 부분은 비서가 되묻습니다.</b> 마음이 바뀌면 “받는 사람에서 박OO 님은 빼 주세요”처럼 그냥 말하면 됩니다.',
      '요청에는 <b>누구에게, 무엇을, 언제까지</b>를 넣으면 더 정확합니다. 예약도 말로 합니다(“내일 오전 9시에 보내도록 예약해 주세요”).',
      '받을 사람 주소는 <b>지어내지 않습니다.</b> 검색으로 확인한 주소만 후보로 보여 주고, 못 찾으면 못 찾았다고 말하고 나에게 묻습니다. 웹에서 찾은 주소는 한 번 더 확인하세요.',
      '웹페이지 주소를 붙여 넣으면 내용을 읽어 본문에 반영합니다. 단 <b>로그인이 필요한 페이지는 읽을 수 없습니다.</b>'],
      quiz: [
        { q: '비서가 받을 사람의 주소를 찾지 못하면?', opts: ['비슷한 주소를 지어서 보낸다', '못 찾았다고 말하고 나에게 묻는다', '메일 발송을 자동 취소한다'], answer: 1, hint: '“주소는 지어내지 않습니다.”' },
        { q: '요청을 한 번에 완벽하게 말해야 하나요?', opts: ['그렇다', '아니다, 부족하면 되묻는다', '짧게 한 단어만 말해야 한다'], answer: 1, hint: '첫 항목을 보세요.' },
        { q: '웹페이지 주소를 줬는데 내용을 못 읽는 경우는?', opts: ['로그인이 필요한 페이지', '한글로 된 페이지', '짧은 주소'], answer: 0, hint: '마지막 항목의 굵은 글씨.' }] },

    { level: '활용', title: '서류 작성', body: [
      '칸이 있는 <b>서식 서류</b>(신청서·고소장·계약서·진단서 등)를 대화로 작성합니다. 분야는 <b>법률 · 세무·회계 · 병원·의원 · 전체</b>가 있습니다. 홈 입력창에 “소유권이전등기 신청서 작성해 줘”처럼 말하거나, 왼쪽 <b>서류 → 서류 작성</b>에서 서류 종류를 직접 고릅니다.',
      '필요한 정보를 하나씩 물어보고 답하는 대로 칸이 채워지며, 내 정보에 저장해 둔 이름·주소 같은 값은 <b>내 정보 칸</b>으로 자동으로 들어갑니다. <b>📎 첨부</b>한 자료는 읽어서 칸을 채우는 데 씁니다.',
      '쓰다가 다른 화면으로 나가면 <b>Draft</b>로 <b>이 기기에 자동 저장</b>됩니다. 다 쓰면 <b>작성 완료로 저장</b>을 눌러 Word 파일로 받고 <b>작성한 서류</b>에 보관하며, 메일에 첨부해 보낼 수 있습니다.',
      '비서가 만든 서류는 <b>초안</b>입니다. 제출하기 전에 내용과 법적 요건을 직접 확인하세요.'],
      quiz: [
        { q: '서류를 쓰다가 다른 화면으로 나가면?', opts: ['모두 사라진다', 'Draft로 이 기기에 자동 저장된다', '서버가 자동으로 제출한다'], answer: 1, hint: '세 번째 항목.' },
        { q: '다 쓴 서류를 Word 파일로 받고 보관하는 버튼은?', opts: ['작성 완료로 저장', '새 캠페인', '빠른 발송'], answer: 0, hint: '세 번째 항목의 굵은 글씨.' },
        { q: '비서가 만든 서류를 제출하기 전에 해야 할 일은?', opts: ['아무것도 하지 않는다', '내용과 법적 요건을 직접 확인한다', '다른 사람에게 메일로 보낸다'], answer: 1, hint: '마지막 항목.' }] },

    { level: '활용', title: '작성한 서류를 대화로 고치기', body: [
      '서류를 다 만든 뒤에는 칸을 하나씩 누르지 않고 <b>말로 고칠</b> 수 있습니다. 입력창(또는 오른쪽 💬 패널)에 “신청 사유를 더 정중하게 고쳐 줘”처럼 적으면, 나만의 AI 비서가 <b>어느 칸을 고칠지</b>만 정하고 <b>서류를 작성한 전문 비서가 값을 씁니다.</b>',
      '바뀐 칸은 <b>강조와 “SP” 배지</b>로 표시되고, 대화 창에 <b>이전 값 → 새 값</b> 카드가 나옵니다. 마음에 들지 않으면 카드의 <b>되돌리기</b>를 누릅니다.',
      '<b>내가 직접 쓴 칸</b>은 보호됩니다. “<b>매매대금</b>을 바꿔 줘”처럼 <b>칸 이름을 말했을 때만</b> 바로 고치고, 말하지 않은 칸은 <b>“바꿀까요?”</b>라고 물어 <b>바꾸기 / 그대로 두기</b>를 고르게 합니다.',
      '<b>칸이 있는 서식 서류</b>만, <b>다 만든 뒤에</b>, <b>컴퓨터에서</b> 됩니다. 한 번에 최대 12칸까지 고치고, 주민등록번호·카드번호·민감 항목 값은 비서에게 보내지 않습니다.'],
      quiz: [
        { q: '비서가 서류 칸을 고치고 나서 되돌리고 싶다면?', opts: ['되돌릴 수 없다', '카드의 되돌리기를 누른다', '서류를 새로 만든다'], answer: 1, hint: '두 번째 항목.' },
        { q: '내가 직접 쓴 칸을 말로 지목하지 않았는데 비서가 바꾸려 하면?', opts: ['말없이 바꾼다', '“바꿀까요?”라고 물어 내가 고르게 한다', '서류를 삭제한다'], answer: 1, hint: '세 번째 항목.' },
        { q: '이 기능이 지원하는 서류는?', opts: ['칸이 있는 서식 서류(다 만든 뒤)', '모든 글', '스마트폰에서 쓴 글만'], answer: 0, hint: '마지막 항목.' }] },

    { level: '활용', title: '주소록', body: [
      '메일을 보내면 받는 사람이 <b>자동으로 주소록에 저장</b>됩니다. 이름, 이메일, 직업, 소속 기관, 메모, 관계, <b>태그</b>(묶음 이름표)를 저장할 수 있습니다.',
      '엑셀·CSV 파일에 연락처가 있다면 <b>주소록 화면에서 파일을 골라 업로드</b>하면 한꺼번에 등록됩니다.',
      '연락처가 많아지면 <b>소속 기관 트리</b>(학교 &gt; 대학 &gt; 제주대학교 &gt; 컴퓨터공학과)로 정리합니다. 소속이 비어 있는 연락처는 <b>자동 분류 마법사</b>가 경로를 제안합니다.',
      '마법사의 제안은 <b>바로 적용되지 않습니다.</b> 목록을 훑어보고 틀린 것을 고친 뒤 한꺼번에 적용합니다.'],
      quiz: [
        { q: '메일을 보낸 상대는 주소록에 어떻게 저장되나요?', opts: ['직접 입력해야 한다', '자동으로 저장된다', '저장되지 않는다'], answer: 1, hint: '첫 항목을 보세요.' },
        { q: '자동 분류 마법사의 제안은 언제 적용되나요?', opts: ['제안 즉시', '내가 검토하고 고친 뒤 한꺼번에 적용할 때', '매일 밤 자동으로'], answer: 1, hint: '마지막 항목을 보세요.' },
        { q: '이미 엑셀·CSV로 가진 연락처를 한꺼번에 넣으려면?', opts: ['주소록 화면에서 파일을 골라 업로드', '메일 본문에 붙여 넣기', '불가능하다'], answer: 0, hint: '“한꺼번에 등록” 항목.' }] },

    { level: '활용', title: '메일함과 Draft', body: [
      '왼쪽 메뉴 <b>메일</b> 안에 편지쓰기, Draft(임시보관함), 보낸메일함, 받은메일함, 태그별 보관함이 있습니다.',
      '<b>임시저장</b>한 글은 Draft에서 <b>이어 쓰기</b>로 편지쓰기 화면에 채워집니다. 보내고 나면 Draft에서 사라집니다.',
      '파일은 <b>한 개당 25MB</b>까지 첨부할 수 있고, 보낸·받은 메일함은 최근 <b>최대 200건</b>을 보여 줍니다.',
      '받은 메일은 <b>메일 → 받은메일함</b>에서 봅니다(빠른 발송에는 받은 메일함이 없습니다). 받은 메일에 <b>라벨</b>을 달면 태그별 보관함에서 모아 봅니다.'],
      quiz: [
        { q: '임시저장한 메일을 이어서 쓰려면?', opts: ['Draft에서 이어 쓰기', '보낸메일함에서 다시 보내기', '새 캠페인에서 처음부터'], answer: 0, hint: '두 번째 항목.' },
        { q: '첨부 파일은 한 개당 얼마까지 가능한가요?', opts: ['5MB', '25MB', '무제한'], answer: 1, hint: '세 번째 항목의 숫자.' },
        { q: '받은 메일을 보는 곳은?', opts: ['빠른 발송', '정보 공개 청구', '메일 → 받은메일함'], answer: 2, hint: '마지막 항목.' }] },

    { level: '활용', title: '캠페인: 여러 사람에게 보내고 답장 모으기', body: [
      '캠페인은 목적 확인 → 받을 사람 찾기 → 주소록 반영 → 발송 → 답장 모으기 → 보고 → 종료 순서로 진행합니다. 보내기를 <b>확정하는 순간</b> 기록됩니다.',
      '정한 시각까지의 답장은 <b>다이제스트</b>(요약)로 정리해 줍니다. 기관별 응답률 표나 긍정적인 답장만 모아 보기도 말로 요청합니다.',
      '본문에 <b>추적 링크</b>를 넣도록 요청하면 받은 사람이 링크를 눌렀는지 사람별로 알 수 있습니다.',
      '<b>메일 → 내 캠페인</b>에서 제목으로 검색하고, <b>이어서 대화하기</b>를 누르면 정리된 핵심(받는 사람·제목·본문)만 불러와 빠르게 이어갑니다.'],
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
      '청구하기 전에 나비웹이 <b>이미 얻을 수 있는 정보</b>(공유 아카이브, 웹에 공개된 자료)를 먼저 찾아 보여 주고, 그래도 없는 것만 청구 항목으로 채웁니다.',
      '보관한 청구 건은 공유 아카이브에 공개할지 <b>선택</b>합니다. 선택하지 않으면 <b>비공개</b>입니다.',
      '청구 목적에 “SP”·“프롬프트” 같은 내부 용어는 쓰지 말고, <b>개인정보는 넣지 마세요.</b>'],
      quiz: [
        { q: '청구서를 만들기 전에 나비웹이 먼저 하는 일은?', opts: ['곧바로 기관에 발송', '이미 얻을 수 있는 정보가 있는지 찾아 보여 준다', '내 주소록을 공개한다'], answer: 1, hint: '두 번째 항목.' },
        { q: '보관한 청구 건을 공유 아카이브에 공개하지 않으면?', opts: ['자동으로 공개된다', '비공개로 남는다', '삭제된다'], answer: 1, hint: '세 번째 항목.' },
        { q: '청구 목적에 넣으면 안 되는 것은?', opts: ['개인정보', '알고 싶은 내용', '청구 기관 이름'], answer: 0, hint: '마지막 항목.' }] },

    { level: '고급', title: '자동 규칙·위임 규칙과 안전하게 쓰기', body: [
      '자동 삭제·부재중 답장 같은 규칙은 말로 설정할 수 있습니다. 자동 삭제는 되돌리기 어려우니 <b>처음에는 범위를 좁게</b> 정하세요.',
      '<b>위임 규칙</b>(“이런 요청이면 내 확인 없이 알아서 답장해”)은 편리하지만 비서가 나 대신 답장을 보내게 됩니다. <b>익숙해진 뒤에</b>, <b>구체적이고 좁게</b> 만드세요. 금액·계약·확정적인 약속이 걸린 일은 규칙 밖에 두세요.',
      '발송 한도(테스트 기간 기준): 이번 1통을 포함한 <b>최근 5일 평균이 하루 100통</b>을 넘으면 초과분은 <b>1통당 10 GDC</b>가 부과됩니다. 발송이 막히지는 않습니다.',
      '비밀번호·주민등록번호·카드 번호 같은 <b>민감한 정보는 메일 본문에 넣지 마세요.</b>'],
      quiz: [
        { q: '위임 규칙은 언제 만드는 것이 좋나요?', opts: ['처음 시작할 때 바로', '대화 방식에 충분히 익숙해진 뒤, 구체적이고 좁게', '금액이 걸린 일부터'], answer: 1, hint: '두 번째 항목.' },
        { q: '발송 한도를 넘으면 어떻게 되나요?', opts: ['발송이 막힌다', '초과분에 1통당 10 GDC가 부과되고 발송은 막히지 않는다', '계정이 삭제된다'], answer: 1, hint: '세 번째 항목.' },
        { q: '메일 본문에 넣으면 안 되는 것은?', opts: ['행사 날짜', '비밀번호·카드 번호 같은 민감한 정보', '회의 장소'], answer: 1, hint: '마지막 항목.' }] },

    { level: '고급', title: '나만의 AI 비서의 점검과 알림', body: [
      '업무에 <b>기한</b>을 넣어 두면 비서가 <b>7일 전·1일 전·당일</b>에 알려 줍니다. 법정 기한을 계산해 주는 것이 아니라 <b>내가 입력한 날짜</b> 기준입니다.',
      '합의·공유·종료처럼 되돌리기 어려운 일 앞에서 비서가 <b>점검 규칙</b>을 확인합니다. <b>주의</b>가 나오면 대화상자의 기본 선택은 <b>보류</b>이고 그래도 하려면 <b>그대로 진행(기록됨)</b>을 누릅니다. <b>진행 불가</b>(예: 미결제 청구서가 있는 종료)는 비서가 대신 진행하지 않습니다.',
      '“통과”는 <b>점검 규칙 범위 안</b>의 결과일 뿐 법적으로 문제없다는 뜻이 아니고, “적용 규칙 없음”도 문제없다는 뜻이 아닙니다. 확실히 점검할 수 없는 부분은 <b>인간 전문가의 조언을 구하시길 권합니다.</b> 나비웹은 <b>특정 전문가를 추천하지 않습니다.</b>',
      '점검 결과와 내 선택은 이 기기에 <b>증거</b>로 남지만, 입력한 내용의 원문이 아니라 <b>지문(해시)</b>만 남깁니다.'],
      quiz: [
        { q: '점검 결과가 “통과”일 때 올바른 이해는?', opts: ['법적으로 문제없음이 보장된다', '점검 규칙 범위 안에서 통과했다는 뜻이다', '더 이상 확인할 필요가 없다'], answer: 1, hint: '세 번째 항목의 굵은 글씨.' },
        { q: '“주의” 대화상자에서 기본으로 선택되는 것은?', opts: ['보류', '그대로 진행', '자동 삭제'], answer: 0, hint: '두 번째 항목.' },
        { q: '확실히 점검할 수 없는 부분에서 비서가 하는 일은?', opts: ['특정 전문가의 이름을 알려 준다', '인간 전문가의 조언을 구하도록 권한다(특정인은 추천하지 않음)', '그냥 통과시킨다'], answer: 1, hint: '세 번째 항목.' }] },

    { level: '고급', title: '혼디 대화 패널과 스마트폰', body: [
      '화면 오른쪽 아래 <b>💬</b>는 사람과 직접 나누는 <b>1:1 대화(P2P) 패널</b>입니다. 닫아도 숨기기만 해서 상대의 대화 요청을 계속 받고, 요청이 오면 저절로 열립니다.',
      '나비웹 화면 안에서는 패널의 <b>AI 입력창도 가운데 입력창과 같은 나만의 AI 비서</b>가 처리합니다. 패널에는 결과 요약이 오고, 자세한 카드(고친 칸·되돌리기)는 가운데 화면에 나옵니다. 파일을 첨부해 보내는 경우는 패널 안에서 처리합니다.',
      '스마트폰에서는 <b>naviweb.kr</b>이 대화 중심의 스마트폰 화면으로 연결됩니다. 메일·업무·점검 알림은 같게 쓰지만 <b>서류 작성과 서류 고치기는 컴퓨터</b>에서 합니다.',
      '초대 링크(<b>naviweb.kr/i…</b>)는 컴퓨터와 스마트폰 모두에서 열립니다.'],
      quiz: [
        { q: '나비웹 화면 안에서 💬 패널의 AI 입력창은?', opts: ['가운데 입력창과 같은 나만의 AI 비서가 처리한다', '별개의 다른 비서가 처리한다', '입력할 수 없다'], answer: 0, hint: '두 번째 항목.' },
        { q: '서류 작성과 서류 고치기를 쓸 수 있는 곳은?', opts: ['스마트폰 화면만', '컴퓨터 화면', '둘 다 아니다'], answer: 1, hint: '세 번째 항목.' },
        { q: '💬 패널의 닫기를 누르면?', opts: ['숨기기만 해서 대화 요청을 계속 받는다', '로그아웃된다', '대화 기록이 삭제된다'], answer: 0, hint: '첫 항목.' }] },

    // 기능 플래그(CaseUI.enabled)가 켜졌을 때만 붙는 페이지
    { level: '고급', title: '업무(Case): 맡은 일 · 맡긴 일 · 나 홀로', flag: 'case', body: [
      '<b>업무</b>(시험 기능, 주소 끝 <b>?case=1</b>로 열기)는 한 건의 일을 처음부터 끝까지 담는 그릇입니다. 세 관점이 있습니다: <b>맡은 일</b>(내가 서비스 제공자로 맡은 일), <b>맡긴 일</b>(내가 전문가에게 맡긴 일), <b>나 홀로</b>(내가 나 자신의 일을 직접 처리).',
      '모든 기록은 <b>이 기기에만</b> 저장되고, 네트워크에는 <b>해시(지문)만</b> 기록됩니다. 진행 기록은 한번 쓰면 고치지 않고 정정은 새 항목으로 남기며, 화면에서 무결성을 확인할 수 있습니다.',
      '<b>소통 이력</b>에는 누가·누구와·언제·어디서·어떻게·무엇을·왜를 기록합니다. 대면은 장소가 필수입니다.',
      '상대는 <b>초대 메일</b>(링크 유효 14일)로 부르고, 상대가 가입·수락하면 아이디가 전달되고 서로의 서명 키를 교환합니다. 일은 <b>제안됨 → 합의됨 → 진행 중(↔보류) → 종료 협의 중 → 종료 → 보관</b> 순서로 흐릅니다.',
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
