import type { Combatant } from '../engine/types';
import type { FateSaveSource } from '../engine/fortune';
import type { SourceRef, RaceKey, Sexe } from '../data/schemas/grammaire/valeurs';
import type { BattleActionMode } from './actionRegistry';
import type { ShipMoraleState } from '../engine/crewMorale';
import type { Dir8 } from './monde/dir8';
import type { LocalIntent } from './localIntent';
import type { RefusIHM } from './refusVisible';
import type { EtatDeSequence } from './sequenceContract';
import type { Flow } from './monde/flow';
import type { MoveSnapshot } from './monde/combatGeometry';
import type { BattleZone } from './monde/zones';
import type { InterludeState, BankDeposit, PendingActivity } from './interludeFlow';
import type { Favor } from '../engine/favor';
import type { MassBattleState } from './massBattleFlow';
import type { SceneMutation } from './monde/sceneInstance';
import type { ClueState } from './monde/clues';
import type { CombatEvent, ActorAim } from './combatLog';
import { campaignStart, dayIndex } from '../engine/clock';
import type { Possession } from '../engine/possession';
import type { MerchantState, MerchantStocks } from './merchantFlow';
import type * as tavernFlow from './tavernFlow';
import type { PendingVictory, PendingLoot, PendingTest, PendingSteamSave, PendingReload, PendingStateRecovery, PendingBargain, PendingAppraise, PendingAttack, PendingHandGate, PendingSiegeAim, PendingCleave, PendingDualStrike, PendingBattement, PendingDistraire, PendingManeuver, PendingRun, PendingFall, PendingShipManeuver, PendingShipBattery, PendingCrewTest, PendingShanty, PendingApproach, PendingWard, PendingFocus, PendingDispel, PendingFrenzy, PendingRenounce, PendingDefense, PendingDisengage, PendingAuContact, PendingGrapple, PendingCast, PendingCounterspell, PendingExtendedTest, PendingForceDoor, PendingDesignationHeros, PendingEtalLot, PendingHeal, PendingSurgery, PendingCorruption, PendingCastOpposition, PendingCascade, ScheduledEffect, EtatDialogue } from './pendings';
import type { MedicState } from './medicFlow';
import type { PendingRest } from './restFlow';
import type { PendingCouncil } from './shipCrew';
import type { Scene, VictoryCondition } from './monde/scene';
import type { DialogueTurn } from './monde/dialogueHistory';
import type { Pt } from './monde/path';
import { emptyWorldMap } from './worldMap';
import { initialFields } from './stateFields';
import type { NarratifBlock, OuvertureBlock } from './monde/campaignNarratif';
import type { ChapitreDepuis, ChapterRecap } from './chapitreRecap';
import type { ActionsDuNoyau } from './actionsDuNoyau';

/** Source unique des écrans valides — `Ecran` en dérive (`typeof SCREENS[number]`) : un id absent
 *  ici échoue à la garde DEV `__wfrp.screen` (state/devtools.ts) au lieu de router silencieusement
 *  vers un écran blanc (#211). */
export const SCREENS = ['menu', 'party', 'creator', 'campaign', 'editor', 'test', 'interlude', 'coop', 'compendium', 'massBattle', 'gallery', 'webglSpike'] as const;
export type Ecran = typeof SCREENS[number];

/** Postures de tir PRÉ-ARMÉES d'un combattant (`BattleState.stances`) : les champs qu'elles
 *  pré-remplissent sur le `PendingAttack` de son prochain tir. `heldGround` — tir IMMOBILE
 *  (`LDB 14 l.70`) ; `intoCrowd` — « Tirer dans le tas » (`LDB 14 l.106`, `l.116`). */
