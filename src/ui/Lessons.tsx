// 日ごとの授業カード（7夜目）：今日の授業・授業の結果・今月の目標技能
import { useEffect, useState } from 'preact/hooks';
import type { GameState, LessonCard, Student, LessonRow, LessonEvent, TalkLog, GrowthEntry } from '../core/state';
import type { SkillId, StatId } from '../core/types';
import { LESSON_BY_ID, LESSON_GROUP_NAMES, LESSON_GROUP_COLOR, type LessonDef } from '../data/lessons';
import { SKILL_NAMES, STAT_NAMES, PERSONALITIES } from '../data/people';
import { B, SKILLS, RANK_POINTS } from '../data/balance';
import { todayCards, DAY_NAMES, attends, recommendCard, teacherStamina, teacherMax, teacherSick, lessonCost } from '../core/lessons';
import { chooseLesson, weekAuto } from '../core/flow';
import { skillUnlocked, bestTeacher, autoTargets } from '../core/week';
import { viceOf, VICE_POLICY_NAMES, viceTargets } from '../core/instructor';
import { enrolled } from '../core/game';
import { rankOf, nextRankPoints } from '../core/util';
import { act, navigate } from './store';
import { Portrait } from './Portrait';
import { Back } from './common';
import { sfx } from './sound';
import { Icon } from './icons';
import { countryColor } from './cards';
import { TalkPlayer } from './Talk';
import { chooseReply } from '../core/interview';
import { GrowthMoments } from './Growth';
import { laneMul } from './anim';

const UP = (w: number) => (w >= 1 ? '↑↑' : '↑');

/** カードの「伸びるもの」の札 */
function gainChips(l: LessonDef): { label: string; up: string }[] {
  const out: { label: string; up: string }[] = [];
  for (const [k, w] of Object.entries(l.skills ?? {})) out.push({ label: SKILL_NAMES[k as SkillId], up: UP(w as number) });
  for (const [k, w] of Object.entries(l.stats ?? {})) out.push({ label: STAT_NAMES[k as StatId], up: UP(w as number) });
  for (const e of l.extra ?? []) out.push({ label: e.label, up: e.big ? '↑↑' : '↑' });
  return out.slice(0, 4);
}
function staminaLabel(s: GameState, l: LessonDef): { text: string; good: boolean } {
  const v = lessonCost(s, l);
  return { text: `体力${v >= 0 ? '+' : ''}${v}`, good: v >= 0 };
}

/** 先生の体力ゲージ（7夜目：体力は先生だけ） */
export function TeacherStamina({ s }: { s: GameState }) {
  const v = Math.round(teacherStamina(s)), m = teacherMax(s);
  const low = v < B.teacher.lowAt;
  return (
    <div class={`tstamina${low ? ' low' : ''}`}>
      <span class="small"><b>先生の体力</b></span>
      <span class="ggauge grow"><span style={{ width: `${(v / m) * 100}%` }} /></span>
      <b class="small">{v}/{m}</b>
      {teacherSick(s) ? <span class="small red">寝込んでいる（あと{s.instructor.sickDays}日）</span> : low ? <span class="small red">低いと授業の効果が落ちる</span> : null}
    </div>
  );
}
/** 顔の子がこの授業で「目」（今月の目標技能） */
function targetHit(st: Student, l: LessonDef): boolean {
  return !!(l.skills && Object.keys(l.skills).includes(st.targets[0])) || l.special === 'field';
}

