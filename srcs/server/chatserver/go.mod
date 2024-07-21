module chatserver

go 1.22

require (
	github.com/aws/aws-sdk-go v1.54.19
	github.com/google/uuid v1.6.0
	github.com/gorilla/mux v1.8.1
	github.com/gorilla/websocket v1.5.3
)

require (
	github.com/dgrijalva/jwt-go v3.2.0+incompatible // indirect
	github.com/jmespath/go-jmespath v0.4.0 // indirect
)

require (
	local.com/jwt v0.0.0
	local.com/jsonresponse v0.0.0
)

replace local.com/jwt v0.0.0 => ../package/jwt

replace local.com/jsonresponse v0.0.0 => ../package/jsonresponse
