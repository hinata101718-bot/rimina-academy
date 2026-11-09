import { cohortName } from '../core/util';
import { useState } from 'preact/hooks';
import type { ComponentChildren } from 'preact';
import type { Student, GameState } from '../core/state';
import { Portrait } from './Portrait';
import { navigate } from './store';
import { CLASSES } from '../data/classes';
import { COUNTRY_SHORT, PERSONALITIES } from '../data/people';
import { B } from '../data/balance';
import { sfx } from './sound';

export function Sheet({ children, onClose, title, top }: { children: ComponentChildren; onClose?: () => void; title?: string; top?: boolean }) {
  return (
    <div class={`overlay${top ? ' top' : ''}`} onClick={(e) => { if (e.target === e.currentTarget && onClose) onClose(); }}>
      <div class="sheet">
        {title && <div class="row between"><h2 class="grow">{title}</h2>{onClose && <button class="btn ghost small" onClick={() => { sfx('cancel'); onClose(); }}>閉じる</button>}</div>}
        {children}
      </div>
    </div>
  );
}

export function Bar({ v, max, red }: { v: number; max: number; red?: boolean }) {
  return <div class={`bar${red ? ' red' : ''}`}><span style={{ width: `${Math.max(0, Math.min(100, (v / max) * 100))}%` }} /></div>;
}

export function StuRow({ st, sub, onClick, right }: { st: Student; sub?: string; onClick?: () => void; right?: ComponentChildren }) {
  return (
    <div class="stu" onClick={onClick ?? (() => navigate({ tab: 'students', page: 'detail', id: st.id }))}>
      <Portrait st={st} size={44} />
      <div class="grow">
        <div><b>{st.given}</b> <span class="muted">{st.family}</span></div>
        <div class="meta">{sub ?? `${st.grade ? `${st.grade}年` : `${cohortName(st.cohort)}`}・${CLASSES[st.classId]?.name}・Lv${st.level}・${COUNTRY_SHORT[st.origin]}・${PERSONALITIES[st.personality].name}`}</div>
      </div>
      {right}
    </div>
  );
}

export function motivationText(m: number) { return B.motivationLabel[m]; }
export function moodIcon(st: Student) { return ['😣', '😟', '🙂', '😊', '😆'][st.motivation]; }

export function Back({ to }: { to: () => void }) {
  return <button class="btn ghost small" onClick={() => { sfx('cancel'); to(); }}>← 戻る</button>;
}

export function money(n: number) { return `${n.toLocaleString()}G`; }
export function stageOf(s: GameState): 'peace' | 'tension' | 'war' {
  return s.world.tension < B.world.peaceBelow ? 'peace' : s.world.tension > B.world.warAbove ? 'war' : 'tension';
}

/** 「？」の札：タップで短い説明を開く（10夜目） */
export function HelpTip({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  return (
    <span class="helptip">
      <button class={`lb-help${open ? ' on' : ''}`} aria-label="説明" onClick={(e) => { e.preventDefault(); e.stopPropagation(); sfx('move'); setOpen(!open); }}>？</button>
      {open && <span class="helptip-body small" onClick={() => setOpen(false)}>{text}</span>}
    </span>
  );
}
