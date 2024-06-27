package main

import (
	"encoding/json"
	"fmt"
	"math/rand"
	"net/http"
	"os"
	"strconv"
	"time"

	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/aws/credentials"
	"github.com/aws/aws-sdk-go/aws/session"
	"github.com/aws/aws-sdk-go/service/dynamodb"
	"github.com/gorilla/mux"
)

func init() {
	sess := session.Must(session.NewSession(&aws.Config{
		Region:   aws.String(os.Getenv("AWS_REGION")),
		Endpoint: aws.String(os.Getenv("DYNAMODB_ENDPOINT")),
		Credentials: credentials.NewStaticCredentials(
			os.Getenv("AWS_ACCESS_KEY_ID"),
			os.Getenv("AWS_SECRET_ACCESS_KEY"),
			"",
		),
	}))
	svc = dynamodb.New(sess)
}

func generateDummyData(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	countStr := vars["count"]
	count, err := strconv.Atoi(countStr)
	if err != nil {
		http.Error(w, "Invalid count parameter", http.StatusBadRequest)
		return
	}

	koreanWords := []string{"맛있는 조기", "걸그룹 포토카드", "신호등과 가드레일", "비서구합니다", "덕수궁 산책하실분", "중고에어컨 팝니다", "자랑할꺼 생겼슴", "신문지 한장씩 팝니다", "한국에서 가져온 꿀 팝니다", "금 유로로 바꾸실분", "공룡팝니다", "하늘에 별 팝니다", "애완용거미 먹이 팝니다", "에어팟 2세대 상태 굿", "모기 팝니다", "부르고뉴 레드와인 2병", "한인택시", "장례식대여합니다", "볼펜5자루", "울산에 가주실분 구합니다", "에펠탑 동행하실분?", "한라봉 맛있습니다", "헤어 디자이너 구합니다", "어제 딴 싱싱한 콩나물 팝니다", "상태좋은 디올 목걸이", "제가그린기린그림", "큰바위얼굴", "필름카메라 거의 사용안함", "밥 해주실분?", "계단 만들어 드립니다", "초보환영", "허리아픔", "터미널 어디로 가야하죠", "분필 먹으면 배아파요", "스튜디오1개 25m", "사위하실분 구합니다", "상태좋은 그랜드피아노 팝니다", "아이폰13 pro 팔아요"}

	tableName := "Items"
	for i := 0; i < count; i++ {
		item := map[string]*dynamodb.AttributeValue{
			"ItemId":      {S: aws.String(fmt.Sprintf("Item%d", i+1))},
			"UserId":      {S: aws.String(fmt.Sprintf("User%d", rand.Intn(39)))},
			"Title":       {S: aws.String(koreanWords[rand.Intn(len(koreanWords))])},
			"Description": {S: aws.String(fmt.Sprintf("Description for item %d", i+1))},
			"Price":       {N: aws.String(fmt.Sprintf("%d", rand.Intn(1000)))},
			"Category":    {S: aws.String("Category")},
			"Images":      {SS: []*string{aws.String("image1.jpg"), aws.String("image2.jpg")}},
			"Location":    {S: aws.String("Location")},
			"CreatedAt":   {N: aws.String(fmt.Sprintf("%d", time.Now().Unix()))},
			"UpdatedAt":   {N: aws.String(fmt.Sprintf("%d", time.Now().Unix()))},
		}

		input := &dynamodb.PutItemInput{
			TableName: aws.String(tableName),
			Item:      item,
		}

		_, err := svc.PutItem(input)
		if err != nil {
			http.Error(w, fmt.Sprintf("Failed to create item: %s", err.Error()), http.StatusInternalServerError)
			return
		}
		err = addItemToElasticsearch(item)
		if err != nil {
			http.Error(w, fmt.Sprintf("Failed to create item in elasticsearch: %s", err.Error()), http.StatusInternalServerError)
			return
		}
	}

	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]string{"message": fmt.Sprintf("%d items created", count)})
}

func deleteDummyData(w http.ResponseWriter, r *http.Request) {
	input := &dynamodb.ScanInput{
		TableName: aws.String("Items"),
	}

	result, err := svc.Scan(input)
	if err != nil {
		http.Error(w, fmt.Sprintf("Failed to scan items: %s", err.Error()), http.StatusInternalServerError)
		return
	}

	for _, item := range result.Items {
		deleteInput := &dynamodb.DeleteItemInput{
			TableName: aws.String("Items"),
			Key: map[string]*dynamodb.AttributeValue{
				"ItemId": item["ItemId"],
			},
		}

		_, err := svc.DeleteItem(deleteInput)
		if err != nil {
			http.Error(w, fmt.Sprintf("Failed to delete item: %s", err.Error()), http.StatusInternalServerError)
			return
		}
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"message": "All dummy data deleted"})
}
