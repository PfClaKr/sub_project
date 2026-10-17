module local.com/account

go 1.22

require (
	github.com/aws/aws-sdk-go v1.54.20
	local.com/dynamo v0.0.0
	local.com/jsonresponse v0.0.0
	local.com/jwt v0.0.0
)

require (
	github.com/golang-jwt/jwt/v5 v5.2.1 // indirect
	github.com/jmespath/go-jmespath v0.4.0 // indirect
)

replace local.com/dynamo => ../dynamo

replace local.com/jsonresponse => ../jsonresponse

replace local.com/jwt => ../jwt
