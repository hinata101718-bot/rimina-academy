import { useState, useEffect } from 'preact/hooks';
import { loadHall } from './storage';
import { ENDING_NAMES, ENDING_SUB, endingTitle, buildHallEntry, hallRecords, hallCompareRow, type HallEntry, type HallStudent } from '../core/ending';
import type { EndingKind } from '../core/state';
import { ClassName } from './cards';
import { useStore, navigate } from './store';
import { StuRow } from './common';
import { Portrait, OfficerFace } from './Portrait';
import { officerName, factionName, rankName } from '../core/officers';
import { titleOf } from '../core/alumni';
import { COUNTRY_SHORT, PATH_NAMES, COUNTRIES } from '../data/people';
import { MONTH_NAMES } from '../core/util';
import type { GameState, Student } from '../core/state';
import { NewsView } from './Pending';
import { MiniCard, CountryChip, countryColor } from './cards';
import { Icon } from './icons';
import { ReviewList } from './Review';
import { LegendWhereabouts } from './Legend';

export function YearbookTab() {
  const { s } = useStore();
  const [tab, setTab] = useState<'roster' | 'photos' | 'review' | 'chronicle' | 'records' | 'news' | 'hall'>('roster');
  if (!s) return null;
  return (
    <div>
      <h2>年鑑</h2>
      <div class="seg" style={{ marginBottom: 8 }}>
        {(['roster', 'photos', 'review', 'chronicle', 'records', 'news', 'hall'] as const).map((t) => <button class={tab === t ? 'on' : ''} onClick={() => setTab(t)}>{{ roster: '卒業生', photos: '写真', review: '振り返り', chronicle: '年表', records: '記録', news: '新聞', hall: '殿堂' }[t]}</button>)}
      </div>
      {tab === 'roster' && <Roster s={s} />}
      {tab === 'photos' && <Photos s={s} />}
      {tab === 'review' && <ReviewList s={s} />}
      {tab === 'chronicle' && <Chronicle s={s} />}
      {tab === 'records' && <><Records s={s} /><LegendWhereabouts s={s} /></>}
      {tab === 'news' && <News s={s} />}
      {tab === 'hall' && <Hall s={s} />}
    </div>
  );
}

function Roster({ s }: { s: GameState }) {
  const [country, setCountry] = useState('');
  const [path, setPath] = useState('');
  const [alive, setAlive] = useState('');
  const [cohort, setCohort] = useState(0);
  const [limit, setLimit] = useState(40);
  let list = Object.values(s.students).filter((x) => x.status === 'graduated' || x.status === 'dead' || x.status === 'dropped');
  if (country) list = list.filter((x) => x.career?.country === country);
  if (path) list = list.filter((x) => x.career?.path === path && x.career.kind === 'army');
  if (alive === 'alive') list = list.filter((x) => x.status === 'graduated' && x.career?.alive);
  if (alive === 'dead') list = list.filter((x) => x.status === 'dead' || (x.career && !x.career.alive));
  if (cohort) list = list.filter((x) => x.cohort === cohort);
  list.sort((a, b) => a.cohort - b.cohort);
  const sub = (x: Student) => x.status === 'dropped' ? `${x.cohort}期生・退学` : x.status === 'dead' ? `${x.cohort}期生・在学中に戦死` : `${x.cohort}期生・${titleOf(x)}・Lv${x.level}`;
  return (
    <div>
      <div class="row">
        <select value={country} onChange={(e) => setCountry((e.target as HTMLSelectElement).value)}><option value="">全部の国</option>{COUNTRIES.map((c) => <option value={c}>{COUNTRY_SHORT[c]}</option>)}</select>
        <select value={path} onChange={(e) => setPath((e.target as HTMLSelectElement).value)}><option value="">全部の道</option>{Object.entries(PATH_NAMES).map(([k, v]) => <option value={k}>{v}</option>)}</select>
        <select value={alive} onChange={(e) => setAlive((e.target as HTMLSelectElement).value)}><option value="">生死</option><option value="alive">存命</option><option value="dead">故人</option></select>
        <select value={cohort} onChange={(e) => setCohort(Number((e.target as HTMLSelectElement).value))}><option value={0}>全部の期</option>{Array.from({ length: s.cohortCount }, (_, i) => <option value={i + 1}>{i + 1}期生</option>)}</select>
      </div>
      <div class="muted small">{list.length}人</div>
      <div>
        {list.slice(0, limit).map((x) => <MiniCard st={x} sub={sub(x)} dim={x.status === 'dead' || (!!x.career && !x.career.alive)} right={x.status === 'dead' || (x.career && !x.career.alive) ? <Icon name="skull" size={18} /> : x.career?.country ? <CountryChip o={x.career.country} /> : undefined} />)}
        {list.length > limit && <button class="btn block" onClick={() => setLimit(limit + 40)}>あと{list.length - limit}人を見る</button>}
        {!list.length && <div class="empty-note">まだ卒業生はいません。3月の卒業式で巣立った子が、ここに載ります。</div>}
      </div>
    </div>
  );
}

