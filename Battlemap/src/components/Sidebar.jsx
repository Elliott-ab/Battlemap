import React, { useState } from 'react';
import IconButton from './common/IconButton.jsx';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSkull, faWandSparkles, faChevronRight, faAnglesLeft, faAnglesRight, faAnglesUp, faAnglesDown } from '@fortawesome/free-solid-svg-icons';
import {
  faSquare as faSquareRegular,
  faEye as faEyeRegular,
  faUser as faUserRegular,
  faSquareCaretUp as faSquareCaretUpRegular,
  faPenToSquare as faPenToSquareRegular,
  faCircleLeft as faCircleLeftRegular,
  faCircleRight as faCircleRightRegular,
} from '@fortawesome/free-regular-svg-icons';
import { computeGreyFractionForCell } from '../Utils/visibility.js';
import { clearMovementAndSelection } from '../Utils/highlights.js';
import InlineNumberEditor from './common/InlineNumberEditor.jsx';
//

// Using Font Awesome icons for UI controls

const Sidebar = ({ state, setState, toggleMovementHighlight, highlightCoverGroup, showEditModal, battleMapRef, isDrawingCover, toggleDrawingMode, openAddCharacterModal, openInitiativeModal, drawEnvType, setDrawEnvType, onOpenMyCharacterSheet, currentUserId }) => {
  console.log('Sidebar received battleMapRef:', battleMapRef);

  // Collapsible sections state
  const [creaturesOpen, setCreaturesOpen] = useState(true);
  const [envOpen, setEnvOpen] = useState(true);
  const prevCreatureCountRef = React.useRef(null);
  // Whole sidebar collapse state (affects height on mobile/portrait and width on desktop)
  const [collapsed, setCollapsed] = useState(false);
  const [isPortraitPhone, setIsPortraitPhone] = useState(false);

  // Default to collapsed on narrow screens to save space
  React.useEffect(() => {
    try {
      if (typeof window !== 'undefined' && window.innerWidth <= 768) {
        setCollapsed(true);
      }
    } catch {}
  }, []);

  // Reflect collapsed state on body so toolbar can adapt widths on desktop/landscape
  React.useEffect(() => {
    try {
      const cls = 'app--sidebar-collapsed';
      if (collapsed) {
        document.body.classList.add(cls);
      } else {
        document.body.classList.remove(cls);
      }
      return () => document.body.classList.remove(cls);
    } catch {}
  }, [collapsed]);

  // Track whether we're on a portrait phone (<=768px and portrait orientation)
  React.useEffect(() => {
    try {
      if (typeof window === 'undefined') return;
      const mqPortrait = window.matchMedia('(orientation: portrait)');
      const compute = () => setIsPortraitPhone(window.innerWidth <= 768 && mqPortrait.matches);
      compute();
      const onResize = () => compute();
      window.addEventListener('resize', onResize);
      if (mqPortrait.addEventListener) mqPortrait.addEventListener('change', compute);
      else if (mqPortrait.addListener) mqPortrait.addListener(compute);
      return () => {
        window.removeEventListener('resize', onResize);
        if (mqPortrait.removeEventListener) mqPortrait.removeEventListener('change', compute);
        else if (mqPortrait.removeListener) mqPortrait.removeListener(compute);
      };
    } catch {}
  }, []);

  // Expand Creatures and collapse Environments when new players/enemies are added
  React.useEffect(() => {
    try {
      const elements = Array.isArray(state.elements) ? state.elements : [];
      const creatureCount = elements.reduce((acc, el) => acc + ((el.type === 'player' || el.type === 'enemy') ? 1 : 0), 0);
      if (prevCreatureCountRef.current == null) {
        // initialize on first run
        prevCreatureCountRef.current = creatureCount;
        return;
      }
      if (creatureCount > prevCreatureCountRef.current) {
        // New creature(s) added
        if (!creaturesOpen) setCreaturesOpen(true);
        if (envOpen) setEnvOpen(false);
      }
      prevCreatureCountRef.current = creatureCount;
    } catch {}
  }, [state.elements, creaturesOpen, envOpen]);

  // Initiative UI moved to modal-driven approach in Sidebar header (no drag & drop)
  const hasCharacters = (state.elements || []).some(e => e.type === 'player' || e.type === 'enemy');
  const initiativeSet = (state.initiativeOrder || []).length > 0;

  const coverGroups = {};
  state.elements.forEach((el) => {
    if (el.type === 'cover' && el.groupId) {
      if (!coverGroups[el.groupId]) {
        coverGroups[el.groupId] = { coverType: el.coverType, positions: [], firstId: el.id, color: el.color || '#795548' };
      }
      coverGroups[el.groupId].positions.push(el.position);
    }
  });
  // Label generator for cover types
  const coverTypeLabel = (t) => {
    switch (t) {
      case 'half': return 'Half Cover';
      case 'three-quarters': return 'Three Quarter Cover';
      case 'full': return 'Full Cover';
      case 'difficult': return 'Difficult Terrain';
      default: return 'Cover';
    }
  };
  // Also compute grouped lists for ordering in the Sidebar
  const elementsArr = state.elements || [];
  const playersList = elementsArr.filter(e => e.type === 'player');
  const enemiesList = elementsArr.filter(e => e.type === 'enemy');
  const ungroupedCovers = elementsArr.filter(e => e.type === 'cover' && !e.groupId);

  // Visibility for player cards is computed via shared utility for consistency

  const getHpClass = (currentHp, maxHp) => {
    if (currentHp <= 0) return 'unconscious';
    if (currentHp < maxHp * 0.25) return 'critical';
    if (currentHp < maxHp * 0.5) return 'bloodied';
    return 'healthy';
  };

  // Apply enabled Global Modifiers of category 'hp' to an element's current HP for display only
  const applyHpModifiers = (baseHp, el) => {
    try {
      const mods = Array.isArray(state.globalModifiers) ? state.globalModifiers : [];
      if (!mods.length) return baseHp;
      const applicable = mods.filter(m => m && m.enabled && m.category === 'hp' && (
        (el.type === 'player' && m.applyToPlayers) || (el.type === 'enemy' && m.applyToEnemies)
      ));
      if (!applicable.length) return baseHp;
      let add = 0;
      let mult = 1;
      for (const m of applicable) {
        const raw = (m.magnitude ?? '').toString();
        const num = parseInt(raw.replace(/[^0-9]/g, ''), 10);
        if (!Number.isFinite(num)) continue;
        const mode = m.magnitudeMode || (raw.endsWith('%') ? 'percent' : (raw.trim().startsWith('-') ? 'minus' : 'plus'));
        if (mode === 'percent') {
          mult *= (num / 100); // e.g., 50% -> half HP
        } else if (mode === 'minus') {
          add -= num;
        } else {
          add += num;
        }
      }
      let value = baseHp + add;
      value = Math.floor(value * mult);
      const maxHp = typeof el.maxHp === 'number' ? el.maxHp : undefined;
      if (typeof maxHp === 'number') value = Math.min(value, maxHp);
      return Math.max(0, value);
    } catch {
      return baseHp;
    }
  };

  // Determine current turn element id if initiative is set
  const order = state.initiativeOrder || [];
  const currentTurnId = order.length ? order[(state.currentTurnIndex || 0) % order.length] : null;

  // Inline damage entry for players (subtract HP) and enemies (accumulate Damage)
  const [damageEdit, setDamageEdit] = useState({ targetId: null, targetType: null, value: '' });
  const openDamageEdit = (targetId, targetType) => {
    clearMovementAndSelection(battleMapRef, setState);
    setDamageEdit({ targetId, targetType, value: '' });
  };
  const cancelDamageEdit = () => setDamageEdit({ targetId: null, targetType: null, value: '' });
  const applyDamageEdit = () => {
    const dmg = parseInt((damageEdit.value || '').toString().trim(), 10);
    if (!Number.isFinite(dmg) || dmg <= 0) { cancelDamageEdit(); return; }
    setState(prev => ({
      ...prev,
      elements: (prev.elements || []).map(el => {
        if (el.id !== damageEdit.targetId) return el;
        if (damageEdit.targetType === 'player' && el.type === 'player') {
          return { ...el, currentHp: Math.max(0, (el.currentHp || 0) - dmg) };
        }
        if (damageEdit.targetType === 'enemy' && el.type === 'enemy') {
          return { ...el, damage: (el.damage || 0) + dmg };
        }
        return el;
      }),
    }));
    cancelDamageEdit();
  };


  // De-duplicated: character adding is centralized in App via AddCharacterModal

  // When drawing mode starts, expand Environments and collapse Creatures
  React.useEffect(() => {
    if (isDrawingCover) {
      setEnvOpen(true);
      setCreaturesOpen(false);
    }
  }, [isDrawingCover]);

  return (
    <aside className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
      <div className="sidebar-body">
        {/* Turn controls (initiative) */}
        <div className={isDrawingCover ? 'disabled-while-drawing' : ''} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', marginBottom: '0.75rem', width: '100%' }}>
        {initiativeSet && (
          <IconButton size="small" title="Previous Turn" onClick={() => {
            setState(prev => {
              const len = (prev.initiativeOrder || []).length;
              if (!len) return prev;
              const prevIdx = ((prev.currentTurnIndex || 0) - 1 + len) % len;
              return { ...prev, currentTurnIndex: prevIdx };
            });
          }}>
            <FontAwesomeIcon icon={faCircleLeftRegular} style={{ color: 'white' }} />
          </IconButton>
        )}
        <div
          className="turn-box"
          style={{ cursor: 'pointer', flex: 1, minWidth: 0 }}
          onClick={openInitiativeModal}
        >
          {(() => {
            const order = state.initiativeOrder || [];
            if (!order.length) return 'Set Initiative';
            const idx = state.currentTurnIndex || 0;
            const currentId = order[idx % order.length];
            const el = (state.elements || []).find(e => e.id === currentId);
            return el ? `Turn: ${el.name}` : 'Set Initiative';
          })()}
        </div>
        {initiativeSet && (
          <IconButton size="small" title="Next Turn" onClick={() => {
            setState(prev => {
              const len = (prev.initiativeOrder || []).length;
              if (!len) return prev;
              const nextIdx = ((prev.currentTurnIndex || 0) + 1) % len;
              return { ...prev, currentTurnIndex: nextIdx };
            });
          }}>
            <FontAwesomeIcon icon={faCircleRightRegular} style={{ color: 'white' }} />
          </IconButton>
        )}
      </div>
      <hr className="sidebar-divider" />
      {/* Creatures Section */}
  <div className={isDrawingCover ? 'disabled-while-drawing' : ''} style={{ display: 'flex', alignItems: 'center', gap: '0.5em', position: 'relative' }}>
        <IconButton onClick={() => setCreaturesOpen(v => !v)} size="small" title={creaturesOpen ? 'Collapse' : 'Expand'}>
          <FontAwesomeIcon icon={faChevronRight} style={{ color: 'white', transform: creaturesOpen ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }} />
        </IconButton>
        <h3 style={{ margin: 0, cursor: 'pointer' }} onClick={() => setCreaturesOpen(v => !v)}>Creatures</h3>
        <IconButton onClick={openAddCharacterModal} disabled={isDrawingCover} title="Add creature" size="small">
          <FontAwesomeIcon icon={faUserRegular} style={{ color: isDrawingCover ? 'grey' : 'white' }} />
        </IconButton>
        {/* Popover moved to App.jsx as AddCharacterModal */}
      </div>
  <div className={`collapsible ${creaturesOpen ? 'open' : ''}`}>
        <div className={`element-list ${isDrawingCover ? 'disabled-while-drawing' : ''}`}>
          {[...playersList, ...enemiesList].map((el) => (
            <div
              key={el.id}
              className="element-item"
              data-id={el.id}
              onClick={() => {
                if (el.incapacitated) return; // disabled for movement when incapacitated
                if (damageEdit.targetId != null) return; // prevent movement highlight while editing damage
                console.log('Sidebar: Clicking element ID:', el.id, 'Type:', el.type);
                toggleMovementHighlight(el.id, battleMapRef);
              }}
              onDoubleClick={() => {
                // If this is the local user's player token, open character sheet instead of edit
                if (onOpenMyCharacterSheet && el.type === 'player' && currentUserId && el.participantUserId === currentUserId) {
                  onOpenMyCharacterSheet(el);
                  return;
                }
                showEditModal(el.id);
              }}
              style={{
                position: 'relative',
                borderColor: (currentTurnId === el.id && (el.type === 'player' || el.type === 'enemy')) ? '#ffffff' : undefined,
                boxShadow: (currentTurnId === el.id && (el.type === 'player' || el.type === 'enemy')) ? '4px 0 10px rgba(255,255,255,0.45)' : undefined,
                opacity: el.incapacitated ? 0.5 : 1,
                pointerEvents: el.incapacitated ? 'auto' : 'auto'
              }}
            >
              <div className="element-info">
                <div className="element-color" style={{ backgroundColor: el.color }}></div>
                <span className="element-name text-ellipsis">{el.name}</span>
                {/* Right-side controls (eye + skull/wand) */}
                <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  {el.type === 'player' && (() => {
                    let greyFrac = computeGreyFractionForCell(state, el.position.x, el.position.y);
                    const steps = [0, 0.25, 0.5, 0.75, 1];
                    const eps = 0.02;
                    for (const s of steps) {
                      if (Math.abs(greyFrac - s) < eps) { greyFrac = s; break; }
                    }
                    let adjustedGrey = greyFrac;
                    if (greyFrac > 0 && greyFrac < 1) {
                      const BIAS = 0.05; // +5% visibility
                      adjustedGrey = Math.max(0, Math.min(1, greyFrac - BIAS));
                    }
                    const widthPct = adjustedGrey <= 0 ? 100 : Math.round((1 - adjustedGrey) * 100);
                    const isFull = widthPct >= 100;
                    return (
                      <span style={{ position: 'relative', width: 18, height: 18, display: 'inline-block' }} title={greyFrac >= 1 ? 'Out of vision or full cover' : greyFrac > 0 ? 'Partial cover' : 'Fully visible'}>
                        <FontAwesomeIcon icon={faEyeRegular} style={{ color: '#777', position: 'absolute', left: 0, top: 0, fontSize: 18, display: 'block' }} />
                        {isFull ? (
                          <FontAwesomeIcon icon={faEyeRegular} style={{ color: '#ffffff', position: 'absolute', left: 0, top: 0, fontSize: 18, display: 'block' }} />
                        ) : (
                          <span style={{ position: 'absolute', left: 0, top: 0, width: `${widthPct}%`, height: '100%', overflow: 'hidden' }}>
                            <FontAwesomeIcon icon={faEyeRegular} style={{ color: '#ffffff', fontSize: 18, display: 'block' }} />
                          </span>
                        )}
                      </span>
                    );
                  })()}
                  {el.incapacitated ? (
                    <FontAwesomeIcon
                      icon={faWandSparkles}
                      title="Revive"
                      style={{ color: '#80DEEA', cursor: 'pointer' }}
                      onClick={(e) => {
                        e.stopPropagation();
                        setState(prev => ({
                          ...prev,
                          elements: prev.elements.map(x => x.id === el.id ? { ...x, incapacitated: false } : x)
                        }));
                      }}
                    />
                  ) : (
                    <FontAwesomeIcon
                      icon={faSkull}
                      title="Incapacitate"
                      style={{ color: '#B0BEC5', cursor: 'pointer' }}
                      onClick={(e) => {
                        e.stopPropagation();
                        try { document.querySelectorAll('.movement-highlight').forEach(h => h.remove()); } catch {}
                        setState(prev => ({
                          ...prev,
                          elements: prev.elements.map(x => x.id === el.id ? { ...x, incapacitated: true } : x),
                          highlightedElementId: prev.highlightedElementId === el.id ? null : prev.highlightedElementId,
                        }));
                      }}
                    />
                  )}
                </span>
              </div>
              {el.type === 'player' && (
                (() => {
                  const effectiveHp = applyHpModifiers(el.currentHp ?? 0, el);
                  return (
                    <div className="element-stats">
                      <div
                        className={`hp-display ${getHpClass(effectiveHp, el.maxHp)}`}
                        onDoubleClick={(e) => { e.stopPropagation(); openDamageEdit(el.id, 'player'); }}
                        title={
                          damageEdit.targetId === el.id && damageEdit.targetType === 'player'
                            ? 'Enter damage, then click OK or press Enter. Press Esc to cancel.'
                            : 'Double-click to enter damage'
                        }
                        style={{
                          userSelect: 'none',
                          cursor: damageEdit.targetId === el.id && damageEdit.targetType === 'player' ? 'text' : 'pointer',
                          color: damageEdit.targetId === el.id && damageEdit.targetType === 'player' ? '#f44336' : undefined,
                          backgroundColor: damageEdit.targetId === el.id && damageEdit.targetType === 'player' ? 'rgba(244,67,54,0.2)' : undefined,
                          borderColor: damageEdit.targetId === el.id && damageEdit.targetType === 'player' ? '#f44336' : undefined,
                        }}
                      >
                        {damageEdit.targetId === el.id && damageEdit.targetType === 'player' ? (
                          <InlineNumberEditor
                            value={damageEdit.value}
                            onChange={(v) => setDamageEdit(p => ({ ...p, value: v }))}
                            onConfirm={applyDamageEdit}
                            onCancel={cancelDamageEdit}
                            title="Damage dealt:"
                            okLabel="OK"
                          />
                        ) : (
                          <>HP: {effectiveHp}/{el.maxHp}</>
                        )}
                      </div>
                    </div>
                  );
                })()
              )}
              {el.type === 'enemy' && (
                <div className="element-stats">
                  <div
                    className="hp-display"
                    onDoubleClick={(e) => { e.stopPropagation(); openDamageEdit(el.id, 'enemy'); }}
                    title={
                      damageEdit.targetId === el.id && damageEdit.targetType === 'enemy'
                        ? 'Enter damage, then click OK or press Enter. Press Esc to cancel.'
                        : 'Double-click to add damage'
                    }
                    style={{
                      color: '#f44336',
                      backgroundColor: (damageEdit.targetId === el.id && damageEdit.targetType === 'enemy') ? 'rgba(244,67,54,0.2)' : 'rgba(244,67,54,0.15)',
                      borderColor: (damageEdit.targetId === el.id && damageEdit.targetType === 'enemy') ? '#f44336' : undefined,
                      userSelect: 'none',
                      cursor: (damageEdit.targetId === el.id && damageEdit.targetType === 'enemy') ? 'text' : 'pointer',
                    }}
                  >
                    {damageEdit.targetId === el.id && damageEdit.targetType === 'enemy' ? (
                      <InlineNumberEditor
                        value={damageEdit.value}
                        onChange={(v) => setDamageEdit(p => ({ ...p, value: v }))}
                        onConfirm={applyDamageEdit}
                        onCancel={cancelDamageEdit}
                        title="Damage dealt:"
                        okLabel="OK"
                      />
                    ) : (
                      <>Damage: {el.damage ?? 0}</>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Inline damage entry handled within the HP bar; no popover */}

      {/* Environments Section */}
      <hr className="sidebar-divider" />
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5em', position: 'relative' }}>
        <IconButton onClick={() => setEnvOpen(v => !v)} size="small" title={envOpen ? 'Collapse' : 'Expand'}>
          <FontAwesomeIcon icon={faChevronRight} style={{ color: 'white', transform: envOpen ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }} />
        </IconButton>
        <h3 style={{ margin: 0, cursor: 'pointer' }} onClick={() => setEnvOpen(v => !v)}>Environments</h3>
        <IconButton onClick={toggleDrawingMode} title="Draw environment (cover/terrain) on grid" size="small">
          <FontAwesomeIcon icon={faPenToSquareRegular} style={{ color: isDrawingCover ? '#4CAF50' : 'white' }} />
        </IconButton>
      </div>
  <div className={`collapsible ${envOpen ? 'open' : ''}`}>
        <div className="element-list">
          {isDrawingCover && (
          <div className="drawing-options" style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 6, marginBottom: 8 }}>
            <label htmlFor="draw-env-half" onClick={() => setDrawEnvType('half')} style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#fff', cursor: 'pointer' }}>
              <input
                id="draw-env-half"
                type="radio"
                name="draw-env-type"
                value="half"
                checked={drawEnvType === 'half'}
                onChange={() => setDrawEnvType('half')}
              />
              Half Cover
            </label>
            <label htmlFor="draw-env-three-quarters" onClick={() => setDrawEnvType('three-quarters')} style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#fff', cursor: 'pointer' }}>
              <input
                id="draw-env-three-quarters"
                type="radio"
                name="draw-env-type"
                value="three-quarters"
                checked={drawEnvType === 'three-quarters'}
                onChange={() => setDrawEnvType('three-quarters')}
              />
              Three-Quarters Cover
            </label>
            <label htmlFor="draw-env-full" onClick={() => setDrawEnvType('full')} style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#fff', cursor: 'pointer' }}>
              <input
                id="draw-env-full"
                type="radio"
                name="draw-env-type"
                value="full"
                checked={drawEnvType === 'full'}
                onChange={() => setDrawEnvType('full')}
              />
              Full Cover
            </label>
            <label htmlFor="draw-env-difficult" onClick={() => setDrawEnvType('difficult')} style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#fff', cursor: 'pointer' }}>
              <input
                id="draw-env-difficult"
                type="radio"
                name="draw-env-type"
                value="difficult"
                checked={drawEnvType === 'difficult'}
                onChange={() => setDrawEnvType('difficult')}
              />
              Difficult Terrain
            </label>
            <div style={{ fontSize: 12, opacity: 0.8 }}>
              Tip: Click cells to add/remove. Finish by clicking the pen icon again.
            </div>
            <hr className="sidebar-divider" />
          </div>
          )}
          {Object.entries(coverGroups).map(([groupId, { coverType, positions, firstId, color }]) => (
            <div
              key={groupId}
              className="element-item cover-item"
              data-id={firstId}
              onClick={() => {
                // Toggle cover group highlight and preserve movement
                // Clear any existing movement highlights to avoid confusion
                document.querySelectorAll('.movement-highlight').forEach((h) => h.remove());
                // Also clear movement dataset highlight so clicks won't attempt token movement
                try {
                  const mapEl = battleMapRef?.current;
                  if (mapEl && mapEl.dataset) delete mapEl.dataset.highlightedId;
                } catch {}
                if (state.highlightedElementId === firstId) {
                  setState(prev => ({ ...prev, highlightedElementId: null }));
                } else {
                  setState(prev => ({ ...prev, highlightedElementId: firstId }));
                  // Immediately show yellow highlight around cover blocks
                  try { highlightCoverGroup(groupId); } catch {}
                }
              }}
              onDoubleClick={() => showEditModal(firstId)}
            >
              <div className="element-info" style={{ gap: '0.5rem', marginBottom: 0 }}>
                {coverType === 'difficult' ? (
                  <FontAwesomeIcon icon={faSquareCaretUpRegular} style={{ color: color || '#795548' }} />
                ) : (
                  <FontAwesomeIcon icon={faSquareRegular} style={{ color: color || '#795548' }} />
                )}
                <span className="element-name">{coverTypeLabel(coverType)}</span>
              </div>
            </div>
          ))}
        {ungroupedCovers.map((el) => (
          <div
            key={el.id}
            className="element-item cover-item"
            data-id={el.id}
            onClick={() => {
              document.querySelectorAll('.movement-highlight').forEach((h) => h.remove());
              try {
                const mapEl = battleMapRef?.current;
                if (mapEl && mapEl.dataset) delete mapEl.dataset.highlightedId;
              } catch {}
              if (state.highlightedElementId === el.id) {
                setState(prev => ({ ...prev, highlightedElementId: null }));
              } else {
                setState(prev => ({ ...prev, highlightedElementId: el.id }));
                // Immediately show yellow highlight around this single cover block
                try {
                  document.querySelectorAll('.cover-highlight').forEach((h) => h.remove());
                  const cell = document.querySelector(`.grid-cell[data-x="${el.position.x}"][data-y="${el.position.y}"]`);
                  if (cell) {
                    const highlight = document.createElement('div');
                    highlight.classList.add('cover-highlight');
                    cell.appendChild(highlight);
                  }
                } catch {}
              }
            }}
            onDoubleClick={() => showEditModal(el.id)}
          >
            <div className="element-info" style={{ gap: '0.5rem', marginBottom: 0 }}>
              {(el.coverType === 'difficult') ? (
                <FontAwesomeIcon icon={faSquareCaretUpRegular} style={{ color: el.color || '#795548' }} />
              ) : (
                <FontAwesomeIcon icon={faSquareRegular} style={{ color: el.color || '#795548' }} />
              )}
              <span className="element-name">{coverTypeLabel(el.coverType)}</span>
            </div>
          </div>
        ))}
        </div>
      </div>
      </div>
      {/* Sidebar footer: expand/collapse control (always visible) */}
      <div className="sidebar-footer">
        <IconButton
          size="small"
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          onClick={() => setCollapsed(v => !v)}
        >
          <FontAwesomeIcon
            icon={isPortraitPhone ? (collapsed ? faAnglesUp : faAnglesDown) : (collapsed ? faAnglesRight : faAnglesLeft)}
            style={{ color: '#fff', fontSize: 14 }}
          />
        </IconButton>
      </div>
    </aside>
  );
};

export default Sidebar;