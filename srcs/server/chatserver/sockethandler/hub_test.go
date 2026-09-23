package sockethandler

import (
	"sync"
	"testing"
)

func TestBroadcastReachesOnlyRoomMembers(t *testing.T) {
	h := NewHub()
	a, b, other := newClient("room"), newClient("room"), newClient("elsewhere")
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
	slow := newClient("room")
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
	c := newClient("room")
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
	c := newClient("room")
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
