package graphqlhandler

import (
	"errors"
	"log"
	"strings"
	"time"

	"local.com/dynamo"
	"local.com/notify"

	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/service/dynamodb"
)

// AutoHideReports: a post or comment is hidden once this many counted
// reports (distinct members, see reportCounts) pile up. An admin then
// restores or removes it from the report queue.
const AutoHideReports = 3

// accountAge returns how long a member has existed and whether they are
// an admin, for rules that trust established accounts.
func accountAge(userId string) (time.Duration, bool, error) {
	out, err := svc.GetItem(&dynamodb.GetItemInput{
		TableName:                aws.String(dynamo.TableUsers),
		Key:                      dynamo.Item{"UserId": {S: aws.String(userId)}},
		ProjectionExpression:     aws.String("CreatedAt, #r"),
		ExpressionAttributeNames: map[string]*string{"#r": aws.String("Role")},
	})
	if err != nil {
		return 0, false, err
	}
	created := time.Unix(int64(num(out.Item, "CreatedAt")), 0) // seconds
	return time.Since(created), dynamo.S(out.Item, "Role") == "admin", nil
}

// reportCounts: reports from accounts younger than the listing threshold
// are kept for the queue but do not count toward hiding, so a handful of
// fresh accounts cannot take a post down.
func reportCounts(reporter string) bool {
	age, admin, err := accountAge(reporter)
	if err != nil {
		log.Printf("report weight %s: %v", reporter, err)
		return false
	}
	return admin || age >= minAccountAge()
}

// countReport adds a counted report to the target and hides it at the
// threshold. Products and members are only queued for the admins.
func countReport(targetType, targetId string) {
	var table string
	var key dynamo.Item
	switch targetType {
	case ReportPost:
		table, key = dynamo.TablePosts, dynamo.Item{"PostId": {S: aws.String(targetId)}}
	case ReportComment:
		postId, commentId, _ := strings.Cut(targetId, "#")
		table, key = dynamo.TableComments, dynamo.Item{"PostId": {S: aws.String(postId)}, "CommentId": {S: aws.String(commentId)}}
	default:
		return
	}
	out, err := svc.UpdateItem(&dynamodb.UpdateItemInput{
		TableName:                 aws.String(table),
		Key:                       key,
		UpdateExpression:          aws.String("ADD ReportCount :one"),
		ExpressionAttributeValues: dynamo.Item{":one": {N: aws.String("1")}},
		ReturnValues:              aws.String(dynamodb.ReturnValueAllNew),
	})
	if err != nil {
		log.Printf("count report %s %s: %v", targetType, targetId, err)
		return
	}
	if int(num(out.Attributes, "ReportCount")) < AutoHideReports || dynamo.S(out.Attributes, "Status") != PostActive {
		return
	}
	if targetType == ReportPost {
		err = ModeratePost(targetId, PostHidden)
	} else {
		postId, commentId, _ := strings.Cut(targetId, "#")
		err = ModerateComment(postId, commentId, CommentHidden)
	}
	if err != nil {
		log.Printf("auto-hide %s %s: %v", targetType, targetId, err)
	}
}

// Exported for the admin API.
var (
	ErrBadModeration = errors.New("이 상태로 바꿀 수 없어요.")
	ErrPostNotFound  = errPostNotFound
)

func postPath(item dynamo.Item) string {
	if isListingType(dynamo.S(item, "Type")) {
		return listingLink(item)
	}
	return postLink(dynamo.S(item, "PostId"), "")
}

// ModeratePost hides, restores or deletes a post (admin queue and
// auto-hide) and tells the author when it is hidden or restored.
func ModeratePost(postId, status string) error {
	if status != PostActive && status != PostHidden && status != PostDeleted {
		return ErrBadModeration
	}
	item, err := getPost(postId)
	if err != nil {
		return err
	}
	if item == nil {
		return errPostNotFound
	}
	was := dynamo.S(item, "Status")
	if was == status {
		return nil
	}
	if err := setPostStatus(postId, status); err != nil {
		return err
	}
	var typ string
	switch {
	case status == PostHidden:
		typ = notify.TypeHidden
	case status == PostActive && was == PostHidden:
		typ = notify.TypeRestored
	}
	if typ != "" {
		if err := notifier().Publish(notify.Event{
			UserId: dynamo.S(item, "AuthorId"), Type: typ, TargetType: "post", TargetId: postId,
			Preview: dynamo.S(item, "Title"), Link: postPath(item),
		}); err != nil {
			log.Printf("notify moderation %s: %v", postId, err)
		}
	}
	return nil
}

