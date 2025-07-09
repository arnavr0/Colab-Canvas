// backend/room.go
package main

import (
	"encoding/json"
	"log"
)

// Message defines the structure of the JSON messages.
// (No changes to this struct)
type Message struct {
	Type    string `json:"type"`
	Payload any    `json:"payload"`
}

// Room manages the clients and broadcasts messages.
type Room struct {
	id         string
	clients    map[*Client]bool
	broadcast  chan []byte
	register   chan *Client
	unregister chan *Client
	history    [][]byte // ADDED: To store the history of draw messages
}

func newRoom(id string) *Room {
	return &Room{
		id:         id,
		clients:    make(map[*Client]bool),
		broadcast:  make(chan []byte),
		register:   make(chan *Client),
		unregister: make(chan *Client),
		history:    make([][]byte, 0), // ADDED: Initialize the history slice
	}
}

func (r *Room) run() {
	for {
		select {
		case client := <-r.register:
			r.clients[client] = true
			log.Printf("Client connected to room %s. Total clients: %d", r.id, len(r.clients))

			// --- MODIFIED SECTION: Send history to the new client ---
			for _, msg := range r.history {
				// Send historical messages directly to the new client's send channel
				client.send <- msg
			}
			// --- END MODIFIED SECTION ---

		case client := <-r.unregister:
			if _, ok := r.clients[client]; ok {
				delete(r.clients, client)
				close(client.send)
				log.Printf("Client disconnected from room %s. Total clients: %d", r.id, len(r.clients))
			}
		case message := <-r.broadcast:
			// --- MODIFIED SECTION: Persist message and then broadcast ---
			var msg Message
			if err := json.Unmarshal(message, &msg); err == nil {
				switch msg.Type {
				case "draw":
					// Add draw messages to history
					r.history = append(r.history, message)
				case "clear":
					// If the canvas is cleared, wipe the history
					r.history = make([][]byte, 0)
				}
			}

			// Broadcast message to all clients in the room (unchanged from before)
			for client := range r.clients {
				select {
				case client.send <- message:
				default:
					close(client.send)
					delete(r.clients, client)
				}
			}
			// --- END MODIFIED SECTION ---
		}
	}
}
