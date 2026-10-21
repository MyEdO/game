/**
 * Tableau des OBSESSIONS — Compagnon T1 (EDOC), chapitre 8, folio 69 (« ### OBSESSIONS », 2d10).
 *
 * Sert de DÉTERMINATION de Cible aux mutations mentales qui l'exigent (EDOC 12) : « Haine sporadique »
 * (→ Trait Haine (Cible)) et « Terribles phobies » (→ Trait Effrayé (Cible)) renvoient toutes deux au
 * « Tableau des Obsessions » pour fixer leur Cible. Données dans `obsessions.json` (taguées source +
 * folio) ; tirage 2d10 (`rollExpr`) + lookup partagé `findTableEntry`.
 */
import { RNG, rollExpr } from '../engine/dice';
import { findTableEntry } from '../engine/tables';
import obsessionsJson from './obsessions.json';

/** Une entrée du Tableau des Obsessions : plage de 2d10 → libellé de la Cible (objet/groupe). */
export interface ObsessionEntry {
  id: string;
  min: number;
  max: number;
  label: string;
}

interface ObsessionTableFile {
  source: { book: string; page: number; note?: string };
  entries: ObsessionEntry[];
}

const FILE = obsessionsJson as ObsessionTableFile;

/** Le Tableau des Obsessions (19 entrées, 2d10 = 2..20). */
export const OBSESSIONS: readonly ObsessionEntry[] = FILE.entries;
/** Provenance (livre + folio) — traçabilité (EDOC 12 folio 69). */
export const OBSESSIONS_SOURCE = FILE.source;

/** Tire une Cible sur le Tableau des Obsessions (2d10), RNG seedable. Renvoie le libellé. */
export function rollObsession(rng: RNG): string {
  return findTableEntry(OBSESSIONS as ObsessionEntry[], rollExpr('2d10', rng)).label;
}
