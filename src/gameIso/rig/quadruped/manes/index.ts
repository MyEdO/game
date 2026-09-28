/**
 * Registre des CRINIÈRES quadrupèdes : une crinière = un fichier `defs/<clé>.ts`, collecté par
 * `npm run gen` (même patron que `heads/` et `tails/`). Le socle `quadParts.ts` compose par LOOKUP.
 */
import { QUAD_MANE_DEFS } from './_registry.generated';
import type { QuadManeDef } from './types';
import { MISSING_ART, nearestView } from '../../viewArt';

export type { QuadManeDef } from './types';
export type { QuadManeId } from './_registry.generated';

/** Table DÉRIVÉE des fichiers `defs/` (clé de crinière → def). */
export const QUAD_MANES: Record<string, QuadManeDef> = Object.fromEntries(QUAD_MANE_DEFS.map((d) => [d.key, d]));

const MISSING_MANE: QuadManeDef = {
  key: '',
  label: 'Crinière manquante',
  art: { neck: nearestView(MISSING_ART, 'profile')() },
};

/**
 * Def de la crinière d'une espèce. Une clé SANS def enregistrée rend la silhouette de REPLI VISIBLE
 * (#223) + un `console.warn` en DEV — jamais un vide silencieux, qui se confondrait avec `sans`
 * (dont la ligne de dos est un art DÉCLARÉ).
 */
export function quadManeDef(mane: string): QuadManeDef {
  const d = QUAD_MANES[mane];
  if (d) return d;
  // `?.` : le module est importé par les scripts tsx (galeries QC), où `import.meta.env` n'existe pas.
  if (import.meta.env?.DEV) console.warn(`[rig quadrupède] crinière « ${mane} » sans def enregistrée — silhouette de repli visible (#223), donnée à corriger.`);
  return MISSING_MANE;
}
