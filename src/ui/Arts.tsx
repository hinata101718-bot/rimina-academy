// 戦技とスキル（12夜目。15夜目に「心得」を「スキル」に、魔法を戦技と同じ一覧に）：覚えた演出、技能タブの一覧と付けかえ
import { useEffect, useState } from 'preact/hooks';
import { act, navigate } from './store';
import { Portrait } from './Portrait';
import { sfx } from './sound';
import { countryColor } from './cards';
import { HelpTip, Sheet } from './common';
import type { GameState, Student, Pending } from '../core/state';
import { ARTS, ART_LIST, ART_SLOTS, COND_LABEL, fxText, type ArtDef } from '../data/arts';
import { SKILL_NAMES } from '../data/people';
import { SKILLS, RANKS, RANK_POINTS } from '../data/balance';
import { toggleArt, autoEquip, needRank, loadoutOf, isSpellId, plannedArts } from '../core/arts';
import { evoPath, evoName, evoFx, evoOptions, evoReady, evoNeed, masteryOf, chooseEvo, autoEvo, evoBase, artNameFor, EVO_BRANCH } from '../core/evolve';
import { combosOf, partnerOf } from '../core/combo';
import { COMBO_KIND } from '../data/combos';
import { EVO_TASTE, type EvoBranch } from '../data/evolve';
import { PERSONALITIES } from '../data/people';
import { usableSpells, nextSpell } from '../core/spells';
import { WEAPONS } from '../data/weapons';
import { CLASSES } from '../data/classes';
import { ABILITIES } from '../data/abilities';
import type { AbilityDef, SkillId } from '../core/types';
import { rankOf, MONTH_NAMES } from '../core/util';
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
      <div class="small muted">{a.card ? '戦いの札になります（山札に入ります）' : `${artWhen(a)}効きます`}</div>
      <button class="btn primary block" style={{ marginTop: 10 }} onClick={(e) => { e.stopPropagation(); next(); }}>{i + 1 < p.ids.length ? '次へ' : '閉じる'}</button>
    </div>
  );
}

