# FROM golang:1.22.2-alpine3.19

#RUN go build -o /something-files-for-execute

#CMD ["/something-files-for-execute"]

# golang/Dockerfile
FROM golang:1.22-rc-alpine

WORKDIR /app

COPY . .

WORKDIR /app/chatserver

RUN go mod download

RUN go build -o /main .

EXPOSE 9090

CMD ["/main"]
