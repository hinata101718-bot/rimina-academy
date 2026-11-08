import type { GameState } from '../core/state';
import { useStore, act, setGame, emit } from './store';
import { exportFile, saveSlot } from './storage';
import { DIFFICULTY, type Difficulty } from '../data/balance';
import { sfx } from './sound';
import { autoWeek } from '../core/autoplay';

export function SettingsTab() {
  const { s } = useStore();
  if (!s) return null;
  const set = (fn: (x: GameState["settings"]) => void) => act((g) => fn(g.settings));
  const days = Math.floor((Date.now() - s.lastExport) / 86400000);
  return (
    <div>
      <h2>設定</h2>
      <div class="card">
        <h3>セーブ</h3>
        <div class="muted small">毎週の終わりと、戦闘中は毎ターン、自動で保存されます（セーブ枠{s.slot + 1}）。最後の書き出しから{days}日。</div>
        <div class="row" style={{ marginTop: 6 }}>
          <button class="btn" onClick={() => { exportFile(s); emit(); saveSlot(s); }}>ファイルに書き出す</button>
          <button class="btn ghost" onClick={async () => { await saveSlot(s); setGame(null); }}>タイトルに戻る</button>
        </div>
        <div class="muted small">書き出したファイルは、タイトル画面の「書き出したファイルを読み込む」で元に戻せます（スマホ⇔パソコンの移動にも）。</div>
      </div>
      <div class="card">
        <h3>難易度</h3>
        <div class="seg">
          {(['easy', 'normal', 'hard'] as Difficulty[]).map((d) => <button class={s.settings.difficulty === d ? 'on' : ''} onClick={() => set((x) => { x.difficulty = d; x.mods = { ...DIFFICULTY[d] }; })}>{{ easy: 'やさしい', normal: 'ふつう', hard: 'むずかしい' }[d]}</button>)}
        </div>
        <details style={{ marginTop: 6 }}><summary class="muted">細かな調整（倍率）</summary>
          {([['enemy', '敵の強さ'], ['exp', '経験値の入り方'], ['skill', '技能の伸び方'], ['money', 'お金の入り方'], ['death', '戦死の確率'], ['reveal', '才能が分かる速さ'], ['war', '戦争の進む速さ']] as const).map(([k, label]) => (
            <div class="row between"><span>{label}</span>
              <span class="row"><input type="range" min="0.5" max="1.5" step="0.05" value={s.settings.mods[k] ?? 1} onInput={(e) => set((x) => { x.mods[k] = Number((e.target as HTMLInputElement).value); })} /><span style={{ width: 40 }}>×{(s.settings.mods[k] ?? 1).toFixed(2)}</span></span>
            </div>
          ))}
        </details>
      </div>
      <div class="card">
        <h3>戦闘</h3>
        <label class="row between nowrap ab-manual"><span>戦闘を自分で指揮する</span><input type="checkbox" checked={s.settings.manualBattle} onChange={(e) => set((x) => { x.manualBattle = (e.target as HTMLInputElement).checked; })} /></label>
        <div class="muted small">オフ（はじめの設定）：出撃メンバー・作戦・役割を決めると自動で決着し、戦いの様子を場面で見せます。オン：マスを動かして自分で指揮します。オフのままでも、出撃前に「この戦いは自分で指揮する」を選べます。</div>
      </div>
      <div class="card">
        <h3>表示・演出</h3>
        <div class="row between"><span>名簿の顔</span><div class="seg"><button class={s.settings.portrait === 'face' ? 'on' : ''} onClick={() => set((x) => { x.portrait = 'face'; })}>似顔絵</button><button class={s.settings.portrait === 'dot' ? 'on' : ''} onClick={() => set((x) => { x.portrait = 'dot'; })}>色の丸</button></div></div>
        <div class="row between" style={{ marginTop: 6 }}><span>カットイン</span><div class="seg">{(['all', 'important', 'off'] as const).map((c) => <button class={s.settings.cutin === c ? 'on' : ''} onClick={() => set((x) => { x.cutin = c; })}>{{ all: '毎回', important: '大事な時', off: 'なし' }[c]}</button>)}</div></div>
        <div class="row between" style={{ marginTop: 6 }}><span>演出の速さ</span><div class="seg">{([1, 2, 3] as const).map((c) => <button class={s.settings.animSpeed === c ? 'on' : ''} onClick={() => set((x) => { x.animSpeed = c; })}>{{ 1: 'ゆっくり', 2: 'ふつう', 3: 'はやい' }[c]}</button>)}</div></div>
        <div class="muted small">HPゲージ・経験値・レベルアップ・会話の文字送りの速さです。演出中は画面をタップすると早送りできます。</div>
        <div class="row between" style={{ marginTop: 6 }}><span>週が進むときの日めくり</span><input type="checkbox" checked={s.settings.flip} onChange={(e) => set((x) => { x.flip = (e.target as HTMLInputElement).checked; })} /></div>
        <div class="row between" style={{ marginTop: 6 }}><span>敵ターンの速さ</span><div class="seg">{([1, 2, 3] as const).map((c) => <button class={s.settings.enemySpeed === c ? 'on' : ''} onClick={() => set((x) => { x.enemySpeed = c; })}>{{ 1: 'ゆっくり', 2: 'ふつう', 3: 'はやい' }[c]}</button>)}</div></div>
        <div class="row between" style={{ marginTop: 6 }}><span>巻き戻し（1戦闘3回）</span><input type="checkbox" checked={s.settings.rewind} onChange={(e) => set((x) => { x.rewind = (e.target as HTMLInputElement).checked; })} /></div>
        <div class="row between" style={{ marginTop: 6 }}><span>最初の月の案内</span><input type="checkbox" checked={s.settings.guide} onChange={(e) => set((x) => { x.guide = (e.target as HTMLInputElement).checked; })} /></div>
      </div>
      <div class="card">
        <h3>音</h3>
        <div class="row between"><span>効果音</span><input type="checkbox" checked={s.settings.sound} onChange={(e) => set((x) => { x.sound = (e.target as HTMLInputElement).checked; })} /></div>
        <div class="row between"><span>音量</span><input type="range" min="0" max="1" step="0.1" value={s.settings.volume} onInput={(e) => set((x) => { x.volume = Number((e.target as HTMLInputElement).value); })} /></div>
        <button class="btn ghost small" onClick={() => sfx('level')}>試しに鳴らす</button>
      </div>
      <details class="card"><summary class="muted">テスト用</summary>
        <div class="muted small">自動で進めます（戦闘も自動、進路は本人の希望どおり）。動作確認のための機能です。</div>
        <div class="row" style={{ marginTop: 6 }}>
          <button class="btn small" onClick={() => act((g) => { const m = g.month, y = g.year; let k = 0; while (g.month === m && g.year === y && k++ < 10) autoWeek(g); })}>1ヶ月進める</button>
          <button class="btn small" onClick={() => act((g) => { const y = g.year; let k = 0; while (g.year === y && k++ < 60) autoWeek(g); })}>1年進める</button>
        </div>
      </details>
      <div class="muted small" style={{ textAlign: 'center' }}>辺境士官学校 ―戦争が終わる日まで― 5夜目の版</div>
    </div>
  );
}
