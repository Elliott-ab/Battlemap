import React, { useState, useEffect } from 'react';

const EditModal = ({ isOpen, elementId, state, updateElement, deleteElement, pushUndo, onClose }) => {
  const [formData, setFormData] = useState({
    name: '',
    type: 'player',
    maxHp: '',
    currentHp: '',
    movement: '',
    damage: '',
    color: '#000000',
    coverType: 'half',
    size: 1,
  });

  useEffect(() => {
    if (elementId) {
      const el = state.elements.find(e => e.id === elementId);
      if (el) {
        setFormData({
          name: el.name,
          type: el.type,
          maxHp: el.maxHp || '',
          currentHp: el.currentHp || '',
          movement: el.movement || '',
          damage: el.damage || '',
          color: el.color || '#000000',
          coverType: el.coverType || 'half',
          size: el.size || 1,
        });
      }
    }
  }, [elementId, state.elements]);

  const handleSubmit = (e) => {
    e.preventDefault();
    updateElement(elementId, {
      name: formData.name,
      type: formData.type,
      maxHp: parseInt(formData.maxHp) || undefined,
      currentHp: parseInt(formData.currentHp) || undefined,
      movement: parseInt(formData.movement) || undefined,
      damage: parseInt(formData.damage) || undefined,
      color: formData.color,
      coverType: formData.coverType,
      size: parseInt(formData.size) || 1,
    });
    pushUndo();
    onClose();
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  if (!isOpen) return null;

  return (
    <div className="modal" style={{ display: 'block' }}>
      <div className="modal-content">
        <span className="close" onClick={onClose}>&times;</span>
        <h3>Edit Element</h3>
        <form onSubmit={handleSubmit} id="editForm">
          <div className="form-group">
            <label htmlFor="name">Name:</label>
            <input type="text" id="name" name="name" value={formData.name} onChange={handleChange} />
          </div>
          <div className="form-group">
            <label htmlFor="type">Type:</label>
            <select id="type" name="type" value={formData.type} onChange={handleChange}>
              <option value="player">Player</option>
              <option value="enemy">Enemy</option>
              <option value="cover">Cover</option>
            </select>
          </div>
          {formData.type !== 'cover' && (
            <>
              <div className="form-group hp-group">
                <label htmlFor="maxHp">Max HP:</label>
                <input type="number" id="maxHp" name="maxHp" value={formData.maxHp} onChange={handleChange} />
              </div>
              <div className="form-group hp-group">
                <label htmlFor="currentHp">Current HP:</label>
                <input type="number" id="currentHp" name="currentHp" value={formData.currentHp} onChange={handleChange} />
              </div>
              <div className="form-group movement-group">
                <label htmlFor="movement">Movement (ft):</label>
                <input type="number" id="movement" name="movement" value={formData.movement} onChange={handleChange} />
              </div>
            </>
          )}
          {formData.type === 'enemy' && (
            <div className="form-group damage-group">
              <label htmlFor="damage">Damage Dealt:</label>
              <input type="number" id="damage" name="damage" value={formData.damage} onChange={handleChange} />
            </div>
          )}
          {formData.type !== 'cover' && (
            <div className="form-group color-group">
              <label htmlFor="color">Color:</label>
              <input type="color" id="color" name="color" value={formData.color} onChange={handleChange} />
            </div>
          )}
          {formData.type === 'cover' && (
            <div className="form-group cover-group">
              <label htmlFor="coverType">Cover Type:</label>
              <select id="coverType" name="coverType" value={formData.coverType} onChange={handleChange}>
                <option value="half">Half Cover</option>
                <option value="three-quarters">Three-Quarters Cover</option>
                <option value="full">Full Cover</option>
                <option value="difficult">Difficult Terrain</option>
              </select>
            </div>
          )}
          <div className="form-group size-group">
            <label htmlFor="size">Size (grid squares):</label>
            <select id="size" name="size" value={formData.size} onChange={handleChange}>
              <option value="1">1x1 (Medium)</option>
              <option value="2">2x2 (Large)</option>
              <option value="3">3x3 (Huge)</option>
              <option value="4">4x4 (Gargantuan)</option>
            </select>
          </div>
          <div className="form-actions">
            <button type="submit" className="btn btn-primary">Save</button>
            <button type="button" className="btn btn-danger" id="deleteBtn" onClick={() => { deleteElement(elementId); pushUndo(); onClose(); }}>Delete</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditModal;