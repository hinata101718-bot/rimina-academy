import { useState } from 'preact/hooks';
import { useStore, act, navigate } from './store';
import { Sheet, StuRow, money } from './common';
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
import { startBattle, admit, autoAdmitIds, finishCareers } from '../core/flow';
import { autoDeploy, canEquip } from '../core/autoplay';
import { OBJECTIVE_NAMES, WEATHER_NAMES } from '../core/quests';
import { hopes, availableChoices, CHOICE_NAMES, acceptRate, suitablePath, autoRecommend, type CareerChoice } from '../core/career';
import { WEAPONS } from '../data/weapons';
import { CLASSES } from '../data/classes';
import { COUNTRY_SHORT, PERSONALITIES, DREAMS, COUNTRY_NAMES, HOUSE_NAMES, TRAITS, PATH_NAMES, STAT_NAMES } from '../data/people';
import { STATS, B } from '../data/balance';
import type { Path } from '../core/types';
import type { Deploy } from '../core/battle/setup';
import { sfx } from './sound';
import { AutoPrep, AutoResultHead } from './AutoBattle';
import { Icon } from './icons';
import { countryColor, CountryChip, Chip, Stars, Num, LvBadge, MiniCard, NameLine, OBJECTIVE_ICON, WEATHER_ICON } from './cards';
import { rankOf } from '../core/util';
import { SKILL_NAMES } from '../data/people';
import { SKILLS } from '../data/balance';

