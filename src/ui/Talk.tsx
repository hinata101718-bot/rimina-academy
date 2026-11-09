// 会話の画面：1セリフずつタップで進める（支援会話・面談）。読み返し用のまとめ表示も
import { useEffect, useRef, useState } from 'preact/hooks';
import type { GameState, TalkLog, TalkLineLog, Student } from '../core/state';
import { Portrait } from './Portrait';
import { sfx } from './sound';
import { laneMul } from './anim';
import { BACKGROUNDS } from '../data/people';

const KIND_LABEL: Record<string, string> = { support: '支援会話', interview: '面談', special: '特別な面談' };

export function talkHeading(s: GameState, t: TalkLog): string {
  const a = s.students[t.a];
  const b = t.b === 'teacher' ? null : s.students[t.b];
  if (t.kind === 'interview' || t.kind === 'special') return `${KIND_LABEL[t.kind]}：${a?.given ?? ''}「${t.title}」`;
  return `${a?.given ?? ''}と${b?.given ?? ''}　支援${t.rank}「${t.title}」`;
}

/** 先生の顔（似顔絵の代わりの印） */
export function TeacherFace({ s, size }: { s: GameState; size: number }) {
  const me = s.instructor.studentId ? s.students[s.instructor.studentId] : null;
  if (me) return <Portrait st={me} size={size} />;
  const bg = BACKGROUNDS.findIndex((b) => b.id === s.instructor.background);
  const color = ['#3f6fb0', '#b5483a', '#4f8f4a', '#8a6f4e'][bg] ?? '#555';
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" style={{ borderRadius: '50%', background: '#efe6d2', flex: 'none' }}>
      <circle cx="50" cy="50" r="48" fill={color} opacity="0.18" />
      <path d="M22 96 Q24 66 50 64 Q76 66 78 96 Z" fill={color} />
      <circle cx="50" cy="42" r="18" fill="#e9c7a6" />
      <path d="M31 40 Q32 20 50 20 Q68 20 69 40 Q60 30 50 31 Q40 30 31 40Z" fill="#4a3a2e" />
      <path d="M44 66 L50 78 L56 66" fill="none" stroke="#fff" stroke-width="3" />
    </svg>
  );
}

function SpeakerFace({ s, id, size }: { s: GameState; id: string; size: number }) {
  if (id === 'teacher') return <TeacherFace s={s} size={size} />;
  const st = s.students[id];
  return st ? <Portrait st={st} size={size} /> : <div style={{ width: size, height: size }} />;
}
function speakerName(s: GameState, id: string): string {
  if (id === 'teacher') return `${s.instructor.name}（先生）`;
  if (id === 'narr') return '';
  return s.students[id]?.given ?? '';
}

