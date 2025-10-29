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
  mode = 'line', // 'line' | 'path'
}) {
  // Line mode state
  const [start, setStart] = useState(null); // {x,y} | null
  const [end, setEnd] = useState(null); // {x,y} | null
  const [finalized, setFinalized] = useState(false);
  // Path mode state
  const [points, setPoints] = useState([]); // [{x,y}, ...]
  const [hover, setHover] = useState(null); // {x,y} | null
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
    // Touch: disable drag-to-measure; support tap-to-start and tap-to-end only
    if (e.pointerType === 'touch') {
      if (e.isPrimary === false) return; // allow second finger for pinch/pan
      if (typeof e.preventDefault === 'function') e.preventDefault();
      const cell = getCellFromPoint(e.clientX, e.clientY);
      if (!cell) return;
      const x = parseInt(cell.dataset.x);
      const y = parseInt(cell.dataset.y);
      if (mode === 'path') {
        setPoints(prev => [...prev, { x, y }]);
      } else {
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
      }
      // Do NOT start a drag or capture on touch
      return;
    }
    // Mouse: only left button
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    // Prevent page scroll/text selection while interacting
    if (typeof e.preventDefault === 'function') e.preventDefault();
    const cell = getCellFromPoint(e.clientX, e.clientY);
    if (!cell) return;
    const x = parseInt(cell.dataset.x);
    const y = parseInt(cell.dataset.y);
    if (mode === 'path') {
      setPoints(prev => [...prev, { x, y }]);
      draggingRef.current = true;
    } else {
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
    }
    // Capture this pointer to keep receiving move/up, but don't interfere with second-finger events
    try { e.currentTarget?.setPointerCapture?.(e.pointerId); } catch {}
  }, [getCellFromPoint, start, finalized, onMeasure, mode]);

  const handlePointerMove = useCallback((e) => {
    // Ignore touch move for ruler (no drag-to-measure on touch)
    if (e.pointerType === 'touch') return;
    // Allow middle/right-drag panning to work on mouse: don't intercept when those buttons are held
    if (e.pointerType === 'mouse') {
      const isMiddleOrRight = (e.buttons & 6) !== 0; // 2=right, 4=middle
      if (isMiddleOrRight) return;
    }
    // No need to stop propagation; container only pans on two-finger or middle/right mouse
    if (typeof e.preventDefault === 'function') e.preventDefault();
    const cell = getCellFromPoint(e.clientX, e.clientY);
    if (!cell) return;
    const x = parseInt(cell.dataset.x);
    const y = parseInt(cell.dataset.y);
    if (mode === 'path') {
      if (points.length > 0) setHover({ x, y });
    } else {
      // Follow mouse after first click, until finalized
      if (!start || finalized) return;
      setEnd({ x, y });
    }
  }, [getCellFromPoint, start, finalized, mode, points.length]);

  const handlePointerUp = useCallback((e) => {
    // Ignore touch: we don't use drag-to-measure on touch, so no finalize-on-release
    if (e.pointerType === 'touch') return;
    // If middle/right mouse button, let container handle ending the pan
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (draggingRef.current) {
      draggingRef.current = false;
      try { e.currentTarget?.releasePointerCapture?.(e.pointerId); } catch {}
      if (mode === 'path') {
        // nothing on mouse up beyond pointer capture release
        return;
      } else {
        // Finalize on release for drag-to-measure (only if not already finalized via second click)
        if (!finalized && onMeasure && start && end) {
          setFinalized(true);
          try { onMeasure({ start, end }); } catch {}
        }
      }
    }
  }, [onMeasure, start, end, finalized, mode]);

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

  // Compute path segments info for path mode
  const pathInfos = useMemo(() => {
    if (mode !== 'path') return null;
    const pts = [...points];
    if (hover) pts.push(hover); // include preview segment
    if (pts.length < 2) return [];
    const feetPerCell = Number(state?.grid?.cellSize || 5);
    // Build cover set once
    const covers = new Set();
    try {
      (state?.elements || []).forEach(el => {
        if (!el || el.type !== 'cover') return;
        const size = Math.max(1, el.size || 1);
        for (let dx = 0; dx < size; dx++) {
          for (let dy = 0; dy < size; dy++) {
            const key = `${el.position.x + dx},${el.position.y + dy}`;
            if ((el.coverType || 'half') !== 'difficult') covers.add(key);
          }
        }
      });
    } catch {}
    const segs = [];
    let cumulative = 0; // exact running total (unrounded)
    let cumulativeDisplay = 0; // running total of displayed (rounded) segment values
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i];
      const b = pts[i + 1];
      const dx = Math.abs(b.x - a.x);
      const dy = Math.abs(b.y - a.y);
      const euclidCells = Math.hypot(dx, dy);
      const feet = euclidCells * feetPerCell;
      const line = supercoverLine(a.x, a.y, b.x, b.y);
      let blocked = false;
      for (let k = 1; k < line.length - 1; k++) {
        if (covers.has(`${line[k].x},${line[k].y}`)) { blocked = true; break; }
      }
      const displayFeet = Math.round(feet);
      cumulative += feet;
      cumulativeDisplay += displayFeet;
      segs.push({ a, b, feet, displayFeet, cumulative, cumulativeDisplay, line, blocked });
    }
    return segs;
  }, [mode, points, hover, state?.grid?.cellSize, state?.elements]);

  // Build overlay positions using DOM (auto-follows transforms)
  const overlay = useMemo(() => {
    if (!start || !end || !info) return null;
    const map = battleMapRef?.current;
    if (!map) return null;
    const startCell = map.querySelector(`.grid-cell[data-x="${start.x}"][data-y="${start.y}"]`);
    const endCell = map.querySelector(`.grid-cell[data-x="${end.x}"][data-y="${end.y}"]`);
    if (!startCell || !endCell) return null;
    const sc = startCell.getBoundingClientRect();
    const ec = endCell.getBoundingClientRect();
    const container = map.closest('.map-container');
    const cr = container ? container.getBoundingClientRect() : { left: 0, top: 0 };
    const sx = sc.left + sc.width / 2 - cr.left;
    const sy = sc.top + sc.height / 2 - cr.top;
    const ex = ec.left + ec.width / 2 - cr.left;
    const ey = ec.top + ec.height / 2 - cr.top;
    return { sx, sy, ex, ey, containerRect: cr };
  }, [start, end, battleMapRef, info, zoom, viewTick]);

  // Compute start marker position independently so we can show a dot after first tap
  const startOverlay = useMemo(() => {
    if (!start) return null;
    const map = battleMapRef?.current;
    if (!map) return null;
    const startCell = map.querySelector(`.grid-cell[data-x="${start.x}"][data-y="${start.y}"]`);
    if (!startCell) return null;
    const sc = startCell.getBoundingClientRect();
    const container = map.closest('.map-container');
    const cr = container ? container.getBoundingClientRect() : { left: 0, top: 0 };
    const sx = sc.left + sc.width / 2 - cr.left;
    const sy = sc.top + sc.height / 2 - cr.top;
    return { sx, sy };
  }, [start, battleMapRef, zoom, viewTick]);

  const clearPath = useCallback(() => { setPoints([]); setHover(null); }, []);
  React.useEffect(() => { if (mode !== 'path') clearPath(); }, [mode, clearPath]);

  return (
    <div
      className="ruler-overlay"
      style={{ position: 'absolute', inset: 0, zIndex: 60, pointerEvents: 'auto' }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onDoubleClick={mode === 'path' ? clearPath : undefined}
    >
      {mode === 'line' && (startOverlay || (overlay && info)) && (
        <svg width="100%" height="100%" style={{ position: 'absolute', inset: 0 }}>
          {/* If we have both endpoints, draw the line and both endpoint dots */}
          {overlay && info && (
            <>
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
            </>
          )}
          {/* If only the start was chosen (e.g., first tap on mobile), show a start dot */}
          {!overlay && startOverlay && (
            <circle
              cx={startOverlay.sx}
              cy={startOverlay.sy}
              r="4"
              fill="#ffffff"
              stroke="rgba(0,0,0,0.6)"
              strokeWidth="1.5"
            />
          )}
        </svg>
      )}
      {mode === 'path' && (points.length > 0) && (
        <svg width="100%" height="100%" style={{ position: 'absolute', inset: 0 }}>
          {/* Draw dots for all points */}
          {points.map((p, idx) => {
            const map = battleMapRef?.current;
            if (!map) return null;
            const cell = map.querySelector(`.grid-cell[data-x="${p.x}"][data-y="${p.y}"]`);
            if (!cell) return null;
            const cr = map.closest('.map-container')?.getBoundingClientRect?.() || { left: 0, top: 0 };
            const r = cell.getBoundingClientRect();
            const cx = r.left + r.width / 2 - cr.left;
            const cy = r.top + r.height / 2 - cr.top;
            return (
              <circle key={`pt-${idx}`} cx={cx} cy={cy} r="4" fill="#ffffff" stroke="rgba(0,0,0,0.6)" strokeWidth="1.5" />
            );
          })}
          {/* Draw segments and labels (including preview if hover is set) */}
          {pathInfos && pathInfos.map((seg, idx) => {
            const map = battleMapRef?.current;
            if (!map) return null;
            const startCell = map.querySelector(`.grid-cell[data-x="${seg.a.x}"][data-y="${seg.a.y}"]`);
            const endCell = map.querySelector(`.grid-cell[data-x="${seg.b.x}"][data-y="${seg.b.y}"]`);
            if (!startCell || !endCell) return null;
            const container = map.closest('.map-container');
            const cr = container ? container.getBoundingClientRect() : { left: 0, top: 0 };
            const sc = startCell.getBoundingClientRect();
            const ec = endCell.getBoundingClientRect();
            const sx = sc.left + sc.width / 2 - cr.left;
            const sy = sc.top + sc.height / 2 - cr.top;
            const ex = ec.left + ec.width / 2 - cr.left;
            const ey = ec.top + ec.height / 2 - cr.top;
            const labelX = Math.min(ex, sx) + Math.abs(ex - sx) * 0.5;
            const labelY = Math.min(ey, sy) + Math.abs(ey - sy) * 0.5;
            return (
              <g key={`seg-${idx}`}>
                <line x1={sx} y1={sy} x2={ex} y2={ey} stroke={seg.blocked ? '#ef5350' : '#ffffff'} strokeWidth="2" strokeOpacity="0.9" strokeDasharray="6,4" />
                <g>
                  <rect x={labelX - 40} y={labelY - 14} width="80" height="20" rx="6" ry="6" fill="rgba(34,34,34,0.85)" stroke="rgba(255,255,255,0.25)" />
                  <text x={labelX} y={labelY} dominantBaseline="middle" textAnchor="middle" fill="#fff" fontSize="12">
                    {`${seg.displayFeet} ft / ${seg.cumulativeDisplay} ft`}
                  </text>
                </g>
              </g>
            );
          })}
        </svg>
      )}
    </div>
  );
}
