package graphqlhandler

import (
	"github.com/graphql-go/graphql"
)

var userType = graphql.NewObject(graphql.ObjectConfig{
	Name: "User",
	Fields: graphql.Fields{
		"UserId":            &graphql.Field{Type: graphql.String},
		"Email":             &graphql.Field{Type: graphql.String},
		"PasswordHash":      &graphql.Field{Type: graphql.String},
		"UserNickname":      &graphql.Field{Type: graphql.String},
		"ProfileImage":      &graphql.Field{Type: graphql.String},
		"PublishedQuantity": &graphql.Field{Type: graphql.Float},
		"CreatedAt":         &graphql.Field{Type: graphql.Float},
	},
})

var productType = graphql.NewObject(graphql.ObjectConfig{
	Name: "Product",
	Fields: graphql.Fields{
		"ProductId":          &graphql.Field{Type: graphql.String},
		"UserId":             &graphql.Field{Type: graphql.String},
		"ProductName":        &graphql.Field{Type: graphql.String},
		"ProductDescription": &graphql.Field{Type: graphql.String},
		"ProductPrice":       &graphql.Field{Type: graphql.Float},
		"ProductCategory":    &graphql.Field{Type: graphql.String},
		"ProductImage":       &graphql.Field{Type: graphql.NewList(graphql.String)},
		"PreferedLocation":   &graphql.Field{Type: graphql.String},
		"ProductCreatedAt":   &graphql.Field{Type: graphql.Float},
		"ProductUpdatedAt":   &graphql.Field{Type: graphql.Float},
	},
})
