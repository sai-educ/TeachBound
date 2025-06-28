// src/App.js
import React, { useState, useCallback, useRef } from 'react';
import './App.css';
import Toolbar from './Toolbar';
import Canvas from './Canvas';

// --- App Name & Slogan ---
const APP_NAME = "Teach Bound";
const APP_SUBTITLE = "Digital White Board";

function App() {
  const [selectedTool, setSelectedTool] = useState('pen');
  const [strokeColor, setStrokeColor] = useState('#000000');
  const [fillColor, setFillColor] = useState('transparent');
  const [lineWidth, setLineWidth] = useState(5);
  const [fontSize, setFontSize] = useState(16);
  const [stickyNoteColor, setStickyNoteColor] = useState('#FFFACD'); // Default yellow
  const [toolbarDisplayMode, setToolbarDisplayMode] = useState('icons'); // 'icons', 'icons-text', 'text'

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
  }, [historyStep]);

  const handleDrawingOrElementComplete = useCallback((newElement) => {
    updateElementsAndHistory((prevElements) => {
        if (newElement.type === 'sticky' && !newElement.text) {
            setEditingElement({ id: newElement.id, text: newElement.text || "Note..." });
        }
        if (newElement.type === 'text' && !newElement.text) {
            setEditingElement({ id: newElement.id, text: newElement.text || "", isText: true });
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

  const activateTextEditing = useCallback((element) => {
    if (element && element.type === 'text') {
        setEditingElement({ id: element.id, text: element.text, isText: true });
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
  
  const handleClearFrame = () => {
    const confirmed = window.confirm("Are you sure you want to clear the canvas? This action cannot be undone.");
    if (confirmed) {
      setHistory([[]]);
      setHistoryStep(0);
    }
  };
  
  const handleDownloadPNG = (scale = 1) => canvasRef.current?.downloadAsPNG(scale);
  const handleDownloadPDF = () => canvasRef.current?.downloadAsPDF();

  const handleDeleteSelected = useCallback(() => {
    canvasRef.current?.deleteSelectedElements();
  }, []);

  return (
    <div className="App">
      <header className="app-header">
        <div className="app-title-container">
          <h1 className="app-title">{APP_NAME}</h1>
          <span className="app-subtitle">{APP_SUBTITLE}</span>
        </div>
        <p className="app-slogan">
          <a href="https://github.com/sai-educ/TeachBound" target="_blank" rel="noopener noreferrer">Open source</a>, ad-free, and 100% free to use.
        </p>
      </header>
      <div className="main-content-wrapper">
        <Toolbar
          selectedTool={selectedTool}
          setSelectedTool={setSelectedTool}
          strokeColor={strokeColor}
          setStrokeColor={setStrokeColor}
          fillColor={fillColor}
          setFillColor={setFillColor}
          lineWidth={lineWidth}
          setLineWidth={setLineWidth}
          fontSize={fontSize}
          setFontSize={setFontSize}
          stickyNoteColor={stickyNoteColor}
          setStickyNoteColor={setStickyNoteColor}
          toolbarDisplayMode={toolbarDisplayMode}
          setToolbarDisplayMode={setToolbarDisplayMode}
          onUndo={handleUndo}
          onRedo={handleRedo}
          onClearFrame={handleClearFrame}
          canUndo={historyStep > 0}
          canRedo={historyStep < history.length - 1}
          onDownloadPNG={handleDownloadPNG}
          onDownloadPDF={handleDownloadPDF}
          onDeleteSelected={handleDeleteSelected}
        />
        <Canvas
          ref={canvasRef}
          selectedTool={selectedTool}
          strokeColor={strokeColor}
          fillColor={fillColor}
          lineWidth={lineWidth}
          fontSize={fontSize}
          stickyNoteColor={stickyNoteColor}
          elements={elements}
          onDrawingOrElementComplete={handleDrawingOrElementComplete}
          updateElementsAndHistory={updateElementsAndHistory}
          editingElementId={editingElement?.id}
          activateStickyNoteEditing={activateStickyNoteEditing}
          activateTextEditing={activateTextEditing}
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
            width: editingElement.isText ? '300px' : '150px', 
            height: editingElement.isText ? 'auto' : '100px',
            minHeight: editingElement.isText ? '30px' : '100px',
            fontSize: editingElement.isText ? `${fontSize}px` : '14px',
            backgroundColor: editingElement.isText ? 'rgba(255, 255, 255, 0.95)' : 'rgba(255, 250, 205, 0.95)',
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