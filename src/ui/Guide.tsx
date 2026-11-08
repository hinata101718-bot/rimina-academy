// 最初の1時間の案内（14夜目）：案内役（管理人オズヴァルト）の吹き出し
import { useEffect } from 'preact/hooks';
import { act } from './store';
import { Sheet } from './common';
import { sfx } from './sound';
import type { GameState } from '../core/state';
import { deskTourStep, nextTour, skipTutorial } from '../core/tutorial';
import { DESK_TOUR, GUIDE_NAME } from '../data/tutorial';

/** 案内役の顔の代わりの判（老人の管理人。「管」の字の丸い判） */
export function GuideSeal({ size = 44 }: { size?: number }) {
  return <span class="guide-seal" style={{ width: size, height: size, fontSize: Math.round(size * 0.48) }} aria-hidden="true">管</span>;
}

/** はじめて出たときの説明（処理待ちの「案内」） */
export function GuideTipView({ title, lines, onDone }: { title: string; lines: string[]; onDone: () => void }) {
  return (
    <Sheet>
      <div class="guide-tip">
        <div class="row nowrap gap8"><GuideSeal /><div class="grow"><div class="small muted">{GUIDE_NAME}</div><b class="serif" style={{ fontSize: 17 }}>{title}</b></div></div>
        <div class="guide-say serif">{lines.map((l) => <p>{l}</p>)}</div>
      </div>
      <button class="btn primary block" style={{ marginTop: 10 }} onClick={() => { sfx('ok'); onDone(); }}>わかりました</button>
    </Sheet>
  );
}

/** ホームの机の案内：机の物を1つずつ指して短く。タップで次へ、「案内を飛ばす」で終わり */
export function DeskTour({ s }: { s: GameState }) {
  const st = deskTourStep(s);
  const target = st?.target ?? null;
  useEffect(() => { if (target) (document.querySelector('.gfocus') as HTMLElement | null)?.scrollIntoView?.({ block: 'center', behavior: 'smooth' }); }, [target]);
  if (!st) return null;
  return (
    <div class={`desktour${st.target === 'command' || st.target === 'drawers' || st.target === 'photos' ? ' top' : ''}`} role="dialog" aria-label="案内" onClick={() => { sfx('move'); act((g) => nextTour(g)); }}>
      <div class="desktour-box">
        <div class="row nowrap gap8"><GuideSeal size={40} /><b class="small">{GUIDE_NAME}</b><span class="grow" /><span class="small muted">{st.i + 1}／{DESK_TOUR.length}</span></div>
        <div class="serif desktour-say">{st.text}</div>
        <div class="row between nowrap">
          <button class="btn ghost small" onClick={(e) => { e.stopPropagation(); sfx('cancel'); if (confirm('案内を飛ばしますか？　はじめて出たものの説明も出なくなります（設定の「案内を見なおす」で、もう一度見られます）。')) act((g) => skipTutorial(g)); }}>案内を飛ばす</button>
          <span class="small muted">タップで次へ ›</span>
        </div>
      </div>
    </div>
  );
}
/** 机の物が今の案内の的なら、目立たせるクラス */
export function tourFocus(s: GameState, target: string): string {
  const st = deskTourStep(s);
  return st && st.target === target ? ' gfocus' : '';
}
