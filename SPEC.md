# Block Puzzle Game – Build Spec

Oct 18, 2026 · @Brendon

## Overview & goals

Build an ad-free, offline 8×8 block puzzle game as an installable web app (PWA) for one player on iPhone, with effectively unlimited levels plus an endless mode.

**Goals**

- Plays like the familiar wooden block puzzle: drag 3 pieces onto an 8×8 board, clear full rows and columns.
- Hundreds-plus levels that never run out, generated deterministically from a level number.
- Zero ads, zero accounts, zero network calls after first load. Fully offline.
- Feels native on iPhone: full-screen, 60 fps drag, haptics where supported, no browser chrome.
- Progress saves automatically and survives closing the app.

**Non-goals**

- No App Store release, monetization, analytics, leaderboards, or multiplayer.
- No backend. No login.
- No copying of any existing game's art, name, or assets. All visuals are original (CSS/SVG/canvas drawn).

## Platform & tech stack

Target is a static PWA built with Vite + TypeScript, rendered with HTML Canvas, installed via Safari's Add to Home Screen.

| Area | Choice | Notes |
| --- | --- | --- |
| Language | TypeScript (strict) | No framework required; a tiny DOM layer for menus is fine |
| Build | Vite | `npm run dev` for local, `npm run build` outputs static `dist/` |
| Rendering | Canvas 2D for board, tray and drag | DOM/CSS for menus and overlays |
| Offline | Service worker (vite-plugin-pwa or hand-written) | Precache all assets; app must launch in airplane mode |
| Install | Web app manifest | `display: standalone`, portrait, theme color, 180×180 apple-touch-icon |
| Storage | localStorage (wrapped in try/catch) | IndexedDB optional later |
| Audio | Web Audio API, synthesized SFX | No external sound files required |
| Haptics | `navigator.vibrate` where available | iOS Safari ignores it; feature-detect and fail silently |
| Tests | Vitest | Pure game logic must be unit tested |
| Hosting | Any static host (GitHub Pages, Netlify, Cloudflare Pages) | HTTPS is required for the service worker |

iOS specifics to handle:

- `apple-mobile-web-app-capable` and `apple-mobile-web-app-status-bar-style` meta tags.
- Respect safe areas with `env(safe-area-inset-*)`; layout must clear the notch and home indicator.
- Disable pinch zoom, double-tap zoom, text selection, and the long-press callout on the game area (`touch-action: none`, `user-select: none`, `-webkit-touch-callout: none`).
- Prevent pull-to-refresh and rubber-band scrolling while dragging.
- Unlock the AudioContext on the first user tap.

Optional later: wrap the same build in Capacitor to produce a native iOS app if wanted. Keep game logic free of browser APIs so that stays easy.

## Core gameplay rules

The player places pieces from a 3-slot tray onto an 8×8 grid; completed rows and columns clear and score points.

**Board**

- 8×8 grid of cells. Each cell is empty, filled (with a color), or a special cell (see Level mode).
- Coordinates: `(row, col)`, `(0,0)` top-left.

**Tray**

- Always shows 3 pieces. Pieces cannot be rotated.
- A new set of 3 is dealt only after all 3 are placed.
- Placed pieces vanish from the tray; remaining slots keep their position.

**Placement**

- A piece can be placed only if every one of its cells lands on an empty in-bounds cell.
- Invalid drop returns the piece to its tray slot with a short snap-back animation.

**Clearing**

- After each placement, check all 8 rows and 8 columns. Every full row and column clears at the same time.
- A cell at the intersection of a cleared row and column counts once.

**Scoring**

1. +1 point per cell placed.
2. Line clear bonus: `10 × lines × lines` for lines cleared by that one placement (1 line = 10, 2 = 40, 3 = 90, 4 = 160).
3. Combo: if the previous placement also cleared at least one line, multiply the clear bonus by the combo count (2×, 3×, …). Combo resets when a placement clears nothing.
4. Board clear: +300 if the board is completely empty after a clear.

All scoring constants live in one config file so they can be tuned.

**Game over**

