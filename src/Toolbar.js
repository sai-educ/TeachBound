// src/Toolbar.js
import React from 'react';
import './Toolbar.css';
import {
  PenTool, Eraser, StickyNote as StickyNoteIcon, Palette,
  Undo, Redo, Trash2, Download, Square, Circle,
  Minus, ArrowRight, Type, MousePointer, Trash
} from 'lucide-react';

const ACCESSIBLE_COLORS = [
  { name: 'Black', value: '#000000' }, { name: 'Red', value: '#D90429' },
  { name: 'Blue', value: '#0077B6' }, { name: 'Green', value: '#06A77D' },
  { name: 'Purple', value: '#7209B7' },
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
  { label: 'Thin', value: 2 }, { label: 'Medium', value: 5 },
  { label: 'Thick', value: 10 }, { label: 'Extra Thick', value: 20 },
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
  onUndo, onRedo, onClearFrame, canUndo, canRedo, onDownloadPNG, onDeleteSelected
}) => {
  const mainTools = [
    { name: 'select', icon: <MousePointer size={18} className="tool-icon" />, label: 'Select' },
    { name: 'pen', icon: <PenTool size={18} className="tool-icon" />, label: 'Pen' },
    { name: 'eraser', icon: <Eraser size={18} className="tool-icon" />, label: 'Eraser' },
    { name: 'sticky', icon: <StickyNoteIcon size={18} className="tool-icon" />, label: 'Sticky Note' },
    { name: 'text', icon: <Type size={18} className="tool-icon" />, label: 'Text' },
  ];

  const shapeTools = [
    { name: 'rectangle', icon: <Square size={18} className="tool-icon" />, label: 'Rectangle' },
    { name: 'circle', icon: <Circle size={18} className="tool-icon" />, label: 'Circle' },
    { name: 'line', icon: <Minus size={18} className="tool-icon" />, label: 'Line' },
    { name: 'arrow', icon: <ArrowRight size={18} className="tool-icon" />, label: 'Arrow' },
  ];

  const actionTools = [
    { name: 'undo', icon: <Undo size={18} />, label: 'Undo', action: onUndo, disabled: !canUndo },
    { name: 'redo', icon: <Redo size={18} />, label: 'Redo', action: onRedo, disabled: !canRedo },
    { name: 'delete', icon: <Trash size={18} />, label: 'Delete', action: onDeleteSelected },
    { name: 'clear', icon: <Trash2 size={18} />, label: 'Clear', action: onClearFrame },
    { name: 'download', icon: <Download size={18} />, label: 'PNG', action: onDownloadPNG },
  ];

  // Show shape-specific options
  const showShapeOptions = ['rectangle', 'circle', 'line', 'arrow'].includes(selectedTool);
  const showTextOptions = selectedTool === 'text';

  return (
    <div className="toolbar-wrapper">
      {/* Main Tools */}
      <div className="toolbar-section">
        <div className="tool-group">
          {mainTools.map((tool) => (
            <button
              key={tool.name}
              className={`tool-button ${selectedTool === tool.name ? 'active' : ''}`}
              onClick={() => setSelectedTool(tool.name)}
              title={tool.label}
            >
              {tool.icon} {tool.label}
            </button>
          ))}
        </div>

        <div className="separator"></div>

        {/* Shape Tools */}
        <div className="tool-group">
          {shapeTools.map((tool) => (
            <button
              key={tool.name}
              className={`tool-button ${selectedTool === tool.name ? 'active' : ''}`}
              onClick={() => setSelectedTool(tool.name)}
              title={tool.label}
            >
              {tool.icon} {tool.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tool Options */}
      <div className="toolbar-section">
        <div className="tool-group tool-options-group">
          <span className="options-label"><Palette size={16} style={{ color: strokeColor }} /> Stroke:</span>
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

        {showShapeOptions && (
          <>
            <div className="separator"></div>
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
                      backgroundSize: '8px 8px',
                      backgroundPosition: '0 0, 4px 4px'
                    }}
                    onClick={() => setFillColor(color.value)}
                    title={color.name}
                    aria-label={`Select fill color ${color.name}`}
                  />
                ))}
              </div>
            </div>
          </>
        )}

        <div className="separator"></div>

        <div className="tool-group tool-options-group">
          <span className="options-label">Line:</span>
          <div className="line-width-selection">
            {LINE_WIDTHS.map((widthOption) => (
              <button
                key={widthOption.value}
                className={`tool-button line-width-button ${lineWidth === widthOption.value ? 'active' : ''}`}
                onClick={() => setLineWidth(widthOption.value)}
                title={widthOption.label}
              >
                <span style={{ display: 'inline-block', width: '20px', height: `${Math.min(widthOption.value, 15)}px`, backgroundColor: strokeColor === '#ffffff' ? '#cccccc' : strokeColor, borderRadius: '2px' }}></span>
              </button>
            ))}
          </div>
        </div>

        {showTextOptions && (
          <>
            <div className="separator"></div>
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
          </>
        )}
      </div>

      {/* Action Tools */}
      <div className="toolbar-section action-tools-section">
         <div className="tool-group">
            {actionTools.map((tool) => (
            <button
                key={tool.name}
                className="tool-button action-button"
                onClick={tool.action}
                disabled={tool.disabled}
                title={tool.label}
            >
                {tool.icon} {tool.label}
            </button>
            ))}
        </div>
      </div>
    </div>
  );
};

export default Toolbar;