import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.js';

// Styles: tokens + base resets from @kitkat/ui, then Tailwind's generated
// utilities. This order is what makes the app actually look styled.
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
