import { useState } from 'preact/hooks';
import { encodeTransfer } from '../core/transfer';
import { PROSE_NAMES } from '../data/warprose';
import { FX_NAMES } from '../data/battlefx';
import type { GameState } from '../core/state';
import { useStore, act, setGame, emit } from './store';
import { exportFile, saveSlot } from './storage';
import { DIFFICULTY, type Difficulty } from '../data/balance';
import { sfx } from './sound';
import { autoWeek } from '../core/autoplay';
import { replayGuide } from '../core/tutorial';

export function SettingsTab() {
  const { s } = useStore();
  if (!s) return null;
  const set = (fn: (x: GameState["settings"]) => void) => act((g) => fn(g.settings));
  const days = Math.floor((Date.now() - s.lastExport) / 86400000);
  return <SettingsBody s={s} set={set} days={days} />;
}

function SettingsBody({ s, set, days }: { s: GameState; set: (fn: (x: GameState['settings']) => void) => void; days: number }) {
  const [msg, setMsg] = useState('');
  const [code, setCode] = useState('');
  return (
    <div>
      <h2>設定</h2>
      <div class="card">
        <h3>セーブ</h3>
        <div class="muted small">毎週の終わりと、戦闘中は毎ターン、自動で保存されます（セーブ枠{s.slot + 1}）。最後の書き出しから{days}日。</div>
        <div class="row" style={{ marginTop: 6 }}>
          <button class="btn" onClick={() => { exportFile(s).then((r) => { setMsg(r === 'shared' ? '共有の画面から保存しました。' : r === 'downloaded' ? 'ファイルを書き出しました。' : '書き出しをやめました。'); emit(); saveSlot(s); }); }}>ファイルに書き出す</button>
          <button class="btn ghost" onClick={async () => { await saveSlot(s); setGame(null); }}>タイトルに戻る</button>
        </div>
        {msg && <div class="small">{msg}</div>}
        <div class="muted small">iPhoneでは共有の画面が開きます。「"ファイル"に保存」を選ぶと、ファイルのアプリに残せます。書き出したファイルは、タイトル画面の「書き出したファイルを読み込む」で元に戻せます。</div>
        <div class="small" style={{ marginTop: 10 }}><b>引き継ぎの文字</b></div>
        <div class="muted small">セーブを長い文字にして、コピーできます。別の端末のタイトル画面で「引き継ぎの文字を貼りつける」を押して、貼りつけると続きから遊べます。</div>
        {!code ? <button class="btn ghost" style={{ marginTop: 4 }} onClick={() => { setMsg(''); encodeTransfer(s).then(setCode); }}>引き継ぎの文字を作る</button> : <>
          <textarea class="transfer-box" readOnly value={code} onFocus={(e) => (e.target as HTMLTextAreaElement).select()} />
          <div class="row between nowrap"><span class="small muted">{code.length.toLocaleString()}文字</span><span class="row nowrap gap6">
            <button class="btn small" onClick={() => { const done = () => setMsg('コピーしました。メモやメッセージに貼りつけて、別の端末へ送ってください。'); const fail = () => setMsg('コピーできませんでした。上の文字を長押しして、すべて選択してからコピーしてください。'); try { navigator.clipboard ? navigator.clipboard.writeText(code).then(done, fail) : fail(); } catch { fail(); } }}>コピーする</button>
            <button class="btn ghost small" onClick={() => setCode('')}>閉じる</button></span></div>
        </>}
      </div>
      <div class="card">
        <h3>難易度</h3>
        <div class="seg">
          {(['easy', 'normal', 'hard'] as Difficulty[]).map((d) => <button class={s.settings.difficulty === d ? 'on' : ''} onClick={() => set((x) => { x.difficulty = d; x.mods = { ...DIFFICULTY[d] }; })}>{{ easy: 'やさしい', normal: 'ふつう', hard: 'むずかしい' }[d]}</button>)}
        </div>
        <details style={{ marginTop: 6 }}><summary class="muted">細かな調整（倍率）</summary>
          {([['enemy', '敵の強さ'], ['exp', '経験値の入り方'], ['skill', '技能の伸び方'], ['money', 'お金の入り方'], ['death', '戦死の確率'], ['reveal', '芽が見える速さ'], ['war', '戦争の進む速さ']] as const).map(([k, label]) => (
            <div class="row between"><span>{label}</span>
              <span class="row"><input type="range" min="0.5" max="1.5" step="0.05" value={s.settings.mods[k] ?? 1} onInput={(e) => set((x) => { x.mods[k] = Number((e.target as HTMLInputElement).value); })} /><span style={{ width: 40 }}>×{(s.settings.mods[k] ?? 1).toFixed(2)}</span></span>
            </div>
          ))}
        </details>
      </div>
      <div class="card">
        <h3>戦闘</h3>
        <div class="muted small">戦いは「札の戦い」です。授業で覚えた戦技・魔法・スキルと先生の策が札になり、毎ターン手札から行動力の分だけ出します（16夜目）。</div>
        <div class="small" style={{ marginTop: 8 }}><b>戦闘の演出</b></div>
        <div class="seg" style={{ marginTop: 4 }}>{(['big', 'normal', 'low'] as const).map((v) => <button class={(s.settings.battleFx ?? 'big') === v ? 'on' : ''} onClick={() => set((x) => { x.battleFx = v; })}>{FX_NAMES[v]}</button>)}</div>
        <div class="small" style={{ marginTop: 8 }}>戦の描写：戦いの文で、傷や死をどこまで書くかを選べます</div>
        <div class="seg" style={{ marginTop: 4 }}>{(['normal', 'dense', 'brutal'] as const).map((v) => <button class={(s.settings.battleProse ?? 'dense') === v ? 'on' : ''} onClick={() => { if (v === 'brutal' && !s.settings.proseAsked && !confirm('むごい描写が増えます（斬り落とされる手足や血しぶきなど）。よろしいですか？')) return; set((x) => { x.battleProse = v; if (v === 'brutal') x.proseAsked = true; }); }}>{PROSE_NAMES[v]}</button>)}</div>
        <div class="muted small">派手：必殺・開花の技・伝説の武器のカットイン、撃破の判、宿命の対決の画面。ふつう：見せ場を短く。控えめ：顔の札と文だけ。どれもタップで早送りできます。</div>
      </div>
      <div class="card">
        <h3>表示・演出</h3>
        <div class="row between"><span>名簿の顔</span><div class="seg"><button class={s.settings.portrait === 'face' ? 'on' : ''} onClick={() => set((x) => { x.portrait = 'face'; })}>似顔絵</button><button class={s.settings.portrait === 'dot' ? 'on' : ''} onClick={() => set((x) => { x.portrait = 'dot'; })}>色の丸</button></div></div>
        <div class="row between" style={{ marginTop: 6 }}><span>演出の速さ</span><div class="seg">{([1, 2, 3] as const).map((c) => <button class={s.settings.animSpeed === c ? 'on' : ''} onClick={() => set((x) => { x.animSpeed = c; })}>{{ 1: 'ゆっくり', 2: 'ふつう', 3: 'はやい' }[c]}</button>)}</div></div>
        <div class="muted small">HPゲージ・経験値・レベルアップ・会話の文字送りの速さです。演出中は画面をタップすると早送りできます。</div>
        <div class="row between" style={{ marginTop: 6 }}><span>週が進むときの日めくり</span><input type="checkbox" checked={s.settings.flip} onChange={(e) => set((x) => { x.flip = (e.target as HTMLInputElement).checked; })} /></div>
        <div class="row between nowrap" style={{ marginTop: 8 }}><span class="grow">管理人の案内{s.tutorial && !s.tutorial.off ? '（いま出ます）' : '（いまは出ません）'}</span><button class="btn small" onClick={() => { sfx('ok'); act((g) => replayGuide(g)); alert('はじめて出たものの説明を、もう一度出すようにしました。ホームの机の案内も、もう一度見られます。'); }}>案内を見なおす</button></div>
        <div class="muted small">はじめて見るもの（兵種試験・支援C・伝説の武器など）が出たとき、管理人が短く説明します。</div>
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
      <div class="muted small" style={{ textAlign: 'center' }}>辺境士官学校 ―戦争が終わる日まで― 15夜目の版</div>
    </div>
  );
}
