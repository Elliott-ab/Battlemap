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
import GlobalModifiersModal from './components/Modals/GlobalModifiersModal.jsx';
import { initialState } from './Utils/state.js';
import { useGrid } from './Utils/grid.js';
import { useElements } from './Utils/elements.js';
import { useModals } from './Utils/modals.js';
import { useStorage } from './Utils/storage.js';
import { useUndo } from './Utils/undo.js';
import { supabase } from './supabaseClient';
import { getMapState, upsertMapState, pushDraftToLive } from './utils/mapService';

function App({ onHostGame, onLeaveGame, onJoinGame, gameId = null, user = null }) {
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
    globalModifiers: false,
  });
  const [undoStack, setUndoStack] = useState([]);
  const uploadInputRef = useRef(null);
  const battleMapRef = useRef(null);
  const [isHost, setIsHost] = useState(false);
  const [channel, setChannel] = useState('live'); // 'live' or 'draft'

  const { updateGridInfo } = useGrid(state);
  const { addElement, addCharactersBatch, createCoverFromBlocks, getElementById, updateElementPosition, toggleMovementHighlight, highlightCoverGroup, updateElement, deleteElement } = useElements(state, setState);
  const { showEditModal, showGridModal, showSaveModal, showOverwriteModal } = useModals(setModalState);
  const { downloadMap, uploadMap } = useStorage(state, setState);
  const { pushUndo, undo } = useUndo(state, setState, setUndoStack);

  useEffect(() => {
    updateGridInfo();
  }, [state, updateGridInfo]);

  // When a participant joins (emitted by BattlemapPage subscription), add a player token if not present
  useEffect(() => {
    const handler = (e) => {
      const row = e.detail;
      if (!row?.user_id) return;
      const exists = (state.elements || []).some(el => el.type === 'player' && el.participantUserId === row.user_id);
      if (!exists) addElement('player', { participantUserId: row.user_id });
    };
    window.addEventListener('participant-joined', handler);
    return () => window.removeEventListener('participant-joined', handler);
  }, [state.elements, addElement]);

  // Determine host status based on participants.role (avoids selecting from games)
  useEffect(() => {
    let active = true;
    (async () => {
      if (!gameId || !user) { setIsHost(false); return; }
      const { data, error } = await supabase
        .from('participants')
        .select('role')
        .eq('game_id', gameId)
        .eq('user_id', user.id)
        .single();
      if (!active) return;
      const host = !error && data?.role === 'host';
      setIsHost(host);
      // Host edits draft by default, players always view/edit live
      setChannel(host ? 'draft' : 'live');
    })();
    return () => { active = false; };
  }, [gameId, user?.id]);

  // Load initial map state for the current channel
  useEffect(() => {
    let active = true;
    (async () => {
      if (!gameId) return;
      const row = await getMapState(gameId, channel);
      if (!active || !row?.state) return;
      // Replace elements/grid from stored state if present
      if (row.state.elements || row.state.grid) {
        setState((prev) => ({ ...prev, ...row.state }));
      }
    })();
    return () => { active = false; };
  }, [gameId, channel]);

  // Realtime subscription to live updates (players and host when viewing live)
  useEffect(() => {
    if (!gameId) return;
    const channelName = `map-live-${gameId}`;
    const ch = supabase
      .channel(channelName)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'map_states', filter: `game_id=eq.${gameId}` }, (payload) => {
        const row = payload.new;
        if (row.channel !== 'live') return;
        if (row.state) setState((prev) => ({ ...prev, ...row.state }));
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [gameId]);

  // Persist edits: players write to live; host writes to draft unless switching to live
  useEffect(() => {
    const debounce = setTimeout(async () => {
      try {
        if (!gameId || !user) return;
        const saveState = { elements: state.elements, grid: state.grid };
        await upsertMapState(gameId, channel, saveState, user.id);
      } catch (e) {
        // swallow
      }
    }, 600);
    return () => clearTimeout(debounce);
  }, [state.elements, state.grid, gameId, user?.id, channel]);

  // Sync isDrawingCover and coverBlocks into state for grid rendering
  const mergedState = { ...state, isDrawingCover, coverBlocks };

  // Use centralized batch add API
  const handleAddCharacters = (characterType, quantity) => {
    addCharactersBatch(characterType, quantity);
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
        openGlobalModifiers={() => setModalState(prev => ({ ...prev, globalModifiers: true }))}
        onHostGame={onHostGame}
        onLeaveGame={onLeaveGame}
        onJoinGame={onJoinGame}
        isHost={isHost}
        currentChannel={channel}
        onToggleChannel={() => setChannel((c) => (c === 'draft' ? 'live' : 'draft'))}
        onPushToPlayers={async () => {
          if (!isHost || !gameId || !user) return;
          try { await pushDraftToLive(gameId, user.id); } catch {}
        }}
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
      <GlobalModifiersModal
        isOpen={modalState.globalModifiers}
        state={mergedState}
        setState={setState}
        onClose={() => setModalState(prev => ({ ...prev, globalModifiers: false }))}
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