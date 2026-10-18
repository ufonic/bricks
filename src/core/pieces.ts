import { SHAPE_FAMILIES, type ShapeFamily } from '../config/pieces';
import { TIER_MULTIPLIERS } from '../config/difficulty';
import type { Coord, Shape, TierWeights } from './types';

/** Shift so the minimum row and column are 0, then sort for stable comparison. */
export function normalize(cells: readonly Coord[]): Coord[] {
  const minR = Math.min(...cells.map(([r]) => r));
  const minC = Math.min(...cells.map(([, c]) => c));
  return cells
    .map(([r, c]): Coord => [r - minR, c - minC])
    .sort((a, b) => a[0] - b[0] || a[1] - b[1]);
}

const rotate = (cells: readonly Coord[]): Coord[] => normalize(cells.map(([r, c]): Coord => [c, -r]));
const mirror = (cells: readonly Coord[]): Coord[] => normalize(cells.map(([r, c]): Coord => [r, -c]));
const keyOf = (cells: readonly Coord[]) => cells.map(([r, c]) => `${r},${c}`).join(';');

/** All distinct orientations of a family, in rotation order (mirrors after). */
export function orientations(family: ShapeFamily): Coord[][] {
  const bases = [normalize(family.cells)];
  if (family.mirror) bases.push(mirror(family.cells));
  const out: Coord[][] = [];
  const seen = new Set<string>();
  for (const base of bases) {
    let cur = base;
    for (let i = 0; i < (family.rotate ? 4 : 1); i++) {
      const k = keyOf(cur);
      if (!seen.has(k)) {
        seen.add(k);
        out.push(cur);
      }
      cur = rotate(cur);
    }
  }
  return out;
}

export function buildShapes(families: readonly ShapeFamily[]): Shape[] {
  const shapes: Shape[] = [];
  for (const fam of families) {
    orientations(fam).forEach((cells, i) => {
      shapes.push({
        id: fam.names?.[i] ?? `${fam.id}${String.fromCharCode(97 + i)}`,
        cells,
        tier: fam.tier,
        weight: fam.weight,
        rows: Math.max(...cells.map(([r]) => r)) + 1,
        cols: Math.max(...cells.map(([, c]) => c)) + 1,
      });
    });
  }
  return shapes;
}

export const SHAPES: Shape[] = buildShapes(SHAPE_FAMILIES);
const SHAPE_BY_ID = new Map(SHAPES.map((s) => [s.id, s]));

export function shapeById(id: string): Shape | undefined {
  return SHAPE_BY_ID.get(id);
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Tier multipliers for a difficulty in [0, 1]. */
export function tierWeightsFor(d: number): TierWeights {
  const t = Math.min(1, Math.max(0, d));
  return {
    easy: lerp(TIER_MULTIPLIERS.easy[0], TIER_MULTIPLIERS.easy[1], t),
    medium: lerp(TIER_MULTIPLIERS.medium[0], TIER_MULTIPLIERS.medium[1], t),
    hard: lerp(TIER_MULTIPLIERS.hard[0], TIER_MULTIPLIERS.hard[1], t),
  };
}

export function shapeWeight(shape: Shape, tiers: TierWeights): number {
  return shape.weight * tiers[shape.tier];
}
