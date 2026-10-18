import { BOARD_SIZE, type Board, type Cell, type ClearedCell, type ColorId, type Coord } from './types';

const EMPTY: Cell = { kind: 'empty' };

export function emptyBoard(): Board {
  return Array.from({ length: BOARD_SIZE }, () => Array.from({ length: BOARD_SIZE }, () => EMPTY));
}

/** Rows are copied; cells are immutable values so they can be shared. */
export function cloneBoard(board: Board): Board {
  return board.map((row) => row.slice());
}

export function isFilled(cell: Cell): boolean {
  return cell.kind !== 'empty';
}

/** A starting obstacle that "Clear blocks" asks the player to remove. */
export function isStartCell(cell: Cell): boolean {
  return (cell.kind === 'block' && cell.start === true) || cell.kind === 'gem' || cell.kind === 'stone';
}

export function countStartCells(board: Board): number {
  let n = 0;
  for (const row of board) for (const cell of row) if (isStartCell(cell)) n++;
  return n;
}

export function inBounds(row: number, col: number): boolean {
  return row >= 0 && row < BOARD_SIZE && col >= 0 && col < BOARD_SIZE;
}

/** True if every cell of the shape lands on an empty, in-bounds cell. */
export function canPlace(board: Board, cells: readonly Coord[], row: number, col: number): boolean {
  for (const [dr, dc] of cells) {
    const r = row + dr;
    const c = col + dc;
    if (!inBounds(r, c) || board[r][c].kind !== 'empty') return false;
  }
  return true;
}

export function fitsAnywhere(board: Board, cells: readonly Coord[]): boolean {
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (canPlace(board, cells, r, c)) return true;
    }
  }
  return false;
}

/** Returns a new board with the shape placed. Caller must check canPlace first. */
export function place(board: Board, cells: readonly Coord[], row: number, col: number, color: ColorId): Board {
  const next = cloneBoard(board);
  const cell: Cell = { kind: 'block', color };
  for (const [dr, dc] of cells) next[row + dr][col + dc] = cell;
  return next;
}

export function findFullLines(board: Board): { rows: number[]; cols: number[] } {
  const rows: number[] = [];
  const cols: number[] = [];
  for (let r = 0; r < BOARD_SIZE; r++) {
    if (board[r].every(isFilled)) rows.push(r);
  }
  for (let c = 0; c < BOARD_SIZE; c++) {
    let full = true;
    for (let r = 0; r < BOARD_SIZE && full; r++) full = isFilled(board[r][c]);
    if (full) cols.push(c);
  }
  return { rows, cols };
}

export function hasFullLine(board: Board): boolean {
  const { rows, cols } = findFullLines(board);
  return rows.length > 0 || cols.length > 0;
}

export interface ClearResult {
  board: Board;
  cells: ClearedCell[];
  gems: number;
  /** Starting cells that are now gone (stones count when they break). */
  blocksCleared: number;
}

/** What one clear does to a cell. Locks never change; stones crack, then break. */
function clearCell(cell: Cell): Cell {
  switch (cell.kind) {
    case 'lock':
      return cell;
    case 'stone':
      return cell.hp === 2 ? { kind: 'stone', hp: 1 } : EMPTY;
    default:
      return EMPTY;
  }
}

/** Clears every given row and column at once; intersections are processed once. */
export function clearLines(board: Board, rows: readonly number[], cols: readonly number[]): ClearResult {
  const next = cloneBoard(board);
  const cells: ClearedCell[] = [];
  const seen = new Set<number>();
  let gems = 0;
  let blocksCleared = 0;
  const visit = (r: number, c: number) => {
    const key = r * BOARD_SIZE + c;
    if (seen.has(key)) return;
    seen.add(key);
    const before = board[r][c];
    const after = clearCell(before);
    if (after === before) return;
    next[r][c] = after;
    cells.push({ row: r, col: c, before, after });
    if (before.kind === 'gem') gems++;
    if (isStartCell(before) && after.kind === 'empty') blocksCleared++;
  };
  for (const r of rows) for (let c = 0; c < BOARD_SIZE; c++) visit(r, c);
  for (const c of cols) for (let r = 0; r < BOARD_SIZE; r++) visit(r, c);
  return { board: next, cells, gems, blocksCleared };
}

/** Empty apart from locks, which can never be cleared. */
export function isBoardClear(board: Board): boolean {
  for (const row of board) for (const cell of row) if (cell.kind !== 'empty' && cell.kind !== 'lock') return false;
  return true;
}

/** Lines that would clear if the shape were dropped at (row, col). For the ghost preview. */
export function previewClears(
  board: Board,
  cells: readonly Coord[],
  row: number,
  col: number,
): { rows: number[]; cols: number[] } {
  const filled = (r: number, c: number) =>
    board[r][c].kind !== 'empty' || cells.some(([dr, dc]) => row + dr === r && col + dc === c);
  const rows: number[] = [];
  const cols: number[] = [];
  const touchedRows = new Set(cells.map(([dr]) => row + dr));
  const touchedCols = new Set(cells.map(([, dc]) => col + dc));
  for (const r of touchedRows) {
    let full = true;
    for (let c = 0; c < BOARD_SIZE && full; c++) full = filled(r, c);
    if (full) rows.push(r);
  }
  for (const c of touchedCols) {
    let full = true;
    for (let r = 0; r < BOARD_SIZE && full; r++) full = filled(r, c);
    if (full) cols.push(c);
  }
  return { rows: rows.sort((a, b) => a - b), cols: cols.sort((a, b) => a - b) };
}
