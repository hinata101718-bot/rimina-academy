// 戦技と心得（12夜目）：覚えた演出、技能タブの一覧と付けかえ
import { useEffect, useState } from 'preact/hooks';
import { act } from './store';
import { Portrait } from './Portrait';
import { sfx } from './sound';
import { countryColor } from './cards';
import { HelpTip } from './common';
import type { GameState, Student, Pending } from '../core/state';
import { ARTS, ART_LIST, ART_SLOTS } from '../data/arts';
import { SKILL_NAMES } from '../data/people';
import { SKILLS } from '../data/balance';
import { toggleArt, autoEquip } from '../core/arts';
import { rankOf } from '../core/util';

/** 覚えた瞬間（タップで進む） */
export function ArtLearnView({ s, p, onDone }: { s: GameState; p: Extract<Pending, { type: 'art' }>; onDone: () => void }) {
  const st = s.students[p.studentId];
  const [i, setI] = useState(0);
  const [lit, setLit] = useState(false);
  useEffect(() => { setLit(false); const t = setTimeout(() => { setLit(true); sfx('pass'); }, 300); return () => clearTimeout(t); }, [i]);
  const a = ARTS[p.ids[i]];
  if (!st || !a) { onDone(); return null; }
  const next = () => { sfx('ok'); if (i + 1 < p.ids.length) setI(i + 1); else onDone(); };
  return (
    <div class="dc-wrap stage3" onClick={() => (lit ? next() : setLit(true))}>
      <div class="dc-title">{SKILL_NAMES[a.skill]}が{rankOf(st.skills[a.skill] ?? 0)}に上がった！</div>
      <div class="row nowrap gap6" style={{ justifyContent: 'center', margin: '6px 0' }}><Portrait st={st} size={56} frame={countryColor(st.origin)} /><b class="serif">{st.given}</b></div>
      <div class={`lt-card${lit ? ' lit' : ''}`} key={i}>
        <span class="small muted">{a.kind === 'art' ? '戦技' : '心得'}を覚えた</span>
        <b class="serif">{a.name}</b>
        <small>{a.desc}</small>
      </div>
      <div class="small muted">{a.kind === 'art' ? '戦いの中で、ここぞのときに自動で使います' : 'いつも効きます'}</div>
      <button class="btn primary block" style={{ marginTop: 10 }} onClick={(e) => { e.stopPropagation(); next(); }}>{i + 1 < p.ids.length ? '次へ' : '閉じる'}</button>
    </div>
  );
}

/** 技能タブ：覚えた技・まだの技（まだのものは「剣Bで？？？」）と、付けかえ */
export function ArtsCard({ s, st }: { s: GameState; st: Student }) {
  const learned = new Set(st.arts ?? []);
  const on = new Set(st.artsOn ?? []);
  const count = (k: 'art' | 'mind') => [...on].filter((x) => ARTS[x]?.kind === k).length;
  const [all, setAll] = useState(false);
  const allSkills = SKILLS.filter((k) => k !== 'gun' || s.world.gunUnlocked || (st.skills.gun ?? 0) > 0);
  // ふだんは、覚えた技のある技能と得意な技能だけ（ほかはたたむ）
  const skills = all ? allSkills : allSkills.filter((k) => ART_LIST.some((a) => a.skill === k && learned.has(a.id)) || st.apt?.good.includes(k));
  return (
    <div class="card arts-card">
      <div class="row between nowrap"><h3 style={{ margin: 0 }}>戦技と心得 <HelpTip text={`技能ランクが上がると覚えます。得意な技能は、ひとつ前のランクで覚えます。付けられるのは戦技${ART_SLOTS.art}つ・心得${ART_SLOTS.mind}つまでで、ふだんはおまかせで今の兵種に合うものを付けます。タップで付けかえられます。`} /></h3>
        <span class="small muted">戦技 {count('art')}／{ART_SLOTS.art}・心得 {count('mind')}／{ART_SLOTS.mind}</span></div>
      {st.artsManual && <button class="btn small" style={{ marginTop: 4 }} onClick={() => act((g) => { const x = g.students[st.id]; x.artsManual = false; autoEquip(x); })}>おまかせに戻す</button>}
      {skills.map((k) => {
        const list = ART_LIST.filter((a) => a.skill === k && (!a.bloom || learned.has(a.id)));
        return (
          <div class="arts-row">
            <span class="arts-sk small">{SKILL_NAMES[k]}</span>
            <span class="arts-list">{list.map((a) => learned.has(a.id)
              ? <button class={`arts-chip ${a.kind}${on.has(a.id) ? ' on' : ''}${a.bloom ? ' bloom' : ''}`} onClick={() => { sfx('move'); act((g) => toggleArt(g.students[st.id], a.id)); }} title={a.desc}>{on.has(a.id) ? '✓' : ''}{a.name}</button>
              : <span class="arts-chip none">{SKILL_NAMES[k]}{a.rank}で？？？</span>)}</span>
          </div>
        );
      })}
      {allSkills.length > skills.length && <button class="btn small" style={{ marginTop: 6 }} onClick={() => setAll(true)}>ほかの技能の技も見る（{allSkills.length - skills.length}）</button>}
    </div>
  );
}
