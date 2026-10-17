package graphqlhandler

import (
	"encoding/json"
	"testing"

	"github.com/graphql-go/graphql"
)

func TestBuildSchemaInputTypes(t *testing.T) {
	resolvers["Query.echo"] = func(p graphql.ResolveParams) (interface{}, error) {
		b, _ := json.Marshal(p.Args["Input"])
		return string(b), nil
	}
	t.Cleanup(func() { delete(resolvers, "Query.echo") })

	s, err := buildSchema([]byte(`
input RangeInput { Min: Float, Max: Float }
input FilterInput { Kind: String!, Tags: [String!], Range: RangeInput }
type Query { echo(Input: FilterInput!): String }
`))
	if err != nil {
		t.Fatal(err)
	}

	res := graphql.Do(graphql.Params{Schema: s, RequestString: `{ echo(Input: {Kind: "shared", Tags: ["a"], Range: {Max: 700}}) }`})
	if len(res.Errors) > 0 {
		t.Fatal(res.Errors)
	}
	got := res.Data.(map[string]interface{})["echo"]
	if want := `{"Kind":"shared","Range":{"Max":700},"Tags":["a"]}`; got != want {
		t.Errorf("echo = %v, want %s", got, want)
	}

	// Required input fields are enforced by graphql-go.
	res = graphql.Do(graphql.Params{Schema: s, RequestString: `{ echo(Input: {Tags: ["a"]}) }`})
	if len(res.Errors) == 0 {
		t.Error("missing required Kind was accepted")
	}
}
