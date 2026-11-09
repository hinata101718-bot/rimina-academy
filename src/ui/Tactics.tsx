// 19夜目：新しい戦いの画面（小さなマス目・運なし・直接タップ）。
// 1. 教え子をタップ → 動ける範囲（青）と、攻撃できる敵（赤）が一度に光る
// 2. 赤い敵をタップ → いちばんいい場所へ動く札が並ぶ（ダメージ・盾が割れるか・弱点か）
// 3. 札をタップで実行。動くだけは青いマス。「ひとつ戻す」もある
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { ComponentChildren } from 'preact';
import { useStore, act } from './store';
import { sfx } from './sound';
import { faceImageFor, FaceSvg, enemyUrl } from './Portrait';
import { getGame } from './store';
import type { GameState } from '../core/state';
import type { TBattle, TUnit, TFx } from '../core/tactics/types';
import { reach, attackable, healable, attacksOf, healsOf, bestSpot, calc, unit, foes, mine, key, attack, heal, moveOnly, wait, usePotion, command, insight, insightTargets, endTurn, undoLast, techOf, boss as bossOf, isForest } from '../core/tactics/engine';
import { autoTurn } from '../core/tactics/ai';
import { finishBattle, finishAuto, noDeath } from '../core/flow';
import { ATK_NAME, TB, FIELD_BY_ID } from '../data/tactics';
import { CLASSES } from '../data/classes';
import { officerById } from '../core/officers';

const OBJ_TEXT: Record<string, string> = { boss: '敵将を倒す（討ち取る・退ける）', rout: '敵を全員倒す', defend: '守り抜く', rescue: '捕らわれた人を救い出す', escape: '先生が北の端へ逃げきる' };

function clone<T>(x: T): T { return JSON.parse(JSON.stringify(x)); }
function speedMul(s: GameState): number { return [1, 1, 0.7, 0.45][s.settings.animSpeed ?? 2] ?? 1; }

/** 1人の顔（教え子は顔の絵、敵将は敵の顔、雑兵はしるし） */
function UnitFace({ u }: { u: TUnit }) {
  const g = getGame();
  const st = u.studentId && g ? g.students[u.studentId] : null;
  if (st) { const img = faceImageFor(st, g); return img ? <img class="tb-img" src={img} alt="" /> : <span class="tb-svg"><FaceSvg face={st.face} size={48} /></span>; }
  if (u.faceImage) return <img class="tb-img" src={enemyUrl(u.faceImage)} alt="" />;
  const o = u.officerId && g ? officerById(g, u.officerId) : null;
  if (o) return <span class="tb-svg"><FaceSvg face={o.face} size={48} /></span>;
  return <span class="tb-mark">{u.mark ?? (u.teacher ? '師' : '敵')}</span>;
}

interface Pop { id: number; x: number; y: number; text: string; cls: string }
interface Over { kind: 'cutin' | 'say' | 'break' | 'phase' | 'duel'; a?: TUnit; d?: TUnit; title?: string; sub?: string; text?: string; dmg?: number; tags?: string[] }

