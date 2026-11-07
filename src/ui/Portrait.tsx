// パーツ組み合わせの似顔絵（SVG）。public/faces/ に顔画像があれば差し替える
import { HAIR_COLORS, HAIR_NAMES, SKIN_COLORS, COUNTRY_COLOR } from '../data/people';
import type { Student, FaceParts } from '../core/state';
import { getGame } from './store';

let faceFiles: string[] = [];
export async function loadFaceManifest(): Promise<void> {
  try {
    const r = await fetch(`${import.meta.env.BASE_URL}faces/index.json`, { cache: 'no-cache' });
    if (r.ok) { const j = await r.json(); faceFiles = Array.isArray(j.files) ? j.files : []; }
  } catch { /* なくてよい */ }
}
function hash(s: string): number { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) | 0; return Math.abs(h); }

/** ファイル名から性別と髪色を読む。新形式 {性別}_{髪色}_{番号}、旧形式 {国}_{性別}_{髪色}_{番号} の両方に対応 */
function parseFace(f: string): { g: string; hair: string } | null {
  const m = f.match(/^(?:(?:kingdom|empire|alliance)_)?([mf])_([a-z]+)_/);
  return m ? { g: m[1], hair: m[2] } : null;
}

/**
 * 顔画像の割り当て。生徒ごとに一度決めたら faceImage に保存して変えない。
 * 在校生・志願者どうしで同じ顔にならないようにし、同じ性別・同じ髪色の顔を優先する
 * （顔は全員おそろいの学校の制服なので、出身国では分けない）。
 */
export function faceImageFor(st: Student): string | null {
  if (!faceFiles.length) return null;
  if (st.faceImage && faceFiles.includes(st.faceImage)) return `${import.meta.env.BASE_URL}faces/${st.faceImage}`;
  const g = getGame();
  const used = new Set<string>();
  if (g) {
    for (const o of Object.values(g.students)) if (o.status === 'enrolled' && o.faceImage && o.id !== st.id) used.add(o.faceImage);
    for (const o of g.applicants ?? []) if (o.faceImage && o.id !== st.id) used.add(o.faceImage);
  }
  const hair = HAIR_NAMES[st.face.hair];
  const all = faceFiles.map((f) => ({ f, p: parseFace(f) })).filter((x) => x.p && x.p.g === st.gender);
  const free = all.filter((x) => !used.has(x.f));
  const tiers = [free.filter((x) => x.p!.hair === hair), free, all];
  const list = tiers.find((t) => t.length) ?? [];
  if (!list.length) return null;
  const pick = list[hash(st.id) % list.length].f;
  st.faceImage = pick; // 一度決めた顔は保存して固定（次の自動保存で残る）
  return `${import.meta.env.BASE_URL}faces/${pick}`;
}

function darken(hex: string, k = 0.75): string {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.round(((n >> 16) & 255) * k), g = Math.round(((n >> 8) & 255) * k), b = Math.round((n & 255) * k);
  return `rgb(${r},${g},${b})`;
}

