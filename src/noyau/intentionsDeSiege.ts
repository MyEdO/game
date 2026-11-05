/**
 * Allowlist des actions du noyau qu'un INVITÉ peut demander (intents) — périmètre : LE COMBAT
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
 *  - les verbes de jet (`jet<Verbe>`, le flux en argument, clôture `jetConfirm` comprise) : classe
 *    dérivée de `FLOW_VERBS` (`coopFlowIntents`) — un flux ajouté à la table n'a AUCUNE ligne à écrire ici ;
 *  - toute autre action : une entrée de `CLASSE_DES_ACTIONS_DU_NOYAU` (actions de `Jeu`) ou de la
 *    table de l'adaptateur (`state/intents.ts`, ses actions d'interface), tables TOTALES sur
 *    `ActionManuscrite` — une action ajoutée sans classe ne compile pas. Une action `<prefix><Maj>…` d'un flux de
 *    jet y est `invité` par le type (#1017, #1050), hors ouvreur `parHote` et élection locale.
 * `invité` = l'invité la DEMANDE à l'hôte (`netFlow` l'enrobe) ; `hôte` = écran ou décision pilotés
 * par l'hôte ; `local` = état d'écran du client, jamais un intent ; `interne` = machinerie qu'aucun
 * écran (`src/ui`, `src/gameIso`) n'émet (garde `intents.test.ts`, #1050). Chez l'invité, une action
 * hors allowlist s'exécute dans son store (`netFlow` n'enrobe que l'allowlist) ; chez l'hôte, toute
 * intention d'un siège passe par `appliquerLIntentionDUnSiege`.
 */
import { coopFlowIntents, type FLOW_VERBS, type NomDeVerbeDeJet } from './flowVerbs';
import type { Jeu } from './etat';
import type { LOCALES_AU_CLIENT } from './coop';
import type { Get } from './flowTypes';
import { intentAllowedFor, withActingSeat } from './netOwnership';
import { t } from '../i18n';

export type ClasseCoop = 'invité' | 'hôte' | 'local' | 'interne';

type Table = typeof FLOW_VERBS;
/** Actions d'un état de store `S` dont la classe coop s'ÉCRIT (hors surface dérivée `coopFlowIntents` : les verbes de jet). */
export type ActionManuscrite<S = Jeu> = Exclude<
  { [K in keyof S]-?: NonNullable<S[K]> extends (...args: never[]) => unknown ? K : never }[keyof S],
  NomDeVerbeDeJet
>;

type Majuscule = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H' | 'I' | 'J' | 'K' | 'L' | 'M' | 'N' | 'O' | 'P' | 'Q'
  | 'R' | 'S' | 'T' | 'U' | 'V' | 'W' | 'X' | 'Y' | 'Z';
type Minuscule = Lowercase<Majuscule>;
/** Site qui pose un flux sans action de store : `<module>.<fonction>`. */
export type SiteInterne = `${string}${Minuscule}.${Minuscule}${string}`;

/**
 * Élections LOCALES d'écran (`targetingModes.TargetingMode.electionLocale`) : l'action n'écrit que le
 * champ nommé, hors instantané (`coop.instantaneDeLaCoop`) ; le COMMIT qui suit est exposé.
 */
const ELECTIONS_LOCALES = { dispelSelectCarrier: 'dispelCarrierId' } as const satisfies { [A in ActionManuscrite]?: (typeof LOCALES_AU_CLIENT)[number] };

/** Classe qu'une action manuscrite de `T` peut prendre. */
type ClasseAdmise<A, T> = A extends OuvreurParHote ? 'hôte'
  : A extends keyof typeof ELECTIONS_LOCALES ? 'local'
  : A extends `${keyof T & string}${Majuscule}${string}` ? 'invité'
  : ClasseCoop;

