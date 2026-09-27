/**
 * Résolveur de PORTEUR unique (#614 doctrine « un héros, un mercenaire, une mule : le MÊME portage » ;
 * #620 SOCLE POSSESSIONS T1-e) — un porteur d'objets est soit un HÉROS (`state.party`, par `id`), soit
 * une POSSESSION (`state.possessions`, par `uid`). Les actions d'inventaire (équiper/ranger/transférer/
 * skin) résolvent le porteur ICI plutôt que de dupliquer la recherche party/possessions à chaque site.
 */
import type { Combatant } from '../engine/types';
import type { Possession, PossessionLocation } from '../engine/possession';
import type { Carrier } from '../engine/carrier';

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

/** Patch d'état qui remplace le porteur `carrierId` par un CLONE muté par `fn` ; `fn` rend `false` → le
 *  porteur reste inchangé. Porteur introuvable → patch vide. */
export function patchCarrier(
  state: { party: Combatant[]; possessions: Possession[] },
  carrierId: string,
  fn: (clone: Carrier) => boolean,
): Partial<{ party: Combatant[]; possessions: Possession[] }> {
  const carrier = resolveCarrier(state, carrierId);
  if (!carrier) return {};
  if (carrier.kind === 'hero') {
    const hero: Combatant = structuredClone(carrier.hero);
    if (!fn({ kind: 'hero', hero })) return {};
    return { party: state.party.map((h) => (h.id === carrierId ? hero : h)) };
  }
  const possession: Possession = structuredClone(carrier.possession);
  if (!fn({ kind: 'possession', possession })) return {};
  return { possessions: state.possessions.map((p) => (p.uid === carrierId ? possession : p)) };
}
