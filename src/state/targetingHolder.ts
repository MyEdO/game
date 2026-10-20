/**
 * QUI DÉTIENT le ciblage carte MAINTENANT (#1016) — SOURCE UNIQUE, consultée par les DEUX bouts du
 * clic : l'aiguilleur `targetingModes.currentTargetingMode` (quel mode rendre/commiter) et la
 * possession réseau `netOwnership.intentAllowedFor` (quel siège a le droit de cliquer).
 *
 * Module VOLONTAIREMENT LÉGER (le type de l'état, et `slotsDeJet` qui n'importe aucun runtime) : `netOwnership`
 * est importé par `combatFlow`, et `targetingModes` se déclare module FEUILLE du moteur de combat —
 * router le clic en important l'aiguilleur depuis `netOwnership` créerait le cycle
 * `netOwnership → targetingModes → combatFlow → netOwnership`. La dépendance va donc du LOURD vers
 * le LÉGER : l'aiguilleur consomme ce verdict, jamais l'inverse. Les deux bouts lisent le même
 * `detenteurDuCiblage` : la possession (`targetingHolder`) et la tête de l'aiguilleur en sont deux
 * projections, et un genre de détenteur non projeté casse la compilation.
 */
import type { GameState } from './store';
import type { HorsModalCoveredKey } from './modalArbiter';
import { sansCorps } from '../noyau/slotsDeJet';

type PendingCastEnCours = NonNullable<GameState['pendingCast']>;

/** La zone EN POSE — le gabarit qui suit le curseur, et la fenêtre qui l'a ouverte. Choix de source
 *  seul : libellé, ancre et portée se projettent dans `combatFlow.placingZoneOf`. */
export type ZoneEnPose =
  | { source: 'cast'; cast: PendingCastEnCours; zone: NonNullable<PendingCastEnCours['zone']> }
  | { source: 'siege'; aim: NonNullable<GameState['pendingSiegeAim']> };

export function zoneEnPose(s: Pick<GameState, 'pendingCast' | 'pendingSiegeAim'>): ZoneEnPose | null {
  const pc = s.pendingCast;
  if (pc?.zone?.placing && !pc.zone.center) return { source: 'cast', cast: pc, zone: pc.zone };
  if (s.pendingSiegeAim) return { source: 'siege', aim: s.pendingSiegeAim };
  return null;
}

/** Ce qui DÉTIENT le ciblage carte, dans l'ORDRE de priorité de l'aiguilleur. `null` = ciblage libre
 *  (attaque/sort/soin…, que l'aiguilleur départage par `battle.action`). */
export type DetenteurDuCiblage =
  | { genre: 'pendingCleave' }
  | { genre: 'pendingDualStrike' }
  | { genre: 'surincantation' }
  | { genre: 'zone'; zone: ZoneEnPose };

type EtatDuCiblage = Pick<GameState, 'pendingCleave' | 'pendingDualStrike' | 'pendingAttack' | 'pendingCast' | 'pendingSiegeAim' | 'pendingCascade'>;

export function detenteurDuCiblage(s: EtatDuCiblage): DetenteurDuCiblage | null {
  if (s.pendingCleave && !s.pendingAttack && coupFerme(s)) return { genre: 'pendingCleave' };
  if (s.pendingDualStrike && !s.pendingAttack && coupFerme(s)) return { genre: 'pendingDualStrike' };
  if (s.pendingCast?.pickingTargets) return { genre: 'surincantation' };
  const zone = zoneEnPose(s);
  return zone ? { genre: 'zone', zone } : null;
}

/** Projection TOTALE de `detenteurDuCiblage` sur la possession : le pending HORS-modale
 *  (`modalArbiter.HORS_MODAL`) qui porte chaque genre, et chaque source de zone. `undefined` = la
 *  possession reste celle de la fenêtre du registre des MODALES (`pendingCast` : Surincantation, pose
 *  de zone d'un sort). Un genre ou une source sans entrée, ou une entrée sans genre, casse la compilation. */
