import { useEffect, useRef, useState } from 'preact/hooks';
import { useStore, act } from './store';
import type { BattleState, Unit, LastAction } from '../core/battle/types';
import { reachable, threatTiles, enemyThreat, moveUnit, attack, heal, wait, useItem, endPlayerPhase, rewind, canRewind, canVisit, visit, canOpenChest, openChest, canPersuade, persuade, command, canCommand, commandRate, allActed } from '../core/battle/engine';
import { forecast, weaponOf, staffOf, inRange, dist, canUseNow, tile, terrainDef } from '../core/battle/calc';
import { battleCtx, finishBattle, ensureReinforcementFactory } from '../core/flow';
import { CLASSES } from '../data/classes';
import { OBJECTIVE_NAMES, WEATHER_NAMES } from '../core/quests';
import { Portrait } from './Portrait';
import { sfx } from './sound';
import type { GameState } from '../core/state';

type Mode = { kind: 'idle' } | { kind: 'selected'; uid: string } | { kind: 'menu'; uid: string; from: [number, number] } | { kind: 'target'; uid: string; from: [number, number]; heal?: boolean } | { kind: 'confirm'; uid: string; from: [number, number]; target: string; heal?: boolean } | { kind: 'command'; cmd: 'again' | 'aim' | 'retreat' };

const TMARK: Record<string, string> = { forest: '🌲', mountain: '⛰', fort: '🏰', river: '', bridge: '', village: '🏠', wall: '', plain: '', road: '' };

