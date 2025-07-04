// backend/client.go
package main

import (
	"log"

	"github.com/gorilla/websocket"
)

// Client represents a single user connection.
type Client struct {
	conn *websocket.Conn
	send chan []byte
	room *Room
}

// readPump pumps messages from the websocket connection to the room's broadcast channel.
func (c *Client) readPump() {
	defer func() {
		c.room.unregister <- c
		c.conn.Close()
	}()
	for {
		_, message, err := c.conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				log.Printf("error: %v", err)
			}
			break
		}
		// The message is then sent to the room's broadcast channel.
		c.room.broadcast <- message
	}
}

// writePump pumps messages from the send channel to the websocket connection.
func (c *Client) writePump() {
	defer c.conn.Close()
	for message := range c.send {
		err := c.conn.WriteMessage(websocket.TextMessage, message)
		if err != nil {
			log.Printf("error writing to websocket: %v", err)
			return
		}
	}
}
