/**
 * Tableau des Événements « Entre deux aventures » (LDB `22 - Evenements.md`) — manuscrit
 * VERBATIM (résumés fidèles). La DONNÉE vit dans `interludeEvents.json` (éditable, comme
 * `creatures.json`), dé de tirage `die` compris ; ce module = types + chargement. `fx` ne porte QUE
 * les effets mécaniques sans ambiguïté du texte ; tout le reste est narratif (journalisé, rien
 * d'inventé). Ajouter/régler un événement = éditer le JSON, jamais ce fichier.
 *
 * Classes canon visées par certains événements : Citadins, Courtisans, Guerriers, Itinérants,
 * Lettrés, Riverains, Roublards, Ruraux. (Le texte dit « Voleurs » pour les Roublards.)
 */
import { facesDuDe, findTableEntry, type DeDeTable } from '../engine/tables';
import { interludeEvents } from './index';
import interludeEventsJson from './interludeEvents.json';
import { deDeTirageDe } from './rangees';
import type * as tableauDesEvenements from './schemas/defs/interludeEvents';

export interface InterludeEventFx {
  /** % appliqué à la bourse AVANT les Activités (le Prévôt −30, Kleptomane −50). */
  moneyPct?: number;
  /** Événement de GROUPE : ses effets valent pour tous les participants, une fois (`effetsDeLaPeriode`).
   *  Absent : pour le seul héros qui l'a tiré. LDB 22 l.5 */
  partyWide?: boolean;
  /** % appliqué aux gains de l'Activité Revenus (Fausse monnaie −20, Profits +50…). */
  revenuePct?: number;
  /** Le `revenuePct` ne vise que ces Classes (absent = tout le monde). */
  revenueClasses?: string[];
  /** L'Activité Revenus est interdite à ces Classes (`['*']` = à tous — Complications monstrueuses). */
  revenueBlockedClasses?: string[];
  /** % appliqué aux dépôts bancaires existants (Fausse monnaie −20). */
  bankPct?: number;
  /** +N au maximum de Points de Chance pour la prochaine aventure (Un homme averti). */
  fortuneMaxDelta?: number;
  /** Le héros perd une Activité (Festivités, Vieilles dettes, Suspect). */
  loseActivity?: boolean;
  /** Les PLANQUES du héros sont dévalisées avant toute Opération bancaire (Mise à sac). */
  stashRaided?: boolean;
  /** Les dépôts INVESTIS vérifient immédiatement la faillite (Émeutes). */
  bankCrashCheck?: boolean;
}

export interface InterludeEvent {
  id: string;
  min: number;
  max: number;
  label: string;
  /** Résumé fidèle du texte (verbatim abrégé) — affiché au joueur et journalisé. */
  desc: string;
  fx?: InterludeEventFx;
  /** Note d'atelier — JAMAIS affichée au joueur ni journalisée : précise ce que `fx` ne modélise
   *  pas pour cet événement, à l'usage des auteurs de données. */
  atelierNote?: string;
}

export const INTERLUDE_EVENTS = interludeEvents;

/** Le dé du Tableau des Événements, lu à l'appel. */
export const interludeEventDie = (): DeDeTable => deDeTirageDe<typeof tableauDesEvenements>(interludeEventsJson);

/** Entrée du tableau pour un jet de son dé, borné à ses faces. */
export function interludeEventFor(roll: number): InterludeEvent {
  const r = Math.max(1, Math.min(facesDuDe(interludeEventDie()), roll));
  return findTableEntry(INTERLUDE_EVENTS, r);
}
