// 25夜目①：戦いに持っていく技を選ぶ（個人ページの技の欄・出撃の画面・進軍の小休止）
import { useState } from 'preact/hooks';
import { act } from './store';
import { sfx } from './sound';
import { Sheet } from './common';
import { AtkMark } from './atk';
import type { Student } from '../core/state';
import { battleTechs, techUsable, toggleBattleTech, autoPickTechs, techPicked } from '../core/techs';
import { TECH_BY_ID, TECH_MAX, type TechDef } from '../data/tactics';

/** 技の一覧（タップで「戦いで使う」をつけ外し） */
export function TechPicker({ st }: { st: Student }) {
  const [swap, setSwap] = useState<string | null>(null);
  const [msg, setMsg] = useState('');
  const all = (st.techs ?? []).map((id) => TECH_BY_ID[id]).filter((t): t is TechDef => !!t);
  const carry = battleTechs(st);
  const on = new Set(carry.map((t) => t.id));
  const tap = (t: TechDef) => {
    if (!techUsable(st, t)) { sfx('cancel'); setMsg(`「${t.name}」は今の兵種では使えません`); return; }
    act((g) => {
      const r = toggleBattleTech(g.students[st.id], t.id);
      if (r.ok) { sfx('ok'); setSwap(null); setMsg(on.has(t.id) ? `「${t.name}」を外しました` : `「${t.name}」を持っていきます`); }
      else if (r.why === 'full') { sfx('move'); setSwap(t.id); setMsg(''); }
      else if (r.why === 'last') { sfx('cancel'); setMsg('技は1つは持っていきます'); }
      else sfx('cancel');
    });
  };
  const doSwap = (out: string) => act((g) => {
    const r = toggleBattleTech(g.students[st.id], swap!, out);
    if (r.ok) { sfx('ok'); setMsg(`「${TECH_BY_ID[out]?.name}」と「${TECH_BY_ID[swap!]?.name}」を入れ替えました`); }
    setSwap(null);
  });
  if (!all.length) return <div class="small muted">まだありません。技能のランクが上がると覚えます。</div>;
  return (
    <div class="tp-wrap">
      <div class="row between nowrap" style={{ marginBottom: 4 }}>
        <span class="small"><b>戦いで使う {carry.length}／{TECH_MAX}</b>{techPicked(st) ? '（自分で選んだ）' : '（おまかせ）'}</span>
        <button class="btn small" disabled={!techPicked(st)} onClick={() => act((g) => { autoPickTechs(g.students[st.id]); sfx('ok'); setSwap(null); setMsg('おまかせで選びました（強い技・癒しの技を先に）'); })}>おまかせで選ぶ</button>
      </div>
      {msg && <div class="guide small">{msg}</div>}
      {swap && (
        <div class="tp-swap" role="dialog" aria-label="入れ替える技を選ぶ">
          <div class="small"><b>「{TECH_BY_ID[swap]?.name}」を持っていくには、どれと入れ替えますか</b>（戦いに持っていけるのは{TECH_MAX}つまで）</div>
          <div class="tp-swap-list">
            {carry.map((t) => <button class="btn tp-swap-btn" onClick={() => doSwap(t.id)}><AtkMark small t={t.type} />{t.name}</button>)}
          </div>
          <button class="btn ghost small" onClick={() => { sfx('cancel'); setSwap(null); }}>やめる</button>
        </div>
      )}
      {all.map((t) => {
        const ok = techUsable(st, t);
        const sel = on.has(t.id);
        return (
          <button class={`tp-row${sel ? ' on' : ''}${ok ? '' : ' off'}${swap === t.id ? ' pick' : ''}`} aria-pressed={sel} aria-disabled={!ok} onClick={() => tap(t)}>
            <AtkMark t={t.type} />
            <span class="grow tp-body"><b>{t.name}</b><span class="small muted">{t.desc}・{t.uses}回まで</span>{!ok && <span class="small tp-why">今の兵種では使えない</span>}</span>
            <span class={`tp-state small${sel ? ' on' : ''}`}>{sel ? '戦いで使う' : ok ? '使わない' : '—'}</span>
          </button>
        );
      })}
      <div class="small muted" style={{ marginTop: 4 }}>タップで「戦いで使う」をつけ外しできます（{TECH_MAX}つまで）。選んでいない子や、兵種を変えて使えなくなった技は、おまかせで埋めます。技ごとに攻撃の種類が違い、いろいろな弱点を突けます。</div>
    </div>
  );
}

/** 出撃の画面・進軍の小休止から開く、技の付け替え */
export function TechSheet({ st, onClose }: { st: Student; onClose: () => void }) {
  return <Sheet title={`${st.given}の技`} onClose={onClose} top><TechPicker st={st} /></Sheet>;
}

/** 出撃の画面などの1行（今持っていく技の名前） */
export function techLine(st: Student): string {
  const t = battleTechs(st);
  return t.length ? t.map((x) => x.name).join('・') : '技なし';
}
