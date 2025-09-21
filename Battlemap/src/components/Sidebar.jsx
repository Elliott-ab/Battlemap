import React from 'react';
import IconButton from '@mui/material/IconButton';
import PersonAddOutlinedIcon from '@mui/icons-material/PersonAddOutlined';
import AddBoxOutlinedIcon from '@mui/icons-material/AddBoxOutlined';
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

  const getHpClass = (currentHp, maxHp) => {
    if (currentHp <= 0) return 'unconscious';
    if (currentHp < maxHp * 0.25) return 'critical';
    if (currentHp < maxHp * 0.5) return 'bloodied';
    return 'healthy';
  };


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
            >
              <div className="element-info">
                <div className="element-color" style={{ backgroundColor: el.color }}></div>
                <span className="element-name text-ellipsis">{el.name}</span>
                <span className="element-type">({el.type})</span>
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