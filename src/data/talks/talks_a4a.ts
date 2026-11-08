// 支援会話：4夜目に増やしたA会話（流れ）。文面は phrases_a4a.ts
// A＝相手への気持ちや将来の約束。友情・ライバル・恋愛で分ける（byKind）。
import type { TalkDef, TalkSay, TalkCond } from '../../core/types';

const iff = (c: TalkCond, then: TalkSay, els: TalkSay): TalkSay => ({ if: c, then, else: els });
const love = { kind: 'love' as const }, rival = { kind: 'rival' as const };
const byKind = (l: string, r: string, f: string): TalkSay => iff(love, l, iff(rival, r, f));
const same = { sameCountry: true };
const war = { stage: 'war' as const };

export const TALKS_A4A: TalkDef[] = [
  // ======================= 生まれ（A） =======================
  {
    id: 'house_a1', topic: 'house', rank: 'A',
    lines: [
      { by: 'n', say: 'n_sunset' },
      { by: 'a', say: 'house_a1_open' },
      { by: 'b', say: 'house_a1_listen' },
      { by: 'a', say: iff({ a: { house: 'noble' } }, 'house_a1_noble', iff({ a: { house: 'orphan' } }, 'house_a1_orphan', 'house_a1_common')) },
      { by: 'b', say: 'house_a1_changed' },
      { by: 'a', say: 'house_a1_because' },
      { by: 'b', say: iff({ sameHouse: true }, 'house_a1_same', 'house_a1_diff') },
      { by: 'a', say: 'house_a1_first' },
      { by: 'b', say: 'house_a1_first_b' },
      { by: 'n', say: 'n_laugh' },
      { by: 'a', say: 'house_a1_worry' },
      { by: 'b', say: 'house_a1_push' },
      { by: 'a', say: 'house_a1_push_a' },
      { by: 'b', say: byKind('house_a1_love', 'house_a1_rival', 'house_a1_friend') },
      { by: 'a', say: iff(love, 'house_a1_reply_love', 'house_a1_reply') },
      { by: 'b', say: 'house_a1_promise' },
      { by: 'a', say: 'g_promise_a' },
      { by: 'n', say: 'n_bell' },
    ],
  },

  // ======================= お互いの癖（A） =======================
  {
    id: 'trait_a1', topic: 'trait', rank: 'A',
    lines: [
      { by: 'n', say: 'n_wind' },
      { by: 'a', say: 'trait_a1_open' },
      { by: 'b', say: 'trait_a1_remember' },
      { by: 'a', say: 'trait_a1_since' },
      { by: 'b', say: iff({ b: { group: 'loud' } }, 'trait_a1_proud_loud', 'trait_a1_proud_quiet') },
      { by: 'a', say: 'trait_a1_your' },
      { by: 'b', say: 'trait_a1_embarrassed' },
      { by: 'a', say: 'trait_a1_example' },
      { by: 'b', say: 'trait_a1_flaw_b' },
      { by: 'a', say: 'trait_a1_keep' },
      { by: 'b', say: 'trait_a1_keep_b' },
      { by: 'n', say: 'n_silence_warm' },
      { by: 'a', say: byKind('trait_a1_love', 'trait_a1_rival', 'trait_a1_friend') },
      { by: 'b', say: byKind('trait_a1_love_b', 'trait_a1_rival_b', 'trait_a1_friend_b') },
      { by: 'a', say: 'trait_a1_future' },
      { by: 'b', say: iff(war, 'trait_a1_war', 'trait_a1_peace') },
      { by: 'a', say: 'g_promise_q' },
      { by: 'b', say: 'g_promise_a' },
      { by: 'n', say: 'n_laugh' },
    ],
  },

  // ======================= かばってくれた日（A） =======================
  {
    id: 'ev_cover_a1', topic: 'ev_cover', rank: 'A',
    lines: [
      { by: 'n', say: 'n_night' },
      { by: 'a', say: 'cover_a1_open' },
      { by: 'b', say: 'cover_a1_again' },
      { by: 'a', say: 'cover_a1_not_debt' },
      { by: 'b', say: 'cover_a1_ask' },
      { by: 'a', say: 'cover_a1_answer' },
      { by: 'b', say: iff({ b: { group: 'quiet' } }, 'cover_a1_quiet', 'cover_a1_loud') },
      { by: 'a', say: 'cover_a1_next' },
      { by: 'b', say: 'cover_a1_refuse' },
      { by: 'a', say: 'cover_a1_refuse_a' },
      { by: 'b', say: 'cover_a1_cornered' },
      { by: 'n', say: 'n_laugh' },
      { by: 'a', say: 'cover_a1_back' },
      { by: 'b', say: byKind('cover_a1_love', 'cover_a1_rival', 'cover_a1_friend') },
      { by: 'a', say: iff(love, 'cover_a1_love_a', 'cover_a1_other_a') },
      { by: 'b', say: 'cover_a1_promise' },
      { by: 'a', say: 'g_promise_a' },
    ],
  },

  // ======================= 息の合った一撃（A） =======================
  {
    id: 'ev_samekill_a1', topic: 'ev_samekill', rank: 'A',
    lines: [
      { by: 'n', say: 'n_after_battle' },
      { by: 'a', say: 'samekill_a1_open' },
      { by: 'b', say: 'samekill_a1_same' },
      { by: 'a', say: 'samekill_a1_wordless' },
      { by: 'b', say: iff({ b: { group: 'steady' } }, 'samekill_a1_reason_steady', 'samekill_a1_reason_feel') },
      { by: 'a', say: 'samekill_a1_past' },
      { by: 'b', say: 'samekill_a1_past_b' },
      { by: 'n', say: 'n_laugh' },
      { by: 'a', say: 'samekill_a1_now' },
      { by: 'b', say: 'samekill_a1_test' },
      { by: 'a', say: byKind('samekill_a1_guess_love', 'samekill_a1_guess_rival', 'samekill_a1_guess_friend') },
      { by: 'b', say: byKind('samekill_a1_ans_love', 'samekill_a1_ans_rival', 'samekill_a1_ans_friend') },
      { by: 'a', say: 'samekill_a1_fear' },
      { by: 'b', say: 'samekill_a1_scold' },
      { by: 'a', say: 'samekill_a1_sorry' },
      { by: 'b', say: iff(war, 'samekill_a1_war', 'samekill_a1_peace') },
      { by: 'a', say: 'samekill_a1_promise' },
      { by: 'b', say: 'g_promise_a' },
    ],
  },

  // ======================= 試験のあと（A） =======================
  {
    id: 'ev_exam_a1', topic: 'ev_exam', rank: 'A',
    lines: [
      { by: 'n', say: 'n_scene' },
      { by: 'a', say: 'exam_a1_open' },
      { by: 'b', say: 'exam_a1_proud' },
      { by: 'a', say: 'exam_a1_thanks' },
      { by: 'b', say: 'exam_a1_modest' },
      { by: 'a', say: 'exam_a1_insist' },
      { by: 'b', say: iff({ b: { hasDream: true } }, 'exam_a1_dream_b', 'exam_a1_nodream_b') },
      { by: 'a', say: 'exam_a1_next' },
      { by: 'b', say: 'exam_a1_next_b' },
      { by: 'a', say: 'exam_a1_not_straight' },
      { by: 'b', say: 'exam_a1_surprise' },
      { by: 'a', say: byKind('exam_a1_love', 'exam_a1_rival', 'exam_a1_friend') },
      { by: 'b', say: byKind('exam_a1_love_b', 'exam_a1_rival_b', 'exam_a1_friend_b') },
      { by: 'n', say: 'n_laugh' },
      { by: 'a', say: 'exam_a1_future' },
      { by: 'b', say: 'exam_a1_future_b' },
      { by: 'a', say: 'g_promise_q' },
      { by: 'b', say: 'g_promise_a' },
    ],
  },

  // ======================= 去った仲間（A） =======================
  {
    id: 'ev_loss_a1', topic: 'ev_loss', rank: 'A',
    lines: [
      { by: 'n', say: 'n_sunset' },
      { by: 'a', say: 'loss_a1_open' },
      { by: 'b', say: 'loss_a1_time' },
      { by: 'a', say: 'loss_a1_still' },
      { by: 'b', say: 'loss_a1_why' },
      { by: 'a', say: 'loss_a1_because' },
      { by: 'b', say: iff({ b: { group: 'quiet' } }, 'loss_a1_quiet', 'loss_a1_loud') },
      { by: 'a', say: 'loss_a1_enough' },
      { by: 'n', say: 'n_silence_warm' },
      { by: 'b', say: 'loss_a1_memory' },
      { by: 'a', say: 'loss_a1_memory_a' },
      { by: 'b', say: 'loss_a1_fear' },
      { by: 'a', say: 'loss_a1_clash' },
      { by: 'b', say: 'loss_a1_clash_b' },
      { by: 'b', say: byKind('loss_a1_love', 'loss_a1_rival', 'loss_a1_friend') },
      { by: 'a', say: byKind('loss_a1_love_a', 'loss_a1_rival_a', 'loss_a1_friend_a') },
      { by: 'a', say: iff(war, 'loss_a1_war', 'loss_a1_peace') },
      { by: 'b', say: 'loss_a1_promise' },
      { by: 'a', say: 'g_promise_a' },
    ],
  },

  // ======================= 故郷の知らせ（A） =======================
  {
    id: 'ev_homewar_a1', topic: 'ev_homewar', rank: 'A',
    lines: [
      { by: 'n', say: 'n_night' },
      { by: 'a', say: 'homewar_a1_open' },
      { by: 'b', say: 'homewar_a1_ask' },
      { by: 'a', say: iff({ a: { house: 'orphan' } }, 'homewar_a1_kids_safe', 'homewar_a1_family_safe') },
      { by: 'b', say: 'homewar_a1_relief' },
      { by: 'a', say: 'homewar_a1_but' },
      { by: 'b', say: 'homewar_a1_hmm' },
      { by: 'a', say: 'homewar_a1_stayed' },
      { by: 'b', say: 'homewar_a1_glad' },
      { by: 'a', say: 'homewar_a1_selfish' },
      { by: 'b', say: 'homewar_a1_selfish_b' },
      { by: 'n', say: 'n_silence_warm' },
      { by: 'b', say: iff(same, 'homewar_a1_same', 'homewar_a1_diff') },
      { by: 'a', say: byKind('homewar_a1_love', 'homewar_a1_rival', 'homewar_a1_friend') },
      { by: 'b', say: byKind('homewar_a1_love_b', 'homewar_a1_rival_b', 'homewar_a1_friend_b') },
      { by: 'a', say: 'homewar_a1_sight' },
      { by: 'b', say: 'g_promise_q' },
      { by: 'a', say: 'g_promise_a' },
    ],
  },

  // ======================= 収穫祭の夜（A） =======================
  {
    id: 'ev_festival_a1', topic: 'ev_festival', rank: 'A',
    lines: [
      { by: 'n', say: 'n_festival' },
      { by: 'a', say: 'festival_a1_open' },
      { by: 'b', say: 'festival_a1_short' },
      { by: 'a', say: 'festival_a1_lanterns' },
      { by: 'b', say: 'festival_a1_wish_ask' },
      { by: 'a', say: byKind('festival_a1_wish_love', 'festival_a1_wish_rival', 'festival_a1_wish_friend') },
      { by: 'b', say: iff(love, 'festival_a1_react_love', 'festival_a1_react') },
      { by: 'a', say: 'festival_a1_you' },
      { by: 'b', say: 'festival_a1_secret' },
      { by: 'a', say: 'festival_a1_unfair' },
      { by: 'b', say: byKind('festival_a1_tell_love', 'festival_a1_tell_rival', 'festival_a1_tell_friend') },
      { by: 'n', say: 'n_laugh' },
      { by: 'a', say: iff(same, 'festival_a1_home_same', 'festival_a1_home_diff') },
      { by: 'b', say: 'festival_a1_home_b' },
      { by: 'a', say: iff(war, 'festival_a1_war', 'festival_a1_peace') },
      { by: 'b', say: 'festival_a1_promise' },
      { by: 'a', say: 'g_promise_a' },
      { by: 'b', say: 'festival_a1_last' },
    ],
  },
];
