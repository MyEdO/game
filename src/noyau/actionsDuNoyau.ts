import type { CharKey } from '../engine/types';
import type { ActionRunCtx, BattleActionMode } from './actionRegistry';
import type { AttackKind } from '../engine/creatureAttacks';
import type { BattleClickOpts, TileClickOpts } from './targetingModes';
import type { IndiceAffiché } from './monde/clues';
import type { HerosEngage } from './creation/engagement';
import type { HealMode } from '../engine/healing';
import type { VerbesDeJet } from './rollFlowSpecs';
import type { VerbeDeReglage } from './reglagesDuJet';
import type { VerbeDeChoix } from './choixDesFenetres';
import type * as tavernFlow from './tavernFlow';
import type { MedicNpc } from './medicFlow';
import type * as restFlow from './restFlow';
import type { RestLodging, RestFood } from './restFlow';
import type { Pt } from './monde/path';
import type {
  IdDeCombattant, IdDeCreatureADepecer, IdDeHeros, IdDeCombattantPromouvable, IdDePorteur, IdDePossession, IdDObjet, IdDeScene,
  IdDEntiteDeScene, IdDeTireurRapide, IdDePorte, IdDIndice,
} from './designations';
import type { CiblesChoisies } from './verdictsDInterlude';
import type { ShootingStanceKey } from './etat';
import type { FenetreAValider, FenetreQuiSeFerme } from './modalArbiter';

