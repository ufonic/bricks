import { describe, expect, it } from 'vitest';
import { clearLevelCache, difficultyFor, generateDaily, generateLevel, isBoss, isBreather } from '../src/core/levelgen';
import { hasFullLine } from '../src/core/board';
import { newGame } from '../src/core/game';
import { runBot } from '../src/core/bot';
import { objectiveValue } from '../src/core/objectives';
import { LEVELGEN } from '../src/config/difficulty';

describe('difficulty curve', () => {
  it('rises overall, with breathers and bosses', () => {
    expect(difficultyFor(1)).toBeLessThan(0.05);
    expect(difficultyFor(100)).toBeGreaterThan(difficultyFor(20) + 0.3);
    expect(isBreather(20)).toBe(true);
    expect(isBoss(25)).toBe(true);
    expect(isBreather(50)).toBe(false);
    expect(difficultyFor(30)).toBeLessThan(difficultyFor(29));
    expect(difficultyFor(25)).toBeGreaterThan(difficultyFor(24));
  });
});

describe('generateLevel', () => {
  it('is deterministic for the same level number', () => {
    for (const n of [1, 7, 42, 412]) {
      const a = JSON.stringify(generateLevel(n));
      clearLevelCache();
      expect(JSON.stringify(generateLevel(n))).toBe(a);
    }
  });

  it('introduces objectives and mechanics on schedule', () => {
    expect(generateLevel(1).info.objectives[0].type).toBe('score');
    expect(generateLevel(3).info.objectives[0].type).toBe('lines');
    expect(generateLevel(5).info.objectives[0].type).toBe('clearBlocks');
    expect(generateLevel(15).info.objectives[0].type).toBe('gems');
    expect(generateLevel(25).info.moveLimit).not.toBeNull();
    expect(generateLevel(25).info.objectives.length).toBe(2);
    expect(generateLevel(40).info.mechanics).toContain('stone');
    expect(generateLevel(60).info.mechanics).toContain('lock');
  });

  it('levels 1–500 never start with a full line and pass the bot check', () => {
    const failures: number[] = [];
    for (let n = 1; n <= 500; n++) {
      const lvl = generateLevel(n);
      expect(hasFullLine(lvl.board), `level ${n} has a full line`).toBe(false);
      // Re-run the bot exactly as the generator did and check it reaches 70% of each goal.
      const start = newGame({ mode: 'level', seed: lvl.dealSeed, board: lvl.board, level: { ...lvl.info, objectives: [], moveLimit: null } });
      const trace = runBot(start, 1000);
      const last = trace[trace.length - 1];
      const ok = lvl.info.objectives.every((o) => {
        const got = last ? objectiveValue(o, { lines: last.lines, gems: last.gems, blocksCleared: last.blocksCleared }, last.score) : 0;
        return got >= o.target * LEVELGEN.botMinRatio;
      });
      if (!ok) failures.push(n);
    }
    expect(failures).toEqual([]);
  });

  it('daily puzzles are deterministic per date and differ between dates', () => {
    const a = generateDaily('2026-10-18');
    expect(JSON.stringify(generateDaily('2026-10-18'))).toBe(JSON.stringify(a));
    expect(generateDaily('2026-10-19').seed).not.toBe(a.seed);
  });
});
