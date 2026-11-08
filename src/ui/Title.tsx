import { useEffect, useState } from 'preact/hooks';
import { slotInfos, loadSlot, deleteSlot, importFile, type SlotInfo } from './storage';
import { setGame } from './store';
import { newGame, type StartKind } from '../core/game';
import { startsUnlocked } from './storage';
import { B } from '../data/balance';
import { makeSeed } from '../core/rng';
import { BACKGROUNDS } from '../data/people';
import { sfx, unlockAudio } from './sound';
import { Portrait } from './Portrait';
import type { GameState } from '../core/state';
import { skipTutorial } from '../core/tutorial';
import { decodeTransfer } from '../core/transfer';

function isStandalone(): boolean {
  return (window.matchMedia?.('(display-mode: standalone)').matches) || (navigator as unknown as { standalone?: boolean }).standalone === true;
}
function isIos(): boolean { return /iPhone|iPad|iPod/.test(navigator.userAgent); }

export function Title() {
  const [slots, setSlots] = useState<SlotInfo[]>([]);
  const [mode, setMode] = useState<'title' | 'new'>('title');
  const [slot, setSlot] = useState(0);
  const [paste, setPaste] = useState(false);
  const [pasted, setPasted] = useState('');
  const refresh = () => slotInfos().then(setSlots);
  useEffect(() => { refresh(); }, []);
  if (mode === 'new') return <Opening slot={slot} onCancel={() => setMode('title')} />;
  return (
    <div class="app"><div class="title-screen">
      <div class="muted">リンデルガ大陸・三国の国境</div>
      <h1>辺境士官学校</h1>
      <div class="serif">―戦争が終わる日まで―</div>
      {!isStandalone() && (
        <div class="guide" style={{ textAlign: 'left', marginTop: 16 }}>
          {isIos() ? 'ホーム画面に置くと、アプリのように遊べて、セーブも消えにくくなります。Safariの共有ボタン（□に↑）から「ホーム画面に追加」を選んでください。' : 'ホーム画面に置くと、遊びやすくなります。ブラウザのメニューから「ホーム画面に追加」を選んでください。'}
        </div>
      )}
      <div style={{ marginTop: 20, textAlign: 'left' }}>
        {slots.map((sl) => (
          <div class="card">
            <div class="row between">
              <div class="grow"><b>セーブ枠 {sl.slot + 1}</b><div class="muted">{sl.label}</div></div>
              {sl.exists ? (
                <div class="row">
                  <button class="btn primary" onClick={async () => { unlockAudio(); sfx('ok'); const g = await loadSlot(sl.slot); if (g) setGame(g); else alert('読み込めませんでした'); }}>続きから</button>
                  <button class="btn ghost small" onClick={async () => { if (confirm(`セーブ枠${sl.slot + 1}を消しますか？　消すと元に戻せません。`)) { await deleteSlot(sl.slot); refresh(); } }}>消す</button>
                </div>
              ) : (
                <button class="btn" onClick={() => { unlockAudio(); sfx('ok'); setSlot(sl.slot); setMode('new'); }}>はじめから</button>
              )}
            </div>
          </div>
        ))}
        <label class="btn ghost block" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 10 }}>
          書き出したファイルを読み込む
          <input type="file" accept=".json,application/json,text/plain" style={{ display: 'none' }} onChange={async (e) => {
            const f = (e.target as HTMLInputElement).files?.[0];
            if (!f) return;
            try {
              const g = await importFile(f);
              const free = slots.find((x) => !x.exists)?.slot ?? 0;
              const target = Number(prompt(`どのセーブ枠に読み込みますか？　1から3の数字を入れてください`, String(free + 1))) - 1;
              if (!(target >= 0 && target <= 2)) return;
              g.slot = target; setGame(g);
            } catch (err) { alert('読み込めませんでした：' + (err as Error).message); }
          }} />
        </label>
        {!paste ? <button class="btn ghost block" style={{ marginTop: 8 }} onClick={() => setPaste(true)}>引き継ぎの文字を貼りつける</button> : (
          <div class="card" style={{ marginTop: 8 }}>
            <div class="small">前の端末の「設定」で作った、RIMINA で始まる文字を貼りつけてください。</div>
            <textarea class="transfer-box" value={pasted} placeholder="ここを長押しして「ペースト」" onInput={(e) => setPasted((e.target as HTMLTextAreaElement).value)} />
            <div class="row nowrap gap6">
              <button class="btn primary grow" disabled={!pasted.trim()} onClick={async () => {
                try {
                  const g = await decodeTransfer(pasted);
                  const free = slots.find((x) => !x.exists)?.slot ?? 0;
                  const target = Number(prompt(`どのセーブ枠に読み込みますか？　1から3の数字を入れてください`, String(free + 1))) - 1;
                  if (!(target >= 0 && target <= 2)) return;
                  g.slot = target; setGame(g);
                } catch (err) { alert('読み込めませんでした：' + (err as Error).message); }
              }}>読み込む</button>
              <button class="btn ghost" onClick={() => { setPaste(false); setPasted(''); }}>やめる</button>
            </div>
          </div>
        )}
      </div>
    </div></div>
  );
}

