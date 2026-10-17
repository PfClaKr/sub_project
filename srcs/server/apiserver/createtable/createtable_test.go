package createtable

import (
	"testing"

	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/service/dynamodb"
	"github.com/aws/aws-sdk-go/service/dynamodb/dynamodbiface"
)

// fakeDB describes a Product table created by an older version: it has
// the obsolete ProductNameIndex and lacks UserIndex.
type fakeDB struct {
	dynamodbiface.DynamoDBAPI
	indexes []string
	updates []*dynamodb.UpdateTableInput
}

func (f *fakeDB) DescribeTable(*dynamodb.DescribeTableInput) (*dynamodb.DescribeTableOutput, error) {
	var gsis []*dynamodb.GlobalSecondaryIndexDescription
	for _, name := range f.indexes {
		gsis = append(gsis, &dynamodb.GlobalSecondaryIndexDescription{IndexName: aws.String(name), IndexStatus: aws.String(dynamodb.IndexStatusActive)})
	}
	return &dynamodb.DescribeTableOutput{Table: &dynamodb.TableDescription{
		TableStatus: aws.String(dynamodb.TableStatusActive), GlobalSecondaryIndexes: gsis,
	}}, nil
}

func (f *fakeDB) UpdateTable(in *dynamodb.UpdateTableInput) (*dynamodb.UpdateTableOutput, error) {
	f.updates = append(f.updates, in)
	return &dynamodb.UpdateTableOutput{}, nil
}

func TestSyncIndexes(t *testing.T) {
	var product tableDef
	for _, td := range tables {
		if td.name == "Product" {
			product = td
		}
	}
	f := &fakeDB{indexes: []string{"ProductNameIndex"}}
	syncIndexes(f, product)
	if len(f.updates) != 2 {
		t.Fatalf("updates = %d, want a drop and a create", len(f.updates))
	}
	if del := f.updates[0].GlobalSecondaryIndexUpdates[0].Delete; del == nil || *del.IndexName != "ProductNameIndex" {
		t.Errorf("first update = %v, want dropping ProductNameIndex", f.updates[0])
	}
	if add := f.updates[1].GlobalSecondaryIndexUpdates[0].Create; add == nil || *add.IndexName != "UserIndex" {
		t.Errorf("second update = %v, want creating UserIndex", f.updates[1])
	}

	// Up to date: nothing to do.
	f = &fakeDB{indexes: []string{"UserIndex"}}
	syncIndexes(f, product)
	if len(f.updates) != 0 {
		t.Errorf("up-to-date table got %d updates", len(f.updates))
	}
}

// Every attribute used by an index key must be declared, or CreateTable
// and UpdateTable fail.
func TestIndexKeysAreDeclared(t *testing.T) {
	for _, td := range tables {
		declared := map[string]bool{}
		for _, a := range td.attribs {
			declared[*a.AttributeName] = true
		}
		for _, gsi := range td.indexes {
			for _, k := range gsi.KeySchema {
				if !declared[*k.AttributeName] {
					t.Errorf("%s.%s uses undeclared %s", td.name, *gsi.IndexName, *k.AttributeName)
				}
			}
		}
	}
}
