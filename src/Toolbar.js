// src/Toolbar.js
import React from 'react';
import './Toolbar.css';
import {
  PenTool, Eraser, StickyNote as StickyNoteIcon, Palette,
  Undo, Redo, Trash2, Download
} from 'lucide-react';

const ACCESSIBLE_COLORS = [
  { name: 'Black', value: '#000000' }, { name: 'Red', value: '#D90429' },
  { name: 'Blue', value: '#0077B6' }, { name: 'Green', value: '#06A77D' },
  { name: 'Purple', value: '#7209B7' },
];

const LINE_WIDTHS = [
  { label: 'Thin', value: 2 }, { label: 'Medium', value: 5 },
  { label: 'Thick', value: 10 }, { label: 'Extra Thick', value: 20 },
];

const Toolbar = ({
  selectedTool, setSelectedTool,
  strokeColor, setStrokeColor,
  lineWidth, setLineWidth,
  onUndo, onRedo, onClearFrame, canUndo, canRedo, onDownloadPNG
}) => {
  const mainTools = [
    { name: 'pen', icon: <PenTool size={18} className="tool-icon" />, label: 'Pen' },
    { name: 'eraser', icon: <Eraser size={18} className="tool-icon" />, label: 'Eraser' },
    { name: 'sticky', icon: <StickyNoteIcon size={18} className="tool-icon" />, label: 'Sticky Note' },
  ];

  const actionTools = [
    { name: 'undo', icon: <Undo size={18} />, label: 'Undo', action: onUndo, disabled: !canUndo },
    { name: 'redo', icon: <Redo size={18} />, label: 'Redo', action: onRedo, disabled: !canRedo },
    { name: 'clear', icon: <Trash2 size={18} />, label: 'Clear', action: onClearFrame },
    { name: 'download', icon: <Download size={18} />, label: 'PNG', action: onDownloadPNG },
  ];

  return (
    <div className="toolbar-wrapper">
      {/* Drawing Tools and Options */}
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

        <div className="tool-group tool-options-group">
          <span className="options-label"><Palette size={16} style={{ color: strokeColor }} /></span>
          <div className="color-palette">
            {ACCESSIBLE_COLORS.map((color) => (
              <button
                key={color.value}
                className={`color-button ${strokeColor === color.value ? 'active' : ''}`}
                style={{ backgroundColor: color.value }}
                onClick={() => setStrokeColor(color.value)}
                title={color.name}
                aria-label={`Select color ${color.name}`}
              />
            ))}
          </div>
        </div>

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
      </div>

      {/* Action Tools (Undo, Redo, Clear, Download) */}
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