/** 今日の授業（ホームの中ほど） */
export function LessonBoard({ s }: { s: GameState }) {
  const [sel, setSel] = useState<number | null>(null);
  const [who, setWho] = useState<string | null>(null);
  const day = s.today && s.today.key === s.absWeek * 5 + ((s.day ?? 1) - 1) ? s.today : null;
  useEffect(() => { if (!day) act((g) => { todayCards(g); }); }, [day]);
  useEffect(() => { setSel(null); setWho(null); }, [s.absWeek, s.day]);
  if (!day) return null;
  const rec = recommendCard(s);
  const card = sel !== null ? day.cards[sel] : null;
  const l = card ? LESSON_BY_ID[card.id] : null;
  const talkFaces = card && l?.special === 'interview' ? card.faces.map((id) => s.students[id]).filter(Boolean) : [];
  const go = (talkWith?: string) => { if (sel === null) return; sfx('ok'); const i = sel; setSel(null); act((g) => chooseLesson(g, i, talkWith)); };
  const whoSt = who ? s.students[who] : null;
  return (
    <div class="lessonboard">
      <div class="row between nowrap">
        <h2 class="serif" style={{ margin: '6px 0 0' }}>今日の授業</h2>
        <span class="lb-day">{DAY_NAMES[(s.day ?? 1) - 1]}曜日{day.rain ? '・雨' : ''}</span>
      </div>
      <div class="muted small">1つ選ぶ。全員が伸びて、顔が出ている子は特に伸びる。授業は先生の体力を使い、休講で回復する。</div>
      <TeacherStamina s={s} />
      <div class="targetbox" onClick={() => { sfx('move'); navigate({ tab: 'school', page: 'targets' }); }}>
        <b class="gold">今月の目標技能</b>
        <span class="small"><span class="fmark t inline">目</span> の子は自分の目標の授業でさらに伸びる（タップで見る・変える）</span>
      </div>
      {teacherSick(s) && <div class="guide">{s.instructor.name}先生が寝込んでいます。今日は自動で休講になります（あと{s.instructor.sickDays}日）。</div>}
      <div class="lcards">
        {day.cards.map((c, i) => <LessonCardView s={s} c={c} on={sel === i} rec={i === rec} onPick={() => { sfx('move'); setSel(sel === i ? null : i); setWho(null); }} onFace={(id) => setWho(who === id ? null : id)} />)}
      </div>
      {whoSt && (
        <div class="whobox" onClick={() => setWho(null)}>
          <Portrait st={whoSt} size={36} frame={countryColor(whoSt.origin)} />
          <div class="grow small"><b>{whoSt.given}</b>（{whoSt.grade}年・{PERSONALITIES[whoSt.personality].name}）目標：{SKILL_NAMES[whoSt.targets[0]]} {rankOf(whoSt.skills[whoSt.targets[0]])}・やる気{B.motivationLabel[whoSt.motivation]}</div>
          <button class="btn ghost small" onClick={(e) => { e.stopPropagation(); navigate({ tab: 'students', page: 'detail', id: whoSt.id }); }}>個人ページ</button>
        </div>
      )}
      <div class="muted small" style={{ marginTop: 4 }}>・顔が出る子は毎日変わります（得意な技能・夢・性格に合う授業に出やすい）<br />・顔が2人以上（仲の良い組・恋人・ライバル）重なると友情タッグ✦</div>
      <div style={{ height: 64 }} />
      <div class="lessonbar">
        {teacherSick(s) ? (
          <button class="btn primary block" onClick={() => { sfx('ok'); act((g) => chooseLesson(g, 0)); }}>今日は休講（先生が寝込んでいる）</button>
        ) : card && l ? (
          talkFaces.length > 1 ? (
            <div class="row nowrap gap6" style={{ width: '100%' }}>
              <span class="small">誰と話す？</span>
              {talkFaces.map((st) => <button class="btn primary small grow" onClick={() => go(st.id)}>{st.given}{card.consult?.includes(st.id) ? '（相談）' : ''}</button>)}
            </div>
          ) : <button class="btn primary block" onClick={() => go()}>「{l.name}」にする <Icon name="next" size={18} /></button>
        ) : (
          <button class="btn ghost block omakase" onClick={() => { sfx('ok'); act((g) => weekAuto(g)); }}>今週はおまかせ（{DAY_NAMES[(s.day ?? 1) - 1]}〜金を先生のおすすめで）</button>
        )}
      </div>
    </div>
  );
}

