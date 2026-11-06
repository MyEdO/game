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
  IdDeCombattant, IdDeHeros, IdDePossession, IdDEntiteDeScene, IdDeTireurRapide,
} from './designations';
import type { ActionsDuNoyau } from './actionsDuNoyau';
import type { EtatDeJeu, Jeu, PaquetALancer, PendingInteract } from './etat';

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
  // ── Commits de clic : le clic du champ (`battleClickEntity`, `battleClickTile`) les appelle ──
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
  openSessionEnd: () => void;
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
