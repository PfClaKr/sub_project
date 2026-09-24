# Build context: srcs/server (shared modules under package/ are needed).
FROM golang:1.22-alpine AS build
WORKDIR /app
COPY . .
WORKDIR /app/chatserver
RUN go mod download && CGO_ENABLED=0 go build -o /main .

FROM alpine:3.20
RUN apk add --no-cache tzdata ca-certificates
COPY --from=build /main /main
CMD ["/main"]
