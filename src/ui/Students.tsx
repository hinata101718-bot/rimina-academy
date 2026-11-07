import { useState } from 'preact/hooks';
import { useStore, navigate, act } from './store';
import { enrolled, effectiveStats } from '../core/game';
import { growthRates } from '../core/growth';
import { nextClasses, classUnlocked, meetsReq, passRate, canTakeExam, takeExam } from '../core/exam';
import { rng } from '../core/flow';
import { skillUnlocked } from '../core/week';
import { StuRow, Back, Bar, moodIcon } from './common';
import { Portrait } from './Portrait';
import { SKILL_NAMES, STAT_NAMES, PERSONALITIES, TRAITS, TALENTS, DREAMS, COUNTRY_NAMES, HOUSE_NAMES } from '../data/people';
import { CLASSES } from '../data/classes';
import { ABILITIES } from '../data/abilities';
import { B, SKILLS, STATS, RANK_POINTS } from '../data/balance';
import { rankOf, nextRankPoints } from '../core/util';
import type { SkillId, Rank } from '../core/types';
import type { GameState, Student } from '../core/state';
import { supportRank } from '../core/support';
import { titleOf } from '../core/alumni';
import { sfx } from './sound';
import { ensureSpellPlan, usableSpells } from '../core/spells';
import { WEAPONS } from '../data/weapons';

export function StudentsTab() {
  const { s, route } = useStore();
  if (!s) return null;
  if (route.page === 'detail' && route.id && s.students[route.id]) return <Detail s={s} st={s.students[route.id]} />;
  if (route.page === 'exam') return <ExamList s={s} />;
  return <Roster s={s} />;
}

function Roster({ s }: { s: GameState }) {
  const [sort, setSort] = useState<'grade' | 'level' | 'mood' | 'fatigue'>('grade');
  const [grade, setGrade] = useState(0);
  let list = enrolled(s);
  if (grade) list = list.filter((x) => x.grade === grade);
  list = [...list].sort((a, b) => sort === 'level' ? b.level - a.level : sort === 'mood' ? a.motivation - b.motivation : sort === 'fatigue' ? b.fatigue - a.fatigue : a.grade - b.grade);
  return (
    <div>
      <div class="row between"><h2>生徒名簿（{enrolled(s).length}人）</h2><button class="btn small" onClick={() => navigate({ tab: 'students', page: 'exam' })}>兵種試験</button></div>
      <div class="row">
        <select value={grade} onChange={(e) => setGrade(Number((e.target as HTMLSelectElement).value))}><option value={0}>全学年</option><option value={1}>1年</option><option value={2}>2年</option><option value={3}>3年</option></select>
        <select value={sort} onChange={(e) => setSort((e.target as HTMLSelectElement).value as typeof sort)}><option value="grade">学年順</option><option value="level">レベル順</option><option value="mood">やる気の低い順</option><option value="fatigue">疲れている順</option></select>
      </div>
      <div class="card">
        {list.map((st) => <StuRow st={st} right={<span class="small">{moodIcon(st)}{st.dropoutSign ? '⚠' : ''}{s.pinned.includes(st.id) ? '📌' : ''}{st.sickWeeks > 0 ? '🤒' : ''}{st.injuredWeeks > 0 ? '🩹' : ''}</span>} />)}
        {!list.length && <div class="empty-note">生徒がいません</div>}
      </div>
    </div>
  );
}

export function talentText(st: Student): string {
  if (!st.talent) return st.talentReveal >= 100 ? '目立った才能はなさそう' : '？';
  const t = TALENTS[st.talent];
  if (st.talentReveal >= B.talent.full) return `「${t.name}」`;
  if (st.talentReveal >= B.talent.hint2) return t.hint2;
  if (st.talentReveal >= B.talent.hint1) return t.hint1;
  return '？';
}

