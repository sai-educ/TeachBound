// src/Toolbar.js
import React, { useState, useRef, useEffect } from 'react';
import './Toolbar.css';
import {
  PenTool, Eraser, StickyNote as StickyNoteIcon, Palette,
  Undo, Redo, Trash2, Download, Square, Circle,
  Minus, ArrowRight, Type, MousePointer, Trash, ChevronDown, Shapes
} from 'lucide-react';

const ACCESSIBLE_COLORS = [
  { name: 'Black', value: '#000000' }, 
  { name: 'Red', value: '#D90429' },
  { name: 'Blue', value: '#0077B6' }, 
  { name: 'Green', value: '#06A77D' },
  { name: 'Purple', value: '#7209B7' },
];

const STICKY_NOTE_COLORS = [
  { name: 'Yellow', value: '#FFFACD' }, 
  { name: 'Pink', value: '#FFB6C1' },
  { name: 'Light Blue', value: '#ADD8E6' }, 
  { name: 'Light Green', value: '#90EE90' },
  { name: 'Orange', value: '#FFE4B5' }, 
  { name: 'Lavender', value: '#E6E6FA' },
];

const FILL_COLORS = [
  { name: 'Transparent', value: 'transparent' },
  { name: 'White', value: '#FFFFFF' },
  { name: 'Light Gray', value: '#F0F0F0' },
  { name: 'Light Blue', value: '#E3F2FD' },
  { name: 'Light Green', value: '#E8F5E9' },
  { name: 'Light Yellow', value: '#FFFDE7' },
];

const LINE_WIDTHS = [
  { label: 'Thin', value: 2 }, 
  { label: 'Medium', value: 5 },
  { label: 'Thick', value: 10 }, 
  { label: 'Extra Thick', value: 20 },
];

const FONT_SIZES = [
  { label: 'Small', value: 12 },
  { label: 'Medium', value: 16 },
  { label: 'Large', value: 24 },
  { label: 'Extra Large', value: 32 },
];

