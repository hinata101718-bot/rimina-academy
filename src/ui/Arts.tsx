// 戦技とスキル（12夜目。15夜目に「心得」を「スキル」に、魔法を戦技と同じ一覧に）：覚えた演出、技能タブの一覧と付けかえ
import { useEffect, useState } from 'preact/hooks';
import { act, navigate } from './store';
import { Portrait } from './Portrait';
import { sfx } from './sound';
import { countryColor } from './cards';
import { HelpTip, Sheet } from './common';
import type { GameState, Student, Pending } from '../core/state';
import { ARTS, ART_LIST, ART_SLOTS, type ArtDef } from '../data/arts';
import { SKILL_NAMES } from '../data/people';
import { SKILLS, RANKS, RANK_POINTS } from '../data/balance';
import { toggleArt, autoEquip, needRank, loadoutOf, isSpellId } from '../core/arts';
import { usableSpells, nextSpell } from '../core/spells';
import { WEAPONS } from '../data/weapons';
import { CLASSES } from '../data/classes';
import { ABILITIES } from '../data/abilities';
import type { AbilityDef, SkillId } from '../core/types';
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
        <span class="small muted">{a.kind === 'art' ? '戦技' : 'スキル'}を覚えた</span>
        <b class="serif">{a.name}</b>
        <small>{a.desc}</small>
      </div>
      <div class="small muted">{a.kind === 'art' ? '戦いの中で、ここぞのときに自動で使います' : `${whenMark(a.ability)}効きます`}</div>
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
  if (a.kind === 'mind') return `${whenMark(a.ability)}効きます（つけているあいだ）。`;
  const v = a.vsMove?.length ? `${a.vsMove.map((m) => MOVE_NAME[m] ?? m).join('・')}の敵と向き合ったときに使いやすい。` : (a.mul ?? 1) > 1 ? '敵が1人で前に出てきたときに使いやすい。' : '';
  return `戦いの中で自動で使います（攻めるときの${a.chance ?? 25}%くらい）。${v}`;
}
/** 15夜目：スキルの効き方の印（「いつも」「HPが半分以下のとき」など） */
export function whenMark(b?: Partial<AbilityDef>): string {
  if (!b) return 'いつも';
  if (b.lowHpAtk) return 'HPが半分以下のとき';
  if (b.aloneAvo) return 'まわりに仲間がいないとき';
  if (b.surroundedAvo) return '敵に囲まれたとき';
  if (b.realBattleHit) return '実戦のとき';
  return 'いつも';
}
const KIND_NAME = { art: '戦技', mind: 'スキル' } as const;

/** 技の札（名前・種類・効果のひとこと）。押すとくわしい説明 */
function ArtTile({ a, on, onOpen }: { a: ArtDef; on?: boolean; onOpen: () => void }) {
  return (
    <button class={`art-tile ${a.kind}${on ? ' on' : ''}${a.bloom ? ' bloom' : ''}`} onClick={() => { sfx('move'); onOpen(); }}>
      <span class="row nowrap gap6"><b class="serif">{a.name}</b><span class="small muted">（{KIND_NAME[a.kind]}・{SKILL_NAMES[a.skill]}）</span>{a.kind === 'mind' && <span class="when-mark">{whenMark(a.ability)}</span>}</span>
      <span class="small">{artPlain(a)}</span>
    </button>
  );
}
/** 魔法の札（15夜目：戦技と同じ一覧に） */
function SpellTile({ id, on, usable, onOpen }: { id: string; on?: boolean; usable: boolean; onOpen: () => void }) {
  const w = WEAPONS[id];
  if (!w) return null;
  return (
    <button class={`art-tile spell${on ? ' on' : ''}${usable ? '' : ' off'}`} onClick={() => { sfx('move'); onOpen(); }}>
      <span class="row nowrap gap6"><b class="serif">{w.name}{w.rare ? '★' : ''}</b><span class="small muted">（魔法・{w.type === 'staff' ? '杖' : w.type === 'holy' ? '信仰' : '魔道'}）</span></span>
      <span class="small">{w.desc}{usable ? '' : '（今の兵種では使えない）'}</span>
    </button>
  );
}

