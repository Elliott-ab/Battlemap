import React, { useState, useEffect, useRef } from 'react';
import { Snackbar, Alert } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import Toolbar from './components/Toolbar.jsx';
import Sidebar from './components/Sidebar.jsx';
import BattleMap from './components/BattleMap.jsx';
import EditModal from './components/Modals/EditModal.jsx';
import AddCharacterModal from './components/Modals/AddCharacterModal.jsx';
import CharacterSelectModal from './components/Modals/CharacterSelectModal.jsx';
import GridModal from './components/Modals/GridModal.jsx';
import InitiativeModal from './components/Modals/InitiativeModal.jsx';
import GlobalModifiersModal from './components/Modals/GlobalModifiersModal.jsx';
import { initialState } from './Utils/state.js';
import { useGrid } from './Utils/grid.js';
import { useElements } from './Utils/elements.js';
import { useModals } from './Utils/modals.js';
import { useUndo } from './Utils/undo.js';
import { supabase } from './supabaseClient';
import { getMapState, upsertMapState, pushDraftToLive, listMapDrafts, upsertMapDraft, getMapDraft, listLibraryMaps, upsertLibraryMap, getLibraryMap } from './Utils/mapService.js';
import SaveDraftModal from './components/Modals/SaveDraftModal.jsx';
import LoadDraftModal from './components/Modals/LoadDraftModal.jsx';
import { useGameSession } from './Utils/GameSessionContext.jsx';

