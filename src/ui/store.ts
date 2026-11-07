// 画面側の状態管理：ゲーム状態の保持・再描画・自動保存
import { useEffect, useState } from 'preact/hooks';
import type { GameState } from '../core/state';
import { saveSlot } from './storage';

export interface Route { tab: 'school' | 'students' | 'war' | 'yearbook' | 'settings'; page?: string; id?: string }

let game: GameState | null = null;
let route: Route = { tab: 'school' };
let version = 0;
const listeners = new Set<() => void>();
let saveTimer: ReturnType<typeof setTimeout> | null = null;

export function getGame(): GameState | null { return game; }
export function getRoute(): Route { return route; }
export function setGame(g: GameState | null) { game = g; route = { tab: 'school' }; emit(); if (g) scheduleSave(0); }
export function navigate(r: Route) { route = r; emit(); window.scrollTo?.(0, 0); }
export function emit() { version++; listeners.forEach((l) => l()); }

/** ゲーム状態を変更して再描画（自動保存も） */
export function act(fn: (s: GameState) => void, save = true) {
  if (!game) return;
  try { fn(game); } catch (e) { console.error(e); alert('エラーが起きました：' + (e as Error).message); }
  emit();
  if (save) scheduleSave();
}

export function scheduleSave(delay = 0) {
  if (!game) return;
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => { saveTimer = null; if (game) saveSlot(game).catch(() => undefined); }, delay);
}
export function flushSave() {
  if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; }
  if (game) saveSlot(game).catch(() => undefined);
}
if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', flushSave);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flushSave(); });
}

export function useStore(): { s: GameState | null; route: Route; v: number } {
  const [, set] = useState(0);
  useEffect(() => { const l = () => set((x) => x + 1); listeners.add(l); return () => { listeners.delete(l); }; }, []);
  return { s: game, route, v: version };
}
