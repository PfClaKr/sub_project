package main

import (
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"apiserver/eshandler"
	"apiserver/graphqlhandler"

	"local.com/dynamo"
	"local.com/jsonresponse"

	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/service/dynamodb"
	"github.com/aws/aws-sdk-go/service/dynamodb/dynamodbattribute"
	"github.com/gorilla/mux"
)

// Debug-only handlers, registered when ENABLE_DEBUG_ROUTES=true.
// Dummy rows use these id prefixes so they can be told apart from
// real (uuid) rows and removed without touching real data.
const (
	dummyUserPrefix    = "dummy-user-"
	dummyProductPrefix = "dummy-product-"
)

func listTables(w http.ResponseWriter, r *http.Request) {
	result, err := svc.ListTables(&dynamodb.ListTablesInput{})
	if err != nil {
		jsonresponse.Internal(w, err)
		return
	}
	jsonresponse.New(w, http.StatusOK, result.TableNames)
}

func describeTable(w http.ResponseWriter, r *http.Request) {
	tableName := mux.Vars(r)["table"]
	// Credentials never leave the loginserver, not even in debug mode.
	if tableName == dynamo.TableUsersCredential {
		jsonresponse.Error(w, http.StatusForbidden, "table not exposed")
		return
	}

	items, err := dynamo.ScanAll(svc, &dynamodb.ScanInput{TableName: aws.String(tableName)})
	if err != nil {
		jsonresponse.Internal(w, err)
		return
	}
	readable := make([]map[string]interface{}, 0, len(items))
	for _, item := range items {
		row := map[string]interface{}{}
		if err := dynamodbattribute.UnmarshalMap(item, &row); err == nil {
			readable = append(readable, row)
		}
	}
	jsonresponse.New(w, http.StatusOK, readable)
}

// A curated catalog so the UI can be tried with realistic listings.
var mockUsers = []struct {
	nickname string
	email    string
}{
	{"파리지앵냥", "chat1@test.com"},
	{"에펠탑아래", "chat2@test.com"},
	{"바게트헌터", "chat3@test.com"},
	{"몽마르뜨댁", "chat4@test.com"},
	{"세느강산책", "chat5@test.com"},
	{"15구토박이", "chat6@test.com"},
	{"오페라단골", "chat7@test.com"},
	{"마레지구", "chat8@test.com"},
}

var mockProducts = []struct {
	name        string
	description string
	category    string
	region      string
	location    string
	price       int
	status      string
}{
	{"아이폰 13 미니 128GB 화이트", "한국에서 쓰던 폰이에요. 배터리 성능 87%, 기스 거의 없습니다. 케이스 두 개 같이 드려요.", "전자기기", "파리", "15구 Beaugrenelle", 380, "판매중"},
	{"이케아 MALM 책상 + 의자 세트", "귀국하게 되어 급처합니다. 직접 가지러 오셔야 해요. 상태 아주 좋아요.", "가구", "파리", "13구 Tolbiac", 60, "판매중"},
	{"라이스쿠커 6인용 (쿠쿠)", "220V 변환 필요 없는 유럽용입니다. 1년 사용했고 내솥 코팅 멀쩡해요.", "전자기기", "일드프랑스", "Cachan", 70, "예약중"},
	{"패딩 롱코트 (M, 검정)", "작년에 한국에서 사온 건데 파리 겨울에 너무 따뜻해요. 이사가서 정리합니다.", "의류", "파리", "5구 팡테옹 근처", 45, "판매중"},
	{"한국 소설 10권 묶음", "한강, 김영하, 김초엽 등이요. 목록은 채팅으로 보내드릴게요. 낱권 판매는 안 해요.", "도서", "파리", "마레지구", 25, "판매중"},
	{"고추장 3kg + 된장 2kg", "한국 다녀오면서 넉넉히 사왔는데 너무 많네요. 미개봉 새제품입니다.", "식품", "파리", "오페라 한인마트 앞", 35, "판매중"},
	{"닌텐도 스위치 OLED + 게임 3개", "젤다, 마리오카트, 모여봐요 동물의숲 포함이요. 박스 있어요.", "전자기기", "파리", "몽파르나스", 260, "판매중"},
	{"전기장판 (싱글)", "파리 집 너무 추워서 샀는데 이사 가는 집은 난방이 잘 돼요. 두 계절 썼습니다.", "전자기기", "파리", "14구", 20, "판매완료"},
	{"유모차 (Yoyo2)", "둘째까지 쓰고 정리해요. 사용감 있지만 바퀴, 접힘 모두 정상입니다.", "기타", "일드프랑스", "불로뉴", 180, "판매중"},
	{"에어프라이어 5.5L", "필립스 제품이고 작동 완벽해요. 기숙사 이사로 판매합니다.", "전자기기", "일드프랑스", "Cité U 근처", 40, "판매중"},
	{"김치냉장고용 김치통 6개", "딤채 정품 김치통입니다. 냄새 배임 없이 깨끗하게 썼어요.", "기타", "파리", "리옹역 근처", 15, "판매중"},
	{"토익 공식문제집 최신판", "필기 거의 없어요. 시험 끝나서 바로 팝니다. 지하철역에서 직거래 가능해요.", "도서", "파리", "샤틀레", 12, "예약중"},
	{"원목 옷장 2단", "H&M 홈 원목 옷장이에요. 분해해서 드릴 수 있고 차 있으시면 옮기기 편해요.", "가구", "일드프랑스", "뇌이쉬르센", 90, "판매중"},
	{"캡슐커피 머신 + 캡슐 30개", "네스프레소 에센자 미니, 화이트 색상. 캡슐은 유통기한 넉넉합니다.", "전자기기", "파리", "9구", 55, "판매중"},
	{"여성 원피스 3벌 (S)", "한 번씩만 입은 거라 새옷 수준이에요. 사진 더 필요하시면 채팅 주세요.", "의류", "파리", "16구 Passy", 30, "판매중"},
	{"전공책: Le francais du tourisme", "소르본 어학원 교재입니다. 형광펜 약간 있어요.", "도서", "파리", "라틴지구", 18, "판매중"},
	{"쌀 10kg (이천쌀)", "한인마트에서 산 지 한 달 안 됐어요. 귀국 정리로 반값에 드려요.", "식품", "파리", "13구 슈아지", 22, "판매중"},
	{"접이식 자전거", "B'TWIN 접이식이고 브레이크 최근에 갈았어요. 시승 가능합니다.", "기타", "일드프랑스", "베르사유", 95, "판매중"},
	{"모니터 27인치 QHD", "LG 27QN600. 픽셀 불량 없고 박스 보관 중입니다. HDMI 케이블 포함.", "전자기기", "일드프랑스", "라데팡스", 140, "예약중"},
	{"화장품 미개봉 (설화수 세트)", "선물 받았는데 쓰는 라인이 아니라서 팝니다. 백화점 정품이에요.", "기타", "파리", "7구", 65, "판매중"},
}

