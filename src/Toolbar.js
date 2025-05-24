// src/Toolbar.js
import React from 'react';
import './Toolbar.css';

const Toolbar = () => {
  return (
    <div className="toolbar-container">
      <button className="tool-button">Pen</button>
      <button className="tool-button">Eraser</button>
      <button className="tool-button">Sticky Note</button>
      {/* Add more placeholder buttons as you plan features */}
    </div>
  );
};

export default Toolbar;