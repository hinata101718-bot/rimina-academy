// 戦況：国力・関係・緊張度・学校との友好度・大事件
import { B } from '../data/balance';
import { COUNTRIES, COUNTRY_NAMES, COUNTRY_SHORT } from '../data/people';
import type { CountryId } from './types';
import type { GameState, Student } from './state';
import { Rng } from './rng';
import { clamp, relKey } from './util';

export type Stage = 'peace' | 'tension' | 'war';
export function tensionStage(t: number): Stage {
  if (t < B.world.peaceBelow) return 'peace';
  if (t > B.world.warAbove) return 'war';
  return 'tension';
}
export const STAGE_NAMES: Record<Stage, string> = { peace: '平和期', tension: '緊張期', war: '激戦期' };

export type RelStage = 'war' | 'tense' | 'friendly' | 'allied';
export function relStage(v: number): RelStage {
  if (v < B.world.relWar) return 'war';
  if (v < 0) return 'tense';
  if (v <= B.world.relAllied) return 'friendly';
  return 'allied';
}
export const REL_NAMES: Record<RelStage, string> = { war: '戦争', tense: '緊張', friendly: '友好', allied: '同盟' };
export const PAIRS: { key: 'ke' | 'ea' | 'ak'; a: CountryId; b: CountryId }[] = [
  { key: 'ke', a: 'kingdom', b: 'empire' }, { key: 'ea', a: 'empire', b: 'alliance' }, { key: 'ak', a: 'alliance', b: 'kingdom' },
];

export function atWar(s: GameState, a: CountryId, b: CountryId): boolean {
  return relStage(s.world.relations[relKey(a, b)]) === 'war';
}

function addPower(s: GameState, c: CountryId, d: number) { s.world.power[c] = clamp(s.world.power[c] + d, 0, 100); }
function addRel(s: GameState, k: 'ke' | 'ea' | 'ak', d: number) { s.world.relations[k] = clamp(s.world.relations[k] + d, -100, 100); }

/** 現役の卒業生（所属国別） */
export function activeAlumni(s: GameState, c?: CountryId): Student[] {
  return Object.values(s.students).filter((st) => st.status === 'graduated' && st.career && st.career.alive && !st.career.retired && st.career.kind === 'army' && (!c || st.career.country === c));
}
export function rankPoints(st: Student): number {
  if (!st.career) return 0;
  const table = B.alumni.rankPoints[st.career.path];
  return table[Math.min(st.career.rank, table.length - 1)] ?? 0;
}
export function pathPoints(s: GameState, c: CountryId, path: 'warrior' | 'strategist' | 'civil'): number {
  return activeAlumni(s, c).filter((st) => st.career!.path === path).reduce((a, st) => a + rankPoints(st), 0);
}

export interface WorldNews { headline: string; lines: string[] }

/** 毎月の小さな変動 */
export function monthlyWorld(s: GameState, rng: Rng): string[] {
  const w = s.world;
  const out: string[] = [];
  const speed = s.settings.mods.war;
  for (const c of COUNTRIES) {
    addPower(s, c, (rng.next() - 0.5) * B.world.monthlyDrift * speed + (55 - w.power[c]) * B.world.powerMeanRevert / 12);
  }
  for (const p of PAIRS) {
    let d = (rng.next() - 0.52) * 2.2 * speed;
    if (relStage(w.relations[p.key]) === 'war') d -= 0.25 * speed;
    // 帝国は野心が強い（統一の大義）
    if (p.a === 'empire' || p.b === 'empire') d -= 0.15 * speed;
    if (p.key === 'ak') d += 0.12;
    addRel(s, p.key, d);
  }
  recalcTension(s, 0.15);
  for (const k of Object.keys(w.eventCooldown)) if (w.eventCooldown[k] > 0) w.eventCooldown[k] -= 1;
  out.push(...majorEvents(s, rng, false));
  return out;
}

