import { useState } from 'preact/hooks';
import { officerById, officerName } from '../core/officers';
import { FACTION_COLOR } from '../data/officers';
import { OfficerFace } from './Portrait';
import { useStore, act, navigate } from './store';
import { Sheet, StuRow, money, HelpTip } from './common';
import { Portrait, faceImageFor } from './Portrait';
import { GrowthPlayer } from './Growth';
import { ScenePlayer } from './Scene';
import { retireInstructor, successorCandidates, askSuccessor, externalSuccessor } from '../core/instructor';
import { rng } from '../core/flow';
import { TeacherFace } from './Talk';
import { continueSchool, buildHallEntry, endingTitle, ENDING_NAMES, ENDING_SUB } from '../core/ending';
import { addHall, unlockStarts, saveSlot } from './storage';
import { setGame } from './store';
import type { CountryId } from '../core/types';
import type { EndingKind } from '../core/state';
import { titleOf } from '../core/alumni';
import { ArtSlot } from './HomeDeco';
import { TalkPlayer } from './Talk';
import { chooseReply } from '../core/interview';
import { usableSpells } from '../core/spells';
import type { GameState, TalkLog, Student, GrowthEntry } from '../core/state';
import { enrolled, available, deployLimit, capacity } from '../core/game';
import { startBattle, admit, autoAdmitIds, finishCareers, acceptVassal } from '../core/flow';
import { autoDeploy, canEquip } from '../core/autoplay';
import { OBJECTIVE_NAMES, WEATHER_NAMES } from '../core/quests';
import { hopes, availableChoices, CHOICE_NAMES, acceptRate, suitablePath, autoRecommend, type CareerChoice } from '../core/career';
import { WEAPONS } from '../data/weapons';
import { CLASSES } from '../data/classes';
import { COUNTRY_SHORT, PERSONALITIES, DREAMS, COUNTRY_NAMES, HOUSE_NAMES, TRAITS, PATH_NAMES, PATH_SAY, STAT_NAMES } from '../data/people';
import { STATS, B } from '../data/balance';
import type { Path } from '../core/types';
import type { Deploy } from '../core/battle/setup';
import { sfx } from './sound';
import { AutoResultHead } from './AutoBattle';
import { SortiePrep } from './Sortie';
import { BattleResult, SortieResult, NewStratView } from './Results';
import { RankUpPlayer, DiscoveryView } from './RankUp';
import { LessonResultView } from './Lessons';
import { Icon } from './icons';
import { countryColor, CountryChip, Chip, Stars, Num, LvBadge, MiniCard, NameLine, OBJECTIVE_ICON, WEATHER_ICON } from './cards';
import { rankOf } from '../core/util';
import { SKILL_NAMES } from '../data/people';
import { SKILLS } from '../data/balance';
import { BloomView } from './Bloom';
import { ArtLearnView } from './Arts';
import { GuideTipView } from './Guide';
import { ReviewPlayer } from './Review';
import { LegendView } from './Legend';

