import { TIMING } from '../config/theme';
import type { SaveData } from '../core/save';
import { setSoundEnabled } from '../platform/audio';
import { setHapticsEnabled } from '../platform/haptics';
import { writeSave } from '../platform/storage';

export type Route =
  | { name: 'home' }
  | { name: 'levels' }
  | { name: 'settings' }
  | { name: 'stats' }
  | { name: 'game'; mode: 'level'; level: number }
  | { name: 'game'; mode: 'endless' }
  | { name: 'game'; mode: 'daily' };

export interface Screen {
  el: HTMLElement;
  /** Called when the screen is replaced. Must save anything it owns. */
  destroy?(): void;
  /** App went to the background. */
  onHide?(): void;
}

export interface App {
  save: SaveData;
  /** Persist the current save (after mutating `app.save`). */
  persist(): void;
  /** Replace the save wholesale (import / reset) and persist. */
  replaceSave(save: SaveData): void;
  go(route: Route, opts?: { replace?: boolean }): void;
  back(): void;
  update: { ready: boolean; apply(): void };
}

type ScreenFactory = (app: App, route: Route) => Screen;

export function createApp(root: HTMLElement, initial: SaveData, factory: ScreenFactory): App {
  let current: Screen | null = null;

  const applySettings = () => {
    setSoundEnabled(app.save.settings.sound);
    setHapticsEnabled(app.save.settings.haptics);
  };

  const render = (route: Route) => {
    const prev = current;
    prev?.destroy?.();
    current = factory(app, route);
    const el = current.el;
    el.classList.add('screen', 'entering');
    root.append(el);
    requestAnimationFrame(() => el.classList.remove('entering'));
    if (prev) {
      const old = prev.el;
      old.classList.add('leaving');
      setTimeout(() => old.remove(), TIMING.screenFadeMs);
    }
  };

  const app: App = {
    save: initial,
    persist() {
      writeSave(app.save);
      applySettings();
    },
    replaceSave(save) {
      app.save = save;
      app.persist();
    },
    go(route, opts = {}) {
      if (opts.replace) history.replaceState({ route }, '');
      else history.pushState({ route }, '');
      render(route);
    },
    back() {
      if (history.state?.route?.name === 'home' || history.length <= 1) app.go({ name: 'home' }, { replace: true });
      else history.back();
    },
    update: { ready: false, apply: () => location.reload() },
  };

  window.addEventListener('popstate', (e) => {
    const route = (e.state?.route as Route | undefined) ?? { name: 'home' };
    render(route);
  });

  const hide = () => {
    current?.onHide?.();
    writeSave(app.save);
  };
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') hide();
  });
  window.addEventListener('pagehide', hide);

  applySettings();
  // Home is always at the bottom of the history stack, so Back never leaves the app.
  history.replaceState({ route: { name: 'home' } }, '');
  render({ name: 'home' });
  return app;
}
