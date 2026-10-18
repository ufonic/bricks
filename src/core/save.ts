import { BOARD_SIZE, type GameMode, type GameState } from './types';

export interface Settings {
  sound: boolean;
  haptics: boolean;
  /** Distance from finger to the piece's bottom row, in cells. */
  liftOffset: number;
  friendlyDeals: boolean;
  /** Undos per game; -1 = unlimited. */
  undoCount: number;
  unlockAll: boolean;
}

export interface LevelRecord {
  bestScore: number;
  stars: 0 | 1 | 2 | 3;
}

export interface SaveData {
  version: 1;
  /** The next unbeaten level. */
  highestLevelUnlocked: number;
  levels: Record<number, LevelRecord>;
  endlessHighScore: number;
  daily: { lastDate: string; streak: number; results: Record<string, number> };
  stats: { linesCleared: number; piecesPlaced: number; gamesPlayed: number };
  settings: Settings;
  /** One saved game per mode, so starting a level never loses an endless run. */
  inProgress: Partial<Record<GameMode, GameState>>;
  /** Mode that was on screen when the app closed; reopening resumes it. */
  active: GameMode | null;
  tipsSeen: string[];
}

export const SAVE_VERSION = 1;

export function defaultSettings(): Settings {
  return { sound: true, haptics: true, liftOffset: 1.5, friendlyDeals: false, undoCount: 1, unlockAll: false };
}

export function defaultSave(): SaveData {
  return {
    version: 1,
    highestLevelUnlocked: 1,
    levels: {},
    endlessHighScore: 0,
    daily: { lastDate: '', streak: 0, results: {} },
    stats: { linesCleared: 0, piecesPlaced: 0, gamesPlayed: 0 },
    settings: defaultSettings(),
    inProgress: {},
    active: null,
    tipsSeen: [],
  };
}

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const num = (v: unknown, d: number) => (typeof v === 'number' && Number.isFinite(v) ? v : d);
const bool = (v: unknown, d: boolean) => (typeof v === 'boolean' ? v : d);
const str = (v: unknown, d: string) => (typeof v === 'string' ? v : d);

const CELL_KINDS = new Set(['empty', 'block', 'gem', 'stone', 'lock']);

/** Structural check so a corrupt saved game is dropped instead of crashing the app. */
export function isValidGameState(v: unknown): v is GameState {
  if (!isObj(v)) return false;
  if (!['level', 'endless', 'daily'].includes(v.mode as string)) return false;
  if (!Array.isArray(v.board) || v.board.length !== BOARD_SIZE) return false;
  for (const row of v.board) {
    if (!Array.isArray(row) || row.length !== BOARD_SIZE) return false;
    for (const cell of row) if (!isObj(cell) || !CELL_KINDS.has(cell.kind as string)) return false;
  }
  if (!Array.isArray(v.tray) || v.tray.length !== 3) return false;
  for (const p of v.tray) {
    if (p === null) continue;
    if (!isObj(p) || !Array.isArray(p.cells) || p.cells.length === 0) return false;
  }
  if (!isObj(v.progress) || !isObj(v.tierWeights) || !Array.isArray(v.undoStack)) return false;
  return ['score', 'combo', 'movesUsed', 'rngState', 'undosUsed', 'startCells'].every((k) => typeof v[k] === 'number');
}

