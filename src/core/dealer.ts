import { DEALER } from '../config/difficulty';
import { BOARD_SIZE, type Board, type ColorId, type Piece, type Shape, type TierWeights } from './types';
import { canPlace, fitsAnywhere, previewClears } from './board';
import { SHAPES, shapeWeight } from './pieces';
import { weightedPick, type Rng } from './rng';

export interface DealOptions {
  tierWeights: TierWeights;
  colors: readonly ColorId[];
  /** Bias toward pieces that can complete a line. */
  friendly?: boolean;
  shapes?: readonly Shape[];
}

/** True if the shape can be dropped somewhere that completes at least one line. */
export function canCompleteLine(board: Board, shape: Shape): boolean {
  for (let r = 0; r <= BOARD_SIZE - shape.rows; r++) {
    for (let c = 0; c <= BOARD_SIZE - shape.cols; c++) {
      if (!canPlace(board, shape.cells, r, c)) continue;
      const { rows, cols } = previewClears(board, shape.cells, r, c);
      if (rows.length + cols.length > 0) return true;
    }
  }
  return false;
}

function toPiece(shape: Shape, color: ColorId): Piece {
  return { id: shape.id, cells: shape.cells, tier: shape.tier, color };
}

/**
 * Deal 3 pieces. Retries the draw until at least one piece fits the board;
 * if none fits after the retries, the last draw is returned (game over is legitimate).
 */
export function dealTray(board: Board, rng: Rng, opts: DealOptions): Piece[] {
  const shapes = opts.shapes ?? SHAPES;
  const lineMakers = opts.friendly ? new Set(shapes.filter((s) => canCompleteLine(board, s)).map((s) => s.id)) : null;
  const weight = (s: Shape) =>
    shapeWeight(s, opts.tierWeights) * (lineMakers?.has(s.id) ? DEALER.friendlyBoost : 1);

  let draw: Shape[] = [];
  let fits = false;
  for (let attempt = 0; attempt < DEALER.fairnessRetries && !fits; attempt++) {
    draw = [0, 1, 2].map(() => weightedPick(rng, shapes, weight) ?? shapes[0]);
    fits = draw.some((s) => fitsAnywhere(board, s.cells));
  }
  if (!fits) {
    // Random draws kept missing: swap one slot for a weighted pick among shapes that fit.
    // Only when no shape fits at all is game over legitimate.
    const fitting = shapes.filter((s) => fitsAnywhere(board, s.cells));
    const pick = weightedPick(rng, fitting, weight);
    if (pick) draw[rng.int(3)] = pick;
  }
  const colors = rng.shuffle(opts.colors.slice());
  return draw.map((s, i) => toPiece(s, colors[i % colors.length]));
}
