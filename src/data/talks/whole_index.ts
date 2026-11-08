// まるごと書いた会話の一覧（7夜目）
import type { WholeTalk, WholeInterview } from './whole';
import { WHOLE_A } from './whole_a';
import { WHOLE_B } from './whole_b';
import { WHOLE_C } from './whole_c';
import { WHOLE_D } from './whole_d';
import { WHOLE_E } from './whole_e';
import { WHOLE_IV } from './whole_iv';
import { WHOLE_IV_PEACE } from './whole_peace';
export const WHOLE_TALKS: WholeTalk[] = [...WHOLE_A, ...WHOLE_B, ...WHOLE_C, ...WHOLE_D, ...WHOLE_E];
export const WHOLE_INTERVIEWS: WholeInterview[] = [...WHOLE_IV, ...WHOLE_IV_PEACE];
