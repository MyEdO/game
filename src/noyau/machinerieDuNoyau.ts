/**
 * LA MACHINERIE DU NOYAU (#3370) : les écritures que le noyau, l'éditeur ou un test appellent, et qu'aucun siège n'envoie
 * ni aucun hôte ne joue. Elles ne sont pas des verbes (`ActionsDuNoyau`) : ni `Intention`, ni `VERBES`, ni
 * `GesteDuNoyau` ne les nomment. Seul un `Get<JeuDuNoyau>` les atteint, celui des fabriques (`creerActionsDuNoyau`) et des
 * flux qui les appellent.
 */
import type { Combatant, CharKey } from '../engine/types';
import type { SupportDetail } from '../engine/skills';
import type { StakeRef } from '../data';
import type { Flow } from '../data/schemas/defs-scenes/effets';
import type { NarratifBlock } from '../data/schemas/defs-scenes/narratif';
import type { MassBattleSpec } from '../engine/massBattle';
import type { PossessionInput } from '../engine/possession';
import type { HealMode } from '../engine/healing';
import type { PendingDesignationHeros, PendingExtendedTest } from './pendings';
import type { Scene } from './monde/scene';
import type { Pt } from './monde/path';
import type {
  IdDeCombattant, IdDeHeros, IdDePossession, IdDEntiteDeScene, IdDeTireurRapide, IdDObjet,
} from './designations';
import type { ActionsDuNoyau } from './actionsDuNoyau';
import type { BattleActionMode } from './actionRegistry';
import type { BattleClickOpts, TileClickOpts } from './targetingModes';
import type { AttackKind } from '../engine/creatureAttacks';
import type { EtatDeJeu, Jeu, PaquetALancer, PendingInteract, ShootingStanceKey } from './etat';

