// 宿敵の仕組み（6夜目）の文章。{leader}=敵将の名 {a}=生徒 {v}=倒された仲間 {when}=いつ {title}=戦いの名 {head}=頭の名 {faction}=陣営
import type { PersonalityId } from '../core/types';
import type { LeaderPersonality } from './autobattle';

type ByP = Record<PersonalityId, string>;

/** 口上：過去の出来事に触れる */
export const MEMORY_TEXT = {
  /** 逃げて傷を負った（相手の生徒がいる） */
  scar: [
    '{when}、{a}に負わされたこの傷……一日たりとも忘れたことはない。',
    '見ろ、この傷を。{when}の{title}で、{a}につけられたものだ。',
    '{when}の借りを返しに来たぞ、{a}。',
  ],
  /** 逃げて傷を負った（相手が分からない） */
  scarAny: ['{when}の{title}で受けた傷が、まだうずく。', 'あの日の傷が、お前たちを覚えている。'],
  /** 生徒を倒したことがある */
  victim: [
    '{when}に{v}を討ったのは、この俺だ。覚えているか？',
    '{v}とかいう生徒も、そうやって向かってきたな。',
    '{v}の次は、誰の番だ？',
  ],
  /** 前に勝った */
  won: ['{when}の{title}では、ずいぶんあっさり逃げ帰ったな。', 'また負けに来たのか。{when}を思い出せ。'],
  /** 前に負けた（傷はない） */
  lost: ['{when}の{title}の屈辱、今日こそ晴らす。', 'あの日の負けは、たまたまだ。今日で証明してやる。'],
  /** 執着している生徒が戦場にいる */
  grudge: [
    '{a}！ どこだ、{a}！ お前だけは、この手で倒す！',
    '{a}……お前の顔は、夢にまで出てきたぞ。',
    'ほかの者はどうでもいい。{a}を出せ！',
  ],
};

/** 傷の見た目（回数ごと） */
export const SCAR_TEXT = ['', '頬に新しい傷跡がある', '額に包帯を巻いている', '片目を眼帯で覆っている', '体じゅう傷だらけだ'];
/** 傷を負って戻ったときの地の文 */
export const SCAR_RETURN = ['{leader}が戻ってきた。{scar}。', '傷を負った{leader}が、再び兵を率いて現れた。{scar}。'];

/** 仇討ちの誓い（生徒のセリフ） */
export const VOW_SAY: ByP = {
  hot: '{v}の仇だ……！ {leader}、お前だけは絶対に許さねえ！',
  calm: '……{v}を傷つけたのは、あなたですね。ここで終わらせます。',
  timid: 'こ、怖い……でも、{v}のために、逃げない……！',
  cynic: '{v}の借り、きっちり返してもらうよ。利子つきでね。',
  gentle: '{v}は、優しい子なんです。……どうして、あんなことを。',
  serious: '{v}の無念は、私が晴らします。覚悟してください。',
  cheerful: '……今日は、笑えないや。{v}の分まで戦う。',
  shy: '{v}、見てて。わたし、やるから。',
  competitive: '{v}を倒したやつに、負けてたまるか！',
  whimsical: '{v}のこと、忘れてないよ。……だから、今日は本気。',
};
export const VOW_NARR = ['{a}の目が変わった。{leader}は、仲間の{v}を傷つけた相手だ。', '{a}は、{v}の仇を前にして、静かに武器を握りしめた。'];

/** 宿敵（段階2以上）と再会したときの生徒のセリフ */
export const RIVAL_SAY: ByP = {
  hot: 'また会ったな、{leader}！ 今日こそ決着だ！',
  calm: '{leader}……あなたの手の内は、もう分かっています。',
  timid: 'また、{leader}……。でも、前よりは怖くない。',
  cynic: '腐れ縁ってやつかな、{leader}。',
  gentle: '{leader}さん……どうして、いつもこうなるんでしょう。',
  serious: '{leader}。何度でも、正面から受けて立ちます。',
  cheerful: 'やっほー、{leader}！ ……なんて言ってる場合じゃないか。',
  shy: '{leader}、また、あの人だ。',
  competitive: '{leader}！ 前の続きだ、今度は負けない！',
  whimsical: 'あ、{leader}だ。今日はどっちが勝つかな。',
};
export const RIVAL_LEADER = ['また貴様か、{a}。……もう、他人とは思えんな。', '{a}。お前と会うのは何度目だ？ 数えるのもやめた。', '待っていたぞ、{a}。お前以外の相手では、もう物足りん。'];

