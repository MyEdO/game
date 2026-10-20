/**
 * Résolveur de PORTEUR unique (#614 doctrine « un héros, un mercenaire, une mule : le MÊME portage » ;
 * #620 SOCLE POSSESSIONS T1-e) — un porteur d'objets est soit un HÉROS (`state.party`, par `id`), soit
 * une POSSESSION (`state.possessions`, par `uid`). Les actions d'inventaire (équiper/ranger/transférer/
 * skin) résolvent le porteur ICI plutôt que de dupliquer la recherche party/possessions à chaque site.
 */
import type { Combatant } from '../../engine/types';
import type { Possession, PossessionLocation } from '../../engine/possession';

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

/** Localisation d'un porteur — un héros suit toujours le groupe ; une possession porte la sienne. */
export function carrierLocation(c: Carrier): PossessionLocation {
  return c.kind === 'hero' ? { kind: 'avec-le-groupe' } : c.possession.location;
}

/** Deux porteurs sont-ils CO-LOCALISÉS (#723) — invariant de `transferItem` (source de vérité, l'UI
 *  n'en est que le reflet). */
export function carriersCoLocated(a: Carrier, b: Carrier): boolean {
  const la = carrierLocation(a);
  const lb = carrierLocation(b);
  if (la.kind !== lb.kind) return false;
  if (la.kind === 'au-lieu' && lb.kind === 'au-lieu') return la.placeId === lb.placeId;
  if (la.kind === 'embarquee' && lb.kind === 'embarquee') return la.hostUid === lb.hostUid;
  return true;
}
