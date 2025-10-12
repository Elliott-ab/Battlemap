import React, { useState } from 'react';
import ModalShell from '../ui/modal/ModalShell.jsx';

const SaveModal = ({ isOpen, downloadMap, onClose }) => {
  const [fileName, setFileName] = useState('battle_map.json');

  const handleSubmit = (e) => {
    e.preventDefault();
    downloadMap(fileName);
    onClose();
  };

  if (!isOpen) return null;
  return (
    <ModalShell open={isOpen} title="Save Map" onClose={onClose}>
      <form id="saveForm" onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="fileName">File Name:</label>
          <input type="text" id="fileName" value={fileName} onChange={(e) => setFileName(e.target.value)} />
        </div>
        <div className="form-actions">
          <button type="submit" className="btn btn-primary">Download</button>
        </div>
      </form>
    </ModalShell>
  );
};

export default SaveModal;