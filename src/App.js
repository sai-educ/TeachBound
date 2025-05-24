// src/App.js
import React, { useState, useCallback, useRef } from 'react';
import './App.css';
import Toolbar from './Toolbar';
import Canvas from './Canvas';

// --- App Name & Slogan ---
const APP_NAME = "EduBoard";
// The slogan will now be constructed directly in the JSX to include the link

function App() {
  const [selectedTool, setSelectedTool] = useState('pen');
  const [strokeColor, setStrokeColor] = useState('#000000');
  const [lineWidth, setLineWidth] = useState(5);

  const [history, setHistory] = useState([[]]); // Array of element arrays
  const [historyStep, setHistoryStep] = useState(0);
  const elements = history[historyStep] || [];

  const canvasRef = useRef(null);

  const [editingElement, setEditingElement] = useState(null);
  const [textAreaPosition, setTextAreaPosition] = useState({ x: 0, y: 0 });
  const textAreaRef = useRef(null);

  const updateElementsAndHistory = useCallback((newElementsOrUpdater) => {
    setHistory((prevHistory) => {
      const currentElementsState = prevHistory[historyStep] || [];
      const updatedElements = typeof newElementsOrUpdater === 'function'
        ? newElementsOrUpdater(currentElementsState)
        : newElementsOrUpdater;

      const newHistorySlice = prevHistory.slice(0, historyStep + 1);
      return [...newHistorySlice, updatedElements];
    });
    setHistoryStep((prevStep) => prevStep + 1);
  }, [historyStep]); // Removed 'history' from dependencies, as it causes issues with this pattern


  const handleDrawingOrElementComplete = useCallback((newElement) => {
    updateElementsAndHistory((prevElements) => {
        if (newElement.type === 'sticky' && !newElement.text) {
            setEditingElement({ id: newElement.id, text: newElement.text || "Note..." });
        }
        return [...prevElements, newElement];
    });
  }, [updateElementsAndHistory]);

  const activateStickyNoteEditing = useCallback((element) => {
    if (element && element.type === 'sticky') {
        setEditingElement({ id: element.id, text: element.text });
        const canvasGlobalRect = canvasRef.current?.getCanvasGlobalRect();
        if (canvasGlobalRect) {
            setTextAreaPosition({
                x: canvasGlobalRect.left + element.x,
                y: canvasGlobalRect.top + element.y,
            });
        }
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
      setEditingElement(null);
    }
  }, [editingElement, updateElementsAndHistory]);

  const handleTextAreaChange = (event) => {
    if (editingElement) {
      setEditingElement((prev) => ({ ...prev, text: event.target.value }));
    }
  };
  
  const handleTextAreaKeyDown = (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        handleTextAreaBlur();
    }
    if (event.key === 'Escape') {
        event.preventDefault();
        setEditingElement(null);
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
        {/* Updated slogan rendering to include a link */}
        <p className="app-slogan">
          A Jamboard alternative: 100% free to use, no ads, open source.{" "}
          <a 
            href="https://github.com/sai-educ/EduBoard" 
            target="_blank" 
            rel="noopener noreferrer"
            className="slogan-link"
          >
            Pull requests welcome!
          </a>
        </p>
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
          updateElementsAndHistory={updateElementsAndHistory}
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
            width: '150px', 
            height: '100px',
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