/** Table TOTALE des classes coop d'un état de store `S` (flux de jet `T`). */
export type TableDesClasses<S = Jeu, T = Table> = { [A in ActionManuscrite<S>]: ClasseAdmise<A, T> };

/** Classe coop de chaque action manuscrite du noyau. */
export const CLASSE_DES_ACTIONS_DU_NOYAU = {
  // ═══ invité : COMBAT (gestes de tour/hotbar, paramètres pré-jet, OUVREURS de flux) ═══
  // tour, ciblage, déplacement tactique
  // `armEndTurn` = 1er temps du garde-fou « tour gâché » : l'armement vit dans `battle` (état d'hôte),
  // donc l'invité le DEMANDE comme tout geste de son tour — sinon son 1er appui serait sans effet.
  battleClickEntity: 'invité', battleClickTile: 'invité', battleEndTurn: 'invité',
  armEndTurn: 'invité', battleClearPreview: 'invité', cancelMove: 'invité', battleSelectAction: 'invité',
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
  // attaque : paramètres de la modale différée
  attackSetLocation: 'invité', attackSetWeapon: 'invité', attackSetDualMode: 'invité',
  attackSetWithhold: 'invité', attackSetHarpoonRopeCut: 'invité', attackSetGrapple: 'invité',
  attackSetCritLocation: 'invité',
  // défense réactive : choix de mode/arme/réaction de bouclier
  defenseSetMode: 'invité', defenseSetParryWeapon: 'invité', defenseSetShieldReaction: 'invité',
  defenseSetRiposte: 'invité',
  // incantation / prière : options d'incantation
  castSetCritChoice: 'invité', castSetConjureForm: 'invité',
  castSetDiscreet: 'invité',
  castAllocOvercast: 'invité', castSetChosenTableRolls: 'invité', castToggleExtraTarget: 'invité',
  castPickTargets: 'invité',
  castPlaceZone: 'invité',
  // PHASE 1 du Contre-sort (#1042/#1059) : chaque candidat DÉCLARE depuis SA RANGÉE (contrer seul /
  // s'unir / passer) — contribution de table routée par la possession de son porteur (patron #1050) ;
  // `counterspellDeclareAll` est le verbe NULLAIRE du drive d'auto-cadence.
  counterspellDeclare: 'invité', counterspellDeclareAll: 'invité',
  // La sortie d'une fenêtre (`fenetreFermer`) : routée sur la fenêtre de son 1ᵉʳ argument, par le siège que son
  // registre déclare (`sortie` : son propriétaire, ou l'hôte seul), `netOwnership.ROUTES`.
  fenetreFermer: 'invité',
  // Cascade séquentielle (jets de nuit / voyage influençables) : choix / SAISIE d'une quantité
  // (#1279 Sf, jumeau du choix) / tout résoudre ; valider l'étape est la clôture de son flux (`jetConfirm('cascade')`).
  cascadeResolveAll: 'invité',
  cascadeChoose: 'invité', cascadeAmount: 'invité',
  // désengagement : Sacrifier l'Avantage, fuir
  disengageConfirmA: 'invité',
  disengageFlee: 'invité',
  // « Au Contact » (LDB 62 l.176) : ouverture, choix du vainqueur
  battleAuContact: 'invité',
  auContactChoose: 'invité',
  // Empoignade (LDB 14 l.161) : ouverture, « Briser », choix du vainqueur
  battleGrapple: 'invité', grappleBreak: 'invité',
  grappleChoose: 'invité',
  // combat monté
  mountTargetSelect: 'invité',
  // manœuvre de créature : réglage pré-jet
  maneuverSetAvantage: 'invité',
  // Tour de NAVIRE (couche Mer, MDG 13-14) : le contrôleur de la coque OUVRE ; CHAQUE participant
  // (héros à un rôle) roule SA rangée, routée par la possession de son id (cf. `intentAllowedFor`,
  // primitive multi `RollParticipant`).
  battleShipManeuver: 'invité', shipManeuverSetTurn: 'invité',
  battleShipBattery: 'invité',
  battleCrewTest: 'invité',
  healSetMode: 'invité', healSetTest: 'invité', healSetBandages: 'invité',
  // Corruption (LDB 19 l.29) : choix de la nature de l'Influence AVANT le jet (le jet et son influence sont dérivés).
  corruptionSetNature: 'invité',
  // Manoeuvres d'arme et de mouvement (#1017) : OUVREUR + paramètre pré-jet ; le jet et
  // ses verbes d'influence sont dérivés de `FLOW_VERBS` (mono → routés par le porteur).
  battleBattement: 'invité', battementSetFoe: 'invité',
  battleDistraire: 'invité', distraireSetFoe: 'invité',
  // Chute volontaire (ouverte par `battleClickTile`) : trajet, DÉCLARATION de rangée (routée par le siège
  // du tombant, `netOwnership`).
  fallAcross: 'invité', fallChoose: 'invité',
  // Enfoncer une porte : choix de l'arme d'une rangée, routé par le siège de son héros (`netOwnership`).
  forceDoorChoisirArme: 'invité',
  // Contre-magie (LDB 46) : OUVREUR (réaction au sort adverse).
  battleDispelSpell: 'invité',
  // Chanson de marin (MDG 09) : OUVREUR + choix de la chanson.
  battleSingShanty: 'invité', shantySetSong: 'invité',
  // Test de scène/compétence (`pendingTest`) : choix du LANCEUR parmi les candidats. L'ouverture reste
  // interne (`openSkillTest`, jamais une action de store).
  testSetActor: 'invité',
  // Infirmerie (hors combat) : patients / actes / chirurgie — l'hôte valide.
  // Chirurgie : openSurgeryPass POSE la passe, les verbes de jet sur `surgery` l'influencent,
  // `jetConfirm('surgery')` applique, `jetCancel('surgery')` annule la passe, medicAbandonSurgery l'opération.
  medicSelectPatient: 'invité', medicAct: 'invité', medicSetWound: 'invité',
  openSurgeryPass: 'invité', medicAbandonSurgery: 'invité',
  // Repos (nuit) : chacun règle SES héros (restSet vise un héros, 1er argument) + ready-check.
  restSet: 'invité', restReady: 'invité',
  // (Psychologie de COMBAT et à la rencontre : passent par les intents `cascade*` dérivés.)
  fateNegate: 'invité', fateSurvive: 'invité', fateAccept: 'invité',
  cleaveAttack: 'invité', cleaveEnd: 'invité', dualStrikeAttack: 'invité', dualStrikeSkip: 'invité',
  roundStartPromote: 'invité', confirmRoundStart: 'invité', roundStartReady: 'invité',
  renounceResolve: 'invité',
  // Tir rapide (Talent « Tir rapide ») pendant la pause de début de Round : ARMER la visée depuis la
  // frise, puis le tir lui-même (appelé par `battleClickEntity` chez l'hôte — exposé en défense en
  // profondeur). Les deux sont routés sur le TIREUR : pendant la pause il n'y a AUCUN combattant
  // actif (`turn: -1`), donc le repli universel les refusait à tout siège invité.
  armPreempt: 'invité', preemptRangedShot: 'invité',
  // Demande de pause au prochain Round : POSER et RETIRER passent par le même chemin (interrupteur
  // de la frise) — une bascule dont un seul sens serait répliqué laisserait la table bloquée.
  victoryReady: 'invité', assignVictoryGear: 'invité', raiseHand: 'invité', lowerHand: 'invité',
  // ═══ invité : GROUPE — composition (chaque siège SES emplacements, tranchée par `ROUTES`) et carnet
  // d'enquête (#670, `TOUJOURS` : épingle de groupe, nouveauté vue par siège). ═══
  partyAddHero: 'invité', partyRemoveHero: 'invité', partyReplaceHero: 'invité', toggleCluePin: 'invité',
  markCluesSeen: 'invité',
  // ═══ invité : INTERLUDE (LDB 23) — chaque Activité vise un héros (1er argument ou pending/dépôt),
  // possession validée par `intentAllowedFor`. ═══
  // `interludeActivity` = chemin UNIQUE de toutes les Activités à jet (Revenus/Artisanat/Apprentissage/
  // Identification + catalogue) ; `interludeCraftStart` engage l'ouvrage (setup, sans jet).
  interludeActivity: 'invité', interludeCraftStart: 'invité', interludeOrder: 'invité',
  interludeBank: 'invité', interludeWithdraw: 'invité', interludeEntrainement: 'invité', favorSettle: 'invité',
  // Préparation de bataille : le héros MENEUR est le 2e argument ; l'affectation de l'armée
  // (`setMassBattleHero`), partagée, reste à l'hôte.
  massBattleActivity: 'invité',
  // ═══ hôte / local : émis par un écran ═══
  // Élection LOCALE d'écran, hors réseau PAR CONSTRUCTION (même famille que `localIntent`) : le clic
  // qui élit le porteur du mode Dissiper n'engage rien — il ouvre le choix du Sort CHEZ CE JOUEUR.
  // `netFlow.emettreIntentInvite` le joue dans le store de l'émetteur et n'envoie aucun intent ; le
  // COMMIT, lui (`battleDispelSpell`), est exposé. Voyager le ferait naître chez l'HÔTE.
  dispelSelectCarrier: 'local',
  // ── Exploration (miroir V1) ───────────────────────────────────────────────────────────────────
  openWorldMap: 'hôte', startTravel: 'hôte',
  startBilletBargain: 'hôte', resumeTravel: 'hôte', departWaitDawn: 'hôte',
  setVoyageCadence: 'hôte', transitionTo: 'hôte', fouillerLaPiece: 'hôte',
  // ── Fiche de personnage : progression (PX), équipement, sorts hors combat ─────────────────────
  buyCharAdvance: 'hôte', buySkillAdvance: 'hôte', buyTalent: 'hôte', buySpell: 'hôte',
  changeCareer: 'hôte', designateCareerSlot: 'hôte', trainProsthesis: 'hôte', buySpellComponent: 'hôte',
  removeSpellComponent: 'hôte', setHeroBackground: 'hôte', favorBreak: 'hôte',
  oocCastSpell: 'hôte', oocFocusSpell: 'hôte', oocDispelSpell: 'hôte', openMedic: 'hôte',
  usePartyItem: 'hôte', appraiseItem: 'hôte', appraiseGear: 'hôte',
  // ── Possessions / inventaire / équipement (lot coop non ouvert) ───────────────────────────────
  toggleEquip: 'hôte', stowItem: 'hôte', transferItem: 'hôte', choisirApparence: 'hôte',
  setLoadoutSlot: 'hôte', createLoadout: 'hôte', deleteLoadout: 'hôte', setActiveLoadout: 'hôte',
  abandonPossession: 'hôte', renamePossession: 'hôte', retrievePossession: 'hôte',
  stablePossession: 'hôte', embark: 'hôte', disembark: 'hôte',
  // ── Bourse du groupe : marché terrestre, marchand, port ───────────────────────────────────────
  addToCart: 'hôte', decFromCart: 'hôte', removeFromCart: 'hôte', clearCart: 'hôte', payCart: 'hôte',
  addToSellCart: 'hôte', removeFromSellCart: 'hôte', clearSellCart: 'hôte', confirmSell: 'hôte',
  setSellHalving: 'hôte', assignDistribution: 'hôte', confirmDistribution: 'hôte',
  barterExchange: 'hôte', repairItem: 'hôte', searchAvailability: 'hôte', startBargain: 'hôte',
  refuseBargain: 'hôte', openPlaceMerchant: 'hôte', openLandMarket: 'hôte',
  landBuyCargo: 'hôte', landSellCargo: 'hôte', landDumpCargo: 'hôte',
  landEvalWine: 'hôte', moveCargo: 'hôte', openPort: 'hôte', portBuyCargo: 'hôte',
  portSellCargo: 'hôte', portDumpCargo: 'hôte', portRepair: 'hôte', portCareen: 'hôte',
  portInstallUpgrade: 'hôte', portHireCrew: 'hôte', portDismissCrew: 'hôte', gatherInnInfo: 'hôte',
  // ── Navire / rôles / conseil de bord ──────────────────────────────────────────────────────────
  setShipRole: 'hôte', setShipStation: 'hôte', setTravelRole: 'hôte', setPosteAmmo: 'hôte',
  councilPay: 'hôte',
  // ── Décisions de GROUPE (mer, taverne, poursuite, séance) ─────────────────────────────────────
  seaActivitiesConfirm: 'hôte', resolveShoreLeave: 'hôte', resolveManannPriest: 'hôte',
  playTavernGame: 'hôte', openTavernGames: 'hôte', sequenceAbandon: 'hôte',
  endSession: 'hôte',
  // Cadre de campagne (#717) : l'invité VOIT les deux écrans (la cérémonie et la chronique se partagent
  // à la table) mais leurs GESTES sont à l'hôte, comme la fin de séance qu'ils enchaînent — l'ouverture
  // n'est pas une décision (rien à trancher), la clôture applique la même séance. Un ready-check de
  // table serait un autre ticket. Le refus est EFFECTIF, pas seulement classé : les actions sont
  // inertes chez l'invité (`noyau/chapitreRecap.ts`, garde `s.net.mode === 'guest'` ; la sortie du récap,
  // `refusDeLaSortie`, contrat
  // `chapitre-recap.hors-store.test.ts` « les trois gestes du cadre sont INERTES ») et les boutons portent leur
  // raison (`GatedAction`, contrats de `CampaignOpeningScreen.test.tsx`/`ChapterRecapScreen.test.tsx`).
  acquitterOuverture: 'hôte', cloreChapitre: 'hôte',
  chooseDialogue: 'hôte', designerHerosChoisir: 'hôte',
  // ── Interlude : ouverture/clôture et bataille de masse ────────────────────────────────────────
  interludeEnd: 'hôte',
  setMassBattleHero: 'hôte', massBattleAdvance: 'hôte', massBattleClash: 'hôte',
  massBattleHazard: 'hôte', massBattleRally: 'hôte', massBattleScene: 'hôte',
  // ── Repos / butin / victoire / défaite ────────────────────────────────────────────────────────
  // `restSleep` : l'HÔTE dort pour le groupe, l'invité passe par `restSet`/`restReady`.
  openRest: 'hôte', restSleep: 'hôte', assignLootGear: 'hôte', harvestCreature: 'hôte',
  // ── Campagne ──────────────────────────────────────────────────────────────────────────────────
  loadProject: 'hôte', setPendingCampaign: 'hôte',
  // ═══ interne : aucun écran ne l'émet ═══
  // ── Armement d'intention au clavier (registre `state/clavier/keybindings.ts`) ─────────────────────
  battleArmIntent: 'interne',
  // ── La porte des offres en intention (`creerActionsDuRegistre`, #2898) : un hôte sans siège ──────────
  jouerLOffre: 'interne',
  // ── Machinerie d'hôte : scène, temps, groupe, combat, IA, journal ─────────────────────────────
  startScene: 'interne', setParty: 'interne', seedRng: 'interne', log: 'interne', avancerLHorloge: 'interne', advanceTime: 'interne',
  resumeCadence: 'interne', moveParty: 'interne', marcherVers: 'interne', stepPartyRelative: 'interne',
  sauter: 'interne', actionnerLaPorte: 'interne',
  pivotParty: 'interne', restParty: 'interne', setPendingInteract: 'interne', jouerAction: 'interne',
  interactEntity: 'interne', designerHerosOuvrir: 'interne', remettreDocument: 'interne',
  startCombat: 'interne', faceAtCombatStart: 'interne', faceFromPath: 'interne', faceToward: 'interne',
  aiWouldCast: 'interne', restoreFortuneNow: 'interne', siegeAimCommit: 'interne',
  startExtendedTest: 'interne', startForceDoor: 'interne', startInterlude: 'interne', startMassBattle: 'interne',
  massBattleBegin: 'interne', openSessionEnd: 'interne', grantXp: 'interne', favorGrant: 'interne',
  openMerchant: 'interne', addPossession: 'interne', transferPossession: 'interne',
  learnPossessionTrait: 'interne', shipAdvance: 'interne', shipTurn: 'interne', shipAutoBattery: 'interne',
  resolveCargoRaid: 'interne',
} as const satisfies TableDesClasses<Jeu>;

