// 札の戦いの遊び方の手引き（17夜目）：戦いの画面の「？」と、設定から。1ページに短い説明と図を1つずつ
import { useState } from 'preact/hooks';
import { Sheet } from './common';
import { sfx } from './sound';
import { CARD_MANUAL, type ManualFig } from '../data/cardGuide';

export function CardManualSheet({ onClose, start = 0 }: { onClose: () => void; start?: number }) {
  const [i, setI] = useState(Math.max(0, Math.min(CARD_MANUAL.length - 1, start)));
  const p = CARD_MANUAL[i];
  const go = (n: number) => { sfx('move'); setI(Math.max(0, Math.min(CARD_MANUAL.length - 1, n))); };
  return (
    <Sheet title="遊び方の手引き" onClose={onClose}>
      <div class="mn-tabs" role="tablist">
        {CARD_MANUAL.map((x, k) => <button class={`mn-tab${k === i ? ' on' : ''}`} role="tab" aria-selected={k === i} onClick={() => go(k)}>{x.title}</button>)}
      </div>
      <div class="mn-page">
        <b class="serif mn-title">{i + 1}. {p.title}</b>
        <div class="mn-fig" aria-hidden="true"><Fig k={p.fig} /></div>
        {p.lines.map((l) => <p class="mn-p">{l}</p>)}
      </div>
      <div class="row between nowrap gap6 mn-nav">
        <button class="btn" disabled={i === 0} onClick={() => go(i - 1)}>‹ 前へ</button>
        <span class="small muted">{i + 1}／{CARD_MANUAL.length}</span>
        {i < CARD_MANUAL.length - 1 ? <button class="btn primary" onClick={() => go(i + 1)}>次へ ›</button> : <button class="btn primary" onClick={() => { sfx('ok'); onClose(); }}>閉じる</button>}
      </div>
    </Sheet>
  );
}

/** 小さな札（図の中の見本） */
function MiniCard({ cost, name, fx, tone = 'atk', on }: { cost: number; name: string; fx: string; tone?: string; on?: boolean }) {
  return <span class={`mn-card ${tone}${on ? ' on' : ''}`}><i class="mn-cost">{cost}</i><b>{name}</b><small>{fx}</small></span>;
}
function Face({ ch, threat, danger, back, label }: { ch: string; threat?: number; danger?: boolean; back?: boolean; label?: string }) {
  return <span class={`mn-face${danger ? ' danger' : ''}`}><i>{ch}</i>{threat ? <em>−{threat}</em> : null}<small>{label ?? ''}{back ? '・後' : ''}</small></span>;
}
function Foe({ ch, intent, lead }: { ch: string; intent?: string; lead?: boolean }) {
  return <span class={`mn-foe${lead ? ' lead' : ''}`}><i>{ch}</i>{intent && <small>{intent}</small>}</span>;
}

function Fig({ k }: { k: ManualFig }) {
  const ft: Record<ManualFig, () => preact.JSX.Element> = {
    ap: () => (
      <div class="mn-col">
        <div class="mn-row">行動力 <i class="cb-ap on" /><i class="cb-ap on" /><i class="cb-ap" /> 2/3 残り</div>
        <div class="mn-row"><MiniCard cost={1} name="燕返し" fx="6×2" on /><MiniCard cost={2} name="月下一閃" fx="18" /><MiniCard cost={1} name="かばう" fx="仲間をかばう" tone="guard" /></div>
      </div>
    ),
    intent: () => (
      <div class="mn-col">
        <div class="mn-row"><Foe ch="敵" intent="大振り 14 → ミラ" lead /></div>
        <div class="mn-arrow">↓</div>
        <div class="mn-row"><Face ch="ミ" threat={14} danger label="ミラ" /><Face ch="ロ" label="ロウ" /></div>
      </div>
    ),
    rows: () => (
      <div class="mn-col">
        <div class="mn-row"><span class="mn-tag dim">控え</span><Foe ch="?" /><Foe ch="?" /></div>
        <div class="mn-row"><span class="mn-tag">前</span><Foe ch="敵" intent="斬る 8" /><Foe ch="敵" intent="射る 6" /></div>
        <div class="mn-row"><Face ch="ロ" label="前" /><Face ch="ミ" back label="ミラ" /></div>
      </div>
    ),
    cover: () => (
      <div class="mn-col">
        <div class="mn-row"><Foe ch="敵" intent="大振り 14" lead /></div>
        <div class="mn-row"><Face ch="ロ" threat={7} label="ロウ" /><span class="mn-shield">守る▶</span><Face ch="ミ" label="ミラ" /></div>
        <div class="mn-row"><MiniCard cost={1} name="かばう" fx="ミラをかばう" tone="guard" on /></div>
      </div>
    ),
    strat: () => (
      <div class="mn-col">
        <div class="mn-row"><span class="cb-chip">森・晴れ</span></div>
        <div class="mn-row"><MiniCard cost={1} name="伏兵" fx="見込み72%" tone="strat" on /><span class="mn-arrow">→</span><span class="mn-tag ok">成功</span><span class="mn-tag dim">外れ</span></div>
      </div>
    ),
    trust: () => (
      <div class="mn-col">
        <div class="mn-row"><Face ch="カ" label="カイ" /><span class="mn-trust"><span style={{ width: '35%' }} /></span><small>信頼 35</small></div>
        <div class="mn-row"><MiniCard cost={1} name="かばう" fx="仲間をかばう" tone="guard" /><span class="mn-arrow">→</span><MiniCard cost={1} name="斬りつける" fx="9" /></div>
      </div>
    ),
    combo: () => (
      <div class="mn-col">
        <div class="mn-row"><Face ch="イ" label="イヴ" /><span class="mn-arrow">✕</span><Face ch="ジ" label="ジーク" /></div>
        <div class="mn-row"><MiniCard cost={1} name="影縫い" fx="連携" on /><MiniCard cost={1} name="燕返し" fx="連携" on /><span class="mn-arrow">→</span><span class="mn-tag ok">影縫い斬り</span></div>
      </div>
    ),
    evolve: () => (
      <div class="mn-col">
        <div class="mn-row"><MiniCard cost={1} name="燕返し" fx="熟練 8/8" on /></div>
        <div class="mn-arrow">↓</div>
        <div class="mn-row"><span class="mn-tag ok">二段燕（攻め）</span><span class="mn-tag">燕返し・守（反撃）</span></div>
      </div>
    ),
    auto: () => (
      <div class="mn-col">
        <span class="mn-btn main">この2枚を出す</span>
        <div class="mn-row"><span class="mn-btn on">おまかせで札を出す</span><span class="mn-btn">最後まで</span></div>
      </div>
    ),
  };
  return ft[k]();
}
