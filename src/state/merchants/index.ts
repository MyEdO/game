import type { MerchantArchetypeDef } from './types';
import { findTrappingById, MERCHANT_ARCHETYPES } from '../../data';

export type { MerchantArchetypeDef } from './types';
export { MERCHANT_ARCHETYPES };

/** Lookup par clé `id` (table dérivée du registre — pas à maintenir à la main). */
export const MERCHANTS: Record<string, MerchantArchetypeDef> = Object.fromEntries(
  MERCHANT_ARCHETYPES.map((m) => [m.id, m]),
);

/** Garde CHOKE-POINT (échec fail-fast au chargement du module, pas un grep) : un `curated` qui
 *  pointe un tarif de SERVICE (LDB 66 l.12-14) le forcerait en stock (`curated` ignore la Disponibilité
 *  ET n'entre pas dans le filtre `!t.service` de `computeFreshStockLines`) — contradiction de donnée. */
for (const arch of MERCHANT_ARCHETYPES) {
  for (const id of arch.curated ?? []) {
    const t = findTrappingById(id);
    if (t?.service) {
      throw new Error(`Marchand "${arch.id}" : curated "${id}" est un tarif de service (LDB 66 l.12-14), pas un objet — retire-le de curated.`);
    }
  }
}
