// 19夜目：月末の出撃（依頼を選ぶ → 教え子4人と先生 → 自分で戦うか、おまかせか）
import { useState, useMemo } from 'preact/hooks';
import { act } from './store';
import { sfx } from './sound';
import { Sheet } from './common';
import { Portrait, OfficerFace } from './Portrait';
import { Stars } from './cards';
import type { GameState, Quest } from '../core/state';
import { enrolled, available } from '../core/game';
import { startSortie, officerForQuest } from '../core/flow';
import { recommendDeploy, deployFor, mustJoin, recommendQuest, lineupFor, affinityOf, officerAttack, studentAttacks } from '../core/sortie';
import { questStages, stageLabel, ensureStages } from '../core/march';
import { nameTag } from '../core/student';
import { FIELD_BY_ID, TB, type AtkType } from '../data/tactics';
import { AtkMark } from './atk';
import { ensureOfficerCombat } from '../core/tactics/setup';
import { bondText } from '../core/nemesis';
import { LEADER_NAMES, type LeaderPersonality } from '../data/autobattle';
import { OFFICER_TRAITS } from '../data/officers';
import { NemDetail } from './Nemesis';
import type { EnemyOfficer } from '../core/state';
import { OBJECTIVE_NAMES } from '../core/quests';
import { officerName, rankName } from '../core/officers';
import { bondOf } from '../core/nemesis';
import { CLASSES } from '../data/classes';
import { B } from '../data/balance';
import { COUNTRY_SHORT } from '../data/people';
import { armoryItem } from '../core/loot';
import { itemName } from '../core/rarity';
import { EquipSheet } from './Equip';

export function SortiePrep({ s }: { s: GameState }) {
  const [qid, setQid] = useState<string | null>(() => s.quests.find((q) => q.mustGo)?.id ?? (s.quests.length === 1 ? s.quests[0].id : null));
  const q = s.quests.find((x) => x.id === qid) ?? null;
  if (!q) return <QuestList s={s} onPick={(id) => { sfx('ok'); setQid(id); }} />;
  return <Members key={q.id} s={s} q={q} onBack={q.mustGo ? undefined : () => setQid(null)} />;
}

function QuestList({ s, onPick }: { s: GameState; onPick: (id: string) => void }) {
  ensureStages(s);
  const rec = recommendQuest(s);
  return (
    <Sheet title="月末の依頼">
      <p class="small muted">依頼を1つ選んで、教え子{B.sortie.members}人と先生で出撃します。宿敵のいる依頼には、その宿敵と因縁のある子が必ず入ります。</p>
      {s.quests.map((q) => <QuestCard s={s} q={q} rec={rec?.id === q.id} onClick={() => onPick(q.id)} />)}
    </Sheet>
  );
}

function QuestCard({ s, q, rec, onClick }: { s: GameState; q: Quest; rec?: boolean; onClick?: () => void }) {
  const o = officerForQuest(s, q);
  const nem = !!o && q.nemesisId === o.id;
  return (
    <button class={`pcard tb-quest${nem ? ' nem' : ''}`} onClick={onClick}>
      <div class="row nowrap gap8">
        {o ? <OfficerFace o={o} size={48} frame={nem ? '#c0392b' : undefined} /> : <span class="tb-qmark">{q.real ? '依' : '演'}</span>}
        <div class="grow">
          <b>{q.title}</b>{rec && <span class="chip-o" style={{ marginLeft: 6 }}>おすすめ</span>}{q.mustGo && <span class="chip-o red" style={{ marginLeft: 6 }}>断れない</span>}
          <div class="small">{q.client}{q.clientCountry ? `（${COUNTRY_SHORT[q.clientCountry]}）` : ''}・{OBJECTIVE_NAMES[q.objective]}・危険 <Stars n={q.danger + Math.floor((questStages(q) - 1) / 2)} max={questStages(q) >= 3 ? 5 : 3} /></div>
          <div class="small muted">報酬 {q.reward}G{o ? `・敵将 ${officerName(o)}（${rankName(o)}）` : ''}</div>
          {questStages(q) > 1 && <div class={`small tb-stages${questStages(q) >= 3 ? ' big' : ''}`}>{stageLabel(q)}</div>}
          {nem && <div class="small red">宿敵がいる：{q.nemesisKind === 'challenge' ? '果たし状が届いた' : q.nemesisKind === 'rush' ? `${s.students[q.rushBy ?? '']?.given ?? '教え子'}が先に向かってしまった` : 'この依頼の先に、因縁の相手が待っている'}</div>}
        </div>
      </div>
    </button>
  );
}

