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
	"Query.product":                resolveProduct,
	"Query.productSearch":          resolveProductSearch,
	"Query.searchSuggestions":      resolveSearchSuggestions,
	"Query.searchProducts":         resolveSearchProducts,
	"Query.recentProducts":         resolveRecentProducts,
	"Query.userProducts":           resolveUserProducts,
	"Query.user":                   resolveUser,
	"Query.marketStats":            resolveMarketStats,
	"Mutation.createProduct":       createProductResolver,
	"Mutation.updateProduct":       updateProductResolver,
	"Mutation.updateProductStatus": updateProductStatusResolver,
	"Mutation.deleteProduct":       deleteProductResolver,
	"Mutation.updateProfile":       updateProfileResolver,
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
	var roots []*ast.ObjectDefinition
	for _, def := range doc.Definitions {
		obj, ok := def.(*ast.ObjectDefinition)
		if !ok {
			continue
		}
		if obj.Name.Value == "Query" || obj.Name.Value == "Mutation" {
			roots = append(roots, obj)
			continue
		}
		types[obj.Name.Value] = buildObject(obj, types, false)
	}

	cfg := graphql.SchemaConfig{}
	for _, obj := range roots {
		built := buildObject(obj, types, true)
		if obj.Name.Value == "Query" {
			cfg.Query = built
		} else {
			cfg.Mutation = built
		}
	}
	return graphql.NewSchema(cfg)
}

func buildObject(def *ast.ObjectDefinition, types map[string]*graphql.Object, root bool) *graphql.Object {
	fields := graphql.Fields{}
	for _, f := range def.Fields {
		field := &graphql.Field{
			Type: outputType(f.Type, types),
			Args: graphql.FieldConfigArgument{},
		}
		for _, arg := range f.Arguments {
			field.Args[arg.Name.Value] = &graphql.ArgumentConfig{Type: inputType(arg.Type)}
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

func inputType(t ast.Type) graphql.Input {
	switch t := t.(type) {
	case *ast.List:
		return graphql.NewList(inputType(t.Type))
	case *ast.NonNull:
		return graphql.NewNonNull(inputType(t.Type))
	case *ast.Named:
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
