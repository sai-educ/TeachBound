// src/Canvas.js
import React, { useRef, useEffect, useState, useImperativeHandle, forwardRef } from 'react';
import './Canvas.css';

const STICKY_NOTE_WIDTH = 150;
const STICKY_NOTE_HEIGHT = 100;

const Canvas = forwardRef(({
  selectedTool, strokeColor, lineWidth, elements,
  onDrawingOrElementComplete, // For new elements
  updateElementsAndHistory, // For updating existing elements (like during drag)
  editingElementId, // ID of the sticky note being edited
  activateStickyNoteEditing // Function to call from App.js to show textarea
}, ref) => {
  const canvasRef = useRef(null);
  const contextRef = useRef(null);

  const [isDrawing, setIsDrawing] = useState(false); // For pen/eraser
  const [currentPath, setCurrentPath] = useState([]);

  const [draggingElement, setDraggingElement] = useState(null); // { id, offsetX, offsetY }
  const [isResizingCanvas, setIsResizingCanvas] = useState(false);


  // Expose methods to App.js
  useImperativeHandle(ref, () => ({
    downloadAsPNG: () => {
      const canvas = canvasRef.current;
      if (canvas) {
        const offscreenCanvas = document.createElement('canvas');
        offscreenCanvas.width = canvas.width;
        offscreenCanvas.height = canvas.height;
        const offscreenCtx = offscreenCanvas.getContext('2d');
        offscreenCtx.fillStyle = '#FFFFFF';
        offscreenCtx.fillRect(0, 0, offscreenCanvas.width, offscreenCanvas.height);
        offscreenCtx.drawImage(canvas, 0, 0);
        const imageURL = offscreenCanvas.toDataURL('image/png');
        const link = document.createElement('a');
        link.href = imageURL; link.download = 'eduboard.png';
        document.body.appendChild(link); link.click(); document.body.removeChild(link);
      }
    },
    getCanvasGlobalRect: () => { // For positioning textarea
        return canvasRef.current?.getBoundingClientRect();
    }
  }));

  const getMousePosition = (event) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const clientX = event.clientX || (event.touches && event.touches[0].clientX);
    const clientY = event.clientY || (event.touches && event.touches[0].clientY);
    return { x: clientX - rect.left, y: clientY - rect.top };
  };

  const redrawAll = (context) => {
    if (!context || !context.canvas) return;
    context.clearRect(0, 0, context.canvas.width, context.canvas.height);
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, context.canvas.width, context.canvas.height);

    elements.forEach(element => {
      context.lineCap = 'round'; context.lineJoin = 'round';
      if (element.type === 'stroke') {
        context.globalCompositeOperation = element.isEraser ? 'destination-out' : 'source-over';
        context.strokeStyle = element.isEraser ? 'rgba(0,0,0,1)' : element.color;
        context.lineWidth = element.lineWidth;
        context.beginPath();
        element.path.forEach((point, index) => {
          if (index === 0) context.moveTo(point.x, point.y);
          else context.lineTo(point.x, point.y);
        });
        context.stroke();
        context.globalCompositeOperation = 'source-over';
      } else if (element.type === 'sticky') {
        context.globalCompositeOperation = 'source-over';
        context.fillStyle = element.backgroundColor || '#FFFACD'; // Lemon chiffon
        context.strokeStyle = draggingElement?.id === element.id ? '#007bff' : '#333333'; // Highlight if dragging
        context.lineWidth = draggingElement?.id === element.id ? 2 : 1;
        
        context.beginPath();
        context.rect(element.x, element.y, STICKY_NOTE_WIDTH, STICKY_NOTE_HEIGHT);
        context.fill();
        context.stroke();
        
        if (editingElementId !== element.id) {
            context.fillStyle = '#000000';
            context.font = '14px Arial';
            const textPadding = 10; const maxWidth = STICKY_NOTE_WIDTH - 2 * textPadding;
            let textY = element.y + textPadding + 14;
            const lines = (element.text || "").split('\n');

            lines.forEach(currentLineText => {
                let textToProcess = currentLineText;
                while(textToProcess.length > 0 && textY < element.y + STICKY_NOTE_HEIGHT - textPadding) {
                    let segment = '';
                    for (let i = 0; i < textToProcess.length; i++) {
                        const testSegment = segment + textToProcess[i];
                        if (context.measureText(testSegment).width > maxWidth) {
                            break;
                        }
                        segment = testSegment;
                    }
                    if (segment) {
                         context.fillText(segment, element.x + textPadding, textY);
                         textY += 16;
                         textToProcess = textToProcess.substring(segment.length);
                    } else { 
                        textY += 16;
                        break; 
                    }
                }
            });
        }
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
    let resizeTimeout;

    const handleResize = () => {
        setIsResizingCanvas(true);
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
            const container = canvas.parentElement;
            if (container && context) {
                canvas.width = container.clientWidth;
                canvas.height = container.clientHeight;
                redrawAll(context);
            }
            setIsResizingCanvas(false);
        }, 100); 
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => {
        window.removeEventListener('resize', handleResize);
        clearTimeout(resizeTimeout);
    }
  }, []);

  useEffect(() => {
    if (contextRef.current && !isResizingCanvas) {
      redrawAll(contextRef.current);
    }
  }, [elements, isResizingCanvas, editingElementId]);

  const getElementAtPosition = (x, y) => {
    for (let i = elements.length - 1; i >= 0; i--) {
      const element = elements[i];
      if (element.type === 'sticky') {
        if (
          x >= element.x && x <= element.x + STICKY_NOTE_WIDTH &&
          y >= element.y && y <= element.y + STICKY_NOTE_HEIGHT
        ) {
          return element;
        }
      }
    }
    return null;
  };


  const handleMouseDown = (event) => {
    event.preventDefault();
    if (editingElementId) return; 

    const { x, y } = getMousePosition(event);
    const context = contextRef.current;

    if (selectedTool === 'pen' || selectedTool === 'eraser') {
      setIsDrawing(true);
      setCurrentPath([{ x, y }]);
      context.globalCompositeOperation = selectedTool === 'eraser' ? 'destination-out' : 'source-over';
      context.strokeStyle = selectedTool === 'eraser' ? 'rgba(0,0,0,1)' : strokeColor;
      context.lineWidth = selectedTool === 'eraser' ? lineWidth * 1.5 : lineWidth;
      context.beginPath(); context.moveTo(x, y);
    } else { 
      const clickedElement = getElementAtPosition(x, y);
      if (clickedElement && clickedElement.type === 'sticky') { 
        const now = Date.now();
        if (clickedElement.id === (canvasRef.current._lastClickedId) && (now - canvasRef.current._lastClickTime < 300) ) {
            activateStickyNoteEditing(clickedElement, canvasRef.current.getBoundingClientRect());
            canvasRef.current._lastClickedId = null; 
            setDraggingElement(null); 
        } else {
            setDraggingElement({
                id: clickedElement.id,
                offsetX: x - clickedElement.x,
                offsetY: y - clickedElement.y,
            });
            canvasRef.current._lastClickedId = clickedElement.id;
            canvasRef.current._lastClickTime = now;
        }
      } else {
        canvasRef.current._lastClickedId = null; 
      }
    }
  };

  const handleMouseMove = (event) => {
    event.preventDefault();
    if (editingElementId) return;

    const { x, y } = getMousePosition(event);
    const context = contextRef.current;

    if (isDrawing && (selectedTool === 'pen' || selectedTool === 'eraser')) {
      context.lineTo(x, y); context.stroke();
      setCurrentPath(prev => [...prev, { x, y }]);
    } else if (draggingElement) {
      // For "live" dragging appearance, we directly update the element in a temporary way
      // The actual persistent update happens on mouseUp via updateElementsAndHistory
      const newX = x - draggingElement.offsetX;
      const newY = y - draggingElement.offsetY;
      // Create a temporary elements array for redrawing
      const tempElements = elements.map(el =>
        el.id === draggingElement.id ? { ...el, x: newX, y: newY } : el
      );
      // Redraw with these temporary positions
      // This does NOT save to history or permanent state yet
      const tempContext = contextRef.current; // Use current context
      tempContext.clearRect(0, 0, tempContext.canvas.width, tempContext.canvas.height);
      tempContext.fillStyle = '#ffffff';
      tempContext.fillRect(0, 0, tempContext.canvas.width, tempContext.canvas.height);
      // Simulate redrawAll with tempElements
      tempElements.forEach(element => {
        tempContext.lineCap = 'round'; tempContext.lineJoin = 'round';
        if (element.type === 'stroke') {
          // ... (stroke drawing logic, simplified for brevity here, copy from redrawAll if needed)
          tempContext.globalCompositeOperation = element.isEraser ? 'destination-out' : 'source-over';
          tempContext.strokeStyle = element.isEraser ? 'rgba(0,0,0,1)' : element.color;
          tempContext.lineWidth = element.lineWidth;
          tempContext.beginPath();
          element.path.forEach((point, index) => {
            if (index === 0) tempContext.moveTo(point.x, point.y);
            else tempContext.lineTo(point.x, point.y);
          });
          tempContext.stroke();
          tempContext.globalCompositeOperation = 'source-over';
        } else if (element.type === 'sticky') {
          // ... (sticky note drawing logic, simplified for brevity, copy from redrawAll)
          tempContext.globalCompositeOperation = 'source-over';
          tempContext.fillStyle = element.backgroundColor || '#FFFACD';
          tempContext.strokeStyle = draggingElement?.id === element.id ? '#007bff' : '#333333';
          tempContext.lineWidth = draggingElement?.id === element.id ? 2 : 1;
          tempContext.beginPath();
          tempContext.rect(element.x, element.y, STICKY_NOTE_WIDTH, STICKY_NOTE_HEIGHT);
          tempContext.fill();
          tempContext.stroke();
          if (editingElementId !== element.id) { // Draw text if not editing
            tempContext.fillStyle = '#000000';
            tempContext.font = '14px Arial';
            // Simplified text drawing for live drag, full logic in redrawAll
            const firstLine = (element.text || "").split('\n')[0] || "";
            tempContext.fillText(firstLine.substring(0,20), element.x + 10, element.y + 24); 
          }
        }
      });
       const dimText = `${tempContext.canvas.width}x${tempContext.canvas.height}`;
       tempContext.fillStyle = '#888888'; tempContext.font = '10px Arial';
       const textWidth = tempContext.measureText(dimText).width;
       tempContext.fillText(dimText, tempContext.canvas.width - textWidth - 5, tempContext.canvas.height - 5);
    }
  };

  const handleMouseUp = (event) => {
    event.preventDefault();
    // The problematic 'if (editingElementId && event.target !== textAreaRef.current)' block is removed.
    // The onBlur for the textarea in App.js handles saving.

    if (isDrawing) {
      setIsDrawing(false);
      if (currentPath.length > 0) {
        onDrawingOrElementComplete({
          type: 'stroke', color: strokeColor, lineWidth: selectedTool === 'eraser' ? lineWidth * 1.5 : lineWidth,
          path: currentPath, isEraser: selectedTool === 'eraser', id: Date.now()
        });
      }
      setCurrentPath([]);
      if (contextRef.current) contextRef.current.globalCompositeOperation = 'source-over';
    } else if (draggingElement) {
        const { x, y } = getMousePosition(event); 
        const finalX = x - draggingElement.offsetX;
        const finalY = y - draggingElement.offsetY;

        updateElementsAndHistory(prevElements =>
            prevElements.map(el =>
                el.id === draggingElement.id ? { ...el, x: finalX, y: finalY } : el
            )
        );
        setDraggingElement(null);
    }
  };

  const handleCanvasClick = (event) => {
    if (editingElementId) return; 
    if (draggingElement) return; 

    const now = Date.now();
    if (canvasRef.current._lastClickTime && (now - canvasRef.current._lastClickTime < 300) && canvasRef.current._lastClickedId) {
        // This condition means it's likely the second click of a double-click that initiated editing
        // or the click that ended a drag. So, don't create a new sticky note here.
        return;
    }

    if (selectedTool === 'sticky') {
      const { x, y } = getMousePosition(event);
      const newStickyId = Date.now();
      const newSticky = {
        type: 'sticky', x: x - STICKY_NOTE_WIDTH / 2, y: y - STICKY_NOTE_HEIGHT / 2,
        text: '', backgroundColor: '#FFFACD', id: newStickyId
      };
      onDrawingOrElementComplete(newSticky); 
      setTimeout(() => {
          activateStickyNoteEditing(newSticky, canvasRef.current.getBoundingClientRect());
      },0);
    }
  };

  let canvasCursor = 'auto';
    if (editingElementId) canvasCursor = 'text'; 
    else if (isDrawing) canvasCursor = selectedTool === 'eraser' ? `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='white' stroke='black' stroke-width='1'><circle cx='12' cy='12' r='10'/></svg>") 12 12, auto` : 'crosshair';
    else if (draggingElement) canvasCursor = 'grabbing';
    else if (selectedTool === 'pen') canvasCursor = 'crosshair';
    else if (selectedTool === 'eraser') canvasCursor = `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='white' stroke='black' stroke-width='1'><circle cx='12' cy='12' r='10'/></svg>") 12 12, auto`;
    else if (selectedTool === 'sticky') canvasCursor = 'cell';
    // Consider adding a 'grab' cursor when hovering over a draggable element if not currently dragging.
    // This would involve adding an onMouseMove listener that checks getElementAtPosition and updates cursor state.

  return (
    <div className="canvas-wrapper"> 
      <canvas
        ref={canvasRef} id="main-canvas" style={{ cursor: canvasCursor }}
        onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp} // Changed onMouseLeave to handleMouseUp for consistency
        onTouchStart={handleMouseDown} onTouchMove={handleMouseMove} onTouchEnd={handleMouseUp}
        onClick={handleCanvasClick}
      />
    </div>
  );
});

export default Canvas;