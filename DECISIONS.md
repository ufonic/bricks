# Decisions

Where SPEC.md was ambiguous, the simplest workable option was chosen and recorded here.

## Gameplay

- **Combo counting.** The first clearing placement is combo 1 (×1). Each consecutive clearing placement adds 1, so the second in a row is ×2, the third ×3. Any placement that clears nothing resets it to 0.
- **Board clear with locks.** Locks can never clear, so "board completely empty" ignores locks. Otherwise lock levels could never earn the bonus.
- **A row with a lock** still counts as full when every other cell is filled. Clearing it removes everything except the lock.
- **Stones** count as filled. The first clear cracks them (hp 2 → 1) and the second breaks them. A broken stone counts toward "Clear blocks".
- **Deal fairness.** After 20 random redraws with nothing fitting, one slot is replaced by a weighted pick from the shapes that do fit. Game over at a deal only happens when no shape in the set fits at all. Mid-tray game over (the remaining pieces don't fit) works as specced.
- **Piece colors.** Level and Daily pieces are never yellow, which is reserved for starting obstacles. Endless uses all 7 colors.

## Levels

- **When a level ends.** A level ends the moment its goal is met: the result card pops up and play stops (changed from the original "keep playing for stars" design). It also ends, as a loss, when no piece fits or a move limit runs out.
- **Stars.** Because a level stops at its goal, stars reward getting there in few moves. Par is the number of moves the bot needed. 1 star for meeting the goal, 2 stars within 1.5× par, 3 stars within par. On move-limited levels, finishing with ≥10% of moves left also gives 2 stars, and ≥25% gives 3.
- **"Break stone" and "Locked cells"** are mechanics, not goals. Stones are mixed into the starting blocks (so on "Clear blocks" levels they need two clears). Locks are scattered on empty cells. Objectives are: score, lines, clear blocks, gems.
- **The piece sequence** is driven by a seeded RNG stored in the game state, so the deals are reproducible for the same moves. Because fair dealing depends on the board, different moves can produce different later deals. Retrying a level restarts the same board and the same RNG.
- **Bot check.** The greedy bot plays the real level (same dealer and seed) for 22–45 moves depending on difficulty. A board is rejected if the bot gets stuck before half of those moves, clears fewer than 4 lines on a lines level, or reaches less than 70% of a blocks/gems goal. After 10 failed tries the fill ratio drops 15%. After 50 tries the best attempt is used, with its goals lowered to what the bot achieved.
- **Daily seed.** A hash of `daily:YYYYMMDD` plus `GENERATOR_VERSION`, using the phone's local date. Daily difficulty is fixed at 0.45. The streak continues when yesterday's daily was won.

## Persistence

- **One saved game per mode** (`inProgress: { level, endless, daily }`) instead of a single `inProgress`, so starting a level never throws away an endless run. `active` remembers which game was on screen, so reopening the app returns straight to it.
- **`migrate()` and the save model live in `src/core/save.ts`** (pure and unit-tested). `src/platform/storage.ts` only does the localStorage I/O.
- **Export** leaves out in-progress games to keep the text short.
- **Undo** is available from the fail/game-over card too, if undos remain.

## Platform

- **Hand-written service worker** (`src/sw.js` plus a small Vite plugin) instead of vite-plugin-pwa. It avoids a dependency that lags new Vite majors. The plugin precaches every built file and versions the cache by a content hash.
- **Updates** wait in the background. They are applied from the Home screen banner or automatically at the next launch, never mid-game.
- **`base: './'`** so the same build works at a domain root or under a GitHub Pages `/repo/` path.
- **Icons** are rendered from `public/icons/icon.svg` by `npm run icons` (uses `sharp`, a dev dependency). The PNGs are committed, so a normal build doesn't need it.
- **App name:** "Bricks" (the folder name). Change it in `index.html`, `manifest.webmanifest` and `home.ts`.
