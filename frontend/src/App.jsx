// src/App.js
import React, { useState } from 'react';
import Whiteboard from './Whiteboard';
//import './App.css';

function App() {
  const [roomId, setRoomId] = useState('');
  const [joined, setJoined] = useState(false);

  const handleJoin = () => {
    if (roomId.trim() !== '') {
      setJoined(true);
    }
  };

  return (
    <div className="App">
      {!joined ? (
        <div className="join-container">
          <h1>Collaborative Whiteboard</h1>
          <input
            type="text"
            placeholder="Enter Room ID"
            value={roomId}
            onChange={(e) => setRoomId(e.target.value)}
          />
          <button onClick={handleJoin}>Join / Create Room</button>
        </div>
      ) : (
        <Whiteboard roomId={roomId} />
      )}
    </div>
  );
}

// Add some basic styling in src/App.css
/*
.App { text-align: center; }
.join-container { margin-top: 20vh; }
input { padding: 10px; margin-right: 10px; }
button { padding: 10px; }
*/

export default App;