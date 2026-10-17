package main

import (
	"local.com/dynamo"

	"github.com/aws/aws-sdk-go/aws"
)

// A subject is what a chat room is about: a product, or a housing or job
// post. Each kind says where its owner, title and picture live.
type subjectKind struct {
	table     string
	key       string // primary key attribute
	owner     string // attribute holding the owner's user id
	title     string
	image     string // string set (products) or list (posts) of URLs
	status    string
	postType  string // posts only: the Type the post must have
	notFound  string
	ownSelf   string
	closedMsg string // non-empty: only Status "active" accepts new rooms
}

const (
	SubjectProduct = "product"
	SubjectHousing = "housing"
	SubjectJob     = "job"
)

var subjects = map[string]subjectKind{
	SubjectProduct: {
		table: dynamo.TableProduct, key: "ProductId", owner: "UserId",
		title: "ProductName", image: "ProductImage", status: "ProductStatus",
		notFound: "상품을 찾을 수 없어요.", ownSelf: "내 상품에는 채팅할 수 없어요.",
	},
	SubjectHousing: {
		table: dynamo.TablePosts, key: "PostId", owner: "AuthorId",
		title: "Title", image: "Images", status: "Status", postType: "housing",
		notFound: "글을 찾을 수 없어요.", ownSelf: "내 글에는 채팅할 수 없어요.",
		closedMsg: "모집이 끝난 글이에요.",
	},
	SubjectJob: {
		table: dynamo.TablePosts, key: "PostId", owner: "AuthorId",
		title: "Title", image: "Images", status: "Status", postType: "job",
		notFound: "글을 찾을 수 없어요.", ownSelf: "내 글에는 채팅할 수 없어요.",
		closedMsg: "모집이 끝난 글이에요.",
	},
}

// firstImage reads the cover from a string set or a list attribute.
func firstImage(item dynamo.Item, attr string) string {
	v := item[attr]
	switch {
	case v == nil:
		return ""
	case len(v.SS) > 0:
		return aws.StringValue(v.SS[0])
	case len(v.L) > 0 && v.L[0].S != nil:
		return *v.L[0].S
	}
	return ""
}
