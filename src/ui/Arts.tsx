// 戦技と心得（12夜目）：覚えた演出、技能タブの一覧と付けかえ
import { useEffect, useState } from 'preact/hooks';
import { act } from './store';
import { Portrait } from './Portrait';
import { sfx } from './sound';
import { countryColor } from './cards';
import { HelpTip, Sheet } from './common';
import type { GameState, Student, Pending } from '../core/state';
import { ARTS, ART_LIST, ART_SLOTS, type ArtDef } from '../data/arts';
import { SKILL_NAMES } from '../data/people';
import { SKILLS, RANKS, RANK_POINTS } from '../data/balance';
import { toggleArt, autoEquip, needRank } from '../core/arts';
import { rankOf } from '../core/util';
import type { Rank } from '../core/types';

/** 覚えた瞬間（タップで進む） */
export function ArtLearnView({ s, p, onDone }: { s: GameState; p: Extract<Pending, { type: 'art' }>; onDone: () => void }) {
  const st = s.students[p.studentId];
  const [i, setI] = useState(0);
  const [lit, setLit] = useState(false);
  useEffect(() => { setLit(false); const t = setTimeout(() => { setLit(true); sfx('pass'); }, 300); return () => clearTimeout(t); }, [i]);
  const a = ARTS[p.ids[i]];
  if (!st || !a) { onDone(); return null; }
  const next = () => { sfx('ok'); if (i + 1 < p.ids.length) setI(i + 1); else onDone(); };
  return (
    <div class="dc-wrap stage3" onClick={() => (lit ? next() : setLit(true))}>
      <div class="dc-title">{SKILL_NAMES[a.skill]}が{rankOf(st.skills[a.skill] ?? 0)}に上がった！</div>
      <div class="row nowrap gap6" style={{ justifyContent: 'center', margin: '6px 0' }}><Portrait st={st} size={56} frame={countryColor(st.origin)} /><b class="serif">{st.given}</b></div>
      <div class={`lt-card${lit ? ' lit' : ''}`} key={i}>
        <span class="small muted">{a.kind === 'art' ? '戦技' : '心得'}を覚えた</span>
        <b class="serif">{a.name}</b>
        <small>{a.desc}</small>
      </div>
      <div class="small muted">{a.kind === 'art' ? '戦いの中で、ここぞのときに自動で使います' : 'いつも効きます'}</div>
      <button class="btn primary block" style={{ marginTop: 10 }} onClick={(e) => { e.stopPropagation(); next(); }}>{i + 1 < p.ids.length ? '次へ' : '閉じる'}</button>
    </div>
  );
}

