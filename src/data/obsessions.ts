/**
 * Tableau des OBSESSIONS — Compagnon T1 (EDOC), chapitre 8, folio 69 (« ### OBSESSIONS », 2d10).
 *
 * Table de CIBLES (`tableDeCiblesSchema`, `grammaire/mecanique.ts`) : la rangée tirée désigne un Groupe
 * (`groups.json`), la Cible du Trait octroyé. EDOC 12 l.170, l.217, l.241. Données dans `obsessions.json`
 * (source + folio) ; tirage 2d10 (`rollExpr`) + lookup partagé `findTableEntry`.
 */
import { RNG, rollExpr } from '../engine/dice';
import { findTableEntry } from '../engine/tables';
import type { TableDeCibles } from './schemas/grammaire/mecanique';
import type * as obsessions from './schemas/defs/obsessions';
import { rangeesDe } from './rangees';
import obsessionsJson from './obsessions.json';

/** Le Tableau des Obsessions (2d10 = 2..20) : plage de 2d10 → id du Groupe-Cible. */
export const OBSESSIONS = rangeesDe<typeof obsessions>(obsessionsJson);
/** Provenance (livre + folio) — traçabilité (EDOC 12 folio 69). */
export const OBSESSIONS_SOURCE = obsessionsJson.source;

/** Le tirage de chaque table de Cibles, RNG seedable : l'id du Groupe de la rangée tirée. */
export const TIRAGE_DE_CIBLE: Readonly<Record<TableDeCibles, (rng: RNG) => string>> = {
  obsessions: (rng) => findTableEntry(OBSESSIONS, rollExpr('2d10', rng)).id,
};

/** Les Groupes que chaque table de Cibles peut tirer : ses rangées, lues à l'appel. */
export const GROUPES_TIRABLES: Readonly<Record<TableDeCibles, () => readonly string[]>> = {
  obsessions: () => OBSESSIONS.map((e) => e.id),
};
