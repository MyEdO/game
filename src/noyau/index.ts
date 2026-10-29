/**
 * LA SURFACE DU NOYAU (#2817 D9) pour un hôte qui n'est pas le web : la partie, les types de l'état et de
 * l'intention, et les lecteurs de sa vue (#2898) : le tour, les offres du registre, la fenêtre ouverte, ses jets,
 * la fenêtre d'attaque en données, l'exploration, le plateau de la scène, l'équipement dessiné d'un porteur, les rôles d'animation. Chaque nom a un lecteur parmi les hôtes, leur module commun ou
 * un test de la surface, que knip mesure (`knip.json`). Chaque nom vient du module qui le déclare ; c'est le SEUL
 * module de `src/noyau` qui réexporte (`murs/reexportation`, `scripts/guards/lib/couchesLint.mjs`).
 */
export { creerPartie, type Partie, type Intention, type EntreesDeLaPartie, type ResultatDeLAppel, type LigneDuJournal } from './partie';
export { etatInitialDuJeu, type EtatDeJeu, type Jeu } from './etat';
export type { Jeton } from './plateforme';
export { horlogeVirtuelle, type Programme } from './horlogeVirtuelle';
export { argsAvecVerdictLocal, porteesDuTour } from './localIntent';
export { previewAttack, activeCombatant } from './combatFlow';
export { LOCALISATIONS_DE_COUP } from '../engine/types';
export { conditionLabel } from '../data';
export type { Cadence } from '../engine/cadence';
export { refusDesSurcharges, ruleOverrides, type RuleValue } from '../engine/policy';
export { actionGate, offresDeLActif, offresParPorteur, offreDesignee, etatDeLaBarre, runAction, type EtatDeLaBarre, type ActionCtx, type ActionRunCtx, type Offre } from './actionRegistry';
export { ACTIONS } from '../data/index';
export { findApparenceById, findTeinteById, gardeRobe } from '../data/index';
export { ecartsDeCleDElement, type CodeDEcartDeCle } from './apparence/cleDElement';
export { SLOTS } from '../data/palette.types';
export { mouvementDuTour } from './mount';
export { combatDistance } from './monde/footprint';
export { effectiveArmourAt } from '../engine/characteristics';
export { fenetreDuJeu, CLES_DE_FENETRE, VERBES_D_INTERACTION } from './combatAuto';
export { stepInteraction } from './cascade';
export type { Combatant } from '../engine/types';
export type { ModLine, RollBreakdown } from '../engine/combat';
export { validTargets } from './targeting';
export { endTurnArmed } from './endTurnGuard';
export { quiTientLaMain } from './netOwnership';
export { siegeDe } from './sieges';
export { DESIGNATIONS } from './designations';
export { gestesDExploration, type GesteDExploration } from './gestesDExploration';
export { CLICS_DU_CHAMP } from './actionsDuNoyau';
export { capDuGroupe, porteurParId } from './monde/combatants';
export { tileFromKey, type Pt } from './monde/path';
export { plateauDeLaScene, type Scene } from './monde/scene';
export { registerScene } from './monde/registreDesScenes';
export { jetsEnVue, type JetEnVue, type LigneDeJet } from './jetsEnVue';
export { fenetreDAttaque, type FenetreDAttaque } from './fenetreDAttaque';
export { fenetreDeDefense, type FenetreDeDefense } from './fenetreDeDefense';
export { fenetreDuButin, REGLAGES_DU_BUTIN } from './fenetreDuButin';
export { fenetreDeLOperation, REGLAGES_DE_L_OPERATION } from './medicFlow';
export { libelleDuVerbe, libelleDuParametre, libelleDuLitteral, libelleDeLaFenetre, libelleDuJet } from './libelles';
export { reglagesDesElements, REGLAGES_DE_L_ATTAQUE, REGLAGES_DE_LA_DEFENSE, type Reglage, type ValeurDuReglage } from './reglages';
export { texteDuMod } from './difficultyText';
export { avecSigne } from '../engine/types';
export { objetDuNarratif } from './monde/resolveursDuNarratif';
export { equipementDessine, equipementDEntite } from './equipementDessine';
export { ROLES_D_ANIMATION, type RoleDAnimation } from './animation';
export { lireLeRoster, ecrireLeRoster, rosterAvecLeHeros, type RosterEntry } from './persistance/roster';
export { lireLesRetraits, cumulerLesRetraits, type RetraitsDElagage } from './persistance/elagage';
export { poserLesReglesMaisonPersistees, surchargerUneRegleMaison, retablirUneRegleMaison } from './reglesMaison';
export { preferenceDef, preferencesAPersister, poserLesPreferencesPersistees, valeurDEntree, type IdDePreference, type Preference, type PrefValue } from './preferences';
export {
  snapshotSave, metaDeSave, lireSave, exporterLaSauvegarde, chargerLaSave, refusDeSauvegarde,
  type SaveGame, type SaveMeta, type ObsoleteCause, CAUSES_DE_REFUS_DE_SAVE,
} from './persistance/save';
export { aEcrire, campagneDUneEntree, entreesRelues, idDesignable, projetDUneEntree, type CampagneLancee, type EntreeListee, type SavedProject } from './persistance/bibliotheque';
export { ProjetRefuse, type ProjectDoc } from './worldMap';
