// 1年の振り返り（14夜目）：見出しつきの頁をタップで1枚ずつ。年鑑の「振り返り」からも読み返せる
import { useState } from 'preact/hooks';
import type { GameState, YearReview } from '../core/state';
import { Portrait } from './Portrait';
import { TeacherFace } from './Talk';
import { countryColor } from './cards';
import { sfx } from './sound';

interface Page { key: string; head: string; body: preact.ComponentChildren }

function pagesOf(s: GameState, rv: YearReview): Page[] {
  const st = (id?: string) => (id ? s.students[id] : undefined);
  const out: Page[] = [];
  const n = rv.nums;
  const cell = (label: string, v: string) => <div class="rv-num"><small>{label}</small><b>{v}</b></div>;
  out.push({ key: 'head', head: rv.title, body: <>
    <div class="rv-nums">
      {cell('入学', `${n.enrolled}人`)}
      {cell('卒業', `${n.graduated}人`)}
      {n.battles !== undefined ? cell('戦い', `${n.battles}回`) : null}
      {n.battles !== undefined ? cell('勝ち・負け', `${n.won}・${n.lost}`) : null}
      {cell('新しい兵種', `${n.newClass}`)}
      {cell('才能の開花', `${n.blooms}人`)}
    </div>
    {n.deaths > 0 && <div class="small rv-quiet">この年、{n.deaths}人の教え子が帰らなかった。</div>}
    {rv.rebuilt && <div class="small muted">この年の記録は、年表から書きおこしたものです。</div>}
  </> });
  if (rv.scenes.length) out.push({ key: 'scenes', head: '名場面', body: <ol class="rv-scenes">{rv.scenes.map((x) => { const a = st(x.by); return <li>{a && <Portrait st={a} size={44} frame={countryColor(a.origin)} />}<span class="serif">{x.text}</span></li>; })}</ol> });
  const g = st(rv.grew?.id), m = st(rv.mvp?.id);
  if (g || m) out.push({ key: 'people', head: 'この年の顔', body: <div class="rv-people">
    {g && <div class="rv-person"><Portrait st={g} size={72} frame={countryColor(g.origin)} /><div><small>いちばん伸びた子</small><b class="serif">{g.given}</b><div class="small">Lv{rv.grew!.lv0} → Lv{rv.grew!.lv1}</div></div></div>}
    {m && <div class="rv-person"><Portrait st={m} size={72} frame="var(--gold)" /><div><small>いちばん称号を集めた子</small><b class="serif">{m.given}</b><div class="small">称号 {rv.mvp!.honors}個</div></div></div>}
  </div> });
  if (rv.grads.length || rv.dead.length || rv.alumniDead.length) out.push({ key: 'farewell', head: '別れ', body: <>
    {rv.grads.length > 0 && <><div class="small muted">巣立った子たち（{rv.grads.length}人）</div><div class="rv-faces">{rv.grads.map((id) => st(id)).filter(Boolean).map((x) => <span class="rv-face"><Portrait st={x!} size={46} frame={countryColor(x!.origin)} /><small>{x!.given}</small></span>)}</div></>}
    {rv.dead.length > 0 && <div class="rv-dead">{rv.dead.map((d) => { const x = st(d.id); return x ? <div class="row nowrap gap8"><Portrait st={x} size={44} /><div><b class="serif">{x.given}</b><div class="small">{d.note}</div></div></div> : null; })}</div>}
    {rv.alumniDead.length > 0 && <div class="small muted" style={{ marginTop: 6 }}>戦場で倒れた卒業生：{rv.alumniDead.map((id) => st(id)?.given).filter(Boolean).join('、')}</div>}
  </> });
  if (rv.world.length) out.push({ key: 'world', head: '世界の動き', body: <ul class="rv-world">{rv.world.map((w) => <li>{w}</li>)}</ul> });
  out.push({ key: 'closing', head: '先生のひとこと', body: <div class="row nowrap gap8"><TeacherFace s={s} size={56} /><div class="serif rv-closing">{rv.closing}</div></div> });
  return out;
}

export function ReviewPlayer({ s, rv, onDone }: { s: GameState; rv: YearReview; onDone: () => void }) {
  const [i, setI] = useState(0);
  const pages = pagesOf(s, rv);
  const p = pages[Math.min(i, pages.length - 1)];
  const last = i >= pages.length - 1;
  return (
    <div class="overlay rv-overlay" onClick={() => { sfx('page'); if (last) onDone(); else setI(i + 1); }}>
      <div class="sheet rv-sheet" key={p.key}>
        <div class="row between nowrap small muted"><span>第{rv.year}年の振り返り</span><span>{i + 1}／{pages.length}</span></div>
        <h2 class={`serif rv-head${p.key === 'head' ? ' big' : ''}`}>{p.head}</h2>
        <div class="rv-body">{p.body}</div>
        <div class="row between nowrap" style={{ marginTop: 12 }}>
          <button class="btn ghost small" onClick={(e) => { e.stopPropagation(); sfx('cancel'); onDone(); }}>{last ? '閉じる' : 'とばす'}</button>
          <span class="small muted">{last ? 'タップで閉じる' : 'タップで次へ ›'}</span>
        </div>
      </div>
    </div>
  );
}

/** 年鑑の「振り返り」：年ごとの見出しの一覧。押すと読み返せる */
export function ReviewList({ s }: { s: GameState }) {
  const [open, setOpen] = useState<number | null>(null);
  const list = [...(s.reviews ?? [])].reverse();
  const rv = open !== null ? (s.reviews ?? []).find((x) => x.year === open) : null;
  return (
    <div>
      {!list.length && <div class="empty-note">1年目の3月、卒業式のあとに、最初の振り返りが残ります。</div>}
      {list.map((x) => (
        <button class="pcard tap rv-row" style={{ ['--band' as string]: x.dead.length ? '#6b5a4e' : 'var(--gold)' }} onClick={() => { sfx('page'); setOpen(x.year); }}>
          <b class="serif">{x.title}</b>
          <span class="small muted">入学{x.nums.enrolled}・卒業{x.nums.graduated}{x.nums.battles !== undefined ? `・戦い${x.nums.battles}` : ''}{x.dead.length ? `・戦死${x.dead.length}` : ''}</span>
        </button>
      ))}
      {rv && <ReviewPlayer s={s} rv={rv} onDone={() => setOpen(null)} />}
    </div>
  );
}
