// 支援会話の流れ（話題×流れ）。セリフは意味IDで指定し、文面は phrases.ts の性格別テキストから選ぶ。
// 差し込み：{me} {you} {myDream} {yourDream} {myCountry} {yourCountry} {myTrait} {yourTrait} {event} {teacher} {school}
// {my*} は話し手、{your*} は聞き手のもの。
import type { TalkDef } from '../../core/types';

export const TALKS: TalkDef[] = [
  // ---------- 夢 ----------
  {
    id: 'dream_c1', topic: 'dream', rank: 'C',
    when: { a: { hasDream: true } },
    lines: [
      { by: 'a', say: 'dream_share' },
      { by: 'b', say: { if: { b: { hasDream: true } }, then: 'dream_share', else: 'no_dream' } },
      { by: 'a', say: { if: { b: { hasDream: true } }, then: 'dream_cheer_each', else: 'encourage_search' } },
      { by: 'b', say: 'thanks_soft' },
    ],
  },
  {
    id: 'dream_c2', topic: 'dream', rank: 'C',
    when: { a: { hasDream: false }, b: { hasDream: true } },
    lines: [
      { by: 'a', say: 'no_dream_envy' },
      { by: 'b', say: 'dream_share' },
      { by: 'a', say: 'dream_ask_how' },
      { by: 'b', say: 'dream_origin_story' },
      { by: 'a', say: 'encourage_self' },
    ],
  },
  {
    id: 'dream_b1', topic: 'dream', rank: 'B',
    when: { a: { hasDream: true } },
    lines: [
      { by: 'a', say: 'dream_doubt' },
      { by: 'b', say: 'dream_believe' },
      { by: 'a', say: 'dream_why' },
      { by: 'b', say: { if: { b: { hasDream: true } }, then: 'dream_together', else: 'dream_inspired' } },
      { by: 'a', say: 'thanks_deep' },
    ],
  },

  // ---------- 出身 ----------
  {
    id: 'origin_c1', topic: 'origin', rank: 'C',
    lines: [
      { by: 'a', say: 'origin_ask' },
      { by: 'b', say: { if: { sameCountry: true }, then: 'origin_same', else: 'origin_describe' } },
      { by: 'a', say: { if: { sameCountry: true }, then: 'origin_homesick', else: 'origin_curious' } },
      { by: 'b', say: 'origin_invite' },
    ],
  },
  {
    id: 'origin_b1', topic: 'origin', rank: 'B',
    lines: [
      { by: 'a', say: 'origin_border' },
      { by: 'b', say: { if: { sameCountry: true }, then: 'origin_same_side', else: 'origin_enemy_maybe' } },
      { by: 'a', say: 'origin_here_now' },
      { by: 'b', say: 'origin_promise' },
      { by: 'a', say: 'close_warm' },
    ],
  },

  // ---------- 家柄 ----------
  {
    id: 'house_c1', topic: 'house', rank: 'C',
    when: { a: { house: 'noble' } },
    lines: [
      { by: 'a', say: 'house_noble_burden' },
      { by: 'b', say: { if: { b: { house: 'noble' } }, then: 'house_noble_too', else: 'house_commoner_view' } },
      { by: 'a', say: 'house_noble_real' },
      { by: 'b', say: 'house_just_you' },
    ],
  },
  {
    id: 'house_c2', topic: 'house', rank: 'C',
    when: { a: { house: 'orphan' } },
    lines: [
      { by: 'a', say: 'house_orphan_tell' },
      { by: 'b', say: { if: { b: { house: 'orphan' } }, then: 'house_orphan_too', else: 'house_orphan_react' } },
      { by: 'a', say: 'house_school_home' },
      { by: 'b', say: 'house_family_here' },
    ],
  },
  {
    id: 'house_b1', topic: 'house', rank: 'B',
    when: { a: { house: 'noble' }, b: { house: 'orphan' } },
    lines: [
      { by: 'a', say: 'house_gap' },
      { by: 'b', say: 'house_orphan_pride' },
      { by: 'a', say: 'house_admire' },
      { by: 'b', say: 'house_same_ground' },
      { by: 'a', say: 'thanks_deep' },
    ],
  },

  // ---------- 特徴 ----------
  {
    id: 'trait_c1', topic: 'trait', rank: 'C',
    lines: [
      { by: 'a', say: 'trait_notice' },
      { by: 'b', say: 'trait_humble' },
      { by: 'a', say: 'trait_praise' },
      { by: 'b', say: 'trait_return' },
    ],
  },
  {
    id: 'trait_b1', topic: 'trait', rank: 'B',
    lines: [
      { by: 'a', say: 'trait_flaw' },
      { by: 'b', say: 'trait_reassure' },
      { by: 'a', say: 'trait_accept' },
      { by: 'b', say: 'close_warm' },
    ],
  },

  // ---------- 出来事：かばった ----------
  {
    id: 'ev_cover_c1', topic: 'ev_cover', rank: 'C',
    lines: [
      { by: 'a', say: 'cover_thanks' },
      { by: 'b', say: 'cover_natural' },
      { by: 'a', say: 'cover_worry' },
      { by: 'b', say: 'cover_promise' },
    ],
  },
  {
    id: 'ev_cover_b1', topic: 'ev_cover', rank: 'B',
    lines: [
      { by: 'a', say: 'cover_why' },
      { by: 'b', say: 'cover_reason' },
      { by: 'a', say: 'cover_repay' },
      { by: 'b', say: 'cover_trust' },
      { by: 'a', say: 'close_promise' },
    ],
  },

  // ---------- 出来事：同じ敵を倒した ----------
  {
    id: 'ev_samekill_c1', topic: 'ev_samekill', rank: 'C',
    lines: [
      { by: 'a', say: 'samekill_hi' },
      { by: 'b', say: 'samekill_combo' },
      { by: 'a', say: 'samekill_again' },
      { by: 'b', say: 'close_promise' },
    ],
  },
  {
    id: 'ev_samekill_b1', topic: 'ev_samekill', rank: 'B',
    lines: [
      { by: 'a', say: 'samekill_reflect' },
      { by: 'b', say: 'samekill_credit' },
      { by: 'a', say: 'samekill_style' },
      { by: 'b', say: 'samekill_partner' },
      { by: 'a', say: 'laugh_ok' },
    ],
  },

  // ---------- 出来事：試験合格 ----------
  {
    id: 'ev_exam_c1', topic: 'ev_exam', rank: 'C',
    lines: [
      { by: 'a', say: 'exam_report' },
      { by: 'b', say: 'exam_congrats' },
      { by: 'a', say: 'exam_effort' },
      { by: 'b', say: { if: { b: { hasDream: true } }, then: 'exam_spur', else: 'exam_inspired' } },
    ],
  },
  {
    id: 'ev_exam_b1', topic: 'ev_exam', rank: 'B',
    lines: [
      { by: 'a', say: 'exam_congrats_open' },
      { by: 'b', say: 'exam_relief' },
      { by: 'a', say: 'exam_ask_next' },
      { by: 'b', say: { if: { b: { hasDream: true } }, then: 'exam_dream_step', else: 'exam_find_path' } },
      { by: 'a', say: 'exam_cheer' },
    ],
  },

  // ---------- 出来事：仲間の退学・戦死 ----------
  {
    id: 'ev_loss_c1', topic: 'ev_loss', rank: 'C',
    lines: [
      { by: 'a', say: 'loss_open' },
      { by: 'b', say: 'loss_same' },
      { by: 'a', say: 'loss_regret' },
      { by: 'b', say: 'loss_carry' },
    ],
  },
  {
    id: 'ev_loss_b1', topic: 'ev_loss', rank: 'B',
    lines: [
      { by: 'a', say: 'loss_cant_sleep' },
      { by: 'b', say: 'loss_listen' },
      { by: 'a', say: 'loss_memory' },
      { by: 'b', say: 'loss_not_alone' },
      { by: 'a', say: 'thanks_deep' },
    ],
  },

  // ---------- 出来事：故郷が戦場に ----------
  {
    id: 'ev_homewar_c1', topic: 'ev_homewar', rank: 'C',
    lines: [
      { by: 'a', say: 'homewar_news' },
      { by: 'b', say: { if: { sameCountry: true }, then: 'homewar_same', else: 'homewar_sympathy' } },
      { by: 'a', say: 'homewar_helpless' },
      { by: 'b', say: 'homewar_strength' },
    ],
  },
  {
    id: 'ev_homewar_b1', topic: 'ev_homewar', rank: 'B',
    lines: [
      { by: 'a', say: 'homewar_go_back' },
      { by: 'b', say: 'homewar_stay' },
      { by: 'a', say: { if: { a: { house: 'orphan' } }, then: 'homewar_village', else: 'homewar_family' } },
      { by: 'b', say: 'homewar_with_you' },
      { by: 'a', say: 'thanks_deep' },
    ],
  },

  // ---------- 出来事：収穫祭 ----------
  {
    id: 'ev_festival_c1', topic: 'ev_festival', rank: 'C',
    lines: [
      { by: 'a', say: 'festival_invite' },
      { by: 'b', say: 'festival_yes' },
      { by: 'a', say: 'festival_plan' },
      { by: 'b', say: 'festival_look_forward' },
    ],
  },
  {
    id: 'ev_festival_b1', topic: 'ev_festival', rank: 'B',
    lines: [
      { by: 'a', say: 'festival_after' },
      { by: 'b', say: 'festival_memory' },
      { by: 'a', say: { if: { sameCountry: true }, then: 'festival_home_same', else: 'festival_home_diff' } },
      { by: 'b', say: 'festival_next_year' },
    ],
  },

  // ---------- 出来事：手合わせ ----------
  {
    id: 'ev_spar_c1', topic: 'ev_spar', rank: 'C',
    lines: [
      { by: 'a', say: 'spar_challenge' },
      { by: 'b', say: 'spar_accept' },
      { by: 'a', say: 'spar_result' },
      { by: 'b', say: 'spar_again' },
    ],
  },
  {
    id: 'ev_spar_b1', topic: 'ev_spar', rank: 'B',
    lines: [
      { by: 'a', say: 'spar_review' },
      { by: 'b', say: 'spar_advice' },
      { by: 'a', say: 'spar_learn' },
      { by: 'b', say: 'spar_grow' },
      { by: 'a', say: 'close_promise' },
    ],
  },

  // ---------- 出来事：負傷 ----------
  {
    id: 'ev_injury_c1', topic: 'ev_injury', rank: 'C',
    lines: [
      { by: 'a', say: 'injury_ask' },
      { by: 'b', say: 'injury_fine' },
      { by: 'a', say: 'injury_rest' },
      { by: 'b', say: 'thanks_soft' },
    ],
  },
  {
    id: 'ev_injury_b1', topic: 'ev_injury', rank: 'B',
    lines: [
      { by: 'a', say: 'injury_visit' },
      { by: 'b', say: 'injury_frustrated' },
      { by: 'a', say: 'injury_wait' },
      { by: 'b', say: 'injury_recover' },
      { by: 'a', say: 'close_warm' },
    ],
  },

  // ---------- 関係：友情 ----------
  {
    id: 'rel_friend_c1', topic: 'rel_friend', rank: 'C',
    when: { kind: 'friend' },
    lines: [
      { by: 'a', say: 'friend_easy' },
      { by: 'b', say: 'friend_same' },
      { by: 'a', say: 'friend_more' },
      { by: 'b', say: 'close_warm' },
    ],
  },
  {
    id: 'rel_friend_b1', topic: 'rel_friend', rank: 'B',
    when: { kind: 'friend' },
    lines: [
      { by: 'a', say: 'friend_secret' },
      { by: 'b', say: 'friend_listen' },
      { by: 'a', say: 'friend_trust' },
      { by: 'b', say: 'friend_always' },
    ],
  },
  {
    id: 'rel_friend_a1', topic: 'rel_friend', rank: 'A',
    when: { kind: 'friend' },
    lines: [
      { by: 'a', say: 'friend_future' },
      { by: 'b', say: { if: { sameCountry: true }, then: 'friend_same_road', else: 'friend_letters' } },
      { by: 'a', say: 'friend_forever' },
      { by: 'b', say: 'friend_forever_yes' },
      { by: 'a', say: 'thanks_deep' },
    ],
  },

  // ---------- 関係：ライバル ----------
  {
    id: 'rel_rival_c1', topic: 'rel_rival', rank: 'C',
    when: { kind: 'rival' },
    lines: [
      { by: 'a', say: 'rival_declare' },
      { by: 'b', say: 'rival_accept' },
      { by: 'a', say: 'rival_score' },
      { by: 'b', say: 'rival_spur' },
    ],
  },
  {
    id: 'rel_rival_b1', topic: 'rel_rival', rank: 'B',
    when: { kind: 'rival' },
    lines: [
      { by: 'a', say: 'rival_admit' },
      { by: 'b', say: 'rival_admit_too' },
      { by: 'a', say: 'rival_goal' },
      { by: 'b', say: 'rival_wait' },
    ],
  },
  {
    id: 'rel_rival_a1', topic: 'rel_rival', rank: 'A',
    when: { kind: 'rival' },
    lines: [
      { by: 'a', say: 'rival_future' },
      { by: 'b', say: { if: { sameCountry: true }, then: 'rival_same_flag', else: 'rival_battlefield' } },
      { by: 'a', say: 'rival_respect' },
      { by: 'b', say: 'rival_handshake' },
    ],
  },

  // ---------- 関係：恋愛（気持ちの描写まで） ----------
  {
    id: 'rel_love_b1', topic: 'rel_love', rank: 'B',
    when: { kind: 'love' },
    lines: [
      { by: 'a', say: 'love_nervous' },
      { by: 'b', say: 'love_what' },
      { by: 'a', say: 'love_confess' },
      { by: 'b', say: 'love_blush' },
      { by: 'a', say: 'love_relief' },
    ],
  },
  {
    id: 'rel_love_a1', topic: 'rel_love', rank: 'A',
    when: { kind: 'love' },
    lines: [
      { by: 'a', say: 'love_answer' },
      { by: 'b', say: 'love_overjoyed' },
      { by: 'a', say: 'love_future' },
      { by: 'b', say: { if: { sameCountry: true }, then: 'love_same_future', else: 'love_border_vow' } },
      { by: 'a', say: 'love_together_close' },
    ],
  },

  // ---------- 日常 ----------
  {
    id: 'daily_c1', topic: 'daily', rank: 'C',
    lines: [
      { by: 'a', say: 'daily_weather' },
      { by: 'b', say: 'daily_reply' },
      { by: 'a', say: 'daily_teacher' },
      { by: 'b', say: 'daily_laugh' },
    ],
  },
  {
    id: 'daily_b1', topic: 'daily', rank: 'B',
    lines: [
      { by: 'a', say: 'daily_tea' },
      { by: 'b', say: 'daily_tea_yes' },
      { by: 'a', say: 'daily_talk_school' },
      { by: 'b', say: { if: { b: { hasDream: true } }, then: 'daily_school_dream', else: 'daily_school_find' } },
      { by: 'a', say: 'close_warm' },
    ],
  },
];
