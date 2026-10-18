module local.com/mailer

go 1.22

require (
	github.com/aws/aws-sdk-go v1.54.20
	local.com/dynamo v0.0.0
	local.com/i18n v0.0.0
)

require github.com/jmespath/go-jmespath v0.4.0 // indirect

replace local.com/i18n => ../i18n

replace local.com/dynamo => ../dynamo
