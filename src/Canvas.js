// src/Canvas.js
import React, { useRef, useEffect, useState, useImperativeHandle, forwardRef } from 'react';
import './Canvas.css';

const STICKY_NOTE_WIDTH = 150;
const STICKY_NOTE_HEIGHT = 100;

const Canvas = forwardRef(({
  selectedTool, strokeColor, fillColor, lineWidth, fontSize, elements,
  onDrawingOrElementComplete,
  updateElementsAndHistory,
  editingElementId,
  activateStickyNoteEditing,
  activateTextEditing
}, ref) => {
  const canvasRef = useRef(null);
  const contextRef = useRef(null);

  const [isDrawing, setIsDrawing] = useState(false);
  const [currentPath, setCurrentPath] = useState([]); // Holds points for the current live stroke

  const [draggingElement, setDraggingElement] = useState(null);
  const [isResizingCanvas, setIsResizingCanvas] = useState(false);

  const [shapeStartPoint, setShapeStartPoint] = useState(null);
  const [currentShape, setCurrentShape] = useState(null);

  const [selectedElements, setSelectedElements] = useState([]);
  const [selectionRect, setSelectionRect] = useState(null);
  const [isSelecting, setIsSelecting] = useState(false);

  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

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
    getCanvasGlobalRect: () => canvasRef.current?.getBoundingClientRect(),
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
    const newMousePos = { x: Math.round(x), y: Math.round(y) };
    setMousePosition(newMousePos);
    return newMousePos;
  };

  const drawShape = (context, type, startX, startY, endX, endY, options = {}) => {
    context.strokeStyle = options.strokeColor || strokeColor;
    context.fillStyle = options.fillColor || fillColor;
    context.lineWidth = options.lineWidth || lineWidth;
    context.lineCap = 'round';
    context.lineJoin = 'round';
    
    const originalGCO = context.globalCompositeOperation;
    context.globalCompositeOperation = 'source-over';

    switch (type) {
      case 'rectangle':
        context.beginPath();
        context.rect(startX, startY, endX - startX, endY - startY);
        if (options.fillColor && options.fillColor !== 'transparent') context.fill();
        context.stroke();
        break;
      case 'circle':
        const radius = Math.sqrt(Math.pow(endX - startX, 2) + Math.pow(endY - startY, 2));
        context.beginPath();
        context.arc(startX, startY, radius, 0, 2 * Math.PI);
        if (options.fillColor && options.fillColor !== 'transparent') context.fill();
        context.stroke();
        break;
      case 'line':
        context.beginPath();
        context.moveTo(startX, startY);
        context.lineTo(endX, endY);
        context.stroke();
        break;
      case 'arrow':
        context.beginPath();
        context.moveTo(startX, startY);
        context.lineTo(endX, endY);
        context.stroke();
        const angle = Math.atan2(endY - startY, endX - startX);
        const arrowLength = Math.min(20, Math.max(10, options.lineWidth * 3));
        context.beginPath();
        context.moveTo(endX, endY);
        context.lineTo(endX - arrowLength * Math.cos(angle - Math.PI / 6), endY - arrowLength * Math.sin(angle - Math.PI / 6));
        context.moveTo(endX, endY);
        context.lineTo(endX - arrowLength * Math.cos(angle + Math.PI / 6), endY - arrowLength * Math.sin(angle + Math.PI / 6));
        context.stroke();
        break;
      default: break;
    }
    context.globalCompositeOperation = originalGCO;
  };

  const redrawAll = (context) => {
    if (!context || !context.canvas) return;
    
    const GCO_backup_main = context.globalCompositeOperation;
    context.globalCompositeOperation = 'source-over';
    context.clearRect(0, 0, context.canvas.width, context.canvas.height);
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, context.canvas.width, context.canvas.height);
    context.globalCompositeOperation = GCO_backup_main;

    elements.forEach(element => {
      const originalGCO = context.globalCompositeOperation;
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
      } else if (element.type === 'sticky') {
        context.globalCompositeOperation = 'source-over';
        context.fillStyle = element.backgroundColor || '#FFFACD';
        context.strokeStyle = '#333333';
        context.lineWidth = 1;
        context.beginPath();
        context.rect(element.x, element.y, STICKY_NOTE_WIDTH, STICKY_NOTE_HEIGHT);
        context.fill(); context.stroke();
        if (editingElementId !== element.id) {
          context.fillStyle = '#000000'; context.font = '14px Arial';
          const textPadding = 10; const maxWidth = STICKY_NOTE_WIDTH - 2 * textPadding;
          let textY = element.y + textPadding + 14;
          const lines = (element.text || "").split('\n');
          lines.forEach(currentLineText => {
            let textToProcess = currentLineText;
            while (textToProcess.length > 0 && textY < element.y + STICKY_NOTE_HEIGHT - textPadding) {
              let segment = '';
              for (let i = 0; i < textToProcess.length; i++) {
                const testSegment = segment + textToProcess[i];
                if (context.measureText(testSegment).width > maxWidth) break;
                segment = testSegment;
              }
              if (segment) {
                context.fillText(segment, element.x + textPadding, textY);
                textY += 16;
                textToProcess = textToProcess.substring(segment.length);
              } else { textY += 16; break; }
            }
          });
        }
      } else if (element.type === 'rectangle' || element.type === 'circle' || element.type === 'line' || element.type === 'arrow') {
        context.globalCompositeOperation = 'source-over';
        drawShape(context, element.type, element.x, element.y, 
                  element.type === 'rectangle' ? element.x + element.width : element.endX,
                  element.type === 'rectangle' ? element.y + element.height : element.endY,
                  { strokeColor: element.strokeColor, fillColor: element.fillColor, lineWidth: element.lineWidth, radius: element.radius });
      } else if (element.type === 'text') {
        context.globalCompositeOperation = 'source-over';
        if (editingElementId !== element.id) {
          context.fillStyle = element.color || '#000000';
          context.font = `${element.fontSize}px Arial`;
          context.fillText(element.text || '', element.x, element.y);
        }
      }
      context.globalCompositeOperation = originalGCO; 

      if (selectedElements.includes(element.id)) {
        context.save();
        context.globalCompositeOperation = 'source-over';
        context.strokeStyle = '#007bff'; context.lineWidth = 2; context.setLineDash([5, 5]);
        if (element.type === 'sticky') {
          context.strokeRect(element.x - 2, element.y - 2, STICKY_NOTE_WIDTH + 4, STICKY_NOTE_HEIGHT + 4);
        } else if (element.type === 'text') {
          const tempFont = context.font; context.font = `${element.fontSize}px Arial`;
          const textWidth = context.measureText(element.text).width; context.font = tempFont;
          context.strokeRect(element.x - 2, element.y - element.fontSize - 2, textWidth + 4, element.fontSize + 8);
        } else if (element.type === 'rectangle') {
          context.strokeRect(element.x - 2, element.y - 2, element.width + 4, element.height + 4);
        } else if (element.type === 'circle') {
          context.beginPath(); context.arc(element.x, element.y, element.radius + 2, 0, 2 * Math.PI); context.stroke();
        } else if (element.type === 'line' || element.type === 'arrow') {
          context.fillStyle = '#007bff';
          context.fillRect(element.x - 4, element.y - 4, 8, 8);
          context.fillRect(element.endX - 4, element.endY - 4, 8, 8);
        }
        context.restore();
      }
    });
    
    context.globalCompositeOperation = 'source-over'; // Ensure GCO is source-over for previews

    // Draw current live stroke (pen/eraser)
    if (isDrawing && (selectedTool === 'pen' || selectedTool === 'eraser') && currentPath.length > 0) {
      const originalGCO = context.globalCompositeOperation;
      context.globalCompositeOperation = selectedTool === 'eraser' ? 'destination-out' : 'source-over';
      context.strokeStyle = selectedTool === 'eraser' ? 'rgba(0,0,0,1)' : strokeColor;
      context.lineWidth = selectedTool === 'eraser' ? lineWidth * 1.5 : lineWidth;
      context.lineCap = 'round';
      context.lineJoin = 'round';

      context.beginPath();
      currentPath.forEach((point, index) => {
        if (index === 0) {
          context.moveTo(point.x, point.y);
        } else {
          context.lineTo(point.x, point.y);
        }
      });
      context.stroke();
      context.globalCompositeOperation = originalGCO;
    }

    // Draw current live shape (rectangle, circle, etc.)
    if (currentShape && shapeStartPoint) {
      // drawShape handles its own GCO internally if needed, but default to source-over here
      const GCO_shape_preview = context.globalCompositeOperation;
      context.globalCompositeOperation = 'source-over';
      drawShape(context, currentShape, shapeStartPoint.x, shapeStartPoint.y, mousePosition.x, mousePosition.y, { strokeColor, fillColor, lineWidth });
      context.globalCompositeOperation = GCO_shape_preview;
    }

    // Draw selection rectangle
    if (selectionRect && isSelecting) {
      context.save();
      context.globalCompositeOperation = 'source-over';
      context.strokeStyle = '#007bff'; context.lineWidth = 1; context.setLineDash([5, 5]);
      context.strokeRect(selectionRect.startX, selectionRect.startY, selectionRect.endX - selectionRect.startX, selectionRect.endY - selectionRect.startY);
      context.restore();
    }

    // Draw canvas dimensions and mouse coordinates
    const dimText = `${context.canvas.width}x${context.canvas.height}`;
    context.fillStyle = '#888888'; context.font = '10px Arial';
    const textWidthDim = context.measureText(dimText).width;
    context.fillText(dimText, context.canvas.width - textWidthDim - 5, context.canvas.height - 5);
    const coordText = `x: ${mousePosition.x}, y: ${mousePosition.y}`;
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
        if (container && contextRef.current) {
          canvas.width = container.clientWidth;
          canvas.height = container.clientHeight;
          // redrawAll will be called by the main useEffect due to isResizingCanvas changing
        }
        setIsResizingCanvas(false); 
      }, 100);
    };
    handleResize(); // Initial resize
    window.addEventListener('resize', handleResize);
    return () => { window.removeEventListener('resize', handleResize); clearTimeout(resizeTimeout); }
  }, []); // Removed redrawAll from here, will be handled by the main effect

  useEffect(() => {
    if (contextRef.current && !isResizingCanvas) {
      redrawAll(contextRef.current);
    }
  }, [
    elements, isResizingCanvas, editingElementId, selectedElements,
    currentShape, mousePosition, shapeStartPoint, selectionRect, isSelecting,
    strokeColor, fillColor, lineWidth, fontSize,
    currentPath, isDrawing, selectedTool // Added for live stroke drawing
  ]);

  const getElementAtPosition = (x, y) => {
    for (let i = elements.length - 1; i >= 0; i--) {
      const el = elements[i]; const ctx = contextRef.current;
      if (el.type === 'sticky' && x >= el.x && x <= el.x + STICKY_NOTE_WIDTH && y >= el.y && y <= el.y + STICKY_NOTE_HEIGHT) return el;
      if (el.type === 'text' && ctx) {
        const originalFont = ctx.font; ctx.font = `${el.fontSize}px Arial`;
        const textWidth = ctx.measureText(el.text).width; ctx.font = originalFont;
        if (x >= el.x && x <= el.x + textWidth && y >= el.y - el.fontSize && y <= el.y) return el;
      }
      if (el.type === 'rectangle' && x >= el.x && x <= el.x + el.width && y >= el.y && y <= el.y + el.height) return el;
      if (el.type === 'circle' && Math.sqrt(Math.pow(x - el.x, 2) + Math.pow(y - el.y, 2)) <= el.radius) return el;
      if (el.type === 'line' || el.type === 'arrow') {
        const { x: x1, y: y1, endX: x2, endY: y2, lineWidth: lw } = el;
        const lenSq = Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2);
        const effectiveLineWidth = (lw / 2 + 3); 
        if (lenSq === 0) { if (Math.sqrt(Math.pow(x - x1, 2) + Math.pow(y - y1, 2)) < effectiveLineWidth) return el; }
        else {
          let t = ((x - x1) * (x2 - x1) + (y - y1) * (y2 - y1)) / lenSq;
          t = Math.max(0, Math.min(1, t));
          const projX = x1 + t * (x2 - x1); const projY = y1 + t * (y2 - y1);
          if (Math.sqrt(Math.pow(x - projX, 2) + Math.pow(y - projY, 2)) < effectiveLineWidth) return el;
        }
      }
    }
    return null;
  };
  
  const getElementsInRect = (rect) => {
    const { startX, startY, endX, endY } = rect;
    const selLeft = Math.min(startX, endX); const selRight = Math.max(startX, endX);
    const selTop = Math.min(startY, endY); const selBottom = Math.max(startY, endY);
    const ctx = contextRef.current;
    return elements.filter(el => {
      let elLeft, elRight, elTop, elBottom;
      if (el.type === 'sticky') { elLeft = el.x; elRight = el.x + STICKY_NOTE_WIDTH; elTop = el.y; elBottom = el.y + STICKY_NOTE_HEIGHT; }
      else if (el.type === 'rectangle') { elLeft = el.x; elRight = el.x + el.width; elTop = el.y; elBottom = el.y + el.height; }
      else if (el.type === 'circle') { elLeft = el.x - el.radius; elRight = el.x + el.radius; elTop = el.y - el.radius; elBottom = el.y + el.radius; }
      else if (el.type === 'text' && ctx) {
        const originalFont = ctx.font; ctx.font = `${el.fontSize}px Arial`;
        const textWidth = ctx.measureText(el.text).width; ctx.font = originalFont;
        elLeft = el.x; elRight = el.x + textWidth; elTop = el.y - el.fontSize; elBottom = el.y;
      } else if (el.type === 'line' || el.type === 'arrow' || el.type === 'stroke') {
        if (el.path && el.path.length > 0) { elLeft = Math.min(...el.path.map(p => p.x)); elRight = Math.max(...el.path.map(p => p.x)); elTop = Math.min(...el.path.map(p => p.y)); elBottom = Math.max(...el.path.map(p => p.y)); }
        else if (el.type === 'line' || el.type === 'arrow') { elLeft = Math.min(el.x, el.endX); elRight = Math.max(el.x, el.endX); elTop = Math.min(el.y, el.endY); elBottom = Math.max(el.y, el.endY); }
        else return false;
      } else return false;
      return elLeft >= selLeft && elRight <= selRight && elTop >= selTop && elBottom <= selBottom;
    });
  };

  const handleMouseDown = (event) => {
    event.preventDefault();
    if (editingElementId) return;
    const { x, y } = getMousePosition(event);

    if (selectedTool === 'pen' || selectedTool === 'eraser') {
      setSelectedElements([]);
      setIsDrawing(true);
      setCurrentPath([{ x, y }]); 
    } else if (selectedTool === 'select') {
      const clickedElement = getElementAtPosition(x, y);
      if (clickedElement) {
        if (event.shiftKey) { setSelectedElements(prev => prev.includes(clickedElement.id) ? prev.filter(id => id !== clickedElement.id) : [...prev, clickedElement.id]); }
        else if (!selectedElements.includes(clickedElement.id)) { setSelectedElements([clickedElement.id]); }
        const currentSelectedIds = selectedElements.includes(clickedElement.id) ? selectedElements : [clickedElement.id];
        const selectedElemsData = elements.filter(el => currentSelectedIds.includes(el.id)).map(el => ({ id: el.id, x: el.x, y: el.y, endX: el.endX, endY: el.endY }));
        setDraggingElement({ ids: currentSelectedIds, initialMouseX: x, initialMouseY: y, initialPositions: selectedElemsData });
      } else {
        setIsSelecting(true); setShapeStartPoint({ x, y }); 
        if (!event.shiftKey) setSelectedElements([]);
      }
    } else if (['rectangle', 'circle', 'line', 'arrow'].includes(selectedTool)) {
      setSelectedElements([]); setShapeStartPoint({ x, y }); setCurrentShape(selectedTool);
    } else if (selectedTool === 'text') {
      setSelectedElements([]); const newTextId = Date.now();
      const newText = { type: 'text', x, y, text: '', color: strokeColor, fontSize, id: newTextId };
      onDrawingOrElementComplete(newText); setTimeout(() => activateTextEditing(newText), 0);
    } else if (selectedTool === 'sticky') {
      setSelectedElements([]); const newStickyId = Date.now();
      const newSticky = { type: 'sticky', x: x - STICKY_NOTE_WIDTH / 2, y: y - STICKY_NOTE_HEIGHT / 2, text: '', backgroundColor: '#FFFACD', id: newStickyId };
      onDrawingOrElementComplete(newSticky); setTimeout(() => activateStickyNoteEditing(newSticky), 0);
    }

    const clickedElementForEdit = getElementAtPosition(x, y);
    if (clickedElementForEdit) {
        const now = Date.now();
        const lastClickInfo = canvasRef.current._lastClickDetails || {};
        if (clickedElementForEdit.id === lastClickInfo.id && (now - lastClickInfo.time < 300)) {
            if (clickedElementForEdit.type === 'sticky') activateStickyNoteEditing(clickedElementForEdit);
            else if (clickedElementForEdit.type === 'text') activateTextEditing(clickedElementForEdit);
            canvasRef.current._lastClickDetails = {}; setDraggingElement(null);
        } else {
            canvasRef.current._lastClickDetails = { id: clickedElementForEdit.id, time: now };
        }
    } else {
        canvasRef.current._lastClickDetails = {};
    }
  };

  const handleMouseMove = (event) => {
    event.preventDefault();
    const { x, y } = getMousePosition(event); // This updates mousePosition state -> triggers redrawAll
    if (editingElementId) return;

    if (isDrawing && (selectedTool === 'pen' || selectedTool === 'eraser')) {
      setCurrentPath(prev => [...prev, { x, y }]); // Update path state -> triggers redrawAll
    } else if (draggingElement && draggingElement.ids && draggingElement.initialPositions) {
      // Visual feedback handled by redrawAll due to mousePosition update
    } else if (isSelecting && shapeStartPoint) {
      setSelectionRect({ startX: shapeStartPoint.x, startY: shapeStartPoint.y, endX: x, endY: y }); // Update state -> triggers redrawAll
    }
  };

  const handleMouseUp = (event) => {
    event.preventDefault();
    const { x, y } = getMousePosition(event); 

    if (isDrawing && (selectedTool === 'pen' || selectedTool === 'eraser')) {
      setIsDrawing(false); // Triggers redrawAll (currentPath will not be drawn as live)
      if (currentPath.length > 1) { 
        onDrawingOrElementComplete({
          type: 'stroke',
          color: selectedTool === 'pen' ? strokeColor : 'rgba(0,0,0,0)', 
          lineWidth: selectedTool === 'eraser' ? lineWidth * 1.5 : lineWidth,
          path: currentPath,
          isEraser: selectedTool === 'eraser',
          id: Date.now()
        });
      }
      setCurrentPath([]); // Triggers redrawAll (currentPath is empty)
    } else if (draggingElement && draggingElement.ids && draggingElement.initialPositions) {
      const deltaX = x - draggingElement.initialMouseX;
      const deltaY = y - draggingElement.initialMouseY;
      updateElementsAndHistory(prevElements =>
        prevElements.map(el => {
          const initialPos = draggingElement.initialPositions.find(p => p.id === el.id);
          if (initialPos) {
            if (el.type === 'line' || el.type === 'arrow') {
              return { ...el, x: initialPos.x + deltaX, y: initialPos.y + deltaY, endX: initialPos.endX + deltaX, endY: initialPos.endY + deltaY };
            }
            return { ...el, x: initialPos.x + deltaX, y: initialPos.y + deltaY };
          }
          return el;
        })
      );
      setDraggingElement(null);
    } else if (currentShape && shapeStartPoint) {
      const distance = Math.sqrt(Math.pow(x - shapeStartPoint.x, 2) + Math.pow(y - shapeStartPoint.y, 2));
      if (distance > 2) {
        let newElement = { type: currentShape, strokeColor, fillColor, lineWidth, id: Date.now() };
        if (currentShape === 'rectangle') { newElement = {...newElement, x: Math.min(shapeStartPoint.x, x), y: Math.min(shapeStartPoint.y, y), width: Math.abs(x - shapeStartPoint.x), height: Math.abs(y - shapeStartPoint.y) };}
        else if (currentShape === 'circle') { newElement = {...newElement, x: shapeStartPoint.x, y: shapeStartPoint.y, radius: distance };}
        else if (currentShape === 'line' || currentShape === 'arrow') { newElement = {...newElement, x: shapeStartPoint.x, y: shapeStartPoint.y, endX: x, endY: y };}
        onDrawingOrElementComplete(newElement);
      }
      setShapeStartPoint(null); setCurrentShape(null);
    } else if (isSelecting && selectionRect) {
      const elementsInSelection = getElementsInRect(selectionRect);
      if (elementsInSelection.length > 0) {
        const newSelectedIds = elementsInSelection.map(el => el.id);
        if (event.shiftKey || (event.touches && event.touches.length > 1)) { setSelectedElements(prev => [...new Set([...prev, ...newSelectedIds])]); }
        else { setSelectedElements(newSelectedIds); }
      } else if (!(event.shiftKey || (event.touches && event.touches.length > 1))) {
        // setSelectedElements([]); // Already handled in mousedown if no shift
      }
      setIsSelecting(false); setSelectionRect(null); setShapeStartPoint(null);
    }
  };

  let canvasCursor = 'auto';
  if (editingElementId) canvasCursor = 'text';
  else if (isDrawing && (selectedTool === 'pen' || selectedTool === 'eraser')) canvasCursor = 'crosshair';
  else if (draggingElement) canvasCursor = 'grabbing';
  else if (selectedTool === 'pen') canvasCursor = 'crosshair';
  else if (selectedTool === 'eraser') canvasCursor = `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='white' stroke='black' stroke-width='1'><circle cx='12' cy='12' r='10'/></svg>") 12 12, auto`;
  else if (selectedTool === 'sticky') canvasCursor = 'cell';
  else if (selectedTool === 'select') canvasCursor = 'default';
  else if (['rectangle', 'circle', 'line', 'arrow', 'text'].includes(selectedTool)) canvasCursor = 'crosshair';

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (document.activeElement && (document.activeElement.tagName === 'TEXTAREA' || document.activeElement.tagName === 'INPUT')) return;
      if ((event.key === 'Delete' || event.key === 'Backspace') && selectedElements.length > 0 && !editingElementId) {
        event.preventDefault();
        updateElementsAndHistory(prevElements => prevElements.filter(el => !selectedElements.includes(el.id)));
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
        onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp}
        onMouseLeave={(event) => { // Pass event to handleMouseUp
            if (isDrawing || draggingElement || isSelecting || currentShape) {
                 handleMouseUp({ 
                    preventDefault: () => {}, 
                    clientX: mousePosition.x + (canvasRef.current?.getBoundingClientRect().left || 0), 
                    clientY: mousePosition.y + (canvasRef.current?.getBoundingClientRect().top || 0),
                    touches: event.touches // Pass original touches if available
                });
            }
        }}
        onTouchStart={handleMouseDown} onTouchMove={handleMouseMove} onTouchEnd={handleMouseUp}
      />
    </div>
  );
});

export default Canvas;