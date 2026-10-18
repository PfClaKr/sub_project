package graphqlhandler

import (
	"errors"
	"log"
	"math"
	"strconv"
	"strings"
	"time"
	"unicode/utf8"

	"apiserver/eshandler"
	"apiserver/throttle"
	"apiserver/uploadhandler"

	"local.com/dynamo"
	"local.com/jwt"

	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/aws/awserr"
	"github.com/aws/aws-sdk-go/service/dynamodb"
	"github.com/google/uuid"
	"github.com/graphql-go/graphql"
)

// Community boards (docs/community-plan.md). Topics must match
// srcs/frontend/libs/constants.ts (checked by libs/contract.test.ts).
const (
	PostTypeFree = "free"
	PostTypeQna  = "qna"
	// DefaultCountry is the only country open so far; posts carry it so
	// other countries can be added without migrating data.
	DefaultCountry = "FR"
)

var FreeTopics = []string{"일상", "정보", "맛집·장보기", "행사·모임", "고민"}

var QnaTopics = []string{"체류증·비자", "행정·CAF·세금", "은행·통신", "학교·어학", "의료", "집·이사", "일·취업", "기타"}

// Post statuses. Hidden posts (reported, phase 3) and deleted ones stay
// in DynamoDB for moderation but never appear in lists.
const (
	PostActive  = "active"
	PostHidden  = "hidden"
	PostDeleted = "deleted"
	// PostExpired: a housing/job post past ExpiresAt, until extended.
	PostExpired = "expired"
)

var topicsByType = map[string][]string{PostTypeFree: FreeTopics, PostTypeQna: QnaTopics}

// AnonymousName is what everyone but the admins sees for an anonymous
// author; DeletedMemberName for an author whose account is gone.
const (
	AnonymousName     = "익명"
	DeletedMemberName = "탈퇴한 회원"
)

var (
	errPostNotFound   = errors.New("글을 찾을 수 없어요.")
	errPostForbidden  = errors.New("내 글만 수정할 수 있어요.")
	errTooManyPosts   = errors.New("글을 너무 자주 올리고 있어요. 잠시 후 다시 시도해주세요.")
	errDuplicatePost  = errors.New("같은 글을 이미 올렸어요.")
	errUnknownPostTyp = errors.New("게시판을 선택해주세요.")
)

// Members may post 5 times an hour; enough for real use, and a cap on
// spam from a single account.
var postLimiter = throttle.New(5, time.Hour)

func nowMs() int64 { return time.Now().UnixMilli() }

func itoa(n int64) string { return strconv.FormatInt(n, 10) }

type postInput struct {
	Type, Topic, City, Title, Body string
	Images                         []string
	Anonymous                      bool
}

// parsePostInput validates a PostInput; keep lists image URLs the post
// already has.
func parsePostInput(raw interface{}, keep ...string) (postInput, error) {
	args, _ := raw.(map[string]interface{})
	in := postInput{}
	in.Type, _ = args["Type"].(string)
	in.Topic, _ = args["Topic"].(string)
	in.City, _ = args["City"].(string)
	in.Title, _ = args["Title"].(string)
	in.Body, _ = args["Body"].(string)
	in.Anonymous, _ = args["Anonymous"].(bool)
	in.Title = strings.Join(strings.Fields(in.Title), " ")
	in.Body = strings.TrimSpace(in.Body)

	topics, ok := topicsByType[in.Type]
	switch {
	case !ok:
		return in, errUnknownPostTyp
	case !contains(topics, in.Topic):
		return in, errors.New("주제를 선택해주세요.")
	case utf8.RuneCountInString(in.Title) < 2 || utf8.RuneCountInString(in.Title) > 100:
		return in, errors.New("제목은 2~100자로 입력해주세요.")
	case in.Body == "" || utf8.RuneCountInString(in.Body) > 5000:
		return in, errors.New("내용은 1~5000자로 입력해주세요.")
	}
	if in.City == "" {
		in.City = DefaultRegion
	}
	if !contains(Regions, in.City) {
		return in, errors.New("지역을 선택해주세요.")
	}
	if list, ok := args["Images"].([]interface{}); ok {
		for _, v := range list {
			s, _ := v.(string)
			if s == "" {
				continue
			}
			if !validImageURL(s) && !contains(keep, s) {
				return in, errors.New("업로드한 이미지만 사용할 수 있어요.")
			}
			in.Images = append(in.Images, s)
		}
	}
	if len(in.Images) > 5 {
		return in, errors.New("사진은 최대 5장까지 올릴 수 있어요.")
	}
	return in, nil
}