function back(style: number, hc: string) {
  // 後ろ髪
  switch (style) {
    case 0: return <path d="M18 40 Q16 78 30 92 L70 92 Q84 78 82 40 Z" fill={hc} />; // ロング
    case 1: return <path d="M20 42 Q18 66 26 74 L74 74 Q82 66 80 42 Z" fill={hc} />; // セミロング
    case 3: return <g fill={hc}><circle cx="18" cy="36" r="9" /><circle cx="82" cy="36" r="9" /><path d="M14 40 Q8 70 16 84 L24 82 Q20 62 24 44Z" /><path d="M86 40 Q92 70 84 84 L76 82 Q80 62 76 44Z" /></g>; // ツインテール
    case 4: return <path d="M50 14 Q86 18 76 40 Q90 60 70 70 L60 52Z" fill={hc} />; // ポニーテール
    case 11: return <path d="M22 44 Q20 88 34 96 L66 96 Q80 88 78 44 Z" fill={hc} />; // 三つ編み風
    default: return null;
  }
}
function front(style: number, hc: string) {
  const d = darken(hc, 0.85);
  switch (style) {
    case 0: case 1: case 11: return <path d="M24 44 Q22 18 50 16 Q78 18 76 44 Q66 30 50 32 Q34 30 24 44Z" fill={hc} stroke={d} stroke-width="1" />;
    case 2: return <path d="M23 46 Q20 16 50 15 Q80 16 77 46 Q74 34 62 30 Q56 38 44 34 Q32 36 23 46Z" fill={hc} stroke={d} stroke-width="1" />; // ボブ
    case 3: return <path d="M25 42 Q24 18 50 17 Q76 18 75 42 Q64 32 50 34 Q36 32 25 42Z" fill={hc} />;
    case 4: return <path d="M25 42 Q24 18 50 17 Q76 18 75 42 Q70 30 58 28 Q44 36 25 42Z" fill={hc} />;
    case 5: return <path d="M25 40 Q26 16 50 16 Q74 16 75 40 L70 32 L62 36 L54 30 L46 36 L38 30 L30 36Z" fill={hc} stroke={d} stroke-width="1" />; // 短髪
    case 6: return <path d="M24 42 Q22 12 52 14 Q80 16 76 40 Q70 26 56 30 Q40 22 24 42Z" fill={hc} stroke={d} stroke-width="1" />; // 流し
    case 7: return <path d="M24 38 L28 18 L36 26 L42 12 L50 24 L58 10 L64 24 L72 16 L76 38 Q62 30 50 30 Q38 30 24 38Z" fill={hc} stroke={d} stroke-width="1" />; // とげとげ
    case 8: return <path d="M25 36 Q26 20 50 20 Q74 20 75 36 Q62 30 50 30 Q38 30 25 36Z" fill={hc} />; // 坊主ぎみ
    case 9: return <path d="M22 50 Q18 14 50 14 Q82 14 78 50 Q76 36 70 32 L64 42 Q56 30 50 34 Q42 30 36 42 L30 32 Q24 36 22 50Z" fill={hc} stroke={d} stroke-width="1" />; // ぼさぼさ
    case 10: return <path d="M24 44 Q22 16 50 16 Q78 16 76 44 Q76 30 50 28 Q28 28 30 40 Z" fill={hc} stroke={d} stroke-width="1" />; // 七三
    default: return null;
  }
}
function eyes(kind: number) {
  switch (kind) {
    case 0: return <g fill="#2a2420"><ellipse cx="40" cy="52" rx="3.2" ry="4" /><ellipse cx="60" cy="52" rx="3.2" ry="4" /><circle cx="41" cy="51" r="1" fill="#fff" /><circle cx="61" cy="51" r="1" fill="#fff" /></g>;
    case 1: return <g stroke="#2a2420" stroke-width="2.2" fill="none" stroke-linecap="round"><path d="M35 52 Q40 49 45 52" /><path d="M55 52 Q60 49 65 52" /></g>;
    case 2: return <g fill="#2a2420"><rect x="36" y="50" width="8" height="3" rx="1.5" /><rect x="56" y="50" width="8" height="3" rx="1.5" /></g>;
    case 3: return <g fill="#2a2420"><circle cx="40" cy="52" r="4.5" /><circle cx="60" cy="52" r="4.5" /><circle cx="41.5" cy="50.5" r="1.6" fill="#fff" /><circle cx="61.5" cy="50.5" r="1.6" fill="#fff" /></g>;
    default: return <g fill="#2a2420"><path d="M35 53 Q40 47 45 53 Z" /><path d="M55 53 Q60 47 65 53 Z" /></g>;
  }
}
function mouth(kind: number) {
  switch (kind) {
    case 0: return <path d="M44 66 Q50 71 56 66" stroke="#8a3c32" stroke-width="2" fill="none" stroke-linecap="round" />;
    case 1: return <path d="M45 67 L55 67" stroke="#8a3c32" stroke-width="2" stroke-linecap="round" />;
    case 2: return <path d="M44 65 Q50 74 56 65 Z" fill="#a54a3e" />;
    default: return <path d="M46 68 Q50 65 54 68" stroke="#8a3c32" stroke-width="2" fill="none" stroke-linecap="round" />;
  }
}
function brows(kind: number, hc: string) {
  const c = darken(hc, 0.7);
  if (kind === 0) return <g stroke={c} stroke-width="2" stroke-linecap="round"><path d="M35 44 L45 44" /><path d="M55 44 L65 44" /></g>;
  if (kind === 1) return <g stroke={c} stroke-width="2" stroke-linecap="round"><path d="M35 46 L45 43" /><path d="M55 43 L65 46" /></g>;
  return <g stroke={c} stroke-width="2" stroke-linecap="round"><path d="M35 43 L45 45" /><path d="M55 45 L65 43" /></g>;
}

