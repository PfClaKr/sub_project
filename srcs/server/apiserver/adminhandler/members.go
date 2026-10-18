package adminhandler

import (
	"log"
	"net/http"

	"apiserver/graphqlhandler"
	"apiserver/uploadhandler"

	"local.com/dynamo"
	"local.com/jsonresponse"
	"local.com/jwt"

	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/service/dynamodb"
)

// DeleteMember removes a member, by an admin or by the member leaving
// (DELETE /account). What happens is what the privacy policy says
// (srcs/frontend/components/legal):
//   - account, login, profile photo, products with their photos,
//     favorites, likes, bookmarks, notifications, push devices and the
//     member's own blocks are deleted now;
//   - housing/job posts are deleted (purged after RecordRetention);
//     community posts and comments stay, shown as "탈퇴한 회원";
//   - chat rooms and messages, and reports by or about the member, are
//     kept RecordRetention for disputes and moderation, then purged.
//
// It returns the number of products removed.
func DeleteMember(userId string) (int, error) {
	defer graphqlhandler.ForgetUser(userId)
	user, err := svc.GetItem(&dynamodb.GetItemInput{
		TableName: aws.String(dynamo.TableUsers),
		Key:       dynamo.Item{"UserId": {S: aws.String(userId)}},
	})
	if err != nil || user.Item == nil {
		return 0, err
	}

	products, err := queryBy(dynamo.TableProduct, "UserIndex", "UserId", userId)
	if err != nil {
		return 0, err
	}
	for _, p := range products {
		if err := graphqlhandler.RemoveProduct(dynamo.S(p, "ProductId"), userId); err != nil {
			return 0, err
		}
	}

	// Housing and job posts go with the account (nobody can answer them
	// any more); community posts stay, shown as "탈퇴한 회원", because the
	// answers in them keep helping others.
	posts, err := queryBy(dynamo.TablePosts, "AuthorIndex", "AuthorId", userId)
	if err != nil {
		return 0, err
	}
	for _, p := range posts {
		t, status := dynamo.S(p, "Type"), dynamo.S(p, "Status")
		if (t == graphqlhandler.PostTypeHousing || t == graphqlhandler.PostTypeJob) && status != graphqlhandler.PostDeleted {
			if err := graphqlhandler.ModeratePost(dynamo.S(p, "PostId"), graphqlhandler.PostDeleted); err != nil {
				return 0, err
			}
		}
	}

	for _, t := range []struct{ table, rangeKey string }{
		{dynamo.TableFavorites, "ItemId"},
		{dynamo.TablePostLikes, "PostId"},
		{dynamo.TableBookmarks, "PostId"},
		{dynamo.TableNotifications, "SortKey"},
		{dynamo.TablePushSubs, "EndpointHash"},
		{dynamo.TableBlocks, "BlockedId"},
	} {
		rows, err := queryBy(t.table, "", "UserId", userId)
		if err != nil {
			return 0, err
		}
		for _, row := range rows {
			if _, err := svc.DeleteItem(&dynamodb.DeleteItemInput{
				TableName: aws.String(t.table),
				Key:       dynamo.Item{"UserId": row["UserId"], t.rangeKey: row[t.rangeKey]},
			}); err != nil {
				return 0, err
			}
		}
	}

	if err := keepChatsForRetention(userId); err != nil {
		return 0, err
	}
	if err := keepReportsForRetention(userId); err != nil {
		return 0, err
	}

	uploadhandler.DeleteImages(dynamo.S(user.Item, "ProfileImage"))
	if email := dynamo.S(user.Item, "Email"); email != "" {
		if _, err := svc.DeleteItem(&dynamodb.DeleteItemInput{
			TableName: aws.String(dynamo.TableUsersCredential),
			Key:       dynamo.Item{"Email": {S: aws.String(email)}},
		}); err != nil {
			return 0, err
		}
	}
	_, err = svc.DeleteItem(&dynamodb.DeleteItemInput{
		TableName: aws.String(dynamo.TableUsers),
		Key:       dynamo.Item{"UserId": {S: aws.String(userId)}},
	})
	return len(products), err
}

// keepChatsForRetention marks the member's rooms and their messages for
// removal after RecordRetention (the other member keeps them until then).
func keepChatsForRetention(userId string) error {
	for index, key := range map[string]string{"SellerIndex": "UserSeller", "BuyerIndex": "UserBuyer"} {
		rooms, err := queryBy(dynamo.TableChatRooms, index, key, userId)
		if err != nil {
			return err
		}
		for _, room := range rooms {
			chatId := dynamo.S(room, "ChatId")
			messages, err := queryBy(dynamo.TableChatMessage, "ChatIndex", "ChatId", chatId)
			if err != nil {
				return err
			}
			for _, m := range messages {
				if err := setPurge(dynamo.TableChatMessage, dynamo.Item{"MessageId": m["MessageId"]}); err != nil {
					return err
				}
			}
			if err := setPurge(dynamo.TableChatRooms, dynamo.Item{"ChatId": room["ChatId"]}); err != nil {
				return err
			}
		}
	}
	return nil
}

// keepReportsForRetention marks reports filed by or about the member.
func keepReportsForRetention(userId string) error {
	reports, err := dynamo.ScanAll(svc, &dynamodb.ScanInput{
		TableName:                 aws.String(dynamo.TableReports),
		ProjectionExpression:      aws.String("ReportId"),
		FilterExpression:          aws.String("ReporterId = :u OR TargetOwner = :u"),
		ExpressionAttributeValues: dynamo.Item{":u": {S: aws.String(userId)}},
	})
	if err != nil {
		return err
	}
	for _, r := range reports {
		if err := setPurge(dynamo.TableReports, dynamo.Item{"ReportId": r["ReportId"]}); err != nil {
			return err
		}
	}
	return nil
}

func setPurge(table string, key dynamo.Item) error {
	_, err := svc.UpdateItem(&dynamodb.UpdateItemInput{
		TableName:                 aws.String(table),
		Key:                       key,
		UpdateExpression:          aws.String("SET PurgeAt = :p"),
		ExpressionAttributeValues: dynamo.Item{":p": graphqlhandler.PurgeAt()},
	})
	return err
}

func queryBy(table, index, key, value string) ([]dynamo.Item, error) {
	in := &dynamodb.QueryInput{
		TableName:                 aws.String(table),
		KeyConditionExpression:    aws.String("#k = :v"),
		ExpressionAttributeNames:  map[string]*string{"#k": aws.String(key)},
		ExpressionAttributeValues: dynamo.Item{":v": {S: aws.String(value)}},
	}
	if index != "" {
		in.IndexName = aws.String(index)
	}
	return dynamo.QueryAll(svc, in)
}

// LeaveHandler (DELETE /account, logged in) deletes the caller's own
// account and logs them out. Admins are demoted by another admin first,
// so the site never loses its last admin by accident.
func LeaveHandler(w http.ResponseWriter, r *http.Request) {
	userId := jwt.UserID(r.Context())
	role, err := Role(userId)
	if err != nil {
		jsonresponse.Internal(w, err)
		return
	}
	if role == RoleAdmin {
		jsonresponse.Error(w, http.StatusBadRequest, "관리자 계정은 다른 관리자가 권한을 해제한 뒤 탈퇴할 수 있어요.")
		return
	}
	if _, err := DeleteMember(userId); err != nil {
		jsonresponse.Internal(w, err)
		return
	}
	log.Printf("user %s left", userId)
	jwt.ClearCookie(w)
	jsonresponse.New(w, http.StatusOK, map[string]bool{"deleted": true})
}
