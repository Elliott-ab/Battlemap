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
    // Allow empty string while editing, or digits only
    if (val === '' || /^\d*$/.test(val)) {
      setQuantity(val);
    }
  };

  const handleQuantityBlur = () => {
    setQuantity(prev => clampQuantity(prev));
  };

  // Always reset quantity to 1 whenever the modal opens
  useEffect(() => {
    if (isOpen) {
      setQuantity('1');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100vw',
      height: '100vh',
      background: 'rgba(0,0,0,0.35)',
      zIndex: 200,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      <div style={{
        background: '#222',
        color: 'white',
        borderRadius: '14px',
        boxShadow: '0 2px 16px rgba(0,0,0,0.25)',
        padding: '2em 1.5em',
        minWidth: '260px',
        maxWidth: '95vw',
        width: '340px',
        fontSize: '1.1em',
      }}>
        <h2 style={{marginTop:0, marginBottom:'1em', fontSize:'1.3em'}}>Add Character Elements</h2>
        <div style={{ marginBottom: '1em', display: 'flex', flexDirection: 'column', gap: '0.7em' }}>
          <label style={{ fontWeight: 500 }}>Type:</label>
          <select
            value={characterType}
            onChange={e => setCharacterType(e.target.value)}
            style={{ background: '#333', color: 'white', border: 'none', borderRadius: '6px', padding: '0.5em', fontSize: '1em', width: '100%' }}
          >
            <option value="player">Player</option>
            <option value="enemy">Enemy</option>
          </select>
        </div>
        <div style={{ marginBottom: '1em', display: 'flex', flexDirection: 'column', gap: '0.7em' }}>
          <label style={{ fontWeight: 500 }}>Quantity:</label>
          <input
            type="number"
            min={1}
            max={20}
            value={quantity}
            onChange={handleQuantityChange}
            onBlur={handleQuantityBlur}
            className="no-spinner"
            style={{ width: '100%', background: '#333', color: 'white', border: 'none', borderRadius: '6px', padding: '0.5em', fontSize: '1em' }}
          />
        </div>
        <div style={{ display: 'flex', gap: '1em', justifyContent: 'flex-end', marginTop: '1em' }}>
          <button
            onClick={() => {
              // Validate and clamp before adding
              const n = parseInt(quantity, 10);
              const safe = isNaN(n) ? 1 : Math.max(1, Math.min(20, n));
              onAdd(characterType, safe);
            }}
            style={{ background: '#4CAF50', color: 'white', border: 'none', borderRadius: '6px', padding: '0.6em 1.2em', fontSize: '1em', cursor: 'pointer' }}
          >
            Add
          </button>
          <button
            onClick={onClose}
            style={{ background: '#888', color: 'white', border: 'none', borderRadius: '6px', padding: '0.6em 1.2em', fontSize: '1em', cursor: 'pointer' }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export default AddCharacterModal;
