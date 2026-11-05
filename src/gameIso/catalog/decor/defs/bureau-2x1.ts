import type { PropViz } from '../../types';
import { prop as bureau } from './bureau';

/** Bureau long (2×1, `props.json` `bureau-2x1`) — même vignette que le bureau courant. */
export const prop: PropViz = { ...bureau, id: 'bureau-2x1' };