- After each placement or new deal, if none of the remaining tray pieces fit anywhere, the game is over.
- Show the outcome screen. In Level mode, the level is failed unless its goal was already met.

**Deal fairness**

- When dealing, guarantee at least one of the 3 pieces fits the current board. Retry the random draw up to 20 times; if still nothing fits, game over is legitimate.
- Optional setting "Friendly deals": bias toward pieces that can complete a line.

## Piece set

The game uses 37 pieces across 13 shape families (each orientation is its own piece, since there is no rotation), each with a draw weight and a difficulty tier.

| ID | Shape | Cells | Tier | Base weight |
| --- | --- | --- | --- | --- |
| dot | 1×1 | 1 | easy | 6 |
| h2 / v2 | 1×2 line, horizontal / vertical | 2 | easy | 6 each |
| h3 / v3 | 1×3 line | 3 | easy | 6 each |
| h4 / v4 | 1×4 line | 4 | medium | 4 each |
| h5 / v5 | 1×5 line | 5 | hard | 2 each |
| sq2 | 2×2 square | 4 | easy | 6 |
| sq3 | 3×3 square | 9 | hard | 2 |
| L3 ×4 | small corner (3 cells), 4 orientations | 3 | easy | 4 each |
| L4 ×8 | L / J tetromino, 4 orientations each | 4 | medium | 2 each |
| T4 ×4 | T tetromino | 4 | medium | 2 each |
| S4 ×4 | S / Z tetromino, 2 orientations each | 4 | medium | 2 each |
| L5 ×4 | big corner (3×3 L, 5 cells) | 5 | hard | 1 each |
| rect23 ×2 | 2×3 rectangle, both orientations | 6 | hard | 1 each |

Define shapes as data, for example `{ id: 'L3a', cells: [[0,0],[1,0],[1,1]], tier: 'easy', weight: 4 }`. Generate orientations programmatically from a base shape and dedupe identical ones.

Each piece gets a color assigned at deal time from the palette (Visual design). Color is cosmetic unless a level uses color objectives.

The level generator scales weights by tier: early levels favor easy pieces, later levels raise medium and hard weights (see Level mode).

## Level mode

Levels are generated on the fly from the level number using a seeded RNG, so there is no level file, no limit, and level 412 is identical every time it is played.

**Determinism**

- Use a small seeded PRNG (mulberry32 or sfc32). Seed = hash of `levelNumber` + a constant `GENERATOR_VERSION`.
- The seed drives the starting board, the objective, the piece weights, and the full piece sequence for that level.
- Bumping `GENERATOR_VERSION` regenerates all levels; saved progress (highest level reached) is kept.

**Objectives** (one per level, sometimes two later on)

| Objective | Rule | First appears |
| --- | --- | --- |
| Reach score | Hit a target score before game over | Level 1 |
| Clear lines | Clear N total lines | Level 3 |
| Clear blocks | Remove all pre-placed starting blocks (like the screenshot) | Level 5 |
| Collect gems | Gems sit inside starting blocks; clear their line to collect N gems | Level 15 |
| Limited moves | Meet the goal within N placements | Level 25 |
| Break stone | Stone cells need 2 clears to break (first clear cracks them) | Level 40 |
| Locked cells | Cells with a lock count as filled and never clear; they shrink usable space | Level 60 |

The first time a mechanic appears, show a one-screen tip.

**Starting board generation**

1. Choose a fill ratio from the difficulty curve (10% at level 1 rising to about 45%).
2. Place starting blocks using a pattern family picked by the seed: symmetric (mirror on one or both axes, like the screenshot), scattered, clustered, border frame, checker fragments, or shapes/letters.
3. Reject boards that contain any already-full row or column.
4. Solvability check: simulate the level's piece sequence with a simple greedy bot (place each piece where it clears the most lines, tie-break by fewest holes). If the bot cannot reach at least 70% of the goal, re-roll the layout (up to 50 tries), then lower the fill ratio.
5. Set the target from the bot's result: score target ≈ 80–110% of the bot's score depending on difficulty, rounded to a tidy number.

**Difficulty curve**

