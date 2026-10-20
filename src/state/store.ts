/**
 * Store central (Zustand) — relie l'UI React et le rendu (SVG iso).
 * Gère les écrans, le groupe, l'exploration de scène, les dialogues et le
 * combat tactique au tour par tour (règles via src/engine).
 */
import { create } from 'zustand';
import { Combatant } from '../engine/types';
import { extendedTestStep } from '../engine/tests';
import { unloadWeapon, setAmmoChoice } from '../engine/items';
import { coupleDIdentite } from '../noyau/monde/identites';
import { fixedJetOpen, markFixedDie } from '../noyau/fixedDieMark';
import { dissipateSpell } from '../engine/dispel';
import { battleRng, seedBattleRng } from '../noyau/battleRng';
import { facingToward, DIR8_DELTA, rotateDir8, type Dir8 } from '../noyau/monde/dir8';
import { footprintTiles, footprintN } from '../noyau/monde/footprint';
import { creerActionsDuCurseur, curseurPerime, screenStepDot, type CombatCursor, type ScreenDir } from './combatCursor';
import { applyShipCollision } from '../noyau/monde/shipCollision';
import { milieuDuVoyage } from '../engine/shipBuild';
import { estNavire } from '../engine/coque';
import { releaseSeatsOfDowned } from '../noyau/combatFlow';
// #2817 D2
import '../noyau/seaVoyageFlow';
import '../noyau/corruptionFlow';
import '../noyau/shipwreck';
import '../noyau/combatEffects';
import '../noyau/combatManeuvers';
import '../noyau/combat/roundHooks';
import '../noyau/combat/turnHooks';
import '../noyau/combat/triggeredTest';
import '../noyau/combat/hitModifiers';
import { reprendreTestSubi } from '../noyau/combat/triggeredTest';
import { removeEntity } from '../noyau/combatPlacement';
import { t } from '../i18n';
import type { Get, Set } from '../noyau/flowTypes';
import { planClimb } from '../noyau/monde/climbMove';
import { planFranchissement, metresRetenus, phaseDeChute, mouvementDeLaChute, mouvementDeLAllege } from '../noyau/fallMove';
import { gesteDepuis, porteurDExploration, refusDuTestDeChute, refusDeLaSuspension, REFUS_FRANCHISSEMENT } from '../noyau/gesteDArete';
import { refuserGeste } from '../noyau/refusVisible';
import { roomFocusAt } from '../noyau/monde/rooms';
import { fouilleDeLaPiece } from '../noyau/monde/decouvertePorteSecrete';
import { climbMovementCost } from '../engine/movement';
import { hasAutoClimb, hasClimbFullSpeed } from '../engine/traits/dispatch';
import { quorumAtteint, decidingSeat } from '../noyau/netOwnership';
import { viewYawDeg } from './stageYaw';
import { resetStagePan } from './stagePan';
import { resetStageGestes } from './stageGestes';
import { markActed } from '../noyau/combatFlow';
import { EMPTY_FLOW } from '../engine/flowCore';
import { moveEnv, findFreeTile } from '../noyau/monde/combatGeometry';
import { movementRemaining } from '../noyau/mount';

import * as interludeFlow from '../noyau/interludeFlow';
import * as favorFlow from '../noyau/favorFlow';
import * as netFlow from './netFlow';
import * as massBattleFlow from '../noyau/massBattleFlow';
import { snapshotSave, saveToSlot, readSlot, importSave, AUTO_SLOT, type SaveSlot, type AnySlot, type SaveGame } from './saves';
import { loadKeyOverrides, saveKeyOverrides } from './keybindingsPrefs';
import { resetFields } from '../noyau/stateFields';
import { captureMutation, applyMutation as applySceneMutation } from '../noyau/monde/sceneInstance';
import { assignSeat, memeCase, placesJouables, pruneSeatAssignments, RANG_MENEUR, releaseRecomposedRanks, releaseSeat, seatPoseOf, type SeatPose } from '../noyau/monde/seating';
import { actionsDe, actionsAuthorees, cleActionJouee, estCapacite, type CapaciteId } from '../noyau/monde/usable';
import { togglePin, marquerVus } from '../noyau/monde/clues';
import type { CodexFocus } from './codexFocus';

/** Onglets de la fiche de personnage (`CharacterSheet.tsx`) — id STABLE, jamais un libellé. */
export type SheetTab = 'etat' | 'possessions' | 'competences' | 'magie' | 'avancement' | 'histoire';

/** Charge une save (Jalon 5) : reset zéro-maintenance (état de création sans les actions — le
 *  JSON round-trip écarte les fonctions) + données de la save par-dessus, écran campagne.
 *  Le merge partiel de zustand préserve les actions du store. */
function applyLoadedSave(set: RemplacerLEtat, save: SaveGame): void {
  const base = JSON.parse(JSON.stringify(useGame.getInitialState())) as Partial<GameState>;
  const data = { ...(save.data as Partial<GameState>) };
  // La save chargée est TOUJOURS à `FORMAT_SAVE` (toute autre forme est jetée, `saves.ts`) :
  // `save.data` a donc la forme courante, sans remise à niveau à faire ici.
  // `net` : la SESSION coop courante prime sur celle figée dans la save (ne pas ressusciter un
  // salon mort, ne pas dissoudre un salon vivant — l'hôte peut charger une save en ligne).
  // ASSISE : la scène persistée peut porter des places dont le meuble, le slot ou le héros n'existent
  // plus dans CE snapshot (paquet de campagne édité, groupe recomposé) — élaguée AVANT d'entrer en
  // état, par la même source unique que la superposition de mutation.
  // Une scène qui n'a jamais porté d'assise n'en gagne pas le champ (même invariant que le seam
  // d'authoring `normaliseAssises`) : rien à élaguer, rien à écrire.
  const chargee = data.scene as Scene | null | undefined;
  const scene = chargee?.seatAssignments
    ? { ...chargee, seatAssignments: pruneSeatAssignments(chargee, (data.party ?? []).length) }
    : chargee;
  set({ ...base, ...data, ...(chargee ? { scene } : {}), screen: 'campaign', net: useGame.getState().net });
  set(reposerPaquetDeCampagne(data.campaignDoc as CampaignDoc | null | undefined));
  // Règles maison de la save : on les applique au registre (parité avec la partie sauvegardée).
  loadRuleOverrides(save.rules);
  bus.emit(EVT.SCENE_DIRTY);
}
import { ev } from '../noyau/combatLog';
import { rule, ruleOverrides, loadRuleOverrides } from '../engine/policy';
import { craftTestDRAdjust, hasQuality, isUnbreakable } from '../engine/qualities/dispatch';
import { campGain } from '../noyau/combat/advantagePool';
import { TIME_COST } from '../engine/timeCost';
import { outOfCombatUpkeep } from '../noyau/outOfCombatUpkeep';
import { checkPartyWiped } from '../noyau/partyWipe';
import { touchActors } from '../noyau/combatOrParty';
import { actorIn, capDuGroupe, ecrireActeur, estDebout, inBattleId, meneurDuMonde, poserCapDuGroupe } from '../noyau/monde/combatants';
import { fireOwnTestFailed } from '../noyau/triggeredEffects';
import { FLOWS, meetsRequiredSL, buildRollFlowActions } from '../noyau/rollFlowSpecs';
import { poserLaPlateforme, type Plateforme, type PlateformeDe } from '../noyau/plateforme';
import { scheduleCombatTimer, timerEnVol } from '../web/minuteries';
import { rosterUpdate } from './roster';
import { planifierLeTickAuto } from '../noyau/combatAuto';
import { gainCorruption, resolveCorruptionPending, releaseCorruptionSlot, testDExposition } from '../noyau/corruptionFlow';
import { testDeRegle } from '../engine/reglesChiffrees';
import * as partyFlow from '../noyau/partyFlow';
import * as possessionsFlow from '../noyau/possessionsFlow';
import { usePartyItem as usePartyConsumable } from '../noyau/consumableFlow';
import * as visionStateMod from '../noyau/visionState';
import * as merchantFlow from '../noyau/merchantFlow';
import * as tavernFlow from '../noyau/tavernFlow';
import type { PendingFall, DialogueTransition, Cloture } from '../noyau/pendings';
import { openEncounterPsych } from '../noyau/encounterPsychFlow';
import { toMoney } from '../engine/money';
import { postingTenu } from '../engine/activities';
import { payFromGroup } from '../noyau/bourseFlow';
import * as medicFlow from '../noyau/medicFlow';
import * as restFlow from '../noyau/restFlow';
import { councilPay as councilPayFlow, councilClose as councilCloseFlow } from '../noyau/shipCrew';
import { Scene, isWalkable, groupePosable, sceneMetresPerTile, heightAt, speakerEntity, startOf, type SceneEntity } from '../noyau/monde/scene';
import { recordTurn, type DialogueTurn } from '../noyau/monde/dialogueHistory';
import { ouvrirDialogue, conversationRepond, reponsesDuNoeud } from '../noyau/dialogue';
import { placeCombatant } from '../noyau/monde/spawn';
import { Pt, tileKey } from '../noyau/monde/path';
import { chebyshev } from '../engine/grid';
import { aPorteeDe, exploreStepDest, povStepDest, spawnFacing } from '../noyau/monde/exploreNav';
import { bus, EVT } from '../noyau/bus';
import { emptyNarratif } from '../noyau/monde/campaignNarratif';
import { snapshotChapitre } from '../noyau/chapitreRecap';
import { runDailyUpkeep, purgeSurAvanceDHorloge } from '../noyau/upkeep';
import type { DeferredUpkeepTest } from '../noyau/upkeep';
import * as travelFlow from '../noyau/travelFlow';
import * as billetFlow from '../noyau/billetFlow';
import { DEFAULT_VOYAGE_ORDERS } from '../noyau/voyageCadence';
import { appliquerLotEtal } from '../noyau/etalLotFlow';
import * as portFlow from '../noyau/portFlow';
import * as landMarketFlow from '../noyau/landMarketFlow';
import * as innFlow from '../noyau/innFlow';
import * as seaActivities from '../noyau/seaActivities';
import * as seaVoyageFlow from '../noyau/seaVoyageFlow';
import { applyLandCargoRaid } from '../noyau/carriers';
import { suspendActiveCascade, resumeSuspendedCascade, dropSceneEntrySteps, extendedTestOutcomeAppliers, curseurPose } from '../noyau/cascade';
import { confierLaSuite, jouerFlowEntier, nePeutPasDifferer, cloturer, registerCloture, flowRestant, effectTargets, openSkillTest, ouvrirChute, reprendreLaSuite, checkTriggers, fireScheduledEffects, applyEffects, applyEffectsLoot, runFlow, assignGearAt, harvestVictoryCreature, pushReveal } from '../noyau/combatEffects';
import { flowFromEffects } from '../noyau/monde/flow';
import { nightBands } from '../noyau/nightBands';
import { resultLine, openSequence, hostStep, idDansLaSequence, pousseSi } from '../noyau/rollSeam';
import { type BuiltCascadeStep } from '../noyau/stepBrand';
import { createCombatSlice } from '../noyau/combatSlice';
import { nomDEntite } from '../noyau/monde/sceneNpc';
import { presetPnjById } from './campaignData';
import { registerScene, reposerPaquetDeCampagne, sceneDuRegistre } from '../noyau/monde/registreDesScenes';
import { etatInitialDuJeu, type BattleState, type CampaignDoc, type Ecran, type Jeu } from '../noyau/etat';

export interface EtatDeLAdaptateur {
  /** Codex : entrée ciblée à l'ouverture (depuis un `CodexRef`, keyée par `id`), null = page d'accueil. */
  compendiumFocus: CodexFocus | null;
  /** Écran à restaurer en quittant le Codex plein écran (capturé depuis le menu). */
  compendiumReturn: Ecran;
  /** Drill-in d'une réf Codex EN JEU : fiche ouverte en MODALE par-dessus la partie (sans changer
   *  d'écran → musique et fiche perso intactes derrière). null = pas de modale. */
  codexOverlay: CodexFocus | null;
  /** Écran de gestion des Possessions du groupe (#762) : MODALE GLOBALE (montée une fois, par-dessus
   *  n'importe quel écran — campagne EN JEU comme roster) ; `uid` = possession pré-sélectionnée à
   *  l'ouverture (null = aucune). Même patron que `codexOverlay` (état store + montage unique). */
  possessionsScreen: { uid: string | null } | null;
  camRot: 0 | 1 | 2 | 3; // orientation caméra (cran de 90° horaire) — état de vue, non sérialisé
  camEdge: boolean; // cran impair : vue « de face » (edge-on, grille axis-alignée 3D) ; alterne avec le coin (losange) par ¼ de tour
  zoom: number; // zoom caméra du JEU (échelle), borné [1, 2.6] — état de vue, non sérialisé
  /** Projection de la carte (bascule) : 'iso' losange ou 'top' grille carrée — préférence de vue. */
  viewMode: 'iso' | 'top';
  /** Vue SUBJECTIVE (POV) active : l'exploration passe en cap-relatif (ZQSD = avance/recul/pas latéral,
   *  A/E = pivote le regard) au lieu du pas iso écran. Préférence de vue, préservée au reset de scène. */
  povActive: boolean;
  /** DEBUG (recette `__wfrp.labels`) : overlay d'annotation de la carte sur IsoStage — coordonnées par
   *  case (+`z{n}`), teinte par étage et pastilles de rôle de structure. false par défaut (zéro coût off). */
  debugLabels: boolean;
  /** DEBUG (recette `__wfrp.roofCut`) : lève-toit du monde volumique — dégagement de la pièce occupée
   *  (toits, façades et décors de toit retirés). true par défaut (comportement de jeu). */
  debugRoofCut: boolean;
  /** Décalage manuel de la caméra (caméra libre tactique) ; remis à zéro au refocus (changement de tour). */
  camPan: { x: number; y: number };
  /** RÉVÉLATION des utilisables (Alt maintenu, binding `decor.reveler`) : état de TOUCHE, jamais une
   *  préférence — il vaut ce que vaut la touche à l'instant, se rend au relâchement comme au `blur`
   *  (`relacherTout`), et n'entre dans aucune sauvegarde. */
  reveler: boolean;
  /** Entité dont on regarde la fiche (InspectPanel) — porté par le STORE pour que TOUTES les surfaces
   *  du geste d'inspection (jeton, portrait, touche) ouvrent le même panneau : un combattant en combat,
   *  un PNJ de scène hors combat. null = panneau fermé. */
  inspectId: string | null;
  /** Fiche de personnage OUVERTE (`CharacterSheet.tsx`) — héros courant, partagé entre les hôtes
   *  (CampaignView/PartyScreen) pour que le switch de héros survive à leurs remontages respectifs.
   *  null = fiche fermée. UI éphémère, non sérialisée (comme `inspectId`). */
  sheetId: string | null;
  /** Onglet courant de la fiche — persiste à travers fermeture/réouverture (dernier onglet consulté). */
  sheetTab: SheetTab | null;
  /** Position de scroll du corps d'onglet (`.sheet-tabbody`), par onglet — restaurée à l'affichage. */
  sheetScroll: Partial<Record<SheetTab, number>>;
  /** Empreinte (`alarmsFingerprint`) des alarmes DÉJÀ vues par héros — la règle d'atterrissage
   *  (`sheetAlarms.ts`) ne force l'onglet État qu'à la première ouverture depuis une alarme nouvelle.
   *  UI éphémère, non sérialisée (comme `sheetId`/`sheetTab`). */
  sheetAlarmsSeen: Record<string, string>;
  /** Combattant SURVOLÉ depuis un PORTRAIT (frise/dock) — pilote, à parité du survol du token,
   *  le réticule de visée sur la carte ET le « peek » caméra (recadrage temporaire). Local (jamais
   *  réseau), read-only : actif même hors de son tour. null = aucun survol de portrait. */
  hoverCombatantId: string | null;
  /** Curseur de combat CLAVIER/MANETTE : case visée (éventuellement aimantée à une cible). Il pilote le
   *  réticule comme un survol souris et se commet via battleClickEntity/Tile. null = aucune navigation
   *  clavier en cours (la souris a la main). Périmé par `curseurPerime`. */
  combatCursor: CombatCursor | null;
  /** Entité mise en évidence par le SURVOL — en combat le combattant (token carte OU portrait frise),
   *  qui pilote le miroir réciproque sur la frise ; hors combat le PNJ de scène à fiche sous le
   *  pointeur. Distinct de hoverCombatantId (frise/Tab → peek caméra). */
  hovered: string | null;
  /** Surcharges de touches du remap clavier (id de raccourci → event.code), persistées en
   *  localStorage ; lues par `useGameKeyboard` via `effectiveCodes`. */
  keyOverrides: Record<string, string>;
  /** Héros en cours de MODIFICATION dans le créateur (bouton « Modifier » d'un emplacement) :
   *  l'id du Combatant à mettre à jour EN PLACE ; null = création normale d'un nouveau héros. */
  editingHeroId: string | null;
  /** Menu système plein écran (pause) ouvert — commuté par Échap (binding `toggle-menu`) et le bouton ☰. */
  gameMenuOpen: boolean;
}

