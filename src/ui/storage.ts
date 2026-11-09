// ブラウザ内の保存（IndexedDB、使えなければ localStorage）
import type { GameState } from '../core/state';
import { serialize, deserialize } from '../core/save';
import type { HallEntry } from '../core/ending';

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

export interface SlotInfo { slot: number; exists: boolean; label: string; savedAt: number; /** 19夜目：古い版のセーブ（新しく始めるのがおすすめ） */ old?: boolean }

export async function saveSlot(s: GameState): Promise<void> {
  const text = serialize(s);
  await put(`slot${s.slot}`, text);
  await put(`meta${s.slot}`, JSON.stringify({ label: `${s.instructor.name}教官 ${s.year}年目 ${['4', '5', '6', '7', '8', '9', '10', '11', '12', '1', '2', '3'][s.month]}月 第${s.week}週`, savedAt: Date.now(), v: 19, old: s.oldSave ?? null }));
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
    if (m) { try { const j = JSON.parse(m); out.push({ slot: i, exists: true, label: j.label, savedAt: j.savedAt, old: !j.v || j.old != null }); continue; } catch { /* */ } }
    out.push({ slot: i, exists: false, label: '空き', savedAt: 0 });
  }
  return out;
}
export async function lastSlot(): Promise<number | null> { const v = await get('last'); return v === null ? null : Number(v); }

/** 書き出すファイルの名前（iPhone の「ファイル」に保存しやすいよう、英数字だけ） */
function exportName(s: GameState): string {
  const d = new Date(); const p = (n: number) => String(n).padStart(2, '0');
  return `rimina-save-y${s.year}-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}.json`;
}
/** タッチの端末（iPhone・iPad・Android）か */
function touchDevice(): boolean { return typeof navigator !== 'undefined' && ((navigator.maxTouchPoints ?? 0) > 0 || /iPhone|iPad|iPod|Android/.test(navigator.userAgent)); }

/**
 * 14夜目：セーブをファイルに書き出す。
 * iPhone・iPad（Safari・ホーム画面に追加したとき）は、共有の画面を開く（「"ファイル"に保存」を選べる）。
 * ホーム画面に追加したアプリでは、ふつうのダウンロードが動かないことがあるため。
 * 共有の画面が使えない端末では、今までどおりダウンロードする。
 * 押した直後に呼ぶこと（共有の画面は、押した操作の中でしか開けない）
 */
export async function exportFile(s: GameState): Promise<'shared' | 'downloaded' | 'cancel'> {
  const before = s.lastExport;
  s.lastExport = Date.now();
  const text = serialize(s);
  const name = exportName(s);
  const nav = navigator as Navigator & { canShare?: (d: { files: File[] }) => boolean; share?: (d: { files: File[]; title?: string }) => Promise<void> };
  if (touchDevice() && typeof File !== 'undefined' && nav.share && nav.canShare) {
    const file = new File([text], name, { type: 'application/json' });
    if (nav.canShare({ files: [file] })) {
      try { await nav.share({ files: [file], title: '辺境士官学校のセーブ' }); return 'shared'; }
      catch (e) { if ((e as Error).name === 'AbortError') { s.lastExport = before; return 'cancel'; } /* 共有できなければダウンロードへ */ }
    }
  }
  const blob = new Blob([text], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 3000);
  return 'downloaded';
}
export function importFile(file: File): Promise<GameState> {
  return file.text().then((t) => deserialize(t));
}

// ---------- 殿堂（セーブ枠とは別に保存） ----------
export async function loadHall(): Promise<HallEntry[]> {
  const t = await get('hall');
  if (!t) return [];
  try { const j = JSON.parse(t); return Array.isArray(j) ? j : []; } catch { return []; }
}
export async function addHall(e: HallEntry): Promise<void> {
  const list = await loadHall();
  list.push(e);
  await put('hall', JSON.stringify(list.slice(-20)));
}
/** 「ふつう」「名門」スタートが選べるか（エンディングに一度でも届いたら） */
export async function startsUnlocked(): Promise<boolean> { return (await get('unlockStarts')) === '1' || (await loadHall()).length > 0; }
export async function unlockStarts(): Promise<void> { await put('unlockStarts', '1'); }
