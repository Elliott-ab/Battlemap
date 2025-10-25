import React, { useCallback, useMemo, useRef, useState } from 'react';

// Supercover Bresenham: returns every cell the line passes through
function supercoverLine(x0, y0, x1, y1) {
  const points = [];
  const dx = Math.abs(x1 - x0);
  const dy = Math.abs(y1 - y0);
  const sx = (x0 < x1) ? 1 : -1;
  const sy = (y0 < y1) ? 1 : -1;
  let err = dx - dy;
  let x = x0, y = y0;
  const e2 = () => 2 * err;
  while (true) {
    points.push({ x, y });
    if (x === x1 && y === y1) break;
    const e2v = e2();
    if (e2v > -dy) { err -= dy; x += sx; points.push({ x, y }); }
    if (e2v < dx) { err += dx; y += sy; points.push({ x, y }); }
  }
  // Deduplicate consecutive duplicates
  const uniq = [];
  let prev = null;
  for (const p of points) {
    if (!prev || p.x !== prev.x || p.y !== prev.y) uniq.push(p);
    prev = p;
  }
  return uniq;
}

export default function RulerTool({
  state,
  battleMapRef,
  zoom,
  viewTick,
  onMeasure,
}) {
  const [start, setStart] = useState(null); // {x,y} | null
  const [end, setEnd] = useState(null); // {x,y} | null
  const [finalized, setFinalized] = useState(false);
  const draggingRef = useRef(false);

  const getCellFromPoint = useCallback((clientX, clientY) => {
    // Temporarily disable pointer events on overlays/tokens so we can hit the underlying grid cell
    const toDisable = Array.from(document.elementsFromPoint(clientX, clientY)).filter(n => {
      if (!n || !n.classList) return false;
      return (
        n.classList.contains('ruler-overlay') ||
        n.classList.contains('element') ||
        n.classList.contains('direction-cone')
      );
    });
    toDisable.forEach(n => { try { n.style.pointerEvents = 'none'; } catch {} });
    const cell = document.elementFromPoint(clientX, clientY);
    toDisable.forEach(n => { try { n.style.pointerEvents = ''; } catch {} });
    return cell ? cell.closest('.grid-cell') : null;
  }, []);

  const handlePointerDown = useCallback((e) => {
    // For touch: handle primary finger for tap/drag measure; allow second finger to bubble for pinch/pan
    if (e.pointerType === 'touch' && e.isPrimary === false) {
      return; // let container handle multi-touch gestures
    }
    // Mouse: only left button
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    // Prevent page scroll/text selection while interacting
    if (typeof e.preventDefault === 'function') e.preventDefault();
    const cell = getCellFromPoint(e.clientX, e.clientY);
    if (!cell) return;
    const x = parseInt(cell.dataset.x);
    const y = parseInt(cell.dataset.y);
    // Click-to-measure logic:
    // - If no active measurement or previous one finalized, start a new one
    // - Else (awaiting second click), finalize with this cell
    if (!start || finalized) {
      setStart({ x, y });
      setEnd(null);
      setFinalized(false);
    } else {
      setEnd({ x, y });
      setFinalized(true);
      if (onMeasure) {
        try { onMeasure({ start: { ...start }, end: { x, y } }); } catch {}
      }
    }
    draggingRef.current = true;
    // Capture this pointer to keep receiving move/up, but don't interfere with second-finger events
    try { e.currentTarget?.setPointerCapture?.(e.pointerId); } catch {}
  }, [getCellFromPoint, start, finalized, onMeasure]);

  const handlePointerMove = useCallback((e) => {
    // Allow middle/right-drag panning to work on mouse: don't intercept when those buttons are held
    if (e.pointerType === 'mouse') {
      const isMiddleOrRight = (e.buttons & 6) !== 0; // 2=right, 4=middle
      if (isMiddleOrRight) return;
    }
    // Follow mouse after first click, until finalized
    if (!start || finalized) return;
    // No need to stop propagation; container only pans on two-finger or middle/right mouse
    if (typeof e.preventDefault === 'function') e.preventDefault();
    const cell = getCellFromPoint(e.clientX, e.clientY);
    if (!cell) return;
    const x = parseInt(cell.dataset.x);
    const y = parseInt(cell.dataset.y);
    setEnd({ x, y });
  }, [getCellFromPoint, start, finalized]);

  const handlePointerUp = useCallback((e) => {
    // If middle/right mouse button, let container handle ending the pan
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (draggingRef.current) {
      draggingRef.current = false;
      try { e.currentTarget?.releasePointerCapture?.(e.pointerId); } catch {}
      // Finalize on release for drag-to-measure (only if not already finalized via second click)
      if (!finalized && onMeasure && start && end) {
        setFinalized(true);
        try { onMeasure({ start, end }); } catch {}
      }
    }
  }, [onMeasure, start, end, finalized]);

  // Compute line and distance info
  const info = useMemo(() => {
    if (!start || !end) return null;
    const dx = Math.abs(end.x - start.x);
    const dy = Math.abs(end.y - start.y);
    // True geometric distance (Euclidean)
    const euclidCells = Math.hypot(dx, dy);
    const feetPerCell = Number(state?.grid?.cellSize || 5);
    const feet = euclidCells * feetPerCell;
    // LOS check using supercover against cover blocks
    const covers = new Set();
    try {
      (state?.elements || []).forEach(el => {
        if (!el || el.type !== 'cover') return;
        const size = Math.max(1, el.size || 1);
        for (let dx = 0; dx < size; dx++) {
          for (let dy = 0; dy < size; dy++) {
            const key = `${el.position.x + dx},${el.position.y + dy}`;
            // Treat non-difficult terrain as blocking LOS by default
            if ((el.coverType || 'half') !== 'difficult') covers.add(key);
          }
        }
      });
    } catch {}
    const line = supercoverLine(start.x, start.y, end.x, end.y);
    // Ignore first and last cells for LOS block check (allow measuring from/to occupied cells)
    let blocked = false;
    for (let i = 1; i < line.length - 1; i++) {
      const k = `${line[i].x},${line[i].y}`;
      if (covers.has(k)) { blocked = true; break; }
    }
    return { cells: euclidCells, feet, line, blocked };
  }, [start, end, state?.grid?.cellSize, state?.elements]);

  // Build overlay line using DOM positions (auto-follows transforms)
  const overlay = useMemo(() => {
    if (!start || !end || !info) return null;
    const map = battleMapRef?.current;
    if (!map) return null;
    const startCell = map.querySelector(`.grid-cell[data-x="${start.x}"][data-y="${start.y}"]`);
    const endCell = map.querySelector(`.grid-cell[data-x="${end.x}"][data-y="${end.y}"]`);
    if (!startCell || !endCell) return null;
    const sc = startCell.getBoundingClientRect();
    const ec = endCell.getBoundingClientRect();
    // Container for overlay anchoring
    const container = map.closest('.map-container');
    const cr = container ? container.getBoundingClientRect() : { left: 0, top: 0 };
    const sx = sc.left + sc.width / 2 - cr.left;
    const sy = sc.top + sc.height / 2 - cr.top;
    const ex = ec.left + ec.width / 2 - cr.left;
    const ey = ec.top + ec.height / 2 - cr.top;
    return { sx, sy, ex, ey, containerRect: cr };
  }, [start, end, battleMapRef, info, zoom, viewTick]);

  return (
    <div
      className="ruler-overlay"
      style={{ position: 'absolute', inset: 0, zIndex: 60, pointerEvents: 'auto' }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      {overlay && info && (
        <svg
          width="100%"
          height="100%"
          style={{ position: 'absolute', inset: 0 }}
        >
          <line
            x1={overlay.sx}
            y1={overlay.sy}
            x2={overlay.ex}
            y2={overlay.ey}
            stroke={info.blocked ? '#ef5350' : '#ffffff'}
            strokeWidth="2"
            strokeOpacity="0.9"
            strokeDasharray="6,4"
          />
          {/* Endpoints */}
          <circle
            cx={overlay.sx}
            cy={overlay.sy}
            r="4"
            fill={info.blocked ? '#ef5350' : '#ffffff'}
            stroke="rgba(0,0,0,0.6)"
            strokeWidth="1.5"
          />
          <circle
            cx={overlay.ex}
            cy={overlay.ey}
            r="4"
            fill={info.blocked ? '#ef5350' : '#ffffff'}
            stroke="rgba(0,0,0,0.6)"
            strokeWidth="1.5"
          />
          {/* Label near end */}
          <g>
            <rect
              x={Math.min(overlay.ex, overlay.sx) + Math.abs(overlay.ex - overlay.sx) * 0.5 - 40}
              y={Math.min(overlay.ey, overlay.sy) + Math.abs(overlay.ey - overlay.sy) * 0.5 - 14}
              width="80" height="20" rx="6" ry="6"
              fill="rgba(34,34,34,0.85)" stroke="rgba(255,255,255,0.25)" />
            <text
              x={Math.min(overlay.ex, overlay.sx) + Math.abs(overlay.ex - overlay.sx) * 0.5}
              y={Math.min(overlay.ey, overlay.sy) + Math.abs(overlay.ey - overlay.sy) * 0.5}
              dominantBaseline="middle"
              textAnchor="middle"
              fill="#fff"
              fontSize="12"
            >
              {Math.round(info.feet)} ft
            </text>
          </g>
        </svg>
      )}
    </div>
  );
}
