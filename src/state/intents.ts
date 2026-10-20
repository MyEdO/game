/**
 * Allowlist des actions de store qu'un INVITÉ peut demander (intents) — périmètre : LE COMBAT
 * (portée V1 : seule la partie combat est jouée côté invité ; l'exploration est un miroir de
 * l'hôte, hors le CARNET D'ENQUÊTE : épingle de groupe et nouveauté vue par siège, #670) + la
 * COMPOSITION DU GROUPE (chaque joueur remplit les emplacements que l'hôte lui a attribués) + les
 * ACTIVITÉS D'INTERLUDE de SES héros (audit POC→produit M7 : « Entre deux aventures » est par
 * nature individuel — chaque joueur mène les Activités de ses personnages ; ouvrir/CLORE l'interlude
 * reste l'hôte) + TOUT FLUX DE JET MONO à porteur (#1017) : dès que le porteur d'un jet peut être
 * le héros d'un autre siège, ses verbes d'influence lui sont ouverts, qu'il roule en combat, en
 * voyage, à l'auberge ou chez le marchand — c'est la POSSESSION qui tranche la dépense
 * (`netOwnership.intentAllowedFor`), jamais la liste. Tout le reste (sauvegarde, voyage, ÉCRANS
 * marchand/éditeur, persistance) est refusé par l'hôte.
 *
 * TOUTE action du store a sa classe coop (#2724) :
 *  - les délégués `<prefix><Verbe>` des flux de jet à surface DÉRIVÉE (tout mono, tout multi
 *    `coop: true`) ET leurs actions de `resolution` : classe dérivée de `FLOW_VERBS`
 *    (`coopFlowIntents`) — un flux mono ajouté à la table n'a AUCUNE ligne à écrire ici ;
 *  - toute autre action : une entrée de `CLASSE_DES_ACTIONS`, table TOTALE sur `ActionManuscrite` —
 *    une action ajoutée au store sans classe ne compile pas. Une action `<prefix><Maj>…` d'un flux de
 *    jet y est `invité` par le type (#1017, #1050), hors ouvreur `parHote`, élection locale, délégué
 *    et `resolution` d'un flux multi sans `coop` (`flowVerbs.FlowVerbs.coop`).
 * `invité` = l'invité la DEMANDE à l'hôte (`netFlow` l'enrobe) ; `hôte` = écran ou décision pilotés
 * par l'hôte ; `local` = état d'écran du client, jamais un intent ; `interne` = machinerie qu'aucun
 * écran (`src/ui`, `src/gameIso`) n'émet (garde `intents.test.ts`, #1050). Chez l'invité, une action
 * hors allowlist s'exécute dans son store (`netFlow` n'enrobe que l'allowlist).
 */
import { coopFlowIntents, type FLOW_VERBS } from '../noyau/flowVerbs';
import type { HORS_MODAL } from '../noyau/modalArbiter';
import type { GameState } from './store';

export type ClasseCoop = 'invité' | 'hôte' | 'local' | 'interne';

type Table = typeof FLOW_VERBS;
type VerbeDe<W> = W extends { verbs: readonly (infer V extends string)[] } ? V : never;
type ResolutionDe<W> = W extends { resolution: readonly (infer R)[] } ? R : never;
/** Flux de `T` à surface DÉRIVÉE (`coopFlowIntents`) : tout mono, tout multi `coop: true`. */
type FluxDerive<T> = { [K in keyof T]: T[K] extends { kind: 'mono' } | { coop: true } ? K : never }[keyof T] & string;
/** Délégués `<prefix><Verbe>` et actions de `resolution` des flux `F` de `T`. */
type ActionDeFlux<T, F extends keyof T & string> = { [K in F]: `${K}${Capitalize<VerbeDe<T[K]>>}` | ResolutionDe<T[K]> }[F];
type ActionDerivee<T> = ActionDeFlux<T, FluxDerive<T>>;
/** Délégués et `resolution` d'un flux multi SANS `coop` : surface non dérivée, classe libre. */
type ActionNonCoop<T> = ActionDeFlux<T, Exclude<keyof T & string, FluxDerive<T>>>;

/** Actions d'un état de store `S` dont la classe coop s'ÉCRIT (hors surface dérivée des flux de `T`). */
export type ActionManuscrite<S = GameState, T = Table> = Exclude<
  { [K in keyof S]-?: NonNullable<S[K]> extends (...args: never[]) => unknown ? K : never }[keyof S],
  ActionDerivee<T>
>;

