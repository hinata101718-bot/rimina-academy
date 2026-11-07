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
export function playBgm(name: 'peace' | 'tension' | 'war' | 'battle') {
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
