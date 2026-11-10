// 22夜目⑤：生徒ごとの武器の装備（個人ページの「装備」・武器を選ぶ一覧・出撃の画面から）
import { useState } from 'preact/hooks';
import { act } from './store';
import { sfx } from './sound';
import { Sheet } from './common';
import { Icon } from './icons';
import type { GameState, Student } from '../core/state';
import { equipped, equipOptions, equipWeapon, autoEquip } from '../core/equip';
import { itemName, itemMod } from '../core/rarity';
import { WEAPONS } from '../data/weapons';
import { WTYPE_ATK, ATK_NAME, type AtkType } from '../data/tactics';
import { RARITY_NAME, RARITY_COLOR } from '../data/rarity';
import { rarityOf } from '../core/rarity';
import { AtkMark } from './atk';
import type { ArmoryItem } from '../core/state';

const WICON: Record<string, string> = { sword: 'sword', lance: 'lance', axe: 'axe', bow: 'bow', magic: 'tome', holy: 'staff', staff: 'staff', gun: 'gun' };

/** 武器の1行の説明（威力・攻撃の種類・レア度・愛用の回数） */
export function weaponLine(a: ArmoryItem, st: Student): string {
  const w = WEAPONS[a.weaponId];
  if (!w) return '';
  const might = w.might + (a.named?.might ?? 0) + (itemMod(a).dmg ?? 0);
  const uses = a.uses?.[st.id] ?? 0;
  return `威力${might}・${ATK_NAME[(WTYPE_ATK[w.type]?.type ?? 'slash') as AtkType]}・${RARITY_NAME[rarityOf(a)]}${uses ? `・愛用${uses}回` : ''}`;
}

/** 個人ページの「装備」の欄 */
export function EquipCard({ s, st }: { s: GameState; st: Student }) {
  const [open, setOpen] = useState(false);
  const a = equipped(s, st);
  const w = a ? WEAPONS[a.weaponId] : null;
  return (
    <div class="card eq-card">
      <div class="row between nowrap"><h3 style={{ margin: 0 }}>装備</h3><span class="small muted">出撃のときに持つ武器</span></div>
      <button class="eq-now" onClick={() => { sfx('move'); setOpen(true); }}>
        <span class="todoicon"><Icon name={w ? WICON[w.type] : 'sword'} size={18} /></span>
        <span class="grow" style={{ minWidth: 0, textAlign: 'left' }}>
          {a ? <><b class="eq-name" style={{ color: RARITY_COLOR[rarityOf(a)] }}>{itemName(a)}</b><span class="small muted eq-sub">{weaponLine(a, st)}</span></>
            : <><b class="eq-name">おまかせ</b><span class="small muted eq-sub">出撃のたびに、武器庫からいちばん合う武器を持たせます</span></>}
        </span>
        <span class="small eq-change">選ぶ</span>
      </button>
      {open && <EquipSheet s={s} st={st} onClose={() => setOpen(false)} />}
    </div>
  );
}

/** 武器を選ぶ一覧（その子の兵種で使える、武器庫の武器） */
export function EquipSheet({ s, st, onClose }: { s: GameState; st: Student; onClose: () => void }) {
  const [msg, setMsg] = useState('');
  const opts = equipOptions(s, st);
  const pick = (uid: string | null) => act((g) => {
    const x = g.students[st.id];
    const r = equipWeapon(g, x, uid);
    sfx(r.ok ? 'ok' : 'cancel');
    setMsg(uid && r.ok ? (r.from ? `${r.from}から付け替えました` : '装備しました') : uid ? '装備できませんでした' : '外しました。出撃のたびに自動で持たせます');
  });
  return (
    <Sheet title={`${st.given}の装備`} onClose={onClose} top>
      <div class="small muted">その子の兵種で使える武器が並びます。ほかの子が装備している武器を選ぶと、付け替えます。</div>
      {msg && <div class="guide">{msg}</div>}
      <div class="row nowrap gap8" style={{ margin: '8px 0' }}>
        <button class="btn grow" onClick={() => pick(null)}>外す</button>
        <button class="btn grow" onClick={() => act((g) => { const id = autoEquip(g, g.students[st.id]); sfx('ok'); setMsg(id ? 'いちばん合う武器を選びました' : '武器庫に合う武器がないので、学校の鉄の武器で出ます'); })}>おまかせで選ぶ</button>
      </div>
      {opts.map((o) => {
        const on = o.a.uid === st.equip;
        const w = WEAPONS[o.a.weaponId];
        return (
          <button class={`eq-opt${on ? ' on' : ''}`} style={{ ['--band' as string]: RARITY_COLOR[o.rarity] }} onClick={() => { if (!on) pick(o.a.uid); }} aria-pressed={on}>
            <span class="todoicon"><Icon name={WICON[w.type]} size={18} /></span>
            <span class="grow" style={{ minWidth: 0, textAlign: 'left' }}>
              <b class="eq-name">{o.name}</b>
              <span class="small eq-sub">威力{o.might} <AtkMark small t={o.atk as AtkType} />・<span style={{ color: RARITY_COLOR[o.rarity] }}>{RARITY_NAME[o.rarity]}</span>{o.uses ? `・愛用${o.uses}回` : ''}</span>
              {o.holder && <span class="small eq-holder">{o.holder.given}が装備中</span>}
            </span>
            <span class="small eq-state">{on ? '装備中' : o.holder ? '付け替える' : '装備する'}</span>
          </button>
        );
      })}
      {!opts.length && <div class="empty-note">この兵種で使える武器は、まだ武器庫にありません。学校の鉄の武器で出ます</div>}
    </Sheet>
  );
}
