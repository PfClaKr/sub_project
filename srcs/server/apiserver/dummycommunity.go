package main

import (
	"fmt"
	"strconv"
	"time"

	"apiserver/eshandler"
	"apiserver/graphqlhandler"

	"local.com/dynamo"

	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/service/dynamodb"
)

// Debug-only community data seeded together with the dummy users.
const dummyPostPrefix = "dummy-post-"

type mockPost struct {
	typ, topic, city, title, body string
	anonymous, solved             bool
	likes                         int
	comments                      []string
}

var mockPosts = []mockPost{
	{"qna", "체류증·비자", "파리", "학생 체류증 갱신, ANEF 온라인 신청 언제부터 가능한가요?",
		"9월 말에 만료되는데 온라인 신청이 언제 열리는지 궁금해요. 만료 몇 달 전부터 신청하셨나요?", false, true, 6,
		[]string{"만료 4개월 전부터 됐어요. 저는 6월 초에 넣었습니다.", "récépissé는 신청하고 바로 다운받을 수 있어요."}},
	{"qna", "행정·CAF·세금", "파리", "CAF 주거보조금(APL) 신청할 때 집주인 서류가 꼭 필요한가요?",
		"집주인이 attestation de loyer를 안 써줘요. 다른 방법이 있을까요?", true, false, 3,
		[]string{"집주인이 CAF 사이트에서 직접 입력해도 돼요."}},
	{"qna", "은행·통신", "일드프랑스", "외국인도 바로 만들 수 있는 은행 추천해주세요",
		"체류증 받기 전인데 계좌가 필요해요. 온라인 은행 써보신 분 계신가요?", false, false, 4,
		[]string{"저는 온라인 은행으로 일주일 만에 만들었어요.", "학생이면 학교 근처 지점에서 학생 계좌 문의해보세요."}},
	{"qna", "의료", "파리", "한국어 가능한 일반의(médecin traitant) 아시는 분?",
		"medecin traitant 등록하려는데 아직 프랑스어가 서툴러서요.", true, false, 2, nil},
	{"free", "맛집·장보기", "파리", "13구 아시아 마트에서 한국 라면 할인 중이에요",
		"이번 주말까지 묶음 할인한대요. 떡볶이 떡도 들어왔어요!", false, false, 9,
		[]string{"정보 감사해요! 내일 가봐야겠네요."}},
	{"free", "행사·모임", "파리", "토요일 오후 뷔트쇼몽 공원 산책 모임 하실 분",
		"날씨 좋으면 2시에 정문 앞에서 만나요. 편하게 오세요.", false, false, 5, nil},
	{"free", "고민", "리옹", "리옹으로 이사 온 지 한 달, 친구 사귀기 어렵네요",
		"한인 모임이나 언어교환 어디서 찾으시나요?", true, false, 7,
		[]string{"리옹 한인회 행사에 가보세요!", "대학 언어교환 프로그램 추천해요."}},
	{"free", "정보", "파리", "나비고 이매진R 학생 할인 신청 방법 정리",
		"9월 신학기 전에 신청하면 좋아요. 필요한 서류는 학생증, 증명사진, 주소 증명이에요.", false, false, 11, nil},
}

