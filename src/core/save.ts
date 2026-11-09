// セーブデータの変換（バージョン番号つき）。DOMに依存しない
// 19夜目：大改修。古いセーブ（1〜18夜目版）は、ここで一度に新しい形へ変換する（1つずつの古い変換はなくした）
import { SAVE_VERSION, DIFFICULTY, STATS } from '../data/balance';
import { newClassId } from '../data/classes';
import type { GameState, Pending, Student } from './state';
import { defaultSettings } from './game';
import { Rng } from './rng';
import { rollMind, birthdayFor } from './student';
import { learnTechs } from './techs';
import { ensureRosters, linkOrg, markOrgSeen } from './officers';
import { ensureOfficerCombat } from './tactics/setup';
import { memoryOf } from './nemesis';
import { ensureRegions, yearlyRulers } from './regions';
import { startNewsDesk } from './newspaper';
import { ensureLegends } from './rarity';
import { rebuildReviews } from './review';

export interface SaveFile { app: 'rimina-academy'; version: number; savedAt: number; state: GameState }

export function serialize(s: GameState): string {
  const f: SaveFile = { app: 'rimina-academy', version: SAVE_VERSION, savedAt: Date.now(), state: s };
  return JSON.stringify(f);
}

/** 読み込み：古い形式は変換する。壊れていれば例外 */
export function deserialize(text: string): GameState {
  const f = JSON.parse(text) as Partial<SaveFile> & { state?: GameState };
  if (!f || f.app !== 'rimina-academy' || !f.state) throw new Error('このゲームのセーブデータではありません');
  return migrate(f.state, f.version ?? 0);
}

export function migrate(s: GameState, from: number): GameState {
  if (from > SAVE_VERSION) throw new Error('新しい版のセーブデータです。ページを再読み込みしてください');
  const oldSettings = s.settings ?? {};
  s.settings = { ...defaultSettings(), ...oldSettings };
  s.settings.mods = { ...DIFFICULTY[s.settings.difficulty ?? 'normal'], ...(s.settings.mods ?? {}) };
  if (from < 19) convertTo19(s, from);
  s.heirs ??= [];
  s.archive ??= {};
  s.notices ??= [];
  s.version = SAVE_VERSION;
  return s;
}

/** 古い能力（9つ）→ 体の6つ：守りは守備と魔防から。幸運・魅力はなくす */
function convertStats<T extends Record<string, number> | undefined>(x: T): T {
  if (!x) return x;
  const o = x as Record<string, number>;
  if (o.res !== undefined && o.def !== undefined) o.def = Math.round(o.def * 0.6 + o.res * 0.4);
  else if (o.res !== undefined) o.def = o.res;
  delete o.res; delete o.lck; delete o.cha;
  return x;
}

/** 19夜目の新しいこと（古いセーブを読みこんだときに1回だけ） */
export const NIGHT19_LINES = [
  'ゲームが大きく作り直されました（宿敵の仕組み）。中身が大きく変わったので、新しく始めるのがおすすめです。このセーブも続きから遊べます。',
  '戦いは、小さなマス目の戦いになりました。運はありません。攻撃は必ず当たり、敵の次の狙いが見えます。弱点を突いて盾を割ると「ブレイク」します。',
  '月末の戦いは、自分で遊ぶか「おまかせ」で結果だけ見るかを選べます。出るのは教え子4人と先生です。',
  '兵種は14種にまとめました（いまの兵種は近いものに変わっています）。能力は「体力・力・魔力・技・速さ・守り」と、心の「闘志・平静・執念」になりました。',
  '戦技と魔法・スキルの5つの枠、施設を建てること、講師を雇うことはなくしました。技は技能のランクが上がると増えます。',
];

