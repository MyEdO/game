/**
 * Store central (Zustand) — relie l'UI React et le rendu (SVG iso).
 * Gère les écrans, le groupe, l'exploration de scène, les dialogues et le
 * combat tactique au tour par tour (règles via src/engine).
 */
import { create } from 'zustand';
import { creerActionsDuCurseur, curseurPerime, screenStepDot, type CombatCursor, type ScreenDir } from './combatCursor';
import { t } from '../i18n';
import { viewYawDeg } from './stageYaw';
import { resetStagePan } from './stagePan';
import { resetStageGestes } from './stageGestes';
import * as netFlow from './netFlow';
import { snapshotSave, saveToSlot, readSlot, importSave, AUTO_SLOT, type SaveSlot, type AnySlot, type SaveGame } from './saves';
import { loadKeyOverrides, saveKeyOverrides } from './keybindingsPrefs';
import { pruneSeatAssignments } from '../noyau/monde/seating';
import { transitionDuJeu } from '../noyau/transitionDuJeu';
import type { CodexFocus } from './codexFocus';
import { ruleOverrides, loadRuleOverrides } from '../engine/policy';
import { meneurDuMonde } from '../noyau/monde/combatants';
import { buildRollFlowActions, creerActionsDuJetDActivite } from '../noyau/rollFlowSpecs';
import { poserLaPlateforme, type Plateforme, type PlateformeDe } from '../noyau/plateforme';
import { scheduleCombatTimer, timerEnVol } from '../web/minuteries';
import { rosterUpdate } from './roster';
import { planifierLeTickAuto } from '../noyau/combatAuto';
import type { Scene } from '../noyau/monde/scene';
import { exploreStepDest } from '../noyau/monde/exploreNav';
import { bus, EVT } from '../noyau/bus';
import { createCombatSlice } from '../noyau/combatSlice';
import { brancherLeJeu } from '../noyau/branchement';
import { graineDEntropie } from '../web/entropie';
import { tablesDuJeu } from '../noyau/tablesDuJeu';
import { reposerPaquetDeCampagne } from '../noyau/monde/registreDesScenes';
import { etatInitialDuJeu, type CampaignDoc, type Ecran, type Jeu } from '../noyau/etat';
import { creerActionsDOrientation } from '../noyau/orientation';
import { creerActionsDeManoeuvre } from '../noyau/shipManeuver';
import { creerActionsDuChapitre } from '../noyau/chapitreRecap';
import { creerActionsDeCampagne } from '../noyau/campagne';
import { creerActionsDeVision } from '../noyau/visionState';
import { creerActionsDEntreeEnScene } from '../noyau/entreeEnScene';
import { creerActionsDInterlude } from '../noyau/interludeFlow';
import { creerActionsDeBatailleDeMasse } from '../noyau/massBattleFlow';
import { creerActionsDesFaveurs } from '../noyau/favorFlow';
import { creerActionsDuGroupe } from '../noyau/partyFlow';
import { creerActionsDesPossessions } from '../noyau/possessionsFlow';
import { creerActionsDeMarche } from '../noyau/marcheDuGroupe';
import { creerActionsDeFranchissement } from '../noyau/gesteDArete';
import { creerActionsDInteraction } from '../noyau/interactionsDExploration';
import { creerActionsDeConversation } from '../noyau/conversation';
import { creerActionsDuMarchand } from '../noyau/merchantFlow';
import { creerActionsDeTaverne } from '../noyau/tavernFlow';
import { creerActionsDesDes, seedBattleRng } from '../noyau/battleRng';
import { creerActionsDIssueDeCombat } from '../noyau/issueDeCombat';
import { creerActionsDuMedecin } from '../noyau/medicFlow';
import { creerActionsDuRepos } from '../noyau/restFlow';
import { creerActionsDeLEquipage } from '../noyau/shipCrew';
import { creerActionsDesConsommables } from '../noyau/consumableFlow';
import { creerActionsDesTestsDeScene } from '../noyau/testsDeScene';
import { creerActionsDuLotDEtal } from '../noyau/etalLotFlow';
import { creerActionsDeCorruption } from '../noyau/corruptionFlow';
import { creerActionsDuJournal } from '../noyau/journal';
import { creerActionsDAvanceeDHorloge, creerActionsDHorloge } from '../noyau/horloge';
import { creerActionsDuVoyage } from '../noyau/travelFlow';
import { creerActionsDesPostesDeVoyage } from '../noyau/travelPostes';
import { creerActionsDuBillet } from '../noyau/billetFlow';
import { creerActionsDuPort } from '../noyau/portFlow';
import { creerActionsDuVoyageEnMer } from '../noyau/seaVoyageFlow';
import { creerActionsDuMarcheTerrestre } from '../noyau/landMarketFlow';
import { creerActionsDeLAuberge } from '../noyau/innFlow';
import { creerActionsDesActivitesEnMer } from '../noyau/seaActivities';
import { tableTotale } from '../lib/tableTotale';

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
  // `keyOverrides` : la préférence de touches du joueur prime sur celle figée dans la save (#2817 D5).
  // ASSISE : la scène persistée peut porter des places dont le meuble, le slot ou le héros n'existent
  // plus dans CE snapshot (paquet de campagne édité, groupe recomposé) — élaguée AVANT d'entrer en
  // état, par la même source unique que la superposition de mutation.
  // Une scène qui n'a jamais porté d'assise n'en gagne pas le champ (même invariant que le seam
  // d'authoring `normaliseAssises`) : rien à élaguer, rien à écrire.
  const chargee = data.scene as Scene | null | undefined;
  const scene = chargee?.seatAssignments
    ? { ...chargee, seatAssignments: pruneSeatAssignments(chargee, (data.party ?? []).length) }
    : chargee;
  const { net, keyOverrides } = useGame.getState();
  set({ ...base, ...data, ...(chargee ? { scene } : {}), screen: 'campaign', net, keyOverrides });
  set(reposerPaquetDeCampagne(data.campaignDoc as CampaignDoc | null | undefined));
  // Règles maison de la save : on les applique au registre (parité avec la partie sauvegardée).
  loadRuleOverrides(save.rules);
  bus.emit(EVT.SCENE_DIRTY);
}

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

