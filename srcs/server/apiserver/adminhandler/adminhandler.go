// Package adminhandler serves the admin back office (/admin/* JSON API).
//
// Every route is wrapped with RequireAdmin, which reads the role from the
// Users table on each request, so demoting an admin takes effect at once
// instead of when their token expires.
package adminhandler

import (
	"encoding/json"
	"errors"
	"log"
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
	"github.com/aws/aws-sdk-go/service/dynamodb/dynamodbiface"
	"github.com/gorilla/mux"
)

const (
	RoleAdmin = "admin"
	RoleUser  = "user"
	PerPage   = 20
)

var svc dynamodbiface.DynamoDBAPI = dynamo.New()

// Role returns the stored role of a user ("user" when unset).
func Role(userId string) (string, error) {
	out, err := svc.GetItem(&dynamodb.GetItemInput{
		TableName:            aws.String(dynamo.TableUsers),
		Key:                  dynamo.Item{"UserId": {S: aws.String(userId)}},
		ProjectionExpression: aws.String("#r"),
		// ROLE is a DynamoDB reserved word.
		ExpressionAttributeNames: map[string]*string{"#r": aws.String("Role")},
	})
	if err != nil {
		return "", err
	}
	if r := dynamo.S(out.Item, "Role"); r != "" {
		return r, nil
	}
	return RoleUser, nil
}

// RequireAdmin rejects anonymous requests with 401 and non-admins with 403.
func RequireAdmin(next http.Handler) http.Handler {
	return jwt.Middleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		role, err := Role(jwt.UserID(r.Context()))
		if err != nil {
			jsonresponse.Internal(w, err)
			return
		}
		if role != RoleAdmin {
			jsonresponse.Error(w, http.StatusForbidden, "관리자만 접근할 수 있어요.")
			return
		}
		next.ServeHTTP(w, r)
	}))
}

// Register mounts the admin routes on r.
func Register(r *mux.Router) {
	a := r.PathPrefix("/admin").Subrouter()
	a.Use(func(next http.Handler) http.Handler { return RequireAdmin(next) })
	a.HandleFunc("/stats", statsHandler).Methods("GET")
	a.HandleFunc("/users", usersHandler).Methods("GET")
	a.HandleFunc("/users/{id}", updateUserHandler).Methods("PATCH")
	a.HandleFunc("/users/{id}", deleteUserHandler).Methods("DELETE")
	a.HandleFunc("/products", productsHandler).Methods("GET")
	a.HandleFunc("/products/{id}", updateProductHandler).Methods("PATCH")
	a.HandleFunc("/products/{id}", deleteProductHandler).Methods("DELETE")
	a.HandleFunc("/conversations", conversationsHandler).Methods("GET")
	a.HandleFunc("/conversations/{id}", conversationHandler).Methods("GET")
}

// ---- list helpers ----

// Page is the envelope of every admin list.
type Page struct {
	Items      interface{} `json:"Items"`
	Page       int         `json:"Page"`
	TotalPages int         `json:"TotalPages"`
	Total      int         `json:"Total"`
}

// paginate clamps the requested page into range (like ineverywhere's
// getAdminPagination) and returns the slice bounds.
func paginate(total int, raw string) (page, totalPages, start, end int) {
	page, _ = strconv.Atoi(raw)
	totalPages = (total + PerPage - 1) / PerPage
	if totalPages < 1 {
		totalPages = 1
	}
	if page < 1 {
		page = 1
	}
	if page > totalPages {
		page = totalPages
	}
	start = (page - 1) * PerPage
	end = start + PerPage
	if end > total {
		end = total
	}
	return
}

func matches(q string, fields ...string) bool {
	if q == "" {
		return true
	}
	q = strings.ToLower(q)
	for _, f := range fields {
		if strings.Contains(strings.ToLower(f), q) {
			return true
		}
	}
	return false
}

func num(item dynamo.Item, name string) float64 {
	if v := item[name]; v != nil && v.N != nil {
		f, _ := strconv.ParseFloat(*v.N, 64)
		return f
	}
	return 0
}

