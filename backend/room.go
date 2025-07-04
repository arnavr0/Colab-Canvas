// backend/room.go
package main

import "log"

// Message defines the structure of the JSON messages.
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
}

func newRoom(id string) *Room {
	return &Room{
		id:         id,
		clients:    make(map[*Client]bool),
		broadcast:  make(chan []byte),
		register:   make(chan *Client),
		unregister: make(chan *Client),
	}
}

func (r *Room) run() {
	for {
		select {
		case client := <-r.register:
			r.clients[client] = true
			log.Printf("Client connected to room %s. Total clients: %d", r.id, len(r.clients))
		case client := <-r.unregister:
			if _, ok := r.clients[client]; ok {
				delete(r.clients, client)
				close(client.send)
				log.Printf("Client disconnected from room %s. Total clients: %d", r.id, len(r.clients))
			}
		case message := <-r.broadcast:
			// Broadcast message to all clients in the room
			for client := range r.clients {
				select {
				case client.send <- message:
				default:
					close(client.send)
					delete(r.clients, client)
				}
			}
		}
	}
}
