# FROM golang:1.22.2-alpine3.19

#RUN go build -o /something-files-for-execute

#CMD ["/something-files-for-execute"]

# golang/Dockerfile
FROM golang:1.20-alpine

WORKDIR /app

COPY go.mod go.sum ./
RUN go mod download

COPY . .

RUN go build -o /main .

EXPOSE 8080

CMD ["/main"]
