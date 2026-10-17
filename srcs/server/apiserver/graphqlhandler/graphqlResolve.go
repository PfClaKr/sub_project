package graphqlhandler

import (
	"errors"
	"fmt"
	"log"
	"math"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"
	"unicode/utf8"

	"apiserver/eshandler"
	"apiserver/geohandler"
	"apiserver/uploadhandler"

	"local.com/account"
	"local.com/dynamo"
	"local.com/jwt"

	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/aws/awserr"
	"github.com/aws/aws-sdk-go/service/dynamodb"
	"github.com/google/uuid"
	"github.com/graphql-go/graphql"
	"github.com/graphql-go/graphql/language/ast"
)

// Categories must match the frontend's libs/constants.ts.
var Categories = []string{"전자기기", "가구", "의류", "도서", "식품", "기타"}

const StatusSelling = "판매중"

// Regions must match REGIONS in the frontend's libs/constants.ts.
var Regions = []string{"파리", "일드프랑스", "리옹", "마르세유", "툴루즈", "스트라스부르", "니스", "프랑스 기타", "기타 유럽"}

const DefaultRegion = "파리"

var validStatuses = map[string]bool{StatusSelling: true, "예약중": true, "판매완료": true}

// User-facing errors; anything else is logged and replaced by errInternal.
var (
	errLogin     = errors.New("로그인이 필요해요.")
	errForbidden = errors.New("본인 상품만 수정할 수 있어요.")
	errNotFound  = errors.New("상품을 찾을 수 없어요.")
	errInternal  = errors.New("서버 오류가 발생했어요. 잠시 후 다시 시도해주세요.")
)

func internal(err error) error {
	log.Printf("graphql: %v", err)
	return errInternal
}

var errSuspended = errors.New(account.SuspendedMessage)

// requireUser is for mutations: it needs a login and refuses suspended
// members. Reads only need jwt.UserID.
func requireUser(p graphql.ResolveParams) (string, error) {
	id := jwt.UserID(p.Context)
	if id == "" {
		return "", errLogin
	}
	switch err := account.CheckActive(svc, id); {
	case errors.Is(err, account.ErrSuspended):
		return "", errSuspended
	case err != nil:
		return "", internal(err)
	}
	return id, nil
}

// Attributes a query may project, per table. Guards ProjectionExpression
// against introspection fields like __typename.
var productAttrs = map[string]bool{
	"ProductId": true, "UserId": true, "ProductStatus": true, "ProductName": true,
	"ProductDescription": true, "ProductPrice": true, "ProductCategory": true, "ProductRegion": true,
	"ProductImage": true, "PreferedLocation": true, "ProductCreatedAt": true, "ProductUpdatedAt": true,
	"Latitude": true, "Longitude": true, "ExactLocation": true, "AreaId": true, "AreaName": true,
}

var userAttrs = map[string]bool{
	"UserId": true, "UserNickname": true, "ProfileImage": true, "Residence": true, "PublishedQuantity": true, "CreatedAt": true,
}

func requestedFields(p graphql.ResolveParams) []string {
	var fields []string
	var walk func(*ast.SelectionSet)
	walk = func(set *ast.SelectionSet) {
		if set == nil {
			return
		}
		for _, sel := range set.Selections {
			switch f := sel.(type) {
			case *ast.Field:
				fields = append(fields, f.Name.Value)
			case *ast.InlineFragment:
				walk(f.SelectionSet)
			}
		}
	}
	for _, f := range p.Info.FieldASTs {
		walk(f.SelectionSet)
	}
	return fields
}

// projection keeps allowed attributes and appends extras (deduplicated).
func projection(fields []string, allowed map[string]bool, extras ...string) string {
	seen := map[string]bool{}
	var out []string
	for _, f := range append(fields, extras...) {
		if allowed[f] && !seen[f] {
			seen[f] = true
			out = append(out, f)
		}
	}
	return strings.Join(out, ", ")
}

func productProjection(p graphql.ResolveParams, extras ...string) (string, bool) {
	fields := requestedFields(p)
	wantSeller := false
	for _, f := range fields {
		if f == "SellerNickname" {
			wantSeller = true
			extras = append(extras, "UserId")
		}
	}
	return projection(fields, productAttrs, extras...), wantSeller
}

