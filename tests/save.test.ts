import { describe, expect, it } from 'vitest';
import {
  currentStreak,
  defaultSave,
  migrate,
  parseSave,
  previousDay,
  recordDailyWin,
  recordLevelResult,
} from '../src/core/save';
import { newGame } from '../src/core/game';

describe('migrate', () => {
  it('returns a fresh save for garbage', () => {
    for (const bad of [null, 42, 'x', [], {}, { version: 99 }]) expect(migrate(bad)).toEqual(defaultSave());
  });
  it('round-trips a valid save', () => {
    const s = defaultSave();
    s.highestLevelUnlocked = 12;
    s.levels[3] = { bestScore: 400, stars: 2 };
    s.inProgress.endless = newGame({ mode: 'endless', seed: 1 });
    s.active = 'endless';
    expect(migrate(JSON.parse(JSON.stringify(s)))).toEqual(JSON.parse(JSON.stringify(s)));
  });
  it('fills missing fields and repairs bad values', () => {
    const m = migrate({ version: 1, highestLevelUnlocked: -5, settings: { sound: 'yes', liftOffset: 99 }, levels: { 2: { stars: 9 }, x: {} } });
    expect(m.highestLevelUnlocked).toBe(1);
    expect(m.settings.sound).toBe(true);
    expect(m.settings.liftOffset).toBe(3);
    expect(m.levels).toEqual({ 2: { bestScore: 0, stars: 3 } });
  });
  it('drops a corrupt in-progress game but keeps everything else', () => {
    const s = JSON.parse(JSON.stringify({ ...defaultSave(), endlessHighScore: 900 }));
    s.inProgress = { endless: { mode: 'endless', board: [[1]], tray: [] } };
    s.active = 'endless';
    const m = migrate(s);
    expect(m.inProgress).toEqual({});
    expect(m.active).toBeNull();
    expect(m.endlessHighScore).toBe(900);
  });
  it('parseSave returns null for invalid JSON', () => {
    expect(parseSave('{nope')).toBeNull();
    expect(parseSave('{"version":1}')?.version).toBe(1);
  });
});

describe('results', () => {
  it('records best score and stars, unlocking the next level on a win', () => {
    let s = recordLevelResult(defaultSave(), 1, 200, 2);
    s = recordLevelResult(s, 1, 150, 1);
    expect(s.levels[1]).toEqual({ bestScore: 200, stars: 2 });
    expect(s.highestLevelUnlocked).toBe(2);
    expect(recordLevelResult(s, 2, 50, 0).highestLevelUnlocked).toBe(2);
  });
  it('tracks daily streaks', () => {
    expect(previousDay('2026-03-01')).toBe('2026-02-28');
    let s = recordDailyWin(defaultSave(), '2026-10-17', 100);
    s = recordDailyWin(s, '2026-10-18', 200);
    expect(s.daily.streak).toBe(2);
    s = recordDailyWin(s, '2026-10-18', 50);
    expect(s.daily.streak).toBe(2);
    expect(s.daily.results['2026-10-18']).toBe(200);
    expect(currentStreak(s, '2026-10-19')).toBe(2);
    expect(currentStreak(s, '2026-10-21')).toBe(0);
    expect(recordDailyWin(s, '2026-10-21', 10).daily.streak).toBe(1);
  });
});
