// backend/main.go
package main

import (
	"encoding/json"
	"log"
	"math/rand"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gorilla/handlers" // NEW: Import the handlers package
	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		return true
	},
}

// createRoomHandler and serveWs functions remain exactly the same as before.
// No changes are needed in them.

func createRoomHandler(hub *Hub, w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	var newRoomID string
	for {
		newRoomID = strconv.Itoa(rand.Intn(90000) + 10000)
		hub.mu.RLock()
		_, exists := hub.rooms[newRoomID]
		hub.mu.RUnlock()
		if !exists {
			break
		}
	}
	hub.getOrCreateRoom(newRoomID)
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"roomId": newRoomID})
	log.Printf("Created new room: %s", newRoomID)
}

func serveWs(hub *Hub, w http.ResponseWriter, r *http.Request) {
	pathParts := strings.Split(r.URL.Path, "/")
	if len(pathParts) < 3 || pathParts[2] == "" {
		http.Error(w, "Room ID is required", http.StatusBadRequest)
		return
	}
	roomId := pathParts[2]
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Println(err)
		return
	}
	room := hub.getOrCreateRoom(roomId)
	client := &Client{conn: conn, send: make(chan []byte, 256), room: room}
	client.room.register <- client
	go client.writePump()
	go client.readPump()
}

func main() {
	rand.New(rand.NewSource(time.Now().UnixNano()))

	hub := newHub()

	// Create a new router
	router := http.NewServeMux()

	router.HandleFunc("/ws/", func(w http.ResponseWriter, r *http.Request) {
		serveWs(hub, w, r)
	})
	router.HandleFunc("/api/rooms", func(w http.ResponseWriter, r *http.Request) {
		createRoomHandler(hub, w, r)
	})

	// --- NEW: Define CORS options ---
	// For development, we allow requests from our React app's origin.
	allowedOrigins := handlers.AllowedOrigins([]string{"http://localhost:5173"})
	allowedMethods := handlers.AllowedMethods([]string{"GET", "POST", "PUT", "DELETE"})
	allowedHeaders := handlers.AllowedHeaders([]string{"Content-Type"})

	log.Println("HTTP server starting on :8080")
	// --- MODIFIED: Wrap the router with the CORS middleware ---
	err := http.ListenAndServe(":8080", handlers.CORS(allowedOrigins, allowedMethods, allowedHeaders)(router))
	if err != nil {
		log.Fatal("ListenAndServe: ", err)
	}
}
