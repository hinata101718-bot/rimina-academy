// 兵種の補正と成長率の見える化（8夜目）：補正の札・成長率の内わけ・兵種図鑑
import type { SkillId } from '../core/types';
import { TECHS, ATK_NAME } from '../data/tactics';
import { useEffect, useState } from 'preact/hooks';
import type { GameState, Student } from '../core/state';
import type { ClassDef, Stats, StatId, Rank } from '../core/types';
import { CLASSES, CLASS_LIST, TRAITS_C, type ClassDefX } from '../data/classes';
import { STAT_NAMES, SKILL_NAMES, COUNTRY_SHORT } from '../data/people';
import { STATS, B } from '../data/balance';
import { growthParts } from '../core/growth';
import { act, navigate } from './store';
import { Back, HelpTip } from './common';
import { Icon } from './icons';
import { classIcon, countryColor } from './cards';
import { sfx } from './sound';

const WEAPON_NAMES: Record<string, string> = { sword: '剣', lance: '槍', axe: '斧', bow: '弓', magic: '魔道書', holy: '白魔法', staff: '杖', gun: '銃' };
const TIER_NAMES = ['見習い', '初級', '中級', '上級', '最上級'];
const sign = (v: number) => (v > 0 ? `+${v}` : v < 0 ? `−${-v}` : '±0');

/** 能力補正：+2 の数字（この兵種でいるあいだ） */
export function StatMods({ bonus, empty = 'なし' }: { bonus: Partial<Stats>; empty?: string }) {
  const ks = STATS.filter((k) => (bonus[k] ?? 0) !== 0);
  if (!ks.length) return <span class="small muted">{empty}</span>;
  return <span class="modlist">{ks.map((k) => <span class={`mod ${bonus[k]! > 0 ? 'up' : 'down'}`}>{STAT_NAMES[k]}{sign(bonus[k]!)}</span>)}</span>;
}
/** 成長率補正：+10% の％（レベルアップでの伸びやすさ） */
export function GrowthMods({ growth, empty = 'なし' }: { growth: Partial<Stats>; empty?: string }) {
  const ks = STATS.filter((k) => (growth[k] ?? 0) !== 0);
  if (!ks.length) return <span class="small muted">{empty}</span>;
  return <span class="modlist">{ks.map((k) => <span class={`mod pct ${growth[k]! > 0 ? 'up' : 'down'}`}>{STAT_NAMES[k]}{sign(growth[k]!)}%</span>)}</span>;
}

/** 兵種の補正（2つの欄に分ける） */
export function ClassMods({ c, note = true }: { c: ClassDef; note?: boolean }) {
  return (
    <div class="classmods">
      <div class="cm-row"><span class="cm-lab">この兵種でいるあいだ</span><StatMods bonus={c.bonus} /></div>
      <div class="cm-row"><span class="cm-lab">レベルアップでの伸びやすさ</span><GrowthMods growth={c.growth} /></div>
      {note && <div class="small muted cm-note">兵種を変えても、これまでに伸びた分はそのまま残ります。入れかわるのは「いるあいだ」の補正だけです。</div>}
    </div>
  );
}

/** 今の兵種 → この兵種の比べ（兵種試験の画面） */
export function ClassCompare({ from, to }: { from: ClassDef; to: ClassDef }) {
  const rows = STATS.filter((k) => (from.bonus[k] ?? 0) !== (to.bonus[k] ?? 0) || (from.growth[k] ?? 0) !== (to.growth[k] ?? 0));
  return (
    <div class="ccmp">
      <div class="ccmp-head"><span>能力</span><span>いるあいだ</span><span>伸びやすさ</span></div>
      {rows.map((k) => {
        const b0 = from.bonus[k] ?? 0, b1 = to.bonus[k] ?? 0, g0 = from.growth[k] ?? 0, g1 = to.growth[k] ?? 0;
        return (
          <div class="ccmp-row">
            <span>{STAT_NAMES[k]}</span>
            <span>{b0 === b1 ? <span class="muted">{sign(b1)}</span> : <><span class="muted">{sign(b0)}</span>→<b class={b1 > b0 ? 'up' : 'down'}>{sign(b1)}</b></>}</span>
            <span>{g0 === g1 ? <span class="muted">{sign(g1)}%</span> : <><span class="muted">{sign(g0)}%</span>→<b class={g1 > g0 ? 'up' : 'down'}>{sign(g1)}%</b></>}</span>
          </div>
        );
      })}
      {!rows.length && <div class="small muted">補正は変わりません</div>}
      <div class="small muted">移動 {from.move}→<b>{to.move}</b>・使える武器：{to.weapons.map((w) => WEAPON_NAMES[w]).join('・')}</div>
    </div>
  );
}