/** Valeurs initiales de l'état d'interface, hors `keyOverrides` (préférence lue au stockage). */
export function etatInitialDeLAdaptateur(): Omit<EtatDeLAdaptateur, 'keyOverrides'> {
  return {
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
    editingHeroId: null,
    gameMenuOpen: false,
    codexOverlay: null,
    compendiumFocus: null,
    compendiumReturn: 'menu',
    possessionsScreen: null,
    combatCursor: null,
  };
}

/** Remis à chaque entrée en scène : la scène se regarde depuis son cran diagonal (#1289) et son centre. */
const REMIS_A_CHAQUE_ENTREE = ['camEdge', 'camPan'] as const;
/** Gardés d'une partie à l'autre : préférences de vue et de touches (#2817 D5). Une partie neuve remet
 *  TOUT le reste de l'état d'interface, dérivé de `etatInitialDeLAdaptateur`. */
export const GARDES_D_UNE_PARTIE_A_L_AUTRE: readonly (keyof EtatDeLAdaptateur)[] = ['camRot', 'zoom', 'viewMode', 'povActive', 'keyOverrides'];

/** Remise de l'interface à l'entrée en scène (`EVT.ARRIVEE_EN_SCENE`, #2817 D5) ; les gestes VIVANTS
 *  (`stageGestes`) aussi : aucune marche tenue de l'écran précédent n'y commet de pas. */
function remettreLAdaptateur(neuve: boolean): void {
  const init = etatInitialDeLAdaptateur();
  const cles = neuve
    ? (Object.keys(init) as (keyof typeof init)[]).filter((k) => !GARDES_D_UNE_PARTIE_A_L_AUTRE.includes(k))
    : REMIS_A_CHAQUE_ENTREE;
  useGame.setState(tableTotale(cles, (k) => init[k]) as Partial<EtatDeLAdaptateur>);
  resetStageGestes();
}

