// 月末の出撃（9夜目）：依頼掲示板から部隊の数だけ依頼を選び、部隊ごとにメンバー・方針・策・部隊長を決める。10夜目：2つ目・3つ目の部隊は、はじめ教官が同行しない（結果だけ）
import { useEffect, useState } from 'preact/hooks';
import { act } from './store';
import { Sheet } from './common';
import { Portrait } from './Portrait';
import { Icon } from './icons';
import { sfx } from './sound';
import { countryColor, CountryChip, Stars, Num, LvBadge, OBJECTIVE_ICON, WEATHER_ICON } from './cards';
import { ArtSlot } from './HomeDeco';
import type { GameState, Quest } from '../core/state';
import { squadCount, squadLimit, startSortie, battleCtx } from '../core/flow';
import { recommendSquads } from '../core/autoplay';
import { estimateWin } from '../core/battle/auto';
import { OBJECTIVE_NAMES, WEATHER_NAMES } from '../core/quests';
import { STRATS } from '../data/stratagems';
import { TACTICS } from '../data/autobattle';
import { SQUADS } from '../data/stratagems';
import { enrolled } from '../core/game';
import { SquadEditor, newDraft, draftFromSquad, planOf, squadOf, type SquadDraft } from './AutoBattle';

const SQUAD_NAMES = ['第一部隊', '第二部隊', '第三部隊'];

/** 依頼の札（掲示板） */
export function QuestCard({ x, onClick, tag }: { x: Quest; onClick?: () => void; tag?: string }) {
  return (
    <div class={`pcard${onClick ? ' tap' : ''}`} style={{ ['--band' as string]: x.clientCountry ? countryColor(x.clientCountry) : 'var(--main)' }} onClick={onClick}>
      <div class="row between nowrap"><span class="ptitle">{x.title}</span><span class="row nowrap gap4">{tag && <span class="flag gold">{tag}</span>}<span class={`flag ${x.real ? 'red' : ''}`}>{x.real ? '実戦' : x.kind === 'exhibition' ? '演武会' : '演習'}</span></span></div>
      <div class="row nowrap gap6 small" style={{ marginTop: 2 }}>{x.clientCountry && <CountryChip o={x.clientCountry} />}<span class="muted">依頼主：{x.client}</span></div>
      <div class="infogrid">
        <div><Icon name={OBJECTIVE_ICON[x.objective]} size={17} />{OBJECTIVE_NAMES[x.objective]}{x.defendTurns && x.objective === 'defend' ? `（${x.defendTurns}ターン）` : ''}</div>
        <div><Icon name={WEATHER_ICON[x.weather]} size={17} />{WEATHER_NAMES[x.weather]}</div>
        <div>危険度 <Stars n={x.danger} /></div>
        <div><Icon name="coin" size={17} />{x.reward ? <Num v={x.reward.toLocaleString()} unit="G" /> : '報酬なし'}</div>
        <div><Icon name="target" size={17} />推奨 <LvBadge lv={x.level} /></div>
        <div class={x.real ? '' : 'muted'}>{x.real ? <><Icon name="skull" size={17} />戦死あり</> : '誰も死なない'}</div>
      </div>
    </div>
  );
}

