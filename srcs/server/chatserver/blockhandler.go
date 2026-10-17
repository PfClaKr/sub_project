package main

import (
	"net/http"
	"strconv"

	"local.com/account"
	"local.com/dynamo"
	"local.com/jsonresponse"
	"local.com/jwt"

	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/service/dynamodb"
	"github.com/gorilla/mux"
)

// BlockedUser is one entry of the member's block list.
type BlockedUser struct {
	UserId       string `json:"UserId"`
	UserNickname string `json:"UserNickname"`
	CreatedAt    int64  `json:"CreatedAt"`
}

// listBlocksHandler (GET /blocks) returns who the member blocked.
func listBlocksHandler(w http.ResponseWriter, r *http.Request) {
	items, err := account.BlockedBy(svc, jwt.UserID(r.Context()))
	if err != nil {
		jsonresponse.Internal(w, err)
		return
	}
	ids := make([]string, 0, len(items))
	for _, it := range items {
		ids = append(ids, dynamo.S(it, "BlockedId"))
	}
	users, err := dynamo.BatchGet(svc, dynamo.TableUsers, "UserId", ids, "UserId, UserNickname")
	if err != nil {
		jsonresponse.Internal(w, err)
		return
	}
	list := make([]BlockedUser, 0, len(items))
	for _, it := range items {
		id := dynamo.S(it, "BlockedId")
		b := BlockedUser{UserId: id, UserNickname: dynamo.S(users[id], "UserNickname")}
		if v := it["CreatedAt"]; v != nil && v.N != nil {
			b.CreatedAt, _ = strconv.ParseInt(*v.N, 10, 64)
		}
		list = append(list, b)
	}
	jsonresponse.New(w, http.StatusOK, list)
}

// blockHandler (PUT /blocks/{userId}) blocks a member.
func blockHandler(w http.ResponseWriter, r *http.Request) {
	userId := jwt.UserID(r.Context())
	target := mux.Vars(r)["userId"]
	if target == userId {
		jsonresponse.Error(w, http.StatusBadRequest, "나 자신은 차단할 수 없어요.")
		return
	}
	out, err := svc.GetItem(&dynamodb.GetItemInput{
		TableName:            aws.String(dynamo.TableUsers),
		Key:                  dynamo.Item{"UserId": {S: aws.String(target)}},
		ProjectionExpression: aws.String("UserId"),
	})
	if err != nil {
		jsonresponse.Internal(w, err)
		return
	}
	if out.Item == nil {
		jsonresponse.Error(w, http.StatusNotFound, "회원을 찾을 수 없어요.")
		return
	}
	if err := account.Block(svc, userId, target); err != nil {
		jsonresponse.Internal(w, err)
		return
	}
	jsonresponse.New(w, http.StatusOK, map[string]bool{"blocked": true})
}

// unblockHandler (DELETE /blocks/{userId}) lifts a block.
func unblockHandler(w http.ResponseWriter, r *http.Request) {
	if err := account.Unblock(svc, jwt.UserID(r.Context()), mux.Vars(r)["userId"]); err != nil {
		jsonresponse.Internal(w, err)
		return
	}
	jsonresponse.New(w, http.StatusOK, map[string]bool{"blocked": false})
}