type Classes = typeof CLASSE_DES_ACTIONS_DU_NOYAU;
/** Actions manuscrites d'une classe donnée. */
export type ActionDeClasse<C extends ClasseCoop> = { [K in keyof Classes]: Classes[K] extends C ? K : never }[keyof Classes];

const INVITEES = (Object.keys(CLASSE_DES_ACTIONS_DU_NOYAU) as (keyof Classes)[]).filter((a) => CLASSE_DES_ACTIONS_DU_NOYAU[a] === 'invité');

/** Groupe : composition et carnet d'enquête. */
export const PARTY_INTENTS: ReadonlySet<string> = new Set<ActionDeClasse<'invité'>>([
  'partyAddHero', 'partyRemoveHero', 'partyReplaceHero', 'toggleCluePin', 'markCluesSeen',
]);

/** Activités d'interlude. `startInterlude`/`interludeEnd` sont `hôte` (l'hôte seul ouvre et clôt la période). */
export const INTERLUDE_INTENTS: ReadonlySet<string> = new Set<ActionDeClasse<'invité'>>([
  'interludeActivity', 'interludeCraftStart', 'interludeOrder', 'interludeBank', 'interludeWithdraw',
  'interludeEntrainement', 'favorSettle', 'massBattleActivity',
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
 *    joué ENTIER par le siège de son porteur (verbes de jet, clôture comprise, routes de `netOwnership`) ;
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

/** Sort d'une intention de siège : ignorée hors allowlist, refusée hors possession, sinon appliquée. */
export type IssueDIntention = 'hors-allowlist' | 'refusee' | 'appliquee';

/**
 * Intention d'un SIÈGE appliquée dans l'état du propriétaire (spec coop §4bis, #1017). Ordre :
 *  1. allowlist `GUEST_INTENTS` : hors liste, rien, ni effet ni journal ;
 *  2. possession `intentAllowedFor` : refus au journal ;
 *  3. l'action AU NOM du siège (`withActingSeat`), seul canal du siège (`decidingSeat`) : les gardes « ce siège possède-t-il ce combattant ? »
 *     (`controlsCombatant`) jugent l'émetteur, et l'intention armée du propriétaire ne s'y lit pas
 *     (`localIntent.intentionDuProprietaire`) : seul compte le verdict joint aux args.
 */
export function appliquerLIntentionDUnSiege(get: Get, siege: number, action: string, args: readonly unknown[]): IssueDIntention {
  if (!GUEST_INTENTS.has(action)) return 'hors-allowlist';
  if (!intentAllowedFor(get(), siege, action, [...args])) {
    get().log(t('coop.intentRefused'));
    return 'refusee';
  }
  const fn = (get() as unknown as Record<string, unknown>)[action];
  if (typeof fn === 'function') withActingSeat(siege, () => (fn as (...a: readonly unknown[]) => void)(...args));
  return 'appliquee';
}
