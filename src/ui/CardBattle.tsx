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
import { battleCtx, finishBattle, moreEscorted, squadWatched } from '../core/flow';
import { chooseAuto, playCardTurn, skipCards, type LeaderInfo } from '../core/battle/auto';
import { cardPreview, intentText, autoPick, incoming, previewDeck, cardCosts, comboGlow, comboFor, type Card, type CLine } from '../core/battle/cards';
import { officerById } from '../core/officers';
import { FACTION_COLOR } from '../data/officers';
import { COUNTRY_SHORT, SKILL_NAMES } from '../data/people';
import { MAP_TAGS, TAG_NAMES, STRATS } from '../data/stratagems';
import { WEATHER_NAMES } from '../core/quests';
import { WEAPONS } from '../data/weapons';
import { CRIT_SAY, type FxLevel } from '../data/battlefx';
import { fxText } from '../data/arts';
import { guideStage, guideNext, skipCardGuide, endCardGuide, onCardsOpen, answerGuideOffer } from '../core/battle/cardGuide';
import { CARD_GUIDE, GUIDE_OFFER } from '../data/cardGuide';
import { GuideSeal } from './Guide';
import { GUIDE_NAME } from '../data/tutorial';
import { CardManualSheet } from './CardManual';
import { COMBO_KIND, COMBO_SAY } from '../data/combos';

