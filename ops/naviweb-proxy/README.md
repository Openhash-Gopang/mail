# naviweb.kr 전환 절차 (Cloudflare 대시보드, 약 10분)

현재 naviweb.kr → mail.hondi.net/desktop.html 로 302 이동하는 규칙이 있다. 이를 아래로 바꾼다.
메일(MX·SPF·DKIM 등) 레코드는 건드리지 않는다.

1. **Workers & Pages → Create → Worker**, 이름 `naviweb-proxy`, 이 폴더의 `worker.js` 내용을 붙여 넣고 Deploy.
2. **DNS** (naviweb.kr): 웹용 레코드가 없다면 `A  @  192.0.2.1  (Proxied)` 와 `A  www  192.0.2.1  (Proxied)` 추가 (주소는 자리 표시용, 프록시(주황 구름) 켜야 함).
3. **Workers Routes**: `naviweb.kr/*` 와 `www.naviweb.kr/*` → `naviweb-proxy`.
4. 기존 **Redirect Rule / Page Rule**(naviweb.kr → mail.hondi.net)이 있으면 삭제(또는 비활성).
5. 확인: https://naviweb.kr 이 주소창 그대로 나비웹을 보여 주는지, 설정 → PDV/GDC 탭과 기능 개선 제안이 열리는지.
6. 전환이 확인되면 mail.hondi.net 쪽에서 naviweb.kr 로 보내는 코드를 켠다(별도 PR).

원본은 `mail.hondi.net` 으로 남겨 둔다(Worker 가 거기서 받아 온다). 이를 리다이렉트로 바꾸면 순환한다.

## 배포
Cloudflare Workers Builds 로 연결되어 있다(루트 `ops/naviweb-proxy`, 배포 명령 `npx wrangler deploy`). main 에 병합되면 자동 배포된다.