export function SortiePrep({ s }: { s: GameState }) {
  const n = squadCount(s);
  // 1部隊のとき：掲示板→出撃前（今まで通り）。2部隊以上：全部隊のおすすめを並べた出撃の机
  const [drafts, setDrafts] = useState<SquadDraft[]>(() => (n > 1 ? recommendSquads(s).map((x) => draftFromSquad(s, x)) : s.quests.length === 1 ? [newDraft(s, s.quests[0], squadLimit(s, 0))] : []));
  const [edit, setEdit] = useState<number | null>(() => (n === 1 && s.quests.length === 1 ? 0 : null));
  const setDraft = (i: number, d: SquadDraft) => setDrafts(drafts.map((x, j) => (j === i ? d : x)));
  const others = (i: number) => {
    const ex = new Set<string>(), arms = new Set<string>();
    drafts.forEach((d, j) => { if (j === i) return; for (const x of d.deploy) { ex.add(x.studentId); if (x.armoryUid) arms.add(x.armoryUid); if (x.staffUid) arms.add(x.staffUid); } });
    return { ex, arms };
  };
  const go = (list: SquadDraft[]) => act((g) => startSortie(g, list.filter((d) => d.deploy.length).map((d) => squadOf(g, d))));
  // ---- 1部隊：掲示板 ----
  if (n === 1 && edit === null) {
    return (
      <Sheet title="月末の依頼掲示板">
        {s.month === 5 && <ArtSlot name="event_exhibition" />}
        {s.settings.guide && s.year === 1 && s.month === 0 && <div class="guide">最初は「演習」を選びましょう。演習では誰も死にません。実戦は報酬と評判がもらえますが、倒れた生徒が戦死することがあります。</div>}
        {enrolled(s).length > 12 && <div class="small muted">在籍が{SQUADS.two}人を超えると、月末に2部隊を別々の依頼へ出せます（{SQUADS.three}人で3部隊）</div>}
        {s.quests.map((x) => <QuestCard x={x} onClick={() => { sfx('ok'); setDrafts([newDraft(s, x, squadLimit(s, 0))]); setEdit(0); }} />)}
      </Sheet>
    );
  }
  if (edit !== null && drafts[edit]) {
    const i = edit;
    const { ex, arms } = others(i);
    const usedQ = new Set(drafts.filter((_, j) => j !== i).map((d) => d.questId));
    return <SquadEditor key={`${i}`} s={s} draft={drafts[i]} setDraft={(d) => setDraft(i, d)} limit={squadLimit(s, i)} exclude={ex} usedArms={arms}
      quests={n > 1 ? s.quests.filter((q) => !usedQ.has(q.id)) : []} squadNo={n > 1 ? i : undefined}
      onBack={n > 1 ? () => setEdit(null) : s.quests.length > 1 ? () => { setEdit(null); setDrafts([]); } : undefined}
      onGo={() => { if (n > 1) setEdit(null); else go(drafts); }} goLabel={n > 1 ? 'この部隊を決める' : `出撃する（${drafts[i].deploy.length}人）`} />;
  }
  // ---- 2部隊以上：出撃の机 ----
  const move = (i: number, d: -1 | 1) => { const j = i + d; if (j < 0 || j >= drafts.length) return; sfx('move'); const nd = [...drafts]; [nd[i], nd[j]] = [nd[j], nd[i]]; setDrafts(nd); };
  const freeQ = s.quests.filter((q) => !drafts.some((d) => d.questId === q.id));
  const total = drafts.reduce((a, d) => a + d.deploy.length, 0);
  return (
    <Sheet title="月末の出撃">
      <div class="sq-head">
        <div><b>今月は{n}部隊まで出せます</b><span class="small muted">（在籍{enrolled(s).length}人）</span></div>
        <div class="small muted">先生は第一部隊に同行して、戦いを見守ります。ほかの部隊は部隊長にまかせて、結果だけを見ます（札の「同行する」で、先生がついていくこともできます）。順番は ▲▼ で変えられます。</div>
        <button class="btn small" onClick={() => { sfx('ok'); setDrafts(recommendSquads(s, drafts.map((d) => d.questId)).map((x) => draftFromSquad(s, x))); }}>おすすめの編成（全部隊）</button>
      </div>
      {drafts.map((d, i) => <SquadCard key={`${i}${d.questId}`} s={s} d={d} i={i} n={drafts.length} onAway={(v) => { sfx('move'); setDraft(i, { ...d, away: v }); }} onOpen={() => { sfx('ok'); setEdit(i); }} onMove={(k) => move(i, k)} onRemove={drafts.length > 1 ? () => { sfx('cancel'); setDrafts(drafts.filter((_, j) => j !== i)); } : undefined} />)}
      {drafts.length < n && freeQ.length > 0 && (
        <div class="sq-add">
          <div class="small"><b>{SQUAD_NAMES[drafts.length]}を出す</b>：依頼を選んでください</div>
          {freeQ.map((x) => <QuestCard x={x} onClick={() => { sfx('ok'); const { ex, arms } = others(-1); const nd = newDraft(s, x, squadLimit(s, drafts.length), ex, arms); setDrafts([...drafts, nd]); setEdit(drafts.length); }} />)}
        </div>
      )}
      <button class="btn accent block" style={{ marginTop: 8 }} disabled={!total} onClick={() => { sfx('ok'); go(drafts); }}>出撃する（{drafts.filter((d) => d.deploy.length).length}部隊・{total}人）</button>
    </Sheet>
  );
}

