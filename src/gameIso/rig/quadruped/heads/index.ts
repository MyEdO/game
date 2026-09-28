/**
 * Registre des TÊTES quadrupèdes : une tête = un fichier `defs/<clé>.ts`, collecté par
 * `npm run gen` (patron des parts monstrueuses du bipède). Le socle `quadParts.ts` compose par
 * LOOKUP — il ne connaît aucune clé d'espèce (#1082).
 */
import { QUAD_HEAD_DEFS } from './_registry.generated';
import type { QuadHeadDef } from './types';
import type { QuadBoneId } from '../quadSkeleton';
import { VIEWS, type View } from '../../facing';
import { tableTotale } from '../../../../lib/tableTotale';
import { MISSING_ART, nearestView } from '../../viewArt';

export type { QuadHeadDef } from './types';
export type { QuadHeadId } from './_registry.generated';

/** Table DÉRIVÉE des fichiers `defs/` (clé de tête → def). */
export const QUAD_HEADS: Record<string, QuadHeadDef> = Object.fromEntries(QUAD_HEAD_DEFS.map((d) => [d.key, d]));

/**
 * Def de la tête d'une espèce. Une clé SANS def enregistrée (def retirée du registre, donnée
 * fautive) rend la silhouette de REPLI VISIBLE (#223) sur les trois vues + un `console.warn` en
 * DEV : jamais un vide silencieux qui ferait « bête sans tête » au rendu.
 */
export function quadHeadDef(head: string): QuadHeadDef {
  const d = QUAD_HEADS[head];
  if (d) return d;
  // `?.` : le module est importé par les scripts tsx (galeries QC), où `import.meta.env` n'existe pas.
  if (import.meta.env?.DEV) console.warn(`[rig quadrupède] tête « ${head} » sans def enregistrée — silhouette de repli visible (#223), donnée à corriger.`);
  return MISSING_HEAD;
}

const missing = (view: View) => nearestView(MISSING_ART, view)();
const MISSING_HEAD: QuadHeadDef = {
  key: '',
  label: 'Tête manquante',
  art: tableTotale(VIEWS, missing),
};

/** Os PORTEUR de l'art de tête pour la vue (défaut `tete` ; clusters multi-cous : `encolure` en profil). */
export const quadHeadBone = (d: QuadHeadDef, view: View): QuadBoneId => d.bone?.[view] ?? 'tete';