func scan(table, projection string, names map[string]*string) ([]dynamo.Item, error) {
	input := &dynamodb.ScanInput{TableName: aws.String(table)}
	if projection != "" {
		input.ProjectionExpression = aws.String(projection)
	}
	if names != nil {
		input.ExpressionAttributeNames = names
	}
	return dynamo.ScanAll(svc, input)
}

func nicknames(ids []string) (map[string]dynamo.Item, error) {
	return dynamo.BatchGet(svc, dynamo.TableUsers, "UserId", ids, "UserId, UserNickname, Email")
}

// ---- stats ----

type Stats struct {
	Users, Admins, NewUsers7d                        int
	Products, Selling, Reserved, Sold, NewProducts7d int
	ChatRooms, Messages, Messages7d                  int
}

func statsHandler(w http.ResponseWriter, r *http.Request) {
	weekAgo := float64(time.Now().AddDate(0, 0, -7).Unix())
	var st Stats

	users, err := scan(dynamo.TableUsers, "UserId, #r, CreatedAt", map[string]*string{"#r": aws.String("Role")})
	if err != nil {
		jsonresponse.Internal(w, err)
		return
	}
	for _, u := range users {
		st.Users++
		if dynamo.S(u, "Role") == RoleAdmin {
			st.Admins++
		}
		if num(u, "CreatedAt") >= weekAgo {
			st.NewUsers7d++
		}
	}

	products, err := scan(dynamo.TableProduct, "ProductStatus, ProductCreatedAt", nil)
	if err != nil {
		jsonresponse.Internal(w, err)
		return
	}
	for _, p := range products {
		st.Products++
		switch dynamo.S(p, "ProductStatus") {
		case "예약중":
			st.Reserved++
		case "판매완료":
			st.Sold++
		default:
			st.Selling++
		}
		if num(p, "ProductCreatedAt") >= weekAgo {
			st.NewProducts7d++
		}
	}

	rooms, err := scan(dynamo.TableChatRooms, "ChatId", nil)
	if err != nil {
		jsonresponse.Internal(w, err)
		return
	}
	st.ChatRooms = len(rooms)

	messages, err := scan(dynamo.TableChatMessage, "#ts", map[string]*string{"#ts": aws.String("Timestamp")})
	if err != nil {
		jsonresponse.Internal(w, err)
		return
	}
	for _, m := range messages {
		st.Messages++
		if msTimestamp(num(m, "Timestamp")) >= weekAgo*1000 {
			st.Messages7d++
		}
	}
	jsonresponse.New(w, http.StatusOK, st)
}

// msTimestamp normalizes chat timestamps stored in seconds (legacy) or ms.
func msTimestamp(ts float64) float64 {
	if ts < 1e12 {
		return ts * 1000
	}
	return ts
}

// ---- users ----

type AdminUser struct {
	UserId            string
	UserNickname      string
	Email             string
	Role              string
	ProfileImage      string
	CreatedAt         float64
	PublishedQuantity float64
}

func usersHandler(w http.ResponseWriter, r *http.Request) {
	q := strings.TrimSpace(r.URL.Query().Get("q"))
	role := r.URL.Query().Get("role")

	items, err := scan(dynamo.TableUsers, "UserId, UserNickname, Email, #r, ProfileImage, CreatedAt, PublishedQuantity",
		map[string]*string{"#r": aws.String("Role")})
	if err != nil {
		jsonresponse.Internal(w, err)
		return
	}

	users := []AdminUser{}
	for _, it := range items {
		u := AdminUser{
			UserId:            dynamo.S(it, "UserId"),
			UserNickname:      dynamo.S(it, "UserNickname"),
			Email:             dynamo.S(it, "Email"),
			Role:              dynamo.S(it, "Role"),
			ProfileImage:      dynamo.S(it, "ProfileImage"),
			CreatedAt:         num(it, "CreatedAt"),
			PublishedQuantity: num(it, "PublishedQuantity"),
		}
		if u.Role == "" {
			u.Role = RoleUser
		}
		if (role == "" || role == u.Role) && matches(q, u.UserNickname, u.Email) {
			users = append(users, u)
		}
	}
	sort.SliceStable(users, func(i, j int) bool { return users[i].CreatedAt > users[j].CreatedAt })

	page, totalPages, start, end := paginate(len(users), r.URL.Query().Get("page"))
	jsonresponse.New(w, http.StatusOK, Page{Items: users[start:end], Page: page, TotalPages: totalPages, Total: len(users)})
}

