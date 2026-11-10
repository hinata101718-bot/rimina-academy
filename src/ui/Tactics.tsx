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
import { reach, attackable, healable, attacksOf, healsOf, bestSpot, calc, unit, foes, mine, key, attack, heal, moveOnly, wait, usePotion, command, insight, insightTargets, endTurn, undoLast, techOf, boss as bossOf, isForest, swapTargets, swapFoeTargets, swapUnits, openables, openAt, ignitables, ignite, T as hasTrait, walkPath, trapSpots, placeTrap } from '../core/tactics/engine';
import { Icon } from './icons';
import { autoTurn, autoOne } from '../core/tactics/ai';
import { finishBattle, finishAuto, noDeath } from '../core/flow';
import { ATK_NAME, TB, FIELD_BY_ID } from '../data/tactics';
import { TEACHER_RANK, B as BAL } from '../data/balance';
const FT = BAL.anim.foeTurn;
import { CLASSES } from '../data/classes';
import { officerById } from '../core/officers';
import { AtkMark, AtkLegend } from './atk';
import { MarchMap } from './March';
import type { AtkType } from '../data/tactics';

/** 22夜目⑧：その子が使える攻撃の種類（ふつうの攻撃と技） */
function typesOf(u: TUnit): AtkType[] {
  const out: AtkType[] = [...(u.atks?.length ? u.atks : [u.type])];
  if (u.dual && !out.includes(u.dual)) out.push(u.dual);
  for (const t of u.techs) { const d = techOf(t.id); if (d && !d.heal && !out.includes(d.type)) out.push(d.type); }
  return out;
}
/** 選んだ子で、分かっている弱点を突けるか（金色）・どれも効かないか（暗く） */
function weakFor(u: TUnit, f: TUnit): 'gold' | 'dim' | '' {
  const ts = typesOf(u);
  if (ts.some((t) => f.known.includes(t) && f.weak.includes(t) && !f.resist.includes(t))) return 'gold';
  if (ts.every((t) => f.resist.includes(t))) return 'dim';
  return '';
}

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
/** 22夜目⑦：演出の列。敵の番は1人ずつ「枠が乗る（focus）→ 歩く → 攻撃 → 間（gap）」
 *  25夜目③：雑兵も1人ずつ順に（速めに）。動かない雑兵（その場で攻撃・待つ・崩れて動けない）も一瞬光らせる */
type Still = 'attack' | 'wait' | 'broken' | null;
type QFx = (TFx | { k: 'focus'; uid: string; grunt?: boolean; still?: Still } | { k: 'gap'; grunt?: boolean }) & { foe?: boolean };
function actorOf(f: TFx): string | null { return f.k === 'move' || f.k === 'flee' ? f.uid : f.k === 'hit' || f.k === 'heal' ? f.a : f.k === 'say' || f.k === 'cutin' ? f.by : null; }
function stage(view: TBattle, fx: TFx[]): QFx[] {
  const out: QFx[] = [];
  let foe = view.phase === 'enemy';
  let last: string | null = null;
  const U = (uid: string | null) => (uid ? view.units.find((x) => x.uid === uid) : undefined);
  const minor = (uid: string | null) => { const u = U(uid); return !!u && u.side === 'foe' && !u.boss && !u.nemesis; };
  const start = (uid: string, broken?: boolean) => {
    if (last) out.push({ k: 'gap', grunt: minor(last), foe });
    out.push({ k: 'focus', uid, grunt: minor(uid), still: broken ? 'broken' : null, foe });
    last = uid;
  };
  for (const f of fx) {
    if (f.k === 'phase') { foe = f.side === 'foe'; last = null; out.push({ ...f, foe }); continue; }
    if (!foe) { if (f.k !== 'actor') out.push({ ...f, foe }); continue; }
    if (f.k === 'actor') { start(f.uid, f.broken); continue; }
    // 古い記録（actor のないもの）でも、敵が替わったら枠を乗せる
    const a = actorOf(f);
    if (a && a !== last && U(a)?.side === 'foe' && (f.k === 'move' || f.k === 'hit' || f.k === 'heal')) start(a);
    out.push({ ...f, foe });
  }
  // 動かない雑兵：次の枠までに歩きがなければ「その場で攻撃」、攻撃もなければ「待つ」
  for (let i = 0; i < out.length; i++) {
    const f = out[i];
    if (f.k !== 'focus' || f.still) continue;
    let moved = false, hit = false;
    for (let j = i + 1; j < out.length; j++) {
      const g = out[j];
      if (g.k === 'focus' || g.k === 'phase') break;
      if (g.k === 'move' && g.uid === f.uid) moved = true;
      if ((g.k === 'hit' || g.k === 'heal') && g.a === f.uid) hit = true;
    }
    if (!moved) f.still = hit ? 'attack' : 'wait';
  }
  return out;
}
const STILL_TEXT: Record<string, string> = { attack: 'その場で攻撃', wait: 'その場で待つ', broken: '崩れて動けない' };
const VERB: Record<string, string> = { slash: '斬った', thrust: '突いた', shot: '射た', crush: '砕いた', blunt: '打ちすえた', fire: '炎で焼いた', thunder: '雷を落とした', ice: '凍らせた', light: '光で撃った', dark: '闇で呑んだ' };
interface Over { kind: 'cutin' | 'say' | 'break' | 'phase' | 'duel'; a?: TUnit; d?: TUnit; title?: string; sub?: string; text?: string; dmg?: number; tags?: string[]; /** 22夜目⑦：タップするまで止まる（▼） */ tap?: boolean }

