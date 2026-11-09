// 効果音（Web Audio で合成）。BGMは public/bgm/ にファイルがあれば流す
import { getGame } from './store';

let ctx: AudioContext | null = null;
export function unlockAudio() {
  try {
    if (!ctx) ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
  } catch { ctx = null; }
}

type Note = [freq: number, start: number, dur: number, type?: OscillatorType, gain?: number];
const SOUNDS: Record<string, Note[]> = {
  ok: [[880, 0, 0.06, 'square', 0.12], [1320, 0.05, 0.08, 'square', 0.1]],
  cancel: [[440, 0, 0.08, 'square', 0.1], [330, 0.06, 0.1, 'square', 0.08]],
  move: [[600, 0, 0.04, 'triangle', 0.15]],
  hit: [[200, 0, 0.08, 'sawtooth', 0.2], [120, 0.04, 0.1, 'sawtooth', 0.15]],
  // 9夜目：武器ごとの効果音
  sword: [[1400, 0, 0.05, 'sawtooth', 0.12], [700, 0.03, 0.08, 'sawtooth', 0.14], [180, 0.06, 0.08, 'square', 0.12]],
  lance: [[500, 0, 0.04, 'square', 0.12], [900, 0.03, 0.05, 'square', 0.12], [150, 0.07, 0.1, 'sawtooth', 0.16]],
  axe: [[90, 0, 0.14, 'sawtooth', 0.26], [60, 0.05, 0.2, 'square', 0.18], [300, 0, 0.04, 'square', 0.1]],
  bow: [[1800, 0, 0.09, 'sine', 0.08], [1200, 0.06, 0.06, 'sine', 0.08], [220, 0.14, 0.06, 'square', 0.12]],
  magic: [[600, 0, 0.12, 'triangle', 0.14], [900, 0.06, 0.12, 'triangle', 0.12], [1350, 0.12, 0.16, 'sine', 0.1]],
  holy: [[1046, 0, 0.12, 'sine', 0.12], [1568, 0.08, 0.18, 'sine', 0.1], [2093, 0.16, 0.2, 'sine', 0.06]],
  gun: [[80, 0, 0.12, 'square', 0.3], [2400, 0, 0.03, 'square', 0.12], [60, 0.05, 0.2, 'sawtooth', 0.18]],
  cutin: [[220, 0, 0.12, 'sawtooth', 0.2], [440, 0.1, 0.12, 'sawtooth', 0.2], [880, 0.2, 0.25, 'square', 0.16], [110, 0, 0.5, 'sine', 0.16]],
  stamp: [[120, 0, 0.12, 'square', 0.28], [70, 0.06, 0.25, 'sawtooth', 0.2]],
  vs: [[330, 0, 0.15, 'sawtooth', 0.18], [494, 0.15, 0.15, 'sawtooth', 0.18], [659, 0.3, 0.4, 'square', 0.16], [2600, 0.3, 0.05, 'square', 0.1], [2200, 0.38, 0.05, 'square', 0.1]],
  fall: [[262, 0, 0.6, 'sine', 0.12], [196, 0.5, 1.0, 'sine', 0.1]],
  miss: [[900, 0, 0.05, 'sine', 0.1], [700, 0.05, 0.07, 'sine', 0.08]],
  crit: [[300, 0, 0.06, 'sawtooth', 0.25], [600, 0.05, 0.06, 'sawtooth', 0.22], [1200, 0.1, 0.15, 'square', 0.15]],
  kill: [[400, 0, 0.1, 'square', 0.15], [200, 0.08, 0.2, 'square', 0.12], [100, 0.2, 0.25, 'sawtooth', 0.1]],
  level: [[523, 0, 0.1, 'triangle', 0.2], [659, 0.1, 0.1, 'triangle', 0.2], [784, 0.2, 0.1, 'triangle', 0.2], [1046, 0.3, 0.25, 'triangle', 0.2]],
  pass: [[523, 0, 0.12, 'square', 0.12], [784, 0.12, 0.12, 'square', 0.12], [1046, 0.24, 0.3, 'square', 0.14]],
  graduation: [[392, 0, 0.3, 'triangle', 0.2], [523, 0.3, 0.3, 'triangle', 0.2], [659, 0.6, 0.3, 'triangle', 0.2], [784, 0.9, 0.6, 'triangle', 0.2]],
  sad: [[330, 0, 0.5, 'sine', 0.15], [262, 0.45, 0.8, 'sine', 0.12]],
  heal: [[700, 0, 0.1, 'sine', 0.15], [1000, 0.08, 0.15, 'sine', 0.12]],
  tick: [[1568, 0, 0.06, 'square', 0.1], [2093, 0.04, 0.08, 'square', 0.08]],
  page: [[300, 0, 0.05, 'triangle', 0.1], [500, 0.03, 0.06, 'triangle', 0.06]],
  text: [[1200, 0, 0.02, 'square', 0.03]],
  // 19夜目：新しい戦いの効果音（ゲームの中で作る。設定の「効果音」で切れる）
  weak: [[880, 0, 0.05, 'square', 0.12], [1320, 0.04, 0.08, 'triangle', 0.14]],
  shield: [[2400, 0, 0.03, 'square', 0.1], [1800, 0.02, 0.06, 'triangle', 0.14], [3200, 0.05, 0.05, 'sine', 0.08]],
  break: [[180, 0, 0.18, 'sawtooth', 0.28], [90, 0.06, 0.3, 'square', 0.2], [2600, 0, 0.05, 'square', 0.12], [1900, 0.08, 0.08, 'square', 0.1], [1400, 0.16, 0.12, 'triangle', 0.12]],
  nemesis: [[110, 0, 0.5, 'sawtooth', 0.16], [116, 0, 0.5, 'sawtooth', 0.12], [220, 0.35, 0.4, 'square', 0.1], [207, 0.7, 0.6, 'sawtooth', 0.12]],
  // エンディングの調べ（BGMのファイルがなくても流れる短いメロディ）
  ending: [[392, 0, 0.45, 'triangle', 0.16], [523, 0.45, 0.45, 'triangle', 0.16], [587, 0.9, 0.45, 'triangle', 0.16], [659, 1.35, 0.9, 'triangle', 0.16],
    [523, 2.3, 0.45, 'triangle', 0.14], [587, 2.75, 0.45, 'triangle', 0.14], [784, 3.2, 1.4, 'triangle', 0.16], [262, 0, 1.3, 'sine', 0.08], [330, 1.35, 1.3, 'sine', 0.08], [392, 3.2, 1.6, 'sine', 0.08]],
};