function App({ onHostGame, onLeaveGame, onJoinGame, gameId = null, user = null }) {
  const navigate = useNavigate();
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
    addCharacter: false,
    selectCharacter: false,
    initiative: false,
    globalModifiers: false,
    saveDraft: false,
    loadDraft: false,
    saveLibrary: false,
    loadLibrary: false,
  });
  const [draftList, setDraftList] = useState([]);
  const [libraryList, setLibraryList] = useState([]);
  const [undoStack, setUndoStack] = useState([]);
  const battleMapRef = useRef(null);
  const [isHost, setIsHost] = useState(false);
  const { game: sessionGame, updateSession } = useGameSession();
  const initialChannel = (!sessionGame
    ? 'draft'
    : ((sessionGame.role === 'host' || sessionGame.host_id === user?.id) ? 'draft' : 'live'));
  const [channel, setChannel] = useState(initialChannel); // 'live' or 'draft'
  const channelInitializedRef = useRef(false);
  // Character sheet pane removed; selection applies to token only

  const { updateGridInfo } = useGrid(state);
  const { addElement, addCharactersBatch, createCoverFromBlocks, getElementById, updateElementPosition, toggleMovementHighlight, highlightCoverGroup, updateElement, deleteElement } = useElements(state, setState);
  const { showEditModal, showGridModal } = useModals(setModalState);
  const { pushUndo, undo } = useUndo(state, setState, setUndoStack);
  const [toast, setToast] = useState({ open: false, message: '', severity: 'info' });

  useEffect(() => {
    updateGridInfo();
  }, [state, updateGridInfo]);

  // Keep latest state in a ref for reliable save on unmount/visibility changes
  const latestStateRef = useRef({ elements: state.elements, grid: state.grid });
  useEffect(() => {
    latestStateRef.current = { elements: state.elements, grid: state.grid };
  }, [state.elements, state.grid]);

  // Persist latest state when tab hides/unmounts
  usePersistOnHide(gameId, user, channel, latestStateRef);

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

  // Determine host status based on participants.role, with fallback to session (host_id/role)
  useEffect(() => {
    let active = true;
    (async () => {
      if (!user) { setIsHost(false); return; }
      // Local editor (no game): show host-like controls
      if (!gameId) {
        setIsHost(true);
        if (!channelInitializedRef.current) {
          setChannel('draft');
          channelInitializedRef.current = true;
        }
        return;
      }
      const { data, error } = await supabase
        .from('participants')
        .select('role')
        .eq('game_id', gameId)
        .eq('user_id', user.id)
        .single();
      if (!active) return;
      const hostFromParticipants = !error && data?.role === 'host';
      const hostFromSession = !!sessionGame && sessionGame.id === gameId && (sessionGame.role === 'host' || sessionGame.host_id === user.id);
      const host = hostFromParticipants || hostFromSession;
      setIsHost(host);
      // Initialize channel once per game based on role; don't override manual toggles
      if (!channelInitializedRef.current) {
        setChannel(host ? 'draft' : 'live');
        channelInitializedRef.current = true;
      }
      // If a player (not host) just joined (session flag), open selection ONCE
      if (!host && sessionGame?.promptCharacter) {
        setModalState(prev => ({ ...prev, selectCharacter: true }));
      }
    })();
    return () => { active = false; };
  }, [gameId, user?.id, sessionGame?.id, sessionGame?.role, sessionGame?.host_id, sessionGame?.promptCharacter]);

  // Reset channel initialization when game changes
  useEffect(() => { channelInitializedRef.current = false; }, [gameId]);

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

  // Host-only: Open save modal for named draft
  const handleSaveMap = async () => {
    if (!isHost) {
      console.warn('Save Map: Only the host can save maps.');
      return;
    }
    if (!gameId || !user) {
      setToast({ open: true, severity: 'warning', message: 'No game loaded. Host or open a game first.' });
      return;
    }
    setModalState(prev => ({ ...prev, saveDraft: true }));
  };

  // Host-only: Open load modal and list drafts
  const handleLoadMap = async () => {
    if (!isHost) {
      console.warn('Load Map: Only the host can load maps.');
      return;
    }
    if (!gameId) {
      setToast({ open: true, severity: 'warning', message: 'No game loaded. Host or open a game first.' });
      return;
    }
    try {
      const drafts = await listMapDrafts(gameId);
      setDraftList(drafts);
      setModalState(prev => ({ ...prev, loadDraft: true }));
    } catch (e) {
      console.error('List drafts failed:', e);
      setToast({ open: true, severity: 'error', message: 'Failed to fetch saved maps.' });
    }
  };

  // Save current map to the user's library (outside any game)
  const handleSaveLibrary = async () => {
    if (!user) { setToast({ open: true, severity: 'warning', message: 'Please sign in to save maps to your library.' }); return; }
    setModalState(prev => ({ ...prev, saveLibrary: true }));
  };

  // Load a map from the user's library into the current session
  const handleLoadLibrary = async () => {
    if (!user) { setToast({ open: true, severity: 'warning', message: 'Please sign in to access your library.' }); return; }
    // If currently in a game, require host to load
    if (gameId && !isHost) { setToast({ open: true, severity: 'info', message: 'Only the host can load a map into an active game.' }); return; }
    try {
      const maps = await listLibraryMaps(user.id);
      setLibraryList(maps);
      setModalState(prev => ({ ...prev, loadLibrary: true }));
    } catch (e) {
      console.error('List library failed:', e);
      setToast({ open: true, severity: 'error', message: 'Failed to fetch library maps.' });
    }
  };

  // Use centralized batch add API
  const handleAddCharacters = (characterType, quantity) => {
    addCharactersBatch(characterType, quantity);
    setModalState(prev => ({ ...prev, addCharacter: false }));
  };

  // Apply selected character to the local user's player token
  const applyCharacterToToken = (character) => {
    if (!character || !user) return;
    // Try to find this user's token; if not present, create one
    let token = (state.elements || []).find(el => el.type === 'player' && el.participantUserId === user.id);
    if (!token) {
      addElement('player', { participantUserId: user.id });
      token = (state.elements || []).find(el => el.type === 'player' && el.participantUserId === user.id);
    }
    if (!token) return;
    const updates = {
      name: character.name || token.name,
      maxHp: Number(character.max_hp ?? token.maxHp ?? 10),
      currentHp: Number(character.current_hp ?? token.currentHp ?? 10),
      movement: Number(character.speed ?? token.movement ?? 30),
      characterId: character.id || token.characterId,
      // Persist the character’s icon URL on the token so all clients can render it without needing DB reads
      characterIconUrl: character.icon_url || token.characterIconUrl || null,
    };
    setState(prev => ({
      ...prev,
      elements: (prev.elements || []).map(el => el.id === token.id ? { ...el, ...updates } : el),
    }));
  };

  return (
    <div className="app-container">
      <Toolbar
        isDrawingCover={isDrawingCover}
        showGridModal={showGridModal}
        clearMap={() => { setState({ ...state, elements: [], highlightedElementId: null }); pushUndo(); }}
        undo={undo}
        onSaveMap={handleSaveMap}
        onLoadMap={handleLoadMap}
        onSaveLibrary={handleSaveLibrary}
        onLoadLibrary={handleLoadLibrary}
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
          currentUserId={user?.id}
          isHost={isHost}
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
          isHost={isHost}
          currentUserId={user?.id}
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
      <CharacterSelectModal
        open={modalState.selectCharacter}
        onClose={() => {
          setModalState(prev => ({ ...prev, selectCharacter: false }));
          if (sessionGame?.promptCharacter) updateSession({ promptCharacter: false });
        }}
        onSelect={(c) => {
          applyCharacterToToken(c);
          setModalState(prev => ({ ...prev, selectCharacter: false }));
          if (sessionGame?.promptCharacter) updateSession({ promptCharacter: false });
        }}
        onBuildNew={() => {
          setModalState(prev => ({ ...prev, selectCharacter: false }));
          if (sessionGame?.promptCharacter) updateSession({ promptCharacter: false });
          navigate('/characters/new');
        }}
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
        isHost={isHost}
      />
      <SaveDraftModal
        isOpen={modalState.saveDraft}
        onClose={() => setModalState(prev => ({ ...prev, saveDraft: false }))}
        onSave={async (name) => {
          try {
            const filteredElements = (state.elements || []).filter(el => el.type !== 'player');
            const payload = { elements: filteredElements, grid: state.grid, globalModifiers: state.globalModifiers || [] };
            await upsertMapDraft(gameId, name, payload, user.id);
            setModalState(prev => ({ ...prev, saveDraft: false }));
            setToast({ open: true, severity: 'success', message: `Saved as "${name}".` });
          } catch (e) {
            console.error('Save named draft failed:', e);
            setToast({ open: true, severity: 'error', message: 'Failed to save map.' });
          }
        }}
      />
      <LoadDraftModal
        isOpen={modalState.loadDraft}
        drafts={draftList}
        onClose={() => setModalState(prev => ({ ...prev, loadDraft: false }))}
        onSelect={async (draft) => {
          try {
            // Fetch the full draft by name to get state
            const row = await getMapDraft(gameId, draft.name);
            const saved = row?.state || {};
            const nonPlayers = (saved.elements || []).filter(el => el.type !== 'player');
            setState(prev => {
              const currentPlayers = (prev.elements || []).filter(el => el.type === 'player');
              return { ...prev, elements: [...currentPlayers, ...nonPlayers], grid: saved.grid || prev.grid, globalModifiers: saved.globalModifiers || prev.globalModifiers };
            });
            setModalState(prev => ({ ...prev, loadDraft: false }));
            setToast({ open: true, severity: 'success', message: `Loaded "${draft.name}" (players preserved).` });
          } catch (e) {
            console.error('Load named draft failed:', e);
            setToast({ open: true, severity: 'error', message: 'Failed to load map.' });
          }
        }}
      />
      <SaveDraftModal
        isOpen={modalState.saveLibrary}
        title="Save to Library"
        onClose={() => setModalState(prev => ({ ...prev, saveLibrary: false }))}
        onSave={async (name) => {
          try {
            const filteredElements = (state.elements || []).filter(el => el.type !== 'player');
            const payload = { elements: filteredElements, grid: state.grid, globalModifiers: state.globalModifiers || [] };
            await upsertLibraryMap(user.id, name, payload);
            setModalState(prev => ({ ...prev, saveLibrary: false }));
            setToast({ open: true, severity: 'success', message: `Saved to library as "${name}".` });
          } catch (e) {
            console.error('Save to library failed:', e);
            setToast({ open: true, severity: 'error', message: 'Failed to save map to library.' });
          }
        }}
      />
      <LoadDraftModal
        isOpen={modalState.loadLibrary}
        title="Load from Library"
        emptyText="Your library is empty."
        drafts={libraryList}
        onClose={() => setModalState(prev => ({ ...prev, loadLibrary: false }))}
        onSelect={async (entry) => {
          try {
            const row = await getLibraryMap(user.id, entry.name);
            const saved = row?.state || {};
            const nonPlayers = (saved.elements || []).filter(el => el.type !== 'player');
            setState(prev => {
              const currentPlayers = (prev.elements || []).filter(el => el.type === 'player');
              return { ...prev, elements: [...currentPlayers, ...nonPlayers], grid: saved.grid || prev.grid, globalModifiers: saved.globalModifiers || prev.globalModifiers };
            });
            setModalState(prev => ({ ...prev, loadLibrary: false }));
            const where = gameId ? 'into game' : 'into editor';
            setToast({ open: true, severity: 'success', message: `Loaded "${entry.name}" ${where}.` });
          } catch (e) {
            console.error('Load from library failed:', e);
            setToast({ open: true, severity: 'error', message: 'Failed to load map from library.' });
          }
        }}
      />
      <Snackbar
        open={toast.open}
        autoHideDuration={2500}
        onClose={() => setToast(prev => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={() => setToast(prev => ({ ...prev, open: false }))} severity={toast.severity} sx={{ width: '100%' }}>
          {toast.message}
        </Alert>
      </Snackbar>
    </div>
  );
}

// Persist latest map state on unmount and when tab is hidden
// Note: best-effort; background tab throttling may delay network
function usePersistOnHide(gameId, user, channel, latestStateRef) {
  useEffect(() => {
    if (!gameId || !user) return;
    const save = () => {
      try {
        const payload = latestStateRef.current || {};
        // Fire and forget; we don't block navigation
        upsertMapState(gameId, channel, payload, user.id).catch(() => {});
      } catch {}
    };
    const onVis = () => {
      if (document.visibilityState === 'hidden') save();
    };
    window.addEventListener('visibilitychange', onVis);
    return () => {
      window.removeEventListener('visibilitychange', onVis);
      // Unmount save
      save();
    };
  }, [gameId, user?.id, channel]);
}

export default App;