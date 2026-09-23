package sockethandler

import (
	"log"
	"sync"
)

// Client is one websocket connection in a room. Only its writePump
// writes to the connection; everyone else sends through the channel,
// because gorilla/websocket forbids concurrent writers.
type Client struct {
	chatId string
	send   chan []byte
}

func newClient(chatId string) *Client {
	return &Client{chatId: chatId, send: make(chan []byte, 32)}
}

// Hub tracks clients per chat room and fans messages out to them.
type Hub struct {
	mu    sync.RWMutex
	rooms map[string]map[*Client]bool
}

func NewHub() *Hub {
	return &Hub{rooms: map[string]map[*Client]bool{}}
}

var hub = NewHub()

func (h *Hub) Join(c *Client) {
	h.mu.Lock()
	defer h.mu.Unlock()
	if h.rooms[c.chatId] == nil {
		h.rooms[c.chatId] = map[*Client]bool{}
	}
	h.rooms[c.chatId][c] = true
}

// Leave removes the client and closes its send channel, which stops
// its writePump. Safe to call more than once.
func (h *Hub) Leave(c *Client) {
	h.mu.Lock()
	defer h.mu.Unlock()
	room := h.rooms[c.chatId]
	if !room[c] {
		return
	}
	delete(room, c)
	close(c.send)
	if len(room) == 0 {
		delete(h.rooms, c.chatId)
	}
}

// Broadcast never blocks: a client whose buffer is full misses the
// message (it still gets it from /history on reload).
func (h *Hub) Broadcast(chatId string, payload []byte) {
	h.mu.RLock()
	defer h.mu.RUnlock()
	for c := range h.rooms[chatId] {
		select {
		case c.send <- payload:
		default:
			log.Printf("chat %s: dropping message for slow client", chatId)
		}
	}
}
