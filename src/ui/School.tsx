import { useState } from 'preact/hooks';
import { useStore, navigate, act } from './store';
import { enrolled, available } from '../core/game';
import { doSpotlight, bestTeacher, skillUnlocked } from '../core/week';
import { LessonBoard, TargetsPage } from './Lessons';
import { examCandidates } from '../core/exam';
import { rng } from '../core/flow';
import { StuRow, Back, money, Bar, moodIcon, HelpTip } from './common';
import { Portrait } from './Portrait';
import { SKILL_NAMES, PERSONALITIES, COUNTRY_SHORT } from '../data/people';
import { REP_TIERS, repTier } from '../data/discovery';
import { B, SKILLS } from '../data/balance';
import { stockList } from '../core/loot';
import { WEAPONS } from '../data/weapons';
import { facilityCost, upgradeFacility, hireTeacher, fireTeacher, buyItem, upkeepCost, type FacilityId } from '../core/teachers';
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
  '毎日、授業のカードを1つ選びます。顔が見えている子は、とくによく伸びます。迷ったら「今週はおまかせ」を押すと、金曜まで進みます。',
  '「目」の印がある子は、今月の目標の授業なので、よく伸びます。仲のよい子が同じカードにそろうと、友情タッグでさらに伸びます。',
  'お茶会や面談も、授業のカードとして出てきます。先生の体力が減ってきたら、「休講」で休みましょう。',
  '4週目の金曜が終わると、月末の出撃です。はじめは「演習」を選びましょう。演習では誰も死にません。',
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
  if (s.week === 1 && (s.day ?? 1) === 1) todo.push({ text: '今月の目標の技能を決めましょう（「自動」の子は決まっています）', go: () => navigate({ tab: 'school', page: 'targets' }), icon: 'lesson', red: true });
  for (const id of s.consults) { const st = s.students[id]; if (st) todo.push({ icon: 'talk', text: `${st.given}「先生、少しいいですか」。面談のカードで話を聞けます`, go: () => navigate({ tab: 'students', page: 'detail', id }), red: true }); }
  const ex = examCandidates(s);
  if (ex.length) todo.push({ icon: 'exam', text: `兵種試験を受けられる子が${ex.length}人います（${ex.map((x) => x.given).join('、')}）`, go: () => navigate({ tab: 'students', page: 'exam' }), red: true });
  for (const st of list) {
    if (st.dropoutSign) todo.push({ icon: 'bell', text: `${st.given}が学校をやめたがっています。面談のカードで話を聞きましょう`, go: () => navigate({ tab: 'students', page: 'detail', id: st.id }), red: true });
    if (st.motivation <= 0) todo.push({ icon: 'bell', text: `${st.given}のやる気が、とても下がっています`, go: () => navigate({ tab: 'students', page: 'detail', id: st.id }) });
  }
  for (const st of list) if (st.birthday && st.birthday.month === s.month && st.birthday.week === s.week) todo.push({ icon: 'cake', text: `今週は${st.given}の誕生日です。お茶会のカードに出てきやすくなります`, go: () => navigate({ tab: 'students', page: 'detail', id: st.id }) });
  const unread = s.mail.filter((m) => !m.read).length;
  if (unread) todo.push({ icon: 'mail', text: `郵便受けに、まだ読んでいない手紙が${unread}通あります`, go: () => navigate({ tab: 'school', page: 'mail' }) });
  const [spotMsg, setSpotMsg] = useState('');
  return (
    <div class="deskpage">
      <Back to={() => navigate({ tab: 'school' })} />
      <div class="ledger"><div class="row between nowrap"><h2 class="ledger-title" style={{ margin: 0 }}>教官手帳</h2><span class="stamp">{MONTH_NAMES_SHORT(s.month)}</span></div><div class="small muted">{s.year}年目 {MONTH_NAMES_SHORT(s.month)} 第{s.week}週です。やることやお知らせを、ここにまとめています。</div></div>
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
            {s.notices.length === 0 && <div class="muted">まだお知らせはありません</div>}
            <ul class="list">{[...s.notices].reverse().slice(0, 8).map((n) => <li class="small" onClick={() => n.studentId && navigate({ tab: 'students', page: 'detail', id: n.studentId })}>{n.text}</li>)}</ul>
            {s.notices.length > 0 && <button class="btn ghost small" onClick={() => act((g) => { g.notices = []; })}>お知らせを消す</button>}
          </div>
          <div class="card">
            <h3>学校のこと</h3>
            <div class="grid2">
              <button class="btn ghost iconbtn" onClick={() => navigate({ tab: 'school', page: 'targets' })}><Icon name="lesson" /> 今月の目標</button>
              <button class="btn ghost iconbtn" onClick={() => navigate({ tab: 'school', page: 'facilities' })}><Icon name="house" /> 施設・講師</button>
              <button class="btn ghost iconbtn" onClick={() => navigate({ tab: 'school', page: 'armory' })}><Icon name="sword" /> 武器庫</button>
              <button class="btn ghost iconbtn" onClick={() => navigate({ tab: 'school', page: 'mail' })}><Icon name="mail" /> 郵便受け{unread ? `（${unread}）` : ''}</button>
              <button class="btn ghost iconbtn" onClick={() => navigate({ tab: 'school', page: 'instructor' })}><Icon name="students" /> 教官・副教官</button>
            </div>
            <div class="muted" style={{ marginTop: 6 }}>在籍 {list.length}人・講師 {s.teachers.length}人・評判 {Math.round(s.reputation)}／100{s.world.vassal ? `（${COUNTRY_SHORT[s.world.vassal]}の傘下です。評判が${B.school.independenceRep}になれば、独立を取り戻せます）` : ''}</div>
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
      <div class="muted">所持金 {money(s.money)}。施設の維持費は毎月{money(upkeepCost(s))}です。<HelpTip text={`施設の段階1つにつき、毎月${B.upkeepPerLevel}Gかかります。`} /></div>
      {ids.map((f) => {
        const lv = s.facilities[f] ?? 0; const cost = facilityCost(s, f); const def = B.facilities[f];
        const eff = f === 'library' ? '魔道がよく伸びます。眠った芽も早く見えます' : f === 'chapel' ? '信仰がよく伸びます。先生の体力も戻りやすくなります' : f === 'dining' ? 'やる気が下がりにくく、交流の会話が増えます' : f === 'stable' ? '騎乗と飛行がよく伸びます。騎兵と天馬の兵種試験も受けられます' : f === 'range' ? '銃と弓がよく伸びます' : '剣と槍と斧がよく伸びます';
        return (
          <div class="pcard" style={{ ['--band' as string]: lv >= 3 ? 'var(--gold)' : lv > 0 ? 'var(--main)' : '#cfc6b2' }}>
            <div class="row between nowrap">
              <div class="row nowrap gap8 grow"><span class="todoicon"><Icon name={FAC_ICON[f]} size={18} /></span><div class="grow"><span class="ptitle">{def.name}</span> <span class="pips">{[1, 2, 3].map((i) => <i class={i <= lv ? 'on' : ''} />)}</span>{lv === 0 && <span class="small muted">（ボロボロ）</span>}<div class="muted small">{eff}</div></div></div>
              {cost !== null ? <button class="btn small" disabled={s.money < cost} onClick={() => { sfx('ok'); act((g) => upgradeFacility(g, f)); }}>直す<br />{money(cost)}</button> : <span class="flag">最大</span>}
            </div>
          </div>
        );
      })}
      <h3>講師</h3>
      <div class="muted small">講師がいると、その科目の授業でよく伸びます。給料は毎月払います。<HelpTip text={`給料は毎年4月に少しずつ上がります。講師は${B.teachers.max}人まで雇えます。`} /></div>
      {s.teachers.map((t) => <div class="pcard row between nowrap" style={{ ['--band' as string]: t.alumniId && s.students[t.alumniId] ? countryColor(s.students[t.alumniId].origin) : 'var(--main)' }}>{t.alumniId && s.students[t.alumniId] && <Portrait st={s.students[t.alumniId]} size={44} />}<div class="grow"><span class="ptitle">{t.name}</span>{t.alumniId ? <Chip tone="gold">卒業生</Chip> : ''}<div class="row nowrap gap6"><Icon name={skillIcon(t.skill)} size={16} />{SKILL_NAMES[t.skill]} <b class="rankbig">{rankOf(t.points)}</b></div><div class="muted small">月給 {money(t.salary)}</div></div><button class="btn ghost small" onClick={() => { if (confirm(`${t.name}に辞めてもらいますか？`)) act((g) => fireTeacher(g, t.id)); }}>辞めてもらう</button></div>)}
      {s.teacherCandidates.length > 0 && <h3>雇える講師（毎年4月に入れかわります）</h3>}
      {s.teacherCandidates.map((t) => <div class="pcard row between nowrap" style={{ ['--band' as string]: '#cfc6b2' }}><div class="grow"><span class="ptitle">{t.name}</span><div class="row nowrap gap6"><Icon name={skillIcon(t.skill)} size={16} />{SKILL_NAMES[t.skill]} <b class="rankbig">{rankOf(t.points)}</b></div><div class="muted small">月給 {money(t.salary)}</div></div><button class="btn small" disabled={s.teachers.length >= B.teachers.max} onClick={() => { sfx('ok'); act((g) => hireTeacher(g, t.id)); }}>雇う</button></div>)}
      {s.teacherCandidates.length === 0 && <div class="muted">今は雇える講師がいません。4月になると、新しい候補が来ます</div>}
    </div>
  );
}

