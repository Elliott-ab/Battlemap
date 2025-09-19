import React from 'react';
import IconButton from '@mui/material/IconButton';
import PersonAddOutlinedIcon from '@mui/icons-material/PersonAddOutlined';
import GroupAddOutlinedIcon from '@mui/icons-material/GroupAddOutlined';
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

  return (
    <aside className="sidebar">
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5em' }}>
        <h3 style={{ margin: 0 }}>Elements</h3>
        <IconButton onClick={addPlayer} disabled={isDrawingCover} title="Add Player" size="small">
          <PersonAddOutlinedIcon sx={{ color: isDrawingCover ? 'grey' : 'white' }} />
        </IconButton>
        <IconButton onClick={addEnemy} disabled={isDrawingCover} title="Add Enemy" size="small">
          <GroupAddOutlinedIcon sx={{ color: isDrawingCover ? 'grey' : 'white' }} />
        </IconButton>
        <IconButton onClick={toggleDrawingMode} title={isDrawingCover ? 'Finish Drawing' : 'Draw Cover'} size="small">
          <BrushOutlinedIcon sx={{ color: isDrawingCover ? '#4CAF50' : 'white' }} />
        </IconButton>
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