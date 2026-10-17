#!/usr/bin/env bash
# make phone: the production stack from this computer, reachable from a
# phone over HTTPS through a temporary Cloudflare quick tunnel (no account,
# random https://<name>.trycloudflare.com address, gone when stopped).
#
#   1. starts the tunnel to Caddy (https://localhost:8443),
#   2. starts the production rehearsal with APP_URL = the tunnel address
#      (CORS, mail links, photo URLs follow it),
#   3. loads the demo accounts and data (scripts/demo.sh),
#   4. prints the address to open on the phone.
#
# make phone-down stops the tunnel and the rehearsal.
set -euo pipefail
cd "$(dirname "$0")/.."

TUNNEL=itnyang-tunnel
REHEARSAL="docker compose -p itnyang-rehearsal -f ./deploy/docker-compose.prod.yml -f ./deploy/docker-compose.rehearsal.yml --env-file ./deploy/rehearsal.env"

if [ "${1:-}" = down ]; then
	docker rm -f "$TUNNEL" >/dev/null 2>&1 || true
	$REHEARSAL down -v --remove-orphans
	exit 0
fi

echo "== 터널 시작"
docker rm -f "$TUNNEL" >/dev/null 2>&1 || true
# Caddy serves the site "localhost" with its internal certificate, so the
# tunnel presents that host name and skips certificate verification.
docker run -d --name "$TUNNEL" --network host cloudflare/cloudflared:2026.9.3 \
	tunnel --no-autoupdate --url https://localhost:8443 \
	--no-tls-verify --http-host-header localhost --origin-server-name localhost >/dev/null
URL=""
for _ in $(seq 1 60); do
	URL=$(docker logs "$TUNNEL" 2>&1 | grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' | head -n1 || true)
	[ -n "$URL" ] && break
	sleep 1
done
[ -n "$URL" ] || { echo "터널 주소를 받지 못했어요: docker logs $TUNNEL"; exit 1; }
echo "  - $URL"

echo "== 서비스 시작 (처음에는 이미지 빌드로 몇 분 걸려요)"
# Shell variables override the env file for compose interpolation.
APP_URL="$URL" S3_PUBLIC_URL="$URL/media" $REHEARSAL up -d --build --wait

echo "== 데모 데이터"
DEMO_COMPOSE="$REHEARSAL" \
DEMO_WEB="$URL" \
DEMO_API=https://localhost:8443/svc/api \
DEMO_AUTH=https://localhost:8443/svc/auth \
DEMO_CHAT=https://localhost:8443/svc/chat \
DEMO_MAIL=http://localhost:8026 \
DEMO_CURL_OPTS=-k \
	./scripts/demo.sh

cat <<EOF

  ──────────────────────────────────────────────────────
   휴대폰에서 열 주소   $URL
  ──────────────────────────────────────────────────────
   안드로이드 앱   CI 아티팩트의 APK를 설치하고, 첫 화면의
                   '테스트 서버 주소'에 위 주소를 입력하세요.
   아이폰          Safari로 열고 공유 → '홈 화면에 추가'.
                   (푸시 알림은 홈 화면 앱에서만 돼요)
   이 주소는 make phone-down 하거나 컴퓨터를 끄면 사라져요.
EOF
