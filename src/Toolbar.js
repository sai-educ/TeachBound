// src/Toolbar.js
import React from 'react';
import './Toolbar.css';
import { PenTool, Eraser, StickyNote as StickyNoteIcon, Palette, Minus, Plus } from 'lucide-react';

const ACCESSIBLE_COLORS = [
  { name: 'Black', value: '#000000' }, { name: 'Red', value: '#D90429' },
  { name: 'Blue', value: '#0077B6' }, { name: 'Green', value: '#06A77D' },
  { name: 'Purple', value: '#7209B7' },
];

const LINE_WIDTHS = [
  { label: 'Thin', value: 2 },
  { label: 'Medium', value: 5 },
  { label: 'Thick', value: 10 },
  { label: 'Extra Thick', value: 20 },
];

const Toolbar = ({
  selectedTool, setSelectedTool,
  strokeColor, setStrokeColor,
  lineWidth, setLineWidth,
  // addElement prop is removed as Canvas will call onDrawingComplete from App.js
}) => {
  const tools = [
    { name: 'pen', icon: <PenTool size={18} className="tool-icon" />, label: 'Pen' },
    { name: 'eraser', icon: <Eraser size={18} className="tool-icon" />, label: 'Eraser' },
    { name: 'sticky', icon: <StickyNoteIcon size={18} className="tool-icon" />, label: 'Sticky Note' },
  ];

  return (
    <div className="toolbar-container">
      <div className="tool-selection">
        {tools.map((tool) => (
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

      <div className="tool-options-group">
        <span className="options-label"><Palette size={16} style={{ color: strokeColor }} /> Colors:</span>
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

      <div className="tool-options-group">
        <span className="options-label">Line:</span>
        <div className="line-width-selection">
          {LINE_WIDTHS.map((widthOption) => (
            <button
              key={widthOption.value}
              className={`tool-button line-width-button ${lineWidth === widthOption.value ? 'active' : ''}`}
              onClick={() => setLineWidth(widthOption.value)}
              title={widthOption.label}
            >
              {/* Visual representation of line width */}
              <span style={{
                display: 'inline-block',
                width: '20px',
                height: `${widthOption.value}px`,
                maxHeight: '15px', // cap visual height
                backgroundColor: strokeColor,
                borderRadius: '2px',
                opacity: widthOption.value <= 15 ? 1 : 0.7
              }}></span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Toolbar;