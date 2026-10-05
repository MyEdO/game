/**
 * CONVERSION « révélation → étape d'AFFICHAGE de cascade » (#942 L8) — module FEUILLE : le seul
 * endroit qui sait fabriquer un `CascadeStep` à partir d'une `RevealEntry` (icône par kind, cadence
 * d'auto-fermeture par gravité, charge riche portée telle quelle). À part de `combatEffects` pour
 * rester importable par les modules FEUILLE, hors du cycle store↔flux.
 */
import type { CascadeTableDone, RevealEntry } from './pendings';
import type { BuiltCascadeStep } from './stepBrand';
import { toRecapLines } from './recapLine';
import type { IconId } from '../ui/icons';

/** Icône d'une étape de révélation, PAR kind — exhaustif (ajouter un kind force son icône). */
const REVEAL_ICON: Record<RevealEntry['kind'], IconId> = {
  miscast: 'nav/dice', // tirage sur la Table des Imparfaites
  critical: 'journal/critical',
  round: 'journal/round',
  mutation: 'nav/mutation',
  effet: 'journal/info', // effet d'AUTEUR (scénario) : Blessure Critique / maladie infligée
  sceneEntry: 'nav/entry-point', // entrée de zone : mise en contexte narrative (N1 — « le Journal n'est pas lu »)
};

/** Cadences d'auto-fermeture DÉCLARABLES (`opts.autoClose`), par gravité — court pour l'informatif,
 *  long pour le grave. Aucune n'est armée d'office : cf. `revealToStep`. */
export const REVEAL_AUTO_CLOSE_MS: Record<NonNullable<RevealEntry['severity']>, number> = { minor: 3500, grave: 9000 };

/** Une révélation → étape d'AFFICHAGE de la séquence : la charge riche `reveal` voyage TELLE QUELLE
 *  (le rendu est routé par `kind` dans `ui/RevealBody.tsx` — panneau du Critique, parchemin d'entrée
 *  de zone, rangée de tirage + lignes pour le reste). `actorId` = le CONCERNÉ (victime → propriétaire
 *  de la modale en coop, et portrait du sujet dans la fenêtre). `opts.table` = la DÉCLARATION du tirage
 *  DÉJÀ résolu qui a produit la révélation (#942 L4 : le d100 de sévérité d'un Critique) — la rangée
 *  `TableRollLine` montre alors le dé et la ligne atteinte, comme sur une étape à table tirée. Le TYPE
 *  le tient (`CascadeTableDone`, `result` requis) et non plus cette phrase : une déclaration OUVERTE
 *  passerait ici en `stepInteraction` `'table'` — un tirage à faire, hors des portes qui en ouvrent
 *  (`tableStep`) et sans enjeu (#1262 V2 L6).
 *
 *  `opts.autoClose` : la fenêtre se ferme d'elle-même après la cadence de la gravité DÉCLARÉE. Absent
 *  — le cas par défaut — l'étape attend le clic (arbitrage #1270). La gravité de la `RevealEntry`
 *  n'arme rien : elle qualifie la révélation (rendu, bandeau), elle ne décide pas de sa durée.
 *
 *  `opts.label`/`opts.icon` : l'EN-TÊTE de l'étape quand la situation qui la pousse la nomme plus
 *  précisément que la révélation elle-même (une Imparfaite est titrée « Incantation Imparfaite » dans
 *  sa charge, « Imparfaite » sur la rangée de séquence ; son icône dit la sévérité). La charge `reveal`
 *  n'est pas touchée : ces deux champs sont l'affichage de l'étape, jamais une seconde vérité. */
export function revealToStep(
  entry: RevealEntry,
  index: number,
  opts?: { table?: CascadeTableDone; autoClose?: NonNullable<RevealEntry['severity']>; label?: string; icon?: IconId },
): BuiltCascadeStep {
  return {
    id: `cons-${entry.kind}-${index}`,
    kind: entry.kind,
    actorId: entry.subjectId,
    icon: opts?.icon ?? REVEAL_ICON[entry.kind],
    label: opts?.label ?? entry.title,
    outcome: toRecapLines(entry.lines),
    reveal: entry,
    ...(opts?.autoClose ? { autoCloseMs: REVEAL_AUTO_CLOSE_MS[opts.autoClose] } : {}),
    table: opts?.table,
  // eslint-disable-next-line murs/marques -- #1262 : minteur `revealToStep` — forger l'étape de révélation est son corps de métier.
  } as BuiltCascadeStep;
}