export interface ShootingStance {
  heldGround?: boolean;
  intoCrowd?: boolean;
}
/** Champ de posture armable — l'id porté par le registre des actions (`ActionDef.stance`). */
export type ShootingStanceKey = keyof ShootingStance;
export interface BattleState {
  combatants: Combatant[];
  order: string[];
  /** Ordre d'initiative CANONIQUE (immuable) ; `order` en est dérivé chaque Round (Maladresse
   *  « agir en dernier » / pré-emption Chance = effets d'UN Round, non permanents). */
  baseOrder?: string[];
  turn: number;
  round: number;
  /** Marins ayant déjà contribué à un Test d'équipage CE ROUND, par navire (`shipId → crewId[]`). Réinitialisé au début de
   *  chaque Round (`enterRoundStartPause`) ; un marin déjà listé qui contribue à un 2e Test (manœuvre + bordée) → cumul à
   *  +2 crans de Difficulté (Manque de bras, MDG 14 l.53). */
  crewActed?: Record<string, string[]>;
  /** Mode d'action À BOUTON en cours (panneau ouvert). Le déplacement et l'attaque n'ont PAS de mode :
   *  ils sont implicites au clic (sol/ennemi) quand `action === null` — cf. battleClickTile/Entity.
   *  La Focalisation / l'usage d'objet / le ramassage NE sont PAS des modes : ils passent par
   *  `battleFocusSpell`→`pendingFocus`, `battleUseItem`, `battlePickup`.
   *  Le TYPE vient du REGISTRE DES ACTIONS (`actions.json` : le champ `armed` de chaque action) +
   *  `MODES_HORS_REGISTRE` pour ce qu'aucune case n'arme (`teleport` = résolution d'un sort) —
   *  parité gardée par `src/state/action-atteignabilite.test.ts`. */
  action: BattleActionMode | null;
  /** Sort sélectionné pour l'action d'incantation en cours (id STABLE — le libellé se résout à l'affichage). */
  selectedSpellId: string | null;
  /** Attaque ARMÉE pour le clic-ennemi (id d'`AttackOption` : 'arme' | 'morsure' | … — cf. `availableAttacks`).
   *  Défaut 'arme' ; vivante seulement quand `action===null`. Source UNIQUE qui remplace l'attaque d'arme
   *  implicite + le mode manœuvre/tentacule armé. */
  selectedAttack?: string;
  reachable: Map<string, number>;
  /** Cases de Mouvement déjà parcourues ce Tour. Le Mouvement est DÉCOMPOSABLE (règle maison : on peut
   *  fractionner son déplacement tant que le total ≤ Marche) MAIS non entrelacé avec l'Action : séquences
   *  permises = `Mouvement* puis Action` OU `Action puis Mouvement*` ; INTERDIT = Mouvement → Action →
   *  Mouvement. 0 en début de tour. « Mouvement restant » = `movementRemaining(battle, c)`. */
  movementUsed: number;
  /** Du Mouvement a-t-il été parcouru AVANT l'Action ce Tour ? Si oui, une fois l'Action prise, plus aucun
   *  Mouvement (pas de « Mouvement → Action → Mouvement », règle maison). Cf. `canMove`. */
  movedPreAction: boolean;
  acted: boolean;
  /** JETON DE TOUR D'IA (#1852) — « round:turn:id » du dernier tour d'IA JOUÉ. `maybeRunEnemyTurn` est
   *  rappelé par tout ce qui relance le combat (changement de cadence `resumeCadence`, reprise après
   *  une fenêtre, scrutation de recette) : sans jeton, chaque rappel armait un `runEnemyAI` de plus sur
   *  le MÊME combattant, qui jouait deux fois son tour. Le jeton vit sur le TIR, pas sur la
   *  planification — un beat redondant arrive et n'a rien à jouer. Porté par `battle` (et non par un
   *  module) : il naît et meurt avec le combat, sans fuite d'une partie à l'autre. */
  aiTurnPlayed?: string;
  /** Le set d'armes a-t-il déjà été changé ce Tour ? Plafond MAISON 1×/tour (dégainer = Action gratuite,
   *  cadence laissée au MJ, LDB 13 l.106). Reset au tour. */
  loadoutSwapped?: boolean;
  /** POSTURES DE TIR PRÉ-ARMÉES, par id de combattant (spec HUD §1a G5). La posture se choisit AVANT
   *  qu'une cible existe (case de console) : la construction du `PendingAttack` la consomme
   *  (`openAttackCascade`), le tir et le changement de Tour la vident. Les champs sont ceux du
   *  `PendingAttack` qu'elle pré-remplit — aucune sémantique parallèle. */
  stances?: Record<string, ShootingStance>;
  log: CombatEvent[];
  over: null | 'victory' | 'defeat';
  onVictory?: Flow;
  /** Objectif de victoire authorable (#197). Absent = `allEnemiesDead` (défaut historique, `checkBattleOver`). */
  victoryCondition?: VictoryCondition;
  /** Restriction d'armes à distance de la rencontre (#471, `EncounterDef.banRanged`) — copiée au
   *  démarrage du combat, lue par `resolveAttack`/`firedAttackBlock`. Absent/false = autorisées. */
  banRanged?: boolean;
  /** Rencontre de SIÈGE (`EncounterDef.siege`) — copiée au démarrage du combat, résolue par
   *  `siegeActif` et lue par `buildAiInput` (vivier de structures offert à l'IA ennemie).
   *  Absent/false = pas de siège. */
  siege?: boolean;
  /** Zones persistantes (L11 — généralise l'ancienne fumée) : fumée du Souffle (blocksLoS),
   *  Mur de feu (onCross), Grands feux d'U'Zhul (perRound)… TTL décrémenté à chaque frontière
   *  de Round (noyau/monde/zones.ts). */
  zones?: BattleZone[];
  /** « Avantages et Magie » (LDB 46 l.123-125) : cibles déjà visées par un Sort d'un Domaine CE Round —
   *  re-viser la même cible avec le même Vent donne +1 Avantage au lanceur. Purgé chaque Round. */
  domainCasts?: { targetId: string; domain: string }[];
  /** Option « Vents Tourbillonnants » (LDB 46 l.179-190) : force des Vents tirée pour LE combat (ou
   *  re-tirée à chaque Round en grain `round`, `noyau/combat/roundHooks.ts`) — `mod` s'ajoute aux
   *  Tests d'Incantation ET de Focalisation (`windsMagicModOf`). `revealed` = un porteur de Seconde
   *  vue a réussi le Test de Perception Facile (+40, l.181) : le HUD peut afficher la force. Le `mod`
   *  reste appliqué (visible au breakdown du jet) même non révélé. Absent = règle inactive. */
  windsOfMagic?: { roll: number; mod: number; revealed: boolean } | null;
  /** Réserves d'Avantage par CAMP (Aux Armes, Annexe I — mode « Avantage de groupe ») : présentes
   *  seulement quand la règle `combat-aa-avantage-groupe` est active. SOURCE DE VÉRITÉ de l'Avantage ;
   *  chaque `Combatant.advantage` en est la PROJECTION du camp (`mirrorPools`). Absent en mode Livre de base. */
  advantagePools?: import('../engine/advantagePool').AdvantagePools;
  /** Mort par Hémorragique (LDB 16 l.105) — combattants pour qui le jet de fin de Round (10 %/pion) a
   *  donné la MORT ce Round : marqués par le hook `bleed-death` (jet RNG, une fois), FINALISÉS par
   *  `resolveRoundBoundary` (qui peut SUSPENDRE pour un héros à Destin). `deathLine` = la ligne de
   *  journal pré-formée, annoncée APRÈS la décision de Destin. Purgé une fois tous finalisés. */
  bleedDoomed?: { id: string; deathLine: string }[];
  /** Instantané positionnel pris au PREMIER segment de Mouvement du Tour (R6) : permet
   *  d'ANNULER tout le déplacement tant qu'aucune Action n'a été prise (`cancelMove`). Restaure
   *  positions de TOUS les combattants (un grand a pu en déplacer d'autres), orientation et
   *  `movedPreAction`. Effacé à l'annulation ou écrasé au 1ᵉʳ segment du Tour suivant. */
  moveSnapshot?: MoveSnapshot | null;
  /** Budget de Mouvement ÉTENDU du Tour après une Course (Marche + Course + DR, LDB 15 l.41) :
   *  le reliquat non parcouru reste dépensable en segments. Null hors Course ; purgé au Tour/Round. */
  runBudget?: number | null;
  /** Test `calme-d-approche` d'une source de Peur (LDB 21 l.27) — une tentative par Tour :
   *  'passed' = approches libres ce Tour ; 'failed' = aucune approche ce Tour. Purgé au Tour/Round. */
  fearGate?: 'passed' | 'failed' | null;
  /** COOP : les SIÈGES qui demandent la PAUSE du prochain début de Round (fenêtre Chance « agir en
   *  premier ») — sinon les rounds s'enchaînent sans gate (arbitrage). Un siège n'ajoute et ne retire
   *  que LE SIEN (`decidingSeat`) ; la pause obtenue vide la liste. */
  handRaisedBy?: number[];
  /** GARDE-FOU « tour gâché » : empreinte de l'économie du tour (`turnEconomyStamp`) au moment où le
   *  1er geste de fin de tour a été posé — le 2ᵉ finit le tour tant qu'elle vaut encore. */
  endTurnArmed?: string;
  /** Aperçu « tap 1 » du modèle de clic implicite (tap aperçu → tap confirme). Purgé au commit,
   *  à chaque changement de Tour/Round, et remplacé par tout nouveau tap. */
  preview?:
    | { kind: 'move'; tile: Pt; path: Pt[]; cost: number }
    | { kind: 'run'; tile: Pt; path: Pt[]; cost: number }
    | { kind: 'attack'; targetId: string }
    | { kind: 'charge'; targetId: string; dest: Pt; path: Pt[]; adv: 0 | 1 }
    | { kind: 'moveAttack'; targetId: string; dest: Pt; path: Pt[]; cost: number }
    | null;
}

/** Un objectif courant de la pile (#238) — `id` STABLE (re-poser le même = mise à jour du `text`),
 *  `text` = la consigne joueur affichée au HUD (« je fais quoi maintenant ? »). */
