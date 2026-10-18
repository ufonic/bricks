import { THEME } from '../config/theme';
import { BOARD_SIZE, type Board, type ColorId, type Coord } from '../core/types';
import type { Layout } from './canvas';
import { brickSprite, cellSprite, roundRect } from './tiles';

let frameCache: { key: string; canvas: HTMLCanvasElement } | null = null;

/** Wooden rim, dark recess and empty cell wells, pre-rendered once per layout. */
function boardFrame(l: Layout): HTMLCanvasElement {
  const key = `${l.width}x${l.height}@${l.dpr}:${l.pitch}`;
  if (frameCache?.key === key) return frameCache.canvas;
  const c = document.createElement('canvas');
  const outer = l.boardSize + l.rim * 2;
  c.width = c.height = Math.ceil(outer * l.dpr);
  const ctx = c.getContext('2d')!;
  ctx.scale(l.dpr, l.dpr);

  // Raised wooden rim with a little procedural grain.
  const rimGrad = ctx.createLinearGradient(0, 0, 0, outer);
  rimGrad.addColorStop(0, THEME.rimLight);
  rimGrad.addColorStop(1, THEME.rimDark);
  roundRect(ctx, 0, 0, outer, outer, l.rim * 1.1);
  ctx.fillStyle = rimGrad;
  ctx.fill();
  ctx.save();
  ctx.clip();
  ctx.globalAlpha = 0.12;
  ctx.strokeStyle = '#3b2210';
  for (let i = 0; i < 26; i++) {
    const y = (i / 26) * outer;
    ctx.lineWidth = 0.6 + ((i * 7) % 5) * 0.25;
    ctx.beginPath();
    ctx.moveTo(0, y);
    for (let x = 0; x <= outer; x += outer / 12) ctx.lineTo(x, y + Math.sin(x * 0.03 + i * 1.7) * 2.2);
    ctx.stroke();
  }
  ctx.restore();
  // Rim bevel highlight.
  roundRect(ctx, 1, 1, outer - 2, outer - 2, l.rim * 1.05);
  ctx.strokeStyle = 'rgba(255,230,190,0.35)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Recessed tray.
  const inset = l.rim * 0.55;
  roundRect(ctx, inset, inset, outer - inset * 2, outer - inset * 2, l.rim * 0.6);
  ctx.fillStyle = THEME.boardRecess;
  ctx.fill();
  ctx.save();
  ctx.clip();
  ctx.shadowColor = 'rgba(0,0,0,0.6)';
  ctx.shadowBlur = l.pitch * 0.25;
  ctx.shadowOffsetY = l.pitch * 0.06;
  ctx.strokeStyle = 'rgba(0,0,0,0.7)';
  ctx.lineWidth = l.pitch * 0.12;
  roundRect(ctx, inset - l.pitch * 0.06, inset - l.pitch * 0.06, outer - inset * 2 + l.pitch * 0.12, outer - inset * 2 + l.pitch * 0.12, l.rim * 0.6);
  ctx.stroke();
  ctx.restore();

  // Empty cell wells.
  const gap = (l.pitch - l.cell) / 2;
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let col = 0; col < BOARD_SIZE; col++) {
      const x = l.rim + col * l.pitch + gap;
      const y = l.rim + r * l.pitch + gap;
      roundRect(ctx, x, y, l.cell, l.cell, l.cell * 0.14);
      ctx.fillStyle = THEME.emptyCell;
      ctx.fill();
      ctx.strokeStyle = THEME.emptyCellEdge;
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }
  frameCache = { key, canvas: c };
  return c;
}

export function cellRect(l: Layout, row: number, col: number): { x: number; y: number; size: number } {
  const gap = (l.pitch - l.cell) / 2;
  return { x: l.boardX + col * l.pitch + gap, y: l.boardY + row * l.pitch + gap, size: l.cell };
}

export interface BoardOverlay {
  ghost?: { cells: Coord[]; row: number; col: number; color: ColorId };
  clearRows?: number[];
  clearCols?: number[];
  /** Cells drawn by an effect instead (key = row * 8 + col). */
  hidden?: Set<number>;
  pulse?: number;
}

export function drawBoard(ctx: CanvasRenderingContext2D, l: Layout, board: Board, o: BoardOverlay = {}): void {
  const frame = boardFrame(l);
  const outer = l.boardSize + l.rim * 2;
  ctx.drawImage(frame, l.boardX - l.rim, l.boardY - l.rim, outer, outer);

  const px = Math.round(l.cell * l.dpr);
  const clearR = new Set(o.clearRows ?? []);
  const clearC = new Set(o.clearCols ?? []);
  const willClear = (r: number, c: number) => clearR.has(r) || clearC.has(c);
  const highlightSprite = o.ghost ? brickSprite(o.ghost.color, px) : null;

  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (o.hidden?.has(r * BOARD_SIZE + c)) continue;
      const cell = board[r][c];
      const sprite = cellSprite(cell, px);
      if (!sprite) continue;
      const { x, y, size } = cellRect(l, r, c);
      // Cells about to clear take the dragged piece's color (locks keep their look).
      const lit = highlightSprite && willClear(r, c) && cell.kind !== 'lock';
      ctx.drawImage(lit ? highlightSprite : sprite, x, y, size, size);
    }
  }

  if (o.ghost) {
    const g = o.ghost;
    const sprite = brickSprite(g.color, px);
    const anyClear = clearR.size + clearC.size > 0;
    ctx.globalAlpha = anyClear ? 0.85 : THEME.ghostAlpha;
    for (const [dr, dc] of g.cells) {
      const { x, y, size } = cellRect(l, g.row + dr, g.col + dc);
      ctx.drawImage(sprite, x, y, size, size);
    }
    ctx.globalAlpha = 1;
  }

  // Glow over lines that would clear.
  if (clearR.size + clearC.size > 0) {
    const a = 0.25 + 0.2 * Math.sin((o.pulse ?? 0) / 120);
    ctx.fillStyle = THEME.clearGlow;
    ctx.globalAlpha = a;
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        if (!willClear(r, c)) continue;
        const { x, y, size } = cellRect(l, r, c);
        roundRect(ctx, x, y, size, size, size * 0.16);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }
}

/** A piece at an arbitrary position (top-left x,y) and pitch, e.g. while dragging or in the tray. */
export function drawPiece(
  ctx: CanvasRenderingContext2D,
  l: Layout,
  cells: readonly Coord[],
  color: ColorId,
  x: number,
  y: number,
  pitch: number,
  alpha = 1,
): void {
  const size = pitch * (l.cell / l.pitch);
  const gap = (pitch - size) / 2;
  // One sprite size (board cells), scaled on draw, so animated sizes don't fill the cache.
  const sprite = brickSprite(color, Math.round(l.cell * l.dpr));
  ctx.globalAlpha = alpha;
  for (const [dr, dc] of cells) ctx.drawImage(sprite, x + dc * pitch + gap, y + dr * pitch + gap, size, size);
  ctx.globalAlpha = 1;
}
