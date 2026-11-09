// 教官の画面（8夜目）：教官手帳の頁で、経験ポイント・技能・特殊能力の木・副教官・歴代の教官
import { useState } from 'preact/hooks';
import type { GameState } from '../core/state';
import type { SkillId } from '../core/types';
import type { VicePolicy } from '../core/state';
import { act, navigate } from './store';
import { Back, HelpTip } from './common';
import { Portrait } from './Portrait';
import { TeacherFace } from './Talk';
import { Num, countryColor } from './cards';
import { Icon } from './icons';
import { sfx } from './sound';
import { B, SKILLS, TEACHER_RANK } from '../data/balance';
import { SKILL_NAMES, PERSONALITIES } from '../data/people';
import { rankOf, nextRankPoints } from '../core/util';
import { RANK_POINTS } from '../data/balance';
import { skillUnlocked } from '../core/week';
import { instructorCaps, goodSkillsOf, viceEligible, viceOf, setVice, removeVice, VICE_POLICY_NAMES, teacherRank, teacherNext, teacherClassName } from '../core/instructor';
import { mentorXp, abilityCost, abilityState, learnAbility, skillCost, trainSkill } from '../core/mentor';
import { MENTOR_ABILITIES, MENTOR_BY_ID, MENTOR_BRANCH_NAMES, MENTOR_COST_NAMES, type MentorAbility, type MentorBranch } from '../data/mentor';
import { teacherMax, teacherStamina } from '../core/lessons';
import { skillIcon } from './cards';

