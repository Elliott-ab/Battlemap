import React, { useMemo, useState, useEffect } from 'react';

const InitiativeModal = ({ isOpen, state, setState, onClose }) => {
  const combatants = useMemo(() => (state.elements || []).filter(el => el.type === 'player' || el.type === 'enemy'), [state.elements]);
  const [scores, setScores] = useState({});

  useEffect(() => {
    const initial = {};
    for (const c of combatants) {
      const prev = state.initiativeScores?.[c.id] ?? 0;
      initial[c.id] = prev;
    }
    setScores(initial);
  }, [combatants, state.initiativeScores]);

  if (!isOpen) return null;

  const handleChange = (id, value) => {
    const num = parseInt(value || '0', 10);
    setScores(prev => ({ ...prev, [id]: isNaN(num) ? 0 : num }));
  };

  const handleReset = () => {
    const reset = {};
    for (const c of combatants) reset[c.id] = 0;
    setScores(reset);
  };

  const handleSave = () => {
    // Determine if all scores are zero; if so, clear order to show "Set Initiative"
    const allZero = combatants.every(c => (scores[c.id] ?? 0) === 0);
    let order = [];
    if (!allZero) {
      order = [...combatants]
        .sort((a, b) => {
          const sa = scores[a.id] ?? 0;
          const sb = scores[b.id] ?? 0;
          if (sb !== sa) return sb - sa;
          return a.name.localeCompare(b.name);
        })
        .map(c => c.id);
    }

    setState(prev => ({
      ...prev,
      initiativeScores: { ...scores },
      initiativeOrder: order,
      currentTurnIndex: 0,
    }));
    onClose();
  };

  return (
    <div className="modal" style={{ display: 'block' }}>
      <div className="modal-content">
        <span className="close" onClick={onClose}>&times;</span>
        <h3>Set Initiative</h3>
        {combatants.length === 0 ? (
          <div style={{ color: '#aaa' }}>No players or enemies available.</div>
        ) : (
          <div className="initiative-form">
            {[...combatants]
              .sort((a, b) => {
                const sa = scores[a.id] ?? 0;
                const sb = scores[b.id] ?? 0;
                if (sb !== sa) return sb - sa;
                return a.name.localeCompare(b.name);
              })
              .map(c => (
              <div
                className="form-group"
                key={c.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  marginBottom: '0.5rem',
                  border: '1px solid #555',
                  borderRadius: '6px',
                  padding: '0.5rem 0.75rem',
                  backgroundColor: '#383838'
                }}
              >
                <label style={{ minWidth: 140, flex: 1 }}>{c.name}</label>
                <input
                  type="number"
                  min="0"
                  value={scores[c.id] ?? 0}
                  onChange={(e) => handleChange(c.id, e.target.value)}
                  style={{ width: '80px', marginLeft: 'auto', textAlign: 'right' }}
                />
              </div>
            ))}
          </div>
        )}
        <div className="form-actions" style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
          <button className="btn btn-secondary" onClick={handleReset}>Reset</button>
          <button className="btn btn-primary" onClick={handleSave}>Save</button>
        </div>
      </div>
    </div>
  );
};

export default InitiativeModal;
