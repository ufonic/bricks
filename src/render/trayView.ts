import type { Board, Piece } from '../core/types';
import { fitsAnywhere } from '../core/board';
import type { Layout } from './canvas';
import { drawPiece } from './boardView';

const extent = (p: Piece) => ({
  rows: Math.max(...p.cells.map(([r]) => r)) + 1,
  cols: Math.max(...p.cells.map(([, c]) => c)) + 1,
});

/** Top-left of a piece drawn centered in its slot at tray scale. */
export function trayPiecePos(l: Layout, slot: number, piece: Piece): { x: number; y: number } {
  const { rows, cols } = extent(piece);
  const cx = l.trayX + l.slotW * (slot + 0.5);
  const cy = l.trayY + l.trayH / 2;
  return { x: cx - (cols * l.trayPitch) / 2, y: cy - (rows * l.trayPitch) / 2 };
}

/** Whole slot is the hit target, not just the filled cells. */
export function slotAt(l: Layout, x: number, y: number): number | null {
  if (y < l.trayY - l.pitch * 0.4 || y > l.trayY + l.trayH + l.pitch) return null;
  const slot = Math.floor((x - l.trayX) / l.slotW);
  return slot >= 0 && slot < 3 ? slot : null;
}

export function drawTray(
  ctx: CanvasRenderingContext2D,
  l: Layout,
  tray: (Piece | null)[],
  board: Board,
  hiddenSlot: number | null,
): void {
  tray.forEach((piece, i) => {
    if (!piece || i === hiddenSlot) return;
    const { x, y } = trayPiecePos(l, i, piece);
    // Pieces that cannot fit anywhere are dimmed.
    const alpha = fitsAnywhere(board, piece.cells) ? 1 : 0.35;
    drawPiece(ctx, l, piece.cells, piece.color, x, y, l.trayPitch, alpha);
  });
}

export { extent as pieceExtent };
