// 札の戦い（16夜目）：出撃前の山札・札を出す画面・札の結果。見本 docs/mockups/battle-ideaA-cards.png・battle-ideaA-flow.png
import { useEffect, useMemo, useState } from 'preact/hooks';
import { act, useStore } from './store';
import { Sheet, HelpTip } from './common';
import { Portrait, OfficerFace } from './Portrait';
import { Icon } from './icons';
import { sfx } from './sound';
import { countryColor } from './cards';
import { FxOverlay, leaderFace, GRUNT_ICON, type FxShow } from './AutoBattle';
import type { GameState, Student } from '../core/state';
import type { BattleState, Unit } from '../core/battle/types';
import { battleCtx, finishBattle, moreEscorted, squadAway } from '../core/flow';
import { chooseAuto, playCardTurn, skipCards, type LeaderInfo } from '../core/battle/auto';
import { cardPreview, intentText, autoPick, incoming, previewDeck, type Card, type CLine } from '../core/battle/cards';
import { officerById } from '../core/officers';
import { FACTION_COLOR } from '../data/officers';
import { COUNTRY_SHORT, SKILL_NAMES } from '../data/people';
import { MAP_TAGS, TAG_NAMES, STRATS } from '../data/stratagems';
import { WEATHER_NAMES } from '../core/quests';
import { WEAPONS } from '../data/weapons';
import { CRIT_SAY, type FxLevel } from '../data/battlefx';
import { fxText } from '../data/arts';

const SQUAD_LABEL = ['第一部隊', '第二部隊', '第三部隊'];
const KIND_LABEL: Record<Card['kind'], string> = { art: '戦技', spell: '魔法', skill: 'スキル札', basic: '攻撃', strat: '策', item: '道具', bloom: '開花の技', legend: '伝説の武器' };
/** 札の色：攻撃＝赤、回復＝緑、守り＝青、強め＝金、策＝茶 */
function cardTone(c: Pick<Card, 'kind' | 'fx'>): string {
  if (c.kind === 'strat') return 'strat';
  if (c.kind === 'bloom' || c.kind === 'legend') return 'gold';
  return c.fx.type === 'atk' ? 'atk' : c.fx.type === 'heal' ? 'heal' : c.fx.type === 'guard' ? 'guard' : 'buff';
}
function skillLabel(c: Pick<Card, 'kind' | 'skill' | 'src'>): string {
  if (c.kind === 'strat') return '策・先生';
  const sk = c.skill === 'staff' ? '杖' : c.skill ? SKILL_NAMES[c.skill] : '';
  return `${KIND_LABEL[c.kind]}${sk ? `・${sk}` : ''}`;
}

/** 戦場の地形と天候（札の帯） */
function placeLabel(s: GameState, b: BattleState): string {
  const q = s.quests.find((x) => x.id === b.questId);
  const tag = q ? (MAP_TAGS[q.template] ?? [])[0] : null;
  const indoor = q ? (MAP_TAGS[q.template] ?? []).includes('keep') : false;
  return `${tag ? TAG_NAMES[tag] : '戦場'}・${indoor ? '屋内' : WEATHER_NAMES[b.weather]}`;
}

