import { objectiveLabel, objectiveValue } from '../../core/objectives';
import type { GameState } from '../../core/types';
import { fmt, h, starsEl } from '../dom';
import { showOverlay, type Overlay } from './overlay';

export interface ResultInfo {
  state: GameState;
  stars: number;
  best: number;
  newBest: boolean;
  streak?: number;
  canUndo: boolean;
  undosLeft: string;
}

export interface ResultActions {
  next?(): void;
  retry(): void;
  home(): void;
  undo(): void;
}

function reason(s: GameState): string {
  if (s.level?.moveLimit != null && s.movesUsed >= s.level.moveLimit) return 'Out of moves';
  return 'No room left';
}

export function showResult(parent: HTMLElement, r: ResultInfo, a: ResultActions): Overlay {
  const s = r.state;
  let ov: Overlay;
  const act = (fn: () => void) => () => {
    ov.close();
    fn();
  };
  const won = s.status === 'won';
  const title =
    s.mode === 'endless' ? 'Game over'
    : s.mode === 'daily' ? (won ? 'Daily complete!' : 'So close!')
    : won ? `Level ${s.levelNumber} complete!` : `Level ${s.levelNumber} failed`;

  const lines: HTMLElement[] = [];
  if (won && s.mode !== 'endless') lines.push(starsEl(r.stars, 'stars big pop'));
  lines.push(h('div', { class: 'result-score' }, fmt(s.score)));
  if (s.mode === 'endless') {
    lines.push(h('p', { class: r.newBest ? 'badge' : 'muted' }, r.newBest ? 'New best!' : `Best ${fmt(r.best)}`));
  } else if (!won && s.level) {
    lines.push(h('p', { class: 'muted' }, reason(s)));
    for (const o of s.level.objectives) {
      const v = objectiveValue(o, s.progress, s.score);
      lines.push(h('p', { class: 'goal-line' }, `${objectiveLabel(o)}: ${fmt(v)} / ${fmt(o.target)}`));
    }
  } else {
    lines.push(h('p', { class: r.newBest ? 'badge' : 'muted' }, r.newBest ? 'New best!' : `Best ${fmt(r.best)}`));
    if (r.streak) lines.push(h('p', { class: 'muted' }, `Daily streak: ${r.streak}`));
  }

  const buttons: HTMLElement[] = [];
  if (won && a.next) buttons.push(h('button', { class: 'btn primary big', onClick: act(a.next) }, 'Next level'));
  if (!won && r.canUndo) buttons.push(h('button', { class: 'btn primary big', onClick: act(a.undo) }, `Undo last move (${r.undosLeft})`));
  const againLabel = s.mode === 'endless' ? 'Play again' : won ? 'Replay' : 'Retry';
  buttons.push(h('button', { class: `btn ${!won && !r.canUndo ? 'primary big' : ''}`, onClick: act(a.retry) }, againLabel));
  buttons.push(h('button', { class: 'btn ghost', onClick: act(a.home) }, 'Home'));

  ov = showOverlay(parent, h('div', { class: 'stack result' }, h('h2', {}, title), ...lines, ...buttons), { cls: won ? 'win' : '' });
  return ov;
}
