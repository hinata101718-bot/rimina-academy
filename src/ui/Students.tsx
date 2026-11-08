import { Badge } from './Results';
import { BADGES } from '../data/evaluation';
import { useState } from 'preact/hooks';
import { useStore, navigate, act } from './store';
import { enrolled, effectiveStats } from '../core/game';
import { growthRates } from '../core/growth';
import { nextClasses, classUnlocked, meetsReq, passRate, canTakeExam, takeExam } from '../core/exam';
import { rng } from '../core/flow';
import { skillUnlocked } from '../core/week';
import { StuRow, Back, Bar, moodIcon, Sheet } from './common';
import { RankUpPlayer } from './RankUp';
import { careerTitleOnly, sidesFor } from '../core/discovery';
import { SIDES } from '../data/discovery';
import { StuCard, SecTitle, MoodDots, studentFlags, countryColor, LvBadge, ClassName, CountryChip, Chip, Gauge, FatigueBar, SkillBox, FaceRow, MiniCard, Num } from './cards';
import { Icon } from './icons';
import { examCandidates, missingReqs, levelReq } from '../core/exam';
import { OfficerFace, Portrait } from './Portrait';
import { SKILL_NAMES, STAT_NAMES, PERSONALITIES, TRAITS, TALENTS, DREAMS, COUNTRY_NAMES, HOUSE_NAMES } from '../data/people';
import { CLASSES } from '../data/classes';
import { ABILITIES } from '../data/abilities';
import { B, SKILLS, STATS, RANK_POINTS } from '../data/balance';
import { rankOf, nextRankPoints, MONTH_NAMES } from '../core/util';
import type { SkillId, Rank } from '../core/types';
import type { GameState, Student, RankUpItem } from '../core/state';
import { supportRank, archiveOf } from '../core/support';
import { TalkView } from './Talk';
import { titleOf } from '../core/alumni';
import { sfx } from './sound';
import { ensureSpellPlan, usableSpells } from '../core/spells';
import { WEAPONS } from '../data/weapons';
import { rivalriesOf, officerById, officerName, stageName, factionName, rankName } from '../core/officers';
import { FACTION_COLOR } from '../data/officers';
import { OfficerSheet } from './Officers';
import { ClassMods, ClassCompare, GrowthTable, ClassBook } from './ClassInfo';