func stringList(values []string) *dynamodb.AttributeValue {
	list := make([]*dynamodb.AttributeValue, len(values))
	for i, v := range values {
		list[i] = &dynamodb.AttributeValue{S: aws.String(v)}
	}
	return &dynamodb.AttributeValue{L: list}
}

func listOf(v *dynamodb.AttributeValue) []string {
	out := []string{}
	if v == nil {
		return out
	}
	for _, e := range v.L {
		if e.S != nil {
			out = append(out, *e.S)
		}
	}
	return out
}

func num(item dynamo.Item, k string) float64 {
	if v := item[k]; v != nil && v.N != nil {
		f, _ := strconv.ParseFloat(*v.N, 64)
		return f
	}
	return 0
}

func boolOf(item dynamo.Item, k string) bool {
	v := item[k]
	return v != nil && v.BOOL != nil && *v.BOOL
}

func getPost(postId string) (dynamo.Item, error) {
	if postId == "" {
		return nil, nil
	}
	out, err := svc.GetItem(&dynamodb.GetItemInput{
		TableName: aws.String(dynamo.TablePosts),
		Key:       dynamo.Item{"PostId": {S: aws.String(postId)}},
	})
	if err != nil {
		return nil, err
	}
	return out.Item, nil
}

func isCommunityType(t string) bool { return t == PostTypeFree || t == PostTypeQna }

// visiblePost returns the post if the viewer may open it: active posts
// for everyone; hidden (reported) and expired ones for their author only.
func visiblePost(postId, viewer string) (dynamo.Item, error) {
	item, err := getPost(postId)
	if err != nil || item == nil {
		return nil, err
	}
	switch dynamo.S(item, "Status") {
	case PostActive:
		return item, nil
	case PostHidden, PostExpired:
		if viewer != "" && dynamo.S(item, "AuthorId") == viewer {
			return item, nil
		}
	}
	return nil, nil
}

// visibleOfType is visiblePost limited to some post types, so a housing
// id opened as a community post is "not found".
func visibleOfType(postId, viewer string, types ...string) (dynamo.Item, error) {
	item, err := visiblePost(postId, viewer)
	if err != nil || item == nil || !contains(types, dynamo.S(item, "Type")) {
		return nil, err
	}
	return item, nil
}

// authors batch-reads nicknames and pictures of the given user ids.
func authors(ids []string) (map[string]dynamo.Item, error) {
	return userCache.BatchGet(svc, ids)
}

const previewRunes = 120

func preview(body string) string {
	flat := strings.Join(strings.Fields(body), " ")
	if r := []rune(flat); len(r) > previewRunes {
		return string(r[:previewRunes]) + "…"
	}
	return flat
}

