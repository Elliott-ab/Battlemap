import React, { useState } from 'react';
import IconButton from '@mui/material/IconButton';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSkull, faWandSparkles, faEye as faEyeSolid, faChevronRight } from '@fortawesome/free-solid-svg-icons';
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
//

// Replaced MUI icons above with Font Awesome equivalents

const Sidebar = ({ state, setState, toggleMovementHighlight, highlightCoverGroup, showEditModal, battleMapRef, isDrawingCover, toggleDrawingMode, openAddCharacterModal, openInitiativeModal, drawEnvType, setDrawEnvType }) => {
  console.log('Sidebar received battleMapRef:', battleMapRef);

  // Collapsible sections state
  const [creaturesOpen, setCreaturesOpen] = useState(true);
  const [envOpen, setEnvOpen] = useState(true);

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

  // Determine current turn element id if initiative is set
  const order = state.initiativeOrder || [];
  const currentTurnId = order.length ? order[(state.currentTurnIndex || 0) % order.length] : null;


  // Find next empty position given current elements and any new positions
  const findEmptyPosition = (elements, size = 1, grid) => {
    for (let y = 0; y < grid.height - size + 1; y++) {
      for (let x = 0; x < grid.width - size + 1; x++) {
        let isOccupied = false;
        for (const el of elements) {
          if (
            x < el.position.x + el.size &&
            x + size > el.position.x &&
            y < el.position.y + el.size &&
            y + size > el.position.y
          ) {
            isOccupied = true;
            break;
          }
        }
        if (!isOccupied) {
          return { x, y };
        }
      }
    }
    return { x: 0, y: 0 };
  };

  const handleAddCharacters = () => {
    // Local counters for unique naming
    let localNextId = Math.max(1, ...state.elements.map(e => e.id || 0)) + 1;
    const getNextNumber = (type) => {
      const nums = state.elements.filter(e => e.type === type).map(e => parseInt((e.name||'').split(' ')[1]) || 0);
      if (nums.length === 0) return 1;
      return Math.max(...nums) + 1;
    };
    let localNextPlayerId = getNextNumber('player');
    let localNextEnemyId = getNextNumber('enemy');
    let newElements = [...state.elements];
    let batch = [];
    for (let i = 0; i < quantity; i++) {
      const pos = findEmptyPosition(newElements, 1, state.grid);
      let type = characterType;
      let name = type === 'player' ? `Player ${localNextPlayerId++}` : `Enemy ${localNextEnemyId++}`;
      let color = type === 'player' ? '#4CAF50' : '#f44336';
      let newEl = {
        id: localNextId++,
        name,
        type,
        position: pos,
        size: 1,
        color,
        maxHp: 10,
        currentHp: 10,
        movement: 30,
        damage: type === 'enemy' ? 0 : undefined
      };
      newElements.push(newEl);
      batch.push(newEl);
    }
    setState(prev => ({ ...prev, elements: [...prev.elements, ...batch], highlightedElementId: null }));
    setPopoverOpen(false);
    setQuantity(1);
    setCharacterType('player');
  };

  // When drawing mode starts, auto-collapse Creatures and disable non-environment interactions
  React.useEffect(() => {
    if (isDrawingCover) {
      setCreaturesOpen(false);
    }
  }, [isDrawingCover]);

  return (
    <aside className="sidebar">
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
                console.log('Sidebar: Clicking element ID:', el.id, 'Type:', el.type);
                toggleMovementHighlight(el.id, battleMapRef);
              }}
              onDoubleClick={() => showEditModal(el.id)}
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
                <div className="element-stats">
                  <div className={`hp-display ${getHpClass(el.currentHp, el.maxHp)}`}>
                    HP: {el.currentHp}/{el.maxHp}
                  </div>
                </div>
              )}
              {el.type === 'enemy' && (
                <div className="element-stats">
                  <div className="hp-display" style={{ color: '#f44336', backgroundColor: 'rgba(244,67,54,0.15)' }}>
                    Damage: {el.damage ?? 0}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

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
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#fff' }}>
              <input
                type="radio"
                name="draw-env-type"
                checked={drawEnvType === 'half'}
                onChange={() => setDrawEnvType('half')}
              />
              Half Cover
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#fff' }}>
              <input
                type="radio"
                name="draw-env-type"
                checked={drawEnvType === 'three-quarters'}
                onChange={() => setDrawEnvType('three-quarters')}
              />
              Three-Quarters Cover
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#fff' }}>
              <input
                type="radio"
                name="draw-env-type"
                checked={drawEnvType === 'full'}
                onChange={() => setDrawEnvType('full')}
              />
              Full Cover
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#fff' }}>
              <input
                type="radio"
                name="draw-env-type"
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
    </aside>
  );
};

export default Sidebar;