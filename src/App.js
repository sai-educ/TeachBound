// src/App.js
import React from 'react';
import './App.css';
import Toolbar from './Toolbar';
import Canvas from './Canvas';
// import FrameBar from './FrameBar'; // We'll use this later

function App() {
  return (
    <div className="App">
      {/* <FrameBar /> */}
      <Toolbar />
      <Canvas />
    </div>
  );
}

export default App;