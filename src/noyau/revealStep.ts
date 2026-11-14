/**
 * CONVERSION « révélation → étape d'AFFICHAGE de cascade » (#942 L8) — module FEUILLE : le seul
 * endroit qui sait fabriquer un `CascadeStep` à partir d'une `RevealEntry` (icône par kind, charge
 * riche portée telle quelle). À part de `combatEffects` pour
 * rester importable par les modules FEUILLE, hors du cycle store↔flux.
 */
import type { CascadeTableDone, RevealEntry } from './pendings';
import type { BuiltCascadeStep } from './stepBrand';
import { toRecapLines } from './recapLine';
import type { IconIdGenerated as IconId } from '../data/icones.generated';

/** Icône d'une étape de révélation, PAR kind — exhaustif (ajouter un kind force son icône). */
const REVEAL_ICON: Record<RevealEntry['kind'], IconId> = {
  incantationImparfaite: 'navigation/des', // tirage sur la Table des Imparfaites
  critique: 'journal/critique',
  round: 'journal/fin-de-round',
  mutation: 'navigation/mutation',
  effet: 'journal/information', // effet d'AUTEUR (scénario) : Blessure Critique / maladie infligée
  entreeEnScene: 'navigation/point-d-entree', // entrée de zone : mise en contexte narrative (N1 — « le Journal n'est pas lu »)
};

/** Une révélation → étape d'AFFICHAGE de la séquence : la charge riche `reveal` voyage TELLE QUELLE
 *  (le rendu est routé par `kind` — panneau du Critique, parchemin d'entrée
 *  de zone, rangée de tirage + lignes pour le reste). `actorId` = le CONCERNÉ (victime → propriétaire
 *  de la modale en coop, et portrait du sujet dans la fenêtre). `opts.table` = la DÉCLARATION du tirage
 *  DÉJÀ résolu qui a produit la révélation (#942 L4 : le d100 de sévérité d'un Critique) — la rangée
 *  `TableRollLine` montre alors le dé et la ligne atteinte, comme sur une étape à table tirée. Le TYPE
 *  le tient (`CascadeTableDone`, `result` requis) et non plus cette phrase : une déclaration OUVERTE
 *  passerait ici en `stepInteraction` `'table'` — un tirage à faire, hors des portes qui en ouvrent
 *  (`tableStep`) et sans enjeu (#1262 V2 L6).
 *
 *  `opts.label`/`opts.icon` : l'EN-TÊTE de l'étape quand la situation qui la pousse la nomme plus
 *  précisément que la révélation elle-même (une Imparfaite est titrée « Incantation Imparfaite » dans
 *  sa charge, « Imparfaite » sur la rangée de séquence ; son icône dit la sévérité). La charge `reveal`
 *  n'est pas touchée : ces deux champs sont l'affichage de l'étape, jamais une seconde vérité. */
export function revealToStep(
  entry: RevealEntry,
  index: number,
  opts?: { table?: CascadeTableDone; label?: string; icon?: IconId },
): BuiltCascadeStep {
  return {
    id: `cons-${entry.kind}-${index}`,
    kind: entry.kind,
    actorId: entry.subjectId,
    icon: opts?.icon ?? REVEAL_ICON[entry.kind],
    label: opts?.label ?? entry.title,
    outcome: toRecapLines(entry.lines),
    reveal: entry,
    table: opts?.table,
  // eslint-disable-next-line murs/marques -- #1262 : minteur `revealToStep` — forger l'étape de révélation est son corps de métier.
  } as BuiltCascadeStep;
}
