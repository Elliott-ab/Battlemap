// Utilities to clear various highlight overlays and selection state across the app

export const clearMovementHighlights = () => {
  try {
    document.querySelectorAll('.movement-highlight').forEach((h) => h.remove());
  } catch {}
};

export const clearCoverHighlights = () => {
  try {
    document.querySelectorAll('.cover-highlight').forEach((h) => h.remove());
  } catch {}
};

export const clearHighlightedIdDataset = (battleMapRefOrEl) => {
  try {
    const el = battleMapRefOrEl?.current || battleMapRefOrEl;
    if (el && el.dataset) delete el.dataset.highlightedId;
  } catch {}
};

export const clearMovementAndSelection = (battleMapRef, setState) => {
  clearMovementHighlights();
  clearHighlightedIdDataset(battleMapRef);
  try {
    if (typeof setState === 'function') {
      setState((prev) => ({ ...prev, highlightedElementId: null }));
    }
  } catch {}
};

export const clearAllHighlights = (battleMapRef, setState) => {
  clearMovementHighlights();
  clearCoverHighlights();
  clearHighlightedIdDataset(battleMapRef);
  try {
    if (typeof setState === 'function') {
      setState((prev) => ({ ...prev, highlightedElementId: null }));
    }
  } catch {}
};
