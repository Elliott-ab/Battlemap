import React, { useState } from 'react';

const SaveModal = ({ isOpen, downloadMap, onClose }) => {
  const [fileName, setFileName] = useState('battle_map.json');

  const handleSubmit = (e) => {
    e.preventDefault();
    downloadMap(fileName);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="modal" style={{ display: 'block' }}>
      <div className="modal-content">
        <span className="close" onClick={onClose}>&times;</span>
        <h3>Save Map</h3>
        <form id="saveForm" onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="fileName">File Name:</label>
            <input type="text" id="fileName" value={fileName} onChange={(e) => setFileName(e.target.value)} />
          </div>
          <div className="form-actions">
            <button type="submit" className="btn btn-primary">Download</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SaveModal;