function LessonCardView({ s, c, on, rec, onPick, onFace }: { s: GameState; c: LessonCard; on: boolean; rec: boolean; onPick: () => void; onFace: (id: string) => void }) {
  const l = LESSON_BY_ID[c.id];
  if (!l) return null;
  const sl = staminaLabel(s, l);
  const tagged = new Set(c.tags.flat());
  const faces = c.faces.map((id) => s.students[id]).filter((x): x is Student => !!x && attends(x));
  const teacher = l.skills && Object.keys(l.skills).length ? bestTeacher(s, Object.keys(l.skills)[0] as SkillId) : '';
  return (
    <div class={`lcard g-${l.group}${on ? ' on' : ''}`} style={{ ['--lc' as string]: LESSON_GROUP_COLOR[l.group] }} onClick={onPick} role="button">
      <div class="lc-head">
        <span class="lc-mark">{l.mark}</span>
        <span class="lc-name serif">{l.name}</span>
        {l.group !== 'rest' && <span class="lc-group">{LESSON_GROUP_NAMES[l.group]}</span>}
        <span class={`lc-st${sl.good ? ' good' : ''}`}>{sl.text}</span>
      </div>
      <div class="lc-chips">{gainChips(l).map((g) => <span class="lc-chip">{g.label} <b>{g.up}</b></span>)}</div>
      {faces.length > 0 && (
        <div class="lc-faces">
          {faces.map((st) => (
            <span class={`lc-face${tagged.has(st.id) ? ' tag' : ''}`} onClick={(e) => { e.stopPropagation(); onFace(st.id); }}>
              <Portrait st={st} size={44} frame={countryColor(st.origin)} />
              {targetHit(st, l) && <i class="fmark t">目</i>}
              {c.consult?.includes(st.id) && <i class="fmark c">相</i>}
              {tagged.has(st.id) && <i class="fmark s">✦</i>}
            </span>
          ))}
        </div>
      )}
      {c.tags.length > 0 && <div class="lc-tag">✦ 友情タッグ {c.tags.map(([a, b]) => `${s.students[a]?.given}×${s.students[b]?.given}`).join('・')}</div>}
      {l.special === 'rest' ? <div class="small muted">先生の体力 {Math.round(teacherStamina(s))}/{teacherMax(s)}</div> : l.note ? <div class="small muted">{l.note}</div> : teacher ? <div class="small muted">担当：{teacher}</div> : null}
      {rec && !on && <span class="lc-rec">おすすめ</span>}
    </div>
  );
}

// ---------- 授業の結果 ----------

function segPct(p: number): number {
  const cur = RANK_POINTS[rankOf(p)];
  const n = nextRankPoints(p);
  if (n === null) return 100;
  return Math.max(0, Math.min(100, ((p - cur) / (n - cur)) * 100));
}

type ResultP = Extract<GameState['pending'][number], { type: 'lessonResult' }>;
/** 結果の画面：伸びた子 → 練習のようす → レベルアップなど（タップで進む） → 会話 */
export function LessonResultView({ s, p, onDone }: { s: GameState; p: ResultP; onDone: () => void }) {
  const moments = p.growth.filter((g) => g.ups.length || g.spells.length || (g.train ?? []).length || g.skills.some((k) => rankOf(k.p0) !== rankOf(k.p1)));
  const stages = ['rows', ...(p.events.length ? ['events'] : []), ...(moments.length ? ['moments'] : []), ...(p.talks.length ? ['talks'] : [])];
  const [si, setSi] = useState(0);
  const [ev, setEv] = useState(0);
  const [ti, setTi] = useState(0);
  const next = () => { if (si + 1 < stages.length) setSi(si + 1); else onDone(); };
  const stage = stages[si];
  if (stage === 'events') return <PracticeEvent key={ev} s={s} e={p.events[ev]} onNext={() => { if (ev + 1 < p.events.length) setEv(ev + 1); else next(); }} />;
  if (stage === 'moments') return <div class="lresult"><GrowthMoments s={s} entries={moments} onDone={next} /></div>;
  if (stage === 'talks') {
    const t: TalkLog = p.talks[ti];
    return <div class="lresult"><div class="muted small">{t.kind === 'support' || !t.kind ? '支援会話' : t.kind === 'special' ? '特別な面談' : '面談'}（{ti + 1}／{p.talks.length}）</div><TalkPlayer key={ti} s={s} t={t} onDone={() => { if (ti + 1 < p.talks.length) setTi(ti + 1); else next(); }} onChoice={(k) => act((g) => chooseReply(g, t, k))} /></div>;
  }
  return <LessonRows s={s} p={p} onNext={next} label={stages[1] === 'events' ? '練習のようすを見る' : stages[1] === 'moments' ? '成長を見る' : stages[1] === 'talks' ? '会話を見る' : '閉じる'} />;
}

