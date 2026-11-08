// 戦闘の結果（9夜目）：生徒ごとの評価（称号・名場面・ひとこと・戦績・伸び・宿敵）、3部隊の結果をまとめた1枚、新しい策を覚えた演出
import { useEffect, useState } from 'preact/hooks';
import { Sheet } from './common';
import { Portrait, OfficerFace } from './Portrait';
import { Icon } from './icons';
import { sfx } from './sound';
import { countryColor, ClassName } from './cards';
import { GrowthPlayer } from './Growth';
import { AutoResultHead } from './AutoBattle';
import { navigate } from './store';
import type { GameState, BattleReport, StudentEval, Pending, LootItem } from '../core/state';
import { WEAPONS } from '../data/weapons';
import { BADGES } from '../data/evaluation';
import { STRATS } from '../data/stratagems';
import { FACTION_COLOR } from '../data/officers';
import { officerById, officerName } from '../core/officers';

const SQUAD_NAMES = ['第一部隊', '第二部隊', '第三部隊'];
const RESULT_MEET: Record<string, string> = { win: '取り逃がした', lose: 'に敗れた', fled: 'は傷を負って逃げのびた', fell: 'を討ち取った', spared: 'を見逃した', persuaded: 'を説き伏せた', yielded: 'を一騎打ちで破った' };

/** 結果の画面：この戦いの敵将（顔と、どうなったか） */
function ResultOfficer({ s, id }: { s: GameState; id: string }) {
  const o = officerById(s, id);
  const m = o?.meets[o.meets.length - 1];
  if (!o || !m) return null;
  return (
    <div class="pcard" style={{ ['--band' as string]: FACTION_COLOR[o.faction] }}>
      <div class="row nowrap gap8">
        <OfficerFace o={o} size={52} frame={FACTION_COLOR[o.faction]} s={s} />
        <div class="grow" style={{ minWidth: 0 }}>
          <div class="small muted">この戦いの敵将</div>
          <b class="serif">{officerName(o)}</b>
          <div class="small">{`${officerName(o)}${RESULT_MEET[m.result] ?? ''}`}{o.status === 'active' && o.meets.length > 1 ? `（会うのは${o.meets.length}回目）` : ''}</div>
        </div>
      </div>
    </div>
  );
}

export function Badge({ id }: { id: string }) {
  const b = BADGES[id];
  if (!b) return null;
  return <span class={`ev-badge ${b.tone}`} title={b.desc}>{b.name}</span>;
}

/** 一人ぶんの評価 */
export function EvalCard({ s, e }: { s: GameState; e: StudentEval }) {
  const st = s.students[e.id];
  if (!st) return null;
  if (e.outcome === 'dead') {
    return (
      <div class="ev-card dead">
        <div class="row nowrap gap8"><Portrait st={st} size={48} frame="#555" /><div class="grow"><b class="serif">{st.given}</b><div class="small">帰らぬ人となった</div>{e.scene && <div class="small muted">{e.scene}</div>}</div></div>
      </div>
    );
  }
  const hr = e.rec.swings ? Math.round((e.rec.hits / e.rec.swings) * 100) : null;
  return (
    <div class={`ev-card${e.outcome === 'injured' ? ' hurt' : ''}`} onClick={() => navigate({ tab: 'students', page: 'detail', id: st.id })}>
      <div class="row nowrap gap8" style={{ alignItems: 'flex-start' }}>
        <Portrait st={st} size={52} frame={countryColor(st.origin)} />
        <div class="grow" style={{ minWidth: 0 }}>
          <div class="row nowrap between"><span class="row nowrap gap6"><b class="serif ev-name">{st.given}</b><span class="small"><ClassName classId={st.classId} size={11} /></span></span><span class={`ev-grade g${e.grade}`}>{e.grade}</span></div>
          <div class="ev-badges">{e.badges.map((b) => <Badge id={b} />)}</div>
          {e.scene && <div class="ev-scene"><Icon name="flag" size={13} /> {e.scene}</div>}
        </div>
      </div>
      {e.say && <div class="ev-say">「{e.say}」</div>}
      <div class="ev-rec">
        <span>撃破<b>{e.rec.kills}</b></span><span>与えた<b>{e.rec.dealt}</b></span><span>受けた<b>{e.rec.taken}</b></span>{e.rec.healed > 0 && <span>回復<b>{e.rec.healed}</b></span>}{hr !== null && <span>命中<b>{hr}%</b></span>}
      </div>
      {e.growth.map((g) => <div class="ev-grow">↑ {g}</div>)}
      {e.rivals.map((r) => <div class="ev-rival"><Icon name="flame" size={13} /> {r}</div>)}
    </div>
  );
}

