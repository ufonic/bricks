import { defaultSave, parseSave, type SaveData } from '../core/save';

const KEY = 'bricks.save';

/** Load the save. Missing, unreadable or corrupt storage → a fresh save, never an error. */
export function loadSave(): SaveData {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaultSave();
    return parseSave(raw) ?? defaultSave();
  } catch {
    return defaultSave();
  }
}

/** Returns false if storage is unavailable or full; the game keeps running either way. */
export function writeSave(save: SaveData): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify(save));
    return true;
  } catch {
    return false;
  }
}

/** Progress for moving to another device. The in-progress games are left out to keep it short. */
export function exportSave(save: SaveData): string {
  return JSON.stringify({ ...save, inProgress: {}, active: null });
}

export function importSave(text: string): SaveData | null {
  const trimmed = text.trim();
  if (!trimmed.startsWith('{')) return null;
  const save = parseSave(trimmed);
  // parseSave turns any unknown object into a fresh save; only accept real exports.
  return save && /"version"\s*:\s*1/.test(trimmed) ? save : null;
}