function LessonRows({ s, p, onNext, label }: { s: GameState; p: ResultP; onNext: () => void; label: string }) {
  const l = LESSON_BY_ID[p.lesson];
  const [go, setGo] = useState(false);
  useEffect(() => { const t = setTimeout(() => setGo(true), 120); return () => clearTimeout(t); }, []);
  const dur = Math.round(700 * laneMul('anim'));
  const rows = p.rows.filter((r) => s.students[r.id]).slice(0, 8);
  return (
    <div class="lresult">
      <div class="lr-head" style={{ ['--lc' as string]: LESSON_GROUP_COLOR[l?.group ?? 'rest'] }}>
        <span class="lc-mark">{l?.mark}</span>
        <div class="grow"><div class="small muted">{DAY_NAMES[p.day - 1]}曜日の授業</div><b class="serif" style={{ fontSize: 20 }}>{l?.name}</b></div>
        {p.tags.length > 0 && <span class="lc-tag">✦ 友情タッグ</span>}
      </div>
      {rows.map((r) => <ResultRow s={s} r={r} go={go} dur={dur} />)}
      {p.others > 0 && l?.group !== 'rest' && <div class="muted small" style={{ margin: '4px 2px' }}>ほかの{p.others}人も少しずつ伸びた</div>}
      {p.lines.length > 0 && <ul class="list sumlist small">{p.lines.slice(0, 10).map((x) => <li>{x}</li>)}</ul>}
      <button class="btn primary block" style={{ marginTop: 8 }} onClick={() => { sfx('ok'); onNext(); }}>{label}</button>
    </div>
  );
}