const OPENING_TEXT = (name: string) => [
  ['', `リンデルガ大陸。かつて一つだった帝国は分かれ、今は三つの国が国境でにらみ合っている。`],
  ['', `北のヴィンターガルト王国、南西のソラリウス帝国、東のフィオレンツァ同盟――。その三つの国境が接する辺境に、古い士官学校がある。`],
  ['', `ソラリウス帝立士官学校 リミナ分校。帝国が一つだった頃に建てられ、今はどの国にも属さない学校だ。`],
  ['管理人', `……おや、あなたが新しい教官の${name}さまですかな。遠いところをよくおいでくださった。わしはこの学校の管理人をしておる者です。`],
  ['', `門は傾き、屋根には穴が開いている。訓練場には草が伸び放題だ。`],
  ['管理人', `ごらんのとおりのありさまでしてな。生徒も、今年はわずかしか集まりませんでした。`],
  ['管理人', `本校からの言づてです。……「どうか、この分校を立て直してほしい。三国のどこにも属さぬ学び舎を、もう一度」と。`],
  ['管理人', `ですが、集まった子たちは、みな目がまっすぐです。どうか、あの子たちをよろしくお願いいたします。`],
];

function Opening({ slot, onCancel }: { slot: number; onCancel: () => void }) {
  const [name, setName] = useState('');
  const [bg, setBg] = useState('knight');
  const [step, setStep] = useState(-1);
  const [debugGrade, setDebugGrade] = useState(1);
  const [start, setStart] = useState<StartKind>('poor');
  const [unlocked, setUnlocked] = useState(false);
  useEffect(() => { startsUnlocked().then(setUnlocked); }, []);
  const [game, setG] = useState<GameState | null>(null);
  if (step === -1) {
    return (
      <div class="app"><div class="content">
        <h1>教官の着任</h1>
        <div class="card">
          <h3>あなたの名前</h3>
          <input type="text" value={name} placeholder="例：アルノルト" maxLength={12} onInput={(e) => setName((e.target as HTMLInputElement).value)} style={{ width: '100%' }} />
        </div>
        <div class="card">
          <h3>経歴</h3>
          {BACKGROUNDS.map((b) => (
            <div class={`card`} style={{ borderColor: bg === b.id ? 'var(--main)' : undefined, borderWidth: bg === b.id ? 2 : 1, cursor: 'pointer' }} onClick={() => { sfx('move'); setBg(b.id); }}>
              <b>{b.name}</b>（{b.age}歳）<div class="muted">{b.desc}</div>
            </div>
          ))}
        </div>
        {unlocked && (
          <div class="card">
            <h3>学校の始まり</h3>
            <div class="seg">{(['poor', 'normal', 'elite'] as StartKind[]).map((k) => <button class={start === k ? 'on' : ''} onClick={() => setStart(k)}>{B.starts[k].name}</button>)}</div>
            <div class="muted small" style={{ marginTop: 4 }}>{start === 'poor' ? '施設はボロボロで、お金も評判もわずかです。名もない分校を、少しずつ立て直していきます。' : start === 'normal' ? `施設はすべて段階${B.starts.normal.facility}、所持金${B.starts.normal.money}G、評判${B.starts.normal.rep}から始まります。` : `施設はすべて段階${B.starts.elite.facility}、所持金${B.starts.elite.money}G、評判${B.starts.elite.rep}から始まります。素質のある子が集まります。`}</div>
          </div>
        )}
        <details class="card"><summary class="muted">テスト用の設定</summary>
          <div class="row" style={{ marginTop: 8 }}>一期生を
            <select value={debugGrade} onChange={(e) => setDebugGrade(Number((e.target as HTMLSelectElement).value))}>
              <option value={1}>1年生</option><option value={2}>2年生</option><option value={3}>3年生</option>
            </select>として始める（卒業式まで早く試すため）
          </div>
        </details>
        <div class="row">
          <button class="btn ghost" onClick={onCancel}>戻る</button>
          <button class="btn primary grow" onClick={() => {
            sfx('ok');
            const g = newGame({ name: name.trim() || 'アルノルト', background: bg, seed: makeSeed(), slot, startGrade: debugGrade, start: unlocked ? start : undefined, tutorial: debugGrade === 1 });
            setG(g); setStep(0);
          }}>着任する</button>
        </div>
      </div></div>
    );
  }
  const lines = OPENING_TEXT(game!.instructor.name);
  if (step < lines.length) {
    const [who, text] = lines[step];
    return (
      <div class="app" onClick={() => { sfx('move'); setStep(step + 1); }} style={{ minHeight: '100vh', cursor: 'pointer' }}><div class="content">
        <div style={{ height: '30vh' }} />
        <div class="card serif" style={{ fontSize: 16, minHeight: 120 }}>
          {who && <div><b>{who}</b></div>}
          {text}
        </div>
        <div class="muted" style={{ textAlign: 'center' }}>（タップすると進みます）</div>
        <div style={{ textAlign: 'center', marginTop: 20 }}><button class="btn ghost small" onClick={(e) => { e.stopPropagation(); setStep(lines.length); }}>読み飛ばす</button></div>
      </div></div>
    );
  }
  const studs = Object.values(game!.students);
  return (
    <div class="app"><div class="content">
      <h2>一期生との対面</h2>
      <div class="card serif">講堂に集まったのは、たった{studs.length}人の生徒たちでした。みんな緊張した顔で、新しい教官を見つめています。</div>
      <div class="card">
        {studs.map((st) => (
          <div class="stu"><Portrait st={st} size={56} game={game!} /><div class="grow"><b>{st.given}</b> <span class="muted">{st.family}</span><div class="muted small">{st.age}歳</div></div></div>
        ))}
      </div>
      <div class="card serif">管理人オズヴァルト「さあ、教官どの。最初のひと月は、わしがおそばで案内いたしましょう。もう慣れておられるなら、案内なしでもかまいませんぞ」</div>
      <button class="btn primary block" onClick={() => { sfx('ok'); setGame(game!); }}>案内を聞いて始める</button>
      {game!.tutorial && <button class="btn ghost block" style={{ marginTop: 8 }} onClick={() => { sfx('ok'); skipTutorial(game!); setGame(game!); }}>案内を飛ばして始める</button>}
    </div></div>
  );
}
