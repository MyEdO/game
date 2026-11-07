import type { CharKey } from '../engine/types';
import type { ContexteDOffre } from './actionRegistry';
import type { OptionDeDetermination } from './combatSlice';
import type { OptionsDuClic } from './targetingModes';
import type { IndiceAffiché } from './monde/clues';
import type { HerosEngage } from './creation/engagement';
import type { HealMode } from '../engine/healing';
import type { VerbesDeJet } from './rollFlowSpecs';
import type { VerbeDeReglage } from './reglagesDuJet';
import type { VerbeDeChoix } from './choixDesFenetres';
import type * as tavernFlow from './tavernFlow';
import type { Pt } from './monde/path';
import type {
  IdDeCombattant, IdDeCreatureADepecer, IdDeHeros, IdDeCombattantPromouvable, IdDePorteur, IdDePossession, IdDObjet, IdDeScene,
  IdDEntiteDeScene, IdDuClic, IdDeTireurRapide, IdDePorte, IdDIndice, IdDOffre, IdDeLigneDeButin,
  IdDeCargaison, IdDePorteurDeCargaison, IdDOffreDeCargaison, IdDeDepot, IdDeSort, IdDePanoplie, IdDeCondition, IdDeFaveur,
  IdDActivite, IdDObjetDuCatalogue, IdDAtoutDArtisanat, IdDeDefautDArtisanat, IdDApparence, IdDeTalent, IdDeCarriere, IdDeCreneau,
  IdDeCompetenceOuDeTalent, IdDEntrainement, IdDePointDEntree, IdDActionDEntite, IdDeServiceDuLieu, IdDArticle, IdDeRoute,
  IdDeModeDeVoyage, IdDeRoleABord, IdDeStation, IdDePoste, IdDeTraitNaval, IdDeCompetence,
} from './designations';
import type { CiblesChoisies } from './verdictsDInterlude';
import type { FenetreAValider, FenetreQuiSeFerme } from './modalArbiter';

/** Un texte que le joueur écrit (un nom, une motivation) : jamais un id, que `DESIGNATIONS` désigne. */
export type TexteLibre = string;
/** Ce qu'un verbe reçoit entier sans le désigner, parce que le geste le crée : le brouillon d'un héros et l'id que
 *  son roster lui donne (`HerosEngage`). Le noyau en juge chaque champ (`herosDeLEngagement`). */
export type HorsDesignation<T> = T;
/** Une Spécialisation de Compétence ou de Talent : un id du catalogue de l'entrée, ou, pour une entrée ouverte, un
 *  texte libre (`entreeOuverte`, LDB 09 l.40) ; le verbe la juge à l'entrée qu'il désigne. */
type Specialisation = TexteLibre;
/** Une Compétence désignée : son id, et sa Spécialisation (`RefDesignee`). */
export interface CompetenceDesignee { id: IdDeCompetence; spec?: Specialisation }

