/**
 * Registre UNIQUE des appendices (cornes/queue), DÉRIVÉ des `defs/` (1 appendice = 1 fichier).
 * Source unique de l'art de corne/queue : aucune chaîne SVG hors des defs. Résolu partout par la
 * primitive `viewOrFront` (référence-par-id → art par vue, comme têtes/tenues).
 */
import { viewOrFront, type PartArt } from '../types';
import { VIEWS } from '../../facing';
import { tableTotale } from '../../../../lib/tableTotale';
import type { BoneId } from '../../bones';
import type { RaceFeature } from '../../races/types';
import { APPENDAGE_DEFS, type AppendageId } from './_registry.generated';

export type { AppendageId };
export type { AppendageDef } from './types';

/** id → art orienté, chaque vue par le repli de `PartArt` (`viewOrFront`) : le dos d'un appendice sans
 *  dos est sa face, cornes symétriques. */
export const APPENDAGES: Record<string, PartArt> = Object.fromEntries(
  APPENDAGE_DEFS.map((a) => [a.id, tableTotale(VIEWS, (view) => viewOrFront(a, view))]),
);

/** Art orienté d'un appendice par id (repli générique cornes si id inconnu). */
export function appendageArt(id: string): PartArt {
  return APPENDAGES[id] ?? APPENDAGES['cornes-generique'];
}

/** Feature de créature portant un appendice ORIENTÉ du registre (cornes/queue). Remplace
 *  `features: [{ bone, svg: OV_CORNES_X }]` (art brut 1-vue) par une réf de type résolue par vue. */
export const appendageFeature = (appendage: AppendageId, bone: BoneId = 'tete', layer = -2): RaceFeature =>
  ({ bone, appendage, svg: '', layer });
