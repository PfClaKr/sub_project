COMPOSE = docker compose -f ./docker/Docker-compose.yaml

all: up

## Start (build if needed) the whole stack in the background.
up:
	@echo "Starting containers.."
	@$(COMPOSE) up --build -d

## Stop and remove containers. Data volumes (dynamodb, minio) are kept.
down:
	@$(COMPOSE) down --remove-orphans

## Stop containers without removing them.
stop:
	@$(COMPOSE) stop -t1

## Rebuild and restart a single service: make restart s=apiserver
s ?= apiserver
restart:
	@$(COMPOSE) up -d --build $(s)

## Show container status.
ps:
	@$(COMPOSE) ps

## Follow logs of every service (or one: make logs s=chatserver).
logs:
	@$(COMPOSE) logs -f --tail=100 $(s)

## Wait until the api server (and its dependencies) answer.
wait:
	@echo "Waiting for apiserver (elasticsearch/minio startup can take ~1min).."
	@until curl -sf http://localhost:8080/tables >/dev/null 2>&1; do sleep 3; done
	@echo "Ready."

## Quick reachability check of every service.
# curl without -f: any HTTP answer (even 4xx) proves the service is up.
health:
	@curl -sf -o /dev/null http://localhost:3000                   && echo "nextjs        OK" || echo "nextjs        DOWN"
	@curl -sf -o /dev/null http://localhost:8080/tables            && echo "apiserver     OK" || echo "apiserver     DOWN"
	@curl -s  -o /dev/null -X POST http://localhost:7070/login     && echo "loginserver   OK" || echo "loginserver   DOWN"
	@curl -s  -o /dev/null http://localhost:9090/rooms             && echo "chatserver    OK" || echo "chatserver    DOWN"
	@curl -sf -o /dev/null http://localhost:9200                   && echo "elasticsearch OK" || echo "elasticsearch DOWN"
	@curl -sf -o /dev/null http://localhost:9000/minio/health/live && echo "minio         OK" || echo "minio         DOWN"
	@curl -s  -o /dev/null http://localhost:8000                   && echo "dynamodb      OK" || echo "dynamodb      DOWN"

## Insert dummy users/products for manual testing.
seed:
	@curl -s http://localhost:8080/dummy/8
	@echo

## Run the same checks as CI: Go unit tests + frontend type-check.
test:
	@echo "== go tests"
	@docker run --rm -v $(CURDIR)/srcs/server:/app golang:1.22-rc-alpine \
		sh -c "cd /app/package/cors && go test ./... && cd /app/package/jwt && go test ./..."
	@echo "== frontend type-check"
	@cd srcs/frontend && npx tsc --noEmit && echo "tsc ok"

## Full wipe: containers, network AND data volumes. Destroys local data!
fclean:
	@echo "Removing containers and volumes.."
	@$(COMPOSE) down -v --remove-orphans

re: fclean up

.PHONY: all up down stop restart ps logs wait health seed test fclean re