func updateUserHandler(w http.ResponseWriter, r *http.Request) {
	target := mux.Vars(r)["id"]
	if target == jwt.UserID(r.Context()) {
		jsonresponse.Error(w, http.StatusBadRequest, "내 권한은 바꿀 수 없어요.")
		return
	}
	var body struct{ Role string }
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || (body.Role != RoleAdmin && body.Role != RoleUser) {
		jsonresponse.Error(w, http.StatusBadRequest, "알 수 없는 권한이에요.")
		return
	}
	if err := SetRole(target, body.Role); err != nil {
		if errors.Is(err, errNoUser) {
			jsonresponse.Error(w, http.StatusNotFound, "회원을 찾을 수 없어요.")
			return
		}
		jsonresponse.Internal(w, err)
		return
	}
	jsonresponse.New(w, http.StatusOK, map[string]string{"Role": body.Role})
}

var errNoUser = errors.New("user not found")

// SetRole stores a role; also used by the promote-admin CLI.
func SetRole(userId, role string) error {
	_, err := svc.UpdateItem(&dynamodb.UpdateItemInput{
		TableName:                 aws.String(dynamo.TableUsers),
		Key:                       dynamo.Item{"UserId": {S: aws.String(userId)}},
		UpdateExpression:          aws.String("SET #r = :r"),
		ConditionExpression:       aws.String("attribute_exists(UserId)"),
		ExpressionAttributeNames:  map[string]*string{"#r": aws.String("Role")},
		ExpressionAttributeValues: dynamo.Item{":r": {S: aws.String(role)}},
	})
	if err != nil && strings.Contains(err.Error(), dynamodb.ErrCodeConditionalCheckFailedException) {
		return errNoUser
	}
	return err
}

// UserIdByEmail resolves a login email (CLI helper).
func UserIdByEmail(email string) (string, error) {
	out, err := svc.GetItem(&dynamodb.GetItemInput{
		TableName: aws.String(dynamo.TableUsersCredential),
		Key:       dynamo.Item{"Email": {S: aws.String(strings.ToLower(strings.TrimSpace(email)))}},
	})
	if err != nil {
		return "", err
	}
	if id := dynamo.S(out.Item, "UserId"); id != "" {
		return id, nil
	}
	return "", errNoUser
}

