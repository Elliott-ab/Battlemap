import React, { useRef, useState } from 'react';
import { Box, IconButton, Tooltip } from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faRulerCombined, faArrowPointer, faArrowsUpDownLeftRight, faChevronDown, faChevronRight } from '@fortawesome/free-solid-svg-icons';
import { faPenToSquare as faPenToSquareRegular } from '@fortawesome/free-regular-svg-icons';
import { useTool, ToolIds } from '../context/ToolContext.jsx';

export default function SlimToolbar({
  isHost = false,
  isDrawingCover = false,
  toggleDrawingMode,
  drawEnvType,
  setDrawEnvType,
}) {
  const { tool, setTool } = useTool();
  const [drawMenuOpen, setDrawMenuOpen] = useState(false);
  const [primaryOpen, setPrimaryOpen] = useState(null); // 'environment' | 'terrain' | 'enemies' | null
  const [submenuTop, setSubmenuTop] = useState(0);
  const drawBtnRef = useRef(null);
  const menuRef = useRef(null);

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
    // If not currently drawing, enter drawing mode and open the menu
    if (!isDrawingCover) {
      if (typeof toggleDrawingMode === 'function') toggleDrawingMode();
      setDrawMenuOpen(true);
      setPrimaryOpen(null);
      return;
    }
    // Already drawing: clicking toggles just the menu visibility (keep mode active)
    setDrawMenuOpen((v) => !v);
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
    // Ensure we're in drawing mode
    if (!isDrawingCover && typeof toggleDrawingMode === 'function') toggleDrawingMode();
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
        <IconButton aria-label="Pointer tool" size="small" sx={btnSx(tool === ToolIds.POINTER)} onClick={() => setTool(ToolIds.POINTER)}>
          <FontAwesomeIcon icon={faArrowPointer} />
        </IconButton>
      </Tooltip>
      <Tooltip title="Move (highlight movement)" placement="bottom">
        <IconButton aria-label="Move tool" size="small" sx={btnSx(tool === ToolIds.MOVE)} onClick={() => setTool(ToolIds.MOVE)}>
          <FontAwesomeIcon icon={faArrowsUpDownLeftRight} />
        </IconButton>
      </Tooltip>
      <Tooltip title="Ruler (measure)" placement="bottom">
        <IconButton aria-label="Ruler tool" size="small" sx={btnSx(tool === ToolIds.RULER)} onClick={() => setTool(ToolIds.RULER)}>
          <FontAwesomeIcon icon={faRulerCombined} />
        </IconButton>
      </Tooltip>
      {isHost && (
        <div className="slim-toolbar__draw" style={{ position: 'relative', display: 'inline-flex' }}>
          <Tooltip title={isDrawingCover ? 'Drawing mode (click to toggle menu)' : 'Enter drawing mode'} placement="bottom">
            <IconButton
              ref={drawBtnRef}
              aria-label="Draw environments/terrain"
              size="small"
              sx={{ ...btnSx(isDrawingCover), position: 'relative' }}
              onClick={onClickDraw}
            >
              {/* Main icon */}
              <FontAwesomeIcon icon={faPenToSquareRegular} />
              {/* Dropdown indicator chevron anchored to the bottom of the button */}
              <FontAwesomeIcon
                icon={faChevronDown}
                style={{ position: 'absolute', bottom: 2, left: '50%', transform: 'translateX(-50%)', fontSize: 10, opacity: 0.9, pointerEvents: 'none' }}
              />
            </IconButton>
          </Tooltip>
          {drawMenuOpen && (
            <div className="slim-dropdown" style={{ position: 'absolute', top: '100%', left: '50%', transform: 'translateX(-50%)', marginTop: 6, zIndex: 210 }}>
              <div className="slim-dropdown__menu" ref={menuRef}>
                <button className={`slim-dropdown__item ${primaryOpen === 'environment' ? 'active' : ''}`} onClick={(e) => selectPrimary('environment', e)}>
                  <span>Environment</span>
                  <FontAwesomeIcon icon={faChevronRight} style={{ opacity: 0.85, fontSize: 10 }} />
                </button>
                <button className={`slim-dropdown__item ${primaryOpen === 'terrain' ? 'active' : ''}`} onClick={(e) => selectPrimary('terrain', e)}>
                  <span>Terrain</span>
                  <FontAwesomeIcon icon={faChevronRight} style={{ opacity: 0.85, fontSize: 10 }} />
                </button>
                <button className={`slim-dropdown__item ${primaryOpen === 'enemies' ? 'active' : ''}`} onClick={(e) => selectPrimary('enemies', e)}>
                  <span>Enemies</span>
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
                {primaryOpen === 'enemies' && (
                  <div className="slim-dropdown__submenu" style={{ left: '100%', top: submenuTop }}>
                    <div className="slim-dropdown__hint">Enemy brush coming soon</div>
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