export function CardBattleView() {
  const { s } = useStore();
  const b = s?.battle;
  const a = b?.auto;
  const cs = a?.cards;
  const [sel, setSel] = useState<string[]>([]);
  const [doneAck, setDoneAck] = useState(false);
  const [lineN, setLineN] = useState(999);
  const [fxq, setFxq] = useState<FxShow[]>([]);
  const [help, setHelp] = useState(false);
  const fxLevel: FxLevel = s?.settings.battleFx ?? 'big';
  const fxNow = fxq[0] ?? null;
  const turnRec = cs?.turns[cs.turns.length - 1];
  const showingResult = !!cs && (cs.phase === 'result' || (cs.phase === 'done' && !doneAck)) && !!turnRec;
  // 結果の文は1行ずつ出す（タップで残りをすぐ）。見せ場の行で大きな演出
  useEffect(() => {
    if (!showingResult || !turnRec) return;
    setLineN(0);
    const ms = 380 * (({ 1: 1.3, 2: 1, 3: 0.6 } as Record<number, number>)[s?.settings.animSpeed ?? 2] ?? 1);
    let n = 0;
    const tm = setInterval(() => { n += 1; setLineN(n); if (n >= turnRec.lines.length) clearInterval(tm); }, ms);
    return () => clearInterval(tm);
  }, [showingResult, turnRec?.turn, cs?.turns.length]);
  useEffect(() => {
    if (!showingResult || !turnRec || !s || !b || fxLevel === 'low' || lineN <= 0) return;
    const l = turnRec.lines[lineN - 1];
    if (!l) return;
    const f = fxOf(s, b, l, fxLevel);
    if (f) setFxq((q) => [...q, f]);
    if (l.cls === 'dmg') sfx('hit'); else if (l.cls === 'heal') sfx('heal'); else if (l.cls === 'guard') sfx('move');
  }, [lineN]);
  useEffect(() => {
    if (!fxNow) return;
    if (fxNow.k === 'crit' || fxNow.k === 'art') sfx('cutin'); else if (fxNow.k === 'kill') sfx('stamp'); else if (fxNow.k === 'fall') sfx('fall'); else sfx('ok');
    const tm = setTimeout(() => setFxq((q) => q.slice(1)), fxNow.k === 'fall' ? 2400 : 1500);
    return () => clearTimeout(tm);
  }, [fxNow]);
  useEffect(() => { setSel([]); }, [cs?.turn, cs?.phase]);
  if (!s || !b || !a || !cs) return null;
  const leader = a.leader;
  const lo = officerById(s, leader?.officerId);
  const leaderColor = lo ? FACTION_COLOR[lo.faction] : 'var(--accent)';
  const q = s.quests.find((x) => x.id === b.questId);
  const foe = q?.kind === 'monster' ? '魔物' : q?.enemyCountry ? `${COUNTRY_SHORT[q.enemyCountry]}兵` : q && !q.real ? '演習の相手' : '盗賊';
  const grunts = b.units.filter((u) => u.side === 'enemy' && u.uid !== leader?.uid && !u.studentId && !u.boss);
  const nameOf = (uid: string): string => {
    const u = b.units.find((x) => x.uid === uid);
    if (!u) return '？';
    if (leader && uid === leader.uid) return leader.name;
    if (u.studentId && s.students[u.studentId]) return s.students[u.studentId].given;
    const g = a.raised?.find((x) => x.uid === uid);
    if (g) return g.given;
    if (u.side !== 'enemy') return u.name;
    const i = grunts.indexOf(u);
    return i >= 0 ? `${foe}${String.fromCharCode(65 + (i % 26))}` : u.name;
  };
  const ctx = battleCtx(s);
  const stop = (e: Event) => e.stopPropagation();
  const nextSquad = !!s.sortie && s.sortie.idx < s.sortie.squads.length - 1 && moreEscorted(s);
  const nextIdx = s.sortie ? s.sortie.squads.findIndex((sq, i) => i > s.sortie!.idx && !squadAway(sq, i)) : -1;
  const finishLabel = nextSquad ? `${SQUAD_LABEL[nextIdx]}の戦いへ` : s.sortie && s.sortie.idx < s.sortie.squads.length - 1 ? 'ほかの部隊の結果を待つ' : '結果を見る';
  const head = (t: string) => (
    <div class="cb-head row between nowrap">
      <b class="serif cb-title">{t}</b>
      <span class="row nowrap gap6">{s.sortie && s.sortie.squads.length > 1 && <span class="cb-chip dim">{SQUAD_LABEL[s.sortie.idx]}</span>}<span class="cb-chip">{placeLabel(s, b)}</span></span>
    </div>
  );
  const overlay = fxNow && <FxOverlay s={s} b={b} fx={fxNow} level={fxLevel} leader={leader} leaderColor={leaderColor} nameOf={nameOf} onTap={() => setFxq((x) => x.slice(1))} />;

  // ---- 札の結果 ----
  if (showingResult && turnRec) {
    const all = lineN >= turnRec.lines.length;
    const next = cs.phase === 'done' ? null : cs.intents;
    return (
      <div class="cb-view" onClick={() => { if (fxNow) setFxq((x) => x.slice(1)); else if (!all) setLineN(999); }}>
        {head(`ターン${turnRec.turn} ― 札の結果`)}
        <div class="cb-log">
          {turnRec.lines.slice(0, Math.max(1, lineN)).map((l, i) => <ResultLine key={i} s={s} b={b} l={l} nameOf={nameOf} leader={leader} leaderColor={leaderColor} />)}
          {!all && <span class="dq-tri">▼</span>}
        </div>
        {all && next && (
          <div class="cb-box small">
            {next.filter((it) => it.act === 'rage' || it.uid === leader?.uid).slice(0, 2).map((it) => <div>次のターンの{nameOf(it.uid)}：<b class="foe">{intentText(b, it).replace(/（[^）]*）$/, '')}</b></div>)}
            <div>手札を{cs.hand.length}枚引きました。山札 {cs.deck.length}・捨て札 {cs.discard.length}</div>
          </div>
        )}
        {all && cs.phase === 'done' && <div class={`cb-box big serif ${b.result === 'win' ? 'win' : 'lose'}`}>{b.result === 'win' ? '勝利！' : '敗北……'}</div>}
        {all && (
          <button class="btn primary block cb-go" onClick={(e) => { stop(e); sfx('ok'); if (cs.phase === 'done') setDoneAck(true); else act((g) => { const c = g.battle?.auto?.cards; if (c) c.phase = 'play'; }); }}>
            {cs.phase === 'done' ? '決着を見る' : a.choice ? 'ここぞの判断へ' : '次のターンへ'}
          </button>
        )}
        {overlay}
      </div>
    );
  }

  // ---- 場面（開戦・判断の結果・決着） ----
  if (a.shown < a.scenes.length && (cs.phase !== 'done' || doneAck || a.shown === 0)) {
    const sc = a.scenes[a.shown];
    const last = a.shown === a.scenes.length - 1 && a.seg >= 3;
    return (
      <div class="cb-view">
        {head(sc.title === '開戦' ? `${b.title}` : sc.title)}
        {sc.title === '開戦' && <FoeRow s={s} b={b} nameOf={nameOf} leader={leader} leaderColor={leaderColor} hideIntent />}
        <div class="cb-log scene">
          {sc.lines.map((l) => <SceneLine s={s} l={l} leader={leader} leaderColor={leaderColor} />)}
        </div>
        {sc.title === '開戦' && <div class="cb-box small">{b.objective === 'boss' || b.objective === 'seize' ? '敵将を倒せば勝ち。' : b.objective === 'defend' || b.objective === 'escort' ? `${cs.maxTurns}ターン守りきれば勝ち。` : b.objective === 'escape' ? `${cs.maxTurns}ターン持ちこたえて囲みを抜ける。` : '敵を退ければ勝ち。'}{cs.maxTurns}ターンで決着します。行動力 {cs.ap}・手札 {cs.handSize}枚。</div>}
        <button class="btn primary block cb-go" onClick={() => { sfx('ok'); if (last) act((g) => finishBattle(g)); else act((g) => { if (g.battle?.auto) g.battle.auto.shown += 1; }); }}>
          {last ? finishLabel : sc.title === '開戦' ? '札を見る' : '次へ'}
        </button>
      </div>
    );
  }

  // ---- ここぞの判断 ----
  if (a.choice) {
    const c = a.choice;
    return (
      <div class="cb-view">
        {head(c.duo ? '宿命の対決' : 'ここぞの判断')}
        <div class="ab-choice rb-choice cb-choice">
          {c.duo && c.actor && s.students[c.actor] && leader && (
            <div class="ab-duo small">
              <span class="ab-duoside"><Portrait st={s.students[c.actor]} size={56} frame={countryColor(s.students[c.actor].origin)} /><b>{s.students[c.actor].given}</b></span>
              <span class="ab-vs">VS</span>
              <span class="ab-duoside"><OfficerFace o={leaderFace(leader)} size={56} frame={leaderColor} s={s} /><b>{leader.name}</b></span>
            </div>
          )}
          <div class="ab-cq">{c.prompt.split('\n').map((x) => <div>{x}</div>)}</div>
          {c.options.map((o, i) => (
            <button class="btn block ab-copt" onClick={() => { sfx('ok'); act((g) => { chooseAuto(g, i, battleCtx(g)); }); }}>
              {o.actor && s.students[o.actor] && <Portrait st={s.students[o.actor]} size={32} />}
              <span class="grow"><b>{o.label}</b><span class="small muted">{o.note}</span></span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // ---- 札を出す ----
  const hand = cs.hand;
  const cost = (id: string) => cs.cards[id]?.fx.cost ?? 1;
  const used = sel.reduce((x, id) => x + cost(id), 0);
  const left = cs.ap - used;
  const toggle = (id: string) => {
    if (sel.includes(id)) { sfx('move'); setSel(sel.filter((x) => x !== id)); return; }
    if (cost(id) > left) { sfx('cancel'); return; }
    sfx('move'); setSel([...sel, id]);
  };
  const play = (ids: string[], target?: string) => { sfx('ok'); act((g) => playCardTurn(g, ids, target, battleCtx(g))); };
  const inc = incoming(b);
  return (
    <div class="cb-view">
      {head(`ターン${cs.turn} ― 札を出す`)}
      <div class="cb-turnline small"><span>残り {cs.maxTurns - cs.turn + 1}ターン</span><button class="btn ghost small cb-help" onClick={() => setHelp(true)}>？ 遊び方</button></div>
      <FoeRow s={s} b={b} nameOf={nameOf} leader={leader} leaderColor={leaderColor} onTarget={(uid) => act((g) => { const c = g.battle?.auto?.cards; if (c) c.target = c.target === uid ? undefined : uid; })} />
      <div class="cb-party">
        {b.units.filter((u) => (u.side === 'player' || u.side === 'ally' || (u.side === 'npc' && u.escort))).slice(0, 12).map((u) => {
          const dn = u.dead || b.retreated.includes(u.uid);
          const p = Math.max(0, Math.min(100, (u.hp / Math.max(1, u.maxHp)) * 100));
          const th = Math.round(inc[u.uid] ?? 0);
          const st = u.studentId ? s.students[u.studentId] : null;
          return (
            <div class={`cb-mem${dn ? ' down' : ''}${th >= u.hp && !dn ? ' danger' : ''}`}>
              <span class="cb-face">{st ? <Portrait st={st} size={36} frame={countryColor(st.origin)} /> : <span class="bl-icon" style={{ width: 36, height: 36 }}>{u.side === 'npc' ? '守' : '援'}</span>}{th > 0 && !dn && <span class="cb-threat">−{th}</span>}</span>
              <b class="cb-mn">{nameOf(u.uid)}</b>
              <span class="rb-bar ally"><span class={p <= 33 ? 'low' : p <= 60 ? 'mid' : ''} style={{ width: `${dn ? 0 : p}%` }} /></span>
              <span class="cb-hp">{dn ? '退いた' : `${u.hp}/${u.maxHp}`}{u.row === 'back' && !dn ? '・後' : ''}</span>
            </div>
          );
        })}
      </div>
      <div class="cb-apline row between nowrap small">
        <span>山札 {cs.deck.length} ・ 捨て札 {cs.discard.length}</span>
        <span class="row nowrap gap6">行動力 {Array.from({ length: cs.ap }).map((_, i) => <i class={`cb-ap${i < left ? ' on' : ''}`} />)} {left}/{cs.ap} 残り</span>
      </div>
      <div class={`cb-hand n${Math.min(hand.length, 8)}`}>
        {hand.map((id, i) => <HandCard s={s} b={b} id={id} order={sel.indexOf(id)} disabled={!sel.includes(id) && cost(id) > left} onTap={() => toggle(id)} idx={i} n={hand.length} ctx={ctx} />)}
      </div>
      <div class="cb-btns">
        <button class="btn primary block cb-go" disabled={!sel.length} onClick={() => play(sel, cs.target)}>{sel.length ? `この${sel.length}枚を出す` : '札を選んでください'}</button>
        <div class="row nowrap gap6">
          <button class="btn block" onClick={() => { const p = autoPick(s, b, ctx); play(p.ids, cs.target ?? p.target); }}>おまかせで札を出す</button>
          <button class="btn ghost" onClick={() => { if (!confirm('残りのターンを、おまかせで最後まで進めます。よろしいですか？')) return; sfx('ok'); act((g) => { skipCards(g, battleCtx(g)); }); setDoneAck(true); }}>最後まで</button>
        </div>
      </div>
      {help && <Sheet title="札の戦い" onClose={() => setHelp(false)}>
        <p class="small">授業で覚えた戦技・魔法・スキルと、先生の策が札になります。毎ターン手札を引き、<b>行動力</b>の分だけ札を出します（札の左上の数が、使う行動力）。</p>
        <p class="small">敵の札の下に<b>次の行動</b>が出ています。味方の顔の赤い数は、そのまま受けると減るHPです。<b>かばう</b>・<b>守り</b>・<b>回復</b>の札で守るか、先に倒すかを選んでください。敵の札を押すと、攻撃の札で狙う相手を決められます（もう一度押すと、おまかせ）。</p>
        <p class="small">信頼の低い子は、ときどき自分の判断で別の札を使います。倒れた子の札は、その戦いのあいだ手札に来ません。{cs.maxTurns}ターンで決着します。</p>
      </Sheet>}
    </div>
  );
}

/** 敵の並び：前に出ている敵（顔・名前・HP・次の行動）。押すと狙う相手に */
function FoeRow({ s, b, nameOf, leader, leaderColor, onTarget, hideIntent }: { s: GameState; b: BattleState; nameOf: (uid: string) => string; leader: LeaderInfo | null; leaderColor: string; onTarget?: (uid: string) => void; hideIntent?: boolean }) {
  const cs = b.auto!.cards!;
  const q = s.quests.find((x) => x.id === b.questId);
  const faction = q?.kind === 'monster' ? null : q?.enemyCountry ?? 'bandit';
  const col = faction ? FACTION_COLOR[faction as keyof typeof FACTION_COLOR] ?? '#8f2a20' : '#5b6b3a';
  const list = cs.front.map((id) => b.units.find((u) => u.uid === id)).filter((u): u is Unit => !!u);
  const n = list.length;
  const reserve = cs.reserve.filter((id) => { const u = b.units.find((x) => x.uid === id); return u && !u.dead; }).length;
  return (
    <div class="cb-foes">
      {list.map((u) => {
        const L = !!leader && u.uid === leader.uid;
        const dn = u.dead || b.retreated.includes(u.uid);
        const it = cs.intents.find((x) => x.uid === u.uid);
        const g = b.auto?.raised?.find((x) => x.uid === u.uid);
        const sz = L ? (n >= 5 ? 58 : 76) : n >= 5 ? 44 : 56;
        const w = u.weaponId ? WEAPONS[u.weaponId]?.type : undefined;
        const stun = cs.stun.includes(u.uid);
        return (
          <button class={`cb-foe${L ? ' lead' : ''}${dn ? ' down' : ''}${cs.target === u.uid ? ' aim' : ''}`} onClick={() => onTarget?.(u.uid)} disabled={!onTarget || dn}>
            <span class="cb-ffeat">
              {L ? <OfficerFace o={leaderFace(leader)} size={sz} frame={leaderColor} s={s} />
                : u.studentId && s.students[u.studentId] ? <Portrait st={s.students[u.studentId]} size={sz} frame="var(--accent)" />
                : g ? <OfficerFace o={{ faceImage: g.faceImage, face: g.face, scars: 0 }} size={sz} frame="#8f2a20" s={s} />
                : <span class="grunt-card" style={{ width: sz, height: sz, ['--fc' as string]: col }}><Icon name={GRUNT_ICON[w ?? ''] ?? 'sword'} size={Math.round(sz * 0.5)} /></span>}
              {cs.target === u.uid && <span class="cb-aim">狙う</span>}
            </span>
            <b class="cb-fn">{nameOf(u.uid)}</b>
            <span class="rb-bar"><span style={{ width: `${dn ? 0 : Math.max(0, Math.min(100, (u.hp / Math.max(1, u.maxHp)) * 100))}%` }} /></span>
            <span class="cb-fhp">{dn ? '倒れた' : `${u.hp}/${u.maxHp}`}</span>
            {!hideIntent && !dn && it && <span class={`cb-intent${stun ? ' stun' : ''}`}>{stun ? '動けない' : <>{(() => { const m = /^(.*?)（(.*)）$/.exec(intentText(b, it)); return m ? <><b>次：{m[1]}</b><small>→{m[2]}</small></> : <b>次：{intentText(b, it)}</b>; })()}</>}</span>}
          </button>
        );
      })}
      {reserve > 0 && <span class="cb-reserve small">控え {reserve}人</span>}
    </div>
  );
}

/** 手札の1枚：行動力・使う子の顔・名前・種類・効き目の数・使う子 */
function HandCard({ s, b, id, order, disabled, onTap, idx, n, ctx }: { s: GameState; b: BattleState; id: string; order: number; disabled: boolean; onTap: () => void; idx: number; n: number; ctx: ReturnType<typeof battleCtx> }) {
  const cs = b.auto!.cards!;
  const c = cs.cards[id];
  const u = b.units.find((x) => x.uid === c.owner);
  const st = u?.studentId ? s.students[u.studentId] : null;
  const pv = cardPreview(s, b, ctx, id);
  const mid = (n - 1) / 2;
  const rot = n <= 5 ? (idx - mid) * 3 : 0;
  return (
    <button class={`cb-card ${cardTone(c)}${order >= 0 ? ' on' : ''}${disabled ? ' off' : ''}`} style={{ ['--rot' as string]: `${rot}deg` }} onClick={onTap}>
      <span class="cb-cost">{c.fx.cost ?? 1}</span>
      {order >= 0 && <span class="cb-order">{order + 1}</span>}
      <span class="cb-cface">{c.kind === 'strat' ? <span class="cb-strat serif">策</span> : st ? <Portrait st={st} size={26} /> : null}</span>
      <b class="cb-cname serif">{c.name}</b>
      <span class="cb-ckind">{skillLabel(c)}</span>
      <span class={`cb-cfx${c.kind === 'strat' ? ' long' : ''}`}>{c.kind === 'strat' ? `見込み${pv.odds ?? 0}%。${pv.text}` : pv.text}{pv.hit !== undefined && pv.hit < 90 ? `・命中${pv.hit}%` : ''}{pv.tri ? (pv.tri > 0 ? '・有利' : '・不利') : ''}</span>
      <span class="cb-cown">{c.kind === 'strat' ? '先生' : st?.given ?? ''}</span>
    </button>
  );
}

/** 結果の文の1行（顔つき） */
function ResultLine({ s, b, l, nameOf, leader, leaderColor }: { s: GameState; b: BattleState; l: CLine; nameOf: (uid: string) => string; leader: LeaderInfo | null; leaderColor: string }) {
  const u = l.a ? b.units.find((x) => x.uid === l.a) : null;
  const st = u?.studentId && u.side !== 'enemy' ? s.students[u.studentId] : null;
  const isL = !!leader && l.a === leader.uid && (l.cls === 'foe');
  void nameOf;
  return (
    <div class={`cb-line ${l.cls}`}>
      {st && (l.cls.startsWith('ally') || l.cls === 'guard') && <span class="cb-lface"><Portrait st={st} size={22} /></span>}
      {isL && <span class="cb-lface"><OfficerFace o={leaderFace(leader)} size={22} frame={leaderColor} s={s} /></span>}
      {l.cls === 'strat' || l.cls === 'stratng' ? <span class={`rb-tag ${l.cls}`}>策</span> : null}
      <span>{l.text}</span>
    </div>
  );
}
/** 場面の文（開戦・判断の結果・決着） */
function SceneLine({ s, l, leader, leaderColor }: { s: GameState; l: { by: string; text: string }; leader: LeaderInfo | null; leaderColor: string }) {
  const st = s.students[l.by];
  if (l.by === 'leader' && leader) return <div class="cb-line foe"><span class="cb-lface"><OfficerFace o={leaderFace(leader)} size={26} frame={leaderColor} s={s} /></span><span><b>{leader.name}</b>「{l.text}」</span></div>;
  if (st) return <div class="cb-line ally"><span class="cb-lface"><Portrait st={st} size={26} /></span><span><b>{st.given}</b>「{l.text}」</span></div>;
  if (l.by === 'strat' || l.by === 'stratng') return <div class={`cb-line ${l.by}`}><span class={`rb-tag ${l.by}`}>策</span>{l.text.replace(/^策「[^」]+」：/, '')}</div>;
  if (l.by === 'loot') return <div class="cb-line strat"><span class="rb-tag strat">戦利品</span>{l.text.replace(/^戦利品：/, '')}</div>;
  if (l.by.startsWith('raise:')) return <div class="cb-line foe">{l.text}</div>;
  return <div class="cb-line narr">{l.text}</div>;
}

/** 結果の行から、見せ場の演出 */
function fxOf(s: GameState, b: BattleState, l: CLine, level: FxLevel): FxShow | null {
  if (level === 'low' || !l.fx) return null;
  if (l.fx === 'crit' && l.a) {
    const st = s.students[b.units.find((u) => u.uid === l.a)?.studentId ?? ''];
    const say = st ? CRIT_SAY[st.personality] : ['覚悟！'];
    const dmg = l.n ?? 0;
    return { k: 'crit', a: l.a, d: l.d ?? '', dmg, say: say[(l.text.length + (st?.given.length ?? 0)) % say.length] };
  }
  if ((l.fx === 'bloom' || l.fx === 'legend') && l.a) return { k: 'art', a: l.a, title: l.fx === 'bloom' ? '開花の技' : '伝説の武器', name: l.card ?? '' };
  if (l.fx === 'kill' && l.d) return { k: 'kill', a: l.a ?? '', d: l.d };
  if (l.fx === 'fall' && l.d) { const du = b.units.find((u) => u.uid === l.d); return { k: 'fall', d: l.d, outcome: b.fallen.find((f) => f.studentId === du?.studentId)?.outcome ?? 'out', key: 'none' }; }
  if (l.fx === 'strat' && level === 'big') return { k: 'strat', text: l.text };
  return null;
}

/** 出撃前 ― 山札を見る（見本 battle-ideaA-flow.png の左） */
export function DeckPreview({ s, b }: { s: GameState; b: BattleState }) {
  const [open, setOpen] = useState(false);
  const deck = useMemo(() => previewDeck(s, b), [b]);
  const total = deck.reduce((x, d) => x + d.cards.length, 0);
  const fresh = deck.flatMap((d) => d.cards.filter((c) => c.fresh).map((c) => ({ c, owner: d.owner })));
  return (
    <div class="card cb-deck">
      <button class="btn ghost block row between nowrap" onClick={() => { sfx('move'); setOpen(!open); }}>
        <b>山札を見る</b><span class="row nowrap gap6"><span class="cb-chip">{total}枚</span>{fresh.length > 0 && <span class="cb-new">✦新 {fresh.length}</span>}{open ? '▲' : '▼'}</span>
      </button>
      {open && <div class="cb-deckbody">
        <div class="small muted">授業で覚えた<b>戦技・魔法</b>と、先生の<b>策</b>が札になります。出撃する子の札だけが山札に入ります。<HelpTip text="つけている戦技と魔法・スキル（個人ページの技能タブ）が札になります。足りない子は、ふつうの攻撃の札で埋めます。技能のランクが上がると「＋」になり、強くなります。" /></div>
        {deck.map((d) => {
          const u = b.units.find((x) => x.uid === d.owner);
          const st: Student | null = u?.studentId ? s.students[u.studentId] : null;
          if (d.owner === 'teacher' && !d.cards.length) return null;
          return (
            <div class="cb-deckrow">
              <div class="row nowrap gap6 small">{st ? <Portrait st={st} size={24} /> : <span class="cb-strat serif small">策</span>}<b>{st?.given ?? '先生の策'}</b><span class="muted">{d.owner === 'teacher' ? '（軍略で増える）' : `${d.cards.filter((c) => c.kind === 'art' || c.kind === 'bloom').length ? `戦技${d.cards.filter((c) => c.kind === 'art' || c.kind === 'bloom').length}・` : ''}${d.cards.filter((c) => c.kind === 'spell').length ? `魔法${d.cards.filter((c) => c.kind === 'spell').length}・` : ''}${d.cards.filter((c) => c.kind === 'skill').length ? `スキル${d.cards.filter((c) => c.kind === 'skill').length}` : ''}`.replace(/・$/, '')}</span></div>
              <div class="cb-chips">{d.cards.map((c) => <span class={`cb-dchip ${cardTone(c)}${c.fresh ? ' fresh' : ''}`} title={c.kind === 'strat' ? STRATS[c.src.slice(6) as keyof typeof STRATS]?.desc : fxText(c.fx)}>{c.name}{c.fresh ? ' ✦新' : ''}</span>)}</div>
            </div>
          );
        })}
        {fresh.length > 0 && <div class="cb-box small">✦ 最近の授業で覚えた札が、山札に入りました（{fresh.map((x) => x.c.name).join('・')}）。</div>}
        <div class="small muted">戦死した子の札は、山札から消えます。</div>
      </div>}
    </div>
  );
}
