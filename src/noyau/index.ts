/**
 * LA SURFACE DU NOYAU (#2817 D9) pour un hôte qui n'est pas le web : la partie, les types de l'état et de
 * l'intention, et les lecteurs de sa vue (#2898) : le tour, les offres du registre, la fenêtre ouverte, ses jets,
 * la fenêtre d'attaque en données, la fiche d'un porteur, l'exploration, le plateau de la scène, l'équipement dessiné d'un porteur, les rôles d'animation. Chaque nom a un lecteur parmi les hôtes, leur module commun ou
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
export { formatMoney } from '../engine/money';
export { conditionLabel } from '../data';
export type { Cadence } from '../engine/cadence';
export { refusDesSurcharges, ruleOverrides, type RuleValue } from '../engine/policy';
export { actionGate, offresDeLActif, offresParPorteur, offreDesignee, etatDeLaBarre, runAction, type EtatDeLaBarre, type ActionCtx, type ActionRunCtx, type Offre } from './actionRegistry';
export { ACTIONS } from '../data/index';
export { findApparenceById, findCouleurById, findTeinteById, gardeRobe } from '../data/index';
export type { EmblemeDef } from '../data/schemas/defs/garde-robe';
export { ecartsDeCleDElement, libelleDeCleDElement, type CodeDEcartDeCle } from './apparence/cleDElement';
export { emplacementDePiece, estEmplacement, emblemeDuPorteur, type EmblemeResolu } from './apparence/gardeRobe';
export type { GabaritResolu } from './apparence/gabarit';
export { cataloguesDeComposition, lireComposition, lireSurchargesDEmblemes, porteeDeComposition, presetDeComposition, type Composition, type LectureAuSchema, type Portee, type SurchargesDEmblemes } from './apparence/composition';
export type { Sexe } from '../data/schemas/grammaire/valeurs';
export { SLOTS } from '../lib/palette';
export { mouvementDuTour } from './mount';
export { combatDistance } from './monde/footprint';
export { effectiveArmourAt } from '../engine/characteristics';
export { effectiveTalents } from '../engine/talentEffects';
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
export { CLICS_DU_CHAMP, CLICS_DE_L_EXPLORATION } from './actionsDuNoyau';
export { capDuGroupe, porteurParId } from './monde/combatants';
export { toneOf, type CombatEvent } from './combatLog';
export { tileFromKey, type Pt } from './monde/path';
export { plateauDeLaScene, type Scene } from './monde/scene';
export { registerScene } from './monde/registreDesScenes';
export { jetsEnVue, type JetEnVue, type LigneDeJet } from './jetsEnVue';
export { fenetreDAttaque, type FenetreDAttaque } from './fenetreDAttaque';
export { difficultyText } from './difficultyText';
export { fenetreDeDefense } from './fenetreDeDefense';
export { ficheDuPorteur, type FicheDuPorteur } from './ficheDuPorteur';
export { fenetreDuButin, REGLAGES_DU_BUTIN } from './fenetreDuButin';
export { fenetreDeLOperation, REGLAGES_DE_L_OPERATION } from './medicFlow';
export { libelleDuGeste, libelleDuParametre, libelleDuLitteral, libelleDeLaFenetre, libelleDuJet, libelleDeLaFermeture } from './libelles';
export { argumentsPosesDuGeste, fermeturesDeLaFenetre } from './verbesOuverts';
export { cleDuGeste, type GesteDuJeu } from './modalArbiter';
export { verbeDeJetDe, viseUneRangee } from './flowVerbs';
export { FERMETURES_DITES } from './rollFlowFactory';
export { reglagesDesElements, REGLAGES_DE_L_ATTAQUE, REGLAGES_DE_LA_DEFENSE, type Reglage, type ValeurDuReglage } from './reglages';
export { avecSigne } from '../engine/types';
export { objetDuNarratif } from './monde/resolveursDuNarratif';
export { equipementDessine, equipementDEntite } from './equipementDessine';
export { ROLES_D_ANIMATION, type RoleDAnimation } from './animation';
export { lireLeRoster, ecrireLeRoster, rosterAvecLeHeros, type RosterEntry } from './persistance/roster';
export { engagement, refusDEngagement } from './creation/engagement';
export type { CreatorDraft } from './creation/brouillon';
export { lireLesRetraits, cumulerLesRetraits, type RetraitsDElagage } from './persistance/elagage';
export { poserLesReglesMaisonPersistees, surchargerUneRegleMaison, retablirUneRegleMaison } from './reglesMaison';
export { preferenceDef, preferencesAPersister, poserLesPreferencesPersistees, valeurDEntree, type IdDePreference, type Preference, type PrefValue } from './preferences';
export {
  snapshotSave, metaDeSave, lireSave, exporterLaSauvegarde, chargerLaSave, refusDeSauvegarde,
  type SaveGame, type SaveMeta, type ObsoleteCause, CAUSES_DE_REFUS_DE_SAVE,
} from './persistance/save';
export { aEcrire, campagneDUneEntree, entreesRelues, idDesignable, projetDUneEntree, type CampagneLancee, type EntreeListee, type SavedProject } from './persistance/bibliotheque';
export { ProjetRefuse, type ProjectDoc } from './worldMap';
