module local.com/notify

go 1.22

require (
	github.com/SherClockHolmes/webpush-go v1.4.0
	github.com/aws/aws-sdk-go v1.54.20
	local.com/dynamo v0.0.0
	local.com/jwt v0.0.0
	local.com/mailer v0.0.0
)

require (
	github.com/golang-jwt/jwt/v5 v5.2.1 // indirect
	github.com/jmespath/go-jmespath v0.4.0 // indirect
	golang.org/x/crypto v0.31.0 // indirect
)

replace local.com/dynamo => ../dynamo

replace local.com/jwt => ../jwt

replace local.com/mailer => ../mailer