type Majuscule = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H' | 'I' | 'J' | 'K' | 'L' | 'M' | 'N' | 'O' | 'P' | 'Q'
  | 'R' | 'S' | 'T' | 'U' | 'V' | 'W' | 'X' | 'Y' | 'Z';
type Minuscule = Lowercase<Majuscule>;
/** Site qui pose un flux sans action de store : `<module>.<fonction>`. */
export type SiteInterne = `${string}${Minuscule}.${Minuscule}${string}`;

/**
 * Élections LOCALES d'écran (`targetingModes.TargetingMode.electionLocale`) : l'action n'écrit que le
 * champ nommé, hors snapshot (`netFlow.netSnapshot`) ; le COMMIT qui suit est exposé.
 */
const ELECTIONS_LOCALES = { dispelSelectCarrier: 'dispelCarrierId' } as const satisfies { [A in ActionManuscrite]?: keyof GameState };

/** Classe qu'une action manuscrite de `T` peut prendre. */
type ClasseAdmise<A, T> = A extends OuvreurParHote ? 'hôte'
  : A extends keyof typeof ELECTIONS_LOCALES ? 'local'
  : A extends ActionNonCoop<T> ? ClasseCoop
  : A extends `${keyof T & string}${Majuscule}${string}` ? 'invité'
  : ClasseCoop;

/** Table TOTALE des classes coop d'un état de store `S` (flux de jet `T`). */
export type TableDesClasses<S = GameState, T = Table> = { [A in ActionManuscrite<S, T>]: ClasseAdmise<A, T> };

