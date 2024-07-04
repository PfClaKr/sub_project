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

func generateUserDummyData(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	countStr := vars["count"]
	count, err := strconv.Atoi(countStr)
	if err != nil {
		http.Error(w, "Invalid count parameter", http.StatusBadRequest)
		return
	}

	names := []string{"김철수", "이영희", "박민수", "최지혜", "홍길동", "전유건", "송채훈", "이동빈"}
	emails := []string{"example1@test.com", "example2@test.com", "example3@test.com", "example4@test.com", "example5@test.com"}
	profileImages := []string{"https://cdn.icon-icons.com/icons2/1378/PNG/512/avatardefault_92824.png"}

	tableName := "Users"
	for i := 0; i < count; i++ {
		item := map[string]*dynamodb.AttributeValue{
			"UserId":            {S: aws.String(fmt.Sprintf("User%d", i+1))},
			"Email":             {S: aws.String(emails[rand.Intn(len(emails))])},
			"PasswordHash":      {S: aws.String(fmt.Sprintf("PasswordHash%d", i+1))},
			"UserNickname":      {S: aws.String(names[rand.Intn(len(names))])},
			"ProfileImage":      {S: aws.String(profileImages[rand.Intn(len(profileImages))])},
			"PublishedQuantity": {N: aws.String(fmt.Sprintf("1"))},
			"CreatedAt":         {N: aws.String(fmt.Sprintf("%d", time.Now().Unix()))},
		}

		input := &dynamodb.PutItemInput{
			TableName: aws.String(tableName),
			Item:      item,
		}

		_, err := svc.PutItem(input)
		if err != nil {
			http.Error(w, fmt.Sprintf("Failed to create user: %s", err.Error()), http.StatusInternalServerError)
			return
		}
	}

	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]string{"message": fmt.Sprintf("%d users created", count)})
}

func generateDummyData(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	countStr := vars["count"]
	count, err := strconv.Atoi(countStr)
	if err != nil {
		http.Error(w, "Invalid count parameter", http.StatusBadRequest)
		return
	}

	generateUserDummyData(w, r)
	koreanWords := []string{"맛있는 조기", "걸그룹 포토카드", "신호등과 가드레일", "비서구합니다", "덕수궁 산책하실분", "중고에어컨 팝니다", "자랑할꺼 생겼슴", "신문지 한장씩 팝니다", "한국에서 가져온 꿀 팝니다", "금 유로로 바꾸실분", "공룡팝니다", "하늘에 별 팝니다", "애완용거미 먹이 팝니다", "에어팟 2세대 상태 굿", "모기 팝니다", "부르고뉴 레드와인 2병", "한인택시", "장례식대여합니다", "볼펜5자루", "울산에 가주실분 구합니다", "에펠탑 동행하실분?", "한라봉 맛있습니다", "헤어 디자이너 구합니다", "어제 딴 싱싱한 콩나물 팝니다", "상태좋은 디올 목걸이", "제가그린기린그림", "큰바위얼굴", "필름카메라 거의 사용안함", "밥 해주실분?", "계단 만들어 드립니다", "초보환영", "허리아픔", "터미널 어디로 가야하죠", "분필 먹으면 배아파요", "스튜디오1개 25m", "사위하실분 구합니다", "상태좋은 그랜드피아노 팝니다", "아이폰13 pro 팔아요"}
	imageUrls1 := []string{"https://images.pexels.com/videos/5201403/abstract-antidepressant-background-beach-5201403.jpeg?auto=compress&cs=tinysrgb&dpr=1&w=500", "https://bytescare.com/blog/wp-content/uploads/2023/05/no-copyright-infringement-intended.svg", "https://stock.bmw.co.uk/rails/active_storage/blobs/redirect/eyJfcmFpbHMiOnsibWVzc2FnZSI6IkJBaHBBa1VDIiwiZXhwIjpudWxsLCJwdXIiOiJibG9iX2lkIn19--40694218137195e12d241012c715264f9d6bb3a7/bmw-2-series-gran-coupe.png"}
	imageUrls2 := []string{"https://thumbs.wbm.im/pw/small/2633e48cbe3e1e9864caebfdbbc38329.jpg", "https://png.pngtree.com/thumb_back/fh260/background/20230612/pngtree-picture-of-a-girl-with-a-camera-in-hand-image_2891140.jpg"}

	tableName := "Product"
	for i := 0; i < count; i++ {
		item := map[string]*dynamodb.AttributeValue{
			"ProductId":          {S: aws.String(fmt.Sprintf("Product%d", i+1))},
			"UserId":             {S: aws.String(fmt.Sprintf("User%d", i+1))},
			"ProductName":        {S: aws.String(koreanWords[rand.Intn(len(koreanWords))])},
			"ProductDescription": {S: aws.String(fmt.Sprintf("ProductDescription for Product %d", i+1))},
			"ProductPrice":       {N: aws.String(fmt.Sprintf("%d", rand.Intn(1000)))},
			"ProductCategory":    {S: aws.String("Category")},
			"ProductImage":       {SS: []*string{aws.String(imageUrls1[rand.Intn(len(imageUrls1))]), aws.String(imageUrls2[rand.Intn(len(imageUrls2))])}},
			"PreferedLocation":   {S: aws.String("PreferedLocation")},
			"ProductCreatedAt":   {N: aws.String(fmt.Sprintf("%d", time.Now().Unix()))},
			"ProductUpdatedAt":   {N: aws.String(fmt.Sprintf("%d", time.Now().Unix()))},
		}

		input := &dynamodb.PutItemInput{
			TableName: aws.String(tableName),
			Item:      item,
		}

		_, err := svc.PutItem(input)
		if err != nil {
			http.Error(w, fmt.Sprintf("Failed to create product: %s", err.Error()), http.StatusInternalServerError)
			return
		}
		err = addItemToElasticsearch(item)
		if err != nil {
			http.Error(w, fmt.Sprintf("Failed to create product in elasticsearch: %s", err.Error()), http.StatusInternalServerError)
			return
		}
	}

	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]string{"message": fmt.Sprintf("%d products created", count)})
}

func deleteDummyData(w http.ResponseWriter, r *http.Request) {
	tableNames := []string{"Product", "User"}

	for _, tableName := range tableNames {
		input := &dynamodb.ScanInput{
			TableName: aws.String(tableName),
		}

		result, err := svc.Scan(input)
		if err != nil {
			http.Error(w, fmt.Sprintf("Failed to scan %s: %s", tableName, err.Error()), http.StatusInternalServerError)
			return
		}

		for _, item := range result.Items {
			deleteInput := &dynamodb.DeleteItemInput{
				TableName: aws.String(tableName),
				Key: map[string]*dynamodb.AttributeValue{
					"ProductId": item["ProductId"],
				},
			}
			if tableName == "User" {
				deleteInput.Key = map[string]*dynamodb.AttributeValue{
					"UserId": item["UserId"],
				}
			}

			_, err := svc.DeleteItem(deleteInput)
			if err != nil {
				http.Error(w, fmt.Sprintf("Failed to delete item from %s: %s", tableName, err.Error()), http.StatusInternalServerError)
				return
			}
		}
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"message": "All dummy data deleted"})
}
