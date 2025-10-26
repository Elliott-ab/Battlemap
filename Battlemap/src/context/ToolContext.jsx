import React, { createContext, useContext, useMemo, useState, useEffect } from 'react';

// Tool ids: keep simple for now; extendable later
export const ToolIds = {
  POINTER: 'pointer',
  RULER: 'ruler',
  MOVE: 'move',
  DRAW: 'draw',
};

const ToolContext = createContext({
  tool: ToolIds.POINTER,
  setTool: () => {},
  isActive: () => false,
});

export function ToolProvider({ children }) {
  const [tool, setToolState] = useState(ToolIds.POINTER);

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
  }), [tool]);

  return (
    <ToolContext.Provider value={value}>{children}</ToolContext.Provider>
  );
}

export function useTool() {
  return useContext(ToolContext);
}