- Difficulty `d` = smooth function of level number with a sawtooth: every 10th level is a "breather" (easier), every 25th is a "boss" (harder, two objectives).
- `d` controls fill ratio, target tightness, hard-piece weight, and move limits.
- All curve parameters live in `config/difficulty.ts` so they can be tuned without touching logic.

**Stars and results**

- 1 star for meeting the goal, 2 for 125% of the target, 3 for 150% (or finishing with moves left, on move-limited levels).
- Store best score and stars per level.
- Failing a level costs nothing: retry immediately with the same board and sequence.

**Level map**

- Scrollable list or path of levels showing stars, with the next unbeaten level highlighted.
- All earlier levels are replayable. Levels beyond the next unbeaten one are locked (setting to unlock all).
- "Continue" on the home screen jumps straight to the next unbeaten level.

## Endless mode and other modes

Two extra modes reuse the same engine: Endless (v1) and Daily Puzzle (v1.1).

- **Endless (v1):** empty board, play until no piece fits, track high score. Difficulty creeps up slowly with score (hard-piece weight rises every 1,000 points).
- **Daily Puzzle (v1.1):** one seeded level per calendar date (seed = `YYYYMMDD`), with a streak counter. Works offline since it is generated locally.
- **Zen (optional, later):** no game over; when stuck, the board clears its fullest 3 rows and play continues.

Game state for every mode autosaves after each placement, so closing the app mid-game resumes exactly where it left off.

## Controls & touch UX

Dragging is the whole game, so it must feel instant: pieces follow the finger at 60 fps, lifted above the finger so the player can see where they land.

**Drag**

- Use Pointer Events (`pointerdown/move/up/cancel`) with pointer capture. One active drag at a time.
- Tray pieces render at about 55% scale. On pickup, animate to full board-cell scale over 100 ms.
- Lift offset: the dragged piece sits about 1.5 cells above the touch point so the finger never covers it. Make this a setting.
- Snap: compute the target cell from the piece's top-left position rounded to the nearest cell, not from the finger.
- Hit target for tray pieces is the whole slot area, not just the filled cells.

**Ghost preview**

- While dragging over a valid spot, draw a translucent ghost of the piece on the board.
- Highlight rows and columns that would clear if dropped there (glow or brighter tint on those cells).
- Over an invalid spot, show no ghost.

**Feedback**

- Drop: short thunk sound plus light haptic.
- Line clear: cells pop and fade in a sweep (about 300 ms), score floats up, combo text ("Combo ×3").
- Invalid drop: snap back to tray, soft click.
- Haptics via `navigator.vibrate` when supported; silently skipped on iOS Safari.

**Other**

- Undo: 1 undo per level (setting can make it unlimited). Undo restores board, tray, score, and combo.
- Pause: tapping the gear pauses; app going to background auto-pauses and saves.
- One-handed reach: tray sits in the lower third of the screen.

## Visual & audio design

The look is a warm wooden table with glossy toy-brick tiles, all drawn in code with no image assets required.

**Visuals**

- Background: warm wood tone with a subtle procedural grain (CSS gradients or a pre-rendered offscreen canvas).
- Board: dark recessed tray with a raised wooden rim; empty cells are slightly darker squares with 2–3 px gaps.
- Tiles: rounded squares with a top highlight, bottom shadow, and 4 raised studs (circles with a highlight). Pre-render each color once to an offscreen canvas and blit it for performance.
- Palette (6+ colors): yellow, blue, orange, green, red, purple, cyan. Starting blocks in levels use one neutral color (for example yellow) so they read as "obstacles."
- Special cells: gem (sparkle icon inside a tile), stone (gray, cracks after the first clear), lock (padlock overlay).
- Top bar: back button, level number, progress bar toward target with the target number, settings gear.
- Dark mode is optional; the wooden theme is the default. A second theme (for example slate/neon) can come later via a theme token file.

**Audio**

- Synthesize all SFX with Web Audio: place (low wooden knock), clear (rising chime, pitch up with combo), board clear (short arpeggio), fail (soft descending tone), button tap.
- No background music in v1. Optional later: a gentle generated ambient loop.
- Sound and haptics toggles in settings, saved.

