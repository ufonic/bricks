import { describe, expect, it } from 'vitest';
import { canCompleteLine, dealTray } from '../src/core/dealer';
import { emptyBoard, fitsAnywhere, hasFullLine } from '../src/core/board';
import { SHAPES, shapeById, tierWeightsFor } from '../src/core/pieces';
import { createRng } from '../src/core/rng';
import { fillRow } from './helpers';
import type { ColorId } from '../src/core/types';

const colors: ColorId[] = ['red', 'blue', 'green'];
const opts = { tierWeights: tierWeightsFor(0.5), colors };

describe('piece set', () => {
  it('has 37 pieces with unique ids', () => {
    expect(SHAPES).toHaveLength(37);
    expect(new Set(SHAPES.map((s) => s.id)).size).toBe(37);
  });
  it('has the expected orientation counts', () => {
    const count = (prefix: string) => SHAPES.filter((s) => s.id.startsWith(prefix)).length;
    expect(count('L3')).toBe(4);
    expect(count('L4')).toBe(8);
    expect(count('T4')).toBe(4);
    expect(count('S4')).toBe(4);
    expect(count('L5')).toBe(4);
    expect(count('rect23')).toBe(2);
    expect(shapeById('h2')!.cols).toBe(2);
    expect(shapeById('v2')!.rows).toBe(2);
  });
});

describe('dealTray', () => {
  it('deals 3 pieces with distinct colors', () => {
    const tray = dealTray(emptyBoard(), createRng(7), opts);
    expect(tray).toHaveLength(3);
    expect(new Set(tray.map((p) => p.color)).size).toBe(3);
  });
  it('is deterministic for the same seed', () => {
    expect(dealTray(emptyBoard(), createRng(42), opts)).toEqual(dealTray(emptyBoard(), createRng(42), opts));
  });
  it('guarantees a fit when only single cells are free', () => {
    // A diagonal of holes: no full line, and only the dot fits anywhere.
    const b = emptyBoard();
    for (let r = 0; r < 8; r++) fillRow(b, r, [r]);
    expect(hasFullLine(b)).toBe(false);
    for (let seed = 0; seed < 30; seed++) {
      const tray = dealTray(b, createRng(seed), { ...opts, tierWeights: { easy: 1, medium: 1, hard: 1 } });
      expect(tray.some((p) => fitsAnywhere(b, p.cells))).toBe(true);
    }
  });
  it('returns a non-fitting tray on a full board (legit game over)', () => {
    const b = emptyBoard();
    for (let r = 0; r < 8; r++) fillRow(b, r);
    const tray = dealTray(b, createRng(1), opts);
    expect(tray.some((p) => fitsAnywhere(b, p.cells))).toBe(false);
  });
  it('canCompleteLine detects line makers', () => {
    const b = emptyBoard();
    fillRow(b, 0, [6, 7]);
    expect(canCompleteLine(b, shapeById('h2')!)).toBe(true);
    expect(canCompleteLine(b, shapeById('v2')!)).toBe(false);
  });
});
