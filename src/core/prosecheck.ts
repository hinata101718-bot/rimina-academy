// 15夜目：戦いの文の点検。最期の文・重傷の文・必殺の文・戦技の名前が、とどめの攻撃（武器の種類・魔法の属性）と合っているか
// すべての武器・魔法 × 当たり方（ふつう・重い・必殺・倒した・外れ）× 描写の段（濃い・凄惨）× 重傷・戦死 で、使われうる文を調べる
import { PROSE_LIGHT, PROSE_DENSE, PROSE_BRUTAL, PROSE_FALL, PROSE_GRUNT_KILL, PROSE_MARKS, fallLines, proseKey } from '../data/warprose';
import { FALL_TEXT } from '../data/battlefx';
import { WEAPONS } from '../data/weapons';
import { ART_LIST } from '../data/arts';

export interface ProseIssue { where: string; text: string; want: string; found: string }

/** 文に入っている、ほかの武器・属性の言葉（want＝合うべき種類） */
function foreign(text: string, want: string): string | null {
  for (const [k, re] of Object.entries(PROSE_MARKS)) if (k !== want && re.test(text)) return k;
  return null;
}

/** すべての組み合わせを調べて、合わない文の一覧を返す（0件が目標） */
export function proseMismatches(): { issues: ProseIssue[]; checked: number } {
  const issues: ProseIssue[] = [];
  let checked = 0;
  const look = (where: string, list: string[] | undefined, want: string) => {
    for (const text of list ?? []) {
      checked++;
      const f = foreign(text, want);
      if (f) issues.push({ where, text, want, found: f });
    }
  };
  // 攻撃に使う武器・魔法すべて（杖をのぞく）。武器なし（格闘）も
  const attacks = [...Object.values(WEAPONS).filter((w) => w.type !== 'staff'), null];
  const hits = ['hit', 'heavy', 'crit', 'kill', 'miss'] as const;
  for (const w of attacks) {
    const key = proseKey(w);
    const name = w ? w.name : '武器なし';
    for (const h of hits) {
      if (h !== 'kill' && h !== 'miss') look(`${name}・ふつうの${h}`, PROSE_LIGHT[key]?.[h] ?? PROSE_LIGHT.none[h], key);
      look(`${name}・濃い${h}`, PROSE_DENSE[key]?.[h] ?? PROSE_DENSE.none[h], key);
      look(`${name}・凄惨${h}`, PROSE_BRUTAL[key]?.[h], key);
    }
    for (const oc of ['injured', 'dead'] as const) for (const lv of ['normal', 'dense', 'brutal'] as const) look(`${name}・${oc === 'dead' ? '戦死' : '重傷'}（${lv}）`, fallLines(key, oc, lv), key);
  }
  // どの攻撃にも使う文は、武器・属性を言わない
  look('雑兵を倒したとき', PROSE_GRUNT_KILL, 'none');
  for (const oc of ['injured', 'dead'] as const) for (const lv of ['normal', 'dense', 'brutal'] as const) look(`属性を言わない${oc}（${lv}）`, PROSE_FALL[oc][lv], 'none');
  look('倒れたときの見せ場', [...FALL_TEXT.injured, ...FALL_TEXT.dead], 'none');
  // 戦技の名前：武器を決めた戦技は、その武器の言葉だけ。どの武器でも使う戦技は、武器・属性を言わない
  for (const a of ART_LIST.filter((x) => x.kind === 'art')) {
    const ws = a.weapons ?? [];
    if (!ws.length) { look(`戦技「${a.name}」（どの武器でも）`, [a.name + a.desc], 'none'); continue; }
    // 魔道・信仰の戦技は、属性のちがう魔法でも使うので、属性を言わない
    for (const wt of ws) look(`戦技「${a.name}」（${wt}）`, [a.name], wt === 'magic' || wt === 'holy' ? (wt === 'holy' ? 'light' : 'none') : wt);
  }
  return { issues, checked };
}