export interface Objective {
  id: string;
  text: string;
  /** Échéance absolue `gameTime` — affichée en compte à rebours par le bandeau ; posée par
   *  `setObjective` avec une `ScheduleSpec` (#668). */
  deadline?: number;
}

/** DOCUMENT SOURCE de la partie en cours (#766) — snapshot AUTO-SUFFISANT du paquet de campagne chargé
 *  par `loadProject` (scènes + carte + narratif + scène d'entrée). Embarqué au save (via `stateFields`)
 *  pour que le chargement RÉ-ENREGISTRE toutes les scènes (`registerScene`) et RE-DÉRIVE `campaignNarratif`
 *  — sans lui, une save reloadée ne connaîtrait que la scène courante et les transitions vers les
 *  AUTRES scènes du paquet échoueraient en silence. `null` = aucun paquet chargé (partie posée par
 *  `startScene` seule). */
export interface CampaignDoc {
  scenes: Scene[];
  worldMap?: import('./worldMap').WorldMap | null;
  narratif: NarratifBlock;
  startSceneId: string;
  /** Identité du document de projet chargé : l'`id` du `ProjectDoc` PARSÉ, jamais la clé d'une entrée
   *  de bibliothèque (#2206). `null` = scénario de test, sans document de projet. */
  projet: { id: string } | null;
}

/** Ce que LANCE `loadProject` : les scènes du paquet, sa scène d'entrée, sa carte, son narratif et
 *  l'identité de son document (`CampaignDoc.projet`, OBLIGATOIRE : `null` déclare un scénario). */
export interface PaquetALancer {
  scenes: Scene[];
  entryId: string;
  worldMap?: import('./worldMap').WorldMap | null;
  narratif?: NarratifBlock;
  projet: CampaignDoc['projet'];
}

/** Déplacement-puis-interaction : le décor visé, l'offre NOMMÉE qu'on lui destine (absente quand
 *  le décor en porte plusieurs — sa pastille les sert à l'arrivée) et la case où la marche se termine.
 *  UN type, lu par l'état comme par son poseur : les deux ne peuvent plus diverger. */
export type PendingInteract = { id: string; actionId?: string; at: Pt };

/** Navire que le groupe possède/commande en campagne — survit aux jours et aux combats (≠ la coque
 *  transitoire d'un combat). Son Moral est recalculé hebdomadairement (`tickShipMorale`). Ses champs
 *  d'état sont OPTIONNELS : une save antérieure charge tel quel, chaque point de lecture porte son
 *  défaut (coque intacte, humeur neutre, cale vide) — migration par défauts, jamais de corruption. */
export interface CampaignVessel {
  vehicleId: string;
  /** #230 — Nom d'INSTANCE authoré (« Le Cormoran »…). Affichage pur (jamais une clé de logique/rendu) ;
   *  absent = le label du TYPE (`findVehicleById(vehicleId).label`). Migration par défaut. */
  label?: string;
  morale: ShipMoraleState;
  /** #30 — Blessures de COQUE persistantes (absent = coque intacte). Synchronisées par le voyage
   *  maritime (`persistHullWounds`) et les réparations ; la coque de trajet en repart. */
  wounds?: { current: number; max: number };
  /** Améliorations d'INSTANCE posées au chantier (MDG 12 — Clinfoc, Blindage, Ancre…), recopiées
   *  sur la coque au départ (`voyageShip`). */
  upgrades?: import('../engine/types').NavalTraitRef[];
  /** Salissures (MDG 13 l.144-159) : niveau 0-5 + garde hebdomadaire du Test. */
  fouling?: { level: number; lastWeek: number };
  /** Humeur de Manann (MDG 15 l.83-125) — par navire, registre des facteurs déjà appliqués. */
  manann?: import('../engine/seaVoyage').ManannMood;
  /** SABOTAGE authoré sur cette coque (MDG 14 l.45-47) — clampé [-5,0] par `shipSaboteurDR`,
   *  recopié sur la coque de trajet (`voyageShip`) comme `upgrades`/`wounds`. */
  saboteurDR?: number;
  /** Cargaison en cale (commerce maritime, MDG 15) — perdue avec le navire (abandon/capture). */
  cargo?: import('../engine/seaVoyage').CargoLot[];
  /** Critiques de navire subis EN VOYAGE (notes verbatim, MDG 13) — à purger à la remise en état. */
  criticals?: string[];
  /** Crabes boxeurs (événement ch.15) : M −1 jusqu'à ce que la coque soit raclée. */
  crabs?: boolean;
  /** Eau douce embarquée (litres — tonneau : 145 L, MDG 14 l.242). Absent = ravitaillement réputé
   *  assuré (même décision de périmètre que la Soif, cf. provisions.ts). */
  waterLitres?: number;
  /** VIVRES de l'équipage PNJ embarqués (rations de mer de la cale, en jours-homme — MDG 14 l.238/250).
   *  L'effectif nominal en consomme une/jour à `shipboardSouls().crew` ; à court → facteur de Moral
   *  `nourriture-insuffisante` (−2d10, MDG 14 l.171). Absent = ravitaillement d'équipage réputé assuré
   *  (même décision de périmètre que `waterLitres`). #245. */
  provisions?: number;
  /** Milles de la DERNIÈRE traversée accomplie — vente à un port PRODUCTEUR : « Si le bateau a
   *  parcouru plus de 100 milles » (MDG 15 l.366). Absent = navire à quai depuis sa mise à l'eau. */
  lastVoyageMilles?: number;
  /** Effectif PNJ perdu CUMULÉ (Embrigadement, MDG 15 l.245 : « Vous perdez 2d10 membres d'équipage »),
   *  plafonné au complément nominal du type (`vehicles.json` ship.crew — `applyVesselCrewLoss`). Absent
   *  = aucune perte. #150. */
  crewLost?: number;
  /** #216 — Équipage SALARIÉ embauché (barème `crew-roles.json`). Absent/vide = aucun équipage salarié
   *  = aucune paie prélevée à l'entretien hebdomadaire. */
  crew?: import('../engine/crewMorale').CrewHire[];
  /** #216 — Solde hebdomadaire NON payée cumulée (sous de cuivre) : bourse insuffisante au tick →
   *  `pas-de-paie` et dette accumulée ici. Absent = aucune dette. */
  wagesOwed?: number;
}

/** État réseau SÉRIALISABLE (dans l'état du jeu). `ownership` : heroId → siège (0 = hôte).
 *  `slots` : siège attribué à chacun des 4 emplacements de l'écran d'équipe (0 = hôte). */