// deleteUserHandler removes a member with their listings and favorites.
// Their own account and other admins are out of reach, as in
// ineverywhere: losing the last admin would lock everyone out, so an
// admin has to be demoted first. Chat rooms stay for dispute handling.
func deleteUserHandler(w http.ResponseWriter, r *http.Request) {
	target := mux.Vars(r)["id"]
	if target == jwt.UserID(r.Context()) {
		jsonresponse.Error(w, http.StatusBadRequest, "내 계정은 여기서 삭제할 수 없어요.")
		return
	}
	user, err := svc.GetItem(&dynamodb.GetItemInput{
		TableName: aws.String(dynamo.TableUsers),
		Key:       dynamo.Item{"UserId": {S: aws.String(target)}},
	})
	if err != nil {
		jsonresponse.Internal(w, err)
		return
	}
	if user.Item == nil {
		jsonresponse.Error(w, http.StatusNotFound, "회원을 찾을 수 없어요.")
		return
	}
	if dynamo.S(user.Item, "Role") == RoleAdmin {
		jsonresponse.Error(w, http.StatusBadRequest, "관리자는 권한을 해제한 뒤 삭제할 수 있어요.")
		return
	}

	products, err := dynamo.ScanAll(svc, &dynamodb.ScanInput{
		TableName:                 aws.String(dynamo.TableProduct),
		ProjectionExpression:      aws.String("ProductId"),
		FilterExpression:          aws.String("UserId = :u"),
		ExpressionAttributeValues: dynamo.Item{":u": {S: aws.String(target)}},
	})
	if err != nil {
		jsonresponse.Internal(w, err)
		return
	}
	for _, p := range products {
		if err := graphqlhandler.RemoveProduct(dynamo.S(p, "ProductId"), target); err != nil {
			jsonresponse.Internal(w, err)
			return
		}
	}

	favs, err := dynamo.QueryAll(svc, &dynamodb.QueryInput{
		TableName:                 aws.String(dynamo.TableFavorites),
		KeyConditionExpression:    aws.String("UserId = :u"),
		ExpressionAttributeValues: dynamo.Item{":u": {S: aws.String(target)}},
	})
	if err != nil {
		jsonresponse.Internal(w, err)
		return
	}
	for _, f := range favs {
		svc.DeleteItem(&dynamodb.DeleteItemInput{
			TableName: aws.String(dynamo.TableFavorites),
			Key:       dynamo.Item{"UserId": f["UserId"], "ItemId": f["ItemId"]},
		})
	}

	if email := dynamo.S(user.Item, "Email"); email != "" {
		if _, err := svc.DeleteItem(&dynamodb.DeleteItemInput{
			TableName: aws.String(dynamo.TableUsersCredential),
			Key:       dynamo.Item{"Email": {S: aws.String(email)}},
		}); err != nil {
			jsonresponse.Internal(w, err)
			return
		}
	}
	if _, err := svc.DeleteItem(&dynamodb.DeleteItemInput{
		TableName: aws.String(dynamo.TableUsers),
		Key:       dynamo.Item{"UserId": {S: aws.String(target)}},
	}); err != nil {
		jsonresponse.Internal(w, err)
		return
	}
	log.Printf("admin %s deleted user %s (%d products)", jwt.UserID(r.Context()), target, len(products))
	jsonresponse.New(w, http.StatusOK, map[string]int{"DeletedProducts": len(products)})
}

// ---- products ----

type AdminProduct struct {
	ProductId        string
	ProductName      string
	ProductStatus    string
	ProductCategory  string
	ProductPrice     float64
	ProductImage     string
	PreferedLocation string
	ProductCreatedAt float64
	UserId           string
	SellerNickname   string
	SellerEmail      string
}

func productsHandler(w http.ResponseWriter, r *http.Request) {
	qs := r.URL.Query()
	q := strings.TrimSpace(qs.Get("q"))
	status, category := qs.Get("status"), qs.Get("category")

	items, err := scan(dynamo.TableProduct, "ProductId, ProductName, ProductStatus, ProductCategory, ProductPrice, ProductImage, PreferedLocation, ProductCreatedAt, UserId", nil)
	if err != nil {
		jsonresponse.Internal(w, err)
		return
	}
	var ids []string
	for _, it := range items {
		ids = append(ids, dynamo.S(it, "UserId"))
	}
	sellers, err := nicknames(ids)
	if err != nil {
		jsonresponse.Internal(w, err)
		return
	}

	products := []AdminProduct{}
	for _, it := range items {
		p := AdminProduct{
			ProductId:        dynamo.S(it, "ProductId"),
			ProductName:      dynamo.S(it, "ProductName"),
			ProductStatus:    dynamo.S(it, "ProductStatus"),
			ProductCategory:  dynamo.S(it, "ProductCategory"),
			ProductPrice:     num(it, "ProductPrice"),
			PreferedLocation: dynamo.S(it, "PreferedLocation"),
			ProductCreatedAt: num(it, "ProductCreatedAt"),
			UserId:           dynamo.S(it, "UserId"),
		}
		if img := it["ProductImage"]; img != nil && len(img.SS) > 0 {
			p.ProductImage = aws.StringValue(img.SS[0])
		}
		if s, ok := sellers[p.UserId]; ok {
			p.SellerNickname = dynamo.S(s, "UserNickname")
			p.SellerEmail = dynamo.S(s, "Email")
		}
		if (status == "" || status == p.ProductStatus) && (category == "" || category == p.ProductCategory) &&
			matches(q, p.ProductName, p.SellerNickname, p.SellerEmail) {
			products = append(products, p)
		}
	}

	switch qs.Get("sort") {
	case "oldest":
		sort.SliceStable(products, func(i, j int) bool { return products[i].ProductCreatedAt < products[j].ProductCreatedAt })
	case "price_asc":
		sort.SliceStable(products, func(i, j int) bool { return products[i].ProductPrice < products[j].ProductPrice })
	case "price_desc":
		sort.SliceStable(products, func(i, j int) bool { return products[i].ProductPrice > products[j].ProductPrice })
	default:
		sort.SliceStable(products, func(i, j int) bool { return products[i].ProductCreatedAt > products[j].ProductCreatedAt })
	}

	page, totalPages, start, end := paginate(len(products), qs.Get("page"))
	jsonresponse.New(w, http.StatusOK, Page{Items: products[start:end], Page: page, TotalPages: totalPages, Total: len(products)})
}

