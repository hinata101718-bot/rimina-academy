// 23夜目⑦：進軍の画面（戦場と戦場のあいだ：持ち越しの様子・小休止を1つ・道を選ぶ）と、上に出す小さな進軍の地図
import { useState } from 'preact/hooks';
import { act } from './store';
import { sfx } from './sound';
import { Portrait, OfficerFace } from './Portrait';
import type { GameState } from '../core/state';
import type { MarchState } from '../core/march';
import { benchOf, autoBreak } from '../core/march';
import { nextStage } from '../core/flow';
import { officerById, officerName } from '../core/officers';
import { REST_TEXT, ROUTE_TEXT, type RestKind } from '../data/march';
import { FIELD_BY_ID } from '../data/tactics';
import { armoryItem } from '../core/loot';
import { itemName } from '../core/rarity';
import { EquipSheet } from './Equip';
import { TechSheet, techLine } from './TechPick';
import { CLASSES } from '../data/classes';

const OBJ_SHORT: Record<string, string> = { boss: '敵将を倒す', rout: '全員倒す', defend: '守り抜く', rescue: '救い出す', escape: '逃げきる' };

/** 進軍の地図（今どの戦場にいて、あといくつか） */
export function MarchMap({ names, idx, small }: { names: string[]; idx: number; small?: boolean }) {
  return (
    <div class={`mm-map${small ? ' small' : ''}`} aria-label={`進軍 ${idx + 1}／${names.length}`}>
      {names.map((n, i) => (
        <>
          {i > 0 && <span class={`mm-line${i <= idx ? ' done' : ''}`} />}
          <span class={`mm-step${i < idx ? ' done' : i === idx ? ' now' : ''}`}><i>{i < idx ? '✓' : i + 1}</i><small>{n}</small></span>
        </>
      ))}
    </div>
  );
}

