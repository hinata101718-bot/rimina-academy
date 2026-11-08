// 先生との面談の流れ（話題×流れ×口調）。a＝生徒、t＝先生、n＝地の文。
// 生徒のセリフは phrases_iv.ts（10性格）、先生のセリフは下の TEACHER_PHRASES（教官の経歴4種）。
// 先生のセリフの差し込み：{you}＝生徒の名前、{your…}＝生徒のもの（{yourSkill} {yourHint} {yourHome} {yourLove}＝恋人 {yourSenior}＝卒業生の先輩 …）、{prevTeacher}＝先代の教官
// 面談で自動でつく目印（src/core/interview.ts）：alumni_teacher＝教官がこの学校の卒業生、gen2＝2代目以降、has_love＝恋人がいる、has_alumni＝生きている卒業生がいる、unrest＝緊張期か激戦期
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
/** 教官がこの学校の卒業生なら key_alum（卒業生として話す言い回し）を使う */
const alum = (key: string): TalkLine['say'] => has('alumni_teacher', `${key}_alum`, key);

/** 同じ生徒と最近話した題（記録の新しいものからこの件数）は、できるだけ避ける */
export const IV_AVOID_RECENT = 4;

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
      { by: 't', say: alum('t_r3_learn') },
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
  // ======================================================================
  // 4夜目に増やした面談（近況・悩み）。先生のセリフは、教官がこの学校の卒業生なら *_alum を使う
  // ======================================================================
  // ---------- 近況：友だちのこと（仲のよい仲間がいるとき） ----------
  {
    id: 'recent_friend', topic: 'recent', title: '友だちのこと', when: { a: { hasFriend: true } },
    lines: [
      { by: 'n', say: 'n_iv_call' },
      { by: 't', say: 't_f_open' },
      { by: 'a', say: 'iv4_f_yes' },
      { by: 't', say: 't_f_how' },
      { by: 'a', say: 'iv4_f_good' },
      { by: 'a', say: 'iv4_f_ask' },
      { by: 't', say: alum('t_f_past') },
      { by: 'a', say: 'iv4_f_promise' },
      { by: 't', say: { if: { stage: 'war' }, then: 't_f_close_war', else: 't_f_close' } },
    ],
  },
  // ---------- 近況：授業で分からないところ ----------
  {
    id: 'recent_study', topic: 'recent', title: '分からないところ',
    lines: [
      { by: 'n', say: 'n_iv_call' },
      { by: 't', say: 't_q_open' },
      { by: 'a', say: 'iv4_q_admit' },
      { by: 't', say: 't_q_where' },
      { by: 'a', say: 'iv4_q_where' },
      { by: 't', say: alum('t_q_hint') },
      { by: 'a', say: 'iv4_q_more' },
    ],
    choice: {
      prompt: '先生の返事を選ぶ',
      options: [
        { label: '「一緒に解いてみよう」と付き合う', effect: { trust: 2 }, lines: [{ by: 't', say: 't_q_a' }, { by: 'a', say: 'iv4_q_after_a' }, { by: 't', say: 't_q_close' }] },
        { label: '「分からないと言えたのが偉い」とほめる', effect: { motivation: 1 }, lines: [{ by: 't', say: alum('t_q_b') }, { by: 'a', say: 'iv4_q_after_b' }, { by: 't', say: 't_q_close' }] },
        { label: '「今日はもう寝て、明日考えよう」と休ませる', effect: { fatigue: -8 }, lines: [{ by: 't', say: 't_q_c' }, { by: 'a', say: 'iv4_q_after_c' }, { by: 't', say: 't_q_close' }] },
      ],
    },
  },
  // ---------- 近況：卒業生の先輩のこと（生きている卒業生がいるとき） ----------
  {
    id: 'recent_senior', topic: 'recent', title: '先輩のこと', when: { flag: 'has_alumni' },
    lines: [
      { by: 'n', say: 'n_iv_senior' },
      { by: 't', say: 't_sn_open' },
      { by: 'a', say: 'iv4_sn_ask' },
      { by: 't', say: alum('t_sn_who') },
      { by: 'a', say: 'iv4_sn_admire' },
      { by: 't', say: 't_sn_letter' },
      { by: 'a', say: 'iv4_sn_me' },
      { by: 't', say: alum('t_sn_close') },
      { by: 'a', say: 'iv_r_thanks' },
    ],
  },
  // ---------- 近況：故郷からの便り ----------
  {
    id: 'recent_letter', topic: 'recent', title: '故郷からの便り',
    lines: [
      { by: 'n', say: 'n_iv_letter' },
      { by: 't', say: 't_l_open' },
      { by: 'a', say: { if: { a: { house: 'orphan' } }, then: 'iv4_l_orphan', else: 'iv4_l_family' } },
      { by: 't', say: 't_l_what' },
      { by: 'a', say: 'iv4_l_content' },
      { by: 't', say: { if: { stage: 'war' }, then: 't_l_worry_war', else: 't_l_worry' } },
      { by: 'a', say: 'iv4_l_reply' },
    ],
    choice: {
      prompt: '先生の返事を選ぶ',
      options: [
        { label: '「ここでの毎日を、そのまま書けばいい」', effect: { trust: 2 }, lines: [{ by: 't', say: 't_l_a' }, { by: 'a', say: 'iv4_l_after_a' }, { by: 't', say: 't_l_close' }] },
        { label: '「先生からも一言書き添えよう」', effect: { trust: 1, motivation: 1 }, lines: [{ by: 't', say: alum('t_l_b') }, { by: 'a', say: 'iv4_l_after_b' }, { by: 't', say: 't_l_close' }] },
        { label: '「次の休みに顔を見せに行っておいで」', effect: { fatigue: -10 }, lines: [{ by: 't', say: 't_l_c' }, { by: 'a', say: 'iv4_l_after_c' }, { by: 't', say: 't_l_close' }] },
      ],
    },
  },
  // ---------- 近況：戦況の不安（緊張期・激戦期） ----------
  {
    id: 'recent_war', topic: 'recent', title: '戦の足音', when: { flag: 'unrest' },
    lines: [
      { by: 'n', say: 'n_iv_war' },
      { by: 't', say: 't_wr_open' },
      { by: 'a', say: { if: { stage: 'war' }, then: 'iv4_wr_war', else: 'iv4_wr_tension' } },
      { by: 't', say: 't_wr_truth' },
      { by: 'a', say: 'iv4_wr_fear' },
      { by: 't', say: alum('t_wr_past') },
      { by: 'a', say: 'iv4_wr_ask' },
    ],
    choice: {
      prompt: '先生の返事を選ぶ',
      options: [
        { label: '「怖い。だから、お前たちを守れるよう鍛える」', effect: { trust: 3 }, lines: [{ by: 't', say: 't_wr_a' }, { by: 'a', say: 'iv4_wr_after_a' }, { by: 't', say: 't_wr_close' }] },
        { label: '「怖いのは当たり前だ」と受け止める', effect: { motivation: 1 }, lines: [{ by: 't', say: 't_wr_b' }, { by: 'a', say: 'iv4_wr_after_b' }, { by: 't', say: 't_wr_close' }] },
        { label: '「今は目の前の一日を大事にしよう」', effect: { trust: 1, fatigue: -5 }, lines: [{ by: 't', say: 't_wr_c' }, { by: 'a', say: 'iv4_wr_after_c' }, { by: 't', say: 't_wr_close' }] },
      ],
    },
  },
  // ---------- 近況：恋の相談（両想いの相手がいるとき。気持ちの話だけ） ----------
  {
    id: 'recent_love', topic: 'recent', title: '気になる人', when: { flag: 'has_love' },
    lines: [
      { by: 'n', say: 'n_iv_love' },
      { by: 't', say: 't_lv_open' },
      { by: 'a', say: 'iv4_lv_open' },
      { by: 't', say: 't_lv_listen' },
      { by: 'a', say: 'iv4_lv_feel' },
      { by: 't', say: alum('t_lv_past') },
      { by: 'a', say: 'iv4_lv_worry' },
    ],
    choice: {
      prompt: '先生の返事を選ぶ',
      options: [
        { label: '「その気持ちを大切にしなさい」', effect: { motivation: 1 }, lines: [{ by: 't', say: 't_lv_a' }, { by: 'a', say: 'iv4_lv_after_a' }, { by: 't', say: 't_lv_close' }] },
        { label: '「伝えたいことは、言葉にして伝えなさい」', effect: { trust: 2 }, lines: [{ by: 't', say: 't_lv_b' }, { by: 'a', say: 'iv4_lv_after_b' }, { by: 't', say: 't_lv_close' }] },
        { label: '「顔が真っ赤だぞ」と笑ってほぐす', effect: { trust: 1, fatigue: -5 }, lines: [{ by: 't', say: 't_lv_c' }, { by: 'a', say: 'iv4_lv_after_c' }, { by: 't', say: 't_lv_close' }] },
      ],
    },
  },
  // ---------- 近況：先生の昔の話をせがむ ----------
  {
    id: 'recent_past', topic: 'recent', title: '先生の昔話',
    lines: [
      { by: 'n', say: 'n_iv_tea' },
      { by: 'a', say: 'iv4_tp_ask' },
      { by: 't', say: alum('t_tp_open') },
      { by: 'a', say: has('alumni_teacher', 'iv4_tp_react_alum', 'iv4_tp_react') },
      { by: 't', say: alum('t_tp_story') },
      { by: 'a', say: 'iv4_tp_more' },
      { by: 't', say: alum('t_tp_more') },
      { by: 'a', say: 'iv4_tp_end' },
      { by: 't', say: 't_tp_close' },
    ],
  },
  // ---------- 近況：夢が変わりそう（夢があるとき） ----------
  {
    id: 'recent_dream', topic: 'recent', title: '揺れる夢', when: { a: { hasDream: true } },
    lines: [
      { by: 'n', say: 'n_iv_call' },
      { by: 't', say: 't_dr_open' },
      { by: 'a', say: 'iv4_dr_unsure' },
      { by: 't', say: 't_dr_why' },
      { by: 'a', say: 'iv4_dr_reason' },
      { by: 't', say: alum('t_dr_past') },
      { by: 'a', say: 'iv4_dr_ask' },
    ],
    choice: {
      prompt: '先生の返事を選ぶ',
      options: [
        { label: '「変わってもいい。それも成長だ」', effect: { motivation: 1 }, lines: [{ by: 't', say: 't_dr_a' }, { by: 'a', say: 'iv4_dr_after_a' }, { by: 't', say: 't_dr_close' }] },
        { label: '「最初の気持ちも思い出してみよう」', effect: { trust: 2 }, lines: [{ by: 't', say: 't_dr_b' }, { by: 'a', say: 'iv4_dr_after_b' }, { by: 't', say: 't_dr_close' }] },
        { label: '「急がず、両方抱えたままでいい」', effect: { trust: 1, fatigue: -5 }, lines: [{ by: 't', say: 't_dr_c' }, { by: 'a', say: 'iv4_dr_after_c' }, { by: 't', say: 't_dr_close' }] },
      ],
    },
  },
  // ---------- 近況：先代の先生のこと（2代目以降の教官のとき） ----------
  {
    id: 'recent_prev', topic: 'recent', title: '先代の先生', when: { flag: 'gen2' },
    lines: [
      { by: 'n', say: 'n_iv_call' },
      { by: 't', say: 't_pv_open' },
      { by: 'a', say: 'iv4_pv_ask' },
      { by: 't', say: alum('t_pv_who') },
      { by: 'a', say: has('alumni_teacher', 'iv4_pv_react_alum', 'iv4_pv_react') },
      { by: 't', say: alum('t_pv_story') },
      { by: 'a', say: 'iv4_pv_me' },
      { by: 't', say: alum('t_pv_close') },
      { by: 'a', say: 'iv4_pv_end' },
    ],
  },
  // ---------- 悩み：疲れが抜けない（疲れているとき） ----------
  {
    id: 'worry_tired', topic: 'worry', title: '抜けない疲れ', when: { a: { tired: true } },
    lines: [
      { by: 'n', say: 'n_iv_call' },
      { by: 't', say: 't_wt_open' },
      { by: 'a', say: 'iv4_wt_deny' },
      { by: 't', say: 't_wt_see' },
      { by: 'a', say: 'iv4_wt_admit' },
      { by: 't', say: alum('t_wt_past') },
      { by: 'a', say: 'iv4_wt_ask' },
    ],
    choice: {
      prompt: '先生の返事を選ぶ',
      options: [
        { label: '「今週はしっかり休め」と言い切る', effect: { fatigue: -15 }, lines: [{ by: 't', say: 't_wt_a' }, { by: 'a', say: 'iv4_wt_after_a' }, { by: 't', say: 't_wt_close' }] },
        { label: '「稽古の量を一緒に見直そう」', effect: { trust: 2, fatigue: -8 }, lines: [{ by: 't', say: 't_wt_b' }, { by: 'a', say: 'iv4_wt_after_b' }, { by: 't', say: 't_wt_close' }] },
        { label: '「頑張りは、ちゃんと見ている」と伝える', effect: { trust: 1, motivation: 1 }, lines: [{ by: 't', say: 't_wt_c' }, { by: 'a', say: 'iv4_wt_after_c' }, { by: 't', say: 't_wt_close' }] },
      ],
    },
  },
  // ---------- 悩み：ひとりぼっち（仲のよい仲間がいないとき） ----------
  {
    id: 'worry_alone', topic: 'worry', title: 'ひとりの食卓', when: { a: { hasFriend: false } },
    lines: [
      { by: 'n', say: 'n_iv_call' },
      { by: 't', say: 't_wa_open' },
      { by: 'a', say: 'iv4_wa_open' },
      { by: 't', say: 't_wa_listen' },
      { by: 'a', say: 'iv4_wa_why' },
      { by: 't', say: alum('t_wa_past') },
      { by: 'a', say: 'iv4_wa_surprise' },
    ],
    choice: {
      prompt: '先生の返事を選ぶ',
      options: [
        { label: '「次の稽古の組み相手は、私が決めよう」', effect: { trust: 2 }, lines: [{ by: 't', say: 't_wa_a' }, { by: 'a', say: 'iv4_wa_after_a' }, { by: 't', say: 't_wa_close' }] },
        { label: '「無理に輪に入らなくてもいい」', effect: { motivation: 1 }, lines: [{ by: 't', say: 't_wa_b' }, { by: 'a', say: 'iv4_wa_after_b' }, { by: 't', say: 't_wa_close' }] },
        { label: '「まずは私と話す練習からだ」', effect: { trust: 3 }, lines: [{ by: 't', say: 't_wa_c' }, { by: 'a', say: 'iv4_wa_after_c' }, { by: 't', say: 't_wa_close' }] },
      ],
    },
  },
  // ---------- 悩み：故郷が戦火に（故郷が戦場になったと最近聞いたとき） ----------
  {
    id: 'worry_homewar', topic: 'worry', title: '故郷の空', when: { a: { recent: 'ev_homewar' } },
    lines: [
      { by: 'n', say: 'n_iv_call' },
      { by: 't', say: 't_wh_open' },
      { by: 'a', say: 'iv4_wh_open' },
      { by: 't', say: 't_wh_ask' },
      { by: 'a', say: 'iv4_wh_news' },
      { by: 't', say: alum('t_wh_past') },
      { by: 'a', say: 'iv4_wh_ask' },
    ],
    choice: {
      prompt: '先生の返事を選ぶ',
      options: [
        { label: '「知らせが来るまで、一緒に待とう」', effect: { trust: 3 }, lines: [{ by: 't', say: 't_wh_a' }, { by: 'a', say: 'iv4_wh_after_a' }, { by: 't', say: 't_wh_close' }] },
        { label: '「ここで強くなることが、故郷を守る力になる」', effect: { motivation: 1 }, lines: [{ by: 't', say: 't_wh_b' }, { by: 'a', say: 'iv4_wh_after_b' }, { by: 't', say: 't_wh_close' }] },
        { label: '「今週は稽古を休んで、手紙を書きなさい」', effect: { trust: 1, fatigue: -10 }, lines: [{ by: 't', say: 't_wh_c' }, { by: 'a', say: 'iv4_wh_after_c' }, { by: 't', say: 't_wh_close' }] },
      ],
    },
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
      { by: 't', say: alum('t_x70_past') },
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
  n_iv_senior: '（教官室の壁に貼られた卒業生の名簿を、{me}がじっと見上げている）',
  n_iv_letter: '（{me}が、一通の手紙を大事そうに抱えて、教官室へやって来た）',
  n_iv_war: '（遠くで、出陣を告げる鐘が鳴っている。{me}は窓の外をじっと見つめていた）',
  n_iv_love: '（{me}は何か言いたそうに、教官室の前を行ったり来たりしていた）',
  n_iv_tea: '（授業のあと、{me}がお茶を二つ持って教官室にやって来た）',
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
  // ===== 4夜目：既存の面談に足した、卒業生の先生の言い回し =====
  t_r3_learn_alum: { knight: '私もかつては、この教室で教わる側だった。教える側に立って、ようやく先代の先生の言葉の意味が分かってきた。', merc: '俺もこの教室で教わってた身だ。教える側になってみりゃ、こっちが教わることばっかりでな。', mage: '私もかつては、この教室の生徒でした。教える側になって、あの頃の先生がどれほど学んでいたかが分かります。', wanderer: '昔はこの教室で教わる側だったんだ。教える側になったら、毎日こっちが教わってばかりだよ。' },
  t_x70_past_alum: {
    knight: '……私もこの学校の生徒だった頃、自分の弱さが嫌でたまらなかった。先代の先生が「弱さを知る者は強くなれる」と言ってくれた。その言葉を、今お前に返そう。',
    merc: '……俺もここの生徒だった頃は、ひねくれ者でな。先代の先生だけが、最後まで見捨てなかった。だから今度は、俺がお前を見捨てねえ。',
    mage: '……私もこの教室で、自分の欠けたところばかり数えていました。先代の先生が「それも含めてあなたです」と言ってくれたのです。',
    wanderer: '……実はね、この学校の生徒だった頃、居場所がない気がしてた。先代の先生が「ここがお前の居場所だ」って言ってくれたんだ。',
  },
  // ===== 4夜目：友だちのこと =====
  t_f_open: { knight: '{you}、最近は{yourFriend}とよく一緒にいるな。', merc: 'よう{you}。最近{yourFriend}とつるんでるじゃねえか。', mage: '{you}、最近は{yourFriend}さんと一緒のところをよく見かけますね。', wanderer: '{you}、最近{yourFriend}と仲いいね。' },
  t_f_how: { knight: '{yourFriend}の、どんなところと気が合うのだ。', merc: '{yourFriend}のどこが気に入ってんだ？', mage: '{yourFriend}さんの、どんなところが好きなのですか。', wanderer: '{yourFriend}のどんなとこが好き？' },
  t_f_past: { knight: '……いた。騎士団の同期でな。今は遠い砦にいるが、年に一度は手紙が届く。', merc: 'いたさ。同じ傭兵団の相棒だ。今どこにいるかも分からねえが、生きてりゃいい。', mage: 'ええ、いましたよ。宮廷の書庫で夜通し議論した友人です。今でも手紙をやりとりしています。', wanderer: 'いたよ。旅の途中で出会って、三つの国を一緒に歩いた。今もどこかの空の下にいるはず。' },
  t_f_past_alum: { knight: 'いたとも。この学校の同じ教室にな。私もここの生徒だった頃、毎日のように手合わせした仲間だ。', merc: 'いたさ。この学校で、同じ寮の隣の部屋だったやつだ。……俺もここの生徒だったからな。', mage: 'ええ。私もこの学校の生徒でしたから。図書室で並んで勉強した友人が、今も手紙をくれます。', wanderer: 'いたよ。この学校で、同じ教室にね。私もここの卒業生なんだ。今でも会うと、すぐあの頃に戻れる。' },
  t_f_close: { knight: 'その縁を大切にしなさい。卒業しても、きっと支えになる。', merc: '大事にしろよ。そういう縁は、金じゃ買えねえ。', mage: 'その縁を、大切にしてくださいね。', wanderer: 'その縁、大事にしなよ。' },
  t_f_close_war: { knight: 'どの国に仕えることになっても、その縁を忘れるな。戦の世だからこそだ。', merc: 'どこの旗の下に立っても、その縁だけは捨てるなよ。', mage: 'どの国に仕えることになっても、その縁を手放さないでください。', wanderer: 'どこへ行くことになっても、その縁は手放しちゃだめだよ。' },
  // ===== 4夜目：分からないところ =====
  t_q_open: { knight: '{you}、今日の戦術の授業で、首をかしげていたな。', merc: '{you}。今日の座学、途中から目が泳いでたぞ。', mage: '{you}、今日の戦術の授業で、困った顔をしていましたね。', wanderer: '{you}、今日の授業、途中で迷子になってたでしょ。' },
  t_q_where: { knight: 'どこで分からなくなった。言ってみなさい。', merc: 'どこで引っかかった？ 言ってみろ。', mage: 'どこで分からなくなったのか、教えてもらえますか。', wanderer: 'どこから分からなくなった？' },
  t_q_hint: { knight: '騎士団では、盾の仲間が踏みとどまれるかを先に見る、と教わった。前に出るかどうかは、それで決まる。', merc: '傭兵の決め方は簡単だ。逃げ道があるうちは出る。なくなる前に下がる。', mage: '宮廷の兵法書には、「味方の届く距離を先に数えよ」とあります。そこから考えるといいですよ。', wanderer: '旅で覚えたのはね、まず逃げ道を見ること。そこが分かれば、前に出ていいかも分かるよ。' },
  t_q_hint_alum: { knight: '実はな、私もこの教室の同じ席で、まったく同じところでつまずいた。先代の先生に何度も聞きに行ったものだ。', merc: '俺もここの生徒だった頃、そこでつまずいた。先代の先生に、三回同じことを聞いたっけな。', mage: '私もこの教室で、同じところで悩みました。先代の先生は、分かるまで何度でも図を描いてくれましたよ。', wanderer: 'そこ、私もこの教室でつまずいたんだ。先代の先生に、夜まで付き合ってもらったっけ。' },
  t_q_a: { knight: 'では、今ここで一緒に解いてみよう。盤を持ってきなさい。', merc: 'よし、今から一緒にやるぞ。駒を並べろ。', mage: 'では、今ここで一緒に解いてみましょう。紙とペンを。', wanderer: 'じゃ、今から一緒に解こう。地図、広げて。' },
  t_q_b: { knight: '分からないと言えるのは、強さだ。戦場では、それが命を救う。', merc: '分からねえって言えるやつは長生きする。偉いぞ。', mage: '分からないと言えるのは、立派なことです。そこから学びが始まります。', wanderer: '分からないって言えるの、えらいよ。それ、けっこう難しいんだ。' },
  t_q_b_alum: { knight: '分からないと言えるのは強さだ。私もこの教室で、先代の先生にそう言われて救われた。', merc: '分からねえって言えるのは偉い。俺はここの生徒の頃、それが言えなくて遠回りした。', mage: '分からないと言えるのは立派です。私もこの教室で、先代の先生にそう教わりました。', wanderer: '分からないって言えるの、えらいよ。私がここの生徒だった頃は、なかなか言えなかったな。' },
  t_q_c: { knight: '今日はもう寝なさい。頭が疲れていては、分かるものも分からぬ。', merc: '今日は寝ろ。寝て起きたら、案外すっと分かるもんだ。', mage: '今日はもう休みましょう。眠っている間に、頭が整理されますから。', wanderer: '今日はもう寝よう。明日の朝、一緒に考えよ。' },
  t_q_close: { knight: '分からなければ、いつでも聞きに来なさい。', merc: 'また引っかかったら来い。', mage: '分からないことがあれば、いつでも聞きに来てくださいね。', wanderer: 'また分からなくなったら、おいで。' },
  // ===== 4夜目：先輩のこと =====
  t_sn_open: { knight: '卒業生の名簿が気になるか、{you}。', merc: 'なんだ{you}、名簿なんか見て。', mage: '卒業生の名簿が気になりますか、{you}。', wanderer: '{you}、その名簿、気になる？' },
  t_sn_who: { knight: '{yourSenior}か。今もこの学校の名に恥じぬ働きをしていると聞く。', merc: '{yourSenior}か。あいつは外でもしぶとくやってるらしいぜ。', mage: '{yourSenior}さんですね。今も立派に務めを果たしていると聞いています。', wanderer: '{yourSenior}か。今もがんばってるって、風のうわさで聞くよ。' },
  t_sn_who_alum: { knight: '{yourSenior}か。私もこの学校の卒業生だ。同じ教室の机を知る仲間として、誇らしく思っている。', merc: '{yourSenior}か。俺もここを出た身だからな、同じ釜の飯を食った仲間みてえなもんだ。', mage: '{yourSenior}さんですね。私もこの学校の卒業生ですから、同じ教室で学んだ仲間として誇りに思います。', wanderer: '{yourSenior}か。私もここの卒業生だから、なんだか家族みたいな気がするんだよね。' },
  t_sn_letter: { knight: '卒業生は、時おり手紙をくれる。次の返事には、お前のことも書いておこう。', merc: '卒業したやつらは、たまに手紙をよこす。今度、お前のことも書いといてやる。', mage: '卒業生は時々手紙をくれます。次の返事に、あなたのことも書いておきますね。', wanderer: 'たまに手紙が来るんだ。今度、{you}のことも書いとくよ。' },
  t_sn_close: { knight: 'いつか、お前たちも誰かの「先輩」になる。その日を楽しみにしている。', merc: 'お前もいつか、誰かの先輩になるんだ。しっかりやれよ。', mage: 'いつか、あなたも誰かの先輩になります。楽しみですね。', wanderer: 'いつか{you}も、誰かの先輩になるんだよ。' },
  t_sn_close_alum: { knight: '私もそう思って、ここを巣立った。そして今、こうしてここにいる。お前もきっと、誰かの先輩になる。', merc: '俺もそう思ってここを出た。で、気づいたらまた戻ってきてた。お前もきっと、誰かの先輩になるさ。', mage: '私もそう願って、ここを卒業しました。そして今、ここに立っています。あなたもきっと、誰かの先輩になりますよ。', wanderer: '私もそう思って卒業したんだ。で、今はここにいる。{you}もきっと、誰かの先輩になるよ。' },
  // ===== 4夜目：故郷からの便り =====
  t_l_open: { knight: '手紙か。故郷からだな。', merc: 'お、手紙か。故郷からか？', mage: 'お手紙ですね。故郷からですか。', wanderer: 'お、手紙だ。故郷から？' },
  t_l_what: { knight: '何と書いてあった。', merc: 'で、なんて書いてあった？', mage: 'どんなことが書いてありましたか。', wanderer: 'なんて書いてあったの？' },
  t_l_worry: { knight: '離れていても、思ってくれる者がいる。それは何よりの宝だ。', merc: '離れてても気にかけてくれるやつがいる。ありがてえ話じゃねえか。', mage: '離れていても、思ってくれる人がいる。素敵なことですね。', wanderer: '遠くにいても、思ってくれる人がいるっていいね。' },
  t_l_worry_war: { knight: '戦が続いている。向こうも、お前の身を案じているのだろう。', merc: 'このご時世だ。向こうも、お前が無事か気が気じゃねえだろうよ。', mage: '戦が続いていますから、向こうもあなたのことを案じているのでしょう。', wanderer: 'こんな時だもんね。向こうも{you}のこと、すごく心配してると思う。' },
  t_l_a: { knight: 'ここでの毎日を、そのまま書けばよい。飾らぬ言葉が、いちばん届く。', merc: 'ここで食ったもんとか、稽古でこけた話とか、そのまま書きゃいい。', mage: 'ここでの毎日を、そのまま書けばいいのです。飾らない言葉が、いちばん伝わります。', wanderer: 'ここでの毎日を、そのまま書けばいいよ。それがいちばんうれしいから。' },
  t_l_b: { knight: 'では、私からも一言書き添えよう。「よく励んでいる」とな。', merc: 'よし、俺からも一言書いてやる。「ちゃんと生きてる、心配すんな」ってな。', mage: 'では、私からも一言添えましょう。「毎日よく学んでいます」と。', wanderer: 'じゃあ、私からも一言書くよ。「元気にしてます」って。' },
  t_l_b_alum: { knight: 'では、私からも一言書き添えよう。私もここの生徒だった頃、先代の先生に一言添えてもらって、家族がたいそう喜んだのだ。', merc: '俺からも一言書いてやる。昔、俺がここの生徒だった頃、先代の先生が同じことをしてくれてな。', mage: '私からも一言添えましょう。私がこの学校の生徒だった頃、先代の先生が添えてくれた一言を、母は今も大事にしています。', wanderer: '私からも一言書くよ。昔ここの生徒だった頃、先代の先生が書いてくれて、うれしかったんだ。' },
  t_l_c: { knight: '次の休みに、顔を見せに行っておいで。手紙より、きっと喜ばれる。', merc: '次の休み、顔見せてこい。そのほうが早え。', mage: '次のお休みに、顔を見せに行ってはどうでしょう。きっと喜ばれますよ。', wanderer: '次の休み、会いに行っておいでよ。顔見せるのがいちばん。' },
  t_l_close: { knight: '書けたら見せてくれ。……いや、見せなくともよいがな。', merc: '書けたら出しとけ。届くといいな。', mage: '無事に届くといいですね。', wanderer: '届くといいね。' },
  // ===== 4夜目：戦の足音 =====
  t_wr_open: { knight: '{you}。鐘の音が、気になるか。', merc: '{you}、あの鐘が気になるか。', mage: '{you}、鐘の音が気になりますか。', wanderer: '{you}、あの鐘、気になる？' },
  t_wr_truth: { knight: '隠すつもりはない。大陸は今、荒れている。', merc: '嘘はつかねえ。大陸はきな臭い。', mage: '隠しません。今の大陸は、穏やかではありません。', wanderer: 'ごまかさないで言うね。今の大陸は、ちょっと荒れてる。' },
  t_wr_past: { knight: '……若い頃、初めての戦の前の晩は、一睡もできなかった。剣を抱いたまま朝を迎えたものだ。', merc: '……初めての戦の前は、手の震えが止まらなかった。何年たっても、あの晩は忘れねえ。', mage: '……宮廷にいた頃、戦の知らせが届くたびに、眠れない夜を過ごしました。', wanderer: '……旅の途中で、戦に巻き込まれた村を見たことがある。あの夜は、ずっと眠れなかった。' },
  t_wr_past_alum: { knight: '……私もこの学校の生徒だった頃、同じことを考えて眠れなかった。先代の先生は、黙って朝まで隣にいてくれた。', merc: '……俺もここの生徒だった頃、同期と敵になるかもしれねえって、夜通し悩んだ。先代の先生が、黙って茶をいれてくれたっけ。', mage: '……私もこの教室で、同じ不安を口にしました。先代の先生は、答えのかわりに、ずっと話を聞いてくれました。', wanderer: '……私もここの生徒だった頃、同じことで眠れなかったんだ。先代の先生が、星を見ながら朝まで付き合ってくれた。' },
  t_wr_a: { knight: '怖いとも。だからこそ、お前たちが生きて帰れるよう、私は鍛える。', merc: '怖えさ。だからお前らが死なねえように、きっちり鍛えるんだ。', mage: '怖いですよ。だからこそ、あなたたちが生きて帰れるよう、教えられることはすべて教えます。', wanderer: '怖いよ。だから、みんなが生きて帰ってこられるように、全部教えるつもり。' },
  t_wr_b: { knight: '怖いのは当たり前だ。怖さを知る者は、無茶をせぬ。それでいい。', merc: '怖くて当たり前だ。怖がるやつのほうが長生きする。', mage: '怖いと思うのは、当たり前のことです。その気持ちを恥じないで。', wanderer: '怖くて当たり前だよ。その気持ち、大事にしていい。' },
  t_wr_c: { knight: '先のことは誰にも分からぬ。だから今は、目の前の一日を大事にしよう。', merc: '明日のことは明日考えりゃいい。今日はしっかり食って寝ろ。', mage: '先のことは誰にも分かりません。今日という一日を、大切にしましょう。', wanderer: '先のことは誰にも分からない。だから今日を、ちゃんと楽しもう。' },
  t_wr_close: { knight: '眠れぬ夜は、ここへ来なさい。灯りはつけておく。', merc: '眠れねえ夜は来い。灯りはつけとく。', mage: '眠れない夜は、ここへ来てください。灯りをつけておきます。', wanderer: '眠れない夜は、おいで。灯り、つけとくから。' },
  // ===== 4夜目：気になる人 =====
  t_lv_open: { knight: 'どうした、{you}。入りなさい。', merc: 'なんだ、{you}。入れよ。', mage: 'どうしましたか、{you}。どうぞ。', wanderer: 'どうしたの、{you}。入りなよ。' },
  t_lv_listen: { knight: '{yourLove}のことか。ゆっくりでよい。', merc: '{yourLove}のことか。……まあ、ゆっくり話せ。', mage: '{yourLove}さんのことですね。ゆっくりで大丈夫ですよ。', wanderer: '{yourLove}のことか。ゆっくりでいいよ。' },
  t_lv_past: { knight: '人を大切に思う気持ちは、恥じるものではない。騎士の誓いと同じくらい、尊いものだ。', merc: '誰かを大事に思うのは、悪いことじゃねえ。戦場で踏んばる力にもなる。', mage: '誰かを大切に思う気持ちは、どんな魔法よりも強いものです。', wanderer: '誰かを大事に思えるのって、すてきなことだよ。旅をしてても、そういう人たちがいちばん強かった。' },
  t_lv_past_alum: { knight: '……実はな、私もこの学校の生徒だった頃、同じように先代の先生の前で、赤くなって話したことがある。', merc: '……笑うなよ。俺もここの生徒だった頃、先代の先生に同じ相談をしたことがある。', mage: '……ふふ。私もこの教室で、先代の先生に同じような相談をしたことがあるのですよ。', wanderer: '……実はね、私もここの生徒だった頃、先代の先生に同じこと話したんだ。顔、真っ赤にしてさ。' },
  t_lv_a: { knight: 'その気持ちを大切にしなさい。それは、お前を強くする。', merc: 'その気持ち、大事にしろ。それがある限り、お前は踏んばれる。', mage: 'その気持ちを大切にしてください。きっとあなたを支えてくれます。', wanderer: 'その気持ち、大事にしなよ。きっと支えになるから。' },
  t_lv_b: { knight: '伝えたいことは、言葉にして伝えなさい。戦の世では、明日があるとは限らぬ。', merc: '言いたいことは口に出して言え。後悔だけはするなよ。', mage: '伝えたい気持ちは、言葉にして伝えてください。言葉は、離れていても残りますから。', wanderer: '伝えたいことは、ちゃんと言葉にしなよ。言わないと、伝わらないからさ。' },
  t_lv_c: { knight: '……{you}、顔が真っ赤だぞ。', merc: 'おいおい、顔が真っ赤だぞ。', mage: 'ふふ、{you}、お顔が真っ赤ですよ。', wanderer: 'あはは、{you}、顔真っ赤だよ。' },
  t_lv_close: { knight: '話してくれてありがとう。……このことは、私の胸にしまっておく。', merc: '安心しろ、誰にも言わねえよ。', mage: '話してくれてありがとう。このことは、二人だけの秘密にしましょう。', wanderer: '話してくれてありがと。誰にも言わないから安心して。' },
  // ===== 4夜目：先生の昔話 =====
  t_tp_open: { knight: '昔の話か。……面白いものではないぞ。', merc: '昔の話だあ？ 聞いても得はねえぞ。', mage: '昔の話ですか。面白いかどうか、分かりませんよ。', wanderer: '昔の話？ そんなに面白くないよ？' },
  t_tp_open_alum: { knight: '昔の話か。……実はな、私もこの学校の生徒だったのだ。', merc: '昔の話か。……言ってなかったか？ 俺もここの生徒だったんだぜ。', mage: '昔の話ですか。……実は私も、この学校の生徒だったのですよ。', wanderer: '昔の話かあ。……実はね、私もここの生徒だったんだ。' },
  t_tp_story: { knight: '若い頃は王国の騎士団にいた。初めての行進では、緊張して兜を前後逆にかぶっていた。', merc: '傭兵をしてた頃、雇い主に金を払ってもらえなくてな。三日間、固いパンだけで歩いた。', mage: '宮廷にいた頃、大事な式典で呪文を言い間違えて、祝いの花火が逆さに上がったことがあります。', wanderer: '旅の途中、道に迷って、三日続けて同じ村に戻ってきたことがあるよ。村の人に名前を覚えられちゃった。' },
  t_tp_story_alum: { knight: 'この教室で、先代の先生に剣の握り方から教わった。卒業して騎士になり、……そしてまた、ここへ戻ってきた。', merc: 'ここを出てから、傭兵として大陸中を歩いた。……結局、帰ってきたのはここだった。', mage: '卒業してから、宮廷に仕えました。でも、いちばん多くを学んだのは、この教室でした。', wanderer: '卒業してから、あちこち旅をしたよ。でも、ずっとこの学校の夕焼けが恋しかったんだ。' },
  t_tp_more: { knight: '続きは、また今度だ。今日はお前の話も聞きたい。', merc: '続きはまた今度な。今度はお前の番だ。', mage: '続きは、またの機会に。次はあなたの話を聞かせてください。', wanderer: '続きはまた今度ね。次は{you}の話も聞かせて。' },
  t_tp_more_alum: { knight: '私も生徒の頃、先代の先生にこうしてせがんだものだ。……今なら、あのときの先生の気持ちが分かる。続きは、また今度だ。', merc: '俺もここの生徒の頃、先代の先生にしつこくせがんだもんだ。……今ならあの人の照れくささが分かるぜ。続きはまた今度な。', mage: '私も生徒の頃、先代の先生にこうしてお話をせがみました。……今なら、あのときの先生のお気持ちが分かります。続きは、また今度。', wanderer: '私も生徒の頃、先代の先生にこうやってせがんだんだ。……今なら、あの照れた顔の意味が分かるよ。続きはまた今度ね。' },
  t_tp_close: { knight: 'ああ、約束だ。……茶をありがとう、{you}。', merc: 'おう、約束だ。茶、うまかったぜ。', mage: 'ええ、約束です。お茶をありがとう、{you}。', wanderer: 'うん、約束。お茶ありがとね。' },
  // ===== 4夜目：揺れる夢 =====
  t_dr_open: { knight: '{you}、前に{yourDream}を目指していると言っていたな。', merc: '{you}、お前、{yourDream}が夢だって言ってたよな。', mage: '{you}、以前、{yourDream}が夢だと話してくれましたね。', wanderer: '{you}、前に{yourDream}が夢だって言ってたよね。' },
  t_dr_why: { knight: '何かあったのか。', merc: 'なんかあったか？', mage: '何かきっかけがあったのですか。', wanderer: 'なにかあった？' },
  t_dr_past: { knight: '私も若い頃は、生涯騎士として生きると決めていた。だが今は、こうして教壇に立っている。', merc: '俺だって昔は、金さえあればいいと思ってた。それが今じゃ先生だ。笑っちまうだろ。', mage: '私も昔は、宮廷で一生を終えるものと思っていました。でも今は、ここで教えています。', wanderer: '私も昔は、ずっと旅を続けるつもりだったよ。でも今は、ここにいる。' },
  t_dr_past_alum: { knight: '私もこの学校で学ぶうちに、夢が変わった。だから今、先代の先生と同じ教壇に立っている。', merc: '俺もここの生徒だった頃、夢がころころ変わった。で、気づいたら先代の先生と同じ場所に立ってた。', mage: '私もこの教室で学ぶうちに、夢が変わりました。だから今、先代の先生と同じ教壇に立っているのです。', wanderer: '私もここの生徒だった頃、夢が変わったんだ。それで今、先代の先生と同じ場所にいる。' },
  t_dr_a: { knight: '変わってもよい。それは、お前が成長した証だ。', merc: '変わっていいんだよ。人は変わるもんだ。', mage: '変わってもいいのです。それは、あなたが成長した証ですから。', wanderer: '変わっていいんだよ。それも成長ってこと。' },
  t_dr_b: { knight: 'では、最初にその夢を抱いた日のことを、もう一度思い出してみなさい。', merc: 'なら、最初にその夢を持った日のこと、思い出してみな。', mage: 'では、最初にその夢を抱いた日のことを、もう一度思い出してみましょう。', wanderer: 'じゃあ、最初にその夢を持った日のこと、思い出してみよっか。' },
  t_dr_c: { knight: '急いで決めずともよい。両方を抱えたまま進むことも、ひとつの道だ。', merc: '急いで決めるこたねえ。両方抱えたまま歩いてもいい。', mage: '急がなくて大丈夫です。両方を大事にしたまま進んでもいいのですよ。', wanderer: '急がなくていいよ。両方持ったまま歩いたっていい。' },
  t_dr_close: { knight: 'どんな夢を選んでも、私はお前を応援する。', merc: 'どの夢を選んでも、応援してやる。', mage: 'どんな夢を選んでも、私は応援しています。', wanderer: 'どの夢を選んでも、ずっと応援してる。' },
  // ===== 4夜目：先代の先生 =====
  t_pv_open: { knight: '何か聞きたそうな顔だな、{you}。', merc: 'なんだ{you}、聞きてえことでもあるのか。', mage: '何か聞きたいことがありそうですね、{you}。', wanderer: '{you}、なにか聞きたそうだね。' },
  t_pv_who: { knight: '{prevTeacher}先生か。直接お会いしたのはわずかだが、残された日誌はすべて読んだ。', merc: '{prevTeacher}先生か。会ったのは引き継ぎの時くらいだが、残してった日誌は全部読んだぜ。', mage: '{prevTeacher}先生ですね。お会いしたのは数えるほどですが、残された日誌はすべて読みました。', wanderer: '{prevTeacher}先生か。ちゃんと話したのは少しだけど、残してくれた日誌は全部読んだよ。' },
  t_pv_who_alum: { knight: '{prevTeacher}先生は、私の恩師だ。私もこの教室で、あの方に叱られ、励まされて育った。', merc: '{prevTeacher}先生は、俺の恩師だ。俺もこの教室で、あの人にさんざん絞られた。', mage: '{prevTeacher}先生は、私の恩師です。私もこの教室で、あの方に学びました。', wanderer: '{prevTeacher}先生は、私の先生なんだ。私もこの教室で、あの人に教わったんだよ。' },
  t_pv_story: { knight: '生徒一人ひとりのことが、細かく書いてあった。皆を大事にしていた方なのだろう。', merc: '生徒一人ずつのことが、びっしり書いてあった。よっぽど大事にしてたんだろうな。', mage: '生徒一人ひとりのことが、丁寧に書かれていました。皆を大切にしていた方なのですね。', wanderer: '生徒一人ひとりのことが、びっしり書いてあった。みんなのこと、大好きだったんだろうね。' },
  t_pv_story_alum: { knight: '厳しい方だった。だが、誰よりも生徒の顔をよく見ていた。私のことも、私より先に分かっていた。', merc: '厳しい人だったよ。でも、誰よりも生徒の顔を見てた。俺が落ちこんでると、すぐばれた。', mage: '厳しくも優しい方でした。生徒の顔を、誰よりもよく見ていました。私の迷いも、すぐに見抜かれました。', wanderer: '厳しかったけど、誰よりも生徒の顔を見てる人だった。私の落ちこみも、すぐ見つけてくれたよ。' },
  t_pv_close: { knight: 'ああ。もちろん、お前のことも書いている。', merc: 'おう。お前のこともちゃんと書いてるぞ。', mage: 'ええ。もちろん、あなたのことも書いていますよ。', wanderer: 'うん。{you}のことも、ちゃんと書いてるよ。' },
  t_pv_close_alum: { knight: 'ああ。あの方にならってな。もちろん、お前のことも書いている。', merc: 'おう、あの人のまねだ。お前のこともちゃんと書いてるぞ。', mage: 'ええ、先生にならって。もちろん、あなたのことも書いていますよ。', wanderer: 'うん、先生のまねっこ。{you}のことも、ちゃんと書いてるよ。' },
  // ===== 4夜目：抜けない疲れ =====
  t_wt_open: { knight: '{you}、顔色が悪いな。', merc: '{you}、ひでえ顔してるぞ。', mage: '{you}、顔色がすぐれませんね。', wanderer: '{you}、顔色悪いよ。' },
  t_wt_see: { knight: '無理をしているのは分かる。稽古の様子を見ていた。', merc: 'ごまかすな。稽古で足がもつれてたのは見てる。', mage: '無理をしているのは分かります。稽古の様子を見ていましたから。', wanderer: 'ごまかさなくていいよ。稽古の時、ふらついてたでしょ。' },
  t_wt_past: { knight: '私も騎士見習いの頃、休めば置いていかれると思い込み、倒れたことがある。', merc: '俺も若い頃、休んだら仕事がなくなると思って、ぶっ倒れたことがある。', mage: '私も宮廷にいた頃、眠らずに勉強を続けて、倒れてしまったことがあります。', wanderer: '私も昔、休まず歩き続けて、道ばたで倒れたことがあるんだ。' },
  t_wt_past_alum: { knight: '私もこの学校の生徒だった頃、同じことを言って倒れた。先代の先生に、ひどく叱られたよ。', merc: '俺もここの生徒の頃、同じこと言ってぶっ倒れた。先代の先生にこっぴどく叱られたぜ。', mage: '私もこの学校の生徒だった頃、同じように無理をして倒れました。先代の先生に、それは叱られました。', wanderer: '私もここの生徒だった頃、同じこと言って倒れたんだ。先代の先生に、すごく叱られた。' },
  t_wt_a: { knight: '今週は休め。これは命令だ。', merc: '今週は休め。文句は聞かねえ。', mage: '今週はしっかり休んでください。これは先生からのお願いです。', wanderer: '今週は休もう。先生命令ね。' },
  t_wt_b: { knight: 'では、稽古の量を一緒に見直そう。減らすのも、強くなるための工夫だ。', merc: 'なら稽古の量を一緒に見直すぞ。減らすのも作戦のうちだ。', mage: 'では、稽古の量を一緒に見直しましょう。減らすことも、大事な工夫です。', wanderer: 'じゃあ、稽古の量、一緒に見直そう。減らすのも立派な作戦だよ。' },
  t_wt_c: { knight: 'お前の頑張りは、ちゃんと見ている。置いていかれることなどない。', merc: 'お前の頑張りは見てる。誰もお前を置いていかねえよ。', mage: 'あなたの頑張りは、ちゃんと見ています。置いていかれたりしません。', wanderer: '{you}が頑張ってるの、ちゃんと見てるよ。置いていったりしない。' },
  t_wt_close: { knight: '体を大事にしなさい。お前の代わりは、いないのだから。', merc: '体は大事にしろ。お前の代わりはいねえんだ。', mage: '体を大切にしてくださいね。あなたの代わりはいないのですから。', wanderer: '体、大事にしてね。{you}の代わりはいないんだから。' },
  // ===== 4夜目：ひとりの食卓 =====
  t_wa_open: { knight: '{you}、最近はひとりでいることが多いな。', merc: '{you}、ここんとこ、ひとりで飯食ってるな。', mage: '{you}、最近はひとりで過ごすことが多いようですね。', wanderer: '{you}、最近ひとりでいること多いね。' },
  t_wa_listen: { knight: 'そうか。……話してくれてありがとう。', merc: 'そうか。……よく言ったな。', mage: 'そうでしたか。話してくれてありがとう。', wanderer: 'そっか。言ってくれてありがと。' },
  t_wa_past: { knight: '……私も騎士団に入ったばかりの頃は、誰とも口をきけず、ずっと馬の世話ばかりしていた。', merc: '……俺も傭兵団に入ったばかりの頃は、誰とも口きかなかった。ずっと剣ばっか磨いてたな。', mage: '……私も宮廷に入ったばかりの頃は、誰とも話せず、ずっと書庫にこもっていました。', wanderer: '……私もずっとひとり旅だったからね。人の輪に入るのは、今でもちょっと苦手なんだ。' },
  t_wa_past_alum: { knight: '……私もこの学校に入ったばかりの頃は、ずっとひとりで食堂の隅にいた。', merc: '……俺もここに入ったばかりの頃は、食堂の隅でひとりで飯食ってた。', mage: '……私もこの学校に入ったばかりの頃は、ずっとひとりで図書室にいました。', wanderer: '……私もここに入ったばかりの頃は、ずっと食堂の隅でひとりだったよ。' },
  t_wa_a: { knight: 'では、次の稽古の組み相手は、私が決めよう。気の合いそうな者を選んでおく。', merc: 'なら、次の稽古の相手は俺が決める。いいやつを当ててやるよ。', mage: 'では、次の稽古の組み相手は、私が選びましょう。きっと話しやすい人を。', wanderer: 'じゃあ、次の稽古の相手、私が決めとくよ。いい子を選んでおくね。' },
  t_wa_b: { knight: '無理に輪に入らずともよい。お前の歩みで、少しずつでいい。', merc: '無理に群れなくていい。お前のペースでいいんだ。', mage: '無理に輪に入らなくても大丈夫です。あなたの歩みで、少しずつ。', wanderer: '無理に輪に入らなくていいよ。{you}のペースでいい。' },
  t_wa_c: { knight: 'では、まずは私と話す練習からだ。明日も、ここへ来なさい。', merc: 'なら、まずは俺と話す練習からだ。明日も来い。', mage: 'では、まずは私とお話しする練習からにしましょう。明日もいらしてください。', wanderer: 'じゃあ、まずは私と話す練習から。明日もおいで。' },
  t_wa_close: { knight: '私はいつでもここにいる。忘れるな。', merc: '俺はいつでもここにいる。覚えとけ。', mage: '私はいつでもここにいますからね。', wanderer: '私はいつでもここにいるからね。' },
  // ===== 4夜目：故郷の空 =====
  t_wh_open: { knight: '{you}。{yourHome}のことは、聞いた。', merc: '{you}。{yourHome}のこと、聞いたぞ。', mage: '{you}。{yourHome}のことは、聞きました。', wanderer: '{you}。{yourHome}のこと、聞いたよ。' },
  t_wh_ask: { knight: '家の者から、何か知らせはあったか。', merc: '家のやつらから、何か連絡は来たか？', mage: 'ご家族から、何か知らせはありましたか。', wanderer: '家の人から、なにか知らせは来た？' },
  t_wh_past: { knight: '……騎士団にいた頃、仲間の村が焼けたことがある。あの時、何もしてやれなかったのを、今も悔いている。', merc: '……傭兵時代、戦で故郷を失ったやつを何人も見た。待つ時間がいちばんつらいってな。', mage: '……宮廷にいた頃、故郷が戦火に包まれた同僚がいました。待つことのつらさを、そばで見ていました。', wanderer: '……旅の途中で、故郷を追われた人たちと一緒に歩いたことがある。待つのが、いちばんつらいって言ってた。' },
  t_wh_past_alum: { knight: '……私がこの学校の生徒だった頃も、仲間の故郷が戦火に包まれた。先代の先生は、毎日その子と一緒に知らせを待っていた。', merc: '……俺がここの生徒だった頃も、同期の故郷が燃えた。先代の先生は、毎日そいつと一緒に門で知らせを待ってた。', mage: '……私がこの学校の生徒だった頃も、友人の故郷が戦火に包まれました。先代の先生は、毎日一緒に知らせを待っていました。', wanderer: '……私がここの生徒だった頃も、友だちの故郷が戦場になったんだ。先代の先生は、毎日その子と知らせを待ってた。' },
  t_wh_a: { knight: '知らせが来るまで、私も一緒に待とう。ひとりで待たずともよい。', merc: '知らせが来るまで、一緒に待ってやる。ひとりで抱えるな。', mage: '知らせが届くまで、私も一緒に待ちます。ひとりで待たないで。', wanderer: '知らせが来るまで、一緒に待とう。ひとりで待たなくていいよ。' },
  t_wh_b: { knight: 'ここにいてよい。ここで強くなることが、いつか故郷を守る力になる。', merc: 'ここにいろ。ここで強くなりゃ、いつか故郷を守れる。', mage: 'ここにいていいのです。ここで学ぶことが、いつか故郷を守る力になります。', wanderer: 'ここにいていいんだよ。ここで強くなることが、いつか故郷を守る力になる。' },
  t_wh_c: { knight: '今週は稽古を休んで、家に手紙を書きなさい。届けば、きっと安心させられる。', merc: '今週は稽古を休んで、手紙を書け。届きゃ向こうも安心する。', mage: '今週は稽古をお休みして、手紙を書きましょう。きっと向こうも安心します。', wanderer: '今週は稽古を休んで、手紙を書こう。届いたら、向こうもほっとするよ。' },
  t_wh_close: { knight: '何か知らせが来たら、すぐに伝える。', merc: '知らせが来たら、真っ先に教えてやる。', mage: '知らせが届いたら、すぐにお伝えしますね。', wanderer: '知らせが来たら、すぐ教えるね。' },
};
