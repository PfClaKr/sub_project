package main

import (
	"fmt"
	"strconv"
	"time"

	"apiserver/adminhandler"
	"apiserver/eshandler"
	"apiserver/graphqlhandler"

	"local.com/dynamo"
	"local.com/notify"

	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/service/dynamodb"
	"github.com/google/uuid"
)

// make demo: /main demo-seed <admin email> <user email> <friend email>.
// The accounts come from the loginserver (/main demo-account). Each run
// first removes everything the three accounts own, so the demo always
// starts from the same state; the dummy members are written again too.
// Community content goes through the GraphQL resolvers (graphqlhandler.Run),
// so counters, notifications and the report auto-hide are the real ones.

// The spammer is a dummy member (removed by make unseed) whose post the
// demo accounts report until it is hidden.
const (
	demoSpammerId = dummyUserPrefix + "spam"
	demoSpamPost  = dummyPostPrefix + "spam"
)

type demoAccounts struct{ admin, user, friend string }

func demoSeed(adminEmail, userEmail, friendEmail string) error {
	var ids demoAccounts
	for _, a := range []struct {
		email string
		id    *string
	}{{adminEmail, &ids.admin}, {userEmail, &ids.user}, {friendEmail, &ids.friend}} {
		id, err := adminhandler.UserIdByEmail(a.email)
		if err != nil {
			return fmt.Errorf("no account for %s (run /main demo-account in the loginserver first): %w", a.email, err)
		}
		*a.id = id
	}
	if err := adminhandler.SetRole(ids.admin, adminhandler.RoleAdmin); err != nil {
		return err
	}
	if err := resetDemo(ids.admin, ids.user, ids.friend, demoSpammerId); err != nil {
		return fmt.Errorf("reset: %w", err)
	}
	if err := seedDummy(12); err != nil {
		return fmt.Errorf("dummy data: %w", err)
	}
	steps := []struct {
		name string
		run  func(demoAccounts) error
	}{
		{"products", demoProducts},
		{"housing/job posts", demoListings},
		{"community posts", demoCommunity},
		{"reports", demoReports},
		{"chats", demoChats},
		{"favorites", demoFavorites},
		{"notice", demoNotice},
	}
	for _, s := range steps {
		if err := s.run(ids); err != nil {
			return fmt.Errorf("%s: %w", s.name, err)
		}
		fmt.Println("  -", s.name)
	}
	return nil
}

