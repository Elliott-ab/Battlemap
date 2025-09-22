import React, { useRef, useEffect } from 'react';
import { useGrid } from '../Utils/grid.js';

const BattleMap = ({ state, setState, isDrawingCover, coverBlocks, setCoverBlocks, updateElementPosition, pushUndo, highlightCoverGroup, battleMapRef }) => {
  const localBattleMapRef = useRef(null);
  const currentDragElement = useRef(null);
  // Track whether a drag occurred to suppress the subsequent click
  const didDragRef = useRef(false);
  const suppressNextClickRef = useRef(false);
  const { renderGrid } = useGrid(state);

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
      renderGrid(localBattleMapRef);
      console.log('Grid rendering complete, cells should be available');
    } else {
      console.warn('localBattleMapRef not ready, scheduling retry');
      const timer = setTimeout(() => {
        if (localBattleMapRef.current) {
          console.log('Retry: Rendering grid with localBattleMapRef:', localBattleMapRef.current);
          renderGrid(localBattleMapRef);
          console.log('Retry: Grid rendering complete, cells should be available');
          if (battleMapRef && battleMapRef.current !== localBattleMapRef.current) {
            battleMapRef.current = localBattleMapRef.current;
            console.log('Retry: Updated passed battleMapRef.current:', battleMapRef.current);
          }
        } else {
          console.warn('localBattleMapRef still not ready after retry');
        }
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [state, renderGrid, localBattleMapRef, battleMapRef]);

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
    // If we just finished or are in a drag, ignore the synthetic click that follows.
    // This covers event ordering differences between native and React synthetic events.
    if (didDragRef.current || suppressNextClickRef.current) {
      didDragRef.current = false;
      suppressNextClickRef.current = false;
      return;
    }
    const cell = e.target.closest('.grid-cell');
    if (!cell) return;

    // Cover drawing mode
    if (isDrawingCover) {
      const x = parseInt(cell.dataset.x);
      const y = parseInt(cell.dataset.y);
      const existingHighlight = cell.querySelector('.drawing-cover-highlight');
      if (existingHighlight) {
        existingHighlight.remove();
        setCoverBlocks(coverBlocks.filter(block => block.x !== x || block.y !== y));
      } else {
        const highlight = document.createElement('div');
        highlight.classList.add('drawing-cover-highlight');
        cell.appendChild(highlight);
        setCoverBlocks([...coverBlocks, { x, y }]);
      }
      return;
    }

    // If it's currently an enemy's turn, allow clicking to set facing angle
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
          return; // Don't also trigger movement logic on this click
        }
      }
    }

    // Movement or cover highlight mode
    if (state.highlightedElementId) {
      const element = state.elements.find(e => e.id === state.highlightedElementId);
      if (!element) return;
      const x = parseInt(cell.dataset.x);
      const y = parseInt(cell.dataset.y);
      if (element.type === 'player' || element.type === 'enemy') {
        const range = Math.floor((element.movement || 30) / state.grid.cellSize);
        const { x: ex, y: ey } = element.position;
        // Check if cell is in movement range
        if (Math.abs(x - ex) + Math.abs(y - ey) <= range) {
          updateElementPosition(element.id, x, y);
          pushUndo();
        } else {
          // Remove highlight if clicked outside range
          setState({ ...state, highlightedElementId: null });
        }
      } else if (element.type === 'cover') {
        // Ignore grid click-to-move for cover groups; covers move only via drag
        return;
      }
    }
  };

  const handlePointerDown = (e) => {
    if (isDrawingCover) return;
    const elDiv = e.target.closest('.element');
    if (elDiv) {
      // Prevent the default to avoid generating a click after drag
      if (typeof e.preventDefault === 'function') e.preventDefault();
      if (typeof e.stopPropagation === 'function') e.stopPropagation();
      let targetDiv = elDiv;
      const clickedId = parseInt(elDiv.dataset.id);
      const clickedEl = state.elements.find(x => x.id === clickedId);
      // If the clicked element is a cover but there is a token in the same cell, prefer dragging the token
      if (clickedEl && clickedEl.type === 'cover') {
        const cell = getCellFromPoint(e.clientX, e.clientY);
        if (cell) {
          const cx = parseInt(cell.dataset.x);
          const cy = parseInt(cell.dataset.y);
          const token = state.elements.find(x => (x.type === 'player' || x.type === 'enemy') && x.position.x === cx && x.position.y === cy);
          if (token) {
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

  return (
    <section className="map-container">
      <div ref={localBattleMapRef} className="battle-map" onClick={handleClick} onPointerDown={handlePointerDown}></div>
    </section>
  );
};

export default BattleMap;