const SQUAD_LABEL = ['第一部隊', '第二部隊', '第三部隊'];
const KIND_LABEL: Record<Card['kind'], string> = { art: '戦技', spell: '魔法', skill: 'スキル札', basic: '攻撃', strat: '策', item: '道具', bloom: '開花の技', legend: '伝説の武器', combo: '連携技' };
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
  /** 18夜目：最後に押した札（手札の上に全文を出す） */
  const [peek, setPeek] = useState<string | null>(null);
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
  // 宿命の対決・一騎打ち：判断の前に大きな演出
  useEffect(() => {
    const c = a?.choice;
    if (!c || !s || fxLevel === 'low' || showingResult) return;
    if (!(c.duo || c.kind === 'duel')) return;
    const actor = c.actor ?? c.options.find((o) => o.actor)?.actor;
    if (actor && a?.leader) setFxq((q) => [...q, { k: 'duel', a: actor, title: c.duo ? '宿命の対決' : '一騎打ち', say: c.prompt.split('\n')[1] ?? '' }]);
  }, [a?.choice?.prompt, showingResult]);
  // 17夜目：最初の札の戦いの案内（最初の依頼は案内つき、今のセーブは「戦い方が新しくなりました」）
  const playing = !!cs && cs.phase === 'play' && !showingResult && !!a && a.shown >= a.scenes.length && !a.choice;
  useEffect(() => {
    if (!playing || !s || s.cardGuide !== 'pending' || !cs || cs.turn !== 1 || cs.guide || cs.guideOffer) return;
    act((g) => onCardsOpen(g));
  }, [playing, cs?.turn]);
  // 案内の段が変わったら、見てほしいところまで動かす（予告＝上、札を選ぶ＝下の手札とボタン）
  const gStage = b && cs?.guide ? guideStage(b, sel) : null;
  useEffect(() => {
    if (!gStage || showingResult) return;
    const v = (document.querySelector('.cb-top') ?? document.querySelector('.cb-view')) as HTMLElement | null;
    if (!v?.scrollTo) return;
    const tm = setTimeout(() => v.scrollTo({ top: gStage === 'intent' ? 0 : v.scrollHeight, behavior: 'smooth' }), 60);
    return () => clearTimeout(tm);
  }, [gStage, showingResult]);
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
  const nextIdx = s.sortie ? s.sortie.squads.findIndex((sq, i) => i > s.sortie!.idx && squadWatched(s, sq, i)) : -1;
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
        {all && cs.guide?.step === 'after' && <GuideBubble head={CARD_GUIDE.after.head} text={CARD_GUIDE.after.text} />}
        {all && cs.phase === 'done' && <div class={`cb-box big serif ${b.result === 'win' ? 'win' : 'lose'}`}>{b.result === 'win' ? '勝利！' : '敗北……'}</div>}
        {all && (
          <button class="btn primary block cb-go" onClick={(e) => { stop(e); sfx('ok'); if (cs.guide?.step === 'after') act((g) => { if (g.battle) endCardGuide(g.battle); }); if (cs.phase === 'done') setDoneAck(true); else act((g) => { const c = g.battle?.auto?.cards; if (c) c.phase = 'play'; }); }}>
            {cs.phase === 'done' ? '決着を見る' : a.choice ? 'ここぞの判断へ' : '次のターンへ'}
          </button>
        )}
        {overlay}
      </div>
    );
  }

  // ---- 場面（開戦・判断の結果・決着） ----
  // 決着したのに見る場面が残っていないとき（再開したときなど）は、決着の場面をもう一度
  if (cs.phase === 'done' && a.shown >= a.scenes.length && a.scenes.length) a.shown = a.scenes.length - 1;
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
        {overlay}
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
  // 18夜目：行動力は、出す順に数える（先駆けの詠唱の子の魔法は1ターンに1枚だけ1少ない）
  const used = cardCosts(s, b, sel).reduce((x, v) => x + v, 0);
  const cost = (id: string) => cardCosts(s, b, [...sel, id]).pop() ?? 1;
  const left = cs.ap - used;
  const g = cs.guide;
  const stage = guideStage(b, sel);
  const guiding = !!stage && stage !== 'after';
  /** 案内のあいだは、言われた札だけ押せる */
  const allowed = (id: string) => !guiding || (stage === 'cover' && id === g!.cover) || (stage === 'atk' && id === g!.atk);
  const toggle = (id: string) => {
    if (guiding && !allowed(id)) { sfx('cancel'); return; }
    if (sel.includes(id)) { if (guiding) return; sfx('move'); setSel(sel.filter((x) => x !== id)); return; }
    if (cost(id) > left) { sfx('cancel'); return; }
    sfx('move'); setSel([...sel, id]);
  };
  const play = (ids: string[], target?: string) => { sfx('ok'); act((g) => playCardTurn(g, ids, target, battleCtx(g))); };
  const inc = incoming(b);
  const fill = (x: string) => {
    if (!g) return x;
    const cv = cs.cards[g.cover]; const ak = cs.cards[g.atk];
    const v: Record<string, string> = { foe: nameOf(g.foe), ward: nameOf(g.ward), coverBy: nameOf(g.coverBy), attacker: nameOf(g.attacker), cover: cv?.name ?? 'かばう', atk: ak?.name ?? '攻撃', dmg: String(cs.intents.find((it) => it.uid === g.foe)?.dmg ?? ''), left: String(cs.ap - (cv?.fx.cost ?? 1)) };
    return x.replace(/\{(\w+)\}/g, (m, k) => v[k] ?? m);
  };
  // 18夜目：連携技。手札に2人の札がそろうと金の縁、続けて選ぶと「連携技」になる
  const golds = comboGlow(s, b);
  const linked = new Set<string>();
  let comboNow: [string, string] | null = null;
  for (let i = 0; i + 1 < sel.length; i++) if (comboFor(s, b, cs.cards[sel[i]], cs.cards[sel[i + 1]])) { linked.add(sel[i]); linked.add(sel[i + 1]); comboNow = [sel[i], sel[i + 1]]; i++; }
  const gd = stage && stage !== 'after' ? CARD_GUIDE[stage] : null;
  const bubble = gd && (
    <GuideBubble head={gd.head} text={fill(gd.text)}
      onNext={stage === 'intent' ? () => { sfx('ok'); act((x) => { if (x.battle) guideNext(x.battle); }); } : undefined} next={CARD_GUIDE.intent.next}
      onSkip={() => { if (!confirm(CARD_GUIDE.skipConfirm)) return; sfx('cancel'); setSel([]); act((x) => { if (x.battle) skipCardGuide(x.battle); }); }} />
  );
  return (
    <div class={`cb-view cb-play${guiding ? ` guiding g-${stage}` : ''}`}>
      <div class="cb-top">
      {head(`ターン${cs.turn} ― 札を出す`)}
      <div class="cb-turnline small"><span>残り {cs.maxTurns - cs.turn + 1}ターン</span><button class="btn ghost small cb-help" onClick={() => { sfx('ok'); setHelp(true); }}>？ 遊び方</button></div>
      <FoeRow s={s} b={b} nameOf={nameOf} leader={leader} leaderColor={leaderColor} glow={stage === 'intent' ? g!.foe : undefined} onTarget={guiding ? undefined : (uid) => act((g) => { const c = g.battle?.auto?.cards; if (c) c.target = c.target === uid ? undefined : uid; })} />
      <div class="cb-party">
        {b.units.filter((u) => (u.side === 'player' || u.side === 'ally' || (u.side === 'npc' && u.escort))).slice(0, 12).map((u) => {
          const dn = u.dead || b.retreated.includes(u.uid);
          const p = Math.max(0, Math.min(100, (u.hp / Math.max(1, u.maxHp)) * 100));
          const th = Math.round(inc[u.uid] ?? 0);
          const st = u.studentId ? s.students[u.studentId] : null;
          return (
            <div class={`cb-mem${dn ? ' down' : ''}${th >= u.hp && !dn ? ' danger' : ''}${stage === 'intent' && g?.ward === u.uid ? ' gglow' : ''}`}>
              <span class="cb-face">{st ? <Portrait st={st} size={36} frame={countryColor(st.origin)} /> : <span class="bl-icon" style={{ width: 36, height: 36 }}>{u.side === 'npc' ? '守' : '援'}</span>}{th > 0 && !dn && <span class="cb-threat">−{th}</span>}</span>
              <b class="cb-mn">{nameOf(u.uid)}</b>
              <span class="rb-bar ally"><span class={p <= 33 ? 'low' : p <= 60 ? 'mid' : ''} style={{ width: `${dn ? 0 : p}%` }} /></span>
              <span class="cb-hp">{dn ? '退いた' : `${u.hp}/${u.maxHp}`}{u.row === 'back' && !dn ? '・後' : ''}</span>
            </div>
          );
        })}
      </div>
      </div>
      <div class="cb-bottom">
      {bubble}
      <div class="cb-apline row between nowrap small">
        <span>山札 {cs.deck.length} ・ 捨て札 {cs.discard.length}</span>
        <span class="row nowrap gap6">行動力 {Array.from({ length: cs.ap }).map((_, i) => <i class={`cb-ap${i < left ? ' on' : ''}`} />)} {left}/{cs.ap} 残り</span>
      </div>
      <div class={`cb-peek small${comboNow ? ' combo' : ''}`}>{comboNow ? comboPeek(s, b, comboNow) : peekText(s, b, ctx, peek && hand.includes(peek) ? peek : sel[sel.length - 1])}</div>
      <div class={`cb-hand n${Math.min(hand.length, 9)}`}>
        {hand.map((id, i) => <HandCard s={s} b={b} id={id} order={sel.indexOf(id)} disabled={guiding ? !allowed(id) && !sel.includes(id) : !sel.includes(id) && cost(id) > left} glow={guiding && allowed(id) && !sel.includes(id)} gold={!guiding && golds.has(id)} linked={linked.has(id)} onTap={() => { setPeek(id); toggle(id); }} idx={i} n={hand.length} ctx={ctx} />)}
      </div>
      <div class="cb-btns">
        <button class={`btn primary block cb-go${stage === 'play' ? ' gglow' : ''}`} disabled={!sel.length || (guiding && stage !== 'play')} onClick={() => play(sel, cs.target)}>{sel.length ? `この${sel.length}枚を出す${linked.size ? '（連携技）' : ''}` : '札を選んでください'}</button>
        <div class="row nowrap gap6">
          <button class="btn block" disabled={guiding} onClick={() => { const p = autoPick(s, b, ctx); play(p.ids, cs.target ?? p.target); }}>おまかせで札を出す</button>
          <button class="btn ghost" disabled={guiding} onClick={() => { if (!confirm('残りのターンを、おまかせで最後まで進めます。よろしいですか？')) return; sfx('ok'); act((g) => { const b0 = g.battle; skipCards(g, battleCtx(g), undefined, undefined, false); if (g.battle === b0 && g.battle?.auto) g.battle.auto.shown = Math.max(0, g.battle.auto.scenes.length - 1); }); setDoneAck(true); }}>最後まで</button>
        </div>
      </div>
      </div>
      {help && <CardManualSheet onClose={() => setHelp(false)} />}
      {cs.guideOffer && !g && (
        <Sheet top>
          <div class="guide-tip">
            <div class="row nowrap gap8"><GuideSeal /><div class="grow"><div class="small muted">{GUIDE_NAME}</div><b class="serif" style={{ fontSize: 17 }}>{GUIDE_OFFER.title}</b></div></div>
            <div class="guide-say serif">{GUIDE_OFFER.lines.map((l) => <p>{l}</p>)}</div>
          </div>
          <button class="btn primary block" style={{ marginTop: 10 }} onClick={() => { sfx('ok'); setSel([]); let ok = true; act((x) => { ok = answerGuideOffer(x, true); }); if (!ok) setHelp(true); }}>{GUIDE_OFFER.see}</button>
          <button class="btn ghost block" style={{ marginTop: 6 }} onClick={() => { sfx('cancel'); act((x) => answerGuideOffer(x, false)); }}>{GUIDE_OFFER.skip}</button>
        </Sheet>
      )}
    </div>
  );
}