export interface NetState {
  mode: 'local' | 'host' | 'guest';
  mySeat: number;
  /** Code de room à 6 caractères (affiché/copiable par l'hôte, voyage dans les snapshots). */
  roomCode: string | null;
  seatNames: Record<number, string>;
  /** Vue HÔTE : sièges en cours de reconnexion (absent = connecté). */
  presence: Record<number, 'ok' | 'away'>;
  /** Vue INVITÉ : sa propre connexion (préservée à l'application des snapshots). */
  connection: 'ok' | 'reconnecting';
  /** Vue INVITÉ : l'hôte est-il momentanément déconnecté ? */
  hostAway: boolean;
  ownership: Record<string, number>;
  slots: number[];
  /** Rôle MJ (bac-à-sable) : le siège qui conduit TOUT le camp ennemi + les jets du monde, sur toutes les
   *  rencontres. `undefined` = IA (défaut, solo ET coop). UNIQUE (zéro ou un siège). Sérialisable (voyage
   *  dans les snapshots coop). Cf. `pilotedByHuman`/`aiDriven`/`controlsCombatant` (netOwnership). */
  gmSeat?: number;
}
export const initialNet = (): NetState => ({
  mode: 'local', mySeat: 0, roomCode: null, seatNames: {}, presence: {},
  connection: 'ok', hostAway: false, ownership: {}, slots: [0, 0, 0, 0],
});