export function PendingView() {
  const { s } = useStore();
  if (!s || !s.pending.length) return null;
  const p = s.pending[0];
  const done = () => act((g) => { g.pending.shift(); });
  switch (p.type) {
    case 'weekSummary': return <WeekSummary lines={p.lines} talks={p.talks} growth={p.growth} onDone={done} />;
    case 'lessonResult': return <Sheet><LessonResultView key={`${p.day}${p.lesson}${s.absWeek}`} s={s} p={p} onDone={done} /></Sheet>;
    case 'talk': return <Sheet title={p.talk.kind === 'support' || !p.talk.kind ? '支援会話' : '面談'}><TalkPlayer s={s} t={p.talk} onDone={done} onChoice={(k) => act((g) => chooseReply(g, p.talk, k))} /></Sheet>;
    case 'yearReview': { const rv = (s.reviews ?? []).find((x) => x.year === p.year); if (!rv) { done(); return null; } return <ReviewPlayer key={`rv${p.year}`} s={s} rv={rv} onDone={done} />; }
    case 'legend': return <LegendView key={`lg${p.id}`} s={s} id={p.id} onDone={done} />;
    case 'guide': return <GuideTipView key={p.key} title={p.title} lines={p.lines} onDone={done} />;
    case 'event': return <Sheet title={p.title}><div class="paper">{p.lines.map((l) => <p>{l}</p>)}</div><button class="btn primary block" style={{ marginTop: 10 }} onClick={done}>閉じる</button></Sheet>;
    case 'battleResult': return <BattleResult key={`${p.title}${s.pending.length}`} s={s} p={p} onDone={done} />;
    case 'sortieResult': return <SortieResult key={`sr${s.pending.length}`} s={s} reports={p.reports} onDone={done} />;
    case 'newStrat': return <Sheet><NewStratView key={p.id} s={s} p={p} onDone={done} /></Sheet>;
    case 'questBoard': return <QuestBoard s={s} />;
    case 'entrance': return <Entrance s={s} />;
    case 'career': return <Career s={s} />;
    case 'graduation': return <Graduation s={s} cohort={p.cohort} lines={p.lines} onDone={done} />;
    case 'ending': return <EndingChoice s={s} kind={p.kind} country={p.country} />;
    case 'retire': return <Retire s={s} forced={p.forced} />;
    case 'successor': return <Successor s={s} />;
    case 'scene': return <Sheet title={p.title}><ScenePlayer key={p.title} s={s} lines={p.lines} onDone={done} /></Sheet>;
    case 'rankup': return <Sheet><RankUpPlayer key={s.pending.length} s={s} items={p.items} onDone={done} /></Sheet>;
    case 'art': return <Sheet><ArtLearnView key={`art${p.studentId}${p.ids[0]}`} s={s} p={p} onDone={done} /></Sheet>;
    case 'bloom': return <BloomView key={`bl${p.studentId}`} s={s} p={p} onDone={done} />;
    case 'discovery': return <Sheet><DiscoveryView key={`${p.studentId}${p.stage}${s.pending.length}`} s={s} p={p} onDone={done} /></Sheet>;
    case 'vassalOffer': return (
      <Sheet title="傘下への誘い">
        <div class="serif">{COUNTRY_NAMES[p.country]}の使者が来た。「貴校と我が国の縁は深い。我が国の傘下に入れば、十分な援助を約束しよう」</div>
        <ul class="small" style={{ paddingLeft: '1.2em' }}><li>受けると：{COUNTRY_SHORT[p.country]}からの援助金が増え、{COUNTRY_SHORT[p.country]}出身の志願者も増えます。そのかわり、ほかの二国とは仲が悪くなり、声もかかりにくくなります。中立宣言と和平の円卓は、独立するまで届きません</li><li>断ると：今までどおり、どの国にも属さない学校のままです</li><li>傘下に入っても、評判が{B.school.independenceRep}になれば、年度末に独立を取り戻せます</li></ul>
        <div class="row nowrap gap8"><button class="btn block grow" onClick={() => { sfx('ok'); act((g) => acceptVassal(g, p.country)); }}>誘いを受ける</button><button class="btn primary block grow" onClick={done}>丁重に断る</button></div>
      </Sheet>
    );
    case 'newspaper': return <Sheet title={s.news.find((n) => n.id === p.id)?.kind === 'extra' ? '号外が出ました' : '新聞が届きました'}><NewsView id={p.id} /><button class="btn primary block" style={{ marginTop: 10 }} onClick={done}>閉じる</button></Sheet>;
    default: return <Sheet title="お知らせ"><button class="btn primary block" onClick={done}>閉じる</button></Sheet>;
  }
}

/** まとめの1行に合う線画アイコン */
export function lineIcon(l: string): string {
  if (l.startsWith('個人指導')) return 'students';
  if (l.startsWith('面談') || l.startsWith('相談') || l.includes('語り合った')) return 'talk';
  if (l.startsWith('週末')) return 'heart';
  if (l.includes('覚えた')) return 'tome';
  if (l.includes('Lv') || l.includes('に上がった')) return 'star';
  if (l.includes('体調') || l.includes('けが') || l.includes('去') || l.includes('やる気')) return 'bell';
  if (l.includes('才能') || l.includes('特徴') || l.includes('傾向')) return 'lantern';
  if (l.includes('誕生日')) return 'cake';
  if (l.includes('教官') || l.includes('先生')) return 'lesson';
  return 'scroll';
}

