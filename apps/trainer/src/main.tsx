import '@lens/scenes/fonts';
import { cssVars } from '@lens/scenes';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { beaconConfig } from './launch/tracking';
import { LAUNCH } from './launch.config';
import './app.css';

for (const [name, value] of Object.entries(cssVars())) {
  document.documentElement.style.setProperty(name, value);
}

// Cloudflare Web Analytics (cookie-free) only when a token is configured.
const beacon = beaconConfig(LAUNCH.cfAnalyticsToken);
if (beacon) {
  const script = document.createElement('script');
  script.defer = true;
  script.src = 'https://static.cloudflareinsights.com/beacon.min.js';
  script.dataset.cfBeacon = beacon;
  document.head.appendChild(script);
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
