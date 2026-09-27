/**
 * Résolveur de l'Incident de Tir d'Artillerie par Salve (Aux Armes, « Salve », AA 10 l.270-277) —
 * CODE GÉNÉRIQUE lisant la DONNÉE verbatim (`artillery-misfire.json` via `data/artilleryMisfire`).
 * Module FRÈRE de `structureCritical.ts` (même patron : `findTableEntry` pour le lookup, issue
 * STRUCTURÉE et PURE — ne mute rien, l'appelant applique). AA 10 l.264 : « Si l'arme subit un
 * Incident de tir à n'importe quel moment du processus, déterminez-en les effets puis faites un jet
 * dans le tableau suivant » — cette table se tire EN PLUS de l'Incident de tir générique (LDB), et
 * UNIQUEMENT pour une arme à Atout *Salve* (branchement : `state/combatFlow.ts::applyOups`).
 */
import { findTableEntry } from './tables';
import type { DiceSpec } from './dice';
import { ARTILLERY_MISFIRE, type ArtilleryMisfireEntry } from '../data/artilleryMisfire';

/** id de la table au registre des étapes à TABLE (`state/cascade.registerTableStep`) — ÉCRITURE
 *  UNIQUE, lue par l'enregistrement comme par la demande de dé de la grappe d'Oups ! (`desDOups`). */
export const TABLE_SALVE_MISFIRE = 'artillery-salve-misfire';

/** Le d10 de la table (AA 10 l.270-277) — une seule écriture, lue par la demande de dé et par la
 *  déclaration de l'étape. */
export const D10_SALVE_MISFIRE: DiceSpec = { n: 1, sides: 10 };

export interface ArtillerySalveMisfireResolved {
  entry: ArtilleryMisfireEntry;
  /** id STABLE de l'entrée (slug) — pour toute logique/réf ; `label` reste l'affichage. */
  id: string;
  label: string;
  /** Jet d10 effectif. */
  roll: number;
  /** Nombre de fois où l'effet de Dégâts à l'équipe se répète (0 pour le tir perdu, ligne 10). */
  hits: number;
  /** La pièce d'artillerie est-elle détruite (lignes 1-9) ? */
  destroyed: boolean;
  note: string;
}

/** LIT un Incident de Tir d'Artillerie par Salve (AA 10 l.270-277) sur le d10 DÉJÀ TOMBÉ — le dé vient
 *  de la porte (étape à TABLE, `TABLE_SALVE_MISFIRE`), jamais d'un rng local. `salveRemaining` = Indice
 *  de Salve restant au moment de l'Incident (lignes 8-9 et 10, « Pour chaque Indice de Salve
 *  restant »). PURE. */
export function lireSalveMisfire(roll: number, salveRemaining: number): ArtillerySalveMisfireResolved {
  const entry = findTableEntry(ARTILLERY_MISFIRE, roll);
  const hits = entry.strayFire ? 0 : entry.perSalveIndex ? Math.max(0, salveRemaining) : 1;
  return { entry, id: entry.id, label: entry.label, roll, hits, destroyed: entry.destroyed, note: entry.note };
}
