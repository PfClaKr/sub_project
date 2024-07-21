package graphqlhandler

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"

	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/aws/credentials"
	"github.com/aws/aws-sdk-go/aws/session"
	"github.com/aws/aws-sdk-go/service/dynamodb"
	"github.com/graphql-go/graphql"
	"github.com/graphql-go/graphql/language/ast"
	"github.com/graphql-go/graphql/language/parser"
	"github.com/graphql-go/graphql/language/source"
)

var svc *dynamodb.DynamoDB
var schema graphql.Schema

func init() {
	schemaFile, err := os.ReadFile("graphqlhandler/schema.graphql")
	if err != nil {
		log.Fatalf("failed to read schema.graphql: %v", err)
	}

	schemaSource := source.NewSource(&source.Source{
		Body: []byte(schemaFile),
		Name: "schema.graphql",
	})

	astDoc, err := parser.Parse(parser.ParseParams{Source: schemaSource})
	if err != nil {
		log.Fatalf("failed to parse schema.graphql: %v", err)
	}

	var queryType, mutationType *ast.ObjectDefinition

	for _, def := range astDoc.Definitions {
		if objDef, ok := def.(*ast.ObjectDefinition); ok {
			switch objDef.Name.Value {
			case "Query":
				queryType = objDef
			case "Mutation":
				mutationType = objDef
			}
		}
	}

	schemaConfig := graphql.SchemaConfig{}
	if queryType != nil {
		schemaConfig.Query = astToGraphQLObject(queryType)
	}
	if mutationType != nil {
		schemaConfig.Mutation = astToGraphQLObject(mutationType)
	}

	schema, err = graphql.NewSchema(schemaConfig)
	if err != nil {
		log.Fatalf("failed to create schema: %v", err)
	}

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

func GraphqlHandler(w http.ResponseWriter, r *http.Request) {
	var query struct {
		Query     string                 `json:"query"`
		Variables map[string]interface{} `json:"variables"`
	}
	if err := json.NewDecoder(r.Body).Decode(&query); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	resultChan := make(chan *graphql.Result)
	errChan := make(chan error)

	go func() {
		result := executeQuery(query.Query, query.Variables, schema)
		if result.HasErrors() {
			var errMessages []string
			for _, err := range result.Errors {
				errMessages = append(errMessages, err.Message)
			}
			errChan <- fmt.Errorf("GraphQL query execution failed: %v", errMessages)
			return
		}
		resultChan <- result
	}()

	select {
	case result := <-resultChan:
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("Access-Control-Allow-Origin", "*")
		json.NewEncoder(w).Encode(result)
	case err := <-errChan:
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("Access-Control-Allow-Origin", "*")
		json.NewEncoder(w).Encode(err)
	}
}

func executeQuery(query string, variables map[string]interface{}, schema graphql.Schema) *graphql.Result {
	result := graphql.Do(graphql.Params{
		Schema:         schema,
		RequestString:  query,
		VariableValues: variables,
	})
	if len(result.Errors) > 0 {
		log.Printf("errors: %v", result.Errors)
	}
	return result
}

func astToGraphQLObject(def *ast.ObjectDefinition) *graphql.Object {
	fields := graphql.Fields{}
	for _, field := range def.Fields {
		field := field
		fields[field.Name.Value] = &graphql.Field{
			Type: fieldTypeToGraphQLType(field.Type),
			Args: fieldArgsToGraphQLArgs(field.Arguments),
			Resolve: func(p graphql.ResolveParams) (interface{}, error) {
				switch def.Name.Value {
				case "Query":
					switch field.Name.Value {
					case "product":
						return resolveItem(p)
					case "productSearch":
						return resolveItemSearch(p)
					case "user":
						return resolveUser(p)
					}
				case "Mutation":
					switch field.Name.Value {
					case "createUser":
						return createUserResolver(p)
					case "createProduct":
						return createProductResolver(p)
					case "deleteProduct":
						return deleteProductResolver(p)
					}
				}
				return nil, fmt.Errorf("no resolver found for %s", field.Name.Value)
			},
		}
	}
	return graphql.NewObject(graphql.ObjectConfig{
		Name:   def.Name.Value,
		Fields: fields,
	})
}

func fieldTypeToGraphQLType(t ast.Type) graphql.Output {
	switch t := t.(type) {
	case *ast.Named:
		switch t.Name.Value {
		case "String":
			return graphql.String
		case "Float":
			return graphql.Float
		case "Boolean":
			return graphql.Boolean
		case "User":
			return userType
		case "Product":
			return productType
		default:
			return graphql.String
		}
	case *ast.List:
		return graphql.NewList(fieldTypeToGraphQLType(t.Type))
	}
	return graphql.String
}

func fieldArgsToGraphQLArgs(args []*ast.InputValueDefinition) graphql.FieldConfigArgument {
	configArgs := graphql.FieldConfigArgument{}
	for _, arg := range args {
		configArgs[arg.Name.Value] = &graphql.ArgumentConfig{
			Type: fieldTypeToGraphQLType(arg.Type),
		}
	}
	return configArgs
}
