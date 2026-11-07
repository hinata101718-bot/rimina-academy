// ホームの賑わい：校舎の絵・今月のカレンダー・季節の飾り・日めくり・1枚絵の差し込み口
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

// ---------- 校舎 ----------
export function facilityTotal(s: GameState): number { return Object.values(s.facilities).reduce((a, b) => a + (b ?? 0), 0); }
export function schoolTier(s: GameState): number { const t = facilityTotal(s); return t >= 13 ? 3 : t >= 8 ? 2 : t >= 3 ? 1 : 0; }

const SKY: Record<Season, [string, string]> = { spring: ['#cfe6f5', '#f7e9ef'], summer: ['#8fc9f0', '#e6f4fb'], autumn: ['#f2c99b', '#f8e8d3'], winter: ['#c9d4e2', '#eef1f6'] };
const TREE: Record<Season, string> = { spring: '#f3b6c8', summer: '#5f9e4f', autumn: '#d9843d', winter: '#e9eef3' };

export function SchoolArt({ s }: { s: GameState }) {
  useArt();
  const tier = schoolTier(s);
  const season = seasonOf(s.month);
  const url = artUrl(`school_${tier}`);
  const stage = s.world.tension > 65 ? 'war' : s.world.tension < 35 ? 'peace' : 'tension';
  if (url) return <div class="schoolart img"><img src={url} alt="リミナ分校" /></div>;
  const [sky1, sky2] = SKY[season];
  const lit = Math.min(14, 2 + facilityTotal(s));
  const flags = Object.entries(s.facilities).filter(([, v]) => (v ?? 0) >= 1).length;
  const windows: [number, number][] = [];
  for (let r = 0; r < 2; r++) for (let c = 0; c < 7; c++) windows.push([122 + c * 17, 78 + r * 22]);
  return (
    <div class="schoolart">
      <svg viewBox="0 0 360 150" preserveAspectRatio="xMidYMid slice" role="img" aria-label="リミナ分校の校舎">
        <defs>
          <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color={stage === 'war' ? '#9aa1ad' : sky1} /><stop offset="1" stop-color={stage === 'war' ? '#d9d4cc' : sky2} /></linearGradient>
        </defs>
        <rect width="360" height="150" fill="url(#sky)" />
        {season === 'summer' && <circle cx="320" cy="26" r="16" fill="#fff6c9" opacity="0.9" />}
        {season !== 'summer' && <circle cx="40" cy="28" r="10" fill="#fffdf2" opacity="0.7" />}
        <path d="M0 112 Q60 96 120 108 T240 104 T360 110 V150 H0Z" fill={season === 'winter' ? '#f4f6f8' : season === 'autumn' ? '#c9b27a' : '#9dc37a'} />
        {stage === 'war' && <path d="M300 60 q8 -14 0 -28 q-8 -10 4 -22" stroke="#6b6b6b" stroke-width="6" fill="none" opacity="0.35" />}
        {/* 本館 */}
        <rect x="112" y="64" width="136" height="56" fill="#e8dcc4" stroke="#8a7a5c" />
        <path d="M106 66 L180 40 L254 66Z" fill={tier >= 2 ? '#a5493a' : '#8d6b5a'} stroke="#6b4a3c" />
        {tier === 0 && <><path d="M150 52 l10 -3 l4 6z" fill="#e8dcc4" /><path d="M214 72 l-6 18" stroke="#8a7a5c" /></>}
        {/* 時計塔 */}
        <rect x="168" y="22" width="24" height="44" fill="#efe4cc" stroke="#8a7a5c" />
        <path d="M164 24 L180 8 L196 24Z" fill={tier >= 1 ? '#a5493a' : '#7d6a5c'} />
        <circle cx="180" cy="38" r="7" fill="#fffaf0" stroke="#8a7a5c" />
        <path d="M180 38 v-4 M180 38 h3" stroke="#5a4a3a" stroke-width="1.2" />
        {/* 窓 */}
        {windows.map(([x, y], i) => <rect x={x} y={y} width="10" height="12" rx="1.5" fill={i < lit ? (stage === 'war' ? '#f0c060' : '#ffe9a6') : '#6d6a63'} opacity={i < lit ? 1 : 0.65} />)}
        <rect x="171" y="98" width="18" height="22" fill="#7a5a3c" />
        {/* 両翼 */}
        <rect x="62" y="84" width="50" height="36" fill="#e2d4b8" stroke="#8a7a5c" />
        <rect x="248" y="84" width="50" height="36" fill="#e2d4b8" stroke="#8a7a5c" />
        <path d="M58 86 L87 70 L116 86Z" fill="#8d6b5a" /><path d="M244 86 L273 70 L302 86Z" fill="#8d6b5a" />
        {tier >= 1 && <><rect x="72" y="94" width="10" height="11" fill="#ffe9a6" /><rect x="92" y="94" width="10" height="11" fill={tier >= 2 ? '#ffe9a6' : '#6d6a63'} /></>}
        {tier >= 1 && <><rect x="258" y="94" width="10" height="11" fill="#ffe9a6" /><rect x="278" y="94" width="10" height="11" fill={tier >= 3 ? '#ffe9a6' : '#6d6a63'} /></>}
        {/* 旗 */}
        {Array.from({ length: flags }, (_, i) => { const x = 120 + i * 24; return <g><path d={`M${x} 64 V48`} stroke="#5a4a3a" /><path d={`M${x} 48 h10 l-3 3 l3 3 h-10z`} fill={['#3d6fa3', '#b8862b', '#4f8f4a', '#a5493a', '#6b5aa8', '#2f6b5a'][i]} /></g>; })}
        {/* 木 */}
        {[22, 44, 318, 340].map((x, i) => <g><rect x={x - 2} y={104 - (i % 2) * 4} width="4" height="14" fill="#6b4a32" /><circle cx={x} cy={98 - (i % 2) * 4} r="11" fill={TREE[season]} opacity="0.95" /></g>)}
        {tier >= 2 && [130, 150, 210, 230].map((x) => <circle cx={x} cy="124" r="3" fill={season === 'winter' ? '#fff' : '#f29bb0'} />)}
        {(s.facilities.dining ?? 0) >= 1 && <path d="M232 52 q4 -6 0 -12 q-4 -6 2 -12" stroke="#fff" stroke-width="3" fill="none" opacity="0.6" />}
      </svg>
      <div class="schoolname">リミナ分校{tier === 0 ? '（ボロボロ）' : tier === 3 ? '（立派になった）' : ''}</div>
    </div>
  );
}

