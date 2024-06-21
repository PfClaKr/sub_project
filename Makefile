COMPOSE_FILE = ./docker/Docker-compose.yaml

all: up

up:
	@echo "Creating containers.."
	@sudo docker-compose -f $(COMPOSE_FILE) up --build -d

fclean:
	@echo "Removing.."
	@sudo docker-compose -f $(COMPOSE_FILE) stop -t1

ifneq ($(shell sudo docker container ls -a | wc -l), 1)
	@sudo docker container prune -f
endif

ifneq ($(shell sudo docker network ls | grep ft_network | wc -l), 0)
	@docker network prune -f
endif

ifneq ($(shell sudo docker volume ls | wc -l), 1)
	@sudo docker volume prune -f
endif

##for removing image files
# ifneq ($(shell sudo docker image ls | wc -l), 1)
# 	@sudo docker image prune -f
#endif

re: fclean up


.PHONY: all up re