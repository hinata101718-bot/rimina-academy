// 戦闘演出（9夜目）：毎回の攻撃は小さく速く、見せ場（必殺・撃破・宿命の対決）だけ大きく。数値と文章
import type { PersonalityId } from '../core/types';

export type FxLevel = 'big' | 'normal' | 'low';
export const FX_NAMES: Record<FxLevel, string> = { big: '派手', normal: 'ふつう', low: '控えめ' };

export const FX = {
  /** 見せ場の長さ（ミリ秒。タップで早送り）。「ふつう」はこの倍率 */
  cutin: 1500, kill: 1300, fall: 1900, duel: 2200, strat: 1500, normalMul: 0.65,
  /** 戦いの記録の「速く」のとき、見せ場の長さの倍率 */
  fastMul: 0.5,
  /** 新しいカードだけはっきり、前のカードは薄く（この枚数より前） */
  keepBright: 2,
};

/** 魔法の色（武器のid→色の名前） */
export const MAGIC_COLOR: Record<string, string> = {
  fire: 'fire', flame_lance: 'fire', abyss_flame: 'fire',
  thunder: 'thunder', thoron: 'thunder',
  wind: 'wind', gale_crown: 'wind', gale_blade: 'wind',
  blizzard: 'ice', aurora: 'ice',
  miasma: 'dark', curse_brand: 'dark',
  starfall: 'star',
};

/** 必殺のひとこと（性格の口調） */
export const CRIT_SAY: Record<PersonalityId, string[]> = {
  hot: ['ここで決める！', 'うおおおっ！', '燃えろォ！'],
  calm: ['……見えました', '隙あり、です', 'ここです'],
  timid: ['え、えいっ！', 'ご、ごめんなさいっ！', 'お願い、当たって……！'],
  cynic: ['悪いな、終わりだ', 'もらった', '甘いんだよ'],
  gentle: ['これで、終わりにします', '許してください……！', '皆さんのために！'],
  serious: ['一撃で決する！', '覚悟！', '訓練の成果を見せる'],
  cheerful: ['いっくよー！', 'とっておき！', 'えーいっ！'],
  shy: ['……いきます', '……ここっ', '……当たって'],
  competitive: ['俺の勝ちだ！', '負けるかよ！', 'これで終わりだ！'],
  whimsical: ['きらっ', 'いまだって、風が言ってる', 'ふふ、ここ'],
};
/** 敵将の必殺のひとこと（性格） */
export const LEADER_CRIT_SAY: Record<string, string[]> = {
  arrogant: ['ひれ伏せ！', '思い知れ！'], veteran: ['若いの、甘いぞ', 'ここまでだ'], cunning: ['ひひっ、もらった', '油断したな'],
  proud: ['我が一撃を受けよ！', '誇りにかけて！'], young: ['俺の時代だ！', '見てろよ！'], cold: ['……終わりだ', '無駄だ'], beast: ['グオオオッ！'],
};

/** 生徒が倒れたときの文（重傷と戦死で分ける。撃破の判は押さない） */
export const FALL_TEXT = {
  injured: ['{a}は深手を負い、仲間に担がれて下がっていった', '{a}が膝をつく。命はある――だが、もう戦えない'],
  dead: ['{a}は……そのまま、動かなくなった', '{a}の声は、もう聞こえない'],
};

/** 武器の種類→効果音 */
export const WEAPON_SFX: Record<string, string> = { sword: 'sword', lance: 'lance', axe: 'axe', bow: 'bow', magic: 'magic', holy: 'holy', gun: 'gun', staff: 'heal' };