function Detail({ s, st }: { s: GameState; st: Student }) {
  const es = effectiveStats(st);
  const gr = growthRates(st);
  const cls = CLASSES[st.classId];
  const dream = DREAMS.find((d) => d.id === st.dream)!;
  const supports = Object.values(s.supports).filter((x) => (x.a === st.id || x.b === st.id) && x.value > 0).sort((a, b) => b.value - a.value).slice(0, 8);
  const grad = st.status !== 'enrolled';
  const pinned = s.pinned.includes(st.id);
  const parents = st.parents.map((p) => s.students[p]).filter(Boolean);
  return (
    <div>
      <Back to={() => history.length && navigate(grad ? { tab: 'yearbook' } : { tab: 'students' })} />
      <div class="card">
        <div class="row">
          <Portrait st={st} size={84} />
          <div class="grow">
            <h2 style={{ margin: 0 }}>{st.given} <span class="muted">{st.family}</span></h2>
            <div class="muted">{st.age}歳・{st.gender === 'm' ? '男性' : '女性'}・{grad ? `${st.cohort}期生` : `${st.grade}年生`}</div>
            <div>{cls.name} Lv{st.level} <span class="muted small">経験{st.exp}/100</span></div>
            {grad && <div><b>{st.status === 'dropped' ? '退学' : st.status === 'dead' ? `在学中に戦死（${st.diedYear}年目）` : titleOf(st)}</b></div>}
          </div>
        </div>
        {!grad && (
          <div class="row" style={{ marginTop: 6 }}>
            <button class="btn small" onClick={() => act((g) => { g.pinned = pinned ? g.pinned.filter((x) => x !== st.id) : [...g.pinned, st.id].slice(-5); })}>{pinned ? '📌 気にかけるをやめる' : '📌 気にかける'}</button>
            {nextClasses(s, st).length > 0 && <button class="btn small" onClick={() => navigate({ tab: 'students', page: 'exam' })}>兵種試験へ</button>}
          </div>
        )}
      </div>
      <div class="two">
        <div>
          <div class="card">
            <h3>人となり</h3>
            <div>性格：{PERSONALITIES[st.personality].name}<span class="muted small">（{PERSONALITIES[st.personality].desc}）</span></div>
            <div>夢：{dream.name}</div>
            <div>出身：{COUNTRY_NAMES[st.origin]}・{HOUSE_NAMES[st.house]}</div>
            {parents.length > 0 && <div>親：{parents.map((p) => <a onClick={() => navigate({ tab: 'students', page: 'detail', id: p.id })} style={{ textDecoration: 'underline', marginRight: 6 }}>{p.given}（{p.cohort}期生）</a>)}</div>}
            <div>特徴：{st.knownTraits.map((t) => <span class="tag" title={TRAITS[t].desc}>{TRAITS[t].name}</span>)}{st.traits.length > st.knownTraits.length && <span class="tag gray">？</span>}</div>
            <div class="small muted">{st.knownTraits.map((t) => `${TRAITS[t].name}：${TRAITS[t].desc}`).join('／')}</div>
            <div>才能：{talentText(st)}</div>
            {!grad && <div class="muted small">才能の判明度 <Bar v={st.talentReveal} max={100} /></div>}
          </div>
          {!grad && (
            <div class="card">
              <h3>状態</h3>
              <div>やる気：{moodIcon(st)} {B.motivationLabel[st.motivation]}</div>
              <div>疲労：{Math.round(st.fatigue)} <Bar v={st.fatigue} max={100} red={st.fatigue >= 60} /></div>
              <div>教官への信頼：{Math.round(st.trust)} <Bar v={st.trust} max={100} /></div>
              {st.sickWeeks > 0 && <div class="tag red">体調不良（あと{st.sickWeeks}週）</div>}
              {st.injuredWeeks > 0 && <div class="tag red">重傷（あと{st.injuredWeeks}週）</div>}
              {st.dropoutSign && <div class="tag red">退学の予兆あり：面談で話を聞こう（あと面談{st.dropoutSign.talksNeeded}回）</div>}
            </div>
          )}
          <div class="card">
            <h3>能力</h3>
            <table class="stats"><tbody>
              {STATS.map((k) => <tr><td>{STAT_NAMES[k]}</td><td><b>{es[k]}</b>{es[k] !== st.stats[k] && <span class="muted small">（{st.stats[k]}{es[k] - st.stats[k] >= 0 ? '+' : ''}{es[k] - st.stats[k]}）</span>}</td><td class="muted small">成長率 {st.growthKnown ? `${gr[k]}%` : '？'}</td></tr>)}
            </tbody></table>
            {cls.ability && ABILITIES[cls.ability] && <div class="small">兵種スキル：{ABILITIES[cls.ability].name}（{ABILITIES[cls.ability].desc}）</div>}
          </div>
        </div>
        <div>
          <div class="card">
            <h3>技能ランク</h3>
            {SKILLS.filter((k) => skillUnlocked(s, k)).map((k) => {
              const p = st.skills[k]; const n = nextRankPoints(p); const cur = RANK_POINTS[rankOf(p)];
              const target = st.targets.includes(k);
              return <div class="row" style={{ marginBottom: 3 }}><span style={{ width: 44 }}>{SKILL_NAMES[k]}</span><b style={{ width: 28 }}>{rankOf(p)}</b><div class="grow"><Bar v={n ? p - cur : 1} max={n ? n - cur : 1} /></div>{target && <span class="tag">目標</span>}</div>;
            })}
            {!grad && (
              <div style={{ marginTop: 8 }}>
                <div class="muted small">目標技能（2つ）：授業で特に伸びます。夢に沿うとやる気が上がりやすい（夢に沿う技能：{dream.skills.map((k) => SKILL_NAMES[k]).join('・') || 'なし'}）</div>
                {[0, 1].map((i) => (
                  <select value={st.targets[i]} onChange={(e) => act((g) => { const x = g.students[st.id]; const t = [...x.targets] as [SkillId, SkillId]; t[i] = (e.target as HTMLSelectElement).value as SkillId; x.targets = t; x.targetsAuto = false; })} style={{ marginRight: 6 }}>
                    {SKILLS.filter((k) => skillUnlocked(s, k)).map((k) => <option value={k}>{SKILL_NAMES[k]}</option>)}
                  </select>
                ))}
                <label class="small"><input type="checkbox" checked={st.targetsAuto} onChange={(e) => act((g) => { g.students[st.id].targetsAuto = (e.target as HTMLInputElement).checked; })} /> 自動で決める</label>
              </div>
            )}
          </div>
          <SpellCard st={st} />
          <div class="card">
            <h3>仲間との支援</h3>
            {supports.length === 0 && <div class="muted">まだ特に親しい仲間はいない</div>}
            {supports.map((sp) => { const o = s.students[sp.a === st.id ? sp.b : sp.a]; if (!o) return null; return (
              <div class="row" onClick={() => navigate({ tab: 'students', page: 'detail', id: o.id })} style={{ cursor: 'pointer' }}>
                <Portrait st={o} size={28} /><span class="grow">{o.given}</span>
                <span class="tag">{supportRank(sp.value) || '—'}</span>
                {sp.kind !== 'none' && <span class="tag gray">{{ friend: '友情', rival: 'ライバル', love: '想い人' }[sp.kind]}</span>}
                <span class="muted small" style={{ width: 70 }}><Bar v={sp.value} max={B.support.max} /></span>
              </div>
            ); })}
          </div>
          <div class="card">
            <h3>記録</h3>
            <div class="small">出撃{st.battles}回・撃破{st.kills}・講評の最高 {st.bestGrade ?? '—'}{st.keepsake ? `・持っていった武器：${st.keepsake}` : ''}</div>
            {st.farewell && <div class="serif">卒業式のひとこと：「{st.farewell}」</div>}
            {st.history.length > 0 && <ul class="list">{st.history.slice(-15).map((h) => <li class="small">{h.year}年目：{h.text}</li>)}</ul>}
            {st.deathNote && <div class="muted">{st.diedYear}年目：{st.deathNote}</div>}
          </div>
        </div>
      </div>
    </div>
  );
}