// ---------- 今月のカレンダー ----------
export function MonthCalendar({ s }: { s: GameState }) {
  const ev = monthEvents(s);
  const next = nextEvent(s);
  const season = seasonOf(s.month);
  const slots = [1, 2, 3, 4, 5];
  useArt();
  const bg = artUrl(`season_${season}`);
  return (
    <div class="calendar card" style={bg ? { backgroundImage: `linear-gradient(rgba(255,250,240,.82), rgba(255,250,240,.9)), url(${bg})`, backgroundSize: 'cover' } : undefined}>
      <div class="row between">
        <div class="calmonth"><span class="big">{MONTH_NAMES[s.month]}</span><span class="muted small">{s.year}年目・{SEASON_NAMES[season]}</span></div>
        {next && <div class="small calnext"><Icon name="bell" size={14} /> {next.weeks === 0 ? `今週は${next.label}` : `${next.label}まであと${next.weeks}週`}</div>}
      </div>
      <div class="calgrid">
        {slots.map((k) => {
          const here = ev.filter((e) => e.slot === k);
          const now = k === s.week;
          const past = k < s.week;
          return (
            <div class={`calcell${now ? ' now' : ''}${past ? ' past' : ''}${k === 5 ? ' end' : ''}`}>
              <div class="calw">{k === 5 ? '月末' : `第${k}週`}</div>
              <div class="calev">{here.slice(0, 2).map((e) => <span class={`calicon${e.big ? ' big' : ''}`} title={e.label}><Icon name={e.icon} size={16} /><i>{e.label}</i></span>)}</div>
            </div>
          );
        })}
      </div>
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
