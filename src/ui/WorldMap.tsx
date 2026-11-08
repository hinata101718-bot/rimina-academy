// 大陸の勢力図（13夜目）：地形の絵の上に、地域ごとに治める国の色。⚔・教え子の数・地域をタップで吹き出し・三国の帯・この前から変わったこと
import { useEffect, useRef, useState } from 'preact/hooks';
import { act, useStore } from './store';
import { sfx } from './sound';
import { Sheet } from './common';
import { Portrait } from './Portrait';
import type { GameState } from '../core/state';
import { REGIONS, REGION_BY_ID, MAP_SIZE } from '../data/regions';
import { ownerOf, warRegions, alumniIn, regionShare, mapChanges, markMapSeen, OWNER_NAMES, type Owner } from '../core/regions';
import { titleOf } from '../core/alumni';

const BASE = import.meta.env.BASE_URL;
export const OWNER_COLOR: Record<Owner, [number, number, number]> = { kingdom: [60, 100, 185], empire: [190, 60, 50], alliance: [80, 150, 70], school: [214, 174, 79], wild: [150, 142, 128] };
const css = (o: Owner) => `rgb(${OWNER_COLOR[o].join(',')})`;

// 地形の絵と、地域の区分け（1つの点が地域の番号）を一度だけ読む
let baseImg: HTMLImageElement | null = null;
let idxData: Uint8ClampedArray | null = null;
let loading: Promise<void> | null = null;
function loadMap(): Promise<void> {
  if (loading) return loading;
  loading = new Promise((done) => {
    let n = 0;
    const fin = () => { if (++n === 2) done(); };
    const b = new Image(); b.onload = () => { baseImg = b; fin(); }; b.onerror = fin; b.src = `${BASE}art/worldmap.webp`;
    // 地域の番号は、絵から読み取らずに、そのままの数の並び（.bin）で読む。
    // iPhone の Safari や Brave は、のぞき見よけのために絵の読み取り（getImageData）にわざと乱れを混ぜることがあり、
    // 絵から読むと地域がまだらになるため
    fetch(`${BASE}art/worldmap-regions.bin`)
      .then((res) => (res.ok ? res.arrayBuffer() : null))
      .then((buf) => { if (buf && buf.byteLength === MAP_SIZE.w * MAP_SIZE.h) idxData = new Uint8ClampedArray(buf); })
      .catch(() => { /* 読めないときは色なし */ })
      .then(fin);
  });
  return loading;
}
export function regionAt(x: number, y: number): string | null {
  if (!idxData) return null;
  const i = idxData[Math.floor(y) * MAP_SIZE.w + Math.floor(x)];
  return REGIONS.find((r) => r.idx === i)?.id ?? null;
}

/** 地図の絵（地域を持ち主の色で塗る。highlight の地域は縁を光らせる） */
export function MapCanvas({ owners, highlight, onTap }: { owners: Record<string, Owner>; highlight?: string | null; onTap?: (id: string) => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(!!baseImg);
  useEffect(() => { loadMap().then(() => setReady(true)); }, []);
  const key = REGIONS.map((r) => owners[r.id]).join(',') + (highlight ?? '');
  useEffect(() => {
    const c = ref.current; if (!c || !ready) return;
    const g = c.getContext('2d'); if (!g) return;
    g.clearRect(0, 0, c.width, c.height);
    if (baseImg) g.drawImage(baseImg, 0, 0, MAP_SIZE.w, MAP_SIZE.h);
    if (!idxData) return;
    // 色の塗りは別の透明な絵に書いてから重ねる（地形の絵を読み取らない）
    const W = MAP_SIZE.w, H = MAP_SIZE.h, A = 0.36;
    const oc = document.createElement('canvas'); oc.width = W; oc.height = H;
    const og = oc.getContext('2d'); if (!og) return;
    const img = og.createImageData(W, H);
    const d = img.data;
    const ownerByIdx: (Owner | null)[] = [];
    for (const r of REGIONS) ownerByIdx[r.idx] = owners[r.id] ?? r.home;
    const hiIdx = highlight ? REGION_BY_ID[highlight]?.idx : -1;
    const put = (p: number, r: number, gg: number, b: number, a: number) => { d[p] = r; d[p + 1] = gg; d[p + 2] = b; d[p + 3] = Math.round(a * 255); };
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x; const k = idxData[i];
      if (k === 255) continue;
      const o = ownerByIdx[k]; if (!o) continue;
      const col = OWNER_COLOR[o]; const p = i * 4;
      const right = x + 1 < W ? idxData[i + 1] : k, down = y + 1 < H ? idxData[i + W] : k;
      const edge = (right !== k && right !== 255) || (down !== k && down !== 255);
      const nat = edge && ((right !== k && ownerByIdx[right] !== o) || (down !== k && ownerByIdx[down] !== o));
      let a = A;
      if (k === hiIdx) a = 0.55 + 0.25 * (((x + y) >> 3) & 1); // 変わった地域は斜線
      if (k === hiIdx && edge) put(p, 255, 240, 170, 1);
      else if (nat) put(p, 250, 225, 150, 1); // 国境は金の線
      else if (edge && ((x + y) >> 2) % 2 === 0) put(p, col[0] * 0.3, col[1] * 0.3, col[2] * 0.3, 0.7); // 地域の境は点線
      else put(p, col[0], col[1], col[2], a);
    }
    og.putImageData(img, 0, 0);
    g.drawImage(oc, 0, 0);
  }, [ready, key]);
  return <canvas ref={ref} width={MAP_SIZE.w} height={MAP_SIZE.h} class="wm-canvas" onClick={(e) => {
    if (!onTap) return;
    const c = e.currentTarget as HTMLCanvasElement; const rc = c.getBoundingClientRect();
    const id = regionAt(((e.clientX - rc.left) / rc.width) * MAP_SIZE.w, ((e.clientY - rc.top) / rc.height) * MAP_SIZE.h);
    if (id) onTap(id);
  }} />;
}