export function TacticsView() {
  const { s } = useStore();
  const b = s?.battle;
  const [sel, setSel] = useState<string | null>(null);
  const [tgt, setTgt] = useState<string | null>(null);
  const [mode, setMode] = useState<'none' | 'command' | 'insight'>('none');
  const [msg, setMsg] = useState<ComponentChildren>(null);
  const [replay, setReplay] = useState<{ view: TBattle; queue: TFx[]; i: number } | null>(null);
  const [pops, setPops] = useState<Pop[]>([]);
  const [over, setOver] = useState<Over | null>(null);
  const [shake, setShake] = useState<string | null>(null);
  const [guide, setGuide] = useState<number>(() => (b && (b.tutorial || !(s?.tutorial?.seen ?? []).includes('tactics')) ? 0 : -1));
  const popId = useRef(1);
  const started = useRef(false);
  // はじめの口上（戦いを作ったときの演出）
  useEffect(() => {
    if (!s?.battle || started.current) return;
    started.current = true;
    if (s.battle.fx.length && s.battle.turn === 1) { const fx = s.battle.fx; act((g) => { if (g.battle) g.battle.fx = []; }, false); setReplay({ view: clone(s.battle), queue: fx, i: 0 }); }
  }, []);
  // 演出を1つずつ
  useEffect(() => {
    if (!replay || !s) return;
    const { view, queue, i } = replay;
    if (i >= queue.length) { setReplay(null); setOver(null); return; }
    const f = queue[i];
    const M = speedMul(s);
    const duelMode = s.settings.duel ?? 'short';
    let ms = 300;
    const next = () => setReplay((r) => (r && r.i === i ? { ...r, i: i + 1 } : r));
    const U = (uid: string) => view.units.find((u) => u.uid === uid);
    if (f.k === 'move') { const u = U(f.uid); if (u) { u.x = f.x; u.y = f.y; } sfx('move'); ms = 220; }
    else if (f.k === 'phase') { setOver({ kind: 'phase', title: f.side === 'foe' ? '敵の番' : `ターン${f.turn}`, sub: f.side === 'foe' ? '赤い札が、狙われている子' : 'こちらの番' }); ms = 650; }
    else if (f.k === 'cutin') { const a = U(f.by); setOver({ kind: 'cutin', a, title: f.title, sub: f.sub }); sfx('cutin'); ms = 950; }
    else if (f.k === 'say') { const a = U(f.by); setOver({ kind: 'say', a, text: f.text }); if (a?.nemesis) sfx('nemesis'); ms = 1500; }
    else if (f.k === 'reveal') { const d = U(f.d); if (d && !d.known.includes(f.type)) d.known.push(f.type); if (d) addPop(d, `弱点：${ATK_NAME[f.type]}`, 'sh'); sfx('weak'); ms = 700; }
    else if (f.k === 'flee') { const u = U(f.uid); if (u) { u.alive = false; u.down = 'fled'; } ms = 500; }
    else if (f.k === 'heal') { const d = U(f.d); if (d) { d.hp = Math.min(d.max, d.hp + f.amt); addPop(d, `+${f.amt}`, 'heal'); } sfx('heal'); ms = 500; }
    else if (f.k === 'hit') {
      const a = U(f.a), d = U(f.d);
      if (d) {
        d.hp = Math.max(0, d.hp - f.dmg);
        if (f.shield) d.sh = Math.max(0, d.sh - 1);
        if (f.brk) d.broken = 2;
        if (f.kill) { d.alive = false; }
        addPop(d, `−${f.dmg}`, ''); if (f.shield) addPop(d, '盾 −1', 'sh'); if (f.resisted) addPop(d, '効かない', 'no');
        setShake(d.uid);
      }
      sfx(f.brk ? 'break' : f.shield ? 'shield' : f.weak ? 'weak' : f.kill ? 'kill' : 'hit');
      const tags = [f.weak ? '弱点！' : '', f.shield ? '盾 −1' : '', f.brk ? 'ブレイク！' : '', f.resisted ? '効かない' : '', f.kill ? (d?.side === 'me' ? '倒れた' : '倒した！') : ''].filter(Boolean);
      if (duelMode !== 'off' && a && d) { setOver({ kind: 'duel', a, d, dmg: f.dmg, tags, title: f.tech }); ms = duelMode === 'full' ? 900 : 520; }
      else ms = 420;
      if (f.brk) { setTimeout(() => setOver({ kind: 'break', d, title: 'ブレイク！', sub: '次の番は動けず、受ける傷が2倍' }), ms); ms += 1000; }
    }
    const t = setTimeout(next, ms * M);
    return () => clearTimeout(t);
  }, [replay?.i, replay?.queue]);
  useEffect(() => { if (!shake) return; const t = setTimeout(() => setShake(null), 320); return () => clearTimeout(t); }, [shake]);
  function addPop(u: TUnit, text: string, cls: string) { const id = popId.current++; setPops((p) => [...p, { id, x: u.x, y: u.y, text, cls }]); setTimeout(() => setPops((p) => p.filter((x) => x.id !== id)), 900); }

  if (!s || !b) return null;
  const view = replay?.view ?? b;
  const busy = !!replay;
  const nd = noDeath(s, s.quests.find((q) => q.id === b.questId));
  const selU = sel ? unit(b, sel) : null;
  const R = selU && !selU.acted && b.phase === 'player' ? reach(b, selU) : null;
  const atkable = selU && !selU.acted ? attackable(b, selU) : [];
  const healOk = selU && !selU.acted ? healable(b, selU) : [];
  const insT = mode === 'insight' ? insightTargets(b) : [];
  const cmdT = mode === 'command' ? mine(b).filter((m) => m.acted && !m.teacher) : [];
  const tgtU = tgt ? unit(b, tgt) : null;

  /** 演出つきで行動する */
  function run(fn: (g: GameState) => void) {
    const before = clone(b!);
    act((g) => { if (g.battle) g.battle.fx = []; fn(g); });
    const g = getGame();
    const fx = g?.battle?.fx ?? [];
    setSel(null); setTgt(null); setMode('none');
    if (fx.length) setReplay({ view: before, queue: fx, i: 0 });
  }
  function tapCell(x: number, y: number) {
    if (busy || b!.phase !== 'player') return;
    const u = view.units.find((o) => o.alive && o.x === x && o.y === y) ?? null;
    if (mode === 'insight') { if (u && insT.some((f) => f.uid === u.uid)) run((g) => insight(g.battle!, u.uid)); else setMode('none'); return; }
    if (mode === 'command') { if (u && cmdT.some((f) => f.uid === u.uid)) run((g) => command(g.battle!, u.uid)); else setMode('none'); return; }
    if (u?.side === 'foe') {
      if (selU && atkable.some((f) => f.uid === u.uid)) { setTgt(u.uid); sfx('ok'); setMsg(null); return; }
      setTgt(null); setMsg(foeInfo(b!, u)); return;
    }
    if (u?.side === 'me' && selU && healOk.some((o) => o.uid === u.uid)) { const h = healsOf(selU)[0]; if (h) { run((g) => heal(g.battle!, selU.uid, u.uid, h)); return; } }
    if (u?.side === 'me' && u.uid !== sel) {
      if (u.acted) { setSel(null); setTgt(null); setMsg(<span><b>{u.name}</b>はもう動いた（HP {u.hp}/{u.max}）</span>); return; }
      setSel(u.uid); setTgt(null); sfx('move'); setMsg(null); return;
    }
    if (selU && R && key(x, y) in R) { run((g) => moveOnly(g.battle!, selU.uid, x, y)); return; }
    setSel(null); setTgt(null);
  }

  const bs = bossOf(view);
  const aimMap: Record<string, { dmg: number; lethal: boolean }> = {};
  for (const f of foes(view)) if (f.aim && 't' in f.aim && !f.aim.approach) { const e = aimMap[f.aim.t] ?? { dmg: 0, lethal: false }; e.dmg += f.aim.dmg; e.lethal ||= f.aim.lethal; aimMap[f.aim.t] = e; }
  const lethalWarn = foes(view).filter((f) => f.aim && 't' in f.aim && f.aim.lethal).map((f) => ({ f, t: unit(view, (f.aim as { t: string }).t) }));
  const left = mine(b).filter((m) => !m.acted).length;
  const field = FIELD_BY_ID[b.field];
  const cards = selU && tgtU ? attackCards(b, selU, tgtU) : [];

  return (
    <div class="tb-wrap" data-field={b.field}>
      <div class="tb-top">
        <div class="tb-title">{b.title}<small>{field?.name}{b.nemesisId ? '・宿敵戦' : ''}</small></div>
        <span class="tb-pill">ターン{view.turn}{b.holdTurns ? `／${b.holdTurns}` : ''}</span>
      </div>
      <div class="tb-obj">勝ち方：{OBJ_TEXT[b.objective]}{b.objective === 'defend' ? `（${b.holdTurns}ターン）` : ''}　先生が倒れると負け</div>
      {bs && <BossCard u={bs} />}
      <div class={`tb-board${shake && view.units.find((u) => u.uid === shake)?.boss ? ' bshake' : ''}`}>
        {Array.from({ length: b.h }, (_, y) => Array.from({ length: b.w }, (_, x) => {
          const k = key(x, y);
          const rock = b.rock.includes(k), forest = isForest(b, x, y);
          const u = view.units.find((o) => o.alive && o.x === x && o.y === y);
          let cls = 'tb-cell' + (rock ? ' rock' : '') + (forest ? ' forest' : '');
          if (!busy && R && k in R && (!u || u.uid === sel)) cls += ' move';
          if (!busy && u && atkable.some((f) => f.uid === u.uid)) cls += ' tgt';
          if (!busy && u && healOk.some((f) => f.uid === u.uid)) cls += ' ally';
          if (!busy && u && (insT.some((f) => f.uid === u.uid) || cmdT.some((f) => f.uid === u.uid))) cls += ' special';
          if (!busy && tgtU && cards[0]?.spot && cards[0].spot.x === x && cards[0].spot.y === y) cls += ' spot';
          if (b.captive && !b.captive.freed && b.captive.x === x && b.captive.y === y) cls += ' captive';
          if (b.objective === 'escape' && y === (b.exitRow ?? 0)) cls += ' exit';
          return <button class={cls} aria-label={`${x + 1}列${y + 1}行${u ? ` ${u.name}` : ''}`} onClick={() => tapCell(x, y)}>{b.captive && !b.captive.freed && b.captive.x === x && b.captive.y === y ? <span class="tb-captive">救</span> : null}</button>;
        }))}
        <div class="tb-layer">
          {view.units.filter((u) => u.alive).map((u) => {
            const aim = aimMap[u.uid];
            return (
              <div class={`tb-u ${u.side}${u.boss ? ' boss' : ''}${u.teacher ? ' teacher' : ''}${u.acted && u.side === 'me' ? ' done' : ''}${u.uid === sel ? ' sel' : ''}${u.broken > 0 ? ' broken' : ''}${shake === u.uid ? ' shake' : ''}`}
                style={{ left: `${(u.x / b.w) * 100}%`, top: `${(u.y / b.h) * 100}%`, width: `${100 / b.w}%`, height: `${100 / b.h}%` }}>
                <div class="tb-uin"><UnitFace u={u} /></div>
                <div class="tb-hp"><i style={{ width: `${Math.max(0, (u.hp / u.max) * 100)}%` }} /></div>
                {u.side === 'foe' && u.shMax > 0 && <div class="tb-ss">{u.broken > 0 ? <span class="tb-brk">崩</span> : Array.from({ length: u.sh }, () => <span class="sh" />)}</div>}
                {aim && <div class={`tb-inc${aim.lethal ? ' lethal' : ''}`}>{aim.lethal ? '命' : ''}−{aim.dmg}</div>}
                {u.side === 'foe' && u.aim && 'flee' in u.aim && <div class="tb-aim">逃</div>}
              </div>
            );
          })}
          {pops.map((p) => <div class={`tb-pop ${p.cls}`} style={{ left: `${((p.x + 0.5) / b.w) * 100}%`, top: `${(p.y / b.h) * 100}%` }}>{p.text}</div>)}
        </div>
      </div>
      {lethalWarn.length > 0 && !busy && b.phase === 'player' && <div class="tb-warn">⚠ 命の危険：{lethalWarn.map(({ f, t }) => `${f.name}が${t?.name ?? ''}を狙っている`).join('、')}{nd ? '（この戦いでは死なず、大けがで済む）' : '。倒れると死んでしまう。動かして避けよう'}</div>}
      <div class="tb-panel">
        {b.phase === 'done' && !busy ? <EndPanel b={b} /> : busy ? (
          <div class="tb-msg">{b.phase === 'enemy' || replay?.queue.some((f) => f.k === 'phase') ? '― 敵の番 ―' : '……'}<button class="btn small ghost" style={{ float: 'right' }} onClick={() => { setReplay(null); setOver(null); }}>演出を飛ばす</button></div>
        ) : selU && tgtU ? (
          <>
            <div class="tb-who"><span class="tb-wf"><UnitFace u={selU} /></span><b>{selU.name}</b> → <b class="red">{tgtU.name}</b>　札を選ぶ</div>
            <div class="tb-cards">
              {cards.map((c) => (
                <button class={`tb-card${c.weak ? ' weak' : ''}${c.brk ? ' brk' : ''}`} disabled={!c.spot} onClick={() => run((g) => attack(g.battle!, selU.uid, tgtU.uid, c.id, c.spot, { noDeath: nd }))}>
                  <span class="tb-cn">{c.name}<span class="tb-ct">{ATK_NAME[c.type]}</span></span>
                  <span class="tb-cd">{c.spot ? <>ダメージ <b>{c.total}</b>{c.hits > 1 ? `（${c.per}×${c.hits}）` : ''}</> : '届かない'}</span>
                  <span class="tb-ctag">{c.weak && <em class="w">弱点！盾−{c.shields}</em>}{c.brk && <em class="b">ブレイク！</em>}{c.kill && <em class="k">倒せる</em>}{c.resisted && <em class="n">効かない</em>}{c.broken && <em class="b">傷2倍</em>}{c.left !== null && <em class="l">のこり{c.left}</em>}</span>
                </button>
              ))}
            </div>
            <div class="tb-acts"><button class="btn small ghost grow" onClick={() => setTgt(null)}>やめる</button></div>
          </>
        ) : selU ? (
          <>
            <div class="tb-who"><span class="tb-wf"><UnitFace u={selU} /></span><div><b>{selU.name}</b>　HP {selU.hp}/{selU.max}　{CLASSES[selU.classId]?.name ?? ''}<div class="tb-techs">{selU.teacher ? <span>号令 のこり{b.command}・見極め のこり{b.insight}</span> : selU.techs.map((t) => <span class="tb-tch">{techOf(t.id)?.name}<small>{ATK_NAME[techOf(t.id)!.type]}・のこり{t.left}</small></span>)}</div></div></div>
            <div class="tb-msg small">{atkable.length ? '赤く光る敵をタップすると、札が並びます。' : '届く敵がいない。'}{healOk.length ? '緑の仲間をタップで回復。' : ''}動くだけなら青いマス。</div>
            <div class="tb-acts">
              <button class="btn small grow" onClick={() => run((g) => wait(g.battle!, selU.uid))}>待機</button>
              {!!selU.potion && selU.hp < selU.max && <button class="btn small grow" onClick={() => run((g) => usePotion(g.battle!, selU.uid))}>傷薬</button>}
              {selU.teacher && b.command > 0 && mine(b).some((m) => m.acted && !m.teacher) && <button class="btn small accent grow" onClick={() => { setMode('command'); setSel(null); setMsg('号令：もう一度動かす子（光っている子）をタップ'); }}>号令</button>}
              {selU.teacher && insightTargets(b).length > 0 && <button class="btn small accent grow" onClick={() => { setMode('insight'); setSel(null); setMsg('見極め：弱点を見たい敵（光っている敵）をタップ'); }}>見極め</button>}
              <button class="btn small ghost grow" onClick={() => setSel(null)}>選びなおす</button>
            </div>
          </>
        ) : (
          <>
            <div class="tb-msg">{msg ?? (mode !== 'none' ? '' : <span>教え子をタップ。赤い数字は、敵が次に狙う相手と傷の大きさ。</span>)}</div>
            <div class="tb-acts">
              <button class="btn primary grow" onClick={() => { sfx('ok'); run((g) => endTurn(g.battle!, { noDeath: nd })); }}>ターンを終える{left ? `（あと${left}人）` : ''}</button>
              <button class="btn small ghost" disabled={!b.undo} onClick={() => { sfx('cancel'); act((g) => { undoLast(g.battle!); }); setSel(null); setTgt(null); }}>ひとつ戻す</button>
            </div>
            <div class="tb-acts">
              <button class="btn small ghost grow" onClick={() => run((g) => autoTurn(g.battle!, { noDeath: nd }))}>このターンはおまかせ</button>
              <button class="btn small ghost grow" onClick={() => { if (confirm('最後までおまかせで進めますか？（同じ計算で自動に進み、名場面は残ります）')) act((g) => finishAuto(g)); }}>最後までおまかせ</button>
            </div>
          </>
        )}
      </div>
      <div class="tb-help">運はありません。攻撃は必ず当たります。弱点を突くと盾が割れ、0になると「ブレイク」（次の番は動けず、受ける傷が2倍）。</div>
      {over && <Overlay o={over} onTap={() => setOver(null)} />}
      {guide >= 0 && !busy && <GuideBox step={guide} tutorial={!!b.tutorial} onNext={() => { if (guide >= 2) { setGuide(-1); act((g) => { g.tutorial ??= { tour: 99, seen: [] }; if (!g.tutorial.seen.includes('tactics')) g.tutorial.seen.push('tactics'); }); } else setGuide(guide + 1); }} />}
    </div>
  );
}