func toMap(item dynamo.Item) map[string]interface{} {
	out := map[string]interface{}{}
	for k, v := range item {
		switch {
		case v.S != nil:
			out[k] = *v.S
		case v.N != nil:
			if f, err := strconv.ParseFloat(*v.N, 64); err == nil {
				out[k] = f
			}
		case v.SS != nil:
			out[k] = aws.StringValueSlice(v.SS)
		case v.BOOL != nil:
			out[k] = *v.BOOL
		}
	}
	return out
}

func userToMap(item dynamo.Item) map[string]interface{} {
	out := toMap(item)
	for k := range out {
		if !userAttrs[k] {
			delete(out, k)
		}
	}
	return out
}

// attachSellerNicknames fills SellerNickname from the Users table.
func attachSellerNicknames(products []map[string]interface{}) error {
	var ids []string
	for _, p := range products {
		if id, ok := p["UserId"].(string); ok {
			ids = append(ids, id)
		}
	}
	users, err := dynamo.BatchGet(svc, dynamo.TableUsers, "UserId", ids, "UserId, UserNickname")
	if err != nil {
		return err
	}
	for _, p := range products {
		id, _ := p["UserId"].(string)
		if u, ok := users[id]; ok {
			p["SellerNickname"] = dynamo.S(u, "UserNickname")
		}
	}
	return nil
}

func finishProducts(items []dynamo.Item, wantSeller bool) ([]map[string]interface{}, error) {
	products := make([]map[string]interface{}, 0, len(items))
	for _, item := range items {
		products = append(products, toMap(item))
	}
	if wantSeller {
		if err := attachSellerNicknames(products); err != nil {
			return nil, internal(err)
		}
	}
	return products, nil
}

// productsInOrder batch-reads products and keeps the order of ids (search
// ranking), skipping products deleted since they were indexed.
func productsInOrder(ids []string, proj string) ([]dynamo.Item, error) {
	found, err := dynamo.BatchGet(svc, dynamo.TableProduct, "ProductId", ids, proj)
	if err != nil {
		return nil, err
	}
	items := make([]dynamo.Item, 0, len(found))
	for _, id := range ids {
		if item, ok := found[id]; ok {
			items = append(items, item)
		}
	}
	return items, nil
}

func sortNewestFirst(items []dynamo.Item) {
	createdAt := func(item dynamo.Item) float64 {
		if v := item["ProductCreatedAt"]; v != nil && v.N != nil {
			f, _ := strconv.ParseFloat(*v.N, 64)
			return f
		}
		return 0
	}
	sort.SliceStable(items, func(i, j int) bool { return createdAt(items[i]) > createdAt(items[j]) })
}

func getProduct(productId, proj string) (dynamo.Item, error) {
	input := &dynamodb.GetItemInput{
		TableName: aws.String(dynamo.TableProduct),
		Key:       dynamo.Item{"ProductId": {S: aws.String(productId)}},
	}
	if proj != "" {
		input.ProjectionExpression = aws.String(proj)
	}
	result, err := svc.GetItem(input)
	if err != nil {
		return nil, internal(err)
	}
	return result.Item, nil
}

// requireOwner returns errNotFound / errForbidden unless userId owns it.
func requireOwner(productId, userId string) error {
	item, err := getProduct(productId, "UserId")
	if err != nil {
		return err
	}
	if item == nil {
		return errNotFound
	}
	if dynamo.S(item, "UserId") != userId {
		return errForbidden
	}
	return nil
}

// adjustPublished keeps Users.PublishedQuantity in sync. Best effort.
func adjustPublished(userId string, delta int) {
	_, err := svc.UpdateItem(&dynamodb.UpdateItemInput{
		TableName:           aws.String(dynamo.TableUsers),
		Key:                 dynamo.Item{"UserId": {S: aws.String(userId)}},
		UpdateExpression:    aws.String("ADD PublishedQuantity :d"),
		ConditionExpression: aws.String("attribute_exists(UserId)"),
		ExpressionAttributeValues: dynamo.Item{
			":d": {N: aws.String(strconv.Itoa(delta))},
		},
	})
	if err != nil {
		log.Printf("adjustPublished(%s, %d): %v", userId, delta, err)
	}
}