export function MarchBreak({ s, m }: { s: GameState; m: MarchState }) {
  const q = s.quests.find((x) => x.id === m.questId);
  const rec = autoBreak(s, m);
  const [rest, setRest] = useState<RestKind>(rec.rest);
  const [route, setRoute] = useState<'short' | 'detour'>(rec.route);
  const bench = benchOf(s, m);
  const [swapIn, setSwapIn] = useState<string | null>(rec.swapIn ?? bench[0] ?? null);
  const [swapOut, setSwapOut] = useState<string | null>(rec.swapOut ?? null);
  const [eq, setEq] = useState<string | null>(null);
  const [tp, setTp] = useState<string | null>(null);
  const foe = m.foe ? officerById(s, m.foe.officerId) : null;
  const next = m.idx + 1;
  const nf = FIELD_BY_ID[m.fields[next]];
  const go = () => { sfx('ok'); act((g) => { nextStage(g, { rest, route, swapIn: rest === 'swap' ? swapIn : null, swapOut: rest === 'swap' ? swapOut : null }); }); };
  const t = m.carry.teacher;
  return (
    <div class="mm-wrap">
      <div class="mm-head"><b>進軍：{q?.title ?? ''}</b><small>戦場 {m.idx + 1}つ目を抜いた</small></div>
      <MarchMap names={m.names} idx={next} />
      <div class="mm-card">
        <h3>持ち越しの様子</h3>
        <p class="small muted">体力は少しだけ戻って、次の戦場へ持ち越します。技の回数は、戦場ごとに全部戻ります。</p>
        <div class="mm-carry">
          {t && <div class="mm-c"><span class="mm-cf t">師</span><span class="mm-cn"><b>{s.instructor.name}先生</b><span class="mm-hp"><i style={{ width: `${(t.hp / t.max) * 100}%` }} /></span><small>体力 {t.hp}/{t.max}</small></span></div>}
          {m.deploy.map((d) => { const st = s.students[d.studentId]; const c = m.carry[d.studentId]; return st && (
            <div class="mm-c"><span class="mm-cf"><Portrait st={st} size={36} /></span><span class="mm-cn"><b>{st.given}</b><span class="mm-hp"><i style={{ width: `${c ? (c.hp / c.max) * 100 : 100}%` }} /></span><small>{c ? `体力 ${c.hp}/${c.max}` : '元気（新しく加わる）'}{c?.potion ? '・傷薬あり' : ''}</small></span></div>
          ); })}
          {m.out.map((id) => { const st = s.students[id]; return st && <div class="mm-c out"><span class="mm-cf"><Portrait st={st} size={36} /></span><span class="mm-cn"><b>{st.given}</b><small>倒れた（次の戦場には出られない）</small></span></div>; })}
        </div>
        {foe && m.foe && <div class="mm-foe"><OfficerFace o={foe} size={40} s={s} /><span class="small">{m.foe.fled ? <><b>{officerName(foe)}</b>は次の戦場へ退いた。傷を負ったまま（体力 {m.foe.hp}/{m.foe.max}）待ち構えている</> : <><b>{officerName(foe)}</b>が次の戦場にいる</>}</span></div>}
      </div>
      <div class="mm-card">
        <h3>小休止（1つだけ選ぶ）</h3>
        <div class="mm-opts">
          {(['heal', 'swap', 'equip', 'scout'] as RestKind[]).map((k) => (
            <button class={`mm-opt${rest === k ? ' on' : ''}`} disabled={k === 'swap' && !bench.length} aria-pressed={rest === k} onClick={() => { sfx('move'); setRest(k); }}>
              <b>{REST_TEXT[k].name}{rec.rest === k && <span class="mm-rec">おすすめ</span>}</b><small>{k === 'swap' && !bench.length ? '後ろに出られる子がいない' : REST_TEXT[k].desc}</small>
            </button>
          ))}
        </div>
        {rest === 'swap' && bench.length > 0 && (
          <div class="mm-swap">
            <div class="small"><b>加わる子</b></div>
            <div class="mm-chips">{bench.slice(0, 8).map((id) => <button class={`mm-chip${swapIn === id ? ' on' : ''}`} onClick={() => setSwapIn(id)}>{s.students[id].given}<small>Lv{s.students[id].level} {CLASSES[s.students[id].classId]?.name}</small></button>)}</div>
            <div class="small" style={{ marginTop: 6 }}><b>下がる子</b>（空きがあれば、だれも下がらなくてよい）</div>
            <div class="mm-chips"><button class={`mm-chip${!swapOut ? ' on' : ''}`} onClick={() => setSwapOut(null)}>だれも下がらない</button>{m.deploy.map((d) => <button class={`mm-chip${swapOut === d.studentId ? ' on' : ''}`} onClick={() => setSwapOut(d.studentId)}>{s.students[d.studentId]?.given}<small>{m.carry[d.studentId] ? `体力 ${m.carry[d.studentId].hp}/${m.carry[d.studentId].max}` : ''}</small></button>)}</div>
          </div>
        )}
        {rest === 'equip' && (
          <div class="mm-swap">
            {m.deploy.map((d) => { const st = s.students[d.studentId]; const a = armoryItem(s, st?.equip ?? d.armoryUid); return st && <button class="tb-mw" onClick={() => { sfx('move'); setEq(st.id); }}><b>{st.given}</b>：{a ? itemName(a) : 'おまかせ'}（タップで付け替え）</button>; })}
            <div class="small" style={{ marginTop: 6 }}><b>持っていく技</b></div>
            {m.deploy.map((d) => { const st = s.students[d.studentId]; return st && <button class="tb-mw" onClick={() => { sfx('move'); setTp(st.id); }}><b>{st.given}</b>：{techLine(st)}（タップで付け替え）</button>; })}
          </div>
        )}
      </div>
      <div class="mm-card">
        <h3>道を選ぶ（次は「{m.names[next]}」）</h3>
        <p class="small muted">{nf?.name ?? ''}・勝ち方：{OBJ_SHORT[m.objectives[next]] ?? ''}{next === m.total - 1 ? '（最後の戦場）' : ''}</p>
        <div class="mm-opts two">
          {(['short', 'detour'] as const).map((k) => (
            <button class={`mm-opt${route === k ? ' on' : ''}`} aria-pressed={route === k} onClick={() => { sfx('move'); setRoute(k); }}>
              <b>{ROUTE_TEXT[k].name}{rec.route === k && <span class="mm-rec">おすすめ</span>}</b><small>{ROUTE_TEXT[k].desc}</small>
            </button>
          ))}
        </div>
      </div>
      <button class="btn primary block mm-go" onClick={go}>次の戦場へ（{m.names[next]}）</button>
      {eq && s.students[eq] && <EquipSheet s={s} st={s.students[eq]} onClose={() => setEq(null)} />}
      {tp && s.students[tp] && <TechSheet st={s.students[tp]} onClose={() => setTp(null)} />}
    </div>
  );
}
