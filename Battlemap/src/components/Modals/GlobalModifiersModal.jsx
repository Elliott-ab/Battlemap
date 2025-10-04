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

const GlobalModifiersModal = ({ isOpen, state, setState, onClose, isHost = false }) => {
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
    if (!isHost) return; // read-only for players
    setMods(prev => prev.map(m => (m.id === id ? { ...m, ...patch } : m)));
  };

  const addMod = () => { if (isHost) setMods(prev => [...prev, blankModifier()]); };

  const removeMod = (id) => {
    if (!isHost) return;
    setOpenMenuId(prev => (prev === id ? null : prev));
    setMods(prev => {
      const filtered = prev.filter(m => m.id !== id);
      return filtered.length ? filtered : [blankModifier()];
    });
  };

  const handleSave = () => {
    if (!isHost) return onClose();
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
        <h3>Global Modifiers{!isHost ? ' (view only)' : ''}</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {mods.map((m) => (
            <React.Fragment key={m.id}>
              {/* Desktop layout (original single-row) */}
              <div
                className="modifier-card only-desktop"
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.5rem',
                  border: '1px solid #555', borderRadius: 6,
                  padding: '0.5rem 0.7rem', backgroundColor: '#383838',
                  minHeight: 52,
                }}
              >
                {/* Remove card button (left) */}
                <button
                  type="button"
                  onClick={() => removeMod(m.id)}
                  title="Remove modifier"
                  aria-label="Remove modifier"
                  style={{
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    color: isHost ? '#f44336' : '#777',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 28,
                    height: 28,
                    padding: 0,
                  }}
                  disabled={!isHost}
                >
                  <FontAwesomeIcon icon={faTrashCan} style={{ color: isHost ? '#f44336' : '#777', fontSize: 16 }} />
                </button>
                {/* Name fills available left space */}
                <input
                  type="text"
                  placeholder="Name"
                  value={m.name}
                  onChange={(e) => updateMod(m.id, { name: e.target.value })}
                  style={{ flex: 1, minWidth: 140 }}
                  disabled={!isHost}
                />
                {/* Right controls grouped */}
                <div className="mod-controls" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  {/* Category dropdown */}
                  <select
                    value={m.category}
                    onChange={(e) => updateMod(m.id, { category: e.target.value })}
                    style={{ flex: 0, width: 150, minWidth: 130 }}
                    disabled={!isHost}
                  >
                    {EFFECT_OPTIONS.map(opt => (
                      <option key={opt.id} value={opt.id}>{opt.label}</option>
                    ))}
                  </select>
                  {/* Magnitude */}
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
                      disabled={!isHost}
                    />
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); if (!isHost) return; setOpenMenuId(prev => prev === m.id ? null : m.id); }}
                      title="Change mode"
                      className="magnitude-affix-btn magnitude-affix-left"
                      disabled={!isHost}
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
                            onClick={() => { if (!isHost) return; updateMod(m.id, { magnitudeMode: mode }); setOpenMenuId(null); }}
                            disabled={!isHost}
                          >
                            {mode === 'percent' ? '%' : (mode === 'minus' ? '-' : '+')}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="vert-divider" />
                  {/* Apply to */}
                  <div className="apply-to-group" title="Apply to">
                    <div className="apply-to-label">Apply to:</div>
                    <div className="apply-to-buttons">
                      <button
                        type="button"
                        className={`circle-toggle ${m.applyToPlayers ? 'active' : ''}`}
                        onClick={() => updateMod(m.id, { applyToPlayers: !m.applyToPlayers })}
                        aria-label="Apply to Players"
                        title="Players"
                        disabled={!isHost}
                      >
                        P
                      </button>
                      <button
                        type="button"
                        className={`circle-toggle ${m.applyToEnemies ? 'active' : ''}`}
                        onClick={() => updateMod(m.id, { applyToEnemies: !m.applyToEnemies })}
                        aria-label="Apply to Enemies"
                        title="Enemies"
                        disabled={!isHost}
                      >
                        E
                      </button>
                    </div>
                  </div>
                  <div className="vert-divider" />
                  <label className="switch" title={m.enabled ? 'Enabled' : 'Disabled'}>
                    <input
                      type="checkbox"
                      checked={!!m.enabled}
                      onChange={(e) => updateMod(m.id, { enabled: e.target.checked })}
                      disabled={!isHost}
                    />
                    <span className="slider" />
                  </label>
                </div>
              </div>

              {/* Mobile layout (stacked rows) */}
              <div
                className="modifier-card only-mobile"
                style={{
                  display: 'flex', flexDirection: 'column', gap: '0.5rem',
                  border: '1px solid #555', borderRadius: 6,
                  padding: '0.5rem 0.7rem', backgroundColor: '#383838',
                }}
              >
                {/* Top row: Name + Enabled switch */}
                <div className="mod-row mod-row--top" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <input
                    type="text"
                    className="mod-name"
                    placeholder="Name"
                    value={m.name}
                    onChange={(e) => updateMod(m.id, { name: e.target.value })}
                    style={{ flex: 1, minWidth: 140 }}
                    disabled={!isHost}
                  />
                  <label className="switch" title={m.enabled ? 'Enabled' : 'Disabled'}>
                    <input
                      type="checkbox"
                      checked={!!m.enabled}
                      onChange={(e) => updateMod(m.id, { enabled: e.target.checked })}
                      disabled={!isHost}
                    />
                    <span className="slider" />
                  </label>
                </div>
                {/* Middle row: Select + Magnitude + Apply icons */}
                <div className="mod-row mod-row--mid" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <select
                    className="mod-select"
                    value={m.category}
                    onChange={(e) => updateMod(m.id, { category: e.target.value })}
                    style={{ flex: 1, minWidth: 130 }}
                    disabled={!isHost}
                  >
                    {EFFECT_OPTIONS.map(opt => (
                      <option key={opt.id} value={opt.id}>{opt.label}</option>
                    ))}
                  </select>
                  <div className="magnitude-wrap" style={{ position: 'relative' }}>
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
                      style={{ width: 80, minWidth: 70, textAlign: 'right', paddingLeft: 32 }}
                      disabled={!isHost}
                    />
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); if (!isHost) return; setOpenMenuId(prev => prev === m.id ? null : m.id); }}
                      title="Change mode"
                      className="magnitude-affix-btn magnitude-affix-left"
                      disabled={!isHost}
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
                            onClick={() => { if (!isHost) return; updateMod(m.id, { magnitudeMode: mode }); setOpenMenuId(null); }}
                            disabled={!isHost}
                          >
                            {mode === 'percent' ? '%' : (mode === 'minus' ? '-' : '+')}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="apply-icons" title="Apply to" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                    <button
                      type="button"
                      className={`circle-toggle ${m.applyToPlayers ? 'active' : ''}`}
                      onClick={() => updateMod(m.id, { applyToPlayers: !m.applyToPlayers })}
                      aria-label="Apply to Players"
                      title="Players"
                      disabled={!isHost}
                    >
                      P
                    </button>
                    <button
                      type="button"
                      className={`circle-toggle ${m.applyToEnemies ? 'active' : ''}`}
                      onClick={() => updateMod(m.id, { applyToEnemies: !m.applyToEnemies })}
                      aria-label="Apply to Enemies"
                      title="Enemies"
                      disabled={!isHost}
                    >
                      E
                    </button>
                  </div>
                </div>
                {/* Bottom row: Delete centered */}
                <div className="mod-row mod-row--bottom" style={{ display: 'flex', justifyContent: 'center' }}>
                  <button
                    type="button"
                    onClick={() => removeMod(m.id)}
                    title="Remove modifier"
                    aria-label="Remove modifier"
                    style={{
                      background: 'transparent',
                      border: '1px solid #555',
                      borderRadius: 6,
                      padding: '6px 10px',
                      color: isHost ? '#f44336' : '#777',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      cursor: isHost ? 'pointer' : 'default',
                    }}
                    disabled={!isHost}
                  >
                    <FontAwesomeIcon icon={faTrashCan} style={{ color: isHost ? '#f44336' : '#777', fontSize: 16 }} />
                    <span>Delete</span>
                  </button>
                </div>
              </div>
            </React.Fragment>
          ))}
          {isHost && (
            <button className="btn btn-outline btn-sm" onClick={addMod}>+ add modifier</button>
          )}
        </div>
        <div className="form-actions" style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
          <button className="btn btn-primary" onClick={handleSave} disabled={!isHost}>Save</button>
        </div>
      </div>
    </div>
  );
};

export default GlobalModifiersModal;
