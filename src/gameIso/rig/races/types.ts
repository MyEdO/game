import type { BoneId } from '../bones';
import type { View } from '../facing';
import type { PaletteDeclaree, Palette } from '../palette';
import type { GabaritDef } from '../gabarits/types';
import type { Sexe } from '../../../data/schemas/grammaire/valeurs';

/** Trait de corps d'une race, ancré à un os, éventuellement échelonné à la taille de l'os. */
export interface RaceFeature {
  bone: BoneId;
  svg: string;                  // art brut 1-vue (tokens @peau/@metal…). Vide '' si `appendage` fournit l'art.
  appendage?: string;           // id du registre APPENDAGES (cornes/queue MULTI-VUES) — quand présent,
                                // REMPLACE `svg`, résolu par `pickView` selon la vue (cf. `appendageFeature`).
  layer?: number;               // ordre peintre (défaut: derrière la part de l'os si négatif)
  scale?: 'bone' | 'fixed';     // 'bone' = suit (thickness,length) de l'os ; 'fixed' = taille fixe (défaut)
  view?: View;                  // limite la feature à une vue (ex. crocs vampire = 'front' seul)
}

/** Identité d'une race bipède : carrure par défaut + peau/tête/traits/posture + défauts d'espèce
 *  (tenue/couleurs/sexe/coiffure/échelle). Dissout PROPS-via-baseSpeciesOf, palettes et postures
 *  d'espèce et la config biped des defs créature. */
export interface RaceDef {
  id: string;                   // 'humain', 'ogre', 'skaven'… (== sortie canonique de baseSpeciesOf)
  label: string;                // libellé d'affichage (« Haut-Elfe ») dont l'id est le slug
  gabarit: string;              // id du gabarit par défaut
  gabaritOverride?: Partial<Pick<GabaritDef, 'sl' | 'st' | 'legs' | 'arms' | 'head'>>;
  palette?: PaletteDeclaree;      // peau/cheveux/yeux par défaut de l'espèce
  paletteF?: PaletteDeclaree;    // variante féminine (sinon palette sert aux deux sexes)
  head?: string;                // id de part de tête monstrueuse (HEADS), sinon visage humain cosmétique
  legs?: string;                // id de jambes monstrueuses (LEGS) remplaçant les 2 cuisses (ex. chèvre)
  armG?: string;                // id de bras monstrueux (ARMS) remplaçant l'épaule gauche
  armD?: string;                // id de bras monstrueux (ARMS) remplaçant l'épaule droite (ex. griffe)
  dropHeadgear?: boolean;       // saute le couvre-chef de tenue (ex. vampire : pas de chapeau de cour)
  /** Plages du tirage INDIVIDUEL des teintes, par emplacement de palette. Sans plages, aucun individu de la
   *  race ne varie de teinte. */
  tirageIndividuel?: Partial<Record<import('../palette').Slot, string[]>>;
  features?: RaceFeature[];     // traits de corps (gut, barbe, queue, cornes…)
  pose?: Record<string, number>;// posture de repos, front + profil
  // Défauts d'espèce :
  tenue?: string;              // tenue par défaut
  colors?: Palette;             // surcharges de palette
  sex?: Sexe;              // sexe forcé
  parts?: { cheveux?: number; visage?: number }; // coiffure/visage épinglés
  scale?: number;               // échelle globale du token en jeu (Géant)
  /** yeux de race par défaut — CLÉS du catalogue d'yeux (`EYE_OPTIONS`, ex. 'rouge' pour le Vampire),
   *  résolues en art par `composeRig`. Surchargés par `Appearance.eyes` (mutation/blessure prime). */
  eyes?: { G?: string; D?: string };
  /** Nu du PIED de l'espèce (#736 Lot 1) — 'lisses' (civilisé, défaut) ou 'griffues' (monstrueux) ;
   *  repli quand aucune tenue/armure ne chausse la zone (`resolve.ts`, `PIED_NU`). Surchargé par
   *  `CreaturePerso.extremites` pour une créature non-canonique repliée sur une race partagée. */
  extremites?: 'lisses' | 'griffues';
}
