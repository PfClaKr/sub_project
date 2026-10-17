module local.com/notify

go 1.22

require (
	github.com/aws/aws-sdk-go v1.54.20
	local.com/dynamo v0.0.0
)

require github.com/jmespath/go-jmespath v0.4.0 // indirect

replace local.com/dynamo => ../dynamo
