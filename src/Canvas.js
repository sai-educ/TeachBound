// src/Canvas.js
import React, { useRef, useEffect } from 'react';
import './Canvas.css';

const Canvas = () => {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    const context = canvas.getContext('2d');

    // --- Canvas Dimensions ---
    // Let's make it a fixed size for now, or a percentage of a container
    // For simplicity, fixed size:
    canvas.width = 800;
    canvas.height = 600;

    // --- Initial Test Drawing ---
    // Fill background
    context.fillStyle = '#f0f0f0'; // A light grey background
    context.fillRect(0, 0, canvas.width, canvas.height);

    // Draw a small red square as a test
    context.fillStyle = 'red';
    context.fillRect(20, 20, 50, 50);

    // Draw some sample text
    context.fillStyle = 'blue';
    context.font = '24px Arial';
    context.fillText('Jamboard Clone Canvas', 20, 100);
    // --- End Test Drawing ---

  }, []); // Empty dependency array means this runs once after the component mounts

  return (
    <div className="canvas-container">
      <canvas ref={canvasRef} id="main-canvas" />
    </div>
  );
};

export default Canvas;