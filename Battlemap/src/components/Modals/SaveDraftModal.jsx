import React, { useEffect, useState } from 'react';

const SaveDraftModal = ({ isOpen, onClose, onSave, title = 'Save Map' }) => {
  const [name, setName] = useState('');
  useEffect(() => {
    if (isOpen) setName('');
  }, [isOpen]);

  if (!isOpen) return null;
  return (
    <div className="modal" style={{ display: 'block' }}>
      <div className="modal-content small">
        <span className="close" onClick={onClose}>&times;</span>
  <h3>{title}</h3>
        <div className="form-group">
          <label htmlFor="draftName">Map Name</label>
          <input id="draftName" type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Goblin Caves" />
        </div>
        <div className="form-actions">
          <button className="btn btn-primary" disabled={!name.trim()} onClick={() => onSave(name.trim())}>Save</button>
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
};

export default SaveDraftModal;
