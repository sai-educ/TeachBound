// src/Canvas.js
import React, { useRef, useEffect, useState, useImperativeHandle, forwardRef } from 'react';
import './Canvas.css';

const Canvas = forwardRef(({
  selectedTool,
  strokeColor,
  lineWidth,
  elements, // All elements to draw (from App.js via history)
  onDrawingComplete, // Callback to App.js when drawing/element is done
}, ref) => {
  const canvasRef = useRef(null);
  const contextRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentPath, setCurrentPath] = useState([]);

  useImperativeHandle(ref, () => ({
    downloadAsPNG: () => {
      const canvas = canvasRef.current;
      if (canvas) {
        // Temporarily set background to white for download if it's transparent
        const context = canvas.getContext('2d');
        const originalCompositeOperation = context.globalCompositeOperation;
        const originalFillStyle = context.fillStyle;

        // Create an offscreen canvas, draw existing elements, then fill white behind
        const offscreenCanvas = document.createElement('canvas');
        offscreenCanvas.width = canvas.width;
        offscreenCanvas.height = canvas.height;
        const offscreenCtx = offscreenCanvas.getContext('2d');
        
        // Fill white background on offscreen canvas
        offscreenCtx.fillStyle = '#FFFFFF';
        offscreenCtx.fillRect(0, 0, offscreenCanvas.width, offscreenCanvas.height);
        
        // Draw existing canvas content on top
        offscreenCtx.drawImage(canvas, 0, 0);

        const imageURL = offscreenCanvas.toDataURL('image/png');
        const link = document.createElement('a');
        link.href = imageURL;
        link.download = 'jamboard-clone.png';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    }
  }));

  const getMousePosition = (event) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const clientX = event.clientX || (event.touches && event.touches[0].clientX);
    const clientY = event.clientY || (event.touches && event.touches[0].clientY);
    return { x: clientX - rect.left, y: clientY - rect.top, };
  };

  const redrawAll = (context) => {
    context.clearRect(0, 0, context.canvas.width, context.canvas.height);
    // No default background fill here; let CSS handle .canvas-container background
    // The #main-canvas itself can have a white background via CSS if needed,
    // or elements (like a background shape) can be the first in the 'elements' array.
    // For simplicity, let's keep a white fill for drawing operations for now.
    context.fillStyle = '#ffffff'; 
    context.fillRect(0, 0, context.canvas.width, context.canvas.height);


    elements.forEach(element => {
      context.lineCap = 'round';
      context.lineJoin = 'round';
      if (element.type === 'stroke') {
        context.globalCompositeOperation = element.isEraser ? 'destination-out' : 'source-over';
        context.strokeStyle = element.isEraser ? 'rgba(0,0,0,1)' : element.color; // Eraser needs a color
        context.lineWidth = element.lineWidth;
        context.beginPath();
        element.path.forEach((point, index) => {
          if (index === 0) context.moveTo(point.x, point.y);
          else context.lineTo(point.x, point.y);
        });
        context.stroke();
        context.globalCompositeOperation = 'source-over'; // Reset
      } else if (element.type === 'sticky') {
        context.globalCompositeOperation = 'source-over';
        context.fillStyle = element.backgroundColor || '#FFFACD';
        context.strokeStyle = '#333333';
        context.lineWidth = 1;
        const noteWidth = 150; const noteHeight = 100;
        context.beginPath();
        // Simple rect for now, roundRect might not be universally supported or needs a polyfill
        context.rect(element.x, element.y, noteWidth, noteHeight);
        context.fill();
        context.stroke();
        
        context.fillStyle = '#000000';
        context.font = '14px Arial';
        const textPadding = 10; const maxWidth = noteWidth - 2 * textPadding;
        let line = ''; let textY = element.y + textPadding + 14;
        for (let i = 0; i < element.text.length; i++) {
            const testLine = line + element.text[i];
            const metrics = context.measureText(testLine);
            if (metrics.width > maxWidth && i > 0) {
                context.fillText(line, element.x + textPadding, textY);
                line = element.text[i]; textY += 16;
            } else { line = testLine; }
        }
        context.fillText(line, element.x + textPadding, textY);
      }
    });

    const dimText = `${context.canvas.width}x${context.canvas.height}`;
    context.fillStyle = '#888888'; context.font = '10px Arial';
    const textWidth = context.measureText(dimText).width;
    context.fillText(dimText, context.canvas.width - textWidth - 5, context.canvas.height - 5);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');
    contextRef.current = context;

    const resizeCanvas = () => {
      const container = canvas.parentElement;
      if (container) {
        canvas.width = container.clientWidth;
        canvas.height = container.clientHeight;
        redrawAll(context);
      }
    };
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    return () => window.removeEventListener('resize', resizeCanvas);
  }, []); // Only on mount for initial setup

  // Redraw whenever elements array changes
  useEffect(() => {
    if (contextRef.current) {
      redrawAll(contextRef.current);
    }
  }, [elements]);

  const startDrawing = (event) => {
    event.preventDefault();
    const { x, y } = getMousePosition(event);
    const context = contextRef.current;

    if (selectedTool === 'pen' || selectedTool === 'eraser') {
      setIsDrawing(true);
      setCurrentPath([{ x, y }]);
      context.globalCompositeOperation = selectedTool === 'eraser' ? 'destination-out' : 'source-over';
      context.strokeStyle = selectedTool === 'eraser' ? 'rgba(0,0,0,1)' : strokeColor;
      context.lineWidth = selectedTool === 'eraser' ? lineWidth * 1.5 : lineWidth; // Eraser can be thicker
      context.beginPath();
      context.moveTo(x, y);
    }
  };

  const draw = (event) => {
    event.preventDefault();
    if (!isDrawing) return;
    const { x, y } = getMousePosition(event);
    const context = contextRef.current;
    context.lineTo(x, y);
    context.stroke();
    setCurrentPath(prevPath => [...prevPath, { x, y }]);
  };

  const stopDrawing = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    const context = contextRef.current;

    if ((selectedTool === 'pen' || selectedTool === 'eraser') && currentPath.length > 0) { // Store even single points for 'tap' erase/draw
      onDrawingComplete({
        type: 'stroke',
        color: strokeColor, // Store original color even for eraser for potential later use
        lineWidth: selectedTool === 'eraser' ? lineWidth * 1.5 : lineWidth,
        path: currentPath,
        isEraser: selectedTool === 'eraser',
        id: Date.now()
      });
    }
    setCurrentPath([]);
    context.globalCompositeOperation = 'source-over'; // Reset
  };

  const handleCanvasClick = (event) => {
    if (selectedTool === 'sticky') {
      const { x, y } = getMousePosition(event);
      const defaultText = prompt("Enter text for your sticky note:", "My idea...");
      if (defaultText !== null) {
        onDrawingComplete({
          type: 'sticky',
          x: x - 75, y: y - 50,
          text: defaultText,
          backgroundColor: '#FFFACD',
          id: Date.now()
        });
      }
    }
  };

  let canvasCursor = 'auto';
  if (isDrawing) {
    canvasCursor = selectedTool === 'eraser' ? `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='white' stroke='black' stroke-width='1'><circle cx='12' cy='12' r='10'/></svg>") 12 12, auto` : 'crosshair';
  } else if (selectedTool === 'pen') canvasCursor = 'crosshair';
  else if (selectedTool === 'eraser') canvasCursor = `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='white' stroke='black' stroke-width='1'><circle cx='12' cy='12' r='10'/></svg>") 12 12, auto`;
  else if (selectedTool === 'sticky') canvasCursor = 'cell';


  return (
    <div className="canvas-container" style={{ cursor: canvasCursor }}>
      <canvas
        ref={canvasRef} id="main-canvas"
        onMouseDown={startDrawing} onMouseMove={draw} onMouseUp={stopDrawing} onMouseLeave={stopDrawing}
        onTouchStart={startDrawing} onTouchMove={draw} onTouchEnd={stopDrawing}
        onClick={handleCanvasClick}
      />
    </div>
  );
});

export default Canvas;