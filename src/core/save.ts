// セーブデータの変換（バージョン番号つき）。DOMに依存しない
import { SAVE_VERSION } from '../data/balance';
import type { GameState } from './state';
import { defaultSettings } from './game';

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
  // 将来の形式変更はここに書く（from < 2 なら … のように）
  if (from > SAVE_VERSION) throw new Error('新しい版のセーブデータです。ページを再読み込みしてください');
  s.settings = { ...defaultSettings(), ...(s.settings ?? {}) };
  s.heirs ??= [];
  s.notices ??= [];
  s.version = SAVE_VERSION;
  return s;
}