export function TacticsView() {
  const { s } = useStore();
  const b = s?.battle;
  const [sel, setSel] = useState<string | null>(null);
  const [tgt, setTgt] = useState<string | null>(null);
  const [mode, setMode] = useState<'none' | 'command' | 'insight' | 'ignite' | 'swapfoe' | 'trap'>('none');
  const [swapFirst, setSwapFirst] = useState<string | null>(null);
  const [msg, setMsg] = useState<ComponentChildren>(null);
  const [replay, setReplay0] = useState<{ view: TBattle; queue: QFx[]; i: number } | null>(null);
  const setReplay = (r: { view: TBattle; queue: TFx[]; i: number } | null) => { if (r) { foeLogRef.current = []; movedRef.current = {}; setLine(''); } setReplay0(r ? { ...r, queue: stage(r.view, r.queue) } : null); };
  // 22夜目⑦：いま動いている敵（枠）・1行の記録・ふりかえり・早送り・台詞のタップ待ち・歩く速さ
  const [focus, setFocus] = useState<string | null>(null);
  const [line, setLine] = useState('');
  const [review, setReview] = useState<string[] | null>(null);
  const [lastFoe, setLastFoe] = useState<string[]>([]);
  const [waitTap, setWaitTap] = useState(false);
  const [lunge, setLunge] = useState<{ uid: string; dx: number; dy: number } | null>(null);
  const [walk, setWalk] = useState(0.12);
  const [, setTick] = useState(0);
  const foeLogRef = useRef<string[]>([]);
  const movedRef = useRef<Record<string, string>>({});
  const rushRef = useRef(false);
  const pressRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longRef = useRef(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
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
    if (s.battle.nemesisId) sfx('nemesis');
    if (s.battle.fx.length && s.battle.turn === 1) { const fx = s.battle.fx; act((g) => { if (g.battle) g.battle.fx = []; }, false); setReplay({ view: clone(s.battle), queue: fx, i: 0 }); }
  }, []);
  // 演出を1つずつ（22夜目⑦：敵は1人ずつ枠が乗り、通り道を1マスずつ歩き、向きを変えて攻撃する）
  useEffect(() => {
    if (!replay || !s) return;
    const { view, queue, i } = replay;
    if (i >= queue.length) { setReplay0(null); setOver(null); setFocus(null); setWaitTap(false); setLunge(null); if (foeLogRef.current.length) setLastFoe([...foeLogRef.current]); return; }
    const f = queue[i];
    const foeMul = f.foe && s.settings.foeSpeed === 'fast' ? FT.fastMul : 1;
    const M = speedMul(s) * foeMul * (rushRef.current ? FT.rushMul : 1);
    const duelMode = s.settings.duel ?? 'short';
    const tapSay = (s.settings.sayMode ?? 'tap') === 'tap';
    let ms = 300;
    let hold = false;
    const next = () => setReplay0((r) => (r && r.i === i ? { ...r, i: i + 1 } : r));
    const U = (uid: string) => view.units.find((u) => u.uid === uid);
    const later = (fn: () => void, t: number) => { timers.current.push(setTimeout(fn, t)); };
    if (f.k === 'focus') {
      const u = U(f.uid);
      setOver(null); setFocus(f.uid); followUnit(f.uid);
      const st = f.still ? STILL_TEXT[f.still] : '';
      setLine(u ? `${u.name}の番${st ? `：${st}` : ''}` : '');
      if (u && (f.still === 'wait' || f.still === 'broken')) foeLogRef.current.push(`${u.name}：${st}`);
      ms = f.grunt ? (f.still === 'wait' || f.still === 'broken' ? FT.gruntStill : FT.gruntFocus) : FT.leaderFocus;
    } else if (f.k === 'gap') { setFocus(null); ms = f.grunt ? FT.gruntGap : FT.leaderGap; }
    else if (f.k === 'move') {
      const u = U(f.uid);
      setOver((o) => (o?.kind === 'duel' || o?.kind === 'phase' ? null : o));
      if (u) {
        const path = walkPath(view, u, f.x, f.y);
        const step = Math.max(0.02, ((f.foe && u.side === 'foe' && !u.boss && !u.nemesis ? FT.gruntStep : FT.leaderStep) / 1000) * M);
        setWalk(step);
        path.forEach((c, n) => later(() => { u.x = c.x; u.y = c.y; setTick((t) => t + 1); followUnit(u.uid); if (n === 0) sfx('move'); }, n * step * 1000));
        if (u.side === 'foe') movedRef.current[u.uid] = isForest(view, f.x, f.y) ? '森へ進み、' : path.length ? '進み、' : '';
        if (u.side === 'foe' && f.foe) setLine(`${u.name}：${movedRef.current[u.uid] ? movedRef.current[u.uid].replace('進み、', '進んだ') : '動いた'}`);
        ms = (path.length * step * 1000 + 80) / M;
      }
    }
    else if (f.k === 'phase') { setFocus(null); rushRef.current = false; setOver({ kind: 'phase', title: f.side === 'foe' ? '敵の番' : `ターン${f.turn}`, sub: f.side === 'foe' ? '敵が1人ずつ動きます（光っている敵の番。画面をタップで早送り）' : 'こちらの番' }); ms = 650; }
    else if (f.k === 'cutin') { const a = U(f.by); setOver({ kind: 'cutin', a, title: f.title, sub: f.sub, tap: tapSay }); sfx('cutin'); ms = 950; hold = tapSay; }
    else if (f.k === 'say') { const a = U(f.by); setOver({ kind: 'say', a, text: f.text, tap: tapSay }); if (a?.nemesis) sfx('nemesis'); ms = 1500; hold = tapSay; }
    else if (f.k === 'reveal') { const d = U(f.d); if (d && !d.known.includes(f.type)) d.known.push(f.type); if (d) addPop(d, `弱点：${ATK_NAME[f.type]}`, 'sh'); sfx('weak'); ms = 700; }
    else if (f.k === 'flee') { const u = U(f.uid); if (u) { u.alive = false; u.down = 'fled'; if (f.foe) { const t = `${u.name}：退いた`; setLine(t); foeLogRef.current.push(t); } } ms = 500; }
    else if (f.k === 'heal') { const d = U(f.d); const a = U(f.a); if (d) { d.hp = Math.min(d.max, d.hp + f.amt); addPop(d, `+${f.amt}`, 'heal'); } if (a && f.foe && a.side === 'foe' && d) { const t = `${a.name}：${d.name}の傷を癒した（+${f.amt}）`; setLine(t); foeLogRef.current.push(t); } sfx('heal'); ms = 500; }
    else if (f.k === 'hit') {
      const a = U(f.a), d = U(f.d);
      if (a && d) { setLunge({ uid: a.uid, dx: Math.sign(d.x - a.x), dy: Math.sign(d.y - a.y) }); later(() => setLunge(null), 260); }
      if (a && d && a.side === 'foe') {
        const t = `${a.name}：${movedRef.current[a.uid] ?? ''}${d.name}を${f.tech ? `「${f.tech}」で` : ''}${VERB[a.type] ?? '攻撃した'}（−${f.dmg}${f.kill ? '・倒れた' : ''}）`;
        movedRef.current[a.uid] = '';
        setLine(t); if (f.foe) foeLogRef.current.push(t);
      }
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
      const quick = !!f.foe && !!a && a.side === 'foe' && !a.boss && !a.nemesis;
      if (duelMode !== 'off' && a && d) { setOver({ kind: 'duel', a, d, dmg: f.dmg, tags, title: f.tech }); ms = duelMode === 'full' ? 900 : quick ? FT.gruntHit : 520; }
      else ms = 420;
      if (f.brk) { later(() => setOver({ kind: 'break', d, title: 'ブレイク！', sub: '次の番は動けず、受ける傷が2倍' }), ms * M); ms += 1000; }
    }
    if (hold) { setWaitTap(true); return () => { timers.current.forEach(clearTimeout); timers.current = []; }; }
    setWaitTap(false);
    const t = setTimeout(next, ms * M);
    return () => { clearTimeout(t); timers.current.forEach(clearTimeout); timers.current = []; };
  }, [replay?.i, replay?.queue]);
  /** 台詞・カットインのタップ待ちを進める */
  function tapOver() { setOver(null); if (waitTap) { setWaitTap(false); setReplay0((r) => (r ? { ...r, i: r.i + 1 } : r)); } }
  /** 動いている子が画面の外なら、盤が追う */
  function followUnit(uid: string) {
    const el = document.querySelector(`[data-uid="${uid}"]`) as HTMLElement | null;
    if (!el?.getBoundingClientRect) return;
    const r = el.getBoundingClientRect();
    if (r.top < 60 || r.bottom > window.innerHeight - 140) el.scrollIntoView?.({ block: 'center', behavior: 'smooth' });
  }
  useEffect(() => { if (!shake) return; const t = setTimeout(() => setShake(null), 320); return () => clearTimeout(t); }, [shake]);
  function addPop(u: TUnit, text: string, cls: string) { const id = popId.current++; setPops((p) => [...p, { id, x: u.x, y: u.y, text, cls }]); setTimeout(() => setPops((p) => p.filter((x) => x.id !== id)), 900); }

  if (!s || !b) return null;
  const view = replay?.view ?? b;
  const busy = !!replay;
  const nd = noDeath(s, s.quests.find((q) => q.id === b.questId));
  const selU = sel ? unit(b, sel) : null;
  const R = selU && !selU.acted && b.phase === 'player' && mode === 'none' ? reach(b, selU) : null;
  const atkable = selU && !selU.acted && mode === 'none' ? attackable(b, selU) : [];
  const healOk = selU && !selU.acted ? healable(b, selU) : [];
  const insT = mode === 'insight' ? insightTargets(b) : [];
  const cmdT = mode === 'command' ? mine(b).filter((m) => m.acted && !m.teacher) : [];
  const tgtU = tgt ? unit(b, tgt) : null;
  // 21夜目：入れ替え（紫）・宝箱と扉・火矢
  const swapT = selU && !selU.acted && mode === 'none' ? swapTargets(b, selU) : [];
  const swapFoeT = mode === 'swapfoe' && selU && swapFirst ? swapFoeTargets(b, selU, swapFirst) : [];
  const opens = selU && !selU.acted && mode === 'none' ? openables(b, selU) : [];
  const igns = selU && !selU.acted ? ignitables(b, selU) : [];
  const ignT = mode === 'ignite' ? igns : [];
  // 23夜目③：罠を置くマス
  const trapT = mode === 'trap' && selU ? trapSpots(b, selU) : [];
  const canTrap = selU && !selU.acted && b.phase === 'player' ? trapSpots(b, selU).length > 0 : false;

  /** 演出つきで行動する */
  function run(fn: (g: GameState) => void) {
    const before = clone(b!);
    act((g) => { if (g.battle) g.battle.fx = []; fn(g); });
    const g = getGame();
    const fx = g?.battle?.fx ?? [];
    setSel(null); setTgt(null); setMode('none');
    if (fx.length) setReplay({ view: before, queue: fx, i: 0 });
  }
  /** 23夜目⑨：駒を長押し → その子だけ「この番はおまかせ」 */
  function pressStart(x: number, y: number) {
    pressEnd();
    if (busy || b!.phase !== 'player') return;
    const u = b!.units.find((o) => o.alive && o.x === x && o.y === y && o.side === 'me' && !o.acted && !o.teacher);
    if (!u) return;
    pressRef.current = setTimeout(() => { pressRef.current = null; longRef.current = true; sfx('ok'); run((g) => autoOne(g.battle!, u.uid, { noDeath: nd })); }, 550);
  }
  function pressEnd() { if (pressRef.current) { clearTimeout(pressRef.current); pressRef.current = null; } }
  function tapCell(x: number, y: number) {
    if (longRef.current) { longRef.current = false; return; }
    if (busy) { rushRef.current = true; return; }
    if (b!.phase !== 'player') return;
    const u = view.units.find((o) => o.alive && o.x === x && o.y === y) ?? null;
    if (mode === 'insight') { if (u && insT.some((f) => f.uid === u.uid)) run((g) => insight(g.battle!, u.uid)); else setMode('none'); return; }
    if (mode === 'command') { if (u && cmdT.some((f) => f.uid === u.uid)) run((g) => command(g.battle!, u.uid)); else setMode('none'); return; }
    if (mode === 'ignite') { if (selU && ignT.some((o) => o.x === x && o.y === y)) run((g) => ignite(g.battle!, selU.uid, x, y)); else { setMode('none'); setMsg(null); } return; }
    if (mode === 'trap') { if (selU && trapT.some((o) => o.x === x && o.y === y)) { const uid = selU.uid; act((g) => { placeTrap(g.battle!, uid, x, y); }); sfx('ok'); setMode('none'); setMsg(<span>罠を仕掛けた。踏んだ敵は傷を負い、そこで止まる。<b>{selU.name}</b>はまだ動ける</span>); } else { setMode('none'); setMsg(null); } return; }
    if (mode === 'swapfoe') { if (selU && swapFirst && u && swapFoeT.some((f) => f.uid === u.uid)) { const first = swapFirst; run((g) => swapUnits(g.battle!, selU.uid, first, u.uid)); } else { setMode('none'); setMsg(null); } setSwapFirst(null); return; }
    if (selU && !u && opens.some((o) => o.x === x && o.y === y)) { run((g) => openAt(g.battle!, selU.uid, x, y)); return; }
    if (u?.side === 'foe') {
      if (selU && (atkable.some((f) => f.uid === u.uid) || swapT.some((f) => f.uid === u.uid))) { setTgt(u.uid); sfx('ok'); setMsg(null); return; }
      setSel(null); setTgt(null); setMsg(foeInfo(b!, u)); sfx('move'); return;
    }
    {
      const ch = b!.chests?.find((c) => !c.opened && c.x === x && c.y === y);
      if (ch || b!.doors?.includes(key(x, y))) { setSel(null); setTgt(null); setMsg(<span>{ch ? '宝箱' : '閉じた扉'}：盗賊の系統（盗賊・トリックスター・道化王）だけが開けられる。{selU && !hasTrait(selU, 'steal') ? `${selU.name}には開けられない。` : ''}</span>); return; }
      if (b!.gate === key(x, y)) { setSel(null); setTgt(null); setMsg(<span>砦の木の門：火矢の系統（火矢兵・焔弓・劫火）の「火矢」で焼き落とせる。</span>); return; }
    }
    if (u?.side === 'me' && selU && healOk.some((o) => o.uid === u.uid)) { const h = healsOf(selU)[0]; if (h) { run((g) => heal(g.battle!, selU.uid, u.uid, h)); return; } }
    if (u?.side === 'me' && selU && swapT.some((o) => o.uid === u.uid)) { run((g) => swapUnits(g.battle!, selU.uid, u.uid)); return; }
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
  // 21夜目：2手先の狙い（千里眼・天眼）：薄い矢印と「次の次」の札
  const aim2Map: Record<string, number> = {};
  const aim2List: { f: TUnit; t: TUnit }[] = [];
  const aim1List: { f: TUnit; t: TUnit }[] = [];
  for (const f of foes(view)) {
    if (f.aim2) { const t = unit(view, f.aim2.t); if (t?.alive) { aim2Map[t.uid] = (aim2Map[t.uid] ?? 0) + f.aim2.dmg; aim2List.push({ f, t }); } }
    if (f.aim && 't' in f.aim && !f.aim.approach) { const t = unit(view, f.aim.t); if (t?.alive) aim1List.push({ f, t }); }
  }
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
      {b.march && b.march.total > 1 && <MarchMap names={b.march.names} idx={b.march.idx} small />}
      <div class="tb-obj">勝ち方：{OBJ_TEXT[b.objective]}{b.objective === 'defend' ? `（${b.holdTurns}ターン）` : ''}　先生が倒れると負け</div>
      {bs && <BossCard u={bs} />}
      <div class={`tb-board${b.w >= 8 ? ' w8' : ''}${busy && focus && view.units.find((u) => u.uid === focus)?.side === 'foe' ? ' foeturn' : ''}${shake && view.units.find((u) => u.uid === shake)?.boss ? ' bshake' : ''}`} style={{ gridTemplateColumns: `repeat(${b.w}, 1fr)`, gridTemplateRows: `repeat(${b.h}, 1fr)`, aspectRatio: `${b.w} / ${b.h}` }}>
        {Array.from({ length: b.h }, (_, y) => Array.from({ length: b.w }, (_, x) => {
          const k = key(x, y);
          const rock = b.rock.includes(k), forest = isForest(b, x, y);
          const u = view.units.find((o) => o.alive && o.x === x && o.y === y);
          const chest = b.chests?.find((c) => c.x === x && c.y === y);
          const door = b.doors?.includes(k), gate = b.gate === k;
          let cls = 'tb-cell' + (rock ? ' rock' : '') + (forest ? ' forest' : '') + (b.walls?.includes(k) ? ' wall' : '') + (b.burn?.[k] ? (b.wild?.includes(k) ? ' burn wild' : ' burn') : '') + (chest ? (chest.opened ? ' chest open' : ' chest') : '') + (door ? ' door' : '') + (gate ? ' gate' : '');
          if (!busy && (swapT.some((f) => f.uid === u?.uid) || swapFoeT.some((f) => f.uid === u?.uid))) cls += ' swap';
          if (!busy && (opens.some((o) => o.x === x && o.y === y) || ignT.some((o) => o.x === x && o.y === y) || trapT.some((o) => o.x === x && o.y === y))) cls += ' openable';
          const trapHere = b.traps?.some((p) => p.x === x && p.y === y);
          if (trapHere) cls += ' trap';
          if (!busy && R && k in R && (!u || u.uid === sel)) cls += ' move';
          if (!busy && u && atkable.some((f) => f.uid === u.uid)) cls += ' tgt';
          if (!busy && u && selU && u.side === 'foe' && atkable.some((f) => f.uid === u.uid) && weakFor(selU, u) === 'gold') cls += ' gold';
          if (!busy && u && healOk.some((f) => f.uid === u.uid)) cls += ' ally';
          if (!busy && u && (insT.some((f) => f.uid === u.uid) || cmdT.some((f) => f.uid === u.uid))) cls += ' special';
          if (!busy && tgtU && cards[0]?.spot && cards[0].spot.x === x && cards[0].spot.y === y) cls += ' spot';
          if (b.captive && !b.captive.freed && b.captive.x === x && b.captive.y === y) cls += ' captive';
          if (b.objective === 'escape' && y === (b.exitRow ?? 0)) cls += ' exit';
          return <button class={cls} onPointerDown={() => pressStart(x, y)} onPointerUp={pressEnd} onPointerLeave={pressEnd} onPointerCancel={pressEnd} onContextMenu={(e) => e.preventDefault()} aria-label={`${x + 1}列${y + 1}行${u ? ` ${u.name}` : ''}${chest && !chest.opened ? ' 宝箱' : ''}${door ? ' 扉' : ''}${gate ? ' 木の門' : ''}`} onClick={() => tapCell(x, y)}>{b.captive && !b.captive.freed && b.captive.x === x && b.captive.y === y ? <span class="tb-captive">救</span> : chest && !chest.opened ? <span class="tb-obj-ic"><Icon name="chest" size={22} /></span> : door ? <span class="tb-obj-ic"><Icon name="door" size={22} /></span> : gate ? <span class="tb-obj-ic gate">門</span> : trapHere ? <span class="tb-obj-ic trapic">罠</span> : null}</button>;
        }))}
        <div class="tb-layer">
          {view.units.filter((u) => u.alive).map((u) => {
            const aim = aimMap[u.uid];
            return (
              <div data-uid={u.uid} class={`tb-u ${u.side}${!busy && selU && u.side === 'foe' && weakFor(selU, u) === 'dim' ? ' dimfoe' : ''}${u.boss ? ' boss' : ''}${u.teacher ? ' teacher' : ''}${u.acted && u.side === 'me' && !busy ? ' done' : ''}${u.uid === sel ? ' sel' : ''}${u.broken > 0 ? ' broken' : ''}${shake === u.uid ? ' shake' : ''}${busy && focus === u.uid ? ' focus' : ''}${lunge?.uid === u.uid ? ' lunge' : ''}`}
                style={{ left: `${(u.x / b.w) * 100}%`, top: `${(u.y / b.h) * 100}%`, width: `${100 / b.w}%`, height: `${100 / b.h}%`, ['--walk' as string]: `${walk}s`, ['--ldx' as string]: `${(lunge?.uid === u.uid ? lunge.dx : 0) * 22}%`, ['--ldy' as string]: `${(lunge?.uid === u.uid ? lunge.dy : 0) * 22}%` }}>
                {busy && focus === u.uid && <div class="tb-fname">{u.name}</div>}
                <div class="tb-uin"><UnitFace u={u} /></div>
                <div class="tb-hp"><i style={{ width: `${Math.max(0, (u.hp / u.max) * 100)}%` }} /></div>
                {!busy && selU && u.side === 'foe' && atkable.some((f) => f.uid === u.uid) && weakFor(selU, u) === 'gold' && <div class="tb-goldtag">弱点</div>}
                <div class="tb-marks">{u.side === 'foe'
                  ? [...u.weak.slice(0, 2).map((w) => (u.known.includes(w) && !u.resist.includes(w) ? <AtkMark small t={w} state="weak" /> : u.resist.includes(w) ? null : <AtkMark small state="q" />)), ...u.resist.slice(0, 1).map((r) => <AtkMark small t={r} state="no" />)]
                  : u.teacher ? null : typesOf(u).slice(0, b.w >= 8 ? 2 : 3).map((t) => <AtkMark small t={t} />)}</div>
                {u.side === 'foe' && u.shMax > 0 && <div class="tb-ss">{u.broken > 0 ? <span class="tb-brk">崩</span> : Array.from({ length: u.sh }, () => <span class="sh" />)}</div>}
                {aim && <div class={`tb-inc${aim.lethal ? ' lethal' : ''}`}>{aim.lethal ? '命' : ''}−{aim.dmg}</div>}
                {aim2Map[u.uid] && !busy && <div class="tb-inc2">次の次−{aim2Map[u.uid]}</div>}
                {u.side === 'foe' && u.aim && 'flee' in u.aim && <div class="tb-aim">逃</div>}
              </div>
            );
          })}
          {aim2List.length > 0 && !busy && (
            <svg class="tb-arrows" viewBox={`0 0 ${b.w} ${b.h}`} preserveAspectRatio="none" aria-hidden="true">
              <defs><marker id="tbah2" viewBox="0 0 10 10" refX="8" refY="5" markerUnits="userSpaceOnUse" markerWidth=".22" markerHeight=".22" orient="auto"><path d="M0 0L10 5L0 10z" fill="#ffd9a0" /></marker><marker id="tbah1" viewBox="0 0 10 10" refX="8" refY="5" markerUnits="userSpaceOnUse" markerWidth=".22" markerHeight=".22" orient="auto"><path d="M0 0L10 5L0 10z" fill="#ff8a7a" /></marker></defs>
              {aim1List.map(({ f, t }) => <line x1={f.x + 0.5} y1={f.y + 0.5} x2={t.x + 0.5} y2={t.y + 0.5} class="a1" marker-end="url(#tbah1)" />)}
              {aim2List.map(({ f, t }) => <line x1={f.x + 0.5} y1={f.y + 0.5} x2={t.x + 0.5} y2={t.y + 0.5} class="a2" marker-end="url(#tbah2)" />)}
            </svg>
          )}
          {pops.map((p) => <div class={`tb-pop ${p.cls}`} style={{ left: `${((p.x + 0.5) / b.w) * 100}%`, top: `${(p.y / b.h) * 100}%` }}>{p.text}</div>)}
        </div>
      </div>
      {lethalWarn.length > 0 && !busy && b.phase === 'player' && <div class="tb-warn">⚠ 命の危険：{lethalWarn.map(({ f, t }) => `${f.name}が${t?.name ?? ''}を狙っている`).join('、')}{nd ? '（この戦いでは死なず、大けがで済む）' : '。倒れると死んでしまう。動かして避けよう'}</div>}
      <div class="tb-panel">
        {b.phase === 'done' && !busy ? <EndPanel b={b} /> : busy ? (
          <div class="tb-msg tb-line">{line || (replay?.queue.some((f) => f.k === 'phase') ? '― 敵の番 ―' : '……')}{waitTap && <span class="tb-tapnext">▼ タップで進む</span>}<button class="btn small ghost" style={{ float: 'right' }} onClick={() => { if (foeLogRef.current.length) setLastFoe([...foeLogRef.current]); setReplay(null); setOver(null); setFocus(null); setWaitTap(false); }}>演出を飛ばす</button></div>
        ) : selU && tgtU ? (
          <>
            <div class="tb-who"><span class="tb-wf"><UnitFace u={selU} /></span><b>{selU.name}</b> → <b class="red">{tgtU.name}</b>　札を選ぶ</div>
            <div class="tb-cards">
              {swapT.some((o) => o.uid === tgtU.uid) && (
                <button class="tb-card swapc" onClick={() => run((g) => swapUnits(g.battle!, selU.uid, tgtU.uid))}>
                  <span class="tb-cn">入れ替え<span class="tb-ct">特技</span></span>
                  <span class="tb-cd">{selU.name}と{tgtU.name}の場所を入れ替える</span>
                </button>
              )}
              {hasTrait(selU, 'swap2') && swapT.some((o) => o.uid === tgtU.uid) && swapFoeTargets(b, selU, tgtU.uid).length > 0 && (
                <button class="tb-card swapc" onClick={() => { setSwapFirst(tgtU.uid); setMode('swapfoe'); setTgt(null); setMsg(<span>道化の手：<b>{tgtU.name}</b>と入れ替える敵（紫に光る敵）をタップ</span>); }}>
                  <span class="tb-cn">道化の手<span class="tb-ct">特技</span></span>
                  <span class="tb-cd">{tgtU.name}と、ほかの敵の場所を入れ替える</span>
                </button>
              )}
              {atkable.some((f) => f.uid === tgtU.uid) && cards.map((c) => (
                <button class={`tb-card${c.weak ? ' weak' : ''}${c.brk ? ' brk' : ''}`} disabled={!c.spot} onClick={() => run((g) => attack(g.battle!, selU.uid, tgtU.uid, c.id, c.spot, { noDeath: nd }))}>
                  <span class="tb-cn">{c.name} <AtkMark t={c.type} state={c.weak ? 'weak' : c.resisted ? 'no' : undefined} /></span>
                  <span class="tb-cd">{c.spot ? <>ダメージ <b>{c.total}</b>{c.hits > 1 ? `（${c.per}×${c.hits}）` : ''}</> : '届かない'}</span>
                  <span class="tb-ctag">{c.weak && <em class="w">弱点！盾−{c.shields}</em>}{c.hidden && <em class="l">効き目は？</em>}{c.brk && <em class="b">ブレイク！</em>}{c.kill && <em class="k">倒せる</em>}{c.resisted && <em class="n">効かない</em>}{c.broken && <em class="b">傷2倍</em>}{c.left !== null && <em class="l">のこり{c.left}</em>}</span>
                </button>
              ))}
            </div>
            <div class="tb-acts"><button class="btn small ghost grow" onClick={() => setTgt(null)}>やめる</button></div>
          </>
        ) : selU ? (
          <>
            <div class="tb-who"><span class="tb-wf"><UnitFace u={selU} /></span><div><b>{selU.name}</b>　HP {selU.hp}/{selU.max}　{selU.teacher ? `${selU.classId !== 'novice' && CLASSES[selU.classId] ? `${CLASSES[selU.classId].name}の` : ''}${TEACHER_RANK.names[b.teacherRank ?? 0]}` : CLASSES[selU.classId]?.name ?? ''}<div class="tb-techs">{selU.teacher ? <span>号令 のこり{b.command}・見極め のこり{b.insight}</span> : <><span class="tb-tch">ふつう <AtkMarksInline list={(selU.atks?.length ? selU.atks : [selU.type])} /></span>{selU.techs.map((t) => <span class="tb-tch">{techOf(t.id)?.name} <AtkMark small t={techOf(t.id)!.type} /><small>のこり{t.left}</small></span>)}</>}</div></div></div>
            {mode !== 'none' && msg ? <div class="tb-msg small">{msg}　<button class="btn small ghost" onClick={() => { setMode('none'); setSwapFirst(null); setMsg(null); }}>やめる</button></div> : <div class="tb-msg small">{atkable.length ? '赤く光る敵をタップすると、札が並びます。' : '届く敵がいない。'}{healOk.length ? '緑の仲間をタップで回復。' : ''}{swapT.length ? '紫に光る相手をタップで入れ替え。' : ''}{opens.length ? '光る宝箱・扉をタップで開ける。' : ''}動くだけなら青いマス。</div>}
            <div class="tb-acts">
              <button class="btn small grow" onClick={() => run((g) => wait(g.battle!, selU.uid))}>待機</button>
              {!!selU.potion && selU.hp < selU.max && <button class="btn small grow" onClick={() => run((g) => usePotion(g.battle!, selU.uid))}>傷薬</button>}
              {selU.teacher && b.command > 0 && mine(b).some((m) => m.acted && !m.teacher) && <button class="btn small accent grow" onClick={() => { setMode('command'); setSel(null); setMsg('号令：もう一度動かす子（光っている子）をタップ'); }}>号令</button>}
              {selU.teacher && insightTargets(b).length > 0 && <button class="btn small accent grow" onClick={() => { setMode('insight'); setSel(null); setMsg('見極め：弱点を見たい敵（光っている敵）をタップ'); }}>見極め</button>}
              {canTrap && <button class="btn small accent grow" onClick={() => { setMode('trap'); setMsg(<span>罠：置くマス（光っているマス）をタップ。敵が通ると傷を負い、そこで止まる（のこり{b.trapLeft?.[selU.uid] ?? 0}）</span>); }}>罠</button>}
              {igns.length > 0 && <button class="btn small accent grow" onClick={() => { setMode('ignite'); setMsg(<span>火矢：燃やすマス（光っている森{igns.some((o) => o.gate) ? '・木の門' : ''}）をタップ。燃える森は、通る者が傷を負う</span>); }}>火矢</button>}
              {!selU.teacher && <button class="btn small ghost grow" onClick={() => run((g) => autoOne(g.battle!, selU.uid, { noDeath: nd }))}>この子はおまかせ</button>}
              <button class="btn small ghost grow" onClick={() => setSel(null)}>選びなおす</button>
            </div>
          </>
        ) : (
          <>
            <div class="tb-msg">{msg ?? (mode !== 'none' ? '' : <span>教え子をタップ。赤い数字は、敵が次に狙う相手と傷の大きさ。駒を長押しすると、その子だけ「この番はおまかせ」。</span>)}</div>
            <div class="tb-acts">
              <button class="btn primary grow" onClick={() => { sfx('ok'); run((g) => endTurn(g.battle!, { noDeath: nd })); }}>ターンを終える{left ? `（あと${left}人）` : ''}</button>
              <button class="btn small ghost" disabled={!b.undo} onClick={() => { sfx('cancel'); act((g) => { undoLast(g.battle!); }); setSel(null); setTgt(null); }}>ひとつ戻す</button>
            </div>
            {lastFoe.length > 0 && <div class="tb-acts"><button class="btn small ghost grow" onClick={() => { sfx('move'); setReview(lastFoe); }}>敵の番のふりかえり（{lastFoe.length}）</button></div>}
            <div class="tb-acts">
              <button class="btn small ghost grow" onClick={() => run((g) => autoTurn(g.battle!, { noDeath: nd }))}>残りをおまかせ{left ? `（${left}人）` : ''}</button>
              <button class="btn small ghost grow" onClick={() => { if (confirm(b.march && b.march.total > 1 ? 'この戦場を最後までおまかせで進めますか？（次の戦場の前で止まります）' : '最後までおまかせで進めますか？（同じ計算で自動に進み、名場面は残ります）')) act((g) => finishAuto(g)); }}>全員おまかせ{b.march && b.march.total > 1 ? '（この戦場）' : '（最後まで）'}</button>
            </div>
          </>
        )}
      </div>
      <div class="tb-help">運はありません。攻撃は必ず当たります。弱点を突くと盾が割れ、0になると「ブレイク」（次の番は動けず、受ける傷が2倍）。 <AtkLegend /></div>
      {over && <Overlay o={over} onTap={tapOver} />}
      {review && <ReviewSheet lines={review} onClose={() => setReview(null)} />}
      {guide >= 0 && !busy && <GuideBox step={guide} tutorial={!!b.tutorial} onNext={() => { if (guide >= 2) { setGuide(-1); act((g) => { g.tutorial ??= { tour: 99, seen: [] }; if (!g.tutorial.seen.includes('tactics')) g.tutorial.seen.push('tactics'); }); } else setGuide(guide + 1); }} />}
    </div>
  );
}

