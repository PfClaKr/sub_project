# AWS 배포 (최소 비용 구성)

서버 한 대에서 Caddy, Next.js, Go 서비스 3개, Elasticsearch를 docker compose로 돌립니다. 데이터는 AWS 관리형 서비스에 둡니다(DynamoDB, S3, SES). 월 **약 $12~13**입니다.

```
사용자 ─ HTTPS ─> Caddy ─┬─ /            → nextjs:3000
  (Lightsail 2GB)         ├─ /svc/api/*   → apiserver:8080 ─┬─ Elasticsearch (같은 서버)
                          ├─ /svc/auth/*  → loginserver:7070 ├─ DynamoDB (온디맨드)
                          └─ /svc/chat/*  → chatserver:9090  └─ S3 (상품 이미지)
                                              loginserver ─── SES SMTP (인증 메일)
```

모든 서비스를 한 도메인 아래 경로(`/svc/*`)로 묶었습니다. 로그인 쿠키가 호스트 전용이어도 모든 서비스에 전달되고, CORS가 필요 없으며, 인증서도 하나면 됩니다.

## 월 비용 (파리 리전 eu-west-3, 소규모 트래픽)

| 항목 | 월 비용 | 비고 |
|---|---|---|
| Lightsail Linux 2GB (2 vCPU, 60GB SSD) | $12 | 공인 IPv4와 전송량 3TB 포함. 신규 계정은 첫 3개월 무료 |
| Lightsail 고정 IP | $0 | 인스턴스에 붙어 있는 동안 무료 |
| DynamoDB 온디맨드 | 약 $0 | 저장 25GB까지 상시 무료. 요청은 100만 건당 몇십 센트 |
| S3 이미지 몇 GB | $0.1 미만 | 인터넷 전송은 월 100GB까지 무료 |
| SES 메일 | 약 $0 | 1,000통당 $0.10 |
| 도메인 | 연 $10 안팎 | DNS는 등록업체 무료 DNS 사용(Route 53 불필요) |
| **합계** | **약 $12~13** | |

비용을 줄인 방법:
- **EC2 대신 Lightsail:** 같은 2GB여도 EC2 `t4g.small`은 인스턴스, 디스크, 공인 IPv4를 합쳐 월 약 $20입니다. Lightsail은 셋이 모두 $12에 포함됩니다.
- **DynamoDB 온디맨드:** 쓰지 않을 때는 과금되지 않습니다. 예전 설정(프로비저닝 5 RCU/WCU × 테이블·GSI 10개)은 무료 한도 25를 넘어서 월 약 $14가 나왔습니다. 목록 조회처럼 전체 스캔을 해도 용량 제한에 걸리지 않습니다.
- **ES는 서버 안에:** OpenSearch Service(월 약 $30) 대신 같은 서버에서 힙 512MB로 돌립니다. ML, 모니터링, 보안 기능은 꺼서 메모리를 아꼈습니다. 인덱스는 DynamoDB에서 다시 만들 수 있으므로 백업하지 않아도 됩니다.
- **로드밸런서, NAT, Route 53 없음:** 모두 고정비가 드는 서비스입니다.
- **이미지 캐시:** 업로드한 이미지에 `Cache-Control: immutable`을 붙여서 S3 요청과 전송량을 줄였습니다.
- **사진 줄이기와 썸네일:** 브라우저가 사진을 긴 변 1600px로 줄여서 올립니다. 서버는 목록용 썸네일(640px)을 따로 만들고, 목록과 카드는 썸네일만 불러옵니다. 그 전에는 휴대폰 원본 사진(장당 약 2.8MB)을 목록에서도 그대로 받아서, 방문 한 번에 사진만 약 70MB를 내려받았습니다.

실측 메모리(리허설 기준): Elasticsearch 약 950MB, 나머지(Caddy, Next, Go 3개) 약 80MB입니다. 베타 시뮬레이션의 최대치는 합계 약 1.2GB였습니다. 2GB 서버에 여유가 있습니다. 1GB 요금제($7)는 ES 때문에 권장하지 않습니다.

### 회원 수별 예상 (베타 시뮬레이션 실측, 2026년 10월)

`scripts/beta-sim`이 실제 브라우저 150명으로 리허설 스택을 사용해서 잰 방문 1회당 사용량입니다. 방문 1회는 페이지뷰 약 5.7개입니다. 서버에서 약 0.17MB, 사진으로 약 1.1MB를 받고, DynamoDB 읽기 약 150 RRU와 쓰기 약 5 WRU를 씁니다. 서버 CPU는 약 0.9초입니다. 이 값을 회원 수와 월 방문 수에 곱했습니다.

| 회원 | 월 방문(회원당) | Lightsail | DynamoDB | S3·전송 | 합계 |
|---|---|---|---|---|---|
| 150 (베타) | 3천 (20) | $12 | $0.1 | $0.05 | **약 $13** |
| 1,000 | 1.2만 (12) | $12 | $0.8 | $0.3 | **약 $14** |
| 5,000 | 5만 (10) | $12 | $6 | $1.3 | **약 $21** |
| 20,000 | 16만 (8) | $12 | $33 | $11 | **약 $59** |

- 합계에는 도메인(월 약 $0.8)과 SES가 포함됩니다.
- 사진을 줄이기 전에는 1,000명에 약 $81, 5,000명에 약 $334였습니다. 대부분이 S3 인터넷 전송료였습니다.
- 2만 명에서는 피크 CPU가 2GB 요금제의 지속 기준선(2 vCPU × 20%)에 가까워집니다. ES 인덱스도 커지므로 4GB($24)로 올릴 때입니다. CloudWatch로 CPU 버스트 잔량을 지켜보세요.
- 그다음 큰 항목은 DynamoDB 읽기입니다(목록마다 작성자 닉네임과 글을 묶어서 읽음). 2만 명 규모에서 줄일 여지가 있습니다.
- 다음은 빠져 있습니다: 검색엔진 크롤러와 비로그인 방문, 백업(PITR), 무료 기간. 계산 방법과 한계는 `scripts/beta-sim/README.md`에 있습니다.

