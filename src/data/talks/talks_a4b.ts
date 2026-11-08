// 支援会話：4夜目に増やしたA会話（流れ）。文面は phrases_a4b.ts
// 話題：手合わせのあと・けがのあと・なにげない話・好きな食べもの・授業・家族・休みの日・怖いもの
// A＝相手への気持ちと将来の約束。友情・ライバル・恋愛で言葉を分ける。
import type { TalkDef, TalkSay, TalkCond } from '../../core/types';

const iff = (c: TalkCond, then: TalkSay, els: TalkSay): TalkSay => ({ if: c, then, else: els });
const same = { sameCountry: true };
const love = { kind: 'love' as const }, rival = { kind: 'rival' as const };
const war = { stage: 'war' as const };
const byKind = (l: string, r: string, f: string): TalkSay => iff(love, l, iff(rival, r, f));
const grp = (side: 'a' | 'b', group: 'loud' | 'quiet'): TalkCond => (side === 'a' ? { a: { group } } : { b: { group } });
const group3 = (side: 'a' | 'b', loud: string, quiet: string, steady: string): TalkSay =>
  iff(grp(side, 'loud'), loud, iff(grp(side, 'quiet'), quiet, steady));

export const TALKS_A4B: TalkDef[] = [
  // ======================= 出来事：手合わせ（A） =======================
  {
    id: 'ev_spar_a1', topic: 'ev_spar', rank: 'A',
    lines: [
      { by: 'n', say: 'n_training' },
      { by: 'a', say: 'spar_a_open' },
      { by: 'b', say: 'spar_a_count' },
      { by: 'a', say: 'spar_a_first' },
      { by: 'b', say: group3('b', 'spar_a_first_b_loud', 'spar_a_first_b_quiet', 'spar_a_first_b_steady') },
      { by: 'a', say: 'g_really' },
      { by: 'b', say: 'spar_a_watch' },
      { by: 'a', say: 'spar_a_scared' },
      { by: 'b', say: 'spar_a_scared_b' },
      { by: 'a', say: byKind('spar_a_love', 'spar_a_rival', 'spar_a_friend') },
      { by: 'b', say: byKind('spar_a_love_b', 'spar_a_rival_b', 'spar_a_friend_b') },
      { by: 'a', say: iff(war, 'spar_a_war', 'spar_a_peace') },
      { by: 'b', say: 'spar_a_promise' },
      { by: 'a', say: 'g_promise_a' },
      { by: 'n', say: 'n_laugh' },
      { by: 'a', say: 'spar_a_again' },
      { by: 'b', say: 'spar_a_again_b' },
    ],
  },

  // ======================= 出来事：けが（A） =======================
  // 出来事の当事者（けがをした人）は a
  {
    id: 'ev_injury_a1', topic: 'ev_injury', rank: 'A',
    lines: [
      { by: 'n', say: 'n_injury_a' },
      { by: 'a', say: 'injury_a_open' },
      { by: 'b', say: 'injury_a_glad' },
      { by: 'a', say: 'injury_a_thanks' },
      { by: 'b', say: iff(love, 'injury_a_casual_love', 'injury_a_casual') },
      { by: 'a', say: 'injury_a_notice' },
      { by: 'b', say: 'injury_a_caught' },
      { by: 'a', say: 'injury_a_ask' },
      { by: 'b', say: 'injury_a_felt' },
      { by: 'a', say: 'injury_a_sorry' },
      { by: 'b', say: 'injury_a_angry' },
      { by: 'a', say: 'injury_a_cant' },
      { by: 'b', say: byKind('injury_a_love_b', 'injury_a_rival_b', 'injury_a_friend_b') },
      { by: 'a', say: byKind('injury_a_love', 'injury_a_rival', 'injury_a_friend') },
      { by: 'b', say: 'injury_a_promise' },
      { by: 'a', say: 'g_promise_a' },
      { by: 'n', say: 'n_laugh' },
      { by: 'a', say: 'injury_a_go' },
      { by: 'b', say: 'injury_a_go_b' },
    ],
  },

  // ======================= なにげない話（A） =======================
  {
    id: 'daily_a1', topic: 'daily', rank: 'A',
    lines: [
      { by: 'n', say: 'n_dining' },
      { by: 'a', say: 'daily_a_open' },
      { by: 'b', say: 'daily_a_habit' },
      { by: 'a', say: 'daily_a_first' },
      { by: 'b', say: 'daily_a_first_b' },
      { by: 'a', say: 'g_laugh' },
      { by: 'b', say: 'daily_a_fav' },
      { by: 'a', say: group3('a', 'daily_a_fav_loud', 'daily_a_fav_quiet', 'daily_a_fav_steady') },
      { by: 'b', say: iff(grp('a', 'quiet'), 'daily_a_fav_b_same', 'daily_a_fav_b') },
      { by: 'a', say: 'daily_a_worry' },
      { by: 'b', say: iff(war, 'daily_a_war_b', 'daily_a_peace_b') },
      { by: 'a', say: 'daily_a_sorry' },
      { by: 'b', say: 'daily_a_no' },
      { by: 'a', say: byKind('daily_a_love', 'daily_a_rival', 'daily_a_friend') },
      { by: 'b', say: byKind('daily_a_love_b', 'daily_a_rival_b', 'daily_a_friend_b') },
      { by: 'a', say: 'daily_a_promise' },
      { by: 'b', say: 'daily_a_promise_b' },
      { by: 'n', say: 'n_silence_warm' },
    ],
  },

  // ======================= 好きな食べもの（A） =======================
  {
    id: 'food_a1', topic: 'food', rank: 'A',
    lines: [
      { by: 'n', say: 'n_kitchen' },
      { by: 'a', say: 'food_a_open' },
      { by: 'b', say: 'food_a_yes' },
      { by: 'n', say: 'n_food_a_cook' },
      { by: 'a', say: 'food_a_taste' },
      { by: 'b', say: iff(same, 'food_a_same_taste', 'food_a_new_taste') },
      { by: 'a', say: 'food_a_memory' },
      { by: 'b', say: 'food_a_memory_b' },
      { by: 'a', say: 'food_a_tease' },
      { by: 'b', say: iff({ b: { personalities: ['cynic', 'competitive', 'hot'] } }, 'food_a_tease_back_hard', 'food_a_tease_back_soft') },
      { by: 'a', say: 'g_laugh' },
      { by: 'b', say: 'food_a_my_turn' },
      { by: 'a', say: byKind('food_a_love', 'food_a_rival', 'food_a_friend') },
      { by: 'b', say: byKind('food_a_love_b', 'food_a_rival_b', 'food_a_friend_b') },
      { by: 'a', say: iff(war, 'food_a_promise_war', 'food_a_promise') },
      { by: 'b', say: 'food_a_promise_b' },
      { by: 'a', say: 'g_glad' },
    ],
  },

  // ======================= 授業（A） =======================
  {
    id: 'study_a1', topic: 'study', rank: 'A',
    lines: [
      { by: 'n', say: 'n_library' },
      { by: 'a', say: 'study_a_open' },
      { by: 'b', say: 'study_a_habit' },
      { by: 'a', say: 'study_a_result' },
      { by: 'b', say: iff({ b: { personalities: ['cynic', 'competitive'] } }, 'study_a_jealous', 'study_a_proud') },
      { by: 'a', say: 'study_a_you_too' },
      { by: 'b', say: 'study_a_not_yet' },
      { by: 'a', say: 'study_a_night' },
      { by: 'b', say: 'study_a_night_b' },
      { by: 'a', say: iff(love, 'g_blush', 'g_nod') },
      { by: 'a', say: 'study_a_clash' },
      { by: 'b', say: 'study_a_clash_b' },
      { by: 'a', say: byKind('study_a_love', 'study_a_rival', 'study_a_friend') },
      { by: 'b', say: byKind('study_a_love_b', 'study_a_rival_b', 'study_a_friend_b') },
      { by: 'a', say: 'study_a_future' },
      { by: 'b', say: 'study_a_future_b' },
      { by: 'a', say: 'g_promise_q' },
      { by: 'b', say: 'g_promise_a' },
    ],
  },

  // ======================= 家族の話（A） =======================
  {
    id: 'family_a1', topic: 'family', rank: 'A',
    lines: [
      { by: 'n', say: 'n_night' },
      { by: 'a', say: 'family_a_open' },
      { by: 'b', say: 'family_a_wrote' },
      { by: 'a', say: iff({ a: { house: 'orphan' } }, 'family_a_reply_orphan', iff({ a: { house: 'noble' } }, 'family_a_reply_noble', 'family_a_reply')) },
      { by: 'b', say: 'family_a_glad' },
      { by: 'a', say: 'family_a_why' },
      { by: 'b', say: 'family_a_nothing' },
      { by: 'a', say: 'family_a_wrote_you' },
      { by: 'b', say: 'family_a_what' },
      { by: 'a', say: byKind('family_a_love', 'family_a_rival', 'family_a_friend') },
      { by: 'b', say: byKind('family_a_love_b', 'family_a_rival_b', 'family_a_friend_b') },
      { by: 'a', say: 'family_a_meet' },
      { by: 'b', say: 'family_a_nervous' },
      { by: 'a', say: 'family_a_fine' },
      { by: 'b', say: iff({ b: { house: 'orphan' } }, 'family_a_b_orphan', 'family_a_b_mine') },
      { by: 'a', say: 'g_promise_a' },
      { by: 'n', say: 'n_silence_warm' },
      { by: 'b', say: 'thanks_deep' },
    ],
  },

  // ======================= 休みの日（A） =======================
  {
    id: 'hobby_a1', topic: 'hobby', rank: 'A',
    lines: [
      { by: 'n', say: 'n_hobby_a' },
      { by: 'a', say: 'hobby_a_open' },
      { by: 'b', say: 'hobby_a_wow' },
      { by: 'a', say: 'hobby_a_why' },
      { by: 'b', say: 'hobby_a_why_me' },
      { by: 'a', say: 'hobby_a_because' },
      { by: 'b', say: iff(love, 'g_blush', 'hobby_a_honored') },
      { by: 'b', say: 'hobby_a_gift' },
      { by: 'a', say: 'hobby_a_gift_react' },
      { by: 'n', say: 'n_hobby_a_gift' },
      { by: 'a', say: 'hobby_a_gift_thanks' },
      { by: 'b', say: iff(war, 'hobby_a_war_b', 'hobby_a_peace_b') },
      { by: 'a', say: 'hobby_a_clash' },
      { by: 'b', say: 'hobby_a_clash_b' },
      { by: 'a', say: byKind('hobby_a_love', 'hobby_a_rival', 'hobby_a_friend') },
      { by: 'b', say: byKind('hobby_a_love_b', 'hobby_a_rival_b', 'hobby_a_friend_b') },
      { by: 'a', say: 'hobby_a_promise' },
      { by: 'b', say: 'hobby_a_promise_b' },
      { by: 'n', say: 'n_sunset' },
    ],
  },

  // ======================= 怖いもの（A） =======================
  {
    id: 'fear_a1', topic: 'fear', rank: 'A',
    lines: [
      { by: 'n', say: 'n_night' },
      { by: 'a', say: 'fear_a_open' },
      { by: 'b', say: 'fear_a_why' },
      { by: 'a', say: 'fear_a_reason' },
      { by: 'b', say: iff(love, 'g_blush', 'fear_a_same_b') },
      { by: 'b', say: 'fear_a_confess' },
      { by: 'a', say: 'fear_a_never' },
      { by: 'b', say: 'fear_a_doubt' },
      { by: 'a', say: 'fear_a_insist' },
      { by: 'b', say: iff(war, 'fear_a_war_b', 'fear_a_calm_b') },
      { by: 'a', say: 'fear_a_not_strong' },
      { by: 'b', say: 'g_silence' },
      { by: 'a', say: byKind('fear_a_love', 'fear_a_rival', 'fear_a_friend') },
      { by: 'b', say: byKind('fear_a_love_b', 'fear_a_rival_b', 'fear_a_friend_b') },
      { by: 'a', say: 'fear_a_promise' },
      { by: 'b', say: 'fear_a_promise_b' },
      { by: 'n', say: 'n_silence_warm' },
      { by: 'a', say: 'fear_a_light' },
      { by: 'b', say: 'fear_a_light_b' },
    ],
  },
];
