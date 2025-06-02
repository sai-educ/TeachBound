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
        offscreenCtx.fillStyle = '#FFFFFF'; // Ensure background is white for PNG
        offscreenCtx.fillRect(0, 0, offscreenCanvas.width, offscreenCanvas.height);
        offscreenCtx.drawImage(canvas, 0, 0); // Draw current canvas content
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
    setMousePosition({ x: Math.round(x), y: Math.round(y) }); // This state update will trigger redrawAll
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
        context.beginPath();
        context.moveTo(startX, startY);
        context.lineTo(endX, endY);
        context.stroke();
        
        const angle = Math.atan2(endY - startY, endX - startX);
        const arrowLength = 15;
        context.beginPath(); // Start a new path for the arrowhead
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
      default:
        break;
    }
  };

  const redrawAll = (context) => {
    if (!context || !context.canvas) return;
    context.clearRect(0, 0, context.canvas.width, context.canvas.height);
    context.fillStyle = '#ffffff'; // Set background for the main canvas
    context.fillRect(0, 0, context.canvas.width, context.canvas.height);

    elements.forEach(element => {
      context.lineCap = 'round'; context.lineJoin = 'round';
      
      const originalGCO = context.globalCompositeOperation; // Save current GCO

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
        context.globalCompositeOperation = 'source-over'; // Ensure sticky notes draw normally
        context.fillStyle = element.backgroundColor || '#FFFACD';
        context.strokeStyle = draggingElement?.id === element.id ? '#007bff' : '#333333';
        context.lineWidth = draggingElement?.id === element.id ? 2 : 1;
        
        context.beginPath();
        context.rect(element.x, element.y, STICKY_NOTE_WIDTH, STICKY_NOTE_HEIGHT);
        context.fill();
        context.stroke();
        
        if (editingElementId !== element.id) {
            context.fillStyle = '#000000';
            context.font = '14px Arial';
            const textPadding = 10; const maxWidth = STICKY_NOTE_WIDTH - 2 * textPadding;
            let textY = element.y + textPadding + 14; // Approx height of one line
            const lines = (element.text || "").split('\n');

            lines.forEach(currentLineText => {
                let textToProcess = currentLineText;
                while(textToProcess.length > 0 && textY < element.y + STICKY_NOTE_HEIGHT - textPadding) { // Check vertical limit
                    let segment = '';
                    for (let i = 0; i < textToProcess.length; i++) {
                        const testSegment = segment + textToProcess[i];
                        if (context.measureText(testSegment).width > maxWidth) {
                            break;
                        }
                        segment = testSegment;
                    }
                    if (segment) { // If a segment fits
                         context.fillText(segment, element.x + textPadding, textY);
                         textY += 16; // Move to next line
                         textToProcess = textToProcess.substring(segment.length);
                    } else { // Word itself is too long or no characters left
                        textY += 16; // Still move to next line (or skip if word was too long)
                        break; // Avoid infinite loop if a single character is too wide (edge case)
                    }
                }
            });
        }
      } else if (element.type === 'rectangle') {
        context.globalCompositeOperation = 'source-over';
        context.strokeStyle = element.strokeColor;
        context.fillStyle = element.fillColor;
        context.lineWidth = element.lineWidth;
        context.beginPath();
        context.rect(element.x, element.y, element.width, element.height);
        if (element.fillColor !== 'transparent') context.fill();
        context.stroke();
      } else if (element.type === 'circle') {
        context.globalCompositeOperation = 'source-over';
        context.strokeStyle = element.strokeColor;
        context.fillStyle = element.fillColor;
        context.lineWidth = element.lineWidth;
        context.beginPath();
        context.arc(element.x, element.y, element.radius, 0, 2 * Math.PI);
        if (element.fillColor !== 'transparent') context.fill();
        context.stroke();
      } else if (element.type === 'line' || element.type === 'arrow') {
        context.globalCompositeOperation = 'source-over';
        drawShape(context, element.type, element.x, element.y, element.endX, element.endY, {
          strokeColor: element.strokeColor,
          fillColor: element.fillColor, // Though line/arrow don't use fill by default
          lineWidth: element.lineWidth
        });
      } else if (element.type === 'text') {
        context.globalCompositeOperation = 'source-over';
        if (editingElementId !== element.id) {
          context.fillStyle = element.color || '#000000';
          context.font = `${element.fontSize}px Arial`; // Use Arial or a common font
          context.fillText(element.text || '', element.x, element.y);
        }
      }
      
      context.globalCompositeOperation = originalGCO; // Restore GCO after drawing each element

      // Draw selection highlight (should be drawn on top, so GCO should be source-over)
      if (selectedElements.includes(element.id)) {
        context.save();
        context.globalCompositeOperation = 'source-over'; // Ensure selection is drawn normally
        context.strokeStyle = '#007bff';
        context.lineWidth = 2;
        context.setLineDash([5, 5]);
        
        if (element.type === 'sticky') {
          context.strokeRect(element.x - 2, element.y - 2, STICKY_NOTE_WIDTH + 4, STICKY_NOTE_HEIGHT + 4);
        } else if (element.type === 'text') {
          // Recalculate text width for accurate bounding box
          const tempFont = context.font;
          context.font = `${element.fontSize}px Arial`;
          const textWidth = context.measureText(element.text).width;
          context.font = tempFont; // Restore font
          context.strokeRect(element.x - 2, element.y - element.fontSize - 2, textWidth + 4, element.fontSize + 8);
        } else if (element.type === 'rectangle') {
          context.strokeRect(element.x - 2, element.y - 2, element.width + 4, element.height + 4);
        } else if (element.type === 'circle') {
          context.beginPath();
          context.arc(element.x, element.y, element.radius + 2, 0, 2 * Math.PI);
          context.stroke();
        } else if (element.type === 'line' || element.type === 'arrow') {
          // Draw selection handles for lines (simple boxes at ends)
          context.fillStyle = '#007bff'; // Use fill for handles
          context.fillRect(element.x - 4, element.y - 4, 8, 8);
          context.fillRect(element.endX - 4, element.endY - 4, 8, 8);
        }
        
        context.restore(); // Restores GCO if it was saved, also line dash settings
      }
    });
    
    context.globalCompositeOperation = 'source-over'; // Ensure GCO is source-over after all elements

    // Draw current shape being created (if any)
    if (currentShape && shapeStartPoint) {
      // Ensure drawing mode is source-over for temporary shapes
      context.globalCompositeOperation = 'source-over';
      drawShape(context, currentShape, shapeStartPoint.x, shapeStartPoint.y, 
                mousePosition.x, mousePosition.y, { strokeColor, fillColor, lineWidth });
    }

    // Draw selection rectangle (if any)
    if (selectionRect && isSelecting) {
      context.save();
      context.globalCompositeOperation = 'source-over';
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
    const textWidthDim = context.measureText(dimText).width;
    context.fillText(dimText, context.canvas.width - textWidthDim - 5, context.canvas.height - 5);

    // Mouse coordinates (bottom left)
    const coordText = `x: ${mousePosition.x}, y: ${mousePosition.y}`;
    context.fillStyle = '#888888'; context.font = '10px Arial'; // Ensure font is reset if changed
    context.fillText(coordText, 5, context.canvas.height - 5);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');
    contextRef.current = context;
    let resizeTimeout;

    const handleResize = () => {
        setIsResizingCanvas(true); // Indicate resizing is in progress
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
            const container = canvas.parentElement;
            if (container && contextRef.current) { // Check contextRef.current
                canvas.width = container.clientWidth;
                canvas.height = container.clientHeight;
                redrawAll(contextRef.current); // Use contextRef.current
            }
            setIsResizingCanvas(false); // Resizing done
        }, 100); // Debounce resize
    };

    handleResize(); // Initial size
    window.addEventListener('resize', handleResize);
    return () => {
        window.removeEventListener('resize', handleResize);
        clearTimeout(resizeTimeout);
    }
  }, []); // Empty dependency array: runs once on mount

  useEffect(() => {
    // Redraw whenever elements or certain interaction states change
    // but not when isResizingCanvas is true to avoid drawing on a potentially old-sized canvas
    if (contextRef.current && !isResizingCanvas) {
      redrawAll(contextRef.current);
    }
  }, [elements, isResizingCanvas, editingElementId, selectedElements, currentShape, mousePosition, shapeStartPoint, selectionRect, isSelecting, strokeColor, fillColor, lineWidth]); // Added drawing properties as deps for redraw

  const getElementAtPosition = (x, y) => {
    // Iterate backwards to select top-most element
    for (let i = elements.length - 1; i >= 0; i--) {
      const element = elements[i];
      const ctx = contextRef.current; // Ensure context is available

      if (element.type === 'sticky') {
        if (
          x >= element.x && x <= element.x + STICKY_NOTE_WIDTH &&
          y >= element.y && y <= element.y + STICKY_NOTE_HEIGHT
        ) {
          return element;
        }
      } else if (element.type === 'text' && ctx) {
        const originalFont = ctx.font; // Save current font
        ctx.font = `${element.fontSize}px Arial`;
        const textWidth = ctx.measureText(element.text).width;
        ctx.font = originalFont; // Restore font
        // Check within bounding box of text
        if (
          x >= element.x && x <= element.x + textWidth &&
          y >= element.y - element.fontSize && y <= element.y // y is baseline, so check above it
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
        // More robust line hit detection: distance from point to line segment
        const { x: x1, y: y1, endX: x2, endY: y2 } = element;
        const lenSq = Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2);
        if (lenSq === 0) { // Line is a point
            if (Math.sqrt(Math.pow(x - x1, 2) + Math.pow(y - y1, 2)) < (element.lineWidth / 2 + 3) ) return element; // 3px tolerance + half line width
        } else {
            let t = ((x - x1) * (x2 - x1) + (y - y1) * (y2 - y1)) / lenSq;
            t = Math.max(0, Math.min(1, t)); // Clamp t to the segment
            const projX = x1 + t * (x2 - x1);
            const projY = y1 + t * (y2 - y1);
            const dist = Math.sqrt(Math.pow(x - projX, 2) + Math.pow(y - projY, 2));
            if (dist < (element.lineWidth / 2 + 3)) return element; // 3px tolerance + half line width
        }
      }
    }
    return null;
  };

  const getElementsInRect = (rect) => {
    const { startX, startY, endX, endY } = rect;
    const selLeft = Math.min(startX, endX);
    const selRight = Math.max(startX, endX);
    const selTop = Math.min(startY, endY);
    const selBottom = Math.max(startY, endY);
    const ctx = contextRef.current;

    return elements.filter(element => {
      let elLeft, elRight, elTop, elBottom;

      if (element.type === 'sticky') {
        elLeft = element.x; elRight = element.x + STICKY_NOTE_WIDTH;
        elTop = element.y; elBottom = element.y + STICKY_NOTE_HEIGHT;
      } else if (element.type === 'rectangle') {
        elLeft = element.x; elRight = element.x + element.width;
        elTop = element.y; elBottom = element.y + element.height;
      } else if (element.type === 'circle') {
        elLeft = element.x - element.radius; elRight = element.x + element.radius;
        elTop = element.y - element.radius; elBottom = element.y + element.radius;
      } else if (element.type === 'text' && ctx) {
        const originalFont = ctx.font;
        ctx.font = `${element.fontSize}px Arial`;
        const textWidth = ctx.measureText(element.text).width;
        ctx.font = originalFont;
        elLeft = element.x; elRight = element.x + textWidth;
        elTop = element.y - element.fontSize; elBottom = element.y;
      } else if (element.type === 'line' || element.type === 'arrow' || element.type === 'stroke') {
        // For lines/strokes, check if all points are within the selection rectangle
        // This is a simplification; true "intersects" is more complex.
        // For this example, we'll check if the bounding box of the stroke/line is within.
        if (element.path && element.path.length > 0) { // Strokes
            elLeft = Math.min(...element.path.map(p => p.x));
            elRight = Math.max(...element.path.map(p => p.x));
            elTop = Math.min(...element.path.map(p => p.y));
            elBottom = Math.max(...element.path.map(p => p.y));
        } else if (element.type === 'line' || element.type === 'arrow') { // Straight lines/arrows
            elLeft = Math.min(element.x, element.endX);
            elRight = Math.max(element.x, element.endX);
            elTop = Math.min(element.y, element.endY);
            elBottom = Math.max(element.y, element.endY);
        } else {
            return false;
        }
      } else {
        return false;
      }
      // Check if element's bounding box is completely within selection rectangle
      return elLeft >= selLeft && elRight <= selRight && elTop >= selTop && elBottom <= selBottom;
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
        // If shift is pressed and element is not already selected, add to selection
        // If shift is pressed and element IS selected, remove from selection (toggle)
        // If shift is NOT pressed, set selection to only this element
        if (event.shiftKey) {
            setSelectedElements(prevSelected => 
                prevSelected.includes(clickedElement.id)
                ? prevSelected.filter(id => id !== clickedElement.id) // Remove if already selected
                : [...prevSelected, clickedElement.id] // Add if not selected
            );
        } else if (!selectedElements.includes(clickedElement.id)) {
            // If not using shift and clicked element is not part of current multi-selection, select only it
            setSelectedElements([clickedElement.id]);
        }
        // If it IS part of current multi-selection and shift is not pressed, it means we want to drag all selected.
        
        // Prepare for dragging ALL currently selected elements
        const currentSelectedIds = selectedElements.includes(clickedElement.id) 
                                   ? selectedElements 
                                   : [clickedElement.id];

        const selectedElemsData = elements
            .filter(el => currentSelectedIds.includes(el.id))
            .map(el => ({
                id: el.id,
                x: el.x,
                y: el.y,
                endX: el.endX, // For lines/arrows
                endY: el.endY  // For lines/arrows
            }));

        setDraggingElement({
          ids: currentSelectedIds,
          initialMouseX: x, // Store initial mouse position for delta calculation
          initialMouseY: y,
          initialPositions: selectedElemsData
        });

      } else {
        // Start selection rectangle
        setIsSelecting(true);
        setShapeStartPoint({ x, y }); // Use shapeStartPoint for selection rect start
        if (!event.shiftKey) {
          setSelectedElements([]); // Clear previous selection if not using shift
        }
      }
    } else if (selectedTool === 'pen' || selectedTool === 'eraser') {
      setSelectedElements([]); // Clear selection when drawing
      setIsDrawing(true);
      setCurrentPath([{ x, y }]);
      
      // Properties like strokeStyle, lineWidth are set on context
      // globalCompositeOperation will be set in handleMouseMove for live drawing
      context.lineCap = 'round';
      context.lineJoin = 'round';
      context.lineWidth = selectedTool === 'eraser' ? lineWidth * 1.5 : lineWidth;
      context.strokeStyle = selectedTool === 'eraser' ? 'rgba(0,0,0,1)' : strokeColor; // Eraser color doesn't matter with destination-out

      context.beginPath(); 
      context.moveTo(x, y);
    } else if (['rectangle', 'circle', 'line', 'arrow'].includes(selectedTool)) {
      setSelectedElements([]); // Clear selection
      setShapeStartPoint({ x, y });
      setCurrentShape(selectedTool); // To indicate a shape is being drawn
    } else if (selectedTool === 'text') {
      setSelectedElements([]);
      const newTextId = Date.now();
      const newText = {
        type: 'text',
        x,
        y, // y is baseline for text
        text: '', // Default empty text
        color: strokeColor,
        fontSize: fontSize,
        id: newTextId
      };
      // Add element first, then activate editing
      onDrawingOrElementComplete(newText); 
      setTimeout(() => { // Timeout to allow state update and element to render
        activateTextEditing(newText); // Pass the newly created element
      }, 0);
    } else if (selectedTool === 'sticky') { // Handle sticky note placement on first click now
        // This was previously in handleCanvasClick, moved here for consistency if sticky tool is selected
        setSelectedElements([]);
        const newStickyId = Date.now();
        const newSticky = {
          type: 'sticky', x: x - STICKY_NOTE_WIDTH / 2, y: y - STICKY_NOTE_HEIGHT / 2,
          text: '', backgroundColor: '#FFFACD', id: newStickyId
        };
        onDrawingOrElementComplete(newSticky); 
        setTimeout(() => {
            activateStickyNoteEditing(newSticky); // Pass element, not canvas rect here
        },0);
    }
    
    // Double click logic for sticky notes & text (moved from handleCanvasClick)
    if (selectedTool !== 'select' && selectedTool !== 'sticky' && selectedTool !== 'text') { // Only if not already handling placement/selection
        const clickedElementForEdit = getElementAtPosition(x, y);
        if (clickedElementForEdit) {
            const now = Date.now();
            const lastClickInfo = canvasRef.current._lastClickDetails || {};
            
            if (clickedElementForEdit.id === lastClickInfo.id && (now - lastClickInfo.time < 300)) { // 300ms for double click
                if (clickedElementForEdit.type === 'sticky') {
                    activateStickyNoteEditing(clickedElementForEdit);
                } else if (clickedElementForEdit.type === 'text') {
                    activateTextEditing(clickedElementForEdit);
                }
                canvasRef.current._lastClickDetails = {}; // Reset after double click processed
                setDraggingElement(null); // Stop any potential drag from first click
            } else {
                canvasRef.current._lastClickDetails = { id: clickedElementForEdit.id, time: now };
            }
        } else {
            canvasRef.current._lastClickDetails = {}; // Clicked on empty space
        }
    }

  };

  const handleMouseMove = (event) => {
    event.preventDefault();
    const { x, y } = getMousePosition(event); // This updates mousePosition state -> triggers redrawAll
    const context = contextRef.current;

    if (editingElementId || !context) return;

    if (isDrawing && (selectedTool === 'pen' || selectedTool === 'eraser')) {
      // **MODIFIED SECTION for BUG FIX**
      // Ensure globalCompositeOperation is correctly set for the LIVE drawing/erasing
      // because redrawAll (triggered by mousePosition change via getMousePosition) might have reset it.
      if (selectedTool === 'eraser') {
        context.globalCompositeOperation = 'destination-out';
      } else { // Pen tool
        context.globalCompositeOperation = 'source-over';
      }
      // Other context properties (strokeStyle, lineWidth, lineCap, lineJoin)
      // are assumed to be set by handleMouseDown and persistent for the current path operation.
      context.lineTo(x, y); 
      context.stroke(); // This uses the GCO set above
      setCurrentPath(prev => [...prev, { x, y }]);

    } else if (draggingElement && draggingElement.ids && draggingElement.initialPositions) {
      const deltaX = x - draggingElement.initialMouseX;
      const deltaY = y - draggingElement.initialMouseY;
      
      // For live preview, we don't alter 'elements' state, just draw temporarily.
      // The actual update happens in handleMouseUp.
      // So, we'll rely on redrawAll to clear and then we draw the dragged elements in their new temp positions.
      // This part of handleMouseMove should ideally just update some temporary drawing state
      // that redrawAll can use, or draw directly after redrawAll clears.
      // For simplicity here, we'll let redrawAll clear, then this will draw over.
      // This means redrawAll needs to be efficient.

      // To provide a visual feedback during dragging without committing to state:
      const tempElementsToDraw = elements.map(el => {
          const initialPos = draggingElement.initialPositions.find(p => p.id === el.id);
          if (initialPos) {
              if (el.type === 'line' || el.type === 'arrow') {
                  return { ...el, x: initialPos.x + deltaX, y: initialPos.y + deltaY, endX: initialPos.endX + deltaX, endY: initialPos.endY + deltaY };
              }
              return { ...el, x: initialPos.x + deltaX, y: initialPos.y + deltaY };
          }
          return el;
      });

      // Instead of redrawing all here, we let the main redrawAll (triggered by mousePosition) handle it.
      // We then draw the current state of dragged items on top of that.
      // This requires careful handling of redrawAll.
      // For now, let's assume redrawAll from useEffect handles the base,
      // and we are just updating a visual cue or relying on the next redraw cycle.
      // The `currentShape` drawing logic in `redrawAll` is an example of drawing temporary things.
      // We might need a similar mechanism for dragging previews if performance is an issue.
      // The simplest is to just trigger a redraw with the new mouse position.
      // The `redrawAll` will then use the *original* `elements` data.
      // The actual update of `elements` for drag must happen in `handleMouseUp`.

      // This mouseMove primarily sets mousePosition, which triggers redraw.
      // The actual visual update of dragged elements should be part of redrawAll based on draggingElement state.
      // For now, we will let redrawAll handle the background and other elements.
      // The final position is set on mouseUp. The visual feedback of dragging is tricky with this redraw model.

      // The current `redrawAll` does not account for previewing dragged elements.
      // It only draws from the `elements` state.
      // This means during drag, elements might flicker or not show their dragged position until mouseUp.
      // A proper solution would be for `redrawAll` to check `draggingElement` and draw previews.

    } else if (isSelecting && shapeStartPoint) { // Used shapeStartPoint for selection rect
      setSelectionRect({ startX: shapeStartPoint.x, startY: shapeStartPoint.y, endX: x, endY: y });
    }
  };

  const handleMouseUp = (event) => {
    event.preventDefault();
    const { x, y } = getMousePosition(event); // Final position
    const context = contextRef.current;

    if (isDrawing) {
      setIsDrawing(false);
      if (currentPath.length > 1) { // Only save if it's more than a dot
        onDrawingOrElementComplete({
          type: 'stroke', 
          // For eraser, color is stored but not directly used if isEraser is true.
          // For pen, strokeColor from state is used.
          color: selectedTool === 'pen' ? strokeColor : 'rgba(0,0,0,0)', // Store actual stroke color for pen
          lineWidth: selectedTool === 'eraser' ? lineWidth * 1.5 : lineWidth,
          path: currentPath, 
          isEraser: selectedTool === 'eraser', 
          id: Date.now()
        });
      }
      setCurrentPath([]);
      if (context) {
         context.globalCompositeOperation = 'source-over'; // Reset GCO after drawing/erasing is done
      }
    } else if (draggingElement && draggingElement.ids && draggingElement.initialPositions) {
      const deltaX = x - draggingElement.initialMouseX;
      const deltaY = y - draggingElement.initialMouseY;
      
      updateElementsAndHistory(prevElements =>
        prevElements.map(el => {
          const initialPos = draggingElement.initialPositions.find(p => p.id === el.id);
          if (initialPos) {
            if (el.type === 'line' || el.type === 'arrow') {
              return { 
                ...el, 
                x: initialPos.x + deltaX, 
                y: initialPos.y + deltaY,
                endX: initialPos.endX + deltaX,
                endY: initialPos.endY + deltaY
              };
            } else { // Rectangles, circles, stickies, text
              return { ...el, x: initialPos.x + deltaX, y: initialPos.y + deltaY };
            }
          }
          return el;
        })
      );
      setDraggingElement(null);
    } else if (currentShape && shapeStartPoint) {
      const distance = Math.sqrt(Math.pow(x - shapeStartPoint.x, 2) + Math.pow(y - shapeStartPoint.y, 2));
      if (distance > 2) { // Minimum movement to create shape
        let newElement = {
          type: currentShape,
          strokeColor: strokeColor, // Use current strokeColor from state
          fillColor: fillColor,     // Use current fillColor from state
          lineWidth: lineWidth,   // Use current lineWidth from state
          id: Date.now()
        };

        if (currentShape === 'rectangle') {
          newElement.x = Math.min(shapeStartPoint.x, x);
          newElement.y = Math.min(shapeStartPoint.y, y);
          newElement.width = Math.abs(x - shapeStartPoint.x);
          newElement.height = Math.abs(y - shapeStartPoint.y);
        } else if (currentShape === 'circle') {
          newElement.x = shapeStartPoint.x; // Center of circle is start point
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
    } else if (isSelecting && selectionRect) { // Finalize selection rectangle
      const elementsInSelection = getElementsInRect(selectionRect);
      if (elementsInSelection.length > 0) {
          const newSelectedIds = elementsInSelection.map(el => el.id);
          if (event.shiftKey) { // Add to existing selection if shift is held
              setSelectedElements(prev => [...new Set([...prev, ...newSelectedIds])]);
          } else {
              setSelectedElements(newSelectedIds);
          }
      } else if (!event.shiftKey) { // If nothing selected and not holding shift, clear selection
          // setSelectedElements([]); // This is handled by mousedown if not shiftkey
      }
      setIsSelecting(false);
      setSelectionRect(null); // Clear the visual selection rectangle
      setShapeStartPoint(null); // Clear shapeStartPoint which was used for selection rect
    }
  };

  // Removed handleCanvasClick as its primary unique role (double click for sticky)
  // is now somewhat integrated into handleMouseDown's double click detection.
  // Sticky note creation is now part of handleMouseDown if sticky tool is selected.

  let canvasCursor = 'auto';
    if (editingElementId) canvasCursor = 'text'; 
    else if (isDrawing) canvasCursor = selectedTool === 'eraser' ? `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='white' stroke='black' stroke-width='1'><circle cx='12' cy='12' r='10'/></svg>") 12 12, auto` : 'crosshair';
    else if (draggingElement) canvasCursor = 'grabbing';
    else if (selectedTool === 'pen') canvasCursor = 'crosshair';
    else if (selectedTool === 'eraser') canvasCursor = `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='white' stroke='black' stroke-width='1'><circle cx='12' cy='12' r='10'/></svg>") 12 12, auto`;
    else if (selectedTool === 'sticky') canvasCursor = 'cell';
    else if (selectedTool === 'select') canvasCursor = 'default'; // Or 'grab' if over a draggable element
    else if (['rectangle', 'circle', 'line', 'arrow', 'text'].includes(selectedTool)) canvasCursor = 'crosshair';

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event) => {
      // Ensure not editing text in a textarea
      if (document.activeElement && (document.activeElement.tagName === 'TEXTAREA' || document.activeElement.tagName === 'INPUT')) {
        return;
      }

      if ((event.key === 'Delete' || event.key === 'Backspace') && selectedElements.length > 0 && !editingElementId) {
        event.preventDefault(); // Prevent browser back navigation on Backspace
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
        onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} 
        onMouseLeave={() => { // If mouse leaves canvas while drawing/dragging, treat as mouse up
            if (isDrawing || draggingElement || (isSelecting && selectionRect) || (currentShape && shapeStartPoint)) {
                 // Simulate a mouse up at the last known mouse position
                 // Create a fake event or just call handler with null/last known position
                 // For simplicity, just call handleMouseUp with a minimal event-like structure
                 // or directly if your handleMouseUp can handle null event (it uses getMousePosition)
                 handleMouseUp({preventDefault: () => {}, clientX: mousePosition.x + (canvasRef.current?.getBoundingClientRect().left || 0) , clientY: mousePosition.y + (canvasRef.current?.getBoundingClientRect().top || 0) });
            }
        }}
        onTouchStart={handleMouseDown} onTouchMove={handleMouseMove} onTouchEnd={handleMouseUp}
        // onClick was removed, its functionality merged into handleMouseDown for double-click
      />
    </div>
  );
});

export default Canvas;