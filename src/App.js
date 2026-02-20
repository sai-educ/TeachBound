// src/App.js
import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import './App.css';
import Toolbar from './Toolbar';
import Canvas from './Canvas';
import { useCollaboration } from './hooks/useCollaboration';

// --- App Name & Slogan ---
const APP_NAME = "Teach Bound";
const APP_SUBTITLE = "Digital Whiteboard for Teaching and Learning.";
const PERSISTED_HISTORY_LIMIT = 30;

function App() {
  const [selectedTool, setSelectedTool] = useState('pen');
  const [strokeColor, setStrokeColor] = useState('#000000');
  const [fillColor, setFillColor] = useState('transparent');
  const [lineWidth, setLineWidth] = useState(5);
  const [fontSize, setFontSize] = useState(16);
  const [textListType, setTextListType] = useState('none');
  const [stickyNoteColor, setStickyNoteColor] = useState('#FFFACD'); // Default yellow
  const [toolbarDisplayMode, setToolbarDisplayMode] = useState('icons-text'); // Changed from 'icons' to 'icons-text'

  // Initialize history from localStorage if available
  const loadFromLocalStorage = () => {
    try {
      const saved = localStorage.getItem('teachbound-canvas-data');
      if (saved) {
        const data = JSON.parse(saved);
        if (data.history && Array.isArray(data.history)) {
          const safeHistory = data.history.length > 0 ? data.history : [[]];
          const requestedStep = Number.isInteger(data.historyStep) ? data.historyStep : 0;
          const safeStep = Math.max(0, Math.min(requestedStep, safeHistory.length - 1));
          return {
            history: safeHistory,
            historyStep: safeStep
          };
        }
      }
    } catch (error) {
      console.error('Error loading from localStorage:', error);
    }
    return { history: [[]], historyStep: 0 };
  };

  const initialState = loadFromLocalStorage();
  const [history, setHistory] = useState(initialState.history);
  const [historyStep, setHistoryStep] = useState(initialState.historyStep);
  const [showSaveIndicator, setShowSaveIndicator] = useState(false);
  const elements = useMemo(() => history[historyStep] || [], [history, historyStep]);
  const historyStepRef = useRef(initialState.historyStep);
  const elementsRef = useRef(elements);

  const canvasRef = useRef(null);

  const [editingElement, setEditingElement] = useState(null);
  const [textAreaPosition, setTextAreaPosition] = useState({ x: 0, y: 0 });
  const textAreaRef = useRef(null);
  const suppressNextBlurRef = useRef(false);

  // Clipboard state for copy/paste
  const [clipboard, setClipboard] = useState([]);

  // Image drag state
  const [isDraggingFile, setIsDraggingFile] = useState(false);

  useEffect(() => {
    historyStepRef.current = historyStep;
  }, [historyStep]);

  useEffect(() => {
    elementsRef.current = elements;
  }, [elements]);

  const normalizeLineForList = useCallback((line) => {
    return line.replace(/^\s*(?:[-*•]\s+|\d+\.\s+)/, '');
  }, []);

  const formatTextForListType = useCallback((text, listType) => {
    const lines = (text || '').split('\n');

    if (listType === 'bullet') {
      return lines.map(line => `• ${normalizeLineForList(line)}`).join('\n');
    }

    if (listType === 'numbered') {
      return lines.map((line, index) => `${index + 1}. ${normalizeLineForList(line)}`).join('\n');
    }

    return lines.map(line => normalizeLineForList(line)).join('\n');
  }, [normalizeLineForList]);

  const hasMeaningfulText = useCallback((text) => {
    return (text || '').split('\n').some(line => normalizeLineForList(line).trim().length > 0);
  }, [normalizeLineForList]);

  const updateElementsAndHistory = useCallback((newElementsOrUpdater) => {
    const baseStep = historyStepRef.current;
    const nextStep = baseStep + 1;

    setHistory((prevHistory) => {
      const safeStep = prevHistory.length > 0
        ? Math.max(0, Math.min(baseStep, prevHistory.length - 1))
        : 0;
      const currentElementsState = prevHistory[safeStep] || [];

      const updatedElements = typeof newElementsOrUpdater === 'function'
        ? newElementsOrUpdater(currentElementsState)
        : newElementsOrUpdater;

      const newHistorySlice = prevHistory.slice(0, safeStep + 1);
      return [...newHistorySlice, updatedElements];
    });

    historyStepRef.current = nextStep;
    setHistoryStep(nextStep);
  }, []);

  // Collaboration Hook
  const {
    isConnected,
    collabRoomId,
    setCollabRoomId,
    emitDraw,
    emitUpdate,
    emitDelete,
    emitClear,
    emitCursorMove,
    remoteCursors
  } = useCollaboration(updateElementsAndHistory, elements);


  const handleDrawingOrElementComplete = useCallback((newElement) => {
    updateElementsAndHistory((prevElements) => {
      if (newElement.type === 'sticky' && !newElement.text) {
        setEditingElement({ id: newElement.id, text: newElement.text || "Note..." });
      }
      if (newElement.type === 'text' && !newElement.text) {
        setEditingElement({
          id: newElement.id,
          text: newElement.text || "",
          isText: true,
          listType: newElement.listType || textListType
        });
      }
      return [...prevElements, newElement];
    });
    // Emit to socket
    emitDraw(newElement);
  }, [updateElementsAndHistory, emitDraw, textListType]);

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

  const positionTextCaret = useCallback((element) => {
    const textarea = textAreaRef.current;
    if (!textarea) return;

    const textValue = element?.text || '';
    const listType = element?.listType || 'none';
    const isFreshBulletStarter = listType === 'bullet' && textValue === '• ';
    const isFreshNumberStarter = listType === 'numbered' && textValue === '1. ';

    if (isFreshBulletStarter || isFreshNumberStarter) {
      const caretPosition = textValue.length;
      textarea.setSelectionRange(caretPosition, caretPosition);
      return;
    }

    textarea.select();
  }, []);

  const activateTextEditing = useCallback((element) => {
    if (element && element.type === 'text') {
      const currentListType = element.listType || 'none';
      setEditingElement({ id: element.id, text: element.text, isText: true, listType: currentListType });
      setTextListType(currentListType);
      const canvasGlobalRect = canvasRef.current?.getCanvasGlobalRect();
      if (canvasGlobalRect) {
        setTextAreaPosition({
          x: canvasGlobalRect.left + element.x,
          y: canvasGlobalRect.top + element.y,
        });
      }
      setTimeout(() => {
        const textarea = textAreaRef.current;
        if (!textarea) return;
        textarea.focus();
        positionTextCaret(element);
      }, 0);
    }
  }, [positionTextCaret]);

  const createAndActivateTextElement = useCallback((x, y) => {
    const starterText = textListType === 'bullet'
      ? '• '
      : textListType === 'numbered'
        ? '1. '
        : '';

    const newText = {
      type: 'text',
      x,
      y,
      text: starterText,
      color: strokeColor,
      fontSize,
      id: Date.now() + Math.random(),
      listType: textListType
    };

    updateElementsAndHistory((prevElements) => [...prevElements, newText]);
    emitDraw(newText);
    activateTextEditing(newText);
  }, [activateTextEditing, emitDraw, fontSize, strokeColor, textListType, updateElementsAndHistory]);

  const commitEditingElement = useCallback((options = {}) => {
    const { startNewTextAt = null } = options;

    if (editingElement) {
      const liveEditorText = textAreaRef.current?.value ?? editingElement.text ?? '';
      const existingElement = elementsRef.current.find((el) => el.id === editingElement.id);

      if (editingElement.isText) {
        const editingListType = editingElement.listType || textListType;
        const formattedText = formatTextForListType(liveEditorText, editingListType);

        if (!hasMeaningfulText(formattedText)) {
          updateElementsAndHistory((prevElements) =>
            prevElements.filter((el) => el.id !== editingElement.id)
          );
          emitDelete([editingElement.id]);
        } else {
          updateElementsAndHistory((prevElements) =>
            prevElements.map((el) => {
              if (el.id === editingElement.id) {
                return { ...el, text: formattedText, listType: editingListType };
              }
              return el;
            })
          );

          if (existingElement) {
            emitUpdate({ ...existingElement, text: formattedText, listType: editingListType });
          }
        }
      } else {
        updateElementsAndHistory((prevElements) =>
          prevElements.map((el) => {
            if (el.id === editingElement.id) {
              return { ...el, text: liveEditorText };
            }
            return el;
          })
        );

        if (existingElement) {
          emitUpdate({ ...existingElement, text: liveEditorText });
        }
      }

      setEditingElement(null);
    }

    if (startNewTextAt && selectedTool === 'text') {
      createAndActivateTextElement(startNewTextAt.x, startNewTextAt.y);
    }
  }, [
    createAndActivateTextElement,
    editingElement,
    emitDelete,
    emitUpdate,
    formatTextForListType,
    hasMeaningfulText,
    selectedTool,
    textListType,
    updateElementsAndHistory
  ]);

  const handleTextAreaBlur = useCallback(() => {
    if (suppressNextBlurRef.current) {
      suppressNextBlurRef.current = false;
      return;
    }
    commitEditingElement();
  }, [commitEditingElement]);

  const handleTextAreaChange = (event) => {
    const { value } = event.target;
    setEditingElement((prev) => (prev ? { ...prev, text: value } : prev));
  };

  const handleTextListTypeChange = useCallback((nextListType) => {
    setTextListType(nextListType);
    setEditingElement((prev) => {
      if (!prev || !prev.isText) return prev;
      return {
        ...prev,
        listType: nextListType,
        text: formatTextForListType(prev.text || '', nextListType)
      };
    });

    if (editingElement?.isText) {
      requestAnimationFrame(() => {
        const textarea = textAreaRef.current;
        if (!textarea) return;

        const value = textarea.value || '';
        const isFreshBulletStarter = nextListType === 'bullet' && value === '• ';
        const isFreshNumberStarter = nextListType === 'numbered' && value === '1. ';
        if (isFreshBulletStarter || isFreshNumberStarter) {
          const caretPosition = value.length;
          textarea.setSelectionRange(caretPosition, caretPosition);
        }
      });
    }
  }, [editingElement, formatTextForListType]);

  const getNextListNumber = useCallback((text, caretIndex) => {
    const textBeforeCaret = text.slice(0, caretIndex);
    const lines = textBeforeCaret.split('\n');
    for (let i = lines.length - 1; i >= 0; i -= 1) {
      const match = lines[i].match(/^\s*(\d+)\.\s/);
      if (match) {
        return Number(match[1]) + 1;
      }
    }
    return 1;
  }, []);

  const handleTextAreaKeyDown = (event) => {
    if (event.key === 'Enter' && event.shiftKey && editingElement?.isText && editingElement.listType && editingElement.listType !== 'none') {
      event.preventDefault();
      const textarea = event.target;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const prefix = editingElement.listType === 'bullet'
        ? '• '
        : `${getNextListNumber(editingElement.text || '', start)}. `;
      const nextText = `${editingElement.text.slice(0, start)}\n${prefix}${editingElement.text.slice(end)}`;
      const nextCaret = start + 1 + prefix.length;

      setEditingElement((prev) => ({ ...prev, text: nextText }));
      requestAnimationFrame(() => {
        textarea.selectionStart = nextCaret;
        textarea.selectionEnd = nextCaret;
      });
      return;
    }

    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      commitEditingElement();
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      setEditingElement(null);
    }
  };

  const handleTextCanvasClickWhileEditing = useCallback((x, y) => {
    suppressNextBlurRef.current = true;
    commitEditingElement({ startNewTextAt: { x, y } });
  }, [commitEditingElement]);

  const handleToolSelection = useCallback((nextTool) => {
    if (editingElement && nextTool !== selectedTool) {
      suppressNextBlurRef.current = true;
      commitEditingElement();
      textAreaRef.current?.blur();
    }
    setSelectedTool(nextTool);
  }, [commitEditingElement, editingElement, selectedTool]);

  const handleUndo = useCallback(() => {
    if (historyStep > 0) {
      const nextStep = historyStep - 1;
      historyStepRef.current = nextStep;
      setHistoryStep(nextStep);
    }
  }, [historyStep]);

  const handleRedo = useCallback(() => {
    if (historyStep < history.length - 1) {
      const nextStep = historyStep + 1;
      historyStepRef.current = nextStep;
      setHistoryStep(nextStep);
    }
  }, [historyStep, history.length]);

  // Enhanced Clear function with sound alert
  const handleClearFrame = () => {
    // Play sound alert
    try {
      // Create a simple beep sound using Web Audio API
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.frequency.value = 800; // Frequency in Hz
      oscillator.type = 'sine';

      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);

      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.5);
    } catch (error) {
      console.log('Audio not supported or blocked:', error);
    }

    // Show confirmation dialog
    const confirmed = window.confirm("⚠️ CLEAR CANVAS WARNING ⚠️\n\nThis will permanently delete everything on the canvas and cannot be undone.\n\nAre you sure you want to continue?");
    if (confirmed) {
      setHistory([[]]);
      setHistoryStep(0);
      emitClear();
    }
  };

  const handleDownloadPNG = (scale = 1) => canvasRef.current?.downloadAsPNG(scale);
  const handleDownloadPDF = () => canvasRef.current?.downloadAsPDF();

  const handleDeleteSelected = useCallback(() => {
    const selected = canvasRef.current?.getSelectedElements() || [];
    const selectedIds = selected.map(el => el.id);
    if (selectedIds.length > 0) {
      canvasRef.current?.deleteSelectedElements();
      emitDelete(selectedIds);
    }
  }, [emitDelete]);

  // Auto-save to localStorage
  const saveToLocalStorage = useCallback((showIndicator = false) => {
    try {
      const safeHistoryStep = Math.max(0, Math.min(historyStep, history.length - 1));
      const historyStartIndex = Math.max(0, safeHistoryStep - PERSISTED_HISTORY_LIMIT + 1);
      const persistedHistory = history.slice(historyStartIndex, safeHistoryStep + 1);

      const dataToSave = {
        history: persistedHistory,
        historyStep: persistedHistory.length - 1,
        timestamp: Date.now()
      };
      localStorage.setItem('teachbound-canvas-data', JSON.stringify(dataToSave));
      if (showIndicator) {
        setShowSaveIndicator(true);
        setTimeout(() => setShowSaveIndicator(false), 2000);
      }
    } catch (error) {
      console.error('Error saving to localStorage:', error);
      // If localStorage is full, try to clear old data
      if (error.name === 'QuotaExceededError') {
        console.warn('localStorage quota exceeded, clearing old data');
        localStorage.removeItem('teachbound-canvas-data');
      }
    }
  }, [history, historyStep]);

  // Save when history changes, deferred slightly to reduce interaction overhead.
  useEffect(() => {
    let idleCallbackId;
    const saveTimer = setTimeout(() => {
      if (history.length > 0) {
        if ('requestIdleCallback' in window) {
          idleCallbackId = window.requestIdleCallback(() => saveToLocalStorage(), { timeout: 1500 });
        } else {
          saveToLocalStorage();
        }
      }
    }, 1200);

    return () => {
      clearTimeout(saveTimer);
      if (idleCallbackId !== undefined && 'cancelIdleCallback' in window) {
        window.cancelIdleCallback(idleCallbackId);
      }
    };
  }, [history, historyStep, saveToLocalStorage]);

  // Manual save function
  const handleManualSave = useCallback(() => {
    saveToLocalStorage(true);
  }, [saveToLocalStorage]);

  // Clear saved data
  const handleClearSaved = () => {
    if (window.confirm('This will clear your saved work from browser storage. Are you sure?')) {
      localStorage.removeItem('teachbound-canvas-data');
      setShowSaveIndicator(true);
      setTimeout(() => setShowSaveIndicator(false), 2000);
    }
  };

  // Handle image upload - creates image element that fits within canvas
  const handleImageUpload = useCallback((imageData) => {
    const img = new window.Image();

    img.onload = () => {
      // Get canvas dimensions
      const canvasRect = canvasRef.current?.getCanvasGlobalRect();
      const maxWidth = (canvasRect?.width || 800) * 0.6; // Max 60% of canvas width
      const maxHeight = (canvasRect?.height || 600) * 0.6; // Max 60% of canvas height

      // Calculate size to fit within bounds while maintaining aspect ratio
      let width = img.width || 200;
      let height = img.height || 200;

      // Handle edge case where dimensions might be 0
      if (width === 0) width = 200;
      if (height === 0) height = 200;

      const aspectRatio = width / height;

      if (width > maxWidth) {
        width = maxWidth;
        height = width / aspectRatio;
      }
      if (height > maxHeight) {
        height = maxHeight;
        width = height * aspectRatio;
      }

      // Center the image on canvas
      const x = ((canvasRect?.width || 800) - width) / 2;
      const y = ((canvasRect?.height || 600) - height) / 2;

      const newImage = {
        type: 'image',
        id: Date.now(),
        x,
        y,
        width,
        height,
        rotation: 0,
        imageData
      };

      updateElementsAndHistory(prev => [...prev, newImage]);
      emitDraw(newImage); // Share image
      handleToolSelection('select'); // Switch to select tool after adding image
    };

    img.onerror = () => {
      console.error('Failed to load image');
      alert('Could not load this image format. Please try converting it to PNG or JPEG first.');
    };

    // Set crossOrigin for potential CORS issues
    img.crossOrigin = 'anonymous';
    img.src = imageData;
  }, [updateElementsAndHistory, emitDraw, handleToolSelection]);

  // Handle file drop - supports all common image formats
  const handleDrop = useCallback((event) => {
    event.preventDefault();
    setIsDraggingFile(false);

    const file = event.dataTransfer.files?.[0];
    if (!file) return;

    // Check if it's an image file (by type or extension)
    const isImage = file.type.startsWith('image/') ||
      /\.(jpg|jpeg|png|gif|webp|svg|bmp|ico|tiff?|heic|heif|avif)$/i.test(file.name);

    if (isImage) {
      // For HEIC/HEIF files, try to convert using canvas if browser doesn't support
      const isHeic = /\.(heic|heif)$/i.test(file.name) || file.type === 'image/heic' || file.type === 'image/heif';

      if (isHeic) {
        const reader = new FileReader();
        reader.onload = (e) => {
          const img = new window.Image();
          img.onload = () => {
            // Convert to PNG using canvas for better compatibility
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);
            const pngDataUrl = canvas.toDataURL('image/png');
            handleImageUpload(pngDataUrl);
          };
          img.onerror = () => {
            alert('HEIC/HEIF format is not supported by your browser. Please convert the image to PNG or JPEG first.');
          };
          img.src = e.target.result;
        };
        reader.readAsDataURL(file);
      } else {
        const reader = new FileReader();
        reader.onload = (e) => {
          handleImageUpload(e.target.result);
        };
        reader.readAsDataURL(file);
      }
    }
  }, [handleImageUpload]);

  const handleDragOver = useCallback((event) => {
    event.preventDefault();
    setIsDraggingFile(true);
  }, []);

  const handleDragLeave = useCallback((event) => {
    event.preventDefault();
    setIsDraggingFile(false);
  }, []);

  // Copy selected elements
  const handleCopy = useCallback(() => {
    const selectedElements = canvasRef.current?.getSelectedElements();
    if (selectedElements && selectedElements.length > 0) {
      setClipboard([...selectedElements]);
      // Show copy feedback
      setShowSaveIndicator(true);
      setTimeout(() => setShowSaveIndicator(false), 1000);
    }
  }, []);

  // Paste elements
  const handlePaste = useCallback(() => {
    if (clipboard.length > 0) {
      const offset = 20; // Offset pasted elements
      const pastedElements = clipboard.map(el => ({
        ...el,
        id: Date.now() + Math.random(), // New unique ID
        x: el.x + offset,
        y: el.y + offset,
        // Adjust end coordinates for shapes
        ...(el.endX !== undefined && { endX: el.endX + offset }),
        ...(el.endY !== undefined && { endY: el.endY + offset }),
        // Adjust path for strokes
        ...(el.path && {
          path: el.path.map(point => ({
            x: point.x + offset,
            y: point.y + offset
          }))
        })
      }));

      updateElementsAndHistory((prevElements) => [
        ...prevElements,
        ...pastedElements
      ]);
      // Emit pasted elements
      pastedElements.forEach(el => emitDraw(el));
    }
  }, [clipboard, updateElementsAndHistory, emitDraw]);

  // Duplicate selected elements
  const handleDuplicate = useCallback(() => {
    handleCopy();
    setTimeout(() => handlePaste(), 100);
  }, [handleCopy, handlePaste]);

  // Keyboard shortcuts handler
  useEffect(() => {
    const handleKeyDown = (event) => {
      // Don't trigger shortcuts when typing in textarea
      if (event.target.tagName === 'TEXTAREA' || event.target.tagName === 'INPUT') {
        return;
      }

      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const cmdOrCtrl = isMac ? event.metaKey : event.ctrlKey;

      // Tool selection shortcuts
      if (!cmdOrCtrl && !event.shiftKey && !event.altKey) {
        switch (event.key.toLowerCase()) {
          case 'v':
            handleToolSelection('select');
            event.preventDefault();
            break;
          case 'p':
            handleToolSelection('pen');
            event.preventDefault();
            break;
          case 'e':
            handleToolSelection('eraser');
            event.preventDefault();
            break;
          case 'n':
            handleToolSelection('sticky');
            event.preventDefault();
            break;
          case 't':
            handleToolSelection('text');
            event.preventDefault();
            break;
          case 'h':
            handleToolSelection('highlighter');
            event.preventDefault();
            break;
          case 'r':
            handleToolSelection('rectangle');
            event.preventDefault();
            break;
          case 'c':
            handleToolSelection('circle');
            event.preventDefault();
            break;
          case 'l':
            handleToolSelection('line');
            event.preventDefault();
            break;
          case 'a':
            handleToolSelection('arrow');
            event.preventDefault();
            break;
          case 'i':
            // Trigger image upload (same as clicking image tool)
            document.querySelector('input[type="file"][accept="image/*"]')?.click();
            event.preventDefault();
            break;
          case 'escape':
            // Deselect all
            canvasRef.current?.clearSelection();
            event.preventDefault();
            break;
          case 'delete':
          case 'backspace':
            // Delete selected elements
            handleDeleteSelected();
            event.preventDefault();
            break;
        }
      }

      // Cmd/Ctrl shortcuts
      if (cmdOrCtrl) {
        switch (event.key.toLowerCase()) {
          case 'z':
            if (event.shiftKey) {
              handleRedo();
            } else {
              handleUndo();
            }
            event.preventDefault();
            break;
          case 'y':
            handleRedo();
            event.preventDefault();
            break;
          case 'c':
            handleCopy();
            event.preventDefault();
            break;
          case 'v':
            handlePaste();
            event.preventDefault();
            break;
          case 'd':
            handleDuplicate();
            event.preventDefault();
            break;
          case 's':
            handleManualSave();
            event.preventDefault();
            break;
          case 'a':
            // Select all
            canvasRef.current?.selectAll();
            event.preventDefault();
            break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedTool, handleToolSelection, handleUndo, handleRedo, handleCopy, handlePaste,
    handleDuplicate, handleDeleteSelected, handleManualSave]);

  const handleShare = () => {
    const roomId = Math.random().toString(36).substring(7);
    const url = `${window.location.origin}?room=${roomId}`;
    if (!collabRoomId) {
      window.history.pushState({}, '', `?room=${roomId}`);
      setCollabRoomId(roomId);
      alert(`Collaboration session started! Share this URL:\n${url}`);
    } else {
      alert(`Already in a session! Share this URL:\n${window.location.href}`);
    }
  };

  return (
    <div className="App">
      <header className="app-header">
        <div className="app-heading">
          <h1 className="app-title">{APP_NAME}</h1>
          <p className="app-slogan">
            <span className="app-subtitle-inline">{APP_SUBTITLE}</span>{' '}
            <a href="https://github.com/sai-educ/TeachBound" target="_blank" rel="noopener noreferrer">Open source</a>, ad-free, and 100% free to use. {' '}
            <a href="https://forms.gle/WShMfsvVaLc34QeaA" target="_blank" rel="noopener noreferrer">Please provide feedback or suggestions.</a>{' '}
            Developed by <a href="https://www.gattupalli.com/" target="_blank" rel="noopener noreferrer">Sai Gattupalli, PhD</a>.
          </p>
        </div>
        {collabRoomId && (
          <div className="room-indicator">
            <span className="room-id">Room: {collabRoomId}</span>
            <span className={`connection-status ${isConnected ? 'connected' : 'disconnected'}`}>
              {isConnected ? '●' : '○'}
            </span>
          </div>
        )}
      </header>
      <div
        className={`main-content-wrapper ${isDraggingFile ? 'dragging-file' : ''}`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        <Toolbar
          selectedTool={selectedTool}
          setSelectedTool={handleToolSelection}
          strokeColor={strokeColor}
          setStrokeColor={setStrokeColor}
          fillColor={fillColor}
          setFillColor={setFillColor}
          lineWidth={lineWidth}
          setLineWidth={setLineWidth}
          fontSize={fontSize}
          setFontSize={setFontSize}
          textListType={textListType}
          onTextListTypeChange={handleTextListTypeChange}
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
          onCopy={handleCopy}
          onPaste={handlePaste}
          onDuplicate={handleDuplicate}
          onSave={handleManualSave}
          onClearSaved={handleClearSaved}
          hasClipboard={clipboard.length > 0}
          onImageUpload={handleImageUpload}
          onShare={handleShare}
        />
        <Canvas
          ref={canvasRef}
          selectedTool={selectedTool}
          strokeColor={strokeColor}
          fillColor={fillColor}
          lineWidth={lineWidth}
          fontSize={fontSize}
          textListType={textListType}
          stickyNoteColor={stickyNoteColor}
          elements={elements}
          onDrawingOrElementComplete={handleDrawingOrElementComplete}
          updateElementsAndHistory={updateElementsAndHistory}
          editingElementId={editingElement?.id}
          activateStickyNoteEditing={activateStickyNoteEditing}
          activateTextEditing={activateTextEditing}
          onTextCanvasClickWhileEditing={handleTextCanvasClickWhileEditing}
          onCursorMove={emitCursorMove}
          remoteCursors={remoteCursors}
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

      {/* Save Indicator */}
      {showSaveIndicator && (
        <div className="save-indicator">
          ✓ Saved
        </div>
      )}
    </div>
  );
}

export default App;