/** 教官が同行しなかった部隊：部隊長の判断と、大事な出来事の短い場面（10夜目） */
export function AwayBlock({ s, p, short }: { s: GameState; p: BattleReport; short?: boolean }) {
  if (!p.away) return null;
  const cap = p.captain ? s.students[p.captain] : null;
  const calls = p.calls ?? [];
  return (
    <div class="paper small aw-block">
      <div class="row nowrap gap6">{cap && <Portrait st={cap} size={30} frame={countryColor(cap.origin)} />}<b>先生は同行しませんでした。{cap ? `部隊長の${cap.given}がまかされました` : ''}</b></div>
      {calls.length === 0 && <div class="muted">ここぞの判断が要る場面はありませんでした。</div>}
      {calls.map((c) => <div class={`aw-call ${c.good ? 'good' : 'bad'}`}>{cap ? `${cap.given}の判断` : '部隊長の判断'}：{c.label} → <b>{c.good ? 'うまくいった' : '迷いが出た'}</b></div>)}
      {!short && (p.moments ?? []).length > 0 && (
        <div class="aw-moments">
          {(p.moments ?? []).map((m) => { const st = s.students[m.by]; return <div class={`aw-m ${m.by === 'leader' ? 'leader' : ''}`}>{st && <Portrait st={st} size={26} />}<span>{st ? `${st.given}「${m.text}」` : m.text}</span></div>; })}
        </div>
      )}
    </div>
  );
}

/** 1つの戦いの結果の中身 */
export function ReportBody({ s, p, compact }: { s: GameState; p: BattleReport; compact?: boolean }) {
  return (
    <>
      {!compact && <AutoResultHead s={s} mvp={p.mvp} review={p.review} />}
      <AwayBlock s={s} p={p} />
      {p.stratReview && p.stratReview.length > 0 && <div class="paper small st-review"><b>策の講評</b>{p.stratReview.map((r) => <div>・{r}</div>)}</div>}
      {p.officerId && <ResultOfficer s={s} id={p.officerId} />}
      {p.findings && p.findings.length > 0 && (
        <div class="pcard" style={{ ['--band' as string]: 'var(--gold)' }}>
          <h3 style={{ marginTop: 0 }}>この戦いで伸びた・分かったこと</h3>
          <ul class="list sumlist">{p.findings.map((f) => <li><span class="todoicon"><Icon name={f.icon} size={16} /></span><span>{f.text}</span></li>)}</ul>
        </div>
      )}
      <h3>生徒ごとの評価</h3>
      {p.evals ? p.evals.map((e) => <EvalCard s={s} e={e} />) : p.grades.map((g) => { const st = s.students[g.id]; return st ? <div class="ev-card"><div class="row nowrap gap8"><Portrait st={st} size={40} /><b class="grow">{st.given}</b><span class={`ev-grade g${g.grade}`}>{g.grade}</span></div><div class="small">{g.note}</div></div> : null; })}
      <div class="pcard"><ul class="list sumlist">{p.lines.map((l) => <li><span class="todoicon"><Icon name={l.startsWith('勝利') ? 'flag' : l.startsWith('敗北') ? 'skull' : l.includes('報酬') ? 'coin' : 'scroll'} size={16} /></span><span>{l}</span></li>)}</ul></div>
    </>
  );
}