/** タップ送りで会話を流す */
export function TalkPlayer({ s, t, onDone, onChoice }: { s: GameState; t: TalkLog; onDone: () => void; onChoice?: (i: number) => void }) {
  const [chosen, setChosen] = useState<number | undefined>(t.chosen);
  const lines: TalkLineLog[] = [...t.lines, ...(chosen !== undefined && t.choice ? t.choice.options[chosen].lines : [])];
  const [i, setI] = useState(0);
  const [shown, setShown] = useState(0);
  const [all, setAll] = useState(false);
  /** 18夜目：会話のあとに、2人の連携技ができた発見の演出 */
  const [found, setFound] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const line = lines[Math.min(i, lines.length - 1)];
  const full = line?.text ?? '';
  const typing = shown < full.length;
  const atChoice = !!t.choice && chosen === undefined && i >= t.lines.length - 1 && !typing;

  useEffect(() => {
    setShown(0);
    if (timer.current) clearInterval(timer.current);
    const per = Math.max(8, Math.round(32 * laneMul('anim')));
    let n = 0;
    timer.current = setInterval(() => {
      n += 1;
      setShown(n);
      if (n % 4 === 1) sfx('text');
      if (n >= full.length && timer.current) { clearInterval(timer.current); timer.current = null; }
    }, per);
    return () => { if (timer.current) clearInterval(timer.current); };
  }, [i, chosen]);

  const tap = () => {
    if (all) return;
    if (typing) { if (timer.current) clearInterval(timer.current); timer.current = null; setShown(full.length); return; }
    if (atChoice) return;
    if (i + 1 < lines.length) { setI(i + 1); return; }
    if (t.combo && !found) { sfx('pass'); setFound(true); return; }
    sfx('ok'); onDone();
  };
  const comboBox = t.combo && <div class="tk-combo" role="status"><span class="small">発見</span><b class="serif">連携技「{t.combo.name}」</b><span class="small">{t.combo.text}</span></div>;
  if (found) {
    return (
      <div class="tplayer" onClick={() => { sfx('ok'); onDone(); }}>
        <div class="muted small">{talkHeading(s, t)}</div>
        <div class="tstage">
          <div class="tface on"><SpeakerFace s={s} id={t.a} size={88} /><div class="small">{speakerName(s, t.a)}</div></div>
          <div class="tface on"><SpeakerFace s={s} id={t.b} size={88} /><div class="small">{speakerName(s, t.b)}</div></div>
        </div>
        {comboBox}
        <button class="btn primary block" style={{ marginTop: 10 }} onClick={(e) => { e.stopPropagation(); sfx('ok'); onDone(); }}>閉じる</button>
      </div>
    );
  }

  if (all) {
    return (
      <div>
        <TalkView s={s} t={{ ...t, chosen }} />
        {comboBox}
        <button class="btn primary block" style={t.combo ? { marginTop: 10 } : undefined} onClick={() => { sfx('ok'); onDone(); }}>閉じる</button>
      </div>
    );
  }
  const left = t.a, right = t.b;
  const speaking = line?.by;
  return (
    <div class="tplayer" onClick={tap}>
      <div class="muted small">{talkHeading(s, t)}</div>
      <div class="tstage">
        <div class={`tface${speaking === left ? ' on' : ''}`}><SpeakerFace s={s} id={left} size={88} /><div class="small">{speakerName(s, left).replace('（先生）', '')}</div></div>
        <div class={`tface${speaking === right ? ' on' : ''}`}><SpeakerFace s={s} id={right} size={88} /><div class="small">{speakerName(s, right).replace('（先生）', '先生')}</div></div>
      </div>
      <div class={`tbox${speaking === 'narr' ? ' narr' : ''}`}>
        {speaking !== 'narr' && <div class="tname">{speakerName(s, speaking ?? '')}</div>}
        <div class="ttext">{full.slice(0, shown)}{typing ? '' : <span class="tnext">{atChoice ? '' : i + 1 < lines.length ? ' ▼' : ' ■'}</span>}</div>
      </div>
      {atChoice && t.choice && (
        <div class="tchoice" onClick={(e) => e.stopPropagation()}>
          <div class="small muted">{t.choice.prompt}</div>
          {t.choice.options.map((o, k) => <button class="btn block" onClick={() => { sfx('ok'); setChosen(k); onChoice?.(k); setI(t.lines.length); }}>{o.label}</button>)}
        </div>
      )}
      <div class="row" style={{ marginTop: 8 }} onClick={(e) => e.stopPropagation()}>
        <span class="muted small grow">{i + 1}／{lines.length + (t.choice && chosen === undefined ? t.choice.options[0].lines.length : 0)}　タップすると進みます</span>
        <button class="btn ghost small" onClick={() => setAll(true)}>すべて表示</button>
        <button class="btn ghost small" onClick={() => { sfx('cancel'); if (t.choice && chosen === undefined) { setChosen(0); onChoice?.(0); } if (t.combo && !found) { setFound(true); return; } onDone(); }}>スキップ</button>
      </div>
    </div>
  );
}

/** まとめて表示（読み返し・すべて表示） */
export function TalkView({ s, t }: { s: GameState; t: TalkLog }) {
  const lines = [...t.lines, ...(t.chosen !== undefined && t.choice ? t.choice.options[t.chosen].lines : [])];
  return (
    <div class="talk">
      <div class="muted">{talkHeading(s, t)}{t.year ? `（${t.year}年目）` : ''}</div>
      {lines.map((l, k) => {
        if (l.by === 'narr') return <div class="narr-line">{l.text}</div>;
        const right = l.by === t.b;
        const choiceHere = t.choice && t.chosen !== undefined && k === t.lines.length;
        return (
          <>
            {choiceHere && <div class="narr-line">（{t.choice!.options[t.chosen!].label}）</div>}
            <div class={`line${right ? ' right' : ''}`}><SpeakerFace s={s} id={l.by} size={40} /><div class="bubble"><div class="small muted">{speakerName(s, l.by)}</div>{l.text}</div></div>
          </>
        );
      })}
      {t.choice && t.chosen === undefined && <div class="muted small">（返事は、まだ選んでいません）</div>}
    </div>
  );
}

export type { Student };
