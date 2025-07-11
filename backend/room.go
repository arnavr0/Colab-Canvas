// backend/room.go
package main

import (
	"encoding/json"
	"log"
)

// Message struct to unmarshal incoming messages
type Message struct {
	Type    string          `json:"type"`
	Payload json.RawMessage `json:"payload"`
}

// Room manages the clients and broadcasts messages.
type Room struct {
	id         string
	clients    map[*Client]bool
	broadcast  chan []byte
	register   chan *Client
	unregister chan *Client
	history    [][]byte
}

func newRoom(id string) *Room {
	return &Room{
		id:         id,
		clients:    make(map[*Client]bool),
		broadcast:  make(chan []byte),
		register:   make(chan *Client),
		unregister: make(chan *Client),
		history:    make([][]byte, 0),
	}
}

// broadcastToAll sends a message to every client in the room.
func (r *Room) broadcastToAll(message []byte) {
	for client := range r.clients {
		select {
		case client.send <- message:
		default:
			close(client.send)
			delete(r.clients, client)
		}
	}
}

func (r *Room) run() {
	for {
		select {
		case client := <-r.register:
			r.clients[client] = true
			log.Printf("Client '%s' connected to room '%s'. Total clients: %d", client.Username, r.id, len(r.clients))

			// --- Corrected Presence Logic ---
			// 1. Create a list of current usernames
			var currentUsers []string
			for c := range r.clients {
				currentUsers = append(currentUsers, c.Username)
			}

			// 2. Send the full user list to the newly connected client
			userListMsg, _ := json.Marshal(map[string]interface{}{"type": "user_list", "payload": currentUsers})
			client.send <- userListMsg

			// 3. Announce the new user to all other clients
			userJoinedMsg, _ := json.Marshal(map[string]interface{}{"type": "user_joined", "payload": client.Username})
			for otherClient := range r.clients {
				if otherClient != client {
					otherClient.send <- userJoinedMsg
				}
			}

			// Send canvas history to the new client
			for _, msg := range r.history {
				client.send <- msg
			}

		case client := <-r.unregister:
			if _, ok := r.clients[client]; ok {
				username := client.Username
				delete(r.clients, client)
				close(client.send)
				log.Printf("Client '%s' disconnected from room '%s'. Total clients: %d", username, r.id, len(r.clients))

				// Announce user departure to remaining clients
				userLeftMsg, _ := json.Marshal(map[string]interface{}{"type": "user_left", "payload": username})
				r.broadcastToAll(userLeftMsg)
			}

		case message := <-r.broadcast:
			// --- Corrected Broadcast Logic ---
			// Unmarshal to inspect the message type for persistence
			var msgData Message
			if err := json.Unmarshal(message, &msgData); err == nil {
				switch msgData.Type {
				case "draw", "shape":
					r.history = append(r.history, message)
				case "clear":
					r.history = make([][]byte, 0)
				}
			}
			// Broadcast the original message to all clients
			r.broadcastToAll(message)
		}
	}
}