function Armory({ s }: { s: GameState }) {
  const typeName: Record<string, string> = { sword: '剣', lance: '槍', axe: '斧', bow: '弓', magic: '魔道', holy: '信仰', staff: '杖', gun: '銃' };
  const named = s.armory.filter((a) => a.named);
  const keep = s.armory.filter((a) => !a.named && a.engraved);
  const counts: Record<string, number> = {};
  for (const a of s.armory) if (!a.named && !a.engraved) counts[a.weaponId] = (counts[a.weaponId] ?? 0) + 1;
  const stock = stockList(s);
  return (
    <div>
      <Back to={() => navigate({ tab: 'school' })} />
      <h2>武器庫</h2>
      <div class="muted">戦いで手に入れた武器が並んでいます。出撃のときは、その子にいちばん合う武器を自動で持たせます。出撃前の画面で、持ちかえることもできます。</div>
      <h3>銘入りの武器 <span class="muted small">{named.length}振り</span></h3>
      {named.length === 0 && <div class="empty-note">敵将を討ち取ると、その敵将の武器が手に入ります</div>}
      {named.map((a) => { const w = WEAPONS[a.weaponId]; const by = a.named!.by ? s.students[a.named!.by] : null; return (
        <div class="pcard wcard named" style={{ ['--band' as string]: 'var(--gold)' }}>
          <div class="row nowrap gap6"><span class="todoicon"><Icon name={WICON[w.type]} size={20} /></span><b class="serif grow">{a.named!.name}</b>{by && <Portrait st={by} size={28} />}</div>
          <div class="small muted">{w.name}・威力{w.might + a.named!.might}・命中{w.hit + a.named!.hit}・{w.rank}</div>
          <div class="small">{a.named!.story}</div>
        </div>
      ); })}
      <h3>戦利品と、もらった武器</h3>
      {Object.keys(counts).length === 0 && <div class="empty-note">敵兵が落とした武器や、依頼でもらった武器が、ここに入ります</div>}
      <div class="weapongrid">
        {Object.entries(counts).map(([id, n]) => { const w = WEAPONS[id]; return (
          <div class="pcard wcard" style={{ ['--band' as string]: 'var(--main)' }}>
            <div class="row nowrap gap6"><span class="todoicon"><Icon name={WICON[w.type]} size={18} /></span><span class="ptitle grow" style={{ fontSize: 15 }}>{w.name}</span><Num v={`×${n}`} /></div>
            <div class="small muted">{typeName[w.type]}・{w.rank}・威力{w.might}・命中{w.hit}</div>
          </div>
        ); })}
      </div>
      {keep.length > 0 && <><h3>卒業生の遺品</h3><div class="weapongrid">{keep.map((a) => <div class="pcard wcard" style={{ ['--band' as string]: 'var(--gold)' }}><b class="small">{WEAPONS[a.weaponId]?.name}</b><div class="small" style={{ color: 'var(--gold)' }}>{a.engraved}の遺品</div></div>)}</div></>}
      <h3>学校の備え</h3>
      <div class="small muted">鉄の武器は、学校にいつでもいくつでもそろっています。{stock.map((a) => WEAPONS[a.weaponId].name).join('、')}</div>
      <h3>道具（所持金 {money(s.money)}）</h3>
      <div class="card">
        <div class="muted small">傷薬 {s.items.vulnerary}個　特効薬 {s.items.elixir}個</div>
        <div class="row between"><span>傷薬（HPが10戻る）</span><button class="btn small" disabled={s.money < B.itemPrice.vulnerary} onClick={() => act((g) => buyItem(g, 'vulnerary'))}>{money(B.itemPrice.vulnerary)}で買う</button></div>
        <div class="row between"><span>特効薬（HPがすべて戻る）</span><button class="btn small" disabled={s.money < B.itemPrice.elixir} onClick={() => act((g) => buyItem(g, 'elixir'))}>{money(B.itemPrice.elixir)}で買う</button></div>
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
        <div class="small muted">評判が上がると、入学したい子や寄付が増えます。教え子にも声がかかりやすくなります。依頼に勝ったり、演武会や卒業生が活躍したりすると上がります。</div></> : <div class="small">これ以上ない、伝説の学び舎です。</div>}
      {s.world.vassal && <div class="small" style={{ color: 'var(--accent)' }}>いまは{COUNTRY_SHORT[s.world.vassal]}の傘下です。評判が{B.school.independenceRep}になれば、年度末に独立を取り戻せます。</div>}
    </div>
  );
}

export { InstructorPage } from './Mentor';