const WNAME: Record<string, string> = { sword: '剣', lance: '槍', axe: '斧', bow: '弓', magic: '魔道', holy: '信仰', staff: '杖', gun: '銃' };
const MOVE_NAME: Record<string, string> = { armor: '重装', flying: '空を飛ぶ敵', cavalry: '騎馬', infantry: '歩兵' };
/** 効果のひとこと（やさしい言葉で） */
export function artPlain(a: ArtDef): string {
  const out: string[] = [];
  if (a.kind === 'art') {
    if ((a.mul ?? 1) > 1) out.push('一撃が重い');
    if (a.vsMove?.length) out.push(`${a.vsMove.map((m) => MOVE_NAME[m] ?? m).join('・')}に強い`);
    if (a.pierce) out.push('相手の守りを抜ける');
    if ((a.crit ?? 0) > 0) out.push('急所に入りやすい');
    if ((a.dmg ?? 0) > 0 && (a.mul ?? 1) <= 1) out.push('威力が上がる');
    if ((a.hit ?? 0) > 0) out.push('当たりやすい');
    if ((a.hit ?? 0) < 0) out.push('少し当たりにくい');
  } else {
    const b = a.ability ?? {};
    const w = b.wtype?.length ? `${b.wtype.map((x) => WNAME[x] ?? x).join('・')}を持つと` : '';
    const e: string[] = [];
    if (b.hit || b.realBattleHit) e.push('当たりやすい');
    if (b.avo || b.aloneAvo) e.push('身をかわしやすい');
    if (b.crit) e.push('急所に入りやすい');
    if (b.dmg || b.lowHpAtk) e.push(b.lowHpAtk ? '傷を負うと攻撃が上がる' : '威力が上がる');
    if (b.prot) e.push('受ける傷が浅くなる');
    if (b.adjAllyDef || b.adjAllyProt) e.push('隣の仲間を守る');
    if (b.auraHeal) e.push('まわりの仲間の傷がふさがる');
    if (b.followUp) e.push('もう一撃を入れやすい');
    if (b.pierce) e.push('相手の守りを抜ける');
    if (b.effective?.length) e.push(`${b.effective.map((m) => MOVE_NAME[m] ?? m).join('・')}に強い`);
    out.push(`${w}${e.join('、') || 'いつも少し強くなる'}`);
  }
  return out.join('。') || a.desc;
}
function whenUsed(a: ArtDef): string {
  if (a.kind === 'mind') return 'いつも効きます（付けているあいだ）。';
  const v = a.vsMove?.length ? `${a.vsMove.map((m) => MOVE_NAME[m] ?? m).join('・')}の敵と向き合ったときに使いやすい。` : (a.mul ?? 1) > 1 ? '敵が1人で前に出てきたときに使いやすい。' : '';
  return `戦いの中で自動で使います（攻めるときの${a.chance ?? 25}%くらい）。${v}`;
}

/** 技の札（名前・種類・効果のひとこと）。押すとくわしい説明 */
function ArtTile({ a, on, onOpen }: { a: ArtDef; on?: boolean; onOpen: () => void }) {
  return (
    <button class={`art-tile ${a.kind}${on ? ' on' : ''}${a.bloom ? ' bloom' : ''}`} onClick={() => { sfx('move'); onOpen(); }}>
      <span class="row nowrap gap6"><b class="serif">{a.name}</b><span class="small muted">（{a.kind === 'art' ? '戦技' : '心得'}・{SKILL_NAMES[a.skill]}）</span></span>
      <span class="small">{artPlain(a)}</span>
    </button>
  );
}

