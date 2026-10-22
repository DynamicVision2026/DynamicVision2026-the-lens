import '@lens/scenes/fonts';
import { applyContentTranslation, cssVars, setScriptFonts } from '@lens/scenes';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { initAnalytics } from './launch/analytics';
import { beaconConfig } from './launch/tracking';
import { LAUNCH } from './launch.config';
import { LANG, type Lang } from './i18n/lang';
import './app.css';

// Other languages: Chinese system fonts ahead of Noto Sans JP, and the course text swapped in before the first render.
const SCRIPT_FONTS: Partial<Record<Lang, string[]>> = {
  en: ['Inter'],
  'zh-Hans': ['PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', 'Noto Sans SC'],
  'zh-Hant': ['PingFang TC', 'Microsoft JhengHei', 'Noto Sans TC'],
};
const CONTENT: Partial<Record<Lang, () => Promise<{ default: Record<string, string> }>>> = {
  en: () => import('../../../i18n/content/en.json'),
  'zh-Hans': () => import('../../../i18n/content/zh-Hans.json'),
  'zh-Hant': () => import('../../../i18n/content/zh-Hant.json'),
};
setScriptFonts(SCRIPT_FONTS[LANG] ?? []);
const contentReady = CONTENT[LANG]?.().then((m) => applyContentTranslation(m.default)) ?? Promise.resolve();

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

// WO-025: Google Analytics 4 only when LAUNCH.ga4Id is set.
initAnalytics();

void contentReady.finally(() =>
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  ),
);
