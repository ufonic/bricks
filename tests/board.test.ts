import { describe, expect, it } from 'vitest';
import { canPlace, clearLines, emptyBoard, findFullLines, isBoardClear, place, previewClears } from '../src/core/board';
import { B, boardFrom, DOT, fillCol, fillRow } from './helpers';
import type { Coord } from '../src/core/types';

const H3: Coord[] = [[0, 0], [0, 1], [0, 2]];

describe('canPlace', () => {
  it('accepts valid placements', () => {
    const b = emptyBoard();
    expect(canPlace(b, H3, 0, 0)).toBe(true);
    expect(canPlace(b, H3, 7, 5)).toBe(true);
  });
  it('rejects out-of-bounds placements', () => {
    const b = emptyBoard();
    expect(canPlace(b, H3, 0, 6)).toBe(false);
    expect(canPlace(b, H3, 8, 0)).toBe(false);
    expect(canPlace(b, H3, -1, 0)).toBe(false);
    expect(canPlace(b, H3, 0, -1)).toBe(false);
  });
  it('rejects overlapping placements, including special cells', () => {
    const b = boardFrom(['..#', '', '...G', 'L', 'O']);
    expect(canPlace(b, H3, 0, 0)).toBe(false);
    expect(canPlace(b, H3, 1, 0)).toBe(true);
    expect(canPlace(b, H3, 2, 1)).toBe(false);
    expect(canPlace(b, DOT, 3, 0)).toBe(false);
    expect(canPlace(b, DOT, 4, 0)).toBe(false);
  });
  it('place does not mutate the input', () => {
    const b = emptyBoard();
    const next = place(b, H3, 0, 0, 'red');
    expect(b[0][0].kind).toBe('empty');
    expect(next[0][2]).toEqual({ kind: 'block', color: 'red' });
  });
});

describe('clearing', () => {
  it('finds and clears a full row', () => {
    const b = emptyBoard();
    fillRow(b, 3);
    b[4][0] = B;
    expect(findFullLines(b)).toEqual({ rows: [3], cols: [] });
    const res = clearLines(b, [3], []);
    expect(res.cells).toHaveLength(8);
    expect(res.board[3].every((c) => c.kind === 'empty')).toBe(true);
    expect(res.board[4][0]).toBe(B);
  });
  it('finds and clears a full column', () => {
    const b = emptyBoard();
    fillCol(b, 6);
    expect(findFullLines(b)).toEqual({ rows: [], cols: [6] });
    expect(clearLines(b, [], [6]).cells).toHaveLength(8);
  });
  it('clears a row and column together, counting the intersection once', () => {
    const b = emptyBoard();
    fillRow(b, 2);
    fillCol(b, 5);
    expect(findFullLines(b)).toEqual({ rows: [2], cols: [5] });
    const res = clearLines(b, [2], [5]);
    expect(res.cells).toHaveLength(15);
    expect(isBoardClear(res.board)).toBe(true);
  });
  it('stones crack then break, locks never clear, gems are collected', () => {
    const b = boardFrom(['OoLG####']);
    const res = clearLines(b, [0], []);
    expect(res.board[0][0]).toEqual({ kind: 'stone', hp: 1 });
    expect(res.board[0][1].kind).toBe('empty');
    expect(res.board[0][2].kind).toBe('lock');
    expect(res.gems).toBe(1);
    expect(res.blocksCleared).toBe(2); // the broken stone + the gem
    expect(isBoardClear(res.board)).toBe(false);
  });
  it('treats a board with only locks as clear', () => {
    expect(isBoardClear(boardFrom(['L......L']))).toBe(true);
  });
  it('previewClears predicts lines for a drop', () => {
    const b = emptyBoard();
    fillRow(b, 0, [5, 6, 7]);
    fillCol(b, 7, [0]);
    expect(previewClears(b, H3, 0, 5)).toEqual({ rows: [0], cols: [7] });
    expect(previewClears(b, H3, 1, 0)).toEqual({ rows: [], cols: [] });
  });
});