// postView is the GraphQL Post. An anonymous author's id never leaves
// the server; IsMine tells the viewer whether they wrote it.
func postView(item dynamo.Item, viewer string, users map[string]dynamo.Item) map[string]interface{} {
	authorId := dynamo.S(item, "AuthorId")
	anonymous := boolOf(item, "Anonymous")
	body := dynamo.S(item, "Body")
	view := map[string]interface{}{
		"PostId":            dynamo.S(item, "PostId"),
		"Type":              dynamo.S(item, "Type"),
		"Topic":             dynamo.S(item, "Topic"),
		"City":              dynamo.S(item, "City"),
		"Title":             dynamo.S(item, "Title"),
		"Body":              body,
		"BodyPreview":       preview(body),
		"Images":            listOf(item["Images"]),
		"Status":            dynamo.S(item, "Status"),
		"Anonymous":         anonymous,
		"CreatedAt":         num(item, "CreatedAt"),
		"UpdatedAt":         num(item, "UpdatedAt"),
		"CommentCount":      num(item, "CommentCount"),
		"LikeCount":         num(item, "LikeCount"),
		"ViewCount":         num(item, "ViewCount"),
		"AcceptedCommentId": dynamo.S(item, "AcceptedCommentId"),
		"Solved":            boolOf(item, "Solved"),
		"IsMine":            viewer != "" && viewer == authorId,
		"Liked":             false,
		"Bookmarked":        false,
	}
	addListingFields(view, item)
	switch {
	case anonymous:
		view["AuthorNickname"] = AnonymousName
	case users[authorId] == nil:
		view["AuthorNickname"] = DeletedMemberName
	default:
		view["AuthorId"] = authorId
		view["AuthorNickname"] = dynamo.S(users[authorId], "UserNickname")
		view["AuthorImage"] = dynamo.S(users[authorId], "ProfileImage")
	}
	return view
}

// postViews renders items in order with one batch read for authors.
func postViews(items []dynamo.Item, viewer string) ([]map[string]interface{}, error) {
	var ids []string
	for _, it := range items {
		if !boolOf(it, "Anonymous") {
			ids = append(ids, dynamo.S(it, "AuthorId"))
		}
	}
	users, err := authors(ids)
	if err != nil {
		return nil, err
	}
	out := make([]map[string]interface{}, 0, len(items))
	for _, it := range items {
		out = append(out, postView(it, viewer, users))
	}
	return out, nil
}

// postsByIds keeps the order of ids (search ranking) and drops posts no
// longer active, e.g. deleted after indexing.
func postsByIds(ids []string) ([]dynamo.Item, error) {
	found, err := postCache.BatchGet(svc, ids)
	if err != nil {
		return nil, err
	}
	items := make([]dynamo.Item, 0, len(ids))
	for _, id := range ids {
		if it, ok := found[id]; ok && dynamo.S(it, "Status") == PostActive {
			items = append(items, it)
		}
	}
	return items, nil
}

// reindexPost refreshes the search document from a full item. Search is
// secondary to DynamoDB here, so a failure is logged, not returned.
func reindexPost(item dynamo.Item) {
	if item == nil {
		return
	}
	postCache.Forget(dynamo.S(item, "PostId"))
	var err error
	if dynamo.S(item, "Status") == PostDeleted {
		err = eshandler.DeletePost(dynamo.S(item, "PostId"))
	} else {
		err = eshandler.IndexPost(eshandler.PostDocFromItem(item))
	}
	if err != nil {
		log.Printf("reindex post %s: %v", dynamo.S(item, "PostId"), err)
	}
}

// ---- queries ----

// resolvePosts lists a board. Type "community" means free + Q&A.
func resolvePosts(p graphql.ResolveParams) (interface{}, error) {
	viewer := jwt.UserID(p.Context)
	q := eshandler.PostQuery{Country: DefaultCountry}
	typ, _ := p.Args["Type"].(string)
	switch typ {
	case "community", "":
		q.Types = []string{PostTypeFree, PostTypeQna}
	case PostTypeFree, PostTypeQna:
		q.Types = []string{typ}
	default:
		return nil, errUnknownPostTyp
	}
	q.Topic, _ = p.Args["Topic"].(string)
	q.City, _ = p.Args["City"].(string)
	q.Q, _ = p.Args["Q"].(string)
	q.Sort, _ = p.Args["Sort"].(string)
	if v, ok := p.Args["Solved"].(bool); ok {
		q.Solved = &v
	}
	if v, ok := p.Args["Page"].(int); ok {
		q.Page = v
	}
	if v, ok := p.Args["Size"].(int); ok {
		q.Size = v
	}
	if q.Page < 1 {
		q.Page = 1
	}

	return postPage(q, viewer)
}

