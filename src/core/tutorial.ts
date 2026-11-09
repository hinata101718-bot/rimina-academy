// 最初の1時間の案内（14夜目）。DOM非依存
// - 1年目の4月だけ、決まった流れで案内する（机の案内・3枚だけの授業・最初の面談・負けない最初の戦い）
// - はじめて出たものは、案内役が短く説明する（2回目からは出ない。設定「案内を見なおす」でもう一度）
// - 古いセーブ（tutorial がない）には出さない
import type { GameState, TalkLog, Quest, Student } from './state';
import { B } from '../data/balance';
import { TIPS, FIRST_TALK, FIRST_TALK_PROMPT, DESK_TOUR } from '../data/tutorial';
import { enrolled } from './game';
import { examCandidates } from './exam';
import { archiveTalk } from './support';

/** 案内のしくみがあるか（新しく始めたゲーム、または設定で「案内を見なおす」を押した） */
export function guideOn(s: GameState): boolean { return !!s.tutorial && !s.tutorial.off; }
/** 決まった流れの案内の最中か（1年目の4月） */
export function tutorialMonth(s: GameState): boolean { return guideOn(s) && s.year === 1 && s.month === 0 && s.cohortCount === 1; }
/** 1日目（授業の札は3枚、休講なし） */
export function firstLessonDay(s: GameState): boolean { return tutorialMonth(s) && s.week === 1 && (s.day ?? 1) === 1; }
/** 机の案内の今の段（なければ null） */
export function deskTourStep(s: GameState): { i: number; target: string | null; text: string } | null {
  if (!guideOn(s)) return null;
  // 最初の4月は1日目の授業の前だけ（設定の「案内を見なおす」のあとは、いつでも）
  if (tutorialMonth(s) && !s.tutorial!.replay && (s.week !== 1 || (s.day ?? 1) !== 1)) return null;
  const i = s.tutorial!.tour;
  if (i >= DESK_TOUR.length) return null;
  return { i, ...DESK_TOUR[i] };
}
export function nextTour(s: GameState): void { if (s.tutorial) s.tutorial.tour += 1; }
export function skipTutorial(s: GameState): void {
  if (!s.tutorial) return;
  s.tutorial.off = true;
  s.tutorial.tour = DESK_TOUR.length;
  s.cardGuide = 'done'; // 17夜目：札の戦いの案内も出さない（設定の「案内を見なおす」で、もう一度）
  // 最初の依頼は、ふつうの依頼に並べなおす（まだ出撃していなければ）
  if (s.quests.some((q) => q.tutorial) && !s.battle) for (const q of s.quests) delete q.tutorial;
}
/** 設定「案内を見なおす」：はじめて出たときの説明を、もう一度出す */
export function replayGuide(s: GameState): void {
  s.tutorial ??= { tour: DESK_TOUR.length, seen: [] };
  s.tutorial.off = false;
  s.tutorial.seen = [];
  s.tutorial.talked = true;
  s.tutorial.tour = 0;
  s.tutorial.replay = true;
  s.cardGuide = 'pending'; // 17夜目：次の札の戦いのはじめに、札の戦いの案内をもう一度
}

/** はじめて出たときの説明を出す（見たものは出さない） */
export function tip(s: GameState, key: string, v: Record<string, string> = {}): boolean {
  if (!guideOn(s)) return false;
  const t = s.tutorial!;
  if (t.seen.includes(key)) return false;
  const def = TIPS[key];
  if (!def) return false;
  t.seen.push(key);
  const fill = (x: string) => x.replace(/\{(\w+)\}/g, (m, k) => v[k] ?? m);
  s.pending.push({ type: 'guide', key, title: def.title, lines: def.lines.map(fill) });
  return true;
}

/** 授業や戦いのあとに、はじめて出たものを探して説明する */
export function checkTips(s: GameState): void {
  if (!guideOn(s)) return;
  const seen = s.tutorial!.seen;
  if (!seen.includes('exam')) { const ex = examCandidates(s).filter((x) => x.status === 'enrolled'); if (ex.length) tip(s, 'exam', { a: ex[0].given }); }
  if (!seen.includes('supportC')) {
    const sp = Object.values(s.supports).find((x) => x.lastRank && s.students[x.a]?.status === 'enrolled' && s.students[x.b]?.status === 'enrolled');
    if (sp) tip(s, 'supportC', { a: s.students[sp.a].given, b: s.students[sp.b].given });
  }
  if (tutorialMonth(s)) {
    if (s.week >= 2) tip(s, 'target');
    if (s.week >= 3 && s.tutorial!.seen.includes('target')) tip(s, 'news');
  }
}

/** 最初の面談の相手：信頼より、目立つ子（能力の合計がいちばん高い1年生） */
export function firstTalkStudent(s: GameState): Student | null {
  const list = enrolled(s);
  if (!list.length) return null;
  const sum = (st: Student) => Object.values(st.stats).reduce((a, b) => a + b, 0);
  return [...list].sort((a, b) => sum(b) - sum(a) || a.id.localeCompare(b.id))[0];
}
/** 最初の面談（3択）。1日目の授業のあと、2日目の終わりに */
export function firstTalk(s: GameState): TalkLog | null {
  const st = firstTalkStudent(s);
  if (!st || !s.tutorial || s.tutorial.talked) return null;
  s.tutorial.talked = true;
  const p = st.personality;
  const t: TalkLog = {
    a: st.id, b: 'teacher', rank: '', title: '入学して一週目', kind: 'interview',
    lines: [
      { by: 'narr', text: `放課後、${st.given}が教官室の戸をたたいた。` },
      { by: st.id, text: FIRST_TALK.open[p] ?? FIRST_TALK.open.serious },
    ],
    choice: {
      prompt: FIRST_TALK_PROMPT,
      options: FIRST_TALK.replies.map((r) => ({ label: r.label, effect: { ...r.effect }, lines: [
        { by: st.id, text: r.say[p] ?? r.say.serious },
        { by: 'narr', text: `（${st.given}の${r.note}）` },
      ] })),
    },
    def: 'tutorial_first', again: false,
  };
  archiveTalk(s, t);
  return t;
}

/** 最初の依頼（4月の月末）：盗賊の見張り。負けない小さな依頼 */
export function tutorialQuest(s: GameState, id: string): Quest {
  return { id, kind: 'bandit', title: '盗賊の見張り', client: '街道の村', clientCountry: null, enemyCountry: null, objective: 'rout', template: 'forest_road',
    level: 1, reward: B.tutorial.reward, danger: 1, weather: 'clear', real: true, tutorial: true, region: 'septem' };
}
/** いま出撃しているのが最初の依頼か */
export function inTutorialBattle(s: GameState): boolean {
  const id = s.battle?.questId;
  return !!id && !!s.quests.find((q) => q.id === id)?.tutorial;
}
