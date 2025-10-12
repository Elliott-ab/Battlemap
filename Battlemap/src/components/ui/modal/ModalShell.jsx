import React from 'react';

// Minimal shell to unify in-house modal markup (non-MUI), preserving current styles.
// Props: open, title, onClose, children, size ('small' | undefined), actions (ReactNode)
export default function ModalShell({ open, title, onClose, children, actions, size }) {
  if (!open) return null;
  return (
    <div className="modal" style={{ display: 'block' }}>
      <div className={`modal-content${size === 'small' ? ' small' : ''}`}>
        <span className="close" onClick={onClose}>&times;</span>
        {title ? <h3>{title}</h3> : null}
        {children}
        {actions ? (
          <div className="form-actions">
            {actions}
          </div>
        ) : null}
      </div>
    </div>
  );
}
