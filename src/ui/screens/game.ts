import { TIMING } from '../../config/theme';
import { applyMove, canUndo, finish, newGame, undo } from '../../core/game';
import { generateDaily, generateLevel } from '../../core/levelgen';
import { computeStars, objectiveValue } from '../../core/objectives';
import { currentStreak, dateKey, recordDailyWin, recordLevelResult } from '../../core/save';
import type { GameEvent, GameState, Objective } from '../../core/types';
import { DragController } from '../../input/drag';
import { sfxClear, sfxFail, sfxFanfare, sfxInvalid, sfxPickup, sfxPlace } from '../../platform/audio';
import { haptics } from '../../platform/haptics';
import { drawBoard, drawPiece } from '../../render/boardView';
import { fitCanvas, type Layout } from '../../render/canvas';
import { Effects } from '../../render/effects';
import { clearSpriteCache } from '../../render/tiles';
import { drawTray } from '../../render/trayView';
import type { App, Route, Screen } from '../app';
import { fmt, h, icon, ICONS, starsEl } from '../dom';
import { type Overlay } from '../overlays/overlay';
import { showPause } from '../overlays/pause';
import { showResult } from '../overlays/result';
import { showTips } from '../overlays/tips';

type GameRoute = Extract<Route, { name: 'game' }>;

const LINE_WORDS = ['', '', 'Double!', 'Triple!', 'Amazing!', 'Incredible!'];

function goalText(o: Objective, s: GameState): { label: string; value: string; ratio: number } {
  const v = objectiveValue(o, s.progress, s.score);
  const ratio = Math.min(1, v / Math.max(1, o.target));
  switch (o.type) {
    case 'score':
      return { label: 'Score', value: `${fmt(Math.min(v, o.target))} / ${fmt(o.target)}`, ratio };
    case 'lines':
      return { label: 'Lines', value: `${Math.min(v, o.target)} / ${o.target}`, ratio };
    case 'gems':
      return { label: 'Gems', value: `${Math.min(v, o.target)} / ${o.target}`, ratio };
    case 'clearBlocks':
      return { label: 'Blocks', value: v >= o.target ? 'All clear' : `${o.target - v} left`, ratio };
  }
}

