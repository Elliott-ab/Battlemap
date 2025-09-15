import { state } from './state.js';
import { renderGrid, updateGridInfo } from './grid.js';
import { renderElementsList } from './elements.js';
import { pushUndo } from './undo.js';

export function downloadMap(fileName) {
  try {
    const data = {
      grid: state.grid,
      elements: state.elements
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Error downloading map:', error);
  }
}

export function uploadMap(file) {
  try {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        if (data.grid && data.elements) {
          state.grid = data.grid;
          state.elements = data.elements;
          renderGrid();
          updateGridInfo();
          renderElementsList();
          pushUndo();
        } else {
          console.error('Invalid map file format');
        }
      } catch (error) {
        console.error('Error parsing uploaded map:', error);
      }
    };
    reader.onerror = () => console.error('Error reading file');
    reader.readAsText(file);
  } catch (error) {
    console.error('Error uploading map:', error);
  }
}