func now() string {
	return strconv.FormatInt(time.Now().Unix(), 10)
}

// ---- queries ----

func resolveProduct(p graphql.ResolveParams) (interface{}, error) {
	productId, _ := p.Args["ProductId"].(string)
	proj, wantSeller := productProjection(p)
	item, err := getProduct(productId, proj)
	if err != nil || item == nil {
		return nil, err
	}
	products, err := finishProducts([]dynamo.Item{item}, wantSeller)
	if err != nil {
		return nil, err
	}
	return products[0], nil
}

// resolveRecentProducts is the home feed: newest first, optionally one
// category, paged with Limit/Offset. Elasticsearch does the ordering and
// paging; only the page's products are read from DynamoDB.
func resolveRecentProducts(p graphql.ResolveParams) (interface{}, error) {
	limit := 8
	if l, ok := p.Args["Limit"].(float64); ok && l > 0 {
		limit = int(math.Min(l, 50))
	}
	offset := 0
	if o, ok := p.Args["Offset"].(float64); ok && o > 0 {
		offset = int(math.Min(o, 5000))
	}
	opts := eshandler.SearchOptions{Sort: "newest", Size: limit, From: offset}
	opts.Category, _ = p.Args["Category"].(string)
	ids, err := eshandler.BrowseProductIds(opts)
	if err != nil {
		return nil, internal(err)
	}
	proj, wantSeller := productProjection(p, "ProductId")
	items, err := productsInOrder(ids, proj)
	if err != nil {
		return nil, internal(err)
	}
	return finishProducts(items, wantSeller)
}

// resolveUserProducts lists a member's products, newest first, through
// the Product UserIndex (exact and immediate, unlike the search index).
func resolveUserProducts(p graphql.ResolveParams) (interface{}, error) {
	userId, _ := p.Args["UserId"].(string)
	if userId == "" {
		return []interface{}{}, nil
	}
	proj, wantSeller := productProjection(p, "ProductCreatedAt")
	items, err := dynamo.QueryAll(svc, &dynamodb.QueryInput{
		TableName:                 aws.String(dynamo.TableProduct),
		IndexName:                 aws.String("UserIndex"),
		KeyConditionExpression:    aws.String("UserId = :u"),
		ExpressionAttributeValues: dynamo.Item{":u": {S: aws.String(userId)}},
		ProjectionExpression:      aws.String(proj),
		ScanIndexForward:          aws.Bool(false),
	})
	if err != nil {
		return nil, internal(err)
	}
	return finishProducts(items, wantSeller)
}

// BrowsePageSize is the page size of productSearch without a keyword.
const BrowsePageSize = 40

func resolveProductSearch(p graphql.ResolveParams) (interface{}, error) {
	query := strings.TrimSpace(p.Args["ProductName"].(string))
	if utf8.RuneCountInString(query) > 100 {
		return map[string]interface{}{"Products": []map[string]interface{}{}, "Corrected": false, "HasNext": false}, nil
	}

	opts := searchOptions(p.Args)
	near, err := nearFilter(p.Args)
	if err != nil {
		return nil, err
	}
	opts.Near = near
	var ids []string
	corrected, hasNext := false, false
	if query == "" {
		// One extra row tells whether another page follows.
		page, _ := p.Args["Page"].(int)
		if page < 1 {
			page = 1
		}
		opts.Size, opts.From = BrowsePageSize+1, (page-1)*BrowsePageSize
		ids, err = eshandler.BrowseProductIds(opts)
		if len(ids) > BrowsePageSize {
			ids, hasNext = ids[:BrowsePageSize], true
		}
	} else {
		ids, corrected, err = eshandler.SearchProductIds(query, opts)
	}
	if err != nil {
		return nil, internal(err)
	}

	// Projection comes from the fields selected under Products.
	var fields []string
	for _, f := range p.Info.FieldASTs {
		for _, sel := range f.SelectionSet.Selections {
			if inner, ok := sel.(*ast.Field); ok && inner.Name.Value == "Products" {
				fields = append(fields, requestedFields(graphql.ResolveParams{Info: graphql.ResolveInfo{FieldASTs: []*ast.Field{inner}}})...)
			}
		}
	}
	wantSeller := contains(fields, "SellerNickname")
	if wantSeller {
		fields = append(fields, "UserId")
	}
	items, err := productsInOrder(ids, projection(fields, productAttrs, "ProductId"))
	if err != nil {
		return nil, internal(err)
	}
	products, err := finishProducts(items, wantSeller)
	if err != nil {
		return nil, err
	}
	return map[string]interface{}{"Products": products, "Corrected": corrected, "HasNext": hasNext}, nil
}

