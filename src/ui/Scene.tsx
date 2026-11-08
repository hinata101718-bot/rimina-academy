// 場面の画面：タップで1ページずつ進む（教官の代替わり・エンディング）
import { useEffect, useRef, useState } from 'preact/hooks';
import type { GameState, SceneLine } from '../core/state';
import { Portrait } from './Portrait';
import { TeacherFace } from './Talk';
import { SceneArt } from './EndingArt';
import { sfx, playBgm } from './sound';
import { laneMul } from './anim';
import { countryColor } from './cards';

function speaker(s: GameState, by: string): string {
  if (by === 'teacher') return `${s.instructor.name}（先生）`;
  if (by === 'narr') return '';
  return s.students[by]?.given ?? '';
}

export function ScenePlayer({ s, lines, onDone }: { s: GameState; lines: SceneLine[]; onDone: () => void }) {
  const [i, setI] = useState(0);
  const [shown, setShown] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const line = lines[Math.min(i, lines.length - 1)];
  const full = line?.text ?? '';
  const typing = shown < full.length;
  useEffect(() => {
    // エンディングの最初の場面で、エンディングの曲（public/bgm/ending.mp3 があれば）と短い調べ
    if (line?.art?.startsWith('ending_')) { sfx('ending'); playBgm('ending'); }
    setShown(0);
    if (timer.current) clearInterval(timer.current);
    const per = Math.max(8, Math.round(30 * laneMul('anim')));
    let n = 0;
    timer.current = setInterval(() => {
      n += 1; setShown(n);
      if (n % 5 === 1) sfx('text');
      if (n >= full.length && timer.current) { clearInterval(timer.current); timer.current = null; }
    }, per);
    return () => { if (timer.current) clearInterval(timer.current); };
  }, [i]);
  const tap = () => {
    if (typing) { if (timer.current) clearInterval(timer.current); timer.current = null; setShown(full.length); return; }
    if (i + 1 < lines.length) { setI(i + 1); return; }
    sfx('ok'); onDone();
  };
  if (!line) return <button class="btn primary block" onClick={onDone}>閉じる</button>;
  const st = line.by !== 'narr' && line.by !== 'teacher' ? s.students[line.by] : null;
  const photo = line.photo !== undefined ? s.photos.find((p) => p.cohort === line.photo) : null;
  return (
    <div class="scene" onClick={tap}>
      {line.art && <SceneArt name={line.art} height={150} />}
      {line.title && <div class="scene-title">{line.title}</div>}
      {line.faces && line.faces.length > 0 && (
        <div class="scene-faces">{line.faces.map((id) => s.students[id]).filter(Boolean).map((x) => <div><Portrait st={x} size={line.faces!.length === 1 ? 110 : line.faces!.length <= 3 ? 84 : line.faces!.length > 6 ? 46 : 60} frame={countryColor(x.origin)} /><div class="small">{x.given}</div></div>)}</div>
      )}
      {photo && (
        <div class="photo scene-photo">
          <div class="photo-cap">{photo.cohort}期生（{photo.year}年目 卒業）</div>
          {photo.ids.map((id) => s.students[id]).filter(Boolean).map((x) => <div class="seat"><Portrait st={x} size={44} />{x.career && !x.career.alive && <div class="deadmark">✝</div>}<div>{x.given}</div></div>)}
          {photo.empty.map((id) => s.students[id]).filter(Boolean).map((x) => <div class="seat"><div class="empty" style={{ width: 44, height: 44 }} /><div class="muted">{x.given}</div></div>)}
        </div>
      )}
      {line.roll && <div class="roll" key={i}>{line.roll.map((r) => <span class={r.dead ? 'dead' : ''}>{r.name}{r.dead ? '✝' : ''}</span>)}</div>}
      {(st || line.by === 'teacher') && (
        <div class="scene-speaker">{st ? <Portrait st={st} size={84} frame={countryColor(st.origin)} /> : <TeacherFace s={s} size={84} />}</div>
      )}
      <div class={`tbox${line.by === 'narr' ? ' narr' : ''}`} style={{ borderRadius: 12 }}>
        {line.by !== 'narr' && <div class="tname">{speaker(s, line.by)}</div>}
        <div class="ttext">{full.slice(0, shown)}{typing ? '' : <span class="tnext">{i + 1 < lines.length ? ' ▼' : ' ■'}</span>}</div>
      </div>
      <div class="row" style={{ marginTop: 8 }} onClick={(e) => e.stopPropagation()}>
        <span class="muted small grow">{i + 1}／{lines.length}　タップすると進みます</span>
        <button class="btn ghost small" onClick={() => { sfx('cancel'); onDone(); }}>読み飛ばす</button>
      </div>
    </div>
  );
}
