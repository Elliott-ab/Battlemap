import React from 'react';
import IconButton from '@mui/material/IconButton';
import PersonAddOutlinedIcon from '@mui/icons-material/PersonAddOutlined';
import AddBoxOutlinedIcon from '@mui/icons-material/AddBoxOutlined';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
//

import ArrowCircleLeftOutlinedIcon from '@mui/icons-material/ArrowCircleLeftOutlined';
import ArrowCircleRightOutlinedIcon from '@mui/icons-material/ArrowCircleRightOutlined';

const Sidebar = ({ state, setState, toggleMovementHighlight, highlightCoverGroup, showEditModal, battleMapRef, isDrawingCover, toggleDrawingMode, openAddCharacterModal, openInitiativeModal }) => {
  console.log('Sidebar received battleMapRef:', battleMapRef);

  // Initiative UI moved to modal-driven approach in Sidebar header (no drag & drop)
  const hasCharacters = (state.elements || []).some(e => e.type === 'player' || e.type === 'enemy');
  const initiativeSet = (state.initiativeOrder || []).length > 0;

  const coverGroups = {};
  state.elements.forEach((el) => {
    if (el.type === 'cover' && el.groupId) {
      if (!coverGroups[el.groupId]) {
        coverGroups[el.groupId] = { coverType: el.coverType, positions: [], firstId: el.id };
      }
      coverGroups[el.groupId].positions.push(el.position);
    }
  });

  // Determine active enemy for visibility cone check (works even without initiative):
  // 1) If a highlighted element is an enemy, use it;
  // 2) Else if initiative is set and the current turn is an enemy, use it;
  // 3) Else fallback to the first enemy, if any.
  const FOV_DEG = 80; // mid width between previous 60 and 100
  const elementsArr = state.elements || [];
  const highlightedEnemy = elementsArr.find(e => e.id === state.highlightedElementId && e.type === 'enemy');
  const orderForVis = state.initiativeOrder || [];
  const currentIdForVis = orderForVis.length ? orderForVis[(state.currentTurnIndex || 0) % orderForVis.length] : null;
  const initiativeEnemy = elementsArr.find(e => e.id === currentIdForVis && e.type === 'enemy');
  const fallbackEnemy = elementsArr.find(e => e.type === 'enemy');
  const currentEnemy = highlightedEnemy || initiativeEnemy || fallbackEnemy || null;
  const enemyFacing = typeof currentEnemy?.facing === 'number' ? currentEnemy.facing : 90; // default down

  // Build a quick lookup for cover cells and severities
  const COVER_SEVERITY = {
    'quarter': 0.25,
    'half': 0.5,
    'three-quarters': 0.75,
    'full': 1.0,
  };
  const coverMap = new Map(); // key: "x,y" -> severity (max)
  (state.elements || []).forEach(el => {
    if (el.type === 'cover') {
      const sev = COVER_SEVERITY[el.coverType] || 0;
      const key = `${el.position.x},${el.position.y}`;
      const prev = coverMap.get(key) || 0;
      if (sev > prev) coverMap.set(key, sev);
    }
  });

  const computeVisibilityGreyFraction = (player) => {
    // Returns 1 for fully grey (not visible), 0 for fully visible, or partial based on cover encountered
    // If no enemies exist, treat as fully visible (no one is observing)
    if (!currentEnemy) return 0;
    const ex = currentEnemy.position.x + currentEnemy.size / 2;
    const ey = currentEnemy.position.y + currentEnemy.size / 2;
    const px = player.position.x + player.size / 2;
    const py = player.position.y + player.size / 2;
    const dx = px - ex;
    const dy = py - ey;
    if (dx === 0 && dy === 0) return 0; // same cell
    // FOV check first
    const bearing = Math.atan2(dy, dx) * 180 / Math.PI; // 0=right, 90=down
    let delta = ((bearing - enemyFacing + 540) % 360) - 180;
    const inFov = Math.abs(delta) <= (FOV_DEG / 2);
    if (!inFov) return 1; // fully grey out of FOV
    // Ray sample along the line from enemy to player, check cover cells intersected
    const steps = Math.max(Math.abs(dx), Math.abs(dy)) * 3; // finer sampling
    let maxSev = 0;
    for (let i = 1; i < steps; i++) { // skip start (i=0) and end (i=steps)
      const t = i / steps;
      const rx = ex + dx * t;
      const ry = ey + dy * t;
      const cx = Math.floor(rx);
      const cy = Math.floor(ry);
      // skip the player's own cell to avoid self-cover
      if (cx === Math.floor(px) && cy === Math.floor(py)) continue;
      const key = `${cx},${cy}`;
      const sev = coverMap.get(key) || 0;
      if (sev > maxSev) maxSev = sev;
      if (maxSev >= 1.0) break; // full cover blocks completely
    }
    // Grey fraction equals cover severity encountered
    return Math.max(0, Math.min(1, maxSev));
  };

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

  return (
    <aside className="sidebar">
      {/* Turn controls (initiative) */}
  <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', marginBottom: '0.75rem', width: '100%' }}>
        {initiativeSet && (
          <IconButton size="small" title="Previous Turn" onClick={() => {
            setState(prev => {
              const len = (prev.initiativeOrder || []).length;
              if (!len) return prev;
              const prevIdx = ((prev.currentTurnIndex || 0) - 1 + len) % len;
              return { ...prev, currentTurnIndex: prevIdx };
            });
          }}>
            <ArrowCircleLeftOutlinedIcon sx={{ color: 'white' }} />
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
            <ArrowCircleRightOutlinedIcon sx={{ color: 'white' }} />
          </IconButton>
        )}
      </div>
      <hr className="sidebar-divider" />
      {/* Elements Section */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5em', position: 'relative' }}>
        <h3 style={{ margin: 0 }}>Elements</h3>
        <IconButton onClick={openAddCharacterModal} disabled={isDrawingCover} title="Add character elements" size="small">
          <PersonAddOutlinedIcon sx={{ color: isDrawingCover ? 'grey' : 'white' }} />
        </IconButton>
        <IconButton onClick={toggleDrawingMode} title="Draw cover elements on grid" size="small">
          <AddBoxOutlinedIcon sx={{ color: isDrawingCover ? '#4CAF50' : 'white' }} />
        </IconButton>
        {/* Popover moved to App.jsx as AddCharacterModal */}
      </div>
      <div className="element-list">
        {state.elements
          .filter((el) => el.type !== 'cover' || !el.groupId)
          .map((el) => (
            <div
              key={el.id}
              className="element-item"
              data-id={el.id}
              onClick={() => {
                console.log('Sidebar: Clicking element ID:', el.id, 'Type:', el.type);
                toggleMovementHighlight(el.id, battleMapRef);
              }}
              onDoubleClick={() => showEditModal(el.id)}
              style={{
                position: 'relative',
                borderColor: (currentTurnId === el.id && (el.type === 'player' || el.type === 'enemy')) ? '#ffffff' : undefined,
                boxShadow: (currentTurnId === el.id && (el.type === 'player' || el.type === 'enemy')) ? '4px 0 10px rgba(255,255,255,0.45)' : undefined
              }}
            >
              <div className="element-info">
                <div className="element-color" style={{ backgroundColor: el.color }}></div>
                <span className="element-name text-ellipsis">{el.name}</span>
                <span className="element-type">({el.type})</span>
                {el.type === 'player' && (() => {
                  const greyFrac = computeVisibilityGreyFraction(el);
                  const visibleFrac = 1 - greyFrac; // portion to show as white
                  const widthPct = Math.round(visibleFrac * 100);
                  return (
                    <span style={{ position: 'relative', width: 18, height: 18, marginLeft: 'auto', display: 'inline-block' }} title={greyFrac >= 1 ? 'Out of vision or full cover' : greyFrac > 0 ? 'Partial cover' : 'Fully visible'}>
                      {/* Base grey icon */}
                      <VisibilityOutlinedIcon sx={{ color: '#777', fontSize: 18, position: 'absolute', left: 0, top: 0 }} />
                      {/* White overlay for visible portion */}
                      <span style={{ position: 'absolute', left: 0, top: 0, width: `${widthPct}%`, height: '100%', overflow: 'hidden' }}>
                        <VisibilityOutlinedIcon sx={{ color: '#ffffff', fontSize: 18 }} />
                      </span>
                    </span>
                  );
                })()}
              </div>
              {el.type !== 'cover' ? (
                <div className="element-stats">
                  <div className={`hp-display ${getHpClass(el.currentHp, el.maxHp)}`}>
                    HP: {el.currentHp}/{el.maxHp}
                  </div>
                </div>
              ) : (
                <span className="element-type">{el.coverType.replace('-', ' ')} cover</span>
              )}
              {/* Removed position display */}
            </div>
          ))}
        {Object.entries(coverGroups).map(([groupId, { coverType, positions, firstId }]) => (
          <div
            key={groupId}
            className="element-item"
            data-id={firstId}
            onClick={() => {
              // Toggle cover group highlight and preserve movement
              if (state.highlightedElementId === firstId) {
                setState(prev => ({ ...prev, highlightedElementId: null }));
              } else {
                setState(prev => ({ ...prev, highlightedElementId: firstId }));
              }
            }}
            onDoubleClick={() => showEditModal(firstId)}
          >
            <div className="element-info">
              <div className="element-color" style={{ backgroundColor: '#795548' }}></div>
              <span className="element-name">Cover Group {groupId}</span>
              <span className="element-type">(cover)</span>
            </div>
            <span className="element-type">{coverType.replace('-', ' ')} cover</span>
            <span className="element-position">
              {positions.length > 1 ? `Multiple (${positions.length} blocks)` : `Position: (${positions[0].x}, ${positions[0].y})`}
            </span>
          </div>
        ))}
      </div>
    </aside>
  );
};

export default Sidebar;