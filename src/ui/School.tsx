import { useState } from 'preact/hooks';
import { useStore, navigate, act } from './store';
import { enrolled, available } from '../core/game';
import { tutoringSlots, weekendSlots, declineConsult, doSpotlight, bestTeacher, skillUnlocked } from '../core/week';
import { examCandidates } from '../core/exam';
import { rng } from '../core/flow';
import { StuRow, Back, money, Bar, moodIcon } from './common';
import { Portrait } from './Portrait';
import { SKILL_NAMES, PERSONALITIES } from '../data/people';
import { B, SKILLS } from '../data/balance';
import { WEAPONS } from '../data/weapons';
import { facilityCost, upgradeFacility, hireTeacher, fireTeacher, buyWeapon, buyItem, upkeepCost, type FacilityId } from '../core/teachers';
import { rankOf } from '../core/util';
import { instructorCaps, goodSkillsOf, viceEligible, viceOf, setVice, removeVice, VICE_POLICY_NAMES } from '../core/instructor';
import { TeacherFace } from './Talk';
import type { VicePolicy } from '../core/state';
import type { SkillId } from '../core/types';
import type { GameState, WeekendAction } from '../core/state';
import { sfx } from './sound';
import { Icon } from './icons';
import { MonthCalendar, ArtSlot } from './HomeDeco';
import { SkillBox, skillIcon, countryColor, LvBadge, ClassName, MoodDots, FatigueBar, Gauge, NameLine, MiniCard, Num, Chip, studentFlags } from './cards';
import { supportRank, supportValue } from '../core/support';

const GUIDE = [
  'まずは「やること一覧」を上から順に見ていきましょう。全部やらなくても「次の週へ」を押せば、残りは自動で決まります。',
  '個人指導で生徒を1人ずつ伸ばせます。面談をすると、やる気と教官への信頼が上がります。',
  '週末の交流では、お茶会や手合わせで生徒どうしの仲（支援）が深まります。仲が深まると戦闘で助け合えます。',
  '今週が終わると月末の戦闘です。最初は「演習」がおすすめ。演習では誰も死にません。',
];

export function SchoolTab() {
  const { s, route } = useStore();
  if (!s) return null;
  if (route.page === 'lessons') return <Lessons s={s} />;
  if (route.page === 'tutoring') return <Tutoring s={s} />;
  if (route.page === 'weekend') return <Weekend s={s} />;
  if (route.page === 'facilities') return <Facilities s={s} />;
  if (route.page === 'armory') return <Armory s={s} />;
  if (route.page === 'mail') return <Mailbox s={s} />;
  if (route.page === 'instructor') return <InstructorPage s={s} />;
  return <Home s={s} />;
}

