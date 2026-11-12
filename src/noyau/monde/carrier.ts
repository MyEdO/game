/**
 * Résolveur de PORTEUR unique (#614 doctrine « un héros, un mercenaire, une mule : le MÊME portage » ;
 * #620 SOCLE POSSESSIONS T1-e) — un porteur d'objets est soit un HÉROS (`state.party`, par `id`), soit
 * une POSSESSION (`state.possessions`, par `uid`). Les actions d'inventaire (équiper/ranger/transférer/
 * teinte) résolvent le porteur ICI plutôt que de dupliquer la recherche party/possessions à chaque site.
 */
import type { Combatant, ItemInstance } from '../../engine/types';
import type { Possession } from '../../engine/possession';
import type { PorteurLocalise } from '../../engine/cargo';
import type { Jeu } from '../etat';
import { t } from '../../i18n';
import { recomputeLoadout } from '../../engine/items';
import { BOURSE_TRAPPING_ID } from '../../engine/bourse';
import { fromBrass, toBrass } from '../../engine/money';
import { ecrireActeur } from './combatants';

export type Carrier = { kind: 'heros'; hero: Combatant } | { kind: 'possession'; possession: Possession };

/** Porteur d'objets par id — héros de `party` (par `id`) sinon possession de `possessions` (par `uid`). */
export function resolveCarrier(
  state: { party: Combatant[]; possessions: Possession[] },
  carrierId: string,
): Carrier | undefined {
  const hero = state.party.find((h) => h.id === carrierId);
  if (hero) return { kind: 'heros', hero };
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
  return c.kind === 'heros'
    ? { id: c.hero.id, location: { kind: 'avec-le-groupe' } }
    : { id: c.possession.uid, location: c.possession.location };
}

/** Le lot qui change de porteur avec l'objet `uid` de `items` : l'objet, puis le contenu de son contenant ; vide sans lui. */
export function lotDeLObjet(items: readonly ItemInstance[], uid: string): ItemInstance[] {
  const it = items.find((i) => i.uid === uid);
  return it ? [it, ...(it.container ? items.filter((i) => i.inside === uid) : [])] : [];
}

/** `items` sans le lot `lot`. */
export function sansLeLot(items: readonly ItemInstance[], lot: readonly ItemInstance[]): ItemInstance[] {
  const uids = new Set(lot.map((i) => i.uid));
  return items.filter((i) => !uids.has(i.uid));
}

/** `items` avec le lot `lot` (son objet en tête) : l'objet arrive non équipé et libre, son contenu garde son contenant.
 *  Chez un combattant (`combattant`), une Bourse rejoint la sienne s'il en a une : son argent s'y ajoute, son contenu y
 *  passe, car seule la première Bourse d'un porteur se lit (`bourseOf`, LDB 61 l.29). */
export function avecLeLot(items: readonly ItemInstance[], lot: readonly ItemInstance[], combattant: boolean): ItemInstance[] {
  const [objet, ...contenu] = lot;
  const bourse = combattant && objet.trappingId === BOURSE_TRAPPING_ID ? items.find((i) => i.trappingId === BOURSE_TRAPPING_ID) : undefined;
  if (!bourse) return [...items, { ...objet, equipped: false, inside: undefined }, ...contenu.map((i) => ({ ...i, equipped: false }))];
  const brass = toBrass(bourse.money ?? fromBrass(0)) + toBrass(objet.money ?? fromBrass(0));
  return [...items.map((i) => (i === bourse ? { ...i, money: fromBrass(brass) } : i)), ...contenu.map((i) => ({ ...i, equipped: false, inside: bourse.uid }))];
}

/** Le patch d'état qui réécrit les objets de chaque porteur de `ecritures` (son id, puis ce qu'il porte ensuite) : une
 *  possession dans `possessions` ; sinon un combattant par `ecrireActeur`, ses armes re-dérivées (`recomputeLoadout`). */
export function ecrireLesPorteurs(
  s: Pick<Jeu, 'party' | 'battle' | 'possessions'>,
  ecritures: Readonly<Record<string, (items: ItemInstance[]) => ItemInstance[]>>,
): Partial<Pick<Jeu, 'party' | 'battle' | 'possessions'>> {
  const estPossession = (id: string) => s.possessions.some((p) => p.uid === id);
  const acteurs = Object.keys(ecritures).filter((id) => !estPossession(id));
  const patch: Partial<Pick<Jeu, 'party' | 'battle' | 'possessions'>> = acteurs.length
    ? ecrireActeur(s, acteurs, (h) => {
      const c: Combatant = structuredClone(h);
      c.items = ecritures[h.id](c.items ?? []);
      recomputeLoadout(c);
      return c;
    })
    : {};
  if (!Object.keys(ecritures).some(estPossession)) return patch;
  return { ...patch, possessions: s.possessions.map((p) => (p.uid in ecritures ? { ...structuredClone(p), items: ecritures[p.uid](structuredClone(p.items)) } : p)) };
}