// postPage runs a post search and renders one PostPage.
func postPage(q eshandler.PostQuery, viewer string) (interface{}, error) {
	ids, total, corrected, err := eshandler.SearchPosts(q)
	if err != nil {
		return nil, internal(err)
	}
	items, err := postsByIds(ids)
	if err != nil {
		return nil, internal(err)
	}
	views, err := postViews(items, viewer)
	if err != nil {
		return nil, internal(err)
	}
	size := q.Size
	if size <= 0 || size > eshandler.PostPageSize {
		size = eshandler.PostPageSize
	}
	totalPages := int(math.Ceil(float64(total) / float64(size)))
	return map[string]interface{}{
		"Items": views, "Page": q.Page, "TotalPages": totalPages, "Total": total, "Corrected": corrected,
	}, nil
}

func resolvePost(p graphql.ResolveParams) (interface{}, error) {
	viewer := jwt.UserID(p.Context)
	postId, _ := p.Args["PostId"].(string)
	types := []string{PostTypeFree, PostTypeQna}
	if t, ok := p.Args["types"].([]string); ok {
		types = t
	}
	item, err := visibleOfType(postId, viewer, types...)
	if err != nil {
		return nil, internal(err)
	}
	if item == nil {
		return nil, nil
	}
	views, err := postViews([]dynamo.Item{item}, viewer)
	if err != nil {
		return nil, internal(err)
	}
	view := views[0]
	if viewer != "" {
		view["Liked"], err = exists(dynamo.TablePostLikes, viewer, postId)
		if err != nil {
			return nil, internal(err)
		}
		view["Bookmarked"], err = exists(dynamo.TableBookmarks, viewer, postId)
		if err != nil {
			return nil, internal(err)
		}
	}
	return view, nil
}

// exists checks a UserId+PostId row (likes, bookmarks).
func exists(table, userId, postId string) (bool, error) {
	out, err := svc.GetItem(&dynamodb.GetItemInput{
		TableName:            aws.String(table),
		Key:                  dynamo.Item{"UserId": {S: aws.String(userId)}, "PostId": {S: aws.String(postId)}},
		ProjectionExpression: aws.String("PostId"),
	})
	if err != nil {
		return false, err
	}
	return out.Item != nil, nil
}

func resolveSimilarQuestions(p graphql.ResolveParams) (interface{}, error) {
	title, _ := p.Args["Title"].(string)
	ids, err := eshandler.SimilarQuestions(title, 5)
	if err != nil {
		return nil, internal(err)
	}
	items, err := postsByIds(ids)
	if err != nil {
		return nil, internal(err)
	}
	return postViews(items, jwt.UserID(p.Context))
}

// resolveMyPosts lists the viewer's own posts (anonymous ones included),
// newest first, through the AuthorIndex.
func resolveMyPosts(p graphql.ResolveParams) (interface{}, error) {
	viewer := jwt.UserID(p.Context)
	if viewer == "" {
		return nil, errLogin
	}
	items, err := dynamo.QueryAll(svc, &dynamodb.QueryInput{
		TableName:                 aws.String(dynamo.TablePosts),
		IndexName:                 aws.String("AuthorIndex"),
		KeyConditionExpression:    aws.String("AuthorId = :u"),
		FilterExpression:          aws.String("#s <> :d"),
		ExpressionAttributeNames:  map[string]*string{"#s": aws.String("Status")},
		ExpressionAttributeValues: dynamo.Item{":u": {S: aws.String(viewer)}, ":d": {S: aws.String(PostDeleted)}},
		ScanIndexForward:          aws.Bool(false),
	})
	if err != nil {
		return nil, internal(err)
	}
	typ, _ := p.Args["Type"].(string)
	kept := items[:0]
	for _, it := range items {
		t := dynamo.S(it, "Type")
		if ((typ == "" || typ == "community") && isCommunityType(t)) || t == typ || (typ == "listing" && isListingType(t)) {
			kept = append(kept, it)
		}
	}
	return postViews(kept, viewer)
}

