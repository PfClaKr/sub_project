module apiserver

go 1.22

require (
	github.com/aws/aws-sdk-go v1.54.20
	github.com/dgrijalva/jwt-go v3.2.0+incompatible // indirect
	github.com/elastic/go-elasticsearch/v8 v8.14.0
	github.com/google/uuid v1.6.0
	github.com/gorilla/mux v1.8.1
	github.com/graphql-go/graphql v0.8.1
)

require (
	github.com/elastic/elastic-transport-go/v8 v8.6.0 // indirect
	github.com/go-logr/logr v1.4.2 // indirect
	github.com/go-logr/stdr v1.2.2 // indirect
	github.com/jmespath/go-jmespath v0.4.0 // indirect
	go.opentelemetry.io/otel v1.28.0 // indirect
	go.opentelemetry.io/otel/metric v1.28.0 // indirect
	go.opentelemetry.io/otel/trace v1.28.0 // indirect
)

require local.com/jwt v0.0.0

replace local.com/jwt v0.0.0 => ../package/jwt