export function PendingView() {
  const { s } = useStore();
  if (!s || !s.pending.length) return null;
  const p = s.pending[0];
  const done = () => act((g) => { g.pending.shift(); });
  switch (p.type) {
    case 'weekSummary': return <WeekSummary lines={p.lines} talks={p.talks} growth={p.growth} onDone={done} />;
    case 'talk': return <Sheet title={p.talk.kind === 'support' || !p.talk.kind ? '支援会話' : '面談'}><TalkPlayer s={s} t={p.talk} onDone={done} onChoice={(k) => act((g) => chooseReply(g, p.talk, k))} /></Sheet>;
    case 'event': return <Sheet title={p.title}><div class="paper">{p.lines.map((l) => <p>{l}</p>)}</div><button class="btn primary block" style={{ marginTop: 10 }} onClick={done}>閉じる</button></Sheet>;
    case 'battleResult': return <BattleResult s={s} p={p} onDone={done} />;
    case 'questBoard': return <QuestBoard s={s} />;
    case 'entrance': return <Entrance s={s} />;
    case 'career': return <Career s={s} />;
    case 'graduation': return <Graduation s={s} cohort={p.cohort} lines={p.lines} onDone={done} />;
    case 'ending': return <EndingChoice s={s} kind={p.kind} country={p.country} />;
    case 'retire': return <Retire s={s} forced={p.forced} />;
    case 'successor': return <Successor s={s} />;
    case 'scene': return <Sheet title={p.title}><ScenePlayer key={p.title} s={s} lines={p.lines} onDone={done} /></Sheet>;
    case 'newspaper': return <Sheet title="新聞が届いた"><NewsView id={p.id} /><button class="btn primary block" style={{ marginTop: 10 }} onClick={done}>閉じる</button></Sheet>;
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
  if (g === 0) return <Sheet title="今週の成長"><GrowthPlayer s={s} entries={growth ?? []} title="伸びた生徒" onDone={() => setG(1)} /></Sheet>;
  if (i >= 0 && i < talks.length) {
    const t = talks[i];
    return <Sheet title={`${t.kind === 'support' || !t.kind ? '支援会話' : t.kind === 'special' ? '特別な面談' : '面談'}（${i + 1}／${talks.length}）`}><TalkPlayer key={i} s={s} t={t} onDone={() => setI(i + 1)} onChoice={(k) => act((g) => chooseReply(g, t, k))} /></Sheet>;
  }
  return (
    <Sheet title="今週のまとめ">
      <div class="pcard"><ul class="list sumlist">{lines.map((l) => <li><span class="todoicon"><Icon name={lineIcon(l)} size={16} /></span><span>{l}</span></li>)}</ul></div>
      {talks.length > 0 && i < 0 && <button class="btn accent block" style={{ marginTop: 8 }} onClick={() => setI(0)}>会話を見る（{talkCountLabel(talks)}）</button>}
      {talks.length > 0 && i >= talks.length && <div class="muted small" style={{ marginTop: 6 }}>会話は生徒の個人ページの「会話の記録」で読み返せます。</div>}
      <button class="btn primary block" style={{ marginTop: 8 }} onClick={() => { sfx('ok'); onDone(); }}>閉じる</button>
    </Sheet>
  );
}

function BattleResult({ s, p, onDone }: { s: GameState; p: Extract<GameState['pending'][number], { type: 'battleResult' }>; onDone: () => void }) {
  const [step, setStep] = useState(p.growth?.length ? 0 : 1);
  if (step === 0) return <Sheet title={p.win ? '勝利 ― 成長の記録' : '敗北 ― 成長の記録'}><GrowthPlayer s={s} entries={p.growth ?? []} title="出撃した生徒" onDone={() => setStep(1)} /></Sheet>;
  return (
    <Sheet title={`${p.win ? '勝利' : '敗北'}${p.title ? `：${p.title}` : ''}`}>
      <AutoResultHead s={s} mvp={p.mvp} review={p.review} />
      {p.findings && p.findings.length > 0 && (
        <div class="pcard" style={{ ['--band' as string]: 'var(--gold)' }}>
          <h3 style={{ marginTop: 0 }}>この戦いで伸びた・分かったこと</h3>
          <ul class="list sumlist">{p.findings.map((f) => <li><span class="todoicon"><Icon name={f.icon} size={16} /></span><span>{f.text}</span></li>)}</ul>
        </div>
      )}
      <h3>生徒ごとの評価</h3>
      {p.grades.map((g) => { const st = s.students[g.id]; if (!st) return null; return <MiniCard st={st} onClick={() => undefined} sub={g.note} right={<span class={`grade g${g.grade}`}>{g.grade}</span>} />; })}
      <div class="pcard"><ul class="list sumlist">{p.lines.map((l) => <li><span class="todoicon"><Icon name={l.startsWith('勝利') ? 'flag' : l.startsWith('敗北') ? 'skull' : l.includes('報酬') ? 'coin' : lineIcon(l)} size={16} /></span><span>{l}</span></li>)}</ul></div>
      <button class="btn primary block" onClick={() => { sfx('ok'); onDone(); }}>閉じる</button>
    </Sheet>
  );
}

const TYPE_SKILL: Record<string, string> = { sword: 'sword', lance: 'lance', axe: 'axe', bow: 'bow', magic: 'magic', holy: 'faith', staff: 'faith', gun: 'gun' };

function QuestBoard({ s }: { s: GameState }) {
  const [qid, setQid] = useState<string | null>(s.quests.length === 1 ? s.quests[0].id : null);
  const [deploy, setDeploy] = useState<Deploy[] | null>(null);
  const q = s.quests.find((x) => x.id === qid);
  if (!q) {
    return (
      <Sheet title="月末の依頼掲示板">
        {s.month === 5 && <ArtSlot name="event_exhibition" />}
        {s.settings.guide && s.year === 1 && s.month === 0 && <div class="guide">最初は「演習」を選びましょう。演習では誰も死にません。実戦は報酬と評判がもらえますが、倒れた生徒が戦死することがあります。</div>}
        {s.quests.map((x) => (
          <div class="pcard tap" style={{ ['--band' as string]: x.clientCountry ? countryColor(x.clientCountry) : 'var(--main)' }} onClick={() => { sfx('ok'); setQid(x.id); }}>
            <div class="row between nowrap"><span class="ptitle">{x.title}</span><span class={`flag ${x.real ? 'red' : ''}`}>{x.real ? '実戦' : x.kind === 'exhibition' ? '演武会' : '演習'}</span></div>
            <div class="row nowrap gap6 small" style={{ marginTop: 2 }}>{x.clientCountry && <CountryChip o={x.clientCountry} />}<span class="muted">依頼主：{x.client}</span></div>
            <div class="infogrid">
              <div><Icon name={OBJECTIVE_ICON[x.objective]} size={17} />{OBJECTIVE_NAMES[x.objective]}{x.defendTurns && x.objective === 'defend' ? `（${x.defendTurns}ターン）` : ''}</div>
              <div><Icon name={WEATHER_ICON[x.weather]} size={17} />{WEATHER_NAMES[x.weather]}</div>
              <div>危険度 <Stars n={x.danger} /></div>
              <div><Icon name="coin" size={17} />{x.reward ? <Num v={x.reward.toLocaleString()} unit="G" /> : '報酬なし'}</div>
              <div><Icon name="target" size={17} />推奨 <LvBadge lv={x.level} /></div>
              <div class={x.real ? '' : 'muted'}>{x.real ? <><Icon name="skull" size={17} />戦死あり</> : '誰も死なない'}</div>
            </div>
          </div>
        ))}
      </Sheet>
    );
  }
  if (!s.settings.manualBattle) return <AutoPrep key={q.id} s={s} q={q} onBack={s.quests.length > 1 ? () => { setQid(null); setDeploy(null); } : undefined} />;
  const limit = deployLimit(s);
  const d = deploy ?? autoDeploy(s, limit);
  const setD = (nd: Deploy[]) => setDeploy(nd);
  const used = new Set(d.flatMap((x) => [x.armoryUid, x.staffUid]).filter(Boolean) as string[]);
  const avail = enrolled(s).filter(available);
  return (
    <Sheet title={`出撃準備：${q.title}`} onClose={s.quests.length > 1 ? () => { setQid(null); setDeploy(null); } : undefined}>
      <div class="row between nowrap"><span>出撃 <Num v={d.length} unit={`／${limit}人`} /></span><span class="row nowrap gap6 small"><Icon name={WEATHER_ICON[q.weather]} size={18} />{WEATHER_NAMES[q.weather]}　<Icon name={OBJECTIVE_ICON[q.objective]} size={18} />{OBJECTIVE_NAMES[q.objective]}</span></div>
      <div class="small muted">出撃できるのは{limit}人まで。武器は武器庫から割り当てます（技能ランクが足りない武器は使えません）。魔法は本人が覚えたものを使います。</div>
      {q.weather === 'rain' && <div class="tag red">雨：移動−1、銃は使えない</div>}
      {q.weather === 'fog' && <div class="tag red">霧：弓・魔道・銃の射程−1</div>}
      {avail.map((st) => {
        const i = d.findIndex((x) => x.studentId === st.id);
        const on = i >= 0;
        const opts = s.armory.filter((a) => canEquip(st, a.weaponId) && WEAPONS[a.weaponId].type !== 'staff' && (!used.has(a.uid) || d[i]?.armoryUid === a.uid));
        const spells = usableSpells(st).map((id) => WEAPONS[id]?.name).filter(Boolean);
        const cls = CLASSES[st.classId];
        return (
          <MiniCard st={st} dim={!on} onClick={() => { sfx('move'); if (on) setD(d.filter((x) => x.studentId !== st.id)); else if (d.length < limit) setD([...d, { studentId: st.id, armoryUid: opts[0]?.uid ?? null, item: null, staffUid: null }]); }}
            sub={<span class="row nowrap gap4">HP<Num v={st.stats.hp + (cls.bonus.hp ?? 0)} />{st.targets.map((k) => <Chip>{SKILL_NAMES[k]} {rankOf(st.skills[k])}</Chip>)}</span>} right={<span class={`checkbox${on ? ' on' : ''}`}>{on ? '✓' : ''}</span>}>
            {on && (
              <div class="row ruled">
                <select value={d[i].armoryUid ?? ''} onChange={(e) => { const nd = [...d]; nd[i] = { ...nd[i], armoryUid: (e.target as HTMLSelectElement).value || null }; setD(nd); }}>
                  <option value="">武器なし</option>
                  {opts.map((a) => <option value={a.uid}>{WEAPONS[a.weaponId].name}{a.engraved ? `（${a.engraved}）` : ''}</option>)}
                </select>
                <select value={d[i].item ?? ''} onChange={(e) => { const nd = [...d]; nd[i] = { ...nd[i], item: ((e.target as HTMLSelectElement).value || null) as Deploy['item'] }; setD(nd); }}>
                  <option value="">道具なし</option>
                  <option value="vulnerary" disabled={s.items.vulnerary <= d.filter((x, j) => j !== i && x.item === 'vulnerary').length}>傷薬（残{s.items.vulnerary}）</option>
                  <option value="elixir" disabled={s.items.elixir <= d.filter((x, j) => j !== i && x.item === 'elixir').length}>特効薬（残{s.items.elixir}）</option>
                </select>
                {spells.length > 0 && <div class="small muted" style={{ width: '100%' }}><Icon name="tome" size={14} /> 使える魔法：{spells.join('・')}</div>}
              </div>
            )}
          </MiniCard>
        );
      })}
      <button class="btn accent block" disabled={!d.length} onClick={() => {
        sfx('ok');
        act((g) => {
          for (const x of d) if (x.item) g.items[x.item] = Math.max(0, g.items[x.item] - 1);
          startBattle(g, q.id, d);
        });
      }}>出撃する（{d.length}人）</button>
    </Sheet>
  );
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
      <div class="muted">志願者{s.applicants.length}人。定員{cap}人まで合格にできます（選択中 {sel.length}人）。</div>
      {s.applicants.map((a) => <ApplicantCard st={a} on={sel.includes(a.id)} toggle={() => setSel(sel.includes(a.id) ? sel.filter((x) => x !== a.id) : sel.length < cap ? [...sel, a.id] : sel)} />)}
      <button class="btn primary block" disabled={!sel.length} onClick={() => { sfx('graduation'); act((g) => admit(g, sel)); }}>この{sel.length}人を合格にする（入学式へ）</button>
    </Sheet>
  );
}

