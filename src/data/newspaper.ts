// 新聞「リンデルガ通信」（8夜目）の言葉。戦況の数字の動きを、記事の言葉で伝える
import type { CountryId } from '../core/types';

export const PAPER_NAME = 'リンデルガ通信';

/** 国の方針の名前 */
export const STANCE_NAMES = { expand: '攻めに出る', defend: '守りを固める', watch: '様子を見る', peace: '和を求める' } as const;
export type Stance = keyof typeof STANCE_NAMES;

/** 国力が伸びた・落ちたときの見出し（{dir}＝相手の国の方角） */
export const POWER_UP: Record<CountryId, string[]> = {
  kingdom: ['王国、騎士団を王都へ呼び戻す', '王国、新たな騎士を叙任', '王国、北の砦を築き直す'],
  empire: ['帝国、{dir}の国境に兵を集める', '帝国、軍を増やし練兵を急ぐ', '帝国、新しい兵器を前線へ'],
  alliance: ['同盟、諸侯の結束を固める', '同盟、傭兵を雇い入れる', '同盟、港の守りを増やす'],
};
export const POWER_DOWN: Record<CountryId, string[]> = {
  kingdom: ['王国、戦の痛手から立ち直れず', '王国の騎士団、損害相次ぐ'],
  empire: ['帝国、前線で思わぬ苦戦', '帝国、兵の疲れが目立つ'],
  alliance: ['同盟、諸侯の足並み乱れる', '同盟、商いの冷え込みに苦しむ'],
};
/** 二国の関係 */
export const REL_DOWN = ['{a}と{b}の関係、さらに冷え込む', '{a}・{b}の国境で小競り合い', '{a}、{b}への使者を追い返す'];
export const REL_UP = ['{a}と{b}、歩み寄りの兆し', '{a}・{b}の使者が会談', '{a}と{b}、国境の兵を引く'];
/** 緊張度 */
export const TENSION_UP = ['大陸に緊張が走る', '三国の国境、張りつめる'];
export const TENSION_DOWN = ['大陸に、つかの間の静けさ', '国境の兵、少しずつ引き揚げ'];
export const QUIET = ['大陸は静かな半年', '目立った動きなし、三国にらみ合い続く'];

/** 方針ごとの政治の記事（{c}＝国の短い名前） */
export const STANCE_TEXT: Record<Stance, string[]> = {
  expand: ['軍を増やし、国境へ兵を送っている。増税の噂も', '統一の大義をふたたび口にし、徴兵令を出した', '前線の砦に物資を運び込んでいる'],
  defend: ['国境の砦を固め、騎士団を呼び戻している', '徴兵令を出し、守りを急いでいる', '王都の守りを厚くし、戦の備えを進めている'],
  watch: ['諸侯会議を開き、どちらにもつかぬと決めた', '商いを優先し、兵を動かさずにいる', '使者を行き来させ、両国の出方をうかがっている'],
  peace: ['和平の使者を送り、休戦を探っている', '国境の兵を減らし、内政に力を入れている', '飢えた村への手当てを増やし、民の暮らしを立て直している'],
};
/** 国ごとの特別な出来事 */
export const EVENT_TEXT = {
  kingDied: '老王が世を去り、王太子が跡を継いだ',
  famine: '飢饉に苦しみ、食糧の配給を始めた',
  epidemic: '疫病が広がり、兵の動きが鈍っている',
};

/** ゲージの言葉 */
export function tensionLabel(t: number): string { return t >= 80 ? '激戦のさなか' : t >= 65 ? '激戦期' : t >= 55 ? '激戦期の手前' : t >= 35 ? '緊張' : t >= 20 ? 'おだやか' : '平和'; }
export function peaceLabel(p: number): string { return p >= 80 ? 'すぐそこ' : p >= 60 ? '見えてきた' : p >= 40 ? 'まだ遠い' : '遠い'; }

/** 組織の札の名前 */
export const ORG_TAGS = { promote: '昇進', dead: '討死', epithet: '二つ名', strife: '争い', rise: '抜擢', retire: '引退', move: '動き' } as const;

/** 次号の案内 */
export const NEXT_ISSUE = {
  first: '次号（後期号）は三月の年度末。卒業式と、三国の一年をまとめてお届けする。',
  second: '次号（前期号）は九月の終わり。新入生の半年と、夏の戦況をお届けする。',
};