/** 戦況タブの勢力図 */
export function WorldMap({ s }: { s: GameState }) {
  const [sel, setSel] = useState<string | null>(null);
  const [zoom, setZoom] = useState(false);
  const { route } = useStore();
  const [play, setPlay] = useState(() => route.sub === 'play' && mapChanges(s).length > 0); // 14夜目：手帳の「勢力図が動いた」から
  const owners = Object.fromEntries(REGIONS.map((r) => [r.id, ownerOf(s, r.id)])) as Record<string, Owner>;
  const wars = new Set(warRegions(s));
  const changes = mapChanges(s);
  // はじめて開いたときは、今のようすを「見たとき」にする。閉じるときにも
  useEffect(() => { if (!s.mapSeen) act((g) => markMapSeen(g), true); return () => { act((g) => { if (!mapChanges(g).length) markMapSeen(g); }, true); }; }, []);
  const share = regionShare(s);
  const total = REGIONS.length;
  const r = sel ? REGION_BY_ID[sel] : null;
  const alum = sel ? alumniIn(s, sel) : [];
  return (
    <div class="card wm-card">
      <div class="row between nowrap"><h3 style={{ margin: 0 }} class="serif">大陸の勢力図</h3><button class="btn small" onClick={() => { sfx('move'); setZoom(!zoom); }}>{zoom ? '元の大きさ' : '拡大する'}</button></div>
      <div class={`wm-wrap${zoom ? ' zoom' : ''}`}>
        <div class="wm-map">
          <MapCanvas owners={owners} onTap={(id) => { sfx('move'); setSel(id); }} />
          <div class="wm-year serif">大陸暦 第{s.year}年</div>
          {REGIONS.map((x) => {
            const o = owners[x.id];
            const n = alumniIn(s, x.id).length;
            return (
              <button class={`wm-label ${o}${x.kind === 'capital' ? ' cap' : ''}${x.kind === 'school' ? ' school' : ''}`} style={{ left: `${(x.x / MAP_SIZE.w) * 100}%`, top: `${(x.y / MAP_SIZE.h) * 100}%` }} onClick={() => { sfx('move'); setSel(x.id); }}>
                {x.kind === 'school' ? <span class="wm-star">★</span> : null}{x.kind === 'capital' ? '◆' : ''}{zoom ? x.name : (x.short ?? x.name)}
                {wars.has(x.id) && <i class="wm-war">⚔</i>}
                {n > 0 && x.kind !== 'school' && <i class="wm-alum">{n}</i>}
              </button>
            );
          })}
        </div>
      </div>
      <div class="wm-legend small">{(['kingdom', 'empire', 'alliance', 'school', 'wild'] as Owner[]).map((o) => <span><i style={{ background: css(o) }} />{OWNER_NAMES[o]}</span>)}</div>
      <div class="wm-share">{(['empire', 'kingdom', 'alliance', 'wild', 'school'] as Owner[]).map((o) => share[o] ? <span style={{ width: `${(share[o] / total) * 100}%`, background: css(o) }} title={`${OWNER_NAMES[o]} ${share[o]}`} /> : null)}</div>
      <div class="small muted" style={{ textAlign: 'center' }}>地域をタップすると、そこにいる教え子と名産が見られます。⚔は戦いの最中、青い丸は教え子の数です</div>
      {changes.length > 0 && (
        <button class="wm-changes" onClick={() => { sfx('ok'); setPlay(true); }}>
          ✦ この前から変わったこと：<b>{REGION_BY_ID[changes[0].id].name}が{OWNER_NAMES[changes[0].to]}の手に</b>（{OWNER_NAMES[changes[0].from]}から）{changes.length > 1 ? `ほか${changes.length - 1}つ` : ''}　▶ 見る
        </button>
      )}
      {r && (
        <Sheet title={r.name} onClose={() => setSel(null)}>
          <div class="row nowrap gap6"><i class="wm-dot" style={{ background: css(owners[r.id]) }} /><b>{OWNER_NAMES[owners[r.id]]}</b>{owners[r.id] !== r.home && <span class="small muted">（もとは{OWNER_NAMES[r.home]}）</span>}{wars.has(r.id) && <span class="flag red">戦いの最中</span>}</div>
          <div class="small" style={{ marginTop: 4 }}>名産：<b>{r.product}</b></div>
          <h3>この地域にいる教え子</h3>
          {alum.length === 0 && <div class="muted small">今はいません</div>}
          {alum.map((st) => <div class="row nowrap gap6" style={{ margin: '4px 0' }}><Portrait st={st} size={36} /><span><b>{st.given}</b>（{st.cohort}期生）<span class="small muted">{titleOf(st)}</span></span></div>)}
        </Sheet>
      )}
      {play && <MapChangePlayer s={s} onDone={() => { setPlay(false); act((g) => markMapSeen(g)); }} />}
    </div>
  );
}