export const useGame = create<GameState>((set, get) => ({
  ...createCombatSlice(get, set),
  ...creerActionsDuCurseur(get, set),
  // Les délégués de jet (mono et multi), dérivés de `FLOW_WIRING`.
  ...buildRollFlowActions(get, set),
  ...creerActionsDuJetDActivite(get, set),
  ...creerActionsDOrientation(get, set),
  ...creerActionsDeManoeuvre(get, set),
  ...creerActionsDuChapitre(get, set),
  ...creerActionsDeCampagne(get, set),
  ...creerActionsDeVision(get, set),
  ...creerActionsDEntreeEnScene(get, set),
  ...creerActionsDInterlude(get, set),
  ...creerActionsDeBatailleDeMasse(get, set),
  ...creerActionsDesFaveurs(get, set),
  ...creerActionsDuGroupe(get, set),
  ...creerActionsDesPossessions(get, set),
  ...creerActionsDeMarche(get, set),
  ...creerActionsDeFranchissement(get, set),
  ...creerActionsDInteraction(get, set),
  ...creerActionsDeConversation(get, set),
  ...creerActionsDuMarchand(get, set),
  ...creerActionsDeTaverne(get, set),
  ...creerActionsDesDes(get, set),
  ...creerActionsDIssueDeCombat(get, set),
  ...creerActionsDuMedecin(get, set),
  ...creerActionsDuRepos(get, set),
  ...creerActionsDeLEquipage(get, set),
  ...creerActionsDesConsommables(get, set),
  ...creerActionsDesTestsDeScene(get, set),
  ...creerActionsDuLotDEtal(get, set),
  ...creerActionsDeCorruption(get, set),
  ...creerActionsDuJournal(get, set),
  ...creerActionsDAvanceeDHorloge(get, set),
  ...creerActionsDHorloge(get, set),
  ...creerActionsDuVoyage(get, set),
  ...creerActionsDesPostesDeVoyage(get, set),
  ...creerActionsDuBillet(get, set),
  ...creerActionsDuPort(get, set),
  ...creerActionsDuVoyageEnMer(get, set),
  ...creerActionsDuMarcheTerrestre(get, set),
  ...creerActionsDeLAuberge(get, set),
  ...creerActionsDesActivitesEnMer(get, set),
  ...etatInitialDuJeu(),
  ...etatInitialDeLAdaptateur(),
  keyOverrides: loadKeyOverrides(),
  rotateCam: (dir) => {
    // Re-centre sur le point focal à chaque cran : sinon le décalage manuel (camPan) persiste à
    // travers le changement de projection (coin↔face, origines très différentes) → vue « téléportée ».
    // Le décalage VIVANT tombe avec lui (`resetStagePan`) : c'est lui que la frame lit, et un geste
    // en cours doit se recaler dessus au lieu de le contredire.
    resetStagePan();
    set((s) => ({ camEdge: false, camRot: (((s.camRot + (dir === 1 ? 1 : 3)) % 4) as 0 | 1 | 2 | 3), camPan: { x: 0, y: 0 } }));
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

  netHostStart: (name) => netFlow.netHostStart(get, set, name),
  netJoin: (code, name) => netFlow.netJoin(get, set, (data) => netFlow.applyNetSnapshot(set, data), code, name),
  netAssign: (heroId, seat) => netFlow.netAssign(get, set, heroId, seat),
  setGmSeat: (seat) => netFlow.setGmSeat(get, set, seat),
  netAssignSlot: (slot, seat) => netFlow.netAssignSlot(get, set, slot, seat),
  netLeave: () => netFlow.netLeave(get, set),

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
  setGameMenu: (open) => set({ gameMenuOpen: open }),
}));

// Le jeu branché sur son propriétaire, le store (#2889, D7).
brancherLeJeu(useGame.getState, useGame.setState, tablesDuJeu());

// Les dés de la partie, semés d'entropie par l'hôte (#2817, D8).
seedBattleRng(graineDEntropie());

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

// Entrée en scène (#2817 D5) : l'interface se remet, puis le changement de scène pose le point de reprise
// (`autoSave`, hors combat et jamais chez l'invité).
bus.on(EVT.ARRIVEE_EN_SCENE, ({ neuve }: { sceneId: string; neuve: boolean }) => {
  remettreLAdaptateur(neuve);
  if (!neuve) useGame.getState().autoSave();
});

// Nouveau héros demandé par un Effet de scène : l'assistant s'ouvre sur une fiche vierge.
bus.on(EVT.HEROS_A_CREER, () => {
  const s = useGame.getState();
  s.setEditingHero(null);
  s.setScreen('creator');
});

// Transition du jeu (`transitionDuJeu`, #2817 D7), puis péremption du curseur (`curseurPerime`).
useGame.subscribe((s, prev) => {
  const ecriture = transitionDuJeu(prev, s);
  if (ecriture) useGame.setState(ecriture);
  if (curseurPerime(prev, s) && useGame.getState().combatCursor) useGame.setState({ combatCursor: null });
});
