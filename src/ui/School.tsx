import { useState } from 'preact/hooks';
import { useStore, navigate, act } from './store';
import { enrolled, available } from '../core/game';
import { doSpotlight, bestTeacher, skillUnlocked } from '../core/week';
import { LessonBoard, TargetsPage } from './Lessons';
import { examCandidates } from '../core/exam';
import { rng } from '../core/flow';
import { StuRow, Back, money, Bar, moodIcon } from './common';
import { Portrait } from './Portrait';
import { SKILL_NAMES, PERSONALITIES, COUNTRY_SHORT } from '../data/people';
import { REP_TIERS, repTier } from '../data/discovery';
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
import { InstructorPage } from './Mentor';
import { Desk } from './Desk';
import { NewsPage } from './Newspaper';
import { MONTH_NAMES } from '../core/util';
const MONTH_NAMES_SHORT = (m: number) => MONTH_NAMES[m];
import { SkillBox, skillIcon, countryColor, LvBadge, ClassName, MoodDots, FatigueBar, Gauge, NameLine, MiniCard, Num, Chip, studentFlags } from './cards';
import { supportRank, supportValue } from '../core/support';

const GUIDE = [
  '毎日、授業のカードを1つ選びます。全員が伸び、顔が出ている子は特に伸びます。迷ったら「今週はおまかせ」で金曜まで進められます。',
  '顔に「目」の印がある子は、今月の目標技能の授業です。仲の良い子どうしが同じカードに出ると「友情タッグ」でさらに伸びます。',
  'お茶会・面談などの交流もカードで出ます。体力が減ってきたら「休講」で休ませましょう。',
  '4週目の金曜が終わると月末の戦闘です。最初は「演習」がおすすめ。演習では誰も死にません。',
];

export function SchoolTab() {
  const { s, route } = useStore();
  if (!s) return null;
  if (route.page === 'lessons' || route.page === 'targets') return <TargetsPage s={s} />;
  if (route.page === 'facilities') return <Facilities s={s} />;
  if (route.page === 'armory') return <Armory s={s} />;
  if (route.page === 'mail') return <Mailbox s={s} />;
  if (route.page === 'instructor') return <InstructorPage s={s} />;
  if (route.page === 'today') return <TodayPage s={s} />;
  if (route.page === 'notebook') return <Notebook s={s} />;
  if (route.page === 'news') return <NewsPage s={s} />;
  return <Desk s={s} />;
}

/** 今日の授業（8夜目：ホームの「本日の授業を命ず」から。授業の札を机の上に並べる） */
function TodayPage({ s }: { s: GameState }) {
  const guideOn = s.settings.guide && s.year === 1 && s.month === 0;
  return (
    <div class="todaypage">
      <div class="today-top"><Back to={() => navigate({ tab: 'school' })} /><MonthCalendar s={s} compact /></div>
      {s.month === 3 && <ArtSlot name="event_camp" />}
      {s.month === 8 && <ArtSlot name="event_festival" />}
      {guideOn && <div class="guide">{GUIDE[Math.min(GUIDE.length - 1, s.week - 1)]}</div>}
      {!s.pending.length && !s.battle && <LessonBoard s={s} />}
    </div>
  );
}