/** ③ 勢力図の変化を1つずつ場面で（組織図の変化と同じ見せ方） */
export function MapChangePlayer({ s, onDone }: { s: GameState; onDone: () => void }) {
  const list = mapChanges(s);
  const [i, setI] = useState(0);
  const [after, setAfter] = useState(false);
  const frame = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ w: 0, h: 0 });
  useEffect(() => { const el = frame.current; if (el) setBox({ w: el.clientWidth, h: el.clientHeight }); }, []);
  useEffect(() => { setAfter(false); const t = setTimeout(() => { setAfter(true); sfx('stamp'); }, 700); return () => clearTimeout(t); }, [i]);
  const c = list[i];
  if (!c) { onDone(); return null; }
  const r = REGION_BY_ID[c.id];
  const owners = Object.fromEntries(REGIONS.map((x) => [x.id, x.id === c.id ? (after ? c.to : c.from) : ownerOf(s, x.id)])) as Record<string, Owner>;
  // 寄る：その地域が真ん中に来るように、地図を大きくずらす
  // 枠の大きさを測り、地図の上の位置（画素）で合わせる（枠と地図は縦横の比が違うため）
  const SC = 1.8;
  const fw = box.w || 360, fh = box.h || 480, mh = fw * (MAP_SIZE.h / MAP_SIZE.w);
  const tx = fw / 2 - SC * (r.x / MAP_SIZE.w) * fw, ty = fh / 2 - SC * (r.y / MAP_SIZE.h) * mh;
  const next = () => { sfx('ok'); if (i + 1 < list.length) setI(i + 1); else onDone(); };
  return (
    <div class="oc-player wm-player" onClick={next}>
      <div class="oc-phead"><b class="serif">大陸の勢力図</b><span class="oc-pcount">変化 {i + 1}／{list.length}</span></div>
      <div class="wm-pframe" ref={frame}>
        <div class="wm-pmap" style={{ transform: `translate(${tx}px, ${ty}px) scale(${SC})` }}><MapCanvas owners={owners} highlight={c.id} /></div>
        <div class={`wm-pname serif ${after ? c.to : c.from}`}>{r.name}</div>
      </div>
      <div class="oc-pwin">
        <b class="serif">{r.name}、{OWNER_NAMES[c.to]}の手に</b>
        <div class="small">{OWNER_NAMES[c.from]}から{OWNER_NAMES[c.to]}へ（{c.year}年目）。名産は{r.product}。</div>
      </div>
      <div class="oc-pbtns" onClick={(e) => e.stopPropagation()}>
        <button class="btn primary" onClick={next}>タップで次へ</button>
        <button class="btn" onClick={() => { sfx('cancel'); onDone(); }}>全部とばす</button>
      </div>
    </div>
  );
}
