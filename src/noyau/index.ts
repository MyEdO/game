/**
 * LA SURFACE DU NOYAU (#2817 D9) pour un hôte qui n'est pas le web : la partie et les événements de ses appels, les types de l'état et de
 * l'intention, et les lecteurs de sa vue (#2898) : le tour, les offres du registre, la fenêtre ouverte, ses jets,
 * la fenêtre d'attaque en données, la fiche d'un porteur, l'exploration, le plateau de la scène, la création d'un héros, les rôles d'animation, les gestes hors combat (#4938). Chaque nom a un lecteur parmi les hôtes, leur module commun ou
 * un test de la surface, que knip mesure (`knip.json`). Chaque nom vient du module qui le déclare ; c'est le SEUL
 * module de `src/noyau` qui réexporte (`murs/reexportation`, `scripts/guards/lib/couchesLint.mjs`).
 */
export { creerPartie, type Partie, type Intention, type EntreesDeLaPartie, type ResultatDeLAppel, type Evenement, type LigneDuJournal } from './partie';
export { EVT, type ChargeDAttaque, type TestJete } from './bus';
export { lancementDuProjet, type LancementDeScenario } from './lancementDeScenario';
export { campagneDuJeu, campagneDuPaquet, paquetDisqueDuJeu, paquetDuJeu, type BuiltinCampaign } from './campagneLivree';
export { etatInitialDuJeu, initialNet, type EtatDeJeu, type Jeu } from './etat';
export type { JeuDuNoyau } from './machinerieDuNoyau';
export type { Get } from './flowTypes';
export type { Jeton } from './plateforme';
export { horlogeVirtuelle, type Programme } from './horlogeVirtuelle';
export { argsAvecIntentionLocale, porteesDuTour } from './localIntent';
export { previewAttack, activeCombatant, ordreDuRoundSuivant } from './combatFlow';
export {
  AVAILABILITIES,
  CHAR_KEYS,
  DIFFICULTE_PAR_DEFAUT,
  DIFFICULTY_LABELS,
  FIRE_ARCS,
  LOCALISATIONS_DE_COUP,
  locationLabel,
  type Difficulty,
  type FireArc,
} from '../engine/types';
export { formatMoney, fromBrass, libelleDuStatut, PA_PER_CO, toBrass, type Money } from '../engine/money';
export type { Applique, FaitApplique } from '../engine/faits';
export { formatSpellDuration, formatSpellRange, formatSpellTarget } from '../engine/spellRangeFormat';
export {
  dayIndex,
  dayPhase,
  formatImperial,
  formatJourImperial,
  jourImperial,
  MINUTES_PER_DAY,
  toDate,
  type DayPhaseId,
  type ImperialDate,
} from '../engine/clock';
export { libelleDeDistance } from '../engine/travel';
export { clockLabel } from '../engine/duration';
export { currentSeason } from '../engine/travelStages';
export { isEngagedWith } from '../engine/engagement';
export { makeRNG, type RNG } from '../engine/dice';
export { isConditionLocked, isOutOfAction, raisonVerrouEtat, refusDeDetermination } from '../engine/conditions';
export {
  CAREER_SKILLS_ADVANCED,
  careerCompletionAdvances,
  coutDeLAugmentation,
  coutDuChangement,
  coutDuTalent,
  niveauValide,
  talentSlotsAchetables,
  type Chiffrage,
  type ContexteDeCompletion,
} from '../engine/advancement';
export { modeleDe } from '../engine/modeleDeProgression';
export { casesDuNiveau } from '../engine/casesDeCarriere';
export { talentMaxReached } from '../engine/acquisitionTalents';
export { spellCost, talentOuvre } from '../engine/grimoire';
export { spellSupportOf } from '../engine/spellspec';
export { castingKindOf } from '../engine/combatFeatures/dispatch';
export { peutTenter, testValue, type TestDesigne } from '../engine/skills';
export { evaluateTest } from '../engine/tests';
export { TIME_COST } from '../engine/timeCost';
export { encumbrancePenalties } from '../engine/encumbrance';
export { qualityWearMods, wornArmourPenalty } from '../engine/wearPenalty';
export { consommableDe, isConsumable } from '../engine/consumables';
export { effectiveWeaponDamage } from '../engine/weaponDamage';
export { ZONES_D_ARMURE } from '../engine/classementDeTrait';
export { armourCastDRPenalty } from '../engine/magic';
export { adresseDeCreation } from '../engine/adresseDeCreation';
export { maladieDeclaree } from '../engine/passifsDeMaladie';
export { corruptionThreshold } from '../engine/corruption';
export { cappedHealAmount, HEAL_SKILL, type HealMode } from '../engine/healing';
export { surgeryTraumas } from '../engine/trauma';
export type { Season } from '../engine/travelStages';
export { saisonSchema } from '../data/schemas/grammaire/valeurs';
export type { QualiteDeRepos } from '../data/schemas/grammaire/valeurs';
export { memeSpecialisation, refCouvre, type RefDesignee } from '../data/schemas/grammaire/ref';
export type { FlowDeScene } from '../data/schemas/defs-scenes/effets';
export { parseTable } from '../data/schemas/source/decoupe';
export { arena } from './mapSpec';
export { avecRencontres } from './monde/encounterAuthoring';
export {
  advancementLabel,
  bandeDe,
  byId,
  careerLabelFor,
  careers,
  characteristics,
  conditionLabel,
  diseaseLabel,
  displayLabelForSex,
  findCreatureById,
  findQualityById,
  findSpeciesById,
  findTalentById,
  findTrappingById,
  names,
  sexeDuPorteur,
  skills,
  spells,
  symptomLabel,
  testSkillLabel,
  trappingsEnVente,
  trappingsInstanciables,
  weaponGroups,
  type CareerLevelData,
  type PorteurDeSexe,
  findCareerById,
  findSpellById,
  levelsForCareer,
  libelleDAuteur,
  lightLevels,
  lightTones,
  matieresCouvrantes,
  matieresDe,
  props,
  refLabel,
  seasonLabel,
  siegeEngines,
  structureAppearances,
  trappingRefLabel,
} from '../data';
export {
  ammoFamily,
  chargeLArme,
  equipConflicts,
  isOffHandEligible,
  isShieldTrapping,
  isWearable,
  itemsEncumbrance,
  maxEncumbrance,
  objetsDeLInventaire,
  reachRankOf,
  totalEncumbrance,
  weaponFromItem,
  wornArmourPoints,
} from '../engine/items';
export {
  carriereActuelle,
  designationsDeCarriere,
  parcoursDe,
  parcoursRetouche,
  talentsDuParcours,
  type ParcoursDeCarriere,
} from '../engine/pnjDeCarriere';
export { listesDeSorts, sortsImprimes } from '../engine/sortsDuPnj';
export { availableChars, candidatsDuSlot, designationsFor, parseRefKey, prisParLesAutres, refKey, skillSlots, slotCovers } from '../engine/careerSlots';
export {
  dotationsDuPnj,
  emplacementsDeDotation,
  estEmplacementRacine,
  libelleDeLaValeur,
  porteurDuProfil,
  sousEmplacementActif,
  valeursDeLEmplacement,
  type ChoixDeDotation,
  type EmplacementDeDotation,
} from '../engine/trappingChoices';
export { PENTE_TOIT_DEG } from '../data/schemas/defs-scenes/scene';
export { PARTS_RELIEF } from '../data/schemas/materials.types';
export type { Cadence } from '../engine/cadence';
export { fabriqueLocale, type FabriqueDId, type FabriqueDuRoster } from '../engine/fabriqueDId';
export type { Equipe } from '../engine/relations';
export { OPTIONAL_RULES, refusDesSurcharges, ruleOverrides, type OptionalRule, type RegleOptionnelleId, type RuleValue } from '../engine/policy';
export { valeurConforme } from '../data/schemas/grammaire/formeDeControle';
export { actionGate, offreArmee, offresDeLActif, offresParPorteur, etatDeLaBarre, type EtatDeLaBarre, type ActionCtx, type Offre } from './actionRegistry';
export { emplacementsRapides } from './emplacementsRapides';
export { ACTIONS } from '../data/index';
export { DESSINS_DES_PARTS } from '../data/schemas/defs/actions';
export { CADRE_DES_ICONES, ICON_DEFS, type IconId } from '../data/schemas/icons';
export { CADRE_DES_CADRES, CADRES } from '../data/schemas/cadres';
export { CADRE_DES_FONDS, FONDS } from '../data/schemas/fonds';
export { CADRE_DES_PAYSAGES, COUCHES_DE_PAYSAGE, type IdDeCouche } from '../data/schemas/paysages';
export { entreesDesFiches } from '../data/schemas/dossiers';
export type { FicheLue } from '../data/schemas/source/dossier';
export { findCouleurById, findTeinteById, gardeRobe } from '../data/index';
export type { LigneDeGardeRobe } from '../data/index';
export { ecartsDeCleDElement, libelleDeCleDElement, type CodeDEcartDeCle } from './apparence/cleDElement';
export { emplacementDePiece, estEmplacement, pieceRacine, emblemeDuPorteur, type EmblemeResolu } from './apparence/gardeRobe';
export type { GabaritResolu } from './apparence/gabarit';
export {
  cataloguesDeComposition,
  emplacementsDeRangement,
  lireApparenceDAuteur,
  lireComposition,
  lireSurchargesDEmblemes,
  porteeDeComposition,
  presetDeComposition,
  type Composition,
  type LectureAuSchema,
  type Portee,
  type PorteeDeComposition,
  type SurchargesDEmblemes,
} from './apparence/composition';
export { porteeDuCombattant, vehiculeDuCombattant, type PosteDuVehicule, type VehiculeDuCombattant } from './apparence/combattant';
export { aLEchelleDesPonts } from '../data/schemas/catalogue/poseDesPonts';
export {
  capEnCombat,
  CAPS_DES_PONTS,
  estPoseParSesPonts,
  coquesDeLaScene,
  seMontreParLeMonde,
  stationsDuNavire,
  TYPES_DE_NAVIRE,
  type EmprisesDesCases,
  type CoqueDeLaScene,
  type StationDeNavire,
} from './planDeNavire';
export type { Sexe } from '../data/schemas/grammaire/valeurs';
export { SLOTS } from '../lib/palette';
export { mouvementDuTour } from './mount';
export { distanceDeCombat, footprintN } from './monde/footprint';
export { bonusDe, effectiveArmourAt, effectiveMaxWounds, forceDuPorteur } from '../engine/characteristics';
export { competenceEnCarriere, reservesPropres } from '../engine/talentEffects';
export { effectiveTalents } from '../engine/talentsPossedes';
export { fenetreDuJeu, CLES_DE_FENETRE, VERBES_D_INTERACTION, VERBES_DU_JET_PSY } from './combatAuto';
export { conversationEnVue, libelleDuTestAnnonce, type ConversationEnVue } from './dialogue';
export { documentEnVue } from './campagne';
export { stepInteraction } from './cascade';
export type { ArmourPoints, Availability, CharKey, Combatant, ConditionInstance, ItemInstance, Main, ModLine } from '../engine/types';
export { attackTestOf, combatBaseValue, ligneDuCoup, weaponGroupSkillMode, weaponSkillId } from '../engine/combat';
export { validTargets } from './targeting';
export { endTurnArmed } from './endTurnGuard';
export { quiTientLaMain, withActingSeat } from './netOwnership';
export { fermerLeSiege, siegeDe, siegesDeLaTable, siegesOfferts } from './sieges';
export { buildDeLaCoop, instantaneDeLaCoop } from './coop';
export { GUEST_INTENTS } from './intentionsDeSiege';
export { DESIGNATIONS, type Designation, type IdDEntiteDeScene, type IdDeHeros } from './designations';
export { gestesDExploration, type GesteDExploration } from './gestesDExploration';
export { CLIC_DU_CHAMP, type GesteDuNoyau, type GesteFermable } from './actionsDuNoyau';
export { capDuGroupe, casesDuGroupe, meneurDuMonde, porteurParId, PARTY_MAX } from './monde/combatants';
export { labelEmplacement, seatSlotsOf, type SeatOccupant } from './monde/seating';
export { assoirALaPlace, ECRITURES_DES_PORTEURS, retraitOffert, type PatchDeZone } from './sceneEdit';
export { toneOf, type CombatEvent } from './combatLog';
export { tileFromKey, type Pt } from './monde/path';
export {
  areteDessinee,
  aretesDeLaCouche,
  aretesDeLaScene,
  masqueDuRegard,
  paletteDeLApparence,
  plateauDeLaScene,
  regardDuJeu,
  REGARDS,
  type AreteDessinee,
  type PlateauDeLaScene,
  type Regard,
} from './monde/aretes';
export { cotesDeMarchesDeLaCouche, cotesDeMarchesDeLaScene, type CoteDeMarches } from './monde/cotesDeMarches';
export { piecesDeToitDeLaScene, type PieceDeToitPosee } from './monde/piecesDeToit';
export type { Scene } from './monde/scene';
export type { RectDeCases } from '../data/schemas/grammaire/valeurs';
export { planDeLaCouche, type OeilDuPlan } from './monde/sceneToAscii';
export {
  couronnesDuMonde,
  matieresDeDecor,
  nomDeMatiere,
  posesDesDecors,
  retraitDuMonde,
  toitsDuMonde,
  volumeDuMonde,
  type MorceauDuMonde,
  type NappeDuMonde,
  type PoseDeDecor,
  type RetraitDuMonde,
  type VolumeDuMonde,
} from './monde/volume/volume';
export { echantillonDessine, famillesDEchantillons, sceneDEchantillon, type EchantillonDessine, type FamilleDEchantillons } from './monde/echantillons';
export { PLAN_DEFECT_FAMILIES } from './planDefects';
export {
  avertissementsDeLaSession,
  cadreDeLaSession,
  calqueDeLaCouche,
  casesDuDefaut,
  corpsActif,
  editer,
  ouvrirLEdition,
  planDeLaVolee,
  planDuLieuOuvert,
  projetDuDepot,
  refusDOuvrage,
  refusDeLaValeur,
  refusDeRetrait,
  refusDuRenommage,
  sessionSousLeCatalogue,
  idDeLaSceneEditee,
  projetEdite,
  sceneEditee,
  vueDeLaScene,
  essaiDeLaScene,
  texteAEnregistrer,
  ACTIONS_D_ARCHITECTURE,
  AMBIANCES,
  BORNES_DE_LA_TROUPE,
  ENVIRONNEMENTS,
  HAUTEURS,
  METEOS,
  OUVRAGES,
  PINCEAUX,
  PROFILS_DE_TOIT,
  QUALITES_DE_REPOS,
  SORTES_D_OUVERTURE,
  groupesDuLieu,
  versLaFautive,
  type BrouillonDArete,
  type GesteDEdition,
  type PatchDArete,
  type PatchDEntite,
  type PatchDeScene,
  type SessionDEdition,
} from './edition/session';
export { OUTILS_DE_LA_CARTE, OUTILS_DU_PLAN_DU_LIEU, UNITES_DU_PLAN_DE_CARTE, type OutilDeLaCarte, type OutilDuPlanDuLieu } from './edition/pointeur';
export { offresDeLEtablissement, orienterRoute, typesDEtablissement } from './worldMapEdit';
export { refusDeForme } from './narratifEdit';
export { FORMES_D_ETAT, type FormeDEtatKind } from '../data/schemas/defs-scenes/formes-d-etat';
export { SOUS_ENTREES } from '../data/schemas/defs-scenes/ecritures-du-narratif';
export {
  FORMULAIRES,
  accesDe,
  cleDeLElement,
  formulaireDe,
  retraitsDuPorteur,
  porteurDeLaSel,
  porteurDuProjet,
  porteursDuProjet,
  idDuPorteur,
  type DonneeDuPorteur,
  type SorteDeDocument,
  type SorteDePorteur,
} from './sceneEditLecture';
export { PHRASE_REFUS, estChampDAdresse, etatDeLAdresse, type SourceDeLEdition } from './edition/adresseDeProse';
export {
  ariteDuNoeud,
  bornesAuPoint,
  champDeLElement,
  champsDeclares,
  champsDuRecord,
  champsOfferts,
  choixDuNoeud,
  clesPosees,
  designeDesEntrees,
  elementDuNoeud,
  formeAuPoint,
  identiteFigee,
  identiteTenue,
  recordDuNoeud,
  unionDuNoeud,
  varianteCourante,
  type FieldDesc,
} from './codex/editFields';
export { valeurNeuveDe, variantesAChoisir } from './valeursNeuves';
export { type CheminsOfferts, type RefusDeValeur, type Segment } from './edition/formulaire';
export {
  atelierIdentifiable,
  categoriesDeLaFamille,
  compendium,
  deDeLAtelier,
  entreeMontree,
  entreesListees,
  facettesOffertes,
  formulaireDeLAtelier,
  ouvrirLeCompendium,
  renvoisDeLEntree,
  transactionDemandee,
  type GesteDuCompendium,
  type RefusDuCompendium,
  type SessionDuCompendium,
} from './codex/session';
export {
  CODEX_GROUPS,
  categoryByKey,
  cibleDuCodex,
  codexGroupLabel,
  type CodexItem,
  type CodexRow,
} from './codex/registry';
export { tokenizeLinks } from './codex/relations';
export {
  enregistrerEntree,
  isEditableCategory,
  supprimerEntree,
} from '../data/atelierDuCodex';
export { buildingsMeta } from './monde/buildings';
export { FACADE_APPEARANCE_IDS, apparencesDeLOuverture } from './monde/facades';
export { ciblesDAncreDeBataille } from './massBattleFlow';
export { allMusicDefs } from '../data/schemas/sons/musique';
export { BORNES_D_OUVERTURE, DEFAUTS_D_OUVERTURE, toitureEffective } from './sceneEdit';
export { ficheDEntite, nomDEntite } from './monde/sceneNpc';
export { libelleDuBord } from './monde/fireArc';
export { objetDuNarratif, objetsInstanciablesDuProjet, presetDuNarratif } from './monde/resolveursDuNarratif';
export { calquesAStocker, coinsDuCalque, planDuCalque, type CalquesStockes } from './edition/calque';
export { terrainIds, terrainLabel } from './monde/terrain';
export { crenellatedAt, tileAt, heightAt, idDuCorps, porteAuteur, reposDeScene, sceneMetresPerTile, secretAuteur } from './monde/scene';
export { isRoomZone } from './monde/rooms';
export { sceneZoneTiles } from './monde/zones';
export {
  capsDeLaPose,
  effectZoneRect,
  entiteDeLaSelection,
  ficheEditee,
  FACES_D_ARETE,
  ficheDePersonnage,
  fichesDePersonnage,
  libelleDeStructure,
  lumiereAllumee,
  poigneeDeLaSelection,
  sameSel,
  segmentDeLaSelection,
  selRect,
  apparencesCrenelables,
  structuresDeLArete,
  type Sel,
  type WallPaint,
  ZONE_VARIANTS,
} from './sceneEditLecture';
export { lumiereDeLaScene, type LumiereDeLaScene } from './lumiereDeLaScene';
export { effetsDeLAppel, vitrineDesEffets, zonesQuiDurentEnVue, type Effet, type VitrineDesEffets, type ZoneQuiDure } from './effetsDeLAppel';
export { cleDeLaVision, combattantEnVue, coquesEnVue, entiteConnue, nomEnVue, porteurEnVue, visionDuMonde, type VisionDuMonde } from './visionDuGroupe';
export { marquesDesEtats, type MarqueDEtat } from './marquesDesEtats';
export { musiqueDeLaPartie, type MusiqueDeLaPartie } from './musiqueDeLaPartie';
export { meteoDuRegard, type MeteoDuRegard } from './monde/meteo';
export { consequencesDeLEtape, faitsDeLEtape, jetsEnVue, type ConsequenceEnVue, type JetEnVue, type LigneDeJet } from './jetsEnVue';
export { tonDuFait } from './recapLine';
export { fenetreDAttaque, type FenetreDAttaque } from './fenetreDAttaque';
export { fenetreDIncantation, type FenetreDIncantation } from './fenetreDIncantation';
export { fenetreDuSoin } from './soin';
export { difficultyText } from './difficultyText';
export { fenetreDeDefense } from './fenetreDeDefense';
export { enTeteDuPorteur, ficheDuCombattant, ficheDuPorteur, type EntreeDeLaFiche, type FicheDuPorteur, type Renvoyable } from './ficheDuPorteur';
export { weaponStatParts } from '../engine/weaponStats';
export { gestesDeLObjet, gesteDeLaPanoplie, type GesteAChoix } from './gestesDeLObjet';
export { gesteDeSoins } from './medicFlow';
export { gesteDeDetermination, gesteDIncantation } from './combatSlice';
export { buildAdvancementView, type TalentDesigne } from './monde/advancement';
export { VERBE_DE_VALIDATION } from './validationDeFenetre';
export { carteEnVue, trajetsDepuis, type CarteEnVue, type LieuDuPlan, type PlanDeLaCarte, type TrajetEnVue } from './carteEnVue';
export { lieuEnVue } from './lieuEnVue';
export { marchandEnVue, type MarchandEnVue } from './marchandEnVue';
export { marcheEnVue, type MarcheEnVue } from './marcheEnVue';
export { voyageEnVue, type VoyageEnVue } from './voyageEnVue';
export { CADENCES_AU_CHOIX, DEFAULT_VOYAGE_ORDERS, cadenceAUnEffet } from './voyageCadence';
export { recitEnVue, type RecitEnVue } from './recitEnVue';
export { interludeEnVue, libelleDuDepot, type InterludeEnVue } from './interludeEnVue';
export { batailleEnVue } from './batailleEnVue';
export { reposEnVue, type ReposEnVue } from './reposEnVue';
export { TITRE_DE_LA_NUIT, gesteDuRepos, prixDeLOffre } from './restFlow';
export { gesteDeLaisserPasserLeTemps } from './horloge';
export { fenetreDuButin, REGLAGES_DU_BUTIN } from './fenetreDuButin';
export { fenetreDeDetermination } from './determinationDuJet';
export {
  libelleDuGeste,
  libelleDuReglage,
  libelleDuChoix,
  libelleDuParametre,
  libelleDuLitteral,
  libelleDeLaFenetre,
  libelleDuJet,
  libelleDeLaFermeture,
} from './libelles';
export { argumentsPosesDuGeste, fermeturesDeLaFenetre } from './verbesOuverts';
export { cleDuGeste, type GesteDuJeu } from './modalArbiter';
export { verbeDeJetDe, viseUneRangee, type FlowKey } from './flowVerbs';
export { FERMETURES_DITES } from './rollFlowFactory';
export { effetDuGeste, reglagesDesElements, type Reglage, type ValeurDuReglage } from './reglages';
export { declarationDuReglageNomme, REGLAGE_DE_L_AXE, VERBE_DE_REGLAGE } from './reglagesDuJet';
export { VERBE_DE_CHOIX, declarationDuChoixNomme, type AxeDuChoix, type FenetreAChoix } from './choixDesFenetres';
export { reglagesDesChoix, type CoutDeLaValeur } from './choixDeFenetre';
export { avecSigne } from '../engine/types';
export { MANIEMENTS, ROLES_D_ANIMATION, maniementDeLaForme, type RoleDAnimation } from './animation';
export type { VerrouDesMots } from './fabriquesDuNoyau';
export type { Maniement } from '../data/schemas/grammaire/valeurs';
export {
  lireLeRoster,
  ecrireLeRoster,
  idDeRosterDuHeros,
  rosterAvecLeHeros,
  rosterExport,
  rosterImport,
  type HerosDuRoster,
  type RosterEntry,
} from './persistance/roster';
export {
  engagement,
  herosDuRosterOfferts,
  intentionDEngagement,
  intentionDeRenvoi,
  pretiresOfferts,
  refusDEngagement,
  refusDUnNouveauHeros,
  type IntentionDEngagement,
} from './creation/engagement';
export { gesteDAchatDuSort, partieEnCours, refusDeLancer, refusDeRenvoyer } from './partyFlow';
export { buildHero, carrieresOffertes, especesOffertes, type CreatorDraft } from './creation/brouillon';
export {
  apresLeGeste,
  brouillonDeLaPartie,
  pagesDeCreation,
  refusDeLaPage,
  rubriquesDeLaPage,
  type GesteDuBrouillon,
  type PageDeCreation,
  type RubriqueDeCreation,
} from './creation/vueDeLaCreation';
export { lireLesRetraits, cumulerLesRetraits, nommerLesRetraits, type RetraitsDElagage } from './persistance/elagage';
export { poserLesReglesMaisonPersistees, reglesMaisonMutables, surchargerUneRegleMaison, retablirUneRegleMaison } from './reglesMaison';
export {
  PREFERENCES,
  preferenceDef,
  preferencesAPersister,
  poserLesPreferencesPersistees,
  valeurDEntree,
  type IdDePreference,
  type Preference,
  type PrefValue,
} from './preferences';
export {
  snapshotSave, metaDeSave, lireSave, exporterLaSauvegarde, chargerLaSave, refusDeSauvegarde, estUnPointDeReprise, pointDeRepriseAGarder,
  type SaveGame, type SaveMeta, type ObsoleteCause, type RefusDeSauvegarde, CAUSES_DE_REFUS_DE_SAVE,
} from './persistance/save';
export {
  aEcrire,
  campagneDUneEntree,
  entreesRelues,
  idDesignable,
  projetDUneEntree,
  type CampagneLancee,
  type EntreeListee,
  type SavedProject,
} from './persistance/bibliotheque';
export { ProjetRefuse, lieuDuGroupe, nomDuPoi, placeServices, type ProjectDoc } from './worldMap';
export { designeGaranti, rollLine } from './ligneDeJet';
export { refusDeConsommer } from './consumableFlow';
export { estOperation } from './acteDeSoin';
export type { DoctrineId } from './monde/ai';
export type { Catalogue } from '../data/schemas/catalogue/catalogue';