function Photos({ s }: { s: GameState }) {
  if (!s.photos.length) return <div class="empty-note">卒業写真はまだありません</div>;
  return (
    <div>
      {[...s.photos].reverse().map((p) => (
        <div class="card">
          <h3>{p.cohort}期生（{p.year}年目 卒業）</h3>
          <div class="photo">
            {p.ids.map((id) => s.students[id]).filter(Boolean).map((st) => <div class="seat" onClick={() => navigate({ tab: 'students', page: 'detail', id: st.id })}><Portrait st={st} size={52} frame={countryColor(st.origin)} /><div>{st.given}</div>{st.career && !st.career.alive && <div class="deadmark">✝</div>}</div>)}
            {p.empty.map((id) => s.students[id]).filter(Boolean).map((st) => <div class="seat"><div class="empty" /><div class="muted">{st.given}</div></div>)}
          </div>
        </div>
      ))}
    </div>
  );
}

function Chronicle({ s }: { s: GameState }) {
  const years = [...new Set(s.chronicle.map((c) => c.year))].sort((a, b) => b - a);
  return (
    <div>
      {years.map((y) => (
        <div class="card">
          <h3>{y}年目</h3>
          <ul class="list">{s.chronicle.filter((c) => c.year === y).map((c) => <li class="small row nowrap gap6"><span class="muted" style={{ width: 30 }}>{MONTH_NAMES[c.month]}</span><span class="todoicon" style={{ width: 24, height: 24 }}><Icon name={c.kind === 'world' ? 'war' : c.kind === 'student' ? 'students' : 'school'} size={14} /></span><span style={{ whiteSpace: 'normal' }}>{c.text}</span></li>)}</ul>
        </div>
      ))}
    </div>
  );
}

function Records({ s }: { s: GameState }) {
  const all = Object.values(s.students).filter((x) => x.status !== 'enrolled');
  const best = (f: (x: Student) => number) => [...all].sort((a, b) => f(b) - f(a))[0];
  const kills = best((x) => x.kills);
  const lv = best((x) => x.level);
  const sent: Record<string, number> = {};
  for (const x of all) if (x.career?.country && x.career.kind === 'army') sent[x.career.country] = (sent[x.career.country] ?? 0) + 1;
  const topCountry = Object.entries(sent).sort((a, b) => b[1] - a[1])[0];
  const marshal = all.find((x) => x.career?.path === 'warrior' && x.career.rank >= 4);
  const chancellor = all.find((x) => x.career?.path === 'civil' && x.career.rank >= 3);
  return (
    <div class="card">
      <table class="stats"><tbody>
        <tr><td>卒業生の数</td><td>{s.stats.graduates}人</td></tr>
        <tr><td>在学中の戦死</td><td>{s.stats.deaths}人</td></tr>
        <tr><td>戦闘の勝敗</td><td>{s.stats.battlesWon}勝 {s.stats.battlesLost}敗</td></tr>
        {kills && kills.kills > 0 && <tr><td>いちばん多く敵を倒した子（在学中）</td><td>{kills.given}（{kills.kills}）</td></tr>}
        {lv && <tr><td>最高レベル</td><td>{lv.given}（Lv{lv.level}）</td></tr>}
        {topCountry && <tr><td>最も多く送り出した国</td><td>{COUNTRY_SHORT[topCountry[0] as 'kingdom']}（{topCountry[1]}人）</td></tr>}
        <tr><td>最初の元帥</td><td>{marshal ? marshal.given : '—'}</td></tr>
        <tr><td>最初の宰相</td><td>{chancellor ? chancellor.given : '—'}</td></tr>
        <tr><td>教官</td><td>{s.instructor.generation}代目 {s.instructor.name}（{s.instructor.age}歳・これまでに教えた子 {s.instructor.experience}人）</td></tr>
        {(s.pastInstructors ?? []).map((p) => <tr><td>歴代の教官（{p.generation}代目）</td><td>{p.name}（{p.from}〜{p.to}年目・教えた子 {p.taught}人）</td></tr>)}
      </tbody></table>
      <Nemeses s={s} />
    </div>
  );
}

