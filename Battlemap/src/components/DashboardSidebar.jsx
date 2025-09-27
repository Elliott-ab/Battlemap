import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faHouse, faMap } from '@fortawesome/free-solid-svg-icons';

export default function DashboardSidebar({ onOpenBattlemap }) {
  return (
    <aside className="sidebar">
      <div className="sidebar-body">
        <h3 style={{ marginTop: 0, marginBottom: '0.75rem' }}>
          <FontAwesomeIcon icon={faHouse} style={{ marginRight: 8 }} />
          Navigation
        </h3>
        <button
          className="turn-box" /* reuse existing button-like style */
          onClick={onOpenBattlemap}
          style={{ width: '100%', textAlign: 'center', cursor: 'pointer' }}
        >
          <FontAwesomeIcon icon={faMap} style={{ marginRight: 8 }} />
          Battlemap
        </button>
      </div>
    </aside>
  );
}
