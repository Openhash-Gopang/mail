# naviweb-qna — 사용법 질문·답변·댓글 게시판 서버

이용자가 사용법을 물으면 **SP-NAVIWEB-MANUAL**이 사용법(guide.js) 발췌를 근거로 먼저 답하고, 그래도 해결되지 않으면 이용자가 "관리자에게 질의"를 눌러 **관리자 대시보드(admin.html)의 "사용법 질의"** 에 올린다. 관리자는 링크(`admin.html#qna=<글 번호>`)로 열어 읽고 답한다. 관리자가 "공개 게시판에 올리기"를 켜면 다른 이용자도 보고 댓글을 달 수 있다.

## 배포 (Cloudflare, 약 10분)
1. **KV** 만들기: Storage & Databases → KV → Create → 이름 `naviweb-qna`. 만든 id 를 `wrangler.toml` 의 `REPLACE_WITH_KV_NAMESPACE_ID` 자리에 넣는다(PR 로 반영).
2. **Worker** 연결: `naviweb-proxy` 와 같은 방식(Workers Builds, 루트 `ops/naviweb-qna`, 배포 명령 `npx wrangler deploy`). 경로는 `naviweb.kr/api/qna/*`.
3. **비밀값**(Worker → Settings → Variables and Secrets):
   - `ADMIN_TOKEN` — 긴 무작위 문자열. 관리자 대시보드에서 처음 열 때 한 번 입력한다(세션 동안만 기억).
   - `SP_API_URL`, `SP_API_KEY`, (선택) `SP_MODEL` — SP 가 쓸 OpenAI 호환 chat completions. **없으면 SP 답변 없이 질문만 접수**되고, 이용자에게는 "자동 답변을 받을 수 없어 관리자에게 질의할 수 있다"고 안내된다.
4. 확인: `https://naviweb.kr/api/qna/public` 이 `{"ok":true,"threads":[]}` 를 돌려주면 연결된 것이다.

## API (경로 앞에 `/api/qna`)
| 대상 | 요청 | 설명 |
|---|---|---|
| 이용자 | `POST /threads` `{title?, text}` | 질문 등록 + SP 답변. 헤더 `X-Qna-Owner: <기기 토큰>` |
| | `GET /threads/mine` · `GET /threads/:id` | 내 글 목록 · 글(내 글 또는 공개 글) |
| | `POST /threads/:id/messages` `{text}` | 추가 질문(SP 가 다시 답함). 관리자 답에 다시 묻으면 다시 접수 |
| | `POST /threads/:id/escalate` `{note?}` | 관리자에게 질의(SP 가 한 번 답한 뒤에만) |
| | `POST /threads/:id/resolve` | 해결됨 |
| 공개 | `GET /public` · `POST /threads/:id/comments` `{text}` | 공개 글 목록 · 댓글 |
| 관리자 | `GET /admin/threads?status=escalated\|answered\|all` · `GET /admin/threads/:id` | `Authorization: Bearer <ADMIN_TOKEN>` |
| | `POST /admin/threads/:id/answer` `{text, publish?}` | 답변(+공개) |
| | `POST /admin/threads/:id/visibility` `{vis}` · `…/hide` `{msgId, hidden?}` | 공개 전환 · 댓글/글 가리기 |

## 개인정보·남용 방지
- 이용자는 기기가 만든 비밀 토큰으로만 구분하고, 서버에는 그 **해시**만 둔다. 이메일·전화·주민번호 모양·긴 숫자는 저장 전에 지운다.
- 기기당 하루 질문 10건, 글 60건. 관리자 API 는 토큰 없이는 401.
- 이용자 글은 본인과 관리자만 본다. 공개로 올린 글만 누구나 본다.

## 매뉴얼 발췌 갱신
SP 의 근거는 `manual-digest.js`(guide.js 에서 자동 생성)다. 사용법 장을 고치면 `node scripts/build-manual-digest.mjs` 를 다시 실행해 함께 커밋한다(테스트가 최신인지 검사한다).
SP 본문은 `SP-NAVIWEB-MANUAL.v1.js`. 같은 내용을 hondi 저장소 `prompts/` 에도 올려 버전별로 관리한다.
