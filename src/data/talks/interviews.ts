// 先生との面談の流れ（話題×流れ×口調）。a＝生徒、t＝先生、n＝地の文。
// 生徒のセリフは phrases_iv.ts（10性格）、先生のセリフは下の TEACHER_PHRASES（教官の経歴4種）。
// 先生のセリフの差し込み：{you}＝生徒の名前、{your…}＝生徒のもの（{yourSkill} {yourHint} {yourHome} …）
import type { TalkLine, TalkCond } from '../../core/types';

export type InterviewTopic = 'recent' | 'worry' | 'career' | 'class' | 'retain' | 'consult' | 'x40' | 'x70' | 'x90';

export interface InterviewChoiceDef {
  label: string;
  lines: TalkLine[];
  effect: { trust?: number; motivation?: number; fatigue?: number };
}
export interface InterviewDef {
  id: string;
  topic: InterviewTopic;
  title: string;
  when?: TalkCond;
  lines: TalkLine[];
  choice?: { prompt: string; options: InterviewChoiceDef[] };
}

const has = (flag: string, then: string, els: TalkLine['say']): TalkLine['say'] => ({ if: { flag }, then, else: els });

export const INTERVIEWS: InterviewDef[] = [
  // ---------- 近況（その1：稽古と仲間） ----------
  {
    id: 'recent1', topic: 'recent', title: '近況',
    lines: [
      { by: 'n', say: 'n_iv_call' },
      { by: 't', say: 't_r_open' },
      { by: 'a', say: { if: { a: { highMood: true } }, then: 'iv_r_good', else: { if: { a: { tired: true } }, then: 'iv_r_tired', else: 'iv_r_ok' } } },
      { by: 't', say: 't_r_skill' },
      { by: 'a', say: { if: { a: { talent: true } }, then: 'iv_r_skill_talent', else: 'iv_r_skill' } },
      { by: 't', say: 't_r_friends' },
      { by: 'a', say: { if: { a: { hasFriend: true } }, then: 'iv_r_friend_yes', else: 'iv_r_friend_no' } },
      { by: 't', say: { if: { a: { hasFriend: true } }, then: 't_r_friend_good', else: 't_r_friend_push' } },
      { by: 'a', say: 'iv_r_thanks' },
      { by: 't', say: 't_r_close' },
    ],
  },
  // ---------- 近況（その2：食べものと故郷） ----------
  {
    id: 'recent2', topic: 'recent', title: '散歩のついでに',
    lines: [
      { by: 'n', say: 'n_iv_walk' },
      { by: 't', say: 't_r2_open' },
      { by: 'a', say: 'iv_r2_yes' },
      { by: 't', say: 't_r2_food' },
      { by: 'a', say: 'iv_r2_food' },
      { by: 't', say: 't_r2_home' },
      { by: 'a', say: { if: { a: { house: 'orphan' } }, then: 'iv_r2_home_orphan', else: 'iv_r2_home' } },
      { by: 't', say: 't_r2_listen' },
      { by: 'a', say: 'iv_r2_laugh' },
      { by: 't', say: 't_r2_close' },
    ],
  },
  // ---------- 近況（その3：先生も学んでいる） ----------
  {
    id: 'recent3', topic: 'recent', title: '先生の勉強',
    lines: [
      { by: 'n', say: 'n_iv_call' },
      { by: 't', say: 't_r3_open' },
      { by: 'a', say: 'iv_r3_surprise' },
      { by: 't', say: 't_r3_learn' },
      { by: 'a', say: { if: { a: { talent: true } }, then: 'iv_r3_teach_talent', else: 'iv_r3_teach' } },
      { by: 't', say: 't_r3_ask' },
      { by: 'a', say: 'iv_r3_proud' },
      { by: 't', say: 't_r3_close' },
      { by: 'a', say: 'iv_r_thanks' },
    ],
  },
  // ---------- 悩み（やる気が低いとき） ----------
  {
    id: 'worry1', topic: 'worry', title: '悩み',
    lines: [
      { by: 'n', say: 'n_iv_call' },
      { by: 't', say: 't_w_open' },
      { by: 'a', say: 'iv_w_quiet' },
      { by: 't', say: 't_w_wait' },
      { by: 'a', say: { if: { a: { tired: true } }, then: 'iv_w_confess_tired', else: { if: { a: { hasFriend: true } }, then: 'iv_w_confess_compare', else: 'iv_w_confess_alone' } } },
      { by: 't', say: 't_w_ask' },
      { by: 'a', say: 'iv_w_want' },
    ],
    choice: {
      prompt: '先生の返事を選ぶ',
      options: [
        { label: '「お前はちゃんと伸びている」と励ます', effect: { motivation: 1 }, lines: [{ by: 't', say: 't_w_a' }, { by: 'a', say: 'iv_w_after_a' }, { by: 't', say: 't_w_close' }] },
        { label: '「一緒に稽古を組み立てよう」と誘う', effect: { trust: 3 }, lines: [{ by: 't', say: 't_w_b' }, { by: 'a', say: 'iv_w_after_b' }, { by: 't', say: 't_w_close' }] },
        { label: '「今週は少し休め」と休ませる', effect: { fatigue: -12, trust: 1 }, lines: [{ by: 't', say: 't_w_c' }, { by: 'a', say: 'iv_w_after_c' }, { by: 't', say: 't_w_close' }] },
      ],
    },
  },
  // ---------- 進路（3年生） ----------
  {
    id: 'career1', topic: 'career', title: '進路',
    lines: [
      { by: 'n', say: 'n_iv_call' },
      { by: 't', say: 't_c_open' },
      { by: 'a', say: { if: { a: { hasDream: true } }, then: 'iv_c_dream', else: 'iv_c_nodream' } },
      { by: 't', say: { if: { a: { hasDream: true } }, then: 't_c_dream_ask', else: 't_c_nodream_ask' } },
      { by: 'a', say: { if: { a: { hasDream: true } }, then: 'iv_c_dream_why', else: 'iv_c_nodream_more' } },
      { by: 't', say: { if: { stage: 'war' }, then: 't_c_war_war', else: 't_c_war_peace' } },
      { by: 'a', say: 'iv_c_fear' },
    ],
    choice: {
      prompt: '先生の返事を選ぶ',
      options: [
        { label: '夢を後押しする', effect: { motivation: 1 }, lines: [{ by: 't', say: 't_c_a' }, { by: 'a', say: 'iv_c_after_a' }, { by: 't', say: 't_c_close' }] },
        { label: 'どの国に仕えるか、よく考えさせる', effect: { trust: 3 }, lines: [{ by: 't', say: 't_c_b' }, { by: 'a', say: 'iv_c_after_b' }, { by: 't', say: 't_c_close' }] },
        { label: '「最後は自分で決めなさい」と任せる', effect: { trust: 2 }, lines: [{ by: 't', say: 't_c_c' }, { by: 'a', say: 'iv_c_after_c' }, { by: 't', say: 't_c_close' }] },
      ],
    },
  },
  // ---------- 兵種（才能のヒント） ----------
  {
    id: 'class1', topic: 'class', title: '兵種の相談',
    lines: [
      { by: 'n', say: 'n_iv_call' },
      { by: 't', say: 't_k_open' },
      { by: 'a', say: 'iv_k_open' },
      { by: 't', say: 't_k_hint' },
      { by: 'a', say: 'iv_k_hint_react' },
      { by: 't', say: 't_k_suggest' },
      { by: 'a', say: 'iv_k_want' },
      { by: 't', say: 't_k_close' },
      { by: 'a', say: 'iv_k_thanks' },
    ],
  },
  // ---------- 引き止め（退学の予兆） ----------
  {
    id: 'retain1', topic: 'retain', title: '引き止め',
    lines: [
      { by: 'n', say: 'n_iv_retain' },
      { by: 't', say: 't_t_open' },
      { by: 'a', say: 'iv_t_silent' },
      { by: 't', say: 't_t_ask' },
      { by: 'a', say: has('reason_family', 'iv_t_family', has('reason_poach', 'iv_t_poach', has('reason_homewar', 'iv_t_homewar', 'iv_t_motivation'))) },
      { by: 't', say: has('reason_family', 't_t_family', has('reason_poach', 't_t_poach', has('reason_homewar', 't_t_homewar', 't_t_motivation'))) },
    ],
    choice: {
      prompt: '先生の返事を選ぶ',
      options: [
        { label: '「ここにいてほしい」と伝える', effect: { trust: 2 }, lines: [{ by: 't', say: 't_t_a' }, { by: 'a', say: has('cleared', 'iv_t_stay', 'iv_t_think') }, { by: 't', say: has('cleared', 't_t_glad', 't_t_again') }] },
        { label: '本当の気持ちを聞く', effect: { motivation: 1 }, lines: [{ by: 't', say: 't_t_b' }, { by: 'a', say: has('cleared', 'iv_t_stay', 'iv_t_think') }, { by: 't', say: has('cleared', 't_t_glad', 't_t_again') }] },
        { label: '「一人で抱えるな」と手を貸す', effect: { trust: 1, motivation: 1 }, lines: [{ by: 't', say: 't_t_c' }, { by: 'a', say: has('cleared', 'iv_t_stay', 'iv_t_think') }, { by: 't', say: has('cleared', 't_t_glad', 't_t_again') }] },
      ],
    },
  },
  // ---------- 相談（生徒から来たとき） ----------
  {
    id: 'consult1', topic: 'consult', title: '相談',
    lines: [
      { by: 'n', say: 'n_iv_consult' },
      { by: 'a', say: 'iv_s_open' },
      { by: 't', say: 't_s_open' },
      { by: 'a', say: has('s_study', 'iv_s_study', has('s_friend', 'iv_s_friend', has('s_home', 'iv_s_home', 'iv_s_tired'))) },
      { by: 't', say: has('s_study', 't_s_study', has('s_friend', 't_s_friend', has('s_home', 't_s_home', 't_s_tired'))) },
      { by: 'a', say: has('s_study', 'iv_s_study2', has('s_friend', 'iv_s_friend2', has('s_home', 'iv_s_home2', 'iv_s_tired2'))) },
      { by: 't', say: has('s_study', 't_s_study_adv', has('s_friend', 't_s_friend_adv', has('s_home', 't_s_home_adv', 't_s_tired_adv'))) },
      { by: 'a', say: 'iv_s_thanks' },
      { by: 't', say: 't_s_close' },
    ],
  },
  // ---------- 特別な面談：信頼40（過去の話） ----------
  {
    id: 'x40', topic: 'x40', title: '昔の話',
    lines: [
      { by: 'n', say: 'n_iv_x40' },
      { by: 'a', say: 'iv_x40_open' },
      { by: 't', say: 't_x40_open' },
      { by: 'a', say: 'iv_x40_home' },
      { by: 't', say: 't_x40_home' },
      { by: 'a', say: { if: { a: { house: 'noble' } }, then: 'iv_x40_noble', else: { if: { a: { house: 'orphan' } }, then: 'iv_x40_orphan', else: 'iv_x40_commoner' } } },
      { by: 't', say: { if: { a: { house: 'noble' } }, then: 't_x40_noble', else: { if: { a: { house: 'orphan' } }, then: 't_x40_orphan', else: 't_x40_commoner' } } },
      { by: 'a', say: { if: { a: { origin: 'frontier' } }, then: 'iv_x40_frontier', else: 'iv_x40_country' } },
      { by: 't', say: 't_x40_listen' },
      { by: 'a', say: 'iv_x40_close' },
    ],
  },
  // ---------- 特別な面談：信頼70（本音） ----------
  {
    id: 'x70', topic: 'x70', title: '本音',
    lines: [
      { by: 'n', say: 'n_iv_x70' },
      { by: 'a', say: 'iv_x70_open' },
      { by: 't', say: 't_x70_open' },
      { by: 'a', say: { if: { a: { hasDream: true } }, then: 'iv_x70_dream_why', else: 'iv_x70_nodream_fear' } },
      { by: 't', say: { if: { a: { hasDream: true } }, then: 't_x70_dream', else: 't_x70_nodream' } },
      { by: 'a', say: 'iv_x70_flaw' },
      { by: 't', say: 't_x70_past' },
      { by: 'a', say: 'iv_x70_surprise' },
      { by: 't', say: 't_x70_close' },
      { by: 'a', say: 'iv_x70_thanks' },
    ],
  },
  // ---------- 特別な面談：信頼90（約束） ----------
  {
    id: 'x90', topic: 'x90', title: '約束',
    lines: [
      { by: 'n', say: 'n_iv_x90' },
      { by: 't', say: 't_x90_open' },
      { by: 'a', say: 'iv_x90_open' },
      { by: 't', say: 't_x90_ask' },
      { by: 'a', say: 'iv_x90_memory' },
      { by: 'a', say: 'iv_x90_feeling' },
      { by: 't', say: 't_x90_moved' },
    ],
    choice: {
      prompt: '先生の返事を選ぶ',
      options: [
        { label: '「お前は私の誇りだ」と伝える', effect: { motivation: 1 }, lines: [{ by: 't', say: 't_x90_a' }, { by: 'a', say: 'iv_x90_after_a' }, { by: 't', say: 't_x90_close' }] },
        { label: '「どこにいても手紙を書け」と約束する', effect: { trust: 3 }, lines: [{ by: 't', say: 't_x90_b' }, { by: 'a', say: 'iv_x90_after_b' }, { by: 't', say: 't_x90_close' }] },
        { label: '照れくさくて、笑ってごまかす', effect: { trust: 2 }, lines: [{ by: 't', say: 't_x90_c' }, { by: 'a', say: 'iv_x90_after_c' }, { by: 't', say: 't_x90_close' }] },
      ],
    },
  },
];

