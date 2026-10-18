# Bricks

An ad-free, offline 8×8 block puzzle for iPhone, built as an installable web app (PWA). See `SPEC.md` for the design and `DECISIONS.md` for the choices made where the spec was open.

## Commands

```sh
npm install
npm run dev       # local dev server (also on your LAN: open the printed Network URL on the phone)
npm test          # unit tests for src/core
npm run build     # type-check + production build into dist/
npm run preview   # serve dist/ locally
npm run icons     # re-render PNG icons from public/icons/icon.svg
```

The service worker only runs in a production build over HTTPS (or on localhost). On the LAN dev server the game works but offline mode doesn't.

## Deploy (GitHub Pages)

`.github/workflows/deploy.yml` tests, builds and publishes `dist/` on every push to `main`.

1. Create a GitHub repo and push this folder to `main`.
2. In the repo: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. The site appears at `https://<user>.github.io/<repo>/`.

## Install on iPhone

1. Open the site in **Safari**.
2. Share → **Add to Home Screen**.
3. Launch it from the home screen icon. It runs full-screen and works offline after the first launch.

The home-screen app has its own storage, separate from Safari tabs. Use **Settings → Export save** now and then as a backup, because iOS can clear data for web apps that go unused for weeks.

## Layout

- `src/core/` holds pure game logic: board, pieces, dealer, scoring, reducer, level generator, bot, save model. There are no DOM, canvas or storage calls here.
- `src/config/` holds every tunable number: scoring, difficulty curve, piece set, theme.
- `src/render/` draws the board, tray, tiles and effects on canvas.
- `src/input/` handles drag (Pointer Events).
- `src/ui/` holds the screens and overlays (DOM).
- `src/platform/` wraps storage, Web Audio, haptics and the service worker.
