import type { Combatant, CharKey, HitLocation } from '../engine/types';
import type { NatureDInfluence } from '../data/schemas/grammaire/valeurs';
import type { SupportDetail } from '../engine/skills';
import type { StakeRef } from '../data';
import type { ActionRunCtx, BattleActionMode } from './actionRegistry';
import type { AttackKind } from '../engine/creatureAttacks';
import type { BattleClickOpts, TileClickOpts } from './targetingModes';
import type { ConjureForm } from '../engine/conjuredWeapons';
import type { OvercastAxis } from '../engine/overcast';
import type { Flow } from '../data/schemas/defs-scenes/effets';
import type { MassBattleSpec } from '../engine/massBattle';
import type { IndiceAffiché } from './monde/clues';
import type { HealMode } from '../engine/healing';
import type { DefenseMode } from '../engine/combat';
import type { RollFlowActionsMap } from './rollFlowSpecs';
import type { PossessionInput } from '../engine/possession';
import type * as tavernFlow from './tavernFlow';
import type { PendingDesignationHeros, PendingExtendedTest, CounterDeclaration } from './pendings';
import type { MedicNpc } from './medicFlow';
import type * as restFlow from './restFlow';
import type { RestLodging, RestFood } from './restFlow';
import type { Scene } from './monde/scene';
import type { Pt } from './monde/path';
import type { RoomPortal } from './monde/roomPortals';
import type { NarratifBlock } from '../data/schemas/defs-scenes/narratif';
import type { EtatDeJeu, PaquetALancer, PendingInteract, ShootingStanceKey } from './etat';

