import { PHRASES as BASE } from './phrases';
import { PHRASES_IV } from './phrases_iv';
import { PHRASES_G } from './phrases_g';
import { PHRASES_EV } from './phrases_ev';
import { PHRASES_REL } from './phrases_rel';
import { PHRASES_NEW } from './phrases_new';
import type { PhraseTable } from '../../core/types';
export const PHRASES: PhraseTable = { ...BASE, ...PHRASES_IV, ...PHRASES_G, ...PHRASES_EV, ...PHRASES_REL, ...PHRASES_NEW };
export { TALKS } from './talks';