/** 決着の場面（二人だけの特別な場面） */
export const SETTLE_TEXT = {
  title: '宿命の対決',
  narr: ['戦場のざわめきが、遠くなった。{a}と{leader}が、まっすぐ向かい合う。', '{a}と{leader}。何度も刃を交えた二人の間に、もう言葉はいらなかった。'],
  prompt: '{a}と宿敵{leader}が向かい合っている。決着のつけ方を選んでください',
  persuade: '{a}に説得させる', persuadeNote: '剣を置かせられれば、誰も傷つかずに終わる（見込み：{chance}）',
  duel: '一騎打ちで決着をつける', duelNote: '勝てば{leader}は敗北を認める（勝ち目：{chance}）',
  kill: '全員で討ち取る', killNote: '仲間全員で{leader}を狙う。逃げ道はふさぐ',
  spare: '見逃す', spareNote: '{leader}は戦場を去る。もう二度と会わないかもしれない',
};
export const SETTLE_RESULT = {
  persuadeOk: ['{a}の言葉に、{leader}は長い間黙っていた。やがて、静かに武器を地面に置いた。', '「……お前に負けたのではない。お前の言葉に負けたのだ」{leader}は剣を収め、去っていった。'],
  persuadeNg: ['{a}の言葉は、{leader}に届かなかった。「甘いな」——戦いは続く。'],
  duelWin: ['{a}の一撃が、{leader}の武器をはね飛ばした。{leader}は膝をつき、敗北を認めた。'],
  duelLose: ['{leader}の刃が{a}をとらえた。{a}は膝をついた。……決着は、また次の戦いに持ちこされた。'],
  duelDraw: ['二人の打ち合いは、どちらも譲らないまま終わった。'],
  kill: ['「{leader}を逃がすな！」仲間たちが{leader}を取り囲む。'],
  killed: ['{leader}が倒れた。{a}は、しばらくその場を動けなかった。'],
  spare: ['{a}は武器を下ろした。「行け」——{leader}は一瞬だけ{a}を見つめ、背を向けて去っていった。'],
};
/** 決着のときの敵将の口上 */
export const SETTLE_LEADER: Record<LeaderPersonality, string[]> = {
  arrogant: ['いいだろう、{a}。お前との因縁、ここで終わらせてやる。'],
  veteran: ['……長い付き合いになったな、{a}。そろそろ、けりをつけようか。'],
  cunning: ['ふふ、{a}。お前だけは、どんな手を使っても……いや、今日くらいは正面からいこう。'],
  proud: ['{a}。お前ほどの相手に会えたことを、誇りに思う。……参る！'],
  young: ['{a}！ お前を越えなきゃ、俺は前に進めないんだ！'],
  cold: ['{a}。お前は、私の計算をいつも狂わせる。……ここで消えてもらう。'],
  beast: ['（獣は低くうなり、{a}だけを見ている）'],
};
/** 決着のあとの生徒のセリフ */
export const SETTLE_SAY: Record<'persuade' | 'duel' | 'kill' | 'spare', string[]> = {
  persuade: ['……分かってくれて、よかった。', 'もう、戦わなくていいんだ。'],
  duel: ['……勝った。やっと、勝てた。', 'これで、終わりにしよう。'],
  kill: ['……終わった。', 'これでよかったんだ……よね。'],
  spare: ['次に会うときは、敵じゃないといいな。', '……行って。'],
};

/** 卒業生が敵将として現れたときの口上（先生への言葉） */
export const ALUMNI_LEADER = {
  open: ['先生……まさか、こんな形でお会いするなんて。', '先生。私は今、{country}の{rankName}です。……引くわけにはいきません。', 'お久しぶりです、先生。手加減は、なしでお願いします。'],
  friend: ['{friend}は元気ですか。あの頃のことを、今でも夢に見るんです。', '{friend}と過ごした日々は、私の宝物です。……だから、つらい。'],
  farewell: ['卒業式の日、私は「{farewell}」と言いました。……覚えていますか。', '「{farewell}」——あの日の言葉は、嘘じゃありません。'],
  interview: ['先生の部屋で話した夜のこと、覚えています。あの言葉が、今の私を支えています。'],
  again: ['また、先生の教え子たちと戦うことになるとは……。', '先生の育てた子たちは、本当に強い。私が一番よく知っています。'],
  persuadeOk: ['……先生には、かなわないな。分かりました。剣を置きます。'],
  persuadeNg: ['ごめんなさい、先生。私にも、守りたいものがあるんです。'],
};

/** 頭（いちばん上）の性格で変わる、陣営の空気（開戦の地の文） */
export const HEAD_TEXT: Record<LeaderPersonality, string[]> = {
  arrogant: ['{faction}の頭、{head}は力ずくを好む。兵たちの目もぎらついている。'],
  veteran: ['{faction}を束ねる{head}は、無駄な戦を嫌う古強者だ。敵兵の動きに乱れがない。'],
  cunning: ['{faction}の頭、{head}は策を好む。どこに罠があってもおかしくない。'],
  proud: ['{faction}の{head}は、正々堂々を重んじるという。兵たちも名乗りを上げて進んでくる。'],
  young: ['{faction}の新しい頭、{head}は手柄を急いでいる。兵たちもどこか浮き足立っている。'],
  cold: ['{faction}の{head}は、兵を駒としか見ないらしい。敵兵は黙々と迫ってくる。'],
  beast: [''],
};