/** Les champs de JEU de l'état (#2817 D5) : tout hôte les porte ; aucun champ d'interface. */
export interface EtatDeJeu {
  screen: Ecran;
  party: Combatant[];
  scene: Scene | null;
  mode: 'exploration' | 'battle';
  /** Groupe anéanti HORS COMBAT (invariant `checkPartyWiped`) → écran de défaite (CampaignView). */
  partyWiped: boolean;
  /** Orientation MONDE vivante par entité/combattant (Dir8) — projetée au rendu (camRot). */
  facing: Record<string, Dir8>;
  /** INTENTION LOCALE armée depuis l'interface (case de console) : le geste que le prochain clic du
   *  champ commettra, avec SA portée peinte d'avance (`localIntent.ts`, spec HUD zone 4). LOCAL au
   *  client : hors `battle`, hors allowlist d'intents, préservé par `applyHostSnapshot` — seul le
   *  COMMIT du geste part en réseau. null = aucune intention (gestes par défaut du grid, inchangés). */
  localIntent: LocalIntent | null;
  /** PORTEUR élu du mode Dissiper (`DISPEL_MODE`, spec HUD §1d) : le clic-token l'a choisi, il reste
   *  à choisir LEQUEL de ses Sorts permanents dissiper — c'est le paramètre que le panneau borné de
   *  la console demande. LOCAL au client au même titre que `localIntent` (aucune ressource engagée,
   *  hors `battle`, hors snapshot). L'élection se joue donc chez l'ÉMETTEUR du clic
   *  (`netFlow.emettreIntentInvite`, table `targetingModes.INTENT_ELECTION_LOCALE`) : elle ne part
   *  JAMAIS en intent — l'exécuter dans le store de l'hôte y ferait naître un panneau étranger, et
   *  l'invité n'en verrait aucun (le snapshot efface ce champ).
   *  null = aucun porteur élu — avant le clic-token, ou après la fermeture du panneau. */
  dispelCarrierId: string | null;
  /** REFUS de geste à DIRE au joueur (`refusVisible.ts`, spec HUD § ARBITRAGE 2026-08-19 « refus
   *  VISIBLE par construction ») — retour d'IHM strictement LOCAL, comme `localIntent` : hors
   *  `battle` (il ne persiste pas au journal de combat), hors snapshot (le refus opposé au geste de
   *  l'hôte ne s'affiche pas chez ses invités). Projeté par `ui/CombatBanner`. */
  refus: RefusIHM | null;
  partyPos: Pt;
  /** Niveau de lumière de scène (mise en scène) : 0 = noir, 1 = plein jour ; null = auto
   *  (horloge/ambiance). Posé par l'Effet `setLight`, lu par le rendu (overlay d'assombrissement). */
  lightLevel: number | null;
  flags: Record<string, boolean>;
  /** ÉTATS DE CAMPAGNE (registre `narratif.etats`) : id d'état → id du héros désigné (forme `heros`) ou id
   *  de la valeur posée (forme `enum`). Posés par les Effets `designerHeros`/`poserEtat`, lus par la
   *  Condition `etat` et le sélecteur `{etat}`. Traversent les scènes ; vidés en nouvelle partie. */
  etats: Record<string, string>;
  /** Espèce (`refChar`) et sexe du héros désigné par un état `heros`, FIGÉS au choix (`designerHerosChoisir`,
   *  EDO 02 l.114) : la ligne d'identité qu'on lit (`identitesResolues`). Traversent les scènes ; vidés en nouvelle partie. */
  identitesFigees: Record<string, { espece: RaceKey; sexe: Sexe }>;
  /** PILE d'objectifs courants (« je fais quoi maintenant ? »), keyés par id STABLE — posés/mis à jour/
   *  retirés par les Effets `setObjective`/`clearObjective`. Le HUD affiche le plus récent (dernier de
   *  la pile). PERSISTE entre transitions de scène (hors `stateFields`, comme `flags`) — un objectif
   *  traverse les scènes ; vidé en nouvelle partie (`startScene`). #238. */
  objectives: Objective[];
  /** Objectifs SOLDÉS de la partie (#717) — MÊME objet `Objective`, DÉPLACÉ ici par l'Effet
   *  `clearObjective` au lieu d'être perdu : c'est la seule archive dont le récap de chapitre
   *  dérive. CAMPAGNE-scopé comme `objectives` ; vidé en nouvelle partie (`startScene`). */
  objectifsSoldes: Objective[];
  /** Borne d'ouverture du chapitre courant (#717) — posée à l'acquittement de l'ouverture
   *  (`acquitterOuverture`), re-posée à la clôture (`cloreChapitre`) ; null = aucun chapitre borné. */
  chapitreDepuis: ChapitreDepuis | null;
  /** La clôture authorée du paquet courant a été CONSOMMÉE (#717) — posé par `cloreChapitre`, lu par
   *  `armChapterRecapIfDue`. La clôture est une Condition, et une Condition vraie le RESTE (un drapeau
   *  ne se retire pas) : sans ce fait, le lot d'effets suivant ré-armerait un récap vide, à l'infini.
   *  Un seul booléen suffit : un paquet porte UNE `narratif.cloture`, et le fait meurt avec la partie
   *  (`startScene` remet l'état à l'init, `loadProject` y repasse pour tout paquet chargé). */
  clotureConsommee: boolean;
  /** Ouverture cérémonielle EN ATTENTE (#717) — posée par `loadProject` APRÈS `startScene` (qui remet
   *  l'état à l'init), rendue par `CampaignOpeningScreen` AVANT tout HUD. */
  pendingOuverture: OuvertureBlock | null;
  /** Récap de fin de chapitre EN ATTENTE (#717) — armé par `armChapterRecapIfDue` quand la CLÔTURE
   *  authorée devient vraie, rendu par `ChapterRecapScreen`. */
  pendingChapterRecap: ChapterRecap | null;
  /** État runtime du carnet d'enquête (#670, mécanique MAISON) — keyé par id d'`Indice`
   *  (`indiceDuNarratif`), absent = indice CACHÉ. CAMPAGNE-scopée : survit aux transitions
   *  de scène (une enquête traverse plusieurs scènes), vidée en nouvelle partie (`startScene`). */
  clues: Record<string, ClueState>;
  /** Brouillard de guerre : cases déjà explorées par scène (`sceneId` → clés "x,y,z"). PERSISTE entre
   *  transitions (hors manifeste de reset `stateFields`) ; vidé en nouvelle partie (`startScene`). */
  explored: Record<string, string[]>;
  /** Journal d'événements RÉCENTS (fenêtre glissante de 40, `log`) — CAMPAGNE-scopé : survit aux
   *  transitions de scène (comme `clues`/`explored`), vidé en nouvelle partie (`startScene`). Verbatim
   *  des dialogues (non borné à 40) : `dialogueHistory`, slot séparé (ne pas greffer ici). */
  journal: string[];
  /** CONVERSATION en cours (`EtatDialogue`, porteuse de sa `session`) — ouverte par l'unique
   *  fabrique `ouvrirDialogue` (`noyau/dialogue.ts`), jamais bâtie à la main. */
  dialogue: EtatDialogue | null;
  /** Archive verbatim des tours de dialogue (#718) — CAMPAGNE-scopée : survit aux transitions de
   *  scène, vidée en nouvelle partie (`startScene`). Fenêtre bornée (`DIALOGUE_HISTORY_CAP`), séparée
   *  du `journal` (dont le cap 40 éjecterait l'historique de dialogue). */
  dialogueHistory: DialogueTurn[];
  /** Marchand ouvert (#2) : instantané du stock pour la visite (Disponibilité figée). */
  merchant: MerchantState | null;
  /** Jeux de taverne ouverts (option `tavern-games`, NADJ 16) — null = fermé ; `result` = dernière partie. */
  tavernGames: tavernFlow.TavernGamesState | null;
  /** Stock PERSISTANT par marchand (#T3 re-stock) : déplété entre visites, re-tiré seulement après
   *  `restockDays` écoulés. `rolledAt` = gameTime du dernier tirage. `bargainLocked` = le joueur a négocié
   *  puis quitté SANS payer → plus de Marchandage avec ce marchand jusqu'au prochain réassort. Reset en nouvelle partie. */
  merchantStocks: MerchantStocks;
  battle: BattleState | null;
  campaignSceneId: string | null;
  /** Couche NARRATIVE de la campagne chargée (#765/#767) — bloc `{affaires, indices, presetsPnj, objets}`
   *  du paquet, posé par `loadProject`, lu par id via les résolveurs UNIQUES de `resolveursDuNarratif.ts`. RUNTIME
   *  (jamais dans `src/data` global, jamais au Compendium) ; null = aucune campagne à narratif. La
   *  persistance snapshot est déférée (#766). */
  campaignNarratif: NarratifBlock | null;
  /** Document source du paquet de campagne chargé (#766) — snapshotté (via `stateFields`), re-registre
   *  les scènes + re-dérive `campaignNarratif` au chargement d'une save. null = aucun paquet chargé. */
  campaignDoc: CampaignDoc | null;
  /** Instances runtime de scène (#707) — delta capturé au départ (entités retirées, flags de porte/
   *  structure) par `sceneId`, réappliqué au clone frais au revisit (`transitionTo`). SURVIT aux
   *  transitions (hors manifeste de reset `stateFields`, `resetOn: []`) ; vidé en nouvelle partie
   *  (`startScene`). Snapshotté via `stateFields` comme `campaignDoc`. */
  sceneInstances: Record<string, SceneMutation>;
  pendingTest: PendingTest | null;
  /** Sauvegarde d'Initiative d'une « Fuite de vapeur » (MDG 12 l.326-328) — Test perso différé par modale. */
  pendingSteamSave: PendingSteamSave | null;
  /** Exposition à une Influence corruptrice en cours (LDB 19) — Test différé par modale. */
  pendingCorruption: PendingCorruption | null;
  /** Tests de SEUIL de Corruption (LDB 19 l.70) EN ATTENTE du slot `pendingCorruption`, dans l'ordre où
   *  ils sont dus — le slot est UNIQUE, et une RAFALE de gains (deux héros franchissant leur seuil dans
   *  la MÊME bande de fin de combat) y ferait sinon tomber tous les suivants sur le repli auto-résolu :
   *  un Test RAW roulé en silence. Vidée un à un par `releaseCorruptionSlot` (`corruptionFlow`). */
  corruptionQueue: PendingCorruption[];
  pendingBargain: PendingBargain | null;
  pendingAppraise: PendingAppraise | null;
  pendingAttack: PendingAttack | null;
  /** Test de Dextérité PAR ACTION de « Main ensanglantée » (AA 07 l.117) — interposé AVANT l'attaque quand
   *  l'arme employée est tenue dans une main gatée (`attackHandGate`). Modale influençable, calque `reload`. */
  pendingHandGate: PendingHandGate | null;
  /** Pilonnage INDIRECT en cours (« viser une case », AA 10 l.169-171) : pièce indirecte servie en attente du
   *  point d'impact (placeur de zone source 'siege'). Clic-case → `siegeAimCommit`. */
  pendingSiegeAim: PendingSiegeAim | null;
  pendingReload: PendingReload | null;
  /** « Se libérer » (Empêtré) / « se rouler » (En flammes) en cours — modale interactive (LDB 16). */
  pendingStateRecovery: PendingStateRecovery | null;
  pendingDefense: PendingDefense | null;
  /** « Je te renie ! » (LDB 17 l.67) : choix subir la mutation / la refuser (1 Résilience). */
  pendingRenounce: PendingRenounce | null;
  pendingDisengage: PendingDisengage | null;
  /** « Au Contact » (LDB 62 l.176, Option « Longueur d'arme ») : Test opposé de Corps à corps + choix du vainqueur. */
  pendingAuContact: PendingAuContact | null;
  /** Empoignade (LDB 14 l.161) : action à son tour — Test opposé de Force OU « Briser » (Avantage supérieur). */
  pendingGrapple: PendingGrapple | null;
  /** Déplacement-puis-interaction : le décor visé ET la case où la marche PLANIFIÉE se termine
   *  (`ExploreMovePlan.dest` — abord d'une place, ou case adjacente d'un décor fouillable). L'interaction
   *  se consomme À CETTE CASE : une adjacence CROISÉE en chemin ne l'ouvre pas (le chemin vers l'abord
   *  d'une place longe la table, et la fouille/assise s'y déclenchait à mi-parcours, hors de l'abord). */
  pendingInteract: PendingInteract | null;
  pendingCast: PendingCast | null;
  /** Contre-sort à PLUSIEURS (réaction au Sort figé dans `pendingCast`) : les contre-lanceurs
   *  enrôlés par `routeCounterspell`, chacun son jet (flux multi `FLOWS.counterspell`). Null = pas de réaction. */
  pendingCounterspell: PendingCounterspell | null;
  /** Test Étendu en cours (LDB 12 : DR cumulé vers une cible, ex. crochetage) : flux multi
   *  SÉQUENTIEL — un Round à la fois (`FLOWS.extendedTest`), cumul dans `extendedTestNext`. */
  pendingExtendedTest: PendingExtendedTest | null;
  /** Enfoncer une porte à PLUSIEURS (EDO Appendice 2 : objet BE/B) : flux multi PARALLÈLE — chaque
   *  héros frappe (`FLOWS.forceDoor`), cumul des dégâts vs B dans `forceDoorConfirm`. */
  pendingForceDoor: PendingForceDoor | null;
  /** DÉSIGNATION d'un héros pour un état de campagne (Effet `designerHeros`, EDO 02 l.91). */
  pendingDesignationHeros: PendingDesignationHeros | null;
  /** LOT DE DÉS d'un étal (#1426) : les tirages d'ouverture d'un marché/port, posables d'un bloc. */
  pendingEtalLot: PendingEtalLot | null;
  /** CASCADE séquentielle influençable (jets de NUIT / VOYAGE) : une étape à la fois (`FLOWS.cascade`),
   *  conséquence par `kind` + avancée du curseur dans `cascadeNext` (noyau/cascade.ts). */
  pendingCascade: PendingCascade | null;
  /** Pile de cascades SUSPENDUES (`suspendActiveCascade`/`resumeSuspendedCascade`, noyau/cascade.ts) :
   *  quand un combat s'ouvre PENDANT une cascade active (ex. un abordage déclenché par l'applier d'une
   *  étape de voyage), la cascade active est poussée ICI (LIFO) plutôt qu'écrasée/perdue — le slot
   *  `pendingCascade` redevient disponible pour les cascades DU COMBAT. Résumée (tête de pile) au
   *  teardown de combat (`dismissVictory`/`dismissDefeat`) si le slot est libre. */
  suspendedCascades: PendingCascade[];
  /** Tests d'entretien du FRANCHISSEMENT DE JOUR mis EN FILE pendant un combat (#253) : en combat le slot
   *  de cascade appartient à l'arène → les Tests de Résistance quotidiens (Faim/Soif/maladie/convalescence/
   *  dessoûlage) ne peuvent pas s'ouvrir tout de suite. Ils sont DIFFÉRÉS ici puis CONSOMMÉS par
   *  `openCombatEndCascade` (fin de combat) — jamais roulés en silence. La garde `lastUpkeepDay` reste la
   *  référence anti-double-résolution (l'entretien lui-même n'est appliqué qu'une fois). */
  deferredUpkeepQueue: import('./stepBrand').BuiltCascadeStep[];
  /** SÉQUENCE EN COURS (socle `noyau/sequenceCore`, #1279) : la situation qui se joue en MANCHES
   *  jusqu'à une issue — poursuite terrestre (LDB 15), jeu de taverne opposé (NADJ 16), demain les
   *  crises de mer. État GÉNÉRIQUE (id de définition, rang de manche, cumuls par camp, paramètres
   *  d'auteur) + la charge utile du domaine ; persisté entre les manches. `null` hors séquence. */
  sequence: EtatDeSequence | null;
  /** Incantation OPPOSÉE (`spec.opposed`) : chaque CIBLE oppose son Test (FM/Int) à l'incantation
   *  figée (`pendingCast.result`) — multijet DANS la modale de cast (cible IA = rangée témoin
   *  auto-roulée, cible héros = interactive). `oppositionConfirm` agrège → `pendingCast.opposedOutcome`
   *  → `castConfirm` applique (cible résistante = aucune op ; sinon ops à la marge). */
  pendingCastOpposition: PendingCastOpposition | null;
  /** Télégraphe d'intention ENNEMI : réticule « qui l'adversaire vise » + manière (`kind`), montré
   *  ~0,85 s AVANT l'action. Alimente le réticule/la ligne sur la carte ET la bannière d'annonce. */
  actorAim: ActorAim | null;
  /** Télégraphe de DÉPLACEMENT ENNEMI : chemin (+ destination = dernière case) montré ~0,4 s AVANT que
   *  l'ennemi glisse dessus, pour lire « où il va ». Tracé via movePreviewEls (rouge), comme un aim. */
  actorMove: { id: string; path: { x: number; y: number }[] } | null;
  /** Télégraphe de ZONE (ZdE) ENNEMI : disque Chebyshev (centre ± rayon) peint ~0,7 s AVANT que le
   *  sort de zone d'un lanceur IA ne se résolve, pour lire « où l'aire va tomber » (parité avec
   *  `actorAim` du missile, qui ne sait montrer qu'une ligne from→to inadaptée à une case). */
  actorAoe: { casterId: string; center: { x: number; y: number }; radius: number } | null;
  /** Soin de Guérison en cours (modale interactive, combat ou hors-combat). */
  pendingHeal: PendingHeal | null;
  /** Passe de Chirurgie en cours (jet INFLUENÇABLE du chirurgien, modale embarquée dans l'infirmerie). */
  pendingSurgery: PendingSurgery | null;
  /** Infirmerie ouverte (modale de soins persistante, hors combat — noyau/medicFlow). */
  medic: MedicState | null;
  /** Modale de Repos (nuit à l'auberge / chez soi / campement — noyau/restFlow). */
  pendingRest: PendingRest | null;
  /** Conseil de bord hebdomadaire (choix de paie + recalcul de Moral joué — #229, noyau/shipCrew). */
  pendingCouncil: PendingCouncil | null;
  /** Balayage (Frappe Mortelle) d'un héros en cours : enchaînements d'attaque restants. */
  pendingCleave: PendingCleave | null;
  /** Maniement de deux armes : sélection de la 2ᵉ cible (après une 1ʳᵉ frappe réussie). */
  pendingDualStrike: PendingDualStrike | null;
  /** File de LIGNES de journal de combat différées (hors `battle.log`) : un hook profond (ex.
   *  `onGainCondition` ennemi/auto, déclenché AVANT le `set` final qui remplace `battle.log`) y pousse
   *  ses lignes ; `drainPendingLog` les déverse dans le MÊME `set` atomique qui réécrit `battle.log`
   *  (bon ordre, zéro clobber). `cid` = combattant concerné (couleur/portrait du feed).
   *
   *  `stateId` = État nommé par la ligne, posé par les producteurs AU FUR ET À MESURE de leur
   *  branchement au canal `OpsCtx.onCondition` (V8d-B, #1330). AUCUN ne le pose encore : son absence
   *  ne dit RIEN de la ligne aujourd'hui — surtout pas qu'elle ne parle d'aucun État. */
  pendingLogQueue: { line: string; cid?: string; stateId?: string }[];
  /** File d'effets PROGRAMMÉS (minuteries `delayedEffect`) — déclenchés au franchissement de
   *  leur échéance dans `advanceTime`. */
  scheduledEffects: ScheduledEffect[];
  /** Battement en cours (LDB 10 l.103 — modale de jet de CC non opposé retirant l'Avantage adverse). */
  pendingBattement: PendingBattement | null;
  /** Distraire en cours (LDB 10 l.364 — modale de Test opposé Athlétisme vs Calme). */
  pendingDistraire: PendingDistraire | null;
  /** Manœuvre de créature en cours (Souffle/Vomi/Langue/Regard/Étreinte — modale de jet d'attaquant). */
  pendingManeuver: PendingManeuver | null;
  /** Course en cours (modale du Test `course` → déplacement étendu). */
  pendingRun: PendingRun | null;
  /** Chute VOLONTAIRE en cours (LDB 15 l.82 — choix Sauter/Tenter, puis modale du Test `chute` → chute). */
  pendingFall: PendingFall | null;
  /** Manœuvre navale en cours (MDG 13 : Test de Navigation du barreur → vire le cap + avance). */
  pendingShipManeuver: PendingShipManeuver | null;
  /** Tir de batterie en cours (MDG 14 : Test d'équipage des Artilleurs → volée sur la cible). */
  pendingShipBattery: PendingShipBattery | null;
  /** Test d'équipage GÉNÉRIQUE en cours (MDG 14 — Rude épreuve : total négatif → perte de Moral, l.110). */
  pendingCrewTest: PendingCrewTest | null;
  /** Chanson de marin en cours (Talent, MDG 09 l.32-40 : choix de la chanson + Test de Divertissement (Chant)). */
  pendingShanty: PendingShanty | null;
  /** Approche d'une source de Peur en cours (Test différant le clic — LDB 21 l.27). */
  pendingApproach: PendingApproach | null;
  /** Bénédiction de Protection en cours (Test de FM +20 différant la déclaration d'attaque — LDB 41 l.142). */
  pendingWard: PendingWard | null;
  /** Focalisation en cours (modale interactive). */
  pendingFocus: PendingFocus | null;
  pendingDispel: PendingDispel | null;
  // (Psychologie de combat : cascade de Round, cf. openRoundStartPsych/openRoundEndCascade.)
  /** Entrée en Frénésie d'un héros en cours (Test de FM, LDB 21 l.31). */
  pendingFrenzy: PendingFrenzy | null;
  /** Modale d'ordre de Round en attente (Chance, 3e usage : pré-emption d'initiative). */
  pendingRoundStart: { round: number; readyBySeat?: Record<number, boolean> } | null;
  /** Tir rapide (LDB 10) : id du héros dont la visée d'interruption est ARMÉE pendant la pause (badge de la
   *  frise) — le prochain clic sur un adversaire (carte OU frise) déclenche `preemptRangedShot`. `null` = aucune. */
  preemptAiming: string | null;
  /** Sauvetage par le Destin en attente (LDB 17 l.29-32). */
  pendingFateSave: { heroId: string; source: FateSaveSource; restoreWounds?: number;
    /** Animosité & Haine (ADE II Annexe I, règle facultative) : Groupe (ou nom) de « l'individu ou
     *  l'élément qui l'a presque tué » — Cible de l'Animosité acquise si le héros dépense le Destin. */
    foeCible?: string } | null;
  /** Récompenses de victoire capturées (écran de fin de combat) ; null hors victoire. */
  pendingVictory: PendingVictory | null;
  /** VOL TERRESTRE en cours (#327) : le combat courant est né d'une péripétie dangereuse terrestre —
   *  la cargaison du convoi est en jeu, dénouée au teardown de combat (`resolveCargoRaid`). */
  cargoRaid: boolean;
  /** Butin HORS combat (fouille/Test/dialogue/trigger) — fenêtre « qui l'emporte ? » (même brique). */
  pendingLoot: PendingLoot | null;
  /** `text` = Markdown (rendu par `Prose`, `src/ui/DocumentModal.tsx`) : un paragraphe par bloc séparé d'une ligne vide.
   *  `documentId` = l'entrée de `narratif.documents` remise (Effet `document`) : le texte est une prose de paquet ;
   *  `suite` = la SUITE du Flow qui l'a remise (geste `suspensif`), rejouée par `closeDocument`. */
  document: { title: string; text: string; source?: SourceRef; documentId?: string; suite?: Flow; remise: number } | null;
  /** Compteur des remises de `document` : chaque pose l'estampille (`remise`), le masque de l'invité s'y keye. */
  remisesDeDocument: number;
  /** Scène d'où l'on vient (pour `transitionBack` : sortie d'intérieur). */
  previousScene: { id: string; pos: Pt } | null;

