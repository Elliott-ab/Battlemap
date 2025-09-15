import { state } from './state.js';

export function renderGrid() {
  const battleMap = document.querySelector('.battle-map');
  if (!battleMap) {
    console.error('Battle map element not found');
    return;
  }

  battleMap.style.gridTemplateColumns = `repeat(${state.grid.width}, 40px)`;
  battleMap.style.gridTemplateRows = `repeat(${state.grid.height}, 40px)`;
  battleMap.innerHTML = '';

  for (let y = 0; y < state.grid.height; y++) {
    for (let x = 0; x < state.grid.width; x++) {
      const cell = document.createElement('div');
      cell.classList.add('grid-cell');
      cell.dataset.x = x;
      cell.dataset.y = y;
      cell.style.gridRow = `${y + 1}`;
      cell.style.gridColumn = `${x + 1}`;
      battleMap.appendChild(cell);
    }
  }

  state.elements.forEach((el) => {
    const elDiv = document.createElement('div');
    elDiv.classList.add('element', el.type);
    if (el.type === 'cover') {
      elDiv.classList.add(el.coverType);
    } else {
      elDiv.style.backgroundColor = el.color;
    }
    elDiv.innerText = el.name[0].toUpperCase();
    elDiv.dataset.id = el.id;
    elDiv.style.gridRow = `${el.position.y + 1} / span ${el.size}`;
    elDiv.style.gridColumn = `${el.position.x + 1} / span ${el.size}`;
    battleMap.appendChild(elDiv);
  });
}

export function updateGridInfo() {
  const gridInfo = document.querySelector('.grid-info');
  if (gridInfo) {
    gridInfo.textContent = `Grid: ${state.grid.cellSize}ft per cell`;
  } else {
    console.error('Grid info element not found');
  }
}