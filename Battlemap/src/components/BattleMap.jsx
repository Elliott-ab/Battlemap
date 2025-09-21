import React, { useRef, useEffect } from 'react';
import { useGrid } from '../Utils/grid.js';

const BattleMap = ({ state, setState, isDrawingCover, coverBlocks, setCoverBlocks, updateElementPosition, pushUndo, highlightCoverGroup, battleMapRef }) => {
  const localBattleMapRef = useRef(null);
  const currentDragElement = useRef(null);
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

  const getCellFromPoint = (clientX, clientY) => {
    let el = document.elementFromPoint(clientX, clientY);
    if (el && el.classList.contains('element')) {
      el.style.pointerEvents = 'none';
      const cell = document.elementFromPoint(clientX, clientY);
      el.style.pointerEvents = 'auto';
      return cell ? cell.closest('.grid-cell') : null;
    }
    return el ? el.closest('.grid-cell') : null;
  };

  const handleClick = (e) => {
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
      } else if (element.type === 'cover' && element.groupId) {
        // Move the whole cover group to the clicked cell (same as drag logic)
        updateElementPosition(element.id, x, y);
        pushUndo();
      }
    }
  };

  const handlePointerDown = (e) => {
    if (isDrawingCover) return;
    const elDiv = e.target.closest('.element');
    if (elDiv) {
      console.log('Started dragging element:', elDiv.dataset.id);
      currentDragElement.current = elDiv;
      elDiv.classList.add('selected');
      elDiv.style.zIndex = '20';
      const id = parseInt(elDiv.dataset.id);
      const el = state.elements.find(e => e.id === id);
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
      pushUndo();
    }
  };

  useEffect(() => {
    document.addEventListener('pointermove', handlePointerMove);
    document.addEventListener('pointerup', handlePointerUp);
    return () => {
      document.removeEventListener('pointermove', handlePointerMove);
      document.removeEventListener('pointerup', handlePointerUp);
    };
  }, [handlePointerMove, handlePointerUp]);

  return (
    <section className="map-container">
      <div ref={localBattleMapRef} className="battle-map" onClick={handleClick} onPointerDown={handlePointerDown}></div>
    </section>
  );
};

export default BattleMap;