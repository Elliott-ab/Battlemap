import React from 'react';

const LoadDraftModal = ({ isOpen, onClose, drafts = [], onSelect, title = 'Load Map', emptyText = 'No saved maps yet.' }) => {
  if (!isOpen) return null;
  return (
    <div className="modal" style={{ display: 'block' }}>
      <div className="modal-content small">
        <span className="close" onClick={onClose}>&times;</span>
  <h3>{title}</h3>
        <div className="form-group" style={{ maxHeight: 260, overflow: 'auto', border: '1px solid #333', borderRadius: 6 }}>
          {drafts.length === 0 && (
            <div style={{ padding: 12, color: '#aaa' }}>{emptyText}</div>
          )}
          {drafts.map((d) => (
            <button
              key={d.id || d.name}
              className="menu-item"
              style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}
              onClick={() => onSelect(d)}
            >
              <span>{d.name}</span>
              {d.updated_at && <small style={{ opacity: 0.7 }}>{new Date(d.updated_at).toLocaleString()}</small>}
            </button>
          ))}
        </div>
        <div className="form-actions">
          <button className="btn btn-secondary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
};

export default LoadDraftModal;
