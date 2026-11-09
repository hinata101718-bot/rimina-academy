// 22夜目③：人望（魅力の代わり、問113）。能力は増やさず、平静・先生への信頼・家柄・二つ名から出す。DOMに依存しない
import { B } from '../data/balance';
import type { Student } from './state';

/** 二つ名がついた（変わった）回数（個人の記録から数える） */
export function epithetCount(st: Student): number {
  return (st.history ?? []).filter((h) => h.text.includes('と呼ばれるようになった')).length + (st.epithet && !(st.history ?? []).some((h) => h.text.includes('と呼ばれるようになった')) ? 1 : 0);
}
/** 隠れた統率者：古いセーブの才能「隠れた統率者」の子と、統率の眠った芽が花ひらいた子 */
export function bornLeader(st: Student): boolean {
  return !!st.bornLeader || (!!st.bud?.done && st.bud.skill === 'command');
}
/** 人望の内わけ（0〜100） */
export function renownParts(st: Student): { calm: number; trust: number; house: number; epithet: number; leader: number; total: number } {
  const R = B.renown;
  const calm = (st.mind?.calm ?? 50) * R.calm;
  const trust = Math.max(0, st.trust) * R.trust;
  const house = R.house[st.house] ?? 0;
  const n = epithetCount(st);
  const epithet = n ? R.epithet + Math.min(R.epithetMax - 1, n - 1) * R.epithetMore : 0;
  const leader = bornLeader(st) ? R.leader : 0;
  const total = Math.round(Math.max(0, Math.min(100, calm + trust + house + epithet + leader)));
  return { calm, trust, house, epithet, leader, total };
}
/** 人望（0〜100）。文官の向き不向き・和平に近づける力・国からの声かけ・出世に効く */
export function renown(st: Student): number { return renownParts(st).total; }
/** 人望の星（1〜5）とことば */
export function renownStars(v: number): number { return Math.max(1, Math.min(5, 1 + Math.floor(v / 20))); }
export function renownWord(v: number): string { return B.renown.words[renownStars(v) - 1]; }