export const CLASSE_DES_ACTIONS = {
  // ═══ invité : COMBAT (gestes de tour/hotbar, paramètres pré-jet, OUVREURS de flux) ═══
  // tour, ciblage, déplacement tactique
  // `armEndTurn` = 1er temps du garde-fou « tour gâché » : l'armement vit dans `battle` (état d'hôte),
  // donc l'invité le DEMANDE comme tout geste de son tour — sinon son 1er appui serait sans effet.
  battleClickEntity: 'invité', battleClickTile: 'invité', battleEndTurn: 'invité',
  armEndTurn: 'invité', cancelMove: 'invité', battleSelectAction: 'invité',
  // actions de la hotbar — rendues dès `controlsCombatant` (le combattant ACTIF), et autorisées par
  // le REPLI universel de `intentAllowedFor` (aucune modale ouverte → le propriétaire de l'actif).
  battleAim: 'invité', battleDefendTotal: 'invité', battleDisengage: 'invité', battleRun: 'invité',
  battleFrenzy: 'invité', battleFocusSpell: 'invité', battleHeal: 'invité', battleReload: 'invité',
  battleRecoverState: 'invité',
  battleStandUp: 'invité', battlePickup: 'invité', battleUseItem: 'invité',
  battleSelectSpell: 'invité', battleSelectAmmo: 'invité',
  battleSpendResolve: 'invité', battleTogglePushback: 'invité', battleToggleStance: 'invité',
  battleSwitchLoadout: 'invité', battleMount: 'invité',
  battleDismount: 'invité', battleResolveIgnoreCrit: 'invité', battleResolvePsychImmune: 'invité',
  battleSelfManeuver: 'invité', battleGainAdvantage: 'invité', battleSelectAttack: 'invité',
  battleManeuverArea: 'invité',
  // Postes de bord / arme d'équipe / engin de siège : même hotbar, même possession (l'actif).
  battleShipReload: 'invité', battleManPoste: 'invité', battleLeavePoste: 'invité',
  battleWater: 'invité', battlePushEngine: 'invité',
  battleAidTeam: 'invité',
  spendResolveCondition: 'invité',
  // Escalade d'une arête (capacité `escalade`) : jumeau de `fallAcross`, même possession (l'actif).
  climbAcross: 'invité',
  // Enjambement d'une croisée (capacité `fenetre`, #700) : même possession (l'actif), aucun jet.
  windowAcross: 'invité',
  // attaque : paramètres de la modale différée + jet/appliquer propres au flux d'attaque
  attackSetLocation: 'invité', attackSetWeapon: 'invité', attackSetDualMode: 'invité',
  attackSetWithhold: 'invité', attackSetHarpoonRopeCut: 'invité', attackSetGrapple: 'invité',
  attackSetCritLocation: 'invité', attackRoll: 'invité', attackConfirm: 'invité',
  // défense réactive : choix de mode/arme/réaction de bouclier + appliquer
  defenseSetMode: 'invité', defenseSetParryWeapon: 'invité', defenseSetShieldReaction: 'invité',
  defenseSetRiposte: 'invité', defenseConfirm: 'invité',
  // incantation / prière : options d'incantation + jet/appliquer/annuler
  castRoll: 'invité', castSetCritChoice: 'invité', castSetConjureForm: 'invité',
  castSetDiscreet: 'invité',
  castAllocOvercast: 'invité', castSetChosenTableRolls: 'invité', castToggleExtraTarget: 'invité',
  castPickTargets: 'invité',
  castPlaceZone: 'invité', castConfirm: 'invité', castCancel: 'invité',
  // Contre-sort / opposition de cible : « tout lancer » des rangées de CE siège (verbe NULLAIRE du
  // drive d'auto-cadence, `combatAuto.STEP_WINDOW_AUTO`). Les résolutions (`xConfirm`/`xCancel`) sont
  // DÉRIVÉES de `FLOW_VERBS.resolution` (#1050), plus recopiées ici.
  counterspellRollAll: 'invité', oppositionRollAll: 'invité',
  // PHASE 1 du Contre-sort (#1042/#1059) : chaque candidat DÉCLARE depuis SA RANGÉE (contrer seul /
  // s'unir / passer) — contribution de table routée par la possession de son porteur (patron #1050) ;
  // `counterspellDeclareAll` est le verbe NULLAIRE du drive d'auto-cadence, comme `counterspellRollAll`.
  counterspellDeclare: 'invité', counterspellDeclareAll: 'invité',
  // Cascade séquentielle (jets de nuit / voyage influençables) : choix / SAISIE d'une quantité
  // (#1279 Sf, jumeau du choix) / tirage sur table (avance et clôture = `resolution` du flux, dérivées).
  cascadeChoose: 'invité', cascadeAmount: 'invité', cascadeTableRoll: 'invité',
  // Mode table (#942 L3) : poser le dé d'une étape à table (champ ou clic sur une ligne) — autorisé par la
  // possession du siège ÉMETTEUR (`intentAllowedFor`) ; l'option « Dés fixés » est CLIENT-SIDE.
  cascadeTableSetForcedRoll: 'invité',
  // DÉ NU (#1508) : les deux mêmes verbes pour l'autre lecture du même dé — même routage de possession.
  cascadeDieRoll: 'invité', cascadeDieSetForcedRoll: 'invité',
  // désengagement : ouverture, jet, appliquer/fuir/annuler
  disengageConfirmA: 'invité', disengageRoll: 'invité', disengageConfirm: 'invité',
  disengageFlee: 'invité', disengageCancel: 'invité',
  // « Au Contact » (LDB 62 l.176) : ouverture, jet, choix du vainqueur
  battleAuContact: 'invité', auContactRoll: 'invité', auContactConfirm: 'invité',
  auContactChoose: 'invité', auContactCancel: 'invité',
  // Empoignade (LDB 14 l.161) : ouverture, « Briser », jet, choix du vainqueur
  battleGrapple: 'invité', grappleBreak: 'invité', grappleRoll: 'invité', grappleConfirm: 'invité',
  grappleChoose: 'invité', grappleCancel: 'invité',
  // combat monté
  mountTargetSelect: 'invité', mountTargetCancel: 'invité',
  // résolutions/annulations des flux de jet en combat (le verbe de jet est dérivé, pas l'appliquer)
  maneuverConfirm: 'invité', maneuverCancel: 'invité', maneuverSetAvantage: 'invité',
  // Tour de NAVIRE (couche Mer, MDG 13-14) : le contrôleur de la coque OUVRE ; CHAQUE participant
  // (héros à un rôle) roule SA rangée, routée par la possession de son id (cf. `intentAllowedFor`,
  // primitive multi `RollParticipant`). Les résolutions sont DÉRIVÉES (`FLOW_VERBS.resolution`).
  battleShipManeuver: 'invité', shipManeuverSetTurn: 'invité',
  battleShipBattery: 'invité',
  battleCrewTest: 'invité',
  runConfirm: 'invité', runCancel: 'invité', focusConfirm: 'invité', focusCancel: 'invité',
  wardConfirm: 'invité', wardCancel: 'invité',
  frenzyConfirm: 'invité', frenzyCancel: 'invité', reloadConfirm: 'invité', reloadCancel: 'invité',
  handGateConfirm: 'invité', handGateCancel: 'invité', recoverConfirm: 'invité',
  recoverCancel: 'invité',
  healSetMode: 'invité', healConfirm: 'invité', healCancel: 'invité',
  // Corruption (LDB 19 l.29) : choix de la nature de l'Influence AVANT le jet (le jet et son influence sont dérivés).
  corruptionSetNature: 'invité',
  // Manoeuvres d'arme et de mouvement (#1017) : OUVREUR + paramètre pré-jet + résolution ; le jet et
  // ses verbes d'influence sont dérivés de `FLOW_VERBS` (mono → routés par le porteur).
  battleBattement: 'invité', battementSetFoe: 'invité', battementConfirm: 'invité',
  battementCancel: 'invité',
  battleDistraire: 'invité', distraireSetFoe: 'invité', distraireConfirm: 'invité',
  distraireCancel: 'invité',
  // Chute volontaire (ouverte par `battleClickTile`) : trajet, DÉCLARATION de rangée (routée par le siège
  // du tombant, `netOwnership`). Les résolutions sont DÉRIVÉES (`FLOW_VERBS.resolution`).
  fallAcross: 'invité', fallChoose: 'invité',
  // Approche d'une source de Peur (ouverte par `battleClickTile`/`battleClickEntity`) : résolution.
  approachConfirm: 'invité', approachCancel: 'invité',
  // Contre-magie (LDB 46) : OUVREUR (réaction au sort adverse) + résolution du jet de dissipation.
  battleDispelSpell: 'invité', dispelConfirm: 'invité', dispelCancel: 'invité',
  // Chanson de marin (MDG 09) : OUVREUR + choix de la chanson + résolution.
  battleSingShanty: 'invité', shantySetSong: 'invité', shantyConfirm: 'invité', shantyCancel: 'invité',
  // Test de scène/compétence (`pendingTest`) : choix du LANCEUR parmi les candidats + application de
  // la branche réussite/échec. L'ouverture reste interne (`openSkillTest`, jamais une action de store).
  testSetActor: 'invité', resolveTest: 'invité',
  // Fuite de vapeur (MDG 12 l.326-328) : résolution de la sauvegarde d'Initiative.
  steamSaveConfirm: 'invité',
  // Infirmerie (hors combat) : patients / actes / chirurgie + fermeture — l'hôte valide.
  // Chirurgie : openSurgeryPass POSE la passe, les verbes surgery* dérivés l'influencent,
  // surgeryNext applique, surgeryPassCancel annule la passe, surgeryCancel l'opération — une passe
  // n'a AUCUN verbe de résolution inline.
  medicSelectPatient: 'invité', medicAct: 'invité', medicSetWound: 'invité', closeMedic: 'invité',
  openSurgeryPass: 'invité', surgeryNext: 'invité', surgeryPassCancel: 'invité',
  surgeryCancel: 'invité',
  // Repos (nuit) : chacun règle SES héros (restSet vise un héros, 1er argument) + ready-check.
  restSet: 'invité', restReady: 'invité',
  // (Psychologie de COMBAT et à la rencontre : passent par les intents `cascade*` dérivés.)
  fateNegate: 'invité', fateSurvive: 'invité', fateAccept: 'invité', fumbleRoll: 'invité',
  fumbleConfirm: 'invité',
  cleaveAttack: 'invité', cleaveEnd: 'invité', dualStrikeAttack: 'invité', dualStrikeSkip: 'invité',
  roundStartPromote: 'invité', confirmRoundStart: 'invité', roundStartReady: 'invité',
  renounceResolve: 'invité',
  // Tir rapide (Talent « Tir rapide ») pendant la pause de début de Round : ARMER la visée depuis la
  // frise, puis le tir lui-même (appelé par `battleClickEntity` chez l'hôte — exposé en défense en
  // profondeur). Les deux sont routés sur le TIREUR : pendant la pause il n'y a AUCUN combattant
  // actif (`turn: -1`), donc le repli universel les refusait à tout siège invité.
  armPreempt: 'invité', preemptRangedShot: 'invité',
  resolveCorruption: 'invité',
  // Demande de pause au prochain Round : POSER et RETIRER passent par le même chemin (interrupteur
  // de la frise) — une bascule dont un seul sens serait répliqué laisserait la table bloquée.
  victoryReady: 'invité', assignVictoryGear: 'invité', raiseHand: 'invité', lowerHand: 'invité',
  // ═══ invité : GROUPE — composition (chaque siège SES emplacements, tranchée par `ROUTES`) et carnet
  // d'enquête (#670, `TOUJOURS` : épingle de groupe, nouveauté vue par siège). L'hôte injecte le siège
  // autoritaire dans `partyAddHero` (netFlow) — jamais celui de l'invité. ═══
  partyAddHero: 'invité', partyRemoveHero: 'invité', partyReplaceHero: 'invité', toggleCluePin: 'invité',
  markCluesSeen: 'invité',
  // ═══ invité : INTERLUDE (LDB 23) — chaque Activité vise un héros (1er argument ou pending/dépôt),
  // possession validée par `intentAllowedFor`. ═══
  // `interludeActivity` = chemin UNIQUE de toutes les Activités à jet (Revenus/Artisanat/Apprentissage/
  // Identification + catalogue) ; `interludeCraftStart` engage l'ouvrage (setup, sans jet).
  interludeActivity: 'invité', interludeCraftStart: 'invité', interludeOrder: 'invité',
  interludeBank: 'invité', interludeWithdraw: 'invité',
  // Jet d'Activité : verbes DÉRIVÉS (flux mono `activity`) ; l'application et l'annulation sont des
  // actions de store hors `FLOW_VERBS`.
  activityConfirm: 'invité', activityCancel: 'invité',
  // ═══ hôte / local : émis par un écran ═══
  // ── Rendu / caméra / navigation d'écran : état local du client ────────────────────────────────
  setHovered: 'local', setHoverCombatant: 'local', setInspectId: 'local', clearCursor: 'local',
  // Élection LOCALE d'écran, hors réseau PAR CONSTRUCTION (même famille que `localIntent`) : le clic
  // qui élit le porteur du mode Dissiper n'engage rien — il ouvre le choix du Sort CHEZ CE JOUEUR.
  // `netFlow.emettreIntentInvite` le joue dans le store de l'émetteur et n'envoie aucun intent ; le
  // COMMIT, lui (`battleDispelSpell`), est exposé. Voyager le ferait naître chez l'HÔTE.
  dispelSelectCarrier: 'local', setCamPan: 'local', resetCamPan: 'local', setZoom: 'local',
  setScreen: 'local', setGameMenu: 'local', closeDocument: 'hôte', openCodex: 'local',
  closeCodexOverlay: 'local', setKeyBinding: 'local', resetKeyBindings: 'local', setSheetTab: 'local',
  setSheetScroll: 'local', setSheetId: 'local', setSheetAlarmsSeen: 'local', setEditingHero: 'local',
  openPossessionsScreen: 'local', closePossessionsScreen: 'local',
  // ── Exploration (miroir V1) ───────────────────────────────────────────────────────────────────
  markExplored: 'hôte', openWorldMap: 'hôte', closeWorldMap: 'hôte', startTravel: 'hôte',
  startBilletBargain: 'hôte', resumeTravel: 'hôte', departWaitDawn: 'hôte', departCancel: 'hôte',
  dismissTravelRecap: 'hôte', setVoyageCadence: 'hôte', transitionTo: 'hôte', fouillerLaPiece: 'hôte',
  // ── Fiche de personnage : progression (PX), équipement, sorts hors combat ─────────────────────
  buyCharAdvance: 'hôte', buySkillAdvance: 'hôte', buyTalent: 'hôte', buySpell: 'hôte',
  changeCareer: 'hôte', designateCareerSlot: 'hôte', trainProsthesis: 'hôte', buySpellComponent: 'hôte',
  removeSpellComponent: 'hôte', setHeroBackground: 'hôte', favorBreak: 'hôte', favorSettle: 'hôte',
  oocCastSpell: 'hôte', oocFocusSpell: 'hôte', oocDispelSpell: 'hôte', openMedic: 'hôte',
  usePartyItem: 'hôte', appraiseItem: 'hôte', appraiseGear: 'hôte',
  // ── Possessions / inventaire / équipement (lot coop non ouvert) ───────────────────────────────
  toggleEquip: 'hôte', stowItem: 'hôte', transferItem: 'hôte', setItemSkin: 'hôte', choisirForme: 'hôte',
  setLoadoutSlot: 'hôte', createLoadout: 'hôte', deleteLoadout: 'hôte', setActiveLoadout: 'hôte',
  abandonPossession: 'hôte', renamePossession: 'hôte', retrievePossession: 'hôte',
  stablePossession: 'hôte', embark: 'hôte', disembark: 'hôte',
  // ── Bourse du groupe : marché terrestre, marchand, port ───────────────────────────────────────
  addToCart: 'hôte', decFromCart: 'hôte', removeFromCart: 'hôte', clearCart: 'hôte', payCart: 'hôte',
  addToSellCart: 'hôte', removeFromSellCart: 'hôte', clearSellCart: 'hôte', confirmSell: 'hôte',
  setSellHalving: 'hôte', assignDistribution: 'hôte', confirmDistribution: 'hôte',
  barterExchange: 'hôte', repairItem: 'hôte', searchAvailability: 'hôte', startBargain: 'hôte',
  refuseBargain: 'hôte', closeMerchant: 'hôte', openPlaceMerchant: 'hôte', openLandMarket: 'hôte',
  closeLandMarket: 'hôte', landBuyCargo: 'hôte', landSellCargo: 'hôte', landDumpCargo: 'hôte',
  landEvalWine: 'hôte', moveCargo: 'hôte', openPort: 'hôte', closePort: 'hôte', portBuyCargo: 'hôte',
  portSellCargo: 'hôte', portDumpCargo: 'hôte', portRepair: 'hôte', portCareen: 'hôte',
  portInstallUpgrade: 'hôte', portHireCrew: 'hôte', portDismissCrew: 'hôte', gatherInnInfo: 'hôte',
  // ── Navire / rôles / conseil de bord ──────────────────────────────────────────────────────────
  setShipRole: 'hôte', setShipStation: 'hôte', setTravelRole: 'hôte', setPosteAmmo: 'hôte',
  councilPay: 'hôte', councilClose: 'hôte',
  // ── Décisions de GROUPE (mer, taverne, poursuite, séance) ─────────────────────────────────────
  seaActivitiesConfirm: 'hôte', resolveShoreLeave: 'hôte', resolveManannPriest: 'hôte',
  playTavernGame: 'hôte', closeTavernGames: 'hôte', openTavernGames: 'hôte', sequenceAbandon: 'hôte',
  endSession: 'hôte', closeSessionEnd: 'hôte',
  // Cadre de campagne (#717) : l'invité VOIT les deux écrans (la cérémonie et la chronique se partagent
  // à la table) mais leurs GESTES sont à l'hôte, comme la fin de séance qu'ils enchaînent — l'ouverture
  // n'est pas une décision (rien à trancher), la clôture applique la même séance. Un ready-check de
  // table serait un autre ticket. Le refus est EFFECTIF, pas seulement classé : les actions sont
  // inertes chez l'invité (`noyau/chapitreRecap.ts`, garde `s.net.mode === 'guest'`, contrat
  // `chapitre-recap.test.ts` « les trois gestes du cadre sont INERTES ») et les boutons portent leur
  // raison (`GatedAction`, contrats de `CampaignOpeningScreen.test.tsx`/`ChapterRecapScreen.test.tsx`).
  acquitterOuverture: 'hôte', cloreChapitre: 'hôte', ajournerChapterRecap: 'hôte',
  chooseDialogue: 'hôte', designerHerosChoisir: 'hôte',
  // ── Interlude : ouverture/clôture et bataille de masse ────────────────────────────────────────
  interludeEnd: 'hôte', interludeEntrainement: 'hôte', massBattleActivity: 'hôte',
  setMassBattleHero: 'hôte', massBattleAdvance: 'hôte', massBattleClash: 'hôte',
  massBattleHazard: 'hôte', massBattleRally: 'hôte', massBattleScene: 'hôte', endMassBattle: 'hôte',
  // ── Repos / butin / victoire / défaite ────────────────────────────────────────────────────────
  // `restSleep` : l'HÔTE dort pour le groupe, l'invité passe par `restSet`/`restReady`.
  // `dismissVictory` : l'invité passe par `victoryReady`, l'hôte ferme à l'unanimité.
  openRest: 'hôte', restSleep: 'hôte', restCancel: 'hôte', assignLootGear: 'hôte', dismissLoot: 'hôte',
  dismissVictory: 'hôte', harvestCreature: 'hôte', dismissDefeat: 'hôte',
  // ── Persistance / campagne / éditeur / session réseau ─────────────────────────────────────────
  // `net*` de session : le client gère SA connexion ; l'attribution de sièges et le rôle MJ sont
  // hôte-autoritaires.
  saveGame: 'hôte', loadGame: 'hôte', importGame: 'hôte', loadProject: 'hôte',
  setPendingCampaign: 'hôte', netHostStart: 'local', netJoin: 'local', netLeave: 'local',
  netAssign: 'hôte', netAssignSlot: 'hôte', setGmSeat: 'hôte',
  // ═══ interne : aucun écran ne l'émet ═══
  // ── Vue et curseur clavier (registre `state/clavier/keybindings.ts`) ─────────────────────────────────
  rotateCam: 'interne', toggleViewMode: 'interne', togglePov: 'interne', setReveler: 'interne', moveCursor: 'interne',
  snapCursorToTarget: 'interne', commitCursor: 'interne', battleArmIntent: 'interne',
  // ── Machinerie d'hôte : scène, temps, groupe, combat, IA, journal ─────────────────────────────
  startScene: 'interne', setParty: 'interne', seedRng: 'interne', log: 'interne', autoSave: 'interne', avancerLHorloge: 'interne', advanceTime: 'interne',
  resumeCadence: 'interne', moveParty: 'interne', stepPartyDir: 'interne', stepPartyRelative: 'interne',
  sauter: 'interne', actionnerLaPorte: 'interne',
  pivotParty: 'interne', restParty: 'interne', setPendingInteract: 'interne', jouerAction: 'interne',
  interactEntity: 'interne', closeDialogue: 'interne', designerHerosOuvrir: 'interne', remettreDocument: 'interne',
  startCombat: 'interne', faceAtCombatStart: 'interne', faceFromPath: 'interne', faceToward: 'interne',
  aiWouldCast: 'interne', restoreFortuneNow: 'interne', siegeAimCommit: 'interne', siegeAimCancel: 'interne',
  startExtendedTest: 'interne', startForceDoor: 'interne', startInterlude: 'interne', startMassBattle: 'interne',
  massBattleBegin: 'interne', openSessionEnd: 'interne', grantXp: 'interne', favorGrant: 'interne',
  openMerchant: 'interne', buyItem: 'interne', addPossession: 'interne', transferPossession: 'interne',
  learnPossessionTrait: 'interne', shipAdvance: 'interne', shipTurn: 'interne', shipAutoBattery: 'interne',
  resolveCargoRaid: 'interne',
} as const satisfies TableDesClasses;

