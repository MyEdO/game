import type { Sexe } from '../../../../data/schemas/grammaire/valeurs';

/**
 * Art PAR-VUE d'une chevelure (coiffure du pool OU coiffure par défaut d'une tête) :
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
export type HairArt = {
  front: string;
  profile: string;
  back: string;
  behind?: { front?: string; profile?: string; back?: string };
  drop?: { front?: string; profile?: string; back?: string };
};

/**
 * Une COIFFURE = un fichier `defs/<nom>-<Sexe>.ts`. Pool PARTAGÉ par sexe (toutes espèces), art en
 * tokens @cheveux/@cheveuxO/@cheveuxH. Porte ses vues (cf. `HairArt`) : le profil/dos vit AVEC la
 * coiffure. `order` = position dans le pool (sélection seed-déterministe). `label` = description
 * d'authoring, non consommée par la résolution (choix par sexe+ordre, jamais par nom). Ajouter une
 * coiffure = déposer un fichier.
 */
export type HairstyleDef = { id: string; label: string; sex: Sexe; order: number } & HairArt;
