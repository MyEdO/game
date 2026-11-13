/**
 * Table des Péripéties de voyage — `LDB 51 l.210-221` ; seuil quotidien : `LDB 51 l.208` (son dé
 * `tirageQuotidien` en donnée ; sa face, `MapRoute.perilDie`, défaut 8, 0 = éteint).
 *
 * La DONNÉE vit dans `peripeties.json` (éditable, comme `creatures.json`), dé `die` compris ; ce
 * module = chargement. Ajouter/régler une péripétie = éditer le JSON, jamais ce fichier. Le
 * tirage est une étape de MONDE à table (`perilATerreTable`, `noyau/travelFlow.ts`).
 *
 * `kind` = ce que le MOTEUR sait jouer :
 *  - 'reposant'  : `LDB 51 l.212` ;
 *  - 'ereintant' : `LDB 51 l.215` ;
 *  - 'attaque'   : `LDB 51 l.221` (sans rencontre configurée → narratif au journal) ;
 *  - 'narratif'  : le texte de la ligne, journalisé tel quel.
 */
import { peripeties } from './index';
import peripetiesJson from './peripeties.json';
import { deDeTirageDe } from './rangees';
import { deDeLaTableTiree, type DeDeTable } from '../engine/tables';
import type * as tableDesPeripeties from './schemas/defs/peripeties';

export const PERIPETIES = peripeties;
/** Le dé de la Table des Péripéties, lu à l'appel. */
export const peripetieDie = (): DeDeTable => deDeTirageDe<typeof tableDesPeripeties>(peripetiesJson);
/** Le dé du seuil quotidien des Péripéties (`tirageQuotidien`), lu à l'appel. */
export const peripetieSeuilDie = (): DeDeTable => deDeLaTableTiree(peripetiesJson.tirageQuotidien);
