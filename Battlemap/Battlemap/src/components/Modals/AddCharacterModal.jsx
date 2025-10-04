import React, { useState, useEffect } from 'react';

const AddCharacterModal = ({ isOpen, onClose, onAdd, initialType = 'player', initialQuantity = 1 }) => {
  const [characterType, setCharacterType] = useState(initialType);
  // Keep quantity as a string to allow temporary empty input while typing
  const [quantity, setQuantity] = useState(String(initialQuantity));

  const clampQuantity = (val) => {
    const n = parseInt(val, 10);
    if (isNaN(n) || n < 1) return '1';
    if (n > 20) return '20';
    return String(n);
  };

  const handleQuantityChange = (e) => {
    const val = e.target.value;
    if (val === '' || /^\d*$/.test(val)) {
      setQuantity(val);
    }
  };

  const handleQuantityBlur = () => {
    setQuantity(prev => clampQuantity(prev));
  };

  useEffect(() => {
    if (isOpen) {
      setQuantity('1');
      setCharacterType(initialType);
    }
  }, [isOpen, initialType]);

  if (!isOpen) return null;

  return (
    <div className="modal" style={{ display: 'block' }}>
      <div className="modal-content small">
        <span className="close" onClick={onClose}>&times;</span>
        <h3>Add Character Elements</h3>
        <div className="form-group">
          <label>Type:</label>
          <select value={characterType} onChange={e => setCharacterType(e.target.value)}>
            <option value="player">Player</option>
            <option value="enemy">Enemy</option>
          </select>
        </div>
        <div className="form-group">
          <label>Quantity:</label>
          <input
            type="number"
            min={1}
            max={20}
            value={quantity}
            onChange={handleQuantityChange}
            onBlur={handleQuantityBlur}
          />
        </div>
        <div className="form-actions">
          <button
            className="btn btn-primary"
            onClick={() => {
              const n = parseInt(quantity, 10);
              const safe = isNaN(n) ? 1 : Math.max(1, Math.min(20, n));
              onAdd(characterType, safe);
            }}
          >
            Add
          </button>
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
};

export default AddCharacterModal;
