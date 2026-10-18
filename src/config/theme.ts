import type { ColorId } from '../core/types';

/** Brick colors: base, light (highlight) and dark (shadow). */
export const BRICK_COLORS: Record<ColorId, { base: string; light: string; dark: string }> = {
  yellow: { base: '#f4b81c', light: '#ffe27a', dark: '#b27a05' },
  blue: { base: '#2f7fe0', light: '#7fb8ff', dark: '#1a4d94' },
  orange: { base: '#f27a1f', light: '#ffb36b', dark: '#a84c0b' },
  green: { base: '#4cb43c', light: '#94e27f', dark: '#2a7621' },
  red: { base: '#e0393e', light: '#ff8a8c', dark: '#97191e' },
  purple: { base: '#8e4fd6', light: '#c79bff', dark: '#5a2a96' },
  cyan: { base: '#1fbfc8', light: '#7eeef2', dark: '#0e7c83' },
};

/** Colors pieces are dealt in. Starting obstacles use OBSTACLE_COLOR. */
export const PIECE_COLORS: ColorId[] = ['blue', 'orange', 'green', 'red', 'purple', 'cyan', 'yellow'];
export const OBSTACLE_COLOR: ColorId = 'yellow';

export const THEME = {
  stone: { base: '#8d8f94', light: '#c4c6cb', dark: '#55575c' },
  lock: { base: '#4a3b30', light: '#6e5a4b', dark: '#2a2019' },
  boardRecess: '#3a2516',
  emptyCell: 'rgba(0,0,0,0.28)',
  emptyCellEdge: 'rgba(255,255,255,0.05)',
  rimLight: '#c98a52',
  rimDark: '#7a4a24',
  ghostAlpha: 0.38,
  clearGlow: 'rgba(255,248,200,0.55)',
  text: '#fff8ec',
  textShadow: 'rgba(60,30,10,0.6)',
} as const;

export const LAYOUT = {
  /** Gap between cells as a fraction of the cell pitch. */
  gap: 0.06,
  /** Tray piece scale relative to board cells. */
  trayScale: 0.55,
  /** Board rim thickness as a fraction of the pitch. */
  rim: 0.32,
  sidePadding: 14,
  /** Max board size (CSS px) so it stays reasonable on tablets / desktop. */
  maxBoard: 520,
} as const;

export const TIMING = {
  pickupMs: 100,
  snapBackMs: 160,
  clearMs: 300,
  clearSweepMs: 22,
  popupMs: 800,
  comboMs: 1000,
  bannerMs: 1500,
  screenFadeMs: 160,
} as const;
