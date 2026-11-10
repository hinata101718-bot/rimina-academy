// 画面全体で使う「紙のカード」の部品：国の色の帯・Lvバッジ・ゲージ・札・線画アイコン
import type { ComponentChildren } from 'preact';
import type { GameState, Student, Quest } from '../core/state';
import type { SkillId, Origin, CountryId } from '../core/types';
import { Portrait } from './Portrait';
import { Icon } from './icons';
import { navigate } from './store';
import { CLASSES } from '../data/classes';
import { COUNTRY_COLOR, COUNTRY_SHORT, PERSONALITIES, DREAMS, SKILL_NAMES, TALENTS } from '../data/people';
import { B, SKILLS, RANK_POINTS } from '../data/balance';
import { isGood, isBad, budKnown, budHinted } from '../core/aptitude';
import { rankOf, nextRankPoints } from '../core/util';
import { skillUnlocked } from '../core/week';
import { examCandidates } from '../core/exam';
import { equipped } from '../core/equip';
import { itemName } from '../core/rarity';

/** 武器の種類 → 線画アイコン */
const WEAPON_ICON: Record<string, string> = { sword: 'sword', lance: 'lance', axe: 'axe', bow: 'bow', magic: 'tome', holy: 'staff', staff: 'staff', gun: 'gun' };
const SKILL_ICON: Record<SkillId, string> = { sword: 'sword', lance: 'lance', axe: 'axe', bow: 'bow', magic: 'tome', faith: 'staff', riding: 'run', heavy: 'shield', flying: 'star', gun: 'gun', tactics: 'scroll', command: 'flag' };
export function skillIcon(k: SkillId): string { return SKILL_ICON[k]; }

export function classIcon(classId: string): string {
  const c = CLASSES[classId] ?? CLASSES.novice;
  if (c.id === 'novice') return 'students';
  return WEAPON_ICON[c.weapons[0]] ?? 'sword';
}
export function countryColor(o: Origin | CountryId | null | undefined): string { return o ? COUNTRY_COLOR[o] : '#8a7f6a'; }

/** 兵種名（武器の線画アイコンつき） */
export function ClassName({ classId, size = 15 }: { classId: string; size?: number }) {
  return <span class="clsname" style={{ fontSize: size }}><Icon name={classIcon(classId)} size={size + 1} /> {CLASSES[classId]?.name ?? ''}</span>;
}

export function LvBadge({ lv, big }: { lv: number; big?: boolean }) {
  return <span class={`lvbadge${big ? ' big' : ''}`}>Lv{lv}</span>;
}

/** 国の札（色つき） */
export function CountryChip({ o }: { o: Origin }) {
  return <span class="chip-c" style={{ background: countryColor(o) }}>{COUNTRY_SHORT[o]}</span>;
}
/** ふつうの札（枠だけ） */
export function Chip({ children, tone }: { children: ComponentChildren; tone?: 'main' | 'red' | 'gold' | 'gray' }) {
  return <span class={`chip-o ${tone ?? ''}`}>{children}</span>;
}

/** ゲージ */
export function Gauge({ v, max, tone, thin }: { v: number; max: number; tone?: 'exp' | 'skill' | 'red' | 'warn' | 'main'; thin?: boolean }) {
  const w = Math.max(0, Math.min(100, (v / Math.max(1, max)) * 100));
  return <span class={`gauge ${tone ?? 'main'}${thin ? ' thin' : ''}`}><span style={{ width: `${w}%` }} /></span>;
}

/** やる気（5つの丸。低いほど橙、高いほど緑） */
export function MoodDots({ m }: { m: number }) {
  const color = ['#d0702c', '#d39a3a', '#b9b04a', '#8aa84f', '#5f9a4c'][m];
  return <span class="mooddots" title={B.motivationLabel[m]}>{[0, 1, 2, 3, 4].map((i) => <i style={{ background: i <= m ? color : undefined }} />)}</span>;
}
/** 体力のゲージ（7夜目：疲労の裏返しを「体力」として見せる。低いと赤） */
export function FatigueBar({ f }: { f: number }) {
  return <Gauge v={100 - f} max={100} tone={f >= B.fatigue.slowAt ? 'red' : 'exp'} thin />;
}