func productOwner(productId string) (string, error) {
	out, err := svc.GetItem(&dynamodb.GetItemInput{
		TableName:            aws.String(dynamo.TableProduct),
		Key:                  dynamo.Item{"ProductId": {S: aws.String(productId)}},
		ProjectionExpression: aws.String("UserId"),
	})
	if err != nil || out.Item == nil {
		return "", err
	}
	return dynamo.S(out.Item, "UserId"), nil
}

func updateProductHandler(w http.ResponseWriter, r *http.Request) {
	var body struct{ ProductStatus string }
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || !graphqlhandler.ValidStatus(body.ProductStatus) {
		jsonresponse.Error(w, http.StatusBadRequest, "알 수 없는 상태예요.")
		return
	}
	if _, err := graphqlhandler.SetProductStatus(mux.Vars(r)["id"], body.ProductStatus); err != nil {
		jsonresponse.Error(w, http.StatusNotFound, err.Error())
		return
	}
	jsonresponse.New(w, http.StatusOK, map[string]string{"ProductStatus": body.ProductStatus})
}

func deleteProductHandler(w http.ResponseWriter, r *http.Request) {
	id := mux.Vars(r)["id"]
	owner, err := productOwner(id)
	if err != nil {
		jsonresponse.Internal(w, err)
		return
	}
	if owner == "" {
		jsonresponse.Error(w, http.StatusNotFound, "상품을 찾을 수 없어요.")
		return
	}
	if err := graphqlhandler.RemoveProduct(id, owner); err != nil {
		jsonresponse.Internal(w, err)
		return
	}
	log.Printf("admin %s deleted product %s", jwt.UserID(r.Context()), id)
	jsonresponse.New(w, http.StatusOK, map[string]bool{"deleted": true})
}

// ---- conversations (read-only) ----

type AdminRoom struct {
	ChatId         string
	ProductId      string
	ProductName    string
	SellerId       string
	SellerNickname string
	SellerEmail    string
	BuyerId        string
	BuyerNickname  string
	BuyerEmail     string
	CreatedAt      float64
	MessageCount   int
	LastActivity   float64 // ms
}

