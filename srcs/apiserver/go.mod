module api

go 1.19

require (
	github.com/aws/aws-sdk-go v1.53.14
	github.com/gorilla/mux v1.8.1
	github.com/graphql-go/graphql v0.8.1
	github.com/jmespath/go-jmespath v0.4.0
	local.com/createtable v0.0.0
)

replace local.com/createtable v0.0.0 => ./createtable
