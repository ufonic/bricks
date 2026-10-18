import { BRICK_COLORS, THEME } from '../config/theme';
import type { Cell, ColorId } from '../core/types';

// Toy-brick tiles drawn once per (kind, color, pixel size) to an offscreen canvas, then blitted.

type Palette = { base: string; light: string; dark: string };
export type TileKey = string;

const cache = new Map<string, HTMLCanvasElement>();

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawBrick(ctx: CanvasRenderingContext2D, s: number, p: Palette, studs = true) {
  const r = s * 0.16;
  // Body with a vertical gradient.
  const body = ctx.createLinearGradient(0, 0, 0, s);
  body.addColorStop(0, p.light);
  body.addColorStop(0.22, p.base);
  body.addColorStop(1, p.dark);
  roundRect(ctx, 0, 0, s, s, r);
  ctx.fillStyle = body;
  ctx.fill();
  // Inner face, slightly inset, for the raised look.
  const inset = s * 0.07;
  const face = ctx.createLinearGradient(0, inset, 0, s - inset);
  face.addColorStop(0, p.base);
  face.addColorStop(1, p.base);
  roundRect(ctx, inset, inset, s - inset * 2, s - inset * 2.6, r * 0.7);
  ctx.fillStyle = face;
  ctx.fill();
  // Top highlight.
  ctx.save();
  roundRect(ctx, inset, inset, s - inset * 2, s * 0.22, r * 0.6);
  ctx.globalAlpha = 0.28;
  ctx.fillStyle = '#fff';
  ctx.fill();
  ctx.restore();
  if (!studs) return;
  const sr = s * 0.115;
  for (const [fx, fy] of [[0.31, 0.31], [0.69, 0.31], [0.31, 0.67], [0.69, 0.67]]) {
    const cx = s * fx;
    const cy = s * fy;
    ctx.beginPath();
    ctx.arc(cx, cy + sr * 0.35, sr, 0, Math.PI * 2);
    ctx.fillStyle = p.dark;
    ctx.globalAlpha = 0.7;
    ctx.fill();
    ctx.globalAlpha = 1;
    const g = ctx.createRadialGradient(cx - sr * 0.35, cy - sr * 0.4, sr * 0.1, cx, cy, sr);
    g.addColorStop(0, p.light);
    g.addColorStop(0.6, p.base);
    g.addColorStop(1, p.base);
    ctx.beginPath();
    ctx.arc(cx, cy, sr, 0, Math.PI * 2);
    ctx.fillStyle = g;
    ctx.fill();
  }
}

function drawGem(ctx: CanvasRenderingContext2D, s: number) {
  const cx = s / 2;
  const cy = s * 0.49;
  const w = s * 0.3;
  const h = s * 0.32;
  ctx.beginPath();
  ctx.moveTo(cx, cy - h);
  ctx.lineTo(cx + w, cy - h * 0.25);
  ctx.lineTo(cx, cy + h);
  ctx.lineTo(cx - w, cy - h * 0.25);
  ctx.closePath();
  const g = ctx.createLinearGradient(cx - w, cy - h, cx + w, cy + h);
  g.addColorStop(0, '#e6fdff');
  g.addColorStop(0.45, '#4fd8f0');
  g.addColorStop(1, '#1868c9');
  ctx.fillStyle = g;
  ctx.fill();
  ctx.lineWidth = Math.max(1, s * 0.03);
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.stroke();
  // Facet line and sparkle.
  ctx.beginPath();
  ctx.moveTo(cx - w, cy - h * 0.25);
  ctx.lineTo(cx + w, cy - h * 0.25);
  ctx.strokeStyle = 'rgba(255,255,255,0.6)';
  ctx.stroke();
  const sx = cx + w * 0.75;
  const sy = cy - h * 0.85;
  const k = s * 0.09;
  ctx.beginPath();
  ctx.moveTo(sx, sy - k);
  ctx.quadraticCurveTo(sx, sy, sx + k, sy);
  ctx.quadraticCurveTo(sx, sy, sx, sy + k);
  ctx.quadraticCurveTo(sx, sy, sx - k, sy);
  ctx.quadraticCurveTo(sx, sy, sx, sy - k);
  ctx.fillStyle = '#fff';
  ctx.fill();
}

function drawCracks(ctx: CanvasRenderingContext2D, s: number) {
  ctx.strokeStyle = 'rgba(30,30,35,0.75)';
  ctx.lineWidth = Math.max(1, s * 0.045);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(s * 0.18, s * 0.22);
  ctx.lineTo(s * 0.42, s * 0.45);
  ctx.lineTo(s * 0.36, s * 0.62);
  ctx.lineTo(s * 0.55, s * 0.84);
  ctx.moveTo(s * 0.42, s * 0.45);
  ctx.lineTo(s * 0.7, s * 0.38);
  ctx.lineTo(s * 0.84, s * 0.18);
  ctx.moveTo(s * 0.7, s * 0.38);
  ctx.lineTo(s * 0.78, s * 0.6);
  ctx.stroke();
}

function drawPadlock(ctx: CanvasRenderingContext2D, s: number) {
  const bw = s * 0.46;
  const bh = s * 0.34;
  const bx = (s - bw) / 2;
  const by = s * 0.46;
  ctx.lineWidth = s * 0.08;
  ctx.strokeStyle = '#c9c2b8';
  ctx.beginPath();
  ctx.arc(s / 2, by, bw * 0.32, Math.PI, 0);
  ctx.stroke();
  roundRect(ctx, bx, by, bw, bh, s * 0.06);
  const g = ctx.createLinearGradient(0, by, 0, by + bh);
  g.addColorStop(0, '#f2c443');
  g.addColorStop(1, '#a8770e');
  ctx.fillStyle = g;
  ctx.fill();
  ctx.fillStyle = '#4a3410';
  ctx.beginPath();
  ctx.arc(s / 2, by + bh * 0.42, s * 0.045, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(s / 2 - s * 0.018, by + bh * 0.42, s * 0.036, bh * 0.32);
}

function render(key: string, px: number, draw: (ctx: CanvasRenderingContext2D, s: number) => void): HTMLCanvasElement {
  const id = `${key}@${px}`;
  let c = cache.get(id);
  if (c) return c;
  c = document.createElement('canvas');
  c.width = c.height = px;
  const ctx = c.getContext('2d')!;
  draw(ctx, px);
  cache.set(id, c);
  return c;
}

export function brickSprite(color: ColorId, px: number): HTMLCanvasElement {
  return render(`brick:${color}`, px, (ctx, s) => drawBrick(ctx, s, BRICK_COLORS[color]));
}

export function cellSprite(cell: Cell, px: number): HTMLCanvasElement | null {
  switch (cell.kind) {
    case 'empty':
      return null;
    case 'block':
      return brickSprite(cell.color, px);
    case 'gem':
      return render(`gem:${cell.color}`, px, (ctx, s) => {
        drawBrick(ctx, s, BRICK_COLORS[cell.color], false);
        drawGem(ctx, s);
      });
    case 'stone':
      return render(`stone:${cell.hp}`, px, (ctx, s) => {
        drawBrick(ctx, s, THEME.stone);
        if (cell.hp === 1) drawCracks(ctx, s);
      });
    case 'lock':
      return render('lock', px, (ctx, s) => {
        drawBrick(ctx, s, THEME.lock, false);
        drawPadlock(ctx, s);
      });
  }
}

/** Drop cached sprites (call after a resize changes tile sizes). */
export function clearSpriteCache(): void {
  cache.clear();
}

export { roundRect };
