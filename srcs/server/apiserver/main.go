package main

import (
	"fmt"
	"log"
	"net/http"
	"os"

	"apiserver/adminhandler"
	"apiserver/createtable"
	"apiserver/eshandler"
	"apiserver/favoriteshandler"
	"apiserver/geohandler"
	"apiserver/graphqlhandler"
	"apiserver/uploadhandler"

	"local.com/cors"
	"local.com/dynamo"
	"local.com/jwt"

	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/service/dynamodb"
	"github.com/aws/aws-sdk-go/service/dynamodb/dynamodbiface"
	"github.com/gorilla/mux"
)

var svc dynamodbiface.DynamoDBAPI = dynamo.New()

// loadSearchDocs reads every product so the search index can be
// rebuilt from DynamoDB, the source of truth.
func loadSearchDocs() ([]eshandler.ProductDoc, error) {
	items, err := dynamo.ScanAll(svc, &dynamodb.ScanInput{TableName: aws.String(dynamo.TableProduct)})
	if err != nil {
		return nil, err
	}
	docs := make([]eshandler.ProductDoc, 0, len(items))
	for _, item := range items {
		docs = append(docs, eshandler.DocFromItem(item))
	}
	return docs, nil
}

// promoteAdmin is the only way to create an admin (there is no public
// route for it): docker compose exec apiserver /main promote-admin <email>
func promoteAdmin(email string) {
	userId, err := adminhandler.UserIdByEmail(email)
	if err != nil {
		log.Fatalf("no account for %s: %v", email, err)
	}
	if err := adminhandler.SetRole(userId, adminhandler.RoleAdmin); err != nil {
		log.Fatalf("promote %s: %v", email, err)
	}
	fmt.Printf("%s (%s) is now an admin\n", email, userId)
}

func main() {
	if len(os.Args) == 3 && os.Args[1] == "promote-admin" {
		promoteAdmin(os.Args[2])
		return
	}

	createtable.CreateTables(svc)
	eshandler.InitElasticsearch()
	if err := eshandler.EnsureIndex(loadSearchDocs); err != nil {
		log.Fatalf("search index: %v", err)
	}
	uploadhandler.EnsureBucket()

	r := mux.NewRouter()
	r.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) { w.Write([]byte("ok")) }).Methods("GET")

	r.Handle("/graphql", jwt.Optional(http.HandlerFunc(graphqlhandler.GraphqlHandler))).Methods("POST")
	r.Handle("/upload", jwt.Middleware(http.HandlerFunc(uploadhandler.UploadHandler))).Methods("POST")

	r.Handle("/favorites", jwt.Middleware(http.HandlerFunc(favoriteshandler.ListHandler))).Methods("GET")
	r.Handle("/favorites/{productId}", jwt.Middleware(http.HandlerFunc(favoriteshandler.StatusHandler))).Methods("GET")
	r.Handle("/favorites/{productId}", jwt.Middleware(http.HandlerFunc(favoriteshandler.AddHandler))).Methods("POST")
	r.Handle("/favorites/{productId}", jwt.Middleware(http.HandlerFunc(favoriteshandler.RemoveHandler))).Methods("DELETE")

	adminhandler.Register(r)
	geohandler.Register(r)

	// Table dumps and dummy data; never enable outside local dev.
	if os.Getenv("ENABLE_DEBUG_ROUTES") == "true" {
		log.Println("WARNING: debug routes enabled")
		r.HandleFunc("/debug/tables", listTables).Methods("GET")
		r.HandleFunc("/debug/tables/{table}", describeTable).Methods("GET")
		r.HandleFunc("/debug/dummy/{count}", generateDummyData).Methods("POST")
		r.HandleFunc("/debug/dummy", deleteDummyData).Methods("DELETE")
	}

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	fmt.Println("Starting api server on :" + port)
	log.Fatal(http.ListenAndServe(":"+port, cors.Middleware(r)))
}