export function sfx(name: keyof typeof SOUNDS | string) {
  const g = getGame();
  if (g && !g.settings.sound) return;
  if (!ctx) return;
  const vol = g?.settings.volume ?? 0.6;
  const notes = SOUNDS[name];
  if (!notes) return;
  const t0 = ctx.currentTime;
  for (const [f, st, d, type = 'sine', gain = 0.15] of notes) {
    const o = ctx.createOscillator();
    const gn = ctx.createGain();
    o.type = type; o.frequency.value = f;
    gn.gain.setValueAtTime(gain * vol, t0 + st);
    gn.gain.exponentialRampToValueAtTime(0.0001, t0 + st + d);
    o.connect(gn).connect(ctx.destination);
    o.start(t0 + st); o.stop(t0 + st + d + 0.02);
  }
}

let bgm: HTMLAudioElement | null = null;
let bgmName = '';
export function playBgm(name: 'peace' | 'tension' | 'war' | 'battle' | 'ending') {
  const g = getGame();
  if (!g?.settings.sound) { bgm?.pause(); return; }
  if (bgmName === name) return;
  bgmName = name;
  try {
    bgm?.pause();
    const a = new Audio(`${import.meta.env.BASE_URL}bgm/${name}.mp3`);
    a.loop = true; a.volume = (g.settings.volume ?? 0.6) * 0.5;
    a.play().catch(() => undefined); // ファイルがなければ何もしない
    a.onerror = () => undefined;
    bgm = a;
  } catch { /* */ }
}