export interface ActionsDeLAdaptateur {
  /** Ouvre le Codex sur une entrée. Depuis le jeu (focus fourni) → modale ; depuis le menu (sans
   *  focus) → écran plein ; déjà ouvert → on s'y déplace en place. */
  openCodex: (focus?: CodexFocus) => void;
  /** Ferme la modale Codex (drill-in). */
  closeCodexOverlay: () => void;
  openPossessionsScreen: (uid?: string | null) => void;
  closePossessionsScreen: () => void;
  rotateCam: (dir: 1 | -1) => void;
  setZoom: (z: number) => void;
  toggleViewMode: () => void;
  togglePov: () => void;
  setCamPan: (x: number, y: number) => void;
  resetCamPan: () => void;
  setReveler: (v: boolean) => void;
  setInspectId: (id: string | null) => void;
  setSheetId: (id: string | null) => void;
  setSheetTab: (tab: SheetTab | null) => void;
  setSheetScroll: (tab: SheetTab, top: number) => void;
  setSheetAlarmsSeen: (heroId: string, fp: string) => void;
  setHoverCombatant: (id: string | null) => void;
  /** Déplace le curseur d'une case dans la direction ÉCRAN poussée (le curseur « suit les yeux »). */
  moveCursor: (dir: ScreenDir) => void;
  /** Aimante le curseur sur la cible valide suivante (+1) / précédente (-1) — Tab / gâchettes. */
  snapCursorToTarget: (step: 1 | -1) => void;
  /** Commet la case visée : attaque (ennemi) ou déplacement (case libre) ; un allié non actionnable ne commet rien. */
  commitCursor: () => void;
  /** Efface le curseur (la souris reprend la main, ou geste « annuler »). */
  clearCursor: () => void;
  setHovered: (id: string | null) => void;
  setKeyBinding: (id: string, code: string) => void;
  resetKeyBindings: () => void;

  setScreen: (s: Ecran) => void;
  setEditingHero: (id: string | null) => void;
  /** Crée une room sur le relay → code 6 chars dans `net.roomCode`. false = service injoignable. */
  netHostStart: (name: string) => Promise<boolean>;
  /** Rejoint une room par code. Résout null si connecté, sinon le message d'erreur à afficher. */
  netJoin: (code: string, name: string) => Promise<string | null>;
  netAssign: (heroId: string, seat: number) => void;
  /** Pose/retire le rôle MJ (bac-à-sable) : `seat` conduit les ennemis + le monde, `null` = IA. */
  setGmSeat: (seat: number | null) => void;
  /** Attribue un EMPLACEMENT (0-3) de l'écran d'équipe à un siège (hôte). */
  netAssignSlot: (slot: number, seat: number) => void;
  netLeave: () => void;
  /** Sauvegarde la partie dans un slot localStorage (Jalon 5). Refusée en combat. */
  saveGame: (slot: SaveSlot) => boolean;
  /** Auto-save silencieuse vers l'emplacement AUTO (checkpoint d'entrée de scène). Hors combat,
   *  jamais l'invité coop. Réutilise le même snapshot que `saveGame`. */
  autoSave: () => boolean;
  /** Charge un slot (manuel OU auto) : reset zéro-maintenance + données de la save (écran campagne). */
  loadGame: (slot: AnySlot) => boolean;
  /** Importe une save : `null` quand elle est appliquée, sinon la cause de son refus. */
  importGame: (json: string) => import('./saves').ObsoleteCause | null;
  /** Pas clavier d'exploration : déplace le groupe d'UNE surface voisine connectée dans la direction
   *  ÉCRAN poussée (flèches) — rampes/tabliers gérés par `exploreStepDest` (zéro ambiguïté de z). */
  stepPartyDir: (dir: ScreenDir) => void;
  setGameMenu: (open: boolean) => void;
}

export type GameState = Jeu & EtatDeLAdaptateur & ActionsDeLAdaptateur;
/** Le `set` brut du store, réservé au REMPLACEMENT de l'état ENTIER (sauvegarde chargée, snapshot de
 *  l'hôte), qui porte `journal` avec le reste (#2724). */
export type RemplacerLEtat = (etat: Partial<GameState>) => void;


/** Applique une avancée de dialogue (transition vers un nœud, ou clôture) — point UNIQUE partagé par
 *  `chooseDialogue` (cas sans Test) et `resolveTest` (reprise après un Test suspendu par `choice.flow`). */
function applyDialogueTransition(get: Get, set: Set, tr: DialogueTransition): void {
  if (tr === 'close') {
    if (get().dialogue) get().advanceTime(TIME_COST.dialogue); // clôture (no-op si un Effect a déjà fermé)
    set({ dialogue: null });
    return;
  }
  set({ dialogue: tr });
}

/**
 * Atterrissage d'une chute VOLONTAIRE (LDB 15 l.82 ; EDO 01 l.231) : chaque TOMBANT subit SA hauteur —
 * chute pleine (`metresRetenus`) sans Test, `effectiveMetres` du Test sinon ; à 0 m ou moins, AUCUN Dégât
 * (bypass EXPLICITE : `applyFall(c,0,rng)` ne garantit PAS 0 dégât seul, cf. son d10). Le Test TENTÉ
 * consomme l'Action (LDB 13 l.86-88, patron `climbAcross` « surface »). Exploration : le PAS du groupe
 * (`moveParty`, ses déclencheurs) d'abord, puis une chute par tombant ; combat : le seul tombant.
 */
function settleFall(get: Get, set: Set, p: PendingFall): void {
  const { scene, mode, battle } = get();
  set({ pendingFall: null });
  if (!scene) return;
  const pool = mode === 'battle' ? (battle?.combatants ?? []) : get().party;
  const chutes = p.participants.flatMap((part) => {
    const c = pool.find((x) => x.id === part.id);
    const m = part.attempt ? part.result?.effectiveMetres : metresRetenus(p, part);
    return c && m !== undefined ? [{ c, m: Math.max(0, m) }] : [];
  });
  // Le tour se solde À LA TENTATIVE (LDB 13 l.86-88 : c'est le Test tenté qui consomme l'Action), donc
  // AVANT l'atterrissage : ce coût ne dépend pas de ce que dira le 1d10 de chute (#1508). Combat : le
  // seul tombant est l'initiateur, son Mouvement est `mouvementDeLaChute`.
  const initiateur = p.participants.find((x) => x.id === p.initiateurId);
  soldeDeLAction(get, set, p.participants.some((x) => x.attempt === true), mouvementDeLaChute(p, initiateur?.suspendre === true, sceneMetresPerTile(scene)));
  if (mode === 'battle') {
    for (const { c, m } of chutes) {
      if (m > 0) jouerFlowEntier(applyEffects(get, set, [{ type: 'fall', target: 'hero', heroId: c.id, metres: m, to: p.to }]));
      else { placeCombatant(c, scene, p.to); get().log(t('fall.jumpSafe', { name: c.label })); }
    }
    return;
  }
  get().moveParty({ ...p.to });
  // Les 1d10 de TOUS les tombants s'ouvrent ENSEMBLE (`ouvrirChute`, patron de l'Effet `fall` à plusieurs
  // cibles et de `collapseStructure`) : la séquence compte d'emblée chaque dé de la chute.
  for (const { c, m } of chutes) {
    if (m > 0) {
      get().log(t('eff.fallOuverte', { m, noms: c.label }));
      ouvrirChute(set, c, m);
    } else get().log(t('fall.jumpSafe', { name: c.label }));
  }
}

/** Les TOMBANTS d'une chute volontaire : combat = l'actif seul ; exploration = le groupe
 *  (`effectTargets('party')`), l'initiateur en tête. */
function tombantsDe(get: Get, battle: BattleState | null, initiateur: Combatant): Combatant[] {
  if (battle) return [initiateur];
  const groupe = effectTargets(get, 'party');
  return [initiateur, ...groupe.filter((c) => c.id !== initiateur.id)];
}

/** La case d'arrivée d'un franchissement (`planFranchissement`) est-elle interdite au mobile en combat ?
 *  Transit bloqué OU arrêt interdit — les deux ensembles du `MoveEnv` (on ne finit jamais sur une autre
 *  créature, `combatGeometry.ts:cannotStopOn`). */
function arriveeOccupee(battle: BattleState, mover: Combatant, to: Pt): boolean {
  const env = moveEnv(battle, mover);
  const k = tileKey(to.x, to.y, to.z ?? 0);
  return env.blocked.has(k) || !!env.noStop?.has(k);
}

/** SOLDE de l'Action/du Mouvement d'un tour à la tentative de saut (`settleFall`) — nommé pour être
 *  joué AVANT l'atterrissage, là où il ne dépend d'aucun dé (LDB 13 l.86-88). `mouvement` = cases
 *  dépensées (`mouvementDeLaChute`). */
function soldeDeLAction(get: Get, set: Set, actionSpent: boolean, mouvement: number): void {
  const bB = get().battle;
  if (get().mode === 'battle' && bB) {
    set({ battle: { ...bB, acted: actionSpent ? true : bB.acted, action: null, movementUsed: (bB.movementUsed ?? 0) + mouvement, movedPreAction: bB.movedPreAction || !bB.acted, reachable: new Map(), preview: null } });
  }
  bus.emit(EVT.SCENE_DIRTY);
}

// ── CLÔTURES du store (#1508) : les verbes que ses sites jouent APRÈS leur Flow, en donnée. Chacun
//    est enregistré ICI, au patron `cascadeAppliers` — la donnée voyage (sauvegarde, réseau), le code reste.
registerCloture('avancerHorloge', (get, _set, c) => get().advanceTime(c.minutes));
registerCloture('retirerEntite', (get, set, c) => removeEntity(get, set, c.entityId));
registerCloture('marquerActionJouee', (_get, set, c) => set((s) => ({ flags: { ...s.flags, [cleActionJouee(c.entityId, c.actionId)]: true } })));
/** AVANCÉE du dialogue — verbe de CLÔTURE (#1508). Une modale de jet ENCORE ouverte (un Test que la
 *  suite vient d'ouvrir) reprend la transition à son compte : « le dialogue n'avance jamais sous une
 *  modale de jet » vaut du Test comme du dé — le dé, lui, est tenu par la mécanique de continuation
 *  (une clôture ne se joue qu'à la validation de la DERNIÈRE étape de la grappe). */
registerCloture('dialogueSuivant', (get, set, c) => {
  const pt = get().pendingTest;
  if (pt) { set({ pendingTest: { ...pt, dialogueNext: c.transition } }); return; }
  applyDialogueTransition(get, set, c.transition);
});
/** SEAM `onOwnTestFailed` d'un Test RATÉ — verbe de CLÔTURE (#1508) : il APPLIQUE des ops (Crampes
 *  abdominales → Sonné/À Terre par paliers de DR, MSRC 16 l.152), donc il attend le dé comme le reste. */
registerCloture('testRateDeLActeur', (get, set, c) => {
  const cascadeSet = !get().pendingCascade && !get().pendingTest ? set : undefined;
  const fired = fireOwnTestFailed(get, c.actorId, { sl: c.sl, rng: battleRng(), set: cascadeSet });
  if (fired.length) fired.forEach((l) => get().log(l));
  set({ ...touchActors(get()) });
});
registerCloture('teardownDeVictoire', (get, set, c) => {
  if (c.batailleDeMasse) massBattleFlow.massBattleResumeCombat(get, set, c.kills);
  // Teardown de combat (couture UNIVERSELLE, noyau/cascade.ts) : résume la cascade SUSPENDUE (ex. le
  // reste d'une journée de voyage interrompue par un abordage) — APRÈS l'écran de victoire, jamais devant.
  resumeSuspendedCascade(get, set);
});

/**
 * EXÉCUTEURS des capacités d'instance (#1687) — table TOTALE keyée par le MÊME `CapaciteId` que
 * `CAPACITES` (`noyau/monde/usable.ts`) : une capacité N+1 ne compile pas sans son OFFRE *et* son
 * exécuteur, et il n'existe pas de `if (actionId === …)` pour en ajouter une.
 */
const JOUER_CAPACITE: Readonly<Record<CapaciteId, (get: Get, set: Set, ent: SceneEntity, scene: Scene) => void>> = {
  parler: (get, set, ent, scene) => {
    const dlg = scene.dialogues.find((d) => d.id === ent.dialogueId);
    if (dlg) set({ dialogue: ouvrirDialogue(get(), dlg, ent.id) });
  },
  commercer: (get, _set, ent) => get().openMerchant(ent.id),
};

/** Places JOUABLES d'une entité : la géométrie vit sur le TYPE de décor, donc seule une instance de
 *  décor en porte (`placesJouables`, `noyau/monde/seating.ts`). */
function placesDe(scene: Scene, entityId: string) {
  const ent = scene.entities.find((e) => e.id === entityId);
  return ent?.kind === 'prop' ? placesJouables(scene, entityId) : [];
}

/** Le meneur occupe-t-il CE meuble ? Alors il s'en relève, et le dit. Rend `true` s'il s'est levé —
 *  c'est la bascule du même intent, prioritaire sur toute autre affordance du meuble. */
function seLeverDe(get: Get, set: Set, entityId: string): boolean {
  const { scene } = get();
  if (!scene || !meneurDuMonde(get())) return false;
  const occupant = { kind: 'party', rang: RANG_MENEUR } as const;
  if (!placesDe(scene, entityId).length) return false;
  if (seatPoseOf(scene, occupant)?.propId !== entityId) return false;
  set({ scene: releaseSeat(scene, occupant) });
  get().log(t('seating.stood'));
  bus.emit(EVT.SCENE_DIRTY);
  return true;
}

/** Le meneur prend place à CE meuble, ou lit la raison française du refus. SOURCE UNIQUE du geste
 *  d'assise : `interactEntity` l'ordonne parmi les autres affordances, `jouerAction` le joue NU
 *  quand le joueur a choisi l'offre `sasseoir`. */
function sasseoirA(get: Get, set: Set, entityId: string): void {
  const { scene, partyPos } = get();
  const leaderId = meneurDuMonde(get())?.id;
  if (!scene || !leaderId) return;
  const places = placesDe(scene, entityId);
  if (!places.length) return;
  const occupant = { kind: 'party', rang: RANG_MENEUR } as const;
  const libres = places.filter((p) => !scene.seatAssignments?.[entityId]?.[p.slotId]);
  const cible = libres.find((p) => memeCase(p.approach, partyPos));
  if (cible) {
    // REVALIDATION ATOMIQUE dans le callback `set` : entre le choix de la place ci-dessus et
    // l'écriture, un autre siège coop a pu prendre la dernière — un seul gagnant en sort. La place
    // ET son abord y sont RE-RÉSOLUS sur l'état courant : l'abord lu au clic peut avoir bougé (un
    // décor posé sur la case déclarée bascule la place sur son repli).
    const gagnee: { pose: SeatPose | null } = { pose: null };
    set((s) => {
      if (!s.scene || meneurDuMonde(s)?.id !== leaderId) return {};
      const place = placesJouables(s.scene, entityId).find((p) => p.slotId === cible.slotId);
      if (!place || !memeCase(s.partyPos, place.approach)) return {};
      const res = assignSeat(s.scene, entityId, place.slotId, occupant, s.party.length);
      if (!res.ok) return {};
      gagnee.pose = res.pose;
      return { scene: res.scene };
    });
    if (gagnee.pose) {
      get().log(t('seating.sat'));
      // POSE UNIQUE : le cap du GROUPE suit celui de la place — le corps, la vue subjective et tout
      // ce qui lit le regard d'exploration regardent la table, pas la direction d'où l'on venait.
      set((s) => ({ facing: poserCapDuGroupe(s.facing, gagnee.pose!.facing) }));
      bus.emit(EVT.SCENE_DIRTY);
      return;
    }
  }
  // UN SEUL message par situation : la place visée est partie (course perdue) ou toutes sont
  // prises → « occupé » ; il en reste une, mais pas sous les pieds → « rejoindre la place ».
  const resteLibre = places.some((p) => !get().scene?.seatAssignments?.[entityId]?.[p.slotId]);
  get().log(t(resteLibre ? 'seating.mustReachApproach' : 'seating.occupied'));
}

