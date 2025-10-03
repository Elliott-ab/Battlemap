import React, { useRef, useEffect, useState } from 'react';
import IconButton from './common/IconButton.jsx';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faMinus, faPlus, faCrosshairs, faGroupArrowsRotate } from '@fortawesome/free-solid-svg-icons';
import compassRose from '/compass-rose-n-svgrepo-com.svg';
import { useGrid } from '../Utils/grid.js';

const BattleMap = ({ state, setState, isDrawingCover, coverBlocks, setCoverBlocks, drawEnvType, updateElementPosition, pushUndo, highlightCoverGroup, battleMapRef, isHost = false, currentUserId = null }) => {
  const localBattleMapRef = useRef(null);
  const containerRef = useRef(null);
  const currentDragElement = useRef(null);
  // Track whether a drag occurred to suppress the subsequent click
  const didDragRef = useRef(false);
  const suppressNextClickRef = useRef(false);
  const { renderGrid } = useGrid(state);

  // Zoom/pan state
  const MIN_SCALE = 0.5;
  const MAX_SCALE = 3.0;
  const transformRef = useRef({ scale: 1, tx: 0, ty: 0 });
  const userZoomedRef = useRef(false);
  const panZoomActiveRef = useRef(false);
  const activePointersRef = useRef(new Map()); // id -> {x,y}
  const pinchStartRef = useRef(null); // {distance, mid:{x,y}, scale, tx, ty}
  const [zoom, setZoom] = useState(1);
  const [rotationIndex, setRotationIndex] = useState(0); // 0,1,2,3 => 0°,90°,180°,270°
  // Desktop mouse panning (middle or right button)
  const mousePanningRef = useRef({ active: false, pointerId: null, startX: 0, startY: 0, startTx: 0, startTy: 0 });
  const lastCenteredIdRef = useRef(null);
  const hasPannedRef = useRef(false);
  // Drawing mode painting state
  const paintingRef = useRef({ active: false, visited: new Set() });

  const processCoverAtPoint = (clientX, clientY) => {
    const cell = getCellFromPoint(clientX, clientY);
    if (!cell) return;
    const x = parseInt(cell.dataset.x);
    const y = parseInt(cell.dataset.y);
    const key = `${x},${y}`;
    if (paintingRef.current.visited.has(key)) return;
    paintingRef.current.visited.add(key);
    // Mirror the click-to-draw logic
    const idx = coverBlocks.findIndex(b => b.x === x && b.y === y);
    if (idx >= 0) {
      const existing = coverBlocks[idx];
      if ((existing.coverType || 'half') === drawEnvType) {
        setCoverBlocks(coverBlocks.filter((_, i) => i !== idx));
        const hl = cell.querySelector('.drawing-cover-highlight');
        if (hl) hl.remove();
      } else {
        const next = [...coverBlocks];
        next[idx] = { ...existing, coverType: drawEnvType };
        setCoverBlocks(next);
      }
    } else {
      const highlight = document.createElement('div');
      highlight.classList.add('drawing-cover-highlight');
      cell.appendChild(highlight);
      setCoverBlocks([...coverBlocks, { x, y, coverType: drawEnvType }]);
    }
  };

  const setTransform = (next) => {
    transformRef.current = next;
    const el = localBattleMapRef.current;
    if (el) {
      const { scale, tx, ty } = next;
  el.style.transformOrigin = '0 0';
      // Apply only translate+scale; rotation handled by coordinate remap in renderGrid
      el.style.transform = `translate(${tx}px, ${ty}px) scale(${scale})`;
    }
    setZoom(next.scale);
  };

  const fitToScreen = () => {
    const container = containerRef.current;
    const map = localBattleMapRef.current;
    if (!container || !map) return;
    // Use scrollWidth/Height to get untransformed size
    const contentW = map.scrollWidth;
    const contentH = map.scrollHeight;
    const styles = window.getComputedStyle(container);
    const padX = parseFloat(styles.paddingLeft || '0') + parseFloat(styles.paddingRight || '0');
    const padY = parseFloat(styles.paddingTop || '0') + parseFloat(styles.paddingBottom || '0');
    const availW = Math.max(0, container.clientWidth - padX);
    const availH = Math.max(0, container.clientHeight - padY);
    if (contentW <= 0 || contentH <= 0 || availW <= 0 || availH <= 0) return;
    const s = Math.min(availW / contentW, availH / contentH);
    // Translate within the container content box (no need to add padding offsets)
    const tx = (availW - s * contentW) / 2;
    const ty = (availH - s * contentH) / 2;
    setTransform({ scale: s, tx, ty });
  };

  const scheduleFitToScreen = () => {
    // Ensure layout is up to date before measuring
    requestAnimationFrame(() => {
      fitToScreen();
    });
  };

  // Center view on a specific element ID without changing scale
  const centerOnElementId = (id) => {
    try {
      const container = containerRef.current;
      const map = localBattleMapRef.current;
      if (!container || !map) return;
      const elDiv = map.querySelector(`.element[data-id="${id}"]`);
      if (!elDiv) return;
      const rect = { w: elDiv.offsetWidth, h: elDiv.offsetHeight, x: elDiv.offsetLeft, y: elDiv.offsetTop };
      const cx = rect.x + rect.w / 2;
      const cy = rect.y + rect.h / 2;
      const s = transformRef.current.scale;
      const P = { x: container.clientWidth / 2, y: container.clientHeight / 2 };
      const tx = P.x - s * cx;
      const ty = P.y - s * cy;
      setTransform({ scale: s, tx, ty });
      userZoomedRef.current = true; // treat as user-driven to avoid auto-fit overriding
    } catch {}
  };

  // Note: automatic recentering on selection/turn is disabled per requirements.

  // Log when battleMapRef.current changes
  useEffect(() => {
    console.log('BattleMap: localBattleMapRef.current changed:', localBattleMapRef.current);
    if (localBattleMapRef.current) {
      // Update the passed battleMapRef if provided
      if (battleMapRef && battleMapRef.current !== localBattleMapRef.current) {
        battleMapRef.current = localBattleMapRef.current;
        console.log('BattleMap: Updated passed battleMapRef.current:', battleMapRef.current);
      }
    }
  }, [localBattleMapRef, battleMapRef]);

  // Render grid when state or ref is ready
  useEffect(() => {
    console.log('BattleMap useEffect triggered, localBattleMapRef:', localBattleMapRef.current);
    if (localBattleMapRef.current) {
      console.log('Rendering grid with localBattleMapRef:', localBattleMapRef.current);
  renderGrid(localBattleMapRef, rotationIndex);
      console.log('Grid rendering complete, cells should be available');
      // Fit to screen by default if user hasn't zoomed
      if (!userZoomedRef.current) {
        scheduleFitToScreen();
      }
    } else {
      console.warn('localBattleMapRef not ready, scheduling retry');
      const timer = setTimeout(() => {
        if (localBattleMapRef.current) {
          console.log('Retry: Rendering grid with localBattleMapRef:', localBattleMapRef.current);
          renderGrid(localBattleMapRef, rotationIndex);
          console.log('Retry: Grid rendering complete, cells should be available');
          if (battleMapRef && battleMapRef.current !== localBattleMapRef.current) {
            battleMapRef.current = localBattleMapRef.current;
            console.log('Retry: Updated passed battleMapRef.current:', battleMapRef.current);
          }
          if (!userZoomedRef.current) {
            scheduleFitToScreen();
          }
        } else {
          console.warn('localBattleMapRef still not ready after retry');
        }
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [state, rotationIndex, renderGrid, localBattleMapRef, battleMapRef]);

  // Ensure drawing mode starts with a clean click state (no suppressed first click)
  useEffect(() => {
    if (isDrawingCover) {
      suppressNextClickRef.current = false;
      didDragRef.current = false;
    }
  }, [isDrawingCover]);

  const getCellFromPoint = (clientX, clientY) => {
    // Temporarily disable pointer events on draggable overlays to get the underlying grid cell
    const toDisable = Array.from(document.elementsFromPoint(clientX, clientY))
      .filter(n => n.classList && (n.classList.contains('element') || n.classList.contains('direction-cone')));
    toDisable.forEach(n => n.style.pointerEvents = 'none');
    const cell = document.elementFromPoint(clientX, clientY);
    toDisable.forEach(n => n.style.pointerEvents = '');
    return cell ? cell.closest('.grid-cell') : null;
  };

  const handleClick = (e) => {
    // Only respond to primary (left) mouse button
    if (e && typeof e === 'object') {
      const btn = (e.nativeEvent && typeof e.nativeEvent.button === 'number') ? e.nativeEvent.button : (typeof e.button === 'number' ? e.button : 0);
      if (btn !== 0) return;
    }
    // If we just finished or are in a drag, ignore the synthetic click that follows.
    // This covers event ordering differences between native and React synthetic events.
    if (didDragRef.current || suppressNextClickRef.current) {
      didDragRef.current = false;
      suppressNextClickRef.current = false;
      return;
    }
  const cell = getCellFromPoint(e.clientX, e.clientY);
  if (!cell) return;

    // Cover drawing mode
    if (isDrawingCover) {
      const x = parseInt(cell.dataset.x);
      const y = parseInt(cell.dataset.y);
      const idx = coverBlocks.findIndex(b => b.x === x && b.y === y);
      if (idx >= 0) {
        // If same type is selected, remove; otherwise update type
        const existing = coverBlocks[idx];
        if ((existing.coverType || 'half') === drawEnvType) {
          setCoverBlocks(coverBlocks.filter((_, i) => i !== idx));
          const hl = cell.querySelector('.drawing-cover-highlight');
          if (hl) hl.remove();
        } else {
          const next = [...coverBlocks];
          next[idx] = { ...existing, coverType: drawEnvType };
          setCoverBlocks(next);
        }
      } else {
        const highlight = document.createElement('div');
        highlight.classList.add('drawing-cover-highlight');
        cell.appendChild(highlight);
        setCoverBlocks([...coverBlocks, { x, y, coverType: drawEnvType }]);
      }
      return;
    }

    // Movement or cover highlight mode
    // Read highlighted id from DOM first to avoid React state timing requiring a second click
    const container = localBattleMapRef.current;
    const domHighlightedId = container?.dataset?.highlightedId ? parseInt(container.dataset.highlightedId) : null;
    const effectiveHighlightedId = domHighlightedId || state.highlightedElementId;
    if (effectiveHighlightedId) {
      const element = state.elements.find(e => e.id === effectiveHighlightedId);
      if (!element) return;
      const x = parseInt(cell.dataset.x);
      const y = parseInt(cell.dataset.y);
      if (element.type === 'player' || element.type === 'enemy') {
          // Players may only move their own player token; hosts can move any
          if (!isHost) {
            if (element.type !== 'player' || (element.participantUserId && element.participantUserId !== currentUserId)) {
              // Not allowed to move
              try {
                if (container && container.dataset) delete container.dataset.highlightedId;
              } catch {}
              setState(prev => ({ ...prev, highlightedElementId: null }));
              return;
            }
          }
          // Determine reachability by presence of a movement highlight in the target cell
          const hasHighlight = !!cell.querySelector('.movement-highlight');
          if (hasHighlight) {
          updateElementPosition(element.id, x, y);
          pushUndo();
          // Clear DOM dataset and state highlight after moving
          try {
            if (container && container.dataset) delete container.dataset.highlightedId;
          } catch {}
          setState(prev => ({ ...prev, highlightedElementId: null }));
        } else {
          // Remove highlight if clicked outside range
          try {
            if (container && container.dataset) delete container.dataset.highlightedId;
          } catch {}
          setState({ ...state, highlightedElementId: null });
        }
      } else if (element.type === 'cover') {
        // Players cannot move cover
        if (!isHost) {
          try {
            if (container && container.dataset) delete container.dataset.highlightedId;
          } catch {}
          setState(prev => ({ ...prev, highlightedElementId: null }));
          return;
        }
        // Click-to-move for cover: move then end selection/highlighting
        updateElementPosition(element.id, x, y);
        pushUndo();
        // Clear any manual cover overlays and movement highlights
        try {
          document.querySelectorAll('.cover-highlight').forEach(h => h.remove());
          document.querySelectorAll('.movement-highlight').forEach(h => h.remove());
        } catch {}
        // Clear DOM dataset and state highlighted id
        try {
          if (container && container.dataset) delete container.dataset.highlightedId;
        } catch {}
        setState(prev => ({ ...prev, highlightedElementId: null }));
        return;
      }
    }

    // If it's currently an enemy's turn and no movement occurred, allow clicking to set facing angle
    const order = state.initiativeOrder || [];
    if (order.length) {
      const currentId = order[(state.currentTurnIndex || 0) % order.length];
      const currentEl = state.elements.find(el => el.id === currentId);
      if (currentEl && currentEl.type === 'enemy') {
        const x = parseInt(cell.dataset.x);
        const y = parseInt(cell.dataset.y);
        const dx = x - currentEl.position.x;
        const dy = y - currentEl.position.y;
        if (dx !== 0 || dy !== 0) {
          const angleDeg = Math.atan2(dy, dx) * 180 / Math.PI; // 0=right, 90=down
          setState(prev => ({
            ...prev,
            elements: prev.elements.map(ei => ei.id === currentEl.id ? { ...ei, facing: angleDeg } : ei),
          }));
          pushUndo();
          return;
        }
      }
    }
  };

  const handlePointerDown = (e) => {
    // Only left mouse button should initiate element drag/move; ignore touch to avoid accidental drags
    if (e.pointerType === 'mouse') {
      if (e.button !== 0) return;
    } else if (e.pointerType === 'touch') {
      // Let touch gestures be handled by the container (two-finger pan/zoom); don't start token drags
      return;
    }
    if (isDrawingCover) return;
    // If movement highlight is active for a token, let the subsequent click handle movement
    const container = localBattleMapRef.current;
    const domHighlightedId = container?.dataset?.highlightedId ? parseInt(container.dataset.highlightedId) : null;
    const effectiveHighlightedId = domHighlightedId || state.highlightedElementId;
    if (effectiveHighlightedId) {
      const el = state.elements.find(x => x.id === effectiveHighlightedId);
      if (el && (el.type === 'player' || el.type === 'enemy') && el.movement) {
        return; // don't start a drag or highlight cover; allow click-to-move
      }
    }
    const elDiv = e.target.closest('.element');
  if (elDiv) {
      // Prevent the default to avoid generating a click after drag
      if (typeof e.preventDefault === 'function') e.preventDefault();
      if (typeof e.stopPropagation === 'function') e.stopPropagation();
      let targetDiv = elDiv;
      const clickedId = parseInt(elDiv.dataset.id);
      const clickedEl = state.elements.find(x => x.id === clickedId);
      if (clickedEl && (clickedEl.type === 'player' || clickedEl.type === 'enemy') && clickedEl.incapacitated) {
        return; // do not allow drag on incapacitated units
      }
      // Players can only drag their own player token
      if (!isHost && clickedEl) {
        if (clickedEl.type !== 'player' || (clickedEl.participantUserId && clickedEl.participantUserId !== currentUserId)) {
          return;
        }
      }
      // If the clicked element is a cover but there is a token in the same cell, prefer dragging the token
      // EXCEPT when a cover is currently selected via Sidebar (user intent: reposition cover)
      if (clickedEl && clickedEl.type === 'cover') {
        // Players cannot drag cover
        if (!isHost) return;
        const selectedIsCover = !!state.highlightedElementId && (() => {
          const sel = state.elements.find(x => x.id === state.highlightedElementId);
          return sel && sel.type === 'cover';
        })();
        const cell = getCellFromPoint(e.clientX, e.clientY);
        if (cell) {
          const cx = parseInt(cell.dataset.x);
          const cy = parseInt(cell.dataset.y);
          const token = state.elements.find(x => (x.type === 'player' || x.type === 'enemy') && x.position.x === cx && x.position.y === cy);
          if (token && !selectedIsCover) {
            const tokenDiv = document.querySelector(`.element[data-id="${token.id}"]`);
            if (tokenDiv) {
              targetDiv = tokenDiv;
            }
          }
        }
      }
      console.log('Started dragging element:', targetDiv.dataset.id);
      currentDragElement.current = targetDiv;
      targetDiv.classList.add('selected');
      targetDiv.style.zIndex = '20';
      didDragRef.current = false; // reset drag tracker
      const id = parseInt(targetDiv.dataset.id);
      const el = state.elements.find(e => e.id === id);
      if (el && (el.type === 'player' || el.type === 'enemy') && el.incapacitated) {
        return; // safety double-check
      }
      // If a cover group was previously selected, clear it when dragging a non-cover token
      if (el && el.type !== 'cover' && state.highlightedElementId) {
        const highlighted = state.elements.find(h => h.id === state.highlightedElementId);
        if (highlighted && highlighted.type === 'cover') {
          setState(prev => ({ ...prev, highlightedElementId: null }));
        }
      }
      if (el && el.type === 'cover' && el.groupId) {
        highlightCoverGroup(el.groupId);
      }
    }
  };

  const handlePointerMove = (e) => {
    if (!currentDragElement.current) return;
    const cell = getCellFromPoint(e.clientX, e.clientY);
    if (cell) {
      const x = parseInt(cell.dataset.x);
      const y = parseInt(cell.dataset.y);
      const id = parseInt(currentDragElement.current.dataset.id);
      console.log('Dragging to cell:', { x, y, id });
      didDragRef.current = true; // mark that a drag occurred
      updateElementPosition(id, x, y);
    }
  };

  const handlePointerUp = () => {
    if (currentDragElement.current) {
      console.log('Finished dragging element:', currentDragElement.current.dataset.id);
      currentDragElement.current.classList.remove('selected');
      // Remove inline z-index so CSS controls stacking (players/enemies above cover)
      currentDragElement.current.style.removeProperty('z-index');
      currentDragElement.current = null;
      document.querySelectorAll('.cover-highlight').forEach(highlight => highlight.remove());
      // If a drag actually happened, suppress the next click to avoid unintended moves
      if (didDragRef.current) {
        suppressNextClickRef.current = true;
      }
      didDragRef.current = false;
      pushUndo();
    }
  };

  useEffect(() => {
    document.addEventListener('pointermove', handlePointerMove);
    document.addEventListener('pointerup', handlePointerUp);
    document.addEventListener('pointercancel', handlePointerUp);
    return () => {
      document.removeEventListener('pointermove', handlePointerMove);
      document.removeEventListener('pointerup', handlePointerUp);
      document.removeEventListener('pointercancel', handlePointerUp);
    };
  }, [handlePointerMove, handlePointerUp]);

  // Handle pinch-to-zoom with two pointers; keep midpoint stationary
  const onContainerPointerDown = (e) => {
    // Drawing mode: start painting on left mouse or single-finger touch
    if (isDrawingCover) {
      if ((e.pointerType === 'mouse' && e.button === 0) || e.pointerType === 'touch') {
        paintingRef.current.active = true;
        paintingRef.current.visited = new Set();
        processCoverAtPoint(e.clientX, e.clientY);
        suppressNextClickRef.current = true;
        if (typeof e.preventDefault === 'function') e.preventDefault();
        if (typeof e.stopPropagation === 'function') e.stopPropagation();
        // Do not start panning when painting
      }
    }
    // Desktop mouse panning: middle (1) or right (2) button
    if (e.pointerType === 'mouse' && (e.button === 1 || e.button === 2)) {
      // Ignore if clicking on overlay controls
      if (e.target && typeof e.target.closest === 'function' && e.target.closest('.zoom-controls')) return;
      const mp = mousePanningRef.current;
      mp.active = true;
      mp.pointerId = e.pointerId;
      mp.startX = e.clientX;
      mp.startY = e.clientY;
      mp.startTx = transformRef.current.tx;
      mp.startTy = transformRef.current.ty;
      // visual feedback
      try { containerRef.current?.classList?.add('panning'); } catch {}
      // prevent token drag and context menu
      if (typeof e.preventDefault === 'function') e.preventDefault();
      if (typeof e.stopPropagation === 'function') e.stopPropagation();
      return;
    }
    // Track pointers for gestures
    activePointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (activePointersRef.current.size === 2) {
      // If a token drag was started, cancel it in favor of gesture panning/zooming
      if (currentDragElement.current) {
        try {
          currentDragElement.current.classList.remove('selected');
          currentDragElement.current.style.removeProperty('z-index');
        } catch {}
        currentDragElement.current = null;
        didDragRef.current = false;
        suppressNextClickRef.current = true;
      }
      // Initialize pinch (no mobile auto-centering)
      const pts = Array.from(activePointersRef.current.values());
      const dx = pts[1].x - pts[0].x;
      const dy = pts[1].y - pts[0].y;
      const dist = Math.hypot(dx, dy);
      // Compute midpoint in container-local coordinates so anchoring is stable
      const containerEl = containerRef.current;
      const containerRect = containerEl?.getBoundingClientRect?.();
      let mid;
      if (containerRect) {
        const styles = window.getComputedStyle(containerEl);
        const padLeft = parseFloat(styles.paddingLeft || '0');
        const padTop = parseFloat(styles.paddingTop || '0');
        mid = {
          x: ((pts[0].x + pts[1].x) / 2) - containerRect.left - padLeft,
          y: ((pts[0].y + pts[1].y) / 2) - containerRect.top - padTop,
        };
      } else {
        mid = { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 };
      }
      const { scale, tx, ty } = transformRef.current;
      pinchStartRef.current = { distance: dist, mid, scale, tx, ty };
      panZoomActiveRef.current = true;
      // prevent token drag click from following
      suppressNextClickRef.current = true;
      e.preventDefault();
    // If painting, stop painting and switch to gesture pan/zoom
    if (paintingRef.current.active) {
      paintingRef.current.active = false;
      paintingRef.current.visited.clear();
    }
    }
  };

  const onContainerPointerMove = (e) => {
    // Drawing mode painting
    if (isDrawingCover && paintingRef.current.active) {
      processCoverAtPoint(e.clientX, e.clientY);
      if (typeof e.preventDefault === 'function') e.preventDefault();
      return;
    }
    // Mouse panning
    const mp = mousePanningRef.current;
    if (mp.active && e.pointerId === mp.pointerId) {
      const dx = e.clientX - mp.startX;
      const dy = e.clientY - mp.startY;
      setTransform({ scale: transformRef.current.scale, tx: mp.startTx + dx, ty: mp.startTy + dy });
      userZoomedRef.current = true;
      hasPannedRef.current = true;
      if (typeof e.preventDefault === 'function') e.preventDefault();
      return;
    }
    if (!panZoomActiveRef.current || activePointersRef.current.size < 2) return;
    if (activePointersRef.current.has(e.pointerId)) {
      activePointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    }
    const pts = Array.from(activePointersRef.current.values());
    if (pts.length < 2) return;
  const dx = pts[1].x - pts[0].x;
  const dy = pts[1].y - pts[0].y;
  const dist = Math.hypot(dx, dy);
    // Midpoint in container-local coordinates
    const containerEl = containerRef.current;
    const containerRect = containerEl?.getBoundingClientRect?.();
    let mid;
    if (containerRect) {
      const styles = window.getComputedStyle(containerEl);
      const padLeft = parseFloat(styles.paddingLeft || '0');
      const padTop = parseFloat(styles.paddingTop || '0');
      mid = {
        x: ((pts[0].x + pts[1].x) / 2) - containerRect.left - padLeft,
        y: ((pts[0].y + pts[1].y) / 2) - containerRect.top - padTop,
      };
    } else {
      mid = { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 };
    }
    const start = pinchStartRef.current;
    if (!start || start.distance <= 0) return;
    // Determine if this is a two-finger pan (no scale change) or pinch (scale change)
    const scaleRatio = dist / start.distance;
    // Threshold to consider as zoom vs. pure pan
    const zoomEpsilon = 0.01; // ~1% change
    if (Math.abs(scaleRatio - 1) < zoomEpsilon) {
      // Two-finger pan: translate by the midpoint delta
      const dxMid = mid.x - start.mid.x;
      const dyMid = mid.y - start.mid.y;
      setTransform({ scale: transformRef.current.scale, tx: start.tx + dxMid, ty: start.ty + dyMid });
    } else {
      // Pinch zoom with anchored midpoint
      let nextScale = start.scale * scaleRatio;
      nextScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, nextScale));
      // Keep the midpoint fixed: P = T + s*C => T = P - s*C, where C = (P - T0)/s0
      const Cx = (start.mid.x - start.tx) / start.scale;
      const Cy = (start.mid.y - start.ty) / start.scale;
      const nextTx = mid.x - nextScale * Cx;
      const nextTy = mid.y - nextScale * Cy;
      setTransform({ scale: nextScale, tx: nextTx, ty: nextTy });
    }
    userZoomedRef.current = true;
    hasPannedRef.current = true; // two-finger gesture includes panning
    e.preventDefault();
  };

  const onContainerPointerUp = (e) => {
    // Stop painting on release
    if (paintingRef.current.active) {
      paintingRef.current.active = false;
      paintingRef.current.visited.clear();
    }
    // End mouse panning
    const mp = mousePanningRef.current;
    if (mp.active && e.pointerId === mp.pointerId) {
      mp.active = false;
      mp.pointerId = null;
      try { containerRef.current?.classList?.remove('panning'); } catch {}
      return;
    }
    activePointersRef.current.delete(e.pointerId);
    if (activePointersRef.current.size < 2) {
      panZoomActiveRef.current = false;
      pinchStartRef.current = null;
    }
  };

  // Fit to screen on viewport resize if user hasn't zoomed manually
  useEffect(() => {
    const onResize = () => {
      if (!userZoomedRef.current) fitToScreen();
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Desktop slider: center on selected/turn element ONLY when zooming in
  const setScaleAroundViewportCenter = (desiredScale) => {
    const container = containerRef.current;
    const { scale, tx, ty } = transformRef.current;
    if (!container) return;
    const sNew = Math.max(MIN_SCALE, Math.min(MAX_SCALE, desiredScale));
    // Default anchor is viewport center
    let anchor = { x: container.clientWidth / 2, y: container.clientHeight / 2 };
    // If zooming in and a target is selected or has turn, center on it for this zoom change
    if (sNew > scale) {
      try {
        const order = state.initiativeOrder || [];
        const currentTurnId = order.length ? order[(state.currentTurnIndex || 0) % order.length] : null;
        const targetId = state.highlightedElementId || currentTurnId || null;
        if (targetId && localBattleMapRef.current) {
          const elDiv = localBattleMapRef.current.querySelector(`.element[data-id="${targetId}"]`);
          if (elDiv) {
            const cxContent = elDiv.offsetLeft + elDiv.offsetWidth / 2;
            const cyContent = elDiv.offsetTop + elDiv.offsetHeight / 2;
            anchor = {
              x: transformRef.current.tx + transformRef.current.scale * cxContent,
              y: transformRef.current.ty + transformRef.current.scale * cyContent,
            };
          }
        }
      } catch {}
    }
    const Cx = (anchor.x - tx) / scale;
    const Cy = (anchor.y - ty) / scale;
    const nextTx = anchor.x - sNew * Cx;
    const nextTy = anchor.y - sNew * Cy;
    setTransform({ scale: sNew, tx: nextTx, ty: nextTy });
    userZoomedRef.current = true;
  };

  // Wheel zoom anywhere on the grid, anchored to the mouse pointer
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e) => {
      // Ignore wheel events over overlay UI controls
      if (e.target && typeof e.target.closest === 'function' && e.target.closest('.zoom-controls')) return;
      // Only handle when the event originates within the map container
      // Prevent the page from scrolling while zooming the map
      if (typeof e.preventDefault === 'function') e.preventDefault();
      const { scale, tx, ty } = transformRef.current;
      // Smooth zoom factor based on deltaY (trackpad-friendly). Positive deltaY => zoom out
      const zoomIntensity = 0.0015; // tune for sensitivity
      const factor = Math.exp(-e.deltaY * zoomIntensity);
      let desired = scale * factor;
      const sNew = Math.max(MIN_SCALE, Math.min(MAX_SCALE, desired));
      // Anchor at the pointer position in container-local coordinates
  const rect = el.getBoundingClientRect();
  const styles = window.getComputedStyle(el);
  const padLeft = parseFloat(styles.paddingLeft || '0');
  const padTop = parseFloat(styles.paddingTop || '0');
  const P = { x: e.clientX - rect.left - padLeft, y: e.clientY - rect.top - padTop };
      const Cx = (P.x - tx) / scale;
      const Cy = (P.y - ty) / scale;
      const nextTx = P.x - sNew * Cx;
      const nextTy = P.y - sNew * Cy;
      setTransform({ scale: sNew, tx: nextTx, ty: nextTy });
      userZoomedRef.current = true;
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  return (
    <section
      ref={containerRef}
      className="map-container"
      onPointerDown={onContainerPointerDown}
      onPointerMove={onContainerPointerMove}
      onPointerUp={onContainerPointerUp}
      onPointerCancel={onContainerPointerUp}
      onContextMenu={(e) => { e.preventDefault(); }}
    >
      <div
        ref={localBattleMapRef}
        className="battle-map"
        data-rotation={rotationIndex}
        onClick={handleClick}
        onAuxClick={(e) => { /* prevent middle/right click from acting like a click */ e.preventDefault?.(); e.stopPropagation?.(); }}
        onPointerDown={handlePointerDown}
      ></div>
      {/* Desktop-only zoom controls (bottom-right) */}
      <div className="zoom-controls">
        <IconButton size="small" aria-label="Zoom out" onClick={() => setScaleAroundViewportCenter(zoom - 0.1)}>
          <FontAwesomeIcon icon={faMinus} style={{ color: '#fff', fontSize: 14 }} />
        </IconButton>
        <input
          type="range"
          min={MIN_SCALE}
          max={MAX_SCALE}
          step={0.01}
          value={zoom}
          onChange={(e) => setScaleAroundViewportCenter(parseFloat(e.target.value))}
          aria-label="Zoom"
        />
        <IconButton size="small" aria-label="Zoom in" onClick={() => setScaleAroundViewportCenter(zoom + 0.1)}>
          <FontAwesomeIcon icon={faPlus} style={{ color: '#fff', fontSize: 14 }} />
        </IconButton>
        <IconButton size="small" aria-label="Recenter" title="Recenter" onClick={() => { userZoomedRef.current = false; /* allow auto-fit */ scheduleFitToScreen(); }}>
          <FontAwesomeIcon icon={faCrosshairs} style={{ color: '#fff', fontSize: 14 }} />
        </IconButton>
        <IconButton size="small" aria-label="Rotate" title="Rotate clockwise" onClick={() => setRotationIndex((r) => (r + 1) % 4)}>
          <FontAwesomeIcon icon={faGroupArrowsRotate} style={{ color: '#fff', fontSize: 14 }} />
        </IconButton>
      </div>
      {/* Compass overlay (top-right), rotates with the grid */}
      <img
        src={compassRose}
        alt="Compass"
        className="compass-overlay"
        style={{ transform: `rotate(${rotationIndex * 90}deg)` }}
        onClick={(e) => { e.stopPropagation?.(); setRotationIndex((r) => (r + 1) % 4); }}
        onPointerDown={(e) => { e.stopPropagation?.(); }}
        onPointerUp={(e) => { e.stopPropagation?.(); }}
      />
    </section>
  );
};

export default BattleMap;