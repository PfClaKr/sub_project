package graphqlhandler

import (
	"crypto/sha1"
	"encoding/hex"
	"errors"
	"strings"
	"time"
	"unicode/utf8"

	"apiserver/throttle"

	"local.com/dynamo"

	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/service/dynamodb"
	"github.com/graphql-go/graphql"
)

// ReportReasons must match srcs/frontend/libs/constants.ts.
var ReportReasons = []string{"사기 의심", "스팸·광고", "욕설·혐오", "개인정보 노출", "불법 행위", "기타"}

// Report targets. A comment is addressed as "<postId>#<commentId>".
const (
	ReportPost    = "post"
	ReportComment = "comment"
	ReportProduct = "product"
	ReportUser    = "user"
	// A chat room (TargetId = ChatId), reported by one of its members
	// about the other; admins read the transcript.
	ReportChat = "chat"
)

const ReportOpen = "open"

var (
	errReportTarget   = errors.New("신고할 대상을 찾을 수 없어요.")
	errReportedTwice  = errors.New("이미 신고했어요. 운영진이 확인하고 있어요.")
	errTooManyReports = errors.New("신고를 너무 많이 보냈어요. 잠시 후 다시 시도해주세요.")
)

var reportLimiter = throttle.New(20, time.Hour)

// reportId is derived from target and reporter, so a conditional put
// allows one report per member and target.
func reportId(targetType, targetId, reporter string) string {
	sum := sha1.Sum([]byte(targetType + ":" + targetId + ":" + reporter))
	return hex.EncodeToString(sum[:])
}

// reportTargetOwner returns who wrote the reported thing ("" when it does
// not exist or is already gone).
func reportTargetOwner(targetType, targetId string) (string, error) {
	switch targetType {
	case ReportPost:
		item, err := getPost(targetId)
		if err != nil || item == nil || dynamo.S(item, "Status") == PostDeleted {
			return "", err
		}
		return dynamo.S(item, "AuthorId"), nil
	case ReportComment:
		postId, commentId, ok := strings.Cut(targetId, "#")
		if !ok {
			return "", nil
		}
		item, err := getComment(postId, commentId)
		if err != nil || item == nil || dynamo.S(item, "Status") == CommentDeleted {
			return "", err
		}
		return dynamo.S(item, "AuthorId"), nil
	case ReportProduct:
		item, err := getProduct(targetId, "UserId")
		if err != nil || item == nil {
			return "", err
		}
		return dynamo.S(item, "UserId"), nil
	case ReportUser:
		out, err := svc.GetItem(&dynamodb.GetItemInput{
			TableName:            aws.String(dynamo.TableUsers),
			Key:                  dynamo.Item{"UserId": {S: aws.String(targetId)}},
			ProjectionExpression: aws.String("UserId"),
		})
		if err != nil || out.Item == nil {
			return "", err
		}
		return targetId, nil
	}
	return "", nil
}

// chatPartner returns the other member of a chat room, or "" when
// userId is not in it (only members can report a conversation).
func chatPartner(chatId, userId string) (string, error) {
	out, err := svc.GetItem(&dynamodb.GetItemInput{
		TableName:            aws.String(dynamo.TableChatRooms),
		Key:                  dynamo.Item{"ChatId": {S: aws.String(chatId)}},
		ProjectionExpression: aws.String("UserSeller, UserBuyer"),
	})
	if err != nil || out.Item == nil {
		return "", err
	}
	switch userId {
	case dynamo.S(out.Item, "UserSeller"):
		return dynamo.S(out.Item, "UserBuyer"), nil
	case dynamo.S(out.Item, "UserBuyer"):
		return dynamo.S(out.Item, "UserSeller"), nil
	}
	return "", nil
}

// reportResolver files a report for the admins' queue (phase 3 adds the
// automatic hiding). Own content cannot be reported.
func reportResolver(p graphql.ResolveParams) (interface{}, error) {
	userId, err := requireUser(p)
	if err != nil {
		return nil, err
	}
	targetType, _ := p.Args["TargetType"].(string)
	targetId, _ := p.Args["TargetId"].(string)
	reason, _ := p.Args["Reason"].(string)
	detail, _ := p.Args["Detail"].(string)
	detail = strings.TrimSpace(detail)
	if !contains(ReportReasons, reason) {
		return nil, errors.New("신고 사유를 선택해주세요.")
	}
	if utf8.RuneCountInString(detail) > 500 {
		return nil, errors.New("설명은 500자 이하로 입력해주세요.")
	}
	var owner string
	if targetType == ReportChat {
		owner, err = chatPartner(targetId, userId)
	} else {
		owner, err = reportTargetOwner(targetType, targetId)
	}
	if err != nil {
		return nil, internal(err)
	}
	if owner == "" {
		return nil, errReportTarget
	}
	if owner == userId {
		return nil, errors.New("내 글은 신고할 수 없어요.")
	}
	if !reportLimiter.Allow(userId) {
		return nil, errTooManyReports
	}

	item := dynamo.Item{
		"ReportId":    {S: aws.String(reportId(targetType, targetId, userId))},
		"TargetType":  {S: aws.String(targetType)},
		"TargetId":    {S: aws.String(targetId)},
		"TargetOwner": {S: aws.String(owner)},
		"ReporterId":  {S: aws.String(userId)},
		"Reason":      {S: aws.String(reason)},
		"Status":      {S: aws.String(ReportOpen)},
		"CreatedAt":   {N: aws.String(itoa(nowMs()))},
	}
	if detail != "" {
		item["Detail"] = &dynamodb.AttributeValue{S: aws.String(detail)}
	}
	counted := reportCounts(userId)
	item["Counted"] = &dynamodb.AttributeValue{BOOL: aws.Bool(counted)}
	_, err = svc.PutItem(&dynamodb.PutItemInput{
		TableName:           aws.String(dynamo.TableReports),
		Item:                item,
		ConditionExpression: aws.String("attribute_not_exists(ReportId)"),
	})
	if isConditionFailed(err) {
		return nil, errReportedTwice
	}
	if err != nil {
		return nil, internal(err)
	}
	if counted {
		countReport(targetType, targetId)
	}
	return true, nil
}