function Home({ s }: { s: GameState }) {
  const list = enrolled(s);
  const slots = tutoringSlots(s);
  const todo: { text: string; go: () => void; red?: boolean; icon?: string }[] = [];
  const left = slots - s.plan.tutoring.length;
  if (s.week === 1) todo.push({ text: `今月の重点科目：${[1, 2, 3].filter((g) => list.some((x) => x.grade === g)).map((g) => `${g}年 ${(s.focus[g] ?? []).map((k) => SKILL_NAMES[k]).join('・')}`).join(' ／ ')}`, go: () => navigate({ tab: 'school', page: 'lessons' }), icon: 'lesson' });
  todo.push({ icon: 'students', text: left > 0 ? `個人指導 あと${left}回` : '個人指導 設定済み', go: () => navigate({ tab: 'school', page: 'tutoring' }), red: left > 0 });
  todo.push({ icon: 'heart', text: s.plan.weekend.length ? `週末の交流 ${s.plan.weekend.length}件 設定済み` : '週末の交流 未設定', go: () => navigate({ tab: 'school', page: 'weekend' }), red: !s.plan.weekend.length });
  for (const id of s.consults) { const st = s.students[id]; if (st) todo.push({ icon: 'talk', text: `相談：${st.given}「先生、少しいいですか」`, go: () => navigate({ tab: 'school', page: 'tutoring' }), red: true }); }
  const ex = examCandidates(s);
  if (ex.length) todo.push({ icon: 'exam', text: `兵種試験を受けられる生徒が${ex.length}人（${ex.map((x) => x.given).join('・')}）`, go: () => navigate({ tab: 'students', page: 'exam' }), red: true });
  for (const st of list) {
    if (st.dropoutSign) todo.push({ icon: 'bell', text: `退学の予兆：${st.given}（面談で話を聞こう）`, go: () => navigate({ tab: 'students', page: 'detail', id: st.id }), red: true });
    if (st.fatigue >= B.fatigue.warnAt && available(st)) todo.push({ icon: 'bell', text: `疲れがたまっている：${st.given}（疲労${Math.round(st.fatigue)}）`, go: () => navigate({ tab: 'students', page: 'detail', id: st.id }) });
    if (st.motivation <= 0) todo.push({ icon: 'bell', text: `やる気がとても低い：${st.given}`, go: () => navigate({ tab: 'students', page: 'detail', id: st.id }) });
  }
  for (const st of list) if (st.birthday && st.birthday.month === s.month && st.birthday.week === s.week) todo.push({ icon: 'cake', text: `今週は${st.given}の誕生日（お茶会に招くと仲が深まりやすい）`, go: () => navigate({ tab: 'school', page: 'weekend' }) });
  const unread = s.mail.filter((m) => !m.read).length;
  if (unread) todo.push({ icon: 'mail', text: `郵便受けに未読の手紙が${unread}通`, go: () => navigate({ tab: 'school', page: 'mail' }) });
  const [spotMsg, setSpotMsg] = useState('');
  const guideOn = s.settings.guide && s.year === 1 && s.month === 0;
  return (
    <div>
      <MonthCalendar s={s} />
      {s.month === 3 && <ArtSlot name="event_camp" />}
      {guideOn && <div class="guide">{GUIDE[Math.min(GUIDE.length - 1, s.week - 1)]}</div>}
      <div class="two">
        <div>
          {s.spotlight.length > 0 && (
            <div class="card">
              <h3>今月の主役</h3>
              <div class="facecards">
                {s.spotlight.map((sp) => { const st = s.students[sp.id]; if (!st) return null; const c = countryColor(st.origin); return (
                  <div class="facecard band" style={{ ['--band' as string]: c }} onClick={() => navigate({ tab: 'students', page: 'detail', id: st.id })}>
                    <div class="mc-face"><Portrait st={st} size={72} frame={c} /><LvBadge lv={st.level} /></div>
                    <div class="grow">
                      <NameLine st={st} size={18} family={false} />
                      <div class="row nowrap gap4"><ClassName classId={st.classId} size={13} /><span class="small muted">{st.grade}年</span></div>
                      <div class="small">{sp.text}</div>
                      {!sp.done && st.status === 'enrolled' ? <button class="btn small accent" style={{ marginTop: 4 }} onClick={(e) => { e.stopPropagation(); sfx('ok'); act((g) => setSpotMsg(doSpotlight(g, rng(g), st.id))); }}>声をかける</button> : <span class="tag gray">声をかけた</span>}
                    </div>
                  </div>
                ); })}
              </div>
              {spotMsg && <div class="muted">{spotMsg}</div>}
            </div>
          )}
          <div class="card">
            <h3>やること一覧</h3>
            <ul class="list todo">
              {todo.map((t) => <li onClick={() => { sfx('move'); t.go(); }}><span class={`todoicon${t.red ? ' red' : ''}`}><Icon name={t.icon ?? 'bell'} size={18} /></span><span class="grow">{t.text}</span><span class="muted">›</span></li>)}
            </ul>
          </div>
        </div>
        <div>
          {s.pinned.length > 0 && (
            <div class="card">
              <h3>気にかける生徒</h3>
              <div class="facecards small">
                {s.pinned.map((id) => s.students[id]).filter(Boolean).map((st) => { const c = countryColor(st.origin); const f = studentFlags(s, st)[0]; return (
                  <div class="facecard band" style={{ ['--band' as string]: c }} onClick={() => navigate({ tab: 'students', page: 'detail', id: st.id })}>
                    <Portrait st={st} size={60} frame={c} />
                    <NameLine st={st} size={15} family={false} />
                    <div class="small row nowrap gap4" style={{ justifyContent: 'center' }}><MoodDots m={st.motivation} /></div>
                    <div class="small row nowrap gap4" style={{ width: '100%' }}>疲労<FatigueBar f={st.fatigue} /></div>
                    {f && <span class={`flag ${f.tone}`}>{f.text}</span>}
                  </div>
                ); })}
              </div>
            </div>
          )}
          <div class="card">
            <h3>変化のお知らせ</h3>
            {s.notices.length === 0 && <div class="muted">まだありません</div>}
            <ul class="list">{[...s.notices].reverse().slice(0, 8).map((n) => <li class="small" onClick={() => n.studentId && navigate({ tab: 'students', page: 'detail', id: n.studentId })}>{n.text}</li>)}</ul>
            {s.notices.length > 0 && <button class="btn ghost small" onClick={() => act((g) => { g.notices = []; })}>お知らせを消す</button>}
          </div>
          <div class="card">
            <h3>学校のこと</h3>
            <div class="grid2">
              <button class="btn ghost iconbtn" onClick={() => navigate({ tab: 'school', page: 'lessons' })}><Icon name="lesson" /> 授業</button>
              <button class="btn ghost iconbtn" onClick={() => navigate({ tab: 'school', page: 'facilities' })}><Icon name="house" /> 施設・講師</button>
              <button class="btn ghost iconbtn" onClick={() => navigate({ tab: 'school', page: 'armory' })}><Icon name="sword" /> 武器庫</button>
              <button class="btn ghost iconbtn" onClick={() => navigate({ tab: 'school', page: 'mail' })}><Icon name="mail" /> 郵便受け{unread ? `（${unread}）` : ''}</button>
              <button class="btn ghost iconbtn" onClick={() => navigate({ tab: 'school', page: 'instructor' })}><Icon name="students" /> 教官・副教官</button>
            </div>
            <div class="muted" style={{ marginTop: 6 }}>在籍 {list.length}人・講師 {s.teachers.length}人・評判 {Math.round(s.reputation)}／100{s.year <= B.school.deadlineYear && !s.world.vassal ? `（${B.school.deadlineYear}年目の終わりまでに${B.school.deadlineRep}が目標）` : ''}</div>
          </div>
        </div>
      </div>
      <div style={{ height: 50 }} />
    </div>
  );
}