func loadRooms(filter func(dynamo.Item) bool) ([]AdminRoom, error) {
	rooms, err := scan(dynamo.TableChatRooms, "", nil)
	if err != nil {
		return nil, err
	}
	msgs, err := scan(dynamo.TableChatMessage, "ChatId, #ts", map[string]*string{"#ts": aws.String("Timestamp")})
	if err != nil {
		return nil, err
	}
	count := map[string]int{}
	last := map[string]float64{}
	for _, m := range msgs {
		id := dynamo.S(m, "ChatId")
		count[id]++
		if ts := msTimestamp(num(m, "Timestamp")); ts > last[id] {
			last[id] = ts
		}
	}

	var userIds, productIds []string
	for _, r := range rooms {
		userIds = append(userIds, dynamo.S(r, "UserSeller"), dynamo.S(r, "UserBuyer"))
		productIds = append(productIds, dynamo.S(r, "ProductId"))
	}
	users, err := nicknames(userIds)
	if err != nil {
		return nil, err
	}
	products, err := dynamo.BatchGet(svc, dynamo.TableProduct, "ProductId", productIds, "ProductId, ProductName")
	if err != nil {
		return nil, err
	}

	out := []AdminRoom{}
	for _, r := range rooms {
		if filter != nil && !filter(r) {
			continue
		}
		room := AdminRoom{
			ChatId:      dynamo.S(r, "ChatId"),
			ProductId:   dynamo.S(r, "ProductId"),
			ProductName: dynamo.S(products[dynamo.S(r, "ProductId")], "ProductName"),
			SellerId:    dynamo.S(r, "UserSeller"),
			BuyerId:     dynamo.S(r, "UserBuyer"),
			CreatedAt:   num(r, "CreatedAt"),
		}
		room.SellerNickname = dynamo.S(users[room.SellerId], "UserNickname")
		room.SellerEmail = dynamo.S(users[room.SellerId], "Email")
		room.BuyerNickname = dynamo.S(users[room.BuyerId], "UserNickname")
		room.BuyerEmail = dynamo.S(users[room.BuyerId], "Email")
		room.MessageCount = count[room.ChatId]
		room.LastActivity = last[room.ChatId]
		if room.LastActivity == 0 {
			room.LastActivity = room.CreatedAt * 1000
		}
		out = append(out, room)
	}
	return out, nil
}

func conversationsHandler(w http.ResponseWriter, r *http.Request) {
	q := strings.TrimSpace(r.URL.Query().Get("q"))
	rooms, err := loadRooms(nil)
	if err != nil {
		jsonresponse.Internal(w, err)
		return
	}
	filtered := []AdminRoom{}
	for _, room := range rooms {
		if matches(q, room.ProductName, room.SellerNickname, room.SellerEmail, room.BuyerNickname, room.BuyerEmail) {
			filtered = append(filtered, room)
		}
	}
	sort.SliceStable(filtered, func(i, j int) bool { return filtered[i].LastActivity > filtered[j].LastActivity })
	page, totalPages, start, end := paginate(len(filtered), r.URL.Query().Get("page"))
	jsonresponse.New(w, http.StatusOK, Page{Items: filtered[start:end], Page: page, TotalPages: totalPages, Total: len(filtered)})
}

type AdminMessage struct {
	MessageId string
	UserId    string
	Nickname  string
	Timestamp float64 // ms
	Content   string
}

// conversationHandler returns one transcript. There is deliberately no
// write endpoint: an admin settling a dispute must not be able to post
// as one of the participants.
func conversationHandler(w http.ResponseWriter, r *http.Request) {
	id := mux.Vars(r)["id"]
	rooms, err := loadRooms(func(it dynamo.Item) bool { return dynamo.S(it, "ChatId") == id })
	if err != nil {
		jsonresponse.Internal(w, err)
		return
	}
	if len(rooms) == 0 {
		jsonresponse.Error(w, http.StatusNotFound, "채팅방을 찾을 수 없어요.")
		return
	}
	room := rooms[0]

	items, err := dynamo.ScanAll(svc, &dynamodb.ScanInput{
		TableName:                 aws.String(dynamo.TableChatMessage),
		FilterExpression:          aws.String("ChatId = :c"),
		ExpressionAttributeValues: dynamo.Item{":c": {S: aws.String(id)}},
	})
	if err != nil {
		jsonresponse.Internal(w, err)
		return
	}
	names := map[string]string{room.SellerId: room.SellerNickname, room.BuyerId: room.BuyerNickname}
	messages := []AdminMessage{}
	for _, it := range items {
		m := AdminMessage{
			MessageId: dynamo.S(it, "MessageId"),
			UserId:    dynamo.S(it, "UserId"),
			Timestamp: msTimestamp(num(it, "Timestamp")),
			Content:   dynamo.S(it, "Content"),
		}
		m.Nickname = names[m.UserId]
		messages = append(messages, m)
	}
	sort.SliceStable(messages, func(i, j int) bool { return messages[i].Timestamp < messages[j].Timestamp })
	jsonresponse.New(w, http.StatusOK, map[string]interface{}{"Room": room, "Messages": messages})
}
