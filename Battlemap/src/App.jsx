import React, { useState, useEffect, useRef } from 'react';
import { Snackbar, Alert } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import Toolbar from './components/Toolbar.jsx';
import SlimToolbar from './components/SlimToolbar.jsx';
import Sidebar from './components/Sidebar.jsx';
import BattleMap from './components/BattleMap.jsx';
import EditModal from './components/Modals/EditModal.jsx';
import AddCharacterModal from './components/Modals/AddCharacterModal.jsx';
import MonsterBrowserModal from './components/Modals/MonsterBrowserModal.jsx';
import MonsterDescriptionModal from './components/Modals/MonsterDescriptionModal.jsx';
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
import { ToolProvider } from './context/ToolContext.jsx';

function App({ onHostGame, onLeaveGame, onJoinGame, onFellowshipClick, gameId = null, user = null, libraryLoadRequest = null }) {
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
  const { game: sessionGame, updateSession, clearSession } = useGameSession();
  const initialChannel = (!sessionGame
    ? 'live' // default to live until role is known to avoid draft reads for players
    : ((sessionGame.role === 'host' || sessionGame.host_id === user?.id) ? 'live' : 'live'));
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
  // Track very recent local token moves so incoming live state doesn't briefly overwrite them
  const pendingMovesRef = useRef(new Map()); // id -> timestamp
  const PENDING_TTL_MS = 1500;
  // Fast-move queue for immediate broadcast and local apply
  const moveQueueRef = useRef([]); // [{id,x,y}]
  const moveFlushTimerRef = useRef(null);
  // Track whether initial state has loaded per channel to avoid wiping server on refresh
  const initialLoadedRef = useRef({ live: false, draft: false });
  // Character sheet pane removed; selection applies to token only

  const { updateGridInfo } = useGrid(state);
  const { addElement, addCharactersBatch, createCoverFromBlocks, getElementById, updateElementPosition, toggleMovementHighlight, highlightCoverGroup, updateElement, deleteElement } = useElements(state, setState);
  const { showEditModal, showGridModal } = useModals(setModalState);
  const { pushUndo, undo } = useUndo(state, setState, setUndoStack);
  const [toast, setToast] = useState({ open: false, message: '', severity: 'info' });
  const [bestiaryModal, setBestiaryModal] = useState({ open: false, initialIndex: null });
  const [monsterDescModal, setMonsterDescModal] = useState({ open: false, index: null });

  useEffect(() => {
    updateGridInfo();
  }, [state, updateGridInfo]);

  // Mobile footer support: if the page includes a footer marked with
  // [data-mobile-footer], measure its height and expose it as the
  // CSS variable --mobile-footer-height so the bottom tool bar can
  // sit just above it.
  useEffect(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;
    const root = document.documentElement;
    let observed = null;
    let ro = null;
    const update = () => {
      try {
        const el = document.querySelector('[data-mobile-footer]');
        // Rebind observer if the footer node changes/appears
        if (el !== observed) {
          if (ro && observed) {
            try { ro.unobserve(observed); } catch {}
          }
          observed = el;
          if (observed && 'ResizeObserver' in window) {
            ro = new ResizeObserver(() => update());
            try { ro.observe(observed); } catch {}
          }
        }
        const h = el ? Math.round(el.getBoundingClientRect().height) : 0;
        root.style.setProperty('--mobile-footer-height', `${h}px`);
      } catch {}
    };
    update();
    const onResize = () => update();
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      try { ro?.disconnect?.(); } catch {}
    };
  }, []);

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
  const latestStateRef = useRef({
    elements: state.elements,
    grid: state.grid,
    globalModifiers: state.globalModifiers,
    initiativeOrder: state.initiativeOrder,
    initiativeScores: state.initiativeScores,
    currentTurnIndex: state.currentTurnIndex,
  });
  useEffect(() => {
    latestStateRef.current = {
      elements: state.elements,
      grid: state.grid,
      globalModifiers: state.globalModifiers,
      initiativeOrder: state.initiativeOrder,
      initiativeScores: state.initiativeScores,
      currentTurnIndex: state.currentTurnIndex,
    };
  }, [state.elements, state.grid, state.globalModifiers, state.initiativeOrder, state.initiativeScores, state.currentTurnIndex]);

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
        .maybeSingle();
      if (!active) return;
  const hostFromParticipants = !error && data?.role === 'host';
      const hostFromSession = !!sessionGame && sessionGame.id === gameId && (sessionGame.role === 'host' || sessionGame.host_id === user.id);
      const host = hostFromParticipants || hostFromSession;
      setIsHost(host);
  // If not host but we see a participants row, allow live writes
  if (!host && !error && data?.role) setCanWriteLive(true);
      // Initialize channel once per game based on role; don't override manual toggles
      if (!channelInitializedRef.current) {
        // Default host to LIVE on load/return; players also LIVE
        setChannel('live');
        channelInitializedRef.current = true;
      }
    })();
    return () => { active = false; };
  }, [gameId, user?.id, sessionGame?.id, sessionGame?.role, sessionGame?.host_id, sessionGame?.promptCharacter]);

  // Separate prompt effect so we don't re-query participants on every elements change
  useEffect(() => {
    if (!user || !gameId) return;
    if (isHost) return;
    // Only evaluate after initial map state has loaded for the current channel
    try {
      const current = channelRef.current || 'live';
      const loaded = initialLoadedRef.current?.[current];
      if (!loaded) return;
    } catch {}
    const shouldPrompt = !!sessionGame?.promptCharacter;
    const myToken = (state.elements || []).find(el => el.type === 'player' && el.participantUserId === user.id);
    const hasCharacter = !!myToken?.characterId;
    const guard = sessionStorage.getItem('bm-character-prompt-shown');
    if (!guard && (shouldPrompt || !hasCharacter)) {
      setModalState(prev => ({ ...prev, selectCharacter: true }));
      try { sessionStorage.setItem('bm-character-prompt-shown', '1'); } catch {}
    }
  }, [isHost, state.elements, user?.id, gameId, sessionGame?.promptCharacter]);

  // Reset channel initialization when game changes and clear loaded flags
  useEffect(() => { channelInitializedRef.current = false; initialLoadedRef.current = { live: false, draft: false }; }, [gameId]);

  // Allow character prompt to show for each new game joined
  useEffect(() => {
    try { sessionStorage.removeItem('bm-character-prompt-shown'); } catch {}
  }, [gameId]);
  // Subscribe to a broadcast channel for live refresh and game end signals
  useEffect(() => {
    if (!gameId) return;
    const sig = supabase
      .channel(`game-${gameId}-signals`)
      .on('broadcast', { event: 'live-updated' }, async (payload) => {
        try {
          const actor = payload?.payload?.by || null;
          // Don't react to our own nudges; we'll already have the local state
          if (actor && userIdRef.current && actor === userIdRef.current) return;
          const current = channelRef.current;
          if (current !== 'live') return; // only refresh when viewing live
          // Small delay to let the writer finish the upsert before we fetch
          await new Promise(res => setTimeout(res, 120));
          const row = await getMapState(gameId, 'live');
          const ts = row?.updated_at ? Date.parse(row.updated_at) : Date.now();
          // Ignore stale or equal timestamps we've already applied
          if (Number.isFinite(ts) && ts <= lastLiveUpdatedAtRef.current) return;
          if (row?.state) {
            setState(prev => {
              const next = { ...prev, ...row.state };
              if (Array.isArray(row.state?.elements)) {
                next.elements = mergeIncomingWithPending(row.state.elements, prev.elements || []);
              }
              return next;
            });
            if (Number.isFinite(ts)) lastLiveUpdatedAtRef.current = ts;
          }
        } catch (e) {
          console.warn('Live refresh fetch failed:', e);
        }
      })
      .on('broadcast', { event: 'game-ended' }, async (payload) => {
        try {
          setToast({ open: true, severity: 'info', message: 'The host ended the game.' });
        } catch {}
        try { clearSession && clearSession(); } catch {}
        try { navigate('/home'); } catch {}
      })
      .on('broadcast', { event: 'turn-changed' }, async (payload) => {
        try {
          const data = payload?.payload || {};
          const idx = Number(data.index);
          const order = Array.isArray(data.order) ? data.order : undefined;
          setState(prev => ({
            ...prev,
            currentTurnIndex: Number.isFinite(idx) ? idx : prev.currentTurnIndex,
            initiativeOrder: order || prev.initiativeOrder,
          }));
        } catch {}
      })
      .on('broadcast', { event: 'move-batch' }, async (payload) => {
        try {
          const data = payload?.payload;
          const moves = Array.isArray(data?.moves) ? data.moves : [];
          if (!moves.length) return;
          const actor = data?.by || null;
          if (actor && userIdRef.current && actor === userIdRef.current) return;
          const current = channelRef.current;
          const hostNow = isHostRef.current;
          // Apply directly in both live viewers and host viewing draft
          setState(prev => {
            const byId = new Map(moves.map(m => [Number(m.id), m]));
            const nextEls = (prev.elements || []).map(el => {
              const m = byId.get(Number(el.id));
              if (!m) return el;
              // Only update position; keep other fields
              return { ...el, position: { x: Number(m.x) || 0, y: Number(m.y) || 0 } };
            });
            return { ...prev, elements: nextEls };
          });
        } catch {}
      })
      .subscribe();
    liveSignalRef.current = sig;
    return () => { liveSignalRef.current = null; supabase.removeChannel(sig); };
  }, [gameId]);

  // When a participant leaves, remove their token from our local state; host also persists removal to LIVE
  useEffect(() => {
    const handler = async (e) => {
      try {
        const row = e?.detail;
        if (!row || !row.user_id) return;
        const userId = row.user_id;
        // Update local state immediately
        setState(prev => ({
          ...prev,
          elements: (prev.elements || []).filter(el => !(el?.type === 'player' && el.participantUserId === userId)),
        }));
        // If host, also remove from LIVE state and notify others
        if (isHost && gameId && user) {
          try {
            const liveRow = await getMapState(gameId, 'live').catch(() => null);
            const liveState = liveRow?.state || {};
            const nextEls = Array.isArray(liveState.elements)
              ? liveState.elements.filter(el => !(el?.type === 'player' && el.participantUserId === userId))
              : [];
            const merged = { ...liveState, elements: nextEls };
            try { lastLiveUpdatedAtRef.current = Date.now(); } catch {}
            await upsertMapState(gameId, 'live', merged, user.id);
            lastLiveUpdatedAtRef.current = Date.now();
            if (liveSignalRef.current) {
              try { await liveSignalRef.current.send({ type: 'broadcast', event: 'live-updated', payload: { by: user.id, t: Date.now() } }); } catch {}
            }
          } catch {}
        }
      } catch {}
    };
    window.addEventListener('participant-left', handler);
    return () => window.removeEventListener('participant-left', handler);
  }, [isHost, gameId, user?.id]);

  // Persist initiative updates to LIVE and broadcast to all (host-only)
  useEffect(() => {
    const handler = async (e) => {
      try {
        const detail = e?.detail || {};
        const order = Array.isArray(detail.order) ? detail.order : (state.initiativeOrder || []);
        const scores = detail.scores || state.initiativeScores || {};
        const index = Number.isFinite(detail.index) ? detail.index : 0;
        if (!gameId || !user) return;
        // Only the host may persist/broadcast initiative updates
        const current = channelRef.current;
        const hostNow = isHostRef.current;
        if (!hostNow) return;
        if (current === 'live') {
          const liveRow = await getMapState(gameId, 'live').catch(() => null);
          const liveState = liveRow?.state || {};
          const merged = {
            ...liveState,
            initiativeOrder: order,
            initiativeScores: scores,
            currentTurnIndex: Number.isFinite(index) ? index : (liveState.currentTurnIndex || 0),
          };
          try { lastLiveUpdatedAtRef.current = Date.now(); } catch {}
          await upsertMapState(gameId, 'live', merged, user.id);
          lastLiveUpdatedAtRef.current = Date.now();
          const sig = liveSignalRef.current;
          if (sig) {
            try {
              await sig.send({ type: 'broadcast', event: 'turn-changed', payload: { index, order, t: Date.now(), by: user.id } });
              await sig.send({ type: 'broadcast', event: 'live-updated', payload: { t: Date.now(), by: user.id } });
            } catch {}
          }
        }
      } catch {}
    };
    window.addEventListener('bm-initiative-updated', handler);
    return () => window.removeEventListener('bm-initiative-updated', handler);
  }, [gameId, user?.id]);

  // Persist player self-updates (e.g., HP changes) to LIVE for non-hosts so everyone sees it
  useEffect(() => {
    const handler = async (e) => {
      try {
        const detail = e?.detail || {};
        const elId = detail.id;
        if (!gameId || !user || !elId) return;
        // Only allow the owner (or host) to persist
        const owner = (state.elements || []).find(x => x.id === elId && x.type === 'player');
        if (!owner) return;
        const isOwner = owner.participantUserId === user.id;
        if (!(isHost || isOwner)) return;
        const liveRow = await getMapState(gameId, 'live').catch(() => null);
        const liveState = liveRow?.state || {};
        const nextEls = (Array.isArray(liveState.elements) ? liveState.elements : []).map(x => {
          if (x && x.type === 'player' && x.id === elId) {
            return { ...x, ...detail };
          }
          return x;
        });
        const merged = { ...liveState, elements: nextEls };
        try { lastLiveUpdatedAtRef.current = Date.now(); } catch {}
        await upsertMapState(gameId, 'live', merged, user.id);
        lastLiveUpdatedAtRef.current = Date.now();
        if (liveSignalRef.current) {
          try { await liveSignalRef.current.send({ type: 'broadcast', event: 'live-updated', payload: { by: user.id, t: Date.now() } }); } catch {}
        }
      } catch {}
    };
    window.addEventListener('bm-player-token-updated', handler);
    return () => window.removeEventListener('bm-player-token-updated', handler);
  }, [gameId, user?.id, isHost, state.elements]);

  // Catch up after inactivity: when the tab/window becomes visible, focused, or comes back online,
  // fetch the latest LIVE state and apply it if it's newer than what we have. This ensures updates
  // that happened while the browser was throttled (e.g., phone screen off) are reflected immediately.
  useEffect(() => {
    if (!gameId) return;
    let timer = null;
    const requestRefresh = () => {
      if (timer) return;
      timer = setTimeout(async () => {
        timer = null;
        try {
          const current = channelRef.current;
          if (current !== 'live') return; // only catch up when viewing LIVE
          const row = await getMapState(gameId, 'live').catch(() => null);
          if (!row || !row.state) return;
          const ts = row?.updated_at ? Date.parse(row.updated_at) : Date.now();
          if (Number.isFinite(ts) && ts <= (lastLiveUpdatedAtRef.current || 0)) return;
          setState(prev => {
            const next = { ...prev, ...row.state };
            if (Array.isArray(row.state?.elements)) {
              next.elements = mergeIncomingWithPending(row.state.elements, prev.elements || []);
            }
            return next;
          });
          if (Number.isFinite(ts)) lastLiveUpdatedAtRef.current = ts;
        } catch {}
      }, 160);
    };
    const onVisChange = () => {
      if (document.visibilityState === 'visible') requestRefresh();
    };
    const onFocus = () => requestRefresh();
    const onPageShow = () => requestRefresh();
    const onOnline = () => requestRefresh();
    window.addEventListener('visibilitychange', onVisChange);
    window.addEventListener('focus', onFocus);
    window.addEventListener('pageshow', onPageShow);
    window.addEventListener('online', onOnline);
    return () => {
      window.removeEventListener('visibilitychange', onVisChange);
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('pageshow', onPageShow);
      window.removeEventListener('online', onOnline);
      if (timer) clearTimeout(timer);
    };
  }, [gameId]);

  // On local turn change, broadcast and persist to live (host-only)
  useEffect(() => {
    const handler = async (e) => {
      try {
        if (!gameId) return;
        const detail = e?.detail || {};
        const idx = Number(detail.index);
        const order = Array.isArray(detail.order) ? detail.order : undefined;
        const hostNow = isHostRef.current;
        if (!hostNow) return;
        const sig = liveSignalRef.current;
        if (sig) {
          await sig.send({ type: 'broadcast', event: 'turn-changed', payload: { index: idx, order, t: Date.now(), by: user?.id || null } });
          await sig.send({ type: 'broadcast', event: 'live-updated', payload: { t: Date.now(), by: user?.id || null } });
        }
        // Persist to live immediately when in live and permitted, after initial load
        const current = channelRef.current;
        if (current === 'live' && hostNow && initialLoadedRef.current.live) {
          const liveRow = await getMapState(gameId, 'live').catch(() => null);
          const liveState = liveRow?.state || {};
          const merged = {
            ...liveState,
            initiativeOrder: order || (state.initiativeOrder || []),
            currentTurnIndex: Number.isFinite(idx) ? idx : (state.currentTurnIndex || 0),
          };
          await upsertMapState(gameId, 'live', merged, user?.id);
          lastLiveUpdatedAtRef.current = Date.now();
        }
      } catch {}
    };
    window.addEventListener('bm-turn-changed', handler);
    return () => window.removeEventListener('bm-turn-changed', handler);
  }, [gameId, state.initiativeOrder, state.currentTurnIndex, user?.id]);

  // Listen for local element moves and broadcast them quickly to peers
  useEffect(() => {
    const onMoved = (e) => {
      try {
        const detail = e?.detail || {};
        const moves = Array.isArray(detail.moves) ? detail.moves : [];
        if (!moves.length) return;
        // Queue moves
        moveQueueRef.current = [...moveQueueRef.current, ...moves];
        // Apply immediately to our local state to keep UI responsive
        setState(prev => {
          const byId = new Map(moves.map(m => [Number(m.id), m]));
          const nextEls = (prev.elements || []).map(el => {
            const m = byId.get(Number(el.id));
            if (!m) return el;
            return { ...el, position: { x: Number(m.x) || 0, y: Number(m.y) || 0 } };
          });
          return { ...prev, elements: nextEls };
        });
        // Debounced/throttled flush
        if (moveFlushTimerRef.current) clearTimeout(moveFlushTimerRef.current);
        moveFlushTimerRef.current = setTimeout(async () => {
          const batch = moveQueueRef.current;
          moveQueueRef.current = [];
          try {
            // Players only send when in live and allowed; host may send in live too
            const current = channelRef.current;
            const hostNow = isHostRef.current;
            // Only broadcast when viewing LIVE; host-in-draft should not leak moves
            if (current !== 'live') return;
            if (!hostNow && current === 'live' && !canWriteLive) return;
            if (!gameId) return;
            const sig = liveSignalRef.current;
            if (!sig) return;
            await sig.send({ type: 'broadcast', event: 'move-batch', payload: { moves: batch, t: Date.now(), by: user?.id || null } });
            // Optional: also send a live-updated nudge
            await sig.send({ type: 'broadcast', event: 'live-updated', payload: { t: Date.now(), by: user?.id || null } });
          } catch {}
        }, 120);
      } catch {}
    };
    window.addEventListener('bm-element-moved', onMoved);
    return () => window.removeEventListener('bm-element-moved', onMoved);
  }, [gameId, canWriteLive]);

  // Merge helper: in host draft, reflect LIVE presence
  // - Remove any player tokens not present in LIVE
  // - Keep enemies as-is
  // - Add any missing players/enemies from LIVE, preserving draft positions for matches
  const mergeActorsIntoElements = (baseElements = [], liveElements = []) => {
    const base = Array.isArray(baseElements) ? baseElements : [];
    const live = Array.isArray(liveElements) ? liveElements : [];
    const keyFor = (e) => {
      if (!e) return null;
      if (e.type === 'player') {
        return e.participantUserId ? `p:u:${e.participantUserId}` : (e.characterId ? `p:c:${e.characterId}` : `p:n:${e.name || ''}`);
      }
      const hasId = e.id !== undefined && e.id !== null && `${e.id}` !== '';
      return e.type === 'enemy' ? (hasId ? `e:id:${e.id}` : `e:n:${e.name || ''}|s:${e.size ?? ''}`) : null;
    };
    // Build sets/maps for quick lookups
    const liveByKey = new Map(live.filter(e => e && (e.type === 'player' || e.type === 'enemy')).map(e => [keyFor(e), e]));
    const livePlayerKeys = new Set(
      live.filter(e => e && e.type === 'player').map(e => keyFor(e))
    );
    // Start with base elements, but drop players not present in live
    const pruned = base.filter(e => {
      if (!e || e.type !== 'player') return true;
      const k = keyFor(e);
      return k && livePlayerKeys.has(k);
    });
    // Index current result and compute id space
    const result = [...pruned];
    const existingIds = new Set(result.map(e => e.id));
    const maxId = result.reduce((m, e) => {
      const n = typeof e.id === 'number' ? e.id : parseInt(e.id, 10);
      return Number.isFinite(n) ? Math.max(m, n) : m;
    }, 0);
    let nextId = maxId + 1;
    const resultByKey = new Map(
      result
        .filter(e => e && (e.type === 'player' || e.type === 'enemy'))
        .map(e => [keyFor(e), e])
    );
    // Add any missing actors from live
    for (const el of live) {
      if (!el || (el.type !== 'player' && el.type !== 'enemy')) continue;
      const k = keyFor(el);
      if (!k || resultByKey.has(k)) continue;
      // Ensure unique id when adding
      let newId = el.id;
      const numeric = typeof newId === 'number' ? newId : parseInt(newId, 10);
      if (!Number.isFinite(numeric) || existingIds.has(newId)) {
        newId = nextId++;
      }
      const copy = { ...el, id: newId };
      result.push(copy);
      existingIds.add(newId);
      resultByKey.set(k, copy);
    }
    return result;
  };

  // Preserve positions of elements moved locally in the last PENDING_TTL_MS when applying incoming state
  const mergeIncomingWithPending = (incomingEls = [], prevEls = []) => {
    const now = Date.now();
    // Clean out stale entries
    try {
      for (const [eid, ts] of pendingMovesRef.current.entries()) {
        if (now - ts > PENDING_TTL_MS) pendingMovesRef.current.delete(eid);
      }
    } catch {}
    const prevById = new Map((prevEls || []).map(e => [typeof e.id === 'number' ? e.id : parseInt(e.id, 10), e]));
    return (incomingEls || []).map(e => {
      const idNum = typeof e.id === 'number' ? e.id : parseInt(e.id, 10);
      if (!Number.isFinite(idNum)) return e;
      const movedAt = pendingMovesRef.current.get(idNum);
      if (movedAt && (Date.now() - movedAt) <= PENDING_TTL_MS) {
        const prevEl = prevById.get(idNum);
        if (prevEl && prevEl.position) {
          return { ...e, position: { ...prevEl.position } };
        }
      }
      return e;
    });
  };

  // Load initial map state for the current channel
  useEffect(() => {
    let active = true;
    (async () => {
      if (!gameId) return;
      try { initialLoadedRef.current[channel] = false; } catch {}
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
          // Show live-shared values while host edits draft
          globalModifiers: liveState.globalModifiers ?? prev.globalModifiers,
          initiativeOrder: liveState.initiativeOrder ?? prev.initiativeOrder,
          initiativeScores: liveState.initiativeScores ?? prev.initiativeScores,
          currentTurnIndex: liveState.currentTurnIndex ?? prev.currentTurnIndex,
        }));
        try { initialLoadedRef.current.draft = true; } catch {}
        return;
      }
      // Default behavior: load the selected channel normally
      let row = null;
      try { row = await getMapState(gameId, channel); } catch (e) { console.warn('getMapState failed:', e); }
      if (!active || !row?.state) return;
      if (row.state.elements || row.state.grid) setState((prev) => ({ ...prev, ...row.state }));
      try { initialLoadedRef.current[channel] = true; } catch {}
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
        if (Number.isFinite(ts) && ts <= lastLiveUpdatedAtRef.current) return;
        const currentChannel = channelRef.current;
        const hostNow = isHostRef.current;
        if (currentChannel === 'live') {
          setState((prev) => {
            const next = { ...prev, ...row.state };
            if (Array.isArray(row.state?.elements)) {
              next.elements = mergeIncomingWithPending(row.state.elements, prev.elements || []);
            }
            return next;
          });
          if (Number.isFinite(ts)) lastLiveUpdatedAtRef.current = ts;
        } else if (currentChannel === 'draft' && hostNow) {
          const liveEls = row.state?.elements || [];
          setState((prev) => ({
            ...prev,
            // Preserve draft elements, but pull in missing actors from live
            elements: mergeActorsIntoElements(prev.elements || [], liveEls),
            // Also adopt shared live fields so host sees current initiative/modifiers
            globalModifiers: row.state?.globalModifiers ?? prev.globalModifiers,
            initiativeOrder: row.state?.initiativeOrder ?? prev.initiativeOrder,
            initiativeScores: row.state?.initiativeScores ?? prev.initiativeScores,
            currentTurnIndex: (typeof row.state?.currentTurnIndex === 'number') ? row.state.currentTurnIndex : prev.currentTurnIndex,
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
  // Only the host performs autosave; players rely on realtime broadcasts (and targeted writes for turns)
  if (!isHost) return;
  if (isHost === false && channel === 'draft') return; // redundant safety
  // Avoid writing before first load completes on this channel (prevents wipe on refresh)
  if (!initialLoadedRef.current[channel]) return;
        // Save full state to avoid wiping shared fields on refresh
        const saveState = {
          elements: state.elements,
          grid: state.grid,
          globalModifiers: state.globalModifiers,
          initiativeOrder: state.initiativeOrder,
          initiativeScores: state.initiativeScores,
          currentTurnIndex: state.currentTurnIndex,
        };
        // Optimistically bump last live ts to avoid applying stale payloads while this write is in flight
        if (channel === 'live') { try { lastLiveUpdatedAtRef.current = Date.now(); } catch {} }
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
  }, [state.elements, state.grid, state.globalModifiers, state.initiativeOrder, state.initiativeScores, state.currentTurnIndex, gameId, user?.id, channel, isHost, canWriteLive]);

  // Always sync shared fields (initiative and global modifiers) to LIVE so everyone sees them.
  // This runs especially when host is in draft; it merges only those fields into live without touching elements/grid.
  useEffect(() => {
    const debounce = setTimeout(async () => {
      try {
        if (!gameId || !user) return;
        // If we're already in live, the normal autosave will persist everything
        if (channel === 'live') return;
        // Only the host can edit modifiers in draft; still sync to live. Initiative can be edited by anyone, but players aren't in draft.
        if (!isHost) return;
        const liveRow = await getMapState(gameId, 'live').catch(() => null);
        const liveState = liveRow?.state || {};
        const merged = {
          ...liveState,
          initiativeOrder: state.initiativeOrder || [],
          initiativeScores: state.initiativeScores || {},
          currentTurnIndex: Number.isFinite(state.currentTurnIndex) ? state.currentTurnIndex : (liveState.currentTurnIndex || 0),
          globalModifiers: Array.isArray(state.globalModifiers) ? state.globalModifiers : (liveState.globalModifiers || []),
        };
        // Optimistically bump last live ts to avoid applying stale payloads while this write is in flight
        try { lastLiveUpdatedAtRef.current = Date.now(); } catch {}
        await upsertMapState(gameId, 'live', merged, user.id);
        lastLiveUpdatedAtRef.current = Date.now();
        if (liveSignalRef.current) {
          try { await liveSignalRef.current.send({ type: 'broadcast', event: 'live-updated', payload: { by: user.id, t: Date.now() } }); } catch {}
        }
      } catch (_) { /* ignore */ }
    }, 500);
    return () => clearTimeout(debounce);
  }, [state.initiativeOrder, state.initiativeScores, state.currentTurnIndex, state.globalModifiers, gameId, user?.id, channel, isHost]);

  // Sync isDrawingCover and coverBlocks into state for grid rendering
  const mergedState = { ...state, isDrawingCover, coverBlocks };

  // Host-in-draft: mirror enemies to LIVE so players retain enemy context across refreshes.
  // - Keep existing LIVE players and any non-enemy elements intact
  // - Replace LIVE enemies with the host's current draft enemies
  // - Debounced and change-guarded to limit churn
  useEffect(() => {
    const debounce = setTimeout(async () => {
      try {
        if (!gameId || !user) return;
        if (!isHost) return;
        if (channel !== 'draft') return;
        if (!initialLoadedRef.current.draft) return;
        const draftEnemies = (state.elements || []).filter(e => e && e.type === 'enemy');
        // If no enemies in draft, still propagate removal to LIVE (clears enemies)
        const liveRow = await getMapState(gameId, 'live').catch(() => null);
        const liveState = liveRow?.state || {};
        const liveEls = Array.isArray(liveState.elements) ? liveState.elements : [];
        const keep = liveEls.filter(e => e && e.type !== 'enemy');
        // Ensure unique ids when adding draft enemies
        const existingIds = new Set(keep.map(e => e.id));
        const maxId = keep.reduce((m, e) => {
          const n = typeof e.id === 'number' ? e.id : parseInt(e.id, 10);
          return Number.isFinite(n) ? Math.max(m, n) : m;
        }, 0);
        let nextId = maxId + 1;
        const addEnemies = draftEnemies.map(en => {
          let newId = en.id;
          if (existingIds.has(newId)) { newId = nextId++; }
          existingIds.add(newId);
          return { ...en, id: newId };
        });
        const nextEls = [...keep, ...addEnemies];
        const sig = (arr) => JSON.stringify((arr || []).filter(e => e && e.type === 'enemy').map(e => ({ id: e.id, name: e.name, size: e.size, x: e.position?.x, y: e.position?.y })).sort((a, b) => (a.id > b.id ? 1 : -1)));
        if (sig(liveEls) === sig(nextEls)) return;
        try { lastLiveUpdatedAtRef.current = Date.now(); } catch {}
        await upsertMapState(gameId, 'live', { ...liveState, elements: nextEls }, user.id);
        lastLiveUpdatedAtRef.current = Date.now();
        if (liveSignalRef.current) {
          try { await liveSignalRef.current.send({ type: 'broadcast', event: 'live-updated', payload: { by: user.id, t: Date.now() } }); } catch {}
        }
      } catch (_) { /* ignore */ }
    }, 800);
    return () => clearTimeout(debounce);
  }, [state.elements, gameId, user?.id, isHost, channel]);

  // Wrap position updates to record a short-lived pending move marker per element
  const safeUpdateElementPosition = (id, x, y) => {
    try { pendingMovesRef.current.set(Number(id), Date.now()); } catch {}
    updateElementPosition(id, x, y);
  };

  // Non-host: persist my player token to LIVE so the host and other players see it
  const syncMyTokenToLive = async (playerEl) => {
    try {
      if (!gameId || !user) return;
      if (isHost) return; // host edits draft; players own their live token
      // Merge my token into current live state without touching other fields
      const liveRow = await getMapState(gameId, 'live').catch(() => null);
      const liveState = liveRow?.state || {};
      const liveEls = Array.isArray(liveState.elements) ? liveState.elements.slice() : [];
      const byIdNum = (arr) => arr.reduce((m, e) => {
        const n = typeof e.id === 'number' ? e.id : parseInt(e.id, 10);
        return Number.isFinite(n) ? Math.max(m, n) : m;
      }, 0);
      const idx = liveEls.findIndex(el => el && el.type === 'player' && el.participantUserId === user.id);
      if (idx >= 0) {
        const existing = liveEls[idx];
        liveEls[idx] = { ...existing, ...playerEl, id: existing.id, type: 'player', participantUserId: user.id };
      } else {
        const maxId = byIdNum(liveEls);
        const newId = maxId + 1;
        const newEl = { ...playerEl, id: newId, type: 'player', participantUserId: user.id };
        liveEls.push(newEl);
      }
      const merged = { ...liveState, elements: liveEls };
      // Optimistic ts so we don't apply stale payloads
      try { lastLiveUpdatedAtRef.current = Date.now(); } catch {}
      await upsertMapState(gameId, 'live', merged, user.id);
      lastLiveUpdatedAtRef.current = Date.now();
      if (liveSignalRef.current) {
        try { await liveSignalRef.current.send({ type: 'broadcast', event: 'live-updated', payload: { by: user.id, t: Date.now() } }); } catch {}
      }
    } catch (_) { /* ignore */ }
  };

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

  // Import a monster as an enemy element (host or in editor)
  const importMonster = async (monster) => {
    try {
      // Only host (or when not in a game) can summon enemies
      if (gameId && !isHost) {
        setToast({ open: true, severity: 'info', message: 'Only the host can summon enemies.' });
        return;
      }
      const name = monster?.name || 'Enemy';
      const hp = Number.isFinite(monster?.hp) ? monster.hp : undefined;
  const movement = Number.isFinite(monster?.movement) ? monster.movement : 30;
  // Force size to 1 (Small) so the enemy occupies a single cell
  const size = 1;
      const iconUrl = monster?.imageUrl || null;
      // Create enemy locally
      setState(prev => {
        // Compute next id and place at first free cell
        const nextId = Math.max(0, ...((prev.elements || []).map(e => {
          const n = typeof e.id === 'number' ? e.id : parseInt(e.id, 10);
          return Number.isFinite(n) ? n : 0;
        }))) + 1;
        // find empty position
        let pos = { x: 0, y: 0 };
        outer: for (let y = 0; y <= (prev.grid.height - size); y++) {
          for (let x = 0; x <= (prev.grid.width - size); x++) {
            let occ = false;
            for (const el of (prev.elements || [])) {
              if (!el || !el.position) continue;
              if (x < el.position.x + el.size && x + size > el.position.x && y < el.position.y + el.size && y + size > el.position.y) {
                occ = true; break;
              }
            }
            if (!occ) { pos = { x, y }; break outer; }
          }
        }
        const newEnemy = {
          id: nextId,
          type: 'enemy',
          name,
          position: pos,
          size,
          color: '#f44336',
          movement,
          damage: 0,
          incapacitated: false,
          enemyIconUrl: iconUrl,
          bestiaryIndex: monster?.index || null,
          facing: 90,
          ...(Number.isFinite(hp) ? { maxHp: hp, currentHp: hp } : {}),
        };
        return { ...prev, elements: [...(prev.elements || []), newEnemy], highlightedElementId: null };
      });
  // If host and currently viewing LIVE, persist to LIVE immediately.
  // When host is in draft, the draft->live mirroring effect will propagate enemies automatically.
  if (gameId && user && isHost && (channelRef.current === 'live')) {
        try {
          const liveRow = await getMapState(gameId, 'live').catch(() => null);
          const liveState = liveRow?.state || {};
          const liveEls = Array.isArray(liveState.elements) ? liveState.elements.slice() : [];
          // Find the enemy we just added from local state and merge by name+size at same position if possible
          const local = latestStateRef.current || {};
          const added = (local.elements || []).slice().sort((a,b)=>b.id-a.id).find(e => e && e.type==='enemy' && e.bestiaryIndex===monster?.index && e.enemyIconUrl===iconUrl);
          const toAdd = added || {
            type: 'enemy', name, position: { x: 0, y: 0 }, size, color: '#f44336', movement, damage: 0, incapacitated: false, enemyIconUrl: iconUrl, bestiaryIndex: monster?.index || null, facing: 90,
            ...(Number.isFinite(hp) ? { maxHp: hp, currentHp: hp } : {}),
          };
          const maxId = liveEls.reduce((m,e)=>{ const n = typeof e.id==='number'?e.id:parseInt(e.id,10); return Number.isFinite(n)?Math.max(m,n):m; }, 0);
          toAdd.id = maxId + 1;
          liveEls.push(toAdd);
          const merged = { ...liveState, elements: liveEls };
          try { lastLiveUpdatedAtRef.current = Date.now(); } catch {}
          await upsertMapState(gameId, 'live', merged, user.id);
          lastLiveUpdatedAtRef.current = Date.now();
          if (liveSignalRef.current) {
            try { await liveSignalRef.current.send({ type: 'broadcast', event: 'live-updated', payload: { by: user.id, t: Date.now() } }); } catch {}
          }
        } catch (_) {}
      }
      setToast({ open: true, severity: 'success', message: `Summoned ${name}.` });
    } catch (e) {
      setToast({ open: true, severity: 'error', message: 'Failed to import monster.' });
    }
  };

  const removeMonster = async ({ index, name }) => {
    try {
      if (gameId && !isHost) {
        setToast({ open: true, severity: 'info', message: 'Only the host can remove enemies.' });
        return;
      }
      // Remove all enemies matching the bestiary index
      setState(prev => ({
        ...prev,
        elements: (prev.elements || []).filter(e => !(e && e.type === 'enemy' && e.bestiaryIndex === index)),
      }));
      // Persist to LIVE immediately if host is viewing live
      if (gameId && user && isHost && (channelRef.current === 'live')) {
        try {
          const liveRow = await getMapState(gameId, 'live').catch(() => null);
          const liveState = liveRow?.state || {};
          const liveEls = Array.isArray(liveState.elements) ? liveState.elements.slice() : [];
          const nextEls = liveEls.filter(e => !(e && e.type === 'enemy' && e.bestiaryIndex === index));
          const merged = { ...liveState, elements: nextEls };
          try { lastLiveUpdatedAtRef.current = Date.now(); } catch {}
          await upsertMapState(gameId, 'live', merged, user.id);
          lastLiveUpdatedAtRef.current = Date.now();
          if (liveSignalRef.current) {
            try { await liveSignalRef.current.send({ type: 'broadcast', event: 'live-updated', payload: { by: user.id, t: Date.now() } }); } catch {}
          }
        } catch (_) {}
      }
      setToast({ open: true, severity: 'success', message: name ? `Removed ${name} from battlemap.` : 'Removed from battlemap.' });
    } catch (e) {
      setToast({ open: true, severity: 'error', message: 'Failed to remove from battlemap.' });
    }
  };

  // Apply selected character to the local user's player token
  const applyCharacterToToken = (character) => {
    if (!character || !user) return;
    let nextTokenForSync = null;
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
        const created = {
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
        nextTokenForSync = created.elements.find(el => el.type === 'player' && el.participantUserId === user.id) || null;
        return created;
      }
      const updates = {
        name: character.name || token.name,
        maxHp: Number(character.max_hp ?? token.maxHp ?? 10),
        currentHp: Number(character.current_hp ?? token.currentHp ?? 10),
        movement: Number(character.speed ?? token.movement ?? 30),
        characterId: character.id || token.characterId,
        characterIconUrl: character.icon_url || token.characterIconUrl || null,
      };
      const updated = {
        ...prev,
        elements: (prev.elements || []).map(el => el.id === token.id ? { ...el, ...updates } : el),
      };
      nextTokenForSync = { ...token, ...updates };
      return updated;
    });
    // Persist to LIVE so host/others see the player's token quickly
    if (!isHost && gameId && user) {
      // Fire and forget; errors are safe to ignore as we still have local state
      syncMyTokenToLive(nextTokenForSync).catch(() => {});
    }
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

  // Listen for Bestiary import and open requests from children
  useEffect(() => {
    const onImport = (e) => {
      const monster = e?.detail || {};
      importMonster(monster);
    };
    const onOpen = (e) => {
      const idx = e?.detail?.index || null;
      // Open standalone description modal instead of the Bestiary list
      setMonsterDescModal({ open: true, index: idx });
    };
    window.addEventListener('bm-import-monster', onImport);
    window.addEventListener('bm-open-bestiary', onOpen);
    return () => {
      window.removeEventListener('bm-import-monster', onImport);
      window.removeEventListener('bm-open-bestiary', onOpen);
    };
  }, [gameId, user?.id, isHost]);

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
        onFellowshipClick={onFellowshipClick}
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
      <ToolProvider>
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
          <div className="map-pane">
            <SlimToolbar />
            <BattleMap
          state={mergedState}
          setState={setState}
          isDrawingCover={isDrawingCover}
          coverBlocks={coverBlocks}
          setCoverBlocks={setCoverBlocks}
          drawEnvType={drawEnvType}
          updateElementPosition={safeUpdateElementPosition}
          pushUndo={pushUndo}
          highlightCoverGroup={highlightCoverGroup}
          battleMapRef={battleMapRef}
          isHost={isHost}
          currentUserId={user?.id}
            />
          </div>
        </div>
      </ToolProvider>
      <AddCharacterModal
        isOpen={modalState.addCharacter}
        onClose={() => setModalState(prev => ({ ...prev, addCharacter: false }))}
        onAdd={handleAddCharacters}
      />
      {/* Bestiary modal for description/import, can be opened programmatically */}
      <MonsterBrowserModal
        open={bestiaryModal.open}
        initialIndex={bestiaryModal.initialIndex}
        onClose={() => setBestiaryModal({ open: false, initialIndex: null })}
        canSummon={!gameId || isHost}
        isInMap={(idx) => {
          try { return (state.elements || []).some(e => e && e.type === 'enemy' && e.bestiaryIndex === idx); } catch { return false; }
        }}
        {...((!gameId || isHost) ? { onImport: (monster) => importMonster(monster), onRemove: (info) => removeMonster(info) } : {})}
      />
      <MonsterDescriptionModal
        open={monsterDescModal.open}
        index={monsterDescModal.index}
        onClose={() => setMonsterDescModal({ open: false, index: null })}
        canSummon={!gameId || isHost}
        isInMap={(() => {
          const idx = monsterDescModal.index;
          if (!idx) return false;
          try {
            return (state.elements || []).some(e => e && e.type === 'enemy' && e.bestiaryIndex === idx);
          } catch { return false; }
        })()}
        onAdd={(payload) => importMonster(payload)}
        onRemove={(info) => removeMonster(info)}
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
        setState={(updater) => {
          setState(prev => {
            const next = typeof updater === 'function' ? updater(prev) : updater;
            return next;
          });
        }}
        onClose={() => setModalState(prev => ({ ...prev, initiative: false }))}
        readOnly={!isHost}
      />
      <GlobalModifiersModal
        isOpen={modalState.globalModifiers}
        state={mergedState}
        setState={(updater) => {
          setState(prev => {
            const next = typeof updater === 'function' ? updater(prev) : updater;
            return next;
          });
        }}
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
            setToast({ open: true, severity: 'success', message: `Overwrote "${entry.name}" in library.` });
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
  // Only the host saves on hide/unmount to avoid write loops from viewers
  if (!isHost) return;
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