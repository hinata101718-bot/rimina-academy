// 演出の時間を管理する小さな仕組み。タップで早送り、スキップで即座に最後まで
import { B } from '../data/balance';
import { getGame } from './store';

export type Lane = 'anim' | 'enemy';

/** 設定から倍率を求める */
export function laneMul(lane: Lane): number {
  const g = getGame();
  const a = B.anim.speedMul[g?.settings.animSpeed ?? 2] ?? 1;
  if (lane === 'enemy') return a * (B.anim.enemySpeedMul[g?.settings.enemySpeed ?? 1] ?? 1);
  return a;
}

export class Seq {
  fast = false;
  cancelled = false;
  private waiting: { t: ReturnType<typeof setTimeout>; res: () => void }[] = [];

  /** 実際に待つ時間（CSSのアニメーション時間にも使う） */
  dur(ms: number, lane: Lane = 'anim'): number {
    if (this.cancelled) return 0;
    return Math.round(ms * laneMul(lane) * (this.fast ? B.anim.fastMul : 1));
  }
  sleep(ms: number, lane: Lane = 'anim'): Promise<void> {
    const d = this.dur(ms, lane);
    if (d <= 0) return Promise.resolve();
    return new Promise((res) => {
      const item = { t: setTimeout(() => { this.waiting = this.waiting.filter((x) => x !== item); res(); }, d), res };
      this.waiting.push(item);
    });
  }
  private tapWait: (() => void) | null = null;
  /** タップするまで待つ（レベルアップなど。早送り中でも止まる。7夜目） */
  waitTap(): Promise<void> {
    if (this.cancelled) return Promise.resolve();
    return new Promise((res) => { this.tapWait = () => { this.tapWait = null; res(); }; });
  }
  get waitingTap(): boolean { return !!this.tapWait; }
  /** タップ：タップ待ちなら次へ、そうでなければ早送り */
  tap(): void {
    if (this.tapWait) { this.tapWait(); return; }
    this.speedUp();
  }
  /** タップ：いま待っている分を終わらせ、残りを速くする */
  speedUp(): void {
    this.fast = true;
    for (const w of this.waiting) { clearTimeout(w.t); w.res(); }
    this.waiting = [];
  }
  /** スキップ：すべて即座に */
  cancel(): void {
    this.cancelled = true;
    this.tapWait?.();
    this.speedUp();
  }
}
