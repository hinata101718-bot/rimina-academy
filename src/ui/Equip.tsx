// 22夜目⑤：生徒ごとの武器の装備（個人ページの欄・武器を選ぶ一覧・出撃の画面から）
import { useState } from 'preact/hooks';
import { act } from './store';
import { sfx } from './sound';
import { Sheet } from './common';
import { Icon } from './icons';
import type { GameState, Student, ArmoryItem } from '../core/state';
import { equipped, equippable, holderOf, equipItem, autoEquip } from '../core/equip';
import { itemName, itemMod, rarityOf } from '../core/rarity';
import { WEAPONS } from '../data/weapons';
import { WTYPE_ATK, ATK_NAME } from '../data/tactics';
import { RARITY_NAME, RARITY_COLOR } from '../data/rarity';

const WICON: Record<string, string> = { sword: 'sword', lance: 'lance', axe: 'axe', bow: 'bow', magic: 'tome', holy: 'staff', staff: 'staff', gun: 'gun' };

/** 武器の1行の説明（威力・攻撃の種類・レア度・愛用の回数） */
export function weaponLine(st: Student, a: ArmoryItem): string {
  const w = WEAPONS[a.weaponId];
  if (!w) return '';
  const m = itemMod(a);
  const atk = WTYPE_ATK[w.type]?.type;
  const uses = a.uses?.[st.id] ?? 0;
  return `威力${w.might + (m.dmg ?? 0)}・${atk ? ATK_NAME[atk] : ''}・${RARITY_NAME[rarityOf(a)]}${uses ? `・愛用${uses}回` : ''}`;
}
/** 名簿のカードなどに出す、装備中の武器の名前（なければ「おまかせ」） */
export function equipLabel(s: GameState, st: Student): string {
  const a = equipped(s, st);
  return a ? itemName(a) : 'おまかせ（出撃のたびに選ぶ）';
}

/** 武器を選ぶ一覧 */
export function EquipSheet({ s, st, onClose }: { s: GameState; st: Student; onClose: () => void }) {
  const [msg, setMsg] = useState('');
  const list = equippable(s, st);
  const cur = equipped(s, st);
  return (
    <Sheet title={`${st.given}の装備`} onClose={onClose} top>
      <div class="small muted">{st.given}の兵種で使える武器庫の武器です。1つの武器を持てるのは1人だけ。ほかの子が装備している武器を選ぶと、付け替わります。装備がないときは、出撃のたびに自動で選びます。</div>
      {msg && <div class="guide">{msg}</div>}
      <div class="row nowrap gap8" style={{ margin: '8px 0' }}>
        <button class="btn grow" onClick={() => { sfx('ok'); act((g) => { const a = autoEquip(g, st.id); setMsg(a ? `おまかせで${itemName(a)}を選びました` : '使える武器が武器庫にありません。出撃のたびに学校の備えから選びます'); }); }}>おまかせで選ぶ</button>
        <button class="btn grow" disabled={!cur} onClick={() => { sfx('cancel'); act((g) => { equipItem(g, st.id, null); }); setMsg('装備を外しました（出撃のたびに自動で選びます）'); }}>外す</button>
      </div>
      {!list.length && <div class="empty-note">使える武器が、まだ武器庫にありません</div>}
      {list.map((a) => {
        const w = WEAPONS[a.weaponId];
        const h = holderOf(s, a.uid);
        const mine = st.equip === a.uid;
        const r = rarityOf(a);
        return (
          <button class={`pcard eq-item${mine ? ' on' : ''}`} style={{ ['--band' as string]: RARITY_COLOR[r] }} onClick={() => { if (mine) return; sfx('ok'); act((g) => { const res = equipItem(g, st.id, a.uid); setMsg(res.ok ? `${itemName(a)}を装備しました${res.from ? `（${res.from}から付け替え）` : ''}` : '装備できませんでした'); }); }}>
            <div class="row nowrap gap6"><Icon name={WICON[w.type]} size={18} /><b class="grow">{itemName(a)}</b>{mine ? <span class="flag" style={{ background: 'var(--good)' }}>装備中</span> : h ? <span class="flag gray-flag">{h.given}が装備中</span> : null}</div>
            <div class="small muted">{weaponLine(st, a)}</div>
          </button>
        );
      })}
    </Sheet>
  );
}

/** 個人ページの「装備」の欄 */
export function EquipCard({ s, st }: { s: GameState; st: Student }) {
  const [open, setOpen] = useState(false);
  const a = equipped(s, st);
  return (
    <div class="card">
      <div class="row between nowrap"><h3 style={{ margin: 0 }}>装備</h3><button class="btn small" onClick={() => { sfx('move'); setOpen(true); }}>武器を選ぶ</button></div>
      {a ? <div style={{ marginTop: 4 }}><div class="row nowrap gap6"><Icon name={WICON[WEAPONS[a.weaponId]?.type ?? 'sword']} size={18} /><b>{itemName(a)}</b></div><div class="small muted">{weaponLine(st, a)}</div></div>
        : <div class="small muted" style={{ marginTop: 4 }}>装備はおまかせです（出撃のたびに、武器庫からいちばん合う武器を選びます）。</div>}
      {open && <EquipSheet s={s} st={st} onClose={() => setOpen(false)} />}
    </div>
  );
}