/** 執着：敵将がその子を狙っている判断 */
export const GRUDGE_CHOICE = {
  prompt: '{leader}は{a}だけを狙っている！',
  guard: '{a}を後ろへ下げて守る', guardNote: '{a}は守りを固める。ほかの子の負担が増える',
  face: '{a}に迎え撃たせる', faceNote: '{a}の気迫が上がる。そのぶん危険もある',
  bait: '{a}をおとりに、横から突く', baitNote: '仲間の命中が上がる。{a}はさらに狙われる',
};
export const GRUDGE_RESULT = {
  guard: ['{a}は後ろへ下がり、仲間たちが前に出た。{leader}が舌打ちする。'],
  face: ['「逃げない」——{a}は{leader}の前に立ちはだかった。'],
  bait: ['{a}が{leader}を引きつけるあいだに、仲間たちが横から回りこんだ。'],
};

/** 隠れた特徴が戦いの中で分かったとき */
export const TRAIT_REVEAL: Record<string, string> = {
  fire_weak: '{a}の魔法の炎に、{leader}の顔色が変わった。どうやら炎に弱いらしい。',
  bow_fear: '飛んできた矢に、{leader}が大きくのけぞった。弓を恐れているようだ。',
  duel_bound: '{leader}は一騎打ちと聞くと、目の色を変えた。挑まれれば断れない性分らしい。',
  night_strong: '霧の中の{leader}は、まるで影のようだった。夜や霧の戦いを得意としている。',
  loyal: '{leader}は倒れた部下をかばって前に出た。仲間を見捨てない人らしい。',
  rain_hate: '{leader}は雨に濡れて、ひどくいら立っている。雨が嫌いらしい。',
  hothead: '少しあおられただけで、{leader}は前に出すぎた。挑発に乗りやすいようだ。',
  cautious: '形勢が傾いたとたん、{leader}は退く構えを見せた。逃げ足が速い。',
  flier_weak: '空からの攻めに、{leader}はまるで備えていなかった。',
  sword_master: '{a}の剣が、ことごとく読まれた。{leader}は剣の達人だ。',
  iron_wall: '{leader}の守りは固い。だが、魔法の一撃には顔をゆがめた。',
  charisma: '{leader}の一声で、敵兵が奮い立った。部下に慕われているようだ。',
  old_wound: '{leader}の動きが、ときおり鈍る。古傷が痛むらしい。',
};
/** 分かった弱点を突いたとき（結果の画面） */
export const EXPLOIT_TEXT = '{leader}の弱点「{trait}」を突いた';

/** 偵察 */
export const SCOUT_TEXT = {
  button: '偵察を出す', note: '今回の出撃は1人少なくなります。敵将の特徴が1つ分かります',
  scoutNote: '斥候の{a}が偵察に出ます（出撃の人数は減りません）',
  done: '偵察の報告：{leader}は「{trait}」らしい。{tip}',
  none: '偵察の報告：{leader}について、これ以上は分からなかった。',
};

/** 卒業生からの手紙（特徴が分かる） */
export const LETTER_TEXT = {
  title: '敵将のうわさ',
  body: [
    '先生へ。{place}で、{leader}（{faction}）のうわさを聞きました。{desc}そうです。戦うときは「{trait}」に気をつけて（うまく使って）ください。—{a}',
    '先生、お元気ですか。{faction}の{leader}について、確かな話を仕入れました。{leader}は{desc}とのこと。「{trait}」——きっと役に立つはずです。—{a}',
  ],
};

/** 年鑑・新聞の記録 */
export const OFFICER_NEWS = {
  epithet: '{faction}の{old}が「{name}」と呼ばれるようになった',
  promote: '{faction}の{name}が{rank}に昇進した',
  head: '{faction}の{rank}に{name}が就いた（性格：{pers}）',
  struggle: '{faction}で権力争い。{name}が{rank}の座を勝ち取り、{loser}は去った',
  contest: '{faction}で権力争い。{name}が{rank}の座をねらっている',
  contestLost: '{faction}の権力争いは、{rank}が退けた。{name}の野心はついえた',
  raised: '{faction}の{rank}に、一兵卒だった{name}が抜擢された',
  retire: '{faction}の{name}が引退した',
  alumni: '卒業生の{a}が、{faction}の{rank}として名を連ねた',
  fell: '{faction}の{name}を討ち取った',
  settle: { persuade: '{a}が宿敵{name}を説き伏せ、因縁に決着がついた', duel: '{a}が一騎打ちで宿敵{name}を破り、因縁に決着がついた', kill: '{a}たちが宿敵{name}を討ち取り、因縁に決着がついた', spare: '{a}は宿敵{name}を見逃した。{name}は戦場を去った' },
  rival: '{a}と{name}が{stage}に',
  vow: '{a}が、{v}の仇{name}に誓いを立てた',
};