/** 因縁の敵将（6夜目からは「戦況」の敵将の名簿にまとめた。ここには会ったことのある敵将を短く） */
function Nemeses({ s }: { s: GameState }) {
  const list = (s.officers ?? []).filter((o) => o.meets.length).sort((a, c) => c.meets.length - a.meets.length).slice(0, 8);
  return (
    <>
      <h3>因縁の敵将</h3>
      {!list.length && <div class="muted small">まだいません。戦場で会った敵将は、「戦況」の「敵将の名簿」で見られます。</div>}
      {list.map((o) => (
        <div class="row nowrap gap6 ruled">
          <OfficerFace o={o} size={36} s={s} />
          <div class="grow" style={{ minWidth: 0 }}><b class="serif">{officerName(o)}</b> <span class="small muted">{o.kind === 'monster' ? '魔物' : `${factionName(o.faction)}・${rankName(o)}`}・{o.meets.length}回</span></div>
          <span class={`flag ${o.status === 'active' ? 'red' : ''}`}>{o.status === 'active' ? '健在' : '決着'}</span>
        </div>
      ))}
      <button class="btn block" style={{ minHeight: 44, marginTop: 6 }} onClick={() => navigate({ tab: 'war', page: 'officers' })}>敵将の名簿を開く ›</button>
    </>
  );
}

function News({ s }: { s: GameState }) {
  const [open, setOpen] = useState<string | null>(s.news[0]?.id ?? null);
  if (!s.news.length) return <div class="empty-note">新聞はまだ出ていません。年度末と、大事件があった月に届きます</div>;
  return (
    <div>
      {s.news.map((n) => (
        <div class="card" onClick={() => setOpen(open === n.id ? null : n.id)}>
          <b>{n.year}年目 {MONTH_NAMES[n.month]}：{n.headline}</b>
          {open === n.id && <div style={{ marginTop: 6 }}><NewsView id={n.id} /></div>}
        </div>
      ))}
    </div>
  );
}

function hallStu(h: HallStudent): Student {
  return { ...h, status: h.dead ? 'dead' : 'graduated', career: h.dead ? { alive: false } : null } as unknown as Student;
}
function HallFace({ g, size }: { g: HallStudent; size: number }) {
  return <Portrait st={hallStu(g)} size={size} fixed frame={countryColor(g.origin)} />;
}

