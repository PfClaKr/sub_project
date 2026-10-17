package main

import (
	"fmt"
	"strconv"
	"time"

	"apiserver/eshandler"
	"apiserver/geohandler"
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

type mockListing struct {
	typ, topic, city, title, body string
	lat, lng                      float64
	exact                         bool
	fields                        dynamo.Item
	images                        int
}

func num(f float64) *dynamodb.AttributeValue {
	return &dynamodb.AttributeValue{N: aws.String(strconv.FormatFloat(f, 'f', -1, 64))}
}

func flag(b bool) *dynamodb.AttributeValue { return &dynamodb.AttributeValue{BOOL: aws.Bool(b)} }

func str(s string) *dynamodb.AttributeValue { return &dynamodb.AttributeValue{S: aws.String(s)} }

func inDays(d int) string { return time.Now().AddDate(0, 0, d).Format("2006-01-02") }

var mockListings = []mockListing{
	{"housing", "쉐어", "파리", "15구 메트로 6분, 채광 좋은 쉐어 방", "한국인 2명과 함께 사는 3룸 아파트의 방 하나예요. 조용하고 깨끗하게 지내실 분이면 좋겠어요.",
		48.8414, 2.2920, false, dynamo.Item{"Mode": str("offer"), "Kind": str("쉐어"), "Rent": num(690), "ChargesIncluded": flag(true), "Deposit": num(690),
			"AvailableFrom": str(inDays(10)), "MinMonths": num(6), "Size": num(12), "Furnished": flag(true), "Caf": flag(true), "Pets": flag(false)}, 3},
	{"housing", "스튜디오·원룸", "파리", "11구 스튜디오, 리모델링 완료", "오베르캄프 근처 22m² 스튜디오입니다. 학생 환영해요.",
		48.8635, 2.3790, false, dynamo.Item{"Mode": str("offer"), "Kind": str("스튜디오·원룸"), "Rent": num(980), "ChargesIncluded": flag(false), "Deposit": num(1960),
			"AvailableFrom": str(inDays(25)), "Size": num(22), "Rooms": num(1), "Furnished": flag(true), "Caf": flag(true), "Pets": flag(false)}, 2},
	{"housing", "서블렛", "일드프랑스", "방학 동안 서블렛 (불로뉴)", "7~8월 한국에 다녀오는 동안 방을 내놓아요. 고양이 밥만 챙겨주실 분!",
		48.8350, 2.2400, false, dynamo.Item{"Mode": str("offer"), "Kind": str("서블렛"), "Rent": num(550), "ChargesIncluded": flag(true),
			"AvailableFrom": str(inDays(40)), "EndDate": str(inDays(100)), "Furnished": flag(true), "Pets": flag(true)}, 2},
	{"housing", "쉐어", "파리", "13구·14구 쉐어 구해요 (학생, 비흡연)", "9월부터 1년 지낼 방을 찾고 있어요. 최대 700유로까지 생각해요.",
		48.8322, 2.3561, false, dynamo.Item{"Mode": str("seek"), "Kind": str("쉐어"), "Rent": num(700), "AvailableFrom": str(inDays(30)), "MinMonths": num(12)}, 0},
	{"job", "식당·카페", "파리", "오페라 한식당 주말 홀서빙 구해요", "토·일 점심 근무, 한국어 가능하신 분. 식사 제공.",
		48.8700, 2.3320, true, dynamo.Item{"Mode": str("hiring"), "Sector": str("식당·카페"), "Employment": str("알바"), "WageType": str("hourly"), "Wage": num(12.5),
			"Schedule": str("토·일 11시~16시"), "PermitRequired": flag(true), "Languages": {L: []*dynamodb.AttributeValue{str("한국어"), str("프랑스어")}}}, 0},
	{"job", "과외·강사", "파리", "초등학생 한국어 과외 선생님 찾아요", "15구 거주, 주 2회 1시간씩 한국어 읽기·쓰기 봐주실 분.",
		48.8420, 2.2990, false, dynamo.Item{"Mode": str("hiring"), "Sector": str("과외·강사"), "Employment": str("프리랜서"), "WageType": str("hourly"), "Wage": num(20),
			"Schedule": str("주 2회 평일 저녁"), "PermitRequired": flag(false), "Languages": {L: []*dynamodb.AttributeValue{str("한국어")}}}, 0},
	{"job", "가이드·통역", "파리", "한-불 통역 가능합니다 (전시회, 상담)", "통번역 석사 과정 중이에요. 박람회·병원 동행 통역 가능해요.",
		48.8566, 2.3522, false, dynamo.Item{"Mode": str("seeking"), "Sector": str("가이드·통역"), "Employment": str("프리랜서"), "WageType": str("negotiable"),
			"PermitRequired": flag(false), "Languages": {L: []*dynamodb.AttributeValue{str("한국어"), str("프랑스어"), str("영어")}}}, 0},
}

// seedDummyListings adds housing and job posts.
func seedDummyListings(users int) error {
	now := time.Now()
	for i, l := range mockListings {
		postId := fmt.Sprintf("%slisting-%d", dummyPostPrefix, i+1)
		author := fmt.Sprintf("%s%d", dummyUserPrefix, (i+3)%users+1)
		item := listingItem(l, postId, author, now.Add(-time.Duration(i)*3*time.Hour))
		item["ViewCount"] = num(float64(10 + i*7))
		if err := putPost(item); err != nil {
			return err
		}
	}
	return nil
}

// listingItem builds an open housing/job post. Neighbourhoods come from
// OpenStreetMap when reachable; otherwise the plain point is kept.
func listingItem(l mockListing, postId, authorId string, created time.Time) dynamo.Item {
	ms := float64(created.UnixMilli())
	item := dynamo.Item{
		"PostId": str(postId), "Type": str(l.typ), "Topic": str(l.topic), "Country": str(graphqlhandler.DefaultCountry),
		"City": str(l.city), "AuthorId": str(authorId), "Anonymous": flag(false),
		"Title": str(l.title), "Body": str(l.body), "Status": str(graphqlhandler.PostActive), "Deal": str(graphqlhandler.DealOpen),
		"CreatedAt": num(ms), "UpdatedAt": num(ms),
		"ExpiresAt":      num(float64(time.Now().Add(graphqlhandler.ListingLifetime).UnixMilli())),
		"ExpiryNotified": flag(false), "CommentCount": num(0), "LikeCount": num(0), "ViewCount": num(0),
		"Latitude": num(l.lat), "Longitude": num(l.lng), "ExactLocation": flag(l.exact),
	}
	if l.typ == "housing" {
		item["Housing"] = &dynamodb.AttributeValue{M: l.fields}
	} else {
		item["Job"] = &dynamodb.AttributeValue{M: l.fields}
	}
	if area, err := geohandler.Resolve(l.lat, l.lng); err == nil {
		item["AreaId"], item["AreaName"] = str(area.AreaId), str(area.Label())
		if !l.exact {
			item["Latitude"], item["Longitude"] = num(area.CenterLat), num(area.CenterLng)
		}
	}
	if l.images > 0 {
		var imgs []*dynamodb.AttributeValue
		for k := 0; k < l.images; k++ {
			imgs = append(imgs, str(fmt.Sprintf("https://picsum.photos/seed/%s%c/800/600", postId, 'a'+k)))
		}
		item["Images"] = &dynamodb.AttributeValue{L: imgs}
	}
	return item
}

// putPost stores a post row and indexes it for the boards.
func putPost(item dynamo.Item) error {
	if _, err := svc.PutItem(&dynamodb.PutItemInput{TableName: aws.String(dynamo.TablePosts), Item: item}); err != nil {
		return err
	}
	return eshandler.IndexPost(eshandler.PostDocFromItem(item))
}

func seedDummyPosts(users int) error {
	if err := seedDummyListings(users); err != nil {
		return err
	}
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
	var ids []string
	for i := range mockPosts {
		ids = append(ids, fmt.Sprintf("%s%d", dummyPostPrefix, i+1))
	}
	for i := range mockListings {
		ids = append(ids, fmt.Sprintf("%slisting-%d", dummyPostPrefix, i+1))
	}
	ids = append(ids, demoSpamPost)
	for _, postId := range ids {
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