## Screens & navigation

The app has 5 screens and 2 overlays; Home's big Continue button gets the player into a level in one tap.

| Screen | Contents | Goes to |
| --- | --- | --- |
| Home | Title, Continue (next level), Levels, Endless, Daily, Settings, Stats | Any mode, Level map, Settings, Stats |
| Level map | Scrollable levels with stars, next level highlighted, jump-to-level | Game |
| Game | Top bar (back, level, progress, gear), board, tray | Pause overlay, Result overlay |
| Pause overlay | Resume, Restart, Sound/Haptics toggles, Quit to Home | Game, Home |
| Result overlay | Win: stars, score, Next / Replay. Fail: score vs target, Retry / Home | Next level, Game, Home |
| Settings | Sound, Haptics, Lift offset, Friendly deals, Undo count, Unlock all levels, Reset progress (with confirm), Export/Import save | Home |
| Stats | Levels beaten, total stars, endless high score, lines cleared, daily streak | Home |

Transitions are quick fades or slides (under 200 ms). The back gesture or button always works and never loses progress.

## Persistence & data model

All state lives in localStorage under one versioned key, saved after every placement and on `visibilitychange`.

```ts
type Cell =
  | { kind: 'empty' }
  | { kind: 'block'; color: ColorId }
  | { kind: 'gem'; color: ColorId }
  | { kind: 'stone'; hp: 1 | 2 }
  | { kind: 'lock' };

interface Piece { id: string; cells: [number, number][]; tier: 'easy' | 'medium' | 'hard'; color: ColorId; }

interface GameState {
  mode: 'level' | 'endless' | 'daily';
  levelNumber?: number;
  board: Cell[][];            // 8x8
  tray: (Piece | null)[];     // length 3
  score: number;
  combo: number;
  movesUsed: number;
  rngState: number;           // so the next deal is reproducible
  objectiveProgress: Record<string, number>;
  undoStack: Snapshot[];      // capped
}

interface SaveData {
  version: 1;
  highestLevelUnlocked: number;
  levels: Record<number, { bestScore: number; stars: 0 | 1 | 2 | 3 }>;
  endlessHighScore: number;
  daily: { lastDate: string; streak: number; results: Record<string, number> };
  stats: { linesCleared: number; piecesPlaced: number; gamesPlayed: number };
  settings: Settings;
  inProgress: GameState | null;
}
```

- Wrap every read and write in try/catch. If storage is unavailable or corrupt, start fresh and keep playing.
- Include a `migrate(save)` function keyed on `version`.
- Export/Import save as a JSON string (copy to clipboard / paste) so progress can move to a new phone.
- Note: iOS can clear storage for home-screen web apps that go unused for weeks. Export/Import is the backup.

## Architecture & file structure

Keep a hard split: `core/` is pure TypeScript game logic with no DOM, canvas, or storage access; everything else depends on it, never the reverse.

```
block-puzzle/
  index.html
  vite.config.ts
  public/
    manifest.webmanifest
    icons/                  # 180, 192, 512 px, generated from an SVG
  src/
    main.ts                 # boot, routing between screens
    config/
      scoring.ts
      difficulty.ts
      pieces.ts             # shape definitions + weights
      theme.ts              # colors, sizes
    core/                   # pure, unit-tested
      rng.ts                # seeded PRNG + hash
      board.ts              # canPlace, place, findFullLines, clearLines
      pieces.ts             # orientation generation, weighted draw
      dealer.ts             # deal 3 with fairness check
      scoring.ts
      game.ts               # GameState reducer: applyMove, undo, isGameOver
      objectives.ts
      levelgen.ts           # seed -> board, objective, piece sequence
      bot.ts                # greedy solver used by levelgen
    render/
      canvas.ts             # sizing, DPR scaling, safe areas
      tiles.ts              # pre-rendered tile sprites
      boardView.ts
      trayView.ts
      effects.ts            # clear sweeps, score popups, combo text
    input/
      drag.ts               # pointer events, lift offset, snapping
    ui/
      screens/              # home, levelMap, game, settings, stats
      overlays/             # pause, result, tips
    platform/
      storage.ts            # SaveData load/save/migrate
      audio.ts              # Web Audio SFX
      haptics.ts
    sw.ts                   # service worker (if not using the plugin)
  tests/
    board.test.ts
    scoring.test.ts
    levelgen.test.ts
    dealer.test.ts
```