function Career({ s }: { s: GameState }) {
  const third = enrolled(s).filter((x) => x.grade === 3);
  const [plans, setPlans] = useState(() => third.map((st) => ({ studentId: st.id, recommend: autoRecommend(s, st), path: suitablePath(st) })));
  return (
    <Sheet title="進路の決定">
      <div class="muted small">各国からの声かけ・本人の希望・教官の推薦の三つで決まります。推薦と希望が同じなら、やる気満々で巣立ちます。違うと、信頼が高いほど推薦を受け入れます（少し不満が残ります）。</div>
      {third.map((st, i) => {
        const h = hopes(s, st).filter((x) => availableChoices(st).includes(x));
        return (
          <div class="card">
            <StuRow st={st} onClick={() => undefined} sub={`信頼${Math.round(st.trust)}・推薦を受け入れる確率${Math.round(acceptRate(st))}%`} />
            <div class="small">声かけ：{st.offers.length ? st.offers.map((c) => COUNTRY_SHORT[c]).join('・') : 'なし'}</div>
            <div class="small">本人の希望：{h.slice(0, 3).map((x) => CHOICE_NAMES[x]).join(' ＞ ')}</div>
            <div class="row">推薦：
              <select value={plans[i].recommend} onChange={(e) => { const np = [...plans]; np[i] = { ...np[i], recommend: (e.target as HTMLSelectElement).value as CareerChoice }; setPlans(np); }}>
                {availableChoices(st).map((c) => <option value={c}>{CHOICE_NAMES[c]}{c === h[0] ? '（希望）' : ''}</option>)}
              </select>
              道：<select value={plans[i].path} onChange={(e) => { const np = [...plans]; np[i] = { ...np[i], path: (e.target as HTMLSelectElement).value as Path }; setPlans(np); }}>
                {(['warrior', 'strategist', 'civil'] as Path[]).map((p) => <option value={p}>{PATH_NAMES[p]}{p === suitablePath(st) ? '（向いている）' : ''}</option>)}
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
      <div class="muted small">写真は「年鑑」に保存されました。</div>
      <button class="btn primary block" onClick={() => { sfx('ok'); onDone(); navigate({ tab: 'school' }); }}>閉じる</button>
    </Sheet>
  );
}

export function NewsView({ id }: { id: string }) {
  const { s } = useStore();
  const n = s?.news.find((x) => x.id === id);
  if (!s || !n) return null;
  return (
    <div class="paper" style={n.tension > 65 ? { background: '#cfc8bb' } : undefined}>
      <ArtSlot name="event_newspaper" height={110} />
      <div class="head">リンデルガ新報　{n.year}年目</div>
      <h2 style={{ marginTop: 4 }}>{n.headline}</h2>
      {n.body.map((l) => <p style={{ margin: '4px 0' }}>{l}</p>)}
      {n.alumni.length > 0 && <>
        <h3 style={{ borderTop: '1px solid var(--ink)', paddingTop: 6 }}>卒業生の消息</h3>
        {n.alumni.map((a) => <div class="small" style={{ cursor: 'pointer', textDecoration: 'underline' }} onClick={() => { act((g) => { g.pending = g.pending.filter((p) => !(p.type === 'newspaper' && p.id === id)); }); navigate({ tab: 'students', page: 'detail', id: a.id }); }}>・{a.text}</div>)}
      </>}
    </div>
  );
}

function Retire({ s, forced }: { s: GameState; forced: boolean }) {
  const ins = s.instructor;
  return (
    <Sheet title={forced ? '引退のとき' : '引退を考える'}>
      <div class="pcard row nowrap gap8"><TeacherFace s={s} size={72} /><div class="grow"><span class="ptitle">{ins.name}</span>（{ins.generation}代目教官）<div class="small">{ins.age}歳・{s.year - (ins.since ?? 1)}年間・教えた生徒 延べ{ins.experience}人</div></div></div>
      <div class="paper">
        {forced
          ? <p>{ins.name}先生は{ins.age}歳になった。長いあいだ教壇に立ってきたが、ついに引退のときが来た。後継の教官を選ぼう。</p>
          : <p>{ins.name}先生も{ins.age}歳。そろそろ後進に道をゆずることもできる。引退すると、卒業生（または外部の人）から後継の教官を選び、学校・生徒・お金・年鑑はそのまま引き継がれる。{ins.age >= 56 ? '（近ごろは疲れて、個人指導の回数が減る週もある）' : ''}</p>}
        <p class="small">後継の候補：講師・副教官はすぐ引き受けます。各国にいる卒業生は、先生への信頼が高いほど引き受けてくれやすくなります。</p>
      </div>
      <button class="btn accent block" style={{ marginTop: 8 }} onClick={() => { sfx('ok'); act((g) => retireInstructor(g, rng(g))); }}>引退して、後継を選ぶ</button>
      {!forced && <button class="btn block" style={{ marginTop: 8 }} onClick={() => { sfx('cancel'); act((g) => { g.pending.shift(); }); }}>まだ続ける（{B.instructor.retireMax}歳まで）</button>}
    </Sheet>
  );
}

function Successor({ s }: { s: GameState }) {
  const [msg, setMsg] = useState('');
  const list = successorCandidates(s);
  const KIND = { teacher: '講師', vice: '副教官', alumni: '卒業生' };
  return (
    <Sheet title="後継の教官を選ぶ">
      <div class="muted small">卒業生なら誰でも教官になれます。新しい教官の得意な授業と三国との縁は、その人の兵種・道・所属していた国で決まり、技能は卒業生のときの値から始まります。</div>
      {msg && <div class="guide">{msg}</div>}
      {list.slice(0, 30).map((c) => (
        <MiniCard st={c.st} onClick={() => undefined} sub={<>{KIND[c.kind]}・{titleOf(c.st)}・{c.st.age}歳・信頼{Math.round(c.st.trust)}</>}
          right={<button class="btn small primary" onClick={() => { sfx('ok'); act((g) => { const r = askSuccessor(g, rng(g), c.st.id); setMsg(r.text); }); }}>頼む<br />{c.chance}%</button>}>
          {c.recall && <div class="small" style={{ color: 'var(--accent)' }}>{c.recall}</div>}
        </MiniCard>
      ))}
      {!list.length && <div class="empty-note">頼める卒業生がいません</div>}
      <button class="btn block" style={{ marginTop: 8 }} onClick={() => { if (!confirm('外部から「流れの旅人」の教官を迎えます。よろしいですか？')) return; sfx('ok'); act((g) => externalSuccessor(g, rng(g))); }}>外部から教官を迎える（流れの旅人）</button>
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
        <div class="scene-title">{endingTitle(kind, country)}</div>
        <div class="small">{s.year}年目・卒業生 {s.stats.graduates}人・{s.instructor.generation}代目教官 {s.instructor.name}</div>
      </div>
      <div class="card">
        <h3>到達したエンディング</h3>
        <div class="row gap6">{(Object.keys(ENDING_NAMES) as EndingKind[]).map((k) => <span class={`chip-o ${reached.has(k) ? 'main' : 'gray'}`}>{reached.has(k) ? ENDING_NAMES[k] : '？？？'}</span>)}</div>
      </div>
      <div class="paper small">
        <p><b>この学校を続ける</b>：平和な時代が始まります。戦争の大事件は起きず、依頼は魔物退治や治安維持が中心になります（まれに、再び戦の気配が漂うことも）。</p>
        <p><b>新しい学校で始める</b>：この学校の年鑑を「殿堂」に保存して、タイトル画面に戻ります（いつでも年鑑の「殿堂」で見られます）。次からは「ふつう」「名門」の学校からも始められます。このセーブもそのまま残ります。</p>
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
