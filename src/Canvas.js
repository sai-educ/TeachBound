// src/Canvas.js
import React, { useRef, useEffect, useState, useImperativeHandle, forwardRef } from 'react';
import './Canvas.css';

const STICKY_NOTE_WIDTH = 150;
const STICKY_NOTE_HEIGHT = 100;

const Canvas = forwardRef(({
  selectedTool, strokeColor, fillColor, lineWidth, fontSize, elements,
  onDrawingOrElementComplete, // For new elements
  updateElementsAndHistory, // For updating existing elements (like during drag)
  editingElementId, // ID of the sticky note being edited
  activateStickyNoteEditing, // Function to call from App.js to show textarea
  activateTextEditing // Function to call for text editing
}, ref) => {
  const canvasRef = useRef(null);
  const contextRef = useRef(null);

  const [isDrawing, setIsDrawing] = useState(false); // For pen/eraser
  const [currentPath, setCurrentPath] = useState([]);

  const [draggingElement, setDraggingElement] = useState(null); // { id, offsetX, offsetY }
  const [isResizingCanvas, setIsResizingCanvas] = useState(false);

  // Shape drawing states
  const [shapeStartPoint, setShapeStartPoint] = useState(null);
  const [currentShape, setCurrentShape] = useState(null);

  // Selection states
  const [selectedElements, setSelectedElements] = useState([]);
  const [selectionRect, setSelectionRect] = useState(null);
  const [isSelecting, setIsSelecting] = useState(false);

  // Mouse position for coordinate display
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

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
    },
    deleteSelectedElements: () => {
      if (selectedElements.length > 0) {
        updateElementsAndHistory(prevElements => 
          prevElements.filter(el => !selectedElements.includes(el.id))
        );
        setSelectedElements([]);
      }
    }
  }));

  const getMousePosition = (event) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const clientX = event.clientX || (event.touches && event.touches[0].clientX);
    const clientY = event.clientY || (event.touches && event.touches[0].clientY);
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    setMousePosition({ x: Math.round(x), y: Math.round(y) });
    return { x, y };
  };

  const drawShape = (context, type, startX, startY, endX, endY, options = {}) => {
    context.strokeStyle = options.strokeColor || strokeColor;
    context.fillStyle = options.fillColor || fillColor;
    context.lineWidth = options.lineWidth || lineWidth;
    context.lineCap = 'round';
    context.lineJoin = 'round';

    switch (type) {
      case 'rectangle':
        context.beginPath();
        context.rect(startX, startY, endX - startX, endY - startY);
        if (options.fillColor !== 'transparent') context.fill();
        context.stroke();
        break;
      case 'circle':
        const radius = Math.sqrt(Math.pow(endX - startX, 2) + Math.pow(endY - startY, 2));
        context.beginPath();
        context.arc(startX, startY, radius, 0, 2 * Math.PI);
        if (options.fillColor !== 'transparent') context.fill();
        context.stroke();
        break;
      case 'line':
        context.beginPath();
        context.moveTo(startX, startY);
        context.lineTo(endX, endY);
        context.stroke();
        break;
      case 'arrow':
        // Draw line
        context.beginPath();
        context.moveTo(startX, startY);
        context.lineTo(endX, endY);
        context.stroke();
        
        // Draw arrowhead
        const angle = Math.atan2(endY - startY, endX - startX);
        const arrowLength = 15;
        context.beginPath();
        context.moveTo(endX, endY);
        context.lineTo(
          endX - arrowLength * Math.cos(angle - Math.PI / 6),
          endY - arrowLength * Math.sin(angle - Math.PI / 6)
        );
        context.moveTo(endX, endY);
        context.lineTo(
          endX - arrowLength * Math.cos(angle + Math.PI / 6),
          endY - arrowLength * Math.sin(angle + Math.PI / 6)
        );
        context.stroke();
        break;
    }
  };

  const redrawAll = (context) => {
    if (!context || !context.canvas) return;
    context.clearRect(0, 0, context.canvas.width, context.canvas.height);
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, context.canvas.width, context.canvas.height);

    elements.forEach(element => {
      context.lineCap = 'round'; context.lineJoin = 'round';
      
      // Draw selection highlight
      if (selectedElements.includes(element.id)) {
        context.save();
        context.strokeStyle = '#007bff';
        context.lineWidth = 2;
        context.setLineDash([5, 5]);
        
        if (element.type === 'sticky') {
          context.strokeRect(element.x - 2, element.y - 2, STICKY_NOTE_WIDTH + 4, STICKY_NOTE_HEIGHT + 4);
        } else if (element.type === 'text') {
          const textWidth = context.measureText(element.text).width;
          context.strokeRect(element.x - 2, element.y - element.fontSize - 2, textWidth + 4, element.fontSize + 8);
        } else if (element.type === 'rectangle') {
          context.strokeRect(element.x - 2, element.y - 2, element.width + 4, element.height + 4);
        } else if (element.type === 'circle') {
          context.beginPath();
          context.arc(element.x, element.y, element.radius + 2, 0, 2 * Math.PI);
          context.stroke();
        } else if (element.type === 'line' || element.type === 'arrow') {
          // Draw selection handles for lines
          context.fillStyle = '#007bff';
          context.fillRect(element.x - 4, element.y - 4, 8, 8);
          context.fillRect(element.endX - 4, element.endY - 4, 8, 8);
        }
        
        context.restore();
      }
      
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
      } else if (element.type === 'rectangle') {
        context.strokeStyle = element.strokeColor;
        context.fillStyle = element.fillColor;
        context.lineWidth = element.lineWidth;
        context.beginPath();
        context.rect(element.x, element.y, element.width, element.height);
        if (element.fillColor !== 'transparent') context.fill();
        context.stroke();
      } else if (element.type === 'circle') {
        context.strokeStyle = element.strokeColor;
        context.fillStyle = element.fillColor;
        context.lineWidth = element.lineWidth;
        context.beginPath();
        context.arc(element.x, element.y, element.radius, 0, 2 * Math.PI);
        if (element.fillColor !== 'transparent') context.fill();
        context.stroke();
      } else if (element.type === 'line' || element.type === 'arrow') {
        drawShape(context, element.type, element.x, element.y, element.endX, element.endY, {
          strokeColor: element.strokeColor,
          fillColor: element.fillColor,
          lineWidth: element.lineWidth
        });
      } else if (element.type === 'text') {
        if (editingElementId !== element.id) {
          context.fillStyle = element.color || '#000000';
          context.font = `${element.fontSize}px Arial`;
          context.fillText(element.text || '', element.x, element.y);
        }
      }
    });

    // Draw current shape being created
    if (currentShape && shapeStartPoint) {
      drawShape(context, currentShape, shapeStartPoint.x, shapeStartPoint.y, 
        mousePosition.x, mousePosition.y, { strokeColor, fillColor, lineWidth });
    }

    // Draw selection rectangle
    if (selectionRect && isSelecting) {
      context.save();
      context.strokeStyle = '#007bff';
      context.lineWidth = 1;
      context.setLineDash([5, 5]);
      context.strokeRect(
        selectionRect.startX,
        selectionRect.startY,
        selectionRect.endX - selectionRect.startX,
        selectionRect.endY - selectionRect.startY
      );
      context.restore();
    }

    // Canvas dimensions (bottom right)
    const dimText = `${context.canvas.width}x${context.canvas.height}`;
    context.fillStyle = '#888888'; context.font = '10px Arial';
    const textWidth = context.measureText(dimText).width;
    context.fillText(dimText, context.canvas.width - textWidth - 5, context.canvas.height - 5);

    // Mouse coordinates (bottom left)
    const coordText = `x: ${mousePosition.x}, y: ${mousePosition.y}`;
    context.fillStyle = '#888888'; context.font = '10px Arial';
    context.fillText(coordText, 5, context.canvas.height - 5);
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
  }, [elements, isResizingCanvas, editingElementId, selectedElements, currentShape, mousePosition, shapeStartPoint, selectionRect, isSelecting]);

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
      } else if (element.type === 'text') {
        const ctx = contextRef.current;
        ctx.font = `${element.fontSize}px Arial`;
        const textWidth = ctx.measureText(element.text).width;
        if (
          x >= element.x && x <= element.x + textWidth &&
          y >= element.y - element.fontSize && y <= element.y
        ) {
          return element;
        }
      } else if (element.type === 'rectangle') {
        if (
          x >= element.x && x <= element.x + element.width &&
          y >= element.y && y <= element.y + element.height
        ) {
          return element;
        }
      } else if (element.type === 'circle') {
        const distance = Math.sqrt(Math.pow(x - element.x, 2) + Math.pow(y - element.y, 2));
        if (distance <= element.radius) {
          return element;
        }
      } else if (element.type === 'line' || element.type === 'arrow') {
        // Simple proximity check for lines
        const distToStart = Math.sqrt(Math.pow(x - element.x, 2) + Math.pow(y - element.y, 2));
        const distToEnd = Math.sqrt(Math.pow(x - element.endX, 2) + Math.pow(y - element.endY, 2));
        const lineLength = Math.sqrt(Math.pow(element.endX - element.x, 2) + Math.pow(element.endY - element.y, 2));
        if (distToStart + distToEnd <= lineLength + 5) { // 5px tolerance
          return element;
        }
      }
    }
    return null;
  };

  const getElementsInRect = (rect) => {
    const { startX, startY, endX, endY } = rect;
    const left = Math.min(startX, endX);
    const right = Math.max(startX, endX);
    const top = Math.min(startY, endY);
    const bottom = Math.max(startY, endY);

    return elements.filter(element => {
      if (element.type === 'sticky') {
        return element.x >= left && element.x + STICKY_NOTE_WIDTH <= right &&
               element.y >= top && element.y + STICKY_NOTE_HEIGHT <= bottom;
      } else if (element.type === 'rectangle') {
        return element.x >= left && element.x + element.width <= right &&
               element.y >= top && element.y + element.height <= bottom;
      } else if (element.type === 'circle') {
        return element.x - element.radius >= left && element.x + element.radius <= right &&
               element.y - element.radius >= top && element.y + element.radius <= bottom;
      } else if (element.type === 'text') {
        const ctx = contextRef.current;
        ctx.font = `${element.fontSize}px Arial`;
        const textWidth = ctx.measureText(element.text).width;
        return element.x >= left && element.x + textWidth <= right &&
               element.y - element.fontSize >= top && element.y <= bottom;
      }
      // TODO: Add line/arrow selection logic
      return false;
    });
  };

  const handleMouseDown = (event) => {
    event.preventDefault();
    if (editingElementId) return; 

    const { x, y } = getMousePosition(event);
    const context = contextRef.current;

    if (selectedTool === 'select') {
      const clickedElement = getElementAtPosition(x, y);
      
      if (clickedElement) {
        if (event.shiftKey && !selectedElements.includes(clickedElement.id)) {
          setSelectedElements([...selectedElements, clickedElement.id]);
        } else if (!selectedElements.includes(clickedElement.id)) {
          setSelectedElements([clickedElement.id]);
        }
        
        // Store initial positions for all selected elements
        const selectedElems = elements.filter(el => 
          selectedElements.includes(el.id) || el.id === clickedElement.id
        );
        
        setDraggingElement({
          ids: selectedElements.includes(clickedElement.id) ? selectedElements : [clickedElement.id],
          offsetX: x,
          offsetY: y,
          initialPositions: selectedElems.map(el => ({
            id: el.id,
            x: el.x,
            y: el.y,
            endX: el.endX,
            endY: el.endY
          }))
        });
      } else {
        // Start selection rectangle
        setIsSelecting(true);
        setSelectionRect({ startX: x, startY: y, endX: x, endY: y });
        if (!event.shiftKey) {
          setSelectedElements([]);
        }
      }
    } else if (selectedTool === 'pen' || selectedTool === 'eraser') {
      setSelectedElements([]);
      setIsDrawing(true);
      setCurrentPath([{ x, y }]);
      context.globalCompositeOperation = selectedTool === 'eraser' ? 'destination-out' : 'source-over';
      context.strokeStyle = selectedTool === 'eraser' ? 'rgba(0,0,0,1)' : strokeColor;
      context.lineWidth = selectedTool === 'eraser' ? lineWidth * 1.5 : lineWidth;
      context.lineCap = 'round';
      context.lineJoin = 'round';
      context.beginPath(); 
      context.moveTo(x, y);
    } else if (['rectangle', 'circle', 'line', 'arrow'].includes(selectedTool)) {
      setSelectedElements([]);
      setShapeStartPoint({ x, y });
      setCurrentShape(selectedTool);
    } else if (selectedTool === 'text') {
      setSelectedElements([]);
      const newTextId = Date.now();
      const newText = {
        type: 'text',
        x,
        y,
        text: '',
        color: strokeColor,
        fontSize: fontSize,
        id: newTextId
      };
      onDrawingOrElementComplete(newText);
      setTimeout(() => {
        activateTextEditing(newText);
      }, 0);
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
      } else if (clickedElement && clickedElement.type === 'text') {
        activateTextEditing(clickedElement);
      } else {
        canvasRef.current._lastClickedId = null; 
      }
    }
  };

  const handleMouseMove = (event) => {
    event.preventDefault();
    const { x, y } = getMousePosition(event);
    const context = contextRef.current;

    if (editingElementId) return;

    if (isDrawing && (selectedTool === 'pen' || selectedTool === 'eraser')) {
      context.lineTo(x, y); 
      context.stroke();
      setCurrentPath(prev => [...prev, { x, y }]);
    } else if (draggingElement) {
      if (draggingElement.ids && draggingElement.initialPositions) {
        // Multi-element drag with proper offset
        const deltaX = x - draggingElement.offsetX;
        const deltaY = y - draggingElement.offsetY;
        
        const tempElements = elements.map(el => {
          const initialPos = draggingElement.initialPositions.find(pos => pos.id === el.id);
          if (initialPos) {
            if (el.type === 'line' || el.type === 'arrow') {
              return { 
                ...el, 
                x: initialPos.x + deltaX, 
                y: initialPos.y + deltaY,
                endX: initialPos.endX + deltaX,
                endY: initialPos.endY + deltaY
              };
            } else {
              return { ...el, x: initialPos.x + deltaX, y: initialPos.y + deltaY };
            }
          }
          return el;
        });
        
        // Redraw with temp elements
        context.clearRect(0, 0, context.canvas.width, context.canvas.height);
        context.fillStyle = '#ffffff';
        context.fillRect(0, 0, context.canvas.width, context.canvas.height);
        
        // Draw all elements with temporary positions
        tempElements.forEach(element => {
          // Redraw logic (simplified - copy from redrawAll)
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
          } else if (element.type === 'rectangle') {
            context.strokeStyle = element.strokeColor;
            context.fillStyle = element.fillColor;
            context.lineWidth = element.lineWidth;
            context.beginPath();
            context.rect(element.x, element.y, element.width, element.height);
            if (element.fillColor !== 'transparent') context.fill();
            context.stroke();
          } else if (element.type === 'circle') {
            context.strokeStyle = element.strokeColor;
            context.fillStyle = element.fillColor;
            context.lineWidth = element.lineWidth;
            context.beginPath();
            context.arc(element.x, element.y, element.radius, 0, 2 * Math.PI);
            if (element.fillColor !== 'transparent') context.fill();
            context.stroke();
          } else if (element.type === 'line' || element.type === 'arrow') {
            drawShape(context, element.type, element.x, element.y, element.endX, element.endY, {
              strokeColor: element.strokeColor,
              fillColor: element.fillColor,
              lineWidth: element.lineWidth
            });
          }
          // Add other element types as needed
        });
      } else {
        // Single element drag (sticky note)
        const newX = x - draggingElement.offsetX;
        const newY = y - draggingElement.offsetY;
        const tempElements = elements.map(el =>
          el.id === draggingElement.id ? { ...el, x: newX, y: newY } : el
        );
        redrawAll(contextRef.current);
      }
    } else if (isSelecting && selectionRect) {
      setSelectionRect({ ...selectionRect, endX: x, endY: y });
    }
  };

  const handleMouseUp = (event) => {
    event.preventDefault();
    const { x, y } = getMousePosition(event);

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
      if (draggingElement.ids && draggingElement.initialPositions) {
        // Multi-element drag - save final positions
        const deltaX = x - draggingElement.offsetX;
        const deltaY = y - draggingElement.offsetY;
        
        updateElementsAndHistory(prevElements =>
          prevElements.map(el => {
            const initialPos = draggingElement.initialPositions.find(pos => pos.id === el.id);
            if (initialPos) {
              if (el.type === 'line' || el.type === 'arrow') {
                return { 
                  ...el, 
                  x: initialPos.x + deltaX, 
                  y: initialPos.y + deltaY,
                  endX: initialPos.endX + deltaX,
                  endY: initialPos.endY + deltaY
                };
              } else {
                return { ...el, x: initialPos.x + deltaX, y: initialPos.y + deltaY };
              }
            }
            return el;
          })
        );
      } else {
        // Single element drag
        const finalX = x - draggingElement.offsetX;
        const finalY = y - draggingElement.offsetY;

        updateElementsAndHistory(prevElements =>
            prevElements.map(el =>
                el.id === draggingElement.id ? { ...el, x: finalX, y: finalY } : el
            )
        );
      }
      setDraggingElement(null);
    } else if (currentShape && shapeStartPoint) {
      // Only create shape if mouse has moved from start point
      const distance = Math.sqrt(Math.pow(x - shapeStartPoint.x, 2) + Math.pow(y - shapeStartPoint.y, 2));
      if (distance > 2) { // Minimum 2px movement to create shape
        let newElement = {
          type: currentShape,
          strokeColor,
          fillColor,
          lineWidth,
          id: Date.now()
        };

        if (currentShape === 'rectangle') {
          newElement.x = Math.min(shapeStartPoint.x, x);
          newElement.y = Math.min(shapeStartPoint.y, y);
          newElement.width = Math.abs(x - shapeStartPoint.x);
          newElement.height = Math.abs(y - shapeStartPoint.y);
        } else if (currentShape === 'circle') {
          newElement.x = shapeStartPoint.x;
          newElement.y = shapeStartPoint.y;
          newElement.radius = Math.sqrt(Math.pow(x - shapeStartPoint.x, 2) + Math.pow(y - shapeStartPoint.y, 2));
        } else if (currentShape === 'line' || currentShape === 'arrow') {
          newElement.x = shapeStartPoint.x;
          newElement.y = shapeStartPoint.y;
          newElement.endX = x;
          newElement.endY = y;
        }

        onDrawingOrElementComplete(newElement);
      }
      setShapeStartPoint(null);
      setCurrentShape(null);
    } else if (isSelecting && selectionRect) {
      const selectedInRect = getElementsInRect(selectionRect);
      if (selectedInRect.length > 0) {
        const newSelectedIds = selectedInRect.map(el => el.id);
        if (event.shiftKey) {
          setSelectedElements([...new Set([...selectedElements, ...newSelectedIds])]);
        } else {
          setSelectedElements(newSelectedIds);
        }
      }
      setIsSelecting(false);
      setSelectionRect(null);
    }
  };

  const handleCanvasClick = (event) => {
    if (editingElementId) return; 
    if (draggingElement) return; 

    const now = Date.now();
    if (canvasRef.current._lastClickTime && (now - canvasRef.current._lastClickTime < 300) && canvasRef.current._lastClickedId) {
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
    else if (selectedTool === 'select') canvasCursor = 'default';
    else if (['rectangle', 'circle', 'line', 'arrow', 'text'].includes(selectedTool)) canvasCursor = 'crosshair';

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Delete' && selectedElements.length > 0 && !editingElementId) {
        updateElementsAndHistory(prevElements => 
          prevElements.filter(el => !selectedElements.includes(el.id))
        );
        setSelectedElements([]);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedElements, editingElementId, updateElementsAndHistory]);

  return (
    <div className="canvas-wrapper"> 
      <canvas
        ref={canvasRef} id="main-canvas" style={{ cursor: canvasCursor }}
        onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp}
        onTouchStart={handleMouseDown} onTouchMove={handleMouseMove} onTouchEnd={handleMouseUp}
        onClick={handleCanvasClick}
      />
    </div>
  );
});

export default Canvas;