export function BattleView() {
  const { s } = useStore();
  const [mode, setMode] = useState<Mode>({ kind: 'idle' });
  const [showThreat, setShowThreat] = useState(false);
  const [inspect, setInspect] = useState<string | null>(null);
  const [popups, setPopups] = useState<{ id: number; x: number; y: number; text: string; kind: string }[]>([]);
  const [cutin, setCutin] = useState<LastAction | null>(null);
  const [replay, setReplay] = useState<{ steps: ReturnType<typeof endPlayerPhase>; i: number } | null>(null);
  const [msg, setMsg] = useState('');
  const lastSeq = useRef(0);
  const boardRef = useRef<HTMLDivElement>(null);
  if (!s || !s.battle) return null;
  const b = s.battle;
  ensureReinforcementFactory(s);
  const ctx = battleCtx(s);
  const W = b.width;
  const cellSize = () => (boardRef.current?.clientWidth ?? 390) / W;

  // 演出：直前の行動の数値ポップとカットイン
  const showAction = (a: LastAction | null) => {
    if (!a || a.seq === lastSeq.current) return;
    lastSeq.current = a.seq;
    const cs = cellSize();
    const u = (uid: string) => b.units.find((x) => x.uid === uid);
    const ps: typeof popups = [];
    for (const st of a.strikes) {
      const target = u(st.by === a.attacker ? a.defender : a.attacker);
      if (!target) continue;
      ps.push({ id: Math.random(), x: target.x * cs + cs / 3, y: target.y * cs, text: st.hit ? `${st.dmg}` : 'ミス', kind: st.crit ? 'crit' : st.hit ? 'hit' : 'miss' });
    }
    if (a.heal) { const t = u(a.defender); if (t) ps.push({ id: Math.random(), x: t.x * cs + cs / 3, y: t.y * cs, text: `+${a.heal}`, kind: 'heal' }); }
    setPopups(ps);
    setTimeout(() => setPopups([]), 900);
    const crit = a.strikes.some((x) => x.crit);
    const boss = [a.attacker, a.defender].some((id) => u(id)?.boss);
    if (a.heal) sfx('heal'); else if (crit) sfx('crit'); else if (a.killed.length) sfx('kill'); else if (a.strikes.some((x) => x.hit)) sfx('hit'); else sfx('miss');
    const want = s.settings.cutin === 'all' ? a.strikes.length > 0 : s.settings.cutin === 'important' ? (crit || a.killed.length > 0 || boss) : false;
    if (want) { setCutin(a); setTimeout(() => setCutin(null), 1000); }
  };
  useEffect(() => { if (!replay) showAction(b.lastAction); });

  // 敵ターンの再生
  useEffect(() => {
    if (!replay) return;
    if (replay.i >= replay.steps.length) { setReplay(null); return; }
    const step = replay.steps[replay.i];
    if (step.action) showAction(step.action);
    const delay = step.action ? [0, 1300, 800, 380][s.settings.enemySpeed] : 60;
    const t = setTimeout(() => setReplay({ ...replay, i: replay.i + 1 }), delay);
    return () => clearTimeout(t);
  }, [replay]);

  const unitAtXY = (x: number, y: number) => b.units.find((u) => !u.dead && u.x === x && u.y === y);
  const controllable = (u: Unit) => (u.side === 'player' || u.side === 'ally' || u.side === 'npc') && !u.acted && b.phase === 'player';
  const sel = 'uid' in mode ? b.units.find((u) => u.uid === mode.uid) : undefined;

  // ハイライト
  const mv = new Set<number>(), atk = new Set<number>(), threat = new Set<number>();
  if (mode.kind === 'selected' && sel) {
    const r = reachable(b, sel);
    r.forEach((_, k) => mv.add(k));
    threatTiles(b, sel, r.keys()).forEach((k) => { if (!mv.has(k)) atk.add(k); });
  }
  if ((mode.kind === 'target') && sel) {
    const t = mode.heal ? threatTiles(b, sel, [sel.y * W + sel.x], true) : threatTiles(b, sel, [sel.y * W + sel.x]);
    t.forEach((k) => atk.add(k));
  }
  if (showThreat) for (const e of b.units) if (e.side === 'enemy' && !e.dead) enemyThreat(b, e).forEach((k) => threat.add(k));
  if (inspect) { const e = b.units.find((u) => u.uid === inspect); if (e && !e.dead) enemyThreat(b, e).forEach((k) => threat.add(k)); }

  const tap = (x: number, y: number) => {
    if (b.phase !== 'player' || replay) return;
    const u = unitAtXY(x, y);
    const k = y * W + x;
    setMsg('');
    if (mode.kind === 'command') {
      if (u && u.side === 'player') { act((g) => { const t = command(g.battle!, ctx, mode.cmd, g.battle!.units.find((z) => z.uid === u.uid)!); setMsg(t || 'その生徒には出せない指示です'); }); setMode({ kind: 'idle' }); }
      return;
    }
    if (mode.kind === 'idle' || mode.kind === 'selected') {
      if (mode.kind === 'selected' && sel && mv.has(k) && (!u || u === sel)) {
        const from: [number, number] = [sel.x, sel.y];
        sfx('move');
        act((g) => { moveUnit(g.battle!, g.battle!.units.find((z) => z.uid === sel.uid)!, x, y); }, false);
        setMode({ kind: 'menu', uid: sel.uid, from });
        return;
      }
      if (u && controllable(u)) { sfx('ok'); setInspect(null); setMode({ kind: 'selected', uid: u.uid }); return; }
      if (u && u.side === 'enemy') { sfx('move'); setInspect(inspect === u.uid ? null : u.uid); setMode({ kind: 'idle' }); return; }
      setInspect(null); setMode({ kind: 'idle' });
      return;
    }
    if (mode.kind === 'target' && sel) {
      if (u && atk.has(k) && ((mode.heal && u.side !== 'enemy' && u.hp < u.maxHp) || (!mode.heal && u.side === 'enemy'))) { sfx('ok'); setMode({ kind: 'confirm', uid: sel.uid, from: mode.from, target: u.uid, heal: mode.heal }); }
    }
  };

  const undoMove = (uid: string, from: [number, number]) => act((g) => { const u = g.battle!.units.find((z) => z.uid === uid)!; u.x = from[0]; u.y = from[1]; u.moved = false; }, false);

  const endTurn = () => {
    sfx('ok');
    setMode({ kind: 'idle' }); setInspect(null);
    let steps: ReturnType<typeof endPlayerPhase> = [];
    act((g) => { steps = endPlayerPhase(g.battle!, ctx); });
    setReplay({ steps, i: 0 });
  };

  const objective = `${OBJECTIVE_NAMES[b.objective]}${b.objective === 'defend' ? `（${b.defendTurns}ターン）` : ''}`;
  const enemies = b.units.filter((u) => u.side === 'enemy' && !u.dead).length;
  const info = sel ?? (inspect ? b.units.find((u) => u.uid === inspect) : undefined);

  return (
    <div class="battle">
      <div class="top">
        <b>{b.title}</b>
        <span>ターン{b.turn}{b.phase === 'enemy' || replay ? '（敵）' : ''}</span>
        <span>{objective}</span>
        <span>{WEATHER_NAMES[b.weather]}</span>
        <span>敵{enemies}</span>
        {!b.real && <span>演習（死なない）</span>}
      </div>
      <div class="board" ref={boardRef}>
        {b.tiles.map((t, k) => {
          const x = k % W, y = Math.floor(k / W);
          const u = unitAtXY(x, y);
          const isGoal = b.goal && b.goal.x === x && b.goal.y === y;
          const chest = b.chests.find((c) => c.x === x && c.y === y && !c.opened);
          return (
            <div class={`cell t-${t}${mv.has(k) ? ' mv' : ''}${atk.has(k) ? ' atk' : ''}${threat.has(k) ? ' threat' : ''}${isGoal ? ' goal' : ''}${sel && sel.x === x && sel.y === y ? ' sel' : ''}`} onClick={() => tap(x, y)}>
              <span class="tmark">{TMARK[t]}{chest ? '📦' : ''}</span>
              {u && <UnitChip u={u} s={s} />}
            </div>
          );
        })}
        {popups.map((p) => <div key={p.id} class={`pop ${p.kind}`} style={{ left: p.x, top: p.y }}>{p.text}</div>)}
      </div>
      <div class="panel">
        {msg && <div class="guide">{msg}</div>}
        {b.phase === 'done' ? (
          <div class="card" style={{ textAlign: 'center' }}>
            <h2>{b.result === 'win' ? '勝利！' : '敗北……'}</h2>
            <button class="btn primary block" onClick={() => { sfx(b.result === 'win' ? 'level' : 'sad'); act((g) => finishBattle(g)); }}>結果を見る</button>
          </div>
        ) : replay ? (
          <div class="card row between"><span>敵の行動中…</span><button class="btn small" onClick={() => setReplay(null)}>スキップ</button></div>
        ) : (
          <>
            {mode.kind === 'menu' && sel && <ActionMenu b={b} u={sel} s={s} onAttack={() => setMode({ kind: 'target', uid: sel.uid, from: mode.from })} onHeal={() => setMode({ kind: 'target', uid: sel.uid, from: mode.from, heal: true })}
              onDone={(t) => { setMsg(t ?? ''); setMode({ kind: 'idle' }); }} onBack={() => { sfx('cancel'); undoMove(sel.uid, mode.from); setMode({ kind: 'selected', uid: sel.uid }); }} />}
            {mode.kind === 'target' && <div class="card row between"><span>{mode.heal ? '回復する味方' : '攻撃する敵'}をタップ</span><button class="btn ghost small" onClick={() => setMode({ kind: 'menu', uid: mode.uid, from: mode.from })}>戻る</button></div>}
            {mode.kind === 'confirm' && sel && <Confirm b={b} s={s} a={sel} d={b.units.find((u) => u.uid === mode.target)!} heal={mode.heal}
              onOk={() => { act((g) => { const bb = g.battle!; const A = bb.units.find((z) => z.uid === sel.uid)!, D = bb.units.find((z) => z.uid === mode.target)!; if (mode.heal) heal(bb, A, D); else attack(bb, ctx, A, D); }); setMode({ kind: 'idle' }); }}
              onBack={() => { sfx('cancel'); setMode({ kind: 'target', uid: sel.uid, from: mode.from, heal: mode.heal }); }} />}
            {mode.kind === 'command' && <div class="card row between"><span>指示を出す生徒をタップ</span><button class="btn ghost small" onClick={() => setMode({ kind: 'idle' })}>やめる</button></div>}
            {(mode.kind === 'idle' || mode.kind === 'selected') && (
              <div class="row" style={{ margin: '6px 0' }}>
                <button class={`btn small ${showThreat ? 'primary' : ''}`} onClick={() => setShowThreat(!showThreat)}>敵の範囲</button>
                <CommandButtons b={b} onPick={(cmd) => setMode({ kind: 'command', cmd })} />
                {canRewind(b) > 0 && <RewindButton b={b} />}
                <button class={`btn small ${allActed(b) ? 'accent' : ''} grow`} onClick={endTurn}>ターン終了</button>
              </div>
            )}
          </>
        )}
        {info && <UnitInfo u={info} s={s} b={b} />}
        <div class="log">{[...b.log].reverse().slice(0, 6).map((l) => <div>{l.text}</div>)}</div>
        {b.phase !== 'done' && <details class="muted small" style={{ marginTop: 6 }}><summary>あきらめる</summary><button class="btn ghost small" onClick={() => { if (confirm('撤退しますか？（敗北になります）')) act((g) => { g.battle!.phase = 'done'; g.battle!.result = 'lose'; }); }}>撤退する</button></details>}
      </div>
      {cutin && <CutIn a={cutin} b={b} s={s} />}
    </div>
  );
}

