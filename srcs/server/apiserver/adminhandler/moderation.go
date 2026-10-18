package adminhandler

import (
	"encoding/json"
	"errors"
	"net/http"
	"sort"
	"strconv"
	"strings"
	"time"

	"apiserver/graphqlhandler"

	"local.com/dynamo"
	"local.com/jsonresponse"
	"local.com/jwt"

	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/service/dynamodb"
	"github.com/gorilla/mux"
)

// Report statuses: open in the queue, resolved (action taken) or
// dismissed (nothing wrong, the target is restored).
const (
	ReportOpen      = "open"
	ReportResolved  = "resolved"
	ReportDismissed = "dismissed"
)

// QueueItem is one reported target with every report about it.
type QueueItem struct {
	TargetType    string
	TargetId      string
	Count         int // reports in this view
	Counted       int // reports from established accounts (auto-hide)
	Reasons       map[string]int
	Details       []string
	FirstAt       float64
	LastAt        float64
	Title         string
	Body          string
	TargetStatus  string
	Link          string
	OwnerId       string
	OwnerNickname string
	OwnerEmail    string
	Anonymous     bool
	Flags         []string
	Missing       bool // the target no longer exists
}

func reportsHandler(w http.ResponseWriter, r *http.Request) {
	status := r.URL.Query().Get("status")
	if status == "" {
		status = ReportOpen
	}
	typ := r.URL.Query().Get("type")

	items, err := scan(dynamo.TableReports, "", nil)
	if err != nil {
		jsonresponse.Internal(w, err)
		return
	}
	groups := map[string]*QueueItem{}
	var order []*QueueItem
	for _, it := range items {
		if dynamo.S(it, "Status") != status || (typ != "" && dynamo.S(it, "TargetType") != typ) {
			continue
		}
		key := dynamo.S(it, "TargetType") + ":" + dynamo.S(it, "TargetId")
		g := groups[key]
		if g == nil {
			g = &QueueItem{TargetType: dynamo.S(it, "TargetType"), TargetId: dynamo.S(it, "TargetId"), Reasons: map[string]int{}, OwnerId: dynamo.S(it, "TargetOwner")}
			groups[key] = g
			order = append(order, g)
		}
		at := num(it, "CreatedAt")
		g.Count++
		if v := it["Counted"]; v != nil && v.BOOL != nil && *v.BOOL {
			g.Counted++
		}
		g.Reasons[dynamo.S(it, "Reason")]++
		if d := dynamo.S(it, "Detail"); d != "" && len(g.Details) < 5 {
			g.Details = append(g.Details, d)
		}
		if g.FirstAt == 0 || at < g.FirstAt {
			g.FirstAt = at
		}
		if at > g.LastAt {
			g.LastAt = at
		}
	}

	page, totalPages, start, end := paginate(len(order), r.URL.Query().Get("page"))
	// Most reported first, then the most recent.
	sort.SliceStable(order, func(i, j int) bool {
		if order[i].Count != order[j].Count {
			return order[i].Count > order[j].Count
		}
		return order[i].LastAt > order[j].LastAt
	})
	pageItems := order[start:end]
	var owners []string
	for _, g := range pageItems {
		t, err := graphqlhandler.DescribeReportTarget(g.TargetType, g.TargetId)
		if err != nil {
			jsonresponse.Internal(w, err)
			return
		}
		if t == nil {
			g.Missing = true
			continue
		}
		g.Title, g.Body, g.TargetStatus, g.Link, g.Flags, g.Anonymous = t.Title, t.Body, t.Status, t.Link, t.Flags, t.Anonymous
		if t.OwnerId != "" {
			g.OwnerId = t.OwnerId
		}
		owners = append(owners, g.OwnerId)
	}
	users, err := nicknames(owners)
	if err != nil {
		jsonresponse.Internal(w, err)
		return
	}
	for _, g := range pageItems {
		g.OwnerNickname = dynamo.S(users[g.OwnerId], "UserNickname")
		g.OwnerEmail = dynamo.S(users[g.OwnerId], "Email")
	}
	if pageItems == nil {
		pageItems = []*QueueItem{}
	}
	jsonresponse.New(w, http.StatusOK, Page{Items: pageItems, Page: page, TotalPages: totalPages, Total: len(order)})
}