const PORTEUR_PAR_GENRE = {
  pendingCleave: 'pendingCleave',
  pendingDualStrike: 'pendingDualStrike',
  surincantation: undefined,
} as const satisfies Record<Exclude<DetenteurDuCiblage['genre'], 'zone'>, HorsModalCoveredKey | undefined>;
const PORTEUR_PAR_ZONE = {
  cast: undefined,
  siege: 'pendingSiegeAim',
} as const satisfies Record<ZoneEnPose['source'], HorsModalCoveredKey | undefined>;

type Porteur = (typeof PORTEUR_PAR_GENRE)[keyof typeof PORTEUR_PAR_GENRE] | (typeof PORTEUR_PAR_ZONE)[keyof typeof PORTEUR_PAR_ZONE];
export type TargetingHolder = NonNullable<Porteur>;

/** Les `pending*` HORS-modale qui peuvent tenir le ciblage carte : l'IMAGE des deux projections
 *  ci-dessus, chaque membre produit par un genre ou une source de zone. Un détenteur neuf s'ajoute
 *  dans une projection, jamais ici. */
export const TARGETING_HOLDERS: readonly TargetingHolder[] = [
  ...Object.values(PORTEUR_PAR_GENRE),
  ...Object.values(PORTEUR_PAR_ZONE),
].filter((h): h is TargetingHolder => h !== undefined);

/** Le pending HORS-modale qui tient le ciblage, lu dans `PORTEUR_PAR_GENRE` / `PORTEUR_PAR_ZONE`.
 *  `undefined` = ciblage libre, ou possession laissée à la fenêtre de `pendingCast`. */
export function targetingHolder(s: EtatDuCiblage): TargetingHolder | undefined {
  const d = detenteurDuCiblage(s);
  if (!d) return undefined;
  return d.genre === 'zone' ? PORTEUR_PAR_ZONE[d.zone.source] : PORTEUR_PAR_GENRE[d.genre];
}

/** Le coup en cours est-il FERMÉ ? L'étape au curseur a rendu son corps (validée, ou slot vidé par sa
 *  confirmation : `sansCorps`) et aucune étape après elle n'attend sa validation : une fenêtre qui
 *  suspend le coup (défense surfacée, Déviation, sauvegarde) le garde ouvert jusqu'à ce qu'elle soit
 *  jouée. LDB 14 l.9, LDB 85 l.362. */
export function coupFerme(s: Partial<GameState>): boolean {
  const seq = s.pendingCascade;
  if (!seq || seq.purpose !== 'combat') return true;
  const cur = seq.participants[seq.cursor];
  return (!cur || !!cur.committed || sansCorps(s, cur)) && seq.participants.slice(seq.cursor + 1).every((p) => p.committed);
}

/** Les `pending*` dont la désignation de cible vit SUR LA CARTE — les détenteurs hors-modale
 *  ci-dessus, plus `pendingCast` dont la POSSESSION reste à sa fenêtre (cf. `targetingHolder`) mais
 *  dont le geste de ciblage, lui, est un geste de carte. ÉNUMÉRATION RUNTIME : un pending de
 *  ciblage NOUVEAU s'ajoute ICI, jamais dans une liste littérale de consommateur. */
export const MAP_TARGETING_PENDINGS = [...TARGETING_HOLDERS, 'pendingCast'] as const;
export type MapTargetingPending = (typeof MAP_TARGETING_PENDINGS)[number];

/** Un ciblage CARTE est-il en cours ? Verdict UNIQUE des consommateurs de la scène : tant qu'il est
 *  vrai on DÉSIGNE une cible — ni piste de déplacement, ni curseur libre par-dessus. */
export function mapTargetingActive(s: Pick<GameState, MapTargetingPending>): boolean {
  return MAP_TARGETING_PENDINGS.some((k) => !!s[k]);
}
