import { useState } from 'preact/hooks';
import { useStore, act, navigate } from './store';
import { Sheet, StuRow, money } from './common';
import { Portrait } from './Portrait';
import type { GameState, TalkLog, Student } from '../core/state';
import { enrolled, available, deployLimit, capacity } from '../core/game';
import { startBattle, admit, autoAdmitIds, finishCareers } from '../core/flow';
import { autoDeploy, canEquip } from '../core/autoplay';
import { OBJECTIVE_NAMES, WEATHER_NAMES } from '../core/quests';
import { hopes, availableChoices, CHOICE_NAMES, acceptRate, suitablePath, autoRecommend, type CareerChoice } from '../core/career';
import { WEAPONS } from '../data/weapons';
import { CLASSES } from '../data/classes';
import { COUNTRY_SHORT, PERSONALITIES, DREAMS, COUNTRY_NAMES, HOUSE_NAMES, TRAITS, PATH_NAMES, STAT_NAMES } from '../data/people';
import { STATS } from '../data/balance';
import type { Path } from '../core/types';
import type { Deploy } from '../core/battle/setup';
import { sfx } from './sound';
import { rankOf } from '../core/util';
import { SKILL_NAMES } from '../data/people';
import { SKILLS } from '../data/balance';

export function PendingView() {
  const { s } = useStore();
  if (!s || !s.pending.length) return null;
  const p = s.pending[0];
  const done = () => act((g) => { g.pending.shift(); });
  switch (p.type) {
    case 'weekSummary': return <WeekSummary lines={p.lines} talks={p.talks} onDone={done} />;
    case 'talk': return <Sheet title="支援会話"><TalkView t={p.talk} /><button class="btn primary block" onClick={done}>閉じる</button></Sheet>;
    case 'event': return <Sheet title={p.title}><div class="paper">{p.lines.map((l) => <p>{l}</p>)}</div><button class="btn primary block" style={{ marginTop: 10 }} onClick={done}>閉じる</button></Sheet>;
    case 'battleResult': return <BattleResult s={s} p={p} onDone={done} />;
    case 'questBoard': return <QuestBoard s={s} />;
    case 'entrance': return <Entrance s={s} />;
    case 'career': return <Career s={s} />;
    case 'graduation': return <Graduation s={s} cohort={p.cohort} lines={p.lines} onDone={done} />;
    case 'newspaper': return <Sheet title="新聞が届いた"><NewsView id={p.id} /><button class="btn primary block" style={{ marginTop: 10 }} onClick={done}>閉じる</button></Sheet>;
    default: return <Sheet title="お知らせ"><button class="btn primary block" onClick={done}>閉じる</button></Sheet>;
  }
}

export function TalkView({ t }: { t: TalkLog }) {
  const { s } = useStore();
  if (!s) return null;
  const a = s.students[t.a], b = s.students[t.b];
  return (
    <div class="talk">
      <div class="muted">{a?.given}と{b?.given}　支援{t.rank}「{t.title}」</div>
      {t.lines.map((l) => { const st = s.students[l.by]; const right = l.by === t.b; return (
        <div class={`line${right ? ' right' : ''}`}>{st && <Portrait st={st} size={40} />}<div class="bubble"><div class="small muted">{st?.given}</div>{l.text}</div></div>
      ); })}
    </div>
  );
}

function WeekSummary({ lines, talks, onDone }: { lines: string[]; talks: TalkLog[]; onDone: () => void }) {
  const [i, setI] = useState(-1);
  if (i >= 0 && i < talks.length) {
    return <Sheet title="支援会話"><TalkView t={talks[i]} /><button class="btn primary block" onClick={() => { sfx('ok'); setI(i + 1); }}>{i + 1 < talks.length ? '次の会話へ' : 'まとめに戻る'}</button></Sheet>;
  }
  return (
    <Sheet title="今週のまとめ">
      <ul class="list">{lines.map((l) => <li class="small">{l}</li>)}</ul>
      {talks.length > 0 && i < 0 && <button class="btn block" style={{ marginTop: 8 }} onClick={() => setI(0)}>💬 支援会話が{talks.length}件あります</button>}
      <button class="btn primary block" style={{ marginTop: 8 }} onClick={() => { sfx('ok'); onDone(); }}>閉じる</button>
    </Sheet>
  );
}

