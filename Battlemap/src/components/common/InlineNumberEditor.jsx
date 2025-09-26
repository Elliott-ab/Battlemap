import React from 'react';

const InlineNumberEditor = ({
  value,
  onChange,
  onConfirm,
  onCancel,
  placeholder = '',
  width = 80,
  okLabel = 'OK',
  title,
}) => {
  return (
    <form
      onSubmit={(e) => { e.preventDefault(); onConfirm?.(); }}
      style={{ display: 'flex', alignItems: 'center', gap: 6 }}
      onDoubleClick={(e) => e.stopPropagation?.()}
    >
      {title ? <span style={{ fontSize: 12, opacity: 0.9 }}>{title}</span> : null}
      <input
        type="number"
        min={0}
        className="no-spinner"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange?.(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Escape') { e.preventDefault(); onCancel?.(); } }}
        autoFocus
        style={{ width, background: 'rgba(0,0,0,0.4)', color: '#fff', border: '1px solid #555', borderRadius: 4, padding: '2px 6px' }}
        aria-label={title || 'Number input'}
      />
      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()} // prevent input blur before click
        onClick={(e) => { e.stopPropagation?.(); onConfirm?.(); }}
        style={{ background: '#4CAF50', color: '#fff', border: 'none', borderRadius: 4, padding: '2px 8px', cursor: 'pointer', fontSize: 12 }}
        title={okLabel}
      >
        {okLabel}
      </button>
    </form>
  );
};

export default InlineNumberEditor;
