import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import { GameController } from './app/controller';
import { applyHudSkinVariables } from './game/rendering/hudSkins';
import { IndexedDbProfileRepository } from './persistence/indexeddb/profileRepository';
import './styles/global.css';

applyHudSkinVariables();

const container = document.getElementById('root');
if (!container) throw new Error('Root element not found');

const repository = new IndexedDbProfileRepository();
const controller = new GameController({ repository });
void controller.initialize();

createRoot(container).render(<App controller={controller} />);

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    const base = import.meta.env.BASE_URL;
    navigator.serviceWorker.register(`${base}sw.js`).catch((error: unknown) => {
      console.warn('Service worker registration failed', error);
    });
  });
}
