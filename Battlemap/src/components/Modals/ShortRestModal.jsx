import React, { useEffect, useState } from 'react';

export default function ShortRestModal({ open, onClose, onConfirm, maxHp = 0, currentHp = 0, name = 'You' }) {
  const [value, setValue] = useState('');

  useEffect(() => {
    if (open) setValue('');
  }, [open]);

  if (!open) return null;

  const handleConfirm = () => {
    const n = parseInt((value || '').toString().trim(), 10);
    const heal = Number.isFinite(n) ? Math.max(0, n) : 0;
    onConfirm && onConfirm(heal);
  };

  return (
    <div className="modal" style={{ display: 'block' }}>
      <div className="modal-content" style={{ maxWidth: 360 }}>
        <span className="close" onClick={onClose}>&times;</span>
  <h3>Recover HP</h3>
        <div style={{ color: '#ccc', marginBottom: '0.75rem' }}>
          {name} regains HP equal to the number rolled + constitution modifier (up to max HP).
        </div>
        <label style={{ display: 'block', marginBottom: 6 }}>HP to regain</label>
        <input
          type="number"
          min="0"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleConfirm(); } }}
          style={{ width: '100%', padding: '0.5rem', borderRadius: 4, border: '1px solid #666', background: '#2f2f2f', color: '#fff' }}
        />
        <div className="form-actions" style={{ display: 'flex', gap: 8, marginTop: 12, justifyContent: 'flex-end' }}>
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleConfirm}>Confirm</button>
        </div>
        <div style={{ marginTop: 8, fontSize: '0.8rem', color: '#aaa' }}>
          Current: {currentHp} / {maxHp}
        </div>
      </div>
    </div>
  );
}
