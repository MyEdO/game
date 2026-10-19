/**
 * QUI DÉTIENT le ciblage carte MAINTENANT (#1016) — SOURCE UNIQUE, consultée par les DEUX bouts du
 * clic : l'aiguilleur `targetingModes.currentTargetingMode` (quel mode rendre/commiter) et la
 * possession réseau `netOwnership.intentAllowedFor` (quel siège a le droit de cliquer).
 *
 * Module VOLONTAIREMENT LÉGER (le type de l'état, et `slotsDeJet` qui n'importe aucun runtime) : `netOwnership`
 * est importé par `combatFlow`, et `targetingModes` se déclare module FEUILLE du moteur de combat —
 * router le clic en important l'aiguilleur depuis `netOwnership` créerait le cycle
 * `netOwnership → targetingModes → combatFlow → netOwnership`. La dépendance va donc du LOURD vers
 * le LÉGER : l'aiguilleur consomme ce verdict, jamais l'inverse. La confrontation
 * verdict ⇄ mode réellement rendu est GARDÉE (`targeting-holder-vs-mode.test.ts`).
 */
import type { GameState } from './store';
import { sansCorps } from './slotsDeJet';

/** Les `pending*` HORS-modale (`modalArbiter.HORS_MODAL`) qui peuvent tenir le ciblage carte —
 *  ÉNUMÉRATION RUNTIME (le type en dérive) : les gardes itèrent CETTE liste, jamais une copie. */
export const TARGETING_HOLDERS = ['pendingCleave', 'pendingDualStrike', 'pendingSiegeAim'] as const;
export type TargetingHolder = (typeof TARGETING_HOLDERS)[number];

/**
 * Le pending qui tient le ciblage, dans l'ORDRE de priorité de l'aiguilleur. `undefined` = ciblage
 * libre (attaque/sort/soin…) OU détenu par un pending du registre des MODALES (`pendingCast` :
 * Surincantation, pose de zone d'un sort) — la possession y reste celle de sa fenêtre, inchangée.
 */
export function targetingHolder(s: Pick<GameState, 'pendingCleave' | 'pendingDualStrike' | 'pendingAttack' | 'pendingCast' | 'pendingSiegeAim' | 'pendingCascade'>): TargetingHolder | undefined {
  if (s.pendingCleave && !s.pendingAttack && coupFerme(s)) return 'pendingCleave';
  if (s.pendingDualStrike && !s.pendingAttack && coupFerme(s)) return 'pendingDualStrike';
  if (s.pendingCast?.pickingTargets) return undefined;
  if (s.pendingCast?.zone?.placing && !s.pendingCast.zone.center) return undefined; // jumeau : combatFlow.placingZoneOf (source 'cast')
  if (s.pendingSiegeAim) return 'pendingSiegeAim';
  return undefined;
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
