package graphqlhandler

import (
	"context"
	"errors"
	"log"
	"math"
	"os"
	"strconv"
	"strings"
	"time"
	"unicode/utf8"

	"apiserver/eshandler"

	"local.com/dynamo"
	"local.com/jwt"
	"local.com/notify"

	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/service/dynamodb"
	"github.com/google/uuid"
	"github.com/graphql-go/graphql"
)

// Housing and job posts ("listings") share the Posts table and the posts
// index with the community boards, plus structured fields, a map
// position, a deal state and an expiry (docs/community-plan.md 4-2/4-3).
const (
	PostTypeHousing = "housing"
	PostTypeJob     = "job"
)

// Values below must match srcs/frontend/libs/constants.ts.
var HousingKinds = []string{"쉐어", "스튜디오·원룸", "아파트 전체", "서블렛", "단기·민박"}

var JobSectors = []string{"식당·카페", "판매·매장", "사무", "과외·강사", "베이비시터", "가이드·통역", "기타"}

var EmploymentTypes = []string{"알바", "정규직", "인턴", "프리랜서"}

var JobLanguages = []string{"한국어", "프랑스어", "영어"}

var listingModes = map[string][]string{
	PostTypeHousing: {"offer", "seek"},     // 방 있어요 / 방 구해요
	PostTypeJob:     {"hiring", "seeking"}, // 구인 / 구직
}

var wageTypes = []string{"hourly", "monthly", "negotiable"}

// Deal states; closed listings leave the default lists.
const (
	DealOpen     = "open"
	DealReserved = "reserved"
	DealClosed   = "closed"
)

var deals = []string{DealOpen, DealReserved, DealClosed}

const (
	// ListingLifetime: a listing expires after 30 days unless extended.
	ListingLifetime = 30 * 24 * time.Hour
	// expiryNotice: the author is told this long before it expires.
	expiryNotice = 3 * 24 * time.Hour
	// extendWindow: extending is possible this close to expiry (or after).
	extendWindow = 7 * 24 * time.Hour
	bumpInterval = 24 * time.Hour
)

// At most this many open listings per member and type.
var activeListingCap = map[string]int{PostTypeHousing: 3, PostTypeJob: 5}

var (
	errNotEligible = errors.New("가입 후 일주일이 지나야 집·알바 글을 쓸 수 있어요. 커뮤니티에서 먼저 활동해보세요.")
	errListingCap  = errors.New("올릴 수 있는 글 수를 넘었어요. 끝난 글은 '완료'로 바꿔주세요.")
)

func isListingType(t string) bool { return t == PostTypeHousing || t == PostTypeJob }

// minAccountAge is how old an account must be to post housing or jobs
// (LISTING_MIN_ACCOUNT_DAYS, default 7). Scam accounts are usually new.
func minAccountAge() time.Duration {
	days := 7
	if v, err := strconv.Atoi(os.Getenv("LISTING_MIN_ACCOUNT_DAYS")); err == nil && v >= 0 {
		days = v
	}
	return time.Duration(days) * 24 * time.Hour
}

// smicHourly is the gross legal minimum hourly wage in mainland France.
// It changes on 1 January and also mid-year when inflation passes 2%
// (as on 1 June 2026): set SMIC_HOURLY or update the default.
func smicHourly() float64 {
	if v, err := strconv.ParseFloat(os.Getenv("SMIC_HOURLY"), 64); err == nil && v > 0 {
		return v
	}
	return 12.31 // since 2026-06-01 (12.02 from 2026-01-01)
}

// canPostListing checks account age; admins are exempt.
func canPostListing(userId string) error {
	age, admin, err := accountAge(userId)
	if err != nil {
		return internal(err)
	}
	if !admin && age < minAccountAge() {
		return errNotEligible
	}
	return nil
}