// resetDemo deletes what the given members own or wrote, and their
// notifications, so a new run does not pile up duplicates.
func resetDemo(userIds ...string) error {
	isDemo := map[string]bool{}
	for _, id := range userIds {
		isDemo[id] = true
	}
	for _, id := range userIds {
		posts, err := queryBy(dynamo.TablePosts, "AuthorIndex", "AuthorId", id)
		if err != nil {
			return err
		}
		for _, p := range posts {
			if err := deletePostTree(dynamo.S(p, "PostId")); err != nil {
				return err
			}
		}
		comments, err := queryBy(dynamo.TableComments, "AuthorIndex", "AuthorId", id)
		if err != nil {
			return err
		}
		if err := deleteKeys(dynamo.TableComments, comments, "PostId", "CommentId"); err != nil {
			return err
		}
		products, err := queryBy(dynamo.TableProduct, "UserIndex", "UserId", id)
		if err != nil {
			return err
		}
		for _, p := range products {
			if err := graphqlhandler.RemoveProduct(dynamo.S(p, "ProductId"), id); err != nil {
				return err
			}
		}
		for _, t := range []struct{ table, rangeKey string }{
			{dynamo.TableFavorites, "ItemId"},
			{dynamo.TablePostLikes, "PostId"},
			{dynamo.TableBookmarks, "PostId"},
			{dynamo.TableNotifications, "SortKey"},
		} {
			rows, err := queryBy(t.table, "", "UserId", id)
			if err != nil {
				return err
			}
			if err := deleteKeys(t.table, rows, "UserId", t.rangeKey); err != nil {
				return err
			}
		}
		for _, index := range []string{"SellerIndex", "BuyerIndex"} {
			key := "UserSeller"
			if index == "BuyerIndex" {
				key = "UserBuyer"
			}
			rooms, err := queryBy(dynamo.TableChatRooms, index, key, id)
			if err != nil {
				return err
			}
			for _, room := range rooms {
				messages, err := queryBy(dynamo.TableChatMessage, "ChatIndex", "ChatId", dynamo.S(room, "ChatId"))
				if err != nil {
					return err
				}
				if err := deleteKeys(dynamo.TableChatMessage, messages, "MessageId"); err != nil {
					return err
				}
				if err := deleteKeys(dynamo.TableChatRooms, []dynamo.Item{room}, "ChatId"); err != nil {
					return err
				}
			}
		}
		// The spammer has no Users row yet on the first run.
		if _, err := svc.UpdateItem(&dynamodb.UpdateItemInput{
			TableName:                 aws.String(dynamo.TableUsers),
			Key:                       dynamo.Item{"UserId": {S: aws.String(id)}},
			UpdateExpression:          aws.String("SET UnreadCount = :z, PublishedQuantity = :z"),
			ConditionExpression:       aws.String("attribute_exists(UserId)"),
			ExpressionAttributeValues: dynamo.Item{":z": {N: aws.String("0")}},
		}); err != nil && !isConditionFailed(err) {
			return err
		}
	}
	if err := deletePostTree(demoSpamPost); err != nil {
		return err
	}
	reports, err := dynamo.ScanAll(svc, &dynamodb.ScanInput{TableName: aws.String(dynamo.TableReports)})
	if err != nil {
		return err
	}
	var stale []dynamo.Item
	for _, r := range reports {
		if isDemo[dynamo.S(r, "ReporterId")] || isDemo[dynamo.S(r, "TargetOwner")] {
			stale = append(stale, r)
		}
	}
	return deleteKeys(dynamo.TableReports, stale, "ReportId")
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

func deleteKeys(table string, rows []dynamo.Item, keys ...string) error {
	for _, row := range rows {
		key := dynamo.Item{}
		for _, k := range keys {
			key[k] = row[k]
		}
		if _, err := svc.DeleteItem(&dynamodb.DeleteItemInput{TableName: aws.String(table), Key: key}); err != nil {
			return err
		}
	}
	return nil
}

// deletePostTree removes a post with all its comments and its index entry.
func deletePostTree(postId string) error {
	comments, err := queryBy(dynamo.TableComments, "", "PostId", postId)
	if err != nil {
		return err
	}
	if err := deleteKeys(dynamo.TableComments, comments, "PostId", "CommentId"); err != nil {
		return err
	}
	if _, err := svc.DeleteItem(&dynamodb.DeleteItemInput{
		TableName: aws.String(dynamo.TablePosts),
		Key:       dynamo.Item{"PostId": {S: aws.String(postId)}},
	}); err != nil {
		return err
	}
	eshandler.DeletePost(postId)
	return nil
}

func isConditionFailed(err error) bool {
	aerr, ok := err.(interface{ Code() string })
	return ok && aerr.Code() == dynamodb.ErrCodeConditionalCheckFailedException
}

var demoProductList = []struct {
	owner                                         func(demoAccounts) string
	name, description, category, region, location string
	price                                         int
	status                                        string
}{
	{func(a demoAccounts) string { return a.user }, "아이패드 9세대 64GB 스페이스그레이", "수업 필기용으로 1년 썼어요. 애플펜슬 1세대와 케이스 함께 드려요. 화면 기스 없습니다.", "전자기기", "파리", "샤틀레 역", 230, "판매중"},
	{func(a demoAccounts) string { return a.user }, "이케아 소파베드 (FRIHETEN)", "이사 날짜가 정해져서 정리해요. 수납공간 있는 모델이고 커버는 세탁했어요. 직접 가져가셔야 해요.", "가구", "파리", "15구 Convention", 150, "예약중"},
	{func(a demoAccounts) string { return a.user }, "필립스 전기포트 1.7L", "귀국 정리 중입니다. 석회 제거 해뒀어요.", "전자기기", "파리", "15구", 10, "판매완료"},
	{func(a demoAccounts) string { return a.friend }, "자전거 헬멧 (M, 거의 새것)", "벨리브 타려고 샀는데 몇 번 안 썼어요.", "기타", "파리", "11구 République", 15, "판매중"},
	{func(a demoAccounts) string { return a.friend }, "프랑스어 문법책 Grammaire progressive (중급)", "답지 포함, 필기 조금 있어요.", "도서", "파리", "라틴지구", 12, "판매중"},
}

func demoProducts(a demoAccounts) error {
	now := time.Now().Unix()
	published := map[string]int{}
	for i, p := range demoProductList {
		owner := p.owner(a)
		item := productItem(fmt.Sprintf("demo-product-%d", i+1), owner, p.name, p.description, p.category, p.region, p.location, p.status, p.price,
			strconv.FormatInt(now-int64(i)*1800, 10))
		if _, err := svc.PutItem(&dynamodb.PutItemInput{TableName: aws.String(dynamo.TableProduct), Item: item}); err != nil {
			return err
		}
		if err := eshandler.IndexProduct(eshandler.DocFromItem(item)); err != nil {
			return err
		}
		published[owner]++
	}
	for owner, n := range published {
		if _, err := svc.UpdateItem(&dynamodb.UpdateItemInput{
			TableName:                 aws.String(dynamo.TableUsers),
			Key:                       dynamo.Item{"UserId": {S: aws.String(owner)}},
			UpdateExpression:          aws.String("SET PublishedQuantity = :n"),
			ExpressionAttributeValues: dynamo.Item{":n": {N: aws.String(strconv.Itoa(n))}},
		}); err != nil {
			return err
		}
	}
	return nil
}

func demoListings(a demoAccounts) error {
	housing := mockListing{"housing", "쉐어", "파리", "15구 쉐어 방 하나 내놓아요 (9월부터)",
		"한국인 두 명이 사는 3룸 아파트예요. 메트로 8호선 5분, 큰 창문이 있어 밝아요. 보증금은 계약서 쓰고 입주할 때 받아요.",
		48.8387, 2.2955, false, dynamo.Item{"Mode": str("offer"), "Kind": str("쉐어"), "Rent": num(720), "ChargesIncluded": flag(true), "Deposit": num(720),
			"AvailableFrom": str(inDays(14)), "MinMonths": num(6), "Size": num(13), "Furnished": flag(true), "Caf": flag(true), "Pets": flag(false)}, 3}
	job := mockListing{"job", "식당·카페", "파리", "11구 한식 카페 평일 오후 바리스타 구해요",
		"평일 14~19시, 주 3일 이상 가능하신 분. 커피 경력 없어도 알려드려요. 계약서 작성하고 급여명세서 드려요.",
		48.8655, 2.3700, true, dynamo.Item{"Mode": str("hiring"), "Sector": str("식당·카페"), "Employment": str("알바"), "WageType": str("hourly"), "Wage": num(12.8),
			"Schedule": str("평일 14시~19시, 주 3일"), "PermitRequired": flag(true), "Languages": {L: []*dynamodb.AttributeValue{str("한국어"), str("프랑스어")}}}, 0}
	now := time.Now()
	for i, l := range []struct {
		post   mockListing
		author string
	}{{housing, a.user}, {job, a.friend}} {
		item := listingItem(l.post, fmt.Sprintf("demo-listing-%d", i+1), l.author, now.Add(-time.Duration(i+1)*time.Hour))
		item["ViewCount"] = num(float64(24 - i*9))
		if l.post.typ == "job" {
			item["Contact"] = &dynamodb.AttributeValue{M: dynamo.Item{"Phone": str("+33 1 00 00 00 00")}}
		}
		if err := putPost(item); err != nil {
			return err
		}
	}
	return nil
}

func gqlAs(userId, query string, vars map[string]interface{}, field string) (map[string]interface{}, error) {
	data, err := graphqlhandler.Run(userId, query, vars)
	if err != nil {
		return nil, fmt.Errorf("%s: %w", field, err)
	}
	out, _ := data[field].(map[string]interface{})
	return out, nil
}

func demoPost(author, typ, topic, title, body string, anonymous bool) (string, error) {
	post, err := gqlAs(author, `mutation($in: PostInput!) { createPost(Input: $in) { PostId } }`, map[string]interface{}{
		"in": map[string]interface{}{"Type": typ, "Topic": topic, "City": "파리", "Title": title, "Body": body, "Anonymous": anonymous},
	}, "createPost")
	if err != nil {
		return "", err
	}
	return post["PostId"].(string), nil
}

func demoComment(author, postId, body, parentId string, anonymous bool) (string, error) {
	vars := map[string]interface{}{"p": postId, "b": body, "a": anonymous}
	if parentId != "" {
		vars["r"] = parentId
	}
	c, err := gqlAs(author, `mutation($p: String!, $b: String!, $r: String, $a: Boolean) {
		createComment(PostId: $p, Body: $b, ParentId: $r, Anonymous: $a) { CommentId } }`, vars, "createComment")
	if err != nil {
		return "", err
	}
	return c["CommentId"].(string), nil
}

func dummy(n int) string { return fmt.Sprintf("%s%d", dummyUserPrefix, n) }

// demoCommunity writes posts and threads around the demo member, which
// also leaves them comment, reply and accepted-answer notifications.
func demoCommunity(a demoAccounts) error {
	// The member's question, answered by the friend (accepted) and others.
	q, err := demoPost(a.user, "qna", "행정·CAF·세금", "한국 운전면허 프랑스 면허로 교환, 요즘 얼마나 걸리나요?",
		"작년 가을에 ANTS로 신청했는데 아직 소식이 없어요. 최근에 교환 받으신 분들 얼마나 걸리셨는지 궁금해요. 중간에 뭘 더 해야 하나요?", false)
	if err != nil {
		return err
	}
	c1, err := demoComment(dummy(1), q, "저는 7개월 걸렸어요. 중간에 서류 보완 요청 메일이 왔었으니 스팸함도 확인해보세요.", "", false)
	if err != nil {
		return err
	}
	answer, err := demoComment(a.friend, q, "ANTS 사이트에서 '내 신청 현황'에 처리 단계가 나와요. 6개월이 넘었으면 사이트 문의 양식으로 독촉할 수 있어요.", "", false)
	if err != nil {
		return err
	}
	if _, err := demoComment(a.user, q, "스팸함에 정말 있었네요 ㅠㅠ 감사합니다!", c1, false); err != nil {
		return err
	}
	if _, err := gqlAs(a.user, `mutation($p: String!, $c: String!) { acceptAnswer(PostId: $p, CommentId: $c) { PostId } }`,
		map[string]interface{}{"p": q, "c": answer}, "acceptAnswer"); err != nil {
		return err
	}
	if _, err := demoComment(dummy(2), q, "저도 같은 상황이라 댓글 달고 갑니다.", "", false); err != nil {
		return err
	}

	// The friend's free post, which the member comments on and likes.
	f, err := demoPost(a.friend, "free", "일상", "파리 온 지 한 달, 소소한 적응기",
		"나비고 만들고, 은행 계좌 열고, 드디어 집 인터넷까지 연결했어요. 다들 처음에 뭐가 제일 힘드셨어요?", false)
	if err != nil {
		return err
	}
	mine, err := demoComment(a.user, f, "저는 CAF 서류요… 그래도 한 달 만에 다 하셨으면 엄청 빠른 거예요!", "", false)
	if err != nil {
		return err
	}
	if _, err := demoComment(a.friend, f, "커뮤니티 Q&A 덕분이에요 ㅎㅎ CAF는 이제 시작이에요.", mine, false); err != nil {
		return err
	}
	if _, err := demoComment(dummy(3), f, "주말에 한인마트 같이 가실 분 구해요~", "", false); err != nil {
		return err
	}
	if _, err := gqlAs(a.user, `mutation($p: String!) { likePost(PostId: $p, On: true) { PostId } }`, map[string]interface{}{"p": f}, "likePost"); err != nil {
		return err
	}
	if _, err := graphqlhandler.Run(a.user, `mutation($p: String!) { bookmarkPost(PostId: $p, On: true) }`, map[string]interface{}{"p": f}); err != nil {
		return err
	}

	// An anonymous question: commenters get stable numbers.
	anon, err := demoPost(a.user, "qna", "집·이사", "퇴실했는데 집주인이 보증금을 두 달째 안 돌려줘요",
		"퇴실 점검(état des lieux)에서 문제 없다고 했는데 연락이 없어요. 어디에 먼저 연락해야 할까요?", true)
	if err != nil {
		return err
	}
	if _, err := demoComment(a.friend, anon, "법적으로 문제 없으면 한 달 안에 돌려줘야 해요. 등기우편(lettre recommandée)으로 먼저 요청해보세요.", "", true); err != nil {
		return err
	}
	if _, err := demoComment(dummy(4), anon, "ADIL에서 무료 상담 받을 수 있어요.", "", true); err != nil {
		return err
	}
	if _, err := demoComment(a.user, anon, "두 분 감사해요. 등기우편부터 보내볼게요.", "", true); err != nil {
		return err
	}
	return nil
}

// demoReports gives the admin a queue: a spam post the demo accounts
// report until it is hidden automatically, and an open comment report.
func demoReports(a demoAccounts) error {
	created := time.Now().Add(-20 * time.Minute).UnixMilli()
	if _, err := svc.PutItem(&dynamodb.PutItemInput{TableName: aws.String(dynamo.TableUsers), Item: dynamo.Item{
		"UserId": str(demoSpammerId), "Email": str("spam@test.com"), "UserNickname": str("고수익알바"),
		"Residence": str(graphqlhandler.DefaultRegion), "PublishedQuantity": num(0),
		"CreatedAt": num(float64(time.Now().Add(-48 * time.Hour).Unix())),
	}}); err != nil {
		return err
	}
	if err := putPost(dynamo.Item{
		"PostId": str(demoSpamPost), "Type": str("free"), "Topic": str("정보"), "Country": str(graphqlhandler.DefaultCountry),
		"City": str("파리"), "AuthorId": str(demoSpammerId), "Anonymous": flag(false),
		"AnonMap": {M: dynamo.Item{}}, "AnonSeq": num(0),
		"Title": str("하루 2시간 재택으로 월 300 버는 법"), "Body": str("텔레그램 @easy_money_fr 로 연락주세요. 선착순 5명, 등록비만 내면 바로 시작!"),
		"Status": str(graphqlhandler.PostActive), "Solved": flag(false),
		"CreatedAt": num(float64(created)), "UpdatedAt": num(float64(created)),
		"CommentCount": num(0), "LikeCount": num(0), "ViewCount": num(31),
	}); err != nil {
		return err
	}
	report := `mutation($t: String!, $id: String!, $r: String!, $d: String) { report(TargetType: $t, TargetId: $id, Reason: $r, Detail: $d) }`
	for _, r := range []struct{ by, reason, detail string }{
		{a.user, "스팸·광고", "외부 메신저로 유도하는 광고예요."},
		{a.friend, "사기 의심", "등록비를 먼저 내라고 해요."},
		{a.admin, "스팸·광고", ""},
	} {
		if _, err := graphqlhandler.Run(r.by, report, map[string]interface{}{"t": "post", "id": demoSpamPost, "r": r.reason, "d": r.detail}); err != nil {
			return err
		}
	}

	// A spam comment on the friend's free post, reported once (stays open).
	posts, err := queryBy(dynamo.TablePosts, "AuthorIndex", "AuthorId", a.friend)
	if err != nil {
		return err
	}
	for _, p := range posts {
		if dynamo.S(p, "Type") != "free" {
			continue
		}
		postId := dynamo.S(p, "PostId")
		commentId, err := demoComment(demoSpammerId, postId, "적응 힘드시죠? 서류 대행 싸게 해드려요. 왓츠앱 +33 6 00 00 00 00", "", false)
		if err != nil {
			return err
		}
		_, err = graphqlhandler.Run(a.friend, report, map[string]interface{}{"t": "comment", "id": postId + "#" + commentId, "r": "스팸·광고", "d": "개인 연락처로 영업해요."})
		return err
	}
	return nil
}

// roomId matches the chatserver's formula, so opening the chat from the
// product page finds these rooms instead of creating new ones.
var roomNamespace = uuid.MustParse("6f1c1b8e-6a53-4c1e-9d0e-2f7a1f3e5c11")

func roomId(subjectType, subjectId, buyerId string) string {
	name := subjectId + ":" + buyerId
	if subjectType != "product" {
		name = subjectType + ":" + name
	}
	return uuid.NewSHA1(roomNamespace, []byte(name)).String()
}

type demoMessage struct {
	fromBuyer bool
	text      string
}

func demoChats(a demoAccounts) error {
	rooms := []struct {
		subjectType, subjectId, seller, buyer string
		messages                              []demoMessage
	}{
		{"product", "demo-product-1", a.user, a.friend, []demoMessage{
			{true, "안녕하세요! 아이패드 아직 판매 중인가요?"},
			{false, "네 아직 있어요 :) 펜슬도 같이 드려요."},
			{true, "혹시 내일 저녁 7시에 샤틀레역에서 직거래 가능할까요?"},
		}},
		{"housing", "demo-listing-1", a.user, a.friend, []demoMessage{
			{true, "방 보러 가볼 수 있을까요? 이번 주말 오후 괜찮아요."},
		}},
		{"product", dummyProductPrefix + "3", dummy(3), a.user, []demoMessage{
			{true, "라이스쿠커 예약 중이던데 혹시 거래 취소되면 연락 주실 수 있을까요?"},
			{false, "네 그럴게요~ 취소되면 바로 말씀드릴게요."},
		}},
	}
	start := time.Now().Add(-90 * time.Minute)
	for i, r := range rooms {
		chatId := roomId(r.subjectType, r.subjectId, r.buyer)
		created := start.Add(time.Duration(i) * 10 * time.Minute)
		room := dynamo.Item{
			"ChatId": str(chatId), "SubjectType": str(r.subjectType), "SubjectId": str(r.subjectId),
			"UserSeller": str(r.seller), "UserBuyer": str(r.buyer), "CreatedAt": num(float64(created.Unix())),
		}
		if r.subjectType == "product" {
			room["ProductId"] = str(r.subjectId)
		}
		if _, err := svc.PutItem(&dynamodb.PutItemInput{TableName: aws.String(dynamo.TableChatRooms), Item: room}); err != nil {
			return err
		}
		for j, m := range r.messages {
			from := r.seller
			if m.fromBuyer {
				from = r.buyer
			}
			if _, err := svc.PutItem(&dynamodb.PutItemInput{TableName: aws.String(dynamo.TableChatMessage), Item: dynamo.Item{
				"MessageId": str(uuid.NewString()), "ChatId": str(chatId), "UserId": str(from),
				"Timestamp": num(float64(created.Add(time.Duration(j+1) * 2 * time.Minute).UnixMilli())),
				"Content":   str(m.text),
			}}); err != nil {
				return err
			}
		}
		// The member was away when the last message to them arrived.
		last := r.messages[len(r.messages)-1]
		to, from := r.seller, r.buyer
		if !last.fromBuyer {
			to, from = r.buyer, r.seller
		}
		if to == a.user {
			if err := notify.New(svc).Publish(notify.Event{UserId: to, Type: notify.TypeChat, ActorId: from,
				TargetType: "chat", TargetId: chatId, Preview: last.text, Link: "/chat/" + chatId}); err != nil {
				return err
			}
		}
	}
	return nil
}

func demoFavorites(a demoAccounts) error {
	for _, f := range []struct{ user, product string }{
		{a.user, dummyProductPrefix + "2"}, {a.user, dummyProductPrefix + "7"}, {a.friend, "demo-product-1"},
	} {
		if _, err := svc.PutItem(&dynamodb.PutItemInput{TableName: aws.String(dynamo.TableFavorites), Item: dynamo.Item{
			"UserId": str(f.user), "ItemId": str(f.product),
		}}); err != nil {
			return err
		}
	}
	return nil
}

func demoNotice(a demoAccounts) error {
	for _, id := range []string{a.user, a.friend} {
		if err := notify.New(svc).Publish(notify.Event{UserId: id, Type: notify.TypeNotice, ActorId: a.admin,
			TargetType: "notice", Preview: "잇냥 체험판에 오신 걸 환영해요. 거래 전에 안전 가이드를 꼭 읽어주세요.", Link: "/safety"}); err != nil {
			return err
		}
	}
	return nil
}
