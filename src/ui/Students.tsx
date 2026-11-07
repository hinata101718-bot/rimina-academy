import { useState } from 'preact/hooks';
import { useStore, navigate, act } from './store';
import { enrolled, effectiveStats } from '../core/game';
import { growthRates } from '../core/growth';
import { nextClasses, classUnlocked, meetsReq, passRate, canTakeExam, takeExam } from '../core/exam';
import { rng } from '../core/flow';
import { skillUnlocked } from '../core/week';
import { StuRow, Back, Bar, moodIcon } from './common';
import { StuCard, SecTitle, MoodDots, studentFlags, countryColor, LvBadge, ClassName, CountryChip, Chip, Gauge, FatigueBar, SkillBox, FaceRow, MiniCard, Num } from './cards';
import { Icon } from './icons';
import { examCandidates, missingReqs, levelReq } from '../core/exam';
import { Portrait } from './Portrait';
import { SKILL_NAMES, STAT_NAMES, PERSONALITIES, TRAITS, TALENTS, DREAMS, COUNTRY_NAMES, HOUSE_NAMES } from '../data/people';
import { CLASSES } from '../data/classes';
import { ABILITIES } from '../data/abilities';
import { B, SKILLS, STATS, RANK_POINTS } from '../data/balance';
import { rankOf, nextRankPoints, MONTH_NAMES } from '../core/util';
import type { SkillId, Rank } from '../core/types';
import type { GameState, Student } from '../core/state';
import { supportRank, archiveOf } from '../core/support';
import { TalkView } from './Talk';
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
  const view = s.settings.rosterView ?? 'card';
  const exams = new Set(examCandidates(s).map((x) => x.id));
  let list = enrolled(s);
  if (grade === 9) list = list.filter((x) => s.pinned.includes(x.id));
  else if (grade) list = list.filter((x) => x.grade === grade);
  list = [...list].sort((a, b) => sort === 'level' ? b.level - a.level : sort === 'mood' ? a.motivation - b.motivation : sort === 'fatigue' ? b.fatigue - a.fatigue : a.grade - b.grade);
  return (
    <div>
      <SecTitle right={<button class="btn small" onClick={() => navigate({ tab: 'students', page: 'exam' })}><Icon name="exam" size={16} /> 兵種試験{exams.size ? `（${exams.size}）` : ''}</button>}>生徒名簿<span class="cnt">{enrolled(s).length}人</span></SecTitle>
      <div class="pills">
        {[[0, '全学年'], [1, '1年'], [2, '2年'], [3, '3年'], [9, '★気にかける']].map(([g, label]) => <button class={grade === g ? 'on' : ''} onClick={() => { sfx('move'); setGrade(g as number); }}>{label}</button>)}
      </div>
      <div class="row between" style={{ marginBottom: 4 }}>
        <select value={sort} onChange={(e) => setSort((e.target as HTMLSelectElement).value as typeof sort)}><option value="grade">学年順</option><option value="level">レベル順</option><option value="mood">やる気の低い順</option><option value="fatigue">疲れている順</option></select>
        <div class="seg" style={{ width: 150 }}>
          <button class={view === 'card' ? 'on' : ''} onClick={() => act((g) => { g.settings.rosterView = 'card'; })}>カード</button>
          <button class={view === 'compact' ? 'on' : ''} onClick={() => act((g) => { g.settings.rosterView = 'compact'; })}>簡易</button>
        </div>
      </div>
      {view === 'card'
        ? list.map((st) => <StuCard s={s} st={st} exams={exams} />)
        : <div class="card compact">{list.map((st) => <div style={{ ['--band' as string]: countryColor(st.origin) }}><StuRow st={st} right={<span class="compright">{s.pinned.includes(st.id) && <span class="pinstar"><Icon name="star" size={16} /></span>}{studentFlags(s, st, exams).slice(0, 1).map((f) => <span class={`flag ${f.tone}`}>{f.text}</span>)}<MoodDots m={st.motivation} /></span>} /></div>)}</div>}
      {!list.length && <div class="empty-note">{grade === 9 ? '気にかける生徒はまだいません（個人ページの★で登録できます）' : '生徒がいません'}</div>}
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
  const color = countryColor(st.origin);
  const flags = studentFlags(s, st);
  const capHp = grad ? B.student.hpCapGrad : B.student.hpCapSchool;
  const cap = grad ? B.student.statCapGrad : B.student.statCapSchool;
  const supList = supports.map((sp) => ({ sp, o: s.students[sp.a === st.id ? sp.b : sp.a] })).filter((x) => x.o);
  return (
    <div>
      <Back to={() => history.length && navigate(grad ? { tab: 'yearbook' } : { tab: 'students' })} />
      <div class="pcard" style={{ ['--band' as string]: color }}>
        <div class="hero">
          <div class="hero-face"><Portrait st={st} size={96} frame={color} /><LvBadge lv={st.level} big /></div>
          <div class="grow" style={{ minWidth: 0 }}>
            <NameLineBig st={st} />
            <div class="row gap4" style={{ marginTop: 2 }}><ClassName classId={st.classId} size={16} /><CountryChip o={st.origin} /><Chip>{PERSONALITIES[st.personality].name}</Chip></div>
            <div class="muted small" style={{ marginTop: 2 }}>{st.age}歳・{st.gender === 'm' ? '男性' : '女性'}・{grad ? `${st.cohort}期生` : `${st.grade}年生`}・{HOUSE_NAMES[st.house]}</div>
            <div class="row nowrap gap6" style={{ marginTop: 4 }}><span class="small muted">EXP</span><Gauge v={st.exp} max={B.student.expPerLevel} tone="exp" /><span class="small muted">{st.exp}/100</span></div>
            {grad && <div style={{ marginTop: 4 }}><b>{st.status === 'dropped' ? '退学' : st.status === 'dead' ? `在学中に戦死（${st.diedYear}年目）` : titleOf(st)}</b></div>}
            {flags.length > 0 && <div class="row gap4" style={{ marginTop: 4 }}>{flags.map((f) => <span class={`flag ${f.tone}`}>{f.text}</span>)}</div>}
          </div>
        </div>
        {!grad && (
          <div class="row" style={{ marginTop: 8 }}>
            <button class="btn small" onClick={() => act((g) => { g.pinned = pinned ? g.pinned.filter((x) => x !== st.id) : [...g.pinned, st.id].slice(-5); })}><span class={pinned ? 'pinstar' : ''}><Icon name="star" size={16} /></span> {pinned ? '気にかけるをやめる' : '気にかける'}</button>
            {nextClasses(s, st).length > 0 && <button class="btn small" onClick={() => navigate({ tab: 'students', page: 'exam' })}><Icon name="exam" size={16} /> 兵種試験へ</button>}
          </div>
        )}
      </div>
      <div class="two">
        <div>
          {!grad && (
            <div class="card">
              <h3>状態</h3>
              <div class="statgrid">
                <div class="row nowrap gap6"><span class="small" style={{ width: 52 }}>やる気</span><MoodDots m={st.motivation} /><span class="small muted">{B.motivationLabel[st.motivation]}</span></div>
                <div class="row nowrap gap6"><span class="small" style={{ width: 52 }}>疲労</span><FatigueBar f={st.fatigue} /><Num v={Math.round(st.fatigue)} /></div>
                <div class="row nowrap gap6"><span class="small" style={{ width: 52 }}>信頼</span><Gauge v={st.trust} max={100} thin /><Num v={Math.round(st.trust)} /></div>
                <div class="row nowrap gap6"><span class="small" style={{ width: 52 }}>才能</span><Gauge v={st.talentReveal} max={100} thin tone="skill" /><span class="small muted">{Math.round(st.talentReveal)}%</span></div>
              </div>
              {st.sickWeeks > 0 && <div class="tag red">体調不良（あと{st.sickWeeks}週）</div>}
              {st.injuredWeeks > 0 && <div class="tag red">重傷（あと{st.injuredWeeks}週）</div>}
              {st.dropoutSign && <div class="tag red">退学の予兆あり：面談で話を聞こう（あと面談{st.dropoutSign.talksNeeded}回）</div>}
            </div>
          )}
          <div class="card">
            <h3>人となり</h3>
            <div>夢：<b>{dream.name}</b></div>
            <div>出身：{COUNTRY_NAMES[st.origin]}・{HOUSE_NAMES[st.house]}</div>
            <div class="small muted">性格：{PERSONALITIES[st.personality].name}（{PERSONALITIES[st.personality].desc}）</div>
            {st.birthday && <div class="small">誕生日：{MONTH_NAMES[st.birthday.month]} 第{st.birthday.week}週</div>}
            {parents.length > 0 && <div>親：{parents.map((p) => <a onClick={() => navigate({ tab: 'students', page: 'detail', id: p.id })} style={{ textDecoration: 'underline', marginRight: 6 }}>{p.given}（{p.cohort}期生）</a>)}</div>}
            <div class="row gap4" style={{ marginTop: 4 }}>特徴：{st.knownTraits.map((t) => <Chip tone="main">{TRAITS[t].name}</Chip>)}{st.traits.length > st.knownTraits.length && <Chip tone="gray">？</Chip>}</div>
            {st.knownTraits.length > 0 && <div class="small muted">{st.knownTraits.map((t) => `${TRAITS[t].name}：${TRAITS[t].desc}`).join('／')}</div>}
            <div style={{ marginTop: 4 }}>才能：<b>{talentText(st)}</b></div>
          </div>
          <div class="card">
            <h3>能力</h3>
            <div class="statlist">
              {STATS.map((k) => (
                <div class="statrow"><span>{STAT_NAMES[k]}</span><b>{es[k]}</b><span class="bonus">{es[k] !== st.stats[k] ? `${es[k] - st.stats[k] >= 0 ? '+' : ''}${es[k] - st.stats[k]}` : ''}</span><Gauge v={es[k]} max={k === 'hp' ? capHp : cap} thin /><span class="gr">成長 {st.growthKnown ? `${gr[k]}%` : '？'}</span></div>
              ))}
            </div>
            <div class="small muted">＋の数字は兵種による補正です。</div>
            {cls.ability && ABILITIES[cls.ability] && <div class="small ruled">兵種スキル：<b>{ABILITIES[cls.ability].name}</b>（{ABILITIES[cls.ability].desc}）</div>}
          </div>
        </div>
        <div>
          <div class="card">
            <h3>技能ランク</h3>
            <div class="skillgrid">{SKILLS.filter((k) => skillUnlocked(s, k)).map((k) => <SkillBox k={k} p={st.skills[k]} target={!grad && st.targets.includes(k)} />)}</div>
            {!grad && (
              <div style={{ marginTop: 8 }}>
                <div class="muted small">目標技能（2つ・金の枠）：授業で特に伸びます。夢に沿うとやる気が上がりやすい（夢に沿う技能：{dream.skills.map((k) => SKILL_NAMES[k]).join('・') || 'なし'}）</div>
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
            {supList.length === 0 && <div class="muted">まだ特に親しい仲間はいない</div>}
            <FaceRow list={supList.map(({ sp, o }) => ({ st: o, label: `${supportRank(sp.value) ? `支援${supportRank(sp.value)}` : ''}${sp.kind !== 'none' ? { friend: '・友情', rival: '・好敵手', love: '・想い' }[sp.kind] : ''}` }))} />
          </div>
          <TalkArchive s={s} st={st} />
          <div class="card">
            <h3>記録</h3>
            <div class="infogrid"><div><Icon name="battle" size={16} />出撃 <Num v={st.battles} /></div><div><Icon name="skull" size={16} />撃破 <Num v={st.kills} /></div><div><Icon name="medal" size={16} />講評の最高 <Num v={st.bestGrade ?? '—'} /></div>{st.keepsake && <div><Icon name="sword" size={16} />{st.keepsake}</div>}</div>
            {st.farewell && <div class="serif ruled">卒業式のひとこと：「{st.farewell}」</div>}
            {st.history.length > 0 && <ul class="list">{st.history.slice(-15).map((h) => <li class="small">{h.year}年目：{h.text}</li>)}</ul>}
            {st.deathNote && <div class="muted">{st.diedYear}年目：{st.deathNote}</div>}
          </div>
        </div>
      </div>
    </div>
  );
}

function NameLineBig({ st }: { st: Student }) {
  const len = st.given.length;
  return <div class="nameline"><b class="given" style={{ fontSize: len >= 9 ? 18 : len >= 7 ? 21 : 24 }}>{st.given}</b><span class="family">{st.family}</span></div>;
}

const TIER_NAMES = ['見習い', '初級', '中級', '上級', '最上級'];

function ExamList({ s }: { s: GameState }) {
  const [msg, setMsg] = useState('');
  const list = enrolled(s).filter((st) => nextClasses(s, st).length);
  const ready = new Set(examCandidates(s).map((x) => x.id));
  const sorted = [...list].sort((a, b) => (ready.has(b.id) ? 1 : 0) - (ready.has(a.id) ? 1 : 0) || b.level - a.level);
  return (
    <div>
      <Back to={() => navigate({ tab: 'students' })} />
      <SecTitle>兵種試験<span class="cnt">受験できる生徒 {ready.size}人</span></SecTitle>
      <div class="muted small">技能ランクとレベルの両方が条件を満たすと受験できます（月に1回）。受験のレベル：初級 Lv{B.exam.levelReq[1]}・中級 Lv{B.exam.levelReq[2]}・上級 Lv{B.exam.levelReq[3]}（最上級は卒業後 Lv{B.exam.levelReq[4]}）。技能が条件を超えるほど合格しやすくなります。</div>
      {msg && <div class="guide">{msg}</div>}
      {sorted.map((st) => {
        const opts = nextClasses(s, st);
        const can = canTakeExam(s, st);
        return (
          <MiniCard st={st} sub={`${st.grade}年・${TIER_NAMES[CLASSES[st.classId].tier]}`} right={ready.has(st.id) ? <span class="flag">試験OK</span> : undefined}>
            {opts.map((c) => {
              const ok = classUnlocked(s, c) && meetsReq(st, c);
              const rate = ok ? passRate(st, c) : 0;
              const miss = missingReqs(s, st, c);
              const lv = levelReq(c);
              return (
                <div class="pcard" style={{ ['--band' as string]: ok ? 'var(--main)' : '#cfc6b2', margin: '8px 0 0' }}>
                  <div class="row between nowrap">
                    <div class="grow"><ClassName classId={c.id} size={16} /> <span class="muted small">{TIER_NAMES[c.tier]}</span></div>
                    <button class={`btn small${ok && can ? ' primary' : ''}`} disabled={!ok || !can} onClick={() => { if (!confirm(`${st.given}が${c.name}の試験を受けます（合格率${rate}%）`)) return; act((g) => { const r = takeExam(g, rng(g), g.students[st.id], c.id); setMsg(r.text); sfx(r.ok ? 'pass' : 'cancel'); }); }}>{ok ? `受験 ${rate}%` : '条件未達'}</button>
                  </div>
                  <div class="checkline"><span class={st.level >= lv ? 'ok' : 'ng'}>{st.level >= lv ? '✓' : '×'}</span>{st.level >= lv ? `Lv${lv}以上（いま Lv${st.level}）` : `Lv${lv}から受験できます（あと${lv - st.level}）`}</div>
                  {Object.entries(c.req).map(([k, r]) => { const have = st.skills[k as SkillId] >= RANK_POINTS[r as Rank]; return <div class="checkline"><span class={have ? 'ok' : 'ng'}>{have ? '✓' : '×'}</span>{SKILL_NAMES[k as SkillId]} {r}{have ? '' : ' が必要'}（いま {rankOf(st.skills[k as SkillId])}）</div>; })}
                  {miss.filter((m) => !m.startsWith('Lv') && !m.includes('が必要（いま')).length > 0 && <div class="small" style={{ color: 'var(--accent)' }}>{miss.filter((m) => !m.startsWith('Lv') && !m.includes('が必要（いま')).join('／')}</div>}
                  <div class="small muted">{c.desc}{c.ability && ABILITIES[c.ability] ? `　スキル「${ABILITIES[c.ability].name}」：${ABILITIES[c.ability].desc}` : ''}</div>
                </div>
              );
            })}
            {!can && <div class="muted small" style={{ marginTop: 4 }}>今月はもう受験できません（または休み中）</div>}
          </MiniCard>
        );
      })}
      {!sorted.length && <div class="empty-note">次の兵種がある生徒はいません</div>}
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

function TalkArchive({ s, st }: { s: GameState; st: Student }) {
  const [open, setOpen] = useState<string | null>(null);
  const list = archiveOf(s, st).slice().reverse();
  return (
    <div class="card">
      <h3>会話の記録</h3>
      {!list.length && <div class="muted">まだ記録はありません（支援会話や面談をすると、ここで読み返せます）</div>}
      {list.map((t) => {
        const other = t.a === st.id ? t.b : t.a;
        const who = other === 'teacher' ? '先生' : s.students[other]?.given ?? '';
        const label = t.kind === 'interview' ? '面談' : t.kind === 'special' ? '特別な面談' : `支援${t.rank}`;
        return (
          <div style={{ borderTop: '1px dashed var(--line)', padding: '4px 0' }}>
            <div class="row between" style={{ cursor: 'pointer', minHeight: 40 }} onClick={() => { sfx('move'); setOpen(open === t.id ? null : t.id!); }}>
              <span class="grow"><span class="tag gray">{label}</span> {who}と「{t.title}」</span>
              <span class="muted small">{t.year}年目 {open === t.id ? '▲' : '▼'}</span>
            </div>
            {open === t.id && <TalkView s={s} t={t} />}
          </div>
        );
      })}
    </div>
  );
}
