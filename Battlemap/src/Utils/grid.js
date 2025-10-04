import { isCellVisibleToAnyEnemy, createVisibilityIconNode } from './visibility.js';
import { getSignedCharacterIconUrl } from './characterService.js';

// Lightweight cache for character icons so we don't re-sign on every render
// Key: characterId -> { url: string|null, expiresAt: number, loading?: Promise<string|null> }
const playerIconCache = new Map();

async function resolveCharacterIconUrl(characterId, publicUrlOrPath) {
  if (!characterId || !publicUrlOrPath) return null;
  const now = Date.now();
  const cached = playerIconCache.get(characterId);
  if (cached && cached.expiresAt && cached.expiresAt > now && typeof cached.url !== 'undefined') {
    return cached.url;
  }
  if (cached && cached.loading) {
    try { return await cached.loading; } catch { /* fallthrough */ }
  }
  const loader = (async () => {
    try {
      // Try to create a signed URL (works for private buckets); fall back to the provided URL if signing fails
      let signed = null;
      try { signed = await getSignedCharacterIconUrl(publicUrlOrPath); } catch (_) { signed = null; }
      const finalUrl = signed || publicUrlOrPath;
      // Signed URLs typically last 1h; set TTL to ~50 minutes to be safe. Public URLs can have longer TTL.
      const ttl = signed ? (50 * 60 * 1000) : (60 * 60 * 1000);
      playerIconCache.set(characterId, { url: finalUrl, expiresAt: now + ttl });
      return finalUrl;
    } catch (_) {
      playerIconCache.set(characterId, { url: null, expiresAt: now + 5 * 60 * 1000 });
      return null;
    }
  })();
  playerIconCache.set(characterId, { url: undefined, expiresAt: now + 60 * 1000, loading: loader });
  return loader;
}

function applyIconToPlayerToken(battleMap, elementId, characterId, fallbackUrl) {
  if (!battleMap || !elementId || !characterId) return;
  const apply = (url) => {
    const elDiv = battleMap.querySelector(`.element.player[data-id="${elementId}"]`);
    if (!elDiv) return; // element re-rendered/removed
    if (!url) return; // keep fallback label/color
    elDiv.classList.add('has-icon');
    // Use background-image to fill the circular token
    elDiv.style.backgroundImage = `url("${url}")`;
    elDiv.style.backgroundSize = 'cover';
    elDiv.style.backgroundPosition = 'center';
    elDiv.style.backgroundRepeat = 'no-repeat';
  };
  if (fallbackUrl) {
    // Resolve (sign if needed) using the provided URL/path stored on the token
    resolveCharacterIconUrl(characterId, fallbackUrl).then(apply).catch(() => { /* ignore */ });
    return;
  }
  // No URL on token; cannot resolve without extra permissions
}

