// Seeded PRNG (mulberry32). The whole generator state is one uint32,
// so it can be saved in GameState and resumed exactly.

export interface Rng {
  /** Current state; save this to resume the sequence later. */
  state: number;
  /** Float in [0, 1). */
  next(): number;
  /** Integer in [0, n). */
  int(n: number): number;
  /** Integer in [min, max] inclusive. */
  range(min: number, max: number): number;
  /** Raw uint32, useful for deriving sub-seeds. */
  uint(): number;
  pick<T>(items: readonly T[]): T;
  shuffle<T>(items: T[]): T[];
}

export function createRng(seed: number): Rng {
  const rng: Rng = {
    state: seed >>> 0,
    uint() {
      rng.state = (rng.state + 0x6d2b79f5) >>> 0;
      let t = rng.state;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return (t ^ (t >>> 14)) >>> 0;
    },
    next() {
      return rng.uint() / 4294967296;
    },
    int(n) {
      return Math.floor(rng.next() * n);
    },
    range(min, max) {
      return min + rng.int(max - min + 1);
    },
    pick(items) {
      return items[rng.int(items.length)];
    },
    shuffle(items) {
      for (let i = items.length - 1; i > 0; i--) {
        const j = rng.int(i + 1);
        [items[i], items[j]] = [items[j], items[i]];
      }
      return items;
    },
  };
  return rng;
}

/** FNV-1a string hash with a final avalanche mix, as a uint32. */
export function hashString(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

/** Pick an item by weight. Returns undefined if every weight is 0. */
export function weightedPick<T>(rng: Rng, items: readonly T[], weight: (item: T) => number): T | undefined {
  let total = 0;
  for (const it of items) total += Math.max(0, weight(it));
  if (total <= 0) return undefined;
  let r = rng.next() * total;
  for (const it of items) {
    r -= Math.max(0, weight(it));
    if (r < 0) return it;
  }
  return items[items.length - 1];
}
