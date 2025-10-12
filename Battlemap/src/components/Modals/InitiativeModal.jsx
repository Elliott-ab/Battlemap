import React, { useMemo, useState, useEffect } from 'react';
import ModalShell from '../ui/modal/ModalShell.jsx';

const InitiativeModal = ({ isOpen, state, setState, onClose }) => {
  const combatants = useMemo(() => (state.elements || []).filter(el => el.type === 'player' || el.type === 'enemy'), [state.elements]);
  // Store as strings so inputs can be empty while typing; coerce on save
  const [scores, setScores] = useState({});

  useEffect(() => {
    const initial = {};
    for (const c of combatants) {
      const prev = state.initiativeScores?.[c.id];
      initial[c.id] = (prev === undefined || prev === null || Number.isNaN(prev)) ? '' : String(prev);
    }
    setScores(initial);
  }, [combatants, state.initiativeScores]);

  if (!isOpen) return null;

  const handleChange = (id, value) => {
    // Allow empty string while typing
    setScores(prev => ({ ...prev, [id]: value }));
  };

  const handleReset = () => {
    const reset = {};
    for (const c of combatants) reset[c.id] = '0';
    setScores(reset);
  };

  const handleRoll = () => {
    const rolled = {};
    for (const c of combatants) {
      const roll = Math.floor(Math.random() * 20) + 1; // 1-20
      rolled[c.id] = String(roll);
    }
    setScores(rolled);
  };

  const handleSave = () => {
    const toNum = (v) => {
      const n = parseInt(v, 10);
      return Number.isFinite(n) ? n : 0;
    };
    // Determine if all scores are zero; if so, clear order to show "Set Initiative"
    const allZero = combatants.every(c => toNum(scores[c.id]) === 0);
    let order = [];
    if (!allZero) {
      order = [...combatants]
        .sort((a, b) => {
          const sa = toNum(scores[a.id]);
          const sb = toNum(scores[b.id]);
          if (sb !== sa) return sb - sa;
          return a.name.localeCompare(b.name);
        })
        .map(c => c.id);
    }
    const numericScores = Object.fromEntries(
      combatants.map(c => [c.id, toNum(scores[c.id])])
    );
    setState(prev => ({
      ...prev,
      initiativeScores: numericScores,
      initiativeOrder: order,
      currentTurnIndex: 0,
    }));
    try {
      window.dispatchEvent(new CustomEvent('bm-initiative-updated', { detail: { order, scores: numericScores, index: 0 } }));
    } catch {}
    onClose();
  };

  return (
    <ModalShell open={isOpen} title="Set Initiative" onClose={onClose}>
      {combatants.length === 0 ? (
        <div style={{ color: '#aaa' }}>Add characters to set initiative</div>
      ) : (
        <>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '0.5rem' }}>
            <button className="btn btn-outline btn-sm" onClick={handleRoll}>Roll</button>
          </div>
          <div className="initiative-form">
          {[...combatants]
            .sort((a, b) => {
              const toNum = (v) => {
                const n = parseInt(v, 10);
                return Number.isFinite(n) ? n : 0;
              };
              const sa = toNum(scores[a.id]);
              const sb = toNum(scores[b.id]);
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
                gap: '0.4rem',
                marginBottom: '0.4rem',
                border: '1px solid #555',
                borderRadius: '6px',
                padding: '0.35rem 0.6rem',
                backgroundColor: '#383838'
              }}
            >
              <label style={{ minWidth: 120, flex: 1 }}>{c.name}</label>
              <input
                type="number"
                min="0"
                value={scores[c.id] ?? ''}
                onChange={(e) => handleChange(c.id, e.target.value)}
                style={{ width: '80px', marginLeft: 'auto', textAlign: 'right' }}
              />
            </div>
          ))}
          </div>
        </>
      )}
      {combatants.length > 0 && (
        <div className="form-actions" style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
          <button className="btn btn-secondary" onClick={handleReset}>Reset</button>
          <button className="btn btn-primary" onClick={handleSave}>Save</button>
        </div>
      )}
    </ModalShell>
  );
};

export default InitiativeModal;
