import type { Tier } from '../core/types';

/**
 * A shape family. Orientations are generated from `cells` by rotating
 * (and mirroring, when `mirror` is set) and removing duplicates.
 * `names` optionally gives each generated orientation its own id.
 */
export interface ShapeFamily {
  id: string;
  cells: [number, number][];
  tier: Tier;
  /** Draw weight for each orientation. */
  weight: number;
  rotate: boolean;
  mirror: boolean;
  names?: string[];
}

export const SHAPE_FAMILIES: ShapeFamily[] = [
  { id: 'dot', cells: [[0, 0]], tier: 'easy', weight: 6, rotate: false, mirror: false, names: ['dot'] },
  { id: 'line2', cells: [[0, 0], [0, 1]], tier: 'easy', weight: 6, rotate: true, mirror: false, names: ['h2', 'v2'] },
  { id: 'line3', cells: [[0, 0], [0, 1], [0, 2]], tier: 'easy', weight: 6, rotate: true, mirror: false, names: ['h3', 'v3'] },
  { id: 'line4', cells: [[0, 0], [0, 1], [0, 2], [0, 3]], tier: 'medium', weight: 4, rotate: true, mirror: false, names: ['h4', 'v4'] },
  { id: 'line5', cells: [[0, 0], [0, 1], [0, 2], [0, 3], [0, 4]], tier: 'hard', weight: 2, rotate: true, mirror: false, names: ['h5', 'v5'] },
  { id: 'sq2', cells: [[0, 0], [0, 1], [1, 0], [1, 1]], tier: 'easy', weight: 6, rotate: false, mirror: false, names: ['sq2'] },
  {
    id: 'sq3',
    cells: [[0, 0], [0, 1], [0, 2], [1, 0], [1, 1], [1, 2], [2, 0], [2, 1], [2, 2]],
    tier: 'hard', weight: 2, rotate: false, mirror: false, names: ['sq3'],
  },
  { id: 'L3', cells: [[0, 0], [1, 0], [1, 1]], tier: 'easy', weight: 4, rotate: true, mirror: false },
  { id: 'L4', cells: [[0, 0], [1, 0], [2, 0], [2, 1]], tier: 'medium', weight: 2, rotate: true, mirror: true },
  { id: 'T4', cells: [[0, 0], [0, 1], [0, 2], [1, 1]], tier: 'medium', weight: 2, rotate: true, mirror: false },
  { id: 'S4', cells: [[0, 1], [0, 2], [1, 0], [1, 1]], tier: 'medium', weight: 2, rotate: true, mirror: true },
  { id: 'L5', cells: [[0, 0], [1, 0], [2, 0], [2, 1], [2, 2]], tier: 'hard', weight: 1, rotate: true, mirror: false },
  { id: 'rect23', cells: [[0, 0], [0, 1], [0, 2], [1, 0], [1, 1], [1, 2]], tier: 'hard', weight: 1, rotate: true, mirror: false },
];
