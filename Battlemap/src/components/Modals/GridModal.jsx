import React, { useState, useEffect, useRef } from 'react';
import ModalShell from '../ui/modal/ModalShell.jsx';

const GridModal = ({ isOpen, state, setState, pushUndo, onClose }) => {
  const [formData, setFormData] = useState({
    gridWidth: state.grid.width,
    gridHeight: state.grid.height,
    cellSize: state.grid.cellSize,
    imageOpacity: 1,
    gridOpacity: 0.22,
    hasBg: false,
  });
  const fileInputRef = useRef(null);
  const lastBlobUrlRef = useRef(null);

  useEffect(() => {
    setFormData({
      gridWidth: state.grid.width,
      gridHeight: state.grid.height,
      cellSize: state.grid.cellSize,
      // hydrate local bg config for display controls
      ...((() => {
        try {
          const raw = sessionStorage.getItem('bm-local-bg');
          if (!raw) return { imageOpacity: 1, gridOpacity: 0.22, hasBg: false };
          const cfg = JSON.parse(raw);
          return {
            imageOpacity: Number.isFinite(cfg.imageOpacity) ? cfg.imageOpacity : 1,
            gridOpacity: Number.isFinite(cfg.gridOpacity) ? cfg.gridOpacity : 0.22,
            hasBg: !!cfg.url,
          };
        } catch { return { imageOpacity: 1, gridOpacity: 0.22, hasBg: false }; }
      })()),
    });
  }, [state.grid]);

  const handleSubmit = (e) => {
    e.preventDefault();
    setState(prev => ({
      ...prev,
      grid: {
        width: parseInt(formData.gridWidth),
        height: parseInt(formData.gridHeight),
        cellSize: parseInt(formData.cellSize),
      },
    }));
    pushUndo();
    onClose();
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  // Local-only background helpers
  const applyLocalBgConfig = (partial) => {
    try {
      const raw = sessionStorage.getItem('bm-local-bg');
      const prev = raw ? JSON.parse(raw) : {};
      const next = { ...prev, ...partial };
      sessionStorage.setItem('bm-local-bg', JSON.stringify(next));
      window.dispatchEvent(new Event('bm-local-bg-updated'));
    } catch {}
  };
  const onPickImage = () => { try { fileInputRef.current?.click?.(); } catch {} };
  const onFileChange = (e) => {
    const file = e?.target?.files?.[0];
    if (!file) return;
    // revoke previous bloburl if any
    if (lastBlobUrlRef.current) {
      try { URL.revokeObjectURL(lastBlobUrlRef.current); } catch {}
      lastBlobUrlRef.current = null;
    }
    const url = URL.createObjectURL(file);
    lastBlobUrlRef.current = url;
    // auto-size grid to image
    const img = new Image();
    img.onload = () => {
      try {
        const root = document.documentElement;
        const cs = getComputedStyle(root).getPropertyValue('--cell-px') || '40px';
        const cellPx = parseFloat(cs);
        const newW = Math.max(1, Math.round(img.naturalWidth / (cellPx || 40)));
        const newH = Math.max(1, Math.round(img.naturalHeight / (cellPx || 40)));
        setState(prev => ({ ...prev, grid: { ...prev.grid, width: newW, height: newH } }));
      } catch {}
      applyLocalBgConfig({ url });
      setFormData(prev => ({ ...prev, hasBg: true }));
    };
    img.onerror = () => {
      try { URL.revokeObjectURL(url); } catch {}
    };
    img.src = url;
  };
  const onClearImage = () => {
    if (lastBlobUrlRef.current) {
      try { URL.revokeObjectURL(lastBlobUrlRef.current); } catch {}
      lastBlobUrlRef.current = null;
    }
    applyLocalBgConfig({ url: null });
    setFormData(prev => ({ ...prev, hasBg: false }));
    try { if (fileInputRef.current) fileInputRef.current.value = ''; } catch {}
  };
  const onImageOpacity = (e) => {
    const v = Math.max(0, Math.min(100, parseInt(e.target.value || '0', 10)));
    setFormData(prev => ({ ...prev, imageOpacity: v / 100 }));
    applyLocalBgConfig({ imageOpacity: v / 100 });
  };
  const onGridOpacity = (e) => {
    const v = Math.max(0, Math.min(100, parseInt(e.target.value || '0', 10)));
    setFormData(prev => ({ ...prev, gridOpacity: v / 100 }));
    applyLocalBgConfig({ gridOpacity: v / 100 });
  };

  if (!isOpen) return null;
  return (
    <ModalShell open={isOpen} title="Grid Settings" onClose={onClose}>
      <form id="gridForm" onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="gridWidth">Grid Width:</label>
          <input type="number" id="gridWidth" name="gridWidth" value={formData.gridWidth} onChange={handleChange} />
        </div>
        <div className="form-group">
          <label htmlFor="gridHeight">Grid Height:</label>
          <input type="number" id="gridHeight" name="gridHeight" value={formData.gridHeight} onChange={handleChange} />
        </div>
        <div className="form-group">
          <label htmlFor="cellSize">Cell Size (feet):</label>
          <select id="cellSize" name="cellSize" value={formData.cellSize} onChange={handleChange}>
            <option value="5">5 feet</option>
            <option value="10">10 feet</option>
          </select>
        </div>
        <hr className="sidebar-divider" />
        <h4 style={{ marginTop: '0.5rem' }}>Background (local test)</h4>
        <div className="form-group">
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <button type="button" className="btn" onClick={onPickImage}>{formData.hasBg ? 'Replace Image' : 'Choose Image'}</button>
            {formData.hasBg && (
              <button type="button" className="btn btn-secondary" onClick={onClearImage}>Clear</button>
            )}
            <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={onFileChange} />
          </div>
        </div>
        <div className="form-group">
          <label htmlFor="imageOpacity">Image Opacity: {Math.round((formData.imageOpacity || 0) * 100)}%</label>
          <input id="imageOpacity" type="range" min={0} max={100} step={1} value={Math.round((formData.imageOpacity || 0) * 100)} onChange={onImageOpacity} />
        </div>
        <div className="form-group">
          <label htmlFor="gridOpacity">Grid Lines Opacity: {Math.round((formData.gridOpacity || 0) * 100)}%</label>
          <input id="gridOpacity" type="range" min={0} max={100} step={1} value={Math.round((formData.gridOpacity || 0) * 100)} onChange={onGridOpacity} />
        </div>
        <div className="form-actions">
          <button type="submit" className="btn btn-primary">Apply Settings</button>
        </div>
      </form>
    </ModalShell>
  );
};

export default GridModal;