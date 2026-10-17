#!/usr/bin/env bash
# make demo: demo accounts plus content around them on the local stack,
# then a login check of each account through the real APIs.
# Running it again resets the demo accounts to the same state.
set -euo pipefail

COMPOSE="docker compose -f ./docker/Docker-compose.yaml"
PASSWORD="${DEMO_PASSWORD:-itnyang1234}"
ADMIN_EMAIL="${DEMO_ADMIN_EMAIL:-admin@itnyang.test}"
USER_EMAIL="${DEMO_USER_EMAIL:-user@itnyang.test}"
FRIEND_EMAIL="${DEMO_FRIEND_EMAIL:-friend@itnyang.test}"
API=http://localhost:8080
AUTH=http://localhost:7070
CHAT=http://localhost:9090
WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT

echo "== 서비스 대기 (처음 띄울 때는 1분쯤 걸려요)"
until curl -sf "$API/healthz" >/dev/null 2>&1; do sleep 3; done

echo "== 데모 계정"
account() { # email nickname
	$COMPOSE exec -T loginserver /main demo-account "$1" "$PASSWORD" "$2" | tail -n1
}
account "$ADMIN_EMAIL" "잇냥관리자" >/dev/null
USER_ID=$(account "$USER_EMAIL" "잇냥체험")
account "$FRIEND_EMAIL" "파리새내기" >/dev/null
echo "  - $ADMIN_EMAIL, $USER_EMAIL, $FRIEND_EMAIL"

echo "== 데모 데이터"
$COMPOSE exec -T apiserver /main demo-seed "$ADMIN_EMAIL" "$USER_EMAIL" "$FRIEND_EMAIL"

echo "== 동작 확인"
failed=0
if [ -t 1 ]; then OK=$'\033[32mOK\033[0m  ' FAIL=$'\033[31mFAIL\033[0m'; else OK="OK  " FAIL="FAIL"; fi
check() { # label ok-condition(0/1) detail
	if [ "$2" = 1 ]; then echo "  $OK $1 $3"; else echo "  $FAIL $1 $3"; failed=1; fi
}
login() { # email jar -> HTTP status
	curl -s -o /dev/null -w '%{http_code}' -c "$2" -H 'Content-Type: application/json' \
		-d "{\"email\":\"$1\",\"password\":\"$PASSWORD\"}" "$AUTH/login"
}
gql() { # jar query
	curl -s -b "$1" -H 'Content-Type: application/json' -d "{\"query\":\"$2\"}" "$API/graphql"
}
count() { grep -o "$1" | wc -l | tr -d ' '; }
number() { grep -o "\"$1\":[0-9]*" | head -n1 | cut -d: -f2; }

for who in admin user friend; do
	case $who in
	admin) email=$ADMIN_EMAIL ;; user) email=$USER_EMAIL ;; friend) email=$FRIEND_EMAIL ;;
	esac
	status=$(login "$email" "$WORK/$who")
	check "로그인 $email" "$([ "$status" = 200 ] && echo 1 || echo 0)" "(HTTP $status)"
done

whoami=$(curl -s -b "$WORK/admin" "$AUTH/whoami")
check "관리자 권한" "$(echo "$whoami" | grep -q '"Role":"admin"' && echo 1 || echo 0)" ""
status=$(curl -s -o "$WORK/reports" -w '%{http_code}' -b "$WORK/admin" "$API/admin/reports?status=open")
check "관리자 신고 목록" "$([ "$status" = 200 ] && grep -q '"Total":[1-9]' "$WORK/reports" && echo 1 || echo 0)" "(열린 신고 $(number Total <"$WORK/reports")건)"
status=$(curl -s -o /dev/null -w '%{http_code}' -b "$WORK/user" "$API/admin/stats")
check "일반회원은 관리자 화면 차단" "$([ "$status" = 403 ] && echo 1 || echo 0)" "(HTTP $status)"

products=$(gql "$WORK/user" "{ userProducts(UserId: \\\"$USER_ID\\\") { ProductId } }" | count '"ProductId"')
check "내 상품" "$([ "$products" -ge 3 ] && echo 1 || echo 0)" "(${products}개)"
posts=$(gql "$WORK/user" "{ myPosts { PostId } }" | count '"PostId"')
check "내 커뮤니티 글" "$([ "$posts" -ge 2 ] && echo 1 || echo 0)" "(${posts}개)"
mine=$(gql "$WORK/user" "{ myPosts(Type: \\\"listing\\\") { PostId } }" | count '"PostId"')
check "내 집·알바 글" "$([ "$mine" -ge 1 ] && echo 1 || echo 0)" "(${mine}개)"
unread=$(gql "$WORK/user" "{ unreadCount }" | number unreadCount)
check "알림" "$([ "${unread:-0}" -ge 1 ] && echo 1 || echo 0)" "(안 읽음 ${unread:-0}개)"
rooms=$(curl -s -b "$WORK/user" "$CHAT/rooms" | count '"ChatId"')
check "채팅방" "$([ "$rooms" -ge 3 ] && echo 1 || echo 0)" "(${rooms}개)"
free=$(gql "$WORK/user" "{ posts(Type: \\\"free\\\") { Total } }" | number Total)
check "커뮤니티 목록 (검색엔진)" "$([ "${free:-0}" -ge 1 ] && echo 1 || echo 0)" "(자유게시판 ${free:-0}개)"
housing=$(gql "$WORK/user" "{ listings(Type: \\\"housing\\\") { Total } }" | number Total)
check "집 목록" "$([ "${housing:-0}" -ge 1 ] && echo 1 || echo 0)" "(${housing:-0}개)"
web=$(curl -s -o /dev/null -w '%{http_code}' http://localhost:3000/community)
check "웹 페이지" "$([ "$web" = 200 ] && echo 1 || echo 0)" "(/community HTTP $web)"

cat <<EOF

  ──────────────────────────────────────────────────────
   잇냥 데모        http://localhost:3000
  ──────────────────────────────────────────────────────
   관리자     $ADMIN_EMAIL   /  $PASSWORD
              (메뉴의 '관리자' → 신고 처리, 회원 정지)
   일반회원   $USER_EMAIL    /  $PASSWORD   (잇냥체험)
              상품 3개, 글·댓글, 채팅 3개, 알림이 있어요
   일반회원2  $FRIEND_EMAIL  /  $PASSWORD   (파리새내기)
              일반회원과 채팅해볼 때 쓰세요
   메일함     http://localhost:8025  (알림 메일, 가입 인증 메일)
  ──────────────────────────────────────────────────────
   다시 실행하면 데모 계정의 글·채팅·알림이 처음 상태로 돌아가요.
EOF

[ "$failed" = 0 ] || { echo; echo "확인에 실패한 항목이 있어요: make logs s=apiserver"; exit 1; }
