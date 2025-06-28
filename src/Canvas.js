// src/Canvas.js
import React, { useRef, useEffect, useState, useImperativeHandle, forwardRef } from 'react';
import './Canvas.css';

const STICKY_NOTE_WIDTH = 150;
const STICKY_NOTE_HEIGHT = 100;

const Canvas = forwardRef(({
  selectedTool, strokeColor, fillColor, lineWidth, fontSize, stickyNoteColor, elements,
  onDrawingOrElementComplete,
  updateElementsAndHistory,
  editingElementId,
  activateStickyNoteEditing,
  activateTextEditing
}, ref) => {
  const canvasRef = useRef(null);
  const contextRef = useRef(null);
  const devicePixelRatioRef = useRef(1);

  const [isDrawing, setIsDrawing] = useState(false);
  const [currentPath, setCurrentPath] = useState([]);

  const [draggingElement, setDraggingElement] = useState(null);
  const [isResizingCanvas, setIsResizingCanvas] = useState(false);

  const [shapeStartPoint, setShapeStartPoint] = useState(null);
  const [currentShape, setCurrentShape] = useState(null);

  const [selectedElements, setSelectedElements] = useState([]);
  const [selectionRect, setSelectionRect] = useState(null);
  const [isSelecting, setIsSelecting] = useState(false);

  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

  // High-resolution canvas setup
  const setupHighResCanvas = (canvas, context) => {
    const rect = canvas.getBoundingClientRect();
    const devicePixelRatio = window.devicePixelRatio || 1;
    devicePixelRatioRef.current = devicePixelRatio;
    
    // Set the actual size in memory (scaled up for high DPI)
    canvas.width = rect.width * devicePixelRatio;
    canvas.height = rect.height * devicePixelRatio;
    
    // Scale the canvas back down using CSS
    canvas.style.width = rect.width + 'px';
    canvas.style.height = rect.height + 'px';
    
    // Scale the drawing context so everything draws at the correct size
    context.scale(devicePixelRatio, devicePixelRatio);
    
    // Set context properties for crisp rendering
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    context.textBaseline = 'top';
    context.textAlign = 'left';
    context.lineCap = 'round';
    context.lineJoin = 'round';
    
    return devicePixelRatio;
  };

  useImperativeHandle(ref, () => ({
    downloadAsPNG: (scale = 1) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      
      const rect = canvas.getBoundingClientRect();
      const exportScale = scale * (window.devicePixelRatio || 1);
      
      // Create high-resolution offscreen canvas
      const offscreenCanvas = document.createElement('canvas');
      offscreenCanvas.width = rect.width * exportScale;
      offscreenCanvas.height = rect.height * exportScale;
      
      const offscreenCtx = offscreenCanvas.getContext('2d');
      offscreenCtx.scale(exportScale, exportScale);
      
      // Set high-quality rendering properties
      offscreenCtx.imageSmoothingEnabled = true;
      offscreenCtx.imageSmoothingQuality = 'high';
      offscreenCtx.textBaseline = 'top';
      offscreenCtx.textAlign = 'left';
      offscreenCtx.lineCap = 'round';
      offscreenCtx.lineJoin = 'round';
      
      // Fill with white background
      offscreenCtx.fillStyle = '#FFFFFF';
      offscreenCtx.fillRect(0, 0, rect.width, rect.height);
      
      // Redraw all elements at high resolution
      redrawAllElements(offscreenCtx, rect.width, rect.height, true);
      
      // Download the image
      offscreenCanvas.toBlob((blob) => {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `teachbound-whiteboard-${scale}x.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }, 'image/png', 1.0);
    },
    
    downloadAsPDF: () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      
      // Create a new window for printing
      const printWindow = window.open('', '_blank');
      const rect = canvas.getBoundingClientRect();
      
      // Create high-resolution canvas for PDF
      const pdfCanvas = document.createElement('canvas');
      const pdfScale = 2; // High resolution for PDF
      pdfCanvas.width = rect.width * pdfScale;
      pdfCanvas.height = rect.height * pdfScale;
      
      const pdfCtx = pdfCanvas.getContext('2d');
      pdfCtx.scale(pdfScale, pdfScale);
      
      // Set high-quality rendering properties
      pdfCtx.imageSmoothingEnabled = true;
      pdfCtx.imageSmoothingQuality = 'high';
      pdfCtx.textBaseline = 'top';
      pdfCtx.textAlign = 'left';
      pdfCtx.lineCap = 'round';
      pdfCtx.lineJoin = 'round';
      
      // Fill with white background
      pdfCtx.fillStyle = '#FFFFFF';
      pdfCtx.fillRect(0, 0, rect.width, rect.height);
      
      // Redraw all elements
      redrawAllElements(pdfCtx, rect.width, rect.height, true);
      
      // Get the image data
      const imageDataUrl = pdfCanvas.toDataURL('image/png', 1.0);
      
      // Create HTML content for PDF printing
      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Teach Bound Whiteboard</title>
          <style>
            @page {
              margin: 0;
              size: A4 landscape;
            }
            body {
              margin: 0;
              padding: 0;
              display: flex;
              justify-content: center;
              align-items: center;
              min-height: 100vh;
              background: white;
            }
            img {
              max-width: 100%;
              max-height: 100vh;
              object-fit: contain;
            }
            @media print {
              body {
                background: white;
              }
              img {
                max-width: 100%;
                max-height: 100vh;
                page-break-inside: avoid;
              }
            }
          </style>
        </head>
        <body>
          <img src="${imageDataUrl}" alt="Teach Bound Whiteboard" />
          <script>
            window.onload = function() {
              setTimeout(() => {
                window.print();
                setTimeout(() => {
                  window.close();
                }, 1000);
              }, 500);
            };
          </script>
        </body>
        </html>
      `;
      
      // Write content to new window and trigger print
      printWindow.document.write(htmlContent);
      printWindow.document.close();
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
    
    const originalGCO = context.globalCompositeOperation;
    context.globalCompositeOperation = 'source-over';

    context.beginPath();
    
    switch (type) {
      case 'rectangle':
        const rectWidth = endX - startX;
        const rectHeight = endY - startY;
        context.rect(startX, startY, rectWidth, rectHeight);
        if (options.fillColor && options.fillColor !== 'transparent') {
          context.fill();
        }
        context.stroke();
        break;
        
      case 'circle':
        const radius = Math.sqrt(Math.pow(endX - startX, 2) + Math.pow(endY - startY, 2));
        context.arc(startX, startY, radius, 0, 2 * Math.PI);
        if (options.fillColor && options.fillColor !== 'transparent') {
          context.fill();
        }
        context.stroke();
        break;
        
      case 'line':
        context.moveTo(startX, startY);
        context.lineTo(endX, endY);
        context.stroke();
        break;
        
      case 'arrow':
        // Draw the main line
        context.moveTo(startX, startY);
        context.lineTo(endX, endY);
        context.stroke();
        
        // Draw arrowhead
        const angle = Math.atan2(endY - startY, endX - startX);
        const arrowLength = Math.min(25, Math.max(15, (options.lineWidth || lineWidth) * 3));
        const arrowAngle = Math.PI / 6; // 30 degrees
        
        context.beginPath();
        context.moveTo(endX, endY);
        context.lineTo(
          endX - arrowLength * Math.cos(angle - arrowAngle),
          endY - arrowLength * Math.sin(angle - arrowAngle)
        );
        context.moveTo(endX, endY);
        context.lineTo(
          endX - arrowLength * Math.cos(angle + arrowAngle),
          endY - arrowLength * Math.sin(angle + arrowAngle)
        );
        context.stroke();
        break;
        
      default: 
        break;
    }
    
    context.globalCompositeOperation = originalGCO;
  };

  const drawText = (context, text, x, y, font, color, isExport = false) => {
    if (!text || (editingElementId && !isExport)) return;
    
    context.fillStyle = color || '#000000';
    context.font = font || `${fontSize}px "Open Sans", Arial, sans-serif`;
    
    // Handle multi-line text
    const lines = text.split('\n');
    const lineHeight = parseInt(font || fontSize) * 1.2;
    
    lines.forEach((line, index) => {
      context.fillText(line, x, y + (index * lineHeight));
    });
  };

  const drawStickyNote = (context, element, isExport = false) => {
    const { x, y, text, backgroundColor, id } = element;
    const noteColor = backgroundColor || stickyNoteColor;
    
    // Draw sticky note background
    context.fillStyle = noteColor;
    context.strokeStyle = '#333333';
    context.lineWidth = 1;
    
    context.beginPath();
    context.roundRect(x, y, STICKY_NOTE_WIDTH, STICKY_NOTE_HEIGHT, 4);
    context.fill();
    context.stroke();
    
    // Draw text if not currently editing or if exporting
    if ((editingElementId !== id || isExport) && text) {
      context.fillStyle = '#000000';
      context.font = '14px "Open Sans", Arial, sans-serif';
      
      const textPadding = 10;
      const maxWidth = STICKY_NOTE_WIDTH - 2 * textPadding;
      let textY = y + textPadding + 14;
      
      const lines = text.split('\n');
      
      lines.forEach(currentLineText => {
        let textToProcess = currentLineText;
        while (textToProcess.length > 0 && textY < y + STICKY_NOTE_HEIGHT - textPadding) {
          let segment = '';
          for (let i = 0; i < textToProcess.length; i++) {
            const testSegment = segment + textToProcess[i];
            if (context.measureText(testSegment).width > maxWidth) break;
            segment = testSegment;
          }
          
          if (segment) {
            context.fillText(segment, x + textPadding, textY);
            textY += 16;
            textToProcess = textToProcess.substring(segment.length);
          } else {
            textY += 16;
            break;
          }
        }
      });
    }
  };

  const redrawAllElements = (context, canvasWidth, canvasHeight, isExport = false) => {
    if (!context) return;
    
    elements.forEach(element => {
      const originalGCO = context.globalCompositeOperation;
      
      if (element.type === 'stroke') {
        context.globalCompositeOperation = element.isEraser ? 'destination-out' : 'source-over';
        context.strokeStyle = element.isEraser ? 'rgba(0,0,0,1)' : element.color;
        context.lineWidth = element.lineWidth;
        
        if (element.path && element.path.length > 0) {
          context.beginPath();
          element.path.forEach((point, index) => {
            if (index === 0) {
              context.moveTo(point.x, point.y);
            } else {
              context.lineTo(point.x, point.y);
            }
          });
          context.stroke();
        }
        
      } else if (element.type === 'sticky') {
        context.globalCompositeOperation = 'source-over';
        drawStickyNote(context, element, isExport);
        
      } else if (['rectangle', 'circle', 'line', 'arrow'].includes(element.type)) {
        context.globalCompositeOperation = 'source-over';
        const endX = element.type === 'rectangle' ? element.x + element.width : element.endX;
        const endY = element.type === 'rectangle' ? element.y + element.height : element.endY;
        
        drawShape(context, element.type, element.x, element.y, endX, endY, {
          strokeColor: element.strokeColor,
          fillColor: element.fillColor,
          lineWidth: element.lineWidth,
          radius: element.radius
        });
        
      } else if (element.type === 'text') {
        context.globalCompositeOperation = 'source-over';
        if ((editingElementId !== element.id || isExport) && element.text) {
          drawText(context, element.text, element.x, element.y, 
                  `${element.fontSize}px "Open Sans", Arial, sans-serif`, element.color, isExport);
        }
      }
      
      context.globalCompositeOperation = originalGCO;

      // Draw selection indicators (not for export)
      if (!isExport && selectedElements.includes(element.id)) {
        context.save();
        context.globalCompositeOperation = 'source-over';
        context.strokeStyle = '#007bff';
        context.lineWidth = 2;
        context.setLineDash([5, 5]);
        
        if (element.type === 'sticky') {
          context.strokeRect(element.x - 2, element.y - 2, 
                           STICKY_NOTE_WIDTH + 4, STICKY_NOTE_HEIGHT + 4);
        } else if (element.type === 'text') {
          const tempFont = context.font;
          context.font = `${element.fontSize}px "Open Sans", Arial, sans-serif`;
          const textWidth = context.measureText(element.text || '').width;
          context.font = tempFont;
          context.strokeRect(element.x - 2, element.y - element.fontSize - 2, 
                           textWidth + 4, element.fontSize + 8);
        } else if (element.type === 'rectangle') {
          context.strokeRect(element.x - 2, element.y - 2, 
                           element.width + 4, element.height + 4);
        } else if (element.type === 'circle') {
          context.beginPath();
          context.arc(element.x, element.y, element.radius + 2, 0, 2 * Math.PI);
          context.stroke();
        } else if (element.type === 'line' || element.type === 'arrow') {
          context.fillStyle = '#007bff';
          context.fillRect(element.x - 4, element.y - 4, 8, 8);
          context.fillRect(element.endX - 4, element.endY - 4, 8, 8);
        }
        
        context.restore();
      }
    });
  };

  const redrawAll = (context) => {
    if (!context || !context.canvas) return;
    
    const rect = context.canvas.getBoundingClientRect();
    const canvasWidth = rect.width;
    const canvasHeight = rect.height;
    
    // Clear and set background
    context.save();
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(0, 0, context.canvas.width, context.canvas.height);
    context.restore();
    
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvasWidth, canvasHeight);

    // Draw all elements
    redrawAllElements(context, canvasWidth, canvasHeight, false);

    // Draw current live stroke (pen/eraser)
    if (isDrawing && (selectedTool === 'pen' || selectedTool === 'eraser') && currentPath.length > 0) {
      const originalGCO = context.globalCompositeOperation;
      context.globalCompositeOperation = selectedTool === 'eraser' ? 'destination-out' : 'source-over';
      context.strokeStyle = selectedTool === 'eraser' ? 'rgba(0,0,0,1)' : strokeColor;
      context.lineWidth = selectedTool === 'eraser' ? lineWidth * 1.5 : lineWidth;

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

    // Draw current live shape preview
    if (currentShape && shapeStartPoint) {
      context.save();
      context.globalCompositeOperation = 'source-over';
      drawShape(context, currentShape, shapeStartPoint.x, shapeStartPoint.y, 
               mousePosition.x, mousePosition.y, { strokeColor, fillColor, lineWidth });
      context.restore();
    }

    // Draw selection rectangle
    if (selectionRect && isSelecting) {
      context.save();
      context.globalCompositeOperation = 'source-over';
      context.strokeStyle = '#007bff';
      context.lineWidth = 1;
      context.setLineDash([5, 5]);
      context.strokeRect(
        selectionRect.startX, selectionRect.startY,
        selectionRect.endX - selectionRect.startX,
        selectionRect.endY - selectionRect.startY
      );
      context.restore();
    }

    // Draw canvas info
    context.save();
    context.fillStyle = '#888888';
    context.font = '10px "Open Sans", Arial, sans-serif';
    context.setLineDash([]);
    
    const dimText = `${Math.round(canvasWidth)}x${Math.round(canvasHeight)}`;
    const textWidthDim = context.measureText(dimText).width;
    context.fillText(dimText, canvasWidth - textWidthDim - 5, canvasHeight - 15);
    
    const coordText = `x: ${mousePosition.x}, y: ${mousePosition.y}`;
    context.fillText(coordText, 5, canvasHeight - 15);
    context.restore();
  };

  // Canvas setup and resize handling
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const context = canvas.getContext('2d');
    contextRef.current = context;
    
    let resizeTimeout;
    const handleResize = () => {
      setIsResizingCanvas(true);
      clearTimeout(resizeTimeout);
      
      resizeTimeout = setTimeout(() => {
        const container = canvas.parentElement;
        if (container && contextRef.current) {
          // Update canvas display size
          canvas.style.width = container.clientWidth + 'px';
          canvas.style.height = container.clientHeight + 'px';
          
          // Setup high-resolution canvas
          setupHighResCanvas(canvas, contextRef.current);
        }
        setIsResizingCanvas(false);
      }, 100);
    };
    
    handleResize(); // Initial setup
    window.addEventListener('resize', handleResize);
    
    return () => {
      window.removeEventListener('resize', handleResize);
      clearTimeout(resizeTimeout);
    };
  }, []);

  // Redraw when state changes
  useEffect(() => {
    if (contextRef.current && !isResizingCanvas) {
      redrawAll(contextRef.current);
    }
  }, [
    elements, isResizingCanvas, editingElementId, selectedElements,
    currentShape, mousePosition, shapeStartPoint, selectionRect, isSelecting,
    strokeColor, fillColor, lineWidth, fontSize, stickyNoteColor,
    currentPath, isDrawing, selectedTool
  ]);

  const getElementAtPosition = (x, y) => {
    for (let i = elements.length - 1; i >= 0; i--) {
      const el = elements[i];
      const ctx = contextRef.current;
      
      if (el.type === 'sticky') {
        if (x >= el.x && x <= el.x + STICKY_NOTE_WIDTH && 
            y >= el.y && y <= el.y + STICKY_NOTE_HEIGHT) {
          return el;
        }
      } else if (el.type === 'text' && ctx) {
        const originalFont = ctx.font;
        ctx.font = `${el.fontSize}px "Open Sans", Arial, sans-serif`;
        const textWidth = ctx.measureText(el.text || '').width;
        ctx.font = originalFont;
        
        if (x >= el.x && x <= el.x + textWidth && 
            y >= el.y - el.fontSize && y <= el.y) {
          return el;
        }
      } else if (el.type === 'rectangle') {
        if (x >= el.x && x <= el.x + el.width && 
            y >= el.y && y <= el.y + el.height) {
          return el;
        }
      } else if (el.type === 'circle') {
        const distance = Math.sqrt(Math.pow(x - el.x, 2) + Math.pow(y - el.y, 2));
        if (distance <= el.radius) {
          return el;
        }
      } else if (el.type === 'line' || el.type === 'arrow') {
        const { x: x1, y: y1, endX: x2, endY: y2, lineWidth: lw } = el;
        const lenSq = Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2);
        const effectiveLineWidth = Math.max(lw / 2 + 3, 8);
        
        if (lenSq === 0) {
          if (Math.sqrt(Math.pow(x - x1, 2) + Math.pow(y - y1, 2)) < effectiveLineWidth) {
            return el;
          }
        } else {
          let t = ((x - x1) * (x2 - x1) + (y - y1) * (y2 - y1)) / lenSq;
          t = Math.max(0, Math.min(1, t));
          const projX = x1 + t * (x2 - x1);
          const projY = y1 + t * (y2 - y1);
          
          if (Math.sqrt(Math.pow(x - projX, 2) + Math.pow(y - projY, 2)) < effectiveLineWidth) {
            return el;
          }
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
    
    return elements.filter(el => {
      let elLeft, elRight, elTop, elBottom;
      
      if (el.type === 'sticky') {
        elLeft = el.x;
        elRight = el.x + STICKY_NOTE_WIDTH;
        elTop = el.y;
        elBottom = el.y + STICKY_NOTE_HEIGHT;
      } else if (el.type === 'rectangle') {
        elLeft = el.x;
        elRight = el.x + el.width;
        elTop = el.y;
        elBottom = el.y + el.height;
      } else if (el.type === 'circle') {
        elLeft = el.x - el.radius;
        elRight = el.x + el.radius;
        elTop = el.y - el.radius;
        elBottom = el.y + el.radius;
      } else if (el.type === 'text' && ctx) {
        const originalFont = ctx.font;
        ctx.font = `${el.fontSize}px "Open Sans", Arial, sans-serif`;
        const textWidth = ctx.measureText(el.text || '').width;
        ctx.font = originalFont;
        elLeft = el.x;
        elRight = el.x + textWidth;
        elTop = el.y - el.fontSize;
        elBottom = el.y;
      } else if (el.type === 'line' || el.type === 'arrow' || el.type === 'stroke') {
        if (el.path && el.path.length > 0) {
          elLeft = Math.min(...el.path.map(p => p.x));
          elRight = Math.max(...el.path.map(p => p.x));
          elTop = Math.min(...el.path.map(p => p.y));
          elBottom = Math.max(...el.path.map(p => p.y));
        } else if (el.type === 'line' || el.type === 'arrow') {
          elLeft = Math.min(el.x, el.endX);
          elRight = Math.max(el.x, el.endX);
          elTop = Math.min(el.y, el.endY);
          elBottom = Math.max(el.y, el.endY);
        } else {
          return false;
        }
      } else {
        return false;
      }
      
      return elLeft >= selLeft && elRight <= selRight && 
             elTop >= selTop && elBottom <= selBottom;
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
        if (event.shiftKey) {
          setSelectedElements(prev => 
            prev.includes(clickedElement.id) 
              ? prev.filter(id => id !== clickedElement.id)
              : [...prev, clickedElement.id]
          );
        } else if (!selectedElements.includes(clickedElement.id)) {
          setSelectedElements([clickedElement.id]);
        }
        
        const currentSelectedIds = selectedElements.includes(clickedElement.id) 
          ? selectedElements 
          : [clickedElement.id];
        
        const selectedElemsData = elements
          .filter(el => currentSelectedIds.includes(el.id))
          .map(el => ({
            id: el.id,
            x: el.x,
            y: el.y,
            endX: el.endX,
            endY: el.endY
          }));
          
        setDraggingElement({
          ids: currentSelectedIds,
          initialMouseX: x,
          initialMouseY: y,
          initialPositions: selectedElemsData
        });
      } else {
        setIsSelecting(true);
        setShapeStartPoint({ x, y });
        if (!event.shiftKey) setSelectedElements([]);
      }
      
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
        fontSize,
        id: newTextId
      };
      onDrawingOrElementComplete(newText);
      setTimeout(() => activateTextEditing(newText), 0);
      
    } else if (selectedTool === 'sticky') {
      setSelectedElements([]);
      const newStickyId = Date.now();
      const newSticky = {
        type: 'sticky',
        x: x - STICKY_NOTE_WIDTH / 2,
        y: y - STICKY_NOTE_HEIGHT / 2,
        text: '',
        backgroundColor: stickyNoteColor,
        id: newStickyId
      };
      onDrawingOrElementComplete(newSticky);
      setTimeout(() => activateStickyNoteEditing(newSticky), 0);
    }

    // Double-click detection for editing
    const clickedElementForEdit = getElementAtPosition(x, y);
    if (clickedElementForEdit) {
      const now = Date.now();
      const lastClickInfo = canvasRef.current._lastClickDetails || {};
      
      if (clickedElementForEdit.id === lastClickInfo.id && (now - lastClickInfo.time < 300)) {
        if (clickedElementForEdit.type === 'sticky') {
          activateStickyNoteEditing(clickedElementForEdit);
        } else if (clickedElementForEdit.type === 'text') {
          activateTextEditing(clickedElementForEdit);
        }
        canvasRef.current._lastClickDetails = {};
        setDraggingElement(null);
      } else {
        canvasRef.current._lastClickDetails = { id: clickedElementForEdit.id, time: now };
      }
    } else {
      canvasRef.current._lastClickDetails = {};
    }
  };

  const handleMouseMove = (event) => {
    event.preventDefault();
    const { x, y } = getMousePosition(event);
    if (editingElementId) return;

    if (isDrawing && (selectedTool === 'pen' || selectedTool === 'eraser')) {
      setCurrentPath(prev => [...prev, { x, y }]);
    } else if (isSelecting && shapeStartPoint) {
      setSelectionRect({
        startX: shapeStartPoint.x,
        startY: shapeStartPoint.y,
        endX: x,
        endY: y
      });
    }
  };

  const handleMouseUp = (event) => {
    event.preventDefault();
    const { x, y } = getMousePosition(event);

    if (isDrawing && (selectedTool === 'pen' || selectedTool === 'eraser')) {
      setIsDrawing(false);
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
      setCurrentPath([]);
      
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
            }
            return {
              ...el,
              x: initialPos.x + deltaX,
              y: initialPos.y + deltaY
            };
          }
          return el;
        })
      );
      setDraggingElement(null);
      
    } else if (currentShape && shapeStartPoint) {
      const distance = Math.sqrt(Math.pow(x - shapeStartPoint.x, 2) + Math.pow(y - shapeStartPoint.y, 2));
      
      if (distance > 5) { // Minimum size threshold
        let newElement = {
          type: currentShape,
          strokeColor,
          fillColor,
          lineWidth,
          id: Date.now()
        };
        
        if (currentShape === 'rectangle') {
          newElement = {
            ...newElement,
            x: Math.min(shapeStartPoint.x, x),
            y: Math.min(shapeStartPoint.y, y),
            width: Math.abs(x - shapeStartPoint.x),
            height: Math.abs(y - shapeStartPoint.y)
          };
        } else if (currentShape === 'circle') {
          newElement = {
            ...newElement,
            x: shapeStartPoint.x,
            y: shapeStartPoint.y,
            radius: distance
          };
        } else if (currentShape === 'line' || currentShape === 'arrow') {
          newElement = {
            ...newElement,
            x: shapeStartPoint.x,
            y: shapeStartPoint.y,
            endX: x,
            endY: y
          };
        }
        
        onDrawingOrElementComplete(newElement);
      }
      
      setShapeStartPoint(null);
      setCurrentShape(null);
      
    } else if (isSelecting && selectionRect) {
      const elementsInSelection = getElementsInRect(selectionRect);
      
      if (elementsInSelection.length > 0) {
        const newSelectedIds = elementsInSelection.map(el => el.id);
        if (event.shiftKey || (event.touches && event.touches.length > 1)) {
          setSelectedElements(prev => [...new Set([...prev, ...newSelectedIds])]);
        } else {
          setSelectedElements(newSelectedIds);
        }
      }
      
      setIsSelecting(false);
      setSelectionRect(null);
      setShapeStartPoint(null);
    }
  };

  // Cursor styling
  let canvasCursor = 'auto';
  if (editingElementId) {
    canvasCursor = 'text';
  } else if (isDrawing && (selectedTool === 'pen' || selectedTool === 'eraser')) {
    canvasCursor = 'crosshair';
  } else if (draggingElement) {
    canvasCursor = 'grabbing';
  } else if (selectedTool === 'pen') {
    canvasCursor = 'crosshair';
  } else if (selectedTool === 'eraser') {
    canvasCursor = `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='white' stroke='black' stroke-width='2'><circle cx='12' cy='12' r='8'/></svg>") 12 12, auto`;
  } else if (selectedTool === 'sticky') {
    canvasCursor = 'cell';
  } else if (selectedTool === 'select') {
    canvasCursor = 'default';
  } else if (['rectangle', 'circle', 'line', 'arrow', 'text'].includes(selectedTool)) {
    canvasCursor = 'crosshair';
  }

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (document.activeElement && 
          (document.activeElement.tagName === 'TEXTAREA' || 
           document.activeElement.tagName === 'INPUT')) {
        return;
      }
      
      if ((event.key === 'Delete' || event.key === 'Backspace') && 
          selectedElements.length > 0 && !editingElementId) {
        event.preventDefault();
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
        ref={canvasRef}
        id="main-canvas"
        style={{ cursor: canvasCursor }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={(event) => {
          if (isDrawing || draggingElement || isSelecting || currentShape) {
            handleMouseUp({
              preventDefault: () => {},
              clientX: mousePosition.x + (canvasRef.current?.getBoundingClientRect().left || 0),
              clientY: mousePosition.y + (canvasRef.current?.getBoundingClientRect().top || 0),
              touches: event.touches
            });
          }
        }}
        onTouchStart={handleMouseDown}
        onTouchMove={handleMouseMove}
        onTouchEnd={handleMouseUp}
      />
    </div>
  );
});

export default Canvas;