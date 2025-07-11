// src/App.jsx
import React, { useState } from 'react';
import Whiteboard from './Whiteboard'; // We will render this conditionally
import './App.css'; // The styles for the join form are here

function App() {
  // State to manage the user's input and connection status
  const [roomId, setRoomId] = useState('');
  const [username, setUsername] = useState('');
  const [inputRoomId, setInputRoomId] = useState('');
  const [error, setError] = useState('');
  
  // The crucial state that controls which view is shown
  const [hasJoined, setHasJoined] = useState(false);

  // This function sets the state to render the Whiteboard
  const joinRoom = (roomIdToJoin) => {
    if (username.trim() === '') {
      setError('Please enter a username.');
      return;
    }
    if (!roomIdToJoin) {
      setError('Room ID is missing.');
      return;
    }
    setRoomId(roomIdToJoin);
    setHasJoined(true); // This triggers the view change
  };

  const handleCreateRoom = async () => {
    if (username.trim() === '') {
        setError('Please enter a username before creating a room.');
        return;
    }
    setError('');
    try {
      const response = await fetch('http://localhost:8080/api/rooms', { method: 'POST' });
      if (!response.ok) throw new Error('Could not create room.');
      const data = await response.json();
      joinRoom(data.roomId); // Use our new function
    } catch (err) {
      setError(err.message || 'Failed to create room.');
    }
  };

  const handleJoinRoom = () => {
    joinRoom(inputRoomId); // Use our new function
  };

  return (
    <div className="App">
      {hasJoined ? (
        // If we have joined, render the Whiteboard and pass it the required data
        <Whiteboard roomId={roomId} username={username} />
      ) : (
        // Otherwise, render the join form
        <div className="join-container">
          <h1>Collaborative Whiteboard</h1>
          <div className="username-section">
            <input
              type="text"
              placeholder="Enter your name"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="username-input"
            />
          </div>
          <div className="create-room-section">
            <button onClick={handleCreateRoom} className="create-btn">Create a New Room</button>
          </div>
          <div className="divider">OR</div>
          <div className="join-room-section">
            <input
              type="text"
              placeholder="Enter 5-Digit Code"
              value={inputRoomId}
              onChange={(e) => setInputRoomId(e.target.value)}
              maxLength="5"
            />
            <button onClick={handleJoinRoom}>Join Room</button>
          </div>
          {error && <p className="error-message">{error}</p>}
        </div>
      )}
    </div>
  );
}

export default App;