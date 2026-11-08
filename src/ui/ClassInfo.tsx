// 兵種の補正と成長率の見える化（8夜目）：補正の札・成長率の内わけ・兵種図鑑
import type { SkillId } from '../core/types';
import { ART_LIST } from '../data/arts';
import { useEffect, useState } from 'preact/hooks';
import type { GameState, Student } from '../core/state';
import type { ClassDef, Stats, StatId, Rank } from '../core/types';
import { CLASSES, CLASS_LIST } from '../data/classes';
import { ABILITIES } from '../data/abilities';
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
      <div class="small muted">移動 {from.move}→<b>{to.move}</b>・使える武器：{to.weapons.map((w) => WEAPON_NAMES[w]).join('・')}{to.ability && ABILITIES[to.ability] ? `・スキル「${ABILITIES[to.ability].name}」` : ''}</div>
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

export function ClassBook({ s }: { s: GameState }) {
  const seen = seenClasses(s);
  const [open, setOpen] = useState<string | null>(null);
  const [sel, setSel] = useState<string | null>(null);
  const tier1 = CLASS_LIST.filter((c) => c.tier === 1 && (!c.needGun || s.world.gunUnlocked || seen.has(c.id)));
  const total = CLASS_LIST.filter((c) => !c.hidden || seen.has(c.id)).length;
  const got = CLASS_LIST.filter((c) => visible(c, seen) && (!c.hidden || seen.has(c.id))).length;
  const kids = (id: string) => CLASS_LIST.filter((c) => parentOf(c) === id && !c.hidden);
  const selC = sel ? CLASSES[sel] : null;
  return (
    <div class="deskpage">
      <Back to={() => navigate({ tab: 'students' })} />
      <div class="ledger">
        <div class="row between nowrap"><h2 class="ledger-title" style={{ margin: 0 }}>兵種図鑑</h2><span class="stamp">図鑑</span></div>
        <div class="small muted">見習いから最上級までの、兵種の木です。まだ誰もなっていない兵種は「？」のままです。生徒か卒業生が初めてなると、埋まります（{got}／{total}）。</div>
        <div class="cb-root"><Leaf c={CLASSES.novice} seen={seen} on={sel === 'novice'} onTap={() => setSel(sel === 'novice' ? null : 'novice')} /></div>
        <div class="cb-grid">
          {tier1.map((c) => <Leaf c={c} seen={seen} on={open === c.id} onTap={() => { sfx('move'); setOpen(open === c.id ? null : c.id); setSel(c.id); }} />)}
        </div>
        {open && <Branch id={open} seen={seen} kids={kids} sel={sel} onSel={(id) => { sfx('move'); setSel(sel === id ? null : id); }} />}
        {CLASS_LIST.filter((c) => c.hidden).map((c) => <div class="cb-hidden">{seen.has(c.id) ? <Leaf c={c} seen={seen} on={sel === c.id} onTap={() => setSel(c.id)} /> : <span class="small muted">隠された兵種：？？？</span>}</div>)}
      </div>
      {selC && <ClassSheet s={s} c={selC} known={visible(selC, seen)} onClose={() => setSel(null)} />}
    </div>
  );
}
function Leaf({ c, seen, on, onTap }: { c: ClassDef; seen: Set<string>; on: boolean; onTap: () => void }) {
  const v = visible(c, seen);
  return (
    <button class={`cb-leaf${v ? '' : ' unknown'}${on ? ' on' : ''}`} style={{ ['--band' as string]: c.nation ? countryColor(c.nation) : 'var(--line)' }} onClick={onTap}>
      <span class="cb-ic">{v ? <Icon name={classIcon(c.id)} size={18} /> : '？'}</span>
      <span class="cb-name">{v ? c.name : '？？？'}</span>
      <span class="cb-tier">{TIER_NAMES[c.tier]}{c.nation ? `・${COUNTRY_SHORT[c.nation]}` : ''}</span>
    </button>
  );
}
function Branch({ id, seen, kids, sel, onSel }: { id: string; seen: Set<string>; kids: (id: string) => ClassDef[]; sel: string | null; onSel: (id: string) => void }) {
  const render = (c: ClassDef, depth: number): preact.JSX.Element => (
    <div class="cb-node" style={{ marginLeft: depth ? 14 : 0 }}>
      <Leaf c={c} seen={seen} on={sel === c.id} onTap={() => onSel(c.id)} />
      {kids(c.id).length > 0 && <div class="cb-kids">{kids(c.id).map((k) => render(k, depth + 1))}</div>}
    </div>
  );
  return <div class="cb-branch">{kids(id).map((c) => render(c, 0))}{!kids(id).length && <div class="small muted">この先の兵種はありません</div>}</div>;
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
        <div class="row between nowrap"><h2 class="grow">{known ? c.name : '？？？'} <span class="small muted">{TIER_NAMES[c.tier]}{c.nation ? `・${COUNTRY_SHORT[c.nation]}専用` : ''}</span></h2><button class="btn ghost small" onClick={() => { sfx('cancel'); onClose(); }}>閉じる</button></div>
        {known ? (
          <>
            <div class="small">{c.desc}</div>
            <ClassMods c={c} />
            <div class="small">移動 {c.move}・使える武器：{c.weapons.map((w) => WEAPON_NAMES[w]).join('・')}</div>
            {c.ability && ABILITIES[c.ability] && <div class="small">スキル「{ABILITIES[c.ability].name}」：{ABILITIES[c.ability].desc}</div>}
          </>
        ) : <div class="small muted">まだ誰もなっていない兵種です。生徒か卒業生が初めてなると、補正やスキルが分かります。</div>}
        {known && <div class="small ruled">この兵種で使える戦技：{ART_LIST.filter((a) => a.kind === 'art' && !a.bloom && a.weapons && a.weapons.some((w) => c.weapons.includes(w))).filter((a, i, l) => l.findIndex((x) => x.skill === a.skill) === i || a.rank === 'D').slice(0, 6).map((a) => a.name).join('・') || 'なし'}（騎乗・飛行・軍略・統率などの戦技は、どの武器でも使えます）</div>}
        {c.hidden && <div class="small" style={{ color: '#8a5a08' }}>金の芽が開いた子だけが、この道へ進めます</div>}
        {(good.length > 0 || bloom.length > 0) && <div class="small ruled">{bloom.length > 0 && <div>開花で道が開けた子：<b>{bloom.join('・')}</b></div>}{good.length > 0 && <div>要る技能が得意な子：{good.slice(0, 8).join('・')}{good.length > 8 ? ' ほか' : ''}</div>}</div>}
        <div class="small ruled">なる条件：{c.prereq.length ? `${c.prereq.map((p) => (known || CLASSES[p].tier <= 1 ? CLASSES[p].name : '？')).join('・')}から` : '入学したとき'}{Object.entries(c.req).length ? `・${Object.entries(c.req).map(([k, r]) => `${SKILL_NAMES[k as keyof typeof SKILL_NAMES]}${r as Rank}`).join('・')}` : ''}{c.tier >= 1 ? `・Lv${B.exam.levelReq[c.tier]}以上` : ''}{c.tier === 4 ? '（卒業後）' : ''}</div>
      </div>
    </div>
  );
}
