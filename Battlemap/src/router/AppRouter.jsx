import React, { useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from '../auth/AuthContext.jsx';
import { GameSessionProvider } from '../Utils/GameSessionContext.jsx';
import { supabase } from '../supabaseClient';
import Login from '../screens/Login.jsx';
import ResetPassword from '../screens/ResetPassword.jsx';
import Dashboard from '../screens/Dashboard.jsx';
import BattlemapPage from '../screens/BattlemapPage.jsx';
import Characters from '../screens/Characters.jsx';
import CharacterBuilder from '../screens/CharacterBuilder.jsx';
import CharacterBuilderWizard from '../screens/CharacterBuilderWizard.jsx';
import Library from '../screens/Library.jsx';
import ToolingDemo from '../screens/ToolingDemo.jsx';
import Fellowship from '../screens/Fellowship.jsx';

function RequireAuth({ children }) {
  const { user } = useAuth();
  const location = useLocation();
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />;
  return children;
}

function RecoveryRedirector() {
  const navigate = useNavigate();
  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        navigate('/reset-password', { replace: true });
      }
    });
    return () => {
      sub.subscription.unsubscribe();
    };
  }, [navigate]);
  return null;
}

export default function AppRouter() {
  return (
    <AuthProvider>
      <GameSessionProvider>
        <HashRouter>
          <RecoveryRedirector />
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
              path="/fellowship"
              element={(
                <RequireAuth>
                  <Fellowship />
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
            <Route
              path="/characters/new/guided"
              element={(
                <RequireAuth>
                  <CharacterBuilderWizard />
                </RequireAuth>
              )}
            />
            <Route
              path="/tools"
              element={(
                <RequireAuth>
                  <ToolingDemo />
                </RequireAuth>
              )}
            />
            <Route path="*" element={<Navigate to="/home" replace />} />
          </Routes>
        </HashRouter>
      </GameSessionProvider>
    </AuthProvider>
  );
}
