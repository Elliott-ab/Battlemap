import React, { useEffect, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTrashCan } from '@fortawesome/free-solid-svg-icons';

const EFFECT_OPTIONS = [
  { id: 'movement', label: 'Movement' },
  { id: 'hp', label: 'HP' },
];

const blankModifier = () => ({
  id: Date.now() + Math.random(),
  name: '',
  category: 'movement',
  applyToPlayers: true,
  applyToEnemies: false,
  enabled: true,
  magnitude: '',
  magnitudeMode: 'plus', // 'plus' | 'minus' | 'percent'
});

const GlobalModifiersModal = ({ isOpen, state, setState, onClose }) => {
  const [mods, setMods] = useState([]);
  const [openMenuId, setOpenMenuId] = useState(null);

  useEffect(() => {
    if (!isOpen) return;
    const existing = Array.isArray(state.globalModifiers) ? state.globalModifiers : [];
  const normalized = existing.map(m => {
      const raw = (m.magnitude ?? '').toString().trim();
      let mode = 'plus';
      let mag = raw;
      if (raw.endsWith('%')) { mode = 'percent'; mag = raw.slice(0, -1); }
      else if (raw.startsWith('-')) { mode = 'minus'; mag = raw.slice(1); }
      else if (raw.startsWith('+')) { mode = 'plus'; mag = raw.slice(1); }
      // keep only up to 2 digits
      mag = (mag.match(/\d{1,2}/)?.[0] || '');
      // Normalize category: drop legacy 'damage' and unknowns to 'movement'
      const allowedCategories = new Set(['movement', 'hp']);
      const normalizedCategory = allowedCategories.has(m.category) ? m.category : 'movement';
      return {
        id: m.id ?? Date.now() + Math.random(),
        name: m.name ?? '',
        category: normalizedCategory,
        applyToPlayers: m.applyToPlayers ?? (m.applyTo ? m.applyTo === 'players' : true),
        applyToEnemies: m.applyToEnemies ?? (m.applyTo ? m.applyTo === 'enemies' : false),
        enabled: m.enabled !== false,
        magnitude: mag,
        magnitudeMode: m.magnitudeMode ?? mode,
      };
    });
    setMods(normalized.length ? normalized : [blankModifier()]);
  }, [isOpen, state.globalModifiers]);

  if (!isOpen) return null;

  const updateMod = (id, patch) => {
    setMods(prev => prev.map(m => (m.id === id ? { ...m, ...patch } : m)));
  };

  const addMod = () => setMods(prev => [...prev, blankModifier()]);

  const removeMod = (id) => {
    setOpenMenuId(prev => (prev === id ? null : prev));
    setMods(prev => {
      const filtered = prev.filter(m => m.id !== id);
      return filtered.length ? filtered : [blankModifier()];
    });
  };

  const handleSave = () => {
    // Persist to global state
    // Persist using explicit booleans for scope to allow both selections
    setState(prev => ({ ...prev, globalModifiers: mods.map(m => ({
      id: m.id,
      name: m.name,
      category: m.category,
      applyToPlayers: !!m.applyToPlayers,
      applyToEnemies: !!m.applyToEnemies,
      enabled: !!m.enabled,
      magnitude: (m.magnitudeMode === 'percent'
        ? `${(m.magnitude || '').trim()}%`
        : `${m.magnitudeMode === 'minus' ? '-' : '+'}${(m.magnitude || '').trim()}`),
      magnitudeMode: m.magnitudeMode, // keep for UI/state
    })) }));
    onClose();
  };

  return (
    <div className="modal" style={{ display: 'block' }}>
  <div className="modal-content wide" onClick={() => setOpenMenuId(null)}>
        <span className="close" onClick={onClose}>&times;</span>
        <h3>Global Modifiers</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {mods.map((m) => (
            <div
              key={m.id}
              className="modifier-card"
              style={{
                display: 'flex', alignItems: 'center', gap: '0.5rem',
                border: '1px solid #555', borderRadius: 6,
                padding: '0.5rem 0.7rem', backgroundColor: '#383838',
                minHeight: 52
              }}
            >
              {/* Remove card button */}
              <button
                type="button"
                onClick={() => removeMod(m.id)}
                title="Remove modifier"
                aria-label="Remove modifier"
                style={{
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#f44336',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 28,
                  height: 28,
                  padding: 0,
                }}
              >
                <FontAwesomeIcon icon={faTrashCan} style={{ color: '#f44336', fontSize: 16 }} />
              </button>
              {/* Name fills available left space */}
              <input
                type="text"
                placeholder="Name"
                value={m.name}
                onChange={(e) => updateMod(m.id, { name: e.target.value })}
                style={{ flex: 1, minWidth: 140 }}
              />
              {/* Right controls grouped */}
              <div className="mod-controls" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                {/* Movement/HP/Damage dropdown */}
                <select
                  value={m.category}
                  onChange={(e) => updateMod(m.id, { category: e.target.value })}
                  style={{ flex: 0, width: 150, minWidth: 130 }}
                >
                  {EFFECT_OPTIONS.map(opt => (
                    <option key={opt.id} value={opt.id}>{opt.label}</option>
                  ))}
                </select>
                {/* Effect magnitude with in-input left affix for mode */}
                <div style={{ position: 'relative', flex: 0 }}>
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder={'0'}
                    title="Enter up to 2 digits"
                    value={m.magnitude}
                    onChange={(e) => {
                      const v = e.target.value;
                      const digits = /^\d{0,2}$/; // 0-99
                      if (v === '' || digits.test(v)) updateMod(m.id, { magnitude: v });
                    }}
                    style={{ width: 70, minWidth: 60, textAlign: 'right', paddingLeft: 32 }}
                  />
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setOpenMenuId(prev => prev === m.id ? null : m.id); }}
                    title="Change mode"
                    className="magnitude-affix-btn magnitude-affix-left"
                  >
                    {m.magnitudeMode === 'percent' ? '%' : (m.magnitudeMode === 'minus' ? '-' : '+')}
                  </button>
                  {openMenuId === m.id && (
                    <div
                      className="magnitude-menu"
                      style={{ position: 'absolute', left: 0, top: '100%', transform: 'translateY(6px)', zIndex: 10 }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      {['plus','minus','percent'].map(mode => (
                        <button
                          key={mode}
                          type="button"
                          className={`magnitude-menu-item ${m.magnitudeMode === mode ? 'active' : ''}`}
                          onClick={() => { updateMod(m.id, { magnitudeMode: mode }); setOpenMenuId(null); }}
                        >
                          {mode === 'percent' ? '%' : (mode === 'minus' ? '-' : '+')}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {/* Divider before players/enemies */}
                <div className="vert-divider" />
                {/* Apply to group: small label to the left of P/E buttons */}
                <div className="apply-to-group" title="Apply to">
                  <div className="apply-to-label">Apply to:</div>
                  <div className="apply-to-buttons">
                    <button
                      type="button"
                      className={`circle-toggle ${m.applyToPlayers ? 'active' : ''}`}
                      onClick={() => updateMod(m.id, { applyToPlayers: !m.applyToPlayers })}
                      aria-label="Apply to Players"
                      title="Players"
                    >
                      P
                    </button>
                    <button
                      type="button"
                      className={`circle-toggle ${m.applyToEnemies ? 'active' : ''}`}
                      onClick={() => updateMod(m.id, { applyToEnemies: !m.applyToEnemies })}
                      aria-label="Apply to Enemies"
                      title="Enemies"
                    >
                      E
                    </button>
                  </div>
                </div>
                {/* Divider before slider */}
                <div className="vert-divider" />
                <label className="switch" title={m.enabled ? 'Enabled' : 'Disabled'}>
                  <input
                    type="checkbox"
                    checked={!!m.enabled}
                    onChange={(e) => updateMod(m.id, { enabled: e.target.checked })}
                  />
                  <span className="slider" />
                </label>
              </div>
            </div>
          ))}
          <button className="btn btn-outline btn-sm" onClick={addMod}>+ add modifier</button>
        </div>
        <div className="form-actions" style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
          <button className="btn btn-primary" onClick={handleSave}>Save</button>
        </div>
      </div>
    </div>
  );
};

export default GlobalModifiersModal;