function Hall({ s }: { s: GameState }) {
  const [list, setList] = useState<HallEntry[] | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  useEffect(() => { loadHall().then(setList); }, []);
  const reached = new Set<string>([...(list ?? []).flatMap((h) => h.endings.map((e) => e.kind)), ...(s.endings ?? []).map((e) => e.kind)]);
  const page = list?.find((h) => h.id === open);
  if (page) return <HallPage h={page} onBack={() => setOpen(null)} />;
  const rows = [hallCompareRow(buildHallEntry(s), true), ...[...(list ?? [])].reverse().map((h) => hallCompareRow(h))];
  return (
    <div>
      <div class="card">
        <h3>到達したエンディング</h3>
        <div class="row gap6">{(Object.keys(ENDING_NAMES) as EndingKind[]).map((k) => <span class={`chip-o ${reached.has(k) ? 'main' : 'gray'}`}>{reached.has(k) ? ENDING_NAMES[k] : '？？？'}</span>)}</div>
        <div class="muted small" style={{ marginTop: 4 }}>エンディングのあとで「新しい学校で始める」を選ぶと、その学校の年鑑がここにしまわれます。セーブ枠とは別に残ります。</div>
      </div>
      {list === null && <div class="empty-note">読み込み中……</div>}
      {list && !list.length && <div class="empty-note">まだ殿堂に入った学校はありません</div>}
      {list && [...list].reverse().map((h) => (
        <div class="pcard tap hallcard" onClick={() => setOpen(h.id)}>
          <div class="row between nowrap"><span class="ptitle">{h.instructor}教官のリミナ分校</span><span class="muted small">{h.years}年間</span></div>
          <div class="row gap4">{h.endings.map((e) => <span class="flag">{endingTitle(e.kind, e.country, e.n)}（{e.year}年目）</span>)}</div>
          <div class="hall-faces">{h.graduates.filter((g) => !g.dead).slice(-6).map((g) => <HallFace g={g} size={36} />)}</div>
          <div class="small muted">卒業生 {h.graduates.filter((g) => g.title !== '在学中に戦死').length}人・{h.stats.battlesWon}勝{h.stats.battlesLost}敗・教官 {h.instructors.length}代</div>
          <div class="row between"><span /><span class="small" style={{ color: 'var(--main)' }}>この学校のページを開く ›</span></div>
        </div>
      ))}
      {list && list.length > 0 && (
        <div class="card">
          <h3>学校どうしの記録</h3>
          <div class="hall-compare">
            <table class="stats compare">
              <thead><tr><th>学校</th><th>年数</th><th>エンディング</th><th>卒業生</th><th>在学中の戦死</th><th>勝敗</th><th>教官</th><th>最高Lv</th><th>最高位</th></tr></thead>
              <tbody>{rows.map((r) => (
                <tr class={r.current ? 'current' : ''}><td>{r.current ? '今の学校' : r.name}</td><td>{r.years}年</td><td>{r.endings}</td><td>{r.graduates}人</td><td>{r.deaths}人</td><td>{r.wins}勝{r.losses}敗</td><td>{r.generations}代</td><td>{r.topLevel || '—'}</td><td>{r.topRank}</td></tr>
              ))}</tbody>
            </table>
          </div>
          <div class="muted small">表は、横にずらすと続きが見られます。</div>
        </div>
      )}
    </div>
  );
}

