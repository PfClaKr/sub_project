module loginserver

go 1.22

require (
	github.com/aws/aws-sdk-go v1.54.20
	github.com/google/uuid v1.6.0
	github.com/gorilla/mux v1.8.1
)

require (
	github.com/golang-jwt/jwt/v5 v5.2.1 // indirect
	github.com/jmespath/go-jmespath v0.4.0 // indirect
)

require (
	golang.org/x/crypto v0.24.0
	local.com/cors v0.0.0
	local.com/dynamo v0.0.0
	local.com/jsonresponse v0.0.0
	local.com/jwt v0.0.0
)

replace local.com/cors => ../package/cors

replace local.com/jwt => ../package/jwt

replace local.com/jsonresponse => ../package/jsonresponse

replace local.com/dynamo => ../package/dynamo
