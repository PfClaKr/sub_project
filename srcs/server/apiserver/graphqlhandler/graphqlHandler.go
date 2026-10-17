package graphqlhandler

import (
	_ "embed"
	"encoding/json"
	"fmt"
	"log"
	"net/http"

	"local.com/dynamo"

	"github.com/aws/aws-sdk-go/service/dynamodb/dynamodbiface"
	"github.com/graphql-go/graphql"
	"github.com/graphql-go/graphql/language/ast"
	"github.com/graphql-go/graphql/language/parser"
	"github.com/graphql-go/graphql/language/source"
)

//go:embed schema.graphql
var schemaSDL []byte

var svc dynamodbiface.DynamoDBAPI = dynamo.New()
var schema graphql.Schema

type resolver = func(graphql.ResolveParams) (interface{}, error)

// resolvers maps "<Root>.<field>" to its implementation. Every root
// field declared in schema.graphql must have an entry.
var resolvers = map[string]resolver{
	"Query.product":                  resolveProduct,
	"Query.productSearch":            resolveProductSearch,
	"Query.searchSuggestions":        resolveSearchSuggestions,
	"Query.searchProducts":           resolveSearchProducts,
	"Query.recentProducts":           resolveRecentProducts,
	"Query.userProducts":             resolveUserProducts,
	"Query.user":                     resolveUser,
	"Query.marketStats":              resolveMarketStats,
	"Query.notifications":            resolveNotifications,
	"Query.unreadCount":              resolveUnreadCount,
	"Query.posts":                    resolvePosts,
	"Query.post":                     resolvePost,
	"Query.comments":                 resolveComments,
	"Query.similarQuestions":         resolveSimilarQuestions,
	"Query.myPosts":                  resolveMyPosts,
	"Query.myBookmarks":              resolveMyBookmarks,
	"Query.listings":                 resolveListings,
	"Query.listing":                  resolveListing,
	"Mutation.createProduct":         createProductResolver,
	"Mutation.updateProduct":         updateProductResolver,
	"Mutation.updateProductStatus":   updateProductStatusResolver,
	"Mutation.deleteProduct":         deleteProductResolver,
	"Mutation.updateProfile":         updateProfileResolver,
	"Mutation.markNotificationsRead": markNotificationsReadResolver,
	"Mutation.createPost":            createPostResolver,
	"Mutation.updatePost":            updatePostResolver,
	"Mutation.deletePost":            deletePostResolver,
	"Mutation.likePost":              likePostResolver,
	"Mutation.bookmarkPost":          bookmarkPostResolver,
	"Mutation.viewPost":              viewPostResolver,
	"Mutation.createComment":         createCommentResolver,
	"Mutation.deleteComment":         deleteCommentResolver,
	"Mutation.acceptAnswer":          acceptAnswerResolver,
	"Mutation.report":                reportResolver,
	"Mutation.createListing":         createListingResolver,
	"Mutation.updateListing":         updateListingResolver,
	"Mutation.setListingDeal":        setListingDealResolver,
	"Mutation.extendListing":         extendListingResolver,
	"Mutation.bumpListing":           bumpListingResolver,
	"Mutation.revealContact":         revealContactResolver,
}

func init() {
	var err error
	schema, err = buildSchema(schemaSDL)
	if err != nil {
		log.Fatalf("invalid schema.graphql: %v", err)
	}
}

// buildSchema turns the SDL into graphql-go objects. Non-root types
// use the default resolver (map key lookup), so resolvers return
// map[string]interface{} keyed by field name.
func buildSchema(sdl []byte) (graphql.Schema, error) {
	doc, err := parser.Parse(parser.ParseParams{
		Source: source.NewSource(&source.Source{Body: sdl, Name: "schema.graphql"}),
	})
	if err != nil {
		return graphql.Schema{}, err
	}

	types := map[string]*graphql.Object{}
	inputs := map[string]*graphql.InputObject{}
	var roots []*ast.ObjectDefinition
	for _, def := range doc.Definitions {
		switch def := def.(type) {
		case *ast.InputObjectDefinition:
			inputs[def.Name.Value] = buildInput(def, inputs)
		case *ast.ObjectDefinition:
			if def.Name.Value == "Query" || def.Name.Value == "Mutation" {
				roots = append(roots, def)
				continue
			}
			types[def.Name.Value] = buildObject(def, types, inputs, false)
		}
	}

	cfg := graphql.SchemaConfig{}
	for _, obj := range roots {
		built := buildObject(obj, types, inputs, true)
		if obj.Name.Value == "Query" {
			cfg.Query = built
		} else {
			cfg.Mutation = built
		}
	}
	return graphql.NewSchema(cfg)
}

