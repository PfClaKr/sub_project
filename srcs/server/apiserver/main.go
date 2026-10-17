package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"time"

	"apiserver/adminhandler"
	"apiserver/createtable"
	"apiserver/eshandler"
	"apiserver/favoriteshandler"
	"apiserver/geohandler"
	"apiserver/graphqlhandler"
	"apiserver/notifyhandler"
	"apiserver/uploadhandler"

	"local.com/account"
	"local.com/cors"
	"local.com/dynamo"
	"local.com/jwt"
	"local.com/notify"

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

// loadPostDocs reads every community post for the posts index.
func loadPostDocs() ([]eshandler.PostDoc, error) {
	items, err := dynamo.ScanAll(svc, &dynamodb.ScanInput{TableName: aws.String(dynamo.TablePosts)})
	if err != nil {
		return nil, err
	}
	docs := make([]eshandler.PostDoc, 0, len(items))
	for _, item := range items {
		docs = append(docs, eshandler.PostDocFromItem(item))
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
	// Prints a new web push key pair for VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY.
	if len(os.Args) == 2 && os.Args[1] == "vapid-keys" {
		private, public, err := notify.GenerateVAPIDKeys()
		if err != nil {
			log.Fatal(err)
		}
		fmt.Printf("VAPID_PUBLIC_KEY=%s\nVAPID_PRIVATE_KEY=%s\n", public, private)
		return
	}

	// make demo (after /main demo-account in the loginserver); needs the
	// running stack's tables and indexes.
	if len(os.Args) == 5 && os.Args[1] == "demo-seed" {
		eshandler.InitElasticsearch()
		if err := demoSeed(os.Args[2], os.Args[3], os.Args[4]); err != nil {
			log.Fatalf("demo: %v", err)
		}
		return
	}

	createtable.CreateTables(svc)
	eshandler.InitElasticsearch()
	if err := eshandler.EnsureIndex(loadSearchDocs); err != nil {
		log.Fatalf("search index: %v", err)
	}
	if err := eshandler.EnsurePostsIndex(loadPostDocs); err != nil {
		log.Fatalf("posts index: %v", err)
	}
	uploadhandler.EnsureBucket()
	// Expire housing/job posts and warn authors three days ahead.
	go graphqlhandler.RunListingExpiry(context.Background(), 30*time.Minute)
	// Sends queued notification mails (immediate and digests).
	go notify.RunEmailWorker(context.Background(), notify.New(svc))

	r := mux.NewRouter()
	r.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) { w.Write([]byte("ok")) }).Methods("GET")

	r.Handle("/graphql", jwt.Optional(http.HandlerFunc(graphqlhandler.GraphqlHandler))).Methods("POST")
	r.Handle("/upload", jwt.Middleware(account.RequireActive(svc, http.HandlerFunc(uploadhandler.UploadHandler)))).Methods("POST")

	r.Handle("/favorites", jwt.Middleware(http.HandlerFunc(favoriteshandler.ListHandler))).Methods("GET")
	r.Handle("/favorites/{productId}", jwt.Middleware(http.HandlerFunc(favoriteshandler.StatusHandler))).Methods("GET")
	r.Handle("/favorites/{productId}", jwt.Middleware(http.HandlerFunc(favoriteshandler.AddHandler))).Methods("POST")
	r.Handle("/favorites/{productId}", jwt.Middleware(http.HandlerFunc(favoriteshandler.RemoveHandler))).Methods("DELETE")

	// Leaving: the member deletes their own account (privacy policy).
	r.Handle("/account", jwt.Middleware(http.HandlerFunc(adminhandler.LeaveHandler))).Methods("DELETE")
	adminhandler.Register(r)
	geohandler.Register(r)
	notifyhandler.Register(r)

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