/** 戦利品の頁（10夜目）：光る札で1つずつ、タップで次へ */
export function LootView({ s, items, onDone }: { s: GameState; items: LootItem[]; onDone: () => void }) {
  const [i, setI] = useState(0);
  const [lit, setLit] = useState(false);
  useEffect(() => { setLit(false); const t = setTimeout(() => { setLit(true); sfx('pass'); }, 350); return () => clearTimeout(t); }, [i]);
  const x = items[i];
  if (!x) { onDone(); return null; }
  const w = WEAPONS[x.weaponId];
  const by = x.named?.by ? s.students[x.named.by] : null;
  const next = () => { sfx('ok'); if (i + 1 < items.length) setI(i + 1); else onDone(); };
  return (
    <div class="dc-wrap stage3 lt-wrap" onClick={() => { if (!lit) setLit(true); else next(); }}>
      <div class="dc-title">戦利品{items.length > 1 ? `（${i + 1}／${items.length}）` : ''}</div>
      <div class={`lt-card${lit ? ' lit' : ''}${x.named ? ' named' : ''}`} key={i}>
        <span class="lt-icon"><Icon name={({ sword: 'sword', lance: 'lance', axe: 'axe', bow: 'bow', gun: 'gun' } as Record<string, string>)[w?.type ?? ''] ?? 'sword'} size={44} /></span>
        <b class="serif">{x.named?.name ?? w?.name}</b>
        {x.named && <small>銘入り・{w?.name}</small>}
        <small class="muted">{w ? `威力${w.might + (x.named?.might ?? 0)}・命中${w.hit + (x.named?.hit ?? 0)}・必要な技能${w.rank}` : ''}</small>
      </div>
      <div class={`dc-text${lit ? ' show' : ''}`}><p>{x.from}</p>{x.named && <p class="small">{x.named.story}</p>}</div>
      {by && <div class="row nowrap gap6 ns-by"><Portrait st={by} size={40} frame={countryColor(by.origin)} /><span class="small">{by.given}が手に入れた</span></div>}
      <div class="small muted" style={{ marginTop: 6 }}>武器庫に入りました。出撃のとき、合う子に自動で持たせます</div>
      <button class="btn primary block" style={{ marginTop: 10 }} onClick={(e) => { e.stopPropagation(); next(); }}>{i + 1 < items.length ? '次へ' : '閉じる'}</button>
    </div>
  );
}

export function BattleResult({ s, p, onDone }: { s: GameState; p: BattleReport; onDone: () => void }) {
  const [step, setStep] = useState(p.growth?.length ? 0 : 1);
  if (step === 2) return <LootView s={s} items={p.loot ?? []} onDone={onDone} />;
  if (step === 0) return <Sheet title={p.win ? '勝利 ― 成長の記録' : '敗北 ― 成長の記録'}><GrowthPlayer s={s} entries={p.growth ?? []} title="出撃した生徒" onDone={() => setStep(1)} /></Sheet>;
  return (
    <Sheet title={`${p.win ? '勝利' : '敗北'}${p.title ? `：${p.title}` : ''}`}>
      <ReportBody s={s} p={p} />
      <button class="btn primary block" onClick={() => { sfx('ok'); if ((p.loot ?? []).length) setStep(2); else onDone(); }}>{(p.loot ?? []).length ? '戦利品を見る' : '閉じる'}</button>
    </Sheet>
  );
}

