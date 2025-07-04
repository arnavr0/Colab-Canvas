// backend/hub.go
package main

import (
	"sync"
)

// Hub manages all the rooms in the application.
type Hub struct {
	rooms map[string]*Room
	mu    sync.RWMutex
}

func newHub() *Hub {
	return &Hub{
		rooms: make(map[string]*Room),
	}
}

// getOrCreateRoom finds a room by ID or creates it if it doesn't exist.
func (h *Hub) getOrCreateRoom(id string) *Room {
	h.mu.Lock()
	defer h.mu.Unlock()

	if room, ok := h.rooms[id]; ok {
		return room
	}

	room := newRoom(id)
	h.rooms[id] = room
	go room.run() // Start the room's message processing loop
	return room
}