/** 技能タブ（14夜目に作り直し）：つけている技 → ほかに覚えている技（たたむ） → あと少しで覚えそうな技 → 技の図鑑 */
export function ArtsCard({ s, st }: { s: GameState; st: Student }) {
  const learned = (st.arts ?? []).map((id) => ARTS[id]).filter(Boolean);
  const on = new Set(st.artsOn ?? []);
  const [more, setMore] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const [book, setBook] = useState(false);
  const onArts = learned.filter((a) => on.has(a.id) && a.kind === 'art');
  const onMinds = learned.filter((a) => on.has(a.id) && a.kind === 'mind');
  const offs = learned.filter((a) => !on.has(a.id));
  // あと少しで覚えそうな技：次のランクまでの差が小さいものだけ1〜3個（目標・得意の技能を先に）
  const near = ART_LIST.filter((a) => !learned.includes(a) && !a.bloom).map((a) => {
    const need = needRank(st, a); if (!need) return null;
    const gap = RANK_POINTS[need] - (st.skills[a.skill] ?? 0);
    const span = Math.max(30, RANK_POINTS[need] - (RANK_POINTS[RANKS[Math.max(0, RANKS.indexOf(need) - 1)]] ?? 0));
    return gap > 0 && gap <= span * 0.6 ? { a, need, gap, pri: (st.targets.includes(a.skill) ? 0 : st.apt?.good.includes(a.skill) ? 1 : 2) } : null;
  }).filter((x): x is { a: ArtDef; need: Rank; gap: number; pri: number } => !!x).sort((x, y) => x.pri - y.pri || x.gap - y.gap).slice(0, 3);
  const sel = open ? ARTS[open] : null;
  return (
    <div class="card arts-card">
      <div class="row between nowrap"><h3 style={{ margin: 0 }}>戦技と心得 <HelpTip text={`技能ランクが上がると覚えます。得意な技能や、卒業生の講師に手ほどきを受けた技は、ひとつ前のランクで覚えます。付けられるのは戦技${ART_SLOTS.art}つ・心得${ART_SLOTS.mind}つまでで、ふだんはおまかせです。`} /></h3></div>
      <div class="row between nowrap arts-sub"><b class="small">つけている戦技　{onArts.length}／{ART_SLOTS.art}</b>{st.artsManual && <button class="btn ghost small" onClick={() => act((g) => { const x = g.students[st.id]; x.artsManual = false; autoEquip(x); })}>おまかせに戻す</button>}</div>
      {onArts.length ? onArts.map((a) => <ArtTile a={a} on onOpen={() => setOpen(a.id)} />) : <div class="small muted">まだ戦技を覚えていません</div>}
      <div class="arts-sub"><b class="small">つけている心得　{onMinds.length}／{ART_SLOTS.mind}</b></div>
      {onMinds.length ? onMinds.map((a) => <ArtTile a={a} on onOpen={() => setOpen(a.id)} />) : <div class="small muted">まだ心得を覚えていません</div>}
      {offs.length > 0 && <button class="btn ghost small block" style={{ marginTop: 6 }} onClick={() => setMore(!more)}>ほかに覚えている技 {offs.length}つ {more ? '▲' : '▼'}</button>}
      {more && offs.map((a) => <ArtTile a={a} onOpen={() => setOpen(a.id)} />)}
      {near.length > 0 && <><div class="arts-sub"><b class="small">次に覚えそうな技</b></div>
        {near.map((x) => <div class="art-tile none small">{SKILL_NAMES[x.a.skill]}{x.need} まで あと少し ― ？？？{(st.taught ?? []).includes(x.a.id) ? '（講師に手ほどきを受けた）' : ''}</div>)}</>}
      <button class="btn ghost small" style={{ marginTop: 6 }} onClick={() => setBook(true)}>技の図鑑を見る</button>
      {sel && (
        <Sheet title={sel.name} onClose={() => setOpen(null)}>
          <div class="small muted">{sel.kind === 'art' ? '戦技' : '心得'}・{SKILL_NAMES[sel.skill]}のランク{sel.rank}で覚える{(st.taught ?? []).includes(sel.id) ? '（講師に手ほどきを受けた）' : ''}</div>
          <p class="serif">{artPlain(sel)}</p>
          <p class="small">{whenUsed(sel)}</p>
          <p class="small muted">くわしい数字：{sel.desc}</p>
          <button class="btn primary block" onClick={() => { sfx('ok'); act((g) => toggleArt(g.students[st.id], sel.id)); setOpen(null); }}>{on.has(sel.id) ? '外す' : 'つける'}</button>
        </Sheet>
      )}
      {book && <ArtBook s={s} onClose={() => setBook(false)} />}
    </div>
  );
}

/** 技の図鑑（14夜目）：覚えた子がいる技だけ名前が見える */
function ArtBook({ s, onClose }: { s: GameState; onClose: () => void }) {
  const known = new Set(Object.values(s.students).flatMap((x) => x.arts ?? []));
  const skills = SKILLS.filter((k) => k !== 'gun' || s.world.gunUnlocked);
  return (
    <Sheet title={`技の図鑑（${ART_LIST.filter((a) => known.has(a.id)).length}／${ART_LIST.length}）`} onClose={onClose}>
      <div class="small muted">生徒か卒業生が一度でも覚えた技は、名前と効果が見えます。</div>
      {skills.map((k) => (
        <div class="arts-row"><span class="arts-sk small">{SKILL_NAMES[k]}</span>
          <span class="arts-list">{ART_LIST.filter((a) => a.skill === k && (!a.bloom || known.has(a.id))).map((a) => known.has(a.id) ? <span class={`arts-chip ${a.kind}`} title={artPlain(a)}>{a.name}</span> : <span class="arts-chip none">{a.rank}で？？？</span>)}</span>
        </div>
      ))}
    </Sheet>
  );
}
