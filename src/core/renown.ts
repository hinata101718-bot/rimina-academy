// 22夜目：人望（問113）。能力は増やさず、平静・先生への信頼・家柄・二つ名から出す。
// 文官の向き不向き・文官として和平に近づける力・国からの声かけ・出世の見込みに使う（前は「技・守り・魔力」の平均）
import { B } from '../data/balance';
import type { Student } from './state';

/** 二つ名の数（つくたびに年表に「〜と呼ばれるようになった」と残る。古いセーブは今の二つ名だけ） */
export function epithetCount(st: Pick<Student, 'history' | 'epithet'>): number {
  const n = (st.history ?? []).filter((h) => h.text.includes('と呼ばれるようになった')).length;
  return Math.max(n, st.epithet ? 1 : 0);
}
/** 人を動かす力（隠れた統率者：統率が得意な子も、人望が高く出る） */
export function isLeader(st: Pick<Student, 'talent' | 'apt'>): boolean { return st.talent === 'leader' || !!st.apt?.good.includes('command'); }

/** 人望の点（だいたい5〜25。前の「技・守り・魔力」の平均と同じくらいの大きさ） */
export function renown(st: Pick<Student, 'mind' | 'trust' | 'house' | 'history' | 'epithet' | 'talent' | 'apt'>): number {
  const R = B.renown;
  const n = epithetCount(st);
  const ep = n > 0 ? R.epithet + Math.min(R.epithetMax - 1, n - 1) * R.epithetMore : 0;
  const v = (st.mind?.calm ?? 50) * R.calm + (st.trust ?? 0) * R.trust + (R.house[st.house] ?? 0) + ep + (isLeader(st) ? R.leader : 0);
  return Math.round(v);
}
/** 星の数（1〜5） */
export function renownStars(v: number): number { let n = 1; for (const t of B.renown.stars) if (v >= t) n += 1; return Math.min(5, n); }
export const RENOWN_WORDS = ['まだ目立たない', '顔が知られている', '人に慕われる', '人望が厚い', 'だれもが一目置く'];
export function renownWord(v: number): string { return RENOWN_WORDS[renownStars(v) - 1]; }
/** 文官として和平に近づける力の倍率（人望の高い文官ほど、話し合いを前に進める） */
export function civilMul(st: Parameters<typeof renown>[0]): number {
  const R = B.renown;
  return Math.max(R.civilMin, Math.min(R.civilMax, 1 + (renown(st) - R.civilBase) * R.civilPer));
}
