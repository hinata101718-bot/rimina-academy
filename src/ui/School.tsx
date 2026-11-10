import { useState } from 'preact/hooks';
import { useStore, navigate, act } from './store';
import { enrolled, available, readAllMail, mailImportant, importantUnread } from '../core/game';
import { doSpotlight, bestTeacher, skillUnlocked } from '../core/week';
import { LessonBoard, TargetsPage } from './Lessons';
import { examCandidates } from '../core/exam';
import { rng } from '../core/flow';
import { StuRow, Back, money, Bar, moodIcon, HelpTip } from './common';
import { Portrait } from './Portrait';
import { SKILL_NAMES, PERSONALITIES, COUNTRY_SHORT } from '../data/people';
import { REP_TIERS, repTier } from '../data/discovery';
import { B, SKILLS } from '../data/balance';
import { stockList, STOCK_IDS } from '../core/loot';
import { rarityOf, itemName, itemMod } from '../core/rarity';
import { RARITY_COLOR, RARITY_NAME, RARITY_ORDER, AFFIXES, LEGENDS, LEGEND_BY_ID, type Rarity } from '../data/rarity';
import type { ArmoryItem } from '../core/state';
import { WEAPONS, ARMS } from '../data/weapons';
import { Ledger } from './Nemesis';
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
import { Desk, deskTodos } from './Desk';
import { GuideSeal } from './Guide';
import { firstLessonDay } from '../core/tutorial';
import { NewsPage } from './Newspaper';
import { MONTH_NAMES } from '../core/util';
const MONTH_NAMES_SHORT = (m: number) => MONTH_NAMES[m];
import { SkillBox, skillIcon, countryColor, LvBadge, ClassName, MoodDots, FatigueBar, Gauge, NameLine, MiniCard, Num, Chip, studentFlags } from './cards';
import { supportRank, supportValue } from '../core/support';

export function SchoolTab() {
  const { s, route } = useStore();
  if (!s) return null;
  if (route.page === 'lessons' || route.page === 'targets') return <TargetsPage s={s} />;
  if (route.page === 'facilities' || route.page === 'ledger') return <div><Back to={() => navigate({ tab: 'school' })} /><Ledger key={route.id ?? 'top'} s={s} focus={route.id} /></div>;
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
  return (
    <div class="todaypage">
      <div class="today-top"><Back to={() => navigate({ tab: 'school' })} /><MonthCalendar s={s} compact /></div>
      {s.month === 3 && <ArtSlot name="event_camp" />}
      {s.month === 8 && <ArtSlot name="event_festival" />}
      {firstLessonDay(s) && !s.pending.length && <div class="guide-tip" style={{ margin: '8px 0', display: 'flex', gap: 8, alignItems: 'center' }}><GuideSeal size={36} /><span class="serif small" style={{ flex: 1, minWidth: 0, whiteSpace: 'normal' }}>今日は札が3枚だけです。どれを選んでも、みんな伸びますぞ。札に顔が出ている子は、とくによく伸びます。</span></div>}
      {!s.pending.length && !s.battle && <LessonBoard s={s} />}
    </div>
  );
}

/** 教官手帳（8夜目：机の手帳を開いた頁）。15夜目：やること一覧は机の手帳と同じもの。今月の主役は月のはじめに自動で声をかける */
function Notebook({ s }: { s: GameState }) {
  const list = enrolled(s);
  const todo = deskTodos(s);
  return (
    <div class="deskpage">
      <Back to={() => navigate({ tab: 'school' })} />
      <div class="ledger"><div class="row between nowrap"><h2 class="ledger-title" style={{ margin: 0 }}>教官手帳</h2><span class="stamp">{MONTH_NAMES_SHORT(s.month)}</span></div><div class="small muted">{s.year}年目 {MONTH_NAMES_SHORT(s.month)} 第{s.week}週</div></div>
      <div class="two">
        <div>
          <div class="card">
            <h3>やること一覧</h3>
            {!todo.length && <div class="muted">いまは、とくにありません</div>}
            <ul class="list todo">
              {todo.map((t) => <li onClick={() => { sfx('move'); t.go(); }}><span class={`todoicon${t.red ? ' red' : ''}`}><Icon name={t.icon} size={18} /></span><span class="grow">{t.text}</span><span class="muted">›</span></li>)}
            </ul>
          </div>
          {s.spotlight.length > 0 && (
            <div class="card">
              <h3>今月の主役 <span class="small muted">先生が声をかけました</span></h3>
              <div class="facecards">
                {s.spotlight.map((sp) => { const st = s.students[sp.id]; if (!st) return null; const c = countryColor(st.origin); return (
                  <div class="facecard band" style={{ ['--band' as string]: c }} onClick={() => navigate({ tab: 'students', page: 'detail', id: st.id })}>
                    <div class="mc-face"><Portrait st={st} size={64} frame={c} /><LvBadge lv={st.level} /></div>
                    <div class="grow">
                      <NameLine st={st} size={17} family={false} />
                      <div class="small">{sp.text}</div>
                      {sp.res && <div class="small muted">{sp.res}</div>}
                    </div>
                  </div>
                ); })}
              </div>
            </div>
          )}
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
          <RepLedger s={s} />
          <div class="muted small" style={{ margin: '6px 4px' }}>在籍 {list.length}人・評判 {Math.round(s.reputation)}／100</div>
        </div>
      </div>
      <div style={{ height: 50 }} />
    </div>
  );
}

