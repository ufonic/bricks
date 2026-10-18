import { describe, expect, it } from 'vitest';
import { applyMove, newGame } from '../src/core/game';
import { clearPoints, placementPoints, tidy } from '../src/core/scoring';
import { emptyBoard } from '../src/core/board';
import { B, fillCol, fillRow } from './helpers';
import type { GameState, Piece } from '../src/core/types';

const dot: Piece = { id: 'dot', cells: [[0, 0]], tier: 'easy', color: 'red' };

function stateWith(board = emptyBoard(), combo = 0): GameState {
  const s = newGame({ mode: 'endless', seed: 1, board });
  return { ...s, board, combo, tray: [dot, dot, dot], score: 0 };
}

describe('scoring formula', () => {
  it('lines bonus is 10 × lines²', () => {
    expect([1, 2, 3, 4].map((l) => clearPoints(l, 1))).toEqual([10, 40, 90, 160]);
    expect(clearPoints(0, 3)).toBe(0);
  });
  it('combo multiplies the clear bonus', () => {
    expect(clearPoints(1, 2)).toBe(20);
    expect(clearPoints(2, 3)).toBe(120);
  });
  it('one point per cell', () => {
    expect(placementPoints(4)).toBe(4);
  });
  it('tidy rounds targets', () => {
    expect(tidy(123)).toBe(120);
    expect(tidy(47)).toBe(45);
    expect(tidy(2370)).toBe(2350);
    expect(tidy(1)).toBe(5);
  });
});

describe('scoring in play', () => {
  it('single line: cell + 10', () => {
    const b = emptyBoard();
    fillRow(b, 0, [7]);
    b[5][5] = B; // keep the board from becoming empty
    const { state, events } = applyMove(stateWith(b), 0, 0, 7);
    expect(state.score).toBe(1 + 10);
    expect(state.combo).toBe(1);
    expect(events.some((e) => e.type === 'linesCleared' && e.lines === 1)).toBe(true);
  });
  it('row + column with one dot: 1 + 40', () => {
    const b = emptyBoard();
    fillRow(b, 0, [0]);
    fillCol(b, 0, [0]);
    b[5][5] = B;
    expect(applyMove(stateWith(b), 0, 0, 0).state.score).toBe(41);
  });
  it('combo continues on consecutive clears and resets on a miss', () => {
    const b = emptyBoard();
    fillRow(b, 0, [7]);
    fillRow(b, 1, [7]);
    b[5][5] = B;
    let s = applyMove(stateWith(b), 0, 0, 7).state; // combo 1: +1 +10
    s = applyMove(s, 1, 1, 7).state; // combo 2: +1 +20
    expect(s.combo).toBe(2);
    expect(s.score).toBe(11 + 21);
    s = applyMove(s, 2, 6, 6).state; // no clear
    expect(s.combo).toBe(0);
    expect(s.score).toBe(33);
  });
  it('board clear adds 300', () => {
    const b = emptyBoard();
    fillRow(b, 0, [7]);
    const { state, events } = applyMove(stateWith(b), 0, 0, 7);
    expect(state.score).toBe(1 + 10 + 300);
    expect(events.some((e) => e.type === 'boardClear')).toBe(true);
  });
});
