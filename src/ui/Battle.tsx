import { useEffect, useRef, useState } from 'preact/hooks';
import { useStore, act } from './store';
import type { BattleState, Unit, LastAction } from '../core/battle/types';
import {
  reachable, threatTiles, enemyThreat, moveUnit, attack, heal, wait, useItem, endPlayerPhase, rewind, canRewind, canVisit, visit,
  canOpenChest, openChest, canOpenDoor, openDoor, canPersuade, persuade, canRescue, rescue, canEscape, escape, command, canCommand, commandRate, allActed, findPath, canHealTarget,
  type EnemyReplay, type UnitView,
} from '../core/battle/engine';
import { forecast, weaponOf, staffOf, staffsOf, inRange, dist, canUseNow, tile, terrainDef, attackWeapons, healAmount, bestStaffFor } from '../core/battle/calc';
import { battleCtx, finishBattle, ensureReinforcementFactory } from '../core/flow';
import { CLASSES } from '../data/classes';
import { WEAPONS } from '../data/weapons';
import { B } from '../data/balance';
import { OBJECTIVE_NAMES, WEATHER_NAMES } from '../core/quests';
import { Portrait } from './Portrait';
import { sfx } from './sound';
import { Seq } from './anim';
import type { GameState } from '../core/state';

type Mode =
  | { kind: 'idle' }
  | { kind: 'selected'; uid: string }
  | { kind: 'menu'; uid: string; from: [number, number] }
  | { kind: 'target'; uid: string; from: [number, number]; heal?: boolean }
  | { kind: 'confirm'; uid: string; from: [number, number]; target: string; heal?: boolean; wid: string | null }
  | { kind: 'command'; cmd: 'again' | 'aim' | 'retreat' };

const TMARK: Record<string, string> = { forest: '🌲', mountain: '⛰', fort: '🏰', river: '', bridge: '', village: '🏠', wall: '', plain: '', road: '', door: '🚪' };

interface CombatShow {
  a: string; d: string; hpA: number; hpD: number; heal: boolean; big: boolean; dur: number; top: boolean;
  active: 'a' | 'd' | null; fxA: string; fxD: string; kindA: string; kindD: string;
}

/** 演出のために、直前の行動の前のHPを求める（結果のHP＋受けたダメージ／−回復量） */
function startHps(b: BattleState, a: LastAction, view: Record<string, UnitView> | null): Record<string, number> {
  const hp = (uid: string) => view?.[uid]?.hp ?? b.units.find((u) => u.uid === uid)?.hp ?? 0;
  if (view?.[a.attacker] && view?.[a.defender]) return { [a.attacker]: hp(a.attacker), [a.defender]: hp(a.defender) };
  const out: Record<string, number> = { [a.attacker]: hp(a.attacker), [a.defender]: hp(a.defender) };
  for (const st of a.strikes) { const t = st.by === a.attacker ? a.defender : a.attacker; out[t] += st.dmg; }
  if (a.heal && a.attacker !== a.defender) out[a.defender] -= a.heal;
  return out;
}

