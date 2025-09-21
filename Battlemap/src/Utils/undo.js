export const useUndo = (state, setState, setUndoStack) => {
  const pushUndo = () => {
    setUndoStack(prev => [...prev, JSON.stringify(state)]);
  };

  const undo = () => {
    setUndoStack(prev => {
      if (prev.length === 0) return prev;
      const lastState = prev[prev.length - 1];
      setState(JSON.parse(lastState));
      return prev.slice(0, -1);
    });
  };

  return { pushUndo, undo };
};