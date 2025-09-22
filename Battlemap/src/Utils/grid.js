export const useGrid = (state) => {
  const renderGrid = (battleMapRef) => {
    console.log('renderGrid called with battleMapRef:', battleMapRef, 'battleMapRef.current:', battleMapRef?.current);
    const battleMap = battleMapRef.current;
    if (!battleMap) {
      console.warn('Battle map element not found, skipping render');
      return;
    }

    console.log('Rendering grid:', state.grid.width, state.grid.height);
    battleMap.style.setProperty('--grid-width', state.grid.width);
    battleMap.style.setProperty('--grid-height', state.grid.height);
    battleMap.style.gridTemplateColumns = `repeat(${state.grid.width}, 40px)`;
    battleMap.style.gridTemplateRows = `repeat(${state.grid.height}, 40px)`;
    battleMap.innerHTML = '';

    // Create grid cells
    for (let y = 0; y < state.grid.height; y++) {
      for (let x = 0; x < state.grid.width; x++) {
        const cell = document.createElement('div');
        cell.classList.add('grid-cell');
        cell.dataset.x = x;
        cell.dataset.y = y;
        cell.style.gridRow = `${y + 1}`;
        cell.style.gridColumn = `${x + 1}`;
        // Show coverBlocks visually during drawing mode
        if (state.isDrawingCover && Array.isArray(state.coverBlocks)) {
          if (state.coverBlocks.some(b => b.x === x && b.y === y)) {
            const highlight = document.createElement('div');
            highlight.classList.add('drawing-cover-highlight');
            cell.appendChild(highlight);
          }
        }
        battleMap.appendChild(cell);
      }
    }

    // Add elements
    // Find selected cover groupId if a cover is selected
    let selectedCoverGroupId = null;
    if (state.highlightedElementId) {
      const selected = state.elements.find(e => e.id === state.highlightedElementId);
      if (selected && selected.type === 'cover' && selected.groupId) {
        selectedCoverGroupId = selected.groupId;
      }
    }
    state.elements.forEach((el) => {
      const elDiv = document.createElement('div');
      elDiv.classList.add('element', el.type);
      if (el.type === 'cover') {
        elDiv.classList.add('custom-cover', el.coverType);
        // Highlight all blocks in the selected group
        if (selectedCoverGroupId && el.groupId === selectedCoverGroupId) {
          elDiv.classList.add('cover-block-highlight');
          console.log('Highlighting cover block', el.id, el.position);
        }
      } else {
        elDiv.style.backgroundColor = el.color;
      }
      if (el.type === 'enemy') {
        // For enemies, show first letter and up to 2 digits (e.g., E12)
        const match = el.name.match(/^([A-Za-z])[a-zA-Z]*\s*(\d+)?/);
        if (match) {
          let digits = match[2] ? match[2].slice(0, 2) : '';
          elDiv.innerText = match[1].toUpperCase() + digits;
        } else {
          elDiv.innerText = el.name[0].toUpperCase();
        }
      } else if (el.type === 'player') {
        // For players, show the first letter of their name
        elDiv.innerText = (el.name && el.name.length > 0) ? el.name[0].toUpperCase() : 'P';
      } else {
        // Default: first letter
        elDiv.innerText = el.name[0].toUpperCase();
      }
      elDiv.dataset.id = el.id;
      elDiv.style.gridRow = `${el.position.y + 1} / span ${el.size}`;
      elDiv.style.gridColumn = `${el.position.x + 1} / span ${el.size}`;
      // Add facing cone for enemies, rendered under the token
      if (el.type === 'enemy') {
        const cone = document.createElement('div');
        cone.classList.add('direction-cone');
        // supply rgb for gradient color
        const toRgb = (hex) => {
          try {
            let h = (hex || '').toString().trim();
            if (h.startsWith('rgb')) {
              const nums = h.replace(/rgba?\(|\)|\s/g, '').split(',').map(Number);
              if (nums.length >= 3) return { r: nums[0], g: nums[1], b: nums[2] };
            }
            if (h[0] === '#') h = h.slice(1);
            if (h.length === 3) h = h.split('').map(c => c + c).join('');
            if (h.length !== 6) return { r: 244, g: 67, b: 54 };
            return {
              r: parseInt(h.slice(0,2), 16),
              g: parseInt(h.slice(2,4), 16),
              b: parseInt(h.slice(4,6), 16),
            };
          } catch {
            return { r: 244, g: 67, b: 54 };
          }
        };
        const rgb = toRgb(el.color || '#f44336');
        cone.style.setProperty('--cone-rgb', `${rgb.r}, ${rgb.g}, ${rgb.b}`);
  const facing = typeof el.facing === 'number' ? el.facing : 90; // 90° = down
  // Rotate cone so 0°=right, 90°=down
  cone.style.transform = `translate(-50%, -50%) rotate(${facing - 90}deg)`;
        // Append cone to the grid cell so it renders beneath the token
        const cell = battleMap.querySelector(`.grid-cell[data-x="${el.position.x}"][data-y="${el.position.y}"]`);
        if (cell) {
          cell.appendChild(cone);
        }
      }
      battleMap.appendChild(elDiv);
    });

    // Add movement highlights if an element is selected
    if (state.highlightedElementId) {
      const element = state.elements.find(e => e.id === state.highlightedElementId);
      if (element && (element.type === 'player' || element.type === 'enemy') && element.movement) {
        const range = Math.floor((element.movement || 30) / state.grid.cellSize);
        const start = { x: element.position.x, y: element.position.y };
        const width = state.grid.width;
        const height = state.grid.height;
        // Helper to convert a hex/rgb(a) string to rgb components
        const hexToRgb = (hex) => {
          try {
            let h = (hex || '').toString().trim();
            if (!h) return null;
            if (h.startsWith('rgb')) {
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
        const alpha = 0.45;
        // Build a set of blocked cells (cover)
        const blocked = new Set();
        state.elements.forEach(el => {
          if (el.type === 'cover') {
            for (let dx = 0; dx < el.size; dx++) {
              for (let dy = 0; dy < el.size; dy++) {
                blocked.add(`${el.position.x + dx},${el.position.y + dy}`);
              }
            }
          }
        });

        // BFS for reachable cells
        const visited = new Set();
        const queue = [{ x: start.x, y: start.y, dist: 0 }];
        visited.add(`${start.x},${start.y}`);
        while (queue.length > 0) {
          const { x, y, dist } = queue.shift();
          if (dist > range) continue;
          // Highlight cell
          const cell = battleMap.querySelector(`.grid-cell[data-x="${x}"][data-y="${y}"]`);
          if (cell) {
            const highlight = document.createElement('div');
            highlight.classList.add('movement-highlight');
            // Style the highlight to match the element's selected color
            highlight.style.backgroundColor = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
            highlight.style.boxShadow = `0 0 10px 5px rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
            highlight.style.border = `1px solid rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 1)`;
            cell.insertBefore(highlight, cell.firstChild);
          }
          // Explore neighbors
          const directions = [
            { dx: 1, dy: 0 },
            { dx: -1, dy: 0 },
            { dx: 0, dy: 1 },
            { dx: 0, dy: -1 }
          ];
          for (const dir of directions) {
            const nx = x + dir.dx;
            const ny = y + dir.dy;
            const key = `${nx},${ny}`;
            if (
              nx >= 0 && nx < width &&
              ny >= 0 && ny < height &&
              !visited.has(key) &&
              !blocked.has(key)
            ) {
              visited.add(key);
              queue.push({ x: nx, y: ny, dist: dist + 1 });
            }
          }
        }
      }
    }
  };
  const updateGridInfo = () => {
    const gridInfo = document.querySelector('.grid-info');
    if (gridInfo) {
      gridInfo.textContent = `Grid: ${state.grid.cellSize}ft per cell`;
    }
  };

  return { renderGrid, updateGridInfo };
};