// generateDummyData creates count users with one product each.
func generateDummyData(w http.ResponseWriter, r *http.Request) {
	count, err := strconv.Atoi(mux.Vars(r)["count"])
	if err != nil || count < 1 || count > 100 {
		jsonresponse.Error(w, http.StatusBadRequest, "count must be 1-100")
		return
	}

	ts := time.Now().Unix()
	for i := 0; i < count; i++ {
		u := mockUsers[i%len(mockUsers)]
		p := mockProducts[i%len(mockProducts)]
		userId := fmt.Sprintf("%s%d", dummyUserPrefix, i%len(mockUsers)+1)
		productId := fmt.Sprintf("%s%d", dummyProductPrefix, i+1)
		// Stagger creation times so the recent feed has an order.
		created := strconv.FormatInt(ts-int64(i)*3600, 10)

		user := dynamo.Item{
			"UserId":            {S: aws.String(userId)},
			"Email":             {S: aws.String(u.email)},
			"UserNickname":      {S: aws.String(u.nickname)},
			"Residence":         {S: aws.String(graphqlhandler.DefaultRegion)},
			"ProfileImage":      {S: aws.String(fmt.Sprintf("https://picsum.photos/seed/avatar%d/150/150", i%len(mockUsers)+1))},
			"PublishedQuantity": {N: aws.String("1")},
			"CreatedAt":         {N: aws.String(created)},
		}
		product := dynamo.Item{
			"ProductId":          {S: aws.String(productId)},
			"UserId":             {S: aws.String(userId)},
			"ProductStatus":      {S: aws.String(p.status)},
			"ProductName":        {S: aws.String(p.name)},
			"ProductDescription": {S: aws.String(p.description)},
			"ProductPrice":       {N: aws.String(strconv.Itoa(p.price))},
			"ProductCategory":    {S: aws.String(p.category)},
			"ProductRegion":      {S: aws.String(p.region)},
			"ProductImage": {SS: []*string{
				aws.String(fmt.Sprintf("https://picsum.photos/seed/product%da/600/600", i+1)),
				aws.String(fmt.Sprintf("https://picsum.photos/seed/product%db/600/600", i+1)),
			}},
			"PreferedLocation": {S: aws.String(p.location)},
			"ProductCreatedAt": {N: aws.String(created)},
			"ProductUpdatedAt": {N: aws.String(created)},
		}

		for table, item := range map[string]dynamo.Item{dynamo.TableUsers: user, dynamo.TableProduct: product} {
			if _, err := svc.PutItem(&dynamodb.PutItemInput{TableName: aws.String(table), Item: item}); err != nil {
				jsonresponse.Internal(w, err)
				return
			}
		}
		if err := eshandler.IndexProduct(eshandler.DocFromItem(product)); err != nil {
			jsonresponse.Internal(w, err)
			return
		}
	}

	jsonresponse.New(w, http.StatusCreated, map[string]string{"message": fmt.Sprintf("%d dummy users/products created", count)})
}

// deleteDummyData removes only rows created by generateDummyData.
func deleteDummyData(w http.ResponseWriter, r *http.Request) {
	targets := []struct{ table, key, prefix string }{
		{dynamo.TableProduct, "ProductId", dummyProductPrefix},
		{dynamo.TableUsers, "UserId", dummyUserPrefix},
	}

	deleted := 0
	for _, t := range targets {
		items, err := dynamo.ScanAll(svc, &dynamodb.ScanInput{
			TableName:                 aws.String(t.table),
			ProjectionExpression:      aws.String(t.key),
			FilterExpression:          aws.String("begins_with(" + t.key + ", :p)"),
			ExpressionAttributeValues: dynamo.Item{":p": {S: aws.String(t.prefix)}},
		})
		if err != nil {
			jsonresponse.Internal(w, err)
			return
		}
		for _, item := range items {
			id := dynamo.S(item, t.key)
			if !strings.HasPrefix(id, t.prefix) {
				continue
			}
			if _, err := svc.DeleteItem(&dynamodb.DeleteItemInput{
				TableName: aws.String(t.table),
				Key:       dynamo.Item{t.key: {S: aws.String(id)}},
			}); err != nil {
				jsonresponse.Internal(w, err)
				return
			}
			if t.table == dynamo.TableProduct {
				eshandler.DeleteProduct(id)
			}
			deleted++
		}
	}

	jsonresponse.New(w, http.StatusOK, map[string]string{"message": fmt.Sprintf("%d dummy rows deleted", deleted)})
}
