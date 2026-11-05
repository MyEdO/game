import type { PropViz } from '../../types';
import { prop as table } from './table';

/** Table longue (2×1, `props.json` `table-2x1`) — même vignette que la table courte. */
export const prop: PropViz = { ...table, id: 'table-2x1' };