function Members({ s, q, onBack }: { s: GameState; q: Quest; onBack?: () => void }) {
  const must = mustJoin(s, q);
  const [ids, setIds] = useState<string[]>(() => recommendDeploy(s, q));
  const list = enrolled(s).filter(available).sort((a, c) => Number(ids.includes(c.id)) - Number(ids.includes(a.id)) || c.level - a.level);
  const toggle = (id: string) => {
    if (must.includes(id)) return;
    sfx('move');
    setIds((x) => (x.includes(id) ? x.filter((y) => y !== id) : x.length >= B.sortie.members ? x : [...x, id]));
  };
  const go = (manual: boolean) => { sfx('ok'); act((g) => startSortie(g, [{ questId: q.id, deploy: deployFor(g, ids), manual }])); };
  const yearBattles = (id: string) => (s.students[id].evalLog ?? []).filter((e) => e.year === s.year).length;
  // 22夜目：だれが何を持つか（装備した武器。ない子は自動）
  const plan = deployFor(s, ids);
  const [eq, setEq] = useState<string | null>(null);
  // 23夜目⑤：敵将の札・敵の顔ぶれ・相性の印・先生のおすすめ
  const o = officerForQuest(s, q);
  const line = useMemo(() => lineupFor(s, q, ids.slice(0, 1)), [q.id]);
  const team = enrolled(s).filter(available);
  const [book, setBook] = useState(false);
  const recIds = recommendDeploy(s, q);
  const same = recIds.length === ids.length && recIds.every((x) => ids.includes(x));
  return (
    <Sheet title="出撃する教え子">
      <QuestCard s={s} q={q} />
      {o && <FoeCard s={s} q={q} o={o} onOpen={() => { sfx('move'); setBook(true); }} />}
      {line && <div class="pcard tb-lineup">
        <div class="small"><b>敵の顔ぶれ</b>{questStages(q) > 1 ? `（1つ目の戦場「${q.stageNames?.[0] ?? ''}」）` : ''}：{line.total}人</div>
        <div class="small">{line.boss ? `敵将 ${line.boss}・` : ''}{line.grunts.map((g) => `${g.name}${g.n}`).join('・')}</div>
        <div class="small muted">戦場：{FIELD_BY_ID[line.field]?.name ?? ''}・勝ち方：{OBJ_SHORT[line.objective] ?? ''}</div>
      </div>}
      <div class="row between nowrap" style={{ marginTop: 6 }}>
        <p class="small grow" style={{ margin: 0 }}>教え子を{B.sortie.members}人まで選びます（今 {ids.length}人）。出撃しない子は、後ろで支えます。</p>
        <button class="btn small accent" disabled={same} onClick={() => { sfx('ok'); setIds(recIds); }}>先生のおすすめの{B.sortie.members}人</button>
      </div>
      <div class="tb-legend-row small muted"><span class="aff weak">弱</span>弱点を突ける <span class="aff frag">狙</span>狙われやすい <span class="aff bond">縁</span>宿敵と因縁あり</div>
      <div class="tb-mem">
        {list.map((st) => { const af = affinityOf(s, st, o, team); return (
          <button class={`tb-mc${ids.includes(st.id) ? ' on' : ''}${must.includes(st.id) ? ' must' : ''}`} onClick={() => toggle(st.id)} aria-pressed={ids.includes(st.id)}>
            <Portrait st={st} size={44} />
            <span class="tb-mt"><b>{nameTag(s, st)}</b><small>Lv{st.level} {CLASSES[st.classId]?.name}</small><span class="tb-mrow"><AtkMarksSmall list={studentAttacks(st).slice(0, 3)} />{af.weak && <span class="aff weak" title="弱点を突ける">弱</span>}{af.fragile && <span class="aff frag" title="狙われやすい">狙</span>}{af.bond && <span class="aff bond" title="宿敵と因縁あり">縁</span>}</span><small>{must.includes(st.id) ? '必ず出る（因縁）' : `今年 ${yearBattles(st.id)}回`}</small></span>
          </button>
        ); })}
      </div>
      {ids.length > 0 && <div class="tb-arms">
        <div class="small" style={{ marginTop: 8 }}><b>持っていく武器</b>（タップで付け替え）</div>
        {plan.map((d) => { const st = s.students[d.studentId]; const a = armoryItem(s, d.armoryUid); return st && <button class="tb-mw" onClick={() => { sfx('move'); setEq(st.id); }}><b>{st.given}</b>：{a ? itemName(a) : '武器なし'}{st.equip && st.equip === d.armoryUid ? '（装備）' : '（おまかせ）'}</button>; })}
      </div>}
      {eq && s.students[eq] && <EquipSheet s={s} st={s.students[eq]} onClose={() => setEq(null)} />}
      {book && o && <Sheet top title="因縁の帳" onClose={() => setBook(false)}>{o.meets.length > 0 ? <NemDetail s={s} o={o} /> : <p class="small muted">まだ刃を交えたことのない相手です。</p>}</Sheet>}
      <div class="row nowrap gap8" style={{ marginTop: 10 }}>
        <button class="btn primary grow" disabled={!ids.length} onClick={() => go(true)}>自分で戦う</button>
        <button class="btn accent grow" disabled={!ids.length} onClick={() => go(false)}>おまかせ</button>
      </div>
      <p class="small muted">おまかせは、同じ計算で自動に進み、結果と名場面だけを見ます。{questStages(q) > 1 ? '戦場と戦場のあいだの小休止と道も、おまかせが選びます。' : ''}</p>
      {onBack && <button class="btn ghost block" onClick={onBack}>依頼を選びなおす</button>}
    </Sheet>
  );
}