// buildInput builds an SDL "input" type. Resolvers receive it as a
// map[string]interface{} argument.
func buildInput(def *ast.InputObjectDefinition, inputs map[string]*graphql.InputObject) *graphql.InputObject {
	fields := graphql.InputObjectConfigFieldMap{}
	for _, f := range def.Fields {
		fields[f.Name.Value] = &graphql.InputObjectFieldConfig{Type: inputType(f.Type, inputs)}
	}
	return graphql.NewInputObject(graphql.InputObjectConfig{Name: def.Name.Value, Fields: fields})
}

func buildObject(def *ast.ObjectDefinition, types map[string]*graphql.Object, inputs map[string]*graphql.InputObject, root bool) *graphql.Object {
	fields := graphql.Fields{}
	for _, f := range def.Fields {
		field := &graphql.Field{
			Type: outputType(f.Type, types),
			Args: graphql.FieldConfigArgument{},
		}
		for _, arg := range f.Arguments {
			field.Args[arg.Name.Value] = &graphql.ArgumentConfig{Type: inputType(arg.Type, inputs)}
		}
		if root {
			key := def.Name.Value + "." + f.Name.Value
			if r, ok := resolvers[key]; ok {
				field.Resolve = r
			} else {
				field.Resolve = func(graphql.ResolveParams) (interface{}, error) {
					return nil, fmt.Errorf("no resolver for %s", key)
				}
			}
		}
		fields[f.Name.Value] = field
	}
	return graphql.NewObject(graphql.ObjectConfig{Name: def.Name.Value, Fields: fields})
}

func scalar(name string) graphql.Output {
	switch name {
	case "Float":
		return graphql.Float
	case "Boolean":
		return graphql.Boolean
	case "Int":
		return graphql.Int
	}
	return graphql.String
}

// Object types must be declared before they are referenced.
func outputType(t ast.Type, types map[string]*graphql.Object) graphql.Output {
	switch t := t.(type) {
	case *ast.List:
		return graphql.NewList(outputType(t.Type, types))
	case *ast.NonNull:
		return graphql.NewNonNull(outputType(t.Type, types))
	case *ast.Named:
		if obj, ok := types[t.Name.Value]; ok {
			return obj
		}
		return scalar(t.Name.Value)
	}
	return graphql.String
}

// Input types, like object types, must be declared before use.
func inputType(t ast.Type, inputs map[string]*graphql.InputObject) graphql.Input {
	switch t := t.(type) {
	case *ast.List:
		return graphql.NewList(inputType(t.Type, inputs))
	case *ast.NonNull:
		return graphql.NewNonNull(inputType(t.Type, inputs))
	case *ast.Named:
		if in, ok := inputs[t.Name.Value]; ok {
			return in
		}
		return scalar(t.Name.Value)
	}
	return graphql.String
}

// GraphqlHandler must be wrapped with jwt.Optional so mutations can
// read the user from the request context. Errors are returned in the
// standard GraphQL "errors" array.
func GraphqlHandler(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Query         string                 `json:"query"`
		Variables     map[string]interface{} `json:"variables"`
		OperationName string                 `json:"operationName"`
	}
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 1<<20)).Decode(&body); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}

	result := graphql.Do(graphql.Params{
		Schema:         schema,
		RequestString:  body.Query,
		VariableValues: body.Variables,
		OperationName:  body.OperationName,
		Context:        r.Context(),
	})

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(result)
}