/** 札の戦いの案内の吹き出し（管理人オズヴァルト） */
function GuideBubble({ head, text, onNext, next, onSkip }: { head: string; text: string; onNext?: () => void; next?: string; onSkip?: () => void }) {
  return (
    <div class="cb-guide" role="note" aria-label="案内">
      <div class="row nowrap gap6"><GuideSeal size={32} /><b class="small grow">{GUIDE_NAME}<span class="cb-ghead">{head}</span></b>{onSkip && <button class="btn ghost small cb-gskip" onClick={onSkip}>{CARD_GUIDE.skip}</button>}</div>
      <div class="serif cb-gsay">{text}</div>
      {onNext && <button class="btn primary block cb-gnext" onClick={onNext}>{next}</button>}
    </div>
  );
}

/** 敵の並び：前に出ている敵（顔・名前・HP・次の行動）。押すと狙う相手に */
function FoeRow({ s, b, nameOf, leader, leaderColor, onTarget, hideIntent, glow }: { s: GameState; b: BattleState; nameOf: (uid: string) => string; leader: LeaderInfo | null; leaderColor: string; onTarget?: (uid: string) => void; hideIntent?: boolean; glow?: string }) {
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
          <button class={`cb-foe${L ? ' lead' : ''}${dn ? ' down' : ''}${cs.target === u.uid ? ' aim' : ''}${glow === u.uid ? ' gglow' : ''}`} onClick={() => onTarget?.(u.uid)} disabled={!onTarget || dn}>
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
            {!hideIntent && !dn && it && <span class={`cb-intent${stun ? ' stun' : ''}`}>{stun ? '動けない' : <>{(() => { const m = /^(.*?)（(.*)）$/.exec(intentText(b, it)); const pre = n >= 5 ? '' : '次：'; return m ? <><b>{pre}{m[1]}</b><small>→{m[2]}</small></> : <b>{pre}{intentText(b, it)}</b>; })()}</>}</span>}
          </button>
        );
      })}
      {reserve > 0 && <span class="cb-reserve small">後ろに控えている敵 {reserve}人{leader && cs.reserve.includes(leader.uid) ? `（敵将${leader.name}も）` : ''}</span>}
    </div>
  );
}