function talkCountLabel(talks: TalkLog[]): string {
  const sup = talks.filter((t) => t.kind === 'support' || !t.kind).length;
  const iv = talks.length - sup;
  return [sup ? `支援会話${sup}件` : '', iv ? `面談${iv}件` : ''].filter(Boolean).join('・');
}

function WeekSummary({ lines, talks, growth, onDone }: { lines: string[]; talks: TalkLog[]; growth?: GrowthEntry[]; onDone: () => void }) {
  const { s } = useStore();
  const [g, setG] = useState(growth?.length ? 0 : 1);
  const [i, setI] = useState(-1);
  if (!s) return null;
  if (g === 0) return <Sheet title="今週の成長"><GrowthPlayer s={s} entries={growth ?? []} title="伸びた子" onDone={() => setG(1)} /></Sheet>;
  if (i >= 0 && i < talks.length) {
    const t = talks[i];
    return <Sheet title={`${t.kind === 'support' || !t.kind ? '支援会話' : t.kind === 'special' ? '特別な面談' : '面談'}（${i + 1}／${talks.length}）`}><TalkPlayer key={i} s={s} t={t} onDone={() => setI(i + 1)} onChoice={(k) => act((g) => chooseReply(g, t, k))} /></Sheet>;
  }
  return (
    <Sheet title="今週のまとめ">
      <div class="pcard"><ul class="list sumlist">{lines.map((l) => <li><span class="todoicon"><Icon name={lineIcon(l)} size={16} /></span><span>{l}</span></li>)}</ul></div>
      {talks.length > 0 && i < 0 && <button class="btn accent block" style={{ marginTop: 8 }} onClick={() => setI(0)}>会話を見る（{talkCountLabel(talks)}）</button>}
      {talks.length > 0 && i >= talks.length && <div class="muted small" style={{ marginTop: 6 }}>会話は、その子の個人ページの「会話の記録」で読み返せます。</div>}
      <button class="btn primary block" style={{ marginTop: 8 }} onClick={() => { sfx('ok'); onDone(); }}>閉じる</button>
    </Sheet>
  );
}

const TYPE_SKILL: Record<string, string> = { sword: 'sword', lance: 'lance', axe: 'axe', bow: 'bow', magic: 'magic', holy: 'faith', staff: 'faith', gun: 'gun' };

function QuestBoard({ s }: { s: GameState }) {
  return <SortiePrep key={`${s.year}-${s.month}`} s={s} />;
}

function ApplicantCard({ st, on, toggle }: { st: Student; on: boolean; toggle: () => void }) {
  const d = DREAMS.find((x) => x.id === st.dream)!;
  const color = countryColor(st.origin);
  const top = SKILLS.filter((k) => st.skills[k] > 0).sort((a, b) => st.skills[b] - st.skills[a]).slice(0, 3);
  return (
    <div class={`pcard tap${on ? ' sel' : ''}`} style={{ ['--band' as string]: color }} onClick={toggle}>
      <div class="row nowrap gap8" style={{ alignItems: 'flex-start' }}>
        <Portrait st={st} size={64} frame={color} />
        <div class="grow">
          <div class="row nowrap between"><NameLine st={st} size={18} /><span class={`checkbox${on ? ' on' : ''}`}>{on ? '✓' : ''}</span></div>
          <div class="row gap4"><CountryChip o={st.origin} /><Chip>{HOUSE_NAMES[st.house]}</Chip><Chip>{PERSONALITIES[st.personality].name}</Chip><span class="small muted">{st.age}歳</span>{st.parents.length > 0 && <Chip tone="gold">卒業生の子</Chip>}</div>
          <div class="small muted" style={{ marginTop: 2 }}>夢：{d.name}</div>
        </div>
      </div>
      <div class="appstats">{STATS.map((k) => <div><span>{STAT_NAMES[k]}</span><b>{st.stats[k]}</b></div>)}</div>
      <div class="row gap4 small">{top.map((k) => <Chip tone="main">{SKILL_NAMES[k]} {rankOf(st.skills[k])}</Chip>)}{st.knownTraits.map((t) => <Chip>{TRAITS[t].name}</Chip>)}</div>
    </div>
  );
}