/** 教官手帳（8夜目：机の手帳を開いた頁。今月の主役・やること・お知らせ・学校のこと） */
function Notebook({ s }: { s: GameState }) {
  const list = enrolled(s);
  const todo: { text: string; go: () => void; red?: boolean; icon?: string }[] = [];
  if (s.week === 1 && (s.day ?? 1) === 1) todo.push({ text: '今月の目標技能を決めよう（自動の子は決まっています）', go: () => navigate({ tab: 'school', page: 'targets' }), icon: 'lesson', red: true });
  for (const id of s.consults) { const st = s.students[id]; if (st) todo.push({ icon: 'talk', text: `相談：${st.given}「先生、少しいいですか」（面談のカードで話せます）`, go: () => navigate({ tab: 'students', page: 'detail', id }), red: true }); }
  const ex = examCandidates(s);
  if (ex.length) todo.push({ icon: 'exam', text: `兵種試験を受けられる生徒が${ex.length}人（${ex.map((x) => x.given).join('・')}）`, go: () => navigate({ tab: 'students', page: 'exam' }), red: true });
  for (const st of list) {
    if (st.dropoutSign) todo.push({ icon: 'bell', text: `退学の予兆：${st.given}（面談のカードで話を聞こう）`, go: () => navigate({ tab: 'students', page: 'detail', id: st.id }), red: true });
    if (st.motivation <= 0) todo.push({ icon: 'bell', text: `やる気がとても低い：${st.given}`, go: () => navigate({ tab: 'students', page: 'detail', id: st.id }) });
  }
  for (const st of list) if (st.birthday && st.birthday.month === s.month && st.birthday.week === s.week) todo.push({ icon: 'cake', text: `今週は${st.given}の誕生日（お茶会のカードに出やすい）`, go: () => navigate({ tab: 'students', page: 'detail', id: st.id }) });
  const unread = s.mail.filter((m) => !m.read).length;
  if (unread) todo.push({ icon: 'mail', text: `郵便受けに未読の手紙が${unread}通`, go: () => navigate({ tab: 'school', page: 'mail' }) });
  const [spotMsg, setSpotMsg] = useState('');
  return (
    <div class="deskpage">
      <Back to={() => navigate({ tab: 'school' })} />
      <div class="ledger"><div class="row between nowrap"><h2 class="ledger-title" style={{ margin: 0 }}>教官手帳</h2><span class="stamp">{MONTH_NAMES_SHORT(s.month)}</span></div><div class="small muted">{s.year}年目 {MONTH_NAMES_SHORT(s.month)} 第{s.week}週。やること・お知らせ・学校のこと。</div></div>
      <RepLedger s={s} />
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
              <button class="btn ghost iconbtn" onClick={() => navigate({ tab: 'school', page: 'targets' })}><Icon name="lesson" /> 目標技能</button>
              <button class="btn ghost iconbtn" onClick={() => navigate({ tab: 'school', page: 'facilities' })}><Icon name="house" /> 施設・講師</button>
              <button class="btn ghost iconbtn" onClick={() => navigate({ tab: 'school', page: 'armory' })}><Icon name="sword" /> 武器庫</button>
              <button class="btn ghost iconbtn" onClick={() => navigate({ tab: 'school', page: 'mail' })}><Icon name="mail" /> 郵便受け{unread ? `（${unread}）` : ''}</button>
              <button class="btn ghost iconbtn" onClick={() => navigate({ tab: 'school', page: 'instructor' })}><Icon name="students" /> 教官・副教官</button>
            </div>
            <div class="muted" style={{ marginTop: 6 }}>在籍 {list.length}人・講師 {s.teachers.length}人・評判 {Math.round(s.reputation)}／100{s.world.vassal ? `（${COUNTRY_SHORT[s.world.vassal]}の傘下。評判${B.school.independenceRep}で独立を取り戻せる）` : ''}</div>
          </div>
        </div>
      </div>
      <div style={{ height: 50 }} />
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
        const eff = f === 'library' ? '魔道の伸び↑・才能が早く分かる' : f === 'chapel' ? '信仰の伸び↑・先生の体力が回復しやすい' : f === 'dining' ? 'やる気が下がりにくい・交流の会話が増える' : f === 'stable' ? '騎乗・飛行の伸び↑・騎兵/天馬の兵種試験が受けられる' : f === 'range' ? '銃・弓の伸び↑' : '剣・槍・斧の伸び↑';
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

/** 評判の段階（8夜目：廃校の期限の代わりの序盤の目標）。次の段階までのゲージ */
function RepLedger({ s }: { s: GameState }) {
  const t = repTier(s.reputation);
  const cur = REP_TIERS[t], next = REP_TIERS[t + 1];
  const pct = next ? Math.round(((s.reputation - cur.at) / (next.at - cur.at)) * 100) : 100;
  return (
    <div class="ledger">
      <h3 class="ledger-title">学校の評判</h3>
      <div class="row between nowrap"><b class="serif" style={{ fontSize: 18 }}>{cur.name}</b><span class="small muted">評判 {Math.round(s.reputation)}</span></div>
      <div class="rep-steps">{REP_TIERS.map((x, i) => <span class={i < t ? 'past' : i === t ? 'now' : ''}>{x.name}</span>)}</div>
      {next ? <><div class="row nowrap gap6"><span class="gauge skill grow"><span style={{ width: `${pct}%` }} /></span><span class="small">「{next.name}」まで あと{Math.ceil(next.at - s.reputation)}</span></div>
        <div class="small muted">評判が上がると、入学の志願者と寄付が増え、教え子に声がかかりやすくなります。依頼に勝つ・演武会・卒業生の活躍で上がります。</div></> : <div class="small">これ以上ない、伝説の学び舎です。</div>}
      {s.world.vassal && <div class="small" style={{ color: 'var(--accent)' }}>いまは{COUNTRY_SHORT[s.world.vassal]}の傘下。評判{B.school.independenceRep}で、年度末に独立を取り戻せます。</div>}
    </div>
  );
}

export { InstructorPage } from './Mentor';