/** 手札の1枚：行動力・使う子の顔・名前・種類・効き目の数・使う子 */
function HandCard({ s, b, id, order, disabled, onTap, idx, n, ctx, glow, gold, linked }: { s: GameState; b: BattleState; id: string; order: number; disabled: boolean; onTap: () => void; idx: number; n: number; ctx: ReturnType<typeof battleCtx>; glow?: boolean; gold?: boolean; linked?: boolean }) {
  const cs = b.auto!.cards!;
  const c = cs.cards[id];
  const u = b.units.find((x) => x.uid === c.owner);
  const st = u?.studentId ? s.students[u.studentId] : null;
  const pv = cardPreview(s, b, ctx, id);
  // 18夜目：手札は必ず1行。札の幅は画面の幅から決める（傾けない）
  void idx; void n;
  return (
    <button class={`cb-card ${cardTone(c)}${order >= 0 ? ' on' : ''}${disabled ? ' off' : ''}${glow ? ' gglow' : ''}${gold ? ' combo' : ''}${linked ? ' linked' : ''}`} onClick={onTap} aria-label={`${c.name}（${c.kind === 'strat' ? '先生' : st?.given ?? ''}）${gold ? '・連携技の札' : ''}`}>
      <span class="cb-cost">{costShown(s, b, id)}</span>
      {gold && order < 0 && <span class="cb-link">連携</span>}
      {order >= 0 && <span class="cb-order">{order + 1}</span>}
      <span class="cb-cface">{c.kind === 'strat' ? <span class="cb-strat serif">策</span> : st ? <Portrait st={st} size={26} /> : null}</span>
      <b class="cb-cname serif">{c.name}</b>
      <span class="cb-ckind">{skillLabel(c)}</span>
      <span class={`cb-cfx${c.kind === 'strat' ? ' long' : ''}`}>{c.kind === 'strat' ? `見込み${pv.odds ?? 0}%。${pv.text}` : pv.text}{pv.hit !== undefined && pv.hit < 90 ? `・命中${pv.hit}%` : ''}{pv.tri ? (pv.tri > 0 ? '・有利' : '・不利') : ''}</span>
      <span class="cb-cown">{c.kind === 'strat' ? '先生' : st?.given ?? ''}</span>
    </button>
  );
}