function Entrance({ s }: { s: GameState }) {
  const cap = capacity(s);
  const [sel, setSel] = useState<string[]>(() => autoAdmitIds(s));
  return (
    <Sheet title={`${s.year}年目 入学試験`}>
      <ArtSlot name="event_entrance" />
      <div class="muted">志願者は{s.applicants.length}人です。{cap}人まで合格にできます（いま{sel.length}人を選んでいます）。</div>
      {s.applicants.map((a) => <ApplicantCard st={a} on={sel.includes(a.id)} toggle={() => setSel(sel.includes(a.id) ? sel.filter((x) => x !== a.id) : sel.length < cap ? [...sel, a.id] : sel)} />)}
      <button class="btn primary block" disabled={!sel.length} onClick={() => { sfx('graduation'); act((g) => admit(g, sel)); }}>この{sel.length}人を合格にする</button>
    </Sheet>
  );
}

function Career({ s }: { s: GameState }) {
  const third = enrolled(s).filter((x) => x.grade === 3);
  const [plans, setPlans] = useState(() => third.map((st) => ({ studentId: st.id, recommend: autoRecommend(s, st), path: suitablePath(st) })));
  return (
    <Sheet title="進路の決定">
      <div class="muted small">推薦と本人の希望が同じなら、やる気いっぱいで巣立っていきます。<HelpTip text="進路は、各国からの声かけ、本人の希望、先生の推薦の3つで決まります。推薦と希望がちがうときは、先生への信頼が高い子ほど推薦を受け入れます。そのときは、少し不満が残ります。" /></div>
      {third.map((st, i) => {
        const h = hopes(s, st).filter((x) => availableChoices(st).includes(x));
        return (
          <div class="card">
            <StuRow st={st} onClick={() => undefined} sub={`信頼${Math.round(st.trust)}　推薦を聞いてくれる見込み${Math.round(acceptRate(st, s))}%`} />
            <div class="small">声かけ：{st.offers.length ? st.offers.map((c) => COUNTRY_SHORT[c]).join('・') : 'なし'}</div>
            <div class="small">本人の希望：{h.slice(0, 3).map((x) => CHOICE_NAMES[x]).join(' ＞ ')}</div>
            <div class="row">推薦：
              <select value={plans[i].recommend} onChange={(e) => { const np = [...plans]; np[i] = { ...np[i], recommend: (e.target as HTMLSelectElement).value as CareerChoice }; setPlans(np); }}>
                {availableChoices(st).map((c) => <option value={c}>{CHOICE_NAMES[c]}{c === h[0] ? '（希望）' : ''}</option>)}
              </select>
              道：<select value={plans[i].path} onChange={(e) => { const np = [...plans]; np[i] = { ...np[i], path: (e.target as HTMLSelectElement).value as Path }; setPlans(np); }}>
                {(['warrior', 'strategist', 'champion', 'civil'] as Path[]).map((p) => <option value={p}>{PATH_NAMES[p]}{p === suitablePath(st) ? '（向いている）' : ''}</option>)}
              </select>
            </div>
          </div>
        );
      })}
      <button class="btn primary block" onClick={() => { sfx('graduation'); act((g) => finishCareers(g, plans)); }}>卒業式へ</button>
    </Sheet>
  );
}

