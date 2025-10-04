import React, { useMemo, useState } from 'react';
import { Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Checkbox } from '@mui/material';

const LoadDraftModal = ({
  isOpen,
  onClose,
  drafts = [],
  onSelect,
  onConfirm,
  selectable = false,
  confirmLabel = 'Load',
  title = 'Load Map',
  emptyText = 'No saved maps yet.',
  secondaryAction,
  secondaryLabel,
  allowEmptySelection = false,
  emptyConfirmLabel,
  onConfirmEmpty,
}) => {
  const [selectedName, setSelectedName] = useState('');
  const selectedDraft = useMemo(() => drafts.find(d => d.name === selectedName) || null, [drafts, selectedName]);

  if (!isOpen) return null;
  return (
    <div className="modal" style={{ display: 'block' }}>
      <div className="modal-content small" style={{ width: 640, maxWidth: '95vw' }}>
        <span className="close" onClick={onClose}>&times;</span>
        <h3>{title}</h3>

        {!selectable ? (
          <div className="form-group" style={{ maxHeight: 260, overflow: 'auto', border: '1px solid #333', borderRadius: 6 }}>
            {drafts.length === 0 && (
              <div style={{ padding: 12, color: '#aaa' }}>{emptyText}</div>
            )}
            {drafts.map((d) => (
              <button
                key={d.id || d.name}
                className="menu-item"
                style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}
                onClick={() => onSelect && onSelect(d)}
              >
                <span>{d.name}</span>
                {d.updated_at && <small style={{ opacity: 0.7 }}>{new Date(d.updated_at).toLocaleString()}</small>}
              </button>
            ))}
          </div>
        ) : (
          <div className="form-group" style={{ border: '1px solid #333', borderRadius: 6 }}>
            {drafts.length === 0 ? (
              <div style={{ padding: 12, color: '#aaa' }}>{emptyText}</div>
            ) : (
              <TableContainer
                sx={{
                  // Allow ~10 rows before scroll across platforms (header + ~10 compact rows)
                  maxHeight: 420,
                  overflowY: 'auto',
                  '& .MuiTableCell-head': { backgroundColor: '#2f2f2f', color: '#fff', height: 32, py: 0, px: 1 },
                  '& .MuiTableCell-root': { borderBottom: '1px solid #444', color: '#fff' },
                  '& .MuiTableRow-root': { backgroundColor: 'transparent', height: 28 },
                }}
              >
                <Table
                  stickyHeader
                  size="small"
                  aria-label="saved maps"
                  sx={{ '& td, & th': { py: 0, px: 1, fontSize: 12 }, '& tbody tr:hover': { backgroundColor: 'rgba(255,255,255,0.06)' } }}
                >
                  <TableHead>
                    <TableRow>
                      <TableCell padding="checkbox">Select</TableCell>
                      <TableCell>Name</TableCell>
                      <TableCell>Last Updated</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {drafts.map((d) => {
                      const checked = selectedName === d.name;
                      return (
                        <TableRow
                          key={d.id || d.name}
                          hover
                          sx={{ cursor: 'pointer' }}
                          onClick={() => setSelectedName(prev => (prev === d.name ? '' : d.name))}
                        >
                          <TableCell padding="checkbox">
                            <Checkbox
                              size="small"
                              color="default"
                              sx={{ color: '#fff', '&.Mui-checked': { color: '#fff' } }}
                              checked={checked}
                              onClick={(e) => e.stopPropagation()}
                              onChange={() => setSelectedName(prev => (prev === d.name ? '' : d.name))}
                            />
                          </TableCell>
                          <TableCell>{d.name}</TableCell>
                          <TableCell>{d.updated_at ? new Date(d.updated_at).toLocaleString() : ''}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </div>
        )}

        <div className="form-actions" style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', alignItems: 'center' }}>
          {secondaryAction && (
            <button
              className="btn btn-secondary"
              onClick={secondaryAction}
            >
              {secondaryLabel || 'Secondary'}
            </button>
          )}
          {selectable && (
            <button
              className="btn btn-primary"
              disabled={!allowEmptySelection && !selectedDraft}
              onClick={() => {
                if (!selectedDraft && allowEmptySelection) {
                  onConfirmEmpty && onConfirmEmpty();
                } else if (selectedDraft) {
                  onConfirm && onConfirm(selectedDraft);
                }
              }}
            >
              {selectedDraft ? confirmLabel : (allowEmptySelection ? (emptyConfirmLabel || confirmLabel) : confirmLabel)}
            </button>
          )}
          <button className="btn btn-secondary" onClick={onClose}>{selectable ? 'Cancel' : 'Close'}</button>
        </div>
      </div>
    </div>
  );
};

export default LoadDraftModal;