interface Card { id: string | null; name: string; type: import('../data/tactics').AtkType; total: number; per: number; hits: number; weak: boolean; shields: number; brk: boolean; kill: boolean; resisted: boolean; broken: boolean; left: number | null; spot: { x: number; y: number } | null }
function attackCards(b: TBattle, u: TUnit, f: TUnit): Card[] {
  return attacksOf(u).map((t) => {
    const spot = bestSpot(b, u, f, t);
    const ox = u.x, oy = u.y;
    if (spot) { u.x = spot.x; u.y = spot.y; }
    const c = calc(b, u, f, t);
    u.x = ox; u.y = oy;
    const tech = techOf(t);
    return { id: t, name: tech?.name ?? '攻撃', type: c.type, total: c.total, per: c.per, hits: c.hits, weak: c.weak, shields: c.shields, brk: c.brk, kill: c.kill, resisted: c.resisted, broken: c.broken, left: t ? u.techs.find((x) => x.id === t)?.left ?? 0 : null, spot };
  });
}

function foeInfo(b: TBattle, f: TUnit): ComponentChildren {
  const weak = f.weak.map((w) => (f.known.includes(w) ? ATK_NAME[w] : '？')).join('・');
  const aim = f.aim && 't' in f.aim ? unit(b, f.aim.t) : null;
  return <span><b>{f.name}</b>　HP {f.hp}/{f.max}　盾 {f.sh}　弱点：{weak || 'なし'}{f.resist.length ? `　効かない：${f.resist.map((r) => ATK_NAME[r]).join('・')}` : ''}{aim ? `　次は${aim.name}を狙う` : f.broken ? '　ブレイク中' : ''}</span>;
}

