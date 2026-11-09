// 15夜目：戦いの文の点検。最期の文・重傷の文・必殺の文・戦技の名前が、とどめの攻撃（武器の種類・魔法の属性）と合っているか
// すべての武器・魔法 × 当たり方（ふつう・重い・必殺・倒した・外れ）× 描写の段（濃い・凄惨）× 重傷・戦死 で、使われうる文を調べる
import { PROSE_LIGHT, PROSE_DENSE, PROSE_BRUTAL, PROSE_FALL, PROSE_FALL_BY, PROSE_GRUNT_KILL, PROSE_MARKS, DEATH_WORDS, SURVIVE_WORDS, PROSE_DEEP, PROSE_FLEE, PROSE_ALUMNI_RETREAT, fallLines, proseKey } from '../data/warprose';
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

/**
 * 16夜目：結果の4段の点検（feedback「『串刺し』なのに生きている」）。
 * ふつうの当たり・深手・重傷の文に、死ぬ段の言葉が入っていないか。重傷の文に、助かった理由が入っているか
 */
export function deathWordLeaks(): { issues: { where: string; text: string; why: string }[]; checked: number } {
  const issues: { where: string; text: string; why: string }[] = [];
  let checked = 0;
  const live = (where: string, list: string[] | undefined) => { for (const t of list ?? []) { checked++; const m = DEATH_WORDS.exec(t); if (m) issues.push({ where, text: t, why: `死ぬ段の言葉「${m[0]}」` }); } };
  const hurt = (where: string, list: string[] | undefined) => { live(where, list); for (const t of list ?? []) if (!SURVIVE_WORDS.test(t)) issues.push({ where, text: t, why: '助かった理由がない' }); };
  // 1・2：ふつうの当たり・深手（必殺・外れも）。どの描写の段の表も
  for (const [tb, T] of [['ふつう', PROSE_LIGHT], ['濃い', PROSE_DENSE], ['凄惨', PROSE_BRUTAL]] as const) for (const [k, v] of Object.entries(T)) for (const h of ['hit', 'heavy', 'crit', 'miss'] as const) live(`${tb}・${k}・${h}`, v[h]);
  live('深手', [PROSE_DEEP]);
  // 3：重傷
  for (const lv of ['normal', 'dense', 'brutal'] as const) hurt(`重傷（${lv}）`, PROSE_FALL.injured[lv]);
  for (const [k, v] of Object.entries(PROSE_FALL_BY)) for (const lv of ['dense', 'brutal'] as const) hurt(`重傷・${k}（${lv}）`, v.injured[lv]);
  for (const k of Object.keys(PROSE_FALL_BY)) for (const lv of ['normal', 'dense', 'brutal'] as const) hurt(`重傷・${k}（${lv}・使われる文）`, fallLines(k, 'injured', lv));
  hurt('重傷の見せ場', FALL_TEXT.injured);
  hurt('敵将が逃げのびる', [PROSE_FLEE]);
  hurt('敵の卒業生が退く', [PROSE_ALUMNI_RETREAT]);
  return { issues, checked };
}