- The game loop is event-driven: render on drag movement and during animations via `requestAnimationFrame`, idle otherwise to save battery.
- Canvas is sized to the viewport times `devicePixelRatio` for crisp tiles on Retina screens.
- `core/game.ts` exposes `applyMove(state, pieceIndex, row, col) => { state, events }`, where events (placed, linesCleared, combo, objectiveMet, gameOver) drive render effects and sounds.

## Testing & acceptance criteria

The build is done when every box below is checked on a real iPhone, installed from the home screen.

**Unit tests (Vitest, `core/` only)**

- [ ] `canPlace` rejects out-of-bounds and overlapping placements; accepts valid ones.
- [ ] Row, column, and simultaneous row+column clears; intersection cells counted once.
- [ ] Scoring matches the formula for 1–4 lines, combos, and board clear.
- [ ] Game-over detection is correct for boards with and without a fit.
- [ ] `levelgen(n)` returns identical output for the same `n` across runs.
- [ ] Generated levels never start with a full line and pass the bot check for levels 1–500.
- [ ] Save migration and corrupt-save recovery.

**On-device acceptance**

- [ ] Installs via Add to Home Screen, opens full-screen with no Safari UI.
- [ ] Launches and plays with airplane mode on.
- [ ] No zoom, scroll, text selection, or callout menus while playing.
- [ ] Drag stays smooth (no visible stutter) on the target phone; piece is visible above the finger.
- [ ] Ghost preview and clear-highlight are accurate.
- [ ] Force-quit mid-level, reopen: board, tray, score, and moves restore exactly.
- [ ] Level 1 is easy to win; level 100 is noticeably harder; every 10th is a breather.
- [ ] Export save on one device and import works.
- [ ] Zero network requests after first load (check in Safari Web Inspector).
- [ ] Layout respects the notch and home indicator in portrait.

## Build milestones & instructions for Claude Code

Build in 6 milestones, each ending in something playable on the phone; stop after each one so it can be tested before moving on.

1. **Engine + tests.** Scaffold Vite + TS + Vitest. Implement `core/` (rng, board, pieces, dealer, scoring, game reducer) with full unit tests. No UI yet.
2. **Playable endless mode.** Canvas board and tray, drag with lift offset and snapping, ghost preview, line clears, score, game over, restart. Plain colored squares are fine.
3. **PWA + persistence.** Manifest, icons, service worker, iOS meta tags, safe areas, touch lockdown. Autosave/resume, settings screen. Deploy to a static host and install on the iPhone.
4. **Level mode.** Level generator with bot check, objectives (score, lines, clear blocks first), level map, stars, result overlay, Continue button. Then gems, limited moves, stone, and locks with first-time tips.
5. **Polish.** Toy-brick tile rendering on the wooden theme, clear animations, score popups, combo text, synthesized SFX, haptics, undo.
6. **Extras.** Daily puzzle with streak, stats screen, export/import save, difficulty tuning pass across levels 1–200.

**Instructions to paste into Claude Code**

```text
Read SPEC.md fully before writing code. Build the game milestone by milestone, in order.
After each milestone: run the tests, run a production build, summarize what changed,
and list anything I should test on my iPhone. Then wait for my go-ahead.
Rules:
- Keep src/core free of DOM, canvas, storage, and audio APIs.
- Put every tunable number in src/config, not inline.
- No third-party runtime dependencies beyond Vite plugins unless you ask first.
- No network calls, analytics, or ads of any kind.
- All art and sound must be generated in code; do not copy assets from other games.
- When the spec is ambiguous, pick the simplest option, note it in DECISIONS.md, and keep going.
```

To hand this off: export this doc as Markdown, save it as `SPEC.md` in an empty project folder, and start Claude Code there.
