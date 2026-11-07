// セーブデータの変換（バージョン番号つき）。DOMに依存しない
import { SAVE_VERSION } from '../data/balance';
import type { GameState } from './state';
import { defaultSettings } from './game';
import { WEAPONS } from '../data/weapons';
import { ensureSpellPlan, learnSpells } from './spells';
import { ensureTeacherSince, instructorCaps } from './instructor';
import { birthdayFor } from './student';

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
  if (from < 2) migrateTo2(s, oldSettings as Partial<GameState['settings']>);
  if (from < 3) migrateTo3(s);
  s.heirs ??= [];
  s.archive ??= {};
  s.notices ??= [];
  s.version = SAVE_VERSION;
  return s;
}

/**
 * 1夜目の版（version 1）→ 2夜目の版（version 2）
 * - 魔法は技能ランクで覚える形に：武器庫の魔道書・杖は売ったことにしてお金に換える（購入価格の半額）
 * - 生徒全員に「覚える魔法の一覧」を作り、今の技能ランクまでの魔法を覚えさせる
 * - 演出の設定を足す（敵ターンは「ゆっくり」に）
 */
function migrateTo2(s: GameState, old: Partial<GameState['settings']>): void {
  if (old.animSpeed === undefined) s.settings.animSpeed = 2;
  if (old.flip === undefined) s.settings.flip = true;
  s.settings.enemySpeed = 1;
  // 武器庫の魔法を売る
  let total = 0;
  const sold: Record<string, number> = {};
  s.armory = (s.armory ?? []).filter((a) => {
    const w = WEAPONS[a.weaponId];
    if (!w) return false;
    if (!w.spell) return true;
    const v = Math.floor((w.value ?? w.price ?? 0) / 2);
    total += v;
    sold[w.name] = (sold[w.name] ?? 0) + 1;
    return false;
  });
  s.money = Math.round((s.money ?? 0) + total);
  // 生徒の魔法
  for (const st of Object.values(s.students ?? {})) {
    st.spells ??= [];
    ensureSpellPlan(st);
    learnSpells(null, st);
  }
  for (const st of s.applicants ?? []) { st.spells ??= []; ensureSpellPlan(st); learnSpells(null, st); }
  // 出撃中の戦闘：持っている魔道書・杖はそのまま使える（同じ名前の魔法として扱う）
  const soldText = Object.entries(sold).map(([n, c]) => `${n}×${c}`).join('・');
  s.pending ??= [];
  s.pending.push({
    type: 'event', title: '魔法の覚え方が変わりました',
    lines: [
      '魔法（魔道）と回復の杖（信仰）は、買うのではなく、生徒が技能ランクを上げたときに覚えるようになりました。',
      soldText ? `武器庫にあった ${soldText} は売り払い、${total}G になりました。` : '武器庫に魔道書・杖はありませんでした。',
      '生徒たちは、今の技能ランクまでの魔法をすでに覚えています。個人ページで「覚えた魔法」と「次に覚える魔法」を見られます。',
    ],
  });
}

/**
 * 2夜目の版（version 2）→ 3夜目の版（version 3）
 * - 教官：着任の年・技能の上限（教えるほど上がる）・歴代の教官・副教官を足す
 * - 講師：学校に来た年（副教官になれるか）を卒業の年から推定
 * - 生徒：誕生日を付ける（在校生・卒業生・志願者すべて）
 * - 兵種：条件より低いレベルですでに昇格している子は、そのまま（降格しない）
 */
function migrateTo3(s: GameState): void {
  s.instructor.since ??= 1;
  s.instructor.generation ??= 1;
  instructorCaps(s);
  s.pastInstructors ??= [];
  s.vice ??= [];
  s.declinedSuccessors ??= [];
  ensureTeacherSince(s);
  for (const st of [...Object.values(s.students ?? {}), ...(s.applicants ?? [])]) st.birthday ??= birthdayFor(st.id + st.given);
  s.settings.rosterView ??= 'card';
}