function ExamList({ s }: { s: GameState }) {
  const [msg, setMsg] = useState('');
  const list = enrolled(s);
  return (
    <div>
      <Back to={() => navigate({ tab: 'students' })} />
      <h2>兵種試験</h2>
      <div class="muted small">技能ランクが条件を満たすと受験できます（月に1回）。条件を超えるほど合格しやすくなります。騎兵・天馬の兵種は厩舎（段階1以上）が必要です。</div>
      {msg && <div class="guide">{msg}</div>}
      {list.map((st) => {
        const opts = nextClasses(s, st);
        if (!opts.length) return null;
        const can = canTakeExam(s, st);
        return (
          <div class="card">
            <StuRow st={st} />
            {opts.map((c) => {
              const ok = classUnlocked(s, c) && meetsReq(st, c);
              const rate = ok ? passRate(st, c) : 0;
              const reqText = Object.entries(c.req).map(([k, r]) => `${SKILL_NAMES[k as SkillId]}${r}（今${rankOf(st.skills[k as SkillId])}${st.skills[k as SkillId] >= RANK_POINTS[r as Rank] ? '✓' : ''}）`).join('・');
              return (
                <div class="row between" style={{ borderTop: '1px dashed var(--line)', padding: '4px 0' }}>
                  <div class="grow"><b>{c.name}</b> <span class="muted small">{['見習い', '初級', '中級', '上級', '最上級'][c.tier]}</span><div class="muted small">{reqText}{c.needStable && (s.facilities.stable ?? 0) < 1 ? '・厩舎が必要' : ''}</div><div class="small muted">{c.desc}</div></div>
                  <button class="btn small" disabled={!ok || !can} onClick={() => { if (!confirm(`${st.given}が${c.name}の試験を受けます（合格率${rate}%）`)) return; act((g) => { const r = takeExam(g, rng(g), g.students[st.id], c.id); setMsg(r.text); sfx(r.ok ? 'pass' : 'cancel'); }); }}>{ok ? `受験 ${rate}%` : '条件未達'}</button>
                </div>
              );
            })}
            {!can && <div class="muted small">今月はもう受験できません（または休み中）</div>}
          </div>
        );
      })}
    </div>
  );
}