/** Les actions de JEU (#2817 D5) : tout hôte les porte ; aucune action d'interface. */
export interface ActionsDuNoyau extends RollFlowActionsMap {
  faceToward: (id: string, from?: Pt, to?: Pt) => void;
  faceFromPath: (id: string, path?: Pt[] | null) => void;
  faceAtCombatStart: () => void;
  /** Manœuvre NAVALE (MDG 13) : vire le cap (`Dir8`) du navire `shipId` de `turnSteps` crans de 45°
   *  (>0 = tribord/droite, <0 = bâbord/gauche) → re-mappe d'un coup TOUS ses arcs de bordée. */
  shipTurn: (shipId: string, turnSteps: number) => void;
  /** Avance la coque `shipId` ET son équipage (à bord, formation rigide) de `cases` tuiles le long du cap
   *  courant `facing[shipId]` (MDG 13). Clampe aux bornes de scène. Renvoie les cases réellement parcourues. */
  shipAdvance: (shipId: string, cases: number) => number;
  /** Élit (ou oublie, `null`) ce porteur — porte unique du champ ci-dessus. */
  dispelSelectCarrier: (carrierId: string | null) => void;
  /** Arme (id d'action) ou dissout (`null`) l'intention locale. Re-armer la MÊME la dissout. */
  battleArmIntent: (actionId: string | null) => void;
  /** Joue l'offre `actionId` du registre par sa porte unique (`runAction`), pour un hôte qui parle en
   *  intentions (#2898). */
  jouerLOffre: (actionId: string, ctx?: ActionRunCtx) => void;
  /** « Prendre la route » : ferme l'ouverture et BORNE le chapitre (instantané PX/vivants/date). */
  acquitterOuverture: () => void;
  /** « Terminer la séance » : ferme le récap et re-borne le chapitre suivant. */
  cloreChapitre: () => void;
  /** AJOURNE le récap (Échap / « Plus tard ») : le chapitre reste clos en donnée, donc le récap se
   *  re-pose au prochain lot d'effets — rien n'est perdu, rien n'est forcé. */
  ajournerChapterRecap: () => void;
  /** Épingle/désépingle un indice du carnet (suivi joueur, no-op si l'indice est encore caché). */
  toggleCluePin: (indiceId: string) => void;
  /** Marque VUS par son siège les indices affichés au Carnet, tels qu'affichés (`marquerVus`, #2415). */
  markCluesSeen: (affichés: readonly IndiceAffiché[]) => void;
  /** Fond les cases visibles courantes dans l'ensemble exploré de la scène (appelé par le rendu). */
  markExplored: (keys: string[]) => void;
  /** Abandon de la séquence en cours, quand sa définition en déclare un (`SequenceDef.abandon`). */
  sequenceAbandon: () => void;
  /** Arme/désarme (bascule) la visée Tir rapide d'un héros pendant la pause de début de Round. */
  armPreempt: (heroId: string | null) => void;
  /** Coop : marque le siège PRÊT au ready-check d'ouverture (round 1) ; l'hôte lance quand tous ✓. */
  roundStartReady: (seat: number) => void;
  /** Attribue un objet d'équipement (giveTrapping) du butin de victoire au héros choisi. */
  assignVictoryGear: (index: number, heroId: string) => void;
  /** Récolte « Précieuses Entrailles » (ZI) une créature vaincue, par id (Test de Savoir → pièces valuées). */
  harvestCreature: (creatureId: string) => void;
  /** Ferme l'écran de victoire et revient à l'exploration. */
  dismissVictory: () => void;
  /** Ferme l'écran de défaite ; dans une Scène de combat de bataille de masse, la bataille CONTINUE
   *  (défaite tactique = `combatLost`, groupe repoussé mais relevé). */
  dismissDefeat: () => void;
  /** Dénoue le vol terrestre GRADUÉ (#327) : applique la perte d'Enc du convoi selon l'issue
   *  (`applyLandCargoRaid`, params maison) et éteint `cargoRaid`. No-op hors vol en cours. */
  resolveCargoRaid: (outcome: import('../engine/cargo').CargoRaidOutcome) => void;
  /** Attribue une ligne de la fenêtre de loot au héros choisi. */
  assignLootGear: (index: number, heroId: string) => void;
  /** Ferme la fenêtre de loot ; l'équipement non attribué va au 1er héros (comme la victoire). */
  dismissLoot: () => void;
  /** Évaluation (LDB 59 l.41) ou Détection d'artefact (LDB 10) d'une ligne de butin ENCORE en
   *  fenêtre (loot ou victoire) : révéler un objet AVANT de choisir qui l'emporte. */
  appraiseGear: (scope: 'loot' | 'victory', index: number, mode?: 'evaluate' | 'detect') => void;
  /** Coop : ✓ d'un siège sur l'écran de victoire — l'hôte ferme quand tous les requis ont validé. */
  victoryReady: (seat: number) => void;
  /** Coop : demande la pause du prochain début de Round (fenêtre Chance). */
  raiseHand: () => void;
  lowerHand: () => void;
  setPendingCampaign: (pc: EtatDeJeu['pendingCampaign']) => void;
  /** Accorde une Faveur (Activité à contrepartie / événement du Tableau / Effet `grantFavor`). */
  favorGrant: (heroId: string, level: import('../engine/favor').FavorLevel, owedTo: string, desc: string) => void;
  /** « Acquitter une Faveur » (LDB 23 l.147/149) : consomme une Activité d'interlude du héros. */
  favorSettle: (heroId: string, favorId: string) => void;
  /** Rompt une Faveur — Niveau de Carrière −1 (min 0) si la rumeur se répand (LDB 23 l.141). */
  favorBreak: (heroId: string, favorId: string) => void;
  /** Ouvre un interlude de N semaines (Effet d'éditeur `interlude` ou appel direct). */
  startInterlude: (weeks?: number) => void;
  /** Clôt l'interlude : « Avec le pouvoir », Argent à gaspiller, Revenus, le temps passe. */
  interludeEnd: () => void;
  /** Regagne MAINTENANT les Points de Chance du groupe (LDB 17 l.47 « Longues Séances de Jeu » —
   *  règle optionnelle `fortune-mid-session` en mode 'manual'). Réutilise l'Effet `restoreFortune`
   *  (logique partagée via `engine/fortune.restoreFortune`) — pas de duplication. */
  restoreFortuneNow: () => void;
  activityCancel: () => void;
  activityConfirm: () => void;
  /** Amorce une bataille de masse et bascule sur sa vue. */
  startMassBattle: (spec: MassBattleSpec) => void;
  /** Passe de la phase pré-bataille (Discours/Planification) aux Rounds de bataille. */
  massBattleBegin: () => void;
  /** Ouvre le Test d'une Activité de bataille pré-combat (l.79-106). */
  massBattleActivity: (activityId: string) => void;
  /** Choisit une Scène cinématique du Round (Test de Compétence ou combat tactique). */
  massBattleScene: (sceneId: string) => void;
  /** Affecte la LISTE des PJ postés à une action du Round (Scène MULTI-PJ résolue en Soutien, ou Activité
   *  SOLO ; clé = id d'action) — le POSTE que la résolution honorera à défaut de la suggestion. Liste vide =
   *  efface l'affectation. Réinitialisé à chaque Round. */
  setMassBattleHero: (actionId: string, heroIds: string[]) => void;
  /** Ouvre le Test de Résistance de guérison du Rassemblement (l.122). */
  massBattleRally: () => void;
  /** Tire/choisit le facteur environnemental du Round (l.309, 1d10). */
  massBattleHazard: (roll?: number) => void;
  /** Résout le Test spectaculaire de Puissance du Round (l.120). */
  massBattleClash: () => void;
  /** Passe au Round suivant après le Rassemblement (l.124). */
  massBattleAdvance: () => void;
  /** Ferme la bataille et revient au jeu. */
  endMassBattle: () => void;
  /** Activités (LDB 23) : `craftStart` engage l'ouvrage (matériaux ¼ prix + `Combatant.craft`) ; le
   *  LANCER passe par `interludeActivity('craft')`. Passer commande (Exotique) + banque restent dédiés. */
  interludeCraftStart: (heroId: string, trappingId: string, atouts: string[], defauts: string[]) => void;
  interludeBank: (heroId: string, kind: 'invest' | 'stash' | 'mecenat', amountBrass: number, rate?: number) => void;
  interludeWithdraw: (index: number) => void;
  interludeOrder: (heroId: string, trappingId: string) => void;
  /** Entraînement (ch.23 l.130-136) : Compétence/Caractéristique hors carrière, PX + tuteur 1D10 sc — sans jet. */
  interludeEntrainement: (heroId: string, kind: 'skill' | 'characteristic', id: string, spec?: string) => void;
  /** Activité du CATALOGUE data-driven (`activities.json`, contexte 'interlude' + gate `where`) — LE
   *  CHEMIN UNIQUE de toutes les Activités à jet : Revenus, Artisanat, Apprentissage (`talentId`),
   *  Identification (`itemUid`), Convalescence (ADE II), Activités d'Altdorf (ACE Annexe I). Cibles
   *  éventuelles selon le résolveur : objet / sort / dépôt / Talent. */
  interludeActivity: (heroId: string, activityId: string, opts?: { itemUid?: string; spellId?: string; depositIndex?: number; talentId?: string }) => void;
  /** Composition d'équipe : ajoute un héros dans un emplacement du siège (intent côté invité ;
   *  l'hôte injecte le siège autoritaire) / retire un héros (propriétaire seul). */
  partyAddHero: (hero: Combatant, wealth?: import('../engine/money').Money, seat?: number) => void;
  partyRemoveHero: (heroId: string) => void;
  /** Remplace EN PLACE le héros `oldId` par `hero` (substitution atomique, possession transférée au
   *  siège ; ne touche pas la bourse) — créateur (édition) et bouton « Remplacer » du slot. */
  partyReplaceHero: (oldId: string, hero: Combatant, seat?: number) => void;
  setParty: (p: Combatant[]) => void;
  toggleEquip: (heroId: string, uid: string) => void;
  /** Range (`containerUid`) ou sort (null) un objet d'un héros d'un contenant (LDB 64). */
  stowItem: (heroId: string, uid: string, containerUid: string | null) => void;
  createLoadout: (heroId: string) => void;
  deleteLoadout: (heroId: string, id: string) => void;
  setActiveLoadout: (heroId: string, id: string) => void;
  setLoadoutSlot: (heroId: string, id: string, slot: 'main' | 'off', uid: string | null) => void;
  /** Donne un objet d'un héros à un autre (transfert d'inventaire). Arrive NON équipé chez le
   *  destinataire ; recalcule les deux loadouts. Permet de confier une arme/armure au bon porteur. */
  transferItem: (uid: string, fromHeroId: string, toHeroId: string) => void;
  /** Skin cosmétique d'un objet (override de palette clé→hex ; clé à `undefined` = reset).
   *  Propagé à l'arme active via recomputeLoadout → le rendu se recolore (objet légendaire). */
  setItemSkin: (heroId: string, uid: string, patch: Record<string, string | undefined>) => void;
  /** Change la FORME (silhouette) d'une arme abstraite parmi ses `formChoices` (« Arme simple » →
   *  épée/hache/masse/…). Pose `ItemInstance.formeChoisie` puis recompute → l'arme tenue change de silhouette. */
  choisirForme: (heroId: string, uid: string, forme: string) => void;
  // ── Avancement par PX (LDB 07-Carrières) — câblage du moteur testé ──
  /** Octroie des PX à un héros. */
  grantXp: (heroId: string, amount: number) => void;
  /** Achète une Augmentation de Caractéristique (coût in/hors-carrière auto, recalc Blessures). */
  buyCharAdvance: (heroId: string, char: CharKey) => void;
  /** Achète une Augmentation de Compétence (identité skillId+spec) ; acquiert la Compétence de
   *  carrière non connue à 0 ; l'achat via un slot « (Au choix) » libre le désigne. */
  buySkillAdvance: (heroId: string, skillId: string, spec?: string) => void;
  /** Achète/augmente un Talent (identité talentId+spec ; refusé hors carrière l.97 / Maxi atteint). */
  buyTalent: (heroId: string, talentId: string, spec?: string) => void;
  /** Désigne GRATUITEMENT un emplacement « (Au choix) » de la carrière courante (LDB 09 l.38). */
  designateCareerSlot: (heroId: string, slotKey: string, optionId: string, spec?: string) => void;
  /** Apprentissage/mémorisation d'un sort (LDB 46/10) — coût PX via engine/grimoire. */
  buySpell: (heroId: string, spellId: string) => void;
  /** Achète un composant d'incantation pour un Sort d'Arcane/Domaine connu (LDB 46 l.113 — NI pistoles). */
  buySpellComponent: (heroId: string, spellId: string) => void;
  /** Retire un composant d'incantation possédé pour un Sort (sans remboursement). */
  removeSpellComponent: (heroId: string, spellId: string) => void;
  /** Édite la bio mutable d'un héros hors combat (Motivation + Ambitions court/long, LDB 05) — persisté en save + roster. */
  setHeroBackground: (heroId: string, patch: { motivation?: string; ambitionShort?: string; ambitionLong?: string }) => void;
  /** Fin de séance (LDB 05 Ambitions + LDB 17 Détermination) : octroie les PX d'Ambition, regagne la
   *  Détermination selon la Motivation, puis restaure la Chance. Alimenté par l'écran de fin de séance. */
  endSession: (rewards: import('./partyFlow').SessionRewards) => void;
  openSessionEnd: () => void;
  closeSessionEnd: () => void;
  /** Entraîne une prothèse portée par dépense de PX (Fausse jambe → réapprendre l'Esquive, 200 PX, LDB 73). */
  trainProsthesis: (heroId: string, uid: string) => void;
  /** Change de Carrière/Niveau (validation LDB 07 l.137 / LDB 08 : complétion, +100 hors Classe). */
  changeCareer: (heroId: string, newCareer: string, newLevel: number) => void;
  /** `narratif` : couche narrative du projet, posée AVANT l'entrée en scène — la Psychologie à la
   *  rencontre y résout les presets de PNJ (#1882). Absente = couche vidée. */
  startScene: (scene: Scene, narratif?: NarratifBlock) => void;
  /** Enregistre plusieurs scènes (projet multi-scènes) puis démarre l'entrée. `worldMap` = carte du
   *  monde du projet (#T2, projet v2) — null/absent : pas de voyage dans ce projet. */
  loadProject: (paquet: PaquetALancer) => void;
  transitionTo: (sceneId: string, entry?: string, pos?: Pt) => void;
  moveParty: (pt: Pt) => void;
  /** SAUT par-dessus un gouffre au pas `indice` d'un chemin de marche (`chemin[indice]`, depuis la case du
   *  groupe) : élan, `planJump`, refus nommé. Rend `true` si la marche continue (saut sans Test), `false`
   *  si elle s'arrête (refus, ou Test de saut ouvert : le joueur reclique pour continuer). */
  sauter: (chemin: readonly Pt[], indice: number) => boolean;
  /** Ouvre ou ferme la porte d'un passage : en combat toute porte, en exploration une porte fermée.
   *  Rend `true` si la porte a bougé. */
  actionnerLaPorte: (portail: RoomPortal) => boolean;
  /** ESCALADE d'une arête `WallSeg.climb` (LDB 15 l.53-57) : `from` (case basse, adjacente) → `to` (case
   *  haute). Porteur = le mobile de `gesteDArete` (exploration : le meneur, le groupe suit ; combat : l'actif
   *  que ce siège mène, héros ou ennemi mené par le siège MJ) ; tout refus est NOMMÉ (`refuserGeste`),
   *  en combat le Test d'Escalade est celui du mobile. `ladder` monte d'office (pas de Test) au
   *  coût du Mouvement à ½ vitesse ; `surface` déclenche un Test d'Escalade influençable (cascade RollShell)
   *  dont l'échec fait chuter, et consomme l'Action en combat (LDB 13 l.86-88). Geste EXPLICITE (overlay). */
  climbAcross: (from: Pt, to: Pt) => void;
  /** POV : pivote le REGARD du meneur d'un cran de 45° (+1 = horaire/droite, -1 = anti-horaire/gauche) —
   *  aucun déplacement (donc pas de réorientation par `faceFromPath`). */
  pivotParty: (turn: 1 | -1) => void;
  /** POV : un pas RELATIF au cap du meneur (avance/recul/pas latéral) — cap monde = regard tourné de
   *  0/2/4/6 crans (90° par cadran), case d'arrivée via `povStepDest`. Le regard est préservé pour tout
   *  pas ≠ avant (un pas latéral/arrière ne réoriente pas le meneur). */
  stepPartyRelative: (rel: 'forward' | 'back' | 'left' | 'right') => void;
  interactEntity: (entityId: string) => void;
  /** JOUE une offre NOMMÉE d'une entité (`ActionOfferte.id`) — l'exécuteur UNIQUE des gestes
   *  d'exploration ; `interactEntity` n'en est que le raccourci « joue l'unique offre ». */
  jouerAction: (entityId: string, actionId: string) => void;
  /** FOUILLER LA PIÈCE où se tient le groupe (`rooms.roomFocusAt`) — geste d'exploration du GROUPE :
   *  second déclencheur de la découverte des portes secrètes (`decouvertePorteSecrete.fouilleDeLaPiece`),
   *  coûte la maison `fouille-piece-minutes` une fois par geste (LDB 12 l.200). Refus DIT hors exploration,
   *  en dialogue, sans meneur debout, hors de toute pièce. */
  fouillerLaPiece: () => void;
  setPendingInteract: (pending: PendingInteract | null) => void;
  chooseDialogue: (choiceIndex: number) => void;
  closeDialogue: () => void;
  openMerchant: (entityId: string) => void;
  /** Marchand de LIEU (#369) — service de catalogue sans `SceneEntity` (forgeron du hub de ville…) : même
   *  système marchand, keyé sur `placeServiceMerchantId` (`worldMap.ts`). */
  openPlaceMerchant: (entityId: string, archetype: string, backdrop?: string) => void;
  closeMerchant: () => void;
  /** Recherche active de Disponibilité (LDB 59 l.50) : passer une journée entière + un Test de Ragot →
   *  réassort frais avec +10 % de Disponibilité si le Ragot réussit (avance l'horloge d'une journée). */
  searchAvailability: () => void;
  /** Jeux de taverne (option `tavern-games`, NADJ 16) : ouvrir la modale / jouer une partie
   *  (choisir un jeu + un adversaire, résolution par le moteur générique) / fermer. */
  openTavernGames: (npcId?: string) => void;
  playTavernGame: (opts: { gameId: string; challengerId: string; opponent: tavernFlow.TavernOpponent; stakeBrass?: number; allyProfil?: string; tablePlayers?: number }) => void;
  closeTavernGames: () => void;
  /** Troc (LDB 59 l.64-76) : céder N exemplaires d'un objet contre M exemplaires du stock, sans argent. */
  barterExchange: (opts: { giveHeroId: string; giveTrappingId: string; getStockId: string; getCount?: number }) => void;
  /** « Baisse des prix » (LDB 59 l.60) : (dé)cale d'un cran le nombre de divisions de moitié consenties
   *  à la vente d'une instance (améliore la Disponibilité de l'acheteur, réduit le gain). */
  setSellHalving: (uid: string, delta: number) => void;
  /** Achat direct (#2, primitif) : débite la Bourse et crée l'objet dans le sac du héros (défaut : 1er). */
  buyItem: (label: string, heroId?: string) => void;
  /** Panier (#2) : ajoute / retire / vide. L'achat passe par le panier → `payCart` (UI). */
  addToCart: (label: string) => void;
  decFromCart: (label: string) => void;
  removeFromCart: (label: string) => void;
  clearCart: () => void;
  /** Refuse un marché NÉGOCIÉ (achat ou vente) : annule la négociation de ce côté + pose le VERROU PARTAGÉ
   *  (plus aucune négociation, achat NI vente, jusqu'au réassort). L'achat vide aussi le panier. */
  refuseBargain: (mode: 'buy' | 'sell') => void;
  /** Paye le panier : débite le Total (prix listés × Marchandage), retire du stock, et met les objets
   *  achetés EN ATTENTE DE RÉPARTITION (`pendingDistribution`) — « qui récupère quoi ». */
  payCart: () => void;
  /** Répartition : affecte l'objet acheté n°`index` à un héros, puis `confirmDistribution` les range. */
  assignDistribution: (index: number, heroId: string) => void;
  confirmDistribution: () => void;
  /** Panier de VENTE (#22b, parité achat) : ajoute / retire / vide / conclut toute la vente d'un coup. */
  addToSellCart: (uid: string, heroId: string) => void;
  removeFromSellCart: (uid: string) => void;
  clearSellCart: () => void;
  confirmSell: () => void;
  /** Réparation chez l'artisan : remet damageTaken à 0 contre le coût unifié — armure 10 %/PA (LDB 63 l.64)
   *  ou arme 10 %/point de Dégâts (LDB 62 l.135). Arme improvisée = irréparable. */
  repairItem: (uid: string, heroId: string) => void;
  /** Marchandage (LDB 59 l.43) : ouvre un Test opposé (1/visite) ; réduit ensuite les prix (`bargainBuyFactor`). */
  startBargain: (mode: 'buy' | 'sell') => void;
  // bargain{Roll,Reroll,BonusSL,DarkPact} : générés (RollFlowActionsMap).
  bargainConfirm: () => void;
  bargainCancel: () => void;
  /** Évaluation (LDB 59 l.41) : Test d'Évaluation (Int) ; un succès révèle l'objet + estime son prix.
   *  `mode:'detect'` = Détection d'artefact (LDB 10) : Intuition au toucher, une tentative par objet. */
  appraiseItem: (uid: string, heroId: string, mode?: 'evaluate' | 'detect') => void;
  // appraise{Roll,Reroll,BonusSL,DarkPact} : générés (RollFlowActionsMap).
  resolveAppraise: () => void;
  appraiseCancel: () => void;
  // test{Roll,Reroll,BonusSL,DarkPact,ForceSuccess,Determine} : générés (RollFlowActionsMap).
  /** Choix du LANCEUR d'un Test de scène parmi les candidats du groupe (avant le jet) — au lieu
   *  d'une désignation automatique du meilleur. Re-cible valeur/cible/malus/outil. */
  testSetActor: (id: string) => void;
  resolveTest: () => void;
  /** Exposition à une Influence corruptrice (LDB 19) : Lancer → Chance → Appliquer (gain selon DR).
   *  Délégués `corruption{Roll,Reroll,BonusSL,DarkPact}` : générés (RollFlowActionsMap). */
  /** Choisit le Test de `influences-corruptrices` AVANT le jet d'exposition (LDB 19 l.29 : « ou … comme déterminé par le
   *  MJ » — RAW indéterminé pour le trait de créature ; le joueur tranche, comme la Défense). Le SEUIL
   *  (LDB 19 l.70) reste figé sur le Test de `corrompu` et ignore cet appel. */
  corruptionSetNature: (nature: NatureDInfluence) => void;
  resolveCorruption: () => void;
  /** Remet un document : l'estampille d'une remise neuve (`remise`). */
  remettreDocument: (doc: Omit<NonNullable<EtatDeJeu['document']>, 'remise'>) => void;
  /** Ferme le document et rejoue sa `suite` ; inerte chez l'invité. */
  closeDocument: () => void;