function BossCard({ u }: { u: TUnit }) {
  const types = [...new Set([...u.weak, ...u.resist])];
  return (
    <div class={`tb-boss${u.nemesis ? ' nem' : ''}`}>
      <span class="tb-bf"><UnitFace u={u} /></span>
      <div class="tb-bt">
        <div class="tb-bn">{u.name}{u.nemesis && <span class="tb-tag">宿敵</span>}{!u.alive && <small>{u.down === 'fled' ? '（退いた）' : '（倒れた）'}</small>}</div>
        <div class="tb-bhp"><i style={{ width: `${Math.max(0, (u.hp / u.max) * 100)}%` }} /></div>
        <div class="tb-shs">盾 {Array.from({ length: u.shMax }, (_, i) => <span class={`sh${i < u.sh && u.broken === 0 ? '' : ' off'}`} />)}{u.broken > 0 && <b class="gold">ブレイク中！傷2倍</b>}{u.fleeing && u.alive && <b class="red">逃げようとしている</b>}{u.rage && <b class="red">大技の構え</b>}</div>
        <div class="tb-wks">{types.map((t) => u.resist.includes(t) ? <span class="wk no">{ATK_NAME[t]}（もう効かない）</span> : u.known.includes(t) ? <span class="wk">弱点 {ATK_NAME[t]}</span> : <span class="wk q">弱点 ？</span>)}</div>
      </div>
    </div>
  );
}

