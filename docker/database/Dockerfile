FROM amazon/dynamodb-local:latest

RUN apk add tzdata

CMD ["-jar DynamoDBLocal.jar -sharedDb -dbPath ./data"]