function UnitChip({ u, s }: { u: Unit; s: GameState }) {
  const st = u.studentId ? s.students[u.studentId] : null;
  return (
    <div class={`unit ${u.side}${u.acted && u.side !== 'enemy' ? ' done' : ''}${u.boss ? ' boss' : ''}`}>
      {st && s.settings.portrait === 'face' ? <div style={{ position: 'absolute', inset: 0, opacity: 0.85 }}><Portrait st={st} size={44} /></div> : null}
      <span class="nm" style={{ position: 'relative', textShadow: '0 0 2px #000' }}>{u.name.replace(/（.*）/, '').slice(0, 4)}</span>
      <div class="hp"><span style={{ width: `${(u.hp / u.maxHp) * 100}%`, background: u.hp / u.maxHp < 0.34 ? '#ff6a5a' : undefined }} /></div>
    </div>
  );
}

function UnitInfo({ u, s, b }: { u: Unit; s: GameState; b: BattleState }) {
  const w = weaponOf(u);
  const t = terrainDef(tile(b, u.x, u.y));
  return (
    <div class="card small">
      <b>{u.name}</b> {CLASSES[u.classId]?.name} Lv{u.level}　HP {u.hp}/{u.maxHp}{u.boss ? '（ボス）' : ''}{u.persuadable ? '（説得できる）' : ''}
      <div>力{u.stats.str} 魔{u.stats.mag} 技{u.stats.skl} 速{u.stats.spd} 幸{u.stats.lck} 守{u.stats.def} 魔防{u.stats.res}　移動{CLASSES[u.classId]?.move}</div>
      <div>武器：{w ? `${w.name}（威力${w.might}・射程${w.minRange === w.maxRange ? w.minRange : `${w.minRange}-${w.maxRange}`}）` : 'なし'}{staffOf(u) ? `・${staffOf(u)!.name}` : ''}{u.item ? `・${u.item === 'elixir' ? '特効薬' : '傷薬'}` : ''}</div>
      <div class="muted">地形：{t.name}{t.avo ? ` 回避+${t.avo}` : ''}{t.def ? ` 守備+${t.def}` : ''}{u.poison ? '・毒' : ''}{u.weaken ? '・弱体' : ''}{u.reloadTurn === b.turn ? '・装填中' : ''}</div>
      {u.studentId && s.students[u.studentId] && u.side === 'player' && <div class="muted">信頼{Math.round(s.students[u.studentId].trust)}（指示の成功率{Math.round(commandRate(battleCtx(s), u))}%）</div>}
    </div>
  );
}