// searchOptions reads the filters shared by productSearch and searchProducts.
// nearFilter reads the place filter: either "inside this area" (AreaId,
// DistanceKm 0) or "within N km of a point" (the area centre or the
// user's position), as on leboncoin. nil when there is none.
func nearFilter(args map[string]interface{}) (*eshandler.GeoFilter, error) {
	areaId, _ := args["AreaId"].(string)
	km, _ := args["DistanceKm"].(float64)
	lat, hasLat := args["Latitude"].(float64)
	lng, hasLng := args["Longitude"].(float64)
	switch {
	case areaId != "" && km == 0:
		near := &eshandler.GeoFilter{AreaId: areaId}
		if hasLat && hasLng {
			near.Lat, near.Lng = lat, lng
		}
		return near, nil
	case hasLat && hasLng:
		if lat < -90 || lat > 90 || lng < -180 || lng > 180 || km <= 0 || km > 200 {
			return nil, errors.New("위치 필터가 올바르지 않아요.")
		}
		return &eshandler.GeoFilter{Lat: lat, Lng: lng, Km: km}, nil
	case areaId != "" || km != 0:
		return nil, errors.New("위치 필터가 올바르지 않아요.")
	}
	return nil, nil
}

func searchOptions(args map[string]interface{}) eshandler.SearchOptions {
	opts := eshandler.SearchOptions{Size: 60}
	opts.Category, _ = args["Category"].(string)
	opts.Region, _ = args["Region"].(string)
	opts.Sort, _ = args["Sort"].(string)
	if opts.Sort == "recent" { // name used by the current search page
		opts.Sort = "newest"
	}
	if v, ok := args["MinPrice"].(float64); ok && v > 0 {
		opts.MinPrice = &v
	}
	if v, ok := args["MaxPrice"].(float64); ok && v > 0 {
		opts.MaxPrice = &v
	}
	return opts
}

// resolveSearchProducts keeps the older filter query working on top of
// the Korean search: keyword → search, no keyword → filtered listing.
func resolveSearchProducts(p graphql.ResolveParams) (interface{}, error) {
	keyword, _ := p.Args["Keyword"].(string)
	keyword = strings.TrimSpace(keyword)
	opts := searchOptions(p.Args)

	var ids []string
	var err error
	if keyword != "" {
		ids, _, err = eshandler.SearchProductIds(keyword, opts)
	} else {
		ids, err = eshandler.BrowseProductIds(opts)
	}
	if err != nil {
		return nil, internal(err)
	}
	proj, wantSeller := productProjection(p, "ProductId")
	items, err := productsInOrder(ids, proj)
	if err != nil {
		return nil, internal(err)
	}
	return finishProducts(items, wantSeller)
}

func resolveSearchSuggestions(p graphql.ResolveParams) (interface{}, error) {
	prefix := strings.TrimSpace(p.Args["Prefix"].(string))
	if prefix == "" || utf8.RuneCountInString(prefix) > 50 {
		return []string{}, nil
	}
	names, err := eshandler.Suggest(prefix, 8)
	if err != nil {
		return nil, internal(err)
	}
	return names, nil
}

// marketStats is cached briefly: the landing page asks on every visit
// and the counts come from full scans.
var marketStatsCache struct {
	sync.Mutex
	at    time.Time
	value map[string]interface{}
}

