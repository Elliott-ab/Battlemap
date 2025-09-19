import React, { useState } from 'react';
import IconButton from '@mui/material/IconButton';
import PersonAddOutlinedIcon from '@mui/icons-material/PersonAddOutlined';
import BrushOutlinedIcon from '@mui/icons-material/BrushOutlined';

const Sidebar = ({ state, setState, toggleMovementHighlight, highlightCoverGroup, showEditModal, battleMapRef, addPlayer, addEnemy, isDrawingCover, toggleDrawingMode }) => {
  console.log('Sidebar received battleMapRef:', battleMapRef);

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

  const [popoverOpen, setPopoverOpen] = useState(false);
  const [characterType, setCharacterType] = useState('player');
  const [quantity, setQuantity] = useState(1);

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
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5em', position: 'relative' }}>
        <h3 style={{ margin: 0 }}>Elements</h3>
        <IconButton onClick={() => setPopoverOpen(true)} disabled={isDrawingCover} title="Add Character" size="small">
          <PersonAddOutlinedIcon sx={{ color: isDrawingCover ? 'grey' : 'white' }} />
        </IconButton>
        <IconButton onClick={toggleDrawingMode} title={isDrawingCover ? 'Finish Drawing' : 'Draw Cover'} size="small">
          <BrushOutlinedIcon sx={{ color: isDrawingCover ? '#4CAF50' : 'white' }} />
        </IconButton>
        {popoverOpen && (
          <div style={{ position: 'absolute', top: '2.5em', left: '2em', background: '#222', color: 'white', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.2)', padding: '1em', zIndex: 100 }}>
            <div style={{ marginBottom: '0.5em' }}>
              <label style={{ marginRight: '0.5em' }}>Type:</label>
              <select value={characterType} onChange={e => setCharacterType(e.target.value)} style={{ background: '#333', color: 'white', border: 'none', borderRadius: '4px', padding: '0.2em 0.5em' }}>
                <option value="player">Player</option>
                <option value="enemy">Enemy</option>
              </select>
            </div>
            <div style={{ marginBottom: '0.5em' }}>
              <label style={{ marginRight: '0.5em' }}>Quantity:</label>
              <input type="number" min={1} max={20} value={quantity} onChange={e => setQuantity(Math.max(1, Math.min(20, Number(e.target.value))))} style={{ width: '3em', background: '#333', color: 'white', border: 'none', borderRadius: '4px', padding: '0.2em 0.5em' }} />
            </div>
            <div style={{ display: 'flex', gap: '0.5em', justifyContent: 'flex-end' }}>
              <button onClick={handleAddCharacters} style={{ background: '#4CAF50', color: 'white', border: 'none', borderRadius: '4px', padding: '0.3em 0.8em', cursor: 'pointer' }}>Add</button>
              <button onClick={() => setPopoverOpen(false)} style={{ background: '#888', color: 'white', border: 'none', borderRadius: '4px', padding: '0.3em 0.8em', cursor: 'pointer' }}>Cancel</button>
            </div>
          </div>
        )}
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
                <span className="element-name">{el.name}</span>
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
              <span className="element-position">Position: ({el.position.x}, {el.position.y})</span>
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