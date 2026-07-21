import React from 'react';
import IconButton from '../../common/IconButton.jsx';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCopy } from '@fortawesome/free-regular-svg-icons';

// Lightweight wrapper to centralize clipboard copy behavior without changing visuals.
// Props:
// - value: string to copy
// - onCopied?: optional callback after successful copy
// - onClick?: optional external click handler (for stopPropagation, etc.)
// - title/aria-label/className/size: forwarded to IconButton
export default function CopyToClipboardButton({ value, onCopied, title = 'Copy', onClick, ...rest }) {
  const handleClick = async (event) => {
    try {
      if (typeof onClick === 'function') onClick(event);
      if (!value) return;
      await navigator.clipboard.writeText(value);
      if (typeof onCopied === 'function') onCopied();
    } catch {
      // ignore clipboard errors
    }
  };
  return (
    <IconButton onClick={handleClick} title={title} aria-label={title} {...rest}>
      <FontAwesomeIcon icon={faCopy} />
    </IconButton>
  );
}
