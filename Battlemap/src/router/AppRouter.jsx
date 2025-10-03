import React from 'react';
import { HashRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from '../auth/AuthContext.jsx';
import { GameSessionProvider } from '../Utils/GameSessionContext.jsx';
import Login from '../screens/Login.jsx';
import ResetPassword from '../screens/ResetPassword.jsx';
import Dashboard from '../screens/Dashboard.jsx';
import BattlemapPage from '../screens/BattlemapPage.jsx';
import Characters from '../screens/Characters.jsx';
import CharacterBuilder from '../screens/CharacterBuilder.jsx';
import Library from '../screens/Library.jsx';

function RequireAuth({ children }) {
  const { user } = useAuth();
  const location = useLocation();
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />;
  return children;
}

export default function AppRouter() {
  const isRecovery = typeof window !== 'undefined' && window.location.hash.includes('type=recovery');
  return (
    <AuthProvider>
      <GameSessionProvider>
      <HashRouter>
        {isRecovery ? (
          // Render reset password screen directly when Supabase returns with a recovery token in the URL hash
          <ResetPassword />
        ) : (
          <Routes>
          <Route path="/" element={<Navigate to="/home" replace />} />
          <Route path="/login" element={<Login />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route
            path="/home"
            element={(
              <RequireAuth>
                <Dashboard />
              </RequireAuth>
            )}
          />
          <Route
            path="/battlemap/:code"
            element={(
              <RequireAuth>
                <BattlemapPage />
              </RequireAuth>
            )}
          />
          <Route
            path="/characters"
            element={(
              <RequireAuth>
                <Characters />
              </RequireAuth>
            )}
          />
          <Route
            path="/library"
            element={(
              <RequireAuth>
                <Library />
              </RequireAuth>
            )}
          />
          <Route
            path="/characters/:id"
            element={(
              <RequireAuth>
                <CharacterBuilder />
              </RequireAuth>
            )}
          />
          <Route path="*" element={<Navigate to="/home" replace />} />
          </Routes>
        )}
      </HashRouter>
      </GameSessionProvider>
    </AuthProvider>
  );
}