// openListings counts a member's listings of one type that still count
// toward the cap (active and not closed).
func openListings(userId, typ string) (int, error) {
	items, err := dynamo.QueryAll(svc, &dynamodb.QueryInput{
		TableName:              aws.String(dynamo.TablePosts),
		IndexName:              aws.String("AuthorIndex"),
		KeyConditionExpression: aws.String("AuthorId = :u"),
		FilterExpression:       aws.String("#t = :t AND #s = :a AND Deal <> :c"),
		ExpressionAttributeNames: map[string]*string{
			"#t": aws.String("Type"), "#s": aws.String("Status"),
		},
		ExpressionAttributeValues: dynamo.Item{
			":u": {S: aws.String(userId)}, ":t": {S: aws.String(typ)},
			":a": {S: aws.String(PostActive)}, ":c": {S: aws.String(DealClosed)},
		},
		ProjectionExpression: aws.String("PostId"),
	})
	return len(items), err
}

type listingInput struct {
	Type, Title, Body, City string
	Images                  []string
	Geo                     *geoInput
	Topic                   string
	Fields                  dynamo.Item // the Housing or Job map
	Contact                 dynamo.Item // job contact (Phone, Email), nil when none
	Warnings                []string
}

const dateLayout = "2006-01-02"

func argString(m map[string]interface{}, k string) string {
	s, _ := m[k].(string)
	return strings.TrimSpace(s)
}

func argFloat(m map[string]interface{}, k string) (float64, bool) {
	switch v := m[k].(type) {
	case float64:
		return v, !math.IsNaN(v) && !math.IsInf(v, 0)
	case int:
		return float64(v), true
	}
	return 0, false
}

func argInt(m map[string]interface{}, k string) (int, bool) {
	switch v := m[k].(type) {
	case int:
		return v, true
	case float64:
		return int(v), v == math.Trunc(v)
	}
	return 0, false
}

func argBool(m map[string]interface{}, k string) bool {
	b, _ := m[k].(bool)
	return b
}

func numAttr(f float64) *dynamodb.AttributeValue {
	return &dynamodb.AttributeValue{N: aws.String(strconv.FormatFloat(f, 'f', -1, 64))}
}

func boolAttr(b bool) *dynamodb.AttributeValue { return &dynamodb.AttributeValue{BOOL: aws.Bool(b)} }

func strAttr(s string) *dynamodb.AttributeValue { return &dynamodb.AttributeValue{S: aws.String(s)} }

func parseDate(s string) (time.Time, bool) {
	t, err := time.Parse(dateLayout, s)
	return t, err == nil
}

