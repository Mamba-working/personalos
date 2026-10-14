/** Minimal typed event emitter. `on` returns an unsubscribe function. */
export class Emitter<M extends object> {
  private map = new Map<keyof M, Set<(p: never) => void>>();

  on<K extends keyof M>(type: K, fn: (payload: M[K]) => void): () => void {
    let set = this.map.get(type);
    if (!set) this.map.set(type, (set = new Set()));
    set.add(fn as (p: never) => void);
    return () => this.off(type, fn);
  }

  once<K extends keyof M>(type: K, fn: (payload: M[K]) => void): () => void {
    const off = this.on(type, (p) => { off(); fn(p); });
    return off;
  }

  off<K extends keyof M>(type: K, fn: (payload: M[K]) => void) { this.map.get(type)?.delete(fn as (p: never) => void); }

  has<K extends keyof M>(type: K) { return (this.map.get(type)?.size ?? 0) > 0; }

  emit<K extends keyof M>(type: K, payload: M[K]) {
    const set = this.map.get(type);
    if (!set) return;
    for (const fn of [...set]) {
      try { (fn as (p: M[K]) => void)(payload); } catch (err) { console.error(`[weather-scene] "${String(type)}" listener failed`, err); }
    }
  }

  clear() { this.map.clear(); }
}
