import { add, scale, type Vec3 } from '../core/math';
import type { CameraRig } from './CameraRig';

export type PressTarget =
  | { mode: 'ball'; hit: { t: number; point: Vec3; local: Vec3 } }
  | { mode: 'umbrella'; hit: { t: number; point: Vec3 } }
  | { mode: 'ground'; point: Vec3 }
  | { mode: 'sky' };

export interface InputHandlers {
  classify(ro: Vec3, rd: Vec3): PressTarget;
  onActivity(): void;
  onHoverMove(px: number): void;
  onDragStart(target: PressTarget): void;
  onDrag(target: PressTarget): void;
  onRelease(target: PressTarget, click: boolean, dbl: boolean): void;
  onKey(key: string): boolean;
}

/** Pointer + keyboard → semantic gestures (hover, click, double click, drag) on the canvas. */
export class Input {
  ndc: [number, number] = [0, 0];
  prevNdc: [number, number] = [0, 0];
  inside = false;
  down = false;
  lastMove = -10;
  moved = 0;
  readonly worldVel: Vec3 = [0, 0, 0];
  private press: PressTarget | null = null;
  private downX = 0; private downY = 0;
  private lastClick = -1;
  private dragging = false;

  /** Pointer gestures on the canvas (hover, click, drag); keyboard shortcuts on the window. */
  pointer = true;
  keyboard = false;
  private abort = new AbortController();

  constructor(private canvas: HTMLCanvasElement, private rig: CameraRig, private h: InputHandlers, private now: () => number) {
    const o = { signal: this.abort.signal };
    canvas.addEventListener('pointerdown', (e) => { if (this.pointer) this.onDown(e); }, o);
    window.addEventListener('pointermove', (e) => { if (this.pointer) this.onMove(e); }, { passive: true, signal: this.abort.signal });
    window.addEventListener('pointerup', () => this.onUp(), o);
    window.addEventListener('pointercancel', () => this.onUp(), o);
    window.addEventListener('mouseout', (e) => { if (!e.relatedTarget) this.inside = false; }, o);
    window.addEventListener('blur', () => { this.inside = false; this.onUp(); }, o);
    window.addEventListener('keydown', (e) => {
      if (!this.keyboard || e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t?.closest?.('input, textarea, select, [contenteditable=""], [contenteditable="true"]')) return;
      if (this.h.onKey(e.key)) e.preventDefault();
    }, o);
  }

  /** Turning pointer input off also forgets the cursor, so the ball stops following it. */
  setPointer(on: boolean) { this.pointer = on; if (!on) { this.inside = false; this.onUp(); } }

  dispose() { this.abort.abort(); }

  get active() { return this.inside && this.now() - this.lastMove < 3; }

  ray(): Vec3 { return this.rig.ray(this.ndc[0], this.ndc[1]); }

  /** Pointer position relative to the canvas (it may be any element on the page, scrolled anywhere). */
  private setNdc(e: PointerEvent): boolean {
    const r = this.canvas.getBoundingClientRect();
    const x = e.clientX - r.left, y = e.clientY - r.top;
    this.ndc = [(x / Math.max(r.width, 1)) * 2 - 1, 1 - (y / Math.max(r.height, 1)) * 2];
    return x >= 0 && y >= 0 && x <= r.width && y <= r.height;
  }

  private onDown(e: PointerEvent) {
    this.setNdc(e);
    this.down = true;
    this.inside = true;
    this.downX = e.clientX; this.downY = e.clientY;
    this.moved = 0;
    this.dragging = false;
    try { this.canvas.setPointerCapture(e.pointerId); } catch { /* synthetic events */ }
    this.press = this.h.classify(this.rig.position, this.ray());
    this.h.onActivity();
    if (this.press.mode === 'sky') { this.dragging = true; this.h.onDragStart(this.press); }
  }

  private onMove(e: PointerEvent) {
    const px = this.ndc;
    const over = this.setNdc(e);
    if (!over && !this.down) { this.inside = false; return; }
    this.inside = true;
    this.lastMove = this.now();
    this.h.onActivity();
    const movedPx = Math.hypot((this.ndc[0] - px[0]) * this.rig.cssW * 0.5, (this.ndc[1] - px[1]) * this.rig.cssH * 0.5);
    if (!this.down) { this.h.onHoverMove(movedPx); return; }
    if (!this.press) return;
    this.moved = Math.max(this.moved, Math.hypot(e.clientX - this.downX, e.clientY - this.downY));
    if (!this.dragging && this.moved > 6 && this.press.mode === 'ball') { this.dragging = true; this.h.onDragStart(this.press); }
    if (this.dragging) this.h.onDrag(this.press);
  }

  private onUp() {
    if (!this.down) return;
    this.down = false;
    const p = this.press;
    this.press = null;
    if (!p) return;
    const click = this.moved < 6;
    const t = this.now();
    const dbl = click && p.mode === 'ball' && t - this.lastClick < 0.33;
    this.lastClick = click && p.mode === 'ball' && !dbl ? t : -1;
    this.h.onRelease(p, click, dbl);
  }

  /** Smoothed cursor velocity in world units per second at unit depth. */
  updateVelocity(dt: number) {
    const dn = [this.ndc[0] - this.prevNdc[0], this.ndc[1] - this.prevNdc[1]];
    this.prevNdc = [...this.ndc];
    const { right, up } = this.rig.basis();
    const cv = add(scale(right, (dn[0] * this.rig.tanH * this.rig.aspect) / dt), scale(up, (dn[1] * this.rig.tanH) / dt));
    for (let i = 0; i < 3; i++) this.worldVel[i] += (cv[i] - this.worldVel[i]) * 0.5;
  }
}
