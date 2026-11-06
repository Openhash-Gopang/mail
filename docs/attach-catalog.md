# 첨부서류 카탈로그 갱신 방법

`attach-catalog.js` 가 서류 이름 → 발급 기관을 정한다(AI 호출 없음). 규칙은 위에서부터 처음 맞는 것이 이긴다.

| 종류 | 뜻 | 서류 화면 |
|---|---|---|
| agency | 공공기관 사이트에서 발급 | "도우미가 가져오기" 버튼, 도우미가 그 사이트를 바로 연다 |
| thirdparty | 회사·병원·학교 등 개별 기관 발급 | 버튼 없음 |
| user | 사용자가 만들거나 가진 자료 | 버튼 없음 |
| unknown | 카탈로그에 없음 | 예전처럼 도우미 AI 가 판단 |

입력(input): `none` 은 본인 명의로 바로 발급(AI 없이 즉시 시작), `ask` 는 대상(법인 이름·주소·사건번호)을 물어야 하므로 사이트·로그인을 먼저 열고 대상은 나중에 전한다.

## 새 서류 양식을 추가했을 때
1. `node scripts/catalog-coverage.mjs --forms <navi-pro>/public/data/forms` — 분류되지 않은 이름이 빈도순으로 나온다.
2. 상위 항목을 `attach-catalog.js` 의 규칙 배열에 추가한다(구체적인 규칙을 위에). 새 기관이면 `AGENCIES` 에도 넣고 `ops/naviweb-agent/extension/policy.js` 의 `DEFAULT_HOSTS` 에 도메인을 넣는다.
3. `node --test tests/naviweb-agent.test.mjs` — 카탈로그 시험(기관 정의·허용 사이트·정규식)이 통과해야 한다.

## 주기 점검(월 1회 권장)
- `node scripts/catalog-check.mjs` — 기관 사이트 주소가 살아 있는지. 실패하면 주소·절차를 확인하고 `VERIFIED` 날짜를 갱신한다.
- 사용자 제보("이 서류 기관이 달라요")가 들어오면 규칙을 고친다.

현재 규칙은 사람이 검토하기 전의 초안이다(`reviewed:false`). 기관 화면·절차는 바뀔 수 있다.