  /** Réensemence le RNG de combat (déterminisme des tests + future coop réseau). */
  seedRng: (seed: number) => void;
  startCombat: (encounterId: string, onVictory?: Flow, opts?: { noSurprise?: boolean }) => void;
  battleSelectAction: (a: BattleActionMode | null) => void;
  /** Guérison (LDB 09-Compétences) — ouvre la modale de soin EN COMBAT (soi/allié adjacent). */
  battleHeal: (targetId: string, mode: HealMode) => void;
  /** « Asperger d'eau » (MDG 16 l.19, #497) — Action DIRECTE (aucune modale) : cible explicite ou
   *  1ᵉʳ candidat éligible adjacent (patron `battleManPoste`). */
  battleWater: (targetId?: string) => void;
  /** Pré-jet : bascule le mode de soin (Blessures ⇄ Hémorragie) dans la modale ouverte. */
  healSetMode: (mode: HealMode) => void;
  /** INFIRMERIE (hors combat, noyau/medicFlow) : modale de soins persistante — patients, actes
   *  (Guérison/Hémorragie/Déchirure/Chirurgie), PNJ payant via l'effet `medicalAid`. */
  openMedic: (opts?: { patientId?: string; npc?: MedicNpc }) => void;
  medicSelectPatient: (id: string) => void;
  /** Lance un acte sur le patient courant (surgery → ARME l'opération). */
  medicAct: (act: HealMode) => void;
  /** Choisit la Blessure Critique à opérer (avant la 1re passe). */
  medicSetWound: (idx: number) => void;
  /** OUVRE le jet INFLUENÇABLE d'une passe de Chirurgie (pendingSurgery) depuis l'opération armée. */
  openSurgeryPass: () => void;
  // surgery{Roll,Reroll,BonusSL,DarkPact,ForceSuccess} : générés (RollFlowActionsMap).
  /** « Appliquer » la passe : cumule le DR (Test étendu), 1d10 PB + Hémorragie ; cible atteinte → trauma
   *  réparé + infection révélée ; sinon réouvre la passe suivante (calque extendedTestNext). */
  surgeryNext: () => void;
  /** Annule la passe posée avant son jet ; l'opération armée et son cumul restent. */
  surgeryPassCancel: () => void;
  /** Annule la Chirurgie (cumul perdu ; jamais commencée → acte remboursé). */
  surgeryCancel: () => void;
  closeMedic: () => void;
  /** REPOS (noyau/restFlow) : modale de nuit — réglages PAR HÉROS (couchage + pitance,
   *  orthogonaux : on peut manger à l'auberge et dormir dehors), puis bilan globalisé. */
  openRest: (opts: restFlow.OpenRestOpts) => void;
  restSet: (heroId: string, patch: Partial<{ lodging: RestLodging; food: RestFood }>) => void;
  restReady: (seat: number) => void;
  restSleep: () => void;
  restCancel: () => void;
  /** CONSEIL DE BORD (#229) : arrête la paie de la semaine, puis clôt le bilan de Moral. */
  councilPay: (decision: string) => void;
  councilClose: () => void;
  // heal{Roll,Reroll,BonusSL,DarkPact,ForceSuccess} : générés (RollFlowActionsMap).
  healConfirm: () => void;
  healCancel: () => void;
  /** Recharger l'arme à distance (LDB 62 l.335) : OUVRE la modale de Test étendu de Projectiles. */
  battleReload: (weaponUid?: string) => void;
  // reload{Roll,Reroll,BonusSL,DarkPact} (Lancer/Chance/+1 DR/Pacte) : générés (RollFlowActionsMap).
  /** « Appliquer » : cumule le DR (Test étendu), recharge si ≥ Indice, consomme l'Action. */
  reloadConfirm: () => void;
  /** Ferme la modale de rechargement sans coût (avant le jet). */
  reloadCancel: () => void;
  // handGate{Roll,Reroll,BonusSL,DarkPact,ForceSuccess,SetForcedRoll} : générés (RollFlowActionsMap).
  /** « Appliquer » le Test de Dextérité de Main ensanglantée (AA 07 l.117) : RÉUSSITE → ouvre l'Action figée ;
   *  ÉCHEC → l'objet glisse (op `disarm`) et l'Action est consommée. */
  handGateConfirm: () => void;
  /** Annule l'Action avant le jet de Main ensanglantée (défait une charge misclic comme `attackCancel`). */
  handGateCancel: () => void;
  /** Se libérer (Empêtré, Test opposé de Force) / se rouler au sol (En flammes, Athlétisme) : OUVRE la modale (LDB 16 l.66/84). */
  battleRecoverState: (state: string) => void;
  // recover{Roll,Reroll,BonusSL,DarkPact} (Lancer/Chance/+1 DR/Pacte) : générés (RollFlowActionsMap).
  /** « Appliquer » : retire 1 + DR pions de l'État, consomme l'Action. */
  recoverConfirm: () => void;
  /** Ferme la modale de récupération sans coût (avant le jet). */
  recoverCancel: () => void;
  // steamSave{Roll,Reroll,BonusSL,DarkPact,ForceSuccess} : générés (RollFlowActionsMap).
  /** « Appliquer » la sauvegarde d'Initiative d'une « Fuite de vapeur » (MDG 12 l.328) : ÉCHEC →
   *  ébouillanté (`scaldOps`) ; puis la boucle maritime reprend (`resolveSteamSave`). */
  steamSaveConfirm: () => void;
  /** Sélectionne la munition à tirer (uid d'un item `kind 'ammo'`). */
  battleSelectAmmo: (uid: string, weaponUid?: string) => void;
  /** Détermination (Resolve, LDB 17 l.61) : retire un État de l'actif (+1 PB si À Terre).
   *  Ne consomme PAS l'Action. */
  battleSpendResolve: (conditionName: string) => void;
  /** Détermination depuis une MODALE de jet (LDB 17 l.61) : même règle, pour n'importe quel héros
   *  (le défenseur n'est pas l'actif) et sans toucher au mode d'action. */
  spendResolveCondition: (combatantId: string, conditionName: string) => void;
  /** Détermination (LDB 17 l.59) : immunité à la Psychologie jusqu'à la fin du prochain Round. */
  battleResolvePsychImmune: () => void;
  /** Détermination (LDB 17 l.60) : ignore les modificateurs de Blessure critique ce Round. */
  battleResolveIgnoreCrit: () => void;
  /** Ramasser UN objet au sol pendant un Round (LDB 13 l.115-116) : applique au combattant
   *  actif un item ramassable d'un `prop` interactif adjacent. Consomme l'Action, pas d'auto-équipe.
   *  `key` = `eff:<index dans interact.effects>` (cf. entityPickables). */
  battlePickup: (entityId: string, key: string) => void;
  battleSelectSpell: (spellId: string) => void;
  /** Le combattant actif boit/utilise un consommable de son inventaire (coûte l'Action). */
  battleUseItem: (uid: string) => void;
  /** HORS COMBAT : un héros utilise un consommable (bandages, potion) depuis sa fiche. */
  usePartyItem: (heroId: string, uid: string) => void;
  /** Incantation par modale : « Lancer » fige le jet, Chance le relance, « Appliquer » résout. */
  castRoll: () => void;
  // cast{Reroll,BonusSL,DarkPact,ForceSuccess,SetForcedRoll} : générés (RollFlowActionsMap).
  /** Incantation CRITIQUE (LDB 46 l.26-32) : choix de l'effet bonus (modale). */
  castSetCritChoice: (choice: 'critique' | 'puissance' | 'ineluctable') => void;
  /** Arme invoquée à forme libre (Arme aethyrique) : le lanceur choisit la forme/Spé de Corps à corps. */
  castSetConjureForm: (form: ConjureForm) => void;
  /** « Prêchez, ma sœur ! » (LDB 40 l.42, option `prayer-conviction`) : entonner la Prière discrètement
   *  (murmurée → Difficulté d'un cran plus dure) plutôt qu'à voix haute. Avant le jet uniquement. */
  castSetDiscreet: (discreet: boolean) => void;
  /** Surincantation : alloue (`delta` +1) ou rend (`delta` −1, reset) un pas de +2 DR à un axe
   *  (Portée / Zone d'Effet / Durée / Cible) ; l'effet d'un pas est source-aware (`engine/overcast.ts`). */
  castAllocOvercast: (axis: OvercastAxis, delta: number) => void;
  /** Jets sur le Tableau CHOISIS par le lanceur (EDOC 13 l.276 : « vous pouvez » — déclinable), borné
   *  [0, pas Durée alloués]. N'apparaît QUE si le sort porte un `rollTable.extraRollsPerStep`. */
  castSetChosenTableRolls: (n: number) => void;
  /** Surincantation : choisit/retire une cible SUPPLÉMENTAIRE (dans la limite allouée). */
  castToggleExtraTarget: (id: string) => void;
  /** Surincantation « +Cible » : bascule le choix SUR LE CHAMP DE BATAILLE (la modale s'efface,
   *  bandeau TargetPrompt + clic carte → castToggleExtraTarget). En combat uniquement. */
  castPickTargets: (on: boolean) => void;
  /** Sort de ZONE (flux « jet puis pose », LDB 47 l.15/28) : bascule la POSE sur la carte
   *  (la modale s'efface, le gabarit final suit le curseur, clic-case = dépose). */
  castPlaceZone: (on: boolean) => void;
  castConfirm: () => void;
  castCancel: () => void;
  /** Contre-sort à PLUSIEURS (flux multi `FLOWS.counterspell`) : chaque contre-lanceur a son
   *  jet + son cycle Chance/+1 DR/Pacte/Résilience (ciblé par `pid`).
   *  Délégués `counterspell{Roll,Reroll,BonusSL,DarkPact,ForceSuccess,SetForcedRoll}` : générés (RollFlowActionsMap, MULTI). */
  /** Fait chanter d'un coup toutes les rangées jouables au siège local (verbe NULLAIRE du drive
   *  d'auto-cadence, #1030 — cf. `STEP_WINDOW_AUTO` dans `combatAuto.ts`). */
  counterspellRollAll: () => void;
  /** PHASE 1 — déclare la rangée `pid` : contrer seul / s'unir au Test Soutenu (LDB 46 l.162,
   *  transposé à la fenêtre réactive) / passer. Refusé hors éligibilité de Domaine (`soutenu`) et
   *  dès que la composition est FIGÉE (toutes les rangées ont déclaré). */
  counterspellDeclare: (pid: string, choice: CounterDeclaration) => void;
  /** Déclare « contrer seul » les rangées vierges de ce siège (verbe NULLAIRE du drive d'auto-cadence). */
  counterspellDeclareAll: () => void;
  /** « Appliquer » : agrège (dissipé si UN gagne ; sinon le Sort se résout au meilleur DR net) → castConfirm. */
  counterspellConfirm: () => void;
  /** « Laisser passer » : aucun Contre-sort retenu → le Sort se résout tel quel (castConfirm). */
  counterspellCancel: () => void;
  /** Test Étendu SÉQUENTIEL (LDB 12) : ouvre le flux (ex. crocheter DR 5) ; un Round à la fois. */
  startExtendedTest: (opts: { actorId: string; label: string; skillLabel: string; target: number; targetDR: number; maxAttempts?: number; flag?: string; support?: SupportDetail; dispel?: { spellId: string; casterId: string; label: string }; outcome?: PendingExtendedTest['outcome']; stake?: StakeRef; suite?: Flow }) => void;
  // extendedTest{Roll,Reroll,BonusSL,DarkPact,ForceSuccess,SetForcedRoll} : générés (RollFlowActionsMap, MULTI).
  /** Cumule le DR du Round courant (LDB 12 l.174) ; total < 0 → recommence ; total ≥ cible → réussite. */
  extendedTestNext: () => void;
  extendedTestCancel: () => void;
  /** Enfoncer une porte à PLUSIEURS (EDO Appendice 2) : ouvre le flux (objet BE/B) ; chacun frappe. */
  startForceDoor: (opts: { label: string; doorBE: number; doorB: number; heroIds: string[]; flag?: string; suite?: Flow }) => void;
  // forceDoor{Roll,Reroll,BonusSL,DarkPact,ForceSuccess,SetForcedRoll} : générés (RollFlowActionsMap, MULTI).
  /** Applique les dégâts du Round (somme) ; porte à ≤ 0 B → cède (flag posé) ; sinon nouveau Round. */
  forceDoorConfirm: () => void;
  forceDoorCancel: () => void;
  /** Ouvre la DÉSIGNATION d'un héros (Effet `designerHeros`, EDO 02 l.91) : `false` sans héros vivant — rien
   *  à désigner, la suite se joue sans suspension. */
  designerHerosOuvrir: (p: PendingDesignationHeros) => boolean;
  /** Pose le héros `heroId` (vivant, du groupe) comme désigné par l'état de `pendingDesignationHeros`, puis
   *  rejoue la suite. Sans `heroId`, ne clôt (sans rien désigner) que si plus aucun héros n'est vivant. */
  designerHerosChoisir: (heroId?: string) => void;
  /** LOT DE DÉS d'un étal (#1426) : valide le lot d'un bloc (rejoue le générateur avec les dés posés,
   *  puis ouvre l'écran) / renonce (l'étal reste celui des dés naturels). */
  etalLotConfirm: () => void;
  etalLotCancel: () => void;
  /** CASCADE séquentielle (`FLOWS.cascade`) : jet de l'étape courante + cycle Chance/+1 DR/Pacte/
   *  Résilience (ciblé par `pid` = id d'étape). `Resist` = Résistance (Menace, LDB 10).
   *  Délégués `cascade{Roll,Reroll,BonusSL,DarkPact,ForceSuccess,SetForcedRoll,Resist}` : générés (RollFlowActionsMap, MULTI). */
  /** « Choix » d'une étape de séquence (analogue de cascadeRoll côté jet) : pose l'option retenue. */
  cascadeChoose: (pid: string, key: string) => void;
  /** « Quantité » d'une étape de séquence (jumeau de `cascadeChoose`) : pose le nombre saisi, ramené
   *  à la plage déclarée par l'étape. */
  cascadeAmount: (pid: string, n: number) => void;
  /** TIRAGE SUR TABLE d'une étape (analogue de `cascadeRoll` côté Test) : pose `table.result` via le
   *  résolveur unique `rollTableStep`. */
  cascadeTableRoll: (pid: string) => void;
  /** MODE TABLE (#942 L3) : POSE le dé NATUREL d'une étape à table — le champ « Fixer le dé » et le
   *  clic sur une ligne (dé qui atteint la ligne, `mod` compris) écrivent tous deux ICI, puis l'étape
   *  est tirée (re-posable tant que l'étape est courante). Délégué NU : l'affordance est armée côté
   *  CLIENT par `canFixDie` (`ui/forcedDieRow.ts`), l'hôte ne re-juge pas le geste d'un invité. */
  cascadeTableSetForcedRoll: (pid: string, roll: number) => void;
  /** TIRAGE d'un DÉ NU d'étape (#1508) — JUMEAU de `cascadeTableRoll` : même geste, même goulot
   *  (`cascade.poseSurCourante`), lecture nue au lieu d'une lecture en table. */
  cascadeDieRoll: (pid: string) => void;
  /** POSE du dé NATUREL d'une étape à DÉ NU (#1508) — JUMEAU de `cascadeTableSetForcedRoll`, mêmes
   *  règles (délégué NU, affordance armée côté client par `canFixDie`, re-posable). */
  cascadeDieSetForcedRoll: (pid: string, roll: number) => void;
  /** « Étape suivante » : valide l'étape courante (conséquence + insertions), avance ; à la fin,
   *  finalise selon `purpose` (reprise de voyage…). */
  cascadeNext: () => void;
  /** « Tout lancer » : résout d'office les étapes restantes (on ne peut pas dé-dormir), puis place le
   *  curseur EN FIN = BILAN — la modale RESTE ouverte pour voir toutes les conséquences. */
  cascadeResolveAll: () => void;
  /** « Terminer » du bilan : ferme la cascade et enchaîne la suite (reprise de voyage…). */
  cascadeFinish: () => void;
  /** Incantation OPPOSÉE (`FLOWS.castOpposition`) : chaque CIBLE oppose son Test (FM/Int) — son jet
   *  + cycle Chance/+1 DR/Pacte/Résilience (ciblé par `pid`). Cible IA = rangée témoin auto-roulée.
   *  Délégués `opposition{Roll,Reroll,BonusSL,DarkPact,ForceSuccess,SetForcedRoll}` : générés (RollFlowActionsMap, MULTI). */
  /** Fait jeter d'un coup toutes les rangées jouables au siège local (verbe NULLAIRE du drive
   *  d'auto-cadence, #1030 — cf. `STEP_WINDOW_AUTO` dans `combatAuto.ts`). */
  oppositionRollAll: () => void;
  /** « Appliquer » : agrège les oppositions → `pendingCast.opposedOutcome` (résisté + marge par cible) → castConfirm. */
  oppositionConfirm: () => void;
  /** Incantation HORS COMBAT (couture D) : un héros lanceur cible self/allié ; sorts non-offensifs. */
  oocCastSpell: (casterId: string, spellId: string, targetId: string, fromGrimoire?: boolean) => void;
  battleFocusSpell: (spellId: string) => void;
  // Les OPTIONS de ces deux clics vivent avec leur consommateur (`targetingModes`) : les recopier ici
  // en littéral les faisait diverger en silence — le champ `approche` (verdict d'armement de la
  // Charge, spec § 2026-08-19) manquait déjà de cette copie, et TypeScript ne pouvait pas le dire.
  battleClickTile: (pt: Pt, opts?: TileClickOpts) => void;
  battleClickEntity: (id: string, opts?: BattleClickOpts) => void;
  /** Annule TOUT le déplacement décomposé du Tour (R6) tant qu'aucune Action n'a été prise :
   *  restaure positions/orientation depuis `battle.moveSnapshot`. No-op après l'Action. */
  cancelMove: () => void;
  battleEndTurn: () => void;
  armEndTurn: () => void;
  /** Reprise après un changement de Cadence de combat en plein combat (passage en Auto/Rapide) :
   *  ré-entre la boucle (auto-résolution de modale + tour de l'IA). No-op en manuel / hors combat. */
  resumeCadence: () => void;
  /** Chance, 3e usage (LDB 17 l.25) : en début de Round, place un héros en tête de l'ordre
   *  contre 1 point de Chance (pré-emption d'initiative). */
  roundStartPromote: (heroId: string) => void;
  /** Tir rapide (talent, LDB 10) : INTERRUPTION à distance en début de Round (hors de l'ordre) ; le tir
   *  se résout par la modale de jet normale et épuise le tour normal du tireur (Action + Mouvement). */
  preemptRangedShot: (heroId: string, targetId: string) => void;
  /** Ferme la modale d'ordre de Round et reprend le combat (active le 1er combattant valide). */
  confirmRoundStart: () => void;
  /** « Comment ça a pu rater ? » (Destin, coup létal) : annule le coup, reste en combat. */
  fateNegate: () => void;
  /** « Meurs un autre jour » (Destin) : survit mais éjecté de la rencontre. */
  fateSurvive: () => void;
  /** « Accepter le sort » : le héros meurt. */
  fateAccept: () => void;
  /** « Sur la défensive » : utilise l'Action pour +20 en défense jusqu'au prochain tour. */
  battleDefendTotal: () => void;
  /** Bascule le set d'armes actif du combattant actif (Action gratuite, LDB 13 l.106 ; plafond MAISON 1×/tour, même Engagé). */
  battleSwitchLoadout: (loadoutId: string) => void;
  /** Action « Viser » (sans jet) : +20 (Accessible) au prochain tir tant que c'est la dernière action. */
  battleAim: () => void;
  /** Perturbante (LDB 62 l.272-274) : bascule le mode « Repousser » (1 m/DR au lieu des Dégâts). */
  battleTogglePushback: () => void;
  /** Bascule une POSTURE DE TIR pré-armée du combattant actif (`battle.stances`, spec HUD §1a G5) :
   *  le choix se pose hors modale, le prochain `PendingAttack` le reçoit déjà armé. */
  battleToggleStance: (stance: ShootingStanceKey) => void;
  /** Flux d'attaque par modale : viser une localisation, lancer, dépenser une Chance, appliquer. */
  attackSetLocation: (loc: HitLocation | null) => void;
  /** Choisit l'arme d'attaque (uid d'ItemInstance du loadout actif ; null = auto) — avant le jet. */
  attackSetWeapon: (uid: string | null) => void;
  /** Maniement de deux armes (LDB 10 l.767-773) : (dés)active le mode « des deux armes » sur l'attaque-Action. */
  attackSetDualMode: (on: boolean) => void;
  /** Mode de tir « corde séparée » (Lance-harpon, ADE II 02 l.677) : bascule le tir sans corde (Portée 60,
   *  perte de l'Atout Immobilisante) — proposé seulement si l'arme porte `ItemCapabilities.ropeMode`. */
  attackSetHarpoonRopeCut: (v: boolean) => void;
  /** « Retenir ses coups » (Aux Armes 07 l.59-61) : bascule le coup non létal de mêlée (avant le jet). */
  attackSetWithhold: (v: boolean) => void;
  /** « Empoignade » (LDB 14 l.159) : bascule l'initiation d'Empoignade à mains nues (avant le jet). */
  attackSetGrapple: (v: boolean) => void;
  /** « Je ne faillirai pas ! » (RAW-2, LDB 17 l.68) : choisit la Localisation d'un Coup Critique forcé. */
  attackSetCritLocation: (loc: HitLocation) => void;
  attackRoll: () => void;
  // attack{Reroll,BonusSL,DarkPact,ForceSuccess,SetForcedRoll,Cancel} : générés (RollFlowActionsMap).
  // `attackSetForcedRoll(roll)` (LDB 17 l.68 « vous choisissez le résultat ») : valeur du dé d'un succès
  //  forcé (un double ≤ cible → Coup Critique, ex. Salundra l.75) ; re-dérive l'attaque, refusé si raté.
  // `attackCancel()` : « Annuler » unifié (défaire-charge via `FLOWS.attack.onCancel`) — cf. RollFlowActionsMap.
  attackConfirm: () => void;
  /** Pilonnage INDIRECT : dépose le point d'impact choisi (clic-case du placeur 'siege') et ouvre la modale
   *  de tir de la pièce indirecte servie (`pendingAttack` siège). Cf. `siegeAimCommit` (combatSlice). */
  siegeAimCommit: (pt: Pt) => void;
  /** Pilonnage INDIRECT : referme le placeur sans tirer (option « Servir … » désarmée). SORTIE de
   *  l'interlude `placing-zone` de source 'siege' (`ACTION_RUN.placingZoneOff`). */
  siegeAimCancel: () => void;
  /** Balayage (Frappe Mortelle, LDB 14 l.9) : enchaîne l'attaque sur une cible adjacente (ouvre une
   *  modale d'attaque standard) ; borné à BCC enchaînements. */
  cleaveAttack: (targetId: string) => void;
  /** Termine le balayage en cours (le joueur renonce aux enchaînements restants). */
  cleaveEnd: () => void;
  /** Maniement de deux armes (LDB 10 l.767-773) : 2ᵉ frappe (main secondaire) contre la cible choisie. `skipGate`
   *  interne : Test de Main ensanglantée déjà PASSÉ (reprise via `handGateConfirm`), ne pas re-tester. */
  dualStrikeAttack: (targetId: string, skipGate?: boolean) => void;
  /** Renonce à la 2ᵉ frappe (« peut viser » = optionnel) → pas de 2ᵉ attaque, pas d'Avantage. */
  dualStrikeSkip: () => void;
  /** Arme une ATTAQUE (id d'`AttackOption` : 'arme'/'morsure'/'tentacule'/'pietinement'…) pour le clic-ennemi
   *  — source UNIQUE de l'attaque armée. Toggle → 'arme'.
   *  Le clic-ennemi résout l'attaque armée via l'approche-puis-frappe (battleClickEntity). */
  battleSelectAttack: (id: string) => void;
  /** Manœuvre de ZONE / soi immédiate (Souffle/Vomi/Langue/Hurlement/Regard/Étreinte) : résolution
   *  directe par le résolveur moteur partagé. L'Étreinte glaciale coûte l'Action (LDB 85 l.112). */
  battleManeuverArea: (kind: AttackKind) => void;
  /** Capacité SUR SOI octroyée par un trait (Métamorphose humain↔hybride de l'Enfant d'Ulric) : résout la
   *  manœuvre `targeting:'self'` sur l'acteur et consomme l'Action (la 2ᵉ vient du `loseTurn` de ses effets). */
  battleSelfManeuver: (maneuverId: string) => void;
  /** Battement (LDB 10 l.103 / AA 13 l.17) : Action, Test de Corps à corps NON opposé retirant de
   *  l'Avantage adverse. `foeId` absent = 1er éligible (picker via `battementSetFoe`). */
  battleBattement: (foeId?: string) => void;
  battementSetFoe: (foeId: string) => void;
  // battement{Roll,Reroll,BonusSL,DarkPact,ForceSuccess,SetForcedRoll} : générés (RollFlowActionsMap).
  battementConfirm: () => void;
  battementCancel: () => void;
  /** Distraire (LDB 10 l.364 / AA 13 l.51) : MOUVEMENT, Test opposé Athlétisme vs Calme. Sur victoire,
   *  le foe est distrait (ne gagne plus d'Avantage). `foeId` absent = 1er éligible en Ligne de vue
   *  (picker via `distraireSetFoe`). */
  battleDistraire: (foeId?: string) => void;
  distraireSetFoe: (foeId: string) => void;
  // distraire{Roll,Reroll,BonusSL,DarkPact,ForceSuccess} : générés (RollFlowActionsMap).
  distraireConfirm: () => void;
  distraireCancel: () => void;
  /** Manœuvre de créature par modale (LDB 85) : Lancer le jet d'ATTAQUANT (CC/CT), Chance/Pacte/
   *  Résilience l'influencent, Appliquer roule les défenseurs et résout l'opposition au feed. */
  // maneuver{Roll,Reroll,BonusSL,DarkPact,ForceSuccess,SetForcedRoll} : générés (RollFlowActionsMap).
  maneuverConfirm: () => void;
  maneuverCancel: () => void;
  /** Avantage dépensé par le Regard pétrifiant (variable, LDB 85 l.290) : 1..advantage → +N DR. */
  maneuverSetAvantage: (n: number) => void;
  /** Course (LDB 15 l.41) : ouvrir la modale, lancer le Test `course`, Chance/Résilience, appliquer (déplacement étendu). */
  battleRun: (dest?: Pt, movement?: { path: Pt[]; cost: number }) => void;
  /** Manœuvre navale (MDG 13) : ouvre la modale du Test de Navigation pour le navire que sert `crewId`. */
  battleShipManeuver: (crewId: string) => void;
  /** Choix du virage (pré-jet OptionChooser) : crans d'octant (±1 = 45°, ±2 = 90°, 0 = tout droit). */
  shipManeuverSetTurn: (steps: number) => void;
  shipManeuverConfirm: () => void;
  shipManeuverCancel: () => void;
  /** Recharge d'un poste (MDG 12 l.462) : ouvre la modale du Test étendu de Projectiles du chef de pièce + Soutien. */
  battleShipReload: (shipId: string, posteUid: string) => void;
  /** Bordée (« Tir de batterie », MDG 14 l.128) : ouvre la modale du Test d'équipage des Artilleurs sur `targetId`. */
  battleShipBattery: (shipId: string, targetId: string) => void;
  shipBatteryConfirm: () => void;
  shipBatteryCancel: () => void;
  /** Bordée HEADLESS (auto-pilote navire, couche Mer) : Test d'équipage des Artilleurs résolu sans modale → volée sur `targetId`. */
  shipAutoBattery: (shipId: string, targetId: string) => boolean;
  // shipBattery{Roll,Reroll,BonusSL,ForceSuccess,DarkPact} : générés (RollFlowActionsMap, MULTI).
  /** Test d'équipage GÉNÉRIQUE (MDG 14) : ouvre la modale multi-jets du type `testTypeId` (Rude épreuve…). */
  battleCrewTest: (shipId: string, testTypeId: string) => void;
  crewTestConfirm: () => void;
  crewTestCancel: () => void;
  // crewTest{Roll,Reroll,BonusSL,ForceSuccess,DarkPact} : générés (RollFlowActionsMap, MULTI).
  /** Chanson de marin (Talent, MDG 09 l.32-40) : ouvre la modale du chanteur (choix de chanson + Test de Chant). */
  battleSingShanty: (shipId: string) => void;
  /** Choix de la chanson (pré-jet, parmi les specs CONNUES du Talent). */
  shantySetSong: (shantyId: string) => void;
  shantyConfirm: () => void;
  shantyCancel: () => void;
  // shanty{Roll,Reroll,BonusSL,ForceSuccess,DarkPact} : générés (RollFlowActionsMap).
  // run{Roll,Reroll,ForceSuccess,DarkPact} : générés (RollFlowActionsMap).
  runConfirm: () => void;
  runCancel: () => void;
  /** Chute volontaire (LDB 15 l.82) : depuis `from` (case du sauteur) vers `to` (case cardinale plus
   *  basse, croisée franchissable comprise), ouvre le choix pré-jet (Sauter / Tenter le Test
   *  `chute`). Porteur = le mobile de `gesteDArete` ; tout refus est NOMMÉ (`refuserGeste`). */
  fallAcross: (from: Pt, to: Pt) => void;
  /** ENJAMBER une croisée franchissable de plain-pied (#700 ; LDB 15 l.55, allège de la croisée
   *  `WallSeg.allege`) : exploration = le pas du groupe (`moveParty`) ; combat = le mobile de
   *  `gesteDArete`, Mouvement seul (1 case + l'allège à ½ vitesse), aucun Test, aucune Action. Tout refus
   *  est NOMMÉ (`refuserGeste`). */
  windowAcross: (from: Pt, to: Pt) => void;
  /** DÉCLARATION pré-jet de la rangée `tombantId` (LDB 15 l.82 « vous pouvez tenter ») : `true` = Test,
   *  `false` = chute PLEINE sans Test. Quand toutes les rangées sautent sans Test, l'étape se résout. */
  /** `suspendre` : l'axe hauteur (EDO 01 l.231), exigé quand `pendingFall.suspendu` est offert. */
  fallChoose: (tombantId: string, attempt: boolean, suspendre?: boolean) => void;
  // fall{Roll,Reroll,ForceSuccess,DarkPact} : générés (RollFlowActionsMap).
  fallConfirm: () => void;
  fallCancel: () => void;
  /** Approche d'une source de Peur (LDB 21 l.27) : succès → l'intention différée est relancée. */
  // approach{Roll,Reroll,ForceSuccess,DarkPact} : générés (RollFlowActionsMap).
  approachConfirm: () => void;
  approachCancel: () => void;
  /** Bénédiction de Protection (LDB 41 l.142) : Test de FM Accessible (+20) ; succès → l'attaque est relancée. */
  // ward{Roll,Reroll,ForceSuccess,DarkPact} : générés (RollFlowActionsMap).
  wardConfirm: () => void;
  wardCancel: () => void;
  /** Se relever d'À Terre (LDB 16 l.37) : consomme le Mouvement (pas l'Action) ; impossible à 0 PB (LDB 18 l.15). */
  battleStandUp: () => void;
  /** « Servir cette pièce » (MDG 12) : le héros actif devient chef d'un poste de siège NON servi adjacent (arme octroyée) — coûte l'Action. KIND-AGNOSTIQUE. */
  battleManPoste: (target?: { hullId: string; posteUid: string }) => void;
  /** « Quitter la pièce » (release) : libère le poste servi pour un autre — coûte l'Action. */
  battleLeavePoste: () => void;
  /** « Pousser » un engin de siège CREWÉ à roues (ADE II 8 l.258, #156) : ouvre le mode de
   *  ciblage-CASE 'push' (le clic-sol suivant commet la translation de formation, `targetingModes.ts`).
   *  Chef d'un poste d'engin MOBILE, Action dispo, Équipe ≥ moitié requise (sinon no-op, comme un tir
   *  sous-effectif refusé). Mouvement SIMPLE, aucun jet ; plafonné à `rule('siege-engine-push-speed')`. */
  battlePushEngine: () => void;
  /** « Diriger l'équipe » (Commandant d'équipe, AA) : Test de Commandement (+0) pour aider une équipe d'Arme
   *  d'équipe à portée de voix — sur réussite, elle tire au score de Projectiles du commandant. Coûte l'Action. */
  battleAidTeam: () => void;
  /** Focalisation par modale (Test étendu) : Lancer, Chance, Appliquer (cumule le DR). */
  // focus{Roll,Reroll,BonusSL,DarkPact,ForceSuccess} : générés (RollFlowActionsMap).
  focusConfirm: () => void;
  focusCancel: () => void;
  battleDispelSpell: (spellId: string, spellCasterId: string) => void;
  dispelConfirm: () => void;
  dispelCancel: () => void;
  /** Focalisation HORS COMBAT (couture D) : ouvre la modale de Focalisation pour un héros lanceur du groupe. */
  oocFocusSpell: (casterId: string, spellId: string) => void;
  /** Dissipation de sort permanent HORS COMBAT (couture D, LDB 46 l.160-162, #461). */
  oocDispelSpell: (casterId: string, spellId: string, spellCasterId: string) => void;
  // (Psychologie de combat (Peur/Terreur/Traits ciblés, LDB 21) : CASCADE de Round — Traits/Terreur au
  //  DÉBUT (openRoundStartPsych), Peur à la FIN (openRoundEndCascade) — résolue par les handlers `cascade*`,
  //  applier 'combatPsych'.)
  /** Entrée en Frénésie d'un héros (LDB 21 l.31) : ouvrir la modale, lancer le Test de FM, Chance/Résilience, appliquer. */
  battleFrenzy: () => void;
  // frenzy{Roll,Reroll,ForceSuccess,DarkPact} : générés (RollFlowActionsMap).
  /** Action « cumuler l'Avantage » (LDB 09 l.305-308) : Test de la Compétence `skillId` (Intuition/
   *  Savoir/Survie/Prière) via la modale de Test standard ; sur réussite +1 Avantage plafonné. Coûte l'Action. */
  battleGainAdvantage: (skillId: string) => void;
  frenzyConfirm: () => void;
  frenzyCancel: () => void;
  /** Maladresse (modale héros, LDB 14) : lancer sur le Tableau des Oups !, puis appliquer l'effet. */
  fumbleRoll: () => void;
  fumbleConfirm: () => void;
  /** Flux de défense réactive (héros attaqué par l'IA) : choisir Parade/Esquive, défendre,
   *  dépenser une Chance, appliquer. PAS de « Subir » : le RAW n'offre aucune non-défense volontaire
   *  (mêlée = Test opposé, LDB 13 l.123) ; la résolution non opposée est réservée aux cas imposés. */
  defenseSetMode: (mode: DefenseMode, subSkillId?: string) => void;
  /** Choisit l'arme de parade (uid d'ItemInstance ; null = main principale) — avant le jet de défense. */
  defenseSetParryWeapon: (uid: string | null) => void;
  /** Déclare/efface la réaction de Porte-Bouclier (variante AA 13 l.84) pour cette défense au Bouclier. */
  defenseSetShieldReaction: (kind: 'damage' | 'push' | null) => void;
  /** Déclare ou refuse la Riposte (LDB 10 l.1037) pour cette défense. */
  defenseSetRiposte: (riposte: boolean) => void;
  // defense{Roll,Reroll,BonusSL,DarkPact,ForceSuccess,SetForcedRoll} : générés (RollFlowActionsMap).
  defenseConfirm: () => void;
  /** « Je te renie ! » (LDB 17 l.67) : résout le choix (true = refuser la mutation, 1 Résilience). */
  renounceResolve: (renounce: boolean) => void;
  /** Peek du planificateur IA (déterministe, sans RNG ni mutation) : la meilleure action du combattant `id`
   *  est-elle de PRÉPARER un sort (cast/castArea/focus) ? Lu par le hook de Frénésie pour différer l'entrée
   *  en Frénésie tant qu'un sort prime (RAW : entrée = choix, psychologie.md l.170). */
  aiWouldCast: (id: string) => boolean;
  /** Combat monté (cadre : LDB 14 l.175-187) : enfourcher une monture libre adjacente / en descendre.
   *  Coût = MOUVEMENT sans jet ni Action — MAISON [entériné 2026-07-17] (« Met les en Maison pour le
   *  moment », #526 ; aucune clause de coût citable, LDB 14/15/09 + AA 9 fouillés en entier) ;
   *  Chevaucher sans Test : LDB 09 l.112. */
  /** `mountId` = la monture DÉSIGNÉE (sa pastille sur le champ) ; absent = la plus proche. */
  battleMount: (mountId?: string) => void;
  battleDismount: () => void;
  mountTargetSelect: (id: string) => void;
  mountTargetCancel: () => void;
  /** Désengagement (LDB 15 l.43-68) : menu Sacrifier l'Avantage / Esquiver / Fuir / Renoncer. */
  battleDisengage: () => void;
  disengageConfirmA: () => void; // Sacrifier l'Avantage
  disengageRoll: () => void; // Esquiver (lance le Test opposé)
  // disengage{Reroll,BonusSL,DarkPact,ForceSuccess} : générés (RollFlowActionsMap).
  // Résilience « Je ne faillirai pas ! » (LDB 17 l.68) + « vous choisissez le résultat » (dé forcé) :
  // {test,attack,defense,cast,disengage}ForceSuccess et {defense,cast}SetForcedRoll sont aussi générés.
  disengageConfirm: () => void; // Appliquer l'issue de l'Esquive
  disengageFlee: () => void; // Fuir : ouvre le flux MULTI `flee` (coup dans le dos du frappeur + Test `fuite` du fuyard)
  // flee{Roll,Reroll,BonusSL,DarkPact,ForceSuccess,SetForcedRoll}(pid) : générés (RollFlowActionsMap) — `pid` = id de l'acteur du slot.
  fleeConfirm: () => void; // Appliquer : coup dans le dos (applicateur canonique) + États Brisés + libération/Course
  disengageCancel: () => void;
  /** « Au Contact » (LDB 62 l.176, Option « Longueur d'arme ») : Test opposé de Corps à corps + choix du vainqueur. */
  battleAuContact: (targetId: string) => void;
  auContactRoll: () => void; // Lancer le jet de Corps à corps du mover (Test opposé)
  // auContact{Reroll,BonusSL,DarkPact,ForceSuccess} : générés (RollFlowActionsMap).
  auContactConfirm: () => void; // Appliquer : le mover gagne → phase de choix ; le foe gagne (IA) → choix auto ; égalité → statu quo
  auContactChoose: (mode: 'normal' | 'contact') => void; // le vainqueur HÉROS tranche
  auContactCancel: () => void;
  /** Empoignade (LDB 14 l.161) : action à son tour entre deux Empoignés. */
  battleGrapple: (targetId: string) => void;
  grappleBreak: () => void; // Briser l'Empoignade (gratuit, Avantage supérieur)
  grappleRoll: () => void; // Lancer le Test opposé de Force de l'acteur
  // grapple{Reroll,BonusSL,DarkPact,ForceSuccess} : générés (RollFlowActionsMap).
  grappleConfirm: () => void; // Appliquer : succès → phase d'options ; échec → +1 Avantage au foe ; égalité → statu quo
  grappleChoose: (mode: 'damage' | 'entangle' | 'free') => void; // le vainqueur choisit Dégâts / Empêtrer / Se libérer
  grappleCancel: () => void;
  /** Action canonique UNIQUE composant `journal` (pousse `msg`, ou toutes les `msg[]` dans l'ordre,
   *  et plafonne à 40 lignes) — ticket #319 : tout site de `journal: [...journal.slice(-40), …]` route ICI. */
  log: (msg: string | string[]) => void;
  /** Écrivain UNIQUE de l'avance de `gameTime` : pose l'horloge, tire les effets programmés échus
   *  (`fireScheduledEffects`, #668) puis dissipe les effets à durée d'horloge échus (`purgeSurAvanceDHorloge`, #1599). */
  avancerLHorloge: (minutes: number) => void;
  /** Avance l'horloge in-game de `minutes` (no-op si ≤ 0) par `avancerLHorloge`, puis ce qui la suit hors combat (#T3 cascade). */
  advanceTime: (minutes: number) => void;
  /** « Dormir / Se reposer N jours » (hors combat) : repos de `days` journée(s) — retire l'Exténué,
   *  soigne des Blessures (l.380 volet a Résistance +20 → DR+BE, ET volet b +BE/jour) et déclenche les
   *  cauchemars des héros marqués (LDB 16/18/21). `days` par défaut = 1 (une nuit). */
  restParty: (days?: number) => void;
  openWorldMap: () => void;
  closeWorldMap: () => void;
  /** « Marchander » le billet de `routeId` en `vehicule` depuis le lieu courant (`billetFlow`). */
  startBilletBargain: (routeId: string, vehicule: string) => void;
  dismissTravelRecap: () => void;
  /** Démarre un voyage depuis le lieu courant le long d'une route (mode + classe + allure). */
  startTravel: (routeId: string, mode: import('../engine/travel').TravelMode, opts?: { classeId?: string; hoursPerDay?: number; allure?: import('../engine/mountTravel').Allure; seaPace?: number; fast?: boolean; cadence?: import('./voyageCadence').VoyageCadence }) => void;
  /** Reprend un voyage interrompu par une péripétie. */
  resumeTravel: () => void;
  /** Bascule la CADENCE des ordres de la traversée en cours (couche `voyageCadence`) — « Passer en
   *  jour-par-jour » de l'écran de traversée, ou retour en commandée. */
  setVoyageCadence: (cadence: import('./voyageCadence').VoyageCadence) => void;
  /** Épingle le RÔLE de marche PERSISTANT d'un héros (`travelRole`, poste d'Activité de voyage EDOC 8),
   *  ou le détache (`null` ⇒ rôle inféré). Réutilisé au départ de chaque trajet (0 ré-assignation/jour). */
  setTravelRole: (heroId: string, role: import('../engine/activities').StagePosting | null) => void;
  /** Épingle (`role`) ou détache (`null`) le rôle d'ÉQUIPAGE naval d'un marin (`shipRole`) — interface de gestion
   *  du navire. Patche `party` ET `battle.combatants` (l'équipage vit dans la bataille en mer). */
  setShipRole: (crewId: string, role: string | null) => void;
  /** Épingle (`station`) ou détache (`null`) la STATION à bord d'un marin (`shipStation`, id de
   *  `ship-stations.json`) — où il se TROUVE quand un Critique frappe une présence (`MDG 13 l.680`,
   *  `MSRC 07 l.78/l.82/l.94`). Aucun défaut : détaché, il n'est visé par aucune présence. Même patron
   *  que `setShipRole`. */
  setShipStation: (crewId: string, station: string | null) => void;
  /** Sélectionne la munition PERSISTANTE d'un poste d'artillerie (`ShipPoste.ammoUid` — boulet/mitraille,
   *  MDG 12 l.410-424), depuis la fiche du navire. `null` → retour au défaut (1re compatible). */
  setPosteAmmo: (shipId: string, posteUid: string, ammoUid: string | null) => void;
  /** « Attendre l'aube » : joue une nuit (repos) puis efface la porte — le groupe repart au matin. */
  departWaitDawn: () => void;
  /** « Annuler » le départ nocturne bloqué par la porte. */
  departCancel: () => void;
  /** Ajoute une Possession au registre (`uid` attribué par scan) — renvoie l'uid. */
  addPossession: (p: PossessionInput) => string;
  /** Renomme l'instance (`label`). */
  renamePossession: (uid: string, label: string) => void;
  /** Réaffecte le propriétaire (succession, don, vente). */
  transferPossession: (uid: string, newOwnerId: string) => void;
  /** Dépose la possession sur place. */
  stablePossession: (uid: string, placeId: string) => void;
  /** Reprend une possession déposée. */
  retrievePossession: (uid: string) => void;
  /** Embarque la possession sur un hôte (véhicule/navire). */
  embark: (uid: string, hostUid: string) => void;
  /** Débarque une possession embarquée. */
  disembark: (uid: string) => void;
  /** Abandon (§6, décision №4) — pose `destroyed`, confirmation côté appelant. */
  abandonPossession: (uid: string) => void;
  /** Ajoute un trait appris (`learnedTraits`, nature `bete`). */
  learnPossessionTrait: (uid: string, traitId: string) => void;
  /** Ouvre l'écran Port si le groupe est à un lieu portuaire de la carte avec un navire de campagne. */
  openPort: () => void;
  closePort: () => void;
  /** Achète `enc` points d'une cargaison de l'escale (Type/Taille/Marchandage, MDG 15 l.319-349). */
  portBuyCargo: (cargoId: string, enc: number) => void;
  /** Vend un lot de la cale (Trouver un acheteur/Prix d'offre/Marchandage, MDG 15 l.351-397). */
  portSellCargo: (cargoIndex: number) => void;
  /** Brade un lot invendable (¼ du prix de base, MDG 15 l.399). */
  portDumpCargo: (cargoIndex: number) => void;
  /** Répare la coque au chantier (1 CO/Blessure, MDG 13 l.643) — journalise le résultat. */
  portRepair: () => void;
  /** Carène en cale sèche (Salissures, MDG 13 l.150-159). */
  portCareen: () => void;
  /** Installe une Amélioration navale (coût par bande de Taille, MDG 12). */
  portInstallUpgrade: (traitId: string, units?: number) => void;
  /** Recrute `count` PNJ salariés au rôle `roleId` (escale-hub #228 — barème `crew-roles.json`, MDG 14 l.293-302). */
  portHireCrew: (roleId: string, count?: number) => void;
  /** Débarque `count` PNJ salariés du rôle `roleId` (#228). */
  portDismissCrew: (roleId: string, count?: number) => void;
  /** Ouvre l'écran Marché si le groupe est à un Lieu de commerce terrestre de la carte (`MapPlace.market`). */
  openLandMarket: () => void;
  closeLandMarket: () => void;
  /** Achète `enc` d'une cargaison de l'étape (disponibilité 2 temps/Marchandage/lot partiel, MSRC 13 l.129-131) —
   *  chargée sur le porteur de défaut du groupe dans la limite de sa Contenance (#327). */
  landBuyCargo: (cargoId: string, enc: number) => void;
  /** Vend un lot d'un porteur (Demande/Mise à prix/Marchandage, MSRC 13 l.133-160). */
  landSellCargo: (carrierId: string, cargoIndex: number) => void;
  /** Brade un lot invendable (½ du prix de base dans un Lieu de Commerce, MSRC 13 l.160). */
  landDumpCargo: (carrierId: string, cargoIndex: number) => void;
  /** Transfère `enc` d'une cargaison entre deux porteurs CO-LOCALISÉS (bête/véhicule/navire, #327). */
  moveCargo: (fromId: string, toId: string, cargoId: string, enc: number) => void;
  /** Évalue la qualité secrète d'un lot de Vin proposé (Test d'Évaluation, MSRC 13 l.95). */
  landEvalWine: (cargoId: string) => void;
  /** Ouvre le Test de Ragot de l'auberge du hub de ville (#352, Activité `recueillir-informations`
   *  étendue au contexte `auberge`) : succès → rumeur commerciale (`generateTradeRumour`), échec →
   *  Exténué (EDOC 8 l.133). Avance l'horloge (`inn-gather-info-minutes`) quelle que soit l'issue. */
  gatherInnInfo: () => void;
  /** Résout les Activités choisies puis rend la main à la halte de nuit. */
  seaActivitiesConfirm: (picks: Record<string, import('./seaActivities').SeaActivityPick | null>) => void;
  /** Résout le choix : `true` = payer la bénédiction, `false` = réduire l'Humeur de Manann de 4d10. */
  resolveManannPriest: (pay: boolean) => void;
  /** Résout le choix : `true` = relâche accordée, `false` = refusée (gate l'Embrigadement/Fête de Manann). */
  resolveShoreLeave: (allow: boolean) => void;
}
