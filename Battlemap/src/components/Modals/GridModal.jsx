import React, { useState, useEffect } from 'react';

const GridModal = ({ isOpen, state, setState, pushUndo, onClose }) => {
  const [formData, setFormData] = useState({
    gridWidth: state.grid.width,
    gridHeight: state.grid.height,
    cellSize: state.grid.cellSize,
  });

  useEffect(() => {
    setFormData({
      gridWidth: state.grid.width,
      gridHeight: state.grid.height,
      cellSize: state.grid.cellSize,
    });
  }, [state.grid]);

  const handleSubmit = (e) => {
    e.preventDefault();
    setState(prev => ({
      ...prev,
      grid: {
        width: parseInt(formData.gridWidth),
        height: parseInt(formData.gridHeight),
        cellSize: parseInt(formData.cellSize),
      },
    }));
    pushUndo();
    onClose();
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  if (!isOpen) return null;

  return (
    <div className="modal" style={{ display: 'block' }}>
      <div className="modal-content">
        <span className="close" onClick={onClose}>&times;</span>
        <h3>Grid Settings</h3>
        <form id="gridForm" onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="gridWidth">Grid Width:</label>
            <input type="number" id="gridWidth" name="gridWidth" value={formData.gridWidth} onChange={handleChange} />
          </div>
          <div className="form-group">
            <label htmlFor="gridHeight">Grid Height:</label>
            <input type="number" id="gridHeight" name="gridHeight" value={formData.gridHeight} onChange={handleChange} />
          </div>
          <div className="form-group">
            <label htmlFor="cellSize">Cell Size (feet):</label>
            <select id="cellSize" name="cellSize" value={formData.cellSize} onChange={handleChange}>
              <option value="5">5 feet</option>
              <option value="10">10 feet</option>
            </select>
          </div>
          <div className="form-actions">
            <button type="submit" className="btn btn-primary">Apply Settings</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default GridModal;