import { state } from './state.js';
import { renderGrid, updateGridInfo } from './grid.js';
import { addElement, renderElementsList, getElementById, updateElementPosition, toggleMovementHighlight, createCoverFromBlocks, highlightCoverGroup } from './elements.js';
import { showGridModal, showSaveModal, showOverwriteModal, showEditModal } from './modals.js';
import { undo, pushUndo } from './undo.js';

let currentDragElement = null;
let isDrawingCover = false;
let coverBlocks = [];
let selectedCoverType = 'half'; // Default cover type

function getCellFromPoint(clientX, clientY) {
  let el = document.elementFromPoint(clientX, clientY);
  if (el && el.classList.contains('element')) {
    el.style.pointerEvents = 'none';
    const cell = document.elementFromPoint(clientX, clientY);
    el.style.pointerEvents = 'auto';
    return cell ? cell.closest('.grid-cell') : null;
  }
  return el ? el.closest('.grid-cell') : null;
}

function toggleDrawingMode() {
  const drawCoverBtn = document.getElementById('drawCoverBtn');
  const buttons = [
    'addPlayerBtn',
    'addEnemyBtn',
    'gridSettingsBtn',
    'clearMapBtn',
    'undoBtn',
    'downloadBtn',
    'uploadBtn'
  ];

  if (!isDrawingCover) {
    isDrawingCover = true;
    coverBlocks = [];
    drawCoverBtn.textContent = 'Finish Drawing';
    drawCoverBtn.classList.remove('btn-cover');
    drawCoverBtn.classList.add('btn-primary');
    buttons.forEach((id) => {
      const btn = document.getElementById(id);
      if (btn) btn.disabled = true;
    });
  } else {
    isDrawingCover = false;
    drawCoverBtn.textContent = 'Draw Cover';
    drawCoverBtn.classList.remove('btn-primary');
    drawCoverBtn.classList.add('btn-cover');
    buttons.forEach((id) => {
      const btn = document.getElementById(id);
      if (btn) btn.disabled = false;
    });
    document.querySelectorAll('.drawing-cover-highlight').forEach((highlight) => highlight.remove());
    createCoverFromBlocks(coverBlocks, selectedCoverType);
    coverBlocks = [];
  }
}

function initialize() {
  const battleMap = document.querySelector('.battle-map');
  if (!battleMap) {
    console.error('Battle map element not found');
    return;
  }

  renderGrid();
  updateGridInfo();
  renderElementsList();
  pushUndo();

  const addPlayerBtn = document.getElementById('addPlayerBtn');
  const addEnemyBtn = document.getElementById('addEnemyBtn');
  const drawCoverBtn = document.getElementById('drawCoverBtn');
  const gridSettingsBtn = document.getElementById('gridSettingsBtn');
  const clearMapBtn = document.getElementById('clearMapBtn');
  const undoBtn = document.getElementById('undoBtn');
  const downloadBtn = document.getElementById('downloadBtn');
  const uploadBtn = document.getElementById('uploadBtn');

  if (addPlayerBtn) addPlayerBtn.addEventListener('click', () => addElement('player'));
  else console.error('Add Player button not found');
  if (addEnemyBtn) addEnemyBtn.addEventListener('click', () => addElement('enemy'));
  else console.error('Add Enemy button not found');
  if (drawCoverBtn) drawCoverBtn.addEventListener('click', toggleDrawingMode);
  else console.error('Draw Cover button not found');
  if (gridSettingsBtn) gridSettingsBtn.addEventListener('click', showGridModal);
  else console.error('Grid Settings button not found');
  if (clearMapBtn) clearMapBtn.addEventListener('click', () => {
    state.elements = [];
    renderGrid();
    renderElementsList();
    pushUndo();
  });
  else console.error('Clear Map button not found');
  if (undoBtn) undoBtn.addEventListener('click', undo);
  else console.error('Undo button not found');
  if (downloadBtn) downloadBtn.addEventListener('click', showSaveModal);
  else console.error('Download button not found');
  if (uploadBtn) uploadBtn.addEventListener('click', showOverwriteModal);
  else console.error('Upload button not found');

  const elementList = document.querySelector('.element-list');
  if (elementList) {
    elementList.addEventListener('click', (e) => {
      const item = e.target.closest('.element-item');
      if (item) {
        const id = parseInt(item.dataset.id);
        if (id) {
          const el = getElementById(id);
          if (el.type === 'cover' && el.groupId) {
            highlightCoverGroup(el.groupId);
          } else {
            toggleMovementHighlight(id);
          }
        } else {
          console.error('Element item clicked without valid ID');
        }
      }
    });
    elementList.addEventListener('dblclick', (e) => {
      const item = e.target.closest('.element-item');
      if (item) {
        const id = parseInt(item.dataset.id);
        if (id) {
          showEditModal(id);
        } else {
          console.error('Element item double-clicked without valid ID');
        }
      }
    });
  } else {
    console.error('Element list not found');
  }

  battleMap.addEventListener('click', (e) => {
    if (isDrawingCover) {
      const cell = e.target.closest('.grid-cell');
      if (cell) {
        const x = parseInt(cell.dataset.x);
        const y = parseInt(cell.dataset.y);
        const existingHighlight = cell.querySelector('.drawing-cover-highlight');
        if (existingHighlight) {
          existingHighlight.remove();
          coverBlocks = coverBlocks.filter(block => block.x !== x || block.y !== y);
        } else {
          const highlight = document.createElement('div');
          highlight.classList.add('drawing-cover-highlight');
          cell.appendChild(highlight);
          coverBlocks.push({ x, y });
        }
      }
    }
  });

  battleMap.addEventListener('pointerdown', (e) => {
    if (isDrawingCover) return;
    const elDiv = e.target.closest('.element');
    if (elDiv) {
      currentDragElement = elDiv;
      elDiv.classList.add('selected');
      elDiv.style.zIndex = '20';
      const id = parseInt(elDiv.dataset.id);
      const el = getElementById(id);
      if (el.type === 'cover' && el.groupId) {
        highlightCoverGroup(el.groupId); // Highlight group when dragging
      }
    }
  });

  battleMap.addEventListener('pointermove', (e) => {
    if (currentDragElement) {
      const cell = getCellFromPoint(e.clientX, e.clientY);
      if (cell) {
        const x = parseInt(cell.dataset.x);
        const y = parseInt(cell.dataset.y);
        const id = parseInt(currentDragElement.dataset.id);
        updateElementPosition(id, x, y);
      }
    }
  });

  document.addEventListener('pointerup', () => {
    if (currentDragElement) {
      currentDragElement.classList.remove('selected');
      currentDragElement.style.zIndex = '10';
      currentDragElement = null;
      document.querySelectorAll('.cover-highlight').forEach((highlight) => highlight.remove());
      pushUndo();
    }
  });
}

document.addEventListener('DOMContentLoaded', () => {
  try {
    initialize();
  } catch (error) {
    console.error('Error initializing application:', error);
  }
});