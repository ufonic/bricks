// Service worker registration and the "update ready" flow.
// A new version waits in the background; it's applied from the Home screen
// or on the next launch, never in the middle of a game.

export interface UpdateHandle {
  onReady(cb: () => void): void;
  apply(): void;
}

export function registerServiceWorker(): UpdateHandle {
  let waiting: ServiceWorker | null = null;
  let readyCb: (() => void) | null = null;
  const handle: UpdateHandle = {
    onReady(cb) {
      readyCb = cb;
      if (waiting) cb();
    },
    apply() {
      if (!waiting) {
        location.reload();
        return;
      }
      waiting.postMessage('skipWaiting');
    },
  };
  if (!('serviceWorker' in navigator) || !import.meta.env.PROD) return handle;

  const markWaiting = (sw: ServiceWorker | null) => {
    if (!sw || !navigator.serviceWorker.controller) return; // first install: nothing to update
    waiting = sw;
    readyCb?.();
  };

  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloading) return;
    reloading = true;
    location.reload();
  });

  window.addEventListener('load', async () => {
    try {
      const reg = await navigator.serviceWorker.register('./sw.js', { scope: './' });
      if (reg.waiting && navigator.serviceWorker.controller) {
        // An update downloaded last session: this is the "next launch", apply it now.
        reg.waiting.postMessage('skipWaiting');
        return;
      }
      reg.addEventListener('updatefound', () => {
        const sw = reg.installing;
        sw?.addEventListener('statechange', () => {
          if (sw.state === 'installed') markWaiting(sw);
        });
      });
      // Check for updates whenever the app comes back to the foreground.
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') void reg.update().catch(() => undefined);
      });
    } catch {
      // Offline support is best-effort; the game runs without it.
    }
  });
  return handle;
}

