// Shared FOV (degrees) for detection logic across UI and grid
export const DETECTION_FOV_DEG = 120;

// Select the current enemy consistent with Sidebar's logic
export function selectCurrentEnemy(state) {
  const elementsArr = state.elements || [];
  const highlightedEnemy = elementsArr.find(e => e.id === state.highlightedElementId && e.type === 'enemy');
  const order = state.initiativeOrder || [];
  const currentId = order.length ? order[(state.currentTurnIndex || 0) % order.length] : null;
  const initiativeEnemy = elementsArr.find(e => e.id === currentId && e.type === 'enemy');
  const fallbackEnemy = elementsArr.find(e => e.type === 'enemy');
  return highlightedEnemy || initiativeEnemy || fallbackEnemy || null;
}

// Compute the same grey fraction used on player cards but for an arbitrary cell
// Returns 1 for fully grey (not visible), 0 for fully visible, or partial based on cover encountered
export function computeGreyFractionForCell(state, cellX, cellY) {
  const enemy = selectCurrentEnemy(state);
  if (!enemy) return 1; // no enemy observing => default to greyed out on player cards

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

  const ex = enemy.position.x + enemy.size / 2;
  const ey = enemy.position.y + enemy.size / 2;
  const px = cellX + 0.5; // use cell center
  const py = cellY + 0.5;
  const dx = px - ex;
  const dy = py - ey;
  if (dx === 0 && dy === 0) return 0;

  const enemyFacing = typeof enemy.facing === 'number' ? enemy.facing : 90; // default down
  const bearing = Math.atan2(dy, dx) * 180 / Math.PI; // 0=right, 90=down
  let delta = ((bearing - enemyFacing + 540) % 360) - 180;
  const inFov = Math.abs(delta) <= (DETECTION_FOV_DEG / 2);
  if (!inFov) return 1; // fully grey outside FOV

  // Ray sample along the line from enemy to cell, check cover
  const steps = Math.max(Math.abs(dx), Math.abs(dy)) * 3; // finer sampling
  let maxSev = 0;
  for (let i = 1; i < steps; i++) { // skip start and end
    const t = i / steps;
    const rx = ex + dx * t;
    const ry = ey + dy * t;
    const cx = Math.floor(rx);
    const cy = Math.floor(ry);
    // skip the destination cell to avoid self-cover
    if (cx === Math.floor(px) && cy === Math.floor(py)) continue;
    const key = `${cx},${cy}`;
    const sev = coverMap.get(key) || 0;
    if (sev > maxSev) maxSev = sev;
    if (maxSev >= 1.0) break; // full cover blocks completely
  }
  return Math.max(0, Math.min(1, maxSev));
}

// Create a small SVG node resembling MUI's Visibility icon
export function createVisibilityIconNode(size = 16, color = '#ffffff', options = {}) {
  const { outlined = true, opacity = 0.6, strokeWidth = 2 } = options;
  const svgNS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(svgNS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', String(size));
  svg.setAttribute('height', String(size));
  svg.classList.add('visibility-eye');
  svg.style.opacity = String(opacity);
  const path = document.createElementNS(svgNS, 'path');
  // Use visibility glyph; render as outline by stroking the path
  path.setAttribute('d', 'M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5C21.27 7.61 17 4.5 12 4.5zm0 12.5c-2.49 0-4.5-2.01-4.5-4.5S9.51 8 12 8s4.5 2.01 4.5 4.5S14.49 17 12 17zm0-7.5c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z');
  if (outlined) {
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', color);
    path.setAttribute('stroke-width', String(strokeWidth));
    path.setAttribute('stroke-linejoin', 'round');
    path.setAttribute('stroke-linecap', 'round');
  } else {
    path.setAttribute('fill', color);
  }
  svg.appendChild(path);
  return svg;
}

// Determine if a cell (cellX, cellY) is visible to any enemy considering their FOV and cover
export function isCellVisibleToAnyEnemy(state, cellX, cellY) {
  const elements = state.elements || [];
  const enemies = elements.filter(e => e.type === 'enemy');
  if (!enemies.length) return false;

  // Build cover severity map once
  const COVER_SEVERITY = {
    'quarter': 0.25,
    'half': 0.5,
    'three-quarters': 0.75,
    'full': 1.0,
  };
  const coverMap = new Map();
  elements.forEach(el => {
    if (el.type === 'cover') {
      const sev = COVER_SEVERITY[el.coverType] || 0;
      const key = `${el.position.x},${el.position.y}`;
      const prev = coverMap.get(key) || 0;
      if (sev > prev) coverMap.set(key, sev);
    }
  });

  const px = cellX + 0.5;
  const py = cellY + 0.5;

  for (const enemy of enemies) {
    const ex = enemy.position.x + enemy.size / 2;
    const ey = enemy.position.y + enemy.size / 2;
    const dx = px - ex;
    const dy = py - ey;
    if (dx === 0 && dy === 0) return true; // same cell
    const enemyFacing = typeof enemy.facing === 'number' ? enemy.facing : 90;
    const bearing = Math.atan2(dy, dx) * 180 / Math.PI;
    const delta = ((bearing - enemyFacing + 540) % 360) - 180;
    const inFov = Math.abs(delta) <= (DETECTION_FOV_DEG / 2);
    if (!inFov) continue;
    // Cover sampling
    const steps = Math.max(Math.abs(dx), Math.abs(dy)) * 3;
    let maxSev = 0;
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      const rx = ex + dx * t;
      const ry = ey + dy * t;
      const cx = Math.floor(rx);
      const cy = Math.floor(ry);
      if (cx === Math.floor(px) && cy === Math.floor(py)) continue;
      const sev = coverMap.get(`${cx},${cy}`) || 0;
      if (sev > maxSev) maxSev = sev;
      if (maxSev >= 1.0) break;
    }
    if (maxSev < 1.0) return true;
  }
  return false;
}