export function StudentsTab() {
  const { s, route } = useStore();
  if (!s) return null;
  if (route.page === 'detail' && route.id && s.students[route.id]) return <Detail key={route.id} s={s} st={s.students[route.id]} sub={route.sub as DetailTab | undefined} />;
  if (route.page === 'exam' && route.id && s.students[route.id]) return <Detail s={s} st={s.students[route.id]} exam />;
  if (route.page === 'exam') return <ExamList s={s} />;
  if (route.page === 'classbook') return <ClassBook s={s} />;
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
      <SecTitle right={<span class="row nowrap gap4"><button class="btn small" onClick={() => navigate({ tab: 'students', page: 'classbook' })}><Icon name="book" size={16} /> 図鑑</button><button class="btn small" onClick={() => navigate({ tab: 'students', page: 'exam' })}><Icon name="exam" size={16} /> 兵種試験{exams.size ? `（${exams.size}）` : ''}</button></span>}>生徒名簿<span class="cnt">{enrolled(s).length}人</span></SecTitle>
      <div class="pills fit">
        {[[0, '全学年'], [1, '1年'], [2, '2年'], [3, '3年'], [9, '★気にかける']].map(([g, label]) => <button class={grade === g ? 'on' : ''} onClick={() => { sfx('move'); setGrade(g as number); }}>{label}</button>)}
      </div>
      <div class="row between" style={{ marginBottom: 4 }}>
        <select value={sort} onChange={(e) => setSort((e.target as HTMLSelectElement).value as typeof sort)}><option value="grade">学年順</option><option value="level">レベル順</option><option value="mood">やる気の低い順</option></select>
        <div class="seg" style={{ width: 150 }}>
          <button class={view === 'card' ? 'on' : ''} onClick={() => act((g) => { g.settings.rosterView = 'card'; })}>カード</button>
          <button class={view === 'compact' ? 'on' : ''} onClick={() => act((g) => { g.settings.rosterView = 'compact'; })}>簡易</button>
        </div>
      </div>
      {view === 'card'
        ? list.map((st) => <StuCard s={s} st={st} exams={exams} />)
        : <div class="notebook compact">{list.map((st) => <div class="nb-row" style={{ ['--band' as string]: countryColor(st.origin) }}><span class="nb-seal" aria-hidden="true" /><StuRow st={st} right={<span class="compright">{s.pinned.includes(st.id) && <span class="pinstar"><Icon name="star" size={16} /></span>}{studentFlags(s, st, exams).slice(0, 1).map((f) => <span class={`flag ${f.tone}`}>{f.text}</span>)}<MoodDots m={st.motivation} /></span>} /></div>)}</div>}
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

/** 卒業生の昇進・兵種昇格：個人ページを開いたとき、前に見たときから変わっていれば演出する */
function promotionItems(st: Student): RankUpItem[] {
  if (st.status !== 'graduated' || !st.career || st.seenTitle === undefined) return [];
  const out: RankUpItem[] = [];
  const t = careerTitleOnly(titleOf(st));
  if (st.seenTitle !== t) out.push({ icon: 'crown', title: `${st.given}の役職`, from: st.seenTitle || '—', to: t, p0: 0.2, p1: 1, studentId: st.id, note: '昇進！' });
  if (st.seenClass && st.seenClass !== st.classId) out.push({ icon: 'exam', title: `${st.given}の兵種`, from: CLASSES[st.seenClass]?.name ?? '', to: CLASSES[st.classId]?.name ?? '', p0: 0.4, p1: 1, studentId: st.id, note: '兵種昇格！' });
  return out;
}

function Detail({ s, st, exam, sub }: { s: GameState; st: Student; exam?: boolean; sub?: DetailTab }) {
  const [tab, setTab0] = useState<DetailTab>(sub ?? s.settings.detailTab ?? 'stats');
  const setTab = (x: DetailTab) => { sfx('move'); setTab0(x); act((g) => { g.settings.detailTab = x; }, true); };
  const [examOpen, setExamOpen] = useState(!!exam);
  const examReady = !st.status || st.status === 'enrolled' ? nextClasses(s, st).some((c) => classUnlocked(s, c) && meetsReq(st, c)) && canTakeExam(s, st) : false;
  const promo = promotionItems(st);
  const markSeen = () => act((g) => { const x = g.students[st.id]; if (x) { x.seenTitle = careerTitleOnly(titleOf(x)); x.seenClass = x.classId; } });
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
      {examOpen && <ExamSheet s={s} st={st} onClose={() => setExamOpen(false)} />}
      {promo.length > 0 && <Sheet><RankUpPlayer s={s} items={promo} title="卒業生の昇進" onDone={markSeen} /></Sheet>}
      <Back to={() => history.length && navigate(grad ? { tab: 'yearbook' } : { tab: 'students' })} />
      <div class="pcard" style={{ ['--band' as string]: color }}>
        <div class="hero">
          <div class="hero-face"><Portrait st={st} size={96} frame={color} /><LvBadge lv={st.level} big /></div>
          <div class="grow" style={{ minWidth: 0 }}>
            <NameLineBig st={st} />
            <div class="row gap4" style={{ marginTop: 2 }}><ClassName classId={st.classId} size={16} /><CountryChip o={st.origin} /><Chip>{PERSONALITIES[st.personality].name}</Chip></div>
            <div class="muted small" style={{ marginTop: 2 }}>{st.age}歳・{st.gender === 'm' ? '男性' : '女性'}・{grad ? `${st.cohort}期生` : `${st.grade}年生`}・{HOUSE_NAMES[st.house]}</div>
            <div class="row nowrap gap6" style={{ marginTop: 4 }}><span class="small muted dt-gl">HP</span><Gauge v={es.hp} max={capHp} tone="main" /><span class="small muted">{es.hp}</span></div>
            <div class="row nowrap gap6" style={{ marginTop: 2 }}><span class="small muted dt-gl">EXP</span><Gauge v={st.exp} max={B.student.expPerLevel} tone="exp" /><span class="small muted">{st.exp}/100</span></div>
            {grad && <div style={{ marginTop: 4 }}><b>{st.status === 'dropped' ? '退学' : st.status === 'dead' ? `在学中に戦死（${st.diedYear}年目）` : titleOf(st)}</b></div>}
            {flags.length > 0 && <div class="row gap4" style={{ marginTop: 4 }}>{flags.map((f) => <span class={`flag ${f.tone}`}>{f.text}</span>)}</div>}
          </div>
        </div>
        {!grad && (
          <div class="row" style={{ marginTop: 8 }}>
            <button class="btn small" onClick={() => act((g) => { g.pinned = pinned ? g.pinned.filter((x) => x !== st.id) : [...g.pinned, st.id].slice(-5); })}><span class={pinned ? 'pinstar' : ''}><Icon name="star" size={16} /></span> {pinned ? '気にかけるをやめる' : '気にかける'}</button>
            {nextClasses(s, st).length > 0 && <button class={`btn small${examReady ? ' primary glow' : ''}`} onClick={() => { sfx('move'); setExamOpen(true); }}><Icon name="exam" size={16} /> 兵種試験を受ける{examReady ? '（受験できます）' : ''}</button>}
          </div>
        )}
      </div>
      <div class="dt-tabs" role="tablist">
        {DETAIL_TABS.map(([k, label]) => <button role="tab" class={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{label}</button>)}
      </div>
      <div class="dt-body">
      {tab === 'stats' && <>
          <div class="card">
            <div class="row between nowrap"><h3 style={{ margin: 0 }}>能力</h3><span class="small muted">合計成長率 <b class="dt-total">{st.growthKnown ? `${STATS.reduce((x, k) => x + gr[k], 0)}%` : '？'}</b></span></div>
            <div class="statlist">
              <div class="statrow sr-head"><span /><b /><span class="bonus">兵種</span><span class="small muted">（{cls.name}）</span><span class="gr">成長率</span></div>
              {STATS.map((k) => {
                const b = es[k] - st.stats[k];
                const g = (cls.growth as Partial<Record<string, number>>)[k] ?? 0;
                return <div class="statrow"><span>{STAT_NAMES[k]}</span><b>{es[k]}</b><span class={`bonus ${b > 0 ? 'up' : b < 0 ? 'down' : ''}`}>{b ? `${b > 0 ? '+' : '−'}${Math.abs(b)}` : ''}</span><Gauge v={es[k]} max={k === 'hp' ? capHp : cap} thin /><span class={`gr total ${g > 0 ? 'up' : g < 0 ? 'down' : ''}`}>{st.growthKnown ? `${gr[k]}%` : g ? `？${g > 0 ? '+' : '−'}${Math.abs(g)}` : '？'}</span></div>;
              })}
            </div>
            <div class="small muted">成長率＝レベルアップでその能力が上がる見込み（本人＋兵種＋才能・特徴。内わけは下の「内わけを見る」）</div>
            <ClassMods c={cls} />
            {!grad && (
              <div class="traingrid">
                <div class="small"><b>鍛錬ゲージ</b><span class="muted">（授業でたまり、満タンで+1。顔が出ている授業ほど早くたまる）</span></div>
                {STATS.map((k) => (
                  <div class="trainrow"><span class="small">{STAT_NAMES[k]}</span><span class="ggauge train grow"><span style={{ width: `${Math.round(st.train?.[k] ?? 0)}%` }} /></span><span class="small muted">{(st.trainGain?.[k] ?? 0) > 0 ? `+${st.trainGain![k]}` : ''}</span></div>
                ))}
              </div>
            )}
            {cls.ability && ABILITIES[cls.ability] && <div class="small ruled">兵種スキル：<b>{ABILITIES[cls.ability].name}</b>（{ABILITIES[cls.ability].desc}）</div>}
          </div>
          <details class="card dt-fold">
            <summary><b>成長率の内わけを見る</b><span class="small muted">（本人＋兵種＋才能・特徴）</span></summary>
            <GrowthTable s={s} st={st} />
          </details>
      </>}
      {tab === 'skills' && <>
          <div class="card">
            <h3>技能ランク</h3>
            <div class="skillgrid">{SKILLS.filter((k) => skillUnlocked(s, k)).map((k) => <SkillBox k={k} p={st.skills[k]} target={!grad && st.targets.includes(k)} />)}</div>
            {!grad && (
              <div style={{ marginTop: 8 }}>
                <div class="muted small">今月の目標技能（2つ・金の枠）：目標の授業でさらに伸びます（1つ目は×1.3）。月に一度決めます。夢に沿うとやる気が上がりやすい（夢に沿う技能：{dream.skills.map((k) => SKILL_NAMES[k]).join('・') || 'なし'}）</div>
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
          {cls.ability && ABILITIES[cls.ability] && <div class="card"><h3>兵種スキル</h3><div><b>{ABILITIES[cls.ability].name}</b>：{ABILITIES[cls.ability].desc}</div></div>}
      </>}
      {tab === 'person' && <>
          {!grad && (
            <div class="card">
              <h3>状態</h3>
              <div class="statgrid">
                <div class="row nowrap gap6"><span class="small" style={{ width: 52 }}>やる気</span><MoodDots m={st.motivation} /><span class="small muted">{B.motivationLabel[st.motivation]}</span></div>
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
          {st.status === 'enrolled' && <DiscoverCard st={st} />}
      </>}
      {tab === 'bonds' && <>
          <div class="card">
            <h3>仲間との支援</h3>
            {supList.length === 0 && <div class="muted">まだ特に親しい仲間はいない</div>}
            <FaceRow list={supList.map(({ sp, o }) => ({ st: o, label: `${supportRank(sp.value) ? `支援${supportRank(sp.value)}` : ''}${sp.kind !== 'none' ? { friend: '・友情', rival: '・好敵手', love: '・想い' }[sp.kind] : ''}` }))} />
          </div>
          <RivalCard s={s} st={st} />
          <TalkArchive s={s} st={st} />
      </>}
      {tab === 'record' && <>
          <div class="card">
            <h3>記録</h3>
            <div class="infogrid"><div><Icon name="battle" size={16} />出撃 <Num v={st.battles} /></div><div><Icon name="skull" size={16} />撃破 <Num v={st.kills} /></div><div><Icon name="bell" size={16} />重傷 <Num v={st.wounds ?? 0} /></div><div><Icon name="medal" size={16} />講評の最高 <Num v={st.bestGrade ?? '—'} /></div>{st.keepsake && <div><Icon name="sword" size={16} />{st.keepsake}</div>}</div>
            {st.farewell && <div class="serif ruled">卒業式のひとこと：「{st.farewell}」</div>}
            {st.history.length > 0 && <ul class="list">{st.history.slice(-15).map((h) => <li class="small">{h.year}年目：{h.text}</li>)}</ul>}
            {st.deathNote && <div class="muted">{st.diedYear}年目：{st.deathNote}</div>}
          </div>
          <HonorCard st={st} />
      </>}
      </div>
    </div>
  );
}

type DetailTab = 'stats' | 'skills' | 'person' | 'bonds' | 'record';
const DETAIL_TABS: [DetailTab, string][] = [['stats', '能力'], ['skills', '技能'], ['person', '人柄'], ['bonds', '関係'], ['record', '記録']];

/** これまでの評価と称号（9夜目） */
function HonorCard({ st }: { st: Student }) {
  const honors = Object.entries(st.honors ?? {}).filter(([k]) => k !== 'quiet').sort((a, b) => b[1] - a[1]);
  return (
    <div class="card">
      <h3>これまでの評価と称号</h3>
      {honors.length ? <div class="ev-badges">{honors.map(([k, n]) => <span class="row nowrap gap4"><Badge id={k} />{n > 1 && <small class="muted">×{n}</small>}</span>)}</div> : <div class="muted small">まだない（出撃すると、戦いのあとに称号がつく）</div>}
      {(st.evalLog ?? []).length > 0 && <ul class="list" style={{ marginTop: 6 }}>{[...(st.evalLog ?? [])].reverse().slice(0, 8).map((e) => <li class="small">{e.year}年目 {MONTH_NAMES[e.month]}「{e.title}」<span class={`ev-grade g${e.grade}`}>{e.grade}</span> {e.badges.filter((x) => x !== 'quiet').map((x) => BADGES[x]?.name).join('・')}{e.scene ? <div class="muted">{e.scene}</div> : null}</li>)}</ul>}
    </div>
  );
}

/** 分かったこと（6夜目）：まだ見えていない項目は「？」のまま残り、埋まっていく */
function DiscoverCard({ st }: { st: Student }) {
  const sides = sidesFor(st);
  const found = (st.sides ?? []).map((id) => SIDES.find((d) => d.id === id)).filter(Boolean);
  const talentStage = !st.talent ? (st.talentReveal >= 100 ? 3 : st.talentReveal >= B.talent.hint1 ? 1 : 0) : st.talentReveal >= B.talent.full ? 3 : st.talentReveal >= B.talent.hint2 ? 2 : st.talentReveal >= B.talent.hint1 ? 1 : 0;
  const total = st.traits.length + 3 + 1 + sides.length;
  const got = st.knownTraits.length + talentStage + (st.growthKnown ? 1 : 0) + found.length;
  return (
    <div class="card">
      <h3>分かったこと <span class="small muted">{got}／{total}</span></h3>
      <div class="dc-meter"><span style={{ width: `${Math.round((got / Math.max(1, total)) * 100)}%` }} /></div>
      <div class="dc-row"><span class="dc-lab">特徴</span>{st.traits.map((t) => st.knownTraits.includes(t) ? <Chip tone="main">{TRAITS[t].name}</Chip> : <span class="dc-q">？</span>)}</div>
      <div class="dc-row"><span class="dc-lab">才能</span>{[1, 2, 3].map((n) => <span class={`dc-step${n <= talentStage ? ' on' : ''}`}>{n === 3 ? '判明' : `ヒント${n}`}</span>)}<span class="small">{talentStage ? talentText(st) : ''}</span></div>
      <div class="dc-row"><span class="dc-lab">成長の傾向</span>{st.growthKnown ? <Chip tone="main">分かった</Chip> : <span class="dc-q">？</span>}</div>
      <div class="dc-row"><span class="dc-lab">意外な一面</span>{found.map((d) => <Chip tone="gold">{d!.label}</Chip>)}{sides.slice(found.length).map(() => <span class="dc-q">？</span>)}</div>
    </div>
  );
}

/** 宿敵の欄（6夜目）：因縁のある敵将の顔・二つ名・戦った回数・結果 */
function RivalCard({ s, st }: { s: GameState; st: Student }) {
  const list = rivalriesOf(s, st.id).map((rv) => ({ rv, o: officerById(s, rv.oid) })).filter((x) => x.o);
  const [open, setOpen] = useState<string | null>(null);
  const sel = open ? officerById(s, open) : null;
  return (
    <div class="card">
      <h3>宿敵</h3>
      {!list.length && <div class="muted small">まだいない。同じ敵将と何度も戦うと、因縁が生まれる。</div>}
      {list.map(({ rv, o }) => (
        <div class="row nowrap gap8 ruled tap" style={{ minHeight: 52 }} onClick={() => setOpen(o!.id)}>
          <OfficerFace o={o} size={48} frame={FACTION_COLOR[o!.faction]} s={s} />
          <div class="grow" style={{ minWidth: 0 }}>
            <div class="row nowrap gap6"><b class="serif ofc-name" style={{ fontSize: 15 }}>{officerName(o!)}</b><span class={`flag ${rv.settled ? '' : 'red'}`}>{rv.settled ? '決着' : rv.vow ? '仇討ちの誓い' : stageName(rv.stage)}</span></div>
            <div class="small muted">{o!.kind === 'monster' ? '魔物' : `${factionName(o!.faction)}・${rankName(o!)}`}・戦った回数 {rv.battles}回</div>
            <div class="small">{rv.settled ? SETTLE_NAMES[rv.settled] : rv.vow && s.students[rv.vow] ? `${s.students[rv.vow].given}の仇` : o!.status !== 'active' ? (o!.endNote ?? '戦場を去った') : (rv.log[rv.log.length - 1]?.text ?? '')}</div>
          </div>
        </div>
      ))}
      {sel && <OfficerSheet s={s} o={sel} onClose={() => setOpen(null)} />}
    </div>
  );
}
const SETTLE_NAMES = { persuade: '説き伏せて、剣を置かせた', duel: '一騎打ちで破った', kill: '討ち取った', spare: '見逃した' };

function NameLineBig({ st }: { st: Student }) {
  const len = st.given.length;
  return <div class="nameline"><b class="given" style={{ fontSize: len >= 9 ? 18 : len >= 7 ? 21 : 24 }}>{st.given}</b><span class="family">{st.family}</span></div>;
}

const TIER_NAMES = ['見習い', '初級', '中級', '上級', '最上級'];

/** 兵種試験の入口（8夜目：受けられる子だけを並べ、個人ページの受験へ） */
function ExamList({ s }: { s: GameState }) {
  const ready = examCandidates(s);
  const later = enrolled(s).filter((st) => !ready.includes(st) && nextClasses(s, st).length);
  return (
    <div>
      <Back to={() => navigate({ tab: 'students' })} />
      <SecTitle>兵種試験<span class="cnt">受けられる生徒 {ready.length}人</span></SecTitle>
      <div class="muted small">兵種試験は、その子の個人ページの「兵種試験を受ける」から受けます。Lvと技能ランクの条件を満たしていれば、必ず合格します。受験のレベル：初級 Lv{B.exam.levelReq[1]}・中級 Lv{B.exam.levelReq[2]}・上級 Lv{B.exam.levelReq[3]}（最上級は卒業後 Lv{B.exam.levelReq[4]}）。</div>
      {ready.map((st) => <MiniCard st={st} sub={`${st.grade}年・${TIER_NAMES[CLASSES[st.classId].tier]}`} right={<button class="btn small primary" onClick={() => { sfx('move'); navigate({ tab: 'students', page: 'exam', id: st.id }); }}>受験へ</button>} />)}
      {!ready.length && <div class="empty-note">今すぐ受けられる生徒はいません</div>}
      {later.length > 0 && <div class="small muted" style={{ marginTop: 8 }}>もう少しで受けられる子：{later.slice(0, 12).map((st) => st.given).join('・')}（個人ページで足りない条件が見られます）</div>}
    </div>
  );
}

/** 個人ページの兵種試験（8夜目）：その子が受けられる兵種だけ。補正の比べ・足りない条件・使える武器とスキル */
function ExamSheet({ s, st, onClose }: { s: GameState; st: Student; onClose: () => void }) {
  const [msg, setMsg] = useState('');
  const opts = nextClasses(s, st);
  const can = canTakeExam(s, st);
  return (
    <Sheet title={`${st.given}の兵種試験`} onClose={onClose}>
      <div class="small muted">今の兵種：<b>{CLASSES[st.classId].name}</b>（Lv{st.level}）。条件を満たしていれば、必ず合格します。</div>
      {msg && <div class="guide">{msg}</div>}
      {opts.map((c) => {
        const ok = classUnlocked(s, c) && meetsReq(st, c);
        const miss = missingReqs(s, st, c);
        return (
          <div class="pcard" style={{ ['--band' as string]: ok ? 'var(--good)' : '#cfc6b2', margin: '8px 0 0' }}>
            <div class="row between nowrap">
              <div class="grow"><ClassName classId={c.id} size={17} /> <span class="muted small">{TIER_NAMES[c.tier]}</span></div>
              {ok ? <span class="flag" style={{ background: 'var(--good)' }}>条件を満たしています</span> : <span class="flag gray-flag">条件が足りない</span>}
            </div>
            {!ok && <div class="small" style={{ color: 'var(--accent)' }}>{miss.join('／')}</div>}
            <div class="small muted">{c.desc}</div>
            <div class="small" style={{ marginTop: 4 }}><b>{CLASSES[st.classId].name} → {c.name}</b>に変わると</div>
            <ClassCompare from={CLASSES[st.classId]} to={c} />
            <div class="small muted">「いるあいだ」の補正は入れ替わり、伸びやすさで伸びた分は残ります。</div>
            <button class={`btn block${ok && can ? ' primary' : ''}`} style={{ marginTop: 6 }} disabled={!ok || !can} onClick={() => { act((g) => { const r = takeExam(g, rng(g), g.students[st.id], c.id); setMsg(r.text); sfx(r.ok ? 'pass' : 'cancel'); }); }}>{ok ? `${c.name}になる` : '条件が足りない'}</button>
          </div>
        );
      })}
      {!opts.length && <div class="empty-note">次の兵種はありません</div>}
      {!can && <div class="muted small" style={{ marginTop: 4 }}>けがで休んでいるあいだは受けられません</div>}
    </Sheet>
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