function Overlay({ o, onTap }: { o: Over; onTap: () => void }) {
  if (o.kind === 'duel' && o.a && o.d) return (
    <div class="tb-ov duel" onClick={onTap}>
      <div class={`tb-duel ${o.a.side}`}>
        <span class="tb-df a"><UnitFace u={o.a} /><b>{o.a.name}</b></span>
        <span class="tb-dvs">{o.title ?? ''}</span>
        <span class="tb-df d"><UnitFace u={o.d} /><b>{o.d.name}</b><span class="tb-dslash" /></span>
        <div class="tb-ddmg">−{o.dmg}</div>
        <div class="tb-dtags">{(o.tags ?? []).map((t) => <em>{t}</em>)}</div>
      </div>
    </div>
  );
  if (o.kind === 'cutin') return <div class="tb-ov" onClick={onTap}><div class="tb-cutin">{o.a && <span class="tb-cf"><UnitFace u={o.a} /></span>}<span class="tb-ctx"><b>{o.title}</b><span>{o.sub}</span></span></div></div>;
  if (o.kind === 'break') return <div class="tb-ov" onClick={onTap}><div class="tb-breakfx">ブレイク！<small>{o.sub}</small></div></div>;
  if (o.kind === 'phase') return <div class="tb-ov" onClick={onTap}><div class="tb-phase"><b>{o.title}</b><small>{o.sub}</small></div></div>;
  return <div class="tb-ov say" onClick={onTap}><div class={`tb-say${o.a?.nemesis ? ' nem' : ''}`}>{o.a && <span class="tb-sf"><UnitFace u={o.a} /></span>}<p><b>{o.a?.name}</b>「{o.text}」</p></div></div>;
}

