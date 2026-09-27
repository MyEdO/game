/**
 * Registre des SETS D'ÉQUIPEMENT quadrupèdes : un set = un fichier `defs/<id>.ts`, collecté par
 * `npm run gen` (même patron que `heads/`, `tails/`, `manes/`). L'art de chaque set est CUIT par
 * `scripts/rig/compile-dessin-quad.mts` depuis son dessin d'atelier `harnais/<id>@<espèce>-<vue>`.
 */
import { QUAD_HARNAIS_DEFS } from './_registry.generated';
import type { QuadHarnaisDef } from './types';
import type { QuadProps } from '../quadSkeleton';
import { MISSING_ART, nearestView } from '../../viewArt';
import renduMonteJson from '../../../../data/renduMonte.json';

export type { QuadHarnaisDef } from './types';
export type { QuadHarnaisId } from './_registry.generated';

/** Table DÉRIVÉE des fichiers `defs/` (id de set → def). */
export const QUAD_HARNAIS: Record<string, QuadHarnaisDef> = Object.fromEntries(QUAD_HARNAIS_DEFS.map((d) => [d.id, d]));

/** Set servi à une monture PORTÉE dont le record ne déclare pas de `appearance.harnais` — DÉCLARÉ en
 *  donnée éditable (`src/data/renduMonte.json`), jamais une constante de code (patron
 *  `DEFAULT_RACE_ID`/`speciesRace.json`). RAW : LDB 08 l.557, ADE I 07 l.48. */
export const DEFAUT_HARNAIS_MONTE: string = (renduMonteJson as { harnaisParDefaut: string }).harnaisParDefaut;

/** Options du sélecteur de set (affiche le libellé, stocke l'id) — pendant de `tenueOptions`. */
export function harnaisOptions(): { id: string; label: string }[] {
  return QUAD_HARNAIS_DEFS.map((d) => ({ id: d.id, label: d.label }));
}

/** REFUS VISIBLE (#223) d'un set non servi : la caisse d'alarme sur le `tronc`, l'os qu'aucune vue
 *  n'omet — jamais une bête silencieusement nue là où la donnée demandait un équipement. */
const MISSING_HARNAIS: NonNullable<QuadProps['deco']> = {
  tronc: [{ svg: nearestView(MISSING_ART, 'profile')(), plan: 0 }],
};

/**
 * Déco d'un SET pour l'espèce qui le porte. Deux refus BRUYANTS (patron `quadHeadDef`/#223), jamais
 * un vide silencieux : un `id` absent du registre, et un set dont l'art n'est PAS cuit pour cette
 * espèce (`especes` — un set posé sur une autre carrure glisse, cf. `QuadHarnaisDef`).
 */
export function quadHarnaisDeco(harnais: string, espece: string): NonNullable<QuadProps['deco']> {
  const d = QUAD_HARNAIS[harnais];
  // `?.` : le module est importé par les scripts tsx (galeries QC), où `import.meta.env` n'existe pas.
  if (!d) {
    if (import.meta.env?.DEV) console.warn(`[rig quadrupède] set d'équipement « ${harnais} » sans def enregistrée — silhouette de repli visible (#223), donnée à corriger.`);
    return MISSING_HARNAIS;
  }
  if (!d.especes.includes(espece)) {
    if (import.meta.env?.DEV) console.warn(`[rig quadrupède] set d'équipement « ${harnais} » non cuit pour l'espèce « ${espece} » (espèces déclarées : ${d.especes.join(', ')}) — silhouette de repli visible (#223), donnée à corriger.`);
    return MISSING_HARNAIS;
  }
  return d.deco;
}
