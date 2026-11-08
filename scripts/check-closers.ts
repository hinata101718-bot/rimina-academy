// 8夜目：会話の終わりに「締めのあいさつ」が重なっていないかを調べる（よかった・ありがとう・またね が続く）
import { TALKS } from '../src/data/talks/index';
import type { TalkSay } from '../src/core/types';
const ids = (s: TalkSay): string[] => typeof s === 'string' ? [s] : [...ids(s.then), ...ids(s.else)];
const CLOSER = /^(g_glad|thanks|close_|g_bye|g_thanks|bye_|end_)/;
let n = 0;
for (const t of TALKS) {
  const tail = t.lines.filter((l) => l.by !== 'n').slice(-3);
  const c = tail.filter((l) => ids(l.say).some((x) => CLOSER.test(x)));
  if (c.length >= 3 || (c.length >= 2 && tail.slice(-2).every((l) => ids(l.say).some((x) => CLOSER.test(x))) && tail.length >= 2 && tail[tail.length - 1].by === tail[tail.length - 3]?.by)) {
    n++; console.log(t.id, tail.map((l) => `${l.by}:${ids(l.say).join('/')}`).join(' | '));
  }
}
console.log('count', n);