function EndPanel({ b }: { b: TBattle }) {
  const last = [...b.log].reverse().find((l) => l.big);
  return (
    <div class="tb-end">
      <div class={`tb-verdict ${b.result}`}>{b.result === 'win' ? '勝利' : '敗北'}</div>
      <div class="tb-msg">{last?.text}</div>
      <button class="btn primary block" onClick={() => { sfx('ok'); act((g) => finishBattle(g)); }}>結果を見る</button>
    </div>
  );
}

const GUIDE = [
  ['敵の次の狙いが見えています', '敵の札の下の赤い数字は、次に狙う子と受ける傷の大きさです。「命」のしるしは命の危険。運はなく、攻撃は必ず当たります。'],
  ['教え子をタップ', '青く光るマスが動ける範囲、赤く光る敵が攻撃できる相手です。赤い敵をタップすると、いちばんいい場所へ動いて攻撃する札が並びます。'],
  ['弱点を突いて、盾を割る', '札に「弱点！」と出る攻撃は、敵の盾（青いしるし）を割ります。盾が0になると「ブレイク」：次の番は動けず、受ける傷が2倍。間違えたら「ひとつ戻す」。'],
];
function GuideBox({ step, tutorial, onNext }: { step: number; tutorial: boolean; onNext: () => void }) {
  const [t, d] = GUIDE[step];
  return (
    <div class="tb-guide" role="dialog">
      <div class="tb-gh">{tutorial ? '戦い方の説明' : '戦い方（短く）'}　{step + 1}／{GUIDE.length}</div>
      <b>{t}</b>
      <p>{d}</p>
      <button class="btn primary block" onClick={onNext}>{step >= GUIDE.length - 1 ? 'はじめる' : 'つぎへ'}</button>
    </div>
  );
}
void useMemo; void TB;
