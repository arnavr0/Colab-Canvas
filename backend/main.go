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

	"github.com/gorilla/handlers"
	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		return true
	},
}

func serveWs(hub *Hub, w http.ResponseWriter, r *http.Request) {
	pathParts := strings.Split(r.URL.Path, "/")
	if len(pathParts) < 3 || pathParts[2] == "" {
		http.Error(w, "Room ID is required", http.StatusBadRequest)
		return
	}
	roomId := pathParts[2]

	username := r.URL.Query().Get("username")
	if username == "" {
		username = "Guest"
	}

	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Println(err)
		return
	}
	room := hub.getOrCreateRoom(roomId)
	client := &Client{conn: conn, send: make(chan []byte, 256), room: room, Username: username}
	client.room.register <- client
	go client.writePump()
	go client.readPump()
}

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

func main() {
	rand.New(rand.NewSource(time.Now().UnixNano()))
	hub := newHub()
	router := http.NewServeMux()
	router.HandleFunc("/ws/", func(w http.ResponseWriter, r *http.Request) {
		serveWs(hub, w, r)
	})
	router.HandleFunc("/api/rooms", func(w http.ResponseWriter, r *http.Request) {
		createRoomHandler(hub, w, r)
	})
	allowedOrigins := handlers.AllowedOrigins([]string{"http://localhost:5173"})
	allowedMethods := handlers.AllowedMethods([]string{"GET", "POST"})
	allowedHeaders := handlers.AllowedHeaders([]string{"Content-Type"})
	log.Println("HTTP server starting on :8080")
	err := http.ListenAndServe(":8080", handlers.CORS(allowedOrigins, allowedMethods, allowedHeaders)(router))
	if err != nil {
		log.Fatal("ListenAndServe: ", err)
	}
}