export const useGame = create<GameState>((set, get) => ({
  ...createCombatSlice(get, set),
  ...creerActionsDuCurseur(get, set),
  ...etatInitialDuJeu(),
  zoom: 1,
  povActive: false,
  camRot: 0,
  camEdge: false, // vue de COIN (losange) : le SEUL régime du chemin joueur ; la vue de face (+45°) reste une géométrie servie à la caméra libre DEV
  // QUATRE crans (90°, les vues diagonales — #1289) : le chemin joueur saute les états de face, donc
  // `camEdge` en ressort toujours faux.
  camPan: { x: 0, y: 0 },
  viewMode: 'iso',
  debugLabels: false,
  debugRoofCut: true,
  reveler: false,
  inspectId: null,
  sheetId: null,
  sheetTab: null,
  sheetScroll: {},
  sheetAlarmsSeen: {},
  hoverCombatantId: null,
  hovered: null,
  keyOverrides: loadKeyOverrides(),
  editingHeroId: null,
  gameMenuOpen: false,
  codexOverlay: null,
  compendiumFocus: null,
  compendiumReturn: 'menu',
  possessionsScreen: null,
  combatCursor: null,
  rotateCam: (dir) => {
    // Re-centre sur le point focal à chaque cran : sinon le décalage manuel (camPan) persiste à
    // travers le changement de projection (coin↔face, origines très différentes) → vue « téléportée ».
    // Le décalage VIVANT tombe avec lui (`resetStagePan`) : c'est lui que la frame lit, et un geste
    // en cours doit se recaler dessus au lieu de le contredire.
    resetStagePan();
    set((s) => ({ camEdge: false, camRot: (((s.camRot + (dir === 1 ? 1 : 3)) % 4) as 0 | 1 | 2 | 3), camPan: { x: 0, y: 0 } }));
  },
  faceToward: (id, from, to) => {
    if (!from || !to) return;
    set((s) => ({ facing: { ...s.facing, [id]: facingToward(from, to) } }));
  },
  faceFromPath: (id, path) => {
    if (!path || path.length < 2) return;
    get().faceToward(id, path[0], path[path.length - 1]);
  },
  // Orientation à l'entrée en combat : valeur authored (entité de scène) sinon vers l'ennemi le plus proche.
  faceAtCombatStart: () => {
    const { battle, scene, facing } = get();
    if (!battle) return;
    const next: Record<string, Dir8> = { ...facing };
    for (const c of battle.combatants) {
      if (!c.pos) continue;
      const authored = scene?.entities.find((e) => e.id === c.id)?.facing;
      if (authored) { next[c.id] = authored; continue; }
      const foes = battle.combatants.filter((o) => o.pos && (o.kind === 'hero') !== (c.kind === 'hero'));
      let best: Pt | undefined;
      let bd = Infinity;
      for (const o of foes) {
        const d = chebyshev(o.pos!, c.pos);
        if (d < bd) { bd = d; best = o.pos!; }
      }
      if (best) next[c.id] = facingToward(c.pos, best);
    }
    set({ facing: next });
  },
  shipTurn: (shipId, turnSteps) => {
    const { facing, battle } = get();
    const cur = facing[shipId];
    if (!cur) return; // navire sans cap initial → rien à virer
    const next = rotateDir8(cur, turnSteps);
    set({ facing: { ...facing, [shipId]: next } });
    // Re-mappe TOUS les arcs de bordée d'un coup : firedAttackBlock / targeting relisent facing[shipId].
    const ship = inBattleId(battle, shipId);
    get().log(t('store.shipTack', { ship: ship?.label ?? shipId, dir: next }));
    bus.emit(EVT.SCENE_DIRTY);
  },
  shipAdvance: (shipId, cases) => {
    const { facing, battle, scene } = get();
    const dir = facing[shipId];
    const hull = inBattleId(battle, shipId);
    if (!battle || !hull?.pos || !dir) return 0;
    const d = DIR8_DELTA[dir];
    const w = scene?.dimensions.w ?? Infinity, h = scene?.dimensions.h ?? Infinity;
    // Autres NAVIRES percutables (≠ self, pos connue) : une tuile occupée par un navire arrête l'avance ADJACENT
    // (pas de chevauchement) et déclenche la collision (MDG 13 l.423-465).
    const otherHulls = battle.combatants.filter((c) => c.id !== shipId && estNavire(c) && c.pos);
    const hullAt = (x: number, y: number) => otherHulls.find((c) => footprintTiles(c.pos!, footprintN(c)).some((t) => t.x === x && t.y === y));
    // Avance PAS-À-PAS le long du cap (coque 1×1) : on s'arrête au dernier pas libre — sortie de scène OU coque devant.
    let moved = 0;
    let victim: Combatant | undefined;
    for (let step = 1; step <= Math.max(0, cases); step++) {
      const nx = hull.pos.x + d.gx * step, ny = hull.pos.y + d.gy * step;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) break; // hors bornes de scène
      const hit = hullAt(nx, ny);
      if (hit) { victim = hit; break; } // coque devant → stop adjacent (moved = step − 1)
      moved = step;
    }
    if (moved > 0) {
      const delta = { x: d.gx * moved, y: d.gy * moved };
      // Coque + équipage À BORD translatés du MÊME delta (formation rigide) ; les postes (sans `pos`) suivent la
      // coque. MÊME patron de commit que le mouvement de combat (combatSlice : ANIM_MOVE).
      const movers = [hull, ...(hull.crewIds ?? [])
        .map((id) => inBattleId(battle, id))
        .filter((c): c is Combatant => !!c?.pos)];
      for (const m of movers) {
        const from = { ...m.pos! };
        placeCombatant(m, scene, { x: from.x + delta.x, y: from.y + delta.y });
        bus.emit(EVT.ANIM_MOVE, { id: m.id, path: [from, { ...m.pos }] });
      }
      get().log(t('store.shipAdvance', { ship: hull.label, n: moved, s: moved > 1 ? 's' : '', dir }));
    }
    // Éperonnage (MDG 13) : on percute de la PROUE (avance vers l'avant) ; FRONTAL si la victime tient un cap
    // ~opposé (octant opposé ±1). Dégâts sur les DEUX coques par la langue unique (`applyShipCollision`→`applyOps`).
    if (victim) {
      const opp = rotateDir8(dir, 4);
      const vf = facing[victim.id];
      const frontal = vf === opp || vf === rotateDir8(opp, 1) || vf === rotateDir8(opp, -1);
      for (const line of applyShipCollision(hull, victim, milieuDuVoyage(get().travelPlan), { ramProue: true, frontal }).lines) get().log(line);
    }
    if (moved > 0 || victim) { set({ battle: { ...battle } }); bus.emit(EVT.SCENE_DIRTY); }
    return moved;
  },
  setZoom: (z) => set({ zoom: Math.min(2.6, Math.max(0.4, z)) }), // floor 0.4 : dézoom tactique large
  toggleViewMode: () => set((s) => ({ viewMode: s.viewMode === 'iso' ? 'top' : 'iso' })),
  togglePov: () => set((s) => ({ povActive: !s.povActive })),
  // ABSOLU, jamais relatif : le geste qui l'écrit vit hors de React (`state/stagePan`) et commet SA
  // valeur au relâchement. Un incrément appliqué à un `camPan` qu'un recentrage a remis à zéro entre
  // temps ferait sauter la vue de tout le glissement déjà parcouru.
  setCamPan: (x, y) => set((s) => (s.camPan.x === x && s.camPan.y === y ? {} : { camPan: { x, y } })),
  // RECENTRAGE : il porte sur le décalage VIVANT (celui que la frame lit) autant que sur le commis —
  // un glisser en cours n'a encore rien commis, et sans cette remise à zéro le geste avalerait le
  // recentrage que le joueur vient de demander (touche de recentrage, nouvelle unité active).
  resetCamPan: () => {
    resetStagePan();
    set((s) => (s.camPan.x === 0 && s.camPan.y === 0 ? {} : { camPan: { x: 0, y: 0 } }));
  },
  setReveler: (v) => set((s) => (s.reveler === v ? {} : { reveler: v })),
  setInspectId: (id) => set((s) => (s.inspectId === id ? {} : { inspectId: id })),
  setSheetId: (id) => set((s) => (s.sheetId === id ? {} : { sheetId: id })),
  setSheetTab: (tab) => set((s) => (s.sheetTab === tab ? {} : { sheetTab: tab })),
  setSheetScroll: (tab, top) => set((s) => (s.sheetScroll[tab] === top ? {} : { sheetScroll: { ...s.sheetScroll, [tab]: top } })),
  setSheetAlarmsSeen: (heroId, fp) => set((s) => (s.sheetAlarmsSeen[heroId] === fp ? {} : { sheetAlarmsSeen: { ...s.sheetAlarmsSeen, [heroId]: fp } })),
  setHoverCombatant: (id) => set((s) => (s.hoverCombatantId === id ? {} : { hoverCombatantId: id })),
  setHovered: (id) => set((s) => (s.hovered === id ? {} : { hovered: id })),
  setKeyBinding: (id, code) => set((s) => { const o = { ...s.keyOverrides, [id]: code }; saveKeyOverrides(o); return { keyOverrides: o }; }),
  resetKeyBindings: () => { saveKeyOverrides({}); set({ keyOverrides: {} }); },
  // Cadre de campagne et COOP (#717) : ces trois gestes vivent chez l'HÔTE (classe `hôte`,
  // `state/intents.ts` `CLASSE_DES_ACTIONS`). Chez un invité ils sont INERTES — sans cette
  // garde le clic muterait l'état LOCAL puis mourrait au snapshot suivant de l'hôte, sans message.
  // L'écran, lui, reste visible : il porte son refus par `GatedAction` (patron `store.ts:1943`).
  acquitterOuverture: () => set((s) => (s.net.mode === 'guest' ? {} : { pendingOuverture: null, chapitreDepuis: snapshotChapitre(s.party, s.gameTime) })),
  cloreChapitre: () => set((s) => (s.net.mode === 'guest' ? {} : { pendingChapterRecap: null, objectifsSoldes: [], chapitreDepuis: snapshotChapitre(s.party, s.gameTime), clotureConsommee: true })),
  ajournerChapterRecap: () => set((s) => (s.net.mode === 'guest' ? {} : { pendingChapterRecap: null })),
  toggleCluePin: (indiceId) => set((s) => ({ clues: togglePin(s.clues, indiceId) })),
  /** NOUVEAUTÉ VUE, MARQUÉE PAR SON SIÈGE : le siège vient de `decidingSeat` (le siège agissant quand
   *  l'hôte applique l'intent d'un invité, sinon le siège local), jamais d'un argument — un siège ne
   *  marque vu que pour lui-même. */
  markCluesSeen: (affichés) => {
    const s = get();
    const clues = marquerVus(s.clues, affichés, decidingSeat(s));
    if (clues !== s.clues) set({ clues });
  },
  markExplored: (keys) => visionStateMod.recordExplored(get, set, keys),

  setScreen: (s) => set({ screen: s }),
  setEditingHero: (id) => set({ editingHeroId: id }),
  openCodex: (focus) =>
    set((st) => {
      // Déjà sur l'écran Codex (parcours plein écran) : on se déplace sur l'entrée en place.
      if (st.screen === 'compendium') return { compendiumFocus: focus ?? null };
      // Déjà dans la modale Codex : une cross-réf plonge DANS la modale (pas de nouvel écran).
      if (st.codexOverlay) return { codexOverlay: focus ?? st.codexOverlay };
      // Drill-in depuis le jeu (réf cliquée) : modale focalisée — écran, musique et fiche intacts.
      if (focus) return { codexOverlay: focus };
      // Parcours complet (depuis le menu) : écran plein, retour à l'écran courant.
      return { screen: 'compendium', compendiumFocus: null, compendiumReturn: st.screen };
    }),
  closeCodexOverlay: () => set({ codexOverlay: null }),
  openPossessionsScreen: (uid) => set({ possessionsScreen: { uid: uid ?? null } }),
  closePossessionsScreen: () => set({ possessionsScreen: null }),
  setPendingCampaign: (pc) => set({ pendingCampaign: pc }),

  // ── Entre deux aventures (LDB 22-23, Jalon 5) ──
  startInterlude: (weeks) => interludeFlow.startInterlude(get, set, weeks),
  interludeEnd: () => interludeFlow.interludeEnd(get, set),
  // Longues Séances de Jeu (LDB 17 l.47) : réutilise l'Effet `restoreFortune` (NE DUPLIQUE PAS la
  // logique — même case que le début de session, qui appelle `engine/fortune.restoreFortune`).
  // Corps de BLOC, retour CONSOMMÉ (#1508) : une flèche à corps expression typée `() => void` avale le
  // signal en silence. `restoreFortune` est une donnée LITTÉRALE sans canal de dés — d'où le fail-fast.
  restoreFortuneNow: () => { nePeutPasDifferer(applyEffects(get, set, [{ type: 'restoreFortune' }]), 'store.restoreFortuneNow'); },
  // TOUS les délégués de jet (mono+multi, 36 flux) en UN spread — dérivés de FLOW_WIRING (fin des 40 spreads épars).
  ...buildRollFlowActions(get, set),
  activityCancel: () => FLOWS.activity.cancel(get, set),
  activityConfirm: () => interludeFlow.confirmActivity(get, set),
  // Combat de masse / Puissance de Bataille (ADE II 08) — flux d'orchestration + jet de PJ différé.
  startMassBattle: (spec) => massBattleFlow.startMassBattle(get, set, spec),
  massBattleBegin: () => massBattleFlow.massBattleBegin(get, set),
  massBattleActivity: (activityId) => massBattleFlow.openMassBattleActivity(get, set, activityId),
  massBattleScene: (sceneId) => massBattleFlow.openMassBattleScene(get, set, sceneId),
  setMassBattleHero: (actionId, heroIds) => massBattleFlow.setMassBattleHero(get, set, actionId, heroIds),
  massBattleRally: () => massBattleFlow.openMassBattleRally(get, set),
  massBattleHazard: (roll) => massBattleFlow.massBattleSetHazard(get, set, roll),
  massBattleClash: () => massBattleFlow.massBattleClash(get, set),
  massBattleAdvance: () => massBattleFlow.massBattleAdvance(get, set),
  endMassBattle: () => massBattleFlow.endMassBattle(get, set),
  interludeCraftStart: (heroId, trapping, atouts, defauts) => interludeFlow.craftStart(get, set, heroId, trapping, atouts, defauts),
  interludeBank: (heroId, kind, amountBrass, rate) => interludeFlow.bankDeposit(get, set, heroId, kind, amountBrass, rate),
  interludeWithdraw: (index) => interludeFlow.bankWithdraw(get, set, index),
  interludeOrder: (heroId, trapping) => interludeFlow.orderItem(get, set, heroId, trapping),
  interludeEntrainement: (heroId, kind, id, spec) => interludeFlow.entrainementStart(get, set, heroId, kind, id, spec),
  interludeActivity: (heroId, activityId, opts) => interludeFlow.openCatalogActivity(get, set, heroId, activityId, opts),
  favorGrant: (heroId, level, owedTo, desc) => favorFlow.grantFavor(get, set, heroId, level, owedTo, desc),
  favorSettle: (heroId, favorId) => favorFlow.settleFavorActivity(get, set, heroId, favorId),
  favorBreak: (heroId, favorId) => favorFlow.breakFavor(get, set, heroId, favorId),

  netHostStart: (name) => netFlow.netHostStart(get, set, name),
  netJoin: (code, name) => netFlow.netJoin(get, set, (data) => netFlow.applyNetSnapshot(set, data), code, name),
  netAssign: (heroId, seat) => netFlow.netAssign(get, set, heroId, seat),
  setGmSeat: (seat) => netFlow.setGmSeat(get, set, seat),
  netAssignSlot: (slot, seat) => netFlow.netAssignSlot(get, set, slot, seat),
  netLeave: () => netFlow.netLeave(get, set),
  partyAddHero: (hero, wealth, seat) => partyFlow.partyAddHero(get, set, hero, wealth, seat),
  partyRemoveHero: (heroId) => partyFlow.partyRemoveHero(get, set, heroId),
  partyReplaceHero: (oldId, hero, seat) => partyFlow.partyReplaceHero(get, set, oldId, hero, seat),

  // ── Possessions (#615) : délégué à possessionsFlow ───
  addPossession: (p) => possessionsFlow.addPossession(get, set, p),
  renamePossession: (uid, label) => possessionsFlow.renamePossession(get, set, uid, label),
  transferPossession: (uid, newOwnerId) => possessionsFlow.transferPossession(get, set, uid, newOwnerId),
  stablePossession: (uid, placeId) => possessionsFlow.stablePossession(get, set, uid, placeId),
  retrievePossession: (uid) => possessionsFlow.retrievePossession(get, set, uid),
  embark: (uid, hostUid) => possessionsFlow.embark(get, set, uid, hostUid),
  disembark: (uid) => possessionsFlow.disembark(get, set, uid),
  abandonPossession: (uid) => possessionsFlow.abandonPossession(get, set, uid),
  learnPossessionTrait: (uid, traitId) => possessionsFlow.learnPossessionTrait(get, set, uid, traitId),

  // ── Sauvegarde / chargement (Jalon 5) — snapshot zéro-maintenance, hors combat ──
  saveGame: (slot) => {
    const s = get();
    if (s.battle) {
      get().log(t('store.saveInBattle'));
      return false;
    }
    const save = snapshotSave(s as unknown as Record<string, unknown>, useGame.getInitialState() as unknown as Record<string, unknown>, new Date().toISOString(), ruleOverrides());
    const ok = saveToSlot(slot, save);
    get().log(ok ? t('store.saveOk', { slot }) : t('store.saveKo'));
    return ok;
  },
  autoSave: () => {
    const s = get();
    if (s.battle || s.net.mode === 'guest') return false; // hors combat ; jamais l'invité (la save vit chez l'hôte)
    const save = snapshotSave(s as unknown as Record<string, unknown>, useGame.getInitialState() as unknown as Record<string, unknown>, new Date().toISOString(), ruleOverrides());
    return saveToSlot(AUTO_SLOT, save);
  },
  loadGame: (slot) => {
    const save = readSlot(slot);
    if (!save) return false;
    applyLoadedSave(set, save);
    return true;
  },
  importGame: (json) => {
    const save = importSave(json);
    if (typeof save === 'string') return save;
    applyLoadedSave(set, save);
    return null;
  },

  // ── Actions GROUPE (équipement / avancement) : déléguées à partyFlow ──
  toggleEquip: (heroId, uid) => partyFlow.toggleEquip(get, set, heroId, uid),
  stowItem: (heroId, uid, containerUid) => partyFlow.stowItem(get, set, heroId, uid, containerUid),
  createLoadout: (heroId) => partyFlow.createLoadout(get, set, heroId),
  deleteLoadout: (heroId, id) => partyFlow.deleteLoadout(get, set, heroId, id),
  setActiveLoadout: (heroId, id) => partyFlow.setActiveLoadout(get, set, heroId, id),
  setLoadoutSlot: (heroId, id, slot, uid) => partyFlow.setLoadoutSlot(get, set, heroId, id, slot, uid),
  transferItem: (uid, fromHeroId, toHeroId) => partyFlow.transferItem(get, set, uid, fromHeroId, toHeroId),
  setItemSkin: (heroId, uid, patch) => partyFlow.setItemSkin(get, set, heroId, uid, patch),
  choisirForme: (heroId, uid, forme) => partyFlow.choisirForme(get, set, heroId, uid, forme),
  grantXp: (heroId, amount) => partyFlow.grantXp(get, set, heroId, amount),
  buyCharAdvance: (heroId, char) => partyFlow.buyCharAdvance(get, set, heroId, char),
  buySkillAdvance: (heroId, skillId, spec) => partyFlow.buySkillAdvance(get, set, heroId, skillId, spec),
  buyTalent: (heroId, talentId, spec) => partyFlow.buyTalent(get, set, heroId, talentId, spec),
  designateCareerSlot: (heroId, slotKey, optionId, spec) => partyFlow.designateCareerSlot(get, set, heroId, slotKey, optionId, spec),
  /** Mémorise un sort (PX selon le Talent, LDB 46/10) ; un sort du Chaos corrompt (+1, seuil → mutation). */
  buySpell: (heroId, spellId) => {
    const r = partyFlow.buySpell(get, set, heroId, spellId);
    if (r.ok && r.chaos) {
      const hero = actorIn(get(), heroId);
      if (hero) {
        for (const l of gainCorruption(get, set, hero, 1)) get().log(l);
        set(touchActors(get()));
      }
    }
  },
  buySpellComponent: (heroId, spellId) => partyFlow.buySpellComponent(get, set, heroId, spellId),
  removeSpellComponent: (heroId, spellId) => partyFlow.removeSpellComponent(get, set, heroId, spellId),
  setHeroBackground: (heroId, patch) => partyFlow.setHeroBackground(get, set, heroId, patch),
  endSession: (rewards) => partyFlow.endSession(get, set, rewards),
  openSessionEnd: () => set({ sessionEndOpen: true }),
  closeSessionEnd: () => set({ sessionEndOpen: false }),
  trainProsthesis: (heroId, uid) => partyFlow.trainProsthesis(get, set, heroId, uid),
  changeCareer: (heroId, newCareer, newLevel) => partyFlow.changeCareer(get, set, heroId, newCareer, newLevel),

  setParty: (p) => set({ party: p }),

  startScene: (scene, narratif) => {
    registerScene(scene);
    const start = scene.entities.find((e) => e.kind === 'heroStart');
    const pos = startOf(scene) ?? findFreeTile(scene);
    // Démarrage d'une partie / d'un scénario : on repart d'un état NEUF. SOURCE UNIQUE et
    // ZÉRO-MAINTENANCE : on réinitialise à l'état de CRÉATION du store (capturé par Zustand) —
    // donc tout nouveau champ d'état ajouté à l'init (système futur) se réinitialise ici sans
    // qu'on ait à le câbler. `JSON` retire les fonctions (seules les données sont remises à
    // plat) ; `set()` (fusion superficielle) préserve les actions. On ne conserve QUE la
    // navigation/vue (screen, caméra, zoom), le groupe (posé par `setParty`) et la SESSION COOP
    // (net : héberger une partie PUIS la lancer ne doit pas dissoudre le salon — Jalon 7).
    const { screen, party, camRot, zoom, viewMode, povActive, net } = get();
    const capEntrant = start?.facing ?? spawnFacing(pos, scene.dimensions);
    set({
      ...(JSON.parse(JSON.stringify(useGame.getInitialState())) as Partial<GameState>),
      screen, party, camRot, zoom, viewMode, povActive, net,
      scene: JSON.parse(JSON.stringify(scene)),
      mode: 'exploration',
      partyPos: pos,
      // Orientation d'ENTRÉE du meneur : authorée (facing du heroStart) sinon vers le CONTENU
      // (spawnFacing — en POV, un spawn au bord sud ne doit pas contempler le vide hors-carte).
      facing: poserCapDuGroupe({}, capEntrant),
      flags: { ...scene.flags },
      campaignSceneId: scene.id,
      journal: scene.startMessage ? [scene.startMessage.texte] : [],
      campaignNarratif: narratif ?? null,
    });
    // Gestes VIVANTS de la frontière (`stageGestes`) : la carte s'ouvre à son cran, CENTRÉE, et sans
    // qu'aucune marche tenue de l'écran précédent n'y commette de pas.
    resetStageGestes();
    // Semis des Possessions de dotation (#617/#618) — ICI, jamais `loadGame` (qui restaure
    // `data.possessions` de la save) : `startScene` est le SEUL seam qui repart d'un registre
    // `possessions` vidé (le reset ci-dessus), pour toute partie neuve (créateur → campagne,
    // devtools scenario()/campaign()) — `transitionTo`/`loadProject` (scène suivante d'un même
    // projet) n'y repassent pas, `party` déjà doté n'est jamais re-semé (garde de la fonction).
    possessionsFlow.seedStartingPossessions(get, set);
    bus.emit(EVT.SCENE_DIRTY);
    openEncounterPsych(get, set); // couture C : Peur/Terreur/trait ciblé à la rencontre des PNJ présents
    // N1 : l'entrée de zone remonte en MODALE (« le Journal n'est pas lu ») — étape d'AFFICHAGE
    // skippable ; le Journal garde l'archive consultable. Poussée APRÈS `openEncounterPsych` et en
    // séquence PROPRE (`own`) : la carte passe DEVANT les Tests de Sang-froid de la rencontre, qui
    // sont parqués par la doctrine du slot et repris à la clôture de la carte — jamais perdus.
    if (scene.startMessage) pushReveal(set, { kind: 'sceneEntry', title: scene.label, lines: [scene.startMessage.texte], sceneId: scene.id }, { own: true });
  },

  loadProject: ({ scenes, entryId, worldMap, narratif, projet }) => {
    // Enregistre toutes les scènes du projet (pour que les portes reveal:'door'
    // résolvent leurs intérieurs), puis démarre la scène d'entrée.
    const entry = scenes.find((s) => s.id === entryId);
    if (!entry) throw new Error(`loadProject : scène d’entrée « ${entryId} » absente (${scenes.map((s) => s.id).join(', ')})`);
    for (const s of scenes) registerScene(s);
    get().startScene(entry, narratif);
    // La carte du PROJET remplace la carte vide de l'état de départ (remise par le reset de
    // startScene) ; un projet sans carte n'offre pas de voyage.
    if (worldMap !== undefined) set({ worldMap });
    // Ouverture cérémonielle du chapitre (#717) : posée ICI, `startScene` vient de remettre l'état à
    // l'init. Absente du paquet = démarrage direct.
    set({ pendingOuverture: structuredClone(narratif?.ouverture ?? null) }); // #2097
    // Document SOURCE de la partie (#766) : snapshot AUTO-SUFFISANT du paquet, embarqué au save par
    // `stateFields` → au chargement, `applyLoadedSave` ré-enregistre ces scènes et re-dérive le narratif.
    // Posé APRÈS startScene (qui vide `campaignDoc` via le reset à l'init).
    set({ campaignDoc: { scenes, worldMap: worldMap ?? null, narratif: narratif ?? emptyNarratif(), startSceneId: entry.id, projet } });
  },

  /** Transition vers une autre scène (conserve groupe, flags, inventaire, argent).
   *  `pos` force la case d'arrivée (utilisé par `transitionBack`). */
  transitionTo: (sceneId, entry, pos) => {
    const target = sceneDuRegistre(sceneId);
    if (!target) {
      get().log(t('store.sceneMissing', { scene: sceneId }));
      return;
    }
    const heroStart = target.entities.find((e) => e.kind === 'heroStart');
    const start = pos || (entry && target.entryPoints?.[entry]) || startOf(target) || findFreeTile(target);
    // Orientation d'ENTRÉE : authorée SEULEMENT si on spawne réellement au heroStart (ni `pos` forcé
    // ni point d'entrée nommé) ; sinon vers le CONTENU de la NOUVELLE carte (le cap hérité de
    // l'ancienne scène n'a aucun sens ici — en POV il peut regarder le vide hors-carte).
    const authored = !pos && !(entry && target.entryPoints?.[entry]) ? heroStart?.facing : undefined;
    // Couture UNIVERSELLE de suspension (noyau/cascade.ts) : une cascade active PARQUÉE au lieu d'être
    // perdue par `resetFields('scene')` ci-dessous (ex. un abordage ouvre `startCombat` PUIS transitionne
    // vers sa scène — l'ORDRE des deux appels varie selon l'appelant, cette couture protège les deux).
    suspendActiveCascade(get, set);
    // …puis la pile parquée perd les cartes d'entrée de la scène QUITTÉE (`dropSceneEntrySteps`) :
    // elles narrent un lieu qu'on ne joue plus, et resurgiraient par-dessus la scène d'arrivée. Le
    // reste de la pile (jour de voyage, Tests de rencontre) traverse la transition intact.
    dropSceneEntrySteps(get, set);
    // Persistance d'INSTANCE de scène (#707) : capture le delta de la scène qu'on QUITTE (entités
    // retirées — décor consommé, PNJ tué par `removeEntity`/réconciliation de combat — et flags
    // runtime de portes/structures/tuiles) vs son document authored, puis applique l'instance stockée
    // de la scène CIBLE (si déjà visitée) au clone frais ci-dessous — SEULE couture, aucun site de
    // mutation (`removeEntity`, `setDoorOpen`…) n'est instrumenté.
    // Le GROUPE quitte la scène : plus personne du groupe n'y tient de place (une scène quittée ne
    // garde pas un héros absent). Libéré AVANT la capture, sinon l'instance persistée rappellerait le
    // meneur à sa chaise au revisit — et l'assise des PNJ authorés, elle, s'y capture normalement.
    const leaving = partyFlow.releaseHeroSeats(get().scene);
    const sceneInstances = { ...get().sceneInstances };
    if (leaving) {
      const leavingAuthored = sceneDuRegistre(leaving.id);
      const mut = leavingAuthored ? captureMutation(leaving, leavingAuthored) : undefined;
      if (mut) sceneInstances[leaving.id] = mut;
      else delete sceneInstances[leaving.id];
    }
    // Le groupe est passé : l'assise superposée est élaguée au moment même où la scène entre en état
    // (meuble retiré par la mutation, slot disparu du catalogue, emplacement de héros que le groupe
    // courant n'atteint pas).
    const scene = applySceneMutation(JSON.parse(JSON.stringify(target)), sceneInstances[target.id], get().party.length);
    set((s) => ({
      scene,
      sceneInstances,
      mode: 'exploration',
      partyPos: { ...start },
      facing: poserCapDuGroupe(s.facing, authored ?? spawnFacing(start, target.dimensions)),
      lightLevel: null, // nouvelle scène → lumière auto (un setLight ne se propage pas d'une scène à l'autre)
      // flags persistants : on conserve l'état narratif et on ajoute les
      // valeurs par défaut de la nouvelle scène pour les clés absentes.
      flags: { ...target.flags, ...s.flags },
      // Reset des champs transitoires du changement de scène (manifeste UNIQUE, scope 'scene') :
      // tous les pending* d'exploration/combat + `document`. `dialogue`/`battle` (état coeur) restent
      // explicites ci-dessous.
      ...resetFields('scene'),
      dialogue: null,
      battle: null,
      campaignSceneId: target.id,
      camEdge: false, // idem `resetStageYaw` ci-dessous : la scène d'arrivée se regarde depuis un cran DIAGONAL (#1289)
      camPan: { x: 0, y: 0 }, // …et depuis son CENTRE : le commis suit le vivant que `resetStagePan` remet à zéro
    }));
    resetStageGestes(); // idem `startScene` : la scène d'arrivée se regarde depuis SON cran, depuis son centre, et la
                        // touche encore enfoncée n'y marche pas (la main a armé ce geste dans la scène de départ)
    if (target.startMessage) get().log(target.startMessage.texte);
    get().advanceTime(TIME_COST.sceneTransition); // seam « tout est horodaté » : 0 en intérieur (paramétrable, #T2 extérieur/voyage)
    bus.emit(EVT.SCENE_DIRTY);
    get().autoSave(); // checkpoint d'ENTRÉE de scène (hors combat) — avant qu'une rencontre ne démarre le combat
    openEncounterPsych(get, set); // couture C : Psychologie à la rencontre dans la nouvelle scène
    // N1 : entrée de zone (transition) en MODALE — étape d'AFFICHAGE skippable (Journal = archive),
    // poussée APRÈS `openEncounterPsych` et en séquence PROPRE (`own`), pour la même raison qu'à
    // `startScene` : la carte passe devant, les Tests de rencontre sont parqués puis repris.
    if (target.startMessage) pushReveal(set, { kind: 'sceneEntry', title: target.label, lines: [target.startMessage.texte], sceneId: target.id }, { own: true });
  },

  moveParty: (pt) => {
    const { scene, mode, partyPos } = get();
    if (!scene || mode !== 'exploration') return;
    if (!groupePosable(scene, pt)) return;
    const from = partyPos; // case quittée → oriente le meneur le long du pas
    // MARCHER, C'EST SE LEVER : le meneur assis qui fait un pas quitte sa place. Libéré AVANT
    // l'écriture de `partyPos`, dans la MÊME écriture — aucun état intermédiaire ne le montre assis
    // à une place dont il s'est déjà éloigné. Scène sans assise → aucun delta (même référence).
    const debout = get().party.length ? releaseSeat(scene, { kind: 'party', rang: RANG_MENEUR }) : scene;
    set(debout === scene ? { partyPos: pt } : { partyPos: pt, scene: debout });
    // CAP DU GROUPE le long du pas (écrivain unique) — `faceFromPath` reste la couture des caps
    // INDIVIDUELS du combat. DELTA NUL : un pas qui ne change que l'ÉTAGE (escalier, `z` seul) ne
    // touche pas au regard ; `facingToward` y rendrait son défaut sud et claquerait la vue.
    if (from.x !== pt.x || from.y !== pt.y) set((s) => ({ facing: poserCapDuGroupe(s.facing, facingToward(from, pt)) }));
    bus.emit(EVT.SCENE_DIRTY);
    checkTriggers(get, set);
    // Déplacement-puis-interaction : l'interaction s'ouvre à la case D'ARRIVÉE du plan qui l'a
    // armée (`pendingInteract.at`), jamais à une adjacence croisée en chemin — le chemin vers l'abord
    // d'une place passe par des cases voisines du meuble qui ne SONT pas cet abord.
    const pi = get().pendingInteract;
    if (pi) {
      const target = scene.entities.find((e) => e.id === pi.id);
      if (!target) set({ pendingInteract: null });
      else if (memeCase(pt, pi.at)) {
        set({ pendingInteract: null });
        // L'offre VISÉE au clic si le décor n'en portait qu'une ; sinon l'arbitrage de proximité
        // (relevage, unique offre recalculée à l'arrivée) — à N offres, la pastille les sert.
        if (pi.actionId) get().jouerAction(pi.id, pi.actionId);
        else get().interactEntity(pi.id);
      }
    }
  },

  climbAcross: (from, to) => {
    const verdict = gesteDepuis(get(), from);
    if ('refus' in verdict) return void refuserGeste(get, set, t(verdict.refus, verdict.vars));
    const { mobile: mover, scene, battle } = verdict;
    // Grimpeur (LDB 15 l.57) : porté par le mobile du geste (`gesteDArete`). Grimpant
    // (LDB 85 l.160-162, créature, combat seulement) : `autoClimb` dispense de tout Test — et de la garde
    // `requiresGrimpeur`, réservée au Talent joueur (`planClimb` arbitre `autoSucceed`, réf ci-dessous).
    const hasGrimpeur = !!mover.talents?.some((tl) => tl.talentId === 'grimpeur' && tl.times > 0);
    const autoClimb = !!battle && hasAutoClimb(mover.traits);
    const plan = planClimb(scene, from, to, hasGrimpeur, battle ? mover.id : undefined, autoClimb);
    if (!plan) return void refuserGeste(get, set, t('climb.pasGrimpable'));
    if (plan.kind === 'impossible') return void refuserGeste(get, set, t('climb.tooHard', { name: mover.label }));
    if (!isWalkable(scene, to.x, to.y, to.z ?? 0)) return void refuserGeste(get, set, t('climb.sommetInaccessible', { name: mover.label }));
    if (!battle) {
      get().moveParty(to); // monte (optimiste) ; l'échec du Test fera chuter au pied via l'Effet `fall`
      if (plan.kind === 'test') jouerFlowEntier(runFlow(get, set, plan.flow));
      return;
    }
    const metres = Math.abs(heightAt(scene, to.x, to.y, to.z ?? 0) - heightAt(scene, from.x, from.y, from.z ?? 0));
    // Grimpant `climbFullSpeed` (LDB 85 l.162) : coût NORMAL (1 case), pas la ½ vitesse du Talent
    // Grimpeur joueur (LDB 15 l.55, `climbMovementCost`) — chemin joueur strictement inchangé.
    const cost = hasClimbFullSpeed(mover.traits) ? 1 : climbMovementCost(metres, sceneMetresPerTile(scene));
    if (movementRemaining(battle, mover) < cost) return void refuserGeste(get, set, t('climb.mouvementInsuffisant', { name: mover.label, cout: cost }));
    // `surface` = Test requis → consomme l'Action (LDB 13 l.86-88) ; `ladder`/`auto` = sans Test → Mouvement seul.
    if (plan.kind === 'test' && battle.acted) return void refuserGeste(get, set, t('climb.actionDejaPrise', { name: mover.label }));
    if (arriveeOccupee(battle, mover, to)) return void refuserGeste(get, set, t('franchir.caseOccupee', { name: mover.label }));
    placeCombatant(mover, scene, to); // hisse (optimiste) ; échec du Test → `fall` au pied
    const acted = plan.kind === 'test' ? true : battle.acted;
    // Résolution directe (Grimpant) : PAS un jet silencieux — il n'y a PAS de jet du tout, journalisé.
    const log = plan.kind === 'free' && plan.auto
      ? [...battle.log, ev('move', t('climb.auto', { name: mover.label }), mover.id)]
      : battle.log;
    set({ battle: { ...battle, log, acted, action: null, movementUsed: (battle.movementUsed ?? 0) + cost, movedPreAction: battle.movedPreAction || !battle.acted, reachable: new Map(), preview: null } });
    bus.emit(EVT.SCENE_DIRTY);
    // Lanceur = le mobile (`actorId`), LDB 15 l.57.
    if (plan.kind === 'test') openSkillTest(get, set, plan.flow.test, plan.flow.success, plan.flow.fail, EMPTY_FLOW, { actorId: mover.id });
  },

  /** Chute VOLONTAIRE (LDB 15 l.82) : depuis `from` (case du sauteur) vers `to` (case cardinale plus
   *  basse, `planFranchissement`) — geste JOUEUR seulement (IA hors périmètre : elle ne saute jamais). Ouvre le
   *  choix pré-jet `pendingFall` (Sauter / Tenter, et se suspendre d'abord quand la croisée l'offre),
   *  résolu par `fallChoose`. Le Mouvement que `soldeDeLAction` imputera (`mouvementDeLaChute`) est
   *  vérifié ici (le pas, l'allège) et à la déclaration (la suspension, `refusDeLaSuspension`). */
  fallAcross: (from, to) => {
    const verdict = gesteDepuis(get(), from);
    if ('refus' in verdict) return void refuserGeste(get, set, t(verdict.refus, verdict.vars));
    const { mobile: mover, scene, battle } = verdict;
    const plan = planFranchissement(scene, from, to);
    if (plan.kind !== 'fall') return void refuserGeste(get, set, t(plan.kind === 'none' ? REFUS_FRANCHISSEMENT[plan.raison] : 'franchir.refus.pasUneChute'));
    if (battle && arriveeOccupee(battle, mover, plan.to)) return void refuserGeste(get, set, t('franchir.caseOccupee', { name: mover.label }));
    // Le pas, et l'allège d'une croisée (`mouvementDeLaChute`, patron `windowAcross`).
    const cout = mouvementDeLaChute(plan, false, sceneMetresPerTile(scene));
    if (battle && movementRemaining(battle, mover) < cout) return void refuserGeste(get, set, t('fall.mouvementInsuffisant', { name: mover.label, cout }));
    const tombants = tombantsDe(get, battle, mover);
    // Membre VIVANT non debout : maison `chute-tombant-non-debout` (EDO 01 l.231, LDB 15 l.82).
    const nonDebout = tombants.find((c) => !estDebout(c));
    if (nonDebout && rule('chute-tombant-non-debout') !== 'chute-pleine') return void refuserGeste(get, set, t('fall.refus.nonDebout', { name: nonDebout.label }));
    set({
      pendingFall: {
        test: testDeRegle('chute', 'tenter'),
        to: plan.to, metres: plan.metres, initiateurId: mover.id,
        ...(plan.suspendu !== undefined ? { suspendu: plan.suspendu } : {}),
        ...(plan.allege !== undefined ? { allege: plan.allege } : {}),
        participants: tombants.map((c) => (estDebout(c)
          ? { id: c.id, interactive: true, attempt: null, ...(plan.suspendu !== undefined ? { suspendre: null } : {}), result: null }
          : { id: c.id, interactive: false, attempt: false, ...(plan.suspendu !== undefined ? { suspendre: false } : {}), result: null })),
      },
      ...(battle ? { battle: { ...battle, action: null, preview: null } } : {}),
    });
  },
  fallChoose: (tombantId, attempt, suspendre) => {
    // Un intent coop PÉRIMÉ (double clic d'un invité, saut déjà résolu) arrive jusqu'ici : refus nommé.
    const p = get().pendingFall;
    if (!p) return void refuserGeste(get, set, t('fall.refus.aucunSaut'));
    const part = p.participants.find((x) => x.id === tombantId);
    if (!part) return void refuserGeste(get, set, t('fall.refus.horsDuSaut'));
    if (part.attempt !== null) return void refuserGeste(get, set, t('fall.refus.dejaDeclare'));
    // Axe HAUTEUR (EDO 01 l.231) : déclaré avec le saut quand la suspension est offerte, jamais sinon.
    const offerte = p.suspendu !== undefined;
    if (offerte !== (suspendre !== undefined)) return void refuserGeste(get, set, t('fall.refus.axeHauteur'));
    if (attempt) {
      const refus = refusDuTestDeChute(get(), tombantId);
      if (refus) return void refuserGeste(get, set, t(refus.refus, refus.vars));
    }
    if (suspendre) {
      const refus = refusDeLaSuspension(get(), tombantId);
      if (refus) return void refuserGeste(get, set, t(refus.refus, refus.vars));
    }
    const suite: PendingFall = { ...p, participants: p.participants.map((x) => (x.id === tombantId ? { ...x, attempt, ...(offerte ? { suspendre } : {}) } : x)) };
    // Toutes les rangées sautent SANS Test (RAW « vous pouvez tenter ») : rien à lancer, l'étape se résout.
    if (suite.participants.every((x) => x.attempt === false)) { settleFall(get, set, suite); return; }
    set({ pendingFall: suite });
  },
  fallConfirm: () => {
    const p = get().pendingFall;
    if (!p || phaseDeChute(p) !== 'roll' || p.participants.some((x) => x.attempt && !x.result)) return;
    settleFall(get, set, p);
  },
  fallCancel: () => set({ pendingFall: null }),

  windowAcross: (from, to) => {
    const verdict = gesteDepuis(get(), from);
    if ('refus' in verdict) return void refuserGeste(get, set, t(verdict.refus, verdict.vars));
    const { mobile: mover, scene, battle } = verdict;
    const plan = planFranchissement(scene, from, to);
    if (plan.kind !== 'enjamber') return void refuserGeste(get, set, t(plan.kind === 'none' ? REFUS_FRANCHISSEMENT[plan.raison] : 'franchir.refus.pasDePlainPied'));
    if (!battle) {
      bus.emit(EVT.ANIM_MOVE, { id: mover.id, path: [verdict.case, plan.to] });
      get().moveParty(plan.to);
      return;
    }
    const cout = 1 + mouvementDeLAllege(plan.allege, sceneMetresPerTile(scene));
    if (movementRemaining(battle, mover) < cout) return void refuserGeste(get, set, t('fenetre.mouvementInsuffisant', { name: mover.label, cout }));
    if (arriveeOccupee(battle, mover, plan.to)) return void refuserGeste(get, set, t('franchir.caseOccupee', { name: mover.label }));
    placeCombatant(mover, scene, plan.to);
    const log = [...battle.log, ev('move', t('fenetre.enjambe', { name: mover.label }), mover.id)];
    set({ battle: { ...battle, log, action: null, movementUsed: (battle.movementUsed ?? 0) + cout, movedPreAction: battle.movedPreAction || !battle.acted, reachable: new Map(), preview: null } });
    bus.emit(EVT.SCENE_DIRTY);
  },

  stepPartyDir: (dir) => {
    const { scene, mode, partyPos, dialogue, camRot, viewMode, camEdge } = get();
    if (!scene || mode !== 'exploration' || dialogue) return;
    const dims = { w: scene.dimensions.w, h: scene.dimensions.h, rot: camRot, view: viewMode, edge: camEdge, yawDeg: viewYawDeg(camRot, camEdge) };
    const dest = exploreStepDest(scene, partyPos, (voisin) => screenStepDot(scene, partyPos, voisin, dir, dims));
    if (!dest) { bus.emit(EVT.MOVE_BLOCKED, {}); return; }
    // Glisse d'1 case via l'anim de marche EXISTANTE (ANIM_MOVE → walkPosOf), puis `moveParty` (z-aware :
    // facing, triggers, déplacement-puis-fouille) — le leader VISIBLE est le même qu'IsoStage.
    const leader = meneurDuMonde(get());
    if (leader) bus.emit(EVT.ANIM_MOVE, { id: leader.id, path: [partyPos, dest] });
    get().moveParty(dest);
  },

  pivotParty: (turn) => {
    if (!meneurDuMonde(get())) return; // groupe vide : personne à faire pivoter
    // Pivot du regard SEUL (aucun déplacement → pas de réorientation par `faceFromPath`). ±1 cran = 45°.
    set((s) => ({ facing: poserCapDuGroupe(s.facing, rotateDir8(capDuGroupe(s) ?? 'S', turn)) }));
  },

  stepPartyRelative: (rel) => {
    const s = get();
    if (s.mode !== 'exploration') return;
    const scene = s.scene;
    if (!scene || !meneurDuMonde(s)) return;
    const cur = capDuGroupe(s) ?? 'S';
    // Cap MONDE du pas = regard tourné de 0/2/4/6 crans (2 crans = 90° par cadran relatif).
    const worldDir = rotateDir8(cur, { forward: 0, right: 2, back: 4, left: 6 }[rel]);
    const dest = povStepDest(scene, s.partyPos, worldDir);
    if (!dest) { bus.emit(EVT.MOVE_BLOCKED, {}); return; }
    // Glisse d'1 case via l'anim de marche EXISTANTE (même forme d'émission que stepPartyDir).
    const leader = meneurDuMonde(s);
    if (leader) bus.emit(EVT.ANIM_MOVE, { id: leader.id, path: [s.partyPos, dest] });
    s.moveParty(dest);
    // Un pas ≠ avant ne doit pas tourner le regard : `moveParty` a posé le cap du groupe le long du
    // pas → on restaure le cap d'origine (l'avance, elle, aligne naturellement regard et déplacement).
    if (rel !== 'forward') set((st) => ({ facing: poserCapDuGroupe(st.facing, cur) }));
  },

  interactEntity: (entityId) => {
    const { scene, partyPos } = get();
    if (!scene) return;
    const ent = scene.entities.find((e) => e.id === entityId);
    if (!ent || ent.combat?.hiddenUntilCombat) return; // un ennemi d'embuscade n'est pas interpellable en exploration
    // ── MEUBLE À PLACES — les places AJOUTENT une affordance, elles n'en retirent AUCUNE : un buffet
    // à tabourets qui porte aussi une fouille reste fouillable. Ordre servi, et c'est le seul :
    //  1. le meneur occupe CE meuble → il se relève (bascule du même intent, priorité absolue) ;
    //  2. ce que le meuble a d'ACTIF à portée : dialogue, marchand, fouille NON épuisée ;
    //  3. une place LIBRE dont l'abord est exactement sous les pieds du groupe → il s'assoit ;
    //  4. sinon la raison française du refus (assise, ou fouille déjà épuisée).
    // On loote la table, PUIS on s'y attable : aucune des deux affordances n'est inatteignable.
    // La portée d'une place ne se mesure pas au meuble mais à son ABORD (`slot.approach`, seule
    // couture `noyau/monde/seating`), qui peut tomber hors du voisinage de la case d'ancrage.
    // Le MENEUR est l'emplacement 1 du groupe ; son id ne sert qu'à re-vérifier, à l'écriture, que
    // le meneur n'a pas changé entre le clic et le commit (coop).
    const leaderId = meneurDuMonde(get())?.id;
    // Places JOUABLES, pas la géométrie : un décor que l'auteur n'a pas ACTIVÉ n'offre pas l'assise
    // (#1687, `placesJouables`) — le clic y reste inerte au lieu de servir une raison de refus.
    const places = placesDe(scene, entityId);
    if (seLeverDe(get, set, entityId)) return;
    const horsPortee = !aPorteeDe(partyPos, ent);
    // Trop loin ou autre étage : la portée se lit à la SOURCE UNIQUE (`exploreNav.aPorteeDe`, qui
    // compte l'étage). Ici, aucune des affordances de proximité ne s'ouvre ; le déplacement-puis-fouille
    // est armé par l'UI (setPendingInteract).
    if (!horsPortee) {
      const offres = actionsDe(scene, ent, get().flags).filter((o) => o.origine !== 'assise');
      // UNE offre → on la joue ; N → rien ici : le PANNEAU borné de la pastille les sert (« Que faire ? »),
      // et deviner à la place du joueur serait le choisir pour lui ; zéro → la chaîne d'assise, puis rien.
      if (offres.length === 1) { get().jouerAction(entityId, offres[0].id); return; }
      if (offres.length > 1) return;
    }
    if (places.length && leaderId) { sasseoirA(get, set, entityId); return; }
    // Actions authorées toutes ÉPUISÉES et rien d'autre à offrir : on le dit (le halo, lui, s'est
    // déjà éteint). Le décor en PORTE (l'auteur en a posé), aucune n'est plus jouable.
    if (!horsPortee && ent.usable?.actions?.length && !actionsAuthorees(ent, get().flags).length)
      get().log(t('store.searchedAlready', { what: nomDEntite(ent, presetPnjById) ?? t('store.searchedFallback') }));
  },

  /**
   * EXÉCUTEUR UNIQUE d'une offre d'exploration (#1687) : `actionsDe` DIT ce qui est offert, `jouerAction`
   * le JOUE — et le dispatch se fait sur l'ORIGINE de l'offre, jamais sur un champ de l'entité ni sur
   * son id. Une action authorée N+1 ne coûte AUCUNE ligne ici ; une capacité d'instance N+1 coûte une
   * ligne de `JOUER_CAPACITE`, que la table TOTALE exige pour compiler.
   *
   * Une offre inconnue ou épuisée ne fait RIEN : l'offre est recalculée ICI sur l'état courant, donc un
   * clic arrivé en retard (coop, marche-puis-geste) ne rejoue pas une action fermée entre-temps.
   */
  jouerAction: (entityId, actionId) => {
    const { scene } = get();
    if (!scene) return;
    const ent = scene.entities.find((e) => e.id === entityId);
    if (!ent) return;
    const offre = actionsDe(scene, ent, get().flags).find((o) => o.id === actionId);
    if (!offre) return;
    // PORTÉE, même source unique que la pastille et le clic (`exploreNav.aPorteeDe`, étage compris) :
    // un ordre arrivé de loin (coop, clic en retard, marche interrompue) ne joue rien sur place.
    // L'assise est dehors : sa portée se mesure à l'ABORD de la place (`slot.approach`), qui peut
    // tomber hors du voisinage de la case d'ancrage.
    if (offre.origine !== 'assise' && !aPorteeDe(get().partyPos, ent)) return;
    if (offre.origine === 'capacite') {
      if (estCapacite(actionId)) JOUER_CAPACITE[actionId](get, set, ent, scene);
      return;
    }
    if (offre.origine === 'assise') {
      if (!seLeverDe(get, set, entityId)) sasseoirA(get, set, entityId);
      return;
    }
    const action = (ent.usable?.actions ?? []).find((a) => a.id === actionId);
    if (!action) return;
    get().log(t('store.actionJouee', { what: nomDEntite(ent, presetPnjById) ?? t('store.searchPlaceFallback'), action: offre.label }));
    // Logique authorée (Flow) : butin → fenêtre d'attribution, test → geste à risque (modale).
    // CLÔTURES (#1508) : l'horloge (« tout est horodaté ») puis le sort du décor. L'horloge tire les
    // effets PROGRAMMÉS et les ticks — jouée devant un dé de chute, elle les tirerait sur des
    // Blessures qui n'ont pas encaissé. Le coût de temps est une DONNÉE d'auteur (`minutes`) ; absent,
    // c'est celui de la fouille.
    cloturer(get, set, runFlow(get, set, flowRestant(entityId, action, get().flags), nomDEntite(ent, presetPnjById) ?? offre.label), [
      { verbe: 'avancerHorloge', minutes: action.minutes ?? TIME_COST.search },
      ...(action.consume ? [{ verbe: 'retirerEntite' as const, entityId }] : []),
      ...(action.unique ? [{ verbe: 'marquerActionJouee' as const, entityId, actionId }] : []),
    ]);
  },

  fouillerLaPiece: () => {
    const s = get();
    if (!s.scene) return void refuserGeste(get, set, t('geste.refus.aucuneScene'));
    if (s.mode !== 'exploration') return void refuserGeste(get, set, t('fouille.refus.horsExploration'));
    const porteur = porteurDExploration(s);
    if ('refus' in porteur) return void refuserGeste(get, set, t(porteur.refus, porteur.vars));
    const piece = roomFocusAt(s.scene, s.partyPos);
    if (!piece) return void refuserGeste(get, set, t('fouille.refus.horsPiece'));
    // La MÊME ligne qu'il y ait des portes ou non, qu'un Test échoue ou non : seule une réussite parle.
    get().log(t('fouille.journal'));
    cloturer(get, set, runFlow(get, set, fouilleDeLaPiece(s.scene, piece), t('eff.flowTitleDiscovery')), [
      { verbe: 'avancerHorloge', minutes: rule('fouille-piece-minutes') as number },
    ]);
  },

  /** Arme (ou annule via null) un déplacement-puis-interaction : l'UI le pose au clic d'un décor
   *  éloigné AVEC la case d'arrivée du plan de marche, consommé par `moveParty` à CETTE case ;
   *  annulé sur tout autre clic. */
  setPendingInteract: (pending) => set({ pendingInteract: pending }),

  chooseDialogue: (choiceIndex) => {
    const st = get();
    // LE VERBE VALIDE, pas la surface : la fenêtre grise, la touche se tait, mais c'est ICI que
    // « cette réponse est-elle jouable MAINTENANT ? » se tranche — un intent coop forgé, une touche
    // restée vive sous une modale et un clic arrivent tous par ce chemin. Deux portes, nommées :
    //  · `conversationRepond` — conversation ouverte, CE siège décide, aucune surface ne tient la
    //    main (`surfaceTientLaMain` : la fenêtre de jet ou le marché qu'une réponse vient d'ouvrir
    //    SUSPEND la conversation) ;
    //  · `reponsesDuNoeud` — la réponse est VISIBLE (son `when`) et OFFERTE (bourse), par le MÊME
    //    sélecteur que les deux surfaces. Un index qui n'y figure pas n'existe pas pour le joueur.
    if (!conversationRepond(st)) return;
    const r = reponsesDuNoeud(st).find((x) => x.index === choiceIndex);
    if (!r?.enabled) {
      if (r?.refus === 'argent') get().log(t('store.dialogueNoMoney'));
      return;
    }
    const node = st.dialogue.dialogue.nodes.find((n) => n.id === st.dialogue.nodeId);
    const choice = node?.choices[choiceIndex];
    if (!node || !choice) return;
    // Option payante (auberge, péage, pot-de-vin) : dépense de groupe (aucun bénéficiaire héros
    // unique) débitée AVANT les effets ; refus si le total du groupe ne couvre pas.
    if (choice.cost) {
      const cost = toMoney(choice.cost);
      if (!payFromGroup(get, set, cost, { purpose: 'Dialogue' })) { get().log(t('store.dialogueNoMoney')); return; }
    }
    const transition: DialogueTransition = choice.next
      ? { ...st.dialogue, nodeId: choice.next } // même conversation : `session` et interlocuteur voyagent avec
      : 'close';
    // Nom AFFICHÉ du locuteur (override par nœud puis speaker de session) — source unique partagée
    // par l'archive du tour et le titre de la fenêtre de butin d'un choix payant.
    const locuteur = speakerEntity(st.scene?.entities ?? [], node, st.dialogue);
    const speaker = locuteur && nomDEntite(locuteur, presetPnjById);
    // Archive verbatim du tour (#718) — au moment où le choix est FAIT, pas à la reprise d'un
    // Test différé (`choice.flow` peut suspendre plus bas : le tour est déjà enregistré ici).
    const turn: DialogueTurn = {
      speaker,
      nodeText: node.desc,
      choiceText: choice.label,
      at: st.gameTime,
      sceneId: st.scene?.id,
      dialogueId: st.dialogue.dialogue.id,
      session: st.dialogue.session,
    };
    set((s) => ({ dialogueHistory: recordTurn(s.dialogueHistory, turn) }));
    // Logique du choix (effets + branches) → runFlow ; objet/argent reçu = fenêtre d'attribution (titrée du donateur).
    if (choice.flow) {
      const suspended = get().pendingTest;
      const issue = runFlow(get, set, choice.flow, speaker ?? 'Butin');
      // Le Flow a SUSPENDU sur un Test (`openSkillTest`) : l'avancée du dialogue est portée par le
      // pending et appliquée par `resolveTest` — sinon le nœud suivant coexiste sous la modale de jet.
      const pt = get().pendingTest;
      if (pt && pt !== suspended) { set({ pendingTest: { ...pt, dialogueNext: transition } }); jouerFlowEntier(issue); return; }
      // MÊME invariant pour un DÉ (#1508) : l'avancée du dialogue est une CLÔTURE — elle attend la
      // conséquence au lieu de passer devant elle.
      cloturer(get, set, issue, [{ verbe: 'dialogueSuivant', transition }]);
      return;
    }
    applyDialogueTransition(get, set, transition);
  },

  closeDialogue: () => {
    if (get().dialogue) get().advanceTime(TIME_COST.dialogue); // clôture d'une conversation ≈ dialogue min
    set({ dialogue: null });
  },

  // ─── Marchand (#2) : délégué à merchantFlow ───
  openMerchant: (entityId) => merchantFlow.openMerchant(get, set, entityId),
  openPlaceMerchant: (entityId, archetype, backdrop) => merchantFlow.openPlaceMerchant(get, set, entityId, archetype, backdrop),
  closeMerchant: () => merchantFlow.closeMerchant(get, set),
  searchAvailability: () => merchantFlow.searchAvailability(get, set),
  buyItem: (label, heroId) => merchantFlow.buyItem(get, set, label, heroId),
  addToCart: (label) => merchantFlow.addToCart(get, set, label),
  decFromCart: (label) => merchantFlow.decFromCart(get, set, label),
  removeFromCart: (label) => merchantFlow.removeFromCart(get, set, label),
  clearCart: () => merchantFlow.clearCart(get, set),
  refuseBargain: (mode) => merchantFlow.refuseBargain(get, set, mode),
  payCart: () => merchantFlow.payCart(get, set),
  assignDistribution: (index, heroId) => merchantFlow.assignDistribution(get, set, index, heroId),
  confirmDistribution: () => merchantFlow.confirmDistribution(get, set),
  addToSellCart: (uid, heroId) => merchantFlow.addToSellCart(get, set, uid, heroId),
  removeFromSellCart: (uid) => merchantFlow.removeFromSellCart(get, set, uid),
  clearSellCart: () => merchantFlow.clearSellCart(get, set),
  confirmSell: () => merchantFlow.confirmSell(get, set),
  repairItem: (uid, heroId) => merchantFlow.repairItem(get, set, uid, heroId),
  startBargain: (mode) => merchantFlow.startBargain(get, set, mode),
  bargainConfirm: () => merchantFlow.bargainConfirm(get, set),
  bargainCancel: () => set({ pendingBargain: null }),

  appraiseItem: (uid, heroId, mode) => merchantFlow.appraiseItem(get, set, uid, heroId, mode),
  appraiseGear: (scope, index, mode) => merchantFlow.appraiseGear(get, set, scope, index, mode),
  resolveAppraise: () => merchantFlow.resolveAppraise(get, set),
  appraiseCancel: () => set({ pendingAppraise: null }),

  openTavernGames: (npcId?: string) => tavernFlow.openTavernGames(get, set, npcId),
  playTavernGame: (opts) => tavernFlow.playTavernGame(get, set, opts),
  closeTavernGames: () => tavernFlow.closeTavernGames(get, set),
  barterExchange: (opts) => merchantFlow.barterExchange(get, set, opts),
  setSellHalving: (uid, delta) => merchantFlow.setSellHalving(get, set, uid, delta),

  seedRng: (seed) => {
    seedBattleRng(seed);
  },

  resolveCargoRaid: (outcome) => {
    if (!get().cargoRaid) return;
    const { patch, pct, losses } = applyLandCargoRaid(get(), outcome);
    const total = losses.reduce((n, l) => n + l.removed, 0);
    set({ ...patch, cargoRaid: false });
    if (total > 0) {
      // Consequence structurée (#295) — issue en donnée + total, jamais un jet silencieux.
      get().log(t('store.cargoRaid', { issue: t(outcome === 'fled' ? 'store.cargoRaidFled' : 'store.cargoRaidBroken'), enc: total, pct, porteurs: losses.length > 1 ? t('store.fragCargoPorters', { n: losses.length }) : '' }));
    } else if (outcome !== 'victory' && pct > 0) {
      get().log(t('store.cargoRaidNothing'));
    }
  },
  dismissVictory: () => {
    get().resolveCargoRaid('victory'); // combat gagné = le convoi est sauf (0 %), le flag s'éteint (#327)
    const pv = get().pendingVictory;
    const leftoverGear = (pv?.gear ?? []).map((g) => g.effect); // équipement non attribué → 1er héros par défaut
    const cont = pv?.onContinue;
    // Scène de COMBAT d'une bataille de masse (ADE II 08) : la victoire tactique nourrit la réduction
    // de Puissance ennemie (l.139 : ennemis neutralisés), puis on reprend la vue de bataille.
    const kills = (pv?.defeated ?? []).reduce((n, d) => n + d.count, 0);
    const inMassBattleCombat = !!get().massBattle?.combatScene;
    set({ pendingVictory: null, battle: null, mode: 'exploration' });
    // DEUX lots à la suite : si le premier ouvre un dé à la porte (#1508), le second est SA suite et
    // ne doit pas passer devant — il part alors dans la continuation de l'étape ouverte, et le teardown
    // de combat (couture UNIVERSELLE, noyau/cascade.ts) est la CLÔTURE qui les suit tous les deux.
    let issue = leftoverGear.length ? applyEffects(get, set, leftoverGear) : undefined;
    if (cont?.length) {
      // #9 : téléport/dialogue de onVictory APRÈS « Continuer ». Si le butin a différé, ce lot-ci est SA
      // suite — confié en APPEND derrière le reste du butin (`confierLaSuite`).
      if (issue) confierLaSuite(set, [{ verbe: 'reprendreFlow', flow: flowFromEffects(cont) }]);
      else issue = applyEffects(get, set, cont);
    }
    cloturer(get, set, issue, [{ verbe: 'teardownDeVictoire', kills, batailleDeMasse: inMassBattleCombat }]);
  },
  /** Ferme l'écran de DÉFAITE. Dans une Scène de COMBAT de bataille de masse (ADE II 08), la défaite
   *  tactique ne met PAS fin à la partie : les héros sont repoussés (soignés, le combat de scène est une
   *  abstraction), l'issue `combatLost` alimente le camp allié (Duel l.223 : −20 ; Percée l.175 : Charge),
   *  et la bataille CONTINUE. Hors bataille de masse : reprise standard (retour à la scène / redémarrage). */
  dismissDefeat: () => {
    get().resolveCargoRaid('defeat'); // combat perdu = le convoi est pillé (landRobberyLossPct, #327)
    // Anéantissement HORS COMBAT (`checkPartyWiped`) : pas de bataille à reprendre — retour au menu.
    if (get().partyWiped) { set({ partyWiped: false, battle: null, screen: 'menu' }); return; }
    const inMassBattleCombat = !!get().massBattle?.combatScene;
    if (inMassBattleCombat) {
      // Repoussés, pas anéantis : on relève le groupe (le combat de scène ne tue pas définitivement).
      const heal = (c: import('../engine/types').Combatant): import('../engine/types').Combatant => ({
        ...c, wounds: { ...c.wounds, current: c.wounds.max }, conditions: [], criticalWounds: 0, dead: false, outOfRencontre: false,
      });
      set({ party: get().party.map(heal), battle: null, mode: 'exploration' });
      massBattleFlow.massBattleResumeCombat(get, set, 0, 'lost');
      resumeSuspendedCascade(get, set); // teardown de combat (couture universelle) — cf. dismissVictory
      return;
    }
    const cur = get().scene;
    if (cur) set({ mode: 'exploration', battle: null });
    resumeSuspendedCascade(get, set); // teardown de combat (couture universelle) — cf. dismissVictory
  },
  /** Ferme la fenêtre de loot — même contrat que la victoire : le non-attribué va au 1er héros. */
  dismissLoot: () => {
    const pl = get().pendingLoot;
    const leftover = (pl?.gear ?? []).map((g) => g.effect);
    set({ pendingLoot: null });
    if (leftover.length) jouerFlowEntier(applyEffects(get, set, leftover));
  },
  assignLootGear: (index, heroId) => assignGearAt(get, set, 'pendingLoot', index, heroId),
  /** Attribue un objet d'équipement du butin de victoire au héros choisi (qualités/skin conservés). */
  assignVictoryGear: (index, heroId) => assignGearAt(get, set, 'pendingVictory', index, heroId),
  harvestCreature: (creatureId) => harvestVictoryCreature(get, set, creatureId),
  /** DEMANDE DE PAUSE au prochain Round, POSÉE PAR SON SIÈGE : le siège vient de `decidingSeat` (le
   *  siège agissant quand l'hôte applique l'intent d'un invité, sinon le siège local), jamais d'un
   *  argument — la demande d'un joueur ne peut pas être signée d'un autre. */
  raiseHand: () => {
    const b = get().battle;
    if (!b) return;
    const seat = decidingSeat(get());
    const deja = b.handRaisedBy ?? [];
    if (deja.includes(seat)) return;
    set({ battle: { ...b, handRaisedBy: [...deja, seat], log: [...b.log, ev('info', t('store.handRaised'))] } });
  },
  /** RETRAIT de la demande de pause (interrupteur de la frise) : symétrique de `raiseHand`, gratuit —
   *  tant que le Round n'a pas tourné, un joueur qui s'est ravisé rend la table à son enchaînement. Il
   *  ne retire QUE son siège : la pause tient tant qu'un autre siège la demande. */
  lowerHand: () => {
    const b = get().battle;
    if (!b) return;
    const seat = decidingSeat(get());
    if (!(b.handRaisedBy ?? []).includes(seat)) return;
    set({ battle: { ...b, handRaisedBy: (b.handRaisedBy ?? []).filter((s) => s !== seat), log: [...b.log, ev('info', t('store.handLowered'))] } });
  },
  victoryReady: (seat) => {
    const pv = get().pendingVictory;
    if (!pv) return;
    const readyBySeat = { ...(pv.readyBySeat ?? {}), [seat]: true };
    set({ pendingVictory: { ...pv, readyBySeat } });
    const s = get();
    if (s.net.mode === 'guest') return; // l'invité ne fait que marquer
    if (quorumAtteint(s, readyBySeat)) get().dismissVictory(); // quorum UNIQUE : `siegesRequis`
  },

  openMedic: (opts) => medicFlow.openMedic(get, set, opts),
  medicSelectPatient: (id) => medicFlow.medicSelectPatient(get, set, id),
  medicAct: (act) => medicFlow.medicAct(get, set, act),
  medicSetWound: (idx) => medicFlow.medicSetWound(get, set, idx),
  openSurgeryPass: () => medicFlow.openSurgeryPass(get, set),
  surgeryNext: () => medicFlow.surgeryNext(get, set),
  surgeryPassCancel: () => medicFlow.surgeryPassCancel(get, set),
  surgeryCancel: () => medicFlow.surgeryCancel(get, set),
  closeMedic: () => medicFlow.closeMedic(get, set),

  // ── Repos (modale de nuit) : cf. noyau/restFlow ──
  openRest: (opts) => restFlow.openRest(get, set, opts),
  restSet: (heroId, patch) => restFlow.restSet(get, set, heroId, patch),
  restReady: (seat) => restFlow.restReady(get, set, seat),
  restSleep: () => restFlow.restSleep(get, set),
  restCancel: () => restFlow.restCancel(get, set),

  // ── Conseil de bord (paie hebdomadaire + Moral) : cf. noyau/shipCrew ──
  councilPay: (decision) => councilPayFlow(get, set, decision),
  councilClose: () => councilCloseFlow(get, set),

  usePartyItem: (heroId, uid) => usePartyConsumable(get, set, heroId, uid),

  startExtendedTest: (opts) => {
    set({ pendingExtendedTest: { ...opts, total: 0, rounds: [{ id: 'round-1', interactive: true, result: null }] } });
    // Par la PORTE (#1262 V2 L4) : dernier hôte manuscrit de `src/state`. Le mint vérifie que
    // `pendingExtendedTest` est posé — il vient de l'être, ligne au-dessus.
    const steps: BuiltCascadeStep[] = [];
    pousseSi(steps, hostStep(get, { id: idDansLaSequence(get, 'ext-jet', 'test'), kind: 'extendedJet', jet: 'extended', actorId: opts.actorId }));
    if (steps.length) openSequence(get, set, { title: opts.label, icon: 'ui/key', purpose: 'test', steps });
  },
  extendedTestNext: () => {
    const p = get().pendingExtendedTest;
    if (!p) return;
    const cur = p.rounds[p.rounds.length - 1];
    if (!cur?.result) return; // le Round courant doit avoir été lancé
    // Cumul LDB 12 mutualisé (`extendedTestStep`) : un Round réussi ajoute son DR, un raté le retire
    // (planché à 0) ; règle opt. l.208 « DR 0 = ±1 min » via `test-extended-min-sl`.
    const { total, done } = extendedTestStep(p.total, cur.result, p.targetDR, !!rule('test-extended-min-sl'));
    // BORNE d'essais (Commerce d'opportunité, MDG 15 l.274-286 : « ≤ 3 tentatives ») — cible non
    // atteinte à la DERNIÈRE tentative permise = une ISSUE (résolue par `outcome`), pas une boucle infinie.
    const exhausted = !done && p.maxAttempts != null && p.rounds.length >= p.maxAttempts;
    if (done || exhausted) {
      set({ pendingExtendedTest: null, pendingCascade: null }); // ferme la cascade-hôte aussi
      get().log(t('store.extendedDone', { label: p.label, issue: t(done ? 'store.extendedOk' : 'store.extendedKo'), total, target: p.targetDR }));
      if (done && p.dispel) {
        // DISSIPATION réussie (LDB 46 l.160) : retire tous les effets du Sort de tous ses porteurs.
        const b = get().battle;
        const n = b ? dissipateSpell(b.combatants, p.dispel.spellId, p.dispel.casterId) : 0;
        set(touchActors(get()));
        get().log(t('cs.dispelDone', { spell: p.dispel.label, extra: n > 1 ? t('cs.fragDispelFreed', { n }) : '' }));
      }
      if (done && p.flag) set({ flags: { ...get().flags, [p.flag]: true } }); // gate la suite (porte/serrure d'éditeur)
      // Issue de DOMAINE en donnée (kind-agnostique) : appliée qu'elle ait réussi ou buté sur `maxAttempts`.
      if (p.outcome) {
        const applier = extendedTestOutcomeAppliers[p.outcome.kind];
        const out = applier?.(get, set, p, total, done);
        const line = out?.consequences ? resultLine(out.consequences) : '';
        if (line) get().log(line);
      }
      reprendreLaSuite(get, set, p.suite);
      return;
    }
    // Round suivant : la cascade-hôte (1 étape) reste, seul `pendingExtendedTest` gagne un Round (re-rendu).
    set({ pendingExtendedTest: { ...p, total, rounds: [...p.rounds, { id: `round-${p.rounds.length + 1}`, interactive: true, result: null }] } });
  },
  // Renoncer CLÔT le Test (sans réussite) : la suite du Flow qui l'a ouvert se joue, comme après un Test raté.
  extendedTestCancel: () => {
    const suite = get().pendingExtendedTest?.suite;
    set({ pendingExtendedTest: null, pendingCascade: null });
    reprendreLaSuite(get, set, suite);
  },
  // Enfoncer une porte à plusieurs (EDO Appendice 2) : flux multi PARALLÈLE (objet BE/B).
  startForceDoor: (opts) => {
    set({ pendingForceDoor: { label: opts.label, doorBE: opts.doorBE, doorB: opts.doorB, doorBmax: opts.doorB, flag: opts.flag,
      ...(opts.suite ? { suite: opts.suite } : {}),
      participants: opts.heroIds.map((id) => ({ id, interactive: true, result: null })) } });
    // « Une situation = une modale » : l'enfoncement est hôté dans la cascade (rendu par CascadeModal
    // via l'étape `jet:'forceDoor'`). `pendingForceDoor` reste le porteur des données/participants ;
    // ses résolveurs ferment LES DEUX quand la porte cède. `groupOwner` → l'arbitre coop met l'owner à
    // '*' (action de GROUPE : chacun pilote ses héros), faute d'acteur unique sur l'étape.
    // #1262 V2 L4 : par la PORTE (`hostStep`, forme de GROUPE) — l'étape n'est plus un littéral, et le
    // mint vérifie que `pendingForceDoor` est posé (il vient de l'être).
    const steps: BuiltCascadeStep[] = [];
    pousseSi(steps, hostStep(get, { id: 'forceDoor', kind: 'forceDoorStep', jet: 'forceDoor', groupOwner: true }));
    if (steps.length) openSequence(get, set, { title: t('store.forceDoorTitle'), icon: 'action/force', purpose: 'combat', steps });
  },
  forceDoorConfirm: () => {
    const p = get().pendingForceDoor;
    if (!p) return;
    // Dégâts du Round = somme des coups (chacun déjà réduit par le BE à la résolution). Objets : pas de min 1.
    const dmg = p.participants.reduce((s, x) => s + (x.result?.damage ?? 0), 0);
    const doorB = p.doorB - dmg;
    if (doorB <= 0) {
      set({ pendingForceDoor: null, pendingCascade: null }); // la porte cède → ferme la situation (data + cascade hôte)
      get().log(t('store.doorYields', { label: p.label, n: dmg, s: dmg > 1 ? 's' : '' }));
      if (p.flag) set({ flags: { ...get().flags, [p.flag]: true } }); // ouverture en jeu (porte d'éditeur)
      reprendreLaSuite(get, set, p.suite);
    } else {
      // La porte tient : un nouveau Round s'ouvre (chacun re-frappe — jets remis à zéro).
      set({ pendingForceDoor: { ...p, doorB, participants: p.participants.map((x) => ({ ...x, result: null, rerolled: false, forced: false })) } });
      get().log(t('store.doorHolds', { label: p.label, n: dmg, s: dmg > 1 ? 's' : '', left: doorB, sB: doorB > 1 ? 's' : '' }));
    }
  },
  // Renoncer CLÔT l'enfoncement (la porte tient) : la suite du Flow qui l'a ouvert se joue.
  forceDoorCancel: () => {
    const suite = get().pendingForceDoor?.suite;
    set({ pendingForceDoor: null, pendingCascade: null });
    reprendreLaSuite(get, set, suite);
  },
  designerHerosOuvrir: (p) => {
    if (!get().party.some((h) => !h.dead)) return false;
    set({ pendingDesignationHeros: p });
    return true;
  },
  designerHerosChoisir: (heroId) => {
    const p = get().pendingDesignationHeros;
    if (!p) return;
    const vivants = get().party.filter((h) => !h.dead);
    if (heroId === undefined ? vivants.length > 0 : !vivants.some((h) => h.id === heroId)) return;
    set((st) => {
      if (heroId === undefined) return { pendingDesignationHeros: null };
      const couple = coupleDIdentite(st.party.find((h) => h.id === heroId));
      const { [p.etat]: _ancien, ...autres } = st.identitesFigees;
      return {
        etats: { ...st.etats, [p.etat]: heroId },
        identitesFigees: couple ? { ...autres, [p.etat]: couple } : autres,
        pendingDesignationHeros: null,
      };
    });
    reprendreLaSuite(get, set, p.suite);
  },

  // LOT DE DÉS d'un étal (#1426) — les deux gestes de BLOC. « Valider » rejoue le générateur avec les
  // dés du lot (posés ou naturels) : c'est le MÊME code que l'ouverture sans fenêtre, nourri par un rng
  // rejoueur qui ne consomme aucun aléa vivant. « Renoncer » applique le lot TEL QU'IL EST TOMBÉ — un
  // étal existe de toute façon, la fenêtre n'est qu'une offre de pose.
  etalLotConfirm: () => { appliquerLotEtal(get, set); },
  etalLotCancel: () => { appliquerLotEtal(get, set); },

  // Résilience « Je ne faillirai pas ! » (LDB 17 l.68) sur un Test de scène (hors combat) — cycle
  // UNIFIÉ par la fabrique rollFlow (les variantes combat attack/defense/cast vivent dans combatSlice).

  /** Choix du lanceur (avant le jet) : re-cible le Test sur le candidat `id` du groupe. */
  testSetActor: (id) => {
    const pt = get().pendingTest;
    if (!pt || pt.roll != null) return; // seulement AVANT le jet
    const cand = pt.candidates?.find((c) => c.id === id);
    if (!cand) return;
    // La cascade-hôte porte l'`actorId` de l'étape (gating coop « chacun ses jets ») : re-cibler le
    // lanceur le met à jour aussi, pour que la modale reste chez le bon propriétaire.
    // Le PORTEUR de l'étape change : le curseur se re-pose par la porte du pilote (`curseurPose`), qui
    // re-juge la surface du nouveau porteur — jamais un `cursor:` écrit à la main. Les DEUX porteurs
    // (Test et étape) se publient dans le MÊME `set` : entre deux `set`, un abonné rendrait un état où
    // la modale suit un porteur et l'étape l'autre.
    const pc = get().pendingCascade;
    const etape = pc ? curseurPose(get, { ...pc, participants: pc.participants.map((st, k) => (k === pc.cursor ? { ...st, actorId: cand.id } : st)) }, pc.cursor) : null;
    set({
      pendingTest: { ...pt, actorId: cand.id, actorName: cand.label, skillValue: cand.value, target: cand.target, clamped: cand.clamped, base: cand.base, mods: cand.mods, psychMod: cand.psychMod, psychDetail: cand.psychDetail, itemUid: cand.itemUid, support: cand.support },
      ...(etape ? { pendingCascade: etape } : {}),
    });
  },
  // Test de scène (hors combat) : Lancer / Chance (relance / +1 DR) / Pacte — Résilience plus haut.
  // `cancel` : referme la cascade quand le test est annulable (action de combat, `pendingTest.cancellable`).
  // `determine` : Détermination (LDB 17 l.59), corps dans `FLOWS.test.caps.determine`.

  /** Exposition à une Influence corruptrice (LDB 19) — flux différé, cf. spec `corruption`. */
  corruptionSetNature: (nature) => {
    const pc = get().pendingCorruption;
    // Pré-jet uniquement, en EXPOSITION seulement, et JAMAIS si la source impose la nature.
    if (!pc || pc.roll != null || pc.kind === 'seuil' || pc.natureFixee) return;
    set({ pendingCorruption: { ...pc, ...testDExposition(nature) } });
  },
  /** Acquitte l'exposition (Points selon niveau + DR, puis seuil) OU le Test du SEUIL
   *  (kind 'seuil', LDB 19 l.70) : dénouement chez `corruptionFlow`, puis le slot LIBÉRÉ revient au
   *  seuil suivant en attente (`corruptionQueue`) — la fenêtre suivante s'ouvre, aucun Test ne se
   *  résout en silence faute de place. */
  resolveCorruption: () => {
    const pc = get().pendingCorruption;
    if (!pc || pc.roll == null) return;
    set({ pendingCorruption: null });
    resolveCorruptionPending(get, set, pc);
    releaseCorruptionSlot(get, set);
  },

  /** Acquitte un test de compétence : applique la branche réussite/échec. */
  resolveTest: () => {
    const pt = get().pendingTest;
    if (!pt || pt.roll == null) return; // pas d'acquittement avant le jet
    // ACQUITTEMENT par le goulot (`FLOWS.test.apply`) : l'issue est déclarée AU FLUX (`spec.issue`),
    // journalisée là — ici on acquitte, avant de fermer (l'issue se lit sur le pending qui l'a produite).
    FLOWS.test.apply(get);
    // Le Test EST une cascade-hôte à une étape (rendu par CascadeModal) : on ferme LES DEUX avant de
    // lancer la branche (qui peut ouvrir d'autres pendings — combat, autre Test…).
    set({ pendingTest: null, pendingCascade: null });
    const actor = get().party.find((c) => c.id === pt.actorId);
    const tool = pt.itemUid ? actor?.items?.find((i) => i.uid === pt.itemUid) : undefined;
    // Pratique/Peu Fiable : ±1 DR sur un Test RATÉ (LDB 60 l.22/58). Ne repêche qu'un échec qui a
    // réussi le d100 mais manqué le seuil requireSL (jamais un roll > cible → on ne crée pas de réussite).
    const drDelta = tool ? craftTestDRAdjust(tool, pt.success) : 0;
    const effSuccess = drDelta !== 0 ? pt.roll <= pt.target && meetsRequiredSL(pt.requireSL, pt.sl + drDelta) : pt.success;
    // SEAM d'observation pure (recette navigateur, #514) — jamais lu par du code de règles.
    bus.emit(EVT.TEST_RESOLVED, { actorId: pt.actorId, success: effSuccess, sl: pt.sl, roll: pt.roll, target: pt.target });
    // Bâclé : un outil Bâclé qui Maladresse (échec + double) se brise (LDB 60, généralisé hors combat).
    if (tool && pt.isDouble && !pt.success && hasQuality(tool, 'bacle') && !isUnbreakable(tool)) {
      tool.destroyed = true;
      set({ party: [...get().party] }); // persiste la casse + re-render
      get().log(t('store.toolBroken', { tool: tool.label, name: actor?.label ?? pt.actorName }));
    }
    // Action de combat « cumuler l'Avantage » (LDB 09 l.305-308) : sur réussite, +1 Avantage plafonné au
    // `cap` de la Compétence (via `gainAdvantage`, qui respecte aussi le plafond général) ; l'Action est
    // consommée qu'on réussisse ou non (on a « passé son tour » à s'observer/prier — LDB 09 l.308/419).
    const ca = pt.combatAdvantage;
    const battle = ca ? get().battle : null;
    if (ca && battle) {
      const c = inBattleId(battle, ca.combatantId);
      if (c && effSuccess && (c.advantage ?? 0) < ca.cap) campGain(get, c, 1);
      set({ battle: { ...markActed(get, set), action: null } });
    }
    // Branche choisie PUIS continuation (suite du `seq` parent d'un nœud `test`), jouées par le
    // marcheur qui parle LEUR vocabulaire — même aiguillage que `reprendreFlow`/`reprendreFlowDeCombat` :
    // un Test SUBI (`pt.subi`) parle `target`/`caster` et repart chez le marcheur d'ACTEUR ; un Test de
    // scène parle `party`/`hero` et reste chez `runFlow` (butin de Test → fenêtre d'attribution).
    const branch = effSuccess ? pt.onSuccess : pt.onFailure;
    const issue = pt.subi
      ? reprendreTestSubi(get, set, pt, effSuccess)
      : runFlow(get, set, { kind: 'seq', steps: [branch ?? EMPTY_FLOW, pt.after ?? EMPTY_FLOW] }, pt.label, pt.sl);
    // CLÔTURES du Test (#1508) — elles suivent la branche, et attendent son dé s'il y en a un :
    //  · SEAM `onOwnTestFailed` (chemin modal JOUEUR — convergence des Tests de scène/compétence/combat,
    //    réf memory « JAMAIS rollTest inline chemin joueur ») : un Test RATÉ émet le trigger (Crampes
    //    abdominales → Sonné/À Terre/Inconscient par paliers de DR, MSRC 16 l.152). Réussite forcée
    //    (Résilience) exclue. RÉ-ENTRANCE : ce Test EST le sous-Test d'un `onOwnTestFailed` (FM de
    //    palier 2) → il ne RÉ-ÉMET PAS.
    //  · avancée de dialogue différée (un `choice.flow` avait suspendu ICI).
    const clotures: Cloture[] = [];
    if (!effSuccess && !pt.noOwnTestFailed) clotures.push({ verbe: 'testRateDeLActeur', actorId: pt.actorId, sl: pt.sl });
    if (pt.dialogueNext) clotures.push({ verbe: 'dialogueSuivant', transition: pt.dialogueNext });
    cloturer(get, set, issue, clotures);
  },
  remettreDocument: (doc) => set((s) => ({ document: { ...doc, remise: s.remisesDeDocument + 1 }, remisesDeDocument: s.remisesDeDocument + 1 })),
  // COOP : l'hôte ferme (patron `acquitterOuverture`) ; chez l'invité, la suite ne se joue jamais.
  closeDocument: () => {
    const doc = get().document;
    if (!doc || get().net.mode === 'guest') return;
    set({ document: null });
    reprendreLaSuite(get, set, doc.suite);
  },

  // PUITS UNIQUE du journal : c'est ici — et nulle part ailleurs — qu'un jet dont le joueur a SAISI la
  // valeur laisse sa trace écrite (arbitrage #939 : marqué PARTOUT, rangée ET journal).
  log: (msg) => set((s) => {
    const lines = Array.isArray(msg) ? msg : [msg];
    return { journal: [...s.journal.slice(-40), ...(fixedJetOpen(s) ? lines.map(markFixedDie) : lines)] };
  }),

  advanceTime: (minutes) => {
    if (minutes <= 0) return;
    set({ gameTime: get().gameTime + minutes });
    bus.emit(EVT.TIME_ADVANCED, { minutes }); // #T3 (cascade) branchera ses déclencheurs sur les franchissements ; #668 : l'abonné module tire `fireScheduledEffects` SYNCHRONE ici

    // HORS COMBAT : faire progresser les États qui tickent (Hémorragique/Poison/Flammes) et l'agonie au
    // prorata du temps écoulé (1 Round ≈ TIME_COST.combatRound min). En combat, la frontière de Round le fait.
    if (!get().battle) {
      const rounds = Math.floor(minutes / TIME_COST.combatRound);
      if (rounds > 0) {
        const party = get().party;
        const log = outOfCombatUpkeep(party, rounds, battleRng());
        if (log.length) { set({ party: [...party] }); get().log(log); }
        // L'agonie hors combat est la SEULE voie par laquelle un corps assis s'éteint sans combat :
        // la couture unique de libération y est appelée (no-op si personne n'est assis).
        releaseSeatsOfDowned(get, set);
      }
    }
    // Entretien quotidien (#T2/#T3 — rations/faim, maladies, convalescence) + purge des effets à
    // durée d'horloge (contrecoups LDB 46/40) : traite les éventuels franchissements de jour.
    // VISIBLE (le journal seul ne suffit pas). HORS COMBAT, tout Test de Résistance d'entretien est
    // DIFFÉRÉ dans la MÊME cascade influençable que le repos (LDB 17 : Chance sur tout Test raté ; « aucun
    // jet silencieux ») via `deferredUpkeepSteps` ; les lignes SANS jet (rations, dissipations…) restent
    // le témoin groupé. En combat, le slot de cascade appartient à l'arène → jets roulés (témoin pré-résolu).
    if (get().battle) {
      // EN COMBAT (#253) : le slot de cascade appartient à l'arène → les Tests de Résistance d'entretien ne
      // s'ouvrent pas ici. On les DIFFÈRE dans `pendingUpkeepSteps` (consommé par `openCombatEndCascade` à la
      // fin du combat) au lieu de les rouler en SILENCE ; les lignes SANS jet (rations, dissipations) restent
      // le témoin. `lastUpkeepDay` (posé par `runDailyUpkeep`) garde l'anti-double-résolution.
      const deferred: DeferredUpkeepTest[] = [];
      const upkeepLines = runDailyUpkeep(get, set, { onDeferTest: (t) => deferred.push(t) });
      if (upkeepLines.length) pushReveal(set, { kind: 'round', title: 'Entretien quotidien', lines: upkeepLines, severity: 'minor' });
      // La file porte des BANDES comme tout le reste de la nuit (#1117 L3) : la fenêtre est formée
      // ICI, à l'émission — `openCombatEndCascade` a seulement à trier ses rangées par pilote.
      const steps = nightBands(restFlow.deferredUpkeepSteps(get().party, deferred));
      if (steps.length) set({ deferredUpkeepQueue: [...get().deferredUpkeepQueue, ...steps] });
    } else {
      const deferred: DeferredUpkeepTest[] = [];
      const upkeepLines = runDailyUpkeep(get, set, { onDeferTest: (t) => deferred.push(t) });
      // 2ᵉ des TROIS bâtisseurs à passer par la fabrique de bandes (#1117 L3).
      const steps = nightBands(restFlow.deferredUpkeepSteps(get().party, deferred));
      if (steps.length) openSequence(get, set, { title: 'Entretien quotidien', icon: 'time/night', purpose: 'upkeep', steps, log: upkeepLines });
      // Même `purpose:'upkeep'` que la branche à jets ci-dessus : les deux issues du MÊME entretien
      // quotidien ouvrent la MÊME séquence (le témoin groupé est le cas « zéro jet à influencer »).
      else if (upkeepLines.length) pushReveal(set, { kind: 'round', title: 'Entretien quotidien', lines: upkeepLines, severity: 'minor' }, { purpose: 'upkeep' });
    }
    checkPartyWiped(get, set); // faim/agonie/maladie a-t-elle anéanti tout le groupe hors combat ? → défaite (recheck à la clôture de cascade)
  },
  // « Dormir » : sommeil de `days` journée(s) (défaut 1) — récup. (Exténué/Blessures) + cauchemars (LDB 16/18/21).
  restParty: (days = 1) => { restFlow.sleepParty(get, set, days); },

  // ── Voyage & nourriture (#T2) ──
  openWorldMap: () => { if (!get().battle && get().worldMap) set({ worldMapOpen: true }); },
  closeWorldMap: () => set({ worldMapOpen: false }),
  setGameMenu: (open) => set({ gameMenuOpen: open }),
  startTravel: (routeId, mode, opts) => travelFlow.startTravel(get, set, routeId, mode, opts),
  startBilletBargain: (routeId, vehicule) => billetFlow.startBilletBargain(get, set, routeId, vehicule),
  resumeTravel: () => travelFlow.resumeTravel(get, set),
  departWaitDawn: () => travelFlow.departWaitDawn(get, set),
  departCancel: () => set({ pendingDeparture: null }),
  setVoyageCadence: (cadence) => { const p = get().travelPlan; if (p) set({ travelPlan: { ...p, orders: { ...(p.orders ?? DEFAULT_VOYAGE_ORDERS), cadence } } }); },
  openPort: () => portFlow.openPort(get, set),
  closePort: () => portFlow.closePort(get, set),
  portBuyCargo: (cargoId, enc) => portFlow.portBuyCargo(get, set, cargoId, enc),
  portSellCargo: (cargoIndex) => portFlow.portSellCargo(get, set, cargoIndex),
  portDumpCargo: (cargoIndex) => portFlow.portDumpCargo(get, set, cargoIndex),
  portRepair: () => seaVoyageFlow.portRepairVessel(get, set).forEach((l) => get().log(l)),
  portCareen: () => seaVoyageFlow.portCareenVessel(get, set).forEach((l) => get().log(l)),
  portInstallUpgrade: (traitId, units) => seaVoyageFlow.portInstallUpgrade(get, set, traitId, units).forEach((l) => get().log(l)),
  portHireCrew: (roleId, count) => portFlow.portHireCrew(get, set, roleId, count),
  portDismissCrew: (roleId, count) => portFlow.portDismissCrew(get, set, roleId, count),
  openLandMarket: () => landMarketFlow.openLandMarket(get, set),
  closeLandMarket: () => landMarketFlow.closeLandMarket(get, set),
  landBuyCargo: (cargoId, enc) => landMarketFlow.landBuyCargo(get, set, cargoId, enc),
  landSellCargo: (carrierId, cargoIndex) => landMarketFlow.landSellCargo(get, set, carrierId, cargoIndex),
  landDumpCargo: (carrierId, cargoIndex) => landMarketFlow.landDumpCargo(get, set, carrierId, cargoIndex),
  moveCargo: (fromId, toId, cargoId, enc) => landMarketFlow.moveCargo(get, set, fromId, toId, cargoId, enc),
  gatherInnInfo: () => innFlow.gatherInnInfo(get, set),
  landEvalWine: (cargoId) => landMarketFlow.landEvalWine(get, set, cargoId),
  seaActivitiesConfirm: (picks) => seaActivities.seaActivitiesConfirm(get, set, picks),
  resolveManannPriest: (pay) => seaVoyageFlow.resolveManannPriest(get, set, pay),
  resolveShoreLeave: (allow) => seaVoyageFlow.resolveShoreLeave(get, set, allow),
  setTravelRole: (heroId, role) => { if (!role || postingTenu(role)) set((s) => ecrireActeur(s, heroId, (h) => ({ ...h, travelRole: role ?? undefined }))); },
  setShipRole: (crewId, role) => set((s) => ecrireActeur(s, crewId, (c) => ({ ...c, shipRole: role || undefined }))),
  setShipStation: (crewId, station) => set((s) => ecrireActeur(s, crewId, (c) => ({ ...c, shipStation: station || undefined }))),
  setPosteAmmo: (shipId, posteUid, ammoUid) => {
    const b = get().battle;
    const ship = inBattleId(b, shipId);
    const poste = ship?.postes?.find((p) => p.item.uid === posteUid);
    if (!b || !poste) return;
    // Le poste est PARTAGÉ par référence avec `mannedPoste` du chef (serveChef) → muter la même instance
    // suffit ; le `set` re-render (pattern combat : mutation + refresh).
    // La munition se fixe au CHARGEMENT — arbitrage utilisateur 2026-08-16 par AskUserQuestion, verbatim de la demande qui
    // l'ouvre : « on doit pouvoir choisir ses munitions avec nos armes de tir facilement depuis sa barre
    // d'action ». Changer celle d'une pièce CHARGÉE la DÉCHARGE — Test étendu de
    // recharge à refaire (LDB 62 l.335) ; re-sélectionner la même est sans effet ; rien n'est détruit (décompte
    // au tir). Le CHEF qui la sert perd aussi son gate de tir : la pièce n'a plus de coup.
    if (poste.loaded !== false && (poste.loadedAmmoUid ?? poste.ammoUid) !== (ammoUid ?? undefined)) {
      const chef = poste.crewIds?.[0] ? inBattleId(b, poste.crewIds[0]) : undefined;
      const gun = chef?.mannedPoste === poste ? chef.weapons.find((w) => w.uid === poste.item.uid) : undefined;
      unloadWeapon(gun ? chef : undefined, gun, poste); // couture UNIQUE : la pièce, et l'arme dérivée du chef
    }
    setAmmoChoice(undefined, undefined, ammoUid ?? undefined, poste); // écrivain UNIQUE de la sélection
    set({ battle: { ...b } });
  },
  /** Acquitte le récit de voyage. Une EMBUSCADE différée (`recap.then`) se déclenche ICI :
   *  le joueur a lu ce qui lui arrive, le combat démarre — fermer la modale (bouton/Échap)
   *  ne l'évite pas, et `resumeTravel` refuse tant qu'elle n'est pas acquittée. */
  dismissTravelRecap: () => {
    const recap = get().travelRecap;
    set({ travelRecap: null });
    const then = recap?.then;
    if (!then || get().battle) return;
    if (then.kind === 'effects') {
      jouerFlowEntier(applyEffectsLoot(get, set, then.effects, t('eff.flowTitleDiscovery'))); // trouvaille d'étape de voyage → fenêtre aussi
    } else {
      get().transitionTo(then.scene, then.entry);
      get().startCombat(then.encounter, undefined, { noSurprise: then.noSurprise });
      // Vol terrestre (#327) : cette embuscade terrestre met la cargaison du convoi en jeu — la
      // perte GRADUÉE se dénoue au teardown de combat. Posé APRÈS startCombat (le reset `combatStart`
      // n'efface donc pas le marqueur).
      if (get().battle) set({ cargoRaid: true });
    }
  },
}));