/** 地の文（性格によらない） */
export const IV_NARR: Record<string, string> = {
  n_iv_call: '（放課後、{teacher}は{me}を教官室に呼んだ）',
  n_iv_walk: '（{scene}で、{teacher}は{me}を見かけて声をかけた）',
  n_iv_retain: '（{me}の表情は硬い。{teacher}は静かに教官室の扉を閉めた）',
  n_iv_consult: '（放課後、{me}が教官室の扉をそっと叩いた）',
  n_iv_x40: '（夜の見回りの途中、{teacher}は灯りのついた教室で、ひとり座っている{me}を見つけた）',
  n_iv_x70: '（{scene}。{me}は珍しく、自分から{teacher}の隣に腰を下ろした）',
  n_iv_x90: '（{season}の夕暮れ。{teacher}は、訓練場の片隅に立つ{me}に歩み寄った）',
};

/** 先生のセリフ：教官の経歴ごと（knight＝元王国騎士、merc＝元帝国の傭兵、mage＝元同盟の宮廷魔道士、wanderer＝流れの旅人） */
export type TeacherBg = 'knight' | 'merc' | 'mage' | 'wanderer';
export const TEACHER_PHRASES: Record<string, Record<TeacherBg, string>> = {
  // 近況1
  t_r_open: { knight: '{you}、座りなさい。最近の調子はどうだ。', merc: 'よう、{you}。まあ座れ。最近どうだ？', mage: '{you}、どうぞ座って。最近の調子はいかがですか。', wanderer: 'やあ、{you}。急に呼んで悪いね。最近どう？' },
  t_r_skill: { knight: '{yourSkill}の稽古を見ている。構えがしっかりしてきたな。', merc: '{yourSkill}、だいぶ様になってきたじゃねえか。', mage: '{yourSkill}の授業での様子、見ていますよ。伸びてきましたね。', wanderer: '{yourSkill}の稽古、ちらっと見たよ。前よりずっといい。' },
  t_r_friends: { knight: '仲間とはうまくやれているか。戦場では背中を預ける相手だ。', merc: '仲間とはどうだ？ 戦場じゃ隣のやつが命綱だぞ。', mage: '仲間とはうまく過ごせていますか。', wanderer: '友だちとはどう？ うまくやれてる？' },
  t_r_friend_good: { knight: 'よい仲間を持ったな。その縁を大切にしなさい。', merc: 'いいじゃねえか。そういう相手は一生ものだ。', mage: 'それは何よりです。互いに学び合えるといいですね。', wanderer: 'いいね。そういう相手がいると、旅も学校も楽しくなる。' },
  t_r_friend_push: { knight: '焦らずともよい。だが、自分から声をかけてみるのも勇気だ。', merc: '一匹で戦うのは楽じゃねえぞ。今度の週末、誰か誘ってみな。', mage: '急がなくて大丈夫。お茶会にでも誘ってみてはどうでしょう。', wanderer: 'まあ、ゆっくりでいいさ。気が合いそうな子、きっといるよ。' },
  t_r_close: { knight: '今日はこれまでだ。体を休めなさい。', merc: 'よし、話は終わりだ。飯食って寝ろ。', mage: '話してくれてありがとう。今日はゆっくり休んでくださいね。', wanderer: 'ありがと。じゃ、また明日ね。' },
  // 近況2
  t_r2_open: { knight: '{you}、少し歩かないか。たまには外の空気もいい。', merc: 'おう、{you}。ちょっと付き合え、散歩だ。', mage: '{you}、少し一緒に歩きませんか。', wanderer: '{you}、ちょっと散歩しない？ いい天気だし。' },
  t_r2_food: { knight: '食堂の食事には慣れたか。', merc: 'ここの飯には慣れたか？ まずくはねえだろ。', mage: '食堂の食事は口に合っていますか。', wanderer: 'ここのご飯、もう慣れた？' },
  t_r2_home: { knight: '{yourHome}の出だったな。どんなところだ。', merc: 'お前、{yourHome}の出だったよな。どんなとこだ？', mage: '{yourHome}の出身でしたね。どんなところなのですか。', wanderer: '{yourHome}の出だっけ。どんなところ？ 行ったことないんだ。' },
  t_r2_listen: { knight: '良い故郷だ。守りたいと思う場所があるのは、強さになる。', merc: 'へえ、いいとこじゃねえか。いつか行ってみたいもんだ。', mage: '目に浮かぶようです。いつか話の続きを聞かせてください。', wanderer: 'いいなあ。旅の行き先に加えておくよ。' },
  t_r2_close: { knight: 'そろそろ戻るか。冷えてきた。', merc: 'さて、戻るか。腹が減った。', mage: 'そろそろ戻りましょうか。良い散歩でした。', wanderer: 'さ、戻ろっか。いい話が聞けたよ。' },
  // 近況3
  t_r3_open: { knight: '{you}、実はな、私も今{yourSkill}を学び直しているのだ。', merc: 'なあ{you}。笑うなよ、俺も今{yourSkill}を勉強し直してんだ。', mage: '{you}、実は私も、{yourSkill}をもう一度学び直しているところなのです。', wanderer: '{you}、聞いてよ。最近{yourSkill}を勉強し直してるんだ。' },
  t_r3_learn: { knight: '教えるというのは、教わるより多くを学ぶものだ。お前たちのおかげで、私の腕も上がっている。', merc: '教えてると、こっちが教わることばっかりでな。おかげで腕が上がってきた。', mage: '人に教えるたびに、自分の理解の浅さに気づかされます。あなたたちが私の先生でもあるのですよ。', wanderer: '教えるたびに、こっちが教わってる気がするんだ。おかげでちょっとずつ上達してる。' },
  t_r3_ask: { knight: 'そこでだ。お前の得意なことを、今度私に教えてくれないか。', merc: 'でよ、お前の得意なやつ、今度俺にも教えてくれ。', mage: 'ですから、今度はあなたの得意なことを私に教えてくれませんか。', wanderer: 'だからさ、今度{you}の得意なこと、教えてよ。' },
  t_r3_close: { knight: '楽しみにしている。……ありがとう、{you}。', merc: '約束だぞ。楽しみにしてる。', mage: '楽しみにしていますね。ありがとう、{you}。', wanderer: 'よし、決まり。楽しみにしてるよ。' },
  // 悩み
  t_w_open: { knight: '{you}、元気がないな。何かあったのか。', merc: '浮かねえ顔だな、{you}。何があった？', mage: '{you}、少し元気がないように見えます。何かありましたか。', wanderer: '{you}、最近ちょっと元気ないね。どうしたの？' },
  t_w_wait: { knight: '急がなくてよい。話せることだけで構わない。', merc: '急がなくていい。言えることだけ言え。', mage: '急がなくて大丈夫ですよ。話せることだけで。', wanderer: 'ゆっくりでいいよ。ここには誰も来ないから。' },
  t_w_ask: { knight: 'そうか……。それで、お前はどうしたい。', merc: 'なるほどな。で、お前はどうしたいんだ？', mage: 'そうでしたか……。{you}は、どうなりたいですか。', wanderer: 'そっか。それで、{you}はどうしたい？' },
  t_w_a: { knight: 'お前はちゃんと伸びている。私が保証する。胸を張りなさい。', merc: 'お前は伸びてる。傭兵の目は節穴じゃねえ。自信持て。', mage: 'あなたは確かに伸びています。私が毎日見ていますから。', wanderer: '大丈夫、ちゃんと伸びてるよ。旅人の勘は当たるんだ。' },
  t_w_b: { knight: 'ならば、来週の稽古は私と一緒に組み立てよう。', merc: 'なら来週の稽古、一緒に組み立てるぞ。', mage: 'では来週の学び方を、一緒に考えましょう。', wanderer: 'じゃあ来週の稽古、一緒に考えよっか。' },
  t_w_c: { knight: '今週は少し休め。焦ると、伸びるものも伸びぬ。', merc: '今週は休め。疲れた体じゃ刃も鈍る。', mage: '今週は少し休みましょう。心も体も、休むことで整います。', wanderer: '今週はちょっと休もう。たまには立ち止まるのも旅のうちさ。' },
  t_w_close: { knight: '困ったら、いつでもここへ来なさい。', merc: 'また何かあったら来い。扉は開けとく。', mage: 'いつでも話しに来てくださいね。', wanderer: 'また話そ。いつでもいいからさ。' },
  // 進路
  t_c_open: { knight: '卒業まであと少しだな。進む道は考えているか。', merc: 'もうすぐ卒業だな。どこへ行くか決めたか？', mage: '卒業が近づいてきましたね。進む道は考えていますか。', wanderer: 'もうすぐ卒業だね。行き先は決まった？' },
  t_c_dream_ask: { knight: 'なぜそう思うようになったのだ。', merc: 'へえ。なんでそう思うようになった？', mage: 'そう思うようになったきっかけは、何だったのですか。', wanderer: 'いいね。どうしてそう思ったの？' },
  t_c_nodream_ask: { knight: '迷っているなら、それも答えのひとつだ。', merc: '決まってねえのか。まあ、それも悪くねえ。', mage: '迷うのは、真剣に考えている証拠です。', wanderer: '決まってないか。それもありだよ。' },
  t_c_war_war: { knight: '今の大陸は荒れている。どの道を選んでも、戦場は近い。', merc: '今は戦の真っ最中だ。どこへ行っても血を見る覚悟がいる。', mage: '今の大陸は戦の只中です。どの国に仕えても、無関係ではいられません。', wanderer: '今は戦が激しい。どこへ行っても、きっと戦場に近い。' },
  t_c_war_peace: { knight: 'どの国に仕えても、いつか教え子どうしが向き合う日が来るかもしれぬ。', merc: 'どこの軍に入っても、いつか同期とぶつかるかもしれねえ。', mage: 'どの国に仕えても、いつか教え子どうしが戦場で向き合うかもしれません。', wanderer: 'どこに行っても、いつか仲間と敵どうしになるかもしれない。' },
  t_c_a: { knight: 'その夢は立派だ。まっすぐ進みなさい。私が背中を押す。', merc: 'いい夢じゃねえか。迷わず行け。', mage: '素晴らしい夢です。その道を歩むあなたを、誇りに思います。', wanderer: 'いいじゃない。その夢、追いかけなよ。' },
  t_c_b: { knight: 'どの国に仕えるかで、剣を向ける相手も変わる。よく考えなさい。', merc: 'どこの旗の下に立つかで、斬る相手が変わる。よく考えろ。', mage: 'どの国に仕えるかで、向き合う相手が変わります。よく考えてください。', wanderer: 'どの国を選ぶかで、ぶつかる相手も変わる。そこは、よく考えて。' },
  t_c_c: { knight: '最後は自分で決めなさい。どの道を選んでも、私はお前を誇りに思う。', merc: '最後はお前が決めろ。どこへ行っても、お前はここの教え子だ。', mage: '最後はあなたが決めることです。どの道でも、私は応援します。', wanderer: '最後は自分で決めな。どこへ行っても、応援してる。' },
  t_c_close: { knight: '卒業の日まで、悔いのないように過ごしなさい。', merc: '残りの日々、しっかり鍛えとけよ。', mage: '卒業の日まで、ひとつずつ積み重ねていきましょう。', wanderer: '残りの時間、楽しんでね。' },
  // 兵種
  t_k_open: { knight: '{yourClass}としての腕はどうだ。手応えはあるか。', merc: '{yourClass}はどうだ？ 板についてきたか？', mage: '{yourClass}としての学びは、順調ですか。', wanderer: '{yourClass}、どう？ しっくりきてる？' },
  t_k_hint: { knight: '見ていて思うのだが、お前は{yourHint}ようだ。', merc: '前から思ってたんだが、お前、{yourHint}んじゃねえか？', mage: '授業を見ていて気づいたのですが、あなたは{yourHint}ようですね。', wanderer: 'なんとなくだけど、{you}って{yourHint}気がするんだよね。' },
  t_k_suggest: { knight: '{yourTalentSkill}を伸ばしてみなさい。思わぬ道が開けるかもしれぬ。', merc: '{yourTalentSkill}、もっとやってみな。化けるかもしれねえぞ。', mage: '{yourTalentSkill}を目標の技能にしてみてはどうでしょう。', wanderer: '{yourTalentSkill}、目標にしてみたら？ 面白くなりそう。' },
  t_k_close: { knight: '兵種の試験は、条件を満たせばいつでも受けられる。準備しておきなさい。', merc: '試験の条件がそろったら、すぐ受けろよ。', mage: '兵種の試験は、条件がそろえば受けられます。焦らず準備しましょう。', wanderer: '試験は条件がそろったら受けられるからね。気楽にいこう。' },
  // 引き止め
  t_t_open: { knight: '{you}。最近、思いつめた顔をしているな。', merc: '{you}、ここんとこ顔色が悪いぞ。', mage: '{you}、最近、何か思いつめているように見えます。', wanderer: '{you}、最近ずっと考えごとしてるね。' },
  t_t_ask: { knight: '……学校を去ることを考えているのか。', merc: 'まさか、学校を辞める気か？', mage: '……もしかして、学校を離れようと考えていますか。', wanderer: 'ひょっとして、ここを出ていくつもり？' },
  t_t_family: { knight: '家の事情か……。家族を思う気持ちは、何より尊い。', merc: '家のことか。そりゃ放っておけねえよな。', mage: 'ご家族のことでしたか……。それは心配でしょう。', wanderer: '家族のことか。それは悩むよね。' },
  t_t_poach: { knight: '他国からの誘いか。お前の力が認められた証でもあるな。', merc: '引き抜きか。腕が認められたってことだ、悪い話じゃねえ。', mage: '他の国からの誘い……。あなたの力が認められたのですね。', wanderer: '誘われたんだ。それだけ評価されてるってことだね。' },
  t_t_homewar: { knight: '故郷が戦場に……。帰りたいと思うのは当然だ。', merc: '故郷が燃えてるのか。そりゃ帰りたくもなる。', mage: '故郷が戦火に……。どれほど不安か、察するに余りあります。', wanderer: '故郷が戦場に……。そりゃ、じっとしていられないよね。' },
  t_t_motivation: { knight: '何をしても身が入らぬ、か。誰にでもそういう時はある。', merc: 'やる気が出ねえ、か。そういう時期は誰にでもある。', mage: '何をしても力が入らない……。そういう時期は誰にでもあります。', wanderer: '何をしても楽しくない、か。そういう時もあるよ。' },
  t_t_a: { knight: '私は、お前にここにいてほしい。それが私の本心だ。', merc: 'お前には、ここにいてほしい。それだけだ。', mage: '私は、あなたにここにいてほしいと思っています。', wanderer: '{you}には、ここにいてほしいな。' },
  t_t_b: { knight: 'お前の本当の気持ちを聞かせてくれ。どんな答えでも受け止める。', merc: 'お前の本音を聞かせろ。どんな答えでも怒りゃしねえ。', mage: 'あなたの本当の気持ちを聞かせてください。どんな答えでも受け止めます。', wanderer: '本当はどうしたいの？ 何を言っても大丈夫だよ。' },
  t_t_c: { knight: '一人で抱えるな。できることがあるなら、私も力を貸す。', merc: '一人で抱え込むな。できることなら何でもする。', mage: '一人で抱え込まないで。私にできることがあれば、手を貸します。', wanderer: '一人で抱えなくていいよ。手伝えることがあったら言って。' },
  t_t_glad: { knight: 'そうか……。よく決めた。共に歩もう。', merc: 'へっ、そうこなくちゃな。', mage: 'ありがとう。一緒に頑張りましょう。', wanderer: 'よかった。これからもよろしくね。' },
  t_t_again: { knight: '答えを急がなくてよい。また話そう。', merc: 'すぐに答えなくていい。また来い。', mage: '答えはすぐでなくて大丈夫です。また話しましょう。', wanderer: 'すぐ決めなくていいよ。また話そう。' },
  // 相談
  t_s_open: { knight: 'ああ、入りなさい。どうした。', merc: 'おう、入れ。どうした？', mage: 'ええ、どうぞ。どうしましたか。', wanderer: 'うん、いいよ。どうしたの？' },
  t_s_study: { knight: '{yourSkill}の伸びが気になるのか。', merc: '{yourSkill}が伸び悩んでる、ってとこか。', mage: '{yourSkill}のことで悩んでいるのですね。', wanderer: '{yourSkill}のことか。' },
  t_s_friend: { knight: '仲間とのことか。', merc: '仲間とケンカでもしたか？', mage: '仲間とのことで、悩んでいるのですね。', wanderer: '友だちのことかな。' },
  t_s_home: { knight: '故郷のことが気がかりか。', merc: '故郷が気になるか。', mage: '故郷のことが心配なのですね。', wanderer: '故郷のことか。' },
  t_s_tired: { knight: '疲れがたまっているな。顔に出ている。', merc: '疲れてんな。顔に書いてあるぞ。', mage: '疲れがたまっているようですね。', wanderer: '疲れてるね。目の下、くまができてるよ。' },
  t_s_study_adv: { knight: '基本の型を毎朝くり返しなさい。積み重ねは裏切らぬ。', merc: '強いやつの動きを盗め。それが一番の近道だ。', mage: '一度、基礎に戻りましょう。分からないところは、いつでも聞いてください。', wanderer: '一つのやり方にこだわらなくていいよ。いろいろ試してみな。' },
  t_s_friend_adv: { knight: '言葉が足りぬだけのことも多い。正面から話してみなさい。', merc: '腹を割って話せ。それでダメなら一発殴り合え。……冗談だ。', mage: 'まずは相手の話を聞いてみましょう。きっと分かり合えます。', wanderer: '一回、二人でお茶でも飲んでみたら？ 案外すぐ戻るよ。' },
  t_s_home_adv: { knight: '手紙を書きなさい。言葉は距離を越える。', merc: '手紙でも書いてやれ。向こうも心配してるさ。', mage: '手紙を書いてみてはどうでしょう。きっと喜ばれます。', wanderer: '手紙、書いてみなよ。届くのを待つ時間も悪くない。' },
  t_s_tired_adv: { knight: '休むのも修練のうちだ。今夜は早く寝なさい。', merc: '寝ろ。それが一番の薬だ。', mage: '今夜はしっかり眠ってください。休むことも学びです。', wanderer: '今日は早く寝なよ。先生が許す。' },
  t_s_close: { knight: 'また何かあれば来なさい。', merc: 'いつでも来い。', mage: 'いつでも相談に来てくださいね。', wanderer: 'また来なよ。' },
  // 信頼40
  t_x40_open: { knight: 'もちろんだ。眠れないのか。', merc: 'ああ、いいぞ。眠れねえのか？', mage: 'ええ、もちろん。眠れないのですか。', wanderer: 'うん、いいよ。眠れないの？' },
  t_x40_home: { knight: 'どんなところだったのだ。', merc: 'どんなとこだった？', mage: 'どんなところだったのですか。', wanderer: 'どんなところ？' },
  t_x40_noble: { knight: '家名を背負うのは重い。私も騎士の家の者として、その重さは知っている。', merc: 'お貴族さまも楽じゃねえんだな。', mage: '家の名を背負うのは、重いことですね。', wanderer: '名家に生まれるのも、大変なんだね。' },
  t_x40_orphan: { knight: '……よく、ここまで来たな。', merc: '……そうか。よく生き抜いてきたな。', mage: '……そうだったのですね。よくここまで来てくれました。', wanderer: '……そっか。がんばってきたんだね。' },
  t_x40_commoner: { knight: '家族を思う心は、何よりの支えになる。', merc: 'いい家族じゃねえか。大事にしろよ。', mage: '温かいご家族なのですね。', wanderer: 'いい家族だね。' },
  t_x40_listen: { knight: '話してくれてありがとう。お前のことが、少し分かった気がする。', merc: '話してくれて、ありがとな。', mage: '話してくれてありがとう。大切な話を聞かせてもらいました。', wanderer: '話してくれてありがとう。ちょっとうれしいよ。' },
  // 信頼70
  t_x70_open: { knight: 'どうした、{you}。', merc: 'なんだ、{you}。珍しいな。', mage: 'どうしましたか、{you}。', wanderer: 'お、{you}。どうしたの？' },
  t_x70_dream: { knight: 'その思いがあれば、どんな困難も越えられる。', merc: 'そういう理由がある夢は、折れねえもんだ。', mage: 'その思いが、あなたの強さの根っこなのですね。', wanderer: 'そういう理由があるなら、きっと叶うよ。' },
  t_x70_nodream: { knight: '何者でもない今だからこそ、何にでもなれる。', merc: '何もねえってことは、何でも拾えるってことだ。', mage: 'まだ何も決まっていないのは、可能性がたくさんあるということです。', wanderer: '何もないってことは、どこへでも行けるってことさ。' },
  t_x70_past: {
    knight: '……私も若い頃、王国の騎士として主君の命に背けず、守れなかった村がある。弱さを知る者だけが、本当に強くなれるのだと思う。',
    merc: '……昔は金のために剣を振ってた。守るもんがなかったからな。お前らに会って、やっと剣の意味を知った気がする。',
    mage: '……私も宮廷にいた頃、言葉だけで人を救えると信じていました。救えなかった人がいます。だから今、ここで教えているのです。',
    wanderer: '……実はね、居場所がなくてずっと旅をしてた。ここに来て、やっと帰る場所ができた気がするんだ。',
  },
  t_x70_close: { knight: 'お前は一人ではない。それを忘れるな。', merc: 'お前は一人じゃねえ。覚えとけ。', mage: 'あなたは一人ではありません。それだけは覚えていてください。', wanderer: '一人じゃないよ。それだけは本当。' },
  // 信頼90
  t_x90_open: { knight: '{you}、少しいいか。', merc: 'よう、{you}。ちょっといいか。', mage: '{you}、少しよろしいですか。', wanderer: '{you}、ちょっといい？' },
  t_x90_ask: { knight: 'この学校に来て、どうだった。', merc: 'ここに来て、どうだった？', mage: 'この学校での日々は、どうでしたか。', wanderer: 'ここに来て、どうだった？' },
  t_x90_moved: { knight: '……そうか。', merc: '……へっ、照れるじゃねえか。', mage: '……ありがとう。', wanderer: '……そっか。' },
  t_x90_a: { knight: 'お前は私の誇りだ。どこへ行っても、胸を張りなさい。', merc: 'お前は自慢の教え子だ。どこへ行っても胸張っとけ。', mage: 'あなたは私の誇りです。どこへ行っても、それは変わりません。', wanderer: '{you}は自慢の教え子だよ。どこへ行っても、ずっと。' },
  t_x90_b: { knight: 'いつか、どこにいても手紙を書きなさい。約束だ。', merc: 'どこにいても、たまには手紙よこせ。約束だぞ。', mage: 'どこにいても、手紙をください。約束ですよ。', wanderer: 'どこにいても手紙ちょうだい。約束ね。' },
  t_x90_c: { knight: '……む。そう真っすぐに言われると、どう返せばよいか分からぬな。', merc: 'よせよ、こっちが照れるだろ。……ははっ。', mage: 'ふふ、そんなふうに言われると、照れてしまいますね。', wanderer: 'あはは、まいったな。照れるよ。' },
  t_x90_close: { knight: 'さあ、戻ろう。皆が待っている。', merc: 'さ、戻るか。腹減っただろ。', mage: 'さあ、戻りましょう。皆が待っています。', wanderer: 'さ、戻ろう。みんな待ってるよ。' },
};
