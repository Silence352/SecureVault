import React from 'react';
import ReactDOM from 'react-dom/client';
import QuickPanel from './QuickPanel';
import './App.css';

console.log('[quickpanel-entry.tsx] Entry point loading...');

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <QuickPanel />
  </React.StrictMode>,
);
