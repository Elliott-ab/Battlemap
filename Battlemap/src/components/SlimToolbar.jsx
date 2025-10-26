import React, { useRef, useState } from 'react';
import { Box, IconButton, Tooltip } from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faRulerCombined, faArrowPointer, faArrowsUpDownLeftRight, faChevronRight } from '@fortawesome/free-solid-svg-icons';
import { faPenToSquare as faPenToSquareRegular } from '@fortawesome/free-regular-svg-icons';
import { useTool, ToolIds } from '../context/ToolContext.jsx';

export default function SlimToolbar({
  isHost = false,
  isDrawingCover = false,
  toggleDrawingMode,
  drawEnvType,
  setDrawEnvType,
  drawCreatureMode = null,
  setDrawCreatureMode,
  finalizeCreatureDrawing,
}) {
  const { tool, setTool } = useTool();
  const [drawMenuOpen, setDrawMenuOpen] = useState(false);
  const [primaryOpen, setPrimaryOpen] = useState(null); // 'environment' | 'terrain' | 'creatures' | null
  const [submenuTop, setSubmenuTop] = useState(0);
  const drawBtnRef = useRef(null);
  const menuRef = useRef(null);
  const wrapRef = useRef(null);

  const btnSx = (active) => ({
    color: active ? '#4CAF50' : '#fff',
    border: active ? '1px solid rgba(76,175,80,0.7)' : '1px solid rgba(255,255,255,0.15)',
    backgroundColor: active ? 'rgba(76,175,80,0.15)' : 'transparent',
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
      }}
      role="toolbar"
      aria-label="Tools"
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
      <Tooltip title="Ruler (measure)" placement="bottom">
        <IconButton aria-label="Ruler tool" size="small" sx={btnSx(tool === ToolIds.RULER)} onClick={() => selectTool(ToolIds.RULER)}>
          <FontAwesomeIcon icon={faRulerCombined} />
        </IconButton>
      </Tooltip>
      {isHost && (
        <div className="slim-toolbar__draw" ref={wrapRef} style={{ position: 'relative', display: 'inline-flex' }}>
          <Tooltip title={isDrawingCover ? 'Drawing mode (click to toggle menu)' : 'Enter drawing mode'} placement="bottom">
            <IconButton
              ref={drawBtnRef}
              aria-label="Draw environments/terrain"
              size="small"
              sx={{ ...btnSx((tool === ToolIds.DRAW) || isDrawingCover || !!drawCreatureMode), position: 'relative' }}
              onClick={onClickDraw}
            >
              {/* Main icon */}
              <FontAwesomeIcon icon={faPenToSquareRegular} />
            </IconButton>
          </Tooltip>
          {drawMenuOpen && (
            <div className="slim-dropdown" style={{ position: 'absolute', top: '100%', left: '50%', transform: 'translateX(-50%)', marginTop: 6, zIndex: 210 }}>
              <div className="slim-dropdown__menu" ref={menuRef}>
                <button className={`slim-dropdown__item ${primaryOpen === 'environment' ? 'active' : ''}`} onClick={(e) => selectPrimary('environment', e)}>
                  <span>Cover</span>
                  <FontAwesomeIcon icon={faChevronRight} style={{ opacity: 0.85, fontSize: 10 }} />
                </button>
                <button className={`slim-dropdown__item ${primaryOpen === 'terrain' ? 'active' : ''}`} onClick={(e) => selectPrimary('terrain', e)}>
                  <span>Terrain</span>
                  <FontAwesomeIcon icon={faChevronRight} style={{ opacity: 0.85, fontSize: 10 }} />
                </button>
                <button className={`slim-dropdown__item ${primaryOpen === 'creatures' ? 'active' : ''}`} onClick={(e) => selectPrimary('creatures', e)}>
                  <span>Creatures</span>
                  <FontAwesomeIcon icon={faChevronRight} style={{ opacity: 0.85, fontSize: 10 }} />
                </button>
                {primaryOpen === 'environment' && (
                  <div className="slim-dropdown__submenu" style={{ left: '100%', top: submenuTop }}>
                    <button className={`slim-dropdown__item ${drawEnvType === 'half' ? 'selected' : ''}`} onClick={() => selectEnvType('half')}>Half Cover</button>
                    <button className={`slim-dropdown__item ${drawEnvType === 'three-quarters' ? 'selected' : ''}`} onClick={() => selectEnvType('three-quarters')}>Three-Quarters</button>
                    <button className={`slim-dropdown__item ${drawEnvType === 'full' ? 'selected' : ''}`} onClick={() => selectEnvType('full')}>Full Cover</button>
                  </div>
                )}
                {primaryOpen === 'terrain' && (
                  <div className="slim-dropdown__submenu" style={{ left: '100%', top: submenuTop }}>
                    <button className={`slim-dropdown__item ${drawEnvType === 'difficult' ? 'selected' : ''}`} onClick={() => selectEnvType('difficult')}>Difficult Terrain</button>
                  </div>
                )}
                {primaryOpen === 'creatures' && (
                  <div className="slim-dropdown__submenu" style={{ left: '100%', top: submenuTop }}>
                    <button className={`slim-dropdown__item ${drawCreatureMode === 'player-generic' ? 'selected' : ''}`} onClick={() => selectCreatureMode('player-generic')}>Player (Generic)</button>
                    <button className={`slim-dropdown__item ${drawCreatureMode === 'enemy-generic' ? 'selected' : ''}`} onClick={() => selectCreatureMode('enemy-generic')}>Enemy (Generic)</button>
                    <button className={`slim-dropdown__item ${drawCreatureMode === 'enemy-bestiary' ? 'selected' : ''}`} onClick={() => selectCreatureMode('enemy-bestiary')}>Enemy (Bestiary)</button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </Box>
  );
}