export function gameScreen(app: App, route: GameRoute): Screen {
  const mode = route.mode;
  const levelNumber = route.mode === 'level' ? route.level : undefined;
  const today = dateKey(new Date());
  const settings = () => app.save.settings;

  function fresh(): GameState {
    const friendly = settings().friendlyDeals;
    if (mode === 'level') {
      const lvl = generateLevel(levelNumber!);
      return newGame({ mode, seed: lvl.dealSeed, board: lvl.board, level: lvl.info, levelNumber, friendly });
    }
    if (mode === 'daily') {
      const lvl = generateDaily(today);
      return newGame({ mode, seed: lvl.dealSeed, board: lvl.board, level: lvl.info, dailyDate: today, friendly });
    }
    return newGame({ mode, seed: (Math.random() * 2 ** 32) >>> 0, friendly });
  }

  function resumed(): GameState | null {
    const g = app.save.inProgress[mode];
    if (!g || g.status !== 'playing') return null;
    if (mode === 'level' && g.levelNumber !== levelNumber) return null;
    if (mode === 'daily' && g.dailyDate !== today) return null;
    return g;
  }

  let state = resumed() ?? fresh();
  let finalized = false;
  let overlay: Overlay | null = null;
  let layout: Layout | null = null;
  let raf = 0;
  const effects = new Effects();

  // ---------------------------------------------------------------- DOM
  const titleText =
    mode === 'level' ? `Level ${levelNumber}`
    : mode === 'daily' ? 'Daily'
    : 'Endless';
  const tag =
    state.level?.boss ? h('span', { class: 'tag boss' }, 'Boss')
    : state.level?.breather ? h('span', { class: 'tag breather' }, 'Breather')
    : mode === 'daily' ? h('span', { class: 'tag' }, new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' }))
    : null;

  const canvas = h('canvas', { class: 'board-canvas' });
  const goalsEl = h('div', { class: 'goals' });
  const scoreEl = h('div', { class: 'score' }, '0');
  const leftSlot = h('div', { class: 'hud-side left' });
  const undoBtn = h('button', { class: 'btn icon-btn undo', 'aria-label': 'Undo', onClick: () => doUndo() }, icon(ICONS.undo), h('span', { class: 'count' }));
  const root = h(
    'div',
    { class: 'game-screen' },
    h(
      'header',
      { class: 'topbar' },
      h('button', { class: 'btn icon-btn', 'aria-label': 'Back', onClick: () => app.back() }, icon(ICONS.back)),
      h('div', { class: 'title' }, h('span', {}, titleText), tag),
      h('button', { class: 'btn icon-btn', 'aria-label': 'Pause', onClick: () => pause() }, icon(ICONS.gear)),
    ),
    h('div', { class: 'hud' }, goalsEl, h('div', { class: 'hud-row' }, leftSlot, scoreEl, h('div', { class: 'hud-side right' }, undoBtn))),
    h('div', { class: 'canvas-wrap' }, canvas),
  );
  const ctx = canvas.getContext('2d')!;

  function undoLimit() {
    return settings().undoCount;
  }

  let shownScore = state.score;
  function updateHud() {
    // Goals
    goalsEl.replaceChildren();
    if (state.level) {
      const stars = state.goalMet ? computeStars(state.level, true, state.score, state.movesUsed) : 0;
      for (const o of state.level.objectives) {
        const g = goalText(o, state);
        goalsEl.append(
          h(
            'div',
            { class: `goal ${g.ratio >= 1 ? 'met' : ''}` },
            h('div', { class: 'goal-head' }, h('span', {}, g.label), h('span', { class: 'goal-val' }, g.value)),
            h('div', { class: 'bar' }, h('div', { class: 'fill', style: `width:${(g.ratio * 100).toFixed(1)}%` })),
          ),
        );
      }
      if (state.goalMet) goalsEl.append(starsEl(stars, 'stars small live'));
    } else {
      goalsEl.append(h('div', { class: 'best' }, `Best ${fmt(Math.max(app.save.endlessHighScore, state.score))}`));
    }
    // Score
    if (state.score !== shownScore) {
      scoreEl.classList.remove('bump');
      void scoreEl.offsetWidth;
      scoreEl.classList.add('bump');
      shownScore = state.score;
    }
    scoreEl.textContent = fmt(state.score);
    // Left: moves left or Finish
    leftSlot.replaceChildren();
    if (state.level?.moveLimit != null) {
      const left = state.level.moveLimit - state.movesUsed;
      leftSlot.append(h('div', { class: `chip ${left <= 3 ? 'warn' : ''}` }, h('b', {}, String(left)), h('span', {}, 'moves')));
    } else if (state.goalMet && state.status === 'playing') {
      leftSlot.append(h('button', { class: 'btn small primary', onClick: () => doFinish() }, 'Finish'));
    }
    // Undo
    const limit = undoLimit();
    undoBtn.disabled = !canUndo(state, limit) || state.status !== 'playing';
    undoBtn.style.visibility = limit === 0 ? 'hidden' : 'visible';
    (undoBtn.querySelector('.count') as HTMLElement).textContent = limit < 0 ? '' : String(Math.max(0, limit - state.undosUsed));
  }

  // ---------------------------------------------------------------- saving
  function saveProgress() {
    if (state.status === 'playing') app.save.inProgress[mode] = state;
    else delete app.save.inProgress[mode];
    app.save.active = mode;
    app.persist();
  }

  // ---------------------------------------------------------------- render loop
  function request() {
    if (!raf) raf = requestAnimationFrame(frame);
  }

  function frame(now: number) {
    raf = 0;
    const l = layout;
    if (!l) return;
    const anim = drag.animating(now);
    ctx.setTransform(l.dpr, 0, 0, l.dpr, 0, 0);
    ctx.clearRect(0, 0, l.width, l.height);
    const view = drag.view(now);
    const t = view?.target;
    drawBoard(
      ctx,
      l,
      state.board,
      view && t ? { ghost: { cells: view.piece.cells, row: t.row, col: t.col, color: view.piece.color }, clearRows: t.rows, clearCols: t.cols, pulse: now } : {},
    );
    effects.draw(ctx, l, now);
    drawTray(ctx, l, state.tray, state.board, drag.hiddenSlot());
    if (view) {
      ctx.save();
      ctx.shadowColor = 'rgba(40,20,5,0.45)';
      ctx.shadowBlur = view.pitch * 0.4;
      ctx.shadowOffsetY = view.pitch * 0.18;
      drawPiece(ctx, l, view.piece.cells, view.piece.color, view.x, view.y, view.pitch);
      ctx.restore();
    }
    if (anim || effects.active) request();
  }

  // ---------------------------------------------------------------- events → effects, sound, haptics
  function handleEvents(events: GameEvent[]) {
    const l = layout;
    const now = performance.now();
    let placedAt: { row: number; col: number } = { row: 3.5, col: 3.5 };
    for (const e of events) {
      switch (e.type) {
        case 'placed': {
          const rows = e.cells.map(([r]) => r);
          const cols = e.cells.map(([, c]) => c);
          placedAt = { row: e.row + (Math.min(...rows) + Math.max(...rows)) / 2, col: e.col + (Math.min(...cols) + Math.max(...cols)) / 2 };
          sfxPlace();
          haptics.light();
          break;
        }
        case 'linesCleared': {
          effects.lineClear(e.cells, Math.round(placedAt.row), Math.round(placedAt.col), now);
          sfxClear(e.lines, e.combo);
          haptics.medium();
          if (!l) break;
          const cx = l.boardX + (placedAt.col + 0.5) * l.pitch;
          const cy = l.boardY + (placedAt.row + 0.5) * l.pitch;
          effects.text(`+${e.points}`, cx, cy, now, { size: Math.round(l.pitch * 0.55) });
          const mid = { x: l.boardX + l.boardSize / 2, y: l.boardY + l.boardSize * 0.42 };
          if (e.combo >= 2) {
            effects.text(`Combo ×${e.combo}`, mid.x, mid.y, now, { size: Math.round(l.pitch * 0.8), dur: TIMING.comboMs, rise: 20, color: '#ffd54a' });
          } else if (e.lines >= 2) {
            effects.text(LINE_WORDS[Math.min(e.lines, LINE_WORDS.length - 1)], mid.x, mid.y, now, { size: Math.round(l.pitch * 0.75), dur: TIMING.comboMs, rise: 20, color: '#ffe9a8' });
          }
          break;
        }
        case 'boardClear':
          sfxFanfare();
          if (l) effects.text(`Board clear! +${e.points}`, l.boardX + l.boardSize / 2, l.boardY + l.boardSize * 0.58, now, { size: Math.round(l.pitch * 0.62), dur: TIMING.bannerMs, rise: 16, color: '#9ff59a' });
          break;
        case 'objectiveMet':
          if (state.status === 'playing') {
            sfxFanfare();
            haptics.success();
            if (l) effects.text('Goal complete!', l.boardX + l.boardSize / 2, l.boardY + l.boardSize * 0.3, now, { size: Math.round(l.pitch * 0.62), dur: TIMING.bannerMs, rise: 10, color: '#9ff59a' });
          }
          break;
        default:
          break;
      }
    }
    request();
  }

  // ---------------------------------------------------------------- game end
  function onEnd() {
    if (!finalized) {
      finalized = true;
      app.save.stats.gamesPlayed++;
    }
    const won = state.status === 'won';
    let stars = 0;
    let best = 0;
    let newBest = false;
    let streak: number | undefined;
    if (mode === 'level' && state.level && levelNumber) {
      stars = computeStars(state.level, state.goalMet, state.score, state.movesUsed);
      const prev = app.save.levels[levelNumber]?.bestScore ?? 0;
      app.save = recordLevelResult(app.save, levelNumber, state.score, stars as 0 | 1 | 2 | 3);
      best = Math.max(prev, state.score);
      newBest = won && prev > 0 && state.score > prev;
    } else if (mode === 'daily') {
      const prev = app.save.daily.results[today] ?? 0;
      if (won) app.save = recordDailyWin(app.save, today, state.score);
      stars = state.level ? computeStars(state.level, state.goalMet, state.score, state.movesUsed) : 0;
      best = Math.max(prev, won ? state.score : 0);
      newBest = won && prev > 0 && state.score > prev;
      streak = currentStreak(app.save, today);
    } else {
      const prev = app.save.endlessHighScore;
      app.save.endlessHighScore = Math.max(prev, state.score);
      best = app.save.endlessHighScore;
      newBest = state.score > prev;
    }
    saveProgress();
    updateHud();

    setTimeout(() => {
      if (won || newBest) {
        sfxFanfare();
        haptics.success();
      } else {
        sfxFail();
        haptics.fail();
      }
      const limit = undoLimit();
      overlay = showResult(
        root,
        {
          state,
          stars,
          best,
          newBest,
          streak,
          canUndo: canUndo(state, limit),
          undosLeft: limit < 0 ? '∞' : String(limit - state.undosUsed),
        },
        {
          next: mode === 'level' ? () => app.go({ name: 'game', mode: 'level', level: levelNumber! + 1 }, { replace: true }) : undefined,
          retry: () => restart(),
          home: () => app.back(),
          undo: () => doUndo(),
        },
      );
    }, TIMING.clearMs + 450);
  }

  // ---------------------------------------------------------------- actions
  function restart() {
    state = fresh();
    finalized = false;
    effects.clear();
    drag.cancel();
    saveProgress();
    updateHud();
    request();
  }

  function doUndo() {
    if (!canUndo(state, undoLimit())) return;
    state = undo(state);
    effects.clear();
    drag.cancel();
    saveProgress();
    updateHud();
    request();
  }

  function doFinish() {
    state = finish(state);
    if (state.status !== 'playing') onEnd();
  }

  function pause() {
    if (overlay?.open || state.status !== 'playing') return;
    drag.cancel();
    overlay = showPause(root, app, {
      resume: () => request(),
      restart: () => restart(),
      quit: () => app.back(),
    });
  }

  // ---------------------------------------------------------------- input
  const drag = new DragController(canvas, {
    layout: () => layout!,
    board: () => state.board,
    tray: () => state.tray,
    liftCells: () => settings().liftOffset,
    canInteract: () => !!layout && state.status === 'playing' && !overlay?.open,
    onPickup: () => sfxPickup(),
    onDrop: (slot, row, col) => {
      const res = applyMove(state, slot, row, col, { friendly: settings().friendlyDeals });
      if (res.events[0]?.type === 'invalid') return false;
      state = res.state;
      app.save.stats.piecesPlaced++;
      for (const e of res.events) if (e.type === 'linesCleared') app.save.stats.linesCleared += e.lines;
      handleEvents(res.events);
      saveProgress();
      updateHud();
      if (state.status !== 'playing') onEnd();
      return true;
    },
    onInvalidDrop: () => sfxInvalid(),
    requestRender: request,
  });

  let lastCell = 0;
  const stopFit = fitCanvas(canvas, (l) => {
    if (Math.round(l.cell * l.dpr) !== lastCell) {
      clearSpriteCache();
      lastCell = Math.round(l.cell * l.dpr);
    }
    layout = l;
    request();
  });

  // ---------------------------------------------------------------- start
  saveProgress();
  updateHud();
  if (state.status !== 'playing') onEnd();

  const tipKeys: string[] = [];
  if (mode === 'endless' || levelNumber === 1) tipKeys.push('basics');
  if (state.level?.boss) tipKeys.push('boss');
  for (const m of state.level?.mechanics ?? []) tipKeys.push(m);
  const unseen = tipKeys.filter((k) => !app.save.tipsSeen.includes(k));
  if (unseen.length) {
    setTimeout(() => {
      overlay = showTips(
        root,
        unseen,
        (k) => {
          app.save.tipsSeen.push(k);
          app.persist();
        },
        () => request(),
      );
    }, 250);
  }

  return {
    el: root,
    destroy() {
      drag.destroy();
      stopFit();
      if (raf) cancelAnimationFrame(raf);
      if (state.status === 'playing') app.save.inProgress[mode] = state;
      app.save.active = null;
      app.persist();
    },
    onHide() {
      saveProgress();
      pause();
    },
  };
}