function BattleResult({ s, p, onDone }: { s: GameState; p: Extract<GameState['pending'][number], { type: 'battleResult' }>; onDone: () => void }) {
  return (
    <Sheet title={p.win ? '勝利' : '敗北'}>
      <h3>講評</h3>
      {p.grades.map((g) => { const st = s.students[g.id]; if (!st) return null; return <StuRow st={st} onClick={() => undefined} sub={g.note} right={<b style={{ fontSize: 22, color: g.grade === 'S' ? 'var(--accent)' : undefined }}>{g.grade}</b>} />; })}
      <ul class="list">{p.lines.map((l) => <li class="small">{l}</li>)}</ul>
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
        {s.settings.guide && s.year === 1 && s.month === 0 && <div class="guide">最初は「演習」を選びましょう。演習では誰も死にません。実戦は報酬と評判がもらえますが、倒れた生徒が戦死することがあります。</div>}
        {s.quests.map((x) => (
          <div class="card" onClick={() => { sfx('ok'); setQid(x.id); }} style={{ cursor: 'pointer' }}>
            <div class="row between"><b>{x.title}</b><span class={`tag ${x.real ? 'red' : ''}`}>{x.real ? '実戦' : x.kind === 'exhibition' ? '演武会' : '演習'}</span></div>
            <div class="small">依頼主：{x.client}</div>
            <div class="small">勝利条件：{OBJECTIVE_NAMES[x.objective]}{x.defendTurns && x.objective === 'defend' ? `（${x.defendTurns}ターン）` : ''}／推奨Lv{x.level}／天候：{WEATHER_NAMES[x.weather]}</div>
            <div class="small">危険度：{'★'.repeat(x.danger)}{'☆'.repeat(3 - x.danger)}／報酬：{x.reward ? money(x.reward) : 'なし'}{x.real ? '／戦死あり' : '／死なない'}</div>
          </div>
        ))}
      </Sheet>
    );
  }
  const limit = deployLimit(s);
  const d = deploy ?? autoDeploy(s, limit);
  const setD = (nd: Deploy[]) => setDeploy(nd);
  const used = new Set(d.flatMap((x) => [x.armoryUid, x.staffUid]).filter(Boolean) as string[]);
  const avail = enrolled(s).filter(available);
  return (
    <Sheet title={`出撃準備：${q.title}`} onClose={s.quests.length > 1 ? () => { setQid(null); setDeploy(null); } : undefined}>
      <div class="small muted">出撃できるのは{limit}人まで。武器は武器庫から割り当てます（技能ランクが足りない武器は使えません）。</div>
      {q.weather === 'rain' && <div class="tag red">雨：移動−1、銃は使えない</div>}
      {q.weather === 'fog' && <div class="tag red">霧：弓・魔道・銃の射程−1</div>}
      {avail.map((st) => {
        const i = d.findIndex((x) => x.studentId === st.id);
        const on = i >= 0;
        const opts = s.armory.filter((a) => canEquip(st, a.weaponId) && WEAPONS[a.weaponId].type !== 'staff' && (!used.has(a.uid) || d[i]?.armoryUid === a.uid));
        const staffs = s.armory.filter((a) => canEquip(st, a.weaponId) && WEAPONS[a.weaponId].type === 'staff' && (!used.has(a.uid) || d[i]?.staffUid === a.uid));
        const cls = CLASSES[st.classId];
        return (
          <div class="card" style={{ opacity: on ? 1 : 0.6 }}>
            <StuRow st={st} onClick={() => { sfx('move'); if (on) setD(d.filter((x) => x.studentId !== st.id)); else if (d.length < limit) setD([...d, { studentId: st.id, armoryUid: opts[0]?.uid ?? null, item: null, staffUid: null }]); }}
              sub={`${cls.name} Lv${st.level}・${st.targets.map((k) => `${SKILL_NAMES[k]}${rankOf(st.skills[k])}`).join(' ')}`} right={<span style={{ fontSize: 22 }}>{on ? '☑' : '☐'}</span>} />
            {on && (
              <div class="row" style={{ marginLeft: 54 }}>
                <select value={d[i].armoryUid ?? ''} onChange={(e) => { const nd = [...d]; nd[i] = { ...nd[i], armoryUid: (e.target as HTMLSelectElement).value || null }; setD(nd); }}>
                  <option value="">武器なし</option>
                  {opts.map((a) => <option value={a.uid}>{WEAPONS[a.weaponId].name}{a.engraved ? `（${a.engraved}）` : ''}</option>)}
                </select>
                {staffs.length > 0 && <select value={d[i].staffUid ?? ''} onChange={(e) => { const nd = [...d]; nd[i] = { ...nd[i], staffUid: (e.target as HTMLSelectElement).value || null }; setD(nd); }}>
                  <option value="">杖なし</option>{staffs.map((a) => <option value={a.uid}>{WEAPONS[a.weaponId].name}</option>)}
                </select>}
                <select value={d[i].item ?? ''} onChange={(e) => { const nd = [...d]; nd[i] = { ...nd[i], item: ((e.target as HTMLSelectElement).value || null) as Deploy['item'] }; setD(nd); }}>
                  <option value="">道具なし</option>
                  <option value="vulnerary" disabled={s.items.vulnerary <= d.filter((x, j) => j !== i && x.item === 'vulnerary').length}>傷薬（残{s.items.vulnerary}）</option>
                  <option value="elixir" disabled={s.items.elixir <= d.filter((x, j) => j !== i && x.item === 'elixir').length}>特効薬（残{s.items.elixir}）</option>
                </select>
              </div>
            )}
          </div>
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
  return (
    <div class="card" onClick={toggle} style={{ cursor: 'pointer', borderColor: on ? 'var(--main)' : undefined, borderWidth: on ? 2 : 1 }}>
      <div class="row"><Portrait st={st} size={44} /><div class="grow"><b>{st.given}</b> <span class="muted">{st.family}</span> {st.parents.length > 0 && <span class="tag">卒業生の子</span>}
        <div class="muted small">{st.age}歳・{COUNTRY_NAMES[st.origin]}・{HOUSE_NAMES[st.house]}・{PERSONALITIES[st.personality].name}・夢：{d.name}</div></div><span style={{ fontSize: 22 }}>{on ? '☑' : '☐'}</span></div>
      <div class="small">{STATS.map((k) => `${STAT_NAMES[k]}${st.stats[k]}`).join(' ')}</div>
      <div class="small muted">{SKILLS.filter((k) => st.skills[k] > 0).map((k) => `${SKILL_NAMES[k]}${rankOf(st.skills[k])}`).join(' ')}　{st.knownTraits.map((t) => TRAITS[t].name).join('・')}</div>
    </div>
  );
}

function Entrance({ s }: { s: GameState }) {
  const cap = capacity(s);
  const [sel, setSel] = useState<string[]>(() => autoAdmitIds(s));
  return (
    <Sheet title={`${s.year}年目 入学試験`}>
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
