// 手応えと発見（6夜目）：ランクアップの演出・評判の段階・「意外な一面」の出来事
import type { PersonalityId } from '../core/types';

/** 評判の段階（この値以上） */
export const REP_TIERS: { at: number; name: string }[] = [
  { at: 0, name: '名もない分校' }, { at: 20, name: '知られはじめた学校' }, { at: 40, name: '評判の学校' },
  { at: 60, name: '名の知れた名門' }, { at: 80, name: '大陸に名だたる学校' }, { at: 95, name: '伝説の学び舎' },
];
export function repTier(v: number): number { let t = 0; REP_TIERS.forEach((x, i) => { if (v >= x.at) t = i; }); return t; }

export const RANKUP = {
  /** ゲージが伸びる時間・ランクアップの文字を見せる時間（ミリ秒） */
  gaugeMs: 800, stampMs: 1000,
  /** 意外な一面：1週ごとの起きやすさ（面談をした子は×面談倍率） */
  sideChance: 0.006, sideInterviewMul: 6,
};

/** 発見の演出の見出し */
export const DISCOVERY_TEXT = {
  hint1: { title: '才能の気配', text: '{a}に、何か光るものがある。「{hint}」' },
  hint2: { title: '才能の輪郭', text: '{a}の才能が、少しずつ形になってきた。「{hint}」' },
  full: { title: '才能が目覚めた！', text: '{a}の隠れた才能は「{name}」だった！' },
  side: { title: '意外な一面', text: '{text}' },
};

/** 意外な一面：性格や夢と、ふだんの姿とのちがいが見える出来事 */
export interface SideDef {
  id: string;
  /** 個人ページに出す短い言葉 */
  label: string;
  /** この性格の子に起きやすい（空ならだれでも） */
  pers: PersonalityId[];
  /** 出来事の文（{a}=生徒の名） */
  lines: string[];
  /** 夢が変わる出来事 */
  dream?: boolean;
}
export const SIDES: SideDef[] = [
  { id: 'cook', label: '料理がとても上手', pers: ['timid', 'shy', 'gentle'], lines: ['夜の厨房で、{a}がひとりで鍋をかき回していた。', '「……見られちゃいましたか。料理だけは、昔から得意なんです」', '味見をさせてもらうと、食堂のどの料理よりもおいしかった。'] },
  { id: 'flowers', label: '花を育てるのが好き', pers: ['hot', 'competitive', 'cynic'], lines: ['中庭の片すみに、小さな花壇があった。水をやっていたのは{a}だった。', '「な、なんだよ。……花は、うそをつかないからな」', 'いつも勝ち負けにこだわる{a}の、知らなかった顔だった。'] },
  { id: 'ghost', label: '怖い話がまったくだめ', pers: ['calm', 'serious'], lines: ['肝だめしの夜、いちばん先に悲鳴を上げたのは{a}だった。', '「……今のは、作戦上の撤退です。決して、怖かったわけでは」', '翌朝、{a}は少しだけ顔を赤くして、目を合わせなかった。'] },
  { id: 'diary', label: '毎晩、日記をつけている', pers: ['cheerful', 'whimsical'], lines: ['消灯のあと、{a}の部屋だけ灯りがついていた。', '「日記です。にぎやかなのは昼間だけで……夜になると、少しさびしくなるんです」', 'いつも明るい{a}が、ぽつりと本音をこぼした。'] },
  { id: 'children', label: '子どもにとてもやさしい', pers: ['cynic', 'competitive', 'calm'], lines: ['町の子どもたちが、{a}のまわりに集まっていた。', '「……べつに。泣かれると面倒だから、相手をしてるだけさ」', 'そう言いながら、{a}は子どもに肩車をしてやっていた。'] },
  { id: 'training', label: '夜明け前から素振りを欠かさない', pers: ['gentle', 'whimsical', 'cheerful'], lines: ['夜明け前の訓練場に、木剣の音が響いていた。{a}だった。', '「のんびりして見えるでしょう？ でも、置いていかれるのは嫌なんです」', '手のひらのまめが、毎朝の努力を物語っていた。'] },
  { id: 'stars', label: '星の名前にくわしい', pers: ['whimsical', 'shy', 'timid'], lines: ['夜の見張り台で、{a}が空を指さした。', '「あれが北の旅人星。あっちが、帰り道の三つ星です」', '{a}が話すと、いつもの夜空がまるで地図のように見えた。'] },
  { id: 'song', label: '歌がとてもうまい', pers: [], lines: ['洗濯場から、きれいな歌声が聞こえてきた。', '歌っていたのは{a}だった。気づくと、まわりに人だかりができていた。', '「えっ、聞いてたんですか！？ ……故郷の歌なんです」'] },
  { id: 'letters', label: '家族に毎週手紙を書いている', pers: ['hot', 'serious', 'competitive'], lines: ['{a}が分厚い封筒を抱えて、郵便係のところへ走っていった。', '「家族への手紙です。毎週出さないと、母が心配するので」', '照れくさそうに笑う{a}は、いつもより少し幼く見えた。'] },
  { id: 'dream', label: '夢に迷いが生まれた', pers: [], dream: true, lines: ['面談のあと、{a}がしばらく窓の外を見ていた。', '「先生。わたし、ずっと同じ夢を追いかけてきたけど……本当にそれでいいのか、分からなくなってきたんです」', '{a}の夢は「{dream}」に変わった。'] },
];