function SquadCard({ s, d, i, n, onOpen, onMove, onRemove, onAway }: { s: GameState; d: SquadDraft; i: number; n: number; onAway: (v: boolean) => void; onOpen: () => void; onMove: (k: -1 | 1) => void; onRemove?: () => void }) {
  const q = s.quests.find((x) => x.id === d.questId)!;
  const plan = planOf(s, d);
  const key = `${q.id}|${d.deploy.map((x) => x.studentId).join(',')}|${plan.tactic}|${(plan.strats ?? []).join(',')}`;
  const [est, setEst] = useState<{ key: string; label: string } | null>(null);
  useEffect(() => {
    if (!d.deploy.length) return;
    const t = setTimeout(() => setEst({ key, label: estimateWin(s, q, d.deploy, plan, battleCtx(s)).label }), 250 + i * 200);
    return () => clearTimeout(t);
  }, [key]);
  const cap = plan.captain ? s.students[plan.captain] : null;
  return (
    <div class="pcard sq-card" style={{ ['--band' as string]: q.clientCountry ? countryColor(q.clientCountry) : 'var(--main)' }}>
      <div class="row between nowrap">
        <span class="sq-no">{SQUAD_NAMES[i]}</span>
        <span class="row nowrap gap4">
          <button class="btn small sq-mv" disabled={i === 0} onClick={() => onMove(-1)} aria-label="上へ">▲</button>
          <button class="btn small sq-mv" disabled={i === n - 1} onClick={() => onMove(1)} aria-label="下へ">▼</button>
          {onRemove && <button class="btn small sq-mv" onClick={onRemove} aria-label="この部隊を出さない">✕</button>}
        </span>
      </div>
      <div class="tap" onClick={onOpen}>
        <div class="row between nowrap"><b class="serif">{q.title}</b><span class={`flag ${q.real ? 'red' : ''}`}>{q.real ? '実戦' : '演習'}</span></div>
        <div class="small muted">{OBJECTIVE_NAMES[q.objective]}・{WEATHER_NAMES[q.weather]}・危険度{'★'.repeat(q.danger)}{q.reward ? `・報酬${q.reward}G` : ''}</div>
        <div class="sq-faces">{d.deploy.map((x) => { const st = s.students[x.studentId]; return st ? <span class="sq-face"><Portrait st={st} size={34} frame={countryColor(st.origin)} />{plan.captain === st.id && <i class="sq-captmark">長</i>}</span> : null; })}</div>
        <div class="small">部隊長：<b>{cap?.given ?? '—'}</b>　方針：{TACTICS[plan.tactic].name}　{d.manual ? '自分で指揮' : ''}</div>
        <div class="small">策：{(plan.strats ?? []).length ? (plan.strats ?? []).map((x) => <span class="st-chip">{STRATS[x].mark} {STRATS[x].name}</span>) : <span class="muted">なし</span>}</div>
      </div>
      {i > 0 && !d.manual && (
        <div class="sq-away">
          <button class={`btn small${d.away !== false ? ' primary' : ''}`} onClick={() => onAway(true)}>同行しない（結果だけ）</button>
          <button class={`btn small${d.away === false ? ' primary' : ''}`} onClick={() => onAway(false)}>同行する</button>
        </div>
      )}
      {i > 0 && !d.manual && d.away !== false && <div class="small muted">ここぞの判断は部隊長の{cap?.given ?? ''}がします。統率と軍略が高いほど、よい判断になりやすい</div>}
      <div class="tap" onClick={onOpen}>
        <div class="row between nowrap small"><span>{d.deploy.length}人　勝ち目：<b class={`ab-oddsv ${est?.key === key ? ({ 優勢: 'good', 五分: 'even', 苦しい: 'bad' } as Record<string, string>)[est.label] ?? '' : ''}`}>{est?.key === key ? est.label : '…'}</b></span><span class="muted">タップで編成 ›</span></div>
      </div>
    </div>
  );
}
