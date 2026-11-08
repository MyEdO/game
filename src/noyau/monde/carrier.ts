/**
 * Résolveur de PORTEUR unique (#614 doctrine « un héros, un mercenaire, une mule : le MÊME portage » ;
 * #620 SOCLE POSSESSIONS T1-e) — un porteur d'objets est soit un HÉROS (`state.party`, par `id`), soit
 * une POSSESSION (`state.possessions`, par `uid`). Les actions d'inventaire (équiper/ranger/transférer/
 * teinte) résolvent le porteur ICI plutôt que de dupliquer la recherche party/possessions à chaque site.
 */
import type { Combatant } from '../../engine/types';
import type { Possession } from '../../engine/possession';
import type { PorteurLocalise } from '../../engine/cargo';
import type { Jeu } from '../etat';
import { t } from '../../i18n';

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

/** L'id du porteur de l'objet `uid` : le combattant (bataille, puis groupe) ou la possession qui l'a dans ses `items`,
 *  `undefined` si personne ne le porte. Un uid n'a qu'un porteur (#2907). */
export function porteurDeLObjet(s: Pick<Jeu, 'battle' | 'party' | 'possessions'>, uid: string): string | undefined {
  const porte = (items: readonly { uid: string }[] | undefined) => (items ?? []).some((i) => i.uid === uid);
  return [...(s.battle?.combatants ?? []), ...s.party].find((c) => porte(c.items))?.id ?? s.possessions.find((p) => porte(p.items))?.uid;
}

type EtatDesPorteurs = Pick<Jeu, 'battle' | 'party' | 'possessions'>;

/** Refus d'un geste sur l'objet `uid` que personne ne porte ; `null` sinon. */
export function refusSansPorteur(s: EtatDesPorteurs, uid: string): string | null {
  return porteurDeLObjet(s, uid) ? null : t('pf.objetSansPorteur');
}

/** Refus d'un geste d'un héros sur l'objet `uid` (sa bourse, ses PX, son Test) : personne ne le porte, ou son porteur
 *  n'est pas un héros du groupe ; `null` sinon. */
export function refusDuHerosPorteur(s: EtatDesPorteurs, uid: string): string | null {
  const id = porteurDeLObjet(s, uid);
  return !id ? t('pf.objetSansPorteur') : s.party.some((h) => h.id === id) ? null : t('pf.objetHorsDesHeros');
}

/** Ce qui SITUE un porteur (`carriersColocated`, `engine/cargo.ts`) : un héros suit toujours le groupe ;
 *  une possession porte sa localisation. */
export function porteurLocalise(c: Carrier): PorteurLocalise {
  return c.kind === 'hero'
    ? { id: c.hero.id, location: { kind: 'avec-le-groupe' } }
    : { id: c.possession.uid, location: c.possession.location };
}
