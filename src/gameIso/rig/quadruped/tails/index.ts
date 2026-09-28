/**
 * Registre des QUEUES quadrupèdes : une queue = un fichier `defs/<clé>.ts`, collecté par
 * `npm run gen` (même patron que `heads/`). Le socle `quadParts.ts` compose par LOOKUP.
 */
import { QUAD_TAIL_DEFS } from './_registry.generated';
import type { QuadTailDef } from './types';
import { MISSING_ART, nearestView } from '../../viewArt';

export type { QuadTailDef } from './types';
export type { QuadTailId } from './_registry.generated';

/** Table DÉRIVÉE des fichiers `defs/` (clé de queue → def). */
export const QUAD_TAILS: Record<string, QuadTailDef> = Object.fromEntries(QUAD_TAIL_DEFS.map((d) => [d.key, d]));

const MISSING_TAIL: QuadTailDef = {
  key: '',
  label: 'Queue manquante',
  art: { profile: nearestView(MISSING_ART, 'profile')(), back: nearestView(MISSING_ART, 'back')() },
};

/**
 * Def de la queue d'une espèce. Une clé SANS def enregistrée rend la silhouette de REPLI VISIBLE
 * (#223) + un `console.warn` en DEV — jamais un vide silencieux (qui se confondrait avec `sans`).
 */
export function quadTailDef(tail: string): QuadTailDef {
  const d = QUAD_TAILS[tail];
  if (d) return d;
  // `?.` : le module est importé par les scripts tsx (galeries QC), où `import.meta.env` n'existe pas.
  if (import.meta.env?.DEV) console.warn(`[rig quadrupède] queue « ${tail} » sans def enregistrée — silhouette de repli visible (#223), donnée à corriger.`);
  return MISSING_TAIL;
}