func resolveMarketStats(p graphql.ResolveParams) (interface{}, error) {
	marketStatsCache.Lock()
	defer marketStatsCache.Unlock()
	if marketStatsCache.value != nil && time.Since(marketStatsCache.at) < time.Minute {
		return marketStatsCache.value, nil
	}
	// Counts come from the search index and table metadata, so the home
	// page never reads whole tables.
	products, err := eshandler.CountProducts(false)
	if err != nil {
		return nil, internal(err)
	}
	selling, err := eshandler.CountProducts(true)
	if err != nil {
		return nil, internal(err)
	}
	// ItemCount is refreshed by DynamoDB about every six hours: fine for
	// a "neighbours" figure, free to read.
	table, err := svc.DescribeTable(&dynamodb.DescribeTableInput{TableName: aws.String(dynamo.TableUsers)})
	if err != nil {
		return nil, internal(err)
	}
	marketStatsCache.value = map[string]interface{}{
		"Products": float64(products),
		"Selling":  float64(selling),
		"Users":    float64(aws.Int64Value(table.Table.ItemCount)),
	}
	marketStatsCache.at = time.Now()
	return marketStatsCache.value, nil
}

func resolveUser(p graphql.ResolveParams) (interface{}, error) {
	userId, _ := p.Args["UserId"].(string)
	proj := projection(requestedFields(p), userAttrs)
	if proj == "" {
		proj = "UserId"
	}
	result, err := svc.GetItem(&dynamodb.GetItemInput{
		TableName:            aws.String(dynamo.TableUsers),
		Key:                  dynamo.Item{"UserId": {S: aws.String(userId)}},
		ProjectionExpression: aws.String(proj),
	})
	if err != nil {
		return nil, internal(err)
	}
	if result.Item == nil {
		return nil, nil
	}
	return userToMap(result.Item), nil
}

// ---- mutations ----

type productInput struct {
	Name, Description, Category, Location, Region string
	Price                                         float64
	Images                                        []string
	// Geo is nil when no map position was given.
	Geo *geoInput
}

// geoInput is the point the seller picked. Exact=false means only the
// town / arrondissement is shown (leboncoin style): the point is then
// replaced by the area's centre before it is stored.
type geoInput struct {
	Lat, Lng float64
	Exact    bool
}

// resolveArea is swapped out in tests (it calls OpenStreetMap).
var resolveArea = geohandler.Resolve

func parseGeo(args map[string]interface{}) (*geoInput, error) {
	lat, hasLat := args["Latitude"].(float64)
	lng, hasLng := args["Longitude"].(float64)
	if !hasLat && !hasLng {
		return nil, nil
	}
	if !hasLat || !hasLng || lat < -90 || lat > 90 || lng < -180 || lng > 180 {
		return nil, errors.New("지도 위치가 올바르지 않아요.")
	}
	exact, _ := args["ExactLocation"].(bool)
	return &geoInput{Lat: lat, Lng: lng, Exact: exact}, nil
}

// locate turns the picked point into stored attributes. Areas need the
// boundary lookup to succeed; an exact pin is kept even without one.
func locate(g *geoInput) (dynamo.Item, error) {
	area, err := resolveArea(g.Lat, g.Lng)
	if err != nil && !g.Exact {
		if errors.Is(err, geohandler.ErrNoArea) {
			return nil, errors.New("이 위치의 동네를 찾지 못했어요. 정확한 위치로 표시해주세요.")
		}
		log.Printf("locate: %v", err)
		return nil, errors.New("지도 서비스에 연결하지 못했어요. 잠시 후 다시 시도해주세요.")
	}
	lat, lng := g.Lat, g.Lng
	if !g.Exact {
		lat, lng = area.CenterLat, area.CenterLng
	}
	attrs := dynamo.Item{
		"Latitude":      {N: aws.String(price(lat))},
		"Longitude":     {N: aws.String(price(lng))},
		"ExactLocation": {BOOL: aws.Bool(g.Exact)},
	}
	if area != nil {
		attrs["AreaId"] = &dynamodb.AttributeValue{S: aws.String(area.AreaId)}
		attrs["AreaName"] = &dynamodb.AttributeValue{S: aws.String(area.Label())}
	}
	return attrs, nil
}

