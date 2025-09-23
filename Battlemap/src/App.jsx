import React, { useState, useEffect, useRef } from 'react';
import Toolbar from './components/Toolbar.jsx';
import Sidebar from './components/Sidebar.jsx';
import BattleMap from './components/BattleMap.jsx';
import EditModal from './components/Modals/EditModal.jsx';
import AddCharacterModal from './components/Modals/AddCharacterModal.jsx';
import GridModal from './components/Modals/GridModal.jsx';
import SaveModal from './components/Modals/SaveModal.jsx';
import OverwriteModal from './components/Modals/OverwriteModal.jsx';
import InitiativeModal from './components/Modals/InitiativeModal.jsx';
import { initialState } from './Utils/state.js';
import { useGrid } from './Utils/grid.js';
import { useElements } from './Utils/elements.js';
import { useModals } from './Utils/modals.js';
import { useStorage } from './Utils/storage.js';
import { useUndo } from './Utils/undo.js';

function App() {
  const [drawEnvType, setDrawEnvType] = useState('half');
  const toggleDrawingMode = () => {
    if (!isDrawingCover) {
      setIsDrawingCover(true);
      setCoverBlocks([]);
    } else {
      // Finish drawing: group drawn cells by their selected coverType and create distinct groups
      setIsDrawingCover(false);
      try {
        const byType = (coverBlocks || []).reduce((acc, b) => {
          const t = b.coverType || 'half';
          if (!acc[t]) acc[t] = [];
          acc[t].push({ x: b.x, y: b.y });
          return acc;
        }, {});
        Object.entries(byType).forEach(([type, blocks]) => {
          if (blocks.length) createCoverFromBlocks(blocks, type);
        });
      } finally {
        setCoverBlocks([]);
        pushUndo();
      }
    }
  };
  const [state, setState] = useState({ ...initialState, highlightedElementId: null });
  const [isDrawingCover, setIsDrawingCover] = useState(false);
  const [coverBlocks, setCoverBlocks] = useState([]);
  const [modalState, setModalState] = useState({
    editModal: { isOpen: false, elementId: null },
    gridModal: false,
    saveModal: false,
    overwriteModal: false,
    addCharacter: false,
    initiative: false,
  });
  const [undoStack, setUndoStack] = useState([]);
  const uploadInputRef = useRef(null);
  const battleMapRef = useRef(null);

  const { updateGridInfo } = useGrid(state);
  const { addElement, createCoverFromBlocks, getElementById, updateElementPosition, toggleMovementHighlight, highlightCoverGroup, renderElementsList, updateElement, deleteElement } = useElements(state, setState);
  const { showEditModal, showGridModal, showSaveModal, showOverwriteModal } = useModals(setModalState);
  const { downloadMap, uploadMap } = useStorage(state, setState);
  const { pushUndo, undo } = useUndo(state, setState, setUndoStack);

  useEffect(() => {
    updateGridInfo();
    renderElementsList();
  }, [state, updateGridInfo, renderElementsList]);

  // Sync isDrawingCover and coverBlocks into state for grid rendering
  const mergedState = { ...state, isDrawingCover, coverBlocks };

  // Advance to next turn based on initiativeOrder
  const handleNextTurn = () => {
    setState(prev => {
      const len = (prev.initiativeOrder || []).length;
      if (!len) return prev;
      const nextIdx = ((prev.currentTurnIndex || 0) + 1) % len;
      return { ...prev, currentTurnIndex: nextIdx };
    });
  };

  const handlePrevTurn = () => {
    setState(prev => {
      const len = (prev.initiativeOrder || []).length;
      if (!len) return prev;
      const prevIdx = ((prev.currentTurnIndex || 0) - 1 + len) % len;
      return { ...prev, currentTurnIndex: prevIdx };
    });
  };

  // Handler for adding characters (batch logic from Sidebar)
  const handleAddCharacters = (characterType, quantity) => {
    let localNextId = Math.max(1, ...state.elements.map(e => e.id || 0)) + 1;
    const getNextNumber = (type) => {
      const nums = state.elements.filter(e => e.type === type).map(e => parseInt((e.name||'').split(' ')[1]) || 0);
      if (nums.length === 0) return 1;
      return Math.max(...nums) + 1;
    };
    let localNextPlayerId = getNextNumber('player');
    let localNextEnemyId = getNextNumber('enemy');
    let newElements = [...state.elements];
    let batch = [];
    // Player color palette (exclude enemy red)
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
    // Seed color index based on current players so colors keep cycling across sessions
    let nextPlayerColorIdx = state.elements.filter(e => e.type === 'player').length % PLAYER_COLORS.length;
    const findEmptyPosition = (elements, size = 1, grid) => {
      for (let y = 0; y < state.grid.height - size + 1; y++) {
        for (let x = 0; x < state.grid.width - size + 1; x++) {
          let isOccupied = false;
          for (const el of elements) {
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
      return { x: 0, y: 0 };
    };
    for (let i = 0; i < quantity; i++) {
      const pos = findEmptyPosition(newElements, 1, state.grid);
      let type = characterType;
      let name = type === 'player' ? `Player ${localNextPlayerId++}` : `Enemy ${localNextEnemyId++}`;
      let color = type === 'player'
        ? PLAYER_COLORS[(nextPlayerColorIdx++) % PLAYER_COLORS.length]
        : '#f44336';
      let newEl = {
        id: localNextId++,
        name,
        type,
        position: pos,
        size: 1,
        color,
        maxHp: type === 'player' ? 10 : undefined,
        currentHp: type === 'player' ? 10 : undefined,
        movement: 30,
        damage: type === 'enemy' ? 0 : undefined,
        incapacitated: type !== 'cover' ? false : undefined
      };
      newElements.push(newEl);
      batch.push(newEl);
    }
    setState(prev => ({ ...prev, elements: [...prev.elements, ...batch], highlightedElementId: null }));
    setModalState(prev => ({ ...prev, addCharacter: false }));
  };

  return (
    <div className="app-container">
      <Toolbar
        isDrawingCover={isDrawingCover}
        showGridModal={showGridModal}
        clearMap={() => { setState({ ...state, elements: [], highlightedElementId: null }); pushUndo(); }}
        undo={undo}
        showSaveModal={showSaveModal}
        showOverwriteModal={showOverwriteModal}
        gridSize={state.grid.cellSize}
      />
      <div className="main-content">
        <Sidebar
          state={mergedState}
          setState={setState}
          toggleMovementHighlight={toggleMovementHighlight}
          highlightCoverGroup={highlightCoverGroup}
          showEditModal={showEditModal}
          battleMapRef={battleMapRef}
          isDrawingCover={isDrawingCover}
          toggleDrawingMode={toggleDrawingMode}
          drawEnvType={drawEnvType}
          setDrawEnvType={setDrawEnvType}
          openAddCharacterModal={() => setModalState(prev => ({ ...prev, addCharacter: true }))}
          openInitiativeModal={() => setModalState(prev => ({ ...prev, initiative: true }))}
        />
        <BattleMap
          state={mergedState}
          setState={setState}
          isDrawingCover={isDrawingCover}
          coverBlocks={coverBlocks}
          setCoverBlocks={setCoverBlocks}
          drawEnvType={drawEnvType}
          updateElementPosition={updateElementPosition}
          pushUndo={pushUndo}
          highlightCoverGroup={highlightCoverGroup}
          battleMapRef={battleMapRef}
        />
      </div>
      <AddCharacterModal
        isOpen={modalState.addCharacter}
        onClose={() => setModalState(prev => ({ ...prev, addCharacter: false }))}
        onAdd={handleAddCharacters}
      />
      <EditModal
        isOpen={modalState.editModal.isOpen}
        elementId={modalState.editModal.elementId}
        state={mergedState}
        updateElement={updateElement}
        deleteElement={deleteElement}
        pushUndo={pushUndo}
        onClose={() => setModalState(prev => ({ ...prev, editModal: { isOpen: false, elementId: null } }))}
      />
      <GridModal
        isOpen={modalState.gridModal}
        state={mergedState}
        setState={setState}
        pushUndo={pushUndo}
        onClose={() => setModalState(prev => ({ ...prev, gridModal: false }))}
      />
      <InitiativeModal
        isOpen={modalState.initiative}
        state={mergedState}
        setState={setState}
        onClose={() => setModalState(prev => ({ ...prev, initiative: false }))}
      />
      <SaveModal
        isOpen={modalState.saveModal}
        downloadMap={downloadMap}
        onClose={() => setModalState(prev => ({ ...prev, saveModal: false }))}
      />
      <OverwriteModal
        isOpen={modalState.overwriteModal}
        uploadInputRef={uploadInputRef}
        uploadMap={uploadMap}
        onClose={() => setModalState(prev => ({ ...prev, overwriteModal: false }))}
      />
      <input
        type="file"
        id="uploadInput"
        style={{ display: 'none' }}
        ref={uploadInputRef}
        onChange={(e) => uploadMap(e.target.files[0])}
      />
    </div>
  );
}

export default App;