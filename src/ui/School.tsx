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
import type { SkillId } from '../core/types';
import type { GameState, WeekendAction } from '../core/state';
import { sfx } from './sound';
import { Icon } from './icons';
import { SchoolArt, MonthCalendar, ArtSlot } from './HomeDeco';
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
  return <Home s={s} />;
}

function Home({ s }: { s: GameState }) {
  const list = enrolled(s);
  const slots = tutoringSlots(s);
  const todo: { text: string; go: () => void; red?: boolean }[] = [];
  const left = slots - s.plan.tutoring.length;
  if (s.week === 1) todo.push({ text: `今月の重点科目：${[1, 2, 3].filter((g) => list.some((x) => x.grade === g)).map((g) => `${g}年 ${(s.focus[g] ?? []).map((k) => SKILL_NAMES[k]).join('・')}`).join(' ／ ')}`, go: () => navigate({ tab: 'school', page: 'lessons' }) });
  todo.push({ text: left > 0 ? `個人指導 あと${left}回` : '個人指導 設定済み', go: () => navigate({ tab: 'school', page: 'tutoring' }), red: left > 0 });
  todo.push({ text: s.plan.weekend.length ? `週末の交流 ${s.plan.weekend.length}件 設定済み` : '週末の交流 未設定', go: () => navigate({ tab: 'school', page: 'weekend' }), red: !s.plan.weekend.length });
  for (const id of s.consults) { const st = s.students[id]; if (st) todo.push({ text: `相談：${st.given}「先生、少しいいですか」`, go: () => navigate({ tab: 'school', page: 'tutoring' }), red: true }); }
  const ex = examCandidates(s);
  if (ex.length) todo.push({ text: `兵種試験を受けられる生徒が${ex.length}人（${ex.map((x) => x.given).join('・')}）`, go: () => navigate({ tab: 'students', page: 'exam' }), red: true });
  for (const st of list) {
    if (st.dropoutSign) todo.push({ text: `退学の予兆：${st.given}（面談で話を聞こう）`, go: () => navigate({ tab: 'students', page: 'detail', id: st.id }), red: true });
    if (st.fatigue >= B.fatigue.warnAt && available(st)) todo.push({ text: `疲れがたまっている：${st.given}（疲労${Math.round(st.fatigue)}）`, go: () => navigate({ tab: 'students', page: 'detail', id: st.id }) });
    if (st.motivation <= 0) todo.push({ text: `やる気がとても低い：${st.given}`, go: () => navigate({ tab: 'students', page: 'detail', id: st.id }) });
  }
  const unread = s.mail.filter((m) => !m.read).length;
  if (unread) todo.push({ text: `郵便受けに未読の手紙が${unread}通`, go: () => navigate({ tab: 'school', page: 'mail' }) });
  const [spotMsg, setSpotMsg] = useState('');
  const guideOn = s.settings.guide && s.year === 1 && s.month === 0;
  return (
    <div>
      <SchoolArt s={s} />
      <MonthCalendar s={s} />
      {s.month === 3 && <ArtSlot name="event_camp" />}
      {guideOn && <div class="guide">{GUIDE[Math.min(GUIDE.length - 1, s.week - 1)]}</div>}
      <div class="two">
        <div>
          {s.spotlight.length > 0 && (
            <div class="card">
              <h3>今月の主役</h3>
              <div class="facecards">
                {s.spotlight.map((sp) => { const st = s.students[sp.id]; if (!st) return null; return (
                  <div class="facecard" onClick={() => navigate({ tab: 'students', page: 'detail', id: st.id })}>
                    <Portrait st={st} size={72} />
                    <div class="grow">
                      <b>{st.given}</b> <span class="muted small">{st.grade}年</span>
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
              {todo.map((t) => <li onClick={() => { sfx('move'); t.go(); }}><span class="dot" style={{ background: t.red ? undefined : 'var(--line)' }} /><span class="grow">{t.text}</span><span class="muted">›</span></li>)}
            </ul>
          </div>
        </div>
        <div>
          {s.pinned.length > 0 && (
            <div class="card">
              <h3>気にかける生徒</h3>
              <div class="facecards small">
                {s.pinned.map((id) => s.students[id]).filter(Boolean).map((st) => (
                  <div class="facecard" onClick={() => navigate({ tab: 'students', page: 'detail', id: st.id })}>
                    <Portrait st={st} size={56} />
                    <div class="grow"><b>{st.given}</b><div class="small">{moodIcon(st)} やる気{B.motivationLabel[st.motivation]}</div><div class="small muted">疲労{Math.round(st.fatigue)}・信頼{Math.round(st.trust)}</div></div>
                  </div>
                ))}
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
          <h3>{g}年生</h3>
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
            return <StuRow st={st} onClick={() => setPick(on ? pick.filter((x) => x !== st.id) : [...pick, st.id].slice(-(mode === 'tea' ? 3 : 2)))} sub={`${PERSONALITIES[st.personality].name}${sup ? `・支援 ${sup}` : ''}`} right={<span style={{ fontSize: 22 }}>{on ? '☑' : '☐'}</span>} />;
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
          <div class="card row between">
            <div class="grow"><b>{def.name}</b> 段階{lv}{lv === 0 ? '（ボロボロ）' : ''}<div class="muted small">{eff}</div></div>
            {cost !== null ? <button class="btn small" disabled={s.money < cost} onClick={() => { sfx('ok'); act((g) => upgradeFacility(g, f)); }}>整備 {money(cost)}</button> : <span class="muted">最大</span>}
          </div>
        );
      })}
      <h3>講師</h3>
      <div class="muted small">講師がいると、その科目の授業がよく伸びます。給料は毎月払い、毎年4月に少しずつ上がります（雇えるのは{B.teachers.max}人まで）。</div>
      {s.teachers.map((t) => <div class="card row between"><div class="grow"><b>{t.name}</b>{t.alumniId ? '（卒業生）' : ''} {SKILL_NAMES[t.skill]} {rankOf(t.points)}<div class="muted small">月給 {money(t.salary)}</div></div><button class="btn ghost small" onClick={() => { if (confirm(`${t.name}に辞めてもらいますか？`)) act((g) => fireTeacher(g, t.id)); }}>解雇</button></div>)}
      {s.teacherCandidates.length > 0 && <h3>雇える講師（毎年4月に入れ替わり）</h3>}
      {s.teacherCandidates.map((t) => <div class="card row between"><div class="grow"><b>{t.name}</b> {SKILL_NAMES[t.skill]} {rankOf(t.points)}<div class="muted small">月給 {money(t.salary)}</div></div><button class="btn small" disabled={s.teachers.length >= B.teachers.max} onClick={() => { sfx('ok'); act((g) => hireTeacher(g, t.id)); }}>雇う</button></div>)}
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
      <div class="card">
        <table class="stats"><tbody>
          {Object.entries(counts).map(([id, n]) => { const w = WEAPONS[id]; const eng = s.armory.filter((a) => a.weaponId === id && a.engraved).map((a) => a.engraved); return <tr><td>{w.name}{eng.length ? <span class="muted small">（{eng.join('・')}の遺品）</span> : ''}</td><td>{typeName[w.type]}</td><td>威力{w.might} 命中{w.hit}</td><td>×{n}</td></tr>; })}
        </tbody></table>
        <div class="muted small">道具：傷薬×{s.items.vulnerary}　特効薬×{s.items.elixir}</div>
      </div>
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
        <div class="card" onClick={() => { setOpen(open === m.id ? null : m.id); act((g) => { const x = g.mail.find((y) => y.id === m.id); if (x) x.read = true; }); }}>
          <div class="row between"><b>{m.read ? '' : '● '}{m.title}</b><span class="muted small">{m.year}年目</span></div>
          <div class="muted small">差出人：{m.from}</div>
          {open === m.id && <div class="serif" style={{ marginTop: 6 }}>{m.body}</div>}
        </div>
      ))}
    </div>
  );
}

export { Portrait, Bar };
