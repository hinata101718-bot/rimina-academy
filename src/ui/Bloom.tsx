// 才能開花の演出（10夜目）：苦手の印が割れて金の花に。本人のひとこと、先生の言葉（タップで進む）
import { useEffect, useState } from 'preact/hooks';
import { Portrait } from './Portrait';
import { sfx } from './sound';
import { countryColor } from './cards';
import type { GameState, Pending } from '../core/state';
import { SKILL_NAMES } from '../data/people';
import { ABILITIES } from '../data/abilities';
import { BLOOM_SAY, BLOOM_TEACHER } from '../data/discovery';
import { bloomClasses } from '../core/aptitude';

export function BloomView({ s, p, onDone }: { s: GameState; p: Extract<Pending, { type: 'bloom' }>; onDone: () => void }) {
  const st = s.students[p.studentId];
  const [step, setStep] = useState(0);
  useEffect(() => { const t = setTimeout(() => { setStep(1); sfx('pass'); }, 700); return () => clearTimeout(t); }, []);
  if (!st) { onDone(); return null; }
  const sk = p.skill ? SKILL_NAMES[p.skill] : '';
  const ab = st.bud?.ability ? ABILITIES[st.bud.ability] : null;
  const say = (BLOOM_SAY[st.personality] ?? BLOOM_SAY.serious)[(st.id.length + st.given.length) % 3].replace(/\{k\}/g, sk || '力');
  const teacher = BLOOM_TEACHER[(st.given.length + s.year) % BLOOM_TEACHER.length].replace(/\{a\}/g, st.given).replace(/\{k\}/g, sk || 'その力');
  const cls = p.skill ? bloomClasses(p.skill) : [];
  const next = () => { sfx('ok'); if (step < 3) setStep(Math.max(1, step + 1)); else onDone(); };
  return (
    <div class={`bloom-wrap s${step}${p.gold ? ' gold' : ''}`} onClick={next}>
      <div class="bloom-title serif">{p.gold ? '金の芽が開いた' : '才能開花'}</div>
      <div class="bloom-face"><Portrait st={st} size={150} frame={countryColor(st.origin)} /></div>
      <div class="bloom-mark">
        <span class="bloom-bad serif">{p.gold ? '芽' : '苦'}</span>
        <span class="bloom-flower" aria-hidden="true"><i /><i /><i /><i /><i /><b /></span>
      </div>
      <div class="bloom-name serif">{st.given}{p.gold ? '' : `の${sk}`}</div>
      {step >= 1 && <div class="bloom-text">{p.gold ? `${st.given}の中に眠っていた大きな器が、目を覚ました。英雄への道が開けた。` : `苦手だった${sk}が、得意に変わった。`}</div>}
      {step >= 2 && <div class="bloom-say">{st.given}「{say}」</div>}
      {step >= 3 && <div class="bloom-teacher">{s.instructor.name}先生「{teacher}」</div>}
      {step >= 3 && ab && <div class="bloom-ab small">技「{ab.name}」を身につけた：{ab.desc}</div>}
      {step >= 3 && cls.length > 0 && <div class="bloom-ab small">{sk}を使う兵種への道が開けた（{cls.join('・')}など）</div>}
      <div class="bloom-tap small">{step < 3 ? 'タップで次へ' : 'タップで閉じる'}</div>
    </div>
  );
}