const FAC_ICON: Record<string, string> = { training: 'sword', library: 'tome', stable: 'run', chapel: 'staff', dining: 'heart', range: 'target' };
const WICON: Record<string, string> = { sword: 'sword', lance: 'lance', axe: 'axe', bow: 'bow', magic: 'tome', holy: 'staff', staff: 'staff', gun: 'gun' };

function Armory({ s }: { s: GameState }) {
  // 15夜目：棚ごとにたたむ（伝説の棚だけ開いておく）。レアの棚は武器の名前ごとにまとめる
  const [opened, setOpened] = useState<Set<string>>(() => new Set(['legend']));
  const toggleShelf = (r: string) => { sfx('move'); const n = new Set(opened); if (n.has(r)) n.delete(r); else n.add(r); setOpened(n); };
  const [group, setGroup] = useState<string | null>(null);
  const groups = (list: ArmoryItem[]) => { const m = new Map<string, ArmoryItem[]>(); for (const a of list) { if (!WEAPONS[a.weaponId]) continue; m.set(a.weaponId, [...(m.get(a.weaponId) ?? []), a]); } return [...m.entries()].sort((x, y) => y[1].length - x[1].length); };
  const [open, setOpen] = useState<string | null>(null);
  const typeName: Record<string, string> = { sword: '剣', lance: '槍', axe: '斧', bow: '弓', magic: '魔道', holy: '信仰', staff: '杖', gun: '銃' };
  const stock = stockList(s);
  const shelf = (r: Rarity) => s.armory.filter((a) => rarityOf(a) === r && !(r === 'normal' && !a.engraved));
  const card = (a: ArmoryItem) => {
    const w = WEAPONS[a.weaponId]; if (!w) return null;
    const r = rarityOf(a); const m = itemMod(a); const L = a.legend ? LEGEND_BY_ID[a.legend] : null;
    const by = a.named?.by ? s.students[a.named.by] : null;
    const users = Object.entries(a.uses ?? {}).sort((x, y) => y[1] - x[1]).map(([id]) => s.students[id]).filter((x) => x && x.status === 'enrolled');
    return (
      <div class={`pcard wcard rar-${r}`} style={{ ['--band' as string]: RARITY_COLOR[r] }} onClick={() => setOpen(open === a.uid ? null : a.uid)}>
        <div class="row nowrap gap6"><span class="todoicon"><Icon name={WICON[w.type]} size={18} /></span><b class={`grow ${r === 'legend' || r === 'unique' ? 'serif' : 'ptitle'}`} style={{ fontSize: 15 }}>{itemName(a)}</b>{by && <Portrait st={by} size={26} />}</div>
        <div class="small muted">{typeName[w.type]}・{w.rank}・威力{w.might + (m.dmg ?? 0)}・命中{w.hit + (m.hit ?? 0)}{m.crit ? `・必殺+${m.crit}` : ''}{m.avo ? `・回避+${m.avo}` : ''}{m.def ? `・守備+${m.def}` : ''}</div>
        {(a.affix ?? []).length > 0 && <div class="small">{(a.affix ?? []).map((k) => AFFIXES[k]).map((f) => `${f.name}：${f.text}`).join('　')}</div>}
        {L && <div class="small"><b>{L.art}</b>：{L.artText}<br /><span class="muted">持ち主を選ぶ：{L.cond.text}</span></div>}
        {a.engraved && <div class="small" style={{ color: 'var(--gold)' }}>{a.engraved}の遺品</div>}
        {open === a.uid && <div class="small" style={{ marginTop: 4 }}>
          {a.named && <p class="serif" style={{ margin: '4px 0' }}>{a.named.story}</p>}
          {L && L.lore.map((x) => <p class="serif" style={{ margin: '4px 0' }}>{x}</p>)}
          {a.got && <div class="muted">{a.got.year}年目：{a.got.text}</div>}
          {users.length > 0 && <div class="muted">よく使う子：{users.slice(0, 3).map((x) => x!.given).join('、')}</div>}
        </div>}
      </div>
    );
  };
  return (
    <div>
      <Back to={() => navigate({ tab: 'school' })} />
      <h2>武器庫</h2>
      <div class="muted">戦いで手に入れた武器が、棚に並んでいます。出撃のときは、その子にいちばん合う武器を自動で持たせます。札を押すと、くわしく見られます。</div>
      {RARITY_ORDER.filter((r) => r !== 'normal').map((r) => { const list = shelf(r); const isOpen = opened.has(r); return (
        <div class={`shelf rar-${r}`} style={{ ['--rar' as string]: RARITY_COLOR[r] }}>
          <button class="shelf-head" disabled={!list.length} onClick={() => toggleShelf(r)}><span class="rar-tag">{RARITY_NAME[r]}</span><span class="grow muted small">{list.length ? `${list.length}振り` : r === 'legend' ? 'まだありません（大陸に12振り）' : r === 'unique' ? 'まだありません（敵将を討ち取ると手に入ることがあります）' : 'まだありません'}</span>{list.length > 0 && <span class="muted">{isOpen ? '▲' : '▼'}</span>}</button>
          {isOpen && (r === 'rare' ? groups(list).map(([wid, xs]) => (
            <div>
              <div class="row between nowrap ruled tap" style={{ minHeight: 44 }} onClick={() => setGroup(group === wid ? null : wid)}><span><Icon name={WICON[WEAPONS[wid].type]} size={16} /> {WEAPONS[wid].name} <span class="muted small">{xs.length}振り{xs.some((x) => (x.affix ?? []).length) ? `（添え名つき${xs.filter((x) => (x.affix ?? []).length).length}）` : ''}</span></span><span class="muted">{group === wid ? '▲' : '▼'}</span></div>
              {group === wid && <div class="weapongrid">{xs.map(card)}</div>}
            </div>
          )) : <div class="weapongrid">{list.map(card)}</div>)}
        </div>
      ); })}
      {shelf('normal').length > 0 && <><h3>卒業生の遺品</h3><div class="weapongrid">{shelf('normal').map(card)}</div></>}
      <div class="small muted" style={{ marginTop: 10 }}>ノーマル（鉄の武器）は、学校にいつでもいくつでもそろっています：{stock.map((a) => WEAPONS[a.weaponId].name).join('、')}</div>
      <button class="btn ghost small" style={{ marginTop: 6 }} onClick={() => navigate({ tab: 'yearbook', page: 'book', sub: 'weapon' })}>武器の図鑑を見る（年鑑）</button>
      <div class="small muted" style={{ marginTop: 10 }}>道具：傷薬 {s.items.vulnerary}個・特効薬 {s.items.elixir}個（毎月のはじめに、傷薬{B.restock.vulnerary}個・特効薬{B.restock.elixir}個まで自動で補充します。所持金が{B.restock.keep}Gより少ないときは補充しません）</div>
    </div>
  );
}