/** Les actions de JEU (#2817 D5) : tout hôte les porte ; aucune action d'interface. */
export interface ActionsDuNoyau extends VerbesDeJet, VerbeDeReglage, VerbeDeChoix {
  /** Élit (ou oublie, `null`) le porteur `porteurId` du Sort à dissiper (`dispelCarrierId`). */
  designerLeSupport: (porteurId: IdDeCombattant | null) => void;
  /** Arme (id d'action) ou dissout (`null`) l'intention locale. Re-armer la MÊME la dissout. */
  armerLIntention: (actionId: IdDOffre | null) => void;
  /** Joue l'offre `actionId` du registre (#2898) sur son contexte : refusée, et dite, quand `offresDeLActif` ne la rend
   *  pas ouverte (`refusDeLOffre`) ; elle arme son intention chez l'émetteur, puis joue son entrée d'`OFFRES_PAR_RUN`. */
  jouerLOffre: (actionId: IdDOffre, ctx?: ContexteDOffre) => void;
  /** Désarme le mode du combat (`battle.action`) et l'intention armée de l'émetteur : Échap, le re-clic d'une case armée,
   *  la sortie de la bordée. L'annulation est gratuite, rien n'étant engagé avant le clic-cible. */
  desarmerLeMode: () => void;
  /** Incante le sort `spellId` de `lanceurId` (LDB 46) : en combat, il arme le mode d'incantation, la cible se
   *  désignant au clic ; hors combat, sur `cibleId` (le lanceur par défaut), un sort non offensif. */
  incanterLeSort: (lanceurId: IdDeCombattant, spellId: IdDeSort, cibleId?: IdDeCombattant, fromGrimoire?: boolean) => void;
  /** Focalise le sort d'Arcane ou de Domaine `spellId` de `lanceurId` : ouvre la modale du Test étendu (LDB 46). */
  focaliserLeSort: (lanceurId: IdDeCombattant, spellId: IdDeSort) => void;
  /** Dissipe le Sort permanent `spellId` que porte `porteurId`, pour l'Action de `lanceurId` (LDB 46 l.158-162). */
  dissiperLeSort: (lanceurId: IdDeCombattant, spellId: IdDeSort, porteurId: IdDeCombattant) => void;
  /** Le porteur `porteurId` utilise le consommable `uid` de son inventaire, Action gratuite (LDB 13 l.106). */
  utiliserLObjet: (porteurId: IdDePorteur, uid: IdDObjet) => void;
  /** Prend le set d'armes `loadoutId` de `heroId`, Action gratuite (LDB 13 l.106), 1×/tour en combat. */
  prendreLaPanoplie: (heroId: IdDeHeros, loadoutId: IdDePanoplie) => void;
  /** Dépense un Point de Détermination de `combattantId` pour l'une de ses trois options, l'État `etat` pour le
   *  retrait (LDB 17 l.59-61). */
  depenserLaDetermination: (combattantId: IdDeCombattant, option: OptionDeDetermination, etat?: IdDeCondition) => void;
  /** Ferme la fenêtre `fenetre`, que son registre déclare se fermer (`sortie`, `modalArbiter.ts`) ; refusé, et dit,
   *  hors de ce que sa déclaration ouvre (`refusDeLaSortie`). */
  fenetreFermer: (fenetre: FenetreQuiSeFerme) => void;
  /** Valide la fenêtre `fenetre`, que son registre déclare se valider (`validation`, `modalArbiter.ts`) : à quorum,
   *  marque prêt le siège qui décide (`decidingSeat`) et la valide au quorum ; refusé, et dit, hors de ce que sa
   *  déclaration ouvre (`refusDeLaValidation`). */
  fenetreValider: (fenetre: FenetreAValider) => void;
  /** Épingle/désépingle un indice du carnet (suivi joueur, no-op si l'indice est encore caché). */
  epinglerLIndice: (indiceId: IdDIndice) => void;
  /** Marque VUS par son siège les indices affichés au Carnet, tels qu'affichés (`marquerVus`, #2415). */
  marquerLesIndices: (affichés: readonly IndiceAffiché[]) => void;
  /** Arme/désarme (bascule) la visée Tir rapide d'un héros pendant la pause de début de Round. */
  armerLeTirPreventif: (heroId: IdDeTireurRapide | null) => void;
  /** Récolte « Précieuses Entrailles » (ZI) une créature vaincue, par id (Test de Savoir → pièces valuées). */
  depecerLaCreature: (creatureId: IdDeCreatureADepecer) => void;
  /** Évaluation (LDB 59 l.41) ou Détection d'artefact (LDB 10) d'une ligne de butin ENCORE en
   *  fenêtre (loot ou victoire) : révéler un objet AVANT de choisir qui l'emporte. */
  evaluerLeButin: (scope: 'loot' | 'victory', uid: IdDeLigneDeButin, mode?: 'evaluate' | 'detect') => void;
  /** Coop : pose (`levee`) ou retire la demande de pause du prochain début de Round (fenêtre Chance), du siège qui
   *  joue le geste. */
  leverLaMain: (levee: boolean) => void;
  /** « Acquitter une Faveur » (LDB 23 l.147/149) : consomme une Activité d'interlude du héros. */
  solderLaFaveur: (heroId: IdDeHeros, favorId: IdDeFaveur) => void;
  /** Rompt une Faveur — Niveau de Carrière −1 (min 0) si la rumeur se répand (LDB 23 l.141). */
  rompreLaFaveur: (heroId: IdDeHeros, favorId: IdDeFaveur) => void;
  /** Regagne MAINTENANT les Points de Chance du groupe (LDB 17 l.47 « Longues Séances de Jeu » —
   *  règle optionnelle `fortune-mid-session` en mode 'manual'). Réutilise l'Effet `restoreFortune`
   *  (logique partagée via `engine/fortune.restoreFortune`) — pas de duplication. */
  restaurerLaFortune: () => void;
  /** Ouvre le Test d'une Activité de bataille pré-combat (l.79-106). */
  menerLActionDeBataille: (activityId: IdDActivite, heroId: IdDeHeros) => void;
  /** Choisit la Scène cinématique `activityId` du Round (Test de Compétence ou combat tactique). */
  jouerLaScene: (activityId: IdDActivite) => void;
  /** Affecte la LISTE des PJ postés à une action du Round (Scène MULTI-PJ résolue en Soutien, ou Activité
   *  SOLO ; clé = id d'Activité) — le POSTE que la résolution honorera à défaut de la suggestion. Liste vide =
   *  efface l'affectation. Réinitialisé à chaque Round. */
  affecterLeHeros: (activityId: IdDActivite, heroIds: IdDeHeros[]) => void;
  /** Ouvre le Test de Résistance de guérison du Rassemblement (l.122). */
  rallierLesTroupes: () => void;
  /** Tire/choisit le facteur environnemental du Round (l.309, 1d10). */
  affronterLePeril: (roll?: number) => void;
  /** Résout le Test spectaculaire de Puissance du Round (l.120). */
  engagerLaMelee: () => void;
  /** Passe au Round suivant après le Rassemblement (l.124). */
  avancerLaBataille: () => void;
  /** Activités (LDB 23) : `craftStart` engage l'ouvrage (matériaux ¼ prix + `Combatant.craft`) ; le
   *  LANCER passe par `pratiquerLActivite('craft')`. Passer commande (Exotique) + banque restent dédiés. */
  fabriquerLObjet: (heroId: IdDeHeros, trappingId: IdDObjetDuCatalogue, atouts: IdDAtoutDArtisanat[], defauts: IdDeDefautDArtisanat[]) => void;
  deposerALaBanque: (heroId: IdDeHeros, kind: 'invest' | 'stash' | 'mecenat', amountBrass: number, rate?: number) => void;
  retirerDeLaBanque: (depotId: IdDeDepot) => void;
  commanderLObjet: (heroId: IdDeHeros, trappingId: IdDObjetDuCatalogue) => void;
  /** Entraînement (ch.23 l.130-136) : Compétence/Caractéristique hors carrière, PX + tuteur 1D10 sc — sans jet. */
  suivreLEntrainement: (heroId: IdDeHeros, kind: 'skill' | 'characteristic', id: IdDEntrainement, spec?: Specialisation) => void;
  /** Activité du CATALOGUE data-driven (`activities.json`, contexte 'interlude' + gate `where`) — LE
   *  CHEMIN UNIQUE de toutes les Activités à jet : Revenus, Artisanat, Apprentissage (`talentId`),
   *  Identification (`itemUid`), Convalescence (ADE II), Activités d'Altdorf (ACE Annexe I). Cibles
   *  éventuelles : `CiblesChoisies`. */
  pratiquerLActivite: (heroId: IdDeHeros, activityId: IdDActivite, opts?: CiblesChoisies) => void;
  /** Composition d'équipe : ajoute le héros que le noyau bâtit de `heros` (`herosDeLEngagement`), avec sa Richesse de
   *  départ, dans un emplacement du siège qui décide (`decidingSeat`) / retire un héros (propriétaire seul). */
  recruterLeHeros: (heros: HerosEngage) => void;
  renvoyerLeHeros: (heroId: IdDeHeros) => void;
  /** Remplace EN PLACE le héros `oldId` par celui que le noyau bâtit de `heros` (substitution atomique, possession
   *  transférée au siège qui possédait `oldId` ; ne touche pas la bourse) — créateur (édition) et bouton « Remplacer »
   *  du slot. */
  remplacerLeHeros: (oldId: IdDeHeros, heros: HerosEngage) => void;
  equiperLObjet: (heroId: IdDePorteur, uid: IdDObjet) => void;
  /** Range (`containerUid`) ou sort (null) un objet d'un héros d'un contenant (LDB 64). */
  rangerLObjet: (heroId: IdDePorteur, uid: IdDObjet, containerUid: IdDObjet | null) => void;
  creerLaPanoplie: (heroId: IdDeHeros) => void;
  supprimerLaPanoplie: (heroId: IdDeHeros, loadoutId: IdDePanoplie) => void;
  garnirLaPanoplie: (heroId: IdDeHeros, loadoutId: IdDePanoplie, slot: 'main' | 'off', uid: IdDObjet | null) => void;
  /** Donne un objet d'un héros à un autre (transfert d'inventaire). Arrive NON équipé chez le
   *  destinataire ; recalcule les deux loadouts. Permet de confier une arme/armure au bon porteur. */
  transmettreLObjet: (uid: IdDObjet, fromHeroId: IdDePorteur, toHeroId: IdDePorteur) => void;
  /** Choisit un id du catalogue d’apparences admis par l’objet ; le défaut retire la clé (#2113). */
  poserLApparence: (heroId: IdDeHeros, uid: IdDObjet, apparence: IdDApparence) => void;
  /** Achète une Augmentation de Caractéristique (coût in/hors-carrière auto, recalc Blessures). */
  acheterLaCaracteristique: (heroId: IdDeHeros, char: CharKey) => void;
  /** Achète une Augmentation de Compétence (identité skillId+spec) ; acquiert la Compétence de
   *  carrière non connue à 0 ; l'achat via un slot « (Au choix) » libre le désigne. */
  acheterLaCompetence: (heroId: IdDeHeros, skill: CompetenceDesignee) => void;
  /** Achète/augmente un Talent (identité talentId+spec ; refusé hors carrière l.97 / Maxi atteint). */
  acheterLeTalent: (heroId: IdDeHeros, talentId: IdDeTalent, spec?: Specialisation) => void;
  /** Désigne GRATUITEMENT un emplacement « (Au choix) » de la carrière courante (LDB 09 l.38). */
  designerLeCreneau: (heroId: IdDeHeros, slotKey: IdDeCreneau, optionId: IdDeCompetenceOuDeTalent, spec?: Specialisation) => void;
  /** Apprentissage/mémorisation d'un sort (LDB 46/10) — coût PX via engine/grimoire. */
  acheterLeSort: (heroId: IdDeHeros, spellId: IdDeSort) => void;
  /** Achète un composant d'incantation pour un Sort d'Arcane/Domaine connu (LDB 46 l.113 — NI pistoles). */
  acheterLaComposante: (heroId: IdDeHeros, spellId: IdDeSort) => void;
  /** Retire un composant d'incantation possédé pour un Sort (sans remboursement). */
  retirerLaComposante: (heroId: IdDeHeros, spellId: IdDeSort) => void;
  /** Édite la bio mutable d'un héros hors combat (Motivation + Ambitions court/long, LDB 05) — persisté en save + roster. */
  ecrireLHistorique: (heroId: IdDeHeros, patch: { motivation?: TexteLibre; ambitionShort?: TexteLibre; ambitionLong?: TexteLibre }) => void;
  /** Ouvre la fin de séance depuis le menu de jeu : refusée et dite hors exploration et chez l'invité (`refusDeFinDeSeance`). */
  ouvrirLaFinDeSeance: () => void;
  /** Entraîne une prothèse portée par dépense de PX (Fausse jambe → réapprendre l'Esquive, 200 PX, LDB 73). */
  entrainerLaProthese: (heroId: IdDeHeros, uid: IdDObjet) => void;
  /** Change de Carrière/Niveau (validation LDB 07 l.137 / LDB 08 : complétion, +100 hors Classe). */
  changerDeCarriere: (heroId: IdDeHeros, newCareer: IdDeCarriere, newLevel: number) => void;
  quitterLaScene: (sceneId: IdDeScene, entry?: IdDePointDEntree, pos?: Pt) => void;
  /** Le clic de la case `pt`, sur ce que le geste y désigne (`entite`), le combat lu dans `battle`. En combat, un
   *  combattant désigné se joue par `cliquerLeCombattant` (le mode de ciblage, le Tir rapide de la pause de Round), une
   *  case libre par `cliquerLaCaseDuCombat` ; `opts` porte la confirmation et les verdicts d'armement (`OptionsDuClic`).
   *  En exploration, sur l'entité de scène désignée, ce qu'il joue est `intentionDuClicDExploration` (interagir, jouer
   *  l'offre, rejoindre, marcher, dire, annuler) ; la marche se joue en une passe, pas à pas, sauts compris
   *  (`marcherLeChemin`), et s'arrête au premier pas qui ne se joue plus. */
  cliquerLaCase: (pt: Pt, entite?: IdDuClic, opts?: OptionsDuClic) => void;
  /** Ouvre ou ferme la porte d'un accès que le mobile du monde emprunte (`portesDuMobile`) : en combat toute porte,
   *  en exploration une porte fermée. Rend `true` si la porte a bougé. */
  actionnerLaPorte: (porte: IdDePorte) => boolean;
  /** FRANCHIT l'arête de `de` (case du mobile) vers `vers` (case cardinale d'en face), selon la capacité qu'elle
   *  porte (`capaciteDuPas`, `aretes.ts`). Porteur = le mobile de `gesteDArete` (exploration : le meneur, le groupe
   *  suit ; combat : l'actif que ce siège mène, héros ou ennemi mené par le siège MJ) ; tout refus est NOMMÉ
   *  (`refuserGeste`).
   *  - `escalade` (`WallSeg.climb`, LDB 15 l.53-57) : `ladder` monte d'office (pas de Test) au coût du Mouvement à
   *    ½ vitesse ; `surface` déclenche un Test d'Escalade influençable (cascade RollShell) du mobile, dont l'échec
   *    fait chuter, et consomme l'Action en combat (LDB 13 l.86-88).
   *  - `chute` (LDB 15 l.82) : vers une case plus basse, croisée franchissable comprise, ouvre le choix pré-jet
   *    (Sauter / Tenter le Test `chute`).
   *  - `fenetre` (#700 ; LDB 15 l.55, allège `WallSeg.allege`) : enjamber une croisée de plain-pied ; exploration =
   *    le pas du groupe ; combat = Mouvement seul (1 case + l'allège à ½ vitesse), aucun Test, aucune Action. */
  franchirLArete: (de: Pt, vers: Pt) => void;
  /** POV : pivote le REGARD du meneur d'un cran de 45° (+1 = horaire/droite, -1 = anti-horaire/gauche) —
   *  aucun déplacement (donc pas de réorientation par `orienterSelonLeChemin`). */
  pivoterLeGroupe: (turn: 1 | -1) => void;
  /** POV : un pas RELATIF au cap du meneur (avance/recul/pas latéral) — cap monde = regard tourné de
   *  0/2/4/6 crans (90° par cadran), case d'arrivée via `povStepDest`. Le regard est préservé pour tout
   *  pas ≠ avant (un pas latéral/arrière ne réoriente pas le meneur). */
  avancerDUnPas: (rel: 'forward' | 'back' | 'left' | 'right') => void;
  /** JOUE une offre NOMMÉE d'une entité (`ActionOfferte.id`) — l'exécuteur UNIQUE des gestes
   *  d'exploration ; `interagirAvecLEntite` n'en est que le raccourci « joue l'unique offre ». */
  jouerAction: (entityId: IdDEntiteDeScene, actionId: IdDActionDEntite) => void;
  /** FOUILLER LA PIÈCE où se tient le groupe (`rooms.roomFocusAt`) — geste d'exploration du GROUPE :
   *  second déclencheur de la découverte des portes secrètes (`decouvertePorteSecrete.fouilleDeLaPiece`),
   *  coûte la maison `fouille-piece-minutes` une fois par geste (LDB 12 l.200). Refus DIT hors exploration,
   *  en dialogue, sans meneur debout, hors de toute pièce. */
  fouillerLaPiece: () => void;
  /** Marchand de LIEU (#369) — l'échoppe du service `serviceId` du lieu où se tient le groupe (forgeron du hub de
   *  ville…) : même système marchand, keyé sur `placeServiceMerchantId` (`worldMap.ts`). */
  ouvrirLaBoutique: (serviceId: IdDeServiceDuLieu) => void;
  /** Recherche active de Disponibilité (LDB 59 l.50) : passer une journée entière + un Test de Ragot →
   *  réassort frais avec +10 % de Disponibilité si le Ragot réussit (avance l'horloge d'une journée). */
  chercherLaDisponibilite: () => void;
  /** Jeux de taverne (option `tavern-games`, NADJ 16) : ouvrir la modale / jouer une partie
   *  (choisir un jeu + un adversaire, résolution par le moteur générique). */
  ouvrirLesJeux: (npcId?: IdDEntiteDeScene) => void;
  jouerALaTaverne: (opts: tavernFlow.ReglageDePartie) => void;
  /** Troc (LDB 59 l.64-76) : céder N exemplaires d'un objet contre M exemplaires du stock, sans argent. */
  troquerLesObjets: (opts: { giveHeroId: IdDeHeros; giveTrappingId: IdDObjetDuCatalogue; getStockId: IdDArticle; getCount?: number }) => void;
  /** Refuse un marché NÉGOCIÉ (achat ou vente) : annule la négociation de ce côté + pose le VERROU PARTAGÉ
   *  (plus aucune négociation, achat NI vente, jusqu'au réassort). L'achat vide aussi le panier. */
  refuserLeMarche: (mode: 'buy' | 'sell') => void;
  /** Paye le panier (`fenetreChoisir('marchand', …)`) : débite le Total (prix listés × Marchandage), retire du stock,
   *  et met les objets achetés EN ATTENTE DE RÉPARTITION (`pendingDistribution`) — « qui récupère quoi ». */
  payerLesAchats: () => void;
  /** Conclut d'un coup la vente du panier de VENTE (#22b, `fenetreChoisir('marchand', …)`). */
  vendreLeLot: () => void;
  /** Réparation chez l'artisan : remet damageTaken à 0 contre le coût unifié — armure 10 %/PA (LDB 63 l.64)
   *  ou arme 10 %/point de Dégâts (LDB 62 l.135). Arme improvisée = irréparable. */
  reparerLObjet: (uid: IdDObjet, heroId: IdDeHeros) => void;
  /** Marchandage (LDB 59 l.43) : ouvre un Test opposé (1/visite) ; réduit ensuite les prix (`bargainBuyFactor`). */
  marchanderLePrix: (mode: 'buy' | 'sell') => void;
  /** Évaluation (LDB 59 l.41) : Test d'Évaluation (Int) ; un succès révèle l'objet + estime son prix.
   *  `mode:'detect'` = Détection d'artefact (LDB 10) : Intuition au toucher, une tentative par objet. */
  evaluerLObjet: (uid: IdDObjet, heroId: IdDeHeros, mode?: 'evaluate' | 'detect') => void;