export const BG_NAMES: Record<string, string> = { knight: '元王国騎士', merc: '元帝国の傭兵', mage: '元同盟の宮廷魔道士', wanderer: '流れの旅人' };
const KANJI = ['〇', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十'];
export function kanjiNum(n: number): string {
  if (n <= 10) return KANJI[Math.max(0, n)];
  if (n < 20) return `十${n % 10 ? KANJI[n % 10] : ''}`;
  if (n < 100) return `${KANJI[Math.floor(n / 10)]}十${n % 10 ? KANJI[n % 10] : ''}`;
  return String(n);
}

type Fx = { kind: 'ability'; id: string } | { kind: 'skill'; k: SkillId; from: string; to: string };

export function InstructorPage({ s }: { s: GameState }) {
  const ins = s.instructor;
  const caps = instructorCaps(s);
  const good = new Set(goodSkillsOf(s));
  const me = ins.studentId ? s.students[ins.studentId] : null;
  const xp = mentorXp(s);
  const [sel, setSel] = useState<string | null>(null);
  const [fx, setFx] = useState<Fx | null>(null);
  const learned = ins.abilities ?? [];
  return (
    <div class="deskpage">
      <Back to={() => navigate({ tab: 'school' })} />
      <div class="ledger">
        <div class="ledger-head">
          <div class="mt-face"><TeacherFace s={s} size={84} /><span class="lvbadge">{ins.generation}代目</span></div>
          <div class="grow" style={{ minWidth: 0 }}>
            <div class="nameline"><b class="given" style={{ fontSize: 22 }}>{ins.name}</b><span class="family">教官</span></div>
            <div class="small">{BG_NAMES[ins.background] ?? ''}{me ? `（${me.cohort}期生）` : ''}・{ins.age}歳・在任{s.year - (ins.since ?? 1)}年</div>
            <div class="small muted">これまでに教えた子 {ins.experience}人・体力 {Math.round(teacherStamina(s))}／{teacherMax(s)}</div>
            <div class="small mt-tclass">先生の兵種：<b>{teacherClassName(s)}</b>（勝った宿敵戦 {ins.nemWins ?? 0}）</div>
          </div>
          <span class="stamp">教官</span>
        </div>
        <div class="mt-xp">
          <span class="small">先生の経験値</span>
          <b class="mt-xpnum">{xp.toLocaleString()}</b><span class="small muted">pt</span>
          <span class="grow" />
          <span class="small muted">これまでの合計 {Math.floor(ins.xpTotal ?? 0).toLocaleString()}</span>
        </div>
        <TeacherRankCard s={s} />
        <div class="small muted">経験値は授業のたびにたまります。たまった経験値で、先生の技能や心得を上げられます。<HelpTip text="顔の子が多いとき、友情タッグのとき、ランクやレベルが上がった子がいるときは、多めにたまります。休講の日はたまりません。" /></div>
      </div>

      <div class="ledger">
        <h3 class="ledger-title">技能の頁</h3>
        <div class="small muted">先生の技能が高いほど、その授業でみんながよく伸びます。<HelpTip text={`★の得意科目はSまで、ほかは${B.instructor.capOther}まで上げられます。${ins.background === 'wanderer' && !ins.studentId ? '流れの旅人は、すべてAまでです。' : ''}雇った講師や卒業生の講師は、教えるうちに自然と上がります。`} /></div>
        {SKILLS.filter((k) => skillUnlocked(s, k)).map((k) => {
          const p = ins.skills[k] ?? 0;
          const c = skillCost(s, k, caps);
          const n = nextRankPoints(p); const cur = RANK_POINTS[rankOf(p)];
          return (
            <div class="mt-skill">
              <span class="mt-sk"><Icon name={skillIcon(k)} size={16} />{SKILL_NAMES[k]}{good.has(k) ? '★' : ''}</span>
              <b class="mt-rank">{rankOf(p)}</b>
              <span class="gauge thin skill grow"><span style={{ width: `${n ? Math.round(((p - cur) / (n - cur)) * 100) : 100}%` }} /></span>
              {c ? <button class="btn small mt-buy" disabled={xp < c.cost} onClick={() => { const from = rankOf(p); let ok = false; act((g) => { ok = !!trainSkill(g, k, instructorCaps(g)); }); if (ok) { sfx('pass'); setFx({ kind: 'skill', k, from, to: c.to }); } }}>→{c.to}<small>{c.cost}pt</small></button> : <span class="mt-cap small muted">上限 {rankOf(caps[k])}</span>}
            </div>
          );
        })}
      </div>

      <div class="ledger">
        <h3 class="ledger-title">心得の木 <span class="small muted">{learned.length}／{MENTOR_ABILITIES.length}</span></h3>
        <div class="small muted">丸をタップすると、説明が出ます。線でつながったものは、上から順に覚えます。<HelpTip text="経歴によって、安く覚えられるものがあります。値札が緑のものです。覚えるたびに、次のものが少しずつ高くなります。" /></div>
        {(Object.keys(MENTOR_BRANCH_NAMES) as MentorBranch[]).map((br) => (
          <div class="mt-branch">
            <div class="mt-brname">{MENTOR_BRANCH_NAMES[br]}</div>
            <div class="mt-nodes">
              {MENTOR_ABILITIES.filter((a) => a.branch === br && !a.pre).map((a) => {
                const kids = MENTOR_ABILITIES.filter((x) => x.pre === a.id);
                return (
                  <div class="mt-col">
                    <Node s={s} a={a} on={sel === a.id} onTap={() => { sfx('move'); setSel(sel === a.id ? null : a.id); }} />
                    {kids.map((c) => <><span class={`mt-line${learned.includes(a.id) ? ' lit' : ''}`} /><Node s={s} a={c} on={sel === c.id} onTap={() => { sfx('move'); setSel(sel === c.id ? null : c.id); }} /></>)}
                  </div>
                );
              })}
            </div>
            {sel && MENTOR_BY_ID[sel]?.branch === br && <AbilityDetail s={s} a={MENTOR_BY_ID[sel]} onLearn={() => { let ok = false; act((g) => { ok = learnAbility(g, sel); }); if (ok) { sfx('level'); setFx({ kind: 'ability', id: sel }); setSel(null); } }} />}
          </div>
        ))}
        {(ins.inherited ?? []).length > 0 && <div class="small muted ruled">先代から受け継いだ心得：{(ins.inherited ?? []).map((id) => MENTOR_BY_ID[id]?.name).filter(Boolean).join('・')}</div>}
      </div>

      <ViceCard s={s} />
      <PastCard s={s} />
      {fx && <LearnFx s={s} fx={fx} onDone={() => setFx(null)} />}
    </div>
  );
}

function Node({ s, a, on, onTap }: { s: GameState; a: MentorAbility; on: boolean; onTap: () => void }) {
  const st = abilityState(s, a);
  return (
    <button class={`mt-node ${st}${on ? ' sel' : ''}`} onClick={onTap} aria-label={a.name}>
      <span class="mt-seal">{a.mark}</span>
      <span class="mt-name">{a.name}</span>
      <span class={`mt-price${a.cheap?.[s.instructor.background] ? ' cheap' : ''}`}>{st === 'learned' ? '覚えた' : st === 'locked' ? '—' : `${abilityCost(s, a)}`}</span>
    </button>
  );
}

function AbilityDetail({ s, a, onLearn }: { s: GameState; a: MentorAbility; onLearn: () => void }) {
  const st = abilityState(s, a);
  const cost = abilityCost(s, a);
  const pre = a.pre ? MENTOR_BY_ID[a.pre] : null;
  return (
    <div class="mt-detail">
      <div class="row between nowrap"><b class="serif">{a.name}</b><span class="small muted">費用：{MENTOR_COST_NAMES[a.cost]}{a.cheap?.[s.instructor.background] ? '（経歴のおかげで安い）' : ''}</span></div>
      <div>{a.desc}</div>
      {pre && <div class="small muted">先に「{pre.name}」を覚えてください</div>}
      {st === 'learned' ? <div class="small" style={{ color: 'var(--gold)' }}>もう覚えています</div>
        : <button class="btn primary block" style={{ marginTop: 6 }} disabled={st !== 'ready'} onClick={onLearn}>{st === 'locked' ? `「${pre?.name}」が先` : st === 'poor' ? `経験値が足りない（${cost}）` : `覚える（${cost}）`}</button>}
    </div>
  );
}

/** 覚えた瞬間の演出：封蝋の印が押され、名前が浮かぶ。タップで閉じる */
function LearnFx({ s, fx, onDone }: { s: GameState; fx: Fx; onDone: () => void }) {
  const a = fx.kind === 'ability' ? MENTOR_BY_ID[fx.id] : null;
  return (
    <div class="levelup mt-fx" onClick={() => { sfx('ok'); onDone(); }}>
      <div class="mt-fxbox">
        <div class="small">{s.instructor.name}教官</div>
        <div class="mt-fxtitle">{a ? '心得を覚えました' : '技能が上がりました'}</div>
        {a ? <span class="mt-fxseal">{a.mark}</span> : <span class="mt-fxseal sk"><Icon name={skillIcon(fx.kind === 'skill' ? fx.k : 'sword')} size={38} /></span>}
        <div class="mt-fxname">{a ? `「${a.name}」` : fx.kind === 'skill' ? `${SKILL_NAMES[fx.k]}　${fx.from} → ${fx.to}` : ''}</div>
        {a && <div class="small">{a.desc}</div>}
        <div class="ru-next" style={{ marginTop: 12 }}>タップしてつづきへ ▼</div>
      </div>
    </div>
  );
}

function ViceCard({ s }: { s: GameState }) {
  const elig = viceEligible(s);
  return (
    <div class="ledger">
      <h3 class="ledger-title">副教官（学年の担任）</h3>
      <div class="muted small">卒業生の講師を、学年の担任にできます。担任のいる学年は、少しよく伸びます。<HelpTip text={`講師になって${B.vice.minYears}年たった卒業生が、担任になれます。担任は方針に合わせて、その学年の目標の技能を決めます。戦いの指揮はしません。`} /></div>
      {[1, 2, 3].map((g) => {
        const v = viceOf(s, g);
        return (
          <div class="pcard" style={{ ['--band' as string]: v ? countryColor(v.st.origin) : '#cfc6b2', margin: '8px 0' }}>
            <div class="row between nowrap"><b>{g}年生の担任</b>{v && <button class="btn ghost small" onClick={() => act((x) => removeVice(x, g))}>外す</button>}</div>
            {v ? (
              <>
                <div class="row nowrap gap8" style={{ marginTop: 4 }}><Portrait st={v.st} size={44} frame={countryColor(v.st.origin)} /><div class="grow"><b>{v.t.name}</b>　<span class="small">{SKILL_NAMES[v.t.skill]} {rankOf(v.t.points)}・{PERSONALITIES[v.st.personality].name}</span></div></div>
                <div class="seg" style={{ marginTop: 6 }}>{(Object.keys(VICE_POLICY_NAMES) as VicePolicy[]).map((p) => <button class={v.v.policy === p ? 'on' : ''} onClick={() => act((x) => { const y = (x.vice ?? []).find((z) => z.grade === g); if (y) y.policy = p; })}>{VICE_POLICY_NAMES[p]}</button>)}</div>
              </>
            ) : (
              <div class="row" style={{ marginTop: 4 }}>
                {elig.filter((t) => !(s.vice ?? []).some((x) => x.teacherId === t.id)).map((t) => <button class="btn small" onClick={() => { sfx('ok'); act((x) => setVice(x, t.id, g, 'balance')); }}>{t.name}に任せる</button>)}
                {!elig.filter((t) => !(s.vice ?? []).some((x) => x.teacherId === t.id)).length && <span class="muted small">任せられる講師がいません。卒業生が「学校に残る」と講師になり、1年たつと担任にできます</span>}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function PastCard({ s }: { s: GameState }) {
  const ins = s.instructor;
  if (!(s.pastInstructors ?? []).length) return null;
  return (
    <div class="ledger">
      <h3 class="ledger-title">歴代の教官</h3>
      {(s.pastInstructors ?? []).map((p) => <div class="row between small ruled"><span>{kanjiNum(p.generation)}代目 <b>{p.name}</b>（{BG_NAMES[p.background] ?? ''}）</span><span class="muted">{p.from}〜{p.to}年目・教えた子{p.taught}人</span></div>)}
      <div class="row between small ruled"><span>{kanjiNum(ins.generation)}代目 <b>{ins.name}</b>（在任中）</span><span class="muted">{ins.since ?? 1}年目〜</span></div>
    </div>
  );
}

/** 20夜目：先生の兵種（教官 → 指揮官 → 軍師 → 名将） */
function TeacherRankCard({ s }: { s: GameState }) {
  const r = teacherRank(s);
  const nx = teacherNext(s);
  return (
    <div class="mt-rankcard">
      <div class="mt-rankrow">{TEACHER_RANK.names.map((n, i) => <span class={`mt-rk${i === r ? ' on' : i < r ? ' done' : ''}`}>{n}</span>)}</div>
      <div class="small">{TEACHER_RANK.desc[r]}</div>
      <div class="small muted">号令 {TEACHER_RANK.command[r]}回・見極め {TEACHER_RANK.insight[r]}回（1回で弱点を{TEACHER_RANK.depth[r]}つ・{TEACHER_RANK.range[r]}マス先まで）</div>
      {nx ? <div class="small muted">次の「{nx.name}」まで：{nx.years > 0 ? `在任あと${nx.years}年` : '在任の年数はそろった'}・{nx.wins > 0 ? `宿敵戦にあと${nx.wins}勝` : '宿敵戦の勝ちはそろった'}</div> : <div class="small muted">先生の兵種は、いちばん上の「名将」です。</div>}
    </div>
  );
}