## 1. AWS 준비 (내 PC에서 한 번)

AWS CLI에 관리자 권한으로 로그인한 상태에서 실행합니다.

```bash
BUCKET=itnyang-images-<임의문자열> ALERT_EMAIL=you@example.com ./deploy/aws-setup.sh
```

- S3 버킷을 만들고 이미지 객체만 공개 읽기로 엽니다. ACL은 계속 차단합니다.
- IAM 사용자 `itnyang-app`을 만듭니다. 권한은 앱의 테이블과 이 버킷으로만 제한합니다. 테이블이 늘면 다시 실행하세요(정책만 바뀌고 키는 그대로). 출력되는 액세스 키를 `deploy/.env`에 넣습니다(한 번만 표시).
- 월 $15 예산 알림을 만듭니다(실제 80%, 예상 100%에서 메일). 금액은 `BUDGET_USD`로 바꿀 수 있습니다.
- DynamoDB 테이블은 apiserver가 처음 뜰 때 만듭니다.

## 2. 메일 (SES)

1. SES 콘솔(eu-west-3) → **Identities**에서 도메인을 추가하고, 안내하는 DKIM CNAME 3개를 DNS에 등록합니다.
2. **SMTP settings**에서 SMTP 자격 증명을 만들고 `SMTP_USER`와 `SMTP_PASSWORD`에 넣습니다.
3. 처음에는 샌드박스라 인증한 주소로만 보낼 수 있습니다. **Request production access**로 해제를 신청하세요(보통 하루 안).

해제 전에 먼저 열어야 하면 `REQUIRE_EMAIL_VERIFICATION=false`로 두었다가, 메일이 준비되면 `true`로 돌리세요.

## 3. 서버 만들기 (Lightsail 콘솔)

1. **Create instance:** 리전은 Paris(eu-west-3), 플랫폼은 Linux, 블루프린트는 **OS Only → Ubuntu 24.04 LTS**, 요금제는 **$12 (2GB, IPv4)**를 고릅니다.
2. **Networking:** Static IP를 만들어 인스턴스에 붙입니다. IPv4 방화벽은 **SSH 22, HTTP 80, HTTPS 443**만 엽니다.
3. DNS에서 도메인의 A 레코드를 이 고정 IP로 지정합니다.

EC2를 쓸 경우, IAM 역할(인스턴스 프로파일)을 붙이고 `AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY`를 비워 두면 역할 권한으로 동작합니다. 보안 그룹도 22/80/443만 엽니다.

## 4. 설치와 첫 배포 (서버에서)

```bash
git clone https://github.com/PfClaKr/itnyang.git && cd itnyang
sudo ./deploy/server-setup.sh     # Docker, 스왑 2GB, ES 커널 설정
exit                              # 다시 접속해야 docker 그룹이 적용됩니다
cd itnyang
cp deploy/.env.example deploy/.env && nano deploy/.env
make prod-deploy                  # 빌드(서비스별 순서대로) → 기동 → 헬스 확인
make prod-admin email=you@example.com   # 가입한 계정을 관리자로
```

`deploy/.env`에서 채워야 하는 값:
- `DOMAIN`, `APP_URL`, `ACME_EMAIL`
- `JWT_SECRET`: `openssl rand -base64 48`
- 1단계에서 받은 AWS 키와 버킷 이름
- 2단계의 SMTP 값

Caddy는 첫 요청 때 Let's Encrypt 인증서를 받습니다. 그 전에 DNS가 서버를 가리키고 있어야 합니다.

## 운영

- **업데이트:** `make prod-deploy`는 `git pull` 후 다시 빌드하고 재시작합니다. 첫 빌드는 2GB 서버에서 10분 정도 걸립니다.
- **상태와 로그:** `make prod-ps`, `make prod-logs s=apiserver`. 로그는 서비스마다 10MB × 3개까지만 보관합니다.
- **Google 로그인(선택):** 리디렉션 URI를 `https://<도메인>/svc/auth/auth/google/callback`으로 등록하고, `GOOGLE_CLIENT_ID`와 `GOOGLE_CLIENT_SECRET`을 넣습니다.
- **백업(선택):** DynamoDB 특정 시점 복구(PITR)는 GB당 월 약 $0.2입니다. 데이터가 작을 때는 몇 센트입니다.

## 배포 전 로컬 리허설

운영 compose를 AWS 없이 그대로 띄웁니다. DynamoDB Local, MinIO, MailHog가 AWS 서비스를 대신합니다.

```bash
make rehearsal        # https://localhost:8443 (Caddy 자체 인증서), 메일은 http://localhost:8026
make rehearsal-down
```

e2e를 Caddy를 거쳐 HTTPS로 돌리려면 `E2E_API=https://localhost:8443/svc/api`, `E2E_LOGIN=.../svc/auth`, `E2E_CHAT=.../svc/chat`, `E2E_ORIGIN=https://localhost:8443`, `E2E_MAILHOG=http://localhost:8026`을 설정합니다. 인증서는 Caddy 루트 CA(`/data/caddy/pki/authorities/local/root.crt`)를 `SSL_CERT_FILE`에 넣습니다. 자체 인증서라 브라우저는 서비스워커를 등록하지 않지만, 실제 도메인에서는 등록됩니다.
