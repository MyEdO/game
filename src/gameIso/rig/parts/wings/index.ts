/**
 * Registre des AILES, dérivé des `defs/` (1 paire = 1 fichier). Source unique de l'art d'ailes, servi
 * en DORSAL (dorsalOverlays) par le trait Vol, l'élément 'ailes' et monster.ailes. Référencé par id.
 */
import type { ViewSet } from '../types';
import { WING_DEFS, type WingId } from './_registry.generated';

export type { WingId };
export type { WingDef } from './types';

/** id → la paire d'ailes, un `ViewSet` (à passer tel quel à dorsalOverlays). */
export const WINGS: Record<string, ViewSet> = Object.fromEntries(WING_DEFS.map((w) => [w.id, w]));
