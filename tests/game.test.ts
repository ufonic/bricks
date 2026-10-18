import { describe, expect, it } from 'vitest';
import { applyMove, canUndo, isGameOver, newGame, undo } from '../src/core/game';
import { emptyBoard } from '../src/core/board';
import { computeStars } from '../src/core/objectives';
import { fillRow } from './helpers';
import type { GameState, LevelInfo, Piece } from '../src/core/types';

const dot: Piece = { id: 'dot', cells: [[0, 0]], tier: 'easy', color: 'red' };
const sq3: Piece = {
  id: 'sq3',
  cells: [[0, 0], [0, 1], [0, 2], [1, 0], [1, 1], [1, 2], [2, 0], [2, 1], [2, 2]],
  tier: 'hard',
  color: 'blue',
};

const level = (over: Partial<LevelInfo> = {}): LevelInfo => ({
  objectives: [{ type: 'score', target: 5 }],
  moveLimit: null,
  parMoves: 4,
  difficulty: 0.2,
  boss: false,
  breather: false,
  mechanics: [],
  ...over,
});

function withTray(s: GameState, tray: (Piece | null)[]): GameState {
  return { ...s, tray };
}

describe('game over detection', () => {
  it('is not over when a piece fits', () => {
    const s = withTray(newGame({ mode: 'endless', seed: 3 }), [sq3, null, null]);
    expect(isGameOver(s)).toBe(false);
  });
  it('is over when no remaining piece fits', () => {
    const b = emptyBoard();
    for (let r = 0; r < 8; r++) fillRow(b, r, [r]); // only single holes
    const s = { ...withTray(newGame({ mode: 'endless', seed: 3 }), [sq3, sq3, null]), board: b };
    expect(isGameOver(s)).toBe(true);
    expect(isGameOver({ ...s, tray: [sq3, dot, null] })).toBe(false);
  });
  it('ends the game after a placement leaves nothing that fits', () => {
    const b = emptyBoard();
    for (let r = 0; r < 8; r++) fillRow(b, r, r === 0 ? [0, 4] : [r]); // row 0 has two holes, no full lines
    let s = { ...withTray(newGame({ mode: 'endless', seed: 3 }), [dot, sq3, null]), board: b };
    const res = applyMove(s, 0, 0, 4);
    s = res.state;
    expect(s.status).toBe('over');
    expect(res.events.at(-1)).toEqual({ type: 'gameOver', status: 'over' });
  });
});

describe('applyMove', () => {
  it('rejects invalid moves without changing state', () => {
    const s = withTray(newGame({ mode: 'endless', seed: 3 }), [sq3, null, null]);
    const res = applyMove(s, 0, 6, 6);
    expect(res.state).toBe(s);
    expect(res.events).toEqual([{ type: 'invalid' }]);
    expect(applyMove(s, 1, 0, 0).events).toEqual([{ type: 'invalid' }]);
  });
  it('removes the placed piece and deals only after all three are used', () => {
    let s = withTray(newGame({ mode: 'endless', seed: 3 }), [dot, dot, dot]);
    s = applyMove(s, 1, 0, 0).state;
    expect(s.tray[1]).toBeNull();
    expect(s.tray[0]).toBe(dot);
    s = applyMove(s, 0, 0, 1).state;
    const res = applyMove(s, 2, 0, 2);
    expect(res.events.some((e) => e.type === 'dealt')).toBe(true);
    expect(res.state.tray.every((p) => p !== null)).toBe(true);
  });
  it('replays identically from the same seed', () => {
    const play = () => {
      let s = newGame({ mode: 'endless', seed: 99 });
      for (let i = 0; i < 6; i++) {
        const idx = s.tray.findIndex((p) => p);
        outer: for (let r = 0; r < 8; r++)
          for (let c = 0; c < 8; c++) {
            const res = applyMove(s, idx, r, c);
            if (res.events[0].type !== 'invalid') {
              s = res.state;
              break outer;
            }
          }
      }
      return s;
    };
    const a = play();
    const b = play();
    expect(a.board).toEqual(b.board);
    expect(a.tray).toEqual(b.tray);
    expect(a.rngState).toBe(b.rngState);
  });
});

describe('levels', () => {
  it('ends the level as won the moment the goal is met', () => {
    const s = withTray(newGame({ mode: 'level', seed: 1, level: level() }), [sq3, null, sq3]);
    const res = applyMove(s, 0, 0, 0);
    expect(res.state.goalMet).toBe(true);
    expect(res.state.status).toBe('won');
    expect(res.events.some((e) => e.type === 'objectiveMet')).toBe(true);
    expect(res.events.at(-1)).toEqual({ type: 'gameOver', status: 'won' });
    // No further moves once won.
    expect(applyMove(res.state, 2, 4, 4).events).toEqual([{ type: 'invalid' }]);
  });
  it('keeps playing while the goal is not yet met', () => {
    const s = withTray(newGame({ mode: 'level', seed: 1, level: level({ objectives: [{ type: 'score', target: 50 }] }) }), [sq3, null, sq3]);
    expect(applyMove(s, 0, 0, 0).state.status).toBe('playing');
  });
  it('fails a move-limited level when moves run out', () => {
    let s = withTray(
      newGame({ mode: 'level', seed: 1, level: level({ objectives: [{ type: 'lines', target: 5 }], moveLimit: 2 }) }),
      [dot, dot, dot],
    );
    s = applyMove(s, 0, 0, 0).state;
    expect(s.status).toBe('playing');
    s = applyMove(s, 1, 4, 4).state;
    expect(s.status).toBe('lost');
  });
  it('wins a move-limited level as soon as the goal is met', () => {
    const s = withTray(newGame({ mode: 'level', seed: 1, level: level({ moveLimit: 10 }) }), [sq3, dot, dot]);
    const after = applyMove(s, 0, 0, 0).state;
    expect(after.status).toBe('won');
    expect(computeStars(after.level!, after.goalMet, after.movesUsed)).toBe(3);
  });
  it('stars reward reaching the goal in fewer moves than par', () => {
    const info = level({ parMoves: 10 });
    expect(computeStars(info, false, 1)).toBe(0);
    expect(computeStars(info, true, 10)).toBe(3);
    expect(computeStars(info, true, 15)).toBe(2);
    expect(computeStars(info, true, 16)).toBe(1);
  });
});

describe('undo', () => {
  it('restores board, tray, score and combo', () => {
    const b = emptyBoard();
    fillRow(b, 0, [7]);
    b[4][4] = { kind: 'block', color: 'red' };
    const s0 = { ...withTray(newGame({ mode: 'endless', seed: 5 }), [dot, dot, dot]), board: b };
    const s1 = applyMove(s0, 0, 0, 7).state;
    expect(s1.score).toBe(11);
    expect(canUndo(s1, 1)).toBe(true);
    const back = undo(s1);
    expect(back.board).toEqual(s0.board);
    expect(back.tray).toEqual(s0.tray);
    expect(back.score).toBe(0);
    expect(back.combo).toBe(0);
    expect(back.rngState).toBe(s0.rngState);
    expect(canUndo(back, 1)).toBe(false);
    expect(canUndo(back, -1)).toBe(false); // stack is empty
  });
});
