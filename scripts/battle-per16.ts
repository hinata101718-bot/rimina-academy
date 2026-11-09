// 16夜目：1回の戦いあたりの数（武器を使った回数・倒した数・戦い数）を、今の版で数える（札の戦いと比べるため）
import { newGame } from '../src/core/game';
import { autoYears, setAutoChoicePick, humanLikePick, opCount } from '../src/core/autoplay';
setAutoChoicePick(humanLikePick(3));
let battles = 0, uses = 0, kills = 0, lv = 0, n = 0, deaths = 0;
for (const seed of [11, 12, 13]) {
  const s = newGame({ name: 'テ', background: 'knight', seed, start: 'normal' });
  autoYears(s, 6);
  for (const st of Object.values(s.students)) {
    battles += st.battles; kills += st.kills; uses += Object.values(st.weaponUse).reduce((a, b) => a + b, 0);
    if (st.status === 'graduated') { lv += st.level; n++; }
    if (st.status === 'dead' && st.deathNote?.includes('戦死')) deaths++;
  }
  console.log(seed, s.stats.battlesWon, s.stats.battlesLost);
}
console.log({ usesPerBattle: (uses / battles).toFixed(2), killsPerBattle: (kills / battles).toFixed(2), gradLv: (lv / n).toFixed(1), deaths, opCount: JSON.stringify(opCount.sq) });