export function BattleView() {
  const { s } = useStore();
  const [mode, setMode] = useState<Mode>({ kind: 'idle' });
  const [showThreat, setShowThreat] = useState(false);
  const [inspect, setInspect] = useState<string | null>(null);
  const [popups, setPopups] = useState<{ id: number; x: number; y: number; text: string; kind: string }[]>([]);
  const [view, setView] = useState<Record<string, UnitView> | null>(null);
  const [busy, setBusy] = useState<'' | 'move' | 'enemy' | 'combat'>('');
  const [focus, setFocus] = useState<{ x: number; y: number } | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [combat, setCombat] = useState<CombatShow | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [msg, setMsg] = useState('');
  const seqRef = useRef<Seq | null>(null);
  const cursorRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<Record<string, UnitView> | null>(null);
  useEffect(() => { if (focus && cursorRef.current) cursorRef.current.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' }); }, [focus?.x, focus?.y]);
  if (!s || !s.battle) return null;
  const b = s.battle;
  ensureReinforcementFactory(s);
  const ctx = battleCtx(s);
  const W = b.width, H = b.height;

  const putView = (v: Record<string, UnitView> | null) => { viewRef.current = v; setView(v); };
  const patchView = (uid: string, p: Partial<UnitView>) => {
    const cur = viewRef.current ?? {};
    const base = cur[uid] ?? (() => { const u = b.units.find((x) => x.uid === uid)!; return { uid, x: u.x, y: u.y, hp: u.hp, dead: u.dead }; })();
    putView({ ...cur, [uid]: { ...base, ...p } });
  };
  const toMap = (list: UnitView[]) => Object.fromEntries(list.map((v) => [v.uid, v]));
  const unitOf = (uid: string) => s.battle?.units.find((u) => u.uid === uid);
  const disp = (u: Unit) => { const v = view?.[u.uid]; return v ? { ...u, x: v.x, y: v.y, hp: v.hp, dead: v.dead } : u; };
  const newSeq = () => { seqRef.current?.cancel(); const q = new Seq(); seqRef.current = q; return q; };
  const sound = (q: Seq, name: string) => { if (!q.cancelled) sfx(name); };

  const popAt = (q: Seq, uid: string, text: string, kind: string) => {
    if (q.cancelled) return;
    const v = viewRef.current?.[uid]; const u = unitOf(uid);
    const x = v?.x ?? u?.x ?? 0, y = v?.y ?? u?.y ?? 0;
    const id = Math.random();
    setPopups((p) => [...p, { id, x, y, text, kind }]);
    setTimeout(() => setPopups((p) => p.filter((z) => z.id !== id)), 900);
  };

  /** 攻撃・回復の演出：HPゲージを並べ、一撃ずつ減らす */
  const playCombat = async (q: Seq, a: LastAction) => {
    const start = startHps(s.battle ?? b, a, viewRef.current);
    if (a.attacker === a.defender) { // 道具
      if (a.heal) { sound(q, 'heal'); patchView(a.attacker, { hp: start[a.attacker] + a.heal }); popAt(q, a.attacker, `+${a.heal}`, 'heal'); await q.sleep(500); }
      return;
    }
    let hpA = start[a.attacker], hpD = start[a.defender];
    patchView(a.attacker, { hp: hpA }); patchView(a.defender, { hp: hpD });
    const crit = a.strikes.some((x) => x.crit);
    const boss = [a.attacker, a.defender].some((id) => unitOf(id)?.boss);
    const big = s.settings.cutin === 'all' ? a.strikes.length > 0 : s.settings.cutin === 'important' ? (crit || a.killed.length > 0 || boss) : false;
    const dv = viewRef.current?.[a.defender] ?? unitOf(a.defender);
    const top = (dv?.y ?? 0) >= (s.battle?.height ?? 12) / 2;
    const show: CombatShow = { a: a.attacker, d: a.defender, hpA, hpD, heal: !!a.heal, big, top, dur: q.dur(B.anim.gauge), active: null, fxA: '', fxD: '', kindA: '', kindD: '' };
    setCombat({ ...show });
    await q.sleep(180);
    if (a.heal) {
      show.active = 'a'; setCombat({ ...show }); await q.sleep(B.anim.strikeLead);
      hpD = Math.min(unitOf(a.defender)?.maxHp ?? hpD + a.heal, hpD + a.heal);
      Object.assign(show, { hpD, fxD: `+${a.heal}`, kindD: 'heal', dur: q.dur(B.anim.gauge) });
      sound(q, 'heal'); patchView(a.defender, { hp: hpD }); popAt(q, a.defender, `+${a.heal}`, 'heal');
      setCombat({ ...show });
      await q.sleep(B.anim.gauge + B.anim.strikeAfter);
    }
    for (const st of a.strikes) {
      const side: 'a' | 'd' = st.by === a.attacker ? 'a' : 'd';
      const target = side === 'a' ? a.defender : a.attacker;
      show.active = side; show.fxA = ''; show.fxD = '';
      setCombat({ ...show });
      await q.sleep(B.anim.strikeLead);
      const fx = st.hit ? (st.crit ? `必殺！ ${st.dmg}` : `${st.dmg}`) : 'MISS';
      const kind = st.hit ? (st.crit ? 'crit' : 'hit') : 'miss';
      if (side === 'a') { hpD = Math.max(0, hpD - st.dmg); show.hpD = hpD; show.fxD = fx; show.kindD = kind; }
      else { hpA = Math.max(0, hpA - st.dmg); show.hpA = hpA; show.fxA = fx; show.kindA = kind; }
      show.dur = q.dur(B.anim.gauge);
      sound(q, st.hit ? (st.crit ? 'crit' : 'hit') : 'miss');
      patchView(target, { hp: side === 'a' ? hpD : hpA });
      popAt(q, target, st.hit ? `${st.dmg}` : 'MISS', kind);
      setCombat({ ...show });
      await q.sleep(B.anim.gauge + B.anim.strikeAfter);
    }
    if (a.killed.length) {
      sound(q, 'kill');
      for (const k of a.killed) { if (k === a.attacker) { show.fxA = '撃破'; show.kindA = 'kill'; } else { show.fxD = '撃破'; show.kindD = 'kill'; } }
      show.active = null; setCombat({ ...show });
      await q.sleep(B.anim.killPause);
      for (const k of a.killed) patchView(k, { dead: true });
    }
    await q.sleep(B.anim.panelAfter);
    setCombat(null);
  };

  const finishAnim = () => { putView(null); setFocus(null); setFlash(null); setCombat(null); setBanner(null); setBusy(''); seqRef.current = null; };

  /** 味方の行動のあと（攻撃・回復・道具） */
  const afterAction = async (before: Record<string, UnitView>) => {
    const a = s.battle?.lastAction;
    if (!a) return;
    const q = newSeq();
    putView(before);
    setBusy('combat');
    await playCombat(q, a);
    finishAnim();
  };

  const runEnemy = async (rep: EnemyReplay) => {
    const q = newSeq();
    putView(toMap(rep.initial));
    setBusy('enemy');
    setBanner('敵のターン');
    sound(q, 'cancel');
    await q.sleep(B.anim.banner, 'enemy');
    setBanner(null);
    for (const st of rep.steps) {
      const moved = st.path.length > 1;
      if (!moved && !st.action) { putView({ ...(viewRef.current ?? {}), ...toMap(st.after.filter((v) => v.uid === st.uid)) }); continue; }
      const start = st.path[0];
      setFocus({ x: start[0], y: start[1] });
      await q.sleep(B.anim.enemyFocus, 'enemy');
      for (const [x, y] of st.path.slice(1)) {
        patchView(st.uid, { x, y });
        setFocus({ x, y });
        if (!q.cancelled && !q.fast) sfx('move');
        await q.sleep(B.anim.enemyWalkStep, 'enemy');
      }
      if (st.action) {
        if (st.action.defender !== st.uid) {
          setFlash(st.action.defender);
          await q.sleep(B.anim.targetFlash, 'enemy');
        }
        await playCombat(q, st.action);
        setFlash(null);
      }
      putView(toMap(st.after));
      await q.sleep(B.anim.enemyAfter, 'enemy');
    }
    setFocus(null);
    putView(null);
    const bb = s.battle;
    if (bb && bb.phase === 'player') {
      setBanner(`ターン${bb.turn}　味方の番`);
      await q.sleep(B.anim.banner * 0.8, 'enemy');
    }
    finishAnim();
  };

  const controllable = (u: Unit) => (u.side === 'player' || u.side === 'ally' || u.side === 'npc') && !u.captive && !u.acted && b.phase === 'player';
  const sel = 'uid' in mode ? b.units.find((u) => u.uid === mode.uid) : undefined;
  const unitAtXY = (x: number, y: number) => b.units.find((u) => !u.dead && u.x === x && u.y === y);

  // ハイライト
  const mv = new Set<number>(), atk = new Set<number>(), threat = new Set<number>();
  if (!busy) {
    if (mode.kind === 'selected' && sel) {
      const r = reachable(b, sel);
      r.forEach((_, k) => mv.add(k));
      threatTiles(b, sel, r.keys()).forEach((k) => { if (!mv.has(k)) atk.add(k); });
    }
    if (mode.kind === 'target' && sel) {
      const t = mode.heal ? threatTiles(b, sel, [sel.y * W + sel.x], true) : threatTiles(b, sel, [sel.y * W + sel.x]);
      t.forEach((k) => atk.add(k));
    }
    if (showThreat) for (const e of b.units) if (e.side === 'enemy' && !e.dead) enemyThreat(b, e).forEach((k) => threat.add(k));
    if (inspect) { const e = b.units.find((u) => u.uid === inspect); if (e && !e.dead) enemyThreat(b, e).forEach((k) => threat.add(k)); }
  }

  const tap = async (x: number, y: number) => {
    if (b.phase !== 'player' || busy) return;
    const u = unitAtXY(x, y);
    const k = y * W + x;
    setMsg('');
    if (mode.kind === 'command') {
      if (u && u.side === 'player') { act((g) => { const t = command(g.battle!, ctx, mode.cmd, g.battle!.units.find((z) => z.uid === u.uid)!); setMsg(t || 'その子には、この指示を出せません'); }); setMode({ kind: 'idle' }); }
      return;
    }
    if (mode.kind === 'idle' || mode.kind === 'selected') {
      if (mode.kind === 'selected' && sel && mv.has(k) && (!u || u === sel)) {
        const from: [number, number] = [sel.x, sel.y];
        const path = findPath(b, sel, x, y);
        sfx('move');
        const q = newSeq();
        putView({ [sel.uid]: { uid: sel.uid, x: sel.x, y: sel.y, hp: sel.hp, dead: false } });
        setBusy('move');
        act((g) => { moveUnit(g.battle!, g.battle!.units.find((z) => z.uid === sel.uid)!, x, y); }, false);
        for (const [px, py] of path.slice(1)) { patchView(sel.uid, { x: px, y: py }); await q.sleep(B.anim.playerWalkStep); }
        finishAnim();
        setMode({ kind: 'menu', uid: sel.uid, from });
        return;
      }
      if (u && controllable(u)) { sfx('ok'); setInspect(null); setMode({ kind: 'selected', uid: u.uid }); return; }
      if (u && u.side === 'enemy') { sfx('move'); setInspect(inspect === u.uid ? null : u.uid); setMode({ kind: 'idle' }); return; }
      setInspect(null); setMode({ kind: 'idle' });
      return;
    }
    if (mode.kind === 'target' && sel) {
      if (u && atk.has(k) && ((mode.heal && canHealTarget(b, sel, u)) || (!mode.heal && u.side === 'enemy'))) {
        sfx('ok');
        const wid = mode.heal ? bestStaffFor(b, sel, u)?.id ?? null : (attackWeapons(b, sel).find((w) => w.id === sel.weaponId && inRange(b, w, dist(sel, u))) ?? attackWeapons(b, sel).find((w) => inRange(b, w, dist(sel, u))))?.id ?? null;
        setMode({ kind: 'confirm', uid: sel.uid, from: mode.from, target: u.uid, heal: mode.heal, wid });
      }
    }
  };

  const undoMove = (uid: string, from: [number, number]) => act((g) => { const u = g.battle!.units.find((z) => z.uid === uid)!; u.x = from[0]; u.y = from[1]; u.moved = false; }, false);

  const endTurn = () => {
    sfx('ok');
    setMode({ kind: 'idle' }); setInspect(null);
    let rep: EnemyReplay = { initial: [], steps: [] };
    act((g) => { rep = endPlayerPhase(g.battle!, ctx); });
    void runEnemy(rep);
  };

  const snapshotViews = (): Record<string, UnitView> => toMap(b.units.map((u) => ({ uid: u.uid, x: u.x, y: u.y, hp: u.hp, dead: u.dead })));

  const objective = `${OBJECTIVE_NAMES[b.objective]}${b.objective === 'defend' ? `（${b.defendTurns}ターン）` : ''}`;
  const enemies = b.units.filter((u) => u.side === 'enemy' && !u.dead).length;
  const info = !busy ? (sel ?? (inspect ? b.units.find((u) => u.uid === inspect) : undefined)) : undefined;

  return (
    <div class="battle" onPointerDown={() => { if (busy && seqRef.current) seqRef.current.speedUp(); }}>
      <div class="top">
        <b>{b.title}</b>
        <span>ターン{b.turn}{busy === 'enemy' ? '（敵）' : ''}</span>
        <span>{objective}{b.objective === 'escape' ? `（${b.escaped ?? 0}／${b.escapeNeed ?? 3}人）` : ''}</span>
        <span>{WEATHER_NAMES[b.weather]}</span>
        <span>敵{enemies}</span>
        {!b.real && <span>演習（誰も死にません）</span>}
      </div>
      <div class="board">
        {b.tiles.map((t, k) => {
          const x = k % W, y = Math.floor(k / W);
          const isGoal = (b.goal && b.goal.x === x && b.goal.y === y) || (b.objective === 'escape' && y === 0 && t !== 'wall');
          const chest = b.chests.find((c) => c.x === x && c.y === y && !c.opened);
          return (
            <div class={`cell t-${t}${mv.has(k) ? ' mv' : ''}${atk.has(k) ? ' atk' : ''}${threat.has(k) ? ' threat' : ''}${isGoal ? ' goal' : ''}${!busy && sel && sel.x === x && sel.y === y ? ' sel' : ''}`} onClick={() => void tap(x, y)}>
              <span class="tmark">{TMARK[t]}{chest ? '📦' : ''}</span>
            </div>
          );
        })}
        <div class="units">
          {b.units.map((u0) => {
            const u = disp(u0);
            if (u.dead) return null;
            return (
              <div key={u.uid} class={`uwrap${flash === u.uid ? ' flash' : ''}`} style={{ left: `${(u.x / W) * 100}%`, top: `${(u.y / H) * 100}%`, width: `${100 / W}%`, height: `${100 / H}%`, transitionDuration: busy === 'enemy' ? '120ms' : busy === 'move' ? '50ms' : '0ms' }}>
                <UnitChip u={u} s={s} />
              </div>
            );
          })}
          {focus && <div ref={cursorRef} class="cursor" style={{ left: `${(focus.x / W) * 100}%`, top: `${(focus.y / H) * 100}%`, width: `${100 / W}%`, height: `${100 / H}%` }} />}
          {popups.map((p) => <div key={p.id} class={`pop ${p.kind}`} style={{ left: `${((p.x + 0.3) / W) * 100}%`, top: `${(p.y / H) * 100}%` }}>{p.text}</div>)}
        </div>
      </div>
      <div class="panel">
        {msg && <div class="guide">{msg}</div>}
        {s.settings.guide && s.year === 1 && s.month === 0 && b.phase === 'player' && !msg && !busy && (
          <div class="guide">{mode.kind === 'idle' ? '青い丸が味方です。タップすると、動ける所が青、攻撃できる所が赤で出ます。赤い丸の敵をタップすると、その敵が届く所が見えます。' : mode.kind === 'selected' ? '青いマスをタップして移動します。その場で動くなら、自分のマスをもう一度タップしてください。' : mode.kind === 'menu' ? '攻撃するなら「攻撃」、何もしないなら「待機」を押してください。「戻る」で動きをやり直せます。' : '予測を見て、よければ「決定」を押してください。全員が動いたら「ターン終了」です。'}</div>
        )}
        {busy ? (
          <div class="card row between"><span>{busy === 'enemy' ? '敵が動いています（タップで早送り）' : '…'}</span>{busy === 'enemy' && <button class="btn small" onClick={(e) => { e.stopPropagation(); seqRef.current?.cancel(); }}>スキップ</button>}</div>
        ) : b.phase === 'done' ? (
          <div class="card" style={{ textAlign: 'center' }}>
            <h2>{b.result === 'win' ? '勝利！' : '敗北……'}</h2>
            <button class="btn primary block" onClick={() => { sfx(b.result === 'win' ? 'level' : 'sad'); act((g) => finishBattle(g)); }}>結果を見る</button>
          </div>
        ) : (
          <>
            {mode.kind === 'menu' && sel && <ActionMenu b={b} u={sel} s={s} onAttack={() => setMode({ kind: 'target', uid: sel.uid, from: mode.from })} onHeal={() => setMode({ kind: 'target', uid: sel.uid, from: mode.from, heal: true })}
              onDone={(t, before) => { setMsg(t ?? ''); setMode({ kind: 'idle' }); if (before) void afterAction(before); }} snapshot={snapshotViews} onBack={() => { sfx('cancel'); undoMove(sel.uid, mode.from); setMode({ kind: 'selected', uid: sel.uid }); }} />}
            {mode.kind === 'target' && <div class="card row between"><span>{mode.heal ? '回復する味方' : '攻撃する敵'}をタップしてください</span><button class="btn ghost small" onClick={() => setMode({ kind: 'menu', uid: mode.uid, from: mode.from })}>戻る</button></div>}
            {mode.kind === 'confirm' && sel && <Confirm b={b} s={s} a={sel} d={b.units.find((u) => u.uid === mode.target)!} heal={mode.heal} wid={mode.wid}
              onWeapon={(wid) => { sfx('move'); setMode({ ...mode, wid }); }}
              onOk={() => {
                const before = snapshotViews();
                act((g) => { const bb = g.battle!; const A = bb.units.find((z) => z.uid === sel.uid)!, D = bb.units.find((z) => z.uid === mode.target)!; if (mode.heal) heal(bb, A, D, mode.wid ?? undefined); else { if (mode.wid) A.weaponId = mode.wid; attack(bb, ctx, A, D); } });
                setMode({ kind: 'idle' });
                void afterAction(before);
              }}
              onBack={() => { sfx('cancel'); setMode({ kind: 'target', uid: sel.uid, from: mode.from, heal: mode.heal }); }} />}
            {mode.kind === 'command' && <div class="card row between"><span>指示を出す子をタップしてください</span><button class="btn ghost small" onClick={() => setMode({ kind: 'idle' })}>やめる</button></div>}
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
        {b.phase !== 'done' && !busy && <details class="muted small" style={{ marginTop: 6 }}><summary>あきらめる</summary><button class="btn ghost small" onClick={() => { if (confirm('退きますか？　この戦いは負けになります。')) act((g) => { g.battle!.phase = 'done'; g.battle!.result = 'lose'; }); }}>撤退する</button></details>}
      </div>
      {combat && <CombatPanel c={combat} b={b} s={s} />}
      {banner && <div class="banner"><span>{banner}</span></div>}
    </div>
  );
}

function UnitChip({ u, s }: { u: Unit; s: GameState }) {
  const st = u.studentId ? s.students[u.studentId] : null;
  const pct = Math.max(0, (u.hp / u.maxHp) * 100);
  return (
    <div class={`unit ${u.side}${u.acted && u.side !== 'enemy' && !u.captive ? ' done' : ''}${u.boss ? ' boss' : ''}${u.captive ? ' captive' : ''}`}>
      {st && s.settings.portrait === 'face' ? <div style={{ position: 'absolute', inset: 0, opacity: 0.85 }}><Portrait st={st} size={44} /></div> : null}
      <span class="nm" style={{ position: 'relative', textShadow: '0 0 2px #000' }}>{u.name.replace(/（.*）/, '').slice(0, 4)}</span>
      <div class="hp"><span style={{ width: `${pct}%`, background: u.hp / u.maxHp < 0.34 ? '#ff6a5a' : undefined }} /></div>
    </div>
  );
}

function Face({ u, s, size }: { u: Unit; s: GameState; size: number }) {
  const st = u.studentId ? s.students[u.studentId] : null;
  if (st) return <Portrait st={st} size={size} />;
  return <div class={`unit ${u.side}`} style={{ width: size, height: size, fontSize: Math.max(11, size / 5), flex: 'none' }}>{u.name.replace(/（.*）/, '').slice(0, 3)}</div>;
}

/** 攻撃のたびに出す、二人のHPゲージ */
function CombatPanel({ c, b, s }: { c: CombatShow; b: BattleState; s: GameState }) {
  const A = b.units.find((u) => u.uid === c.a), D = b.units.find((u) => u.uid === c.d);
  if (!A || !D) return null;
  const side = (u: Unit, hp: number, fx: string, kind: string, on: boolean, right: boolean) => {
    const w = c.heal && u === A ? staffOf(u) : weaponOf(u);
    const pct = Math.max(0, Math.min(100, (hp / u.maxHp) * 100));
    return (
      <div class={`cside ${u.side}${on ? ' on' : ''}${right ? ' right' : ''}`}>
        <div class="cface"><Face u={u} s={s} size={c.big ? 64 : 40} />{fx && <div class={`cfx ${kind}`}>{fx}</div>}</div>
        <div class="cbody">
          <div class="cname">{u.name.replace(/（.*）/, '')}</div>
          <div class="small">{w?.name ?? '—'}</div>
          <div class="chp"><b>{hp}</b><span class="small">/{u.maxHp}</span></div>
          <div class="cgauge"><span style={{ width: `${pct}%`, transitionDuration: `${c.dur}ms`, background: pct < 34 ? '#e2553f' : undefined }} /></div>
        </div>
      </div>
    );
  };
  return (
    <div class={`combat${c.big ? ' big' : c.top ? ' top' : ''}`}>
      <div class="cbox">
        {side(A, c.hpA, c.fxA, c.kindA, c.active === 'a', false)}
        <div class="cvs">{c.heal ? '回復' : 'VS'}</div>
        {side(D, c.hpD, c.fxD, c.kindD, c.active === 'd', true)}
      </div>
    </div>
  );
}

function UnitInfo({ u, s, b }: { u: Unit; s: GameState; b: BattleState }) {
  const w = weaponOf(u);
  const t = terrainDef(tile(b, u.x, u.y));
  const others = [...new Set(u.weapons)].filter((id) => id !== u.weaponId).map((id) => WEAPONS[id]).filter(Boolean);
  return (
    <div class="card small">
      <b>{u.name}</b> {CLASSES[u.classId]?.name} Lv{u.level}　HP {u.hp}/{u.maxHp}{u.boss ? '（ボス）' : ''}{u.persuadable ? '（説得できる）' : ''}
      <div>力{u.stats.str} 魔{u.stats.mag} 技{u.stats.skl} 速{u.stats.spd} 幸{u.stats.lck} 守{u.stats.def} 魔防{u.stats.res}　移動{CLASSES[u.classId]?.move}</div>
      <div>装備：{w ? `${w.name}（威力${w.might}・射程${w.minRange === w.maxRange ? w.minRange : `${w.minRange}-${w.maxRange}`}）` : 'なし'}{u.item ? `・${u.item === 'elixir' ? '特効薬' : '傷薬'}` : ''}</div>
      {others.length > 0 && <div class="muted">ほかに：{others.map((x) => x.name).join('・')}</div>}
      <div class="muted">地形：{t.name}{t.avo ? ` 回避+${t.avo}` : ''}{t.def ? ` 守備+${t.def}` : ''}{u.poison ? '・毒' : ''}{u.weaken ? '・弱体' : ''}{u.ward ? `・魔防+${u.ward}` : ''}{u.reloadTurn === b.turn ? '・装填中' : ''}</div>
      {u.studentId && s.students[u.studentId] && u.side === 'player' && <div class="muted">信頼{Math.round(s.students[u.studentId].trust)}（指示がうまくいく見込み{Math.round(commandRate(battleCtx(s), u))}%）</div>}
    </div>
  );
}

function ActionMenu({ b, u, s, onAttack, onHeal, onDone, onBack, snapshot }: { b: BattleState; u: Unit; s: GameState; onAttack: () => void; onHeal: () => void; onDone: (t?: string, before?: Record<string, UnitView>) => void; onBack: () => void; snapshot: () => Record<string, UnitView> }) {
  const ctx = battleCtx(s);
  const foes = b.units.filter((e) => e.side === 'enemy' && !e.dead);
  const canAtk = attackWeapons(b, u).some((w) => foes.some((e) => inRange(b, w, dist(u, e))));
  const canHeal = staffsOf(u).length > 0 && b.units.some((a) => canHealTarget(b, u, a));
  const w = weaponOf(u);
  const doAct = (fn: (bb: BattleState, uu: Unit) => string | boolean | void, anim = false) => {
    const before = anim ? snapshot() : undefined;
    let t: string | undefined;
    act((g) => { const bb = g.battle!; const r = fn(bb, bb.units.find((z) => z.uid === u.uid)!); if (typeof r === 'string') t = r; });
    sfx('ok'); onDone(t, before);
  };
  return (
    <div class="card">
      <div class="row">
        {canAtk && <button class="btn small accent" onClick={onAttack}>攻撃</button>}
        {canHeal && <button class="btn small primary" onClick={onHeal}>回復</button>}
        {u.item && u.hp < u.maxHp && <button class="btn small" onClick={() => doAct((bb, uu) => { useItem(bb, uu); }, true)}>{u.item === 'elixir' ? '特効薬' : '傷薬'}</button>}
        {canVisit(b, u) && <button class="btn small" onClick={() => doAct((bb, uu) => visit(bb, uu))}>村を訪ねる</button>}
        {canOpenChest(b, u) && <button class="btn small" onClick={() => doAct((bb, uu) => openChest(bb, uu))}>宝箱を開ける</button>}
        {canOpenDoor(b, u) && <button class="btn small" onClick={() => doAct((bb, uu) => openDoor(bb, uu))}>扉を開ける</button>}
        {canPersuade(b, u) && <button class="btn small primary" onClick={() => doAct((bb, uu) => persuade(bb, ctx, uu))}>説得する</button>}
        {canRescue(b, u) && <button class="btn small accent" onClick={() => doAct((bb, uu) => rescue(bb, uu))}>助け出す</button>}
        {canEscape(b, u) && <button class="btn small accent" onClick={() => doAct((bb, uu) => escape(bb, uu))}>脱出</button>}
        <button class="btn small" onClick={() => doAct((bb, uu) => { wait(bb, uu); })}>待機</button>
        <button class="btn small ghost" onClick={onBack}>戻る</button>
      </div>
      {w && w.type === 'gun' && !canUseNow(b, u, w) && <div class="muted small">{b.weather === 'rain' ? '雨のため、銃が使えません' : '弾をこめているので、まだ撃てません'}</div>}
    </div>
  );
}

function withWeapon<T>(u: Unit, wid: string | null, fn: () => T): T {
  const keep = u.weaponId;
  if (wid) u.weaponId = wid;
  try { return fn(); } finally { u.weaponId = keep; }
}

function Confirm({ b, s, a, d, heal: isHeal, wid, onWeapon, onOk, onBack }: { b: BattleState; s: GameState; a: Unit; d: Unit; heal?: boolean; wid: string | null; onWeapon: (w: string) => void; onOk: () => void; onBack: () => void }) {
  if (isHeal) {
    const opts = staffsOf(a).filter((w) => inRange(b, w, dist(a, d)));
    const st = opts.find((w) => w.id === wid) ?? opts[0];
    if (!st) return null;
    const amt = healAmount(a, st);
    return (
      <div class="card">
        {opts.length > 1 && <div class="row" style={{ marginBottom: 6 }}>{opts.map((w) => <button class={`btn small ${w.id === st.id ? 'primary' : ''}`} onClick={() => onWeapon(w.id)}>{w.name}</button>)}</div>}
        <div>{a.name}が{d.name}を回復（{st.name}：HP{d.hp}→{Math.min(d.maxHp, d.hp + amt)}{st.cure ? '・毒と弱体を治す' : ''}{st.ward ? `・魔防+${st.ward}` : ''}）</div>
        <div class="row"><button class="btn primary grow" onClick={onOk}>決定</button><button class="btn ghost" onClick={onBack}>戻る</button></div>
      </div>
    );
  }
  const opts = attackWeapons(b, a).filter((w) => inRange(b, w, dist(a, d)));
  const f = withWeapon(a, wid, () => forecast(b, a, d, a.x, a.y, battleCtx(s).support));
  const tri = (n: number) => n > 0 ? '▲有利' : n < 0 ? '▼不利' : '';
  const aw = withWeapon(a, wid, () => weaponOf(a)), dw = weaponOf(d);
  return (
    <div class="card">
      {opts.length > 1 && <div class="row" style={{ marginBottom: 6 }}><span class="small muted">使うもの：</span>{opts.map((w) => <button class={`btn small ${w.id === aw?.id ? 'primary' : ''}`} onClick={() => onWeapon(w.id)}>{w.name}</button>)}</div>}
      <div class="forecast">
        <div><b>{a.name}</b><div class="small">{aw?.name} {tri(f.atk.triangle)}{f.atk.effective ? ' 特効!' : ''}</div></div><div class="lbl">戦闘予測</div><div><b>{d.name}</b><div class="small">{dw?.name ?? '武器なし'} {tri(f.def.triangle)}</div></div>
        <div>{a.hp}/{a.maxHp}</div><div class="lbl">HP</div><div>{d.hp}/{d.maxHp}</div>
        <div><b>{f.atk.dmg}{f.atk.count > 1 ? ' ×2' : ''}</b></div><div class="lbl">威力</div><div><b>{f.def.canAttack ? `${f.def.dmg}${f.def.count > 1 ? ' ×2' : ''}` : '—'}</b></div>
        <div>{f.atk.hit}%</div><div class="lbl">命中</div><div>{f.def.canAttack ? `${f.def.hit}%` : '—'}</div>
        <div>{f.atk.crit}%</div><div class="lbl">必殺</div><div>{f.def.canAttack ? `${f.def.crit}%` : '—'}</div>
      </div>
      {!f.def.canAttack && <div class="muted small" style={{ textAlign: 'center' }}>相手は反撃できません</div>}
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
  if (!open) return <button class="btn small" onClick={() => setOpen(true)}>やり直す（あと{b.rewindsLeft}）</button>;
  return (
    <span class="row">
      {Array.from({ length: n }, (_, i) => i + 1).map((k) => <button class="btn small" onClick={() => { sfx('cancel'); act((g) => { g.battle = rewind(g.battle!, k); }); setOpen(false); }}>{k === 1 ? 'このターンの最初' : `${k - 1}ターン前`}</button>)}
      <button class="btn small ghost" onClick={() => setOpen(false)}>やめる</button>
    </span>
  );
}
