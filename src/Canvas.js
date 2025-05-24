// src/Canvas.js
import React, { useRef, useEffect, useState } from 'react';
import './Canvas.css';

const Canvas = () => {
  const canvasRef = useRef(null);
  const containerRef = useRef(null); // Ref for the container div

  // Function to draw on the canvas (will be expanded later)
  const draw = (context, frameCount) => {
    // For now, just clear and draw a background and border
    context.clearRect(0, 0, context.canvas.width, context.canvas.height);
    context.fillStyle = '#ffffff'; // White background for the canvas
    context.fillRect(0, 0, context.canvas.width, context.canvas.height);

    // Test drawing (optional, can be removed)
    context.fillStyle = 'blue';
    context.font = '24px Arial';
    context.fillText(`Canvas Ready: ${context.canvas.width}x${context.canvas.height}`, 20, 50);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');
    let animationFrameId;

    const resizeCanvas = () => {
      // Get dimensions of the container
      const container = containerRef.current;
      if (container) {
        // Set canvas drawing surface size
        canvas.width = container.clientWidth;
        canvas.height = container.clientHeight;

        // Redraw content after resizing
        // For now, just our basic draw function
        draw(context, 0); // Pass a dummy frameCount or manage state
      }
    };

    // Initial resize
    resizeCanvas();

    // Add resize listener
    window.addEventListener('resize', resizeCanvas);

    // Animation loop (if you need continuous rendering, otherwise just call draw on events)
    // For now, we just draw once on resize. If you have animations, you'd use this:
    // const render = () => {
    //   frameCount++;
    //   draw(context, frameCount);
    //   animationFrameId = window.requestAnimationFrame(render);
    // };
    // render();

    // Cleanup
    return () => {
      window.removeEventListener('resize', resizeCanvas);
      // window.cancelAnimationFrame(animationFrameId); // If using animation loop
    };
  }, []); // Empty dependency array, effect runs once on mount and cleans up on unmount

  return (
    <div ref={containerRef} className="canvas-container">
      <canvas ref={canvasRef} id="main-canvas" />
    </div>
  );
};

export default Canvas;