/** 武器の図鑑（14夜目）：手に入れたことのある武器は名前が見える。伝説の武器は「？」の影から埋まる */
export function WeaponBook({ s }: { s: GameState }) {
  const seen = new Set(s.weaponSeen ?? []);
  for (const a of s.armory) seen.add(a.weaponId);
  const arms = ARMS.filter((w) => !STOCK_IDS.has(w.id) && (w.type !== 'gun' || s.world.gunUnlocked || seen.has(w.id)));
  const nLeg = LEGENDS.filter((l) => seen.has(`legend:${l.id}`)).length;
  // 15夜目：レアリティで切り替える（長い画面を短く）
  const [view, setView] = useState<'legend' | 'rare'>('legend');
  return (
    <div>
      <div class="seg" style={{ marginBottom: 6 }}><button class={view === 'legend' ? 'on' : ''} onClick={() => setView('legend')}>{RARITY_NAME.legend} {nLeg}／{LEGENDS.length}</button><button class={view === 'rare' ? 'on' : ''} onClick={() => setView('rare')}>{RARITY_NAME.rare} {arms.filter((w) => seen.has(w.id)).length}／{arms.length}</button></div>
      {view === 'legend' && <>
      <h3><span class="rar-tag" style={{ ['--rar' as string]: RARITY_COLOR.legend }}>{RARITY_NAME.legend}</span> <span class="muted small">{nLeg}／{LEGENDS.length}</span></h3>
      <div class="weapongrid">
        {LEGENDS.map((l) => { const k = seen.has(`legend:${l.id}`); const v = s.legends?.[l.id]; return (
          <div class={`pcard wcard rar-legend${k ? '' : ' unknown'}`} style={{ ['--band' as string]: k ? RARITY_COLOR.legend : '#5b5446' }}>
            <b class="serif">{k ? l.name : '？？？'}</b>
            <div class="small muted">{k ? `${l.art}：${l.artText}` : v?.holder === 'officer' ? 'どこかの将軍が持っているらしい' : 'まだ見たことのない伝説の武器'}</div>
          </div>
        ); })}
      </div>
      </>}
      {view === 'rare' && <>
      <h3><span class="rar-tag" style={{ ['--rar' as string]: RARITY_COLOR.rare }}>{RARITY_NAME.rare}</span> <span class="muted small">{arms.filter((w) => seen.has(w.id)).length}／{arms.length}</span></h3>
      <div class="weapongrid">
        {arms.map((w) => { const k = seen.has(w.id); return <div class={`pcard wcard${k ? '' : ' unknown'}`} style={{ ['--band' as string]: k ? RARITY_COLOR.rare : '#cfc6b2' }}><b class="small">{k ? w.name : '？？？'}</b><div class="small muted">{k ? `威力${w.might}・命中${w.hit}${w.crit ? `・必殺${w.crit}` : ''}・${w.rank}` : `${({ sword: '剣', lance: '槍', axe: '斧', bow: '弓', gun: '銃' } as Record<string, string>)[w.type] ?? ''}の武器`}</div></div>; })}
      </div>
      </>}
      <div class="small muted" style={{ marginTop: 6 }}>ユニーク（銘入り）の武器は、討ち取った敵将ごとに1本ずつ違います。年鑑の「記録」に、伝説の武器の行方が載っています。</div>
    </div>
  );
}

