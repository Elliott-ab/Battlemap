import { initialState } from '../Utils/state.js';

// Module counters are kept for names only; IDs are computed from state to avoid collisions
let nextGroupId = 1;
let nextPlayerId = 1;
let nextEnemyId = 1;
// Player color palette (exclude red, which is reserved for enemies)
const PLAYER_COLORS = [
  '#4CAF50', // Green
  '#2196F3', // Blue
  '#FFEB3B', // Yellow
  '#FF9800', // Orange
  '#9C27B0', // Purple
  '#00BCD4', // Cyan
  '#E91E63', // Pink
  '#3F51B5', // Indigo
  '#009688', // Teal
  '#8BC34A', // Light Green
];
let nextPlayerColorIdx = 0;

import { isCellVisibleToAnyEnemy, createVisibilityIconNode } from './visibility.js';

export const useElements = (state, setState) => {
  if (!state.hasOwnProperty('highlightedElementId')) {
    setState({ ...state, highlightedElementId: null });
  }

  const findEmptyPosition = (size) => {
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
  };

  const addElement = (type, options = {}) => {
    const defaults = {
      position: findEmptyPosition(1),
      size: 1,
      coverType: 'half',
      groupId: null,
    };
    const { position, size, coverType, groupId } = { ...defaults, ...options };
    // Compute a unique ID from current state to avoid collisions with other creation flows
    const newId = Math.max(0, ...state.elements.map(e => e.id || 0)) + 1;
    let name;
    if (type === 'player') {
      name = `Player ${nextPlayerId++}`;
    } else if (type === 'enemy') {
      name = `Enemy ${nextEnemyId++}`;
    } else {
      name = `${type.charAt(0).toUpperCase() + type.slice(1)} ${newId}`;
    }
    // Choose colors by type (players cycle palette, enemies fixed red, cover brown)
    const color = type === 'player'
      ? PLAYER_COLORS[(nextPlayerColorIdx++) % PLAYER_COLORS.length]
      : type === 'enemy'
        ? '#f44336'
        : '#795548';

    const newEl = {
      id: newId,
      name,
      type,
      position,
      size,
      color,
      maxHp: type !== 'cover' ? 10 : undefined,
      currentHp: type !== 'cover' ? 10 : undefined,
      movement: type !== 'cover' ? 30 : undefined,
      damage: type === 'enemy' ? 0 : undefined,
      coverType: type === 'cover' ? coverType : undefined,
      groupId: type === 'cover' ? groupId : undefined,
  // Facing direction in degrees (used for enemies' direction cone). 90° = down.
  facing: type === 'enemy' ? 90 : undefined,
    };
    setState(prev => ({ ...prev, elements: [...prev.elements, newEl], highlightedElementId: null }));
  };

  const createCoverFromBlocks = (coverBlocks, coverType) => {
    if (coverBlocks.length === 0) {
      console.warn('No cover blocks selected; no cover elements created');
      return;
    }

    // Build occupied map for existing non-cover elements to avoid overlap
    const occupied = new Set();
    (state.elements || []).forEach(el => {
      if (el.type === 'cover') return; // only block by tokens/creatures
      for (let dx = 0; dx < el.size; dx++) {
        for (let dy = 0; dy < el.size; dy++) {
          occupied.add(`${el.position.x + dx},${el.position.y + dy}`);
        }
      }
    });

    const groupId = nextGroupId++;
    let created = 0;
    coverBlocks.forEach(({ x, y }) => {
      const key = `${x},${y}`;
      if (occupied.has(key)) {
        console.warn(`Skipping cover at (${x},${y}) because it overlaps an existing element`);
        return; // skip overlapping block
      }
      addElement('cover', {
        position: { x, y },
        size: 1,
        coverType,
        groupId,
      });
      created++;
    });
    if (created === 0) {
      console.warn('All selected cover blocks overlapped existing elements; no cover created');
    }
  };

  const getElementById = (id) => {
    const element = state.elements.find((e) => e.id === parseInt(id));
    if (!element) {
      console.warn(`Element with id ${id} not found`);
    }
    return element;
  };

  const updateElementPosition = (id, x, y) => {
    const el = getElementById(id);
    if (!el) {
      console.warn(`Element with id ${id} not found`);
      return;
    }

    // For cover group, clamp movement so all blocks stay in bounds and do not overlap other elements
    if (el.type === 'cover' && el.groupId) {
      const groupElements = state.elements.filter(e => e.type === 'cover' && e.groupId === el.groupId);
      const dx = x - el.position.x;
      const dy = y - el.position.y;

      // Find allowed dx/dy so all blocks stay in bounds
      let maxDx = dx;
      let maxDy = dy;
      groupElements.forEach(e => {
        // Clamp dx so x >= 0 and x + size <= width
        if (e.position.x + maxDx < 0) {
          maxDx = -e.position.x;
        }
        if (e.position.x + maxDx + e.size > state.grid.width) {
          maxDx = state.grid.width - e.size - e.position.x;
        }
        // Clamp dy so y >= 0 and y + size <= height
        if (e.position.y + maxDy < 0) {
          maxDy = -e.position.y;
        }
        if (e.position.y + maxDy + e.size > state.grid.height) {
          maxDy = state.grid.height - e.size - e.position.y;
        }
      });

      // Check for collisions with other elements
      // Try all possible deltas from maxDx/maxDy down to 0, prioritizing the largest move
      function isCollision(testDx, testDy) {
        // Get new positions for group
        const newPositions = groupElements.map(e => ({
          x: e.position.x + testDx,
          y: e.position.y + testDy,
          size: e.size
        }));
        // Check against all other elements
        return state.elements.some(other => {
          // Skip elements in the same group
          if (other.type === 'cover' && other.groupId === el.groupId) return false;
          // Check overlap
          return newPositions.some(pos => {
            return (
              pos.x < other.position.x + other.size &&
              pos.x + pos.size > other.position.x &&
              pos.y < other.position.y + other.size &&
              pos.y + pos.size > other.position.y
            );
          });
        });
      }

      let finalDx = maxDx;
      let finalDy = maxDy;
      // Try all possible moves from maxDx/maxDy down to 0
      let found = false;
      for (let d = 0; d <= Math.max(Math.abs(maxDx), Math.abs(maxDy)); d++) {
        // Try moving dx/dy closer to zero
        const tryDx = maxDx > 0 ? Math.max(maxDx - d, 0) : Math.min(maxDx + d, 0);
        const tryDy = maxDy > 0 ? Math.max(maxDy - d, 0) : Math.min(maxDy + d, 0);
        if (!isCollision(tryDx, tryDy)) {
          finalDx = tryDx;
          finalDy = tryDy;
          found = true;
          break;
        }
      }
      // If all moves collide, don't move
      if (!found && isCollision(0, 0)) {
        finalDx = 0;
        finalDy = 0;
      }

      const updatedElements = state.elements.map((e) => {
        if (e.type === 'cover' && e.groupId === el.groupId) {
          const newX = e.position.x + finalDx;
          const newY = e.position.y + finalDy;
          return { ...e, position: { x: newX, y: newY } };
        }
        return e;
      });
      setState({ ...state, elements: updatedElements, highlightedElementId: null });
    } else {
      // Clamp single element to bounds
      let clampedX = Math.max(0, Math.min(x, state.grid.width - el.size));
      let clampedY = Math.max(0, Math.min(y, state.grid.height - el.size));
      // Prevent moving onto cover cells (covers remain stationary unless explicitly dragged)
      const wouldOverlapCover = state.elements.some(other => {
        if (other.type !== 'cover') return false;
        return (
          clampedX < other.position.x + other.size &&
          clampedX + el.size > other.position.x &&
          clampedY < other.position.y + other.size &&
          clampedY + el.size > other.position.y
        );
      });
      if (wouldOverlapCover) {
        // Do not move onto cover; leave state unchanged
        return;
      }
      const dx = clampedX - el.position.x;
      const dy = clampedY - el.position.y;
      const shouldUpdateFacing = (dx !== 0 || dy !== 0) && (el.type === 'enemy');
      const angleDeg = shouldUpdateFacing ? (Math.atan2(dy, dx) * 180 / Math.PI) : el.facing;
      setState({
        ...state,
        elements: state.elements.map((e) =>
          e.id === id
            ? { ...e, position: { x: clampedX, y: clampedY }, ...(shouldUpdateFacing ? { facing: angleDeg } : {}) }
            : e
        ),
        highlightedElementId: null,
      });
    }
  };

  const toggleMovementHighlight = (id, battleMapRef) => {
    console.log('Toggling movement highlight for id:', id, 'battleMapRef:', battleMapRef, 'battleMapRef.current:', battleMapRef?.current);
    const element = getElementById(id);
    if (!element || element.type === 'cover' || !element.movement) {
      console.warn(`Cannot toggle movement highlight for element ${id}:`, { element });
      return;
    }
    console.log('Element details:', { id, type: element.type, movement: element.movement, position: element.position });

    const attemptHighlight = () => {
      if (!battleMapRef || !battleMapRef.current) {
        console.error('Battle map ref is null or undefined', { battleMapRef });
        return false;
      }

      const battleMap = battleMapRef.current;
      if (!(battleMap instanceof HTMLElement)) {
        console.error('battleMap is not an HTMLElement', { battleMap, type: typeof battleMap });
        return false;
      }

      console.log('Battle map element:', battleMap);

      document.querySelectorAll('.movement-highlight').forEach((highlight) => {
        console.log('Removing existing highlight:', highlight);
        highlight.remove();
      });

      // If toggling off the same element, clear state and dataset on the map
      if (state.highlightedElementId === id) {
        try {
          if (battleMap && battleMap.dataset) {
            delete battleMap.dataset.highlightedId;
          }
        } catch {}
        setState({ ...state, highlightedElementId: null });
        console.log('Toggled off highlight for id:', id);
        return true;
      }

  const range = Math.floor((element.movement || 30) / state.grid.cellSize);
      console.log('Calculated range:', range, 'cellSize:', state.grid.cellSize);
      if (range <= 0) {
        console.warn('Range is zero or negative, no highlights will be shown');
        return true;
      }

      const { x, y } = element.position;
      const cells = [];
      for (let dy = -range; dy <= range; dy++) {
        for (let dx = -range; dx <= range; dx++) {
          if (Math.abs(dx) + Math.abs(dy) <= range) {
            const cellX = x + dx;
            const cellY = y + dy;
            if (
              cellX >= 0 &&
              cellX < state.grid.width &&
              cellY >= 0 &&
              cellY < state.grid.height
            ) {
              cells.push({ x: cellX, y: cellY });
            }
          }
        }
      }

      console.log('Cells to highlight:', cells);

      // Helper to convert a hex color string to rgb components
      const hexToRgb = (hex) => {
        try {
          let h = (hex || '').toString().trim();
          if (!h) return null;
          if (h.startsWith('rgb')) {
            // rgb or rgba already
            const nums = h.replace(/rgba?\(|\)|\s/g, '').split(',').map(Number);
            if (nums.length >= 3) return { r: nums[0], g: nums[1], b: nums[2] };
            return null;
          }
          if (h[0] === '#') h = h.slice(1);
          if (h.length === 3) {
            h = h.split('').map((c) => c + c).join('');
          }
          if (h.length !== 6) return null;
          const r = parseInt(h.slice(0, 2), 16);
          const g = parseInt(h.slice(2, 4), 16);
          const b = parseInt(h.slice(4, 6), 16);
          if ([r, g, b].some((v) => Number.isNaN(v))) return null;
          return { r, g, b };
        } catch {
          return null;
        }
      };
      const rgb = hexToRgb(element.color) || { r: 33, g: 150, b: 243 }; // fallback to blue
      let highlightCount = 0;
      // Record highlighted id on the DOM immediately so clicks can be handled without waiting for React state flush
      try {
        if (battleMap && battleMap.dataset) {
          battleMap.dataset.highlightedId = String(id);
        }
      } catch {}

      cells.forEach(({ x, y }) => {
        const cell = battleMap.querySelector(`.grid-cell[data-x="${x}"][data-y="${y}"]`);
        if (cell) {
          console.log(`Found cell at x=${x}, y=${y}:`, cell);
          const highlight = document.createElement('div');
          highlight.classList.add('movement-highlight');
          // Style the highlight to match the element's selected color
          const alpha = 0.45;
          highlight.style.backgroundColor = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
          highlight.style.boxShadow = `0 0 10px 5px rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
          highlight.style.border = `1px solid rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 1)`;
          // Append visibility eye using same logic as player cards (grey fraction)
          // Only show visibility eye for players, not enemies
          if (element.type === 'player') {
            if (isCellVisibleToAnyEnemy(state, x, y)) {
              const eye = createVisibilityIconNode(14, '#ffffff', { outlined: true, opacity: 0.35, strokeWidth: 2 });
              highlight.appendChild(eye);
            }
          }
          cell.appendChild(highlight);
          console.log(`Appended highlight to cell at x=${x}, y=${y}`);
          highlightCount++;
        } else {
          console.warn(`Cell not found at x=${x}, y=${y}`);
        }
      });
      console.log(`Total highlights added: ${highlightCount}`);

      setState({ ...state, highlightedElementId: id });
      return true;
    };

    if (!attemptHighlight()) {
      console.warn('battleMapRef not ready, scheduling retry for highlight');
      setTimeout(() => {
        if (!attemptHighlight()) {
          console.error('battleMapRef still not ready after retry');
        }
      }, 500);
    }
  };

  const highlightCoverGroup = (groupId) => {
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
  };

  const renderElementsList = () => {};

  const updateElement = (id, updates) => {
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
      setState({ ...state, highlightedElementId: null });
    } else {
      console.error(`Cannot update element with id ${id}: not found`);
    }
  };

  const deleteElement = (id) => {
    const el = getElementById(id);
    if (el && el.type === 'cover' && el.groupId) {
      state.elements = state.elements.filter((e) => !(e.type === 'cover' && e.groupId === el.groupId));
    } else {
      state.elements = state.elements.filter((e) => e.id !== parseInt(id));
    }
    setState({ ...state, highlightedElementId: null });
  };

  return {
    addElement,
    createCoverFromBlocks,
    getElementById,
    updateElementPosition,
    toggleMovementHighlight,
    highlightCoverGroup,
    renderElementsList,
    updateElement,
    deleteElement,
  };
};