// frontend/src/App.js
import React from 'react';
import { Routes, Route } from 'react-router-dom';
import HomePage from './HomePage'; // Import the new HomePage component
import Whiteboard from './Whiteboard'; // Import the Whiteboard component
import './App.css';

function App() {
  return (
    <div className="App">
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/room/:roomId" element={<Whiteboard />} />
      </Routes>
    </div>
  );
}

export default App;