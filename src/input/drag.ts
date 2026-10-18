import { TIMING } from '../config/theme';
import { canPlace, previewClears } from '../core/board';
import type { Board, Piece } from '../core/types';
import type { Layout } from '../render/canvas';
import { pieceExtent, slotAt, trayPiecePos } from '../render/trayView';

export interface DragHost {
  layout(): Layout;
  board(): Board;
  tray(): (Piece | null)[];
  /** Finger-to-piece lift, in cells (distance to the centre of the piece's bottom row). */
  liftCells(): number;
  canInteract(): boolean;
  onPickup(slot: number): void;
  /** Return true if the move was applied. */
  onDrop(slot: number, row: number, col: number): boolean;
  onInvalidDrop(): void;
  requestRender(): void;
}

export interface DragView {
  slot: number;
  piece: Piece;
  x: number;
  y: number;
  pitch: number;
  target: { row: number; col: number; rows: number[]; cols: number[] } | null;
}

interface Active {
  pointerId: number;
  slot: number;
  piece: Piece;
  fx: number;
  fy: number;
  t0: number;
  /** Offset from finger to piece top-left at pickup (tray scale). */
  startDx: number;
  startDy: number;
  target: DragView['target'];
}

interface SnapBack {
  slot: number;
  piece: Piece;
  t0: number;
  from: { x: number; y: number; pitch: number };
}

const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export class DragController {
  private active: Active | null = null;
  private snap: SnapBack | null = null;
  private readonly off: () => void;

  constructor(private readonly el: HTMLElement, private readonly host: DragHost) {
    const down = (e: PointerEvent) => this.down(e);
    const move = (e: PointerEvent) => this.move(e);
    const up = (e: PointerEvent) => this.up(e, false);
    const cancel = (e: PointerEvent) => this.up(e, true);
    el.addEventListener('pointerdown', down);
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', cancel);
    el.addEventListener('lostpointercapture', cancel);
    this.off = () => {
      el.removeEventListener('pointerdown', down);
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', cancel);
      el.removeEventListener('lostpointercapture', cancel);
    };
  }

  destroy(): void {
    this.off();
  }

  /** Slot whose piece is being dragged or animating back (not drawn in the tray). */
  hiddenSlot(): number | null {
    return this.active?.slot ?? this.snap?.slot ?? null;
  }

  animating(now: number): boolean {
    if (this.active) return true;
    if (this.snap && now - this.snap.t0 >= TIMING.snapBackMs) this.snap = null;
    return this.snap !== null;
  }

  cancel(): void {
    this.active = null;
    this.snap = null;
  }

  private point(e: PointerEvent): { x: number; y: number } {
    const r = this.el.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  private down(e: PointerEvent) {
    if (this.active || !this.host.canInteract()) return;
    const { x, y } = this.point(e);
    const l = this.host.layout();
    const slot = slotAt(l, x, y);
    if (slot === null || slot === this.snap?.slot) return;
    const piece = this.host.tray()[slot];
    if (!piece) return;
    e.preventDefault();
    try {
      this.el.setPointerCapture(e.pointerId);
    } catch {
      // Synthetic events in tests have no active pointer.
    }
    const start = trayPiecePos(l, slot, piece);
    this.active = { pointerId: e.pointerId, slot, piece, fx: x, fy: y, t0: performance.now(), startDx: start.x - x, startDy: start.y - y, target: null };
    this.updateTarget();
    this.host.onPickup(slot);
    this.host.requestRender();
  }

  private move(e: PointerEvent) {
    const a = this.active;
    if (!a || e.pointerId !== a.pointerId) return;
    e.preventDefault();
    const { x, y } = this.point(e);
    a.fx = x;
    a.fy = y;
    this.updateTarget();
    this.host.requestRender();
  }

  private up(e: PointerEvent, cancelled: boolean) {
    const a = this.active;
    if (!a || e.pointerId !== a.pointerId) return;
    const view = this.view(performance.now());
    this.active = null;
    if (!cancelled && a.target && this.host.onDrop(a.slot, a.target.row, a.target.col)) {
      this.host.requestRender();
      return;
    }
    if (!cancelled) this.host.onInvalidDrop();
    if (view) this.snap = { slot: a.slot, piece: a.piece, t0: performance.now(), from: { x: view.x, y: view.y, pitch: view.pitch } };
    this.host.requestRender();
  }

  /** Final (full-size) top-left of the dragged piece relative to the finger. */
  private liftedOffset(piece: Piece, pitch: number): { dx: number; dy: number } {
    const { rows, cols } = pieceExtent(piece);
    const lift = this.host.liftCells();
    return { dx: -(cols * pitch) / 2, dy: -(rows * pitch) - (lift - 0.5) * pitch };
  }

  private updateTarget() {
    const a = this.active;
    if (!a) return;
    const l = this.host.layout();
    const { dx, dy } = this.liftedOffset(a.piece, l.pitch);
    // Snap from the piece's top-left, not from the finger.
    const col = Math.round((a.fx + dx - l.boardX) / l.pitch);
    const row = Math.round((a.fy + dy - l.boardY) / l.pitch);
    const board = this.host.board();
    if (canPlace(board, a.piece.cells, row, col)) {
      const { rows, cols } = previewClears(board, a.piece.cells, row, col);
      a.target = { row, col, rows, cols };
    } else {
      a.target = null;
    }
  }

  view(now: number): DragView | null {
    const l = this.host.layout();
    const a = this.active;
    if (a) {
      const t = easeOut(Math.min(1, (now - a.t0) / TIMING.pickupMs));
      const pitch = lerp(l.trayPitch, l.pitch, t);
      const end = this.liftedOffset(a.piece, l.pitch);
      return {
        slot: a.slot,
        piece: a.piece,
        pitch,
        x: a.fx + lerp(a.startDx, end.dx, t),
        y: a.fy + lerp(a.startDy, end.dy, t),
        target: a.target,
      };
    }
    const s = this.snap;
    if (s) {
      const t = easeOut(Math.min(1, (now - s.t0) / TIMING.snapBackMs));
      const to = trayPiecePos(l, s.slot, s.piece);
      return {
        slot: s.slot,
        piece: s.piece,
        pitch: lerp(s.from.pitch, l.trayPitch, t),
        x: lerp(s.from.x, to.x, t),
        y: lerp(s.from.y, to.y, t),
        target: null,
      };
    }
    return null;
  }
}
