import { render } from 'preact';
import { App } from './ui/App';
import './ui/styles.css';
import { loadFaceManifest } from './ui/Portrait';

loadFaceManifest().finally(() => render(<App />, document.getElementById('app')!));

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => undefined);
  });
}
