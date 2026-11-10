// 19夜目：月末の出撃（依頼を選ぶ → 教え子4人と先生 → 自分で戦うか、おまかせか）
import { useState } from 'preact/hooks';
import { act } from './store';
import { sfx } from './sound';
import { Sheet } from './common';
import { Portrait, OfficerFace } from './Portrait';
import { Stars } from './cards';
import type { GameState, Quest } from '../core/state';
import { enrolled, available } from '../core/game';
import { startSortie, officerForQuest } from '../core/flow';
import { recommendDeploy, deployFor, mustJoin, recommendQuest } from '../core/sortie';
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
          <div class="small">{q.client}{q.clientCountry ? `（${COUNTRY_SHORT[q.clientCountry]}）` : ''}・{OBJECTIVE_NAMES[q.objective]}・危険 <Stars n={q.danger} /></div>
          <div class="small muted">報酬 {q.reward}G{o ? `・敵将 ${officerName(o)}（${rankName(o)}）` : ''}</div>
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
  return (
    <Sheet title="出撃する教え子">
      <QuestCard s={s} q={q} />
      <p class="small">教え子を{B.sortie.members}人まで選びます（今 {ids.length}人）。出撃しない子は、後ろで薬を作る・罠を仕掛ける・弱点を調べて支えます。</p>
      <div class="tb-mem">
        {list.map((st) => (
          <button class={`tb-mc${ids.includes(st.id) ? ' on' : ''}${must.includes(st.id) ? ' must' : ''}`} onClick={() => toggle(st.id)} aria-pressed={ids.includes(st.id)}>
            <Portrait st={st} size={44} />
            <span class="tb-mt"><b>{st.given}</b><small>Lv{st.level} {CLASSES[st.classId]?.name}</small><small>{must.includes(st.id) ? '必ず出る（因縁）' : `今年 ${yearBattles(st.id)}回`}</small></span>
          </button>
        ))}
      </div>
      {ids.length > 0 && <div class="tb-arms">
        <div class="small" style={{ marginTop: 8 }}><b>持っていく武器</b>（タップで付け替え）</div>
        {plan.map((d) => { const st = s.students[d.studentId]; const a = armoryItem(s, d.armoryUid); return st && <button class="tb-mw" onClick={() => { sfx('move'); setEq(st.id); }}><b>{st.given}</b>：{a ? itemName(a) : '武器なし'}{st.equip && st.equip === d.armoryUid ? '（装備）' : '（おまかせ）'}</button>; })}
      </div>}
      {eq && s.students[eq] && <EquipSheet s={s} st={s.students[eq]} onClose={() => setEq(null)} />}
      <div class="row nowrap gap8" style={{ marginTop: 10 }}>
        <button class="btn primary grow" disabled={!ids.length} onClick={() => go(true)}>自分で戦う</button>
        <button class="btn accent grow" disabled={!ids.length} onClick={() => go(false)}>おまかせ</button>
      </div>
      <p class="small muted">おまかせは、同じ計算で自動に進み、結果と名場面だけを見ます。</p>
      {onBack && <button class="btn ghost block" onClick={onBack}>依頼を選びなおす</button>}
    </Sheet>
  );
}
