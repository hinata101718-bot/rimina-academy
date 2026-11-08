// 手応えと発見の演出（6夜目）：ゲージが伸びて「ランクアップ！」／隠れた才能のヒント→判明・意外な一面
import { useEffect, useRef, useState } from 'preact/hooks';
import type { GameState, RankUpItem, Pending } from '../core/state';
import { RANKUP } from '../data/discovery';
import { Portrait } from './Portrait';
import { Icon } from './icons';
import { Seq } from './anim';
import { sfx } from './sound';
import { countryColor } from './cards';

/** ランクアップの演出：1つずつ、ゲージが伸びて満タンになると「ランクアップ！」。タップで早送り */
export function RankUpPlayer({ s, items, onDone, title = 'ランクアップ' }: { s: GameState; items: RankUpItem[]; onDone: () => void; title?: string }) {
  const [i, setI] = useState(0);
  const [pct, setPct] = useState(items[0]?.p0 ?? 0);
  const [dur, setDur] = useState(0);
  const [stamp, setStamp] = useState(false);
  const [all, setAll] = useState(false);
  const seq = useRef<Seq | null>(null);
  const tap = useRef<(() => void) | null>(null);
  const [waiting, setWaiting] = useState(false);
  useEffect(() => {
    if (all) return;
    const q = new Seq();
    seq.current = q;
    (async () => {
      for (let k = 0; k < items.length; k++) {
        if (q.cancelled) break;
        const it = items[k];
        setI(k); setStamp(false); setDur(0); setPct(it.p0);
        await q.sleep(200);
        const d = q.dur(RANKUP.gaugeMs * Math.max(0.3, it.p1 - it.p0));
        setDur(d); setPct(it.p1);
        await q.sleep(RANKUP.gaugeMs * Math.max(0.3, it.p1 - it.p0));
        if (!q.cancelled) sfx('pass');
        setStamp(true);
        await q.sleep(Math.min(400, RANKUP.stampMs));
        // ランクアップの画面は、タップするまで次に進まない（感想メモ：上がったところをしっかり見たい）
        if (!q.cancelled) { setWaiting(true); await new Promise<void>((res) => { tap.current = res; }); tap.current = null; setWaiting(false); }
      }
      if (!q.cancelled) setAll(true);
    })();
    return () => { q.cancel(); tap.current?.(); };
  }, [all]);
  const it = items[Math.min(i, items.length - 1)];
  if (!it) return null;
  if (all) {
    return (
      <div class="ru-wrap">
        <div class="ru-title">{title}</div>
        {items.map((x) => <RankRow s={s} it={x} />)}
        <button class="btn primary block" style={{ marginTop: 10 }} onClick={() => { sfx('ok'); onDone(); }}>閉じる</button>
      </div>
    );
  }
  return (
    <div class="ru-wrap" onClick={() => { if (tap.current) tap.current(); else seq.current?.speedUp(); }}>
      <div class="ru-title">{title}<span class="small muted">　{i + 1}／{items.length}</span></div>
      <div class="ru-card">
        <RankIcon s={s} it={it} size={72} />
        <div class="ru-name">{it.title}</div>
        <div class="ru-gauge"><span style={{ width: `${Math.round(pct * 100)}%`, transition: `width ${dur}ms ease-out` }} /></div>
        <div class={`ru-from${stamp ? ' done' : ''}`}><b>{it.from}</b><span class="ru-arrow">→</span><b class="ru-to">{stamp ? it.to : '？'}</b></div>
        {stamp && <div class="ru-stamp">ランクアップ！</div>}
        {it.note && <div class="small muted">{it.note}</div>}
      </div>
      <div class="row between" style={{ marginTop: 10 }}>
        <span class={`small ${waiting ? 'ru-next' : 'muted'}`}>{waiting ? 'タップで次へ ▼' : 'タップで早送り'}</span>
        <button class="btn small ghost" onClick={(e) => { e.stopPropagation(); seq.current?.cancel(); tap.current?.(); setAll(true); }}>スキップ</button>
      </div>
    </div>
  );
}
function RankIcon({ s, it, size }: { s: GameState; it: RankUpItem; size: number }) {
  const st = it.studentId ? s.students[it.studentId] : null;
  if (st) return <Portrait st={st} size={size} frame={countryColor(st.origin)} />;
  return <span class="ru-icon" style={{ width: size, height: size }}><Icon name={it.icon} size={size * 0.55} /></span>;
}
function RankRow({ s, it }: { s: GameState; it: RankUpItem }) {
  return (
    <div class="row nowrap gap8 ruled">
      <RankIcon s={s} it={it} size={40} />
      <div class="grow"><b>{it.title}</b><div class="small">{it.from} → <b class="ru-to">{it.to}</b>{it.note ? `　${it.note}` : ''}</div></div>
    </div>
  );
}

/** 発見の演出：ヒント1→ヒント2→判明（判明は似顔絵と才能の名前を大きく）・意外な一面 */
export function DiscoveryView({ s, p, onDone }: { s: GameState; p: Extract<Pending, { type: 'discovery' }>; onDone: () => void }) {
  const st = s.students[p.studentId];
  const [show, setShow] = useState(false);
  useEffect(() => { const t = setTimeout(() => { setShow(true); sfx(p.stage === 3 ? 'level' : 'pass'); }, p.stage === 3 ? 700 : 350); return () => clearTimeout(t); }, []);
  if (!st) { onDone(); return null; }
  const big = p.stage === 3;
  return (
    <div class={`dc-wrap stage${p.stage}`} onClick={() => setShow(true)}>
      <div class="dc-steps">{[1, 2, 3].map((n) => <span class={p.stage === 4 ? 'off' : n <= p.stage ? 'on' : ''}>{n === 3 ? '判明' : `ヒント${n}`}</span>)}</div>
      <div class="dc-title">{p.stage === 4 ? <><Icon name="lantern" size={18} /> {p.title}</> : p.title}</div>
      <div class={`dc-face${big ? ' big' : ''}${show ? ' lit' : ''}`}><Portrait st={st} size={big ? 140 : 96} frame={countryColor(st.origin)} /></div>
      <div class="dc-who serif">{st.given}</div>
      {big && <div class={`dc-name serif${show ? ' show' : ''}`}>「{p.name}」</div>}
      {p.stage === 4 && p.name && <div class={`dc-side serif${show ? ' show' : ''}`}>{p.name}</div>}
      <div class={`dc-text${show ? ' show' : ''}`}>{p.text.split('\n').map((l) => <p>{l}</p>)}</div>
      <button class="btn primary block" style={{ marginTop: 10 }} onClick={(e) => { e.stopPropagation(); sfx('ok'); onDone(); }}>閉じる</button>
    </div>
  );
}