func seedDummyPosts(users int) error {
	ts := time.Now().UnixMilli()
	for i, p := range mockPosts {
		postId := fmt.Sprintf("%s%d", dummyPostPrefix, i+1)
		author := fmt.Sprintf("%s%d", dummyUserPrefix, i%users+1)
		created := strconv.FormatInt(ts-int64(i)*5400_000, 10)
		item := dynamo.Item{
			"PostId":       {S: aws.String(postId)},
			"Type":         {S: aws.String(p.typ)},
			"Topic":        {S: aws.String(p.topic)},
			"Country":      {S: aws.String(graphqlhandler.DefaultCountry)},
			"City":         {S: aws.String(p.city)},
			"AuthorId":     {S: aws.String(author)},
			"Anonymous":    {BOOL: aws.Bool(p.anonymous)},
			"AnonMap":      {M: dynamo.Item{}},
			"AnonSeq":      {N: aws.String("0")},
			"Title":        {S: aws.String(p.title)},
			"Body":         {S: aws.String(p.body)},
			"Status":       {S: aws.String(graphqlhandler.PostActive)},
			"Solved":       {BOOL: aws.Bool(false)},
			"CreatedAt":    {N: aws.String(created)},
			"UpdatedAt":    {N: aws.String(created)},
			"CommentCount": {N: aws.String(strconv.Itoa(len(p.comments)))},
			"LikeCount":    {N: aws.String(strconv.Itoa(p.likes))},
			"ViewCount":    {N: aws.String(strconv.Itoa(p.likes*7 + 3))},
		}
		for j, body := range p.comments {
			commentId := fmt.Sprintf("%013d-dummy%d", ts-int64(i)*5400_000+int64(j+1)*60_000, j)
			commenter := fmt.Sprintf("%s%d", dummyUserPrefix, (i+j+1)%users+1)
			if commenter == author {
				commenter = fmt.Sprintf("%s%d", dummyUserPrefix, (i+j+2)%users+1)
			}
			if _, err := svc.PutItem(&dynamodb.PutItemInput{TableName: aws.String(dynamo.TableComments), Item: dynamo.Item{
				"PostId":    {S: aws.String(postId)},
				"CommentId": {S: aws.String(commentId)},
				"AuthorId":  {S: aws.String(commenter)},
				"Body":      {S: aws.String(body)},
				"Anonymous": {BOOL: aws.Bool(false)},
				"Status":    {S: aws.String(graphqlhandler.CommentActive)},
				"CreatedAt": {N: aws.String(commentId[:13])},
			}}); err != nil {
				return err
			}
			if j == 0 && p.solved {
				item["AcceptedCommentId"] = &dynamodb.AttributeValue{S: aws.String(commentId)}
				item["Solved"] = &dynamodb.AttributeValue{BOOL: aws.Bool(true)}
			}
		}
		if _, err := svc.PutItem(&dynamodb.PutItemInput{TableName: aws.String(dynamo.TablePosts), Item: item}); err != nil {
			return err
		}
		if err := eshandler.IndexPost(eshandler.PostDocFromItem(item)); err != nil {
			return err
		}
	}
	return nil
}

// deleteDummyPosts removes the seeded posts with their comments.
func deleteDummyPosts() (int, error) {
	deleted := 0
	for i := range mockPosts {
		postId := fmt.Sprintf("%s%d", dummyPostPrefix, i+1)
		comments, err := dynamo.QueryAll(svc, &dynamodb.QueryInput{
			TableName:                 aws.String(dynamo.TableComments),
			KeyConditionExpression:    aws.String("PostId = :p"),
			ExpressionAttributeValues: dynamo.Item{":p": {S: aws.String(postId)}},
			ProjectionExpression:      aws.String("PostId, CommentId"),
		})
		if err != nil {
			return deleted, err
		}
		for _, c := range comments {
			if _, err := svc.DeleteItem(&dynamodb.DeleteItemInput{
				TableName: aws.String(dynamo.TableComments),
				Key:       dynamo.Item{"PostId": c["PostId"], "CommentId": c["CommentId"]},
			}); err != nil {
				return deleted, err
			}
		}
		out, err := svc.DeleteItem(&dynamodb.DeleteItemInput{
			TableName:    aws.String(dynamo.TablePosts),
			Key:          dynamo.Item{"PostId": {S: aws.String(postId)}},
			ReturnValues: aws.String(dynamodb.ReturnValueAllOld),
		})
		if err != nil {
			return deleted, err
		}
		if out.Attributes != nil {
			deleted++
		}
		eshandler.DeletePost(postId)
	}
	return deleted, nil
}
