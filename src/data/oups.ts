/**
 * Tableau des Oups ! — Livre de base, « Maladresses » (14-_GoBack.md l.14-46), transcrit verbatim.
 * `00` encodé `max: 100`. `kind` = effet mécanique discriminé (appliqué par le store).
 *
 * La DONNÉE vit dans `oups.json` (éditable, comme `creatures.json`), dé de tirage `die` compris ; ce
 * module = type + chargement. Ajouter/régler une entrée = éditer le JSON, jamais ce fichier.
 */
import type { DiceSpec } from '../engine/dice';
import { oups } from './index';
import oupsJson from './oups.json';
import { deDeTirageDe } from './rangees';
import type * as tableauDesOups from './schemas/defs/oups';
import { memoParVersion } from './versionDataset';

export type OupsKind =
  | 'selfWound' | 'weaponDamageActLast' | 'actionPenalty'
  | 'loseMovement' | 'loseAction' | 'trauma' | 'hitAlly';

export interface OupsEntry { id: string; min: number; max: number; kind: OupsKind; label: string; mod?: number; }
/** Incident de Tir (LDB 14 l.34) — HORS table : déclenché par arme à Poudre noire + jet PAIR. */
export interface OupsMisfireEntry { id: string; kind: 'misfire'; label: string; }
export type OupsRow = OupsEntry | OupsMisfireEntry;

/** Bandes du Tableau des Oups ! (les 7 fourchettes) — lues par `findTableEntry`. */
export const oupsTable = memoParVersion('oups', () => oups.filter((e): e is OupsEntry => e.kind !== 'misfire'));
/** Entrée « Incident de Tir » (label DISPLAY-ONLY) — source UNIQUE, lue par `rollOups`. */
export const oupsMisfire = memoParVersion('oups', () => oups.find((e): e is OupsMisfireEntry => e.kind === 'misfire')!);
/** Le dé du Tableau des Oups !, lu à l'appel. */
export const oupsDie = (): DiceSpec => deDeTirageDe<typeof tableauDesOups>(oupsJson);
