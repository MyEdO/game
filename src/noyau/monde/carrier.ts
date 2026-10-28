/**
 * Résolveur de PORTEUR unique (#614 doctrine « un héros, un mercenaire, une mule : le MÊME portage » ;
 * #620 SOCLE POSSESSIONS T1-e) — un porteur d'objets est soit un HÉROS (`state.party`, par `id`), soit
 * une POSSESSION (`state.possessions`, par `uid`). Les actions d'inventaire (équiper/ranger/transférer/
 * skin) résolvent le porteur ICI plutôt que de dupliquer la recherche party/possessions à chaque site.
 */
import type { Combatant } from '../../engine/types';
import type { Possession } from '../../engine/possession';
import type { PorteurLocalise } from '../../engine/cargo';

export type Carrier = { kind: 'hero'; hero: Combatant } | { kind: 'possession'; possession: Possession };

/** Porteur d'objets par id — héros de `party` (par `id`) sinon possession de `possessions` (par `uid`). */
export function resolveCarrier(
  state: { party: Combatant[]; possessions: Possession[] },
  carrierId: string,
): Carrier | undefined {
  const hero = state.party.find((h) => h.id === carrierId);
  if (hero) return { kind: 'hero', hero };
  const possession = state.possessions.find((p) => p.uid === carrierId);
  return possession ? { kind: 'possession', possession } : undefined;
}

/** Ce qui SITUE un porteur (`carriersColocated`, `engine/cargo.ts`) : un héros suit toujours le groupe ;
 *  une possession porte sa localisation. */
export function porteurLocalise(c: Carrier): PorteurLocalise {
  return c.kind === 'hero'
    ? { id: c.hero.id, location: { kind: 'avec-le-groupe' } }
    : { id: c.possession.uid, location: c.possession.location };
}
