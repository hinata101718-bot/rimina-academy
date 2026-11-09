import { loadArtManifest } from './ui/HomeDeco';
import { render } from 'preact';
import { App } from './ui/App';
import './ui/styles.css';
import { loadFaceManifest } from './ui/Portrait';

// 19夜目：画面の確かめ用（?debug のときだけ。遊ぶ人には関係ない）
if (/debug/.test(location.search)) {
  void Promise.all([import('./ui/store'), import('./core/game'), import('./core/flow'), import('./core/autoplay'), import('./core/sortie'), import('./core/rng'), import('./core/nemesis')]).then(([store, game, flow, auto, sortie, rng, nemesis]) => {
    (window as unknown as Record<string, unknown>).__rimina = { store, game, flow, auto, sortie, rng, nemesis };
  });
}

Promise.all([loadFaceManifest(), loadArtManifest()]).finally(() => render(<App />, document.getElementById('app')!));

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => undefined);
  });
}
