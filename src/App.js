// src/App.js
import React, { useState, useCallback, useRef } from 'react';
import './App.css';
// TopMenu is removed, its functionality is merged into Toolbar
import Toolbar from './Toolbar';
import Canvas from './Canvas';

// --- App Name & Slogan ---
const APP_NAME = "EduBoard";
const APP_SLOGAN = "A Jamboard alternative: 100% free to use, no ads, open source. Pull requests welcome!";

function App() {
  const [selectedTool, setSelectedTool] = useState('pen');
  const [strokeColor, setStrokeColor] = useState('#000000');
  const [lineWidth, setLineWidth] = useState(5);

  const [history, setHistory] = useState([[]]); // Array of element arrays
  const [historyStep, setHistoryStep] = useState(0);
  const elements = history[historyStep] || [];

  const canvasRef = useRef(null);

  // State for the active text area (for editing sticky notes)
  const [editingElement, setEditingElement] = useState(null); // { id: 'elementId', text: 'current text' }
  const [textAreaPosition, setTextAreaPosition] = useState({ x: 0, y: 0 });
  const textAreaRef = useRef(null);


  const updateElementsAndHistory = useCallback((newElementsOrUpdater) => {
    setHistory((prevHistory) => {
      const currentElements = prevHistory[historyStep] || [];
      const updatedElements = typeof newElementsOrUpdater === 'function'
        ? newElementsOrUpdater(currentElements)
        : newElementsOrUpdater;

      const newHistorySlice = prevHistory.slice(0, historyStep + 1);
      return [...newHistorySlice, updatedElements];
    });
    setHistoryStep((prevStep) => prevStep + 1);
  }, [historyStep]);


  const handleDrawingOrElementComplete = useCallback((newElement) => {
    updateElementsAndHistory((prevElements) => {
        // If it's a new sticky note, prepare for editing
        if (newElement.type === 'sticky' && !newElement.text) { // New sticky note
            setEditingElement({ id: newElement.id, text: newElement.text || "Note..." });
            // Position textarea slightly offset from canvas element creation point
            // Canvas.js will calculate x,y for the sticky note element itself
            // We need to map that to screen coordinates for the textarea
            // This will be refined when Canvas calls a function to activate editing
        }
        return [...prevElements, newElement];
    });
  }, [updateElementsAndHistory]);

  const activateStickyNoteEditing = useCallback((element, canvasElementRect) => {
    if (element && element.type === 'sticky') {
        setEditingElement({ id: element.id, text: element.text });
        // Position textarea based on the canvas element's bounding box
        // canvasElementRect should be { top, left, width, height } from getBoundingClientRect()
        // This needs to be relative to the viewport
        const canvasGlobalRect = canvasRef.current?.getCanvasGlobalRect();
        if (canvasGlobalRect && canvasElementRect) {
            setTextAreaPosition({
                x: canvasGlobalRect.left + element.x, // element.x is canvas-relative
                y: canvasGlobalRect.top + element.y,  // element.y is canvas-relative
            });
        }

        // Focus the textarea after a short delay to ensure it's rendered
        setTimeout(() => {
            textAreaRef.current?.focus();
            textAreaRef.current?.select();
        }, 0);
    }
  }, []);

  const handleTextAreaBlur = useCallback(() => {
    if (editingElement) {
      updateElementsAndHistory((prevElements) =>
        prevElements.map((el) =>
          el.id === editingElement.id ? { ...el, text: editingElement.text } : el
        )
      );
      setEditingElement(null); // Stop editing
    }
  }, [editingElement, updateElementsAndHistory]);

  const handleTextAreaChange = (event) => {
    if (editingElement) {
      setEditingElement((prev) => ({ ...prev, text: event.target.value }));
    }
  };
  
  const handleTextAreaKeyDown = (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault(); // Prevent new line in textarea
        handleTextAreaBlur();   // Save and close
    }
    if (event.key === 'Escape') {
        event.preventDefault();
        setEditingElement(null); // Cancel editing without saving current textarea changes
    }
  };


  const handleUndo = () => historyStep > 0 && setHistoryStep(historyStep - 1);
  const handleRedo = () => historyStep < history.length - 1 && setHistoryStep(historyStep + 1);
  const handleClearFrame = () => updateElementsAndHistory([]);
  const handleDownloadPNG = () => canvasRef.current?.downloadAsPNG();

  return (
    <div className="App">
      <header className="app-header">
        <h1 className="app-title">{APP_NAME}</h1>
        <p className="app-slogan">{APP_SLOGAN}</p>
      </header>
      <div className="main-content-wrapper">
        <Toolbar
          selectedTool={selectedTool}
          setSelectedTool={setSelectedTool}
          strokeColor={strokeColor}
          setStrokeColor={setStrokeColor}
          lineWidth={lineWidth}
          setLineWidth={setLineWidth}
          onUndo={handleUndo}
          onRedo={handleRedo}
          onClearFrame={handleClearFrame}
          canUndo={historyStep > 0}
          canRedo={historyStep < history.length - 1}
          onDownloadPNG={handleDownloadPNG}
        />
        <Canvas
          ref={canvasRef}
          selectedTool={selectedTool}
          strokeColor={strokeColor}
          lineWidth={lineWidth}
          elements={elements}
          onDrawingOrElementComplete={handleDrawingOrElementComplete}
          updateElementsAndHistory={updateElementsAndHistory} // For dragging
          editingElementId={editingElement?.id}
          activateStickyNoteEditing={activateStickyNoteEditing}
        />
      </div>

      {editingElement && (
        <textarea
          ref={textAreaRef}
          className="sticky-note-textarea"
          style={{
            position: 'absolute',
            top: `${textAreaPosition.y}px`,
            left: `${textAreaPosition.x}px`,
            // Dimensions should match the sticky note drawing on canvas
            width: '150px', // Must match canvas drawing
            height: '100px', // Must match canvas drawing
          }}
          value={editingElement.text}
          onChange={handleTextAreaChange}
          onBlur={handleTextAreaBlur}
          onKeyDown={handleTextAreaKeyDown}
        />
      )}
    </div>
  );
}

export default App;