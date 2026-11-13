/**
 * Tableau des Événements « Entre deux aventures » (LDB `22 - Evenements.md`) — manuscrit
 * VERBATIM (résumés fidèles). La DONNÉE vit dans `interludeEvents.json` (éditable, comme
 * `creatures.json`), dé de tirage `die` compris ; ce module = types + tirage. `fx` ne porte QUE
 * les effets mécaniques sans ambiguïté du texte ; tout le reste est narratif (journalisé, rien
 * d'inventé). Ajouter/régler un événement = éditer le JSON, jamais ce fichier.
 *
 * Classes canon visées par certains événements : Citadins, Courtisans, Guerriers, Itinérants,
 * Lettrés, Riverains, Roublards, Ruraux. (Le texte dit « Voleurs » pour les Roublards.)
 */
import { facesDuDe, findTableEntry, type DeDeTable } from '../engine/tables';
import { interludeEvents } from './index';
import interludeEventsJson from './interludeEvents.json';
import { deDeTirageDe, type RangeeDe } from './rangees';
import type * as tableauDesEvenements from './schemas/defs/interludeEvents';

/** Une rangée du Tableau des Événements (`interludeEvents.json`) ; `atelierNote` n'est jamais affichée ni journalisée. */
export type InterludeEvent = RangeeDe<typeof tableauDesEvenements>;
/** Les effets d'un événement d'interlude (`partyWide` : LDB 22 l.5). */
export type InterludeEventFx = NonNullable<InterludeEvent['fx']>;

export const INTERLUDE_EVENTS = interludeEvents;

/** Le dé du Tableau des Événements, lu à l'appel. */
export const interludeEventDie = (): DeDeTable => deDeTirageDe<typeof tableauDesEvenements>(interludeEventsJson);

/** Entrée du tableau pour un jet de son dé, borné à ses faces. */
export function interludeEventFor(roll: number): InterludeEvent {
  const r = Math.max(1, Math.min(facesDuDe(interludeEventDie()), roll));
  return findTableEntry(INTERLUDE_EVENTS, r);
}
