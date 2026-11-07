// ブラウザ内の保存（IndexedDB、使えなければ localStorage）
import type { GameState } from '../core/state';
import { serialize, deserialize } from '../core/save';

const DB = 'rimina-academy';
const STORE = 'saves';

function openDb(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    try {
      if (typeof indexedDB === 'undefined') return resolve(null);
      const req = indexedDB.open(DB, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch { resolve(null); }
  });
}

async function put(key: string, value: string): Promise<void> {
  const db = await openDb();
  if (!db) { try { localStorage.setItem(`${DB}:${key}`, value); } catch { /* 保存できない */ } return; }
  await new Promise<void>((res) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(value, key);
    tx.oncomplete = () => res(); tx.onerror = () => res();
  });
}
async function get(key: string): Promise<string | null> {
  const db = await openDb();
  if (!db) { try { return localStorage.getItem(`${DB}:${key}`); } catch { return null; } }
  return new Promise((res) => {
    const tx = db.transaction(STORE, 'readonly');
    const r = tx.objectStore(STORE).get(key);
    r.onsuccess = () => res((r.result as string) ?? null); r.onerror = () => res(null);
  });
}
async function del(key: string): Promise<void> {
  const db = await openDb();
  if (!db) { try { localStorage.removeItem(`${DB}:${key}`); } catch { /* */ } return; }
  await new Promise<void>((res) => { const tx = db.transaction(STORE, 'readwrite'); tx.objectStore(STORE).delete(key); tx.oncomplete = () => res(); tx.onerror = () => res(); });
}

export interface SlotInfo { slot: number; exists: boolean; label: string; savedAt: number }

export async function saveSlot(s: GameState): Promise<void> {
  const text = serialize(s);
  await put(`slot${s.slot}`, text);
  await put(`meta${s.slot}`, JSON.stringify({ label: `${s.instructor.name}教官 ${s.year}年目 ${['4', '5', '6', '7', '8', '9', '10', '11', '12', '1', '2', '3'][s.month]}月 第${s.week}週`, savedAt: Date.now() }));
  await put('last', String(s.slot));
}
export async function loadSlot(slot: number): Promise<GameState | null> {
  const t = await get(`slot${slot}`);
  if (!t) return null;
  try { const s = deserialize(t); s.slot = slot; return s; } catch { return null; }
}
export async function deleteSlot(slot: number): Promise<void> { await del(`slot${slot}`); await del(`meta${slot}`); }
export async function slotInfos(): Promise<SlotInfo[]> {
  const out: SlotInfo[] = [];
  for (let i = 0; i < 3; i++) {
    const m = await get(`meta${i}`);
    if (m) { try { const j = JSON.parse(m); out.push({ slot: i, exists: true, label: j.label, savedAt: j.savedAt }); continue; } catch { /* */ } }
    out.push({ slot: i, exists: false, label: '空き', savedAt: 0 });
  }
  return out;
}
export async function lastSlot(): Promise<number | null> { const v = await get('last'); return v === null ? null : Number(v); }

export function exportFile(s: GameState): void {
  s.lastExport = Date.now();
  const blob = new Blob([serialize(s)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `rimina-save-${s.year}年目-${Date.now()}.json`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 3000);
}
export function importFile(file: File): Promise<GameState> {
  return file.text().then((t) => deserialize(t));
}