/** 18夜目：続けて選んだ2枚が連携技になるときの説明 */
function comboPeek(s: GameState, b: BattleState, ids: [string, string]): string {
  const cs = b.auto!.cards!;
  const x = cs.cards[ids[0]], y = cs.cards[ids[1]];
  const cb = comboFor(s, b, x, y);
  if (!cb) return '';
  const n = (c: Card) => b.units.find((u) => u.uid === c.owner)?.name ?? '';
  return `連携技「${cb.name}」になります（${n(x)}と${n(y)}・行動力${cardCosts(s, b, ids).reduce((a, v) => a + v, 0)}）：${COMBO_KIND[cb.kind].label}。${COMBO_KIND[cb.kind].tip}`;
}
/** 18夜目：その札1枚の行動力（先駆けの詠唱で1少ないことがある） */
function costShown(s: GameState, b: BattleState, id: string): number { return cardCosts(s, b, [id])[0] ?? 1; }
/** 18夜目：押した札の全文（手札の上の帯） */
function peekText(s: GameState, b: BattleState, ctx: ReturnType<typeof battleCtx>, id: string | null | undefined): string {
  const cs = b.auto!.cards!;
  const c = id ? cs.cards[id] : null;
  if (!c) return '札を押すと選べます（もう一度押すと外す）';
  const u = b.units.find((x) => x.uid === c.owner);
  const st = u?.studentId ? s.students[u.studentId] : null;
  const pv = cardPreview(s, b, ctx, c.id);
  const who = c.kind === 'strat' ? '先生' : st?.given ?? '';
  const fxs = c.kind === 'strat' ? `見込み${pv.odds ?? 0}%。${pv.text}` : `${fxText(c.fx)}（今の見込み：${pv.text}${pv.hit !== undefined && pv.hit < 90 ? `・命中${pv.hit}%` : ''}）`;
  return `${c.name}（${who}・行動力${costShown(s, b, c.id)}）：${fxs}`;
}
/** 結果の文の1行（顔つき） */
function ResultLine({ s, b, l, nameOf, leader, leaderColor }: { s: GameState; b: BattleState; l: CLine; nameOf: (uid: string) => string; leader: LeaderInfo | null; leaderColor: string }) {
  const u = l.a ? b.units.find((x) => x.uid === l.a) : null;
  const st = u?.studentId && u.side !== 'enemy' ? s.students[u.studentId] : null;
  const isL = !!leader && l.a === leader.uid && (l.cls === 'foe');
  void nameOf;
  return (
    <div class={`cb-line ${l.cls}`}>
      {st && (l.cls.startsWith('ally') || l.cls === 'guard' || l.cls === 'say') && <span class="cb-lface"><Portrait st={st} size={22} /></span>}
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
  if (l.fx === 'combo' && l.a && l.d) {
    const sa = b.units.find((u) => u.uid === l.a)?.studentId, sb = b.units.find((u) => u.uid === l.d)?.studentId;
    const cb = sa && sb ? s.combos?.[[sa, sb].sort().join('|')] : null;
    const kind = cb?.kind ?? 'friend';
    const says = COMBO_SAY[kind];
    return { k: 'combo', a: l.a, d: l.d, name: l.card ?? '', label: COMBO_KIND[kind].label, say: says[(l.text.length + (cb?.used ?? 0)) % says.length] };
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
        <div class="small muted">授業で覚えた<b>戦技・魔法</b>と、先生の<b>策</b>が札になります。出撃する子の札だけが山札に入ります。<HelpTip text="つけている戦技と魔法・スキル（個人ページの技能タブ）が札になります。足りない子は、ふつうの攻撃の札で埋めます。戦技と魔法は使うたびに熟練がたまり、満ちると2つの進化先から選んで育てられます。" /></div>
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
        {(() => { const ids = b.units.filter((u) => u.side === 'player' && u.studentId).map((u) => u.studentId!); const cbs = Object.values(s.combos ?? {}).filter((c) => !c.lost && ids.includes(c.a) && ids.includes(c.b)); return cbs.length ? <div class="cb-box small">連携技：{cbs.map((c) => `「${c.name}」（${s.students[c.a]?.given}と${s.students[c.b]?.given}）`).join('・')}。2人の札を続けて出すと発動します。</div> : null; })()}
        <div class="small muted">戦死した子の札は、山札から消えます。</div>
      </div>}
    </div>
  );
}