const OBJ_SHORT: Record<string, string> = { boss: '敵将を倒す', rout: '敵を全員倒す', defend: '守り抜く', rescue: '捕らわれた人を救い出す', escape: '先生が北の端へ逃げきる' };
function AtkMarksSmall({ list }: { list: AtkType[] }) { return <>{list.map((t) => <AtkMark small t={t} />)}</>; }

/** 23夜目⑤：敵将の札（顔・名前・二つ名・兵種・Lv・盾・弱点・効かない種類・攻撃の種類・ひとこと・因縁） */
function FoeCard({ s, q, o, onOpen }: { s: GameState; q: Quest; o: EnemyOfficer; onOpen: () => void }) {
  ensureOfficerCombat(o);
  const nem = q.nemesisId === o.id;
  const weak = (o.weak ?? []) as AtkType[];
  const known = (o.knownWeak ?? []) as AtkType[];
  const resist = ((o.resist ?? []) as AtkType[]).filter((t) => !weak.includes(t));
  const atk = officerAttack(o);
  const sh = Math.min(TB.shields.nemesisMax, (nem ? TB.shields.nemesis : TB.shields.captain) + (nem ? Math.min(2, Math.floor(bondOf(s, o) / 4)) : 0));
  const bonds = Object.values(s.rivalries ?? {}).filter((rv) => rv.oid === o.id && !rv.settled && s.students[rv.sid]?.status === 'enrolled').map((rv) => bondText(s, o, rv.sid)).filter(Boolean).slice(0, 2);
  const word = LEADER_NAMES[o.personality as LeaderPersonality];
  const traits = (o.knownTraits ?? []).map((k) => OFFICER_TRAITS[k]?.name).filter(Boolean).slice(0, 2);
  return (
    <button class={`pcard tb-foecard${nem ? ' nem' : ''}`} onClick={onOpen}>
      <div class="row nowrap gap8">
        <OfficerFace o={o} size={56} frame={nem ? '#c0392b' : undefined} s={s} />
        <div class="grow" style={{ minWidth: 0 }}>
          <div class="tb-fn"><b>{officerName(o)}</b>{nem && <span class="chip-o red">宿敵</span>}</div>
          <div class="small">{CLASSES[o.classId]?.name ?? ''}・Lv{o.level}・盾 {Array.from({ length: sh }, () => <span class="sh" />)}</div>
          <div class="small tb-fw">弱点 {weak.length ? weak.map((t) => (known.includes(t) ? <AtkMark t={t} state="weak" /> : <AtkMark state="q" />)) : 'なし'}{resist.length > 0 && <> 効かない {resist.map((t) => <AtkMark t={t} state="no" />)}</>}</div>
          <div class="small">攻撃 {atk.types.map((t) => <AtkMark t={t} />)}（{atk.magic ? '魔法：魔防で受ける' : '武器：守りで受ける'}）</div>
        </div>
      </div>
      {(word || traits.length > 0) && <div class="small muted" style={{ marginTop: 4 }}>ひとこと：{[word, ...traits].filter(Boolean).join('・')}</div>}
      {bonds.map((t) => <div class="small red">因縁：{t}</div>)}
      <div class="small muted" style={{ textAlign: 'right' }}>タップで因縁の帳 ▶</div>
    </button>
  );
}