/** Les actions de JEU (#2817 D5) : tout hôte les porte ; aucune action d'interface. */
export interface ActionsDuNoyau extends VerbesDeJet, VerbeDeReglage, VerbeDeChoix {
  /** Élit (ou oublie, `null`) ce porteur — porte unique du champ ci-dessus. */
  dispelSelectCarrier: (carrierId: string | null) => void;
  /** Arme (id d'action) ou dissout (`null`) l'intention locale. Re-armer la MÊME la dissout. */
  battleArmIntent: (actionId: string | null) => void;
  /** Joue l'offre `actionId` du registre par sa porte unique (`runAction`), pour un hôte qui parle en
   *  intentions (#2898). */
  jouerLOffre: (actionId: string, ctx?: ActionRunCtx) => void;
  /** Ferme la fenêtre `fenetre`, que son registre déclare se fermer (`sortie`, `modalArbiter.ts`) ; refusé, et dit,
   *  hors de ce que sa déclaration ouvre (`refusDeLaSortie`). */
  fenetreFermer: (fenetre: FenetreQuiSeFerme) => void;
  /** Valide la fenêtre `fenetre`, que son registre déclare se valider (`validation`, `modalArbiter.ts`) : à quorum,
   *  marque prêt le siège qui décide (`decidingSeat`) et la valide au quorum ; refusé, et dit, hors de ce que sa
   *  déclaration ouvre (`refusDeLaValidation`). */
  fenetreValider: (fenetre: FenetreAValider) => void;
  /** Épingle/désépingle un indice du carnet (suivi joueur, no-op si l'indice est encore caché). */
  toggleCluePin: (indiceId: IdDIndice) => void;
  /** Marque VUS par son siège les indices affichés au Carnet, tels qu'affichés (`marquerVus`, #2415). */
  markCluesSeen: (affichés: readonly IndiceAffiché[]) => void;
  /** Arme/désarme (bascule) la visée Tir rapide d'un héros pendant la pause de début de Round. */
  armPreempt: (heroId: IdDeTireurRapide | null) => void;
  /** Attribue un objet d'équipement (giveTrapping) du butin de victoire au héros choisi. */
  assignVictoryGear: (index: number, heroId: IdDeHeros) => void;
  /** Récolte « Précieuses Entrailles » (ZI) une créature vaincue, par id (Test de Savoir → pièces valuées). */
  harvestCreature: (creatureId: IdDeCreatureADepecer) => void;
  /** Attribue une ligne de la fenêtre de loot au héros choisi. */
  assignLootGear: (index: number, heroId: IdDeHeros) => void;
  /** Évaluation (LDB 59 l.41) ou Détection d'artefact (LDB 10) d'une ligne de butin ENCORE en
   *  fenêtre (loot ou victoire) : révéler un objet AVANT de choisir qui l'emporte. */
  appraiseGear: (scope: 'loot' | 'victory', index: number, mode?: 'evaluate' | 'detect') => void;
  /** Coop : demande la pause du prochain début de Round (fenêtre Chance). */
  raiseHand: () => void;
  lowerHand: () => void;
  /** « Acquitter une Faveur » (LDB 23 l.147/149) : consomme une Activité d'interlude du héros. */
  favorSettle: (heroId: IdDeHeros, favorId: string) => void;
  /** Rompt une Faveur — Niveau de Carrière −1 (min 0) si la rumeur se répand (LDB 23 l.141). */
  favorBreak: (heroId: IdDeHeros, favorId: string) => void;
  /** Regagne MAINTENANT les Points de Chance du groupe (LDB 17 l.47 « Longues Séances de Jeu » —
   *  règle optionnelle `fortune-mid-session` en mode 'manual'). Réutilise l'Effet `restoreFortune`
   *  (logique partagée via `engine/fortune.restoreFortune`) — pas de duplication. */
  restoreFortuneNow: () => void;
  /** Ouvre le Test d'une Activité de bataille pré-combat (l.79-106). */
  massBattleActivity: (activityId: string, heroId: IdDeHeros) => void;
  /** Choisit une Scène cinématique du Round (Test de Compétence ou combat tactique). */
  massBattleScene: (sceneId: string) => void;
  /** Affecte la LISTE des PJ postés à une action du Round (Scène MULTI-PJ résolue en Soutien, ou Activité
   *  SOLO ; clé = id d'action) — le POSTE que la résolution honorera à défaut de la suggestion. Liste vide =
   *  efface l'affectation. Réinitialisé à chaque Round. */
  setMassBattleHero: (actionId: string, heroIds: IdDeHeros[]) => void;
  /** Ouvre le Test de Résistance de guérison du Rassemblement (l.122). */
  massBattleRally: () => void;
  /** Tire/choisit le facteur environnemental du Round (l.309, 1d10). */
  massBattleHazard: (roll?: number) => void;
  /** Résout le Test spectaculaire de Puissance du Round (l.120). */
  massBattleClash: () => void;
  /** Passe au Round suivant après le Rassemblement (l.124). */
  massBattleAdvance: () => void;
  /** Activités (LDB 23) : `craftStart` engage l'ouvrage (matériaux ¼ prix + `Combatant.craft`) ; le
   *  LANCER passe par `interludeActivity('craft')`. Passer commande (Exotique) + banque restent dédiés. */
  interludeCraftStart: (heroId: IdDeHeros, trappingId: string, atouts: string[], defauts: string[]) => void;
  interludeBank: (heroId: IdDeHeros, kind: 'invest' | 'stash' | 'mecenat', amountBrass: number, rate?: number) => void;
  interludeWithdraw: (index: number) => void;
  interludeOrder: (heroId: IdDeHeros, trappingId: string) => void;
  /** Entraînement (ch.23 l.130-136) : Compétence/Caractéristique hors carrière, PX + tuteur 1D10 sc — sans jet. */
  interludeEntrainement: (heroId: IdDeHeros, kind: 'skill' | 'characteristic', id: string, spec?: string) => void;
  /** Activité du CATALOGUE data-driven (`activities.json`, contexte 'interlude' + gate `where`) — LE
   *  CHEMIN UNIQUE de toutes les Activités à jet : Revenus, Artisanat, Apprentissage (`talentId`),
   *  Identification (`itemUid`), Convalescence (ADE II), Activités d'Altdorf (ACE Annexe I). Cibles
   *  éventuelles : `CiblesChoisies`. */
  interludeActivity: (heroId: IdDeHeros, activityId: string, opts?: CiblesChoisies) => void;
  /** Composition d'équipe : ajoute le héros que le noyau bâtit de `heros` (`herosDeLEngagement`), avec sa Richesse de
   *  départ, dans un emplacement du siège qui décide (`decidingSeat`) / retire un héros (propriétaire seul). */
  partyAddHero: (heros: HerosEngage) => void;
  partyRemoveHero: (heroId: IdDeHeros) => void;
  /** Remplace EN PLACE le héros `oldId` par celui que le noyau bâtit de `heros` (substitution atomique, possession
   *  transférée au siège qui possédait `oldId` ; ne touche pas la bourse) — créateur (édition) et bouton « Remplacer »
   *  du slot. */
  partyReplaceHero: (oldId: IdDeHeros, heros: HerosEngage) => void;
  toggleEquip: (heroId: IdDePorteur, uid: IdDObjet) => void;
  /** Range (`containerUid`) ou sort (null) un objet d'un héros d'un contenant (LDB 64). */
  stowItem: (heroId: IdDePorteur, uid: IdDObjet, containerUid: IdDObjet | null) => void;
  createLoadout: (heroId: IdDeHeros) => void;
  deleteLoadout: (heroId: IdDeHeros, id: string) => void;
  setActiveLoadout: (heroId: IdDeHeros, id: string) => void;
  setLoadoutSlot: (heroId: IdDeHeros, id: string, slot: 'main' | 'off', uid: IdDObjet | null) => void;
  /** Donne un objet d'un héros à un autre (transfert d'inventaire). Arrive NON équipé chez le
   *  destinataire ; recalcule les deux loadouts. Permet de confier une arme/armure au bon porteur. */
  transferItem: (uid: IdDObjet, fromHeroId: IdDePorteur, toHeroId: IdDePorteur) => void;
  /** Choisit un id du catalogue d’apparences admis par l’objet ; le défaut retire la clé (#2113). */
  choisirApparence: (heroId: IdDeHeros, uid: IdDObjet, apparence: string) => void;
  /** Achète une Augmentation de Caractéristique (coût in/hors-carrière auto, recalc Blessures). */
  buyCharAdvance: (heroId: IdDeHeros, char: CharKey) => void;
  /** Achète une Augmentation de Compétence (identité skillId+spec) ; acquiert la Compétence de
   *  carrière non connue à 0 ; l'achat via un slot « (Au choix) » libre le désigne. */
  buySkillAdvance: (heroId: IdDeHeros, skillId: string, spec?: string) => void;
  /** Achète/augmente un Talent (identité talentId+spec ; refusé hors carrière l.97 / Maxi atteint). */
  buyTalent: (heroId: IdDeHeros, talentId: string, spec?: string) => void;
  /** Désigne GRATUITEMENT un emplacement « (Au choix) » de la carrière courante (LDB 09 l.38). */
  designateCareerSlot: (heroId: IdDeHeros, slotKey: string, optionId: string, spec?: string) => void;
  /** Apprentissage/mémorisation d'un sort (LDB 46/10) — coût PX via engine/grimoire. */
  buySpell: (heroId: IdDeHeros, spellId: string) => void;
  /** Achète un composant d'incantation pour un Sort d'Arcane/Domaine connu (LDB 46 l.113 — NI pistoles). */
  buySpellComponent: (heroId: IdDeHeros, spellId: string) => void;
  /** Retire un composant d'incantation possédé pour un Sort (sans remboursement). */
  removeSpellComponent: (heroId: IdDeHeros, spellId: string) => void;
  /** Édite la bio mutable d'un héros hors combat (Motivation + Ambitions court/long, LDB 05) — persisté en save + roster. */
  setHeroBackground: (heroId: IdDeHeros, patch: { motivation?: string; ambitionShort?: string; ambitionLong?: string }) => void;
  /** Entraîne une prothèse portée par dépense de PX (Fausse jambe → réapprendre l'Esquive, 200 PX, LDB 73). */
  trainProsthesis: (heroId: IdDeHeros, uid: IdDObjet) => void;
  /** Change de Carrière/Niveau (validation LDB 07 l.137 / LDB 08 : complétion, +100 hors Classe). */
  changeCareer: (heroId: IdDeHeros, newCareer: string, newLevel: number) => void;
  transitionTo: (sceneId: IdDeScene, entry?: string, pos?: Pt) => void;
  /** Le clic de la case `pt` en exploration, sur l'entité `entite` que le geste désigne : ce qu'il joue est
   *  `intentionDuClicDExploration` (interagir, jouer l'offre, rejoindre, marcher, dire, annuler). La marche se joue en
   *  une passe, pas à pas, sauts compris (`marcherLeChemin`), et s'arrête au premier pas qui ne se joue plus. */
  cliquerLaCase: (pt: Pt, entite?: IdDEntiteDeScene) => void;
  /** Ouvre ou ferme la porte d'un accès que le mobile du monde emprunte (`portesDuMobile`) : en combat toute porte,
   *  en exploration une porte fermée. Rend `true` si la porte a bougé. */
  actionnerLaPorte: (porte: IdDePorte) => boolean;
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
  /** JOUE une offre NOMMÉE d'une entité (`ActionOfferte.id`) — l'exécuteur UNIQUE des gestes
   *  d'exploration ; `interactEntity` n'en est que le raccourci « joue l'unique offre ». */
  jouerAction: (entityId: IdDEntiteDeScene, actionId: string) => void;
  /** FOUILLER LA PIÈCE où se tient le groupe (`rooms.roomFocusAt`) — geste d'exploration du GROUPE :
   *  second déclencheur de la découverte des portes secrètes (`decouvertePorteSecrete.fouilleDeLaPiece`),
   *  coûte la maison `fouille-piece-minutes` une fois par geste (LDB 12 l.200). Refus DIT hors exploration,
   *  en dialogue, sans meneur debout, hors de toute pièce. */
  fouillerLaPiece: () => void;
  /** Marchand de LIEU (#369) — service de catalogue sans `SceneEntity` (forgeron du hub de ville…) : même
   *  système marchand, keyé sur `placeServiceMerchantId` (`worldMap.ts`). */
  openPlaceMerchant: (entityId: string, archetype: string, backdrop?: string) => void;
  /** Recherche active de Disponibilité (LDB 59 l.50) : passer une journée entière + un Test de Ragot →
   *  réassort frais avec +10 % de Disponibilité si le Ragot réussit (avance l'horloge d'une journée). */
  searchAvailability: () => void;
  /** Jeux de taverne (option `tavern-games`, NADJ 16) : ouvrir la modale / jouer une partie
   *  (choisir un jeu + un adversaire, résolution par le moteur générique). */
  openTavernGames: (npcId?: string) => void;
  playTavernGame: (opts: { gameId: string; challengerId: IdDeHeros; opponent: tavernFlow.TavernOpponent; stakeBrass?: number; allyProfil?: string; tablePlayers?: number }) => void;
  /** Troc (LDB 59 l.64-76) : céder N exemplaires d'un objet contre M exemplaires du stock, sans argent. */
  barterExchange: (opts: { giveHeroId: IdDeHeros; giveTrappingId: string; getStockId: string; getCount?: number }) => void;
  /** « Baisse des prix » (LDB 59 l.60) : (dé)cale d'un cran le nombre de divisions de moitié consenties
   *  à la vente d'une instance (améliore la Disponibilité de l'acheteur, réduit le gain). */
  setSellHalving: (uid: IdDObjet, delta: number) => void;
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
  /** Répartition : affecte l'objet acheté n°`index` à un héros, puis la validation de l'échoppe
   *  (`fenetreValider('marchand')`) les range. */
  assignDistribution: (index: number, heroId: IdDeHeros) => void;
  /** Panier de VENTE (#22b, parité achat) : ajoute / retire / vide / conclut toute la vente d'un coup. */
  addToSellCart: (uid: IdDObjet, heroId: IdDeHeros) => void;
  removeFromSellCart: (uid: IdDObjet) => void;
  clearSellCart: () => void;
  confirmSell: () => void;
  /** Réparation chez l'artisan : remet damageTaken à 0 contre le coût unifié — armure 10 %/PA (LDB 63 l.64)
   *  ou arme 10 %/point de Dégâts (LDB 62 l.135). Arme improvisée = irréparable. */
  repairItem: (uid: IdDObjet, heroId: IdDeHeros) => void;
  /** Marchandage (LDB 59 l.43) : ouvre un Test opposé (1/visite) ; réduit ensuite les prix (`bargainBuyFactor`). */
  startBargain: (mode: 'buy' | 'sell') => void;
  /** Évaluation (LDB 59 l.41) : Test d'Évaluation (Int) ; un succès révèle l'objet + estime son prix.
   *  `mode:'detect'` = Détection d'artefact (LDB 10) : Intuition au toucher, une tentative par objet. */
  appraiseItem: (uid: IdDObjet, heroId: IdDeHeros, mode?: 'evaluate' | 'detect') => void;

