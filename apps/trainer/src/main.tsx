import '@lens/scenes/fonts';
import { cssVars } from '@lens/scenes';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './app.css';

for (const [name, value] of Object.entries(cssVars())) {
  document.documentElement.style.setProperty(name, value);
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