function Lessons({ s }: { s: GameState }) {
  const grades = [1, 2, 3].filter((g) => enrolled(s).some((x) => x.grade === g));
  const skills = SKILLS.filter((k) => skillUnlocked(s, k));
  return (
    <div>
      <Back to={() => navigate({ tab: 'school' })} />
      <h2>授業（重点科目）</h2>
      <div class="muted">学年ごとに、今月の重点科目を2つ選びます。学年全員が少しずつ伸びます。生徒ごとの「目標技能」は生徒の画面で変えられます。</div>
      {grades.map((g) => (
        <div class="card">
          <h3>{g}年生{viceOf(s, g) ? `（担任：${viceOf(s, g)!.t.name}）` : ''}</h3>
          {viceOf(s, g) && <div class="muted small">担任が毎月の始めに重点科目を決めます。ここで変えると、その月はあなたの決定が優先されます。</div>}
          {[0, 1].map((i) => (
            <div class="row" style={{ marginBottom: 6 }}>
              <span>重点{i + 1}</span>
              <select value={s.focus[g]?.[i]} onChange={(e) => act((x) => { const f = [...(x.focus[g] ?? ['sword', 'lance'])] as [SkillId, SkillId]; f[i] = (e.target as HTMLSelectElement).value as SkillId; x.focus[g] = f; })}>
                {skills.map((k) => <option value={k}>{SKILL_NAMES[k]}（担当：{bestTeacher(s, k)}）</option>)}
              </select>
            </div>
          ))}
        </div>
      ))}
      <div class="card">
        <h3>時間割（自動）</h3>
        <table class="stats"><tbody>
          {['月', '火', '水', '木', '金'].map((d, i) => (
            <tr><td>{d}</td>{grades.map((g) => { const f = s.focus[g] ?? ['sword', 'lance']; return <td>{g}年：{i % 2 === 0 ? SKILL_NAMES[f[0]] : SKILL_NAMES[f[1]]}{i === 4 ? '・自習（目標技能）' : ''}</td>; })}</tr>
          ))}
        </tbody></table>
        <div class="muted small">担当者の技能ランクが高いほどよく伸びます。担当者のいない科目は伸びが半分です。</div>
      </div>
    </div>
  );
}