// Queue actions.
const (
	ActionDismiss = "dismiss" // nothing wrong: restore if hidden
	ActionHide    = "hide"    // keep (or make) it hidden
	ActionDelete  = "delete"  // remove the post, comment or product
	// ActionResolve closes the reports as handled without touching the
	// target (chats and members: the admin suspends from the member list).
	ActionResolve = "resolve"
)

var errNoTarget = errors.New("대상을 찾을 수 없어요.")

// applyAction changes the target itself.
func applyAction(targetType, targetId, action string) error {
	postId, commentId, _ := strings.Cut(targetId, "#")
	switch {
	// Closing as handled never touches the target, whatever it is (also
	// posts or comments their author already deleted).
	case action == ActionResolve:
		return nil
	case targetType == graphqlhandler.ReportPost:
		status := map[string]string{ActionDismiss: graphqlhandler.PostActive, ActionHide: graphqlhandler.PostHidden, ActionDelete: graphqlhandler.PostDeleted}[action]
		item, err := graphqlhandler.DescribeReportTarget(targetType, targetId)
		if err != nil || item == nil {
			return errOr(err, errNoTarget)
		}
		// Dismissing only lifts a hide; it never revives a deleted post.
		if action == ActionDismiss && item.Status != graphqlhandler.PostHidden {
			return nil
		}
		return graphqlhandler.ModeratePost(targetId, status)
	case targetType == graphqlhandler.ReportComment:
		status := map[string]string{ActionDismiss: graphqlhandler.CommentActive, ActionHide: graphqlhandler.CommentHidden, ActionDelete: graphqlhandler.CommentDeleted}[action]
		item, err := graphqlhandler.DescribeReportTarget(targetType, targetId)
		if err != nil || item == nil {
			return errOr(err, errNoTarget)
		}
		if action == ActionDismiss && item.Status != graphqlhandler.CommentHidden {
			return nil
		}
		return graphqlhandler.ModerateComment(postId, commentId, status)
	case targetType == graphqlhandler.ReportProduct && action == ActionDelete:
		owner, err := productOwner(targetId)
		if err != nil {
			return err
		}
		return graphqlhandler.RemoveProduct(targetId, owner)
	case action == ActionDismiss:
		return nil
	}
	return errors.New("이 대상에는 할 수 없는 처리예요.")
}

func errOr(err, fallback error) error {
	if err != nil {
		return err
	}
	return fallback
}

// resolveReportsHandler applies an action to a target and closes every
// open report about it.
func resolveReportsHandler(w http.ResponseWriter, r *http.Request) {
	var body struct{ TargetType, TargetId, Action string }
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.TargetType == "" || body.TargetId == "" {
		jsonresponse.Error(w, http.StatusBadRequest, "처리할 대상을 알려주세요.")
		return
	}
	if body.Action != ActionDismiss && body.Action != ActionHide && body.Action != ActionDelete && body.Action != ActionResolve {
		jsonresponse.Error(w, http.StatusBadRequest, "알 수 없는 처리예요.")
		return
	}
	if err := applyAction(body.TargetType, body.TargetId, body.Action); err != nil {
		if errors.Is(err, errNoTarget) && body.Action == ActionDismiss {
			err = nil // gone already: just close the reports
		} else {
			jsonresponse.Error(w, http.StatusBadRequest, err.Error())
			return
		}
	}

	open, err := dynamo.ScanAll(svc, &dynamodb.ScanInput{
		TableName:                aws.String(dynamo.TableReports),
		FilterExpression:         aws.String("TargetType = :t AND TargetId = :i AND #s = :o"),
		ExpressionAttributeNames: map[string]*string{"#s": aws.String("Status")},
		ExpressionAttributeValues: dynamo.Item{
			":t": {S: aws.String(body.TargetType)}, ":i": {S: aws.String(body.TargetId)}, ":o": {S: aws.String(ReportOpen)},
		},
		ProjectionExpression: aws.String("ReportId"),
	})
	if err != nil {
		jsonresponse.Internal(w, err)
		return
	}
	status := ReportResolved
	if body.Action == ActionDismiss {
		status = ReportDismissed
	}
	now := time.Now().UnixMilli()
	for _, rep := range open {
		if _, err := svc.UpdateItem(&dynamodb.UpdateItemInput{
			TableName:                aws.String(dynamo.TableReports),
			Key:                      dynamo.Item{"ReportId": rep["ReportId"]},
			UpdateExpression:         aws.String("SET #s = :s, ResolvedAt = :at, ResolvedBy = :by, #a = :a"),
			ExpressionAttributeNames: map[string]*string{"#s": aws.String("Status"), "#a": aws.String("Action")},
			ExpressionAttributeValues: dynamo.Item{
				":s": {S: aws.String(status)}, ":at": {N: aws.String(strconv.FormatInt(now, 10))},
				":by": {S: aws.String(jwt.UserID(r.Context()))}, ":a": {S: aws.String(body.Action)},
			},
		}); err != nil {
			jsonresponse.Internal(w, err)
			return
		}
	}
	jsonresponse.New(w, http.StatusOK, map[string]interface{}{"Closed": len(open), "Status": status})
}

