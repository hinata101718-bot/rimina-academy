// ホームの賑わい：今月のカレンダー・季節の飾り・日めくり・1枚絵の差し込み口
import { useEffect, useState } from 'preact/hooks';
import type { GameState } from '../core/state';
import { monthEvents, nextEvent, seasonOf, SEASON_NAMES, type Season } from '../core/calendar';
import { MONTH_NAMES } from '../core/util';
import { Icon } from './icons';

// ---------- 1枚絵の差し込み口（public/art/index.json に書いたファイルだけ表示する） ----------
let artFiles: string[] = [];
let artLoaded = false;
const artListeners = new Set<() => void>();
export async function loadArtManifest(): Promise<void> {
  try {
    const r = await fetch(`${import.meta.env.BASE_URL}art/index.json`, { cache: 'no-cache' });
    if (r.ok) { const j = await r.json(); artFiles = Array.isArray(j.files) ? j.files : []; }
  } catch { /* なくてよい */ }
  artLoaded = true;
  artListeners.forEach((l) => l());
}
/** name（拡張子なし）に合う画像のURL。なければ null */
export function artUrl(name: string): string | null {
  const f = artFiles.find((x) => x.replace(/\.(webp|png|jpe?g)$/i, '') === name);
  return f ? `${import.meta.env.BASE_URL}art/${f}` : null;
}
function useArt(): void {
  const [, set] = useState(0);
  useEffect(() => { if (artLoaded) return; const l = () => set((x) => x + 1); artListeners.add(l); return () => { artListeners.delete(l); }; }, []);
}
/** 行事などの画面の上に置く1枚絵（画像があるときだけ） */
export function ArtSlot({ name, height = 140 }: { name: string; height?: number }) {
  useArt();
  const url = artUrl(name);
  if (!url) return null;
  return <div class="artslot" style={{ height }}><img src={url} alt="" /></div>;
}

// ---------- 今月のカレンダー（7夜目：月〜金＋月末の日ごと。今日を強調） ----------
const DAYS = ['月', '火', '水', '木', '金'];
export function MonthCalendar({ s }: { s: GameState }) {
  const ev = monthEvents(s);
  const next = nextEvent(s);
  const season = seasonOf(s.month);
  useArt();
  const bg = artUrl(`season_${season}`);
  const day = s.day ?? 1;
  const thisWeek = ev.filter((e) => e.slot === s.week);
  const endEv = ev.filter((e) => e.slot === 5);
  const lastWeek = s.week === 4;
  return (
    <div class="calendar card" style={bg ? { backgroundImage: `linear-gradient(rgba(255,250,240,.82), rgba(255,250,240,.9)), url(${bg})`, backgroundSize: 'cover' } : undefined}>
      <div class="row between nowrap">
        <div class="calmonth"><span class="big">{MONTH_NAMES[s.month]}</span><span class="muted small">{s.year}年目・{SEASON_NAMES[season]}・第{s.week}週</span></div>
        {next && <div class="small calnext"><Icon name="bell" size={14} /> {next.weeks === 0 ? `今週は${next.label}` : `${next.label}まであと${next.weeks}週`}</div>}
      </div>
      <div class="weekpips">{[1, 2, 3, 4].map((w) => <span class={w < s.week ? 'past' : w === s.week ? 'now' : ''}>第{w}週{ev.some((e) => e.slot === w && e.big) ? '★' : ''}</span>)}<span class="end">月末</span></div>
      <div class="daystrip">
        {DAYS.map((d, i) => {
          const k = i + 1;
          return (
            <div class={`dcell${k === day ? ' now' : ''}${k < day ? ' past' : ''}`}>
              <b>{d}</b>
              {k < day && <span class="dchk">✓</span>}
              {k === 1 && thisWeek.some((e) => e.birthday) && <span class="dic"><Icon name="cake" size={13} /></span>}
            </div>
          );
        })}
        <div class={`dcell end${lastWeek ? '' : ' far'}`}><b>⚔月末</b>{endEv.slice(0, 1).map((e) => <span class="dlabel">{e.label.replace('月末の', '')}</span>)}</div>
      </div>
      {thisWeek.length > 0 && <div class="small calweek">今週：{thisWeek.map((e) => e.label).join('・')}</div>}
    </div>
  );
}

// ---------- 季節の飾り（控えめに降らせる） ----------
export function SeasonFx({ month, stage }: { month: number; stage: string }) {
  const season = seasonOf(month);
  const n = stage === 'war' ? 4 : 9;
  return (
    <div class={`seasonfx ${season}`} aria-hidden="true">
      {season === 'summer' && <div class="glare" />}
      {Array.from({ length: n }, (_, i) => <span style={{ left: `${(i * 37 + 7) % 100}%`, animationDelay: `${(i * 1.7) % 9}s`, animationDuration: `${9 + (i % 4) * 2.5}s` }} />)}
    </div>
  );
}

// ---------- 日めくり ----------
export function PageFlip({ from, to, onEnd, ms }: { from: { m: number; w: number }; to: { m: number; w: number }; onEnd: () => void; ms: number }) {
  useEffect(() => { const t = setTimeout(onEnd, ms); return () => clearTimeout(t); }, []);
  const monthChanged = from.m !== to.m;
  return (
    <div class="pageflip" style={{ ['--flip' as string]: `${ms}ms` }} onClick={onEnd}>
      <div class="flipbox">
        <div class="flippage back">{monthChanged ? <><div class="flipmonth">{MONTH_NAMES[to.m]}</div><div class="small">{SEASON_NAMES[seasonOf(to.m)]}</div></> : <><div class="flipm small">{MONTH_NAMES[to.m]}</div><div class="flipweek">第{to.w}週</div></>}</div>
        <div class="flippage front"><div class="flipm small">{MONTH_NAMES[from.m]}</div><div class="flipweek">{from.w === 5 ? '月末' : `第${from.w}週`}</div></div>
      </div>
    </div>
  );
}
