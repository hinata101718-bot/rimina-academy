// 「まるごと書いた会話」（7夜目）：性格を5つのまとまりに分け、組み合わせごとに会話を通しで書く。
// 部品の差し込みは、名前・国名・夢などの固有の言葉だけ（{me} {you} {myDream} {yourDream} {myCountry} {yourCountry} {myHome} {yourHome} …）。
// 返事は前のセリフの中身を拾う（相手の夢・故郷・出来事・気持ちに触れる）。
import type { PersonalityId, TalkTopic, TalkCond } from '../../core/types';
import type { TeacherBg, InterviewTopic } from './interviews';

/** 性格のまとまり：明るい・落ち着いた・強気・控えめ・ひねくれ */
export type Tone = 'bright' | 'calm' | 'strong' | 'modest' | 'twisted';
export const TONE_OF: Record<PersonalityId, Tone> = {
  cheerful: 'bright', gentle: 'bright',
  calm: 'calm', serious: 'calm',
  hot: 'strong', competitive: 'strong',
  timid: 'modest', shy: 'modest',
  cynic: 'twisted', whimsical: 'twisted',
};
export const TONE_NAMES: Record<Tone, string> = { bright: '明るい', calm: '落ち着いた', strong: '強気', modest: '控えめ', twisted: 'ひねくれ' };
export const TONES: Tone[] = ['bright', 'calm', 'strong', 'modest', 'twisted'];

/** 1行。t＝文面（話す人の口調で）。p＝同じまとまりの中で性格ごとに言い替えたいとき */
export interface WholeLine { by: 'a' | 'b' | 'n'; t: string; p?: Partial<Record<PersonalityId, string>> }
/** 支援会話（a・bの性格のまとまりの組み合わせごと） */
export interface WholeTalk { id: string; topic: TalkTopic; rank: 'C' | 'B' | 'A'; ga: Tone; gb: Tone; when?: TalkCond; lines: WholeLine[] }

/** 面談の1行。by：a＝生徒、t＝先生（経歴4種で言い替え。knight だけ書けば全員それを使う）、n＝地の文 */
export interface WholeIvLine { by: 'a' | 't' | 'n'; t: string | Partial<Record<TeacherBg, string>>; p?: Partial<Record<PersonalityId, string>> }
/** 面談（生徒の性格のまとまりごと） */
export interface WholeInterview { id: string; topic: InterviewTopic; title: string; g: Tone; when?: TalkCond; lines: WholeIvLine[] }
