import { LAYOUT } from '../config/theme';
import { BOARD_SIZE } from '../core/types';

/** Geometry of the game canvas in CSS pixels. */
export interface Layout {
  width: number;
  height: number;
  dpr: number;
  /** Distance between cell origins. */
  pitch: number;
  /** Drawn tile size (pitch minus gap). */
  cell: number;
  /** Top-left of cell (0,0)'s pitch box. */
  boardX: number;
  boardY: number;
  boardSize: number;
  rim: number;
  trayY: number;
  trayH: number;
  slotW: number;
  trayX: number;
  trayPitch: number;
}

/** Board on top, tray in the lower third, both centered and sized to fit. */
export function computeLayout(width: number, height: number, dpr: number): Layout {
  const pad = LAYOUT.sidePadding;
  // Units of pitch: board 8 + rim on both sides; tray ≈ 3.4; spacing between ≈ 0.5.
  const rimU = LAYOUT.rim;
  const wUnits = BOARD_SIZE + rimU * 2;
  const hUnits = BOARD_SIZE + rimU * 2 + 0.5 + 3.4;
  const pitch = Math.max(8, Math.floor(Math.min((width - pad * 2) / wUnits, (height - pad) / hUnits, LAYOUT.maxBoard / BOARD_SIZE)));
  const boardSize = pitch * BOARD_SIZE;
  const rim = pitch * rimU;
  const trayH = pitch * 3.4;
  const spare = height - (boardSize + rim * 2 + 0.5 * pitch + trayH);
  // Keep the tray low for one-handed reach; split spare space ⅓ above the board, ⅔ above the tray.
  const boardY = Math.round(rim + spare * 0.3);
  const boardX = Math.round((width - boardSize) / 2);
  const trayY = boardY + boardSize + rim + 0.5 * pitch + spare * 0.45;
  const trayW = Math.min(width - pad * 2, boardSize + rim * 2);
  return {
    width,
    height,
    dpr,
    pitch,
    cell: pitch * (1 - LAYOUT.gap),
    boardX,
    boardY,
    boardSize,
    rim,
    trayY,
    trayH,
    slotW: trayW / 3,
    trayX: (width - trayW) / 2,
    trayPitch: pitch * LAYOUT.trayScale,
  };
}

/** Sizes the canvas backing store to CSS size × devicePixelRatio and calls back on every resize. */
export function fitCanvas(canvas: HTMLCanvasElement, onResize: (layout: Layout) => void): () => void {
  const apply = () => {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    canvas.width = Math.max(1, Math.round(rect.width * dpr));
    canvas.height = Math.max(1, Math.round(rect.height * dpr));
    onResize(computeLayout(rect.width, rect.height, dpr));
  };
  const ro = new ResizeObserver(apply);
  ro.observe(canvas);
  apply();
  return () => ro.disconnect();
}