/** Bring any stored value up to the current SaveData shape. Unknown or broken input → fresh save. */
export function migrate(raw: unknown): SaveData {
  const fresh = defaultSave();
  if (!isObj(raw) || typeof raw.version !== 'number' || raw.version > SAVE_VERSION) return fresh;
  // Future: `if (raw.version === 1) raw = migrateV1toV2(raw)` etc.

  const s = isObj(raw.settings) ? raw.settings : {};
  const settings: Settings = {
    sound: bool(s.sound, fresh.settings.sound),
    haptics: bool(s.haptics, fresh.settings.haptics),
    liftOffset: Math.min(3, Math.max(0, num(s.liftOffset, fresh.settings.liftOffset))),
    friendlyDeals: bool(s.friendlyDeals, fresh.settings.friendlyDeals),
    undoCount: Math.round(num(s.undoCount, fresh.settings.undoCount)),
    unlockAll: bool(s.unlockAll, fresh.settings.unlockAll),
  };

  const levels: Record<number, LevelRecord> = {};
  if (isObj(raw.levels)) {
    for (const [k, v] of Object.entries(raw.levels)) {
      const n = Number(k);
      if (!Number.isInteger(n) || n < 1 || !isObj(v)) continue;
      const stars = Math.round(num(v.stars, 0));
      levels[n] = { bestScore: Math.max(0, num(v.bestScore, 0)), stars: Math.min(3, Math.max(0, stars)) as 0 | 1 | 2 | 3 };
    }
  }

  const d = isObj(raw.daily) ? raw.daily : {};
  const results: Record<string, number> = {};
  if (isObj(d.results)) for (const [k, v] of Object.entries(d.results)) if (typeof v === 'number') results[k] = v;

  const st = isObj(raw.stats) ? raw.stats : {};
  const inProgress: SaveData['inProgress'] = {};
  if (isObj(raw.inProgress)) {
    for (const mode of ['level', 'endless', 'daily'] as const) {
      const g = raw.inProgress[mode];
      if (isValidGameState(g) && g.mode === mode) inProgress[mode] = g;
    }
  }
  const active = ['level', 'endless', 'daily'].includes(raw.active as string) ? (raw.active as GameMode) : null;

  return {
    version: 1,
    highestLevelUnlocked: Math.max(1, Math.round(num(raw.highestLevelUnlocked, 1))),
    levels,
    endlessHighScore: Math.max(0, num(raw.endlessHighScore, 0)),
    daily: { lastDate: str(d.lastDate, ''), streak: Math.max(0, num(d.streak, 0)), results },
    stats: {
      linesCleared: num(st.linesCleared, 0),
      piecesPlaced: num(st.piecesPlaced, 0),
      gamesPlayed: num(st.gamesPlayed, 0),
    },
    settings,
    inProgress,
    active: active && inProgress[active] ? active : null,
    tipsSeen: Array.isArray(raw.tipsSeen) ? raw.tipsSeen.filter((t): t is string => typeof t === 'string') : [],
  };
}

/** Parse a stored or imported JSON string; null when it is not valid JSON at all. */
export function parseSave(json: string): SaveData | null {
  try {
    return migrate(JSON.parse(json));
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Results bookkeeping (pure updates on SaveData)

export function recordLevelResult(save: SaveData, level: number, score: number, stars: 0 | 1 | 2 | 3): SaveData {
  const prev = save.levels[level];
  const levels = {
    ...save.levels,
    [level]: { bestScore: Math.max(prev?.bestScore ?? 0, score), stars: Math.max(prev?.stars ?? 0, stars) as 0 | 1 | 2 | 3 },
  };
  const highestLevelUnlocked = stars > 0 ? Math.max(save.highestLevelUnlocked, level + 1) : save.highestLevelUnlocked;
  return { ...save, levels, highestLevelUnlocked };
}

/** Local calendar date as YYYY-MM-DD. */
export function dateKey(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function previousDay(key: string): string {
  const [y, m, d] = key.split('-').map(Number);
  return dateKey(new Date(y, m - 1, d - 1));
}

/** Streak continues when yesterday was completed; repeating today changes nothing. */
export function recordDailyWin(save: SaveData, date: string, score: number): SaveData {
  const { daily } = save;
  const best = Math.max(daily.results[date] ?? 0, score);
  let streak = daily.streak;
  if (daily.lastDate !== date) streak = daily.lastDate === previousDay(date) ? daily.streak + 1 : 1;
  return { ...save, daily: { lastDate: date, streak, results: { ...daily.results, [date]: best } } };
}

/** The streak shown today: it lapses if neither today nor yesterday was completed. */
export function currentStreak(save: SaveData, today: string): number {
  const { lastDate, streak } = save.daily;
  return lastDate === today || lastDate === previousDay(today) ? streak : 0;
}