// parseListingInput validates a ListingInput; keep lists image URLs the
// listing already has.
func parseListingInput(raw interface{}, keep ...string) (listingInput, error) {
	args, _ := raw.(map[string]interface{})
	in := listingInput{
		Type:  argString(args, "Type"),
		Title: strings.Join(strings.Fields(argString(args, "Title")), " "),
		Body:  argString(args, "Body"),
		City:  argString(args, "City"),
	}
	switch {
	case !isListingType(in.Type):
		return in, errUnknownPostTyp
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
	if len(in.Images) > 8 {
		return in, errors.New("사진은 최대 8장까지 올릴 수 있어요.")
	}
	geo, err := parseGeo(args)
	if err != nil {
		return in, err
	}
	if geo == nil {
		return in, errors.New("지도에서 위치를 골라주세요.")
	}
	in.Geo = geo

	if in.Type == PostTypeHousing {
		err = parseHousing(&in, args)
	} else {
		err = parseJob(&in, args)
	}
	if err != nil {
		return in, err
	}
	in.Warnings = append(riskWarnings(in.Title, in.Body), in.Warnings...)
	return in, nil
}

func parseHousing(in *listingInput, args map[string]interface{}) error {
	h, _ := args["Housing"].(map[string]interface{})
	if h == nil {
		return errors.New("집 정보를 입력해주세요.")
	}
	mode := argString(h, "Mode")
	kind := argString(h, "Kind")
	if !contains(listingModes[PostTypeHousing], mode) {
		return errors.New("'방 있어요' 또는 '방 구해요'를 골라주세요.")
	}
	if !contains(HousingKinds, kind) {
		return errors.New("집 형태를 골라주세요.")
	}
	rent, ok := argFloat(h, "Rent")
	if !ok || rent < 0 || rent > 20000 {
		return errors.New("월세를 올바르게 입력해주세요.")
	}
	fields := dynamo.Item{
		"Mode":            strAttr(mode),
		"Kind":            strAttr(kind),
		"Rent":            numAttr(rent),
		"ChargesIncluded": boolAttr(argBool(h, "ChargesIncluded")),
		"Furnished":       boolAttr(argBool(h, "Furnished")),
		"Caf":             boolAttr(argBool(h, "Caf")),
		"Pets":            boolAttr(argBool(h, "Pets")),
	}
	if dep, ok := argFloat(h, "Deposit"); ok {
		if dep < 0 || dep > 50000 {
			return errors.New("보증금을 올바르게 입력해주세요.")
		}
		fields["Deposit"] = numAttr(dep)
	}
	from := argString(h, "AvailableFrom")
	fromDate, ok := parseDate(from)
	if !ok {
		return errors.New("입주 가능일을 골라주세요.")
	}
	if fromDate.After(time.Now().AddDate(2, 0, 0)) {
		return errors.New("입주 가능일이 너무 멀어요.")
	}
	fields["AvailableFrom"] = strAttr(from)
	if end := argString(h, "EndDate"); end != "" {
		endDate, ok := parseDate(end)
		if !ok || !endDate.After(fromDate) {
			return errors.New("종료일은 입주 가능일 이후로 골라주세요.")
		}
		fields["EndDate"] = strAttr(end)
	} else if kind == "서블렛" {
		return errors.New("서블렛은 종료일을 입력해주세요.")
	}
	if months, ok := argInt(h, "MinMonths"); ok && months > 0 {
		if months > 36 {
			return errors.New("최소 기간은 36개월 이하로 입력해주세요.")
		}
		fields["MinMonths"] = numAttr(float64(months))
	}
	if size, ok := argFloat(h, "Size"); ok && size > 0 {
		if size > 1000 {
			return errors.New("면적을 올바르게 입력해주세요.")
		}
		fields["Size"] = numAttr(size)
	}
	if rooms, ok := argInt(h, "Rooms"); ok && rooms > 0 {
		if rooms > 20 {
			return errors.New("방 수를 올바르게 입력해주세요.")
		}
		fields["Rooms"] = numAttr(float64(rooms))
	}
	// Someone offering a place shows it; "seek" posts may have none.
	if mode == "offer" && len(in.Images) == 0 {
		return errors.New("방 사진을 1장 이상 올려주세요.")
	}
	// Housing shows only the neighbourhood, never the address.
	in.Geo.Exact = false
	in.Topic = kind
	in.Fields = fields
	return nil
}

func parseJob(in *listingInput, args map[string]interface{}) error {
	j, _ := args["Job"].(map[string]interface{})
	if j == nil {
		return errors.New("알바 정보를 입력해주세요.")
	}
	mode := argString(j, "Mode")
	sector := argString(j, "Sector")
	employment := argString(j, "Employment")
	wageType := argString(j, "WageType")
	switch {
	case !contains(listingModes[PostTypeJob], mode):
		return errors.New("'구인' 또는 '구직'을 골라주세요.")
	case !contains(JobSectors, sector):
		return errors.New("업종을 골라주세요.")
	case !contains(EmploymentTypes, employment):
		return errors.New("고용 형태를 골라주세요.")
	case !contains(wageTypes, wageType):
		return errors.New("급여 방식을 골라주세요.")
	}
	fields := dynamo.Item{
		"Mode":           strAttr(mode),
		"Sector":         strAttr(sector),
		"Employment":     strAttr(employment),
		"WageType":       strAttr(wageType),
		"PermitRequired": boolAttr(argBool(j, "PermitRequired")),
	}
	if wageType != "negotiable" {
		wage, ok := argFloat(j, "Wage")
		if !ok || wage <= 0 || wage > 100000 {
			return errors.New("급여를 올바르게 입력해주세요.")
		}
		fields["Wage"] = numAttr(wage)
		if mode == "hiring" && wageType == "hourly" && wage < smicHourly() {
			in.Warnings = append(in.Warnings, RiskLowWage)
		}
	}
	if schedule := argString(j, "Schedule"); schedule != "" {
		if utf8.RuneCountInString(schedule) > 200 {
			return errors.New("근무 시간은 200자 이하로 입력해주세요.")
		}
		fields["Schedule"] = strAttr(schedule)
	}
	if list, ok := j["Languages"].([]interface{}); ok {
		var langs []string
		for _, v := range list {
			if s, _ := v.(string); contains(JobLanguages, s) && !contains(langs, s) {
				langs = append(langs, s)
			}
		}
		if len(langs) > 0 {
			fields["Languages"] = stringList(langs)
		}
	}
	// Contact details are only for employers; seekers talk through chat.
	if c, _ := args["Contact"].(map[string]interface{}); c != nil && mode == "hiring" {
		phone, email := argString(c, "Phone"), argString(c, "Email")
		contact := dynamo.Item{}
		if phone != "" {
			if utf8.RuneCountInString(phone) > 30 || !phoneRe.MatchString(phone) {
				return errors.New("전화번호를 올바르게 입력해주세요.")
			}
			contact["Phone"] = strAttr(phone)
		}
		if email != "" {
			if len(email) > 100 || !emailRe.MatchString(email) {
				return errors.New("이메일을 올바르게 입력해주세요.")
			}
			contact["Email"] = strAttr(email)
		}
		if len(contact) > 0 {
			in.Contact = contact
		}
	}
	in.Topic = sector
	in.Fields = fields
	return nil
}

func fieldsAttr(typ string) string {
	if typ == PostTypeHousing {
		return "Housing"
	}
	return "Job"
}

// addListingFields copies the structured part into a Post view. Contact
// details are never included, only whether there are any.
func addListingFields(view map[string]interface{}, item dynamo.Item) {
	typ := dynamo.S(item, "Type")
	if !isListingType(typ) {
		return
	}
	view["Deal"] = dynamo.S(item, "Deal")
	view["ExpiresAt"] = num(item, "ExpiresAt")
	view["BumpedAt"] = num(item, "BumpedAt")
	view["AreaId"] = dynamo.S(item, "AreaId")
	view["AreaName"] = dynamo.S(item, "AreaName")
	view["Latitude"] = num(item, "Latitude")
	view["Longitude"] = num(item, "Longitude")
	view["ExactLocation"] = boolOf(item, "ExactLocation")
	view["HasContact"] = item["Contact"] != nil && len(item["Contact"].M) > 0
	if v := item[fieldsAttr(typ)]; v != nil && v.M != nil {
		info := toMap(v.M)
		if langs := v.M["Languages"]; langs != nil {
			info["Languages"] = listOf(langs)
		}
		view[fieldsAttr(typ)] = info
	}
}

// ---- queries ----

func floatPtr(m map[string]interface{}, k string) *float64 {
	if f, ok := argFloat(m, k); ok {
		return &f
	}
	return nil
}

func stringsArg(m map[string]interface{}, k string, allowed []string) []string {
	var out []string
	if list, ok := m[k].([]interface{}); ok {
		for _, v := range list {
			if s, _ := v.(string); contains(allowed, s) {
				out = append(out, s)
			}
		}
	}
	return out
}

// resolveListings lists housing or job posts with their filters.
func resolveListings(p graphql.ResolveParams) (interface{}, error) {
	viewer := jwt.UserID(p.Context)
	typ, _ := p.Args["Type"].(string)
	if !isListingType(typ) {
		return nil, errUnknownPostTyp
	}
	q := eshandler.PostQuery{Country: DefaultCountry, Types: []string{typ}}
	q.City, _ = p.Args["City"].(string)
	q.Q, _ = p.Args["Q"].(string)
	q.Sort, _ = p.Args["Sort"].(string)
	if v, ok := p.Args["Page"].(int); ok {
		q.Page = v
	}
	if v, ok := p.Args["Size"].(int); ok {
		q.Size = v
	}
	if q.Page < 1 {
		q.Page = 1
	}
	if h, ok := p.Args["Housing"].(map[string]interface{}); ok && typ == PostTypeHousing {
		if mode := argString(h, "Mode"); contains(listingModes[typ], mode) {
			q.Mode = mode
		}
		q.Topics = stringsArg(h, "Kinds", HousingKinds)
		q.MinRent, q.MaxRent = floatPtr(h, "MinRent"), floatPtr(h, "MaxRent")
		if by := argString(h, "AvailableBy"); by != "" {
			if _, ok := parseDate(by); ok {
				q.AvailableBy = by
			}
		}
		q.Furnished, q.Caf, q.Pets = argBool(h, "Furnished"), argBool(h, "Caf"), argBool(h, "Pets")
	}
	if j, ok := p.Args["Job"].(map[string]interface{}); ok && typ == PostTypeJob {
		if mode := argString(j, "Mode"); contains(listingModes[typ], mode) {
			q.Mode = mode
		}
		q.Topics = stringsArg(j, "Sectors", JobSectors)
		q.Employment = stringsArg(j, "Employment", EmploymentTypes)
		q.MinWage = floatPtr(j, "MinWage")
		q.PermitFree = argBool(j, "PermitFree")
	}
	near, err := nearFilter(p.Args)
	if err != nil {
		return nil, err
	}
	q.Near = near

	return postPage(q, viewer)
}

func resolveListing(p graphql.ResolveParams) (interface{}, error) {
	args := map[string]interface{}{"PostId": p.Args["PostId"], "types": []string{PostTypeHousing, PostTypeJob}}
	return resolvePost(graphql.ResolveParams{Context: p.Context, Args: args})
}

// ---- mutations ----

// listingResult: with warnings and no Acknowledge nothing is saved; the
// author confirms and sends the same input again with Acknowledge.
func listingResult(post interface{}, warnings []string) map[string]interface{} {
	if warnings == nil {
		warnings = []string{}
	}
	return map[string]interface{}{"Post": post, "Warnings": warnings}
}

func createListingResolver(p graphql.ResolveParams) (interface{}, error) {
	userId, err := requireUser(p)
	if err != nil {
		return nil, err
	}
	in, err := parseListingInput(p.Args["Input"])
	if err != nil {
		return nil, err
	}
	if err := canPostListing(userId); err != nil {
		return nil, err
	}
	if ack, _ := p.Args["Acknowledge"].(bool); len(in.Warnings) > 0 && !ack {
		return listingResult(nil, in.Warnings), nil
	}
	if dup, err := isDuplicatePost(userId, postInput{Title: in.Title, Body: in.Body}); err != nil {
		return nil, internal(err)
	} else if dup {
		return nil, errDuplicatePost
	}
	if n, err := openListings(userId, in.Type); err != nil {
		return nil, internal(err)
	} else if n >= activeListingCap[in.Type] {
		return nil, errListingCap
	}
	if !postLimiter.Allow(userId) {
		return nil, errTooManyPosts
	}
	geo, err := locate(in.Geo)
	if err != nil {
		return nil, err
	}

	postId := uuid.NewString()
	now := time.Now()
	ts := itoa(now.UnixMilli())
	item := dynamo.Item{
		"PostId":            strAttr(postId),
		"Type":              strAttr(in.Type),
		"Topic":             strAttr(in.Topic),
		"Country":           strAttr(DefaultCountry),
		"City":              strAttr(in.City),
		"AuthorId":          strAttr(userId),
		"Anonymous":         boolAttr(false),
		"Title":             strAttr(in.Title),
		"Body":              strAttr(in.Body),
		"Status":            strAttr(PostActive),
		"Deal":              strAttr(DealOpen),
		"CreatedAt":         {N: aws.String(ts)},
		"UpdatedAt":         {N: aws.String(ts)},
		"ExpiresAt":         {N: aws.String(itoa(now.Add(ListingLifetime).UnixMilli()))},
		"ExpiryNotified":    boolAttr(false),
		"CommentCount":      {N: aws.String("0")},
		"LikeCount":         {N: aws.String("0")},
		"ViewCount":         {N: aws.String("0")},
		fieldsAttr(in.Type): {M: in.Fields},
	}
	for k, v := range geo {
		item[k] = v
	}
	if len(in.Images) > 0 {
		item["Images"] = stringList(in.Images)
	}
	if in.Contact != nil {
		item["Contact"] = &dynamodb.AttributeValue{M: in.Contact}
	}
	if len(in.Warnings) > 0 {
		item["Flags"] = stringList(in.Warnings)
	}
	if _, err := svc.PutItem(&dynamodb.PutItemInput{TableName: aws.String(dynamo.TablePosts), Item: item}); err != nil {
		return nil, internal(err)
	}
	if err := eshandler.IndexPost(eshandler.PostDocFromItem(item)); err != nil {
		if _, derr := svc.DeleteItem(&dynamodb.DeleteItemInput{
			TableName: aws.String(dynamo.TablePosts),
			Key:       dynamo.Item{"PostId": strAttr(postId)},
		}); derr != nil {
			log.Printf("rollback of listing %s failed: %v", postId, derr)
		}
		return nil, internal(err)
	}
	views, err := postViews([]dynamo.Item{item}, userId)
	if err != nil {
		return nil, internal(err)
	}
	return listingResult(views[0], in.Warnings), nil
}

// ownListing is ownPost limited to housing/job posts.
func ownListing(postId, userId string) (dynamo.Item, error) {
	item, err := ownPost(postId, userId)
	if err != nil {
		return nil, err
	}
	if !isListingType(dynamo.S(item, "Type")) {
		return nil, errPostNotFound
	}
	return item, nil
}

func updateListingResolver(p graphql.ResolveParams) (interface{}, error) {
	userId, err := requireUser(p)
	if err != nil {
		return nil, err
	}
	postId, _ := p.Args["PostId"].(string)
	current, err := ownListing(postId, userId)
	if err != nil {
		return nil, err
	}
	raw, _ := p.Args["Input"].(map[string]interface{})
	if raw != nil {
		raw["Type"] = dynamo.S(current, "Type")
	}
	in, err := parseListingInput(raw, listOf(current["Images"])...)
	if err != nil {
		return nil, err
	}
	if ack, _ := p.Args["Acknowledge"].(bool); len(in.Warnings) > 0 && !ack {
		return listingResult(nil, in.Warnings), nil
	}
	geo, err := locate(in.Geo)
	if err != nil {
		return nil, err
	}

	set := []string{"Topic = :topic", "City = :city", "Title = :title", "Body = :body", "UpdatedAt = :u", "#f = :fields"}
	var remove []string
	values := dynamo.Item{
		":topic": strAttr(in.Topic), ":city": strAttr(in.City), ":title": strAttr(in.Title),
		":body": strAttr(in.Body), ":u": {N: aws.String(itoa(nowMs()))}, ":fields": {M: in.Fields},
	}
	names := map[string]*string{"#f": aws.String(fieldsAttr(in.Type))}
	for _, k := range []string{"Latitude", "Longitude", "ExactLocation", "AreaId", "AreaName"} {
		if v, ok := geo[k]; ok {
			set = append(set, k+" = :"+k)
			values[":"+k] = v
		} else {
			remove = append(remove, k)
		}
	}
	optional := map[string]*dynamodb.AttributeValue{}
	if len(in.Images) > 0 {
		optional["Images"] = stringList(in.Images)
	}
	if in.Contact != nil {
		optional["Contact"] = &dynamodb.AttributeValue{M: in.Contact}
	}
	if len(in.Warnings) > 0 {
		optional["Flags"] = stringList(in.Warnings)
	}
	for _, k := range []string{"Images", "Contact", "Flags"} {
		if v, ok := optional[k]; ok {
			set = append(set, k+" = :"+k)
			values[":"+k] = v
		} else {
			remove = append(remove, k)
		}
	}
	expr := "SET " + strings.Join(set, ", ")
	if len(remove) > 0 {
		expr += " REMOVE " + strings.Join(remove, ", ")
	}
	out, err := svc.UpdateItem(&dynamodb.UpdateItemInput{
		TableName:                 aws.String(dynamo.TablePosts),
		Key:                       dynamo.Item{"PostId": strAttr(postId)},
		UpdateExpression:          aws.String(expr),
		ExpressionAttributeNames:  names,
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
	return listingResult(views[0], in.Warnings), nil
}

// updateListing runs an UpdateItem on the caller's listing and returns
// its fresh view.
func updateListing(p graphql.ResolveParams, userId, postId string, in *dynamodb.UpdateItemInput) (interface{}, error) {
	in.TableName = aws.String(dynamo.TablePosts)
	in.Key = dynamo.Item{"PostId": strAttr(postId)}
	in.ReturnValues = aws.String(dynamodb.ReturnValueAllNew)
	out, err := svc.UpdateItem(in)
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

func setListingDealResolver(p graphql.ResolveParams) (interface{}, error) {
	userId, err := requireUser(p)
	if err != nil {
		return nil, err
	}
	postId, _ := p.Args["PostId"].(string)
	deal, _ := p.Args["Deal"].(string)
	if !contains(deals, deal) {
		return nil, errors.New("알 수 없는 상태예요.")
	}
	current, err := ownListing(postId, userId)
	if err != nil {
		return nil, err
	}
	// Reopening counts toward the cap again.
	if deal != DealClosed && dynamo.S(current, "Deal") == DealClosed {
		if n, err := openListings(userId, dynamo.S(current, "Type")); err != nil {
			return nil, internal(err)
		} else if n >= activeListingCap[dynamo.S(current, "Type")] {
			return nil, errListingCap
		}
	}
	return updateListing(p, userId, postId, &dynamodb.UpdateItemInput{
		UpdateExpression:          aws.String("SET Deal = :d"),
		ExpressionAttributeValues: dynamo.Item{":d": strAttr(deal)},
	})
}

// extendListingResolver gives a listing another 30 days, from 7 days
// before expiry on (and after it expired).
func extendListingResolver(p graphql.ResolveParams) (interface{}, error) {
	userId, err := requireUser(p)
	if err != nil {
		return nil, err
	}
	postId, _ := p.Args["PostId"].(string)
	current, err := ownListing(postId, userId)
	if err != nil {
		return nil, err
	}
	status := dynamo.S(current, "Status")
	if status != PostActive && status != PostExpired {
		return nil, errPostNotFound
	}
	expires := time.UnixMilli(int64(num(current, "ExpiresAt")))
	if time.Until(expires) > extendWindow {
		return nil, errors.New("만료 7일 전부터 연장할 수 있어요.")
	}
	return updateListing(p, userId, postId, &dynamodb.UpdateItemInput{
		UpdateExpression:         aws.String("SET ExpiresAt = :e, #s = :a, ExpiryNotified = :f"),
		ExpressionAttributeNames: map[string]*string{"#s": aws.String("Status")},
		ExpressionAttributeValues: dynamo.Item{
			":e": {N: aws.String(itoa(time.Now().Add(ListingLifetime).UnixMilli()))},
			":a": strAttr(PostActive), ":f": boolAttr(false),
		},
	})
}

// bumpListingResolver moves an open listing back to the top of "newest",
// once a day.
func bumpListingResolver(p graphql.ResolveParams) (interface{}, error) {
	userId, err := requireUser(p)
	if err != nil {
		return nil, err
	}
	postId, _ := p.Args["PostId"].(string)
	current, err := ownListing(postId, userId)
	if err != nil {
		return nil, err
	}
	if dynamo.S(current, "Status") != PostActive || dynamo.S(current, "Deal") == DealClosed {
		return nil, errors.New("모집 중인 글만 끌어올릴 수 있어요.")
	}
	last := int64(math.Max(num(current, "BumpedAt"), num(current, "CreatedAt")))
	if time.Since(time.UnixMilli(last)) < bumpInterval {
		return nil, errors.New("끌어올리기는 하루에 한 번 할 수 있어요.")
	}
	return updateListing(p, userId, postId, &dynamodb.UpdateItemInput{
		UpdateExpression:          aws.String("SET BumpedAt = :b"),
		ExpressionAttributeValues: dynamo.Item{":b": {N: aws.String(itoa(nowMs()))}},
	})
}

// revealContactResolver shows a job post's phone/email to a logged-in
// member and counts the views, so harvesting stays visible.
func revealContactResolver(p graphql.ResolveParams) (interface{}, error) {
	userId := jwt.UserID(p.Context)
	if userId == "" {
		return nil, errLogin
	}
	postId, _ := p.Args["PostId"].(string)
	item, err := visibleOfType(postId, userId, PostTypeJob)
	if err != nil {
		return nil, internal(err)
	}
	if item == nil || item["Contact"] == nil {
		return nil, errPostNotFound
	}
	if !postLimiter.Allow("contact:" + userId) {
		// Shares the post limiter's budget: 5 reveals an hour per member.
		return nil, errors.New("연락처를 너무 많이 열어봤어요. 잠시 후 다시 시도해주세요.")
	}
	if _, err := svc.UpdateItem(&dynamodb.UpdateItemInput{
		TableName:                 aws.String(dynamo.TablePosts),
		Key:                       dynamo.Item{"PostId": strAttr(postId)},
		UpdateExpression:          aws.String("ADD ContactViews :one"),
		ExpressionAttributeValues: dynamo.Item{":one": {N: aws.String("1")}},
	}); err != nil {
		log.Printf("contact views %s: %v", postId, err)
	}
	c := item["Contact"].M
	return map[string]interface{}{"Phone": dynamo.S(c, "Phone"), "Email": dynamo.S(c, "Email")}, nil
}

// ---- expiry ----

func listingLink(item dynamo.Item) string {
	path := "/housing/"
	if dynamo.S(item, "Type") == PostTypeJob {
		path = "/jobs/"
	}
	return path + dynamo.S(item, "PostId")
}

// ExpireListings marks listings past ExpiresAt expired and warns authors
// three days before. Scans the Posts table (fine at this size).
func ExpireListings(now time.Time) error {
	items, err := dynamo.ScanAll(svc, &dynamodb.ScanInput{
		TableName:                aws.String(dynamo.TablePosts),
		FilterExpression:         aws.String("(#t = :h OR #t = :j) AND #s = :a"),
		ExpressionAttributeNames: map[string]*string{"#t": aws.String("Type"), "#s": aws.String("Status")},
		ExpressionAttributeValues: dynamo.Item{
			":h": strAttr(PostTypeHousing), ":j": strAttr(PostTypeJob), ":a": strAttr(PostActive),
		},
	})
	if err != nil {
		return err
	}
	for _, item := range items {
		postId := dynamo.S(item, "PostId")
		expires := time.UnixMilli(int64(num(item, "ExpiresAt")))
		switch {
		case !expires.After(now):
			if err := setPostStatus(postId, PostExpired); err != nil {
				log.Printf("expire %s: %v", postId, err)
			}
		case expires.Sub(now) <= expiryNotice && !boolOf(item, "ExpiryNotified") && dynamo.S(item, "Deal") != DealClosed:
			_, err := svc.UpdateItem(&dynamodb.UpdateItemInput{
				TableName:                 aws.String(dynamo.TablePosts),
				Key:                       dynamo.Item{"PostId": strAttr(postId)},
				UpdateExpression:          aws.String("SET ExpiryNotified = :t"),
				ConditionExpression:       aws.String("ExpiryNotified = :f"),
				ExpressionAttributeValues: dynamo.Item{":t": boolAttr(true), ":f": boolAttr(false)},
			})
			if isConditionFailed(err) {
				continue
			}
			if err != nil {
				log.Printf("expiry notice %s: %v", postId, err)
				continue
			}
			if err := notifier().Publish(notify.Event{
				UserId: dynamo.S(item, "AuthorId"), Type: notify.TypeExpiring,
				TargetType: "post", TargetId: postId,
				Preview: dynamo.S(item, "Title"), Link: listingLink(item),
			}); err != nil {
				log.Printf("notify expiring %s: %v", postId, err)
			}
		}
	}
	return nil
}

// RunListingExpiry runs ExpireListings now and then every interval until
// ctx is done.
func RunListingExpiry(ctx context.Context, interval time.Duration) {
	for {
		if err := ExpireListings(time.Now()); err != nil {
			log.Printf("listing expiry: %v", err)
		}
		select {
		case <-ctx.Done():
			return
		case <-time.After(interval):
		}
	}
}
