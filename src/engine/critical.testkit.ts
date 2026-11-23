/** Ce qu'un test lit d'une ligne de table de Blessure critique. */
import type { GameOp } from './ops';

/** Les PB que retirent les ops `wounds` chiffrées d'une ligne, ignorant BE et PA (LDB 18). */
export const blessuresDeLaLigne = (ops: readonly GameOp[] = []): number =>
  ops.reduce((n, o) => n + (o.op === 'wounds' && typeof o.amount === 'number' && o.ignoreTB !== false && o.ignoreAP !== false ? o.amount : 0), 0);