  /** Campagne publiée choisie au menu — jouée après constitution du groupe (PartyScreen).
   *  null = « Nouvelle partie » standard (campagne par défaut). `id` (#608) : plombé à la sélection
   *  (builtin/publié) pour que `PartyScreen` surligne par id, jamais par `label`. `projet` : l'id du
   *  DOCUMENT lancé (`CampaignDoc.projet`), distinct de `id` pour une entrée de bibliothèque (#2206). */
  pendingCampaign: { id: string; label: string; scenes: Scene[]; startSceneId: string; worldMap?: import('./worldMap').WorldMap | null; activeAxes?: string[]; narratif?: NarratifBlock; projet: { id: string } } | null;
  /** Interlude « Entre deux aventures » (LDB 22-23, Jalon 5) — état + dépôts bancaires + commandes. */
  interlude: InterludeState | null;
  bank: BankDeposit[];
  pendingOrders: { heroId: string; trappingId: string }[];
  /** Système de Faveurs (LDB 23 l.139-151, #509) — contrepartie future acceptée en échange d'une
   *  aide immédiate ; persistée SOURCE UNIQUE, même patron que `bank`/`pendingOrders`. */
  favors: Favor[];
  /** Jet d'Activité en attente (Revenus / lancer d'Artisanat — modale, fabrique rollFlow).
   *  Délégués `activity{Roll,Reroll,BonusSL,DarkPact}` : générés (RollFlowActionsMap). */
  pendingActivity: PendingActivity | null;
  /** Combat de masse / Puissance de Bataille (ADE II 08) : état de la bataille abstraite en cours
   *  (Puissance des deux armées, Round, Scènes) — null hors bataille. */
  massBattle: MassBattleState | null;
  /** Coop en ligne : état réseau sérialisable + actions de session — délégué à netFlow.
   *  Les objets réseau vivants (sessions, sockets du relay) restent des singletons de module. */
  net: NetState;
  /** Écran de fin de séance (`SessionEndModal`) ouvert par l'Effet `sessionEnd` (#83) — le menu de jeu
   *  le pilote encore par état local ; ce flag EN PLUS permet à un beat de campagne authoré de l'ouvrir. */
  sessionEndOpen: boolean;
  /** Combat monté (AA 9 l.36) : clic sur un couple cavalier+monture (deux ennemis) → choisir lequel
   *  frapper (le cavalier −10 si l'on est plus petit que la monture ; abattre la monture désarçonne). */
  /** `approche` = VERDICT D'ARMEMENT capturé au clic qui a ouvert ce choix (cf. `PendingApproach`). */
  pendingMountTarget: { riderId: string; mountId: string; approche?: boolean } | null;
  /** Temps de jeu : minutes depuis l'époque (Hexenstag 2512 00:00, cf. clock.ts). « Tout est horodaté ». */
  gameTime: number;
  // ── Voyage & nourriture (#T2) ──
  /** Carte du monde du projet courant (graphe de lieux/routes, éditable) — null si le projet n'en a pas. */
  worldMap: import('./worldMap').WorldMap | null;
  /** Overlay carte du monde ouvert (exploration). */
  worldMapOpen: boolean;
  /** Voyage en cours/interrompu (progression km — « Reprendre le voyage » après une embuscade). */
  travelPlan: import('./travelFlow').TravelPlan | null;
  /** Billet payé dont il reste des tronçons (EDO 01 l.142) — consommé au départ de chacun, sans débit. */
  billetEnMain: import('./billetFlow').BilletEnMain | null;
  /** Issue du Marchandage de chaque billet, par `cleDeBillet` — un Test par billet (EDO 01 l.142). */
  marchandagesDeBillet: Record<string, import('../engine/bargain').BargainOutcome>;
  /** Récapitulatif du dernier segment de voyage (audit M4) — modale à l'arrivée/interruption. */
  travelRecap: import('./travelFlow').TravelRecap | null;
  /** Dernier jour (index d'horloge) traité par l'entretien quotidien (rations/faim) — anti-double-comptage. */
  lastUpkeepDay: number;
  /** Budget d'heures de voyage CONSOMMÉ le jour calendaire courant (#340) — SOURCE UNIQUE keyée sur
   *  `dayIndex(gameTime)`, remise à zéro au franchissement de jour. `foot`/`mount` = heures à pied / en
   *  selle déjà parcourues aujourd'hui (le budget RAW de 6 h se compte PAR JOUR, pas par trajet) ;
   *  `marched` = la marche forcée du jour a déjà été testée (un seul Test de Résistance/jour, LDB 51 l.195). */
  travelDayHours: { day: number; foot: number; mount: number; marched: boolean };
  /** Dernier jour calendaire (index d'horloge) où une NUIT a été jouée (`sleepParty`/`buildNightCascade`)
   *  — garde de la « nuit forcée » maison (#340) : un jour franchi au-delà sans sommeil coûte 1 Exténué. */
  lastNightDay: number;
  /** Départ de voyage BLOQUÉ par la porte d'heure (maison `travel-departure-gate`, #340) : terre/fleuve
   *  de nuit → « Attendre l'aube » (nuit jouée) ou annuler. `null` = pas de départ en attente. */
  pendingDeparture: { mode: import('../engine/travel').TravelMode; cause: 'nuit' | 'budget'; dawnAt: number } | null;
  /** Navire de campagne PERSISTANT (MDG 13-14) — porte son `vehicleId` et son MORAL (recalculé chaque
   *  semaine par l'entretien quotidien via `tickShipMorale`). `null` hors campagne navale. */
  vessel: CampaignVessel | null;
  /** Registre UNIQUE des Possessions (#615, SOCLE POSSESSIONS §6) — bêtes/serviteurs/véhicules/navires/
   *  immeubles, hors héros de `party`. Aucun mirroir par kind ; `possessionsFlow.ts` en est la plomberie. */
  possessions: Possession[];
  /** Écran PORT ouvert (services au navire à quai — MDG 15) : réparation/carénage/Améliorations +
   *  commerce (offres d'achat générées à l'escale). `null` = fermé. */
  port: import('./portFlow').PortState | null;
  /** Board de RUMEURS COMMERCIALES persistant (MSRC 13 l.180) : chaque rumeur désigne un AUTRE Lieu où
   *  des biens se vendent au double. Entendues aux marchés (Ragot Complexe −10) OU à l'auberge du hub de
   *  ville (#352, Activité `recueillir-informations`, EDOC 8 l.151), consultées dans l'écran Marché/le
   *  panneau auberge, appliquées à la vente au Lieu désigné. Persiste au niveau GROUPE (sauvegardé, remis
   *  à zéro en nouvelle partie via l'état initial). */
  tradeRumours: import('../engine/landCargo').TradeRumour[];
  /** Écran MARCHÉ TERRESTRE ouvert (commerce de cargaison à un Lieu `market` de la carte — MSRC 13 l.3) :
   *  offres d'achat générées à l'arrivée. `null` = fermé. */
  landMarket: import('./landMarketFlow').LandMarketState | null;
  /** ACTIVITÉS EN MER en attente (semaine de 8 jours, MDG 15 l.266-306) — modale de choix par héros. */
  pendingSeaActivities: import('./seaActivities').PendingSeaActivities | null;
  /** ÉVÉNEMENT DE PORT « Prêtre de Manann » en attente de CHOIX (MDG 15 l.246). */
  pendingManannPriest: import('./seaVoyageFlow').PendingManannPriest | null;
  /** Permission de RELÂCHE À TERRE en attente de CHOIX, posée à l'accostage AVANT l'événement de
   *  port (MDG 15 l.245). */
  pendingShoreLeave: import('./seaVoyageFlow').PendingShoreLeave | null;
}