function ResultRow({ s, r, go, dur }: { s: GameState; r: LessonRow; go: boolean; dur: number }) {
  const st = s.students[r.id];
  const skills = r.skills.filter((k) => k.p1 - k.p0 >= 0.5).sort((a, b) => (b.p1 - b.p0) - (a.p1 - a.p0)).slice(0, 2);
  const train = r.train.filter((t) => t.g1 !== t.g0 || t.up).slice(0, 2);
  return (
    <div class={`lr-row${r.face ? ' face' : ''}`}>
      <Portrait st={st} size={40} frame={countryColor(st.origin)} />
      <div class="grow" style={{ minWidth: 0 }}>
        <div class="row nowrap gap4"><b>{st.given}</b>{r.face && <span class="fmark t inline">顔</span>}{r.target && <span class="fmark t inline">目</span>}{r.tag && <span class="fmark s inline">✦</span>}</div>
        {skills.map((k) => {
          const up = rankOf(k.p0) !== rankOf(k.p1);
          return (
            <div class="lr-gauge">
              <span class="small lr-k">{SKILL_NAMES[k.k]} <b>{go ? rankOf(k.p1) : rankOf(k.p0)}</b></span>
              <span class="ggauge grow"><span style={{ width: `${go ? (up ? 100 : segPct(k.p1)) : segPct(k.p0)}%`, transitionDuration: `${dur}ms` }} /></span>
              <span class={`lr-num${go ? ' pop' : ''}`}>{up ? `${rankOf(k.p0)}→${rankOf(k.p1)}!` : `+${Math.round(k.p1 - k.p0)}`}</span>
            </div>
          );
        })}
        {train.map((t) => (
          <div class="lr-gauge">
            <span class="small lr-k">{STAT_NAMES[t.k]}の鍛錬</span>
            <span class="ggauge train grow"><span style={{ width: `${go ? (t.up ? 100 : t.g1) : t.g0}%`, transitionDuration: `${dur}ms` }} /></span>
            <span class={`lr-num${go ? ' pop' : ''}`}>{t.up ? `${STAT_NAMES[t.k]}+${t.up}!` : `+${Math.round(t.g1 - t.g0)}`}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function PracticeEvent({ s, e, onNext }: { s: GameState; e: LessonEvent; onNext: () => void }) {
  const [i, setI] = useState(0);
  const line = e.lines[Math.min(i, e.lines.length - 1)];
  const st = line.by !== 'narr' ? s.students[line.by] : null;
  const faces = e.ids.map((id) => s.students[id]).filter(Boolean);
  return (
    <div class="lresult pevent" onClick={() => { sfx('move'); if (i + 1 < e.lines.length) setI(i + 1); else onNext(); }}>
      <div class="small muted">練習のようす</div>
      <div class="row gap6" style={{ justifyContent: 'center', margin: '8px 0' }}>{faces.map((x) => <Portrait st={x} size={64} frame={countryColor(x.origin)} />)}</div>
      {st ? <div class="talk"><div class="line"><Portrait st={st} size={40} /><div class="bubble"><b class="small">{st.given}</b><div>{line.text}</div></div></div></div> : <div class="paper">{line.text}</div>}
      <div class="small muted" style={{ textAlign: 'center', marginTop: 6 }}>タップで次へ ▼</div>
    </div>
  );
}

// ---------- 今月の目標技能 ----------
export function TargetsPage({ s }: { s: GameState }) {
  const grades = [1, 2, 3].filter((g) => enrolled(s).some((x) => x.grade === g));
  const skills = SKILLS.filter((k) => skillUnlocked(s, k));
  return (
    <div>
      <Back to={() => navigate({ tab: 'school' })} />
      <h2>今月の目標技能</h2>
      <div class="muted small">生徒ごとに、今月いちばん伸ばしたい技能（目標）と2番目を決めます。目標の授業ではその子がさらに3割伸びやすく、カードの顔に「目」の印が出ます。「自動」の子は毎月の初めに決まります（担任のいる学年は担任の方針で）。</div>
      {grades.map((g) => {
        const v = viceOf(s, g);
        return (
          <div class="card">
            <h3>{g}年生{v ? `（担任：${v.t.name}・${VICE_POLICY_NAMES[v.v.policy]}）` : ''}</h3>
            {enrolled(s).filter((x) => x.grade === g).map((st) => (
              <div class="tg-row">
                <Portrait st={st} size={40} frame={countryColor(st.origin)} />
                <div class="grow" style={{ minWidth: 0 }}>
                  <b>{st.given}</b> <span class="small muted">Lv{st.level}</span>
                  <div class="row nowrap gap4">
                    {[0, 1].map((i) => (
                      <select value={st.targets[i]} onChange={(e) => act((x) => { const y = x.students[st.id]; const t = [...y.targets] as [SkillId, SkillId]; t[i] = (e.target as HTMLSelectElement).value as SkillId; if (t[0] !== t[1]) { y.targets = t; y.targetsAuto = false; } })}>
                        {skills.map((k) => <option value={k}>{i === 0 ? '目標' : '2番目'}：{SKILL_NAMES[k]} {rankOf(st.skills[k])}</option>)}
                      </select>
                    ))}
                  </div>
                </div>
                <label class="small tg-auto"><input type="checkbox" checked={st.targetsAuto} onChange={(e) => act((x) => { const y = x.students[st.id]; y.targetsAuto = (e.target as HTMLInputElement).checked; if (y.targetsAuto) { const vv = viceOf(x, y.grade); y.targets = vv ? viceTargets(x, y, vv.v.policy, vv.st, autoTargets) : autoTargets(x, y); } })} />自動</label>
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}

export type { GrowthEntry };
