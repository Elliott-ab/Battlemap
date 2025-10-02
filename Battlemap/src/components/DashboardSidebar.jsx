import React from 'react';
import { useLocation } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faHouse, faMap, faUser } from '@fortawesome/free-solid-svg-icons';

export default function DashboardSidebar({ onOpenBattlemap, onOpenCharacters }) {
  const location = useLocation();
  const path = location?.pathname || '';
  const hideNav = path === '/home' || path.startsWith('/characters');
  return (
    <aside className="sidebar">
      <div className="sidebar-body">
        {hideNav ? null : (
          <>
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
            <button
              className="turn-box"
              onClick={onOpenCharacters}
              style={{ width: '100%', textAlign: 'center', cursor: 'pointer', marginTop: 8 }}
            >
              <FontAwesomeIcon icon={faUser} style={{ marginRight: 8 }} />
              Characters
            </button>
          </>
        )}
      </div>
    </aside>
  );
}