func validImageURL(u string) bool {
	return strings.HasPrefix(u, uploadhandler.PublicBase()+"/")
}

// parseProductInput validates arguments; keep lists image URLs the
// product already has, which are accepted even if hosted elsewhere.
func parseProductInput(args map[string]interface{}, keep ...string) (productInput, error) {
	in := productInput{}
	in.Name, _ = args["ProductName"].(string)
	in.Description, _ = args["ProductDescription"].(string)
	in.Category, _ = args["ProductCategory"].(string)
	in.Location, _ = args["PreferedLocation"].(string)
	in.Price, _ = args["ProductPrice"].(float64)
	in.Name = strings.TrimSpace(in.Name)
	in.Location = strings.TrimSpace(in.Location)

	switch {
	case in.Name == "" || utf8.RuneCountInString(in.Name) > 100:
		return in, errors.New("상품명은 1~100자로 입력해주세요.")
	case utf8.RuneCountInString(in.Description) > 2000:
		return in, errors.New("설명은 2000자 이하로 입력해주세요.")
	case in.Price < 0 || in.Price > 1_000_000 || math.IsNaN(in.Price):
		return in, errors.New("가격이 올바르지 않아요.")
	case in.Location == "" || utf8.RuneCountInString(in.Location) > 100:
		return in, errors.New("거래 희망 지역을 입력해주세요.")
	}
	if !contains(Categories, in.Category) {
		return in, errors.New("카테고리를 선택해주세요.")
	}
	in.Region, _ = args["ProductRegion"].(string)
	if in.Region == "" {
		in.Region = DefaultRegion
	}
	if !contains(Regions, in.Region) {
		return in, errors.New("지역을 선택해주세요.")
	}

	// graphql-go delivers list args as []interface{}.
	if raw, ok := args["ProductImage"].([]interface{}); ok {
		for _, v := range raw {
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
	geo, err := parseGeo(args)
	if err != nil {
		return in, err
	}
	in.Geo = geo
	return in, nil
}

func contains(list []string, s string) bool {
	for _, v := range list {
		if v == s {
			return true
		}
	}
	return false
}

func price(f float64) string {
	return strconv.FormatFloat(f, 'f', -1, 64)
}

func createProductResolver(p graphql.ResolveParams) (interface{}, error) {
	userId, err := requireUser(p)
	if err != nil {
		return nil, err
	}
	in, err := parseProductInput(p.Args)
	if err != nil {
		return nil, err
	}

	productId := uuid.NewString()
	ts := now()
	item := dynamo.Item{
		"ProductId":          {S: aws.String(productId)},
		"UserId":             {S: aws.String(userId)},
		"ProductStatus":      {S: aws.String(StatusSelling)},
		"ProductName":        {S: aws.String(in.Name)},
		"ProductDescription": {S: aws.String(in.Description)},
		"ProductPrice":       {N: aws.String(price(in.Price))},
		"ProductCategory":    {S: aws.String(in.Category)},
		"ProductRegion":      {S: aws.String(in.Region)},
		"PreferedLocation":   {S: aws.String(in.Location)},
		"ProductCreatedAt":   {N: aws.String(ts)},
		"ProductUpdatedAt":   {N: aws.String(ts)},
	}
	// DynamoDB string sets cannot be empty; omit when no image.
	if len(in.Images) > 0 {
		item["ProductImage"] = &dynamodb.AttributeValue{SS: aws.StringSlice(in.Images)}
	}
	if in.Geo != nil {
		attrs, err := locate(in.Geo)
		if err != nil {
			return nil, err
		}
		for k, v := range attrs {
			item[k] = v
		}
	}

	if _, err := svc.PutItem(&dynamodb.PutItemInput{
		TableName: aws.String(dynamo.TableProduct),
		Item:      item,
	}); err != nil {
		return nil, internal(err)
	}

	// Roll back so the product is never stored without being searchable.
	if err := eshandler.IndexProduct(eshandler.DocFromItem(item)); err != nil {
		if _, derr := svc.DeleteItem(&dynamodb.DeleteItemInput{
			TableName: aws.String(dynamo.TableProduct),
			Key:       dynamo.Item{"ProductId": {S: aws.String(productId)}},
		}); derr != nil {
			log.Printf("rollback of %s failed: %v", productId, derr)
		}
		return nil, internal(err)
	}

	adjustPublished(userId, 1)
	return toMap(item), nil
}

func updateProductResolver(p graphql.ResolveParams) (interface{}, error) {
	userId, err := requireUser(p)
	if err != nil {
		return nil, err
	}
	productId, _ := p.Args["ProductId"].(string)
	current, err := getProduct(productId, "UserId, ProductImage")
	if err != nil {
		return nil, err
	}
	if current == nil {
		return nil, errNotFound
	}
	if dynamo.S(current, "UserId") != userId {
		return nil, errForbidden
	}
	var existing []string
	if v := current["ProductImage"]; v != nil {
		existing = aws.StringValueSlice(v.SS)
	}
	in, err := parseProductInput(p.Args, existing...)
	if err != nil {
		return nil, err
	}

	set := []string{"ProductName = :n", "ProductDescription = :d", "ProductPrice = :p", "ProductCategory = :c", "ProductRegion = :r", "PreferedLocation = :l", "ProductUpdatedAt = :t"}
	var remove []string
	values := dynamo.Item{
		":n": {S: aws.String(in.Name)},
		":d": {S: aws.String(in.Description)},
		":p": {N: aws.String(price(in.Price))},
		":c": {S: aws.String(in.Category)},
		":r": {S: aws.String(in.Region)},
		":l": {S: aws.String(in.Location)},
		":t": {N: aws.String(now())},
	}
	// Omitted ProductImage / position keep the current values.
	if _, given := p.Args["ProductImage"]; given {
		if len(in.Images) > 0 {
			set = append(set, "ProductImage = :i")
			values[":i"] = &dynamodb.AttributeValue{SS: aws.StringSlice(in.Images)}
		} else {
			remove = append(remove, "ProductImage")
		}
	}
	if in.Geo != nil {
		attrs, err := locate(in.Geo)
		if err != nil {
			return nil, err
		}
		for _, k := range []string{"Latitude", "Longitude", "ExactLocation", "AreaId", "AreaName"} {
			if v, ok := attrs[k]; ok {
				set = append(set, k+" = :"+k)
				values[":"+k] = v
			} else {
				remove = append(remove, k)
			}
		}
		// Rows saved before areas existed.
		remove = append(remove, "LocationRadius")
	}
	update := "SET " + strings.Join(set, ", ")
	if len(remove) > 0 {
		update += " REMOVE " + strings.Join(remove, ", ")
	}

	out, err := svc.UpdateItem(&dynamodb.UpdateItemInput{
		TableName:                 aws.String(dynamo.TableProduct),
		Key:                       dynamo.Item{"ProductId": {S: aws.String(productId)}},
		UpdateExpression:          aws.String(update),
		ExpressionAttributeValues: values,
		ReturnValues:              aws.String(dynamodb.ReturnValueAllNew),
	})
	if err != nil {
		return nil, internal(err)
	}
	if err := eshandler.IndexProduct(eshandler.DocFromItem(out.Attributes)); err != nil {
		log.Printf("reindex of %s failed, search shows stale data: %v", productId, err)
	}
	return toMap(out.Attributes), nil
}

// ValidStatus reports whether s is a product status.
func ValidStatus(s string) bool { return validStatuses[s] }

// SetProductStatus updates the status and keeps the search index in
// sync (sold-out listings rank lower). Shared with the admin API.
func SetProductStatus(productId, status string) (dynamo.Item, error) {
	out, err := svc.UpdateItem(&dynamodb.UpdateItemInput{
		TableName:           aws.String(dynamo.TableProduct),
		Key:                 dynamo.Item{"ProductId": {S: aws.String(productId)}},
		UpdateExpression:    aws.String("SET ProductStatus = :s, ProductUpdatedAt = :t"),
		ConditionExpression: aws.String("attribute_exists(ProductId)"),
		ExpressionAttributeValues: dynamo.Item{
			":s": {S: aws.String(status)},
			":t": {N: aws.String(now())},
		},
		ReturnValues: aws.String(dynamodb.ReturnValueAllNew),
	})
	if aerr, ok := err.(awserr.Error); ok && aerr.Code() == dynamodb.ErrCodeConditionalCheckFailedException {
		return nil, errNotFound
	}
	if err != nil {
		return nil, internal(err)
	}
	if err := eshandler.IndexProduct(eshandler.DocFromItem(out.Attributes)); err != nil {
		log.Printf("reindex of %s failed: %v", productId, err)
	}
	return out.Attributes, nil
}

// RemoveProduct deletes a product owned by ownerId from DynamoDB and
// the search index. Shared with the admin API.
func RemoveProduct(productId, ownerId string) error {
	if _, err := svc.DeleteItem(&dynamodb.DeleteItemInput{
		TableName: aws.String(dynamo.TableProduct),
		Key:       dynamo.Item{"ProductId": {S: aws.String(productId)}},
	}); err != nil {
		return internal(err)
	}
	if err := eshandler.DeleteProduct(productId); err != nil {
		log.Printf("es delete of %s failed; search skips it anyway: %v", productId, err)
	}
	adjustPublished(ownerId, -1)
	return nil
}

func updateProductStatusResolver(p graphql.ResolveParams) (interface{}, error) {
	userId, err := requireUser(p)
	if err != nil {
		return nil, err
	}
	productId, _ := p.Args["ProductId"].(string)
	status, _ := p.Args["ProductStatus"].(string)
	if !validStatuses[status] {
		return nil, errors.New("알 수 없는 상태예요.")
	}
	if err := requireOwner(productId, userId); err != nil {
		return nil, err
	}
	item, err := SetProductStatus(productId, status)
	if err != nil {
		return nil, err
	}
	return toMap(item), nil
}

func deleteProductResolver(p graphql.ResolveParams) (interface{}, error) {
	userId, err := requireUser(p)
	if err != nil {
		return nil, err
	}
	productId, _ := p.Args["ProductId"].(string)
	if err := requireOwner(productId, userId); err != nil {
		return nil, err
	}
	if err := RemoveProduct(productId, userId); err != nil {
		return nil, err
	}
	return true, nil
}

func updateProfileResolver(p graphql.ResolveParams) (interface{}, error) {
	userId, err := requireUser(p)
	if err != nil {
		return nil, err
	}
	nickname := strings.TrimSpace(p.Args["UserNickname"].(string))
	if n := utf8.RuneCountInString(nickname); n < 2 || n > 20 {
		return nil, errors.New("닉네임은 2~20자로 입력해주세요.")
	}

	update := "SET UserNickname = :n"
	values := dynamo.Item{":n": {S: aws.String(nickname)}}
	if img, ok := p.Args["ProfileImage"].(string); ok {
		if img != "" && !validImageURL(img) {
			return nil, errors.New("업로드한 이미지만 사용할 수 있어요.")
		}
		update += ", ProfileImage = :i"
		values[":i"] = &dynamodb.AttributeValue{S: aws.String(img)}
	}

	out, err := svc.UpdateItem(&dynamodb.UpdateItemInput{
		TableName:                 aws.String(dynamo.TableUsers),
		Key:                       dynamo.Item{"UserId": {S: aws.String(userId)}},
		UpdateExpression:          aws.String(update),
		ConditionExpression:       aws.String("attribute_exists(UserId)"),
		ExpressionAttributeValues: values,
		ReturnValues:              aws.String(dynamodb.ReturnValueAllNew),
	})
	if aerr, ok := err.(awserr.Error); ok && aerr.Code() == dynamodb.ErrCodeConditionalCheckFailedException {
		return nil, fmt.Errorf("사용자를 찾을 수 없어요.")
	}
	if err != nil {
		return nil, internal(err)
	}
	return userToMap(out.Attributes), nil
}