func resolveMyBookmarks(p graphql.ResolveParams) (interface{}, error) {
	viewer := jwt.UserID(p.Context)
	if viewer == "" {
		return nil, errLogin
	}
	rows, err := dynamo.QueryAll(svc, &dynamodb.QueryInput{
		TableName:                 aws.String(dynamo.TableBookmarks),
		KeyConditionExpression:    aws.String("UserId = :u"),
		ExpressionAttributeValues: dynamo.Item{":u": {S: aws.String(viewer)}},
	})
	if err != nil {
		return nil, internal(err)
	}
	// Newest bookmark first.
	ids := make([]string, len(rows))
	for i, r := range rows {
		ids[len(rows)-1-i] = dynamo.S(r, "PostId")
	}
	items, err := postsByIds(ids)
	if err != nil {
		return nil, internal(err)
	}
	return postViews(items, viewer)
}

// ---- mutations ----

func createPostResolver(p graphql.ResolveParams) (interface{}, error) {
	userId, err := requireUser(p)
	if err != nil {
		return nil, err
	}
	in, err := parsePostInput(p.Args["Input"])
	if err != nil {
		return nil, err
	}
	if dup, err := isDuplicatePost(userId, in); err != nil {
		return nil, internal(err)
	} else if dup {
		return nil, errDuplicatePost
	}
	if !postLimiter.Allow(userId) {
		return nil, errTooManyPosts
	}

	postId := uuid.NewString()
	ts := itoa(nowMs())
	item := dynamo.Item{
		"PostId":       {S: aws.String(postId)},
		"Type":         {S: aws.String(in.Type)},
		"Topic":        {S: aws.String(in.Topic)},
		"Country":      {S: aws.String(DefaultCountry)},
		"City":         {S: aws.String(in.City)},
		"AuthorId":     {S: aws.String(userId)},
		"Anonymous":    {BOOL: aws.Bool(in.Anonymous)},
		"AnonMap":      {M: dynamo.Item{}},
		"AnonSeq":      {N: aws.String("0")},
		"Title":        {S: aws.String(in.Title)},
		"Body":         {S: aws.String(in.Body)},
		"Status":       {S: aws.String(PostActive)},
		"Solved":       {BOOL: aws.Bool(false)},
		"CreatedAt":    {N: aws.String(ts)},
		"UpdatedAt":    {N: aws.String(ts)},
		"CommentCount": {N: aws.String("0")},
		"LikeCount":    {N: aws.String("0")},
		"ViewCount":    {N: aws.String("0")},
	}
	if len(in.Images) > 0 {
		item["Images"] = stringList(in.Images)
	}
	if _, err := svc.PutItem(&dynamodb.PutItemInput{TableName: aws.String(dynamo.TablePosts), Item: item}); err != nil {
		return nil, internal(err)
	}
	// Roll back so a post is never stored without being listed.
	if err := eshandler.IndexPost(eshandler.PostDocFromItem(item)); err != nil {
		if _, derr := svc.DeleteItem(&dynamodb.DeleteItemInput{
			TableName: aws.String(dynamo.TablePosts),
			Key:       dynamo.Item{"PostId": {S: aws.String(postId)}},
		}); derr != nil {
			log.Printf("rollback of post %s failed: %v", postId, derr)
		}
		return nil, internal(err)
	}
	views, err := postViews([]dynamo.Item{item}, userId)
	if err != nil {
		return nil, internal(err)
	}
	return views[0], nil
}

// duplicateWindow: the same title and body from the same member within a
// day is refused (copy-paste spam, double submits).
const duplicateWindow = 24 * time.Hour