export function recalcTension(s: GameState, weight: number): void {
  const w = s.world;
  let target = 20;
  for (const p of PAIRS) {
    const st = relStage(w.relations[p.key]);
    if (st === 'war') target += 26;
    else if (st === 'tense') target += 12 + (-w.relations[p.key]) * 0.2;
    else if (st === 'allied') target -= 6;
    else target -= 2;
  }
  const pw = COUNTRIES.map((c) => w.power[c]);
  target += (Math.max(...pw) - Math.min(...pw)) / B.world.tensionPowerGapDiv;
  w.tension = clamp(w.tension + (target - w.tension) * weight, 0, 100);
}

/** 年度末の大きな変動 */
export function yearlyWorld(s: GameState, rng: Rng): string[] {
  const w = s.world;
  const out: string[] = [];
  const speed = s.settings.mods.war;
  for (const c of COUNTRIES) {
    const war = pathPoints(s, c, 'warrior') * B.world.warriorPowerMul;
    const strat = pathPoints(s, c, 'strategist') * B.world.strategistPowerMul;
    const atWarCount = COUNTRIES.filter((o) => o !== c && atWar(s, c, o)).length;
    let d = war * 0.4 + rng.int(-B.world.yearRandom, B.world.yearRandom) * speed;
    if (atWarCount) d += (strat - 2) * 0.6 * speed - atWarCount * 2 * speed;
    d += (50 - w.power[c]) * 0.08;
    addPower(s, c, d);
  }
  for (const p of PAIRS) {
    const civ = Math.min(pathPoints(s, p.a, 'civil'), pathPoints(s, p.b, 'civil'));
    let d = civ * B.world.civilRelMul + rng.int(-4, 3) * speed;
    if (relStage(w.relations[p.key]) === 'war') d += B.world.warDecay * speed;
    // 長い戦争は疲れを生み、停戦へ向かう力も働く
    if (w.warYears >= 4) d += w.warYears * 0.8;
    addRel(s, p.key, d);
  }
  recalcTension(s, 0.6);
  const stage = tensionStage(w.tension);
  w.warYears = stage === 'war' ? w.warYears + 1 : 0;
  // 激戦期が長いと国力が削れる
  if (stage === 'war') for (const c of COUNTRIES) addPower(s, c, -2.5 * speed);
  w.history.push({ year: s.year, tension: Math.round(w.tension), power: { ...w.power } });
  out.push(`大陸は${STAGE_NAMES[stage]}（緊張度${Math.round(w.tension)}）`);
  out.push(...majorEvents(s, rng, true));
  return out;
}

function cd(s: GameState, id: string): boolean { return (s.world.eventCooldown[id] ?? 0) <= 0; }
function setCd(s: GameState, id: string, months: number) { s.world.eventCooldown[id] = months; }

