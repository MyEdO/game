import { HEAD_DEFS } from './_registry.generated';
import type { HeadDef } from './types';
import type { Sexe } from '../../../../data/schemas/grammaire/valeurs';
import { baseSpeciesOf } from '../../skeletons';
export type { HeadDef } from './types';
export { HEAD_DEFS };

/** Tête dessinée d'une espèce×sexe : la def dont `tete` vaut `baseSpeciesOf(species)`, `undefined` pour
 *  une espèce sans tête (visage de repli de `cosmetic.ts`). */
export function teteDEspece(species: string, sex: Sexe): HeadDef | undefined {
  const tete = baseSpeciesOf(species);
  return HEAD_DEFS.find((d) => d.tete === tete && d.sex === sex);
}