func isDuplicatePost(userId string, in postInput) (bool, error) {
	since := itoa(time.Now().Add(-duplicateWindow).UnixMilli())
	out, err := svc.Query(&dynamodb.QueryInput{
		TableName:                aws.String(dynamo.TablePosts),
		IndexName:                aws.String("AuthorIndex"),
		KeyConditionExpression:   aws.String("AuthorId = :u AND CreatedAt > :t"),
		FilterExpression:         aws.String("Title = :title AND Body = :body AND #s <> :d"),
		ExpressionAttributeNames: map[string]*string{"#s": aws.String("Status")},
		ExpressionAttributeValues: dynamo.Item{
			":u": {S: aws.String(userId)}, ":t": {N: aws.String(since)},
			":title": {S: aws.String(in.Title)}, ":body": {S: aws.String(in.Body)},
			":d": {S: aws.String(PostDeleted)},
		},
		ProjectionExpression: aws.String("PostId"),
	})
	if err != nil {
		return false, err
	}
	return len(out.Items) > 0, nil
}

// ownPost loads a post the caller wrote, for edits and deletion.
func ownPost(postId, userId string) (dynamo.Item, error) {
	item, err := getPost(postId)
	if err != nil {
		return nil, internal(err)
	}
	if item == nil || dynamo.S(item, "Status") == PostDeleted {
		return nil, errPostNotFound
	}
	if dynamo.S(item, "AuthorId") != userId {
		return nil, errPostForbidden
	}
	return item, nil
}

// updatePostResolver edits topic, city, title, body and pictures. The
// board and the anonymity choice stay as they were: switching a post to
// named would reveal who wrote the earlier anonymous version.
func updatePostResolver(p graphql.ResolveParams) (interface{}, error) {
	userId, err := requireUser(p)
	if err != nil {
		return nil, err
	}
	postId, _ := p.Args["PostId"].(string)
	current, err := ownPost(postId, userId)
	if err != nil {
		return nil, err
	}
	if !isCommunityType(dynamo.S(current, "Type")) {
		return nil, errPostNotFound
	}
	raw, _ := p.Args["Input"].(map[string]interface{})
	if raw != nil {
		raw["Type"] = dynamo.S(current, "Type")
	}
	in, err := parsePostInput(raw, listOf(current["Images"])...)
	if err != nil {
		return nil, err
	}
	expr := "SET Topic = :topic, City = :city, Title = :title, Body = :body, UpdatedAt = :u"
	values := dynamo.Item{
		":topic": {S: aws.String(in.Topic)}, ":city": {S: aws.String(in.City)},
		":title": {S: aws.String(in.Title)}, ":body": {S: aws.String(in.Body)},
		":u": {N: aws.String(itoa(nowMs()))},
	}
	if len(in.Images) > 0 {
		expr += ", Images = :img"
		values[":img"] = stringList(in.Images)
	} else {
		expr += " REMOVE Images"
	}
	out, err := svc.UpdateItem(&dynamodb.UpdateItemInput{
		TableName:                 aws.String(dynamo.TablePosts),
		Key:                       dynamo.Item{"PostId": {S: aws.String(postId)}},
		UpdateExpression:          aws.String(expr),
		ExpressionAttributeValues: values,
		ReturnValues:              aws.String(dynamodb.ReturnValueAllNew),
	})
	if err != nil {
		return nil, internal(err)
	}
	reindexPost(out.Attributes)
	views, err := postViews([]dynamo.Item{out.Attributes}, userId)
	if err != nil {
		return nil, internal(err)
	}
	return views[0], nil
}

// deletePostResolver marks the post deleted (kept for moderation and so
// replies to it are not orphaned in notifications) and drops it from
// search.
func deletePostResolver(p graphql.ResolveParams) (interface{}, error) {
	userId, err := requireUser(p)
	if err != nil {
		return nil, err
	}
	postId, _ := p.Args["PostId"].(string)
	if _, err := ownPost(postId, userId); err != nil {
		return nil, err
	}
	if err := setPostStatus(postId, PostDeleted); err != nil {
		return nil, internal(err)
	}
	return true, nil
}