// ModerateComment is ModeratePost for comments.
func ModerateComment(postId, commentId, status string) error {
	if status != CommentActive && status != CommentHidden && status != CommentDeleted {
		return ErrBadModeration
	}
	c, err := getComment(postId, commentId)
	if err != nil {
		return err
	}
	if c == nil {
		return errCommentNotFound
	}
	was := dynamo.S(c, "Status")
	if was == status {
		return nil
	}
	if err := setCommentStatus(postId, commentId, status); err != nil {
		return err
	}
	var typ string
	switch {
	case status == CommentHidden:
		typ = notify.TypeHidden
	case status == CommentActive && was == CommentHidden:
		typ = notify.TypeRestored
	}
	if typ != "" {
		if err := notifier().Publish(notify.Event{
			UserId: dynamo.S(c, "AuthorId"), Type: typ, TargetType: "comment", TargetId: postId + "#" + commentId,
			Preview: dynamo.S(c, "Body"), Link: postLink(postId, commentId),
		}); err != nil {
			log.Printf("notify moderation %s#%s: %v", postId, commentId, err)
		}
	}
	return nil
}

// ReportTarget describes a reported thing for the admin queue.
type ReportTarget struct {
	Title, Body, Status, Link, OwnerId string
	Flags                              []string
	ReportCount                        int
	Anonymous                          bool
}

// DescribeReportTarget loads what the queue shows about a target; nil
// when it no longer exists.
func DescribeReportTarget(targetType, targetId string) (*ReportTarget, error) {
	switch targetType {
	case ReportPost:
		item, err := getPost(targetId)
		if err != nil || item == nil {
			return nil, err
		}
		return &ReportTarget{
			Title: dynamo.S(item, "Title"), Body: preview(dynamo.S(item, "Body")), Status: dynamo.S(item, "Status"),
			Link: postPath(item), OwnerId: dynamo.S(item, "AuthorId"), Flags: listOf(item["Flags"]),
			ReportCount: int(num(item, "ReportCount")), Anonymous: boolOf(item, "Anonymous"),
		}, nil
	case ReportComment:
		postId, commentId, _ := strings.Cut(targetId, "#")
		c, err := getComment(postId, commentId)
		if err != nil || c == nil {
			return nil, err
		}
		// The post's title tells the admin where the comment was left.
		title := "댓글"
		if post, err := getPost(postId); err == nil && post != nil {
			title = "“" + dynamo.S(post, "Title") + "”의 댓글"
		}
		return &ReportTarget{
			Title: title, Body: preview(dynamo.S(c, "Body")), Status: dynamo.S(c, "Status"),
			Link: postLink(postId, commentId), OwnerId: dynamo.S(c, "AuthorId"),
			ReportCount: int(num(c, "ReportCount")), Anonymous: boolOf(c, "Anonymous"),
		}, nil
	case ReportProduct:
		item, err := getProduct(targetId, "ProductId, UserId, ProductName, ProductDescription, ProductStatus")
		if err != nil || item == nil {
			return nil, err
		}
		return &ReportTarget{
			Title: dynamo.S(item, "ProductName"), Body: preview(dynamo.S(item, "ProductDescription")),
			Status: dynamo.S(item, "ProductStatus"), Link: "/product/" + targetId, OwnerId: dynamo.S(item, "UserId"),
		}, nil
	case ReportUser:
		out, err := svc.GetItem(&dynamodb.GetItemInput{
			TableName:            aws.String(dynamo.TableUsers),
			Key:                  dynamo.Item{"UserId": {S: aws.String(targetId)}},
			ProjectionExpression: aws.String("UserId, UserNickname"),
		})
		if err != nil || out.Item == nil {
			return nil, err
		}
		return &ReportTarget{Title: dynamo.S(out.Item, "UserNickname"), Link: "/user/" + targetId, OwnerId: targetId}, nil
	case ReportChat:
		room, err := svc.GetItem(&dynamodb.GetItemInput{
			TableName:            aws.String(dynamo.TableChatRooms),
			Key:                  dynamo.Item{"ChatId": {S: aws.String(targetId)}},
			ProjectionExpression: aws.String("ChatId"),
		})
		if err != nil || room.Item == nil {
			return nil, err
		}
		// The last messages as a preview; the owner is the reported member
		// stored on the report, so OwnerId stays empty here.
		msgs, err := svc.Query(&dynamodb.QueryInput{
			TableName:                 aws.String(dynamo.TableChatMessage),
			IndexName:                 aws.String("ChatIndex"),
			KeyConditionExpression:    aws.String("ChatId = :c"),
			ExpressionAttributeValues: dynamo.Item{":c": {S: aws.String(targetId)}},
			ScanIndexForward:          aws.Bool(false),
			Limit:                     aws.Int64(3),
		})
		if err != nil {
			return nil, err
		}
		var lines []string
		for i := len(msgs.Items) - 1; i >= 0; i-- {
			lines = append(lines, dynamo.S(msgs.Items[i], "Content"))
		}
		return &ReportTarget{Title: "채팅 대화", Body: preview(strings.Join(lines, " / ")), Link: "/admin/conversations/" + targetId}, nil
	}
	return nil, nil
}