export const useGrid = (state) => {
  const renderGrid = (battleMapRef, rotationIndex = 0) => {
    console.log('renderGrid called with battleMapRef:', battleMapRef, 'battleMapRef.current:', battleMapRef?.current);
    const battleMap = battleMapRef.current;
    if (!battleMap) {
      console.warn('Battle map element not found, skipping render');
      return;
    }

    const w = state.grid.width;
    const h = state.grid.height;
    const rot = ((rotationIndex || 0) % 4 + 4) % 4; // normalize
    console.log('Rendering grid (world):', w, h, 'rotationIndex:', rot);
    battleMap.style.setProperty('--grid-width', w);
    battleMap.style.setProperty('--grid-height', h);
    // Display dimensions swap for 90/270
    const dispW = (rot % 2 === 0) ? w : h;
    const dispH = (rot % 2 === 0) ? h : w;
    // Use CSS variable for responsive cell sizing so tracks match elements on mobile/tablet
    battleMap.style.gridTemplateColumns = `repeat(${dispW}, var(--cell-px))`;
    battleMap.style.gridTemplateRows = `repeat(${dispH}, var(--cell-px))`;
    battleMap.innerHTML = '';

    const mapWorldToDisplay = (x, y) => {
      switch (rot) {
        case 1: return { x: h - 1 - y, y: x };
        case 2: return { x: w - 1 - x, y: h - 1 - y };
        case 3: return { x: y, y: w - 1 - x };
        default: return { x, y };
      }
    };

    // Create grid cells
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const cell = document.createElement('div');
        cell.classList.add('grid-cell');
        cell.dataset.x = x;
        cell.dataset.y = y;
        const d = mapWorldToDisplay(x, y);
        cell.style.gridRow = `${d.y + 1}`;
        cell.style.gridColumn = `${d.x + 1}`;
        // Tag every 5th column/row in display coordinates
        if ((d.x + 1) % 5 === 0) cell.classList.add('bold-right');
        if ((d.y + 1) % 5 === 0) cell.classList.add('bold-bottom');
        // Show coverBlocks visually during drawing mode
        if (state.isDrawingCover && Array.isArray(state.coverBlocks)) {
          const b = state.coverBlocks.find(b => b.x === x && b.y === y);
          if (b) {
            // Clean any existing drawing outline to avoid duplicates
            const existing = cell.querySelector('.drawing-cover-highlight');
            if (existing) existing.remove();
            // Render a preview tile that matches final cover appearance
            const preview = document.createElement('div');
            preview.classList.add('element', 'cover', 'custom-cover');
            if (b.coverType) preview.classList.add(b.coverType);
            if (b.coverType === 'difficult') {
              const span = document.createElement('span');
              span.classList.add('token-label');
              span.textContent = 'DT';
              preview.appendChild(span);
            }
            preview.style.pointerEvents = 'none';
            cell.appendChild(preview);
            // Add a visible outline to indicate active drawing selection
            const outline = document.createElement('div');
            outline.classList.add('drawing-cover-highlight');
            cell.appendChild(outline);
          }
        }
        battleMap.appendChild(cell);
      }
    }

    // Add elements
    // Find selected cover groupId if a cover is selected
    let selectedCoverGroupId = null;
    let selectedSingleCoverId = null;
    if (state.highlightedElementId) {
      const selected = state.elements.find(e => e.id === state.highlightedElementId);
      if (selected && selected.type === 'cover') {
        if (selected.groupId) {
          selectedCoverGroupId = selected.groupId;
        } else {
          selectedSingleCoverId = selected.id;
        }
      }
    }
    state.elements.forEach((el) => {
      // Guard: skip elements with no valid position (can happen during join or partial loads)
      if (!el || !el.position || typeof el.position.x !== 'number' || typeof el.position.y !== 'number') {
        console.warn('Skipping element without valid position', el);
        return;
      }
      const elDiv = document.createElement('div');
      elDiv.classList.add('element', el.type);
      // Grey out players and enemies during drawing mode
      if (state.isDrawingCover && (el.type === 'player' || el.type === 'enemy')) {
        elDiv.classList.add('greyed-out');
      }
      if (el.type === 'cover') {
        elDiv.classList.add('custom-cover', el.coverType);
        // Highlight all blocks in the selected group
        if ((selectedCoverGroupId && el.groupId === selectedCoverGroupId) || (selectedSingleCoverId && el.id === selectedSingleCoverId)) {
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
        // Use a label span to keep text upright on map rotation
        const span = document.createElement('span');
        span.classList.add('token-label');
        span.textContent = (el.name && el.name.length > 0) ? el.name[0].toUpperCase() : 'P';
        elDiv.appendChild(span);
        // If a character is associated and has an icon, apply it to the token
        if (el.characterId) {
          // Defer icon application until after the element is in the DOM
          queueMicrotask(() => applyIconToPlayerToken(battleMap, el.id, el.characterId, el.characterIconUrl));
        }
      } else if (el.type === 'cover' && el.coverType === 'difficult') {
        // Difficult terrain: explicit 'DT' label
        const span = document.createElement('span');
        span.classList.add('token-label');
        span.textContent = 'DT';
        elDiv.appendChild(span);
      } else {
        // Default: first letter (includes cover blocks)
        const span = document.createElement('span');
        span.classList.add('token-label');
        span.textContent = el.name && el.name.length ? el.name[0].toUpperCase() : '';
        elDiv.appendChild(span);
      }
      elDiv.dataset.id = el.id;
      // Map element anchor based on rotation and size (square span)
  const size = Math.max(1, el.size || 1);
      let ax = el.position.x;
      let ay = el.position.y;
      switch (rot) {
        case 1:
          ax = h - (el.position.y + size);
          ay = el.position.x;
          break;
        case 2:
          ax = w - (el.position.x + size);
          ay = h - (el.position.y + size);
          break;
        case 3:
          ax = el.position.y;
          ay = w - (el.position.x + size);
          break;
        default:
          ax = el.position.x;
          ay = el.position.y;
      }
      elDiv.style.gridRow = `${ay + 1} / span ${size}`;
      elDiv.style.gridColumn = `${ax + 1} / span ${size}`;
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
  const facingBase = typeof el.facing === 'number' ? el.facing : 90; // 90° = down
  const facingAdj = (facingBase + rot * 90) % 360;
  // Rotate cone so 0°=right, 90°=down
  cone.style.transform = `translate(-50%, -50%) rotate(${facingAdj - 90}deg)`;
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
      if (element && element.position && typeof element.position.x === 'number' && typeof element.position.y === 'number' && (element.type === 'player' || element.type === 'enemy') && element.movement) {
        // Apply active global movement modifiers to compute effective movement in feet
        const applyMovementModifiers = (baseFeet, el, mods) => {
          let value = baseFeet;
          if (!Array.isArray(mods) || !mods.length) return value;
          const applicable = mods.filter(m => m && m.enabled && m.category === 'movement' && (
            (el.type === 'player' && m.applyToPlayers) || (el.type === 'enemy' && m.applyToEnemies)
          ));
          if (!applicable.length) return value;
          let add = 0;
          let mult = 1;
          for (const m of applicable) {
            const raw = (m.magnitude ?? '').toString();
            const num = parseInt(raw.replace(/[^0-9]/g, ''), 10);
            if (!Number.isFinite(num)) continue;
            const mode = m.magnitudeMode || (raw.endsWith('%') ? 'percent' : (raw.trim().startsWith('-') ? 'minus' : 'plus'));
            if (mode === 'percent') {
              // Interpret as setting movement to N% of current (e.g., 50% -> half movement)
              mult *= (num / 100);
            } else if (mode === 'minus') {
              add -= num;
            } else {
              add += num; // 'plus' default
            }
          }
          value = Math.max(0, value + add);
          value = Math.max(0, Math.floor(value * mult));
          return value;
        };

        const baseFeet = (element.movement || 30);
        const effectiveFeet = applyMovementModifiers(baseFeet, element, state.globalModifiers);
        const range = Math.floor(effectiveFeet / state.grid.cellSize);
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
  // Soften movement highlight intensity
  const alphaBg = 0.28; // background fill opacity
  const alphaGlow = 0.22; // outer glow opacity

        // Build sets for impassable and difficult terrain
        const impassable = new Set(); // normal cover (not difficult)
        const difficult = new Set(); // difficult terrain cells
        state.elements.forEach(el => {
          if (el.type === 'cover') {
            const isDifficult = el.coverType === 'difficult';
            for (let dx = 0; dx < el.size; dx++) {
              for (let dy = 0; dy < el.size; dy++) {
                const key = `${el.position.x + dx},${el.position.y + dy}`;
                if (isDifficult) {
                  difficult.add(key);
                } else {
                  impassable.add(key);
                }
              }
            }
          }
        });

        // Dijkstra for weighted reachable cells (cost: 1 normal, 2 difficult)
        const dist = new Map();
        const startKey = `${start.x},${start.y}`;
        dist.set(startKey, 0);
        const frontier = [{ x: start.x, y: start.y, cost: 0 }];

        const inBounds = (x, y) => x >= 0 && x < width && y >= 0 && y < height;
        const directions = [
          { dx: 1, dy: 0 },
          { dx: -1, dy: 0 },
          { dx: 0, dy: 1 },
          { dx: 0, dy: -1 }
        ];

        while (frontier.length > 0) {
          // Extract node with smallest cost
          let minIdx = 0;
          for (let i = 1; i < frontier.length; i++) {
            if (frontier[i].cost < frontier[minIdx].cost) minIdx = i;
          }
          const { x, y, cost } = frontier.splice(minIdx, 1)[0];
          if (cost > range) continue;

          // Highlight cell at (x, y)
          const cell = battleMap.querySelector(`.grid-cell[data-x="${x}"][data-y="${y}"]`);
          if (cell) {
            const highlight = document.createElement('div');
            highlight.classList.add('movement-highlight');
            // lighter background, smaller/softer glow, and a subtler border
            highlight.style.backgroundColor = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alphaBg})`;
            highlight.style.boxShadow = `0 0 6px 2px rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alphaGlow})`;
            highlight.style.border = `1px solid rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.6)`;
            // Tag enemy for potential theming via CSS (kept lightweight)
            if (element.type === 'enemy') highlight.classList.add('enemy');
            // Visibility indicator for players only
            if (element.type === 'player') {
              if (isCellVisibleToAnyEnemy(state, x, y)) {
                const eye = createVisibilityIconNode(14, '#ffffff', { outlined: true, opacity: 0.35, strokeWidth: 2 });
                highlight.appendChild(eye);
              }
            }
            cell.insertBefore(highlight, cell.firstChild);
          }

          // Explore neighbors
          for (const dir of directions) {
            const nx = x + dir.dx;
            const ny = y + dir.dy;
            const key = `${nx},${ny}`;
            if (!inBounds(nx, ny)) continue;
            if (impassable.has(key)) continue; // cannot enter normal cover
            const stepCost = difficult.has(key) ? 2 : 1;
            const newCost = cost + stepCost;
            if (newCost > range) continue;
            const prev = dist.get(key);
            if (prev === undefined || newCost < prev) {
              dist.set(key, newCost);
              frontier.push({ x: nx, y: ny, cost: newCost });
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