function Mailbox({ s }: { s: GameState }) {
  const [open, setOpen] = useState<string | null>(null);
  const unread = s.mail.filter((m) => !m.read).length;
  const face = (id?: string) => (id && s.students[id] ? s.students[id] : null);
  return (
    <div>
      <Back to={() => navigate({ tab: 'school' })} />
      <div class="row between nowrap"><h2>郵便受け</h2>{unread > 0 && <button class="btn small" onClick={() => { sfx('page'); act((g) => readAllMail(g)); }}>すべて読んだ（{unread}通）</button>}</div>
      <div class="small muted">赤い数字は、急報・敵将のうわさ・卒業生の昇格など、大事な知らせだけです。</div>
      {s.mail.length === 0 && <div class="empty-note">まだ手紙は届いていません</div>}
      {s.mail.map((m) => { const st = face(m.studentId); const imp = mailImportant(m); return (
        <div class="pcard tap" style={{ ['--band' as string]: imp ? 'var(--accent)' : st ? countryColor(st.origin) : '#cfc6b2' }} onClick={() => { setOpen(open === m.id ? null : m.id); if (!m.read) act((g) => { const x = g.mail.find((y) => y.id === m.id); if (x) x.read = true; }); }}>
          <div class="row between nowrap"><span class="row nowrap gap6" style={{ minWidth: 0 }}>{m.parts ? <span class="row nowrap">{m.parts.slice(0, 3).map((x) => face(x.studentId) && <Portrait st={face(x.studentId)!} size={30} />)}</span> : st ? <Portrait st={st} size={36} /> : <Icon name="mail" size={20} />}<b>{m.read ? '' : <span class={`flag ${imp ? 'red' : ''}`}>{imp ? '急' : '未読'}</span>} {m.title}</b></span><span class="muted small">{m.year}年目</span></div>
          <div class="muted small">差出人：{m.from}</div>
          {open === m.id && (m.parts ? m.parts.map((x) => <div class="serif" style={{ marginTop: 6 }}><b class="small">{x.from}</b><br />{x.body}</div>) : <div class="serif" style={{ marginTop: 6 }}>{m.body}</div>)}
        </div>
      ); })}
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
        <div class="small muted">評判が上がると、入学したい子や寄付が増えます。教え子にも声がかかりやすくなります。依頼に勝ったり、演武会や卒業生が活躍したりすると上がります。依頼に失敗したり、教え子が戦死したり、卒業生が敵に回ったりすると下がります。高くなるほど、上がりにくくなります。</div></> : <div class="small">これ以上ない、伝説の学び舎です。</div>}
      {s.world.vassal && <div class="small" style={{ color: 'var(--accent)' }}>いまは{COUNTRY_SHORT[s.world.vassal]}の傘下です。評判が{B.school.independenceRep}になれば、年度末に独立を取り戻せます。</div>}
    </div>
  );
}

export { InstructorPage } from './Mentor';
