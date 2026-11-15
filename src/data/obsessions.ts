/**
 * Tableau des OBSESSIONS — Compagnon T1 (EDOC), chapitre 8, folio 69 (« ### OBSESSIONS », 2d10).
 *
 * Table de CIBLES (`tableDeCiblesSchema`, `grammaire/mecanique.ts`) : la rangée tirée désigne un Groupe
 * (`groups.json`), la Cible du Trait octroyé. EDOC 12 l.170, l.217, l.241. Données dans `obsessions.json`
 * (source + folio, dé de tirage `die`) ; tirage `rollDice` + lookup partagé `findTableEntry`.
 */
import { rollDice, type RNG } from '../engine/dice';
import { findTableEntry, type DeDeTable } from '../engine/tables';
import type { TableDeCibles } from './schemas/grammaire/mecanique';
import type * as obsessions from './schemas/defs/obsessions';
import { deDeTirageDe, rangeesDe, type RangeeDe } from './rangees';
import obsessionsJson from './obsessions.json';

/** Le Tableau des Obsessions : plage du dé de tirage → id du Groupe-Cible. */
type Obsession = RangeeDe<typeof obsessions>;
export const OBSESSIONS: Obsession[] = rangeesDe<typeof obsessions>(obsessionsJson);
/** Le dé du Tableau des Obsessions, lu à l'appel. */
export const obsessionsDie = (): DeDeTable => deDeTirageDe<typeof obsessions>(obsessionsJson);

/** Le tirage de chaque table de Cibles, RNG seedable : l'id du Groupe de la rangée tirée. */
export const TIRAGE_DE_CIBLE: Readonly<Record<TableDeCibles, (rng: RNG) => string>> = {
  obsessions: (rng) => findTableEntry(OBSESSIONS, rollDice(obsessionsDie(), rng)).id,
};

/** Les Groupes que chaque table de Cibles peut tirer : ses rangées, lues à l'appel. */
export const GROUPES_TIRABLES: Readonly<Record<TableDeCibles, () => readonly string[]>> = {
  obsessions: () => OBSESSIONS.map((e) => e.id),
};
