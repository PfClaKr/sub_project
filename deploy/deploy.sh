#!/usr/bin/env bash
# Build and (re)start the production stack on the server:
#   ./deploy/deploy.sh            # pull the current branch, build, restart
#   ./deploy/deploy.sh --no-pull  # deploy the working tree as is
set -euo pipefail
cd "$(dirname "$0")/.."

test -f deploy/.env || { echo "deploy/.env is missing (see deploy/.env.example)"; exit 1; }

if [ "${1:-}" != "--no-pull" ]; then
	git pull --ff-only
fi

COMPOSE="docker compose -f deploy/docker-compose.prod.yml"
# One image at a time: parallel builds (next build + Go) can run a 2GB
# host out of memory.
for service in elasticsearch apiserver loginserver chatserver nextjs; do
	echo "== build $service"
	$COMPOSE build "$service"
done
$COMPOSE up -d --remove-orphans
docker image prune -f >/dev/null

echo "Waiting for the stack to become healthy..."
for _ in $(seq 1 60); do
	if $COMPOSE ps --format '{{.Service}} {{.Health}}' | grep -qv -e ' healthy$' -e '^caddy ' -e '^nextjs '; then
		sleep 5
	else
		break
	fi
done
$COMPOSE ps