  battleSelectAction: (a: BattleActionMode | null) => void;
  /** « Asperger d'eau » (MDG 16 l.19, #497) — Action DIRECTE (aucune modale) : cible explicite ou
   *  1ᵉʳ candidat éligible adjacent (patron `battleManPoste`). */
  battleWater: (targetId?: IdDeCombattant) => void;
  /** INFIRMERIE (hors combat, noyau/medicFlow) : modale de soins persistante — patients, actes
   *  (Guérison/Hémorragie/Déchirure/Chirurgie), PNJ payant via l'effet `medicalAid`. */
  openMedic: (opts?: { patientId?: IdDeHeros; npc?: MedicNpc }) => void;
  /** Lance un acte sur le patient courant (surgery → ARME l'opération). */
  medicAct: (act: HealMode) => void;
  /** OUVRE le jet INFLUENÇABLE d'une passe de Chirurgie (pendingSurgery) depuis l'opération armée. */
  openSurgeryPass: () => void;
  /** REPOS (noyau/restFlow) : modale de nuit — réglages PAR HÉROS (couchage + pitance,
   *  orthogonaux : on peut manger à l'auberge et dormir dehors), puis bilan globalisé. */
  openRest: (opts: restFlow.OpenRestOpts) => void;
  restSet: (heroId: IdDeHeros, patch: Partial<{ lodging: RestLodging; food: RestFood }>) => void;
  /** Recharger l'arme à distance (LDB 62 l.335) : OUVRE la modale de Test étendu de Projectiles. */
  battleReload: (weaponUid?: IdDObjet) => void;
  /** Se libérer (Empêtré, Test opposé de Force) / se rouler au sol (En flammes, Athlétisme) : OUVRE la modale (LDB 16 l.66/84). */
  battleRecoverState: (state: string) => void;
  /** Sélectionne la munition à tirer (uid d'un item `kind 'ammo'`). */
  battleSelectAmmo: (uid: IdDObjet, weaponUid?: IdDObjet) => void;
  /** Détermination (Resolve, LDB 17 l.61) : retire un État de l'actif (+1 PB si À Terre).
   *  Ne consomme PAS l'Action. */
  battleSpendResolve: (conditionName: string) => void;
  /** Détermination depuis une MODALE de jet (LDB 17 l.61) : même règle, pour n'importe quel héros
   *  (le défenseur n'est pas l'actif) et sans toucher au mode d'action. */
  spendResolveCondition: (combatantId: IdDeCombattant, conditionName: string) => void;
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
  battleUseItem: (uid: IdDObjet) => void;
  /** HORS COMBAT : un héros utilise un consommable (bandages, potion) depuis sa fiche. */
  usePartyItem: (heroId: IdDeHeros, uid: IdDObjet) => void;
  /** Incantation HORS COMBAT (couture D) : un héros lanceur cible self/allié ; sorts non-offensifs. */
  oocCastSpell: (casterId: IdDeCombattant, spellId: string, targetId: IdDeCombattant, fromGrimoire?: boolean) => void;
  battleFocusSpell: (spellId: string) => void;
  // Les OPTIONS de ces deux clics vivent avec leur consommateur (`targetingModes`) : les recopier ici
  // en littéral les faisait diverger en silence — le champ `approche` (verdict d'armement de la
  // Charge, spec § 2026-08-19) manquait déjà de cette copie, et TypeScript ne pouvait pas le dire.
  battleClickTile: (pt: Pt, opts?: TileClickOpts) => void;
  battleClickEntity: (id: IdDeCombattant, opts?: BattleClickOpts) => void;
  /** Annule TOUT le déplacement décomposé du Tour (R6) tant qu'aucune Action n'a été prise :
   *  restaure positions/orientation depuis `battle.moveSnapshot`. No-op après l'Action. */
  cancelMove: () => void;
  battleEndTurn: () => void;
  armEndTurn: () => void;
  /** Retire l'aperçu armé par un premier clic (`battle.preview`). */
  battleClearPreview: () => void;
  /** Chance, 3e usage (LDB 17 l.25) : en début de Round, place un héros en tête de l'ordre
   *  contre 1 point de Chance (pré-emption d'initiative). */
  roundStartPromote: (heroId: IdDeCombattantPromouvable) => void;
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
   *  l'Avantage adverse. `foeId` absent = 1er éligible (picker via réglage `battement.adversaire`). */
  battleBattement: (foeId?: IdDeCombattant) => void;
  /** Distraire (LDB 10 l.364 / AA 13 l.51) : MOUVEMENT, Test opposé Athlétisme vs Calme. Sur victoire,
   *  le foe est distrait (ne gagne plus d'Avantage). `foeId` absent = 1er éligible en Ligne de vue
   *  (picker via réglage `distraire.adversaire`). */
  battleDistraire: (foeId?: IdDeCombattant) => void;
  /** Manœuvre navale (MDG 13) : ouvre la modale du Test de Navigation pour le navire que sert `crewId`. */
  battleShipManeuver: (crewId: IdDeCombattant) => void;
  /** Recharge d'un poste (MDG 12 l.462) : ouvre la modale du Test étendu de Projectiles du chef de pièce + Soutien. */
  battleShipReload: (shipId: IdDeCombattant, posteUid: string) => void;
  /** Test d'équipage GÉNÉRIQUE (MDG 14) : ouvre la modale multi-jets du type `testTypeId` (Rude épreuve…). */
  battleCrewTest: (shipId: IdDeCombattant, testTypeId: string) => void;
  /** Chanson de marin (Talent, MDG 09 l.32-40) : ouvre la modale du chanteur (choix de chanson + Test de Chant). */
  battleSingShanty: (shipId: IdDeCombattant) => void;
  /** Chute volontaire (LDB 15 l.82) : depuis `from` (case du sauteur) vers `to` (case cardinale plus
   *  basse, croisée franchissable comprise), ouvre le choix pré-jet (Sauter / Tenter le Test
   *  `chute`). Porteur = le mobile de `gesteDArete` ; tout refus est NOMMÉ (`refuserGeste`). */
  fallAcross: (from: Pt, to: Pt) => void;
  /** ENJAMBER une croisée franchissable de plain-pied (#700 ; LDB 15 l.55, allège de la croisée
   *  `WallSeg.allege`) : exploration = le pas du groupe (`moveParty`) ; combat = le mobile de
   *  `gesteDArete`, Mouvement seul (1 case + l'allège à ½ vitesse), aucun Test, aucune Action. Tout refus
   *  est NOMMÉ (`refuserGeste`). */
  windowAcross: (from: Pt, to: Pt) => void;
  /** Se relever d'À Terre (LDB 16 l.37) : consomme le Mouvement (pas l'Action) ; impossible à 0 PB (LDB 18 l.15). */
  battleStandUp: () => void;
  /** « Servir cette pièce » (MDG 12) : le héros actif devient chef d'un poste de siège NON servi adjacent (arme octroyée) — coûte l'Action. KIND-AGNOSTIQUE. */
  battleManPoste: (target?: { hullId: IdDeCombattant; posteUid: string }) => void;
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
  battleDispelSpell: (spellId: string, spellCasterId: IdDeCombattant) => void;
  /** Focalisation HORS COMBAT (couture D) : ouvre la modale de Focalisation pour un héros lanceur du groupe. */
  oocFocusSpell: (casterId: IdDeCombattant, spellId: string) => void;
  /** Dissipation de sort permanent HORS COMBAT (couture D, LDB 46 l.160-162, #461). */
  oocDispelSpell: (casterId: IdDeCombattant, spellId: string, spellCasterId: IdDeCombattant) => void;
  // (Psychologie de combat (LDB 21 l.9, l.25) : passes de Round openRoundStartPsych / openRoundEndCascade,
  //  résolues par les verbes de jet de la cascade, applier 'combatPsych'.)
  /** Entrée en Frénésie d'un héros (LDB 21 l.31) : ouvrir la modale, lancer le Test de FM, Chance/Résilience, appliquer. */
  battleFrenzy: () => void;
  /** Action « cumuler l'Avantage » (LDB 09 l.305-308) : Test de la Compétence `skillId` (Intuition/
   *  Savoir/Survie/Prière) via la modale de Test standard ; sur réussite +1 Avantage plafonné. Coûte l'Action. */
  battleGainAdvantage: (skillId: string) => void;
  /** Combat monté (cadre : LDB 14 l.175-187) : enfourcher une monture libre adjacente / en descendre.
   *  Coût = MOUVEMENT sans jet ni Action — MAISON [entériné 2026-07-17] (« Met les en Maison pour le
   *  moment », #526 ; aucune clause de coût citable, LDB 14/15/09 + AA 9 fouillés en entier) ;
   *  Chevaucher sans Test : LDB 09 l.112. */
  /** `mountId` = la monture DÉSIGNÉE (sa pastille sur le champ) ; absent = la plus proche. */
  battleMount: (mountId?: IdDeCombattant) => void;
  battleDismount: () => void;
  /** Désengagement (LDB 15 l.43-68) : menu Sacrifier l'Avantage / Esquiver / Fuir / Renoncer. */
  battleDisengage: () => void;
  openWorldMap: () => void;
  /** « Marchander » le billet de `routeId` en `vehicule` depuis le lieu courant (`billetFlow`). */
  startBilletBargain: (routeId: string, vehicule: string) => void;
  /** Démarre un voyage depuis le lieu courant le long d'une route (mode + classe + allure). */
  startTravel: (routeId: string, mode: import('../engine/travel').TravelMode, opts?: import('./travelFlow').OptionsDeDepart) => void;
  /** Reprend un voyage interrompu par une péripétie. */
  resumeTravel: () => void;
  /** Bascule la CADENCE des ordres de la traversée en cours (couche `voyageCadence`) — « Passer en
   *  jour-par-jour » de l'écran de traversée, ou retour en commandée. */
  setVoyageCadence: (cadence: import('./voyageCadence').VoyageCadence) => void;
  /** Épingle le RÔLE de marche PERSISTANT d'un héros (`travelRole`, poste d'Activité de voyage EDOC 8),
   *  ou le détache (`null` ⇒ rôle inféré). Réutilisé au départ de chaque trajet (0 ré-assignation/jour). */
  setTravelRole: (heroId: IdDeHeros, role: import('../engine/activities').StagePosting | null) => void;
  /** Épingle (`role`) ou détache (`null`) le rôle d'ÉQUIPAGE naval d'un marin (`shipRole`) — interface de gestion
   *  du navire. Patche `party` ET `battle.combatants` (l'équipage vit dans la bataille en mer). */
  setShipRole: (crewId: IdDeCombattant, role: string | null) => void;
  /** Épingle (`station`) ou détache (`null`) la STATION à bord d'un marin (`shipStation`, id de
   *  `ship-stations.json`) — où il se TROUVE quand un Critique frappe une présence (`MDG 13 l.680`,
   *  `MSRC 07 l.78/l.82/l.94`). Aucun défaut : détaché, il n'est visé par aucune présence. Même patron
   *  que `setShipRole`. */
  setShipStation: (crewId: IdDeCombattant, station: string | null) => void;
  /** Sélectionne la munition PERSISTANTE d'un poste d'artillerie (`ShipPoste.ammoUid` — boulet/mitraille,
   *  MDG 12 l.410-424), depuis la fiche du navire. `null` → retour au défaut (1re compatible). */
  setPosteAmmo: (shipId: IdDeCombattant, posteUid: string, ammoUid: string | null) => void;
  /** Renomme l'instance (`label`). */
  renamePossession: (uid: IdDePossession, label: string) => void;
  /** Dépose la possession au lieu courant du groupe. */
  stablePossession: (uid: IdDePossession) => void;
  /** Reprend une possession déposée. */
  retrievePossession: (uid: IdDePossession) => void;
  /** Embarque la possession sur un hôte (véhicule/navire). */
  embark: (uid: IdDePossession, hostUid: IdDePossession) => void;
  /** Débarque une possession embarquée. */
  disembark: (uid: IdDePossession) => void;
  /** Abandon (§6, décision №4) — pose `destroyed`, confirmation côté appelant. */
  abandonPossession: (uid: IdDePossession) => void;
  /** Ouvre l'écran Port si le groupe est à un lieu portuaire de la carte avec un navire de campagne. */
  openPort: () => void;
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
}

/** Un geste écrit en verbe du noyau et ses arguments, tel qu'un hôte le joue. */
export interface GesteDuNoyau {
  verbe: keyof ActionsDuNoyau;
  args: unknown[];
}

/** Les clics du champ de bataille, par ce qu'ils désignent : un combattant (son id), une case (`Pt`). Un premier clic
 *  pose l'aperçu, le même clic le confirme (`battle.preview`). */
export const CLICS_DU_CHAMP = { combattant: 'battleClickEntity', case: 'battleClickTile' } as const satisfies Record<string, keyof ActionsDuNoyau>;
/** Le clic d'une case en exploration (`cliquerLaCase`). */
export const CLICS_DE_L_EXPLORATION = { case: 'cliquerLaCase' } as const satisfies Record<string, keyof ActionsDuNoyau>;