type Classes = typeof CLASSE_DES_ACTIONS;
/** Actions manuscrites d'une classe donnée. */
export type ActionDeClasse<C extends ClasseCoop> = { [K in keyof Classes]: Classes[K] extends C ? K : never }[keyof Classes];

const INVITEES = (Object.keys(CLASSE_DES_ACTIONS) as (keyof Classes)[]).filter((a) => CLASSE_DES_ACTIONS[a] === 'invité');

/** Groupe : composition et carnet d'enquête. */
export const PARTY_INTENTS: ReadonlySet<string> = new Set<ActionDeClasse<'invité'>>([
  'partyAddHero', 'partyRemoveHero', 'partyReplaceHero', 'toggleCluePin', 'markCluesSeen',
]);

/** Activités d'interlude. `startInterlude`/`interludeEnd` sont `hôte` (l'hôte seul ouvre et clôt la période). */
export const INTERLUDE_INTENTS: ReadonlySet<string> = new Set<ActionDeClasse<'invité'>>([
  'interludeActivity', 'interludeCraftStart', 'interludeOrder', 'interludeBank', 'interludeWithdraw',
  'activityConfirm', 'activityCancel',
]);

/** Intents manuscrits du COMBAT : la classe `invité` hors groupe et interlude. */
export const MANUAL_COMBAT_INTENTS: readonly string[] = INVITEES.filter((a) => !PARTY_INTENTS.has(a) && !INTERLUDE_INTENTS.has(a));

