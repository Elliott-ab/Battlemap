import React, { useState, useEffect, useRef } from 'react';
import Toolbar from './components/Toolbar.jsx';
import Sidebar from './components/Sidebar.jsx';
import BattleMap from './components/BattleMap.jsx';
import EditModal from './components/Modals/EditModal.jsx';
import GridModal from './components/Modals/GridModal.jsx';
import SaveModal from './components/Modals/SaveModal.jsx';
import OverwriteModal from './components/Modals/OverwriteModal.jsx';
import { initialState } from './Utils/state.js';
import { useGrid } from './Utils/grid.js';
import { useElements } from './Utils/elements.js';
import { useModals } from './Utils/modals.js';
import { useStorage } from './Utils/storage.js';
import { useUndo } from './Utils/undo.js';

function App() {
  const toggleDrawingMode = () => {
    if (!isDrawingCover) {
      setIsDrawingCover(true);
      setCoverBlocks([]);
    } else {
      setIsDrawingCover(false);
      createCoverFromBlocks(coverBlocks, 'half');
      setCoverBlocks([]);
      pushUndo();
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

  return (
    <div className="app-container">
      <Toolbar
        isDrawingCover={isDrawingCover}
        toggleDrawingMode={toggleDrawingMode}
        addPlayer={() => { addElement('player'); pushUndo(); }}
        addEnemy={() => { addElement('enemy'); pushUndo(); }}
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
        />
        <BattleMap
          state={mergedState}
          setState={setState}
          isDrawingCover={isDrawingCover}
          coverBlocks={coverBlocks}
          setCoverBlocks={setCoverBlocks}
          updateElementPosition={updateElementPosition}
          pushUndo={pushUndo}
          highlightCoverGroup={highlightCoverGroup}
          battleMapRef={battleMapRef}
        />
      </div>
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