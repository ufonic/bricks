import { emptyBoard } from '../src/core/board';
import type { Board, Cell, Coord } from '../src/core/types';

export const B: Cell = { kind: 'block', color: 'blue' };

/** Board from strings: '.' empty, '#' block, 'S' start block, 'G' gem, 'O' stone(2), 'o' stone(1), 'L' lock. */
export function boardFrom(rows: string[]): Board {
  const b = emptyBoard();
  rows.forEach((line, r) =>
    [...line].forEach((ch, c) => {
      b[r][c] =
        ch === '#' ? B
        : ch === 'S' ? { kind: 'block', color: 'yellow', start: true }
        : ch === 'G' ? { kind: 'gem', color: 'yellow' }
        : ch === 'O' ? { kind: 'stone', hp: 2 }
        : ch === 'o' ? { kind: 'stone', hp: 1 }
        : ch === 'L' ? { kind: 'lock' }
        : { kind: 'empty' };
    }),
  );
  return b;
}

export function fillRow(b: Board, r: number, except: number[] = []) {
  for (let c = 0; c < 8; c++) if (!except.includes(c)) b[r][c] = B;
}

export function fillCol(b: Board, c: number, except: number[] = []) {
  for (let r = 0; r < 8; r++) if (!except.includes(r)) b[r][c] = B;
}

export const DOT: Coord[] = [[0, 0]];
