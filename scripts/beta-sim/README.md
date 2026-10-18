# 베타 트래픽 시뮬레이션과 AWS 비용 계산

실제 Chromium 브라우저 여러 개가 베타 회원처럼 프로덕션 리허설 스택(`make rehearsal`과 같은 구성)을 사용합니다. 회원들은 페이지를 열고, 스크롤하고, 카드를 누르고, 검색어를 입력하고, 좋아요·댓글·채팅·글쓰기(휴대폰 크기 사진 포함)를 합니다. 이때 나오는 사용량을 재고, 그 결과로 월 AWS 비용을 계산합니다.

## 무엇을 재나

| 항목 | 방법 |
|---|---|
| DynamoDB 읽기/쓰기 요청 단위(RRU/WRU) | `ddbmeter`가 서비스와 DynamoDB Local 사이에서 모든 호출에 `ReturnConsumedCapacity`를 붙이고, 작업·테이블별로 더합니다. 실제 DynamoDB의 최소 과금(읽기 0.5, 쓰기 1)은 `cost.mjs`에서 보정합니다. |
| 서버 전송량 | 브라우저가 받은 문서, RSC, 정적 파일, API 바이트입니다. Lightsail 전송량에 해당합니다. |
| 사진 전송량 | `/media/*` 응답입니다. 운영에서는 S3가 직접 보냅니다. |
| CPU, 메모리 | `docker stats`로 컨테이너별 CPU 시간과 최대 메모리를 잽니다. Lightsail에서 돌아갈 컨테이너(Caddy, Next, Go 3개, ES)는 `cpuset`으로 코어 2개에 묶어서 2 vCPU 플랜을 흉내 냅니다. |
| 업로드, 메일 | 올린 사진 수와 크기, MailHog에 도착한 메일 수입니다. |

## 실행

```bash
scripts/beta-sim/run.sh up                       # 측정용 리허설 (https://localhost:8443)
cd scripts/beta-sim && npm install && cd -       # playwright
CHROMIUM_PATH=<chrome 실행 파일, 선택> taskset -c 6-11 scripts/beta-sim/run.sh sim --users=150 --days=3
node scripts/beta-sim/cost.mjs                   # 월 비용 표 (--compare=<다른 결과>로 나란히 비교)
scripts/beta-sim/run.sh down                     # 정리 (볼륨까지 삭제)
```

- `taskset`은 브라우저가 서버용 코어(0–1)를 쓰지 않게 합니다. 코어가 12개보다 적으면 범위를 바꾸세요.
- 단계는 `--phase=accounts,content,idle,beta,load` 중에서 고릅니다. 결과 위치는 `--out`으로 바꿀 수 있습니다. 결과는 `scripts/beta-sim/results/<단계>.json`에 쌓입니다.
  - **accounts:** loginserver CLI로 가입 30일 된 회원 `beta-NNN@sim.itnyang`을 만듭니다.
  - **content:** 베타 첫 몇 주에 쌓였을 만한 상품(사진 1–4장), 글, 집·알바 글, 댓글을 회원들이 API로 올립니다.
  - **idle:** 아무 요청 없이 90초 동안 스택이 쓰는 CPU입니다. `cost.mjs`가 방문 비용에서 이 값을 빼고, 서버의 고정 부하로 따로 셉니다.
  - **beta:** `--days`일 동안 매일 회원의 약 40%가 1–3번 들어옵니다. 회원 유형 비율은 많이 올리는 회원 10%, 참여하는 회원 30%, 주로 보는 회원 60%입니다. 70%는 휴대폰 화면으로 들어옵니다.
  - **load:** 생각하는 시간 없이 동시 세션을 늘려가며(`--levels=2,4,8,16`) 처리량과 응답 시간을 봅니다.
- 사진은 사이트처럼 업로드 전에 긴 변 1600px로 줄여서 올립니다. `--raw-upload`를 주면 원본 그대로 올립니다(사진 리사이즈 전 동작).
- 브라우저는 localhost 말고는 이름을 찾지 못하게 막혀 있습니다. 그래서 OpenStreetMap 같은 공개 서비스에는 시뮬레이션 트래픽이 가지 않습니다. 위치는 파리의 몇 지점만 써서 Nominatim 조회도 몇 번뿐입니다.

## 한계

- 이 컴퓨터의 CPU와 Lightsail vCPU는 성능이 다릅니다. `cost.mjs`는 Lightsail vCPU를 이 컴퓨터 코어의 절반으로 계산합니다(`--cpuFactor=2`).
- 시간은 압축되어 있습니다. 실제 방문 시간 동안 일어나는 알림 폴링(60초마다)은 세션마다 계산해서 따로 보냅니다. 메일 다이제스트 묶음은 실제보다 많이 묶이므로, 메일 수는 알림 수의 절반으로 잡습니다.
- 부하 단계는 이 컴퓨터의 브라우저(코어 6개)가 먼저 한계에 닿습니다. 서버 용량은 방문당 CPU 시간으로 판단하세요.
- 테스트 사진은 캔버스로 만든 12MP JPEG(약 2.8MB)입니다. 실제 사진과 압축률이 조금 다릅니다.
- 로그인한 회원만 흉내 냅니다. 검색 유입처럼 로그인하지 않은 방문은 들어 있지 않습니다.
