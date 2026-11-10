// 22夜目⑧：攻撃の種類の色つきの小さな印（盤・札・個人ページ・図鑑・武器の一覧で同じ印）
import { useState } from 'preact/hooks';
import { ATK_NAME, ATK_COLOR, ATK_DESC, ATK_TYPES, type AtkType } from '../data/tactics';

/** state：q＝まだ分からない弱点（？）・no＝効かない（×）・weak＝弱点（強調） */
export function AtkMark({ t, state, small }: { t?: AtkType; state?: 'q' | 'no' | 'weak'; small?: boolean }) {
  if (state === 'q' || !t) return <span class={`atk q${small ? ' sm' : ''}`} title="まだ分からない弱点">？</span>;
  const c = ATK_COLOR[t];
  return <span class={`atk${state === 'no' ? ' no' : ''}${state === 'weak' ? ' wk' : ''}${small ? ' sm' : ''}`} style={{ background: c.bg, color: c.fg }} title={`${ATK_NAME[t]}${state === 'no' ? '（効かない）' : ''}`}>{ATK_NAME[t]}</span>;
}
export function AtkMarks({ list }: { list: AtkType[] }) { return <span class="atks">{list.map((t) => <AtkMark t={t} />)}</span>; }

/** 印の意味（「？」で開く） */
export function AtkLegend() {
  const [open, setOpen] = useState(false);
  return (
    <span class="atk-legend">
      <button class="btn small ghost" onClick={() => setOpen(!open)} aria-expanded={open}>印の意味 ？</button>
      {open && <div class="atk-legend-box small">
        {ATK_TYPES.map((t) => <div class="row nowrap gap6"><AtkMark t={t} /><span>{ATK_DESC[t]}</span></div>)}
        <div class="row nowrap gap6"><AtkMark state="q" /><span>まだ分からない弱点（見抜き・見極め・当てて分かる）</span></div>
        <div class="row nowrap gap6"><AtkMark t="fire" state="no" /><span>×つきは、効かない種類</span></div>
        <div>敵の駒の下：分かっている弱点。味方の駒の下：その子が使える攻撃。教え子を選ぶと、弱点を突ける敵が<b style={{ color: '#b8860b' }}>金色</b>に光ります。</div>
      </div>}
    </span>
  );
}
