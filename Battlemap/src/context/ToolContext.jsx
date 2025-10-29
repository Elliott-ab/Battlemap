import React, { createContext, useContext, useMemo, useState, useEffect } from 'react';

// Tool ids: keep simple for now; extendable later
export const ToolIds = {
  POINTER: 'pointer',
  RULER: 'ruler',
  MOVE: 'move',
  DRAW: 'draw',
};

export const RulerModes = {
  LINE: 'line',
  PATH: 'path',
};

const ToolContext = createContext({
  tool: ToolIds.POINTER,
  setTool: () => {},
  isActive: () => false,
  rulerMode: 'line',
  setRulerMode: () => {},
});

export function ToolProvider({ children }) {
  const [tool, setToolState] = useState(ToolIds.POINTER);
  const [rulerMode, setRulerMode] = useState(RulerModes.LINE);

  const setTool = (id) => {
    setToolState(id);
  };

  // Update a class on <body> for global cursor changes
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const b = document.body;
    const cls = `tool--${tool}`;
    // Remove any previous tool--* classes
    Array.from(b.classList).forEach((c) => { if (c.startsWith('tool--')) b.classList.remove(c); });
    b.classList.add(cls);
    return () => {
      try { b.classList.remove(cls); } catch {}
    };
  }, [tool]);

  const value = useMemo(() => ({
    tool,
    setTool,
    isActive: (id) => tool === id,
    rulerMode,
    setRulerMode,
  }), [tool, rulerMode]);

  return (
    <ToolContext.Provider value={value}>{children}</ToolContext.Provider>
  );
}

export function useTool() {
  return useContext(ToolContext);
}
