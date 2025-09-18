import React from 'react';

const OverwriteModal = ({ isOpen, uploadInputRef, uploadMap, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="modal" style={{ display: 'block' }}>
      <div className="modal-content">
        <span className="close" onClick={onClose}>&times;</span>
        <h3>Overwrite Map?</h3>
        <p>Uploading a map will overwrite your current map. Continue?</p>
        <div className="form-actions">
          <button className="btn btn-primary" id="confirmUpload" onClick={() => { uploadInputRef.current.click(); onClose(); }}>
            Yes
          </button>
          <button className="btn btn-danger" onClick={onClose}>No</button>
        </div>
      </div>
    </div>
  );
};

export default OverwriteModal;