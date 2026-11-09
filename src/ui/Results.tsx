// 戦闘の結果（9夜目）：生徒ごとの評価（称号・名場面・ひとこと・戦績・伸び・宿敵）、3部隊の結果をまとめた1枚、新しい策を覚えた演出
import { rarityOf, itemName, itemMod } from '../core/rarity';
import { RARITY_COLOR, RARITY_NAME, AFFIXES } from '../data/rarity';
import type { ArmoryItem } from '../core/state';
import { useEffect, useState } from 'preact/hooks';
import { Sheet } from './common';
import { Portrait, OfficerFace } from './Portrait';
import { Icon } from './icons';
import { sfx } from './sound';
import { countryColor, ClassName } from './cards';
import { GrowthPlayer } from './Growth';
import { navigate } from './store';
import type { GameState, BattleReport, StudentEval, Pending, LootItem } from '../core/state';
import { WEAPONS } from '../data/weapons';
import { BADGES } from '../data/evaluation';
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

/** 1つの戦いの結果の中身 */
export function ReportBody({ s, p, compact }: { s: GameState; p: BattleReport; compact?: boolean }) {
  return (
    <>
      {!compact && p.mvp && s.students[p.mvp] && <div class="row nowrap gap8 pcard"><Portrait st={s.students[p.mvp]} size={44} /><span>いちばんの働き：<b>{s.students[p.mvp].given}</b>{p.auto ? '（おまかせ）' : ''}</span></div>}
      {(p.scenes ?? []).length > 0 && <div class="paper small"><b>名場面</b>{(p.scenes ?? []).map((sc) => <div>・{sc.text}</div>)}</div>}
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
      <div class={`lt-card rar-${rarityOf(x)}${lit ? ' lit' : ''}${x.named ? ' named' : ''}`} key={i} style={{ ['--rar' as string]: RARITY_COLOR[rarityOf(x)] }}>
        <span class="rar-tag">{RARITY_NAME[rarityOf(x)]}</span>
        <span class="lt-icon"><Icon name={({ sword: 'sword', lance: 'lance', axe: 'axe', bow: 'bow', gun: 'gun' } as Record<string, string>)[w?.type ?? ''] ?? 'sword'} size={44} /></span>
        <b class="serif">{itemName(x)}</b>
        {x.named && <small>銘入り・{w?.name}</small>}
        {(x.affix ?? []).length > 0 && <small>{(x.affix ?? []).map((k) => `${AFFIXES[k].name}：${AFFIXES[k].text}`).join('　')}</small>}
        <small class="muted">{w ? `威力${w.might + (itemMod(x as ArmoryItem).dmg ?? 0)}・命中${w.hit + (itemMod(x as ArmoryItem).hit ?? 0)}・必要な技能${w.rank}` : ''}</small>
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
  if (step === 2) return <Sheet><LootView s={s} items={p.loot ?? []} onDone={onDone} /></Sheet>;
  if (step === 0) return <Sheet title={p.win ? '勝利 ― 成長の記録' : '敗北 ― 成長の記録'}><GrowthPlayer s={s} entries={p.growth ?? []} title="出撃した生徒" onDone={() => setStep(1)} /></Sheet>;
  return (
    <Sheet title={`${p.win ? '勝利' : '敗北'}${p.title ? `：${p.title}` : ''}`}>
      <ReportBody s={s} p={p} />
      <button class="btn primary block" onClick={() => { sfx('ok'); if ((p.loot ?? []).length) setStep(2); else onDone(); }}>{(p.loot ?? []).length ? '戦利品を見る' : '閉じる'}</button>
    </Sheet>
  );
}

