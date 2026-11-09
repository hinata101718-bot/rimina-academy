// 伝説の武器が手に入ったとき（14夜目）：画面が金に、伝説の文が1行ずつ。年鑑の「伝説の武器の行方」
import { useState } from 'preact/hooks';
import type { GameState } from '../core/state';
import { LEGEND_BY_ID, LEGENDS, RARITY_COLOR } from '../data/rarity';
import { WEAPONS } from '../data/weapons';
import { Icon } from './icons';
import { sfx } from './sound';
import { Portrait } from './Portrait';

export function LegendView({ s, id, onDone }: { s: GameState; id: string; onDone: () => void }) {
  const L = LEGEND_BY_ID[id];
  const [i, setI] = useState(0);
  if (!L) { onDone(); return null; }
  const w = WEAPONS[L.base];
  const n = L.lore.length + 1;
  return (
    <div class="legend-wrap" onClick={() => { sfx(i + 1 >= n ? 'ok' : 'page'); if (i + 1 > n) onDone(); else setI(i + 1); }}>
      <div class="legend-glow" />
      <div class="legend-title small">伝説の武器</div>
      <div class="legend-icon"><Icon name={({ sword: 'sword', lance: 'lance', axe: 'axe', bow: 'bow', gun: 'gun' } as Record<string, string>)[L.type] ?? 'sword'} size={64} /></div>
      <h2 class="serif legend-name">{L.name}</h2>
      <div class="legend-lore serif">{L.lore.slice(0, i + 1).map((x, k) => <p class={k === i ? 'new' : ''}>{x}</p>)}</div>
      {i >= L.lore.length && <div class="legend-art">
        <div><b>専用のスキル「{L.art}」</b>　{L.artText}</div>
        <div class="small">もとの武器：{w?.name}（威力{w?.might}・命中{w?.hit}）　持ち主を選ぶ：{L.cond.text}</div>
      </div>}
      <div class="small legend-tap">{i + 1 > L.lore.length ? 'タップで閉じる' : 'タップで次へ'}</div>
    </div>
  );
}

/** 年鑑：伝説の武器の行方（見たことのない武器は「？」のまま） */
export function LegendWhereabouts({ s }: { s: GameState }) {
  const seen = new Set(s.weaponSeen ?? []);
  return (
    <div class="card">
      <h3>伝説の武器の行方</h3>
      <div class="muted small">大陸に12振りの伝説の武器。敵の将軍が持っているものは、討てば取りもどせます。</div>
      <ul class="list">
        {LEGENDS.map((l) => {
          const v = s.legends?.[l.id]; const k = seen.has(`legend:${l.id}`);
          const o = v?.officerId ? (s.officers ?? []).find((x) => x.id === v.officerId) : null;
          const st = v?.studentId ? s.students[v.studentId] : null;
          const where = !v || v.holder === 'none' ? '行方知れず' : v.holder === 'school' ? 'リミナ分校の武器庫' : v.holder === 'alumni' ? `卒業生の${st?.given ?? ''}が持っている` : `${o ? `${o.given}${o.family ? `・${o.family}` : ''}` : '敵の将軍'}が持っている`;
          return <li class="row nowrap gap6" style={{ ['--rar' as string]: RARITY_COLOR.legend }}>{st && <Portrait st={st} size={28} />}<span class="grow"><b class="serif">{k || v?.holder === 'officer' ? l.name : '？？？'}</b><br /><span class="small muted">{where}{v?.log.length ? `（${v.log[v.log.length - 1].year}年目：${v.log[v.log.length - 1].text}）` : ''}</span></span></li>;
        })}
      </ul>
    </div>
  );
}