const WNAME: Record<string, string> = { sword: '剣', lance: '槍', axe: '斧', bow: '弓', magic: '魔道', holy: '信仰', staff: '杖', gun: '銃' };
const MOVE_NAME: Record<string, string> = { armor: '重装', flying: '空を飛ぶ敵', cavalry: '騎馬', infantry: '歩兵' };
/** 効果のひとこと（やさしい言葉で） */
export function artPlain(a: ArtDef): string {
  const out: string[] = [];
  if (a.card) return `札：${fxText(a.card)}`;
  if (a.cond || a.perk) return a.desc;
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
  if (a.card) return `つけていると、戦いの山札に札が入ります（使うのに行動力${a.card.cost ?? 1}）。使うたびに熟練がたまり、満ちると2つの進化先から1つを選んで育てられます（2段まで。技能のランクが上がっても熟練がたまります）。`;
  if (a.kind === 'mind') return `${artWhen(a)}効きます（つけているあいだ）。`;
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
/** 16夜目：技の効き方の印（札・条件・いつも） */
export function artWhen(a: ArtDef): string { return a.card ? '札' : a.cond ? COND_LABEL[a.cond] : whenMark(a.ability); }

/** 18夜目：熟練のゲージ（戦技と魔法）。満ちたら「進化させる」 */
function Gauge({ st, id, onEvolve }: { st: Student; id: string; onEvolve?: () => void }) {
  const path = evoPath(st, id);
  const need = evoNeed(path);
  if (!evoBase(id)) return null;
  if (need === null || !evoOptions(id, path)) return <span class="evo-gl small"><span>熟練をきわめた（2段まで進化した）</span></span>;
  const m = masteryOf(st, id);
  const ready = evoReady(st, id);
  return (
    <span class="evo-gwrap">
      <span class="evo-gl small"><span>熟練 {Math.min(m, need)}／{need}{ready ? '　満ちた！' : `（あと${need - m}で${path.length ? '2段目' : '進化'}）`}</span></span>
      <span class="evo-gauge"><i style={{ width: `${Math.min(100, (m / need) * 100)}%` }} /></span>
      {ready && onEvolve && st.status === 'enrolled' && <span role="button" class="btn small evo-ready" onClick={(e) => { e.stopPropagation(); sfx('ok'); onEvolve(); }}>進化させる（2つから選ぶ）</span>}
    </span>
  );
}
/** 技の札（名前・種類・効果のひとこと）。押すとくわしい説明。18夜目：進化した名前・熟練のゲージ */
function ArtTile({ a, st, on, onOpen, onEvolve }: { a: ArtDef; st: Student; on?: boolean; onOpen: () => void; onEvolve?: () => void }) {
  const path = evoPath(st, a.id);
  const name = evoName(a.id, a.name, path);
  return (
    <button class={`art-tile ${a.kind}${on ? ' on' : ''}${a.bloom ? ' bloom' : ''}${a.card?.type ? ` t-${a.card.type}` : ''}`} onClick={() => { sfx('move'); onOpen(); }}>
      <span class="row nowrap gap6"><b class="serif">{name}</b><span class="small muted">（{KIND_NAME[a.kind]}・{SKILL_NAMES[a.skill]}）{path.length ? `${'◆'.repeat(path.length)} ${path.map((x) => EVO_BRANCH[x].label).join('→')}` : ''}</span>{(a.kind === 'mind' || a.card) && <span class="when-mark">{artWhen(a)}</span>}</span>
      <span class="small">{a.card ? `札：${fxText(evoFx(a.card, path))}` : artPlain(a)}</span>
      {a.card && <Gauge st={st} id={a.id} onEvolve={onEvolve} />}
    </button>
  );
}
/** 魔法の札（15夜目：戦技と同じ一覧に）。18夜目：進化・熟練 */
function SpellTile({ id, st, on, usable, onOpen, onEvolve }: { id: string; st: Student; on?: boolean; usable: boolean; onOpen: () => void; onEvolve?: () => void }) {
  const w = WEAPONS[id];
  if (!w) return null;
  const path = evoPath(st, id);
  return (
    <button class={`art-tile spell${on ? ' on' : ''}${usable ? '' : ' off'}`} onClick={() => { sfx('move'); onOpen(); }}>
      <span class="row nowrap gap6"><b class="serif">{evoName(id, w.name, path)}{w.rare ? '★' : ''}</b><span class="small muted">（魔法・{w.type === 'staff' ? '杖' : w.type === 'holy' ? '信仰' : '魔道'}）{path.length ? `${'◆'.repeat(path.length)} ${path.map((x) => EVO_BRANCH[x].label).join('→')}` : ''}</span></span>
      <span class="small">{w.desc}{path.length ? `（進化：${path.map((x) => EVO_BRANCH[x].tip).join('・')}）` : ''}{usable ? '' : '（今の兵種では使えない）'}</span>
      <Gauge st={st} id={id} onEvolve={onEvolve} />
    </button>
  );
}
/** 18夜目：連携技の欄（個人ページ） */
function ComboList({ s, st }: { s: GameState; st: Student }) {
  const list = combosOf(s, st.id);
  if (!list.length) return null;
  return (
    <>
      <div class="arts-sub row between nowrap"><b class="small">連携技</b><span class="small muted">2人の札を続けて出すと発動</span></div>
      {list.map((c) => {
        const o = s.students[partnerOf(c, st.id)];
        return (
          <div class={`art-tile combo${c.lost ? ' lost' : ''}`}>
            <span class="row nowrap gap6">{o && <Portrait st={o} size={28} />}<b class="serif">{c.name}</b><span class="small muted">{o?.given}と・{COMBO_KIND[c.kind].short}</span></span>
            <span class="small">{c.lost ? `${s.students[c.lost.by]?.given ?? ''}が${c.lost.year}年目${MONTH_NAMES[c.lost.month] ?? ''}に戦死。もう使えない（使った${c.used}回）` : `${COMBO_KIND[c.kind].tip}・使った ${c.used}回`}</span>
          </div>
        );
      })}
    </>
  );
}

/**
 * 18夜目：技の進化を選ぶ（2択。選んだ瞬間はタップで進む演出）。処理待ち（戦いのあと）と個人ページの両方から
 */
export function EvolveView({ s, studentId, id, onDone, later, done, inPending }: { s: GameState; studentId: string; id: string; onDone: () => void; later?: () => void; done?: EvoBranch; inPending?: boolean }) {
  const st = s.students[studentId];
  const [pick, setPick] = useState<EvoBranch | null>(done ?? null);
  const [lit, setLit] = useState(false);
  useEffect(() => { if (!pick) return; const t = setTimeout(() => { setLit(true); sfx('pass'); }, 350); return () => clearTimeout(t); }, [pick]);
  const base = evoBase(id);
  // 選ぶ前の道（開いたときのもの。選んだあとも、おまかせで選んだあと〔done〕も、これで見せる）
  const [path] = useState<EvoBranch[]>(() => { const p0 = st ? evoPath(st, id) : []; return done && p0[p0.length - 1] === done ? p0.slice(0, -1) : p0; });
  const opts = st && base ? evoOptions(id, path) : null;
  if (!st || !base || !opts || (!pick && !evoReady(st, id))) { onDone(); return null; }
  const baseName = ARTS[id]?.name ?? WEAPONS[id]?.name ?? '';
  const nowName = evoName(id, baseName, path);
  const like = EVO_TASTE[st.personality] ?? [];
  const fit = autoEvo(st, id);
  const choose = (b: EvoBranch) => { sfx('ok'); setPick(b); act((g) => { const x = g.students[studentId]; if (x) chooseEvo(g, x, id, b, !inPending); }); };
  if (pick) {
    const nn = evoName(id, baseName, [...path, pick]);
    return (
      <div class="dc-wrap stage3 evo-wrap" onClick={() => (lit ? onDone() : setLit(true))}>
        <div class="dc-title">{st.given}の「{nowName}」が育った！{done ? '（おまかせ）' : ''}</div>
        <div class="row nowrap gap6" style={{ justifyContent: 'center', margin: '6px 0' }}><Portrait st={st} size={56} frame={countryColor(st.origin)} /></div>
        <div class={`lt-card evo-new${lit ? ' lit' : ''}`}>
          <span class="small muted">{EVO_BRANCH[pick].label}の道</span>
          <b class="serif">{nn}</b>
          <small>札：{fxText(evoFx(base.fx, [...path, pick]))}</small>
        </div>
        <div class="small muted">{path.length + 1 >= 2 ? 'これ以上は進化しません。この子だけの技になりました。' : 'もう一度熟練が満ちると、2段目に進化できます。'}</div>
        <button class="btn primary block" style={{ marginTop: 10 }} onClick={(e) => { e.stopPropagation(); onDone(); }}>閉じる</button>
      </div>
    );
  }
  return (
    <div class="evo-wrap">
      <div class="dc-title">{st.given}の「{nowName}」の熟練が満ちた！</div>
      <div class="row nowrap gap6" style={{ justifyContent: 'center', margin: '4px 0' }}><Portrait st={st} size={56} frame={countryColor(st.origin)} /></div>
      <div class="evo-base"><span class="small muted">いまの技</span><b class="serif">{nowName}</b><small>札：{fxText(evoFx(base.fx, path))}</small></div>
      <div class="evo-arrow">▼ どちらに育てる？ ▼</div>
      <div class="evo-opts">
        {opts.map((b, k) => (
          <button class={`evo-opt o${k}`} onClick={() => choose(b)}>
            <span class="evo-lab">{EVO_BRANCH[b].label}</span>
            <b class="serif evo-nm">{evoName(id, baseName, [...path, b])}</b>
            <span class="small">{EVO_BRANCH[b].tip}</span>
            <span class="small evo-fx">{fxText(evoFx(base.fx, [...path, b]))}</span>
          </button>
        ))}
      </div>
      <div class="small muted" style={{ textAlign: 'center', marginTop: 6 }}>{fit && like.includes(fit) ? `${st.given}らしいのは「${EVO_BRANCH[fit].label}」（${PERSONALITIES[st.personality]?.name ?? ''}）。` : ''}選んだ道は変えられません。</div>
      {later && <button class="btn ghost block" style={{ marginTop: 8 }} onClick={() => { sfx('cancel'); later(); }}>あとで選ぶ（個人ページからも選べます）</button>}
    </div>
  );
}

/** 技能タブ（15夜目に作り直し）：つけている戦技と魔法（合わせて5つ）→ スキル（5つ・兵種のスキル）→ ほかに覚えているもの（たたむ）→ 次に覚えそうなもの */
export function ArtsCard({ s, st }: { s: GameState; st: Student }) {
  const learned = (st.arts ?? []).map((id) => ARTS[id]).filter(Boolean);
  const on = new Set(loadoutOf(st));
  const [more, setMore] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const [evo, setEvo] = useState<string | null>(null);
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
    ...plannedArts(st).map((a) => { const need = needRank(st, a); const gap = need ? close(a.skill, need) : null; return gap ? { skill: a.skill, need: need!, gap, pri: pri(a.skill), taught: (st.taught ?? []).includes(a.id), spell: false } : null; }),
    ...(['magic', 'faith'] as const).map((k) => { const x = nextSpell(st, k); const gap = x ? close(k, x.rank) : null; return x && gap ? { skill: k as SkillId, need: x.rank, gap, pri: pri(k), taught: false, spell: true } : null; }),
  ].filter((x): x is NonNullable<typeof x> => !!x).sort((x, y) => x.pri - y.pri || x.gap - y.gap).slice(0, 3);
  const sel = open && ARTS[open] ? ARTS[open] : null;
  const selSpell = open && isSpellId(open) ? WEAPONS[open] : null;
  const full = (id: string) => !on.has(id) && (isSpellId(id) || ARTS[id]?.kind === 'art' ? onBattle.length >= ART_SLOTS.art : onMinds.length >= ART_SLOTS.mind);
  return (
    <div class="card arts-card">
      <div class="row between nowrap"><h3 style={{ margin: 0 }}>戦技と魔法・スキル <HelpTip text={`覚える技は一人ひとり違い、入学のときに決まっています（性格・夢・生まれた国・家柄で変わります）。技能ランクが上がると覚えます。得意な技能や、卒業生の講師に手ほどきを受けた技は、ひとつ前のランクで覚えます。つけられるのは、戦技と魔法を合わせて${ART_SLOTS.art}つ、スキル${ART_SLOTS.mind}つまでで、ふだんはおまかせです（回復の魔法を覚えた子は、回復の魔法を必ず入れます）。`} /></h3></div>
      <div class="row between nowrap arts-sub"><b class="small">つけている戦技と魔法　{onBattle.length}／{ART_SLOTS.art}</b>{st.artsManual && <button class="btn ghost small" onClick={() => act((g) => { const x = g.students[st.id]; x.artsManual = false; autoEquip(x); })}>おまかせに戻す</button>}</div>
      {onBattle.length ? onBattle.map((id) => isSpellId(id) ? <SpellTile id={id} st={st} on usable={usable.has(id)} onOpen={() => setOpen(id)} onEvolve={() => setEvo(id)} /> : <ArtTile a={ARTS[id]} st={st} on onOpen={() => setOpen(id)} onEvolve={() => setEvo(id)} />) : <div class="small muted">まだ戦技も魔法も覚えていません</div>}
      <ComboList s={s} st={st} />
      <div class="arts-sub"><b class="small">つけているスキル　{onMinds.length}／{ART_SLOTS.mind}</b></div>
      {onMinds.length ? onMinds.map((a) => <ArtTile a={a} st={st} on onOpen={() => setOpen(a.id)} />) : <div class="small muted">まだスキルを覚えていません</div>}
      {(classAb || budAb) && <><div class="arts-sub"><b class="small">兵種のスキル</b><span class="small muted">（つけ外しはできません）</span></div>
        {[classAb, budAb].filter(Boolean).map((ab) => <div class="art-tile mind on fixed"><span class="row nowrap gap6"><b class="serif">{ab!.name}</b><span class="small muted">（{ab === classAb ? cls.name : '開花'}）</span><span class="when-mark">{whenMark(ab!)}</span></span><span class="small">{ab!.desc}</span></div>)}</>}
      {offArts.length + offSpells.length > 0 && <button class="btn ghost small block" style={{ marginTop: 6 }} onClick={() => setMore(!more)}>ほかに覚えている技と魔法 {offArts.length + offSpells.length}つ {more ? '▲' : '▼'}</button>}
      {more && <>{offArts.map((a) => <ArtTile a={a} st={st} onOpen={() => setOpen(a.id)} onEvolve={() => setEvo(a.id)} />)}{offSpells.map((id) => <SpellTile id={id} st={st} usable={usable.has(id)} onOpen={() => setOpen(id)} onEvolve={() => setEvo(id)} />)}</>}
      {near.length > 0 && <><div class="arts-sub"><b class="small">次に覚えそうな技と魔法</b></div>
        {near.map((x) => <div class="art-tile none small">{SKILL_NAMES[x.skill]}{x.need} まで あと少し ― ？？？{x.spell ? '（魔法）' : ''}{x.taught ? '（講師に手ほどきを受けた）' : ''}</div>)}</>}
      <button class="btn ghost small" style={{ marginTop: 6 }} onClick={() => navigate({ tab: 'yearbook', page: 'book', sub: 'art' })}>技の図鑑を見る（年鑑）</button>
      {evo && <Sheet onClose={() => setEvo(null)}><EvolveView s={s} studentId={st.id} id={evo} onDone={() => setEvo(null)} later={() => setEvo(null)} /></Sheet>}
      {sel && (
        <Sheet title={artNameFor(st, sel.id)} onClose={() => setOpen(null)}>
          <div class="small muted">{KIND_NAME[sel.kind]}・{SKILL_NAMES[sel.skill]}のランク{sel.rank}で覚える{(st.taught ?? []).includes(sel.id) ? '（講師に手ほどきを受けた）' : ''}</div>
          <p class="serif">{artPlain(sel)}</p>
          <p class="small">{whenUsed(sel)}</p>
          <p class="small muted">くわしい数字：{sel.desc}</p>
          <button class="btn primary block" disabled={full(sel.id)} onClick={() => { sfx('ok'); act((g) => toggleArt(g.students[st.id], sel.id)); setOpen(null); }}>{on.has(sel.id) ? '外す' : full(sel.id) ? 'いっぱいです（ほかを外してください）' : 'つける'}</button>
        </Sheet>
      )}
      {selSpell && (
        <Sheet title={artNameFor(st, selSpell.id)} onClose={() => setOpen(null)}>
          <div class="small muted">魔法・{selSpell.type === 'staff' ? '杖（回復・補助）' : selSpell.type === 'holy' ? '信仰' : '魔道'}{usable.has(selSpell.id) ? '' : '・今の兵種では使えない'}</div>
          <p class="serif">{selSpell.desc}</p>
          <p class="small">{selSpell.type === 'staff' ? `回復${selSpell.might}。つけていると、戦いの山札に回復の札が入ります。` : `威力${selSpell.might}・命中${selSpell.hit}。つけていると、戦いの山札に魔法の札が入ります。`}使うたびに熟練がたまり、満ちると2つの進化先から選んで育てられます。</p>
          <button class="btn primary block" disabled={full(selSpell.id)} onClick={() => { sfx('ok'); act((g) => toggleArt(g.students[st.id], selSpell.id)); setOpen(null); }}>{on.has(selSpell.id) ? '外す' : full(selSpell.id) ? 'いっぱいです（ほかを外してください）' : 'つける'}</button>
        </Sheet>
      )}
    </div>
  );
}

