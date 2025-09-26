import React from 'react';

// Minimal icon-only button used across the project
export default function IconButton({
  children,
  className = '',
  size, // 'small' | 'large' | undefined
  disabled,
  title,
  onClick,
  'aria-label': ariaLabel,
  ...rest
}) {
  const sizeClass = size === 'small' ? 'icon-button--small' : size === 'large' ? 'icon-button--large' : '';
  return (
    <button
      type="button"
      className={`icon-button ${sizeClass} ${className}`.trim()}
      disabled={disabled}
      title={title}
      aria-label={ariaLabel}
      onClick={onClick}
      {...rest}
    >
      {children}
    </button>
  );
}