export const COMBAT_INTENTS: ReadonlySet<string> = new Set([...MANUAL_COMBAT_INTENTS, ...coopFlowIntents()]);

/** Allowlist complète côté hôte / interception côté invité. */
export const GUEST_INTENTS: ReadonlySet<string> = new Set([...COMBAT_INTENTS, ...PARTY_INTENTS, ...INTERLUDE_INTENTS]);

type FluxMono = { [K in keyof Table]: Table[K] extends { kind: 'mono' } ? K : never }[keyof Table];
type Ouvreurs<C extends ClasseCoop> = readonly [ActionDeClasse<C>, ...ActionDeClasse<C>[]];
/**
 * OUVERTURE de chaque flux mono — total sur `FluxMono` : sans ouvreur atteignable, ses verbes exposés
 * sont une surface MORTE.
 *  - `parInvite` : ouvreurs qu'un invité doit pouvoir demander (classe `invité`) ;
 *  - `parHote` : ouvreurs d'un ÉCRAN piloté par l'hôte (classe `hôte`) — le jet, une fois ouvert, est
 *    joué ENTIER par le siège de son porteur (verbes ET `resolution`, routes `jetOwnedIntents`) ;
 *  - `interne` : aucune action de store n'ouvre ce flux — la valeur NOMME le site qui le pose.
 * Ses ouvreurs `parHote` fixent leur classe dans `TableDesClasses` : la table n'est donc vérifiée
 * qu'après sa déclaration (`_ouvertureTotale`).
 */