// RecordRetention is how long deleted posts, and the chats and reports
// of a member who left, are kept for disputes and moderation before
// DynamoDB removes them (PurgeAt, epoch seconds). Stated in the privacy
// policy (srcs/frontend/components/legal).
const RecordRetention = 365 * 24 * time.Hour

// PurgeAt is the TTL value for a record kept RecordRetention from now.
func PurgeAt() *dynamodb.AttributeValue {
	return &dynamodb.AttributeValue{N: aws.String(strconv.FormatInt(time.Now().Add(RecordRetention).Unix(), 10))}
}

// setPostStatus is shared with moderation (hide, restore, delete). A
// deleted post loses its photo files at once and its row and comments
// are purged after RecordRetention.
func setPostStatus(postId, status string) error {
	update := "SET #s = :s"
	values := dynamo.Item{":s": {S: aws.String(status)}}
	if status == PostDeleted {
		update = "SET #s = :s, PurgeAt = :p REMOVE Images"
		values[":p"] = PurgeAt()
	}
	out, err := svc.UpdateItem(&dynamodb.UpdateItemInput{
		TableName:                 aws.String(dynamo.TablePosts),
		Key:                       dynamo.Item{"PostId": {S: aws.String(postId)}},
		UpdateExpression:          aws.String(update),
		ConditionExpression:       aws.String("attribute_exists(PostId)"),
		ExpressionAttributeNames:  map[string]*string{"#s": aws.String("Status")},
		ExpressionAttributeValues: values,
		ReturnValues:              aws.String(dynamodb.ReturnValueAllOld),
	})
	if err != nil {
		return err
	}
	item := out.Attributes
	if item == nil {
		return nil // only fakes answer without the old row
	}
	item["Status"] = values[":s"]
	if status == PostDeleted {
		if imgs := item["Images"]; imgs != nil {
			var urls []string
			for _, v := range imgs.L {
				urls = append(urls, aws.StringValue(v.S))
			}
			uploadhandler.DeleteImages(urls...)
		}
		delete(item, "Images")
		purgeComments(postId)
	}
	reindexPost(item)
	return nil
}

// purgeComments schedules the removal of a deleted post's comments.
func purgeComments(postId string) {
	comments, err := dynamo.QueryAll(svc, &dynamodb.QueryInput{
		TableName:                 aws.String(dynamo.TableComments),
		KeyConditionExpression:    aws.String("PostId = :p"),
		ExpressionAttributeValues: dynamo.Item{":p": {S: aws.String(postId)}},
		ProjectionExpression:      aws.String("PostId, CommentId"),
	})
	if err != nil {
		log.Printf("purge comments of %s: %v", postId, err)
		return
	}
	for _, c := range comments {
		if _, err := svc.UpdateItem(&dynamodb.UpdateItemInput{
			TableName:                 aws.String(dynamo.TableComments),
			Key:                       dynamo.Item{"PostId": c["PostId"], "CommentId": c["CommentId"]},
			UpdateExpression:          aws.String("SET PurgeAt = :p"),
			ExpressionAttributeValues: dynamo.Item{":p": PurgeAt()},
		}); err != nil {
			log.Printf("purge comment %s: %v", postId, err)
		}
	}
}

// addToPost moves a counter (CommentCount, LikeCount) and refreshes the
// search document, whose popularity score depends on it.
func addToPost(postId, counter string, delta int) {
	out, err := svc.UpdateItem(&dynamodb.UpdateItemInput{
		TableName:                 aws.String(dynamo.TablePosts),
		Key:                       dynamo.Item{"PostId": {S: aws.String(postId)}},
		UpdateExpression:          aws.String("ADD " + counter + " :d"),
		ConditionExpression:       aws.String("attribute_exists(PostId)"),
		ExpressionAttributeValues: dynamo.Item{":d": {N: aws.String(strconv.Itoa(delta))}},
		ReturnValues:              aws.String(dynamodb.ReturnValueAllNew),
	})
	if err != nil {
		log.Printf("post %s %s %+d: %v", postId, counter, delta, err)
		return
	}
	reindexPost(out.Attributes)
}

