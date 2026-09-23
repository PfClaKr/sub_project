module apiserver

go 1.22

require (
	github.com/aws/aws-sdk-go v1.54.20
	github.com/elastic/go-elasticsearch/v8 v8.14.0
	github.com/google/uuid v1.6.0
	github.com/gorilla/mux v1.8.1
	github.com/graphql-go/graphql v0.8.1
)

require (
	github.com/elastic/elastic-transport-go/v8 v8.6.0 // indirect
	github.com/go-logr/logr v1.4.2 // indirect
	github.com/go-logr/stdr v1.2.2 // indirect
	github.com/golang-jwt/jwt/v5 v5.2.1 // indirect
	github.com/jmespath/go-jmespath v0.4.0 // indirect
	go.opentelemetry.io/otel v1.28.0 // indirect
	go.opentelemetry.io/otel/metric v1.28.0 // indirect
	go.opentelemetry.io/otel/trace v1.28.0 // indirect
)

require (
	local.com/cors v0.0.0
	local.com/dynamo v0.0.0-00010101000000-000000000000
	local.com/jsonresponse v0.0.0-00010101000000-000000000000
	local.com/jwt v0.0.0
)

replace local.com/cors => ../package/cors

replace local.com/jwt => ../package/jwt

replace local.com/jsonresponse => ../package/jsonresponse

replace local.com/dynamo => ../package/dynamo
