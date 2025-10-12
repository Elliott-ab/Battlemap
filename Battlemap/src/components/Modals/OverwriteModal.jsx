import React from 'react';
import ModalShell from '../ui/modal/ModalShell.jsx';

const OverwriteModal = ({ isOpen, uploadInputRef, uploadMap, onClose }) => {
  return (
    <ModalShell open={isOpen} title="Overwrite Map?" onClose={onClose} actions={(
      <>
        <button className="btn btn-primary" id="confirmUpload" onClick={() => { uploadInputRef.current.click(); onClose(); }}>
          Yes
        </button>
        <button className="btn btn-danger" onClick={onClose}>No</button>
      </>
    )}>
      <p>Uploading a map will overwrite your current map. Continue?</p>
    </ModalShell>
  );
};

export default OverwriteModal;