export type Ouverture = { parInvite: Ouvreurs<'invité'>; interne?: SiteInterne } | { parHote: Ouvreurs<'hôte'> } | { interne: SiteInterne };
const OUVERTURE_DES_FLUX = {
  attack: { parInvite: ['battleClickEntity', 'battleSelectAction'] },
  defense: { interne: 'réaction : combatFlow.maybeOpenDefense / openSurfacedDefense' },
  cast: { parInvite: ['battleSelectSpell', 'battleClickEntity'] },
  disengage: { parInvite: ['battleDisengage'] },
  auContact: { parInvite: ['battleAuContact'] },
  grapple: { parInvite: ['battleGrapple'] },
  battement: { parInvite: ['battleBattement'] },
  distraire: { parInvite: ['battleDistraire'] },
  maneuver: { parInvite: ['battleClickEntity'] }, // manœuvre de créature : ciblage (targetingModes.attackClickCommit)
  run: { parInvite: ['battleRun'] },
  reload: { parInvite: ['battleReload'] },
  // Main ensanglantée (AA 07 l.117) : posé par l'ouverture d'attaque (interne) ET par la 2ᵉ frappe à
  // deux armes, qui est UNE action de store exposée.
  handGate: { parInvite: ['dualStrikeAttack'], interne: 'combatFlow.openAttackCascade (Test par Action)' },
  recover: { parInvite: ['battleRecoverState'] },
  focus: { parInvite: ['battleFocusSpell'] },
  dispel: { parInvite: ['battleDispelSpell'] },
  frenzy: { parInvite: ['battleFrenzy'] },
  approach: { parInvite: ['battleClickTile', 'battleClickEntity'] }, // gate de Peur (combatSlice.fearGateBlocks)
  ward: { parInvite: ['battleClickEntity'] }, // ciblage (targetingModes.attackClickCommit)
  heal: { parInvite: ['battleHeal', 'medicAct'] },
  surgery: { parInvite: ['openSurgeryPass'] },
  corruption: { interne: 'exposition/seuil : combatEffects (Effect) et corruptionFlow.gainCorruption' },
  test: { interne: 'combatEffects.openSkillTest (Effet de scène, dialogue, consommable)' },
  steamSave: { interne: 'panne de vapeur : seaVoyageFlow.openSteamSave' },
  activity: { parInvite: ['interludeActivity'] },
  bargain: { parHote: ['startBargain'] },
  appraise: { parHote: ['appraiseItem', 'appraiseGear'] },
  shanty: { parInvite: ['battleSingShanty'] },
} as const;
type FluxOuverts = keyof typeof OUVERTURE_DES_FLUX;
const _ouvertureTotale: Record<FluxMono, Ouverture> & Record<Exclude<FluxOuverts, FluxMono>, never> = OUVERTURE_DES_FLUX;
void _ouvertureTotale;
type OuvreurParHote = { [K in FluxOuverts]: (typeof OUVERTURE_DES_FLUX)[K] extends { parHote: readonly (infer A)[] } ? A : never }[FluxOuverts];