const Toolbar = ({
  selectedTool, setSelectedTool,
  strokeColor, setStrokeColor,
  fillColor, setFillColor,
  lineWidth, setLineWidth,
  fontSize, setFontSize,
  stickyNoteColor, setStickyNoteColor,
  onUndo, onRedo, onClearFrame, canUndo, canRedo, onDownloadPNG, onDownloadPDF, onDeleteSelected
}) => {
  const [showShapesDropdown, setShowShapesDropdown] = useState(false);
  const [showDownloadDropdown, setShowDownloadDropdown] = useState(false);
  const shapesDropdownRef = useRef(null);
  const downloadDropdownRef = useRef(null);

  const shapeTools = [
    { name: 'rectangle', icon: <Square size={14} className="tool-icon" />, label: 'Rectangle' },
    { name: 'circle', icon: <Circle size={14} className="tool-icon" />, label: 'Circle' },
    { name: 'line', icon: <Minus size={14} className="tool-icon" />, label: 'Line' },
    { name: 'arrow', icon: <ArrowRight size={14} className="tool-icon" />, label: 'Arrow' },
  ];

  const mainTools = [
    { name: 'select', icon: <MousePointer size={14} className="tool-icon" />, label: 'Select' },
    { name: 'pen', icon: <PenTool size={14} className="tool-icon" />, label: 'Pen' },
    { name: 'eraser', icon: <Eraser size={14} className="tool-icon" />, label: 'Eraser' },
    { name: 'sticky', icon: <StickyNoteIcon size={14} className="tool-icon" />, label: 'Sticky Note' },
    { name: 'text', icon: <Type size={14} className="tool-icon" />, label: 'Text' },
  ];

  const actionTools = [
    { name: 'undo', icon: <Undo size={14} />, label: 'Undo', action: onUndo, disabled: !canUndo },
    { name: 'redo', icon: <Redo size={14} />, label: 'Redo', action: onRedo, disabled: !canRedo },
    { name: 'delete', icon: <Trash size={14} />, label: 'Delete', action: onDeleteSelected },
    { name: 'clear', icon: <Trash2 size={14} />, label: 'Clear', action: onClearFrame },
  ];

  // Get current shape icon for shapes button
  const getCurrentShapeIcon = () => {
    const currentShape = shapeTools.find(shape => shape.name === selectedTool);
    return currentShape ? currentShape.icon : <Shapes size={14} className="tool-icon" />;
  };

  // Show tool-specific options
  const showShapeOptions = ['rectangle', 'circle', 'line', 'arrow'].includes(selectedTool);
  const showTextOptions = selectedTool === 'text';
  const showStickyOptions = selectedTool === 'sticky';

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (shapesDropdownRef.current && !shapesDropdownRef.current.contains(event.target)) {
        setShowShapesDropdown(false);
      }
      if (downloadDropdownRef.current && !downloadDropdownRef.current.contains(event.target)) {
        setShowDownloadDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleShapeSelect = (shapeName) => {
    setSelectedTool(shapeName);
    setShowShapesDropdown(false);
  };

  const handleDownloadSelect = (type, scale = 1) => {
    if (type === 'png') {
      onDownloadPNG(scale);
    } else if (type === 'pdf') {
      onDownloadPDF();
    }
    setShowDownloadDropdown(false);
  };

  return (
    <div className="toolbar-wrapper">
      {/* Main Tools Bar */}
      <div className="toolbar-section main-toolbar">
        {/* Main Tools Group */}
        <div className="tool-group main-tools">
          {mainTools.map((tool) => (
            <button
              key={tool.name}
              className={`tool-button ${selectedTool === tool.name ? 'active' : ''}`}
              onClick={() => setSelectedTool(tool.name)}
              title={tool.label}
            >
              {tool.icon}
            </button>
          ))}

          {/* Shapes Dropdown */}
          <div className="dropdown-container" ref={shapesDropdownRef}>
            <button
              className={`tool-button dropdown-trigger ${showShapeOptions ? 'active' : ''}`}
              onClick={() => setShowShapesDropdown(!showShapesDropdown)}
              title="Shapes"
            >
              {getCurrentShapeIcon()} <ChevronDown size={12} />
            </button>
            {showShapesDropdown && (
              <div className="dropdown-menu shapes-dropdown">
                {shapeTools.map((tool) => (
                  <button
                    key={tool.name}
                    className={`dropdown-item ${selectedTool === tool.name ? 'active' : ''}`}
                    onClick={() => handleShapeSelect(tool.name)}
                  >
                    {tool.icon} {tool.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="separator"></div>

        {/* Stroke Colors */}
        <div className="tool-group stroke-group">
          <span className="options-label">Stroke:</span>
          <div className="color-palette">
            {ACCESSIBLE_COLORS.map((color) => (
              <button
                key={color.value}
                className={`color-button ${strokeColor === color.value ? 'active' : ''}`}
                style={{ backgroundColor: color.value }}
                onClick={() => setStrokeColor(color.value)}
                title={color.name}
                aria-label={`Select stroke color ${color.name}`}
              />
            ))}
          </div>
        </div>

        <div className="separator"></div>

        {/* Line Width */}
        <div className="tool-group line-width-group">
          <span className="options-label">Line Width:</span>
          <div className="line-width-selection">
            {LINE_WIDTHS.map((widthOption) => (
              <button
                key={widthOption.value}
                className={`tool-button line-width-button ${lineWidth === widthOption.value ? 'active' : ''}`}
                onClick={() => setLineWidth(widthOption.value)}
                title={widthOption.label}
              >
                <span 
                  className="line-preview"
                  style={{ 
                    display: 'inline-block', 
                    width: '16px', 
                    height: `${Math.min(widthOption.value, 12)}px`, 
                    backgroundColor: strokeColor === '#ffffff' ? '#cccccc' : strokeColor, 
                    borderRadius: '2px' 
                  }}
                ></span>
              </button>
            ))}
          </div>
        </div>

        <div className="separator"></div>

        {/* Action Tools */}
        <div className="tool-group action-tools">
          {actionTools.map((tool) => (
            <button
              key={tool.name}
              className="tool-button action-button"
              onClick={tool.action}
              disabled={tool.disabled}
              title={tool.label}
            >
              {tool.icon}
            </button>
          ))}
        </div>

        {/* Download Button - Right Aligned */}
        <div className="tool-group download-group">
          <div className="dropdown-container" ref={downloadDropdownRef}>
            <button
              className="tool-button download-button"
              onClick={() => setShowDownloadDropdown(!showDownloadDropdown)}
              title="Download"
            >
              <Download size={14} /> <ChevronDown size={12} />
            </button>
            {showDownloadDropdown && (
              <div className="dropdown-menu download-dropdown">
                <div className="dropdown-section">
                  <div className="dropdown-section-title">High Quality PNG</div>
                  <button className="dropdown-item" onClick={() => handleDownloadSelect('png', 1)}>
                    <Download size={14} /> PNG - Standard (1x)
                  </button>
                  <button className="dropdown-item" onClick={() => handleDownloadSelect('png', 2)}>
                    <Download size={14} /> PNG - High Quality (2x)
                  </button>
                  <button className="dropdown-item" onClick={() => handleDownloadSelect('png', 3)}>
                    <Download size={14} /> PNG - Ultra Quality (3x)
                  </button>
                </div>
                <div className="dropdown-section">
                  <div className="dropdown-section-title">PDF Document</div>
                  <button className="dropdown-item" onClick={() => handleDownloadSelect('pdf')}>
                    <Download size={14} /> Download as PDF
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tool-Specific Options Row */}
      {(showStickyOptions || showShapeOptions || showTextOptions) && (
        <div className="toolbar-section options-section">
          {showStickyOptions && (
            <div className="tool-group tool-options-group">
              <span className="options-label">Note Color:</span>
              <div className="color-palette">
                {STICKY_NOTE_COLORS.map((color) => (
                  <button
                    key={color.value}
                    className={`color-button ${stickyNoteColor === color.value ? 'active' : ''}`}
                    style={{ backgroundColor: color.value }}
                    onClick={() => setStickyNoteColor(color.value)}
                    title={color.name}
                    aria-label={`Select sticky note color ${color.name}`}
                  />
                ))}
              </div>
            </div>
          )}

          {showShapeOptions && (
            <div className="tool-group tool-options-group">
              <span className="options-label">Fill:</span>
              <div className="color-palette">
                {FILL_COLORS.map((color) => (
                  <button
                    key={color.value}
                    className={`color-button fill-button ${fillColor === color.value ? 'active' : ''}`}
                    style={{ 
                      backgroundColor: color.value === 'transparent' ? '#ffffff' : color.value,
                      backgroundImage: color.value === 'transparent' 
                        ? 'linear-gradient(45deg, #ccc 25%, transparent 25%, transparent 75%, #ccc 75%, #ccc), linear-gradient(45deg, #ccc 25%, transparent 25%, transparent 75%, #ccc 75%, #ccc)'
                        : 'none',
                      backgroundSize: '6px 6px',
                      backgroundPosition: '0 0, 3px 3px'
                    }}
                    onClick={() => setFillColor(color.value)}
                    title={color.name}
                    aria-label={`Select fill color ${color.name}`}
                  />
                ))}
              </div>
            </div>
          )}

          {showTextOptions && (
            <div className="tool-group tool-options-group">
              <span className="options-label">Font Size:</span>
              <div className="font-size-selection">
                {FONT_SIZES.map((sizeOption) => (
                  <button
                    key={sizeOption.value}
                    className={`tool-button font-size-button ${fontSize === sizeOption.value ? 'active' : ''}`}
                    onClick={() => setFontSize(sizeOption.value)}
                    title={sizeOption.label}
                  >
                    {sizeOption.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Toolbar;