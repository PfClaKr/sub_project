package sessionhandler

import (
	"net/http"
	"time"

	"local.com/account"
	"local.com/dynamo"
	"local.com/jsonresponse"
	"local.com/jwt"

	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/service/dynamodb"
	"github.com/aws/aws-sdk-go/service/dynamodb/dynamodbiface"
)

var svc dynamodbiface.DynamoDBAPI = dynamo.New()

// WhoamiHandler returns the logged-in user's public profile.
// Must be wrapped with jwt.Middleware.
func WhoamiHandler(w http.ResponseWriter, r *http.Request) {
	userId := jwt.UserID(r.Context())
	if userId == "" {
		jsonresponse.Error(w, http.StatusUnauthorized, "no session")
		return
	}

	resp := map[string]interface{}{"UserId": userId}
	result, err := svc.GetItem(&dynamodb.GetItemInput{
		TableName: aws.String(dynamo.TableUsers),
		Key: dynamo.Item{
			"UserId": {S: aws.String(userId)},
		},
		ProjectionExpression: aws.String("UserNickname, ProfileImage, Residence, #r, #s, SuspendedUntil"),
		// ROLE and STATUS are DynamoDB reserved words.
		ExpressionAttributeNames: map[string]*string{"#r": aws.String("Role"), "#s": aws.String("Status")},
	})
	if err == nil && result.Item != nil {
		resp["UserNickname"] = dynamo.S(result.Item, "UserNickname")
		resp["ProfileImage"] = dynamo.S(result.Item, "ProfileImage")
		resp["Residence"] = dynamo.S(result.Item, "Residence")
		// Only for showing the admin menu; the apiserver re-checks the
		// role on every admin request.
		if dynamo.S(result.Item, "Role") == "admin" {
			resp["Role"] = "admin"
		}
		// Lets the UI explain why writes fail; every service enforces it.
		if st := account.StateOf(result.Item); st.Suspended(time.Now()) {
			resp["Suspended"] = true
			resp["SuspendedUntil"] = st.Until
		}
	}
	jsonresponse.New(w, http.StatusOK, resp)
}

// LogoutHandler clears the token cookie.
func LogoutHandler(w http.ResponseWriter, r *http.Request) {
	jwt.ClearCookie(w)
	jsonresponse.New(w, http.StatusOK, map[string]string{"message": "logged out"})
}