function ActionMenu({ b, u, s, onAttack, onHeal, onDone, onBack }: { b: BattleState; u: Unit; s: GameState; onAttack: () => void; onHeal: () => void; onDone: (t?: string) => void; onBack: () => void }) {
  const ctx = battleCtx(s);
  const w = weaponOf(u);
  const foes = b.units.filter((e) => e.side === 'enemy' && !e.dead);
  const canAtk = !!w && canUseNow(b, u, w) && foes.some((e) => inRange(b, w, dist(u, e)));
  const st = staffOf(u);
  const canHeal = !!st && b.units.some((a) => a.side !== 'enemy' && !a.dead && a !== u && a.hp < a.maxHp && inRange(b, st, dist(a, u)));
  const doAct = (fn: (bb: BattleState, uu: Unit) => string | boolean | void) => { let t: string | undefined; act((g) => { const bb = g.battle!; const r = fn(bb, bb.units.find((z) => z.uid === u.uid)!); if (typeof r === 'string') t = r; }); sfx('ok'); onDone(t); };
  return (
    <div class="card">
      <div class="row">
        {canAtk && <button class="btn small accent" onClick={onAttack}>攻撃</button>}
        {canHeal && <button class="btn small primary" onClick={onHeal}>回復</button>}
        {u.item && u.hp < u.maxHp && <button class="btn small" onClick={() => doAct((bb, uu) => { useItem(bb, uu); })}>{u.item === 'elixir' ? '特効薬' : '傷薬'}</button>}
        {canVisit(b, u) && <button class="btn small" onClick={() => doAct((bb, uu) => visit(bb, uu))}>訪問</button>}
        {canOpenChest(b, u) && <button class="btn small" onClick={() => doAct((bb, uu) => openChest(bb, uu))}>宝箱</button>}
        {canPersuade(b, u) && <button class="btn small primary" onClick={() => doAct((bb, uu) => persuade(bb, ctx, uu))}>説得</button>}
        <button class="btn small" onClick={() => doAct((bb, uu) => { wait(bb, uu); })}>待機</button>
        <button class="btn small ghost" onClick={onBack}>戻る</button>
      </div>
      {w && w.type === 'gun' && !canUseNow(b, u, w) && <div class="muted small">{b.weather === 'rain' ? '雨で銃が使えない' : '装填中で撃てない'}</div>}
    </div>
  );
}