function convertStudent(st: Student, r: Rng): void {
  convertStats(st.stats as unknown as Record<string, number>);
  convertStats(st.growth as unknown as Record<string, number>);
  convertStats(st.train as unknown as Record<string, number>);
  convertStats(st.trainGain as unknown as Record<string, number>);
  for (const k of STATS) { st.stats[k] = Math.max(1, Math.round(st.stats[k] ?? 3)); st.growth[k] = Math.round(st.growth[k] ?? 35); }
  st.classId = newClassId(st.classId, st.skills);
  st.mind ??= rollMind(r, st.personality);
  // 信頼の厚い子は平静が高め、仇討ちの誓いのある子は執念が高め
  st.mind.calm = Math.min(95, st.mind.calm + Math.round((st.trust ?? 0) / 10));
  st.lessons ??= [];
  st.spells = [];
  for (const k of ['arts', 'artsOn', 'artsManual', 'artPlan', 'spellPlan', 'mastery', 'evo', 'evoLog', 'recentLearn', 'taught'] as const) delete (st as unknown as Record<string, unknown>)[k];
  st.birthday ??= birthdayFor(st.id + st.given);
  learnTechs(null, st, false);
  st.history ??= [];
  st.recent ??= [];
}

function convertTo19(s: GameState, from: number): void {
  const r = new Rng({ rng: ((s.createdAt ?? 1) ^ 0x19a1) | 0 });
  for (const st of Object.values(s.students ?? {})) convertStudent(st, r);
  for (const st of s.applicants ?? []) convertStudent(st, r);
  // 仇討ちの誓いのある子は、執念が強い
  for (const rv of Object.values(s.rivalries ?? {})) { const st = s.students?.[rv.sid]; if (st?.mind && rv.vow) st.mind.grudge = Math.max(st.mind.grudge, 60); else if (st?.mind && rv.stage >= 2) st.mind.grudge = Math.max(st.mind.grudge, 45); }
  // 施設・講師・策・連携技・札の戦いの案内はなくした
  s.facilities = {};
  s.teachers = [];
  s.teacherCandidates = [];
  s.vice = [];
  const g = s as unknown as Record<string, unknown>;
  for (const k of ['strats', 'combos', 'cardGuide', 'cardGuideSeen', 'autoMemory', 'nemeses', 'carry']) delete g[k];
  // 敵将：兵種・戦い方・覚えていること
  for (const o of s.officers ?? []) {
    o.classId = newClassId(o.classId);
    ensureOfficerCombat(o);
    const m = memoryOf(o);
    for (const mt of o.meets ?? []) {
      if (mt.result === 'fled') for (const id of (mt.foes ?? []).slice(0, 1)) if (!m.beatenBy.includes(id)) m.beatenBy.push(id);
      if (mt.note?.startsWith('scar:')) { const id = mt.note.slice(5); m.woundedBy.push({ id, text: '古い傷', year: mt.year }); (o.wounds ??= []).push({ text: '古い傷', year: mt.year, by: id }); }
    }
    o.intel ??= Math.min(2, (o.meets ?? []).length) + Math.min(1, (o.knownTraits ?? []).length);
  }
  // 途中の戦い：はじめからやり直す（依頼を選ぶところへ）
  const hadBattle = !!s.battle || !!s.sortie;
  s.battle = null;
  s.sortie = null;
  s.today = null;
  const DROP = new Set(['evolve', 'newStrat', 'teacherHire', 'sortieResult', 'art']);
  s.pending = (s.pending ?? []).filter((p) => !DROP.has((p as { type: string }).type)) as Pending[];
  if (hadBattle && !s.pending.some((p) => p.type === 'questBoard')) s.pending.push({ type: 'questBoard' });
  s.items ??= { vulnerary: 0, elixir: 0 };
  // 足りないものをそろえる（古い版ほど足りない）
  s.rivalries ??= {};
  s.officers ??= [];
  try { ensureRosters(s, r); linkOrg(s); if (!s.orgSeen) markOrgSeen(s); } catch { /* 名簿が作れなくても先へ */ }
  try { ensureRegions(s); yearlyRulers(s, r, []); } catch { /* */ }
  try { if (!s.newsDesk) startNewsDesk(s); } catch { /* */ }
  try { ensureLegends(s); } catch { /* */ }
  try { if (!s.reviews) rebuildReviews(s); } catch { /* */ }
  s.oldSave = from;
  s.pending.unshift({ type: 'event', title: '大きく作り直しました', lines: NIGHT19_LINES });
}