/** 技の図鑑（14夜目）：覚えた子がいる技だけ名前が見える。15夜目：年鑑の「図鑑」にまとめた。18夜目：進化した技と連携技 */
export function ArtBookBody({ s }: { s: GameState }) {
  const known = new Set(Object.values(s.students).flatMap((x) => x.arts ?? []));
  const skills = SKILLS.filter((k) => k !== 'gun' || s.world.gunUnlocked);
  // 進化した技：もとの技 → 進化した名前（だれの技か）
  const evo = new Map<string, { name: string; who: string[] }[]>();
  for (const st of Object.values(s.students)) for (const [id, path] of Object.entries(st.evo ?? {})) {
    if (!path.length) continue;
    const base = ARTS[id]?.name ?? WEAPONS[id]?.name;
    if (!base) continue;
    const n = evoName(id, base, path);
    const l = evo.get(id) ?? [];
    const e = l.find((x) => x.name === n);
    if (e) e.who.push(st.given); else l.push({ name: n, who: [st.given] });
    evo.set(id, l);
  }
  const combos = Object.values(s.combos ?? {}).sort((a, b) => Number(!!a.lost) - Number(!!b.lost) || b.made.year - a.made.year);
  return (
    <div>
      <div class="small muted">技は一人ひとり違います。生徒か卒業生が一度でも覚えた技だけ、名前と効果が載ります（{ART_LIST.filter((a) => known.has(a.id)).length}／{ART_LIST.length}）。</div>
      {skills.map((k) => { const all = ART_LIST.filter((a) => a.skill === k); const got = all.filter((a) => known.has(a.id)); return (
        <div class="arts-row"><span class="arts-sk small">{SKILL_NAMES[k]}</span>
          <span class="arts-list">{got.map((a) => <span class={`arts-chip ${a.kind}`} title={artPlain(a)}>{a.name}</span>)}{got.length < all.length && <span class="arts-chip none">？？？ ×{all.length - got.length}</span>}</span>
        </div>
      ); })}
      <h4 class="serif" style={{ margin: '12px 0 4px' }}>連携技 <span class="small muted">（{combos.length}組）</span></h4>
      <div class="small muted">支援がB以上になった2人の技。戦死した子の技は、もう使えませんが、ここに残ります。</div>
      {combos.length ? combos.map((c) => (
        <div class={`yb-combo${c.lost ? ' lost' : ''}`}><b class="serif">{c.name}</b>　{s.students[c.a]?.given ?? '？'} × {s.students[c.b]?.given ?? '？'}（{COMBO_KIND[c.kind].short}）
          <div class="small muted">{c.made.year}年目{MONTH_NAMES[c.made.month] ?? ''}にできた・使った {c.used}回{c.lost ? `・${s.students[c.lost.by]?.given ?? ''}が${c.lost.year}年目${MONTH_NAMES[c.lost.month] ?? ''}に戦死。もう使えない` : ''}</div></div>
      )) : <div class="small muted">まだありません</div>}
      <h4 class="serif" style={{ margin: '12px 0 4px' }}>進化した技 <span class="small muted">（{[...evo.values()].reduce((a, l) => a + l.length, 0)}）</span></h4>
      {evo.size ? [...evo.entries()].map(([id, l]) => (
        <div class="yb-combo"><b class="serif">{ARTS[id]?.name ?? WEAPONS[id]?.name}</b> → {l.map((x) => `${x.name}（${x.who.slice(0, 3).join('・')}${x.who.length > 3 ? 'ほか' : ''}）`).join('／')}</div>
      )) : <div class="small muted">まだありません（戦技と魔法は、使うたびに熟練がたまります）</div>}
    </div>
  );
}