function SpellCard({ st }: { st: Student }) {
  const plan = ensureSpellPlan(st);
  const usable = new Set(usableSpells(st));
  return (
    <div class="card">
      <h3>魔法</h3>
      <div class="muted small">魔道・信仰の技能ランクが上がると、一人ひとり決まった魔法を覚えます。戦闘では、今の兵種で使える魔法を選んで使えます（回数の制限なし）。</div>
      {(['magic', 'faith'] as const).map((k) => {
        const slots = plan.filter((x) => x.skill === k);
        return (
          <div style={{ marginTop: 6 }}>
            <b>{SKILL_NAMES[k]}</b> <span class="muted small">（今 {rankOf(st.skills[k])}）</span>
            <div class="row" style={{ gap: 4, marginTop: 2 }}>
              {slots.map((x) => {
                const got = st.spells.includes(x.id);
                const w = WEAPONS[x.id];
                return got
                  ? <span class={`tag${usable.has(x.id) ? '' : ' gray'}`} title={w?.desc}>{w?.name}{w?.rare ? '★' : ''}</span>
                  : <span class="tag gray">{k === 'magic' ? '魔道' : '信仰'}{x.rank}で？？？</span>;
              })}
              {!slots.length && <span class="muted small">覚える魔法はない</span>}
            </div>
          </div>
        );
      })}
      {st.spells.some((id) => !usable.has(id)) && <div class="muted small">灰色の魔法は、今の兵種では使えません。</div>}
    </div>
  );
}