/** 殿堂：学校ごとのページ */
function HallPage({ h, onBack }: { h: HallEntry; onBack: () => void }) {
  const [i, setI] = useState(Math.max(0, h.photos.length - 1));
  const [showAll, setShowAll] = useState(false);
  const rec = hallRecords(h);
  const byId = new Map(h.graduates.map((g) => [g.id, g]));
  const p = h.photos[i];
  const seats = p ? p.ids.map((id) => byId.get(id)).filter((x): x is HallStudent => !!x) : [];
  const gradCount = h.graduates.filter((g) => g.title !== '在学中に戦死').length;
  return (
    <div class="hallpage">
      <button class="btn" style={{ minHeight: 44 }} onClick={onBack}>‹ 殿堂の一覧へ</button>
      <div class="card">
        <div class="ptitle" style={{ fontSize: 20 }}>{h.instructor}教官のリミナ分校</div>
        <div class="muted small">{h.years}年間・{new Date(h.savedAt).toLocaleDateString('ja-JP')}に殿堂入り</div>
        <h3>到達したエンディング</h3>
        {h.endings.length ? h.endings.map((e) => <div class="row between nowrap"><b>{endingTitle(e.kind, e.country, e.n)}</b><span class="muted small">{ENDING_SUB[e.kind]}・{e.year}年目</span></div>) : <div class="muted small">なし</div>}
      </div>
      <div class="card">
        <h3>卒業写真</h3>
        {p ? (
          <>
            <div class="row between nowrap photo-nav">
              <button class="btn" disabled={i <= 0} onClick={() => setI(i - 1)} aria-label="前の期">◀</button>
              <b class="photo-title">{p.cohort}期生（{p.year}年目）<span class="muted small">　{i + 1}／{h.photos.length}</span></b>
              <button class="btn" disabled={i >= h.photos.length - 1} onClick={() => setI(i + 1)} aria-label="次の期">▶</button>
            </div>
            <div class="photo big">
              {seats.map((g) => <div class="seat"><HallFace g={g} size={72} />{g.dead && <div class="deadmark">✝</div>}<div>{g.given}</div></div>)}
            </div>
            <div class="muted small" style={{ marginTop: 4 }}>{seats.length}人が巣立ちました（✝は戦場で倒れた子です）</div>
          </>
        ) : <div class="muted small">卒業写真はありません</div>}
      </div>
      <div class="card">
        <h3>記録</h3>
        <table class="stats"><tbody>
          <tr><td>卒業生の数</td><td>{gradCount}人</td></tr>
          <tr><td>在学中の戦死</td><td>{h.stats.deaths}人</td></tr>
          <tr><td>戦闘の勝敗</td><td>{h.stats.battlesWon}勝 {h.stats.battlesLost}敗</td></tr>
          <tr><td>いちばん多く敵を倒した子（在学中）</td><td>{rec.topKills ? `${rec.topKills.name}（${rec.topKills.n}）` : '—'}</td></tr>
          <tr><td>最高レベル</td><td>{rec.topLevel ? `${rec.topLevel.name}（Lv${rec.topLevel.n}）` : '—'}</td></tr>
          <tr><td>最高位</td><td>{rec.topRank ? `${rec.topRank.name}（${rec.topRank.title}）` : '—'}</td></tr>
          <tr><td>最初の元帥</td><td>{rec.firstMarshal ?? '—'}</td></tr>
          <tr><td>最初の宰相</td><td>{rec.firstChancellor ?? '—'}</td></tr>
          {COUNTRIES.some((c) => rec.sent[c]) && <tr><td>三国へ送り出した数</td><td>{COUNTRIES.map((c) => `${COUNTRY_SHORT[c]}${rec.sent[c] ?? 0}`).join('・')}</td></tr>}
        </tbody></table>
        {!h.v && <div class="muted small">古い殿堂なので、倒した数や最高位など、一部の記録は残っていません。</div>}
      </div>
      <div class="card">
        <h3>歴代の教官</h3>
        {h.instructors.map((x) => <div class="row between nowrap ruled"><span>{x.generation}代目 <b>{x.name}</b></span><span class="muted small">{x.from}〜{x.to}年目</span></div>)}
      </div>
      <div class="card">
        <h3>卒業生</h3>
        {(showAll ? h.graduates : h.graduates.slice(0, 30)).map((g) => <div class="row nowrap gap6 small ruled hallgrad"><HallFace g={g} size={32} /><b>{g.given}</b><span class="muted">{g.cohort}期生・Lv{g.level}・{g.title}</span></div>)}
        {!showAll && h.graduates.length > 30 && <button class="btn" style={{ minHeight: 44, width: '100%' }} onClick={() => setShowAll(true)}>残り{h.graduates.length - 30}人も見る</button>}
      </div>
      <div class="card">
        <h3>年表</h3>
        <ul class="list">{h.chronicle.slice(-80).map((c) => <li class="small">{c.year}年目　{c.text}</li>)}</ul>
      </div>
      <button class="btn" style={{ minHeight: 44 }} onClick={onBack}>‹ 殿堂の一覧へ</button>
    </div>
  );
}
void ClassName;