interface Card { id: string | null; name: string; type: import('../data/tactics').AtkType; total: number; per: number; hits: number; weak: boolean; hidden: boolean; shields: number; brk: boolean; kill: boolean; resisted: boolean; broken: boolean; left: number | null; spot: { x: number; y: number } | null }
function attackCards(b: TBattle, u: TUnit, f: TUnit): Card[] {
  return attacksOf(u).map((t) => {
    const spot = bestSpot(b, u, f, t);
    const steps = spot ? reach(b, u)[key(spot.x, spot.y)] ?? 0 : 0;
    const ox = u.x, oy = u.y;
    if (spot) { u.x = spot.x; u.y = spot.y; }
    const c = calc(b, u, f, t, { steps });
    u.x = ox; u.y = oy;
    const tech = techOf(t);
    // 23夜目の前の直し：まだ分かっていない弱点は、札で明かさない（打ってみるまで「？」）
    const known = c.weak && f.known.includes(c.type) && f.weak.includes(c.type);
    const hidden = c.weak && !known;
    return { id: t, name: tech?.name ?? '攻撃', type: c.type, total: c.total, per: c.per, hits: c.hits, weak: known, hidden, shields: c.shields, brk: c.brk && !hidden, kill: c.kill, resisted: c.resisted, broken: c.broken, left: tech ? u.techs.find((x) => x.id === t)?.left ?? 0 : null, spot };
  });
}