func isConditionFailed(err error) bool {
	aerr, ok := err.(awserr.Error)
	return ok && aerr.Code() == dynamodb.ErrCodeConditionalCheckFailedException
}

// likePostResolver turns the viewer's like on or off; the counter only
// moves when the like row actually changed, so repeats are harmless.
func likePostResolver(p graphql.ResolveParams) (interface{}, error) {
	userId, err := requireUser(p)
	if err != nil {
		return nil, err
	}
	postId, _ := p.Args["PostId"].(string)
	on, _ := p.Args["On"].(bool)
	item, err := visibleOfType(postId, userId, PostTypeFree, PostTypeQna)
	if err != nil {
		return nil, internal(err)
	}
	if item == nil {
		return nil, errPostNotFound
	}
	changed, err := toggleRow(dynamo.TablePostLikes, userId, postId, on)
	if err != nil {
		return nil, internal(err)
	}
	if changed {
		delta := 1
		if !on {
			delta = -1
		}
		addToPost(postId, "LikeCount", delta)
	}
	return resolvePost(graphql.ResolveParams{Context: p.Context, Args: map[string]interface{}{"PostId": postId}})
}

func bookmarkPostResolver(p graphql.ResolveParams) (interface{}, error) {
	userId, err := requireUser(p)
	if err != nil {
		return nil, err
	}
	postId, _ := p.Args["PostId"].(string)
	on, _ := p.Args["On"].(bool)
	if on {
		item, err := visiblePost(postId, userId)
		if err != nil {
			return nil, internal(err)
		}
		if item == nil {
			return nil, errPostNotFound
		}
	}
	if _, err := toggleRow(dynamo.TableBookmarks, userId, postId, on); err != nil {
		return nil, internal(err)
	}
	return on, nil
}

// toggleRow puts or deletes a UserId+PostId row and reports whether it
// changed anything.
func toggleRow(table, userId, postId string, on bool) (bool, error) {
	key := dynamo.Item{"UserId": {S: aws.String(userId)}, "PostId": {S: aws.String(postId)}}
	var err error
	if on {
		item := dynamo.Item{"CreatedAt": {N: aws.String(itoa(nowMs()))}}
		for k, v := range key {
			item[k] = v
		}
		_, err = svc.PutItem(&dynamodb.PutItemInput{
			TableName: aws.String(table), Item: item,
			ConditionExpression: aws.String("attribute_not_exists(PostId)"),
		})
	} else {
		_, err = svc.DeleteItem(&dynamodb.DeleteItemInput{
			TableName: aws.String(table), Key: key,
			ConditionExpression: aws.String("attribute_exists(PostId)"),
		})
	}
	if isConditionFailed(err) {
		return false, nil
	}
	return err == nil, err
}

// viewPostResolver counts a view. No login needed and no dedup (MVP);
// the client calls it once per page open.
func viewPostResolver(p graphql.ResolveParams) (interface{}, error) {
	postId, _ := p.Args["PostId"].(string)
	out, err := svc.UpdateItem(&dynamodb.UpdateItemInput{
		TableName:                 aws.String(dynamo.TablePosts),
		Key:                       dynamo.Item{"PostId": {S: aws.String(postId)}},
		UpdateExpression:          aws.String("ADD ViewCount :one"),
		ConditionExpression:       aws.String("attribute_exists(PostId) AND #s = :a"),
		ExpressionAttributeNames:  map[string]*string{"#s": aws.String("Status")},
		ExpressionAttributeValues: dynamo.Item{":one": {N: aws.String("1")}, ":a": {S: aws.String(PostActive)}},
		ReturnValues:              aws.String(dynamodb.ReturnValueUpdatedNew),
	})
	if isConditionFailed(err) {
		return 0, nil
	}
	if err != nil {
		return nil, internal(err)
	}
	return int(num(out.Attributes, "ViewCount")), nil
}