// Plateforme web du noyau (#2817, D6) : ses appels différés passent par le registre tracé de
// `web/minuteries` (#405, #415), son héros persisté par le roster. Son jeton est l'id du timer tracé :
// le noyau ne le reçoit que de `programmer` et ne le rend qu'à `enAttente`, d'où la seule conversion
// vers le jeton à marque.
const plateformeWeb: PlateformeDe<ReturnType<typeof scheduleCombatTimer>> = {
  programmer: scheduleCombatTimer,
  enAttente: timerEnVol,
  persisterLeHeros: rosterUpdate,
};
poserLaPlateforme(plateformeWeb as unknown as Plateforme);

/** Branche l'auto-cadence de combat sur le store (une fois au démarrage, `main.tsx`) ; rend son
 *  désabonnement. */
export function initCombatAuto(): () => void {
  return useGame.subscribe(() => planifierLeTickAuto(useGame.getState, useGame.setState));
}

// #668 — `fireScheduledEffects` tire les minuteries `delayedEffect` sur CHAQUE avance d'horloge, quel
// que soit le chemin (advanceTime, rest, travel, sea émettent tous EVT.TIME_ADVANCED) — seam UNIQUE,
// plus de dépendance à advanceTime seul (bug de recette : repos/voyage sautaient les échéances).
bus.on(EVT.TIME_ADVANCED, () => fireScheduledEffects(useGame.getState, useGame.setState));