function foeInfo(b: TBattle, f: TUnit): ComponentChildren {
  const aim = f.aim && 't' in f.aim ? unit(b, f.aim.t) : null;
  return (
    <span class="tb-foeinfo"><b>{f.name}</b><span>HP {f.hp}/{f.max}</span><span>盾 {f.sh}</span>
      <span>弱点 {f.weak.length ? f.weak.map((w) => (f.known.includes(w) && !f.resist.includes(w) ? <AtkMark t={w} state="weak" /> : f.resist.includes(w) ? null : <AtkMark state="q" />)) : 'なし'}</span>
      {f.resist.length > 0 && <span>効かない {f.resist.map((r) => <AtkMark t={r} state="no" />)}</span>}
      <span>攻撃 <AtkMark t={f.type} /></span>
      <span>{aim ? `次は${aim.name}を狙う` : f.broken ? 'ブレイク中' : ''}</span></span>
  );
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
        <div class="tb-wks">{types.map((t) => u.resist.includes(t) ? <span class="wk no"><AtkMark t={t} state="no" /> もう効かない</span> : u.known.includes(t) ? <span class="wk">弱点 <AtkMark t={t} state="weak" /></span> : <span class="wk q">弱点 <AtkMark state="q" /></span>)}</div>
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
  if (o.kind === 'cutin') return <div class="tb-ov" onClick={onTap}><div class={`tb-cutin${o.tap ? ' hold' : ''}`}>{o.a && <span class="tb-cf"><UnitFace u={o.a} /></span>}<span class="tb-ctx"><b>{o.title}</b><span>{o.sub}</span></span>{o.tap && <span class="tb-tri">▼</span>}</div></div>;
  if (o.kind === 'break') return <div class="tb-ov" onClick={onTap}><div class="tb-breakfx">ブレイク！<small>{o.sub}</small></div></div>;
  if (o.kind === 'phase') return <div class="tb-ov" onClick={onTap}><div class="tb-phase"><b>{o.title}</b><small>{o.sub}</small></div></div>;
  return <div class="tb-ov say" onClick={onTap}><div class={`tb-say${o.a?.nemesis ? ' nem' : ''}`}>{o.a && <span class="tb-sf"><UnitFace u={o.a} /></span>}<p><b>{o.a?.name}</b>「{o.text}」</p>{o.tap && <span class="tb-tri">▼</span>}</div></div>;
}

