import { state } from './state.js';
import { updateElement, deleteElement, getElementById, renderElementsList } from './elements.js';
import { renderGrid, updateGridInfo } from './grid.js';
import { pushUndo } from './undo.js';
import { downloadMap, uploadMap } from './storage.js';

export function showEditModal(id) {
  const el = getElementById(id);
  if (!el) {
    console.error(`Cannot show edit modal: element with id ${id} not found`);
    return;
  }

  const editModal = document.getElementById('editModal');
  const nameInput = document.getElementById('name');
  const typeSelect = document.getElementById('type');
  const maxHpInput = document.getElementById('maxHp');
  const currentHpInput = document.getElementById('currentHp');
  const movementInput = document.getElementById('movement');
  const damageInput = document.getElementById('damage');
  const colorInput = document.getElementById('color');
  const coverTypeSelect = document.getElementById('coverType');
  const sizeSelect = document.getElementById('size');

  if (!editModal || !nameInput || !typeSelect || !sizeSelect) {
    console.error('Edit modal or form elements not found');
    return;
  }

  nameInput.value = el.name;
  typeSelect.value = el.type;
  maxHpInput.value = el.maxHp || '';
  currentHpInput.value = el.currentHp || '';
  movementInput.value = el.movement || '';
  damageInput.value = el.damage || '';
  colorInput.value = el.color || '#000000';
  coverTypeSelect.value = el.coverType || 'half';
  sizeSelect.value = el.size;

  toggleFormGroups(el.type);

  let hiddenId = document.getElementById('editId');
  if (!hiddenId) {
    hiddenId = document.createElement('input');
    hiddenId.type = 'hidden';
    hiddenId.id = 'editId';
    document.getElementById('editForm').appendChild(hiddenId);
  }
  hiddenId.value = id;

  editModal.style.display = 'block';
}

export function toggleFormGroups(type) {
  const hpGroups = document.querySelectorAll('.hp-group');
  const movementGroup = document.querySelector('.movement-group');
  const damageGroup = document.querySelector('.damage-group');
  const colorGroup = document.querySelector('.color-group');
  const coverGroup = document.querySelector('.cover-group');
  const sizeGroup = document.querySelector('.size-group');

  if (!hpGroups.length || !movementGroup || !damageGroup || !colorGroup || !coverGroup || !sizeGroup) {
    console.error('Form group elements not found');
    return;
  }

  hpGroups.forEach((g) => (g.style.display = type !== 'cover' ? 'block' : 'none'));
  movementGroup.style.display = type !== 'cover' ? 'block' : 'none';
  damageGroup.style.display = type === 'enemy' ? 'block' : 'none';
  colorGroup.style.display = type !== 'cover' ? 'block' : 'none';
  coverGroup.style.display = type === 'cover' ? 'block' : 'none';
  sizeGroup.style.display = 'block';
}

export function showGridModal() {
  const gridModal = document.getElementById('gridModal');
  const gridWidthInput = document.getElementById('gridWidth');
  const gridHeightInput = document.getElementById('gridHeight');
  const cellSizeSelect = document.getElementById('cellSize');

  if (!gridModal || !gridWidthInput || !gridHeightInput || !cellSizeSelect) {
    console.error('Grid modal or form elements not found');
    return;
  }

  gridWidthInput.value = state.grid.width;
  gridHeightInput.value = state.grid.height;
  cellSizeSelect.value = state.grid.cellSize;
  gridModal.style.display = 'block';
}

export function showSaveModal() {
  const saveModal = document.getElementById('saveModal');
  const fileNameInput = document.getElementById('fileName');

  if (!saveModal || !fileNameInput) {
    console.error('Save modal or form elements not found');
    return;
  }

  fileNameInput.value = 'battle_map.json';
  saveModal.style.display = 'block';
}

export function showOverwriteModal() {
  const overwriteModal = document.getElementById('overwriteModal');
  if (!overwriteModal) {
    console.error('Overwrite modal not found');
    return;
  }
  overwriteModal.style.display = 'block';
}

function initializeModalEventListeners() {
  const modals = document.querySelectorAll('.modal');
  modals.forEach((modal) => {
    const closeBtn = modal.querySelector('.close');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        modal.style.display = 'none';
      });
    }
  });

  const editForm = document.getElementById('editForm');
  if (editForm) {
    editForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const id = parseInt(document.getElementById('editId')?.value);
      if (!id) {
        console.error('Edit form submitted without valid element ID');
        return;
      }
      const updates = {
        name: document.getElementById('name')?.value || '',
        type: document.getElementById('type')?.value || 'player',
        maxHp: parseInt(document.getElementById('maxHp')?.value) || undefined,
        currentHp: parseInt(document.getElementById('currentHp')?.value) || undefined,
        movement: parseInt(document.getElementById('movement')?.value) || undefined,
        damage: parseInt(document.getElementById('damage')?.value) || undefined,
        color: document.getElementById('color')?.value || '#000000',
        coverType: document.getElementById('coverType')?.value || 'half',
        size: parseInt(document.getElementById('size')?.value) || 1,
      };
      updateElement(id, updates);
      pushUndo();
      document.getElementById('editModal').style.display = 'none';
    });

    const typeSelect = document.getElementById('type');
    if (typeSelect) {
      typeSelect.addEventListener('change', (e) => toggleFormGroups(e.target.value));
    }
  }

  const deleteBtn = document.getElementById('deleteBtn');
  if (deleteBtn) {
    deleteBtn.addEventListener('click', () => {
      const id = parseInt(document.getElementById('editId')?.value);
      if (id) {
        deleteElement(id);
        document.getElementById('editModal').style.display = 'none';
      } else {
        console.error('Delete button clicked without valid element ID');
      }
    });
  }

  const gridForm = document.getElementById('gridForm');
  if (gridForm) {
    gridForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const width = parseInt(document.getElementById('gridWidth')?.value);
      const height = parseInt(document.getElementById('gridHeight')?.value);
      const cellSize = parseInt(document.getElementById('cellSize')?.value);
      if (width && height && cellSize) {
        state.grid.width = width;
        state.grid.height = height;
        state.grid.cellSize = cellSize;
        renderGrid();
        updateGridInfo();
        pushUndo();
        document.getElementById('gridModal').style.display = 'none';
      } else {
        console.error('Invalid grid form input');
      }
    });
  }

  const saveForm = document.getElementById('saveForm');
  if (saveForm) {
    saveForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const fileName = document.getElementById('fileName')?.value;
      if (fileName) {
        downloadMap(fileName);
        document.getElementById('saveModal').style.display = 'none';
      } else {
        console.error('Save form submitted without valid file name');
      }
    });
  }

  const confirmUploadBtn = document.getElementById('confirmUpload');
  if (confirmUploadBtn) {
    confirmUploadBtn.addEventListener('click', () => {
      document.getElementById('overwriteModal').style.display = 'none';
      const uploadInput = document.getElementById('uploadInput');
      if (uploadInput) {
        uploadInput.click();
      } else {
        console.error('Upload input not found');
      }
    });
  }

  const uploadInput = document.getElementById('uploadInput');
  if (uploadInput) {
    uploadInput.addEventListener('change', (e) => {
      if (e.target.files[0]) {
        uploadMap(e.target.files[0]);
      } else {
        console.error('No file selected for upload');
      }
    });
  }
}

document.addEventListener('DOMContentLoaded', initializeModalEventListeners);