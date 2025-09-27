import React from 'react';
import ReactDOM from 'react-dom/client';
import AppRouter from './router/AppRouter.jsx';
import './App.css';
import '@fontsource/roboto';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AppRouter />
  </React.StrictMode>,
);