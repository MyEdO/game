import { HAIRSTYLE_DEFS } from './_registry.generated';
import type { HairstyleDef } from './types';
import type { Sexe } from '../../../../data/schemas/grammaire/valeurs';
export type { HairstyleDef, HairArt } from './types';
export { HAIRSTYLE_DEFS };

/** Coiffures d'un sexe, dans l'ordre du pool (`order`) — porte front/profile/back par coiffure. */
export function hairstylesForSex(sex: Sexe): HairstyleDef[] {
  return HAIRSTYLE_DEFS.filter((h) => h.sex === sex).sort((a, b) => a.order - b.order);
}