// AdminPost is a row of the post list. The real author is shown even for
// anonymous posts: admins need it to act on reports.
type AdminPost struct {
	PostId         string
	Type           string
	Topic          string
	Title          string
	Status         string
	Deal           string
	AuthorId       string
	AuthorNickname string
	AuthorEmail    string
	Anonymous      bool
	Flags          []string
	ReportCount    float64
	CommentCount   float64
	CreatedAt      float64
}

func stringsOf(v *dynamodb.AttributeValue) []string {
	out := []string{}
	if v != nil {
		for _, e := range v.L {
			if e.S != nil {
				out = append(out, *e.S)
			}
		}
	}
	return out
}

func postsHandler(w http.ResponseWriter, r *http.Request) {
	q := strings.TrimSpace(r.URL.Query().Get("q"))
	typ := r.URL.Query().Get("type")
	status := r.URL.Query().Get("status")
	flagged := r.URL.Query().Get("flagged") == "1"

	items, err := scan(dynamo.TablePosts,
		"PostId, #t, Topic, Title, #s, Deal, AuthorId, Anonymous, Flags, ReportCount, CommentCount, CreatedAt",
		map[string]*string{"#t": aws.String("Type"), "#s": aws.String("Status")})
	if err != nil {
		jsonresponse.Internal(w, err)
		return
	}
	var ids []string
	for _, it := range items {
		ids = append(ids, dynamo.S(it, "AuthorId"))
	}
	users, err := nicknames(ids)
	if err != nil {
		jsonresponse.Internal(w, err)
		return
	}
	posts := []AdminPost{}
	for _, it := range items {
		p := AdminPost{
			PostId: dynamo.S(it, "PostId"), Type: dynamo.S(it, "Type"), Topic: dynamo.S(it, "Topic"),
			Title: dynamo.S(it, "Title"), Status: dynamo.S(it, "Status"), Deal: dynamo.S(it, "Deal"),
			AuthorId: dynamo.S(it, "AuthorId"), Flags: stringsOf(it["Flags"]),
			ReportCount: num(it, "ReportCount"), CommentCount: num(it, "CommentCount"), CreatedAt: num(it, "CreatedAt"),
		}
		if v := it["Anonymous"]; v != nil && v.BOOL != nil {
			p.Anonymous = *v.BOOL
		}
		p.AuthorNickname = dynamo.S(users[p.AuthorId], "UserNickname")
		p.AuthorEmail = dynamo.S(users[p.AuthorId], "Email")
		if (typ == "" || typ == p.Type) && (status == "" || status == p.Status) &&
			(!flagged || len(p.Flags) > 0 || p.ReportCount > 0) && matches(q, p.Title, p.AuthorNickname, p.AuthorEmail) {
			posts = append(posts, p)
		}
	}
	sort.SliceStable(posts, func(i, j int) bool { return posts[i].CreatedAt > posts[j].CreatedAt })
	page, totalPages, start, end := paginate(len(posts), r.URL.Query().Get("page"))
	jsonresponse.New(w, http.StatusOK, Page{Items: posts[start:end], Page: page, TotalPages: totalPages, Total: len(posts)})
}

func updatePostHandler(w http.ResponseWriter, r *http.Request) {
	var body struct{ Status string }
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		jsonresponse.Error(w, http.StatusBadRequest, "잘못된 요청이에요.")
		return
	}
	switch err := graphqlhandler.ModeratePost(mux.Vars(r)["id"], body.Status); {
	case errors.Is(err, graphqlhandler.ErrPostNotFound):
		jsonresponse.Error(w, http.StatusNotFound, err.Error())
	case errors.Is(err, graphqlhandler.ErrBadModeration):
		jsonresponse.Error(w, http.StatusBadRequest, err.Error())
	case err != nil:
		jsonresponse.Internal(w, err)
	default:
		jsonresponse.New(w, http.StatusOK, map[string]string{"Status": body.Status})
	}
}