export function FaceSvg({ face, size = 48, dim = false }: { face: FaceParts; size?: number; dim?: boolean }) {
  const hc = HAIR_COLORS[face.hair] ?? '#5a3a24';
  const skin = SKIN_COLORS[face.skin] ?? SKIN_COLORS[0];
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} style={{ flex: 'none', filter: dim ? 'grayscale(1) opacity(.6)' : undefined }} aria-hidden="true">
      <circle cx="50" cy="50" r="49" fill="#efe4cc" />
      {back(face.hairStyle, hc)}
      <path d="M22 100 Q24 80 50 78 Q76 80 78 100 Z" fill={face.cloth} />
      <path d="M44 78 L50 88 L56 78" fill="#fff" opacity=".8" />
      <rect x="44" y="70" width="12" height="10" fill={skin} />
      <ellipse cx="50" cy="50" rx="25" ry="27" fill={skin} />
      {eyes(face.eyes)}
      {brows(face.brows, hc)}
      {mouth(face.mouth)}
      <ellipse cx="34" cy="62" rx="4" ry="2.4" fill="#e89c8c" opacity=".35" />
      <ellipse cx="66" cy="62" rx="4" ry="2.4" fill="#e89c8c" opacity=".35" />
      {front(face.hairStyle, hc)}
      {face.accessory === 1 && <g stroke="#444" stroke-width="1.6" fill="none"><circle cx="40" cy="52" r="6" /><circle cx="60" cy="52" r="6" /><path d="M46 52 L54 52" /></g>}
      {face.accessory === 2 && <path d="M28 30 Q50 22 72 30" stroke="#c0392b" stroke-width="4" fill="none" />}
      {face.accessory === 3 && <circle cx="72" cy="30" r="4" fill="#e8c34a" />}
    </svg>
  );
}

export function Portrait({ st, size = 48 }: { st: Student; size?: number }) {
  const g = getGame();
  const dead = st.status === 'dead' || (st.career && !st.career.alive);
  if (g?.settings.portrait === 'dot') {
    return <span class="dot-face" style={{ width: size, height: size, background: COUNTRY_COLOR[st.origin], fontSize: size * 0.42, opacity: dead ? 0.5 : 1 }}>{st.given[0]}</span>;
  }
  const img = faceImageFor(st);
  if (img) {
    // 顔画像は胸から上の絵なので、小さい表示ほど顔のあたりを大きく切り抜く
    const zoom = size <= 64 ? 1.55 : size <= 120 ? 1.3 : 1.0;
    return (
      <span style={{ width: size, height: size, borderRadius: size <= 120 ? '22%' : '12px', overflow: 'hidden', flex: 'none', display: 'inline-block', position: 'relative', background: '#f7f0e2', border: '1.5px solid #c9bfa8', boxSizing: 'border-box' }}>
        <img src={img} alt="" loading="lazy" style={{ position: 'absolute', width: `${zoom * 100}%`, left: `${-(zoom - 1) * 50}%`, top: zoom > 1 ? '-2%' : '0', filter: dead ? 'grayscale(1)' : undefined }} />
      </span>
    );
  }
  return <FaceSvg face={st.face} size={size} dim={!!dead} />;
}
