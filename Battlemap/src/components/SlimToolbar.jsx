import React, { useRef, useState } from 'react';
import { Box, IconButton, Tooltip } from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faRuler, faRulerCombined, faArrowPointer, faArrowsUpDownLeftRight, faChevronRight, faGear, faTrashCan, faUpload, faDownload, faRightToBracket, faUserPlus, faRightFromBracket, faRotateLeft, faBook, faXmark, faBold, faItalic, faUnderline, faStrikethrough, faListUl, faListOl } from '@fortawesome/free-solid-svg-icons';
import { faPenToSquare as faPenToSquareRegular } from '@fortawesome/free-regular-svg-icons';
import { useTool, ToolIds, RulerModes } from '../context/ToolContext.jsx';

export default function SlimToolbar({
  isHost = false,
  isDrawingCover = false,
  toggleDrawingMode,
  drawEnvType,
  setDrawEnvType,
  drawCreatureMode = null,
  setDrawCreatureMode,
  finalizeCreatureDrawing,
  undo,
  openGlobalModifiers,
  gridSize,
  openGridSettings,
  gameId = null,
  hasCharacter = false,
  onSaveNotes,
  // Map actions (optional)
  clearMap,
  onSaveMap,
  onLoadMap,
  onSaveLibrary,
  onLoadLibrary,
  // Game actions (optional)
  onJoinGame,
  onHostGame,
  onLeaveGame,
  // Host live/draft controls
  currentChannel,
  onToggleChannel,
  onPushToPlayers,
  hasGame = false,
}) {
  const { tool, setTool, rulerMode, setRulerMode } = useTool();
  const [drawMenuOpen, setDrawMenuOpen] = useState(false);
  const [primaryOpen, setPrimaryOpen] = useState(null); // 'environment' | 'terrain' | 'creatures' | null
  const [submenuTop, setSubmenuTop] = useState(0);
  const drawBtnRef = useRef(null);
  const menuRef = useRef(null);
  const wrapRef = useRef(null);
  const [isMobile, setIsMobile] = useState(false);
  const [menuHeight, setMenuHeight] = useState(56); // track primary menu height on mobile
  const toolbarRef = useRef(null);
  const [barHeight, setBarHeight] = useState(48);
  // Ruler dropdown state
  const [rulerMenuOpen, setRulerMenuOpen] = useState(false);
  const rulerWrapRef = useRef(null);
  const rulerMenuRef = useRef(null);
  const [rulerMenuHeight, setRulerMenuHeight] = useState(56);
  // Settings dropdown state
  const [settingsMenuOpen, setSettingsMenuOpen] = useState(false);
  const [settingsPrimaryOpen, setSettingsPrimaryOpen] = useState(null); // 'map' | 'game' | null
  const [settingsSubmenuTop, setSettingsSubmenuTop] = useState(0);
  const settingsWrapRef = useRef(null);
  const settingsMenuRef = useRef(null);
  const [settingsMenuHeight, setSettingsMenuHeight] = useState(56);
  // Notes popover state
  const [notesOpen, setNotesOpen] = useState(false);
  const notesWrapRef = useRef(null);
  const notesEditorRef = useRef(null);
  const [notesHtml, setNotesHtml] = useState('');
  const notesStorageKey = gameId ? `bm-notes-${gameId}` : 'bm-notes-local';
  const notesHydratedRef = useRef(false);
  const isPlayerInGame = hasGame && !isHost;

  // Track mobile layout (toolbar fixed at bottom); open draw menu upwards on mobile
  React.useEffect(() => {
    const compute = () => {
      try {
        setIsMobile(typeof window !== 'undefined' && window.innerWidth <= 1024);
      } catch { setIsMobile(false); }
    };
    compute();
    window.addEventListener('resize', compute);
    return () => window.removeEventListener('resize', compute);
  }, []);

  // Measure the primary menu height when open on mobile so we can place the submenu above it
  React.useEffect(() => {
    if (!drawMenuOpen || !isMobile) return;
    const el = menuRef.current;
    if (!el) return;
    try {
      const rect = el.getBoundingClientRect();
      if (rect?.height && Math.abs(rect.height - menuHeight) > 1) setMenuHeight(Math.ceil(rect.height));
    } catch {}
  }, [drawMenuOpen, isMobile, primaryOpen, menuHeight]);

  // Measure the slim toolbar height on mobile so menus can sit above it even when it grows
  React.useEffect(() => {
    if (!isMobile) return;
    const measure = () => {
      try {
        const el = toolbarRef.current;
        if (!el) return;
        const h = Math.ceil(el.getBoundingClientRect().height);
        if (Number.isFinite(h) && h > 0 && Math.abs(h - barHeight) > 1) setBarHeight(h);
      } catch {}
    };
    measure();
    const onResize = () => measure();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [isMobile, barHeight, isHost, hasGame]);

  // Measure settings primary height on mobile
  React.useEffect(() => {
    if (!settingsMenuOpen || !isMobile) return;
    const el = settingsMenuRef.current;
    if (!el) return;
    try {
      const rect = el.getBoundingClientRect();
      if (rect?.height && Math.abs(rect.height - settingsMenuHeight) > 1) setSettingsMenuHeight(Math.ceil(rect.height));
    } catch {}
  }, [settingsMenuOpen, isMobile, settingsPrimaryOpen, settingsMenuHeight]);

  // Measure ruler primary height on mobile
  React.useEffect(() => {
    if (!rulerMenuOpen || !isMobile) return;
    const el = rulerMenuRef.current;
    if (!el) return;
    try {
      const rect = el.getBoundingClientRect();
      if (rect?.height && Math.abs(rect.height - rulerMenuHeight) > 1) setRulerMenuHeight(Math.ceil(rect.height));
    } catch {}
  }, [rulerMenuOpen, isMobile, rulerMenuHeight]);

  const btnSx = (active) => ({
    color: active ? '#4CAF50' : '#fff',
    border: active ? '1px solid rgba(76,175,80,0.7)' : '1px solid rgba(255,255,255,0.15)',
    backgroundColor: active ? 'rgba(76,175,80,0.15)' : 'transparent',
    '&:hover': { backgroundColor: 'rgba(255,255,255,0.08)' },
    p: 0,
  });
  const btnSxAmber = (active) => ({
    color: active ? '#FFC107' : '#fff',
    border: active ? '1px solid rgba(255,193,7,0.7)' : '1px solid rgba(255,255,255,0.15)',
    backgroundColor: active ? 'rgba(255,193,7,0.15)' : 'transparent',
    '&:hover': { backgroundColor: 'rgba(255,255,255,0.08)' },
    p: 0,
  });

  const onClickDraw = () => {
    // Only hosts can draw
    if (!isHost) return;
    // If in any draw mode (cover or creatures), just toggle the menu visibility
    if (isDrawingCover || drawCreatureMode) {
      setDrawMenuOpen(v => !v);
      if (typeof setTool === 'function') setTool(ToolIds.DRAW);
      return;
    }
    // Otherwise, open the draw menu without entering any specific mode yet
    setDrawMenuOpen(true);
    setPrimaryOpen(null);
    if (typeof setTool === 'function') setTool(ToolIds.DRAW);
  };

  const selectPrimary = (key, evt) => {
    // Toggle submenu if same item clicked again
    if (primaryOpen === key) {
      setPrimaryOpen(null);
      return;
    }
    setPrimaryOpen(key);
    // Align submenu near the clicked item like typical submenus
    try {
      const menuEl = menuRef.current;
      const itemEl = evt?.currentTarget;
      if (menuEl && itemEl) {
        const mRect = menuEl.getBoundingClientRect();
        const iRect = itemEl.getBoundingClientRect();
        setSubmenuTop(Math.max(0, iRect.top - mRect.top));
      } else {
        setSubmenuTop(0);
      }
    } catch {
      setSubmenuTop(0);
    }
  };

  const selectEnvType = (type) => {
    if (typeof setDrawEnvType === 'function') setDrawEnvType(type);
    // Exit creatures mode if active
    if (drawCreatureMode) {
      if (typeof finalizeCreatureDrawing === 'function') finalizeCreatureDrawing();
      if (typeof setDrawCreatureMode === 'function') setDrawCreatureMode(null);
    }
    // Ensure we're in cover drawing mode
    if (!isDrawingCover && typeof toggleDrawingMode === 'function') toggleDrawingMode();
    // Close the menu after selecting
    setDrawMenuOpen(false);
  };

  // Close draw menus when clicking outside the draw tool area
  React.useEffect(() => {
    if (!drawMenuOpen) return;
    const onDocPointerDown = (e) => {
      try {
        const within = wrapRef.current?.contains?.(e.target);
        if (!within) {
          setDrawMenuOpen(false);
          // Preserve primaryOpen so reopening restores the last submenu
        }
      } catch {}
    };
    document.addEventListener('pointerdown', onDocPointerDown, true);
    return () => document.removeEventListener('pointerdown', onDocPointerDown, true);
  }, [drawMenuOpen]);

  // Close settings menu on outside click
  React.useEffect(() => {
    if (!settingsMenuOpen) return;
    const onDocPointerDown = (e) => {
      try {
        const within = settingsWrapRef.current?.contains?.(e.target);
        if (!within) {
          setSettingsMenuOpen(false);
        }
      } catch {}
    };
    document.addEventListener('pointerdown', onDocPointerDown, true);
    return () => document.removeEventListener('pointerdown', onDocPointerDown, true);
  }, [settingsMenuOpen]);

  // Close ruler menu on outside click
  React.useEffect(() => {
    if (!rulerMenuOpen) return;
    const onDocPointerDown = (e) => {
      try {
        const within = rulerWrapRef.current?.contains?.(e.target);
        if (!within) setRulerMenuOpen(false);
      } catch {}
    };
    document.addEventListener('pointerdown', onDocPointerDown, true);
    return () => document.removeEventListener('pointerdown', onDocPointerDown, true);
  }, [rulerMenuOpen]);

  // Notes: load/save and outside click
  React.useEffect(() => {
    if (!notesOpen) return;
    try {
      const saved = window.localStorage.getItem(notesStorageKey);
      setNotesHtml(saved || '');
      // Hydrate editor content and focus after open
      setTimeout(() => {
        if (notesEditorRef.current) {
          try { notesEditorRef.current.innerHTML = saved || ''; } catch {}
          notesEditorRef.current.focus();
          notesHydratedRef.current = true;
        }
      }, 50);
    } catch {}
  }, [notesOpen, notesStorageKey]);
  React.useEffect(() => { if (!notesOpen) notesHydratedRef.current = false; }, [notesOpen]);
  React.useEffect(() => {
    if (!notesOpen) return;
    try { window.localStorage.setItem(notesStorageKey, notesHtml || ''); } catch {}
  }, [notesOpen, notesHtml, notesStorageKey]);
  React.useEffect(() => {
    if (!notesOpen) return;
    const onDocPointerDown = (e) => {
      try {
        const within = notesWrapRef.current?.contains?.(e.target);
        if (!within) setNotesOpen(false);
      } catch {}
    };
    document.addEventListener('pointerdown', onDocPointerDown, true);
    return () => document.removeEventListener('pointerdown', onDocPointerDown, true);
  }, [notesOpen]);
  const execNoteCmd = (cmd) => {
    try {
      const editor = notesEditorRef.current;
      if (editor) editor.focus();
      document.execCommand(cmd, false, null);
      const next = editor?.innerHTML || '';
      setNotesHtml(next);
    } catch {}
  };
  const [savingNotes, setSavingNotes] = useState(false);

  const selectTool = (id) => {
    // Switching tools while drawing should finish the drawing and exit mode
    if (isDrawingCover && typeof toggleDrawingMode === 'function') {
      toggleDrawingMode(); // completes/commits any drawn cover and exits mode
    }
    // Exit creature placement mode if active
    if (drawCreatureMode) {
      if (typeof finalizeCreatureDrawing === 'function') finalizeCreatureDrawing();
      if (typeof setDrawCreatureMode === 'function') setDrawCreatureMode(null);
    }
    // Close any open draw menus
    setDrawMenuOpen(false);
    setPrimaryOpen(null);
    // Switch tool
    setTool(id);
  };

  const selectCreatureMode = (mode) => {
    if (!isHost) return;
    // If currently in cover mode, finalize/exit first
    if (isDrawingCover && typeof toggleDrawingMode === 'function') {
      toggleDrawingMode();
    }
    if (typeof setDrawCreatureMode === 'function') setDrawCreatureMode(mode);
    if (typeof setTool === 'function') setTool(ToolIds.DRAW);
    // Keep the menu open and remember current submenu for quick switching
    setPrimaryOpen('creatures');
    setDrawMenuOpen(true);
  };

  return (
    <Box
      className="slim-toolbar"
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 0.5,
        px: 0.75,
        flexWrap: isMobile ? 'wrap' : 'nowrap',
      }}
      role="toolbar"
      aria-label="Tools"
      ref={toolbarRef}
    >
      <Tooltip title="Pointer" placement="bottom">
        <IconButton aria-label="Pointer tool" size="small" sx={btnSx(tool === ToolIds.POINTER)} onClick={() => selectTool(ToolIds.POINTER)}>
          <FontAwesomeIcon icon={faArrowPointer} />
        </IconButton>
      </Tooltip>
      <Tooltip title="Move (highlight movement)" placement="bottom">
        <IconButton aria-label="Move tool" size="small" sx={btnSx(tool === ToolIds.MOVE)} onClick={() => selectTool(ToolIds.MOVE)}>
          <FontAwesomeIcon icon={faArrowsUpDownLeftRight} />
        </IconButton>
      </Tooltip>
      {/* Ruler tool with dropdown */}
      <div className="slim-toolbar__ruler" ref={rulerWrapRef} style={{ position: 'relative', display: 'inline-flex' }}>
        <Tooltip title="Ruler (choose mode)" placement="bottom">
          <IconButton
            aria-label="Ruler tool"
            size="small"
            sx={btnSx(tool === ToolIds.RULER || rulerMenuOpen)}
            onClick={() => {
              // Enter ruler tool and toggle menu
              if (tool !== ToolIds.RULER) setTool(ToolIds.RULER);
              setRulerMenuOpen(v => !v);
              // Close other menus
              setDrawMenuOpen(false);
              setSettingsMenuOpen(false);
              setNotesOpen(false);
            }}
          >
            <FontAwesomeIcon icon={faRuler} />
          </IconButton>
        </Tooltip>
        {rulerMenuOpen && (
          <div
            className="slim-dropdown"
            style={{
              position: isMobile ? 'fixed' : 'absolute',
              zIndex: 210,
              ...(isMobile ? {
                left: 0,
                right: 0,
                bottom: `calc(${barHeight}px + env(safe-area-inset-bottom, 0px) + var(--mobile-footer-height, 0px))`,
                transform: 'none',
              } : { left: '50%', transform: 'translateX(-50%)', top: '100%', marginTop: 6 })
            }}
          >
            <div
              className="slim-dropdown__menu"
              ref={rulerMenuRef}
              style={isMobile ? { top: 'auto', left: 0, right: 0, bottom: 0, borderRadius: 0, display: 'flex', flexDirection: 'row', justifyContent: 'space-around', padding: '8px 10px' } : undefined}
            >
              <button
                className={`slim-dropdown__item ${rulerMode === RulerModes.LINE ? 'selected' : ''}`}
                onClick={() => { setRulerMode(RulerModes.LINE); setRulerMenuOpen(false); setTool(ToolIds.RULER); }}
                style={isMobile ? { flex: 1, justifyContent: 'center' } : undefined}
              >
                <FontAwesomeIcon icon={faRuler} style={{ marginRight: 8 }} />
                <span>Line Measure</span>
              </button>
              <button
                className={`slim-dropdown__item ${rulerMode === RulerModes.PATH ? 'selected' : ''}`}
                onClick={() => { setRulerMode(RulerModes.PATH); setRulerMenuOpen(false); setTool(ToolIds.RULER); }}
                style={isMobile ? { flex: 1, justifyContent: 'center' } : undefined}
              >
                <FontAwesomeIcon icon={faRulerCombined} style={{ marginRight: 8 }} />
                <span>Path Measure</span>
              </button>
            </div>
          </div>
        )}
      </div>
      
      {isHost && (
        <div className="slim-toolbar__draw" ref={wrapRef} style={{ position: 'relative', display: 'inline-flex' }}>
          <Tooltip title={isDrawingCover ? 'Drawing mode (click to toggle menu)' : 'Enter drawing mode'} placement="bottom">
            <IconButton
              ref={drawBtnRef}
              aria-label="Draw environments/terrain"
              size="small"
              sx={{ ...btnSx(isDrawingCover || !!drawCreatureMode || drawMenuOpen), position: 'relative' }}
              onClick={onClickDraw}
            >
              {/* Main icon */}
              <FontAwesomeIcon icon={faPenToSquareRegular} />
            </IconButton>
          </Tooltip>
          {drawMenuOpen && (
            <div
              className="slim-dropdown"
              style={{
                position: isMobile ? 'fixed' : 'absolute',
                zIndex: 210,
                ...(isMobile ? {
                  left: 0,
                  right: 0,
                  bottom: `calc(${barHeight}px + env(safe-area-inset-bottom, 0px) + var(--mobile-footer-height, 0px))`,
                  transform: 'none',
                } : { left: '50%', transform: 'translateX(-50%)', top: '100%', marginTop: 6 })
              }}
            >
              <div
                className="slim-dropdown__menu"
                ref={menuRef}
                style={isMobile ? { top: 'auto', left: 0, right: 0, bottom: 0, borderRadius: 0, display: 'flex', flexDirection: 'row', justifyContent: 'space-around', padding: '8px 10px' } : undefined}
              >
                <button className={`slim-dropdown__item ${primaryOpen === 'environment' ? 'active' : ''}`} onClick={(e) => selectPrimary('environment', e)} style={isMobile ? { flex: 1, justifyContent: 'center' } : undefined}>
                  <span>Cover</span>
                  {!isMobile && (<FontAwesomeIcon icon={faChevronRight} style={{ opacity: 0.85, fontSize: 10 }} />)}
                </button>
                <button className={`slim-dropdown__item ${primaryOpen === 'terrain' ? 'active' : ''}`} onClick={(e) => selectPrimary('terrain', e)} style={isMobile ? { flex: 1, justifyContent: 'center' } : undefined}>
                  <span>Terrain</span>
                  {!isMobile && (<FontAwesomeIcon icon={faChevronRight} style={{ opacity: 0.85, fontSize: 10 }} />)}
                </button>
                <button className={`slim-dropdown__item ${primaryOpen === 'creatures' ? 'active' : ''}`} onClick={(e) => selectPrimary('creatures', e)} style={isMobile ? { flex: 1, justifyContent: 'center' } : undefined}>
                  <span>Creatures</span>
                  {!isMobile && (<FontAwesomeIcon icon={faChevronRight} style={{ opacity: 0.85, fontSize: 10 }} />)}
                </button>
                {primaryOpen === 'environment' && (
                  <div
                    className="slim-dropdown__submenu"
                    style={isMobile ? {
                      top: 'auto',
                      position: 'fixed',
                      left: 0,
                      right: 0,
                      bottom: `calc(${barHeight}px + env(safe-area-inset-bottom, 0px) + var(--mobile-footer-height, 0px) + ${menuHeight}px)`,
                      borderRadius: 0,
                    } : { left: '100%', top: submenuTop }}
                  >
                    <button className={`slim-dropdown__item ${drawEnvType === 'half' ? 'selected' : ''}`} onClick={() => selectEnvType('half')} style={isMobile ? { width: '100%' } : undefined}>Half Cover</button>
                    <button className={`slim-dropdown__item ${drawEnvType === 'three-quarters' ? 'selected' : ''}`} onClick={() => selectEnvType('three-quarters')} style={isMobile ? { width: '100%' } : undefined}>Three-Quarters</button>
                    <button className={`slim-dropdown__item ${drawEnvType === 'full' ? 'selected' : ''}`} onClick={() => selectEnvType('full')} style={isMobile ? { width: '100%' } : undefined}>Full Cover</button>
                    <button className={`slim-dropdown__item ${drawEnvType === 'walls' ? 'selected' : ''}`} onClick={() => selectEnvType('walls')} style={isMobile ? { width: '100%' } : undefined}>Walls (Full)</button>
                  </div>
                )}
                {primaryOpen === 'terrain' && (
                  <div
                    className="slim-dropdown__submenu"
                    style={isMobile ? {
                      top: 'auto',
                      position: 'fixed',
                      left: 0,
                      right: 0,
                      bottom: `calc(${barHeight}px + env(safe-area-inset-bottom, 0px) + var(--mobile-footer-height, 0px) + ${menuHeight}px)`,
                      borderRadius: 0,
                    } : { left: '100%', top: submenuTop }}
                  >
                    <button className={`slim-dropdown__item ${drawEnvType === 'difficult' ? 'selected' : ''}`} onClick={() => selectEnvType('difficult')} style={isMobile ? { width: '100%' } : undefined}>Difficult Terrain</button>
                    <button className={`slim-dropdown__item ${drawEnvType === 'vegetation' ? 'selected' : ''}`} onClick={() => selectEnvType('vegetation')} style={isMobile ? { width: '100%' } : undefined}>Vegetation</button>
                    <button className={`slim-dropdown__item ${drawEnvType === 'water' ? 'selected' : ''}`} onClick={() => selectEnvType('water')} style={isMobile ? { width: '100%' } : undefined}>Water</button>
                  </div>
                )}
                {primaryOpen === 'creatures' && (
                  <div
                    className="slim-dropdown__submenu"
                    style={isMobile ? {
                      top: 'auto',
                      position: 'fixed',
                      left: 0,
                      right: 0,
                      bottom: `calc(${barHeight}px + env(safe-area-inset-bottom, 0px) + var(--mobile-footer-height, 0px) + ${menuHeight}px)`,
                      borderRadius: 0,
                    } : { left: '100%', top: submenuTop }}
                  >
                    <button className={`slim-dropdown__item ${drawCreatureMode === 'player-generic' ? 'selected' : ''}`} onClick={() => selectCreatureMode('player-generic')} style={isMobile ? { width: '100%' } : undefined}>Player (Generic)</button>
                    <button className={`slim-dropdown__item ${drawCreatureMode === 'enemy-generic' ? 'selected' : ''}`} onClick={() => selectCreatureMode('enemy-generic')} style={isMobile ? { width: '100%' } : undefined}>Enemy (Generic)</button>
                    <button className={`slim-dropdown__item ${drawCreatureMode === 'enemy-bestiary' ? 'selected' : ''}`} onClick={() => selectCreatureMode('enemy-bestiary')} style={isMobile ? { width: '100%' } : undefined}>Enemy (Bestiary)</button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
      {/* Settings dropdown (gear) */}
      {/* Notes button, placed after Drawing tool */}
      <div className="slim-toolbar__notes" ref={notesWrapRef} style={{ position: 'relative', display: 'inline-flex' }}>
        <Tooltip title="Notes" placement="bottom">
          <IconButton aria-label="Notes" size="small" sx={btnSxAmber(notesOpen)} onClick={() => { setNotesOpen(v => !v); setSettingsMenuOpen(false); setDrawMenuOpen(false); }}>
            <FontAwesomeIcon icon={faBook} />
          </IconButton>
        </Tooltip>
        {notesOpen && (
          <div
            className="slim-dropdown"
            style={{
              position: isMobile ? 'fixed' : 'absolute',
              zIndex: 210,
              ...(isMobile ? { left: 0, right: 0, bottom: `calc(${barHeight}px + env(safe-area-inset-bottom, 0px) + var(--mobile-footer-height, 0px))`, transform: 'none' } : { left: '50%', transform: 'translateX(-50%)', top: '100%', marginTop: 6 })
            }}
          >
            <div
              className="slim-dropdown__menu"
              style={isMobile ? {
                top: 'auto', left: 0, right: 0, bottom: 0, borderRadius: 0, padding: '10px',
                maxHeight: `calc(100vh - ${barHeight}px - env(safe-area-inset-bottom, 0px) - var(--mobile-footer-height, 0px) - 12px)`,
                overflowY: 'auto'
              } : { minWidth: 420, maxWidth: 520, padding: 10, maxHeight: '70vh', overflowY: 'auto' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 8, position: 'relative' }}>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>
                  <Tooltip title="Bold" placement="top">
                    <IconButton size="small" onMouseDown={(e) => e.preventDefault()} onClick={() => execNoteCmd('bold')} sx={{ color: 'rgba(255,255,255,0.9)' }}>
                      <FontAwesomeIcon icon={faBold} />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Italic" placement="top">
                    <IconButton size="small" onMouseDown={(e) => e.preventDefault()} onClick={() => execNoteCmd('italic')} sx={{ color: 'rgba(255,255,255,0.9)' }}>
                      <FontAwesomeIcon icon={faItalic} />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Underline" placement="top">
                    <IconButton size="small" onMouseDown={(e) => e.preventDefault()} onClick={() => execNoteCmd('underline')} sx={{ color: 'rgba(255,255,255,0.9)' }}>
                      <FontAwesomeIcon icon={faUnderline} />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Strikethrough" placement="top">
                    <IconButton size="small" onMouseDown={(e) => e.preventDefault()} onClick={() => execNoteCmd('strikeThrough')} sx={{ color: 'rgba(255,255,255,0.9)' }}>
                      <FontAwesomeIcon icon={faStrikethrough} />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Bullet list" placement="top">
                    <IconButton size="small" onMouseDown={(e) => e.preventDefault()} onClick={() => execNoteCmd('insertUnorderedList')} sx={{ color: 'rgba(255,255,255,0.9)' }}>
                      <FontAwesomeIcon icon={faListUl} />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Numbered list" placement="top">
                    <IconButton size="small" onMouseDown={(e) => e.preventDefault()} onClick={() => execNoteCmd('insertOrderedList')} sx={{ color: 'rgba(255,255,255,0.9)' }}>
                      <FontAwesomeIcon icon={faListOl} />
                    </IconButton>
                  </Tooltip>
                </div>
                <IconButton
                  aria-label="Close notes"
                  size="small"
                  onClick={() => setNotesOpen(false)}
                  sx={{ position: 'absolute', right: 0, top: 0, color: 'rgba(255,255,255,0.8)' }}
                  title="Close notes"
                >
                  <FontAwesomeIcon icon={faXmark} />
                </IconButton>
              </div>
              <div
                ref={notesEditorRef}
                contentEditable
                suppressContentEditableWarning
                onInput={() => { const next = notesEditorRef.current?.innerHTML || ''; setNotesHtml(next); }}
                style={{ minHeight: 240, outline: 'none', border: '1px solid #555', borderRadius: 6, padding: '8px 10px', backgroundColor: '#2c2c2c', direction: 'ltr', textAlign: 'left', whiteSpace: 'pre-wrap', wordBreak: 'break-word', overflowY: 'auto', listStylePosition: 'inside', paddingLeft: 16 }}
              />
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
                <button
                  className="btn btn-primary"
                  disabled={savingNotes || !gameId || (!isHost && !hasCharacter)}
                  title={gameId ? (isHost ? 'Save campaign notes' : (hasCharacter ? 'Save to your character' : 'Select a character to save notes')) : 'Notes can be saved only in a game'}
                  onClick={async () => {
                    if (!onSaveNotes) return;
                    setSavingNotes(true);
                    try {
                      const res = await Promise.resolve(onSaveNotes(notesHtml));
                      if (res?.ok ?? !!res) {
                        setNotesOpen(false);
                      }
                    } catch (error) {
                      // Keep the popover open to allow retry after an unexpected save failure.
                    } finally {
                      setSavingNotes(false);
                    }
                  }}
                  style={{ minWidth: 100 }}
                >
                  {savingNotes ? 'Saving…' : 'Save'}
                </button>
              </div>            </div>
          </div>
        )}
      </div>
      
      {/* Settings dropdown (gear) */}
      <div className="slim-toolbar__settings" ref={settingsWrapRef} style={{ position: 'relative', display: 'inline-flex' }}>
        <Tooltip title={isHost ? (isDrawingCover ? 'Settings disabled while drawing' : 'Settings') : 'Settings (host features disabled)'} placement="bottom">
          <span>
            <IconButton
              aria-label="Settings"
              size="small"
              sx={btnSxAmber(settingsMenuOpen)}
              onClick={() => {
                setSettingsMenuOpen(v => !v);
                setSettingsPrimaryOpen(null);
                setDrawMenuOpen(false);
                // Do not change the current tool; Settings is not a tool
              }}
            >
              <FontAwesomeIcon icon={faGear} />
            </IconButton>
          </span>
        </Tooltip>
        {settingsMenuOpen && (
          <div
            className="slim-dropdown"
            style={{
              position: isMobile ? 'fixed' : 'absolute',
              zIndex: 210,
              ...(isMobile ? { left: 0, right: 0, bottom: `calc(${barHeight}px + env(safe-area-inset-bottom, 0px) + var(--mobile-footer-height, 0px))`, transform: 'none' } : { left: '50%', transform: 'translateX(-50%)', top: '100%', marginTop: 6 })
            }}
          >
            <div
              className="slim-dropdown__menu"
              ref={settingsMenuRef}
              style={isMobile ? { top: 'auto', left: 0, right: 0, bottom: 0, borderRadius: 0, display: 'flex', flexDirection: 'row', justifyContent: 'space-around', padding: '8px 10px' } : undefined}
            >
              <button className={`slim-dropdown__item`} disabled={isPlayerInGame}
                onClick={() => { if (isPlayerInGame) return; if (!isDrawingCover) openGridSettings && openGridSettings(); setSettingsMenuOpen(false); }}
                style={isMobile ? { flex: 1, justifyContent: 'center', opacity: isPlayerInGame ? 0.5 : 1, cursor: isPlayerInGame ? 'not-allowed' : 'pointer' } : (isPlayerInGame ? { opacity: 0.5, cursor: 'not-allowed' } : undefined)}
              >
                <span>Grid Settings</span>
              </button>
              <button className={`slim-dropdown__item ${settingsPrimaryOpen === 'map' ? 'active' : ''}`} disabled={isPlayerInGame}
                onClick={(e) => {
                  if (isPlayerInGame) return;
                  if (settingsPrimaryOpen === 'map') setSettingsPrimaryOpen(null); else setSettingsPrimaryOpen('map');
                  if (!isMobile) {
                    try {
                      const mRect = settingsMenuRef.current?.getBoundingClientRect();
                      const iRect = e.currentTarget?.getBoundingClientRect();
                      if (mRect && iRect) setSettingsSubmenuTop(Math.max(0, iRect.top - mRect.top));
                    } catch {}
                  }
                }}
                style={isMobile ? { flex: 1, justifyContent: 'center', opacity: isPlayerInGame ? 0.5 : 1, cursor: isPlayerInGame ? 'not-allowed' : 'pointer' } : (isPlayerInGame ? { opacity: 0.5, cursor: 'not-allowed' } : undefined)}
              >
                <span>Map Settings</span>
                {!isMobile && (<FontAwesomeIcon icon={faChevronRight} style={{ opacity: 0.85, fontSize: 10 }} />)}
              </button>
              <button className={`slim-dropdown__item ${settingsPrimaryOpen === 'game' ? 'active' : ''}`} onClick={(e) => {
                if (settingsPrimaryOpen === 'game') setSettingsPrimaryOpen(null); else setSettingsPrimaryOpen('game');
                if (!isMobile) {
                  try {
                    const mRect = settingsMenuRef.current?.getBoundingClientRect();
                    const iRect = e.currentTarget?.getBoundingClientRect();
                    if (mRect && iRect) setSettingsSubmenuTop(Math.max(0, iRect.top - mRect.top));
                  } catch {}
                }
              }} style={isMobile ? { flex: 1, justifyContent: 'center' } : undefined}>
                <span>Game Settings</span>
                {!isMobile && (<FontAwesomeIcon icon={faChevronRight} style={{ opacity: 0.85, fontSize: 10 }} />)}
              </button>

              {settingsPrimaryOpen === 'map' && (
                <div
                  className="slim-dropdown__submenu"
                  style={isMobile ? { top: 'auto', position: 'fixed', left: 0, right: 0, bottom: `calc(${barHeight}px + env(safe-area-inset-bottom, 0px) + var(--mobile-footer-height, 0px) + ${settingsMenuHeight}px)`, borderRadius: 0 } : { left: '100%', top: settingsSubmenuTop }}
                >
                  <button className="slim-dropdown__item" onClick={() => { if (!isDrawingCover) clearMap && clearMap(); setSettingsMenuOpen(false); }}>
                    <FontAwesomeIcon icon={faTrashCan} style={{ marginRight: 8 }} />
                    <span>Clear Map</span>
                  </button>
                  <button className="slim-dropdown__item" onClick={() => { if (!isDrawingCover) onSaveMap && onSaveMap(); setSettingsMenuOpen(false); }}>
                    <FontAwesomeIcon icon={faUpload} style={{ marginRight: 8 }} />
                    <span>Save Map</span>
                  </button>
                  <button className="slim-dropdown__item" onClick={() => { if (!isDrawingCover) onLoadMap && onLoadMap(); setSettingsMenuOpen(false); }}>
                    <FontAwesomeIcon icon={faDownload} style={{ marginRight: 8 }} />
                    <span>Load Map</span>
                  </button>
                  <button className="slim-dropdown__item" onClick={() => { if (!isDrawingCover) onSaveLibrary && onSaveLibrary(); setSettingsMenuOpen(false); }}>
                    <FontAwesomeIcon icon={faUpload} style={{ marginRight: 8 }} />
                    <span>Save to Library</span>
                  </button>
                  <button className="slim-dropdown__item" onClick={() => { if (!isDrawingCover) onLoadLibrary && onLoadLibrary(); setSettingsMenuOpen(false); }}>
                    <FontAwesomeIcon icon={faDownload} style={{ marginRight: 8 }} />
                    <span>Load from Library</span>
                  </button>
                </div>
              )}

              {settingsPrimaryOpen === 'game' && (
                <div
                  className="slim-dropdown__submenu"
                  style={isMobile ? { top: 'auto', position: 'fixed', left: 0, right: 0, bottom: `calc(${barHeight}px + env(safe-area-inset-bottom, 0px) + var(--mobile-footer-height, 0px) + ${settingsMenuHeight}px)`, borderRadius: 0 } : { left: '100%', top: settingsSubmenuTop }}
                >
                  {(undo && (isHost || !hasGame)) && (
                    <button className="slim-dropdown__item" onClick={() => { if (isDrawingCover) return; undo && undo(); setSettingsMenuOpen(false); }} disabled={!!isDrawingCover}>
                      <FontAwesomeIcon icon={faRotateLeft} style={{ marginRight: 8 }} />
                      <span>Undo</span>
                    </button>
                  )}
                  {onJoinGame && (
                    <button className="slim-dropdown__item" onClick={() => { onJoinGame(); setSettingsMenuOpen(false); }}>
                      <FontAwesomeIcon icon={faRightToBracket} style={{ marginRight: 8 }} />
                      <span>Join Game</span>
                    </button>
                  )}
                  {onHostGame && (
                    <button className="slim-dropdown__item" onClick={() => { onHostGame(); setSettingsMenuOpen(false); }}>
                      <FontAwesomeIcon icon={faUserPlus} style={{ marginRight: 8 }} />
                      <span>Host Game</span>
                    </button>
                  )}
                  {onLeaveGame && (
                    <button className="slim-dropdown__item" onClick={() => { onLeaveGame(); setSettingsMenuOpen(false); }} style={{ color: '#f44336' }}>
                      <FontAwesomeIcon icon={faRightFromBracket} style={{ marginRight: 8 }} />
                      <span>Leave Game</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

  {/* Spacer to align moved items to the right side (desktop only) */}
  {!isMobile && <div style={{ flex: 1 }} />}
      {/* Moved from burger/main toolbar: Global Modifiers and Grid size */}
      {isHost && hasGame && !isMobile && (
        <>
          <div className="toolbar-divider-vert" aria-hidden="true" />
          <button
            className="turn-box turn-box--small"
            onClick={isDrawingCover ? undefined : onPushToPlayers}
            disabled={!!isDrawingCover}
            title="Push current draft to all players"
            style={{ cursor: isDrawingCover ? 'not-allowed' : 'pointer' }}
          >
            Push to Players
          </button>
          <div className="toolbar-divider-vert" aria-hidden="true" />
          <button
            className={`turn-box turn-box--small ${currentChannel === 'draft' ? 'turn-box--status-draft' : 'turn-box--status-live'}`}
            onClick={isDrawingCover ? undefined : onToggleChannel}
            disabled={!!isDrawingCover}
            title="Toggle edit/view channel"
            style={{ cursor: isDrawingCover ? 'not-allowed' : 'pointer' }}
          >
            {currentChannel === 'draft' ? 'Editing Draft' : 'Viewing Live'}
          </button>
        </>
      )}
      {!isMobile && (
        <>
          <div className="toolbar-divider-vert" aria-hidden="true" />
          {(isHost || !hasGame) && (
            <button
              className="turn-box turn-box--small turn-box--danger"
              onClick={isDrawingCover ? undefined : openGlobalModifiers}
              disabled={!!isDrawingCover}
              title="Global Modifiers"
              style={{ cursor: isDrawingCover ? 'not-allowed' : 'pointer' }}
            >
              Global Modifiers
            </button>
          )}
          <div className="toolbar-divider-vert" aria-hidden="true" />
          <span className="grid-info">Grid: {gridSize}ft per cell</span>
        </>
      )}

      {/* Mobile-only host controls below tools, separated by a divider */}
      {isMobile && (
        (() => {
          const showHostRow = isHost && hasGame;
          const showModifiersOnly = !hasGame; // not in a game
          const hasSecondRow = showHostRow || showModifiersOnly;
          if (!hasSecondRow) return null;
          return (
            <>
              <div style={{ flexBasis: '100%' }} />
              <div style={{ width: '100%', height: 1, background: 'rgba(255,255,255,0.2)', margin: '6px 0' }} aria-hidden="true" />
              <div style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, justifyContent: showModifiersOnly ? 'center' : 'center' }}>
                {/* Global Modifiers always first when shown on mobile second row */}
                {(isHost || !hasGame) && (
                  <button
                    className="turn-box turn-box--small turn-box--danger"
                    onClick={isDrawingCover ? undefined : openGlobalModifiers}
                    disabled={!!isDrawingCover}
                    title="Global Modifiers"
                    style={{ cursor: isDrawingCover ? 'not-allowed' : 'pointer' }}
                  >
                    Global Modifiers
                  </button>
                )}
                {showHostRow && (
                  <>
                    <button
                      className="turn-box turn-box--small"
                      onClick={isDrawingCover ? undefined : onPushToPlayers}
                      disabled={!!isDrawingCover}
                      title="Push current draft to all players"
                      style={{ cursor: isDrawingCover ? 'not-allowed' : 'pointer' }}
                    >
                      Push to Players
                    </button>
                    <button
                      className={`turn-box turn-box--small ${currentChannel === 'draft' ? 'turn-box--status-draft' : 'turn-box--status-live'}`}
                      onClick={isDrawingCover ? undefined : onToggleChannel}
                      disabled={!!isDrawingCover}
                      title="Toggle edit/view channel"
                      style={{ cursor: isDrawingCover ? 'not-allowed' : 'pointer' }}
                    >
                      {currentChannel === 'draft' ? 'Editing Draft' : 'Viewing Live'}
                    </button>
                  </>
                )}
              </div>
            </>
          );
        })()
      )}
    </Box>
  );
}
