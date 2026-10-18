import { THEME, TIMING } from '../config/theme';
import type { Cell, ClearedCell } from '../core/types';
import type { Layout } from './canvas';
import { cellRect } from './boardView';
import { cellSprite, roundRect } from './tiles';

// Short-lived visual effects. Each is a pure function of elapsed time.

interface Pop {
  kind: 'pop';
  t0: number;
  delay: number;
  row: number;
  col: number;
  cell: Cell;
  /** Stones that only cracked flash instead of vanishing. */
  flash: boolean;
}

interface Text {
  kind: 'text';
  t0: number;
  dur: number;
  text: string;
  x: number;
  y: number;
  size: number;
  rise: number;
  color: string;
}

type Effect = Pop | Text;

const FONT = '-apple-system, "SF Pro Rounded", system-ui, sans-serif';
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

export class Effects {
  private list: Effect[] = [];

  get active(): boolean {
    return this.list.length > 0;
  }

  clear(): void {
    this.list = [];
  }

  /** Cleared cells pop and fade in a sweep outward from where the piece landed. */
  lineClear(cells: ClearedCell[], originRow: number, originCol: number, now: number): void {
    for (const c of cells) {
      const dist = Math.abs(c.row - originRow) + Math.abs(c.col - originCol);
      this.list.push({
        kind: 'pop',
        t0: now,
        delay: dist * TIMING.clearSweepMs,
        row: c.row,
        col: c.col,
        cell: c.before,
        flash: c.after.kind !== 'empty',
      });
    }
  }

  text(text: string, x: number, y: number, now: number, opts: Partial<Pick<Text, 'size' | 'dur' | 'rise' | 'color'>> = {}): void {
    this.list.push({
      kind: 'text',
      t0: now,
      text,
      x,
      y,
      dur: opts.dur ?? TIMING.popupMs,
      size: opts.size ?? 22,
      rise: opts.rise ?? 40,
      color: opts.color ?? THEME.text,
    });
  }

  draw(ctx: CanvasRenderingContext2D, l: Layout, now: number): void {
    const px = Math.round(l.cell * l.dpr);
    this.list = this.list.filter((e) => {
      const t = now - e.t0;
      if (e.kind === 'pop') {
        const local = (t - e.delay) / TIMING.clearMs;
        const { x, y, size } = cellRect(l, e.row, e.col);
        if (local < 0) {
          // Not started yet: the cell still shows as it was.
          const sprite = cellSprite(e.cell, px);
          if (sprite && !e.flash) ctx.drawImage(sprite, x, y, size, size);
          return true;
        }
        if (local >= 1) return false;
        if (e.flash) {
          ctx.globalAlpha = (1 - local) * 0.8;
          ctx.fillStyle = '#fff';
          roundRect(ctx, x, y, size, size, size * 0.16);
          ctx.fill();
          ctx.globalAlpha = 1;
          return true;
        }
        const sprite = cellSprite(e.cell, px);
        const scale = local < 0.3 ? 1 + 0.25 * (local / 0.3) : 1.25 * (1 - easeOut((local - 0.3) / 0.7));
        const s = size * scale;
        ctx.globalAlpha = 1 - easeOut(local) * 0.7;
        if (sprite) ctx.drawImage(sprite, x + (size - s) / 2, y + (size - s) / 2, s, s);
        // A white flash at the start of the pop.
        if (local < 0.35) {
          ctx.globalAlpha = 0.6 * (1 - local / 0.35);
          ctx.fillStyle = '#fff';
          roundRect(ctx, x + (size - s) / 2, y + (size - s) / 2, s, s, s * 0.16);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
        return true;
      }
      const p = t / e.dur;
      if (p >= 1) return false;
      const scale = p < 0.15 ? 0.6 + 0.4 * (p / 0.15) : 1;
      ctx.save();
      ctx.globalAlpha = p > 0.7 ? 1 - (p - 0.7) / 0.3 : 1;
      ctx.translate(e.x, e.y - e.rise * easeOut(p));
      ctx.scale(scale, scale);
      ctx.font = `800 ${e.size}px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineWidth = Math.max(3, e.size * 0.18);
      ctx.lineJoin = 'round';
      ctx.strokeStyle = THEME.textShadow;
      ctx.strokeText(e.text, 0, 0);
      ctx.fillStyle = e.color;
      ctx.fillText(e.text, 0, 0);
      ctx.restore();
      return true;
    });
  }
}
