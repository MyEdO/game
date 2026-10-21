/**
 * LA SURFACE DU NOYAU (#2817 D9) pour un hôte qui n'est pas le web : la partie, les types de l'état, des
 * actions et de l'intention, et les lecteurs dont un hôte a besoin pour montrer la fenêtre d'attaque
 * (`docs/plans/2026-10-19-modale-attaque-godot.md`, morceaux 1 à 7). Chaque nom vient du module qui le
 * déclare ; c'est le SEUL module de `src/noyau` qui réexporte (`scripts/guards/lib/reexportations.mjs`).
 */
export { creerPartie, type Partie, type Intention, type Evenement, type EntreesDeLaPartie, type ResultatDeLAppel, type IssueDeLAppel, type LigneDuJournal } from './partie';
export { etatInitialDuJeu, type EtatDeJeu, type Jeu } from './etat';
export type { Get } from './flowTypes';
export type { Jeton } from './plateforme';
export type { ActionsDuNoyau } from './actionsDuNoyau';
export { argsAvecVerdictLocal } from './localIntent';
export { previewAttack, defenseDodgeMods, resolveAttack } from './combatFlow';
export { rederiveAttack } from './rollFlowSpecs';
export { opReroll, opBonusSL } from './rollFlowFactory';
export { LOCALISATIONS_DE_COUP, type HitLocation } from '../engine/types';
export { modDeRegle } from '../engine/reglesChiffrees';
