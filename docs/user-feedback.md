# 사용자 제보 반영 체계

사용자 제보(오류·잘못된 안내·없는 서류·개선 아이디어)는 나비웹에서 가장 중요한 개선 신호다. 제보는 아래 통로로 모이고, 한 곳(혼디 제보 창구 `POST /user-feedback/submit`, 익명 허용)에 쌓인다.

## 사용자가 제보하는 방법
| 통로 | 위치 | 종류 |
|---|---|---|
| ⚑ 문제 알리기 | 서류 화면 첨부서류 항목마다 | attach — 기관이 달라요 / 가져오지 못해요 / 직접 준비 서류예요 / 버튼이 없어요 |
| 서류 요청 | 문서 작성 화면 위쪽 | newdoc — 찾는 서류가 없어요 |
| 문제 알리기 | 문서 작성 화면 위쪽 | bug — 오류·불편 |
| 대화창 명령 | 도우미 대화창에 `신고: …` · `서류 요청: …` · `제안: …` | AI 를 거치지 않고 제보 창을 연다(제안은 기능 개선 게시판) |
| 도우미 AI 에게 말하기 | 도우미 대화창에서 "그건 정부24가 아니에요", "이 서류가 없어요" 처럼 말하면 | 도우미가 사과하고 미리 채운 제보 창을 띄운다. 보내기는 사용자가 확인해야 전송 |
| 가져오기 실패 안내 | 도우미가 항목을 가져오지 못했을 때 대화창에 자동 안내 | 위 ⚑ 로 연결 |
| 기능 개선 제안 게시판 | 위쪽 "기능 개선 제안", 요금제의 "기능 개선 제안·오류 신고하기" | 아이디어(투표) |

채택된 제보는 베타 테스트 기간에 중요도에 따라 GDC 로 보상한다(요금제 안내).

## 보내는 내용(개인정보 보호)
사용자가 쓴 글·서류 이름·카탈로그 규칙 ID·확장 버전·서류 제목만 보낸다. 이메일·전화·주민번호 모양·긴 숫자는 보내기 전에 지운다. 기기당 하루 10건까지.

## 자동 수집 (주 1회)
- 혼디 제보 창구에 운영자 전용 `GET /user-feedback/export?since=&limit=` (Bearer 토큰)가 있다. 읽기 전용, 토큰이 없거나 틀리면 401.
- `scripts/feedback-weekly.mjs` 가 최근 7일 제보를 받아 `feedback-digest` 로 집계한다. `.github/workflows/feedback-digest.yml` 이 매주 월요일 09:00(KST)에 실행해 결과를 GitHub 이슈 "사용자 제보 주간 집계 <날짜>" 로 올린다(새 제보가 없으면 이슈를 만들지 않는다). 수동 실행도 가능(Actions → feedback-digest → Run workflow).
- 제보자는 기기마다 무작위로 만든 표식(`dev=`)으로만 구분한다(개인정보 아님). 한 기기의 중복 제보는 1명으로 센다.
- 설정(1회): 같은 토큰 값을 ① Cloudflare hondi-proxy Worker secret `USER_FEEDBACK_EXPORT_TOKEN` ② 이 저장소 Actions secret `USER_FEEDBACK_EXPORT_TOKEN` 에 넣는다. 로컬 실행: `USER_FEEDBACK_EXPORT_TOKEN=… node scripts/feedback-weekly.mjs --out report.md`

## 운영자가 반영하는 방법 (주 1회 권장)
1. 제보 내려받기 — 혼디 L1(PocketBase) `user_feedback` 에서 말머리 `[naviweb:` 가 들어 있는 기록을 JSON 으로 저장한다.
   예) `GET <L1>/api/collections/user_feedback/records?perPage=500&filter=(raw_text~'[naviweb:')` (관리자 인증 필요)
2. `node scripts/feedback-digest.mjs <제보.json> --out report.md` — 같은 (서류·문제)를 서로 다른 3명 이상이 보낸 것은 **[조치]**, 새 서류 요청은 **[추가]** 로 표시된다. 한 사람이 여러 번 보내도 1명으로 센다.
3. 조치
   - attach → `attach-catalog.js` 규칙 수정(기관 변경·분류 변경·새 규칙). `docs/attach-catalog.md` 참조.
   - newdoc → navi-pro 서류 양식 추가(`scripts/forms-batch.mjs` 등). 추가 후 `node scripts/catalog-coverage.mjs` 로 첨부서류 분류도 점검.
   - bug → 재현해 고치고, 같은 증상 신고가 많으면 우선순위를 올린다.
4. 처리 결과를 제보 상태(`status`)에 반영하고 보상 대상은 별도 기록한다.

## 서식 항목 제보(기존)
서류 칸이 부족할 때 사용자가 칸을 추가하면 `/doc-form/feedback` 으로 익명 집계되고 `navi-pro/scripts/apply-form-feedback.mjs` 로 서식에 반영한다.
