import { loadArtManifest } from './ui/HomeDeco';
import { render } from 'preact';
import { App } from './ui/App';
import './ui/styles.css';
import { loadFaceManifest } from './ui/Portrait';
import { setCardMode } from './core/battle/auto';

// 16夜目：札の戦いを試すとき（?cards）。切り替えのあとは、いつも札の戦い
if (/cards/.test(location.search)) setCardMode(true);

Promise.all([loadFaceManifest(), loadArtManifest()]).finally(() => render(<App />, document.getElementById('app')!));

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => undefined);
  });
}
