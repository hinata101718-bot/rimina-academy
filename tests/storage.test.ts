import 'fake-indexeddb/auto';
import { describe, it, expect } from 'vitest';
import { newGame } from '../src/core/game';
import { saveSlot, loadSlot, slotInfos, deleteSlot } from '../src/ui/storage';

describe('ブラウザ内のセーブ（IndexedDB）', () => {
  it('3つの枠に保存・読み込み・削除できる', async () => {
    for (let i = 0; i < 3; i++) { const s = newGame({ name: `教官${i}`, background: 'wanderer', seed: i + 1, slot: i }); await saveSlot(s); }
    const infos = await slotInfos();
    expect(infos.every((x) => x.exists)).toBe(true);
    const g = await loadSlot(1);
    expect(g?.instructor.name).toBe('教官1');
    await deleteSlot(2);
    expect((await slotInfos())[2].exists).toBe(false);
  });
});
