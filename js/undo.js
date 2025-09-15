import { state } from './state.js';
import { renderGrid, updateGridInfo } from './grid.js';
import { renderElementsList } from './elements.js';

const undoStack = [];

export function pushUndo() {
  try {
    const currentState = {
      grid: { ...state.grid },
      elements: state.elements.map((el) => ({ ...el, position: { ...el.position } }))
    };
    undoStack.push(JSON.stringify(currentState));
    if (undoStack.length > 20) {
      undoStack.shift();
    }
  } catch (error) {
    console.error('Error pushing to undo stack:', error);
  }
}

export function undo() {
  try {
    if (undoStack.length > 0) {
      const prevState = JSON.parse(undoStack.pop());
      state.grid = prevState.grid;
      state.elements = prevState.elements;
      renderGrid();
      updateGridInfo();
      renderElementsList();
    } else {
      console.warn('No states in undo stack');
    }
  } catch (error) {
    console.error('Error performing undo:', error);
  }
}