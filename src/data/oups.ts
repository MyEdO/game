/**
 * Tableau des Oups ! — Livre de base, « Maladresses » (14-_GoBack.md l.14-46), transcrit verbatim.
 * `00` encodé `max: 100`. `kind` = effet mécanique discriminé (appliqué par le store).
 *
 * La DONNÉE vit dans `oups.json` (éditable, comme `creatures.json`), dé de tirage `die` compris ; ce
 * module = chargement. Ajouter/régler une entrée = éditer le JSON, jamais ce fichier.
 */
import { oups } from './index';
import oupsJson from './oups.json';
import { deDeTirageDe, type RangeeDe } from './rangees';
import type { DeDeTable } from '../engine/tables';
import type * as tableauDesOups from './schemas/defs/oups';
import { memoParVersion } from './versionDataset';

/** Une ligne du Tableau des Oups !, au type de son schéma. */
type LigneDesOups = RangeeDe<typeof tableauDesOups>;
/** Une bande du Tableau des Oups !, hors Incident de Tir. */
type BandeDesOups = Exclude<LigneDesOups, { kind: 'misfire' }>;
/** L'effet mécanique d'une bande. */
export type OupsKind = BandeDesOups['kind'];

/** Bandes du Tableau des Oups ! (les 7 fourchettes) — lues par `findTableEntry`. */
export const oupsTable = memoParVersion('oups', () => oups.filter((e): e is BandeDesOups => e.kind !== 'misfire'));
/** Entrée « Incident de Tir » (label DISPLAY-ONLY) — source UNIQUE, lue par `rollOups`. */
export const oupsMisfire = memoParVersion('oups', () => oups.find((e) => e.kind === 'misfire')!);
/** Le dé du Tableau des Oups !, lu à l'appel. */
export const oupsDie = (): DeDeTable => deDeTirageDe<typeof tableauDesOups>(oupsJson);
