package sockethandler

import (
	"sync"
	"testing"
	"time"
)

func TestBroadcastReachesOnlyRoomMembers(t *testing.T) {
	h := NewHub()
	a, b, other := newClient("room", "u1"), newClient("room", "u1"), newClient("elsewhere", "u2")
	for _, c := range []*Client{a, b, other} {
		h.Join(c)
	}

	h.Broadcast("room", []byte("hi"))

	for _, c := range []*Client{a, b} {
		if got := string(<-c.send); got != "hi" {
			t.Errorf("got %q, want hi", got)
		}
	}
	if len(other.send) != 0 {
		t.Error("client in another room received the message")
	}
}

func TestBroadcastDoesNotBlockOnSlowClient(t *testing.T) {
	h := NewHub()
	slow := newClient("room", "u1")
	h.Join(slow)
	for i := 0; i < cap(slow.send)+10; i++ {
		h.Broadcast("room", []byte("x"))
	}
	if len(slow.send) != cap(slow.send) {
		t.Errorf("buffer = %d, want full %d", len(slow.send), cap(slow.send))
	}
}

func TestLeaveClosesSendOnce(t *testing.T) {
	h := NewHub()
	c := newClient("room", "u1")
	h.Join(c)
	h.Leave(c)
	h.Leave(c) // must not panic on double close
	if _, open := <-c.send; open {
		t.Error("send channel should be closed")
	}
	h.Broadcast("room", []byte("after leave")) // must not panic
}

// Run with -race: concurrent senders must not race on connections.
func TestConcurrentBroadcast(t *testing.T) {
	h := NewHub()
	c := newClient("room", "u1")
	h.Join(c)
	var wg sync.WaitGroup
	for i := 0; i < 8; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			h.Broadcast("room", []byte("x"))
		}()
	}
	wg.Wait()
	h.Leave(c)
}

func TestOnlineAndNotifyGap(t *testing.T) {
	h := NewHub()
	c := newClient("room", "alice")
	h.Join(c)
	if !h.Online("room", "alice") || h.Online("room", "bob") || h.Online("other", "alice") {
		t.Error("Online does not match who has the room open")
	}
	h.Leave(c)
	if h.Online("room", "alice") {
		t.Error("still online after leaving")
	}

	now := time.Unix(0, 0)
	if !shouldNotify("r1", "bob", now) {
		t.Error("first message must notify")
	}
	if shouldNotify("r1", "bob", now.Add(5*time.Minute)) {
		t.Error("a second message within the gap must not notify again")
	}
	if !shouldNotify("r1", "bob", now.Add(chatNotifyGap+time.Second)) || !shouldNotify("r2", "bob", now) {
		t.Error("after the gap, or in another room, it must notify")
	}
}