function Confirm({ b, s, a, d, heal: isHeal, onOk, onBack }: { b: BattleState; s: GameState; a: Unit; d: Unit; heal?: boolean; onOk: () => void; onBack: () => void }) {
  if (isHeal) {
    const st = staffOf(a)!;
    return <div class="card"><div>{a.name}が{d.name}を回復（{st.name}：HP{d.hp}→{Math.min(d.maxHp, d.hp + st.might + Math.floor(a.stats.mag / 2))}）</div><div class="row"><button class="btn primary grow" onClick={onOk}>決定</button><button class="btn ghost" onClick={onBack}>戻る</button></div></div>;
  }
  const f = forecast(b, a, d, a.x, a.y, battleCtx(s).support);
  const tri = (n: number) => n > 0 ? '▲有利' : n < 0 ? '▼不利' : '';
  const aw = weaponOf(a), dw = weaponOf(d);
  return (
    <div class="card">
      <div class="forecast">
        <div><b>{a.name}</b><div class="small">{aw?.name} {tri(f.atk.triangle)}{f.atk.effective ? ' 特効!' : ''}</div></div><div class="lbl">戦闘予測</div><div><b>{d.name}</b><div class="small">{dw?.name ?? '武器なし'} {tri(f.def.triangle)}</div></div>
        <div>{a.hp}/{a.maxHp}</div><div class="lbl">HP</div><div>{d.hp}/{d.maxHp}</div>
        <div><b>{f.atk.dmg}{f.atk.count > 1 ? ' ×2' : ''}</b></div><div class="lbl">威力</div><div><b>{f.def.canAttack ? `${f.def.dmg}${f.def.count > 1 ? ' ×2' : ''}` : '—'}</b></div>
        <div>{f.atk.hit}%</div><div class="lbl">命中</div><div>{f.def.canAttack ? `${f.def.hit}%` : '—'}</div>
        <div>{f.atk.crit}%</div><div class="lbl">必殺</div><div>{f.def.canAttack ? `${f.def.crit}%` : '—'}</div>
      </div>
      {!f.def.canAttack && <div class="muted small" style={{ textAlign: 'center' }}>相手は反撃できない</div>}
      <div class="row" style={{ marginTop: 6 }}><button class="btn accent grow" onClick={onOk}>決定</button><button class="btn ghost" onClick={onBack}>戻る</button></div>
    </div>
  );
}

