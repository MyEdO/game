/**
 * LA SURFACE DU NOYAU (#2817 D9) pour un hôte qui n'est pas le web : la partie, les types de l'état, des
 * actions, de l'intention et du lancement de scénario, les lecteurs dont un hôte a besoin pour montrer la
 * fenêtre d'attaque (`docs/plans/2026-10-19-modale-attaque-godot.md`, morceaux 1 à 7), et ceux de sa vue
 * (#2898) : le tour, les offres du registre, la fenêtre ouverte, l'exploration. Chaque nom vient du module qui
 * le déclare ; c'est le SEUL module de `src/noyau` qui réexporte (`scripts/guards/lib/reexportations.mjs`).
 */
export { creerPartie, type Partie, type Intention, type Evenement, type EntreesDeLaPartie, type ResultatDeLAppel, type IssueDeLAppel, type LigneDuJournal } from './partie';
export { etatInitialDuJeu, type EtatDeJeu, type Jeu } from './etat';
export type { Get } from './flowTypes';
export type { Jeton } from './plateforme';
export type { ActionsDuNoyau } from './actionsDuNoyau';
export { argsAvecVerdictLocal, porteesDuTour } from './localIntent';
export { previewAttack, defenseDodgeMods, resolveAttack, activeCombatant } from './combatFlow';
export { rederiveAttack } from './rollFlowSpecs';
export { opReroll, opBonusSL } from './rollFlowFactory';
export { LOCALISATIONS_DE_COUP, type HitLocation } from '../engine/types';
export { modDeRegle } from '../engine/reglesChiffrees';
export type { LancementDeScenario } from './lancementDeScenario';
export { actionGate, actionCostLabel, offresDeLActif, offresParPorteur, offreDesignee, etatDeLaBarre, type EtatDeLaBarre, type ActionGate, type ActionCtx, type ActionRunCtx, type ActionSelectorCtx, type Offre, type OffresParPorteur } from './actionRegistry';
export { ACTIONS, type ActionDef } from '../data/index';
export { mouvementDuTour } from './mount';
export { combatDistance } from './monde/footprint';
export { effectiveArmourAt } from '../engine/characteristics';
export { pickActiveModalKey, modalOwnerOf, type ModalKey } from './modalArbiter';
export { fenetreDuJeu } from './combatAuto';
export { stepInteraction } from './cascade';
export type { Combatant } from '../engine/types';
export { validTargets } from './targeting';
export { endTurnArmed } from './endTurnGuard';
export { portalsForParty, type RoomPortal } from './monde/roomPortals';
export type { Scene } from './monde/scene';
export { tileFromKey, type Pt } from './monde/path';