function Graduation({ s, cohort, lines, onDone }: { s: GameState; cohort: number; lines: { id: string; text: string }[]; onDone: () => void }) {
  const [i, setI] = useState(0);
  const photo = s.photos.find((p) => p.cohort === cohort);
  if (i < lines.length) {
    const st = s.students[lines[i].id];
    return (
      <Sheet title={`${cohort}期生 卒業式`}>
        {i === 0 && <ArtSlot name="event_graduation" />}
        <div style={{ textAlign: 'center' }}><Portrait st={st} size={96} /></div>
        <h2 style={{ textAlign: 'center' }}>{st.given} {st.family}</h2>
        <div style={{ textAlign: 'center' }} class="muted">{st.career ? `${st.career.kind === 'army' ? `${COUNTRY_SHORT[st.career.country!]}の軍・${PATH_NAMES[st.career.path]}` : { stay: '学校に残る', home: '故郷に帰る', merc: '流れの傭兵', army: '' }[st.career.kind]}` : ''}</div>
        {st.career && st.career.kind !== 'stay' && <div class="small" style={{ textAlign: 'center', color: '#6a4a18' }}>この子は――{PATH_SAY[st.career.path]}</div>}
        <div class="card serif" style={{ fontSize: 16 }}>「{lines[i].text}」</div>
        <button class="btn primary block" onClick={() => { sfx('ok'); setI(i + 1); }}>{i + 1 < lines.length ? '次の卒業生' : '卒業写真へ'}</button>
      </Sheet>
    );
  }
  return (
    <Sheet title={`${cohort}期生 卒業写真`}>
      {photo && <div class="photo">
        {photo.ids.map((id) => s.students[id]).filter(Boolean).map((st) => <div class="seat"><Portrait st={st} size={52} /><div>{st.given}</div></div>)}
        {photo.empty.map((id) => s.students[id]).filter(Boolean).map((st) => <div class="seat"><div class="empty" /><div class="muted">{st.given}</div></div>)}
      </div>}
      <div class="muted small">写真は「年鑑」にしまいました。いつでも見返せます。</div>
      <button class="btn primary block" onClick={() => { sfx('ok'); onDone(); navigate({ tab: 'school' }); }}>閉じる</button>
    </Sheet>
  );
}

import { NewsView } from './Newspaper';
export { NewsView };

function Retire({ s, forced }: { s: GameState; forced: boolean }) {
  const ins = s.instructor;
  return (
    <Sheet title={forced ? '引退のとき' : '引退を考える'}>
      <div class="pcard row nowrap gap8"><TeacherFace s={s} size={72} /><div class="grow"><span class="ptitle">{ins.name}</span>（{ins.generation}代目教官）<div class="small">{ins.age}歳・{s.year - (ins.since ?? 1)}年間・これまでに教えた子 {ins.experience}人</div></div></div>
      <div class="paper">
        {forced
          ? <p>{ins.name}先生は{ins.age}歳になりました。長いあいだ教壇に立ってきましたが、引退のときが来ました。あとを継ぐ教官を選びましょう。</p>
          : <p>{ins.name}先生も{ins.age}歳です。そろそろ、若い人に道をゆずることもできます。引退すると、卒業生などからあとを継ぐ教官を選びます。学校も生徒もお金も年鑑も、そのまま引き継がれます。{ins.age >= 56 ? '近ごろは疲れて、個人指導が減る週もあります。' : ''}</p>}
        <p class="small">講師と副教官は、頼めばすぐに引き受けてくれます。各国にいる卒業生は、先生への信頼が高いほど引き受けてくれやすいです。</p>
      </div>
      <button class="btn accent block" style={{ marginTop: 8 }} onClick={() => { sfx('ok'); act((g) => retireInstructor(g, rng(g))); }}>引退して、後継を選ぶ</button>
      {!forced && <button class="btn block" style={{ marginTop: 8 }} onClick={() => { sfx('cancel'); act((g) => { g.pending.shift(); }); }}>まだ続ける（{B.instructor.retireMax}歳まで続けられます）</button>}
    </Sheet>
  );
}