function Tutoring({ s }: { s: GameState }) {
  const slots = tutoringSlots(s);
  const list = enrolled(s);
  const used = s.plan.tutoring;
  const [kind, setKind] = useState<'skill' | 'talk'>('skill');
  const add = (id: string, k: 'skill' | 'talk' | 'consult', skill?: SkillId) => act((g) => {
    if (g.plan.tutoring.length >= tutoringSlots(g)) return;
    g.plan.tutoring.push({ studentId: id, kind: k, skill });
    if (k === 'consult') g.consults = g.consults.filter((x) => x !== id);
  });
  return (
    <div>
      <Back to={() => navigate({ tab: 'school' })} />
      <h2>個人指導（あと{slots - used.length}回）</h2>
      {(s.vice ?? []).length > 0 && <div class="muted small">ほかに、副教官（担任）が担当学年の生徒を毎週{(s.vice ?? []).length}人、自動で指導します。</div>}
      {used.length > 0 && (
        <div class="card">
          <h3>今週の予定</h3>
          {used.map((t, i) => { const st = s.students[t.studentId]; return (
            <div class="row between"><span>{st?.given}：{t.kind === 'skill' ? `技能指導（${SKILL_NAMES[t.skill ?? 'sword']}）` : t.kind === 'consult' ? '相談にのる' : '面談'}</span>
              <button class="btn ghost small" onClick={() => act((g) => { g.plan.tutoring.splice(i, 1); if (t.kind === 'consult') g.consults.push(t.studentId); })}>取り消す</button></div>
          ); })}
        </div>
      )}
      {s.consults.length > 0 && (
        <div class="card">
          <h3>相談に来ている生徒</h3>
          {s.consults.map((id) => { const st = s.students[id]; if (!st) return null; return (
            <StuRow st={st} sub="「先生、少しいいですか」" right={<div class="row">
              <button class="btn small primary" disabled={used.length >= slots} onClick={(e) => { e.stopPropagation(); sfx('ok'); add(id, 'consult'); }}>受ける</button>
              <button class="btn small ghost" onClick={(e) => { e.stopPropagation(); if (confirm('断るとやる気が少し下がります。断りますか？')) act((g) => declineConsult(g, id)); }}>断る</button>
            </div>} />
          ); })}
        </div>
      )}
      <div class="seg" style={{ margin: '8px 0' }}>
        <button class={kind === 'skill' ? 'on' : ''} onClick={() => setKind('skill')}>技能指導</button>
        <button class={kind === 'talk' ? 'on' : ''} onClick={() => setKind('talk')}>面談</button>
      </div>
      <div class="muted small">{kind === 'skill' ? '1人の技能を大きく伸ばします（疲労+10）。才能も見えてきやすくなります。' : 'やる気が上がり、教官への信頼が深まります。退学の予兆も消せます。'}</div>
      <div class="card">
        {list.map((st) => (
          <div>
            <StuRow st={st} onClick={() => undefined} sub={`${moodIcon(st)} やる気${B.motivationLabel[st.motivation]}・疲労${Math.round(st.fatigue)}・信頼${Math.round(st.trust)}${st.dropoutSign ? '・⚠退学の予兆' : ''}${!available(st) ? '・休み中' : ''}`}
              right={kind === 'talk' ? <button class="btn small" disabled={!available(st) || used.length >= slots} onClick={() => { sfx('ok'); add(st.id, 'talk'); }}>面談</button> : undefined} />
            {kind === 'skill' && available(st) && (
              <div class="row" style={{ marginLeft: 54, marginBottom: 6 }}>
                {st.targets.map((k) => <button class="btn small" disabled={used.length >= slots} onClick={() => { sfx('ok'); add(st.id, 'skill', k); }}>{SKILL_NAMES[k]} {rankOf(st.skills[k])}</button>)}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function Weekend({ s }: { s: GameState }) {
  const n = weekendSlots(s);
  const list = enrolled(s).filter(available);
  const [mode, setMode] = useState<'tea' | 'spar' | null>(null);
  const [pick, setPick] = useState<string[]>([]);
  const [skill, setSkill] = useState<SkillId>('sword');
  const add = (w: WeekendAction) => act((g) => { if (g.plan.weekend.length < weekendSlots(g)) g.plan.weekend.push(w); });
  const name = (w: WeekendAction) => w.kind === 'rest' ? '休養（全員の疲労回復）' : w.kind === 'tea' ? `お茶会：${w.ids.map((id) => s.students[id]?.given).join('・')}` : w.kind === 'spar' ? `手合わせ：${w.ids.map((id) => s.students[id]?.given).join('と')}（${SKILL_NAMES[w.skill]}）` : `${w.grade}年生の食事会`;
  return (
    <div>
      <Back to={() => navigate({ tab: 'school' })} />
      <h2>週末の交流（{s.plan.weekend.length}／{n}）</h2>
      {s.month === 8 && <ArtSlot name="event_festival" />}
      {s.month === 8 && <div class="guide">収穫祭の月です。交流が1回多く、支援が上がりやすくなっています。</div>}
      {s.plan.weekend.map((w, i) => <div class="card row between"><span>{name(w)}</span><button class="btn ghost small" onClick={() => act((g) => { g.plan.weekend.splice(i, 1); })}>取り消す</button></div>)}
      {s.plan.weekend.length < n && !mode && (
        <div class="grid2">
          <button class="btn" onClick={() => { sfx('ok'); add({ kind: 'rest' }); }}>休養</button>
          <button class="btn" onClick={() => { setMode('tea'); setPick([]); }}>お茶会</button>
          <button class="btn" onClick={() => { setMode('spar'); setPick([]); }}>手合わせ</button>
          {[1, 2, 3].filter((g) => list.some((x) => x.grade === g)).map((g) => <button class="btn" onClick={() => { sfx('ok'); add({ kind: 'dinner', grade: g }); }}>{g}年の食事会</button>)}
        </div>
      )}
      <div class="muted small" style={{ marginTop: 6 }}>休養＝全員の疲労−25／お茶会＝2〜3人を招いて仲を深める・やる気↑／手合わせ＝2人の仲と技能↑・疲労↑／食事会＝学年全員のやる気↑</div>
      {mode && (
        <div class="card">
          <h3>{mode === 'tea' ? 'お茶会に招く生徒（2〜3人）' : '手合わせする2人'}</h3>
          {mode === 'spar' && <div class="row">技能：<select value={skill} onChange={(e) => setSkill((e.target as HTMLSelectElement).value as SkillId)}>{SKILLS.filter((k) => skillUnlocked(s, k)).map((k) => <option value={k}>{SKILL_NAMES[k]}</option>)}</select></div>}
          {list.map((st) => {
            const on = pick.includes(st.id);
            const sup = pick.filter((x) => x !== st.id).map((x) => { const v = supportValue(s, x, st.id); return `${s.students[x].given}と${supportRank(v) || '—'}`; }).join(' ');
            return <StuRow st={st} onClick={() => setPick(on ? pick.filter((x) => x !== st.id) : [...pick, st.id].slice(-(mode === 'tea' ? 3 : 2)))} sub={`${st.birthday && st.birthday.month === s.month && st.birthday.week === s.week ? '🎂今週が誕生日・' : ''}${PERSONALITIES[st.personality].name}${sup ? `・支援 ${sup}` : ''}`} right={<span style={{ fontSize: 22 }}>{on ? '☑' : '☐'}</span>} />;
          })}
          <div class="row">
            <button class="btn ghost" onClick={() => setMode(null)}>やめる</button>
            <button class="btn primary grow" disabled={pick.length < 2} onClick={() => { sfx('ok'); add(mode === 'tea' ? { kind: 'tea', ids: pick } : { kind: 'spar', ids: [pick[0], pick[1]], skill }); setMode(null); }}>決定</button>
          </div>
        </div>
      )}
    </div>
  );
}

const FAC_ICON: Record<string, string> = { training: 'sword', library: 'tome', stable: 'run', chapel: 'staff', dining: 'heart', range: 'target' };
const WICON: Record<string, string> = { sword: 'sword', lance: 'lance', axe: 'axe', bow: 'bow', magic: 'tome', holy: 'staff', staff: 'staff', gun: 'gun' };

function Facilities({ s }: { s: GameState }) {
  const ids = (Object.keys(B.facilities) as FacilityId[]).filter((f) => f !== 'range' || s.world.gunUnlocked);
  return (
    <div>
      <Back to={() => navigate({ tab: 'school' })} />
      <h2>施設・講師</h2>
      <div class="muted">所持金 {money(s.money)}・施設の維持費 毎月{money(upkeepCost(s))}（段階1つにつき{B.upkeepPerLevel}G）</div>
      {ids.map((f) => {
        const lv = s.facilities[f] ?? 0; const cost = facilityCost(s, f); const def = B.facilities[f];
        const eff = f === 'library' ? '魔道の伸び↑・才能が早く分かる' : f === 'chapel' ? '信仰の伸び↑・疲労が回復しやすい' : f === 'dining' ? 'やる気が下がりにくい・交流の会話が増える' : f === 'stable' ? '騎乗・飛行の伸び↑・騎兵/天馬の兵種試験が受けられる' : f === 'range' ? '銃・弓の伸び↑' : '剣・槍・斧の伸び↑';
        return (
          <div class="pcard" style={{ ['--band' as string]: lv >= 3 ? 'var(--gold)' : lv > 0 ? 'var(--main)' : '#cfc6b2' }}>
            <div class="row between nowrap">
              <div class="row nowrap gap8 grow"><span class="todoicon"><Icon name={FAC_ICON[f]} size={18} /></span><div class="grow"><span class="ptitle">{def.name}</span> <span class="pips">{[1, 2, 3].map((i) => <i class={i <= lv ? 'on' : ''} />)}</span>{lv === 0 && <span class="small muted">（ボロボロ）</span>}<div class="muted small">{eff}</div></div></div>
              {cost !== null ? <button class="btn small" disabled={s.money < cost} onClick={() => { sfx('ok'); act((g) => upgradeFacility(g, f)); }}>整備<br />{money(cost)}</button> : <span class="flag">最大</span>}
            </div>
          </div>
        );
      })}
      <h3>講師</h3>
      <div class="muted small">講師がいると、その科目の授業がよく伸びます。給料は毎月払い、毎年4月に少しずつ上がります（雇えるのは{B.teachers.max}人まで）。</div>
      {s.teachers.map((t) => <div class="pcard row between nowrap" style={{ ['--band' as string]: t.alumniId && s.students[t.alumniId] ? countryColor(s.students[t.alumniId].origin) : 'var(--main)' }}>{t.alumniId && s.students[t.alumniId] && <Portrait st={s.students[t.alumniId]} size={44} />}<div class="grow"><span class="ptitle">{t.name}</span>{t.alumniId ? <Chip tone="gold">卒業生</Chip> : ''}<div class="row nowrap gap6"><Icon name={skillIcon(t.skill)} size={16} />{SKILL_NAMES[t.skill]} <b class="rankbig">{rankOf(t.points)}</b></div><div class="muted small">月給 {money(t.salary)}</div></div><button class="btn ghost small" onClick={() => { if (confirm(`${t.name}に辞めてもらいますか？`)) act((g) => fireTeacher(g, t.id)); }}>解雇</button></div>)}
      {s.teacherCandidates.length > 0 && <h3>雇える講師（毎年4月に入れ替わり）</h3>}
      {s.teacherCandidates.map((t) => <div class="pcard row between nowrap" style={{ ['--band' as string]: '#cfc6b2' }}><div class="grow"><span class="ptitle">{t.name}</span><div class="row nowrap gap6"><Icon name={skillIcon(t.skill)} size={16} />{SKILL_NAMES[t.skill]} <b class="rankbig">{rankOf(t.points)}</b></div><div class="muted small">月給 {money(t.salary)}</div></div><button class="btn small" disabled={s.teachers.length >= B.teachers.max} onClick={() => { sfx('ok'); act((g) => hireTeacher(g, t.id)); }}>雇う</button></div>)}
      {s.teacherCandidates.length === 0 && <div class="muted">今は雇える講師がいません（4月に候補が来ます）</div>}
    </div>
  );
}

function Armory({ s }: { s: GameState }) {
  const counts: Record<string, number> = {};
  for (const a of s.armory) counts[a.weaponId] = (counts[a.weaponId] ?? 0) + 1;
  const shop = Object.values(WEAPONS).filter((w) => w.price > 0 && (w.type !== 'gun' || s.world.gunUnlocked));
  const typeName: Record<string, string> = { sword: '剣', lance: '槍', axe: '斧', bow: '弓', magic: '魔道', holy: '信仰', staff: '杖', gun: '銃' };
  return (
    <div>
      <Back to={() => navigate({ tab: 'school' })} />
      <h2>武器庫</h2>
      <div class="muted">武器は学校の共有物です。出撃の前に生徒へ割り当てます。耐久はありません。魔法（魔道・信仰）は買うものではなく、生徒が技能ランクを上げて覚えます。</div>
      <div class="weapongrid">
        {Object.entries(counts).map(([id, n]) => { const w = WEAPONS[id]; const eng = s.armory.filter((a) => a.weaponId === id && a.engraved).map((a) => a.engraved); return (
          <div class="pcard wcard" style={{ ['--band' as string]: eng.length ? 'var(--gold)' : 'var(--main)' }}>
            <div class="row nowrap gap6"><span class="todoicon"><Icon name={WICON[w.type]} size={18} /></span><span class="ptitle grow" style={{ fontSize: 15 }}>{w.name}</span><Num v={`×${n}`} /></div>
            <div class="small muted">{typeName[w.type]}・{w.rank}・威力{w.might}・命中{w.hit}</div>
            {eng.length > 0 && <div class="small" style={{ color: 'var(--gold)' }}>{eng.join('・')}の遺品</div>}
          </div>
        ); })}
      </div>
      <div class="muted small">道具：傷薬×{s.items.vulnerary}　特効薬×{s.items.elixir}</div>
      <h3>購入（所持金 {money(s.money)}）</h3>
      <div class="card">
        <div class="row between"><span>傷薬（HP+10）</span><button class="btn small" disabled={s.money < B.itemPrice.vulnerary} onClick={() => act((g) => buyItem(g, 'vulnerary'))}>{money(B.itemPrice.vulnerary)}</button></div>
        <div class="row between"><span>特効薬（HP全回復）</span><button class="btn small" disabled={s.money < B.itemPrice.elixir} onClick={() => act((g) => buyItem(g, 'elixir'))}>{money(B.itemPrice.elixir)}</button></div>
        {shop.map((w) => (
          <div class="row between" style={{ borderTop: '1px dashed var(--line)', paddingTop: 4 }}>
            <span class="grow">{w.name} <span class="muted small">{typeName[w.type]}・{w.rank}・威力{w.might}・命中{w.hit}・射程{w.minRange === w.maxRange ? w.minRange : `${w.minRange}-${w.maxRange}`}</span></span>
            <button class="btn small" disabled={s.money < w.price} onClick={() => { sfx('ok'); act((g) => buyWeapon(g, w.id, w.price)); }}>{money(w.price)}</button>
          </div>
        ))}
      </div>
    </div>
  );
}

function Mailbox({ s }: { s: GameState }) {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <div>
      <Back to={() => navigate({ tab: 'school' })} />
      <h2>郵便受け</h2>
      {s.mail.length === 0 && <div class="empty-note">まだ手紙は届いていません</div>}
      {s.mail.map((m) => (
        <div class="pcard tap" style={{ ['--band' as string]: m.studentId && s.students[m.studentId] ? countryColor(s.students[m.studentId].origin) : '#cfc6b2' }} onClick={() => { setOpen(open === m.id ? null : m.id); act((g) => { const x = g.mail.find((y) => y.id === m.id); if (x) x.read = true; }); }}>
          <div class="row between nowrap"><span class="row nowrap gap6">{m.studentId && s.students[m.studentId] ? <Portrait st={s.students[m.studentId]} size={36} /> : <Icon name="mail" size={20} />}<b>{m.read ? '' : <span class="flag red">未読</span>} {m.title}</b></span><span class="muted small">{m.year}年目</span></div>
          <div class="muted small">差出人：{m.from}</div>
          {open === m.id && <div class="serif" style={{ marginTop: 6 }}>{m.body}</div>}
        </div>
      ))}
    </div>
  );
}

export { Portrait, Bar };

const BG_NAMES: Record<string, string> = { knight: '元王国騎士', merc: '元帝国の傭兵', mage: '元同盟の宮廷魔道士', wanderer: '流れの旅人' };

function InstructorPage({ s }: { s: GameState }) {
  const ins = s.instructor;
  const caps = instructorCaps(s);
  const good = new Set(goodSkillsOf(s));
  const elig = viceEligible(s);
  const grades = [1, 2, 3];
  const me = ins.studentId ? s.students[ins.studentId] : null;
  return (
    <div>
      <Back to={() => navigate({ tab: 'school' })} />
      <div class="pcard" style={{ ['--band' as string]: me ? countryColor(me.origin) : 'var(--main)' }}>
        <div class="hero">
          <div class="hero-face"><TeacherFace s={s} size={84} /><span class="lvbadge">{ins.generation}代目</span></div>
          <div class="grow">
            <div class="nameline"><b class="given" style={{ fontSize: 22 }}>{ins.name}</b><span class="family">先生</span></div>
            <div class="small">{BG_NAMES[ins.background] ?? ''}{me ? `（${me.cohort}期生）` : ''}</div>
            <div class="infogrid"><div>年齢 <Num v={ins.age} unit="歳" /></div><div>在任 <Num v={s.year - (ins.since ?? 1)} unit="年" /></div><div>教えた生徒 <Num v={ins.experience} unit="人" /></div><div>魅力 <Num v={ins.cha} /></div></div>
            {ins.age >= B.instructor.retireMin && <div class="small muted">{B.instructor.retireMin}歳を過ぎたので、年度末に引退を選べます（{B.instructor.retireMax}歳で必ず引退）。</div>}
          </div>
        </div>
      </div>
      <div class="card">
        <h3>教官の技能ランク</h3>
        <div class="muted small">教えるほど少しずつ上がります（学年の重点科目にした週・個人指導で教えた回数）。上限は得意科目（★）が S、それ以外が B です。</div>
        <div class="skillgrid" style={{ marginTop: 6 }}>{SKILLS.filter((k) => skillUnlocked(s, k)).map((k) => <div><SkillBox k={k} p={ins.skills[k] ?? 0} target={good.has(k)} /><div class="small muted" style={{ textAlign: 'right' }}>{good.has(k) ? '★' : ''}上限{rankOf(caps[k])}</div></div>)}</div>
      </div>
      <div class="card">
        <h3>副教官（学年の担任）</h3>
        <div class="muted small">学校に残った卒業生の講師（講師になって{B.vice.minYears}年以上）を、1学年の担任にできます。担任は方針に沿って、担当学年の目標技能・重点科目・週末の過ごし方を自動で組み、毎週1人に個人指導をします（伸びは教官より少し小さめ）。教官はいつでも上書きできます。戦闘の指揮は任せません。</div>
        {grades.map((g) => {
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
                  {!elig.filter((t) => !(s.vice ?? []).some((x) => x.teacherId === t.id)).length && <span class="muted small">任せられる講師がいません（卒業生が「学校に残る」と講師になり、1年たつと担任にできます）</span>}
                </div>
              )}
            </div>
          );
        })}
      </div>
      {(s.pastInstructors ?? []).length > 0 && (
        <div class="card">
          <h3>歴代の教官</h3>
          {(s.pastInstructors ?? []).map((p) => <div class="row between small ruled"><span>{p.generation}代目 <b>{p.name}</b>（{BG_NAMES[p.background] ?? ''}）</span><span class="muted">{p.from}〜{p.to}年目・延べ{p.taught}人</span></div>)}
          <div class="row between small ruled"><span>{ins.generation}代目 <b>{ins.name}</b>（在任中）</span><span class="muted">{ins.since ?? 1}年目〜</span></div>
        </div>
      )}
    </div>
  );
}
