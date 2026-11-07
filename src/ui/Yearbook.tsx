import { useState, useEffect } from 'preact/hooks';
import { loadHall } from './storage';
import { ENDING_NAMES, endingTitle, type HallEntry, type HallStudent } from '../core/ending';
import type { EndingKind } from '../core/state';
import { ClassName } from './cards';
import { useStore, navigate } from './store';
import { StuRow } from './common';
import { Portrait } from './Portrait';
import { titleOf } from '../core/alumni';
import { COUNTRY_SHORT, PATH_NAMES, COUNTRIES } from '../data/people';
import { MONTH_NAMES } from '../core/util';
import type { GameState, Student } from '../core/state';
import { NewsView } from './Pending';
import { MiniCard, CountryChip, countryColor } from './cards';
import { Icon } from './icons';

export function YearbookTab() {
  const { s } = useStore();
  const [tab, setTab] = useState<'roster' | 'photos' | 'chronicle' | 'records' | 'news' | 'hall'>('roster');
  if (!s) return null;
  return (
    <div>
      <h2>年鑑</h2>
      <div class="seg" style={{ marginBottom: 8 }}>
        {(['roster', 'photos', 'chronicle', 'records', 'news', 'hall'] as const).map((t) => <button class={tab === t ? 'on' : ''} onClick={() => setTab(t)}>{{ roster: '卒業生', photos: '写真', chronicle: '年表', records: '記録', news: '新聞', hall: '殿堂' }[t]}</button>)}
      </div>
      {tab === 'roster' && <Roster s={s} />}
      {tab === 'photos' && <Photos s={s} />}
      {tab === 'chronicle' && <Chronicle s={s} />}
      {tab === 'records' && <Records s={s} />}
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
        {list.length > limit && <button class="btn block" onClick={() => setLimit(limit + 40)}>もっと見る（あと{list.length - limit}人）</button>}
        {!list.length && <div class="empty-note">まだ卒業生はいません。3月の卒業式で巣立った生徒がここに載ります。</div>}
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
        {kills && kills.kills > 0 && <tr><td>最多撃破（在学中）</td><td>{kills.given}（{kills.kills}）</td></tr>}
        {lv && <tr><td>最高レベル</td><td>{lv.given}（Lv{lv.level}）</td></tr>}
        {topCountry && <tr><td>最も多く送り出した国</td><td>{COUNTRY_SHORT[topCountry[0] as 'kingdom']}（{topCountry[1]}人）</td></tr>}
        <tr><td>最初の元帥</td><td>{marshal ? marshal.given : '—'}</td></tr>
        <tr><td>最初の宰相</td><td>{chancellor ? chancellor.given : '—'}</td></tr>
        <tr><td>教官</td><td>{s.instructor.generation}代目 {s.instructor.name}（{s.instructor.age}歳・教えた生徒 延べ{s.instructor.experience}人）</td></tr>
        {(s.pastInstructors ?? []).map((p) => <tr><td>歴代の教官（{p.generation}代目）</td><td>{p.name}（{p.from}〜{p.to}年目・延べ{p.taught}人）</td></tr>)}
      </tbody></table>
    </div>
  );
}

function News({ s }: { s: GameState }) {
  const [open, setOpen] = useState<string | null>(s.news[0]?.id ?? null);
  if (!s.news.length) return <div class="empty-note">新聞はまだ発行されていません（年度末と大事件の月に届きます）</div>;
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

function Hall({ s }: { s: GameState }) {
  const [list, setList] = useState<HallEntry[] | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  useEffect(() => { loadHall().then(setList); }, []);
  const reached = new Set<string>([...(list ?? []).flatMap((h) => h.endings.map((e) => e.kind)), ...(s.endings ?? []).map((e) => e.kind)]);
  return (
    <div>
      <div class="card">
        <h3>到達したエンディング</h3>
        <div class="row gap6">{(Object.keys(ENDING_NAMES) as EndingKind[]).map((k) => <span class={`chip-o ${reached.has(k) ? 'main' : 'gray'}`}>{reached.has(k) ? ENDING_NAMES[k] : '？？？'}</span>)}</div>
        <div class="muted small" style={{ marginTop: 4 }}>エンディングのあと「新しい学校で始める」を選ぶと、その学校の年鑑がここに保存されます（セーブ枠とは別に保存）。</div>
      </div>
      {list === null && <div class="empty-note">読み込み中……</div>}
      {list && !list.length && <div class="empty-note">まだ殿堂に入った学校はありません</div>}
      {list && [...list].reverse().map((h) => (
        <div class="pcard tap" onClick={() => setOpen(open === h.id ? null : h.id)}>
          <div class="row between nowrap"><span class="ptitle">{h.instructor}教官のリミナ分校</span><span class="muted small">{h.years}年間</span></div>
          <div class="row gap4">{h.endings.map((e) => <span class="flag">{endingTitle(e.kind, e.country)}（{e.year}年目）</span>)}</div>
          <div class="small muted">卒業生 {h.graduates.filter((g) => g.title !== '在学中に戦死').length}人・{h.stats.battlesWon}勝{h.stats.battlesLost}敗・教官 {h.instructors.length}代</div>
          {open === h.id && (
            <div onClick={(e) => e.stopPropagation()}>
              <h3>歴代の教官</h3>
              {h.instructors.map((i) => <div class="small">{i.generation}代目 {i.name}（{i.from}〜{i.to}年目）</div>)}
              <h3>卒業写真</h3>
              {h.photos.map((p) => (
                <div class="photo" style={{ marginBottom: 6 }}>
                  <div class="photo-cap">{p.cohort}期生（{p.year}年目）</div>
                  {p.ids.map((id) => h.graduates.find((g) => g.id === id)).filter((x): x is HallStudent => !!x).map((g) => <div class="seat"><Portrait st={hallStu(g)} size={40} />{g.dead && <div class="deadmark">✝</div>}<div>{g.given}</div></div>)}
                </div>
              ))}
              <h3>卒業生</h3>
              {h.graduates.slice(0, 200).map((g) => <div class="row nowrap gap6 small ruled"><Portrait st={hallStu(g)} size={30} /><b>{g.given}</b><span class="muted">{g.cohort}期生・Lv{g.level}・{g.title}</span></div>)}
              <h3>年表</h3>
              <ul class="list">{h.chronicle.slice(-80).map((c) => <li class="small">{c.year}年目　{c.text}</li>)}</ul>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
void ClassName;
