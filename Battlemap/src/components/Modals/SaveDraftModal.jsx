import React, { useEffect, useState } from 'react';
import ModalShell from '../ui/modal/ModalShell.jsx';

const SaveDraftModal = ({ isOpen, onClose, onSave, title = 'Save Map' }) => {
  const [name, setName] = useState('');
  useEffect(() => {
    if (isOpen) setName('');
  }, [isOpen]);

  return (
    <ModalShell open={isOpen} title={title} onClose={onClose} size="small" actions={(
      <>
        <button className="btn btn-primary" disabled={!name.trim()} onClick={() => onSave(name.trim())}>Save</button>
        <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
      </>
    )}>
      <div className="form-group">
        <label htmlFor="draftName">Map Name</label>
        <input id="draftName" type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Goblin Caves" />
      </div>
    </ModalShell>
  );
};

export default SaveDraftModal;