/** 成長率の内わけ（本人 ＋ 兵種 ＋ 特徴 ＝ 合計）。本人が「？」のあいだは分かる分だけ。判明したら埋まる演出 */
export function GrowthTable({ s, st }: { s: GameState; st: Student }) {
  const parts = growthParts(st);
  const known = st.growthKnown;
  const reveal = known && !st.growthSeen;
  const [lit, setLit] = useState(reveal ? 0 : 99);
  useEffect(() => {
    if (!reveal) return;
    sfx('pass');
    let n = 0;
    const t = setInterval(() => { n += 1; setLit(n); if (n > STATS.length) { clearInterval(t); act((g) => { const x = g.students[st.id]; if (x) x.growthSeen = true; }); } }, 260);
    return () => clearInterval(t);
  }, [reveal]);
  const sum = STATS.reduce((a, k) => a + parts[k].total, 0);
  const pc = (v: number) => <span class={v > 0 ? 'up' : v < 0 ? 'down' : 'muted'}>{v > 0 ? `+${v}` : v < 0 ? `−${-v}` : '0'}%</span>;
  void s;
  return (
    <div class={`gtable${reveal ? ' revealing' : ''}`}>
      <div class="gt-row gt-head"><span>能力</span><span>本人</span><span>兵種</span><span>特徴</span><span>合計</span></div>
      {STATS.map((k: StatId, i) => {
        const p = parts[k];
        const on = known && i < lit;
        return (
          <div class={`gt-row${on && reveal ? ' pop' : ''}`}>
            <span>{STAT_NAMES[k]}</span>
            <span>{on ? `${p.own}%` : <span class="dc-q">？</span>}</span>
            <span>{pc(p.cls)}</span>
            <span>{on ? pc(p.extra) : <span class="muted">—</span>}</span>
            <b class="gt-total">{on ? `${p.total}%` : '？'}</b>
          </div>
        );
      })}
      <div class="gt-sum"><span>合計成長率</span><b>{known && lit > STATS.length - 1 ? `${sum}%` : '？'}</b></div>
      <div class="small muted">数字が大きい能力ほど、レベルが上がったときに伸びやすくなります。<HelpTip text="合計の数字が、レベルが上がったときにその能力が1上がる見込みです。5%きざみで決まります。" /></div>
    </div>
  );
}

// ---------- 兵種図鑑 ----------
/** 生徒か卒業生が一度でもなった兵種（見習い・初級は最初から見える） */
export function seenClasses(s: GameState): Set<string> {
  const out = new Set<string>(s.classSeen ?? []);
  for (const st of Object.values(s.students)) out.add(st.classId);
  return out;
}
function visible(c: ClassDef, seen: Set<string>): boolean { return c.tier <= 1 || seen.has(c.id); }
function parentOf(c: ClassDef): string | null { return c.prereq[0] ?? null; }

/** 20夜目：最上級の条件の明かし方（0=？？？ 1=はじめの数文字 2=全部）。上級になった子がいると少し、条件の出来事を成し遂げかけた子がいると全部 */
export function deedReveal(s: GameState, c: ClassDefX, seen: Set<string>): number {
  if (seen.has(c.id)) return 2;
  const all = Object.values(s.students);
  if (c.deed && all.some((x) => (x.deeds?.[c.deed!] ?? 0) > 0)) return 2;
  if (c.prereq.some((p) => seen.has(p))) return 1;
  return 0;
}
function unlockText(c: ClassDefX, lv: number): string {
  if (!c.unlock) return '';
  if (lv >= 2) return c.unlock;
  if (lv === 1) return `${[...c.unlock].slice(0, 4).join('')}……`;
  return '？？？';
}
/** その兵種になったことのある子（生徒・卒業生） */
function holders(s: GameState, id: string): string[] {
  return Object.values(s.students).filter((x) => x.classId === id || x.history?.some((h) => h.text.includes(`「${CLASSES[id]?.name}」`) || h.text === `${CLASSES[id]?.name}になった`)).map((x) => `${x.given}（${x.cohort}期）`);
}