/** 技能の上位n個 */
export function topSkills(s: GameState, st: Student, n = 3): SkillId[] {
  return SKILLS.filter((k) => skillUnlocked(s, k)).sort((a, b) => st.skills[b] - st.skills[a] || (st.targets.includes(b) ? 1 : 0) - (st.targets.includes(a) ? 1 : 0)).slice(0, n);
}
/** 技能ランクの小箱（ランクは明朝体で大きく、次のランクまでのゲージ） */
/** 技能の札。10夜目：得意（金の「得」）・苦手（灰色の「苦」）・芽（小さな芽の印）・開花（金の花） */
export function SkillBox({ k, p, target, st }: { k: SkillId; p: number; target?: boolean; st?: Student }) {
  const n = nextRankPoints(p); const cur = RANK_POINTS[rankOf(p)];
  const good = st ? isGood(st, k) : false, bad = st ? isBad(st, k) : false;
  const bud = st?.bud && !st.bud.done && st.bud.skill === k && budKnown(st);
  const bloomed = st?.bud?.done && st.bud.skill === k;
  return (
    <div class={`skillbox${target ? ' target' : ''}${good ? ' good' : ''}${bad ? ' bad' : ''}`}>
      <div class="row between nowrap"><span class="sk">{SKILL_NAMES[k]}{bloomed ? <i class="apt bloom" title="開花">花</i> : good ? <i class="apt good" title="得意：よく伸びます">得</i> : bad ? <i class="apt bad" title="苦手：伸びにくいです">苦</i> : null}{bud && <i class="apt bud" title="眠った芽">芽</i>}</span><b class="rank">{rankOf(p)}</b></div>
      <Gauge v={n ? p - cur : 1} max={n ? n - cur : 1} tone="skill" thin />
    </div>
  );
}

/** カード右上のお知らせの札 */
/** 札から個人ページのどのタブを開くか（9夜目） */
export function flagTab(text: string): string {
  if (text === '宿敵') return 'bonds';
  if (text.startsWith('けが')) return 'record';
  return 'person';
}
export function studentFlags(s: GameState, st: Student, exams?: Set<string>): { text: string; tone: 'main' | 'red' | 'gold' }[] {
  const out: { text: string; tone: 'main' | 'red' | 'gold' }[] = [];
  if (st.status !== 'enrolled') return out;
  if (st.dropoutSign) out.push({ text: '退学の予兆', tone: 'red' });
  if (st.injuredWeeks > 0) out.push({ text: `けが あと${st.injuredWeeks}週`, tone: 'red' });
  if (s.consults.includes(st.id)) out.push({ text: '相談あり', tone: 'gold' });
  if ((exams ?? new Set(examCandidates(s).map((x) => x.id))).has(st.id)) out.push({ text: '試験OK', tone: 'main' });
  if (st.motivation <= 1) out.push({ text: 'やる気低下', tone: 'red' });
  if (budKnown(st)) out.push({ text: st.bud?.gold ? '金の芽' : '芽', tone: 'gold' });
  else if (budHinted(st)) out.push({ text: 'ひらめきの兆し', tone: 'main' });
  if (s.students[st.id] && isBirthdayWeek(s, st)) out.push({ text: '誕生日', tone: 'gold' });
  if (Object.values(s.rivalries ?? {}).some((r) => r.sid === st.id && !r.settled && (r.stage >= 2 || r.vow))) out.push({ text: '宿敵', tone: 'red' });
  return out;
}
/** 誕生日の週か（誕生日がまだない生徒は false） */
export function isBirthdayWeek(s: GameState, st: Student): boolean {
  const b = st.birthday;
  return !!b && b.month === s.month && b.week === s.week;
}

/** 長い名前は1行に収める（文字を小さく、それでも長ければ省略） */
export function NameLine({ st, size = 20, family = true }: { st: Student; size?: number; family?: boolean }) {
  const len = st.given.length;
  const fs = len >= 9 ? size * 0.68 : len >= 7 ? size * 0.8 : size;
  return (
    <div class="nameline">
      <b class="given" style={{ fontSize: fs }}>{st.given}</b>
      {family && <span class="family">{st.family}</span>}
    </div>
  );
}

