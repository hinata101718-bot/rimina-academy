// 戦いの記録（7夜目）：場面に移した攻撃ごとの記録を、画面に並べる項目（ターンの区切り・攻撃のカード・雑兵のまとめ・黄色い帯）にする。DOMに依存しない
import type { BattleState, BLog, Unit } from './types';
import type { AutoScene, AutoLine } from './auto';

export type AtkLog = Extract<BLog, { k: 'atk' }>;
export type HealLog = Extract<BLog, { k: 'heal' }>;
export type BItem =
  | { k: 'turn'; turn: number; side: 'player' | 'enemy' }
  | { k: 'atk'; e: AtkLog }
  | { k: 'heal'; e: HealLog }
  /** 雑兵の行動のまとめ（「盗賊3人の攻撃：合計−9」） */
  | { k: 'group'; count: number; total: number; counter: number; entries: (AtkLog | HealLog)[]; names: string[] }
  | { k: 'band'; line: AutoLine; scene: number }
  | { k: 'title'; text: string; scene: number }
  /** 場面の終わり：両軍のHPをそろえる（毒・砦などで記録にない増減を合わせる） */
  | { k: 'sync'; scene: number; hp: Record<string, number>; gone: string[] };

/** 名前のない雑兵か（敵将・卒業生・ボスは除く） */
export function isGrunt(u: Unit | undefined, leaderUid?: string): boolean {
  return !!u && u.side === 'enemy' && !u.boss && u.uid !== leaderUid && !u.studentId;
}

/** 雑兵の行動のまとめ：同じやりとり（x）がすべて雑兵の攻撃と、それへの反撃で、倒れた者も必殺もないものが3つ以上続いたら1枚に */
export function compact(log: BLog[], units: Unit[], leaderUid?: string, minRun = 3): BItem[] {
  const byId = new Map(units.map((u) => [u.uid, u]));
  const out: BItem[] = [];
  let i = 0;
  // やりとりごとに分ける
  const chunks: BLog[][] = [];
  for (const e of log) {
    if (e.k === 'turn') { chunks.push([e]); continue; }
    const last = chunks[chunks.length - 1];
    if (last && last[0].k !== 'turn' && (last[0] as AtkLog).x === e.x) last.push(e); else chunks.push([e]);
  }
  const quiet = (c: BLog[]) => {
    const first = c[0];
    if (first.k !== 'atk' || first.role !== 'atk') return false;
    if (!isGrunt(byId.get(first.a), leaderUid)) return false;
    return c.every((e) => e.k === 'atk' && !e.kill && !e.crit);
  };
  while (i < chunks.length) {
    let j = i;
    while (j < chunks.length && quiet(chunks[j])) j++;
    if (j - i >= minRun) {
      const es = chunks.slice(i, j).flat() as AtkLog[];
      const atk = es.filter((e) => isGrunt(byId.get(e.a), leaderUid));
      const names = [...new Set(atk.map((e) => e.a))];
      out.push({ k: 'group', count: names.length, total: atk.reduce((a, e) => a + e.dmg, 0), counter: es.filter((e) => !isGrunt(byId.get(e.a), leaderUid)).reduce((a, e) => a + e.dmg, 0), entries: es, names });
      i = j;
      continue;
    }
    for (const e of chunks[i]) {
      if (e.k === 'turn') out.push({ k: 'turn', turn: e.turn, side: e.side });
      else if (e.k === 'atk') out.push({ k: 'atk', e });
      else out.push({ k: 'heal', e });
    }
    i++;
  }
  // 中身のないターンの区切りは消す
  return out.filter((x, n) => x.k !== 'turn' || (out[n + 1] && out[n + 1].k !== 'turn'));
}

/** 画面に並べる項目（開戦は帯が先、ほかの場面は記録のあとに帯） */
export function battleItems(b: BattleState): BItem[] {
  const a = b.auto;
  if (!a) return [];
  const leaderUid = a.leader?.uid;
  const out: BItem[] = [];
  a.scenes.forEach((sc: AutoScene, i: number) => {
    const bands: BItem[] = sc.lines.map((line) => ({ k: 'band', line, scene: i }));
    const log = sc.log ? compact(sc.log, b.units, leaderUid) : [];
    if (sc.title !== '開戦' && sc.title !== '指示' && sc.title !== '策' && i > 0 && sc.log) out.push({ k: 'title', text: sc.duo ? '宿命の対決' : sc.title, scene: i });
    if (i === 0 || !sc.log) out.push(...bands, ...log);
    else out.push(...log, ...bands);
    if (sc.hp) out.push({ k: 'sync', scene: i, hp: sc.hp, gone: sc.gone ?? [] });
  });
  return out;
}

/** 項目n個目まで進んだときの、両軍のHP（uid→HP）と倒れた者 */
export function hpAt(b: BattleState, items: BItem[], n: number): { hp: Record<string, number>; gone: Set<string> } {
  const hp: Record<string, number> = {};
  const gone = new Set<string>();
  for (const [uid, v] of Object.entries(b.auto?.hp0 ?? {})) hp[uid] = v[0];
  const apply = (e: AtkLog | HealLog) => { hp[e.d] = e.hp1; if (e.k === 'atk' && e.kill) gone.add(e.d); };
  for (let i = 0; i < Math.min(n, items.length); i++) {
    const it = items[i];
    if (it.k === 'atk' || it.k === 'heal') apply(it.e);
    else if (it.k === 'group') it.entries.forEach(apply);
    else if (it.k === 'sync') { Object.assign(hp, it.hp); for (const g of it.gone) gone.add(g); }
  }
  return { hp, gone };
}
