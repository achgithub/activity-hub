import React from 'react';
import ReactDOM from 'react-dom/client';
import '@activity-hub/ui/styles/activity-hub.css';
import App from './App';

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
