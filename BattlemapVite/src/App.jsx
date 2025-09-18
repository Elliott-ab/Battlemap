import React, { useState, useEffect, useRef } from 'react';
import Toolbar from './components/Toolbar.jsx';
import Sidebar from './components/Sidebar.jsx';
import BattleMap from './components/BattleMap.jsx';
import EditModal from './components/Modals/EditModal.jsx';
import GridModal from './components/Modals/GridModal.jsx';
import SaveModal from './components/Modals/SaveModal.jsx';
import OverwriteModal from './components/Modals/OverwriteModal.jsx';
import { initialState } from './utils/state.js';
import { useGrid } from './utils/grid.js';
import { useElements } from './utils/elements.js';
import { useModals } from './utils/modals.js';
import { useStorage } from './utils/storage.js';
import { useUndo } from './utils/undo.js';

function App() {
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
          state={state}
          toggleMovementHighlight={toggleMovementHighlight}
          highlightCoverGroup={highlightCoverGroup}
          showEditModal={showEditModal}
          battleMapRef={battleMapRef}
        />
        <BattleMap
          state={state}
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
        state={state}
        updateElement={updateElement}
        deleteElement={deleteElement}
        pushUndo={pushUndo}
        onClose={() => setModalState(prev => ({ ...prev, editModal: { isOpen: false, elementId: null } }))}
      />
      <GridModal
        isOpen={modalState.gridModal}
        state={state}
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