export function ClassBook({ s, embedded }: { s: GameState; embedded?: boolean }) {
  const seen = seenClasses(s);
  const [open, setOpen] = useState<string | null>(null);
  const [sel, setSel] = useState<string | null>(null);
  const tier1 = CLASS_LIST.filter((c) => c.tier === 1);
  const total = CLASS_LIST.length;
  const got = CLASS_LIST.filter((c) => seen.has(c.id)).length;
  const kids = (id: string) => CLASS_LIST.filter((c) => parentOf(c) === id && !c.hidden);
  const selC = sel ? CLASSES[sel] : null;
  return (
    <div class={embedded ? '' : 'deskpage'}>
      {!embedded && <Back to={() => navigate({ tab: 'students' })} />}
      <div class="ledger">
        {!embedded && <div class="row between nowrap"><h2 class="ledger-title" style={{ margin: 0 }}>兵種図鑑</h2><span class="stamp">図鑑</span></div>}
        <div class="small muted">初級 → 中級 → 上級 → 最上級 の木です。枝分かれは「おすすめの道」で、技能の条件を満たせば、ほかの枝の兵種にも移れます。だれかがなった兵種は明るく、まだの兵種は名前だけ。最上級になる条件は「？」から少しずつ分かります（{got}／{total}）。</div>
        <div class="cb-grid">
          {tier1.map((c) => <Leaf c={c} seen={seen} on={open === c.id} onTap={() => { sfx('move'); setOpen(open === c.id ? null : c.id); setSel(c.id); }} />)}
        </div>
        {open ? <Tree s={s} id={open} seen={seen} kids={kids} sel={sel} onSel={(id) => { sfx('move'); setSel(sel === id ? null : id); }} /> : <div class="small muted" style={{ marginTop: 8 }}>初級の兵種をタップすると、その先の枝分かれが出ます。</div>}
        <div class="ct-hidden">
          <div class="small"><b>隠れた兵種</b>（出来事で道が開く）</div>
          {CLASS_LIST.filter((c) => c.hidden).map((c) => seen.has(c.id) ? <Leaf c={c} seen={seen} on={sel === c.id} onTap={() => setSel(c.id)} /> : <div class="small muted">？？？ —— {c.id === 'oneeye' ? '弓か密偵の子に、ある出来事が起きると……' : '死の淵から戻った子に……'}</div>)}
        </div>
      </div>
      {selC && <ClassSheet s={s} c={selC} known={visible(selC, seen)} onClose={() => setSel(null)} />}
    </div>
  );
}
function Leaf({ c, seen, on, onTap, small }: { c: ClassDef; seen: Set<string>; on: boolean; onTap: () => void; small?: boolean }) {
  const v = seen.has(c.id) || c.tier <= 1;
  return (
    <button class={`cb-leaf${v ? '' : ' unknown'}${on ? ' on' : ''}${small ? ' ct-leaf' : ''}`} style={{ ['--band' as string]: c.nation ? countryColor(c.nation) : 'var(--line)' }} onClick={onTap}>
      {!small && <span class="cb-ic">{v ? <Icon name={classIcon(c.id)} size={18} /> : '・'}</span>}
      <span class="cb-name">{c.hidden && !v ? '？？？' : c.name}</span>
      <span class="cb-tier">{TIER_NAMES[c.tier]}</span>
    </button>
  );
}
/** 4段階の枝分かれ：初級 → 中級（2〜4）→ 上級 → 最上級。最上級には条件（少しずつ明かす） */
function Tree({ s, id, seen, kids, sel, onSel }: { s: GameState; id: string; seen: Set<string>; kids: (id: string) => ClassDef[]; sel: string | null; onSel: (id: string) => void }) {
  return (
    <div class="ct-tree">
      <div class="small muted">おすすめの道（ほかの枝へも、技能の条件で移れます）</div>
      <div class="ct-cols small muted"><span>中級</span><span>上級</span><span>最上級</span></div>
      {kids(id).map((m) => (
        <div class="ct-row">
          <div class="ct-c"><Leaf small c={m} seen={seen} on={sel === m.id} onTap={() => onSel(m.id)} /></div>
          <div class="ct-sub">
            {kids(m.id).map((u) => {
              const top = kids(u.id)[0] as ClassDefX | undefined;
              const lv = top ? deedReveal(s, top, seen) : 0;
              return (
                <div class="ct-pair">
                  <div class="ct-c"><Leaf small c={u} seen={seen} on={sel === u.id} onTap={() => onSel(u.id)} /></div>
                  <div class="ct-c">{top && <><Leaf small c={top} seen={seen} on={sel === top.id} onTap={() => onSel(top.id)} /><div class={`ct-cond${lv < 2 ? ' q' : ''}`}>条件：{unlockText(top, lv)}</div></>}</div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
function ClassSheet({ s, c, known, onClose }: { s: GameState; c: ClassDef; known: boolean; onClose: () => void }) {
  // 10夜目：この兵種に要る技能が得意な子・開花で道が開けた子
  const req = Object.keys(c.req) as SkillId[];
  const list = Object.values(s.students).filter((x) => x.status === 'enrolled');
  const good = req.length ? list.filter((x) => req.some((k) => x.apt?.good.includes(k)) && !(x.bud?.done && req.includes(x.bud.skill as SkillId))).map((x) => x.given) : [];
  const bloom = list.filter((x) => x.bud?.done && x.bud.skill && req.includes(x.bud.skill)).map((x) => x.given);
  return (
    <div class="overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div class="sheet">
        <div class="row between nowrap"><h2 class="grow">{known || !c.hidden ? c.name : '？？？'} <span class="small muted">{TIER_NAMES[c.tier]}{c.nation ? `・${COUNTRY_SHORT[c.nation]}専用` : ''}</span></h2><button class="btn ghost small" onClick={() => { sfx('cancel'); onClose(); }}>閉じる</button></div>
        {known ? (
          <>
            <div class="small">{c.desc}</div>
            <ClassMods c={c} />
            <div class="small">移動 {c.move}・使える武器：{c.weapons.map((w) => WEAPON_NAMES[w]).join('・')}</div>
          </>
        ) : <div class="small muted">まだ誰もなっていない兵種です。生徒か卒業生が初めてなると、補正やスキルが分かります。</div>}
        {known && <div class="small ruled">この兵種で使える技：{TECHS.filter((t) => c.weapons.some((w) => ({ sword: 'sword', lance: 'lance', axe: 'axe', bow: 'bow', magic: 'magic', holy: 'faith', staff: 'faith', gun: 'gun' } as Record<string, string>)[w] === t.skill)).map((t) => `${t.name}（${ATK_NAME[t.type]}）`).join('・') || 'なし'}</div>}
        {known && <div class="small ruled"><b>特技</b>{(c as ClassDefX).traits.map((t) => TRAITS_C[t] && <div class="ct-trait"><b>{TRAITS_C[t].name}</b>：{TRAITS_C[t].desc}{TRAITS_C[t].todo ? <em class="ct-todo">（まだ説明だけ）</em> : TRAITS_C[t].part ? <em class="ct-todo">（{TRAITS_C[t].part}）</em> : null}</div>)}<div class="muted">下の段階の特技は、上がっても残ります。</div></div>}
        {(c as ClassDefX).unlock && <div class="small ruled"><b>{c.hidden ? '道が開く出来事' : 'なる条件の出来事'}</b>：{c.hidden && !known ? '？？？' : unlockText(c as ClassDefX, c.hidden ? 2 : deedReveal(s, c as ClassDefX, seenClasses(s)))}{c.tier === 4 && <div class="muted">卒業生のうち、この出来事を成し遂げた子だけがなれます。</div>}</div>}
        {known && c.tier >= 2 && holders(s, c.id).length > 0 && <div class="small ruled">なった子：{holders(s, c.id).slice(0, 8).join('・')}</div>}
        {(good.length > 0 || bloom.length > 0) && <div class="small ruled">{bloom.length > 0 && <div>開花で道が開けた子：<b>{bloom.join('・')}</b></div>}{good.length > 0 && <div>要る技能が得意な子：{good.slice(0, 8).join('・')}{good.length > 8 ? ' ほか' : ''}</div>}</div>}
        <div class="small ruled">なる条件：{c.prereq.length ? `${TIER_NAMES[c.tier - 1]}の兵種から（おすすめの道は${c.prereq.map((p) => CLASSES[p].name).join('・')}）` : c.hidden ? '出来事で道が開く' : '入学したとき'}{Object.entries(c.req).length ? `・${Object.entries(c.req).map(([k, r]) => `${SKILL_NAMES[k as keyof typeof SKILL_NAMES]}${r as Rank}`).join('・')}` : ''}{c.tier >= 1 && !c.hidden ? `・Lv${c.tier === 4 ? B.alumni.tier4Level : B.exam.levelReq[c.tier]}以上` : ''}{c.tier === 4 ? '（卒業後）' : ''}</div>
      </div>
    </div>
  );
}
