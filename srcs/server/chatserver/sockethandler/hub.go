package sockethandler

import (
	"sync"

	"github.com/gorilla/websocket"
)

// Hub tracks websocket connections per chat room and broadcasts
// messages to every member of a room.
type Hub struct {
	mu    sync.RWMutex
	rooms map[string]map[*websocket.Conn]bool
}

var hub = &Hub{rooms: map[string]map[*websocket.Conn]bool{}}

func (h *Hub) Join(chatId string, conn *websocket.Conn) {
	h.mu.Lock()
	defer h.mu.Unlock()
	if h.rooms[chatId] == nil {
		h.rooms[chatId] = map[*websocket.Conn]bool{}
	}
	h.rooms[chatId][conn] = true
}

func (h *Hub) Leave(chatId string, conn *websocket.Conn) {
	h.mu.Lock()
	defer h.mu.Unlock()
	delete(h.rooms[chatId], conn)
	if len(h.rooms[chatId]) == 0 {
		delete(h.rooms, chatId)
	}
}

func (h *Hub) Broadcast(chatId string, payload []byte) {
	h.mu.RLock()
	defer h.mu.RUnlock()
	for conn := range h.rooms[chatId] {
		// Ignore per-connection write errors; dead peers are removed
		// when their read loop exits.
		conn.WriteMessage(websocket.TextMessage, payload)
	}
}