/** 技能タブ（15夜目に作り直し）：つけている戦技と魔法（合わせて5つ）→ スキル（5つ・兵種のスキル）→ ほかに覚えているもの（たたむ）→ 次に覚えそうなもの */
export function ArtsCard({ s, st }: { s: GameState; st: Student }) {
  const learned = (st.arts ?? []).map((id) => ARTS[id]).filter(Boolean);
  const on = new Set(loadoutOf(st));
  const [more, setMore] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const usable = new Set(usableSpells(st));
  const onBattle = [...on].filter((id) => isSpellId(id) || ARTS[id]?.kind === 'art');
  const onMinds = learned.filter((a) => on.has(a.id) && a.kind === 'mind');
  const offArts = learned.filter((a) => !on.has(a.id));
  const offSpells = (st.spells ?? []).filter((id) => !on.has(id));
  const cls = CLASSES[st.classId];
  const classAb = cls?.ability ? ABILITIES[cls.ability] : null;
  const budAb = st.bud?.done && st.bud.ability ? ABILITIES[st.bud.ability] : null;
  // あと少しで覚えそうな技：次のランクまでの差が小さいものだけ1〜3個（目標・得意の技能を先に）。魔法も同じ
  const close = (skill: SkillId, need: Rank) => { const gap = RANK_POINTS[need] - (st.skills[skill] ?? 0); const span = Math.max(30, RANK_POINTS[need] - (RANK_POINTS[RANKS[Math.max(0, RANKS.indexOf(need) - 1)]] ?? 0)); return gap > 0 && gap <= span * 0.6 ? gap : null; };
  const pri = (k: SkillId) => (st.targets.includes(k) ? 0 : st.apt?.good.includes(k) ? 1 : 2);
  const near = [
    ...ART_LIST.filter((a) => !learned.includes(a) && !a.bloom).map((a) => { const need = needRank(st, a); const gap = need ? close(a.skill, need) : null; return gap ? { skill: a.skill, need: need!, gap, pri: pri(a.skill), taught: (st.taught ?? []).includes(a.id), spell: false } : null; }),
    ...(['magic', 'faith'] as const).map((k) => { const x = nextSpell(st, k); const gap = x ? close(k, x.rank) : null; return x && gap ? { skill: k as SkillId, need: x.rank, gap, pri: pri(k), taught: false, spell: true } : null; }),
  ].filter((x): x is NonNullable<typeof x> => !!x).sort((x, y) => x.pri - y.pri || x.gap - y.gap).slice(0, 3);
  const sel = open && ARTS[open] ? ARTS[open] : null;
  const selSpell = open && isSpellId(open) ? WEAPONS[open] : null;
  const full = (id: string) => !on.has(id) && (isSpellId(id) || ARTS[id]?.kind === 'art' ? onBattle.length >= ART_SLOTS.art : onMinds.length >= ART_SLOTS.mind);
  return (
    <div class="card arts-card">
      <div class="row between nowrap"><h3 style={{ margin: 0 }}>戦技と魔法・スキル <HelpTip text={`技能ランクが上がると覚えます。得意な技能や、卒業生の講師に手ほどきを受けた技は、ひとつ前のランクで覚えます。つけられるのは、戦技と魔法を合わせて${ART_SLOTS.art}つ、スキル${ART_SLOTS.mind}つまでで、ふだんはおまかせです（回復の魔法を覚えた子は、回復の魔法を必ず入れます）。`} /></h3></div>
      <div class="row between nowrap arts-sub"><b class="small">つけている戦技と魔法　{onBattle.length}／{ART_SLOTS.art}</b>{st.artsManual && <button class="btn ghost small" onClick={() => act((g) => { const x = g.students[st.id]; x.artsManual = false; autoEquip(x); })}>おまかせに戻す</button>}</div>
      {onBattle.length ? onBattle.map((id) => isSpellId(id) ? <SpellTile id={id} on usable={usable.has(id)} onOpen={() => setOpen(id)} /> : <ArtTile a={ARTS[id]} on onOpen={() => setOpen(id)} />) : <div class="small muted">まだ戦技も魔法も覚えていません</div>}
      <div class="arts-sub"><b class="small">つけているスキル　{onMinds.length}／{ART_SLOTS.mind}</b></div>
      {onMinds.length ? onMinds.map((a) => <ArtTile a={a} on onOpen={() => setOpen(a.id)} />) : <div class="small muted">まだスキルを覚えていません</div>}
      {(classAb || budAb) && <><div class="arts-sub"><b class="small">兵種のスキル</b><span class="small muted">（つけ外しはできません）</span></div>
        {[classAb, budAb].filter(Boolean).map((ab) => <div class="art-tile mind on fixed"><span class="row nowrap gap6"><b class="serif">{ab!.name}</b><span class="small muted">（{ab === classAb ? cls.name : '開花'}）</span><span class="when-mark">{whenMark(ab!)}</span></span><span class="small">{ab!.desc}</span></div>)}</>}
      {offArts.length + offSpells.length > 0 && <button class="btn ghost small block" style={{ marginTop: 6 }} onClick={() => setMore(!more)}>ほかに覚えている技と魔法 {offArts.length + offSpells.length}つ {more ? '▲' : '▼'}</button>}
      {more && <>{offArts.map((a) => <ArtTile a={a} onOpen={() => setOpen(a.id)} />)}{offSpells.map((id) => <SpellTile id={id} usable={usable.has(id)} onOpen={() => setOpen(id)} />)}</>}
      {near.length > 0 && <><div class="arts-sub"><b class="small">次に覚えそうな技と魔法</b></div>
        {near.map((x) => <div class="art-tile none small">{SKILL_NAMES[x.skill]}{x.need} まで あと少し ― ？？？{x.spell ? '（魔法）' : ''}{x.taught ? '（講師に手ほどきを受けた）' : ''}</div>)}</>}
      <button class="btn ghost small" style={{ marginTop: 6 }} onClick={() => navigate({ tab: 'yearbook', page: 'book', sub: 'art' })}>技の図鑑を見る（年鑑）</button>
      {sel && (
        <Sheet title={sel.name} onClose={() => setOpen(null)}>
          <div class="small muted">{KIND_NAME[sel.kind]}・{SKILL_NAMES[sel.skill]}のランク{sel.rank}で覚える{(st.taught ?? []).includes(sel.id) ? '（講師に手ほどきを受けた）' : ''}</div>
          <p class="serif">{artPlain(sel)}</p>
          <p class="small">{whenUsed(sel)}</p>
          <p class="small muted">くわしい数字：{sel.desc}</p>
          <button class="btn primary block" disabled={full(sel.id)} onClick={() => { sfx('ok'); act((g) => toggleArt(g.students[st.id], sel.id)); setOpen(null); }}>{on.has(sel.id) ? '外す' : full(sel.id) ? 'いっぱいです（ほかを外してください）' : 'つける'}</button>
        </Sheet>
      )}
      {selSpell && (
        <Sheet title={selSpell.name} onClose={() => setOpen(null)}>
          <div class="small muted">魔法・{selSpell.type === 'staff' ? '杖（回復・補助）' : selSpell.type === 'holy' ? '信仰' : '魔道'}{usable.has(selSpell.id) ? '' : '・今の兵種では使えない'}</div>
          <p class="serif">{selSpell.desc}</p>
          <p class="small">{selSpell.type === 'staff' ? `回復${selSpell.might}・届く距離${selSpell.maxRange}マス。戦いの中で、傷ついた仲間に自動で使います。` : `威力${selSpell.might}・命中${selSpell.hit}・届く距離${selSpell.minRange}〜${selSpell.maxRange}マス。つけていると、戦いの中で使います。`}</p>
          <button class="btn primary block" disabled={full(selSpell.id)} onClick={() => { sfx('ok'); act((g) => toggleArt(g.students[st.id], selSpell.id)); setOpen(null); }}>{on.has(selSpell.id) ? '外す' : full(selSpell.id) ? 'いっぱいです（ほかを外してください）' : 'つける'}</button>
        </Sheet>
      )}
    </div>
  );
}

/** 技の図鑑（14夜目）：覚えた子がいる技だけ名前が見える。15夜目：年鑑の「図鑑」にまとめた */
export function ArtBookBody({ s }: { s: GameState }) {
  const known = new Set(Object.values(s.students).flatMap((x) => x.arts ?? []));
  const skills = SKILLS.filter((k) => k !== 'gun' || s.world.gunUnlocked);
  return (
    <div>
      <div class="small muted">生徒か卒業生が一度でも覚えた技は、名前と効果が見えます（{ART_LIST.filter((a) => known.has(a.id)).length}／{ART_LIST.length}）。</div>
      {skills.map((k) => (
        <div class="arts-row"><span class="arts-sk small">{SKILL_NAMES[k]}</span>
          <span class="arts-list">{ART_LIST.filter((a) => a.skill === k && (!a.bloom || known.has(a.id))).map((a) => known.has(a.id) ? <span class={`arts-chip ${a.kind}`} title={artPlain(a)}>{a.name}</span> : <span class="arts-chip none">{a.rank}で？？？</span>)}</span>
        </div>
      ))}
    </div>
  );
}
