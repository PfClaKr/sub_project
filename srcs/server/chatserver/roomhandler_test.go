package main

import (
	"testing"

	"github.com/google/uuid"
)

// Product rooms must keep the id they had before subjects existed, or
// every existing conversation would be orphaned.
func TestRoomIdKeepsProductFormula(t *testing.T) {
	legacy := uuid.NewSHA1(roomNamespace, []byte("p1:buyer")).String()
	if got := roomId(SubjectProduct, "p1", "buyer"); got != legacy {
		t.Errorf("product room id changed: %s, want %s", got, legacy)
	}
	if roomId(SubjectHousing, "p1", "buyer") == legacy {
		t.Error("a housing post with the same id must not share the product room")
	}
	if roomId(SubjectHousing, "p1", "buyer") == roomId(SubjectJob, "p1", "buyer") {
		t.Error("housing and job rooms collide")
	}
}

func TestNormalizeLegacyRoom(t *testing.T) {
	r := ChatRoom{ChatId: "c", ProductId: "p1"}
	r.normalize()
	if r.SubjectType != SubjectProduct || r.SubjectId != "p1" {
		t.Errorf("legacy room normalized to %s/%s", r.SubjectType, r.SubjectId)
	}
}
