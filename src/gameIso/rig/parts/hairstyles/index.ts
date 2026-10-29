import { HAIRSTYLE_DEFS } from './_registry.generated';
import type { HairstyleDef } from './types';
import { sexeSchema, type Sexe } from '../../../../data/schemas/grammaire/valeurs';
import type { CoiffureId } from '../../../../data/schemas/defs/garde-robe';
import { baseSpeciesOf } from '../../skeletons';
export type { HairstyleDef, HairArt } from './types';
export { HAIRSTYLE_DEFS };

const parOrdre = (a: HairstyleDef, b: HairstyleDef) => a.order - b.order;

/** Coiffures PARTAGÉES (sans `tete`) d'un sexe, dans l'ordre du pool (`order`). */
export function hairstylesForSex(sex: Sexe): HairstyleDef[] {
  return HAIRSTYLE_DEFS.filter((h) => h.sex === sex && h.tete == null).sort(parOrdre);
}

/** Pool de coiffures d'une espèce×sexe : les coiffures de sa tête (`tete` = `baseSpeciesOf(species)`),
 *  puis les coiffures partagées, chacun par `order`. SOURCE UNIQUE du tirage (`cosmeticPart`, par idx) et
 *  de l'imposition par id (`hairIndexById`). */
export function coiffuresDuPool(species: string, sex: Sexe): HairstyleDef[] {
  const tete = baseSpeciesOf(species);
  return [...HAIRSTYLE_DEFS.filter((h) => h.sex === sex && h.tete === tete).sort(parOrdre), ...hairstylesForSex(sex)];
}

/** Coiffures PROPOSÉES à l'auteur, chacune une fois, dans l'ordre du pool : celles d'un sexe posé, sinon
 *  des deux ; les coiffures d'une tête seulement si l'espèce est connue. */
export function coiffuresProposees(species: string | undefined, sex: Sexe | undefined): CoiffureId[] {
  const sexes: readonly Sexe[] = sex ? [sex] : sexeSchema.options;
  const defs = sexes.flatMap((s) => (species ? coiffuresDuPool(species, s) : hairstylesForSex(s)));
  return [...new Set(defs.map((h) => h.coiffure))];
}