// MÊME couture pour la DISSIPATION des effets à durée d'horloge : `runDailyUpkeep` ne la portait plus
// seul — le voyage terrestre (`travelFlow`) et la journée de mer (`seaVoyageFlow`) avancent l'horloge
// et DIFFÈRENT l'entretien à la cascade de nuit, si bien qu'une fenêtre échue y survivait à sa borne.
bus.on(EVT.TIME_ADVANCED, () => purgeSurAvanceDHorloge(useGame.getState, useGame.setState));

// Nouveau héros demandé par un Effet de scène : l'assistant s'ouvre sur une fiche vierge.
bus.on(EVT.HEROS_A_CREER, () => {
  const s = useGame.getState();
  s.setEditingHero(null);
  s.setScreen('creator');
});

// ── OCCUPATION AU RUNTIME — LA CHAISE SUIT LE CORPS ────────────────────────────────────────────
// COUTURE UNIQUE, et PAR CONSTRUCTION : elle ne s'accroche pas aux écrivains de `party` (un seul
// oublié rouvrirait le défaut), elle observe la TRANSITION d'état. Tout ce qui recompose le groupe
// — `partyAddHero`/`partyRemoveHero`/`partyReplaceHero`, `setParty` en bloc, devtools, un écran de
// test, un snapshot coop, une permutation écrite à la main — y passe sans le savoir : le corps
// présent à chaque emplacement ASSIS est comparé avant/après, et l'emplacement dont le corps a
// changé (ou disparu) se lève.
// Ce qui décide n'est PAS la scène (une scène patchée dans la même écriture reste la même partie),
// c'est l'OCCUPATION EN VIGUEUR : on réconcilie quand l'écriture n'a pas apporté une occupation
// NEUVE. Une occupation neuve — chargement de save, `startScene`, `transitionTo`, snapshot coop,
// élagage, geste d'assise — arrive avec sa propre vérité, déjà élaguée à sa source ; il n'y a alors
// rien à réconcilier. C'est aussi ce qui rend la réentrance structurelle : l'écriture de libération
// ci-dessous produit une occupation neuve, donc ne se rejoue pas.
// Le même abonnement applique ENSUITE la péremption du curseur (`curseurPerime`).
useGame.subscribe((s, prev) => {
  const scene = s.scene;
  if (s.party !== prev.party && scene?.seatAssignments && scene.seatAssignments === prev.scene?.seatAssignments) {
    const debout = releaseRecomposedRanks(scene, prev.party, s.party);
    if (debout !== scene) useGame.setState({ scene: debout });
  }
  if (curseurPerime(prev, s) && useGame.getState().combatCursor) useGame.setState({ combatCursor: null });
});
