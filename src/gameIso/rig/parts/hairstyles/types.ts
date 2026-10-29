import type { Sexe } from '../../../../data/schemas/grammaire/valeurs';
import type { ViewSet } from '../types';
import type { CoiffureId, TeteId } from '../../../../data/schemas/defs/garde-robe';

/**
 * Art PAR-VUE d'une coiffure :
 * les 3 vues `{front, profile, back}` + DEUX composantes optionnelles PAR vue :
 * - `behind` : masse ARRIÈRE qui épouse le crâne, peinte DERRIÈRE la part de visage
 *   (layer −2 — même sémantique que `RigOverlay.behind`) ;
 * - `drop` : CHUTE qui dépasse la tête (chute longue, queue, rideau), routée par composeRig
 *   sur le PLAN dorsal (cf. parts/dorsal.ts) : de face derrière TOUT le corps (visible aux
 *   bords de silhouette, jamais posée sur le buste), de dos par-dessus le dos, de profil
 *   layer −2 ancré au crâne.
 * PAS de repli front→profil pour `behind`/`drop` : une composante se dessine par vue, ou ne
 * s'affiche pas dans cette vue.
 */
export type HairArt = ViewSet & { behind?: Partial<ViewSet>; drop?: Partial<ViewSet> };

/**
 * Une COIFFURE = un fichier `defs/<coiffure>-<Sexe>.ts` : l'art d'une ligne `coiffure` de
 * `garde-robe.json` pour un sexe, en jetons @cheveux/@cheveuxO/@cheveuxH, vues comprises (cf. `HairArt`).
 * `tete` absent = pool partagé de toutes les espèces ; posé = pool de cette seule tête, placé avant le
 * partagé. `order` = rang dans son pool (tirage par la graine). Le libellé vit en donnée
 * (`findCoiffureById`).
 */
export type HairstyleDef = { coiffure: CoiffureId; sex: Sexe; order: number; tete?: TeteId } & HairArt;