/** 22夜目⑦：敵の番のふりかえり（その番の動きを並べる） */
function ReviewSheet({ lines, onClose }: { lines: string[]; onClose: () => void }) {
  return (
    <div class="overlay top" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div class="sheet">
        <div class="row between"><h2 class="grow">敵の番のふりかえり</h2><button class="btn ghost small" onClick={() => { sfx('cancel'); onClose(); }}>閉じる</button></div>
        <ol class="tb-review">{lines.map((l) => <li>{l}</li>)}</ol>
      </div>
    </div>
  );
}

function EndPanel({ b }: { b: TBattle }) {
  const last = [...b.log].reverse().find((l) => l.big);
  const more = b.result === 'win' && b.march && b.march.idx < b.march.total - 1 && b.units.some((u) => u.teacher && u.alive);
  return (
    <div class="tb-end">
      <div class={`tb-verdict ${b.result}`}>{b.result === 'win' ? (more ? 'この戦場を抜いた' : '勝利') : '敗北'}</div>
      <div class="tb-msg">{last?.text}</div>
      {b.march && b.march.total > 1 && b.result !== 'win' && b.march.idx > 0 && <div class="tb-msg small">{b.march.idx}つの戦場を抜いた戦果は残ります</div>}
      <button class="btn primary block" onClick={() => { sfx('ok'); act((g) => finishBattle(g)); }}>{more ? `次へ（${b.march!.names[b.march!.idx + 1]}の前に、小休止）` : '結果を見る'}</button>
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

function AtkMarksInline({ list }: { list: AtkType[] }) { return <>{list.map((t) => <AtkMark small t={t} />)}</>; }
