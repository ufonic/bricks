import './style.css';
import { unlockAudio } from './platform/audio';
import { registerServiceWorker } from './platform/pwa';
import { loadSave } from './platform/storage';
import { createApp, type Route, type Screen, type App } from './ui/app';
import { gameScreen } from './ui/screens/game';
import { homeScreen } from './ui/screens/home';
import { levelMapScreen } from './ui/screens/levelMap';
import { settingsScreen } from './ui/screens/settings';
import { statsScreen } from './ui/screens/stats';

// ---------------------------------------------------------------- touch lockdown
// No pinch / double-tap zoom, no rubber-band scrolling, no long-press callouts.
document.addEventListener('gesturestart', (e) => e.preventDefault());
document.addEventListener('dblclick', (e) => e.preventDefault(), { passive: false });
document.addEventListener(
  'touchmove',
  (e) => {
    // Allow scrolling only inside elements marked as scrollable.
    const target = e.target as HTMLElement | null;
    if (!target?.closest('.scroll, .card, textarea')) e.preventDefault();
  },
  { passive: false },
);
document.addEventListener('contextmenu', (e) => e.preventDefault());

// iOS starts audio only from a user gesture.
const unlock = () => {
  unlockAudio();
  window.removeEventListener('pointerdown', unlock);
};
window.addEventListener('pointerdown', unlock);

// ---------------------------------------------------------------- app
const update = registerServiceWorker();

function screenFor(app: App, route: Route): Screen {
  switch (route.name) {
    case 'home':
      return homeScreen(app);
    case 'levels':
      return levelMapScreen(app);
    case 'settings':
      return settingsScreen(app);
    case 'stats':
      return statsScreen(app);
    case 'game':
      return gameScreen(app, route);
  }
}

const save = loadSave();
const resume = save.active && save.inProgress[save.active] ? save.inProgress[save.active] : null;
const app = createApp(document.getElementById('app')!, save, screenFor);

app.update.apply = () => update.apply();
update.onReady(() => {
  app.update.ready = true;
  // Re-render Home so it shows the banner; never interrupt a game.
  if (history.state?.route?.name === 'home') app.go({ name: 'home' }, { replace: true });
});

// Reopening the app drops you back into the game you left.
if (resume) {
  if (resume.mode === 'level' && resume.levelNumber) app.go({ name: 'game', mode: 'level', level: resume.levelNumber });
  else if (resume.mode === 'endless') app.go({ name: 'game', mode: 'endless' });
  else if (resume.mode === 'daily') app.go({ name: 'game', mode: 'daily' });
}
