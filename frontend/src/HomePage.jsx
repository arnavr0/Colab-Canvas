// frontend/src/HomePage.jsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom'; // Import useNavigate
import './App.css';

function HomePage() {
  const [inputRoomId, setInputRoomId] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate(); // Get the navigation function

  // Function to handle creating a new room
  const handleCreateRoom = async () => {
    setError('');
    try {
      const response = await fetch('http://localhost:8080/api/rooms', {
        method: 'POST',
      });
      if (!response.ok) {
        throw new Error('Could not create room.');
      }
      const data = await response.json();
      // Navigate to the new room's URL
      navigate(`/room/${data.roomId}`);
    } catch (err) {
      setError(err.message || 'Failed to create room.');
    }
  };

  // Function to handle joining an existing room
  const handleJoinRoom = () => {
    setError('');
    if (inputRoomId.trim() === '' || inputRoomId.trim().length !== 5) {
      setError('Please enter a valid 5-digit Room ID.');
      return;
    }
    // Navigate to the specified room's URL
    navigate(`/room/${inputRoomId}`);
  };

  return (
    <div className="join-container">
      <h1>Collaborative Whiteboard</h1>
      
      <div className="create-room-section">
        <button onClick={handleCreateRoom} className="create-btn">
          Create a New Room
        </button>
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
  );
}

export default HomePage;