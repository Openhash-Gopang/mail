# naviweb-agent — 서류 절차 도우미 (브라우저 확장 + 모델 게이트웨이)

naviweb.kr '서류 작성' 서류의 후속 절차(법원·등기소 포털 등)를 사용자의 브라우저에서 단계별로 돕는 에이전트.
Claude in Chrome 과 같은 구성(도구 호출 모델 + 페이지 읽기/조작 도구 + 안전 규칙)을 자체 구현한다.

```
확장(사이드패널) ─ 에이전트 루프 ─ POST /v1/step ─▶ 게이트웨이(Cloudflare Worker) ─▶ Claude(Haiku 5.5) | Gemma 4 31B
        │ read_page/find/click/type… (ref 기반)
        ▼
   현재 탭(iros.go.kr, ecfs.scourt.go.kr, gov.kr, hondi.net, naviweb.kr)
```

## 모델 전환
- 기본은 **Claude 중 가장 저렴한 `claude-haiku-5-5`** (게이트웨이 `CLAUDE_MODEL`).
- Gemma 4 31B 가 준비되면 게이트웨이 변수 `DEFAULT_PROVIDER=gemma`, `GEMMA_BASE_URL`(OpenAI 호환 `/v1`), `GEMMA_API_KEY` 만 바꾸면 된다. 확장 코드는 그대로다.
- 확장 설정에서 provider 를 `claude`/`gemma` 로 직접 고를 수도 있다(둘을 비교 시험할 때).

## 안전 규칙(`extension/policy.js`, 모델보다 우선)
- 로그인·인증서·결제·보안문자, 비밀번호·카드 입력 → 사용자에게 넘김(handoff)
- 제출·발급·삭제·전송 클릭 → 사용자 확인
- 주민등록번호 입력 → 거부. 허용 목록(iros, ecfs, gov.kr, hondi.net, naviweb.kr) 밖 이동 → 거부
- 키는 게이트웨이 비밀값에만 둔다(확장에는 토큰만).

## 요청 크기 상한(강제)
Haiku 5.5 는 한 요청이 10만 토큰을 넘으면 모든 요율이 5배다. 그래서 게이트웨이가 **모든 요청**(Claude·Gemma 공통)에서 입력을 `MAX_INPUT_TOKENS`(기본 90,000, **어떤 값을 넣어도 95,000 초과 불가**) 이하로 강제한다.
1. 오래된 도구 결과는 3,000자, 최신은 6,000자로 자르고 오래된 스크린샷은 제거
2. 그래도 넘으면 가장 오래된 (assistant, user) 단계 쌍부터 삭제(첫 목표·마지막 단계·도구 짝은 유지)
3. Claude 는 추정치가 한도의 60%를 넘으면 `count_tokens` 로 정확히 재확인해 더 줄이고, 확인 불가에 여유도 없으면 거절
4. 끝까지 못 줄이면 413 `context_too_large` — 모델을 호출하지 않는다(비용 0). 응답에 `input_estimate`, `trimmed` 를 넣는다.
확장도 도구 결과를 6,000자로 자르고 스크린샷을 1장만 남긴다.

## 배포
1. 게이트웨이: `cd ops/naviweb-agent/gateway && npx wrangler deploy` 후 비밀값 설정
   `npx wrangler secret put AGENT_TOKEN` / `ANTHROPIC_API_KEY` (Gemma 사용 시 `GEMMA_BASE_URL`, `GEMMA_API_KEY`).
   `ALLOWED_ORIGINS` 에 `chrome-extension://<확장ID>` 를 넣는다.
2. 확장: `chrome://extensions` → 개발자 모드 → `ops/naviweb-agent/extension` 폴더 로드 → 설정에 게이트웨이 주소·토큰 입력.
3. 사이드패널에서 절차(예: 법인등기 전자소송용 발급)를 고르고 목표를 적어 시작.

## 한계(현재 0.1)
- 좌표 클릭 없이 요소 이름(ref)으로만 조작한다. 화면이 iframe 안에 있으면 요소가 안 보일 수 있다(`all_frames` 로 일부 대응).
- 절차는 `playbooks.js` 에 1개(인터넷등기소 전자소송용 발급)만 있다. 판결정본·보정서 첨부 절차는 후속.
- Haiku/Gemma 의 조작 성공률은 실제 포털에서 시험해야 한다. 막히면 `provider` 를 바꿔 비교한다.
