# 나비웹 원격 브라우저 러너

naviweb.kr 방문자가 확장 프로그램이나 GitHub 내려받기 없이 `서류 작성` 후속 절차(인터넷등기소·전자소송)를 도우미(Claude)에게 맡기는 서버입니다.
방문자의 브라우저에는 서버 브라우저의 **화면(JPEG 스트림)** 만 보이고, 로그인(간편인증)과 결제는 방문자가 그 화면에서 직접 합니다.

```
naviweb.kr (remote-agent.js) ──POST /v1/ticket──▶ 게이트웨이(Cloudflare) ──서명된 티켓(120초, 1회용)──▶ 방문자
방문자 ──wss + 티켓──▶ 러너(한국 리전 VM, Chromium) ──/v1/step──▶ 게이트웨이 ──▶ Claude Haiku
```

## 안전 장치
- 티켓: HMAC-SHA256, 120초, 한 번만 사용, 출처(Origin) 확인. 사용자당 1세션, 전체 `MAX_SESSIONS`.
- 세션마다 새 브라우저 컨텍스트(쿠키·저장소는 세션 종료 시 삭제), 파일 내려받기 차단, 기본 20분 제한.
- 주 화면 이동은 허용 목록(iros.go.kr, ecfs.scourt.go.kr, gov.kr, hondi.net, naviweb.kr + 간편인증 업체 + `ALLOW_HOSTS`)만.
- 에이전트 정책은 확장 프로그램과 동일(`extension/policy.js`): 로그인·인증서·결제·보안문자는 사용자에게 넘기고, 제출·발급은 확인을 받으며, 비밀번호·주민등록번호는 입력하지 않는다.
- 사용자 마우스·키보드 입력은 "직접 진행" 단계에서만 서버가 받는다.
- 모델 호출은 서버 토큰으로만 이루어지며 방문자에게 키가 노출되지 않는다. 요청 입력은 게이트웨이가 10만 토큰 미만으로 제한한다.

## 설치(한 번)
1. 한국 리전 VM 준비(Oracle Cloud 서울/춘천 등, 2 vCPU/6 GB 이상, Docker 설치). **먼저 이 VM 에서 `curl -I https://www.iros.go.kr` 로 접속이 되는지 확인**하세요. 데이터센터 IP 를 막는 사이트가 있을 수 있습니다.
2. `runner.naviweb.kr` 를 VM 공인 IP 에 연결(DNS A 레코드), 80/443 포트 열기.
3. `cp runner.env.example runner.env` 후 값 채우기. `TICKET_SECRET` 은 `openssl rand -hex 32`.
4. `docker compose up -d --build`
5. Cloudflare 게이트웨이(naviweb-agent-gateway) 설정 → 변수/비밀:
   - 비밀 `TICKET_SECRET`(러너와 같은 값)
   - 변수 `RUNNER_WS_URL` = `wss://runner.naviweb.kr/ws`
   - 변수 `AUTH_VERIFY_URL` = 로그인 확인 주소. 예: `https://hondi-proxy.tensor-city.workers.dev/kmail/settings` (방문자 토큰으로 200 이 오면 로그인한 사용자로 본다. 응답의 `mail_id` 를 사용자 식별자로 쓴다. 이 주소가 맞는지 확인 필요)
   - 변수 `TICKET_ORIGINS` = `https://naviweb.kr`(기본값)

## 알려진 한계·위험
- 방문자가 간편인증을 위해 입력하는 이름·생년월일·전화번호가 **운영자 서버의 브라우저**를 거칩니다. 개인정보 처리 고지와 보관 없음(세션 종료 시 삭제) 안내가 필요합니다.
- 공동인증서(파일)는 원격 브라우저에서 쓸 수 없어 간편인증만 지원합니다. 업체 주소가 목록에 없으면 "열 수 없는 사이트" 로 표시되므로 `ALLOW_HOSTS` 에 추가하세요.
- 등기소·전자소송이 해외/데이터센터 IP 나 자동화 브라우저를 막으면 동작하지 않습니다(한국 VM 에서 실제 시험 필요). 자동화 이용 약관 검토도 필요합니다.
- 동시 10세션은 대략 vCPU 4·메모리 8 GB 이상이 안전합니다(화면 스트림 약 0.3–1 Mbps/세션).
