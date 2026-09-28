/**
 * Registre des CAPES, dérivé des `defs/` (1 cape = 1 fichier). Source unique de l'art de cape, servi
 * en DORSAL (dorsalOverlays) pour l'emplacement Cape (equip.cape). Référencé par id.
 */
import type { ViewSet } from '../types';
import { CAPE_DEFS, type CapeId } from './_registry.generated';

export type { CapeId };
export type { CapeDef } from './types';

/** id → la cape, un `ViewSet` (à passer tel quel à dorsalOverlays). */
export const CAPES: Record<string, ViewSet> = Object.fromEntries(CAPE_DEFS.map((c) => [c.id, c]));