/** 2部隊以上の結果：まとめて1枚（勝敗・称号・名場面・けが人）→ 成長（タップで1人ずつ）→ 部隊ごとのくわしい評価 */
export function SortieResult({ s, reports, onDone }: { s: GameState; reports: BattleReport[]; onDone: () => void }) {
  const growth = reports.flatMap((r) => r.growth ?? []);
  const [step, setStep] = useState<'sum' | 'grow' | 'loot' | number>('sum');
  const loot = reports.flatMap((r) => r.loot ?? []);
  const close = () => { sfx('ok'); if (loot.length) setStep('loot'); else onDone(); };
  if (step === 'loot') return <LootView s={s} items={loot} onDone={onDone} />;
  if (step === 'grow') return <Sheet title="成長の記録"><GrowthPlayer s={s} entries={growth} title="出撃した生徒" onDone={() => setStep(0)} /></Sheet>;
  if (typeof step === 'number') {
    const p = reports[step];
    return (
      <Sheet title={`${SQUAD_NAMES[p.squad ?? step]}：${p.win ? '勝利' : '敗北'}`}>
        <div class="seg sq-tabs">{reports.map((r, i) => <button class={i === step ? 'on' : ''} onClick={() => { sfx('move'); setStep(i); }}>{SQUAD_NAMES[r.squad ?? i]}</button>)}</div>
        <ReportBody s={s} p={p} />
        <button class="btn primary block" onClick={close}>{loot.length ? '戦利品を見る' : '閉じる'}</button>
      </Sheet>
    );
  }
  const won = reports.filter((r) => r.win).length;
  return (
    <Sheet title="月末の出撃の結果">
      <div class="sr-head serif"><b>{reports.length}部隊</b>　勝利 {won}・敗北 {reports.length - won}</div>
      {reports.map((r, i) => {
        const mvp = r.mvp ? s.students[r.mvp] : null;
        const top = (r.evals ?? []).filter((e) => !e.outcome && e.badges.some((b) => b !== 'quiet')).slice(0, 3);
        const scene = (r.evals ?? []).find((e) => e.id === r.mvp)?.scene ?? (r.evals ?? []).find((e) => e.scene)?.scene;
        return (
          <div class={`pcard sr-card ${r.win ? 'win' : 'lose'}`} onClick={() => { sfx('ok'); setStep(i); }}>
            <div class="row between nowrap"><span class="sq-no">{SQUAD_NAMES[r.squad ?? i]}</span><span class={`sr-res ${r.win ? 'win' : 'lose'}`}>{r.win ? '勝利' : '敗北'}</span></div>
            <b class="serif">{r.title}</b>
            {mvp && <div class="row nowrap gap6 small"><Portrait st={mvp} size={30} frame={countryColor(mvp.origin)} /><span>MVP <b>{mvp.given}</b></span></div>}
            {scene && <div class="small ev-scene">名場面：{scene}</div>}
            {r.away && <AwayBlock s={s} p={r} short />}
            {top.length > 0 && <div class="ev-badges">{top.map((e) => <span class="sr-who">{s.students[e.id]?.given}<Badge id={e.badges[0]} /></span>)}</div>}
            {(r.fallen ?? []).length > 0 && <div class="small sr-fall">{(r.fallen ?? []).map((f) => `${s.students[f.id]?.given ?? ''}${f.outcome === 'dead' ? '（戦死）' : '（重傷）'}`).join('・')}</div>}
            {(r.stratReview ?? []).length > 0 && <div class="small muted">{r.stratReview!.join('　')}</div>}
            {r.lines.filter((l) => l.includes('報酬') || l.includes('評判')).slice(0, 1).map((l) => <div class="small">{l}</div>)}
            <div class="small muted" style={{ textAlign: 'right' }}>くわしく ›</div>
          </div>
        );
      })}
      <button class="btn primary block" onClick={() => { sfx('ok'); setStep(growth.length ? 'grow' : 0); }}>{growth.length ? '成長を見る' : '部隊ごとの評価へ'}</button>
    </Sheet>
  );
}

/** 新しい策を覚えた（発見の演出） */
export function NewStratView({ s, p, onDone }: { s: GameState; p: Extract<Pending, { type: 'newStrat' }>; onDone: () => void }) {
  const d = STRATS[p.id as keyof typeof STRATS];
  const st = p.by ? s.students[p.by] : null;
  const [show, setShow] = useState(false);
  useEffect(() => { const t = setTimeout(() => { setShow(true); sfx('pass'); }, 450); return () => clearTimeout(t); }, []);
  if (!d) { onDone(); return null; }
  return (
    <div class="dc-wrap stage3 ns-wrap" onClick={() => setShow(true)}>
      <div class="dc-title">新しい策を覚えた</div>
      <div class={`ns-card${show ? ' lit' : ''}`}><span class="ns-mark">{d.mark}</span><b class="serif">{d.name}</b></div>
      <div class={`dc-text${show ? ' show' : ''}`}><p>{d.desc}</p><p class="small muted">{d.tip}</p></div>
      {st && <div class="row nowrap gap6 ns-by"><Portrait st={st} size={40} frame={countryColor(st.origin)} /><span class="small">{p.why}</span></div>}
      <div class="small muted" style={{ marginTop: 6 }}>出撃前の画面で、策として選べるようになりました</div>
      <button class="btn primary block" style={{ marginTop: 10 }} onClick={(e) => { e.stopPropagation(); sfx('ok'); onDone(); }}>閉じる</button>
    </div>
  );
}