function Successor({ s }: { s: GameState }) {
  const [msg, setMsg] = useState('');
  const list = successorCandidates(s);
  const KIND = { teacher: '講師', vice: '副教官', alumni: '卒業生' };
  return (
    <Sheet title="後継の教官を選ぶ">
      <div class="muted small">卒業生なら、誰でも教官になれます。新しい教官の得意な授業は、その人の兵種と歩んだ道で決まります。<HelpTip text="三国との縁は、その人がいた国で決まります。技能は、卒業生だったときの値から始まります。" /></div>
      {msg && <div class="guide">{msg}</div>}
      {list.slice(0, 30).map((c) => (
        <MiniCard st={c.st} onClick={() => undefined} sub={<>{KIND[c.kind]}・{titleOf(c.st)}・{c.st.age}歳・信頼{Math.round(c.st.trust)}</>}
          right={<button class="btn small primary" onClick={() => { sfx('ok'); act((g) => { const r = askSuccessor(g, rng(g), c.st.id); setMsg(r.text); }); }}>頼んでみる<br />{c.chance}%</button>}>
          {c.recall && <div class="small" style={{ color: 'var(--accent)' }}>{c.recall}</div>}
        </MiniCard>
      ))}
      {!list.length && <div class="empty-note">頼める卒業生がいません</div>}
      <button class="btn block" style={{ marginTop: 8 }} onClick={() => { if (!confirm('旅の人を、新しい教官として迎えます。よろしいですか？')) return; sfx('ok'); act((g) => externalSuccessor(g, rng(g))); }}>旅の人を教官に迎える</button>
    </Sheet>
  );
}

function EndingChoice({ s, kind, country }: { s: GameState; kind: EndingKind; country?: CountryId }) {
  const [busy, setBusy] = useState(false);
  const reached = new Set((s.endings ?? []).map((e) => e.kind));
  return (
    <Sheet title="エンディング">
      <div class="pcard" style={{ textAlign: 'center' }}>
        <div class="muted small">{ENDING_SUB[kind]}</div>
        <div class="scene-title">{endingTitle(kind, country, (s.endings ?? [])[(s.endings ?? []).length - 1]?.n)}</div>
        <div class="small">{s.year}年目・卒業生 {s.stats.graduates}人・{s.instructor.generation}代目教官 {s.instructor.name}</div>
      </div>
      <div class="card">
        <h3>到達したエンディング</h3>
        <div class="row gap6">{(Object.keys(ENDING_NAMES) as EndingKind[]).map((k) => <span class={`chip-o ${reached.has(k) ? 'main' : 'gray'}`}>{reached.has(k) ? ENDING_NAMES[k] : '？？？'}</span>)}</div>
      </div>
      <div class="paper small">
        <p><b>この学校を続ける</b>：平和な時代が始まります。大きな戦争は起きず、依頼は魔物退治や見回りが中心になります。ただ、戦争の終わり方によっては、次の戦争の火種がくすぶりはじめます。<HelpTip text="火種のようすは「戦況」で見られます。先生たちの動きで、火がつくのを遅らせることもできます。" /></p>
        <p><b>新しい学校で始める</b>：この学校の年鑑を「殿堂」にしまって、タイトル画面に戻ります。次からは「ふつう」や「名門」の学校からも始められます。今のセーブも、そのまま残ります。<HelpTip text="しまった年鑑は、いつでも年鑑の「殿堂」で見られます。" /></p>
      </div>
      <button class="btn primary block" style={{ marginTop: 8 }} disabled={busy} onClick={() => { sfx('ok'); unlockStarts(); act((g) => continueSchool(g)); }}>この学校を続ける</button>
      <button class="btn accent block" style={{ marginTop: 8 }} disabled={busy} onClick={async () => {
        if (!confirm('この学校の年鑑を殿堂に保存して、タイトル画面に戻ります。よろしいですか？')) return;
        setBusy(true); sfx('graduation');
        await addHall(buildHallEntry(s, (st) => faceImageFor(st, s))); await unlockStarts();
        act((g) => continueSchool(g));
        await saveSlot(s);
        setGame(null);
      }}>新しい学校で始める（殿堂に保存）</button>
    </Sheet>
  );
}
