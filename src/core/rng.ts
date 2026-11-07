// シード付き乱数（mulberry32）。状態は数値1つなのでセーブに入れられる。

export interface RngHolder { rng: number }

export function nextRandom(h: RngHolder): number {
  let t = (h.rng = (h.rng + 0x6d2b79f5) | 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export class Rng {
  constructor(public h: RngHolder) {}
  next(): number { return nextRandom(this.h); }
  /** min以上max以下の整数 */
  int(min: number, max: number): number { return min + Math.floor(this.next() * (max - min + 1)); }
  chance(p: number): boolean { return this.next() < p; }
  pick<T>(arr: readonly T[]): T { return arr[Math.floor(this.next() * arr.length)]; }
  shuffle<T>(arr: T[]): T[] {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }
  weighted<T>(items: readonly T[], weight: (t: T) => number): T {
    const total = items.reduce((s, t) => s + Math.max(0, weight(t)), 0);
    if (total <= 0) return this.pick(items);
    let r = this.next() * total;
    for (const t of items) { r -= Math.max(0, weight(t)); if (r < 0) return t; }
    return items[items.length - 1];
  }
}

export function makeSeed(): number {
  return (Math.floor(Math.random() * 0xffffffff) ^ Date.now()) | 0;
}
