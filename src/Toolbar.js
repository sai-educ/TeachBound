// src/Toolbar.js
import React from 'react';
import './Toolbar.css';
import { PenTool, Eraser, StickyNote } from 'lucide-react'; // Import icons

const Toolbar = () => {
  return (
    <div className="toolbar-container">
      <button className="tool-button">
        <PenTool size={18} className="tool-icon" /> Pen
      </button>
      <button className="tool-button">
        <Eraser size={18} className="tool-icon" /> Eraser
      </button>
      <button className="tool-button">
        <StickyNote size={18} className="tool-icon" /> Sticky Note
      </button>
      {/* Add more tools with icons later */}
    </div>
  );
};

export default Toolbar;