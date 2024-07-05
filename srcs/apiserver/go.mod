module apiserver

go 1.22

require (
	local.com/createtable v0.0.0
	local.com/graphqlhandler v0.0.0
	local.com/jwt v0.0.0
	local.com/eshandler v0.0.0
	local.com/loginhandler v0.0.0
)

require (
	github.com/aws/aws-sdk-go v1.53.14
	github.com/gorilla/mux v1.8.1
	github.com/dgrijalva/jwt-go v3.2.0+incompatible // indirect
	github.com/elastic/elastic-transport-go/v8 v8.6.0 // indirect
	github.com/elastic/go-elasticsearch/v8 v8.14.0 // indirect
	github.com/go-logr/logr v1.4.1 // indirect
	github.com/go-logr/stdr v1.2.2 // indirect
	github.com/google/uuid v1.6.0 // indirect
	github.com/graphql-go/graphql v0.8.1 // indirect
	github.com/jmespath/go-jmespath v0.4.0 // indirect
	go.opentelemetry.io/otel v1.24.0 // indirect
	go.opentelemetry.io/otel/metric v1.24.0 // indirect
	go.opentelemetry.io/otel/trace v1.24.0 // indirect
)

replace local.com/createtable v0.0.0 => ./createtable

replace local.com/graphqlhandler v0.0.0 => ./graphQL

replace local.com/eshandler v0.0.0 => ./eshandler

replace local.com/jwt v0.0.0 => ./jwt

replace local.com/loginhandler v0.0.0 => ./login