import { initialState } from '../utils/state.js';

let nextId = 1;
let nextGroupId = 1;

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
      groupId: type === 'cover' ? groupId : undefined,
    };
    setState(prev => ({ ...prev, elements: [...prev.elements, newEl], highlightedElementId: null }));
  };

  const createCoverFromBlocks = (coverBlocks, coverType) => {
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
        groupId,
      });
    });
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
    if (!el || x < 0 || y < 0 || x + el.size > state.grid.width || y + el.size > state.grid.height) {
      console.warn(`Invalid position update for element ${id}: x=${x}, y=${y}`);
      return;
    }

    console.log('Updating position:', { id, x, y });
    if (el.type === 'cover' && el.groupId) {
      const groupElements = state.elements.filter(e => e.type === 'cover' && e.groupId === el.groupId);
      const dx = x - el.position.x;
      const dy = y - el.position.y;

      const updatedElements = state.elements.map((e) => {
        if (e.type === 'cover' && e.groupId === el.groupId) {
          const newX = e.position.x + dx;
          const newY = e.position.y + dy;
          if (newX < 0 || newY < 0 || newX + e.size > state.grid.width || newY + e.size > state.grid.height) {
            console.warn(`Cannot move group ${el.groupId}: block at (${newX}, ${newY}) out of bounds`);
            return e;
          }
          return { ...e, position: { x: newX, y: newY } };
        }
        return e;
      });
      setState({ ...state, elements: updatedElements, highlightedElementId: null });
    } else {
      setState({
        ...state,
        elements: state.elements.map((e) => e.id === id ? { ...e, position: { x, y } } : e),
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

      if (state.highlightedElementId === id) {
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
      let highlightCount = 0;
      cells.forEach(({ x, y }) => {
        const cell = battleMap.querySelector(`.grid-cell[data-x="${x}"][data-y="${y}"]`);
        if (cell) {
          console.log(`Found cell at x=${x}, y=${y}:`, cell);
          const highlight = document.createElement('div');
          highlight.classList.add('movement-highlight');
          if (element.type === 'enemy') {
            highlight.classList.add('enemy');
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