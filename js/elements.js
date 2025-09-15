import { state } from './state.js';
import { renderGrid } from './grid.js';
import { pushUndo } from './undo.js';
import { showEditModal } from './modals.js';

let nextId = 1;
let nextGroupId = 1;

function findEmptyPosition(size) {
  for (let y = 0; y < state.grid.height - size + 1; y++) {
    for (let x = 0; x < state.grid.width - size + 1; x++) {
      let isOccupied = false;
      for (const el of state.elements) {
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
  console.warn('No empty position found; defaulting to (0,0)');
  return { x: 0, y: 0 };
}

export function addElement(type, options = {}) {
  const defaults = {
    position: findEmptyPosition(1),
    size: 1,
    coverType: 'half',
    groupId: null
  };
  const { position, size, coverType, groupId } = { ...defaults, ...options };
  const newEl = {
    id: nextId++,
    name: `${type.charAt(0).toUpperCase() + type.slice(1)} ${nextId}`,
    type,
    position,
    size,
    color: type === 'player' ? '#4CAF50' : type === 'enemy' ? '#f44336' : '#795548',
    maxHp: type !== 'cover' ? 10 : undefined,
    currentHp: type !== 'cover' ? 10 : undefined,
    movement: type !== 'cover' ? 30 : undefined,
    damage: type === 'enemy' ? 0 : undefined,
    coverType: type === 'cover' ? coverType : undefined,
    groupId: type === 'cover' ? groupId : undefined
  };
  state.elements.push(newEl);
  renderElementsList();
  renderGrid();
  pushUndo();
}

export function createCoverFromBlocks(coverBlocks, coverType) {
  if (coverBlocks.length === 0) {
    console.warn('No cover blocks selected; no cover elements created');
    return;
  }

  const groupId = nextGroupId++;
  coverBlocks.forEach(({ x, y }) => {
    addElement('cover', {
      position: { x, y },
      size: 1,
      coverType,
      groupId
    });
  });
}

function getHpClass(currentHp, maxHp) {
  if (currentHp <= 0) return 'unconscious';
  if (currentHp < maxHp * 0.25) return 'critical';
  if (currentHp < maxHp * 0.5) return 'bloodied';
  return 'healthy';
}

export function renderElementsList() {
  const list = document.querySelector('.element-list');
  if (!list) {
    console.error('Element list not found');
    return;
  }
  list.innerHTML = '';

  const coverGroups = {};
  state.elements.forEach((el) => {
    if (el.type === 'cover' && el.groupId) {
      if (!coverGroups[el.groupId]) {
        coverGroups[el.groupId] = { coverType: el.coverType, positions: [], firstId: el.id };
      }
      coverGroups[el.groupId].positions.push(el.position);
    }
  });

  state.elements.forEach((el) => {
    if (el.type !== 'cover' || !el.groupId) {
      const item = document.createElement('div');
      item.classList.add('element-item');
      item.dataset.id = el.id;
      let statsHtml = '';
      if (el.type !== 'cover') {
        const hpClass = getHpClass(el.currentHp, el.maxHp);
        statsHtml = `
          <div class="element-stats">
            <div class="hp-display ${hpClass}">HP: ${el.currentHp}/${el.maxHp}</div>
          </div>
        `;
      } else {
        statsHtml = `<span class="element-type">${el.coverType.replace('-', ' ')} cover</span>`;
      }
      item.innerHTML = `
        <div class="element-info">
          <div class="element-color" style="background-color: ${el.color};"></div>
          <span class="element-name">${el.name}</span>
          <span class="element-type">(${el.type})</span>
        </div>
        ${statsHtml}
        <span class="element-position">Position: (${el.position.x}, ${el.position.y})</span>
      `;
      list.appendChild(item);
    }
  });

  Object.entries(coverGroups).forEach(([groupId, { coverType, positions, firstId }]) => {
    const item = document.createElement('div');
    item.classList.add('element-item');
    item.dataset.id = firstId;
    const positionStr = positions.length > 1
      ? `Multiple (${positions.length} blocks)`
      : `Position: (${positions[0].x}, ${positions[0].y})`;
    item.innerHTML = `
      <div class="element-info">
        <div class="element-color" style="background-color: #795548;"></div>
        <span class="element-name">Cover Group ${groupId}</span>
        <span class="element-type">(cover)</span>
      </div>
      <span class="element-type">${coverType.replace('-', ' ')} cover</span>
      <span class="element-position">${positionStr}</span>
    `;
    list.appendChild(item);
  });
}

export function highlightCoverGroup(groupId) {
  document.querySelectorAll('.cover-highlight').forEach((highlight) => highlight.remove());
  state.elements.forEach((el) => {
    if (el.type === 'cover' && el.groupId === parseInt(groupId)) {
      const cell = document.querySelector(`.grid-cell[data-x="${el.position.x}"][data-y="${el.position.y}"]`);
      if (cell) {
        const highlight = document.createElement('div');
        highlight.classList.add('cover-highlight');
        cell.appendChild(highlight);
      }
    }
  });
}

export function updateElementPosition(id, x, y) {
  const el = getElementById(id);
  if (!el || x < 0 || y < 0 || x + el.size > state.grid.width || y + el.size > state.grid.height) {
    console.warn(`Invalid position update for element ${id}: x=${x}, y=${y}`);
    return;
  }

  if (el.type === 'cover' && el.groupId) {
    const groupElements = state.elements.filter(e => e.type === 'cover' && e.groupId === el.groupId);
    const dx = x - el.position.x;
    const dy = y - el.position.y;

    for (const groupEl of groupElements) {
      const newX = groupEl.position.x + dx;
      const newY = groupEl.position.y + dy;
      if (newX < 0 || newY < 0 || newX + groupEl.size > state.grid.width || newY + groupEl.size > state.grid.height) {
        console.warn(`Cannot move group ${el.groupId}: block at (${newX}, ${newY}) out of bounds`);
        return;
      }
      groupEl.position.x = newX;
      groupEl.position.y = newY;
    }
  } else {
    el.position.x = x;
    el.position.y = y;
  }

  renderGrid();
  renderElementsList();
}

export function getElementById(id) {
  const element = state.elements.find((e) => e.id === parseInt(id));
  if (!element) {
    console.warn(`Element with id ${id} not found`);
  }
  return element;
}

export function updateElement(id, updates) {
  const el = getElementById(id);
  if (el) {
    Object.assign(el, updates);
    if (el.type === 'cover' && el.groupId) {
      state.elements.forEach((e) => {
        if (e.type === 'cover' && e.groupId === el.groupId) {
          Object.assign(e, { coverType: updates.coverType || e.coverType });
        }
      });
    }
    renderElementsList();
    renderGrid();
  } else {
    console.error(`Cannot update element with id ${id}: not found`);
  }
}

export function deleteElement(id) {
  const el = getElementById(id);
  if (el && el.type === 'cover' && el.groupId) {
    state.elements = state.elements.filter((e) => !(e.type === 'cover' && e.groupId === el.groupId));
  } else {
    state.elements = state.elements.filter((e) => e.id !== parseInt(id));
  }
  renderElementsList();
  renderGrid();
  pushUndo();
}

export function toggleMovementHighlight(id) {
  const el = getElementById(id);
  if (!el || el.type === 'cover' || !el.movement) {
    console.warn(`Cannot toggle movement highlight for element ${id}: invalid element or no movement`);
    return;
  }

  const battleMap = document.querySelector('.battle-map');
  if (!battleMap) {
    console.error('Battle map not found');
    return;
  }

  document.querySelectorAll('.movement-highlight').forEach((highlight) => highlight.remove());

  if (el.isHighlighted) {
    el.isHighlighted = false;
    return;
  }

  const range = Math.floor(el.movement / state.grid.cellSize);
  const { x, y } = el.position;
  const size = el.size;

  for (let dy = -range; dy <= range; dy++) {
    for (let dx = -range; dx <= range; dx++) {
      const newX = x + dx;
      const newY = y + dy;
      if (
        newX >= 0 &&
        newX < state.grid.width &&
        newY >= 0 &&
        newY < state.grid.height &&
        Math.abs(dx) + Math.abs(dy) <= range
      ) {
        const cell = battleMap.querySelector(`.grid-cell[data-x="${newX}"][data-y="${newY}"]`);
        if (cell) {
          const highlight = document.createElement('div');
          highlight.classList.add('movement-highlight');
          if (el.type === 'enemy') {
            highlight.classList.add('enemy');
          }
          cell.appendChild(highlight);
        }
      }
    }
  }

  el.isHighlighted = true;
}