/** L'état et les actions du jeu (#2817 D5) : ce que reçoivent les flux du noyau. */
export type Jeu = EtatDeJeu & ActionsDuNoyau;

/** Valeurs initiales des champs de jeu (#2817 D5) : un objet neuf à chaque appel. */
export function etatInitialDuJeu(): EtatDeJeu {
  return {
    screen: 'menu',
    gameTime: campaignStart(),
    lastUpkeepDay: dayIndex(campaignStart()),
    travelDayHours: { day: dayIndex(campaignStart()), foot: 0, mount: 0, marched: false },
    lastNightDay: dayIndex(campaignStart()),
    vessel: null,
    possessions: [],
    tradeRumours: [],
    landMarket: null,
    worldMap: emptyWorldMap(),
    worldMapOpen: false,
    travelPlan: null,
    billetEnMain: null,
    marchandagesDeBillet: {},
    travelRecap: null,
    party: [],
    scene: null,
    campaignNarratif: null,
    mode: 'exploration',
    partyWiped: false,
    facing: {},
    localIntent: null,
    dispelCarrierId: null,
    partyPos: { x: 0, y: 0 },
    lightLevel: null,
    flags: {},
    etats: {},
    identitesFigees: {},
    remisesDeDocument: 0,
    objectives: [],
    objectifsSoldes: [],
    chapitreDepuis: null,
    clotureConsommee: false,
    clues: {},
    explored: {},
    journal: [],
    dialogue: null,
    dialogueHistory: [],
    merchant: null,
    merchantStocks: {},
    tavernGames: null,
    battle: null,
    campaignSceneId: null,
    interlude: null,
    bank: [],
    favors: [],
    massBattle: null,
    net: initialNet(),
    ...initialFields(),
  };
}