/** Un flux mono dont le `pending` est `HORS_MODAL` n'a aucune modale du registre pour désigner son
 *  porteur (`modalOwnerOf`) : ses actions de clôture passent par sa `resolution`, routée sur lui. */
type PendingHorsModal = (typeof HORS_MODAL)[number]['pendingKey'];
type FluxHorsModalSansResolution = {
  [K in FluxMono]: Table[K] extends { jetOwner: { pending: PendingHorsModal } }
    ? (Table[K] extends { resolution: readonly [string, ...string[]] } ? never : K)
    : never;
}[FluxMono];
const _fluxHorsModalClos: [FluxHorsModalSansResolution] extends [never] ? true : ['flux mono HORS_MODAL sans `resolution`', FluxHorsModalSansResolution] = true;
void _fluxHorsModalClos;

/** Args JSON-sûrs pour un intent : les handlers React passent parfois l'ÉVÉNEMENT en argument
 *  (`onClick={action}`) — circulaire, il ferait échouer la sérialisation et PERDRAIT l'intent
 *  (bug trouvé à l'audit coop : « Appliquer » d'invité muet). On TRONQUE la queue non
 *  sérialisable (l'événement est toujours en dernier) sans toucher aux vrais arguments. */
export function sanitizeIntentArgs(args: unknown[]): unknown[] {
  const jsonSafe = (v: unknown) => {
    try {
      JSON.stringify(v);
      return true;
    } catch {
      return false;
    }
  };
  const out = [...args];
  while (out.length && (!jsonSafe(out[out.length - 1]) || typeof out[out.length - 1] === 'function')) out.pop();
  return out;
}