export interface MachinerieDuNoyau {
  // ── Horloge ──
  /** Écrivain UNIQUE de l'avance de `gameTime` : pose l'horloge, tire les effets programmés échus
   *  (`fireScheduledEffects`, #668) puis dissipe les effets à durée d'horloge échus (`purgeSurAvanceDHorloge`, #1599). */
  avancerLHorloge: (minutes: number) => void;
  /** Avance l'horloge in-game de `minutes` (no-op si ≤ 0) par `avancerLHorloge`, puis ce qui la suit hors combat (#T3 cascade). */
  advanceTime: (minutes: number) => void;
  // ── Lancement de scène ──
  /** `narratif` : couche narrative du projet, posée AVANT l'entrée en scène — la Psychologie à la
   *  rencontre y résout les presets de PNJ (#1882). Absente = couche vidée. */
  startScene: (scene: Scene, narratif?: NarratifBlock) => void;
  /** Enregistre plusieurs scènes (projet multi-scènes) puis démarre l'entrée. `worldMap` = carte du
   *  monde du projet (#T2, projet v2) — null/absent : pas de voyage dans ce projet. */
  loadProject: (paquet: PaquetALancer) => void;
  setParty: (p: Combatant[]) => void;
  /** Ouvre un interlude de N semaines (Effet d'éditeur `interlude` ou appel direct). */
  startInterlude: (weeks?: number) => void;
  /** « Dormir / Se reposer N jours » (hors combat) : repos de `days` journée(s) — retire l'Exténué,
   *  soigne des Blessures (l.380 volet a Résistance +20 → DR+BE, ET volet b +BE/jour) et déclenche les
   *  cauchemars des héros marqués (LDB 16/18/21). `days` par défaut = 1 (une nuit). */
  restParty: (days?: number) => void;
  /** Reprise après un changement de Cadence de combat en plein combat (passage en Auto/Rapide) :
   *  ré-entre la boucle (auto-résolution de modale + tour de l'IA). No-op en manuel / hors combat. */
  resumeCadence: () => void;
  // ── Combat ──
  startCombat: (encounterId: string, onVictory?: Flow, opts?: { noSurprise?: boolean }) => void;
  /** Amorce une bataille de masse et bascule sur sa vue. */
  startMassBattle: (spec: MassBattleSpec) => void;
  /** Passe de la phase pré-bataille (Discours/Planification) aux Rounds de bataille. */
  massBattleBegin: () => void;
  /** Test Étendu SÉQUENTIEL (LDB 12) : ouvre le flux (ex. crocheter DR 5) ; un Round à la fois. */
  startExtendedTest: (opts: { actorId: IdDeCombattant; label: string; skillLabel: string; skill?: PendingExtendedTest['skill']; characteristic?: CharKey; target: number; targetDR: number; maxAttempts?: number; flag?: string; support?: SupportDetail; dispel?: { spellId: string; casterId: IdDeCombattant; label: string }; outcome?: PendingExtendedTest['outcome']; stake?: StakeRef; suite?: Flow }) => void;
  /** Enfoncer une porte à PLUSIEURS (EDO Appendice 2) : ouvre le flux (objet BE/B) ; chacun frappe. */
  startForceDoor: (opts: { label: string; doorBE: number; doorB: number; heroIds: IdDeHeros[]; flag?: string; suite?: Flow }) => void;
  faceAtCombatStart: () => void;
  faceFromPath: (id: IdDeCombattant, path?: Pt[] | null) => void;
  faceToward: (id: IdDeCombattant, from?: Pt, to?: Pt) => void;
  // ── Le clic du champ en combat : `cliquerLaCase` les joue, et un geste différé s'y relance ──
  /** Le clic d'un combattant, au mode de ciblage courant (`currentTargetingMode`), ou le tir du Tir rapide armé de la
   *  pause de Round (`preemptAiming`). */
  cliquerLeCombattant: (id: IdDeCombattant, opts?: BattleClickOpts) => void;
  /** Le clic d'une case libre : le commit-case du mode de ciblage courant, sinon le déplacement de l'actif (aperçu,
   *  puis commit), la Course, ou le Désengagement de l'actif Engagé. */
  cliquerLaCaseDuCombat: (pt: Pt, opts?: TileClickOpts) => void;
  // ── Commits de clic : le clic du champ (`cliquerLeCombattant`, `cliquerLaCaseDuCombat`) les appelle ──
  /** Tir rapide (talent, LDB 10) : INTERRUPTION à distance en début de Round (hors de l'ordre) ; le tir
   *  se résout par la modale de jet normale et épuise le tour normal du tireur (Action + Mouvement). */
  preemptRangedShot: (heroId: IdDeTireurRapide, targetId: IdDeCombattant) => void;
  /** Pilonnage INDIRECT : dépose le point d'impact choisi (clic-case du placeur 'siege') et ouvre la modale
   *  de tir de la pièce indirecte servie (`pendingAttack` siège). Cf. `siegeAimCommit` (combatSlice). */
  siegeAimCommit: (pt: Pt) => void;
  /** Balayage (Frappe Mortelle, LDB 14 l.9) : enchaîne l'attaque sur une cible adjacente (ouvre une
   *  modale d'attaque standard) ; borné à BCC enchaînements. */
  cleaveAttack: (targetId: IdDeCombattant) => void;
  /** Maniement de deux armes (LDB 10 l.767-773) : 2ᵉ frappe (main secondaire) contre la cible choisie. */
  dualStrikeAttack: (targetId: IdDeCombattant) => void;
  /** Guérison (LDB 09-Compétences) — ouvre la modale de soin EN COMBAT (soi/allié adjacent). */
  battleHeal: (targetId: IdDeCombattant, mode: HealMode) => void;
  /** Course (LDB 15 l.41) : ouvrir la modale, lancer le Test `course`, Chance/Résilience, appliquer (déplacement étendu). */
  battleRun: (dest?: Pt, movement?: { path: Pt[]; cost: number }) => void;
  /** Bordée (« Tir de batterie », MDG 14 l.128) : ouvre la modale du Test d'équipage des Artilleurs sur `targetId`. */
  battleShipBattery: (shipId: IdDeCombattant, targetId: IdDeCombattant) => void;
  /** « Au Contact » (LDB 62 l.176, Option « Longueur d'arme ») : Test opposé de Corps à corps + choix du vainqueur. */
  battleAuContact: (targetId: IdDeCombattant) => void;
  /** Empoignade (LDB 14 l.161) : action à son tour entre deux Empoignés. */
  battleGrapple: (targetId: IdDeCombattant) => void;
  // ── Corps d'offre : l'offre du registre les joue (`jouerLOffre`, `OFFRES_PAR_RUN`), l'IA et le ciblage aussi ──
  armerLaFinDuTour: () => void;
  /** « Diriger l'équipe » (Commandant d'équipe, AA) : Test de Commandement (+0) pour aider une équipe d'Arme
   *  d'équipe à portée de voix — sur réussite, elle tire au score de Projectiles du commandant. Coûte l'Action. */
  aiderLEquipe: () => void;
  /** Action « Viser » (sans jet) : +20 (Accessible) au prochain tir tant que c'est la dernière action. */
  prendreLaVisee: () => void;
  /** Battement (LDB 10 l.103 / AA 13 l.17) : Action, Test de Corps à corps NON opposé retirant de
   *  l'Avantage adverse. `foeId` absent = 1er éligible (picker via réglage `battement.adversaire`). */
  faireUnBattement: (foeId?: IdDeCombattant) => void;
  /** Test d'équipage GÉNÉRIQUE (MDG 14) : ouvre la modale multi-jets du type `testTypeId` (Rude épreuve…). */
  eprouverLEquipage: (shipId: IdDeCombattant, testTypeId: string) => void;
  /** « Sur la défensive » : utilise l'Action pour +20 en défense jusqu'au prochain tour. */
  prendreLaDefensive: () => void;
  /** Désengagement (LDB 15 l.43-68) : menu Sacrifier l'Avantage / Esquiver / Fuir / Renoncer. */
  rompreLEngagement: () => void;
  mettrePiedATerre: () => void;
  /** Distraire (LDB 10 l.364 / AA 13 l.51) : MOUVEMENT, Test opposé Athlétisme vs Calme. Sur victoire,
   *  le foe est distrait (ne gagne plus d'Avantage). `foeId` absent = 1er éligible en Ligne de vue
   *  (picker via réglage `distraire.adversaire`). */
  tenterDeDistraire: (foeId?: IdDeCombattant) => void;
  terminerLeTour: () => void;
  /** Entrée en Frénésie d'un héros (LDB 21 l.31) : ouvrir la modale, lancer le Test de FM, Chance/Résilience, appliquer. */
  entrerEnFrenesie: () => void;
  /** Action « cumuler l'Avantage » (LDB 09 l.305-308) : Test de la Compétence `skillId` (Intuition/
   *  Savoir/Survie/Prière) via la modale de Test standard ; sur réussite +1 Avantage plafonné. Coûte l'Action. */
  gagnerLAvantage: (skillId: string) => void;
  /** « Quitter la pièce » (release) : libère le poste servi pour un autre — coûte l'Action. */
  quitterLePoste: () => void;
  /** « Servir cette pièce » (MDG 12) : le héros actif devient chef d'un poste de siège NON servi adjacent (arme octroyée) — coûte l'Action. KIND-AGNOSTIQUE. */
  servirLePoste: (target?: { hullId: IdDeCombattant; posteUid: string }) => void;
  /** Manœuvre de ZONE / soi immédiate (Souffle/Vomi/Langue/Hurlement/Regard/Étreinte) : résolution
   *  directe par le résolveur moteur partagé. L'Étreinte glaciale coûte l'Action (LDB 85 l.112). */
  lancerLAttaqueDeZone: (kind: AttackKind) => void;
  /** Combat monté (cadre : LDB 14 l.175-187) : enfourcher une monture libre adjacente / en descendre.
   *  Coût = MOUVEMENT sans jet ni Action — MAISON [entériné 2026-07-17] (« Met les en Maison pour le
   *  moment », #526 ; aucune clause de coût citable, LDB 14/15/09 + AA 9 fouillés en entier) ;
   *  Chevaucher sans Test : LDB 09 l.112. */
  /** `mountId` = la monture DÉSIGNÉE (sa pastille sur le champ) ; absent = la plus proche. */
  monterEnSelle: (mountId?: IdDeCombattant) => void;
  /** Ramasser UN objet au sol pendant un Round (LDB 13 l.115-116) : applique au combattant
   *  actif un item ramassable d'un `prop` interactif adjacent. Consomme l'Action, pas d'auto-équipe.
   *  `key` = `eff:<index dans interact.effects>` (cf. entityPickables). */
  ramasserLObjet: (entityId: string, key: string) => void;
  /** « Pousser » un engin de siège CREWÉ à roues (ADE II 8 l.258, #156) : ouvre le mode de
   *  ciblage-CASE 'push' (le clic-sol suivant commet la translation de formation, `targetingModes.ts`).
   *  Chef d'un poste d'engin MOBILE, Action dispo, Équipe ≥ moitié requise (sinon no-op, comme un tir
   *  sous-effectif refusé). Mouvement SIMPLE, aucun jet ; plafonné à `rule('siege-engine-push-speed')`. */
  pousserLEngin: () => void;
  /** Se libérer (Empêtré, Test opposé de Force) / se rouler au sol (En flammes, Athlétisme) : OUVRE la modale (LDB 16 l.66/84). */
  seRemettreDeLEtat: (state: string) => void;
  armerLeMode: (a: BattleActionMode | null) => void;
  /** Arme une ATTAQUE (id d'`AttackOption` : 'arme'/'morsure'/'tentacule'/'pietinement'…) pour le clic-ennemi
   *  — source UNIQUE de l'attaque armée. Toggle → 'arme'.
   *  Le clic-ennemi résout l'attaque armée via l'approche-puis-frappe (cliquerLeCombattant). */
  armerLAttaque: (id: string) => void;
  /** Capacité SUR SOI octroyée par un trait (Métamorphose humain↔hybride de l'Enfant d'Ulric) : résout la
   *  manœuvre `targeting:'self'` sur l'acteur et consomme l'Action (la 2ᵉ vient du `loseTurn` de ses effets). */
  manoeuvrerSurSoi: (maneuverId: string) => void;
  /** Manœuvre navale (MDG 13) : ouvre la modale du Test de Navigation pour le navire que sert `crewId`. */
  manoeuvrerLeNavire: (crewId: IdDeCombattant) => void;
  /** Chanson de marin (Talent, MDG 09 l.32-40) : ouvre la modale du chanteur (choix de chanson + Test de Chant). */
  chanterLaChanson: (shipId: IdDeCombattant) => void;
  /** Se relever d'À Terre (LDB 16 l.37) : consomme le Mouvement (pas l'Action) ; impossible à 0 PB (LDB 18 l.15). */
  seRelever: () => void;
  /** Perturbante (LDB 62 l.272-274) : bascule le mode « Repousser » (1 m/DR au lieu des Dégâts). */
  basculerLaRepousse: () => void;
  /** Bascule une POSTURE DE TIR pré-armée du combattant actif (`battle.stances`, spec HUD §1a G5) :
   *  le choix se pose hors modale, le prochain `PendingAttack` le reçoit déjà armé. */
  basculerLaPosture: (stance: ShootingStanceKey) => void;
  /** « Asperger d'eau » (MDG 16 l.19, #497) — Action DIRECTE (aucune modale) : cible explicite ou
   *  1ᵉʳ candidat éligible adjacent (patron `servirLePoste`). */
  aspergerDEau: (targetId?: IdDeCombattant) => void;
  /** Annule TOUT le déplacement décomposé du Tour (R6) tant qu'aucune Action n'a été prise :
   *  restaure positions/orientation depuis `battle.moveSnapshot`. No-op après l'Action. */
  annulerLeDeplacement: () => void;
  /** Sélectionne la munition à tirer (uid d'un item `kind 'ammo'`). */
  approvisionnerLArme: (uid: IdDObjet, weaponUid?: IdDObjet) => void;
  /** Recharger l'arme à distance (LDB 62 l.335) : OUVRE la modale de Test étendu de Projectiles. */
  rechargerLArme: (weaponUid?: IdDObjet) => void;
  /** Recharge d'un poste (MDG 12 l.462) : ouvre la modale du Test étendu de Projectiles du chef de pièce + Soutien. */
  rechargerLaPiece: (shipId: IdDeCombattant, posteUid: string) => void;
  // ── Navire ──
  /** Manœuvre NAVALE (MDG 13) : vire le cap (`Dir8`) du navire `shipId` de `turnSteps` crans de 45°
   *  (>0 = tribord/droite, <0 = bâbord/gauche) → re-mappe d'un coup TOUS ses arcs de bordée. */
  shipTurn: (shipId: IdDeCombattant, turnSteps: number) => void;
  /** Avance la coque `shipId` ET son équipage (à bord, formation rigide) de `cases` tuiles le long du cap
   *  courant `facing[shipId]` (MDG 13). Clampe aux bornes de scène. Renvoie les cases réellement parcourues. */
  shipAdvance: (shipId: IdDeCombattant, cases: number) => number;
  /** Bordée HEADLESS (auto-pilote navire, couche Mer) : Test d'équipage des Artilleurs résolu sans modale → volée sur `targetId`. */
  shipAutoBattery: (shipId: IdDeCombattant, targetId: IdDeCombattant) => boolean;
  // ── Effets de scène ──
  openMerchant: (entityId: IdDEntiteDeScene) => void;
  /** Remet un document : l'estampille d'une remise neuve (`remise`). */
  remettreDocument: (doc: Omit<NonNullable<EtatDeJeu['document']>, 'remise'>) => void;
  /** Ouvre la DÉSIGNATION d'un héros (Effet `designerHeros`, EDO 02 l.91) : `false` sans héros vivant — rien
   *  à désigner, la suite se joue sans suspension. */
  designerHerosOuvrir: (p: PendingDesignationHeros) => boolean;
  // ── Héros et possessions ──
  /** Accorde une Faveur (Activité à contrepartie / événement du Tableau / Effet `grantFavor`). */
  favorGrant: (heroId: IdDeHeros, level: import('../engine/favor').FavorLevel, owedTo: string, desc: string) => void;
  /** Octroie des PX à un héros (LDB 07). */
  grantXp: (heroId: IdDeHeros, amount: number) => void;
  /** Dénoue le vol terrestre GRADUÉ (#327) : applique la perte d'Enc du convoi selon l'issue
   *  (`applyLandCargoRaid`, params maison) et éteint `cargoRaid`. No-op hors vol en cours. */
  resolveCargoRaid: (outcome: import('../engine/cargo').CargoRaidOutcome) => void;
  /** Ajoute une Possession au registre (`uid` attribué par scan) — renvoie l'uid. */
  addPossession: (p: PossessionInput) => string;
  /** Réaffecte le propriétaire (succession, don, vente). */
  transferPossession: (uid: IdDePossession, newOwnerId: IdDeHeros) => void;
  /** Ajoute un trait appris (`learnedTraits`, nature `bete`). */
  learnPossessionTrait: (uid: IdDePossession, traitId: string) => void;
  // ── Tirage ──
  /** Réensemence le RNG de combat (déterminisme des tests + future coop réseau). */
  seedRng: (seed: number) => void;
  // ── Journal ──
  /** Action canonique UNIQUE composant `journal` (pousse `msg`, ou toutes les `msg[]` dans l'ordre,
   *  et plafonne à 40 lignes) — ticket #319 : tout site de `journal: [...journal.slice(-40), …]` route ICI. */
  log: (msg: string | string[]) => void;
  // ── Le clic d'une case en exploration (`cliquerLaCase`) les joue ──
  /** Le pas d'une case du groupe vers `pt`, refusé hors d'une case voisine à pied (`pasDuGroupe`). */
  moveParty: (pt: Pt) => void;
  /** SAUT par-dessus un gouffre au pas `indice` d'un chemin de marche (`chemin[indice]`, depuis la case du
   *  groupe) : élan, `planJump`, refus nommé. Rend `true` si la marche continue (saut sans Test), `false`
   *  si elle s'arrête (refus, ou Test de saut ouvert : le joueur reclique pour continuer). */
  sauter: (chemin: readonly Pt[], indice: number) => boolean;
  interactEntity: (entityId: IdDEntiteDeScene) => void;
  setPendingInteract: (pending: PendingInteract | null) => void;
}

/** L'état, les verbes et la machinerie du noyau : ce que lit le `get` des fabriques et des flux qui appellent la
 *  machinerie. */
export type JeuDuNoyau = Jeu & MachinerieDuNoyau;

/** Ce qu'une fabrique du noyau rend : une part des verbes et de la machinerie. */
export type FabriqueDuNoyau = Partial<ActionsDuNoyau & MachinerieDuNoyau>;

/** VERROU : aucun nom n'est à la fois un verbe et une machinerie. */
type _Disjoints = [keyof ActionsDuNoyau & keyof MachinerieDuNoyau] extends [never] ? true : ['verbe et machinerie à la fois', keyof ActionsDuNoyau & keyof MachinerieDuNoyau];
const _disjoints: _Disjoints = true;
void _disjoints;