  /** INFIRMERIE (hors combat, noyau/medicFlow) : modale de soins persistante — patients, actes
   *  (Guérison/Hémorragie/Déchirure/Chirurgie) ; le PNJ payant s'ouvre par l'effet `medicalAid`. */
  ouvrirLeMedecin: (opts?: { patientId?: IdDeHeros }) => void;
  /** Lance un acte sur le patient courant (surgery → ARME l'opération). */
  soignerLePatient: (act: HealMode) => void;
  /** OUVRE le jet INFLUENÇABLE d'une passe de Chirurgie (pendingSurgery) depuis l'opération armée. */
  ouvrirLaChirurgie: () => void;
  /** REPOS (noyau/restFlow) : modale de nuit — réglages PAR HÉROS (couchage + pitance, `fenetreChoisir('rest', …)`,
   *  orthogonaux : on peut manger à l'auberge et dormir dehors), puis bilan globalisé ; le lieu de la nuit est celui où
   *  se tient le groupe (`reposDuLieu`). */
  ouvrirLeRepos: () => void;
  /** Retire l'aperçu armé par un premier clic (`battle.preview`). */
  effacerLApercu: () => void;
  /** Chance, 3e usage (LDB 17 l.25) : en début de Round, place un héros en tête de l'ordre
   *  contre 1 point de Chance (pré-emption d'initiative). */
  promouvoirLeCombattant: (heroId: IdDeCombattantPromouvable) => void;
  // (Psychologie de combat (LDB 21 l.9, l.25) : passes de Round openRoundStartPsych / openRoundEndCascade,
  //  résolues par les verbes de jet de la cascade, applier 'combatPsych'.)
  ouvrirLaCarte: () => void;
  /** Rouvre l'écran du lieu où se tient le groupe (`lieuFlow`). */
  ouvrirLeLieu: () => void;
  /** « Marchander » le billet de `routeId` en `mode` depuis le lieu courant (`billetFlow`). */
  marchanderLeBillet: (routeId: IdDeRoute, mode: IdDeModeDeVoyage) => void;
  /** Démarre un voyage depuis le lieu courant le long d'une route (mode + classe + allure). */
  partirEnVoyage: (routeId: IdDeRoute, mode: IdDeModeDeVoyage, opts?: import('./travelFlow').OptionsDeDepart) => void;
  /** Reprend un voyage interrompu par une péripétie. */
  reprendreLeVoyage: () => void;
  /** Bascule la CADENCE des ordres de la traversée en cours (couche `voyageCadence`) — « Passer en
   *  jour-par-jour » de l'écran de traversée, ou retour en commandée. */
  fixerLaCadence: (cadence: import('./voyageCadence').VoyageCadence) => void;
  /** Épingle le RÔLE de marche PERSISTANT d'un héros (`travelRole`, poste d'Activité de voyage EDOC 8),
   *  ou le détache (`null` ⇒ rôle inféré). Réutilisé au départ de chaque trajet (0 ré-assignation/jour). */
  attribuerLeRoleDeMarche: (heroId: IdDeHeros, role: { activityId: IdDActivite; freeSkill?: CompetenceDesignee } | null) => void;
  /** Épingle (`roleId`) ou détache (`null`) le rôle d'ÉQUIPAGE naval d'un marin (`shipRole`) — interface de gestion
   *  du navire. Patche `party` ET `battle.combatants` (l'équipage vit dans la bataille en mer). */
  attribuerLeRoleABord: (crewId: IdDeCombattant, roleId: IdDeRoleABord | null) => void;
  /** Épingle (`station`) ou détache (`null`) la STATION à bord d'un marin (`shipStation`, id de
   *  `ship-stations.json`) — où il se TROUVE quand un Critique frappe une présence (`MDG 13 l.680`,
   *  `MSRC 07 l.78/l.82/l.94`). Aucun défaut : détaché, il n'est visé par aucune présence. Même patron
   *  qu'`attribuerLeRoleABord`. */
  affecterALaStation: (crewId: IdDeCombattant, station: IdDeStation | null) => void;
  /** Sélectionne la munition PERSISTANTE d'un poste d'artillerie (`ShipPoste.ammoUid` — boulet/mitraille,
   *  MDG 12 l.410-424), depuis la fiche du navire. `null` → retour au défaut (1re compatible). */
  approvisionnerLaPiece: (shipId: IdDeCombattant, posteUid: IdDePoste, ammoUid: IdDObjet | null) => void;
  /** Renomme l'instance (`label`). */
  renommerLaPossession: (uid: IdDePossession, label: TexteLibre) => void;
  /** Dépose la possession au lieu courant du groupe. */
  remiserLaPossession: (uid: IdDePossession) => void;
  /** Reprend une possession déposée. */
  recupererLaPossession: (uid: IdDePossession) => void;
  /** Embarque la possession sur un hôte (véhicule/navire). */
  embarquer: (uid: IdDePossession, hostUid: IdDePossession) => void;
  /** Débarque une possession embarquée. */
  debarquer: (uid: IdDePossession) => void;
  /** Abandon (§6, décision №4) — pose `destroyed`, confirmation côté appelant. */
  cederLaPossession: (uid: IdDePossession) => void;
  /** Ouvre l'écran Port si le groupe est à un lieu portuaire de la carte avec un navire de campagne. */
  ouvrirLePort: () => void;
  /** Répare la coque au chantier (1 CO/Blessure, MDG 13 l.643) — journalise le résultat. */
  reparerLeNavire: () => void;
  /** Carène en cale sèche (Salissures, MDG 13 l.150-159). */
  carenerLeNavire: () => void;
  /** Installe une Amélioration navale (coût par bande de Taille, MDG 12). */
  installerLAmelioration: (traitId: IdDeTraitNaval, units?: number) => void;
  /** Recrute `count` PNJ salariés au rôle `roleId` (escale-hub #228 — barème `crew-roles.json`, MDG 14 l.293-302). */
  recruterLEquipage: (roleId: IdDeRoleABord, count?: number) => void;
  /** Débarque `count` PNJ salariés du rôle `roleId` (#228). */
  renvoyerLEquipage: (roleId: IdDeRoleABord, count?: number) => void;
  /** Ouvre l'écran Marché si le groupe est à un Lieu de commerce terrestre de la carte (`MapPlace.market`). */
  ouvrirLeMarche: () => void;
  /** Achète `enc` points d'une offre du marché ouvert, chargés sur le porteur `porteurId` dans la limite de sa
   *  Contenance (#327) : au port, le navire (Type/Taille/Marchandage, MDG 15 l.319-349) ; à la halle, un porteur de
   *  vrac (disponibilité 2 temps/Marchandage/lot partiel, MSRC 13 l.129-131). */
  acheterLaCargaison: (porteurId: IdDePorteurDeCargaison, cargoId: IdDOffreDeCargaison, enc: number) => void;
  /** Vend le lot `lotId` au marché ouvert : au port, un lot de la cale (Trouver un acheteur/Prix d'offre/Marchandage,
   *  MDG 15 l.351-397) ; à la halle, le lot d'un porteur (Demande/Mise à prix/Marchandage, MSRC 13 l.133-160). */
  vendreLaCargaison: (lotId: IdDeCargaison) => void;
  /** Brade le lot `lotId` au marché ouvert : ¼ du prix de base au port (MDG 15 l.399), ½ dans un Lieu de Commerce
   *  (MSRC 13 l.160). */
  jeterLaCargaison: (lotId: IdDeCargaison) => void;
  /** Transfère `enc` du lot `lotId` vers le porteur CO-LOCALISÉ `toId` (bête/véhicule/navire, #327). */
  deplacerLaCargaison: (lotId: IdDeCargaison, toId: IdDePorteurDeCargaison, enc: number) => void;
  /** Évalue la qualité secrète d'un lot de Vin proposé (Test d'Évaluation, MSRC 13 l.95). */
  evaluerLeVin: (cargoId: IdDOffreDeCargaison) => void;
  /** Ouvre le Test de Ragot de l'auberge du hub de ville (#352, Activité `recueillir-informations`
   *  étendue au contexte `auberge`) : succès → rumeur commerciale (`generateTradeRumour`), échec →
   *  Exténué (EDOC 8 l.133). Avance l'horloge (`inn-gather-info-minutes`) quelle que soit l'issue. */
  recueillirLesRumeurs: () => void;
}

/** Un geste écrit en verbe du noyau et ses arguments, tel qu'un hôte le joue. */
export interface GesteDuNoyau {
  verbe: keyof ActionsDuNoyau;
  args: unknown[];
}

/** Le clic du champ, en combat comme en exploration : la case, et ce qu'elle porte. En combat, un premier clic pose
 *  l'aperçu, le même clic le confirme (`battle.preview`). */
export const CLIC_DU_CHAMP = 'cliquerLaCase' satisfies keyof ActionsDuNoyau;
