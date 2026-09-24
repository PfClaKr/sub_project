COMPOSE = docker compose -f ./docker/Docker-compose.yaml

all: up

## Start (build if needed) the whole stack in the background.
up:
	@echo "Starting containers.."
	@$(COMPOSE) up --build -d --renew-anon-volumes

## Stop and remove containers. Data volumes (dynamodb, minio) are kept.
down:
	@$(COMPOSE) down --remove-orphans

## Stop containers without removing them.
stop:
	@$(COMPOSE) stop -t1

## Rebuild and restart a single service: make restart s=apiserver
## (--renew-anon-volumes: nextjs keeps node_modules in an anonymous volume,
## which would otherwise survive a rebuild and hide new dependencies.)
s ?= apiserver
restart:
	@$(COMPOSE) up -d --build --renew-anon-volumes $(s)

## Show container status.
ps:
	@$(COMPOSE) ps

## Follow logs of every service (or one: make logs s=chatserver).
logs:
	@$(COMPOSE) logs -f --tail=100 $(s)

## Wait until the api server (and its dependencies) answer.
wait:
	@echo "Waiting for apiserver (elasticsearch/minio startup can take ~1min).."
	@until curl -sf http://localhost:8080/healthz >/dev/null 2>&1; do sleep 3; done
	@echo "Ready."

## Quick reachability check of every service.
# curl without -f: any HTTP answer (even 4xx) proves the service is up.
health:
	@curl -sf -o /dev/null http://localhost:3000                   && echo "nextjs        OK" || echo "nextjs        DOWN"
	@curl -sf -o /dev/null http://localhost:8080/healthz           && echo "apiserver     OK" || echo "apiserver     DOWN"
	@curl -sf -o /dev/null http://localhost:7070/healthz           && echo "loginserver   OK" || echo "loginserver   DOWN"
	@curl -sf -o /dev/null http://localhost:9090/healthz           && echo "chatserver    OK" || echo "chatserver    DOWN"
	@curl -sf -o /dev/null http://localhost:9200                   && echo "elasticsearch OK" || echo "elasticsearch DOWN"
	@curl -sf -o /dev/null http://localhost:9000/minio/health/live && echo "minio         OK" || echo "minio         DOWN"
	@curl -sf -o /dev/null http://localhost:8025                   && echo "mailhog       OK" || echo "mailhog       DOWN"
	@curl -s  -o /dev/null http://localhost:8000                   && echo "dynamodb      OK" || echo "dynamodb      DOWN"

## Insert dummy users/products for manual testing (debug routes only).
seed:
	@curl -s -X POST http://localhost:8080/debug/dummy/12
	@echo

## Remove only the rows created by seed.
unseed:
	@curl -s -X DELETE http://localhost:8080/debug/dummy
	@echo

GO_MODULES = apiserver loginserver chatserver package/cors package/jwt package/jsonresponse package/dynamo

## Grant the admin role to an existing account: make admin email=you@example.com
admin:
	@test -n "$(email)" || { echo "usage: make admin email=you@example.com"; exit 1; }
	@$(COMPOSE) exec apiserver /main promote-admin $(email)

## Run the same checks as CI (without e2e): go vet/test for every module,
## then frontend lint, type-check and unit tests.
test:
	@echo "== go vet + tests"
	@docker run --rm -v $(CURDIR)/srcs/server:/app golang:1.22-alpine \
		sh -c 'set -e; for m in $(GO_MODULES); do echo "-- $$m"; cd /app/$$m; go vet ./...; go test ./...; done; cd /app/e2e && go vet -tags e2e ./...'
	@echo "== frontend lint + type-check + unit tests"
	@cd srcs/frontend && npm run lint && npx tsc --noEmit && npm test

## API end-to-end tests against the running stack (make up first; needs Go
## on the host and docker for the admin promotion step).
e2e:
	@cd srcs/server/e2e && E2E_COMPOSE_FILE=$(CURDIR)/docker/Docker-compose.yaml go test -tags e2e -count=1 ./...

## Full wipe: containers, network AND data volumes. Destroys local data!
fclean:
	@echo "Removing containers and volumes.."
	@$(COMPOSE) down -v --remove-orphans

re: fclean up

.PHONY: all up down stop restart ps logs wait health seed unseed admin test e2e fclean re
