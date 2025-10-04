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
import { getCharacter } from './Utils/characterService.js';
import { getMapState, upsertMapState, pushDraftToLive, listMapDrafts, upsertMapDraft, getMapDraft, listLibraryMaps, upsertLibraryMap, getLibraryMap } from './Utils/mapService.js';
import SaveDraftModal from './components/Modals/SaveDraftModal.jsx';
import LoadDraftModal from './components/Modals/LoadDraftModal.jsx';
import { useGameSession } from './Utils/GameSessionContext.jsx';

function App({ onHostGame, onLeaveGame, onJoinGame, gameId = null, user = null, libraryLoadRequest = null }) {
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
    saveDraftPicker: false,
    saveLibraryPicker: false,
  });
  const [draftList, setDraftList] = useState([]);
  const [libraryList, setLibraryList] = useState([]);
  const [undoStack, setUndoStack] = useState([]);
  const battleMapRef = useRef(null);
  const [isHost, setIsHost] = useState(false);
  const [canWriteLive, setCanWriteLive] = useState(false);
  const { game: sessionGame, updateSession } = useGameSession();
  const initialChannel = (!sessionGame
    ? 'live' // default to live until role is known to avoid draft reads for players
    : ((sessionGame.role === 'host' || sessionGame.host_id === user?.id) ? 'draft' : 'live'));
  const [channel, setChannel] = useState(initialChannel); // 'live' or 'draft'
  const channelInitializedRef = useRef(false);
  // Keep refs of current channel/role for realtime handlers
  const channelRef = useRef(channel);
  useEffect(() => { channelRef.current = channel; }, [channel]);
  const isHostRef = useRef(isHost);
  useEffect(() => { isHostRef.current = isHost; }, [isHost]);
  // Realtime broadcast channel for live refresh signals
  const liveSignalRef = useRef(null);
  // Track identity and last live update time to avoid spring-back
  const userIdRef = useRef(user?.id || null);
  useEffect(() => { userIdRef.current = user?.id || null; }, [user?.id]);
  const lastLiveUpdatedAtRef = useRef(0);
  // Character sheet pane removed; selection applies to token only

  const { updateGridInfo } = useGrid(state);
  const { addElement, addCharactersBatch, createCoverFromBlocks, getElementById, updateElementPosition, toggleMovementHighlight, highlightCoverGroup, updateElement, deleteElement } = useElements(state, setState);
  const { showEditModal, showGridModal } = useModals(setModalState);
  const { pushUndo, undo } = useUndo(state, setState, setUndoStack);
  const [toast, setToast] = useState({ open: false, message: '', severity: 'info' });

  useEffect(() => {
    updateGridInfo();
  }, [state, updateGridInfo]);

  // One-time cleanup: if a previous build stored Supabase auth in localStorage,
  // remove it so users don't remain logged in after switching to sessionStorage.
  useEffect(() => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        // Supabase default key pattern
        const keys = Object.keys(window.localStorage).filter(k => k.startsWith('sb-'));
        for (const k of keys) {
          // remove only the auth-related keys; sb- prefix is safe for Supabase
          window.localStorage.removeItem(k);
        }
      }
    } catch {}
  }, []);

  // Keep latest state in a ref for reliable save on unmount/visibility changes
  const latestStateRef = useRef({ elements: state.elements, grid: state.grid });
  useEffect(() => {
    latestStateRef.current = { elements: state.elements, grid: state.grid };
  }, [state.elements, state.grid]);

  // Persist latest state when tab hides/unmounts
  usePersistOnHide(gameId, user, channel, latestStateRef, isHost, canWriteLive);

  // Load a library map into the local editor when requested
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        if (!libraryLoadRequest || gameId || !user) return;
        const row = await getLibraryMap(user.id, libraryLoadRequest.name);
        if (!active) return;
        const saved = row?.state || {};
        const nonPlayers = (saved.elements || []).filter(el => el.type !== 'player');
        setState(prev => ({
          ...prev,
          elements: [...nonPlayers],
          grid: saved.grid || prev.grid,
          globalModifiers: saved.globalModifiers || prev.globalModifiers,
        }));
        setToast({ open: true, severity: 'success', message: `Loaded "${libraryLoadRequest.name}" into editor.` });
      } catch (e) {
        console.error('Load library map into editor failed:', e);
        setToast({ open: true, severity: 'error', message: 'Failed to open map from library.' });
      }
    })();
    return () => { active = false; };
  }, [libraryLoadRequest?.name, gameId, user?.id]);

  // When a participant joins (emitted by BattlemapPage subscription), add a player token if not present
  useEffect(() => {
    const handler = (e) => {
      const row = e.detail;
      if (!row?.user_id) return;
      // Do not auto-create any player tokens on join. Each user creates their own
      // token after selecting a character (applyCharacterToToken handles creation).
      // If this event is for the current user and they haven't selected a character yet, prompt them.
      if (row.user_id === user?.id && !isHost) {
        setCanWriteLive(true); // confirmed participant; allow live writes
        const myToken = (state.elements || []).find(el => el.type === 'player' && el.participantUserId === user.id);
        const hasCharacter = !!myToken?.characterId;
        const guard = sessionStorage.getItem('bm-character-prompt-shown');
        if (!hasCharacter && !guard) {
          setModalState(prev => ({ ...prev, selectCharacter: true }));
          try { sessionStorage.setItem('bm-character-prompt-shown', '1'); } catch {}
        }
      }
    };
    window.addEventListener('participant-joined', handler);
    return () => window.removeEventListener('participant-joined', handler);
  }, [state.elements, user?.id, isHost]);

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
  // If not host but we see a participants row, allow live writes
  if (!host && !error && data?.role) setCanWriteLive(true);
      // Initialize channel once per game based on role; don't override manual toggles
      if (!channelInitializedRef.current) {
        setChannel(host ? 'draft' : 'live');
        channelInitializedRef.current = true;
      }
      // If a player (not host) and session requests a prompt OR no character on token, prompt selection once
      if (!host) {
        const shouldPrompt = !!sessionGame?.promptCharacter;
        const myToken = (state.elements || []).find(el => el.type === 'player' && el.participantUserId === user.id);
        const hasCharacter = !!myToken?.characterId;
        const guard = sessionStorage.getItem('bm-character-prompt-shown');
        if (!guard && (shouldPrompt || !hasCharacter)) {
          setModalState(prev => ({ ...prev, selectCharacter: true }));
          try { sessionStorage.setItem('bm-character-prompt-shown', '1'); } catch {}
        }
      }
    })();
    return () => { active = false; };
  }, [gameId, user?.id, sessionGame?.id, sessionGame?.role, sessionGame?.host_id, sessionGame?.promptCharacter, state.elements]);

  // Reset channel initialization when game changes
  useEffect(() => { channelInitializedRef.current = false; }, [gameId]);

  // Allow character prompt to show for each new game joined
  useEffect(() => {
    try { sessionStorage.removeItem('bm-character-prompt-shown'); } catch {}
  }, [gameId]);
  // Subscribe to a broadcast channel that signals live updates to force a small fetch
  useEffect(() => {
    if (!gameId) return;
    const sig = supabase
      .channel(`game-${gameId}-signals`)
      .on('broadcast', { event: 'live-updated' }, async () => {
        const current = channelRef.current;
        if (current !== 'live') return; // only refresh when viewing live
        try {
          const row = await getMapState(gameId, 'live');
          const ts = row?.updated_at ? Date.parse(row.updated_at) : Date.now();
          if (Number.isFinite(ts) && ts < lastLiveUpdatedAtRef.current) return;
          if (row?.state) {
            setState(prev => ({ ...prev, ...row.state }));
            if (Number.isFinite(ts)) lastLiveUpdatedAtRef.current = ts;
          }
        } catch (e) {
          console.warn('Live refresh fetch failed:', e);
        }
      })
      .subscribe();
    liveSignalRef.current = sig;
    return () => { liveSignalRef.current = null; supabase.removeChannel(sig); };
  }, [gameId]);

  // Merge helper: ensure all actors (players+enemies) from live are present in base elements (used when host views draft)
  const mergeActorsIntoElements = (baseElements = [], liveElements = []) => {
    const result = [...(baseElements || [])];
    const existingIds = new Set(result.map(e => e.id));
    const maxId = result.reduce((m, e) => {
      const n = typeof e.id === 'number' ? e.id : parseInt(e.id, 10);
      return Number.isFinite(n) ? Math.max(m, n) : m;
    }, 0);
    let nextId = maxId + 1;
    // Index base actors:
    // - players by participantUserId, then characterId, then name
    // - enemies by stable id if present, else name+size
    const baseActorsByKey = new Map(
      result
        .filter(e => e && (e.type === 'player' || e.type === 'enemy'))
        .map(e => {
          let key;
          if (e.type === 'player') {
            key = e.participantUserId ? `p:u:${e.participantUserId}` : (e.characterId ? `p:c:${e.characterId}` : `p:n:${e.name || ''}`);
          } else {
            const hasId = e.id !== undefined && e.id !== null && `${e.id}` !== '';
            key = hasId ? `e:id:${e.id}` : `e:n:${e.name || ''}|s:${e.size ?? ''}`;
          }
          return [key, e];
        })
    );
    for (const el of (liveElements || [])) {
      if (!el || (el.type !== 'player' && el.type !== 'enemy')) continue;
      let key;
      if (el.type === 'player') {
        key = el.participantUserId ? `p:u:${el.participantUserId}` : (el.characterId ? `p:c:${el.characterId}` : `p:n:${el.name || ''}`);
      } else {
        const hasId = el.id !== undefined && el.id !== null && `${el.id}` !== '';
        key = hasId ? `e:id:${el.id}` : `e:n:${el.name || ''}|s:${el.size ?? ''}`;
      }
      if (baseActorsByKey.has(key)) {
        // Already present in draft; keep draft's position so host edits persist
        continue;
      }
      // Add a copy of the live actor into draft, ensuring a unique id
      let newId = el.id;
      const numeric = typeof newId === 'number' ? newId : parseInt(newId, 10);
      if (!Number.isFinite(numeric) || existingIds.has(newId)) {
        newId = nextId++;
      }
      result.push({ ...el, id: newId });
      existingIds.add(newId);
      baseActorsByKey.set(key, el);
    }
    return result;
  };

  // Load initial map state for the current channel
  useEffect(() => {
    let active = true;
    (async () => {
      if (!gameId) return;
      // Host viewing draft: load draft, then merge in live players
      if (channel === 'draft' && isHost) {
        let draftRow = null;
        let liveRow = null;
        try {
          const [d, l] = await Promise.all([
            getMapState(gameId, 'draft').catch(e => { console.warn('getMapState draft failed:', e); return null; }),
            getMapState(gameId, 'live').catch(e => { console.warn('getMapState live failed:', e); return null; }),
          ]);
          draftRow = d; liveRow = l;
        } catch (_) {}
        if (!active) return;
        const draftState = draftRow?.state || {};
        const liveState = liveRow?.state || {};
        const mergedElements = mergeActorsIntoElements(draftState.elements || [], liveState.elements || []);
        setState((prev) => ({
          ...prev,
          // Keep draft as source of truth for non-player content
          elements: mergedElements,
          grid: draftState.grid ?? prev.grid,
          globalModifiers: draftState.globalModifiers ?? prev.globalModifiers,
        }));
        return;
      }
      // Default behavior: load the selected channel normally
      let row = null;
      try { row = await getMapState(gameId, channel); } catch (e) { console.warn('getMapState failed:', e); }
      if (!active || !row?.state) return;
      if (row.state.elements || row.state.grid) setState((prev) => ({ ...prev, ...row.state }));
    })();
    return () => { active = false; };
  }, [gameId, channel, isHost]);

  // Realtime: apply live updates when viewing live; when viewing draft as host, only merge in missing players
  useEffect(() => {
    if (!gameId) return;
    const channelName = `map-live-${gameId}`;
    const ch = supabase
      .channel(channelName)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'map_states', filter: `game_id=eq.${gameId}` }, (payload) => {
        const row = payload.new;
        if (row.channel !== 'live') return;
        if (!row.state) return;
        // Prevent applying our own writes and ignore stale updates (helps avoid snap-back after click-to-move)
        if (row.updated_by && userIdRef.current && row.updated_by === userIdRef.current) return;
        const ts = row.updated_at ? Date.parse(row.updated_at) : Date.now();
        if (Number.isFinite(ts) && ts < lastLiveUpdatedAtRef.current) return;
        const currentChannel = channelRef.current;
        const hostNow = isHostRef.current;
        if (currentChannel === 'live') {
          setState((prev) => ({ ...prev, ...row.state }));
          if (Number.isFinite(ts)) lastLiveUpdatedAtRef.current = ts;
        } else if (currentChannel === 'draft' && hostNow) {
          const liveEls = row.state?.elements || [];
          setState((prev) => ({
            ...prev,
            elements: mergeActorsIntoElements(prev.elements || [], liveEls),
          }));
          if (Number.isFinite(ts)) lastLiveUpdatedAtRef.current = ts;
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [gameId]);

  // Persist edits: players write to live; host writes to draft unless switching to live
  useEffect(() => {
    const debounce = setTimeout(async () => {
      try {
        if (!gameId || !user) return;
        // Only host writes draft; players may write live only after confirmed as participant
        if (!isHost && channel !== 'live') return; // players never write draft
        if (!isHost && channel === 'live' && !canWriteLive) return; // wait until participant check
        if (isHost === false && channel === 'draft') return; // redundant safety
        const saveState = { elements: state.elements, grid: state.grid };
        await upsertMapState(gameId, channel, saveState, user.id);
        if (channel === 'live') {
          lastLiveUpdatedAtRef.current = Date.now();
        }
              // Send a lightweight broadcast signal to refresh live viewers immediately
              if (channel === 'live' && liveSignalRef.current) {
                try { await liveSignalRef.current.send({ type: 'broadcast', event: 'live-updated', payload: { by: user.id, t: Date.now() } }); } catch {}
              }
      } catch (e) {
        // swallow
      }
    }, 600);
    return () => clearTimeout(debounce);
  }, [state.elements, state.grid, gameId, user?.id, channel, isHost, canWriteLive]);

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
    try {
      const drafts = await listMapDrafts(gameId);
      setDraftList(drafts);
      setModalState(prev => ({ ...prev, saveDraftPicker: true }));
    } catch (e) {
      console.error('List drafts for save failed:', e);
      setToast({ open: true, severity: 'error', message: 'Failed to fetch saved maps.' });
    }
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
    try {
      const maps = await listLibraryMaps(user.id);
      setLibraryList(maps);
      setModalState(prev => ({ ...prev, saveLibraryPicker: true }));
    } catch (e) {
      console.error('List library for save failed:', e);
      setToast({ open: true, severity: 'error', message: 'Failed to fetch library maps.' });
    }
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
    setState(prev => {
      // Find or create player's token within the same state transition to avoid stale reads
      let token = (prev.elements || []).find(el => el.type === 'player' && el.participantUserId === user.id);
      if (!token) {
        const nextId = Math.max(0, ...((prev.elements || []).map(e => {
          const n = typeof e.id === 'number' ? e.id : parseInt(e.id, 10);
          return Number.isFinite(n) ? n : 0;
        }))) + 1;
        token = {
          id: nextId,
          type: 'player',
          participantUserId: user.id,
          name: character.name || 'Player',
          position: { x: 0, y: 0 },
          size: 1,
          color: '#4CAF50',
          maxHp: 10,
          currentHp: 10,
          movement: 30,
        };
        return {
          ...prev,
          elements: [...(prev.elements || []), {
            ...token,
            name: character.name || token.name,
            maxHp: Number(character.max_hp ?? token.maxHp ?? 10),
            currentHp: Number(character.current_hp ?? token.currentHp ?? 10),
            movement: Number(character.speed ?? token.movement ?? 30),
            characterId: character.id,
            characterIconUrl: character.icon_url || null,
          }],
        };
      }
      const updates = {
        name: character.name || token.name,
        maxHp: Number(character.max_hp ?? token.maxHp ?? 10),
        currentHp: Number(character.current_hp ?? token.currentHp ?? 10),
        movement: Number(character.speed ?? token.movement ?? 30),
        characterId: character.id || token.characterId,
        characterIconUrl: character.icon_url || token.characterIconUrl || null,
      };
      return {
        ...prev,
        elements: (prev.elements || []).map(el => el.id === token.id ? { ...el, ...updates } : el),
      };
    });
  };

  // Detect return from character sheet and refresh the player's token
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const key = 'bm-refresh-character-id';
        const cid = sessionStorage.getItem(key);
        const pending = sessionStorage.getItem('bm-refresh-pending') === '1';
        if (!cid || !user || !pending) return;
        const row = await getCharacter(cid);
        if (!active || !row) return;
        applyCharacterToToken(row);
        // Notify the user that their changes were applied
        setToast({ open: true, severity: 'success', message: 'Character saved and applied to your token.' });
        try {
          sessionStorage.removeItem(key);
          sessionStorage.removeItem('bm-refresh-pending');
        } catch {}
      } catch (_) {}
    })();
    return () => { active = false; };
  }, [user?.id]);

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
          try {
            await pushDraftToLive(gameId, user.id);
            setToast({ open: true, severity: 'success', message: 'Updates sent to players.' });
            // Notify all clients to refresh their live view ASAP
            if (liveSignalRef.current) {
              try { await liveSignalRef.current.send({ type: 'broadcast', event: 'live-updated', payload: { by: user.id, t: Date.now() } }); } catch {}
            }
          } catch (e) {
            console.error('Push to players failed:', e);
            setToast({ open: true, severity: 'error', message: 'Failed to push updates to players.' });
          }
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
          try { sessionStorage.removeItem('bm-character-prompt-shown'); } catch {}
        }}
        onSelect={(c) => {
          applyCharacterToToken(c);
          setModalState(prev => ({ ...prev, selectCharacter: false }));
          if (sessionGame?.promptCharacter) updateSession({ promptCharacter: false });
          try { sessionStorage.removeItem('bm-character-prompt-shown'); } catch {}
        }}
        onBuildNew={() => {
          setModalState(prev => ({ ...prev, selectCharacter: false }));
          if (sessionGame?.promptCharacter) updateSession({ promptCharacter: false });
          navigate('/characters/new');
          try { sessionStorage.removeItem('bm-character-prompt-shown'); } catch {}
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
            setModalState(prev => ({ ...prev, saveDraft: false, saveDraftPicker: false }));
            setToast({ open: true, severity: 'success', message: `Saved as "${name}".` });
          } catch (e) {
            console.error('Save named draft failed:', e);
            setToast({ open: true, severity: 'error', message: 'Failed to save map.' });
          }
        }}
      />
      <LoadDraftModal
        title="Save Map"
        isOpen={modalState.loadDraft}
        drafts={draftList}
        selectable
        confirmLabel="Load"
        onClose={() => setModalState(prev => ({ ...prev, loadDraft: false }))}
        onConfirm={async (draft) => {
          try {
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
      {/* Save Draft: picker to overwrite existing or Save as New */}
      <LoadDraftModal
        title="Save Map"
        isOpen={modalState.saveDraftPicker}
        drafts={draftList}
        selectable
        confirmLabel="Overwrite"
        secondaryAction={() => setModalState(prev => ({ ...prev, saveDraftPicker: false, saveDraft: true }))}
        secondaryLabel="Save as New"
        onClose={() => setModalState(prev => ({ ...prev, saveDraftPicker: false }))}
        onConfirm={async (draft) => {
          try {
            const filteredElements = (state.elements || []).filter(el => el.type !== 'player');
            const payload = { elements: filteredElements, grid: state.grid, globalModifiers: state.globalModifiers || [] };
            await upsertMapDraft(gameId, draft.name, payload, user.id);
            setModalState(prev => ({ ...prev, saveDraftPicker: false }));
            setToast({ open: true, severity: 'success', message: `Overwrote "${draft.name}".` });
          } catch (e) {
            console.error('Overwrite draft failed:', e);
            setToast({ open: true, severity: 'error', message: 'Failed to save map.' });
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
            setModalState(prev => ({ ...prev, saveLibrary: false, saveLibraryPicker: false }));
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
        selectable
        confirmLabel="Load"
        onClose={() => setModalState(prev => ({ ...prev, loadLibrary: false }))}
        onConfirm={async (entry) => {
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
      {/* Save to Library: single dynamic action (Overwrite vs Save as New) */}
      <LoadDraftModal
        title="Save to Library"
        isOpen={modalState.saveLibraryPicker}
        drafts={libraryList}
        selectable
        confirmLabel="Overwrite"
        allowEmptySelection
        emptyConfirmLabel="Save as New"
        onConfirmEmpty={() => setModalState(prev => ({ ...prev, saveLibraryPicker: false, saveLibrary: true }))}
        onClose={() => setModalState(prev => ({ ...prev, saveLibraryPicker: false }))}
        onConfirm={async (entry) => {
          try {
            const filteredElements = (state.elements || []).filter(el => el.type !== 'player');
            const payload = { elements: filteredElements, grid: state.grid, globalModifiers: state.globalModifiers || [] };
            await upsertLibraryMap(user.id, entry.name, payload);
            setModalState(prev => ({ ...prev, saveLibraryPicker: false }));
            setToast({ open: true, severity: 'success', message: `Overwrote \"${entry.name}\" in library.` });
          } catch (e) {
            console.error('Overwrite library failed:', e);
            setToast({ open: true, severity: 'error', message: 'Failed to save map to library.' });
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
function usePersistOnHide(gameId, user, channel, latestStateRef, isHost, canWriteLive) {
  useEffect(() => {
    if (!gameId || !user) return;
    const save = () => {
      try {
        const payload = latestStateRef.current || {};
        // Guard writes according to role/channel to avoid RLS 403s
        if (!isHost && channel !== 'live') return; // players never write draft
        if (!isHost && channel === 'live' && !canWriteLive) return; // wait until participant row exists
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