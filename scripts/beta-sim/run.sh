#!/usr/bin/env bash
# Beta traffic simulation against the production rehearsal (see
# scripts/beta-sim/README.md).
#   scripts/beta-sim/run.sh up      build and start the metered rehearsal
#   scripts/beta-sim/run.sh sim     run the simulation (args go to sim.mjs)
#   scripts/beta-sim/run.sh down    remove it (volumes too)
#   scripts/beta-sim/run.sh <compose args>
set -euo pipefail
cd "$(dirname "$0")/../.."

compose() {
	DYNAMODB_ENDPOINT=http://ddbmeter:8000 docker compose -p itnyang-rehearsal \
		-f deploy/docker-compose.prod.yml -f deploy/docker-compose.rehearsal.yml \
		-f scripts/beta-sim/compose.yml --env-file deploy/rehearsal.env "$@"
}

case "${1:-}" in
up) compose up -d --build --wait ;;
down) compose down -v --remove-orphans ;;
sim)
	shift
	# Caddy's internal CA is not trusted by Node; local only.
	NODE_TLS_REJECT_UNAUTHORIZED=0 node scripts/beta-sim/sim.mjs "$@"
	;;
*) compose "$@" ;;
esac