/** 大事件。発生したものの見出しを返し、郵便・年表・新聞の材料を pendingEvents に積む */
export function majorEvents(s: GameState, rng: Rng, yearEnd: boolean): string[] {
  const w = s.world;
  const out: string[] = [];
  const fire = (title: string, lines: string[]) => {
    out.push(title);
    s.chronicle.push({ year: s.year, month: s.month, text: title, kind: 'world' });
    s.pending.push({ type: 'event', title, lines });
    pushEventNews(s, title, lines);
  };
  // 1. 銃の登場
  if (!w.gunUnlocked && s.year >= w.gunYear && (yearEnd || rng.chance(0.15))) {
    w.gunUnlocked = true;
    addPower(s, 'empire', 5);
    fire('銃の登場', [
      'ソラリウス帝国が、火薬で鉛の弾を撃ち出す新兵器「銃」を戦場に投入した。',
      '学校でも「銃」の授業が受けられるようになり、銃兵の兵種試験と射撃場の建設が解放された。',
      '王国の騎士たちは「卑怯な武器だ」と眉をひそめている。',
    ]);
  }
  // 2. 国境紛争
  for (const p of PAIRS) {
    const v = w.relations[p.key];
    if (v < -25 && v >= B.world.relWar && cd(s, `border_${p.key}`) && rng.chance(0.12)) {
      addRel(s, p.key, B.world.events.borderClashRel);
      setCd(s, `border_${p.key}`, 14);
      const alumni = [...activeAlumni(s, p.a), ...activeAlumni(s, p.b)];
      fire(`${COUNTRY_SHORT[p.a]}と${COUNTRY_SHORT[p.b]}の国境紛争`, [
        `${COUNTRY_NAMES[p.a]}と${COUNTRY_NAMES[p.b]}の国境で、兵士どうしの衝突が起きた。`,
        '国境沿いの依頼が増えそうだ。',
        ...(alumni.length ? [`教え子の${alumni.slice(0, 3).map((a) => a.given).join('・')}が国境に向かったと聞く。`] : []),
      ]);
      recalcTension(s, 0.3);
    }
  }
  // 3. 帝国の侵攻
  if (w.power.empire >= B.world.events.invasionEmpirePower && atWar(s, 'empire', 'kingdom') && cd(s, 'invasion') && rng.chance(0.25)) {
    addPower(s, 'kingdom', B.world.events.invasionPower);
    addPower(s, 'empire', 2);
    setCd(s, 'invasion', 18);
    const kAlumni = activeAlumni(s, 'kingdom');
    fire('帝国の侵攻', [
      'ソラリウス帝国の大軍が国境を越え、ヴィンターガルト王国へ攻め込んだ。',
      `王国の国力が大きく下がった（${Math.round(w.power.kingdom)}）。`,
      ...(kAlumni.length ? [`王国にいる教え子たち（${kAlumni.length}人）が最前線にいるかもしれない。`] : []),
    ]);
    for (const st of kAlumni.slice(0, 2)) if (st.trust >= 50) s.mail.unshift({ id: `m${s.nextId++}`, year: s.year, month: s.month, from: st.given, title: '最前線より', body: `先生、帝国の軍勢が来ました。今、最前線にいます。でも大丈夫です。先生に教わったことを思い出しながら戦います。—${st.given}`, read: false, studentId: st.id });
  }
  // 4. 和平会議
  if (PAIRS.every((p) => w.relations[p.key] >= B.world.events.peaceRel) && w.tension < 40 && cd(s, 'peace') && rng.chance(0.3)) {
    setCd(s, 'peace', 24);
    w.peaceTalksHeld += 1;
    const ambassadors = COUNTRIES.filter((c) => activeAlumni(s, c).some((st) => st.career!.path === 'civil' && st.career!.rank >= 2));
    for (const p of PAIRS) addRel(s, p.key, 6 + ambassadors.length * 3);
    fire('和平会議', [
      '三国の代表が同盟の都に集まり、和平について話し合った。',
      ambassadors.length === 3 ? '三国すべての席に、リミナ分校の教え子の姿があった！' : `教え子が大使として出席した国：${ambassadors.length ? ambassadors.map((c) => COUNTRY_SHORT[c]).join('・') : 'なし'}。`,
      '話し合いは一歩前進し、三国の関係が少し良くなった。',
    ]);
    recalcTension(s, 0.3);
  }
  // 5. 同盟の内紛
  if (w.power.alliance <= B.world.events.allianceStrifePower && cd(s, 'strife') && rng.chance(0.15)) {
    setCd(s, 'strife', 18);
    const civil = activeAlumni(s, 'alliance').some((st) => st.career!.path === 'civil' && st.career!.rank >= 2);
    addPower(s, 'alliance', civil ? B.world.events.allianceStrifeHit / 2 : B.world.events.allianceStrifeHit);
    if (civil) addRel(s, 'ak', 5);
    fire('同盟の内紛', ['フィオレンツァ同盟の諸侯が対立し、合議が割れた。', civil ? '教え子の大使が間に入り、被害は小さく済んだ。' : '同盟の国力が下がった。']);
  }
  // 6. 王の崩御（5年目以降に一度）
  if (!w.kingDied && s.year >= B.world.events.kingDeathYear && rng.chance(yearEnd ? 0.12 : 0.01)) {
    w.kingDied = true;
    const advisor = activeAlumni(s, 'kingdom').find((st) => st.career!.path !== 'warrior' && st.career!.rank >= 2);
    addRel(s, 'ke', advisor ? 12 : -10);
    fire('王の崩御', ['ヴィンターガルト王国の王が亡くなり、後継をめぐって宮廷が揺れている。', advisor ? `側近として仕える教え子の${advisor.given}が、帝国との対話を新王に勧めたという。` : '新王は帝国への強硬な姿勢を示した。']);
  }
  // 7. 大飢饉
  if (w.warYears >= B.world.events.famineWarYears && yearEnd && cd(s, 'famine') && rng.chance(0.4)) {
    setCd(s, 'famine', 24); w.famine = true;
    fire('大飢饉', ['長い戦争で畑が荒れ、大陸に飢饉が広がった。', '親を失った子どもたちの志願が増え、三国からの援助金が減りそうだ。']);
  }
  // 8. 疫病
  if (yearEnd && rng.chance(B.world.events.epidemicRate)) {
    w.epidemic = true;
    fire('疫病の流行', ['大陸で疫病が流行している。今年は体調を崩す生徒が出やすい（疲労の限界が下がる）。']);
  }
  // 9. 学校防衛戦
  if (tensionStage(w.tension) === 'war' && !yearEnd && !w.schoolDefensePending && cd(s, 'defense') && s.month !== 5 && s.month !== 11 && rng.chance(B.world.events.schoolDefenseChance)) {
    w.schoolDefensePending = true;
    setCd(s, 'defense', 20);
    fire('学校に迫る戦火', ['国境の戦いが学校の近くまで迫っている。今月末は学校を守る戦い（学校防衛戦）になる。']);
  }
  // 10. 英雄の出現
  for (const c of COUNTRIES) {
    if (!yearEnd || !cd(s, 'hero')) break;
    const top = activeAlumni(s, c).filter((st) => st.career!.path === 'warrior' && st.level >= 35);
    if (top.length && rng.chance(0.08)) {
      const h = rng.pick(top);
      addPower(s, c, B.world.events.heroPower);
      setCd(s, 'hero', 24);
      h.history.push({ year: s.year, text: '英雄と呼ばれる大戦果を挙げた' });
      fire(`英雄の出現：${h.given}`, [`${COUNTRY_NAMES[c]}の${h.given}（リミナ分校卒）が大戦果を挙げ、「英雄」と呼ばれている。`, `${COUNTRY_SHORT[c]}の国力が大きく上がった。`]);
    }
  }
  return out;
}

function pushEventNews(s: GameState, title: string, lines: string[]) {
  s.news.unshift({ id: `news${s.nextId++}`, year: s.year, month: s.month, headline: title, body: lines, alumni: [], tension: Math.round(s.world.tension) });
  if (s.news.length > 60) s.news.length = 60;
}

/** 実戦依頼の結果による小さな変動 */
export function questWorldEffect(s: GameState, client: CountryId | null, enemy: CountryId | null, win: boolean): string[] {
  const out: string[] = [];
  if (!client) return out;
  if (win) {
    addPower(s, client, B.quests.powerUp);
    s.world.friendship[client] = clamp(s.world.friendship[client] + B.quests.friendshipUp, -50, 100);
    out.push(`${COUNTRY_SHORT[client]}との友好度+${B.quests.friendshipUp}`);
    if (enemy) { addPower(s, enemy, -B.quests.powerUp); }
    for (const o of COUNTRIES) if (o !== client && atWar(s, client, o)) { s.world.friendship[o] = clamp(s.world.friendship[o] - B.quests.enemyFriendshipDown, -50, 100); out.push(`${COUNTRY_SHORT[o]}との友好度−${B.quests.enemyFriendshipDown}`); }
  }
  return out;
}