function CommandButtons({ b, onPick }: { b: BattleState; onPick: (c: 'again' | 'aim' | 'retreat') => void }) {
  const [open, setOpen] = useState(false);
  if (!canCommand(b)) return <button class="btn small" disabled>指示（済）</button>;
  if (!open) return <button class="btn small" onClick={() => setOpen(true)}>指示</button>;
  return (
    <span class="row">
      <button class="btn small" disabled={b.commandUsed.again} onClick={() => onPick('again')}>もう一度動け</button>
      <button class="btn small" onClick={() => onPick('aim')}>狙え</button>
      <button class="btn small" disabled={b.commandUsed.retreat} onClick={() => onPick('retreat')}>下がれ</button>
    </span>
  );
}

function RewindButton({ b }: { b: BattleState }) {
  const [open, setOpen] = useState(false);
  const n = canRewind(b);
  if (!open) return <button class="btn small" onClick={() => setOpen(true)}>巻き戻し（{b.rewindsLeft}）</button>;
  return (
    <span class="row">
      {Array.from({ length: n }, (_, i) => i + 1).map((k) => <button class="btn small" onClick={() => { sfx('cancel'); act((g) => { g.battle = rewind(g.battle!, k); }); setOpen(false); }}>{k === 1 ? 'このターンの最初' : `${k - 1}ターン前`}</button>)}
      <button class="btn small ghost" onClick={() => setOpen(false)}>やめる</button>
    </span>
  );
}

function CutIn({ a, b, s }: { a: LastAction; b: BattleState; s: GameState }) {
  const A = b.units.find((u) => u.uid === a.attacker), D = b.units.find((u) => u.uid === a.defender);
  if (!A || !D) return null;
  const face = (u: Unit) => u.studentId && s.students[u.studentId] ? <Portrait st={s.students[u.studentId]} size={64} /> : <div class={`unit ${u.side}`} style={{ width: 64, height: 64, fontSize: 14 }}>{u.name.slice(0, 3)}</div>;
  const crit = a.strikes.some((x) => x.crit);
  const dmg = a.strikes.filter((x) => x.by === a.attacker).reduce((t, x) => t + x.dmg, 0);
  return (
    <div class="cutin"><div class="box">
      <div style={{ textAlign: 'center' }}>{face(A)}<div class="small">{A.name}</div><div class="small">HP {A.hp}/{A.maxHp}</div></div>
      <div class="big">{crit ? '必殺！' : a.killed.length ? '撃破！' : `${dmg}`}{crit ? <div style={{ fontSize: 16 }}>{dmg}</div> : null}</div>
      <div style={{ textAlign: 'center' }}>{face(D)}<div class="small">{D.name}</div><div class="small">HP {D.hp}/{D.maxHp}</div></div>
    </div></div>
  );
}
