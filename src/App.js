// src/App.js
import React, { useState, useCallback, useRef, useEffect } from 'react';
import './App.css';
import TopMenu from './TopMenu'; // Import TopMenu
import Toolbar from './Toolbar';
import Canvas from './Canvas';

function App() {
  const [selectedTool, setSelectedTool] = useState('pen');
  const [strokeColor, setStrokeColor] = useState('#000000');
  const [lineWidth, setLineWidth] = useState(5); // Default line width

  // History for Undo/Redo
  // Each item in history is the full 'elements' array at that point
  const [history, setHistory] = useState([[]]); // Starts with one empty frame in history
  const [historyStep, setHistoryStep] = useState(0); // Pointer to current state in history

  // The current elements being displayed/edited, derived from history
  const elements = history[historyStep] || [];

  const canvasRef = useRef(null); // Ref for <Canvas /> component instance

  // Function to update elements and history
  const updateElementsAndHistory = useCallback((newElements) => {
    // If newElements is a function, it means it's an updater function like (prevElements => ...)
    const updatedElements = typeof newElements === 'function' ? newElements(elements) : newElements;

    const newHistory = history.slice(0, historyStep + 1); // Remove "redo" states
    setHistory([...newHistory, updatedElements]);
    setHistoryStep(newHistory.length);
  }, [history, historyStep, elements]); // Added elements here

  const handleUndo = () => {
    if (historyStep > 0) {
      setHistoryStep((prevStep) => prevStep - 1);
    }
  };

  const handleRedo = () => {
    if (historyStep < history.length - 1) {
      setHistoryStep((prevStep) => prevStep + 1);
    }
  };

  const handleClearFrame = () => {
    updateElementsAndHistory([]); // Set elements to an empty array and update history
  };

  const handleDownloadPNG = () => {
    if (canvasRef.current) {
      canvasRef.current.downloadAsPNG();
    }
  };

  // This function will be called by Canvas when a drawing or new element is completed
  const handleDrawingOrElementComplete = useCallback((newElement) => {
    updateElementsAndHistory((prevElements) => [...prevElements, newElement]);
  }, [updateElementsAndHistory]);


  return (
    <div className="App">
      <TopMenu
        onUndo={handleUndo}
        onRedo={handleRedo}
        onClearFrame={handleClearFrame}
        canUndo={historyStep > 0}
        canRedo={historyStep < history.length - 1}
        onDownloadPNG={handleDownloadPNG}
      />
      <div className="main-content">
        <Toolbar
          selectedTool={selectedTool}
          setSelectedTool={setSelectedTool}
          strokeColor={strokeColor}
          setStrokeColor={setStrokeColor}
          lineWidth={lineWidth}
          setLineWidth={setLineWidth} // Pass setLineWidth
        />
        <Canvas
          ref={canvasRef}
          selectedTool={selectedTool}
          strokeColor={strokeColor}
          lineWidth={lineWidth}
          elements={elements} // Pass current elements from history
          onDrawingComplete={handleDrawingOrElementComplete} // Pass the callback
        />
      </div>
    </div>
  );
}

export default App;