export const useGrid = (state) => {
  const renderGrid = (battleMapRef) => {
    console.log('renderGrid called with battleMapRef:', battleMapRef, 'battleMapRef.current:', battleMapRef?.current);
    const battleMap = battleMapRef.current;
    if (!battleMap) {
      console.warn('Battle map element not found, skipping render');
      return;
    }

    console.log('Rendering grid:', state.grid.width, state.grid.height);
    battleMap.style.setProperty('--grid-width', state.grid.width);
    battleMap.style.setProperty('--grid-height', state.grid.height);
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
        console.log(`Created cell at x=${x}, y=${y}`);
      }
    }

    state.elements.forEach((el) => {
      const elDiv = document.createElement('div');
      elDiv.classList.add('element', el.type);
      if (el.type === 'cover') {
        elDiv.classList.add('custom-cover', el.coverType);
      } else {
        elDiv.style.backgroundColor = el.color;
      }
      elDiv.innerText = el.name[0].toUpperCase();
      elDiv.dataset.id = el.id;
      elDiv.style.gridRow = `${el.position.y + 1} / span ${el.size}`;
      elDiv.style.gridColumn = `${el.position.x + 1} / span ${el.size}`;
      battleMap.appendChild(elDiv);
    });
  };

  const updateGridInfo = () => {
    const gridInfo = document.querySelector('.grid-info');
    if (gridInfo) {
      gridInfo.textContent = `Grid: ${state.grid.cellSize}ft per cell`;
    }
  };

  return { renderGrid, updateGridInfo };
};