/** 名簿のカード（見本 docs/mockups/roster.png） */
export function StuCard({ s, st, exams, onClick, extra }: { s: GameState; st: Student; exams?: Set<string>; onClick?: () => void; extra?: ComponentChildren }) {
  const color = countryColor(st.origin);
  const dream = DREAMS.find((d) => d.id === st.dream);
  const flags = studentFlags(s, st, exams);
  const pinned = s.pinned.includes(st.id);
  return (
    <div class="stucard" style={{ ['--band' as string]: color }} onClick={onClick ?? (() => navigate({ tab: 'students', page: 'detail', id: st.id }))}>
      <div class="sc-left">
        <Portrait st={st} size={72} frame={color} />
        <LvBadge lv={st.level} />
      </div>
      <div class="sc-body">
        <div class="sc-head">
          <NameLine st={st} />
          <span class="sc-flags">{pinned && <span class="pinstar"><Icon name="star" size={18} /></span>}{flags.slice(0, 2).map((f) => <span class={`flag ${f.tone}`} onClick={(e) => { e.stopPropagation(); if (f.text === '試験OK') navigate({ tab: 'students', page: 'exam', id: st.id }); else navigate({ tab: 'students', page: 'detail', id: st.id, sub: flagTab(f.text) }); }}>{f.text}</span>)}</span>
        </div>
        <div class="row nowrap gap4"><ClassName classId={st.classId} /><CountryChip o={st.origin} /><Chip>{PERSONALITIES[st.personality].name}</Chip>{st.grade > 0 && <span class="muted small">{st.grade}年</span>}</div>
        <div class="row nowrap gap6 expline"><span class="lbl">EXP</span><Gauge v={st.exp} max={B.student.expPerLevel} tone="exp" /></div>
        <div class="skill3">{topSkills(s, st).map((k) => <SkillBox k={k} p={st.skills[k]} target={st.targets.includes(k)} />)}</div>
        <div class="sc-foot">
          <span class="nowrap">やる気 <MoodDots m={st.motivation} /></span>
        </div>
        <div class="dream">夢：{dream?.text ? dream.name : 'まだない'}</div>
        {st.status === 'enrolled' && <div class="sc-weapon">装備：{(() => { const a = equipped(s, st); return a ? itemName(a) : 'おまかせ'; })()}</div>}
        {extra}
      </div>
    </div>
  );
}

/** 小さめのカード（出撃準備・面談・お茶会などの一覧） */
export function MiniCard({ st, sub, right, onClick, dim, children }: { st: Student; sub?: ComponentChildren; right?: ComponentChildren; onClick?: () => void; dim?: boolean; children?: ComponentChildren }) {
  const color = countryColor(st.origin);
  return (
    <div class={`minicard${dim ? ' dim' : ''}`} style={{ ['--band' as string]: color }}>
      <div class="row nowrap gap8" onClick={onClick ?? (() => navigate({ tab: 'students', page: 'detail', id: st.id }))} style={{ cursor: 'pointer' }}>
        <div class="mc-face"><Portrait st={st} size={52} frame={color} /><LvBadge lv={st.level} /></div>
        <div class="grow">
          <NameLine st={st} size={16} />
          <div class="small row nowrap gap4"><ClassName classId={st.classId} size={13} /></div>
          {sub && <div class="small muted">{sub}</div>}
        </div>
        {right}
      </div>
      {children}
    </div>
  );
}

/** 顔の並び（支援相手など） */
export function FaceRow({ list, size = 40 }: { list: { st: Student; label?: string }[]; size?: number }) {
  return (
    <div class="facerow">
      {list.map(({ st, label }) => (
        <div class="fr-item" onClick={() => navigate({ tab: 'students', page: 'detail', id: st.id })}>
          <Portrait st={st} size={size} frame={countryColor(st.origin)} />
          <div class="fr-name">{st.given}</div>
          {label && <div class="fr-label">{label}</div>}
        </div>
      ))}
    </div>
  );
}

// ---------- 依頼のカード ----------
export const OBJECTIVE_ICON: Record<Quest['objective'], string> = { rout: 'skull', boss: 'crown', defend: 'shield', escort: 'run', seize: 'castle', rescue: 'hand', escape: 'run' };
export const WEATHER_ICON: Record<Quest['weather'], string> = { clear: 'sun', rain: 'rain', fog: 'fog' };
export function Stars({ n, max = 3 }: { n: number; max?: number }) {
  return <span class="stars">{Array.from({ length: max }, (_, i) => <span class={i < n ? 'on' : ''}>★</span>)}</span>;
}

/** 区切りの見出し（飾り罫） */
export function SecTitle({ children, right }: { children: ComponentChildren; right?: ComponentChildren }) {
  return <div class="sectitle"><h2>{children}</h2>{right}</div>;
}
/** 数字を大きく明朝体で */
export function Num({ v, unit }: { v: number | string; unit?: string }) {
  return <span class="num">{v}{unit && <small>{unit}</small>}</span>;
}

export { TALENTS };
