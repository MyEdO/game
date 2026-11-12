import type { CharKey, Main } from '../engine/types';
import type { GenreDeDepot } from '../engine/activities';
import type { BattleActionMode } from './actionRegistry';
import type { ShootingStanceKey } from './etat';
import type { AttackKind } from '../engine/creatureAttacks';
import type { OptionDeDetermination } from './combatSlice';
import type { OptionsDuClic } from './targetingModes';
import type { IndiceAffiché } from './monde/clues';
import type { HerosEngage } from './creation/engagement';
import type { VerbesDeJet } from './rollFlowSpecs';
import type { VerbeDeReglage } from './reglagesDuJet';
import type { VerbeDeChoix } from './choixDesFenetres';
import type * as tavernFlow from './tavernFlow';
import type { ModeDEvaluation } from './merchantFlow';
import type { Pt } from './monde/path';
import type {
  IdDeCombattant, IdDeHeros, IdDePorteur, IdDePossession, IdDObjet,
  IdDEntiteDeScene, IdDuClic, IdDePorte, IdDIndice, IdDIntention, IdDeLigneDeButin,
  IdDeCargaison, IdDePorteurDeCargaison, IdDOffreDeCargaison, IdDeDepot, IdDeSort, IdDePanoplie, IdDeCondition, IdDeFaveur,
  IdDActivite, IdDObjetDuCatalogue, IdDApparence, IdDeTalent, IdDeCarriere, IdDeCreneau,
  IdDeCompetenceOuDeTalent, IdDActionDEntite, IdDeServiceDuLieu, IdDeRoute,
  IdDeModeDeVoyage, IdDeRoleABord, IdDeStation, IdDePoste, IdDeTraitNaval, IdDeCompetence, IdDAttaque, IdDeManoeuvre,
  IdDObjetRamassable,
} from './designations';
import type { FenetreAValider, FenetreQuiSeFerme } from './modalArbiter';
import type { RefDesignee, TexteLibre } from '../data/schemas/grammaire/ref';

/** Ce qu'un verbe reçoit sans le désigner, parce que le geste le crée : le brouillon d'un héros et l'id que son roster
 *  lui donne (`HerosEngage`). Exempt de désignation seulement : l'hôte en lit chaque champ à sa forme (`lireALaForme`). */
export type HorsDesignation<T> = T;
/** L'Indice d'intérêts d'un placement en banque, choisi entre 1 et 10 (LDB 23 l.168). */
export type IndiceDePlacement = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;
/** Un pas relatif au cap du meneur (`avancerDUnPas`). */
export type PasRelatif = 'avant' | 'arriere' | 'gauche' | 'droite';

/** Les gestes de la BARRE de l'actif (#3610) : chacun est le verbe qu'une offre du registre déclare (`ENTREES_PAR_RUN`,
 *  `actionRegistry.ts`), et nul autre geste ne le joue. Le refus de son geste le juge (`refusDuGeste`), dont l'offre
 *  est la projection : refusé, et dit, hors de l'entrée qui l'admet ; l'intention que cette offre arme s'arme chez l'émetteur. */
export interface VerbesDeLaBarre {
  /** Arme l'intention de l'offre `intentionId` (`ActionDef.intent`) : sa portée se peint, le clic du champ la commet. */
  armerLIntention: (intentionId: IdDIntention) => void;
  /** Arme le mode `mode` du combat (`battle.action`) : le clic-cible le commet. */
  armerLeMode: (mode: BattleActionMode) => void;
  /** Arme une ATTAQUE (id d'`AttackOption` : 'arme'/'morsure'/'tentacule'/'pietinement'…) pour le clic-ennemi
   *  — source UNIQUE de l'attaque armée. Toggle → 'arme'.
   *  Le clic-ennemi résout l'attaque armée via l'approche-puis-frappe (cliquerLeCombattant). */
  armerLAttaque: (attaqueId: IdDAttaque) => void;
  /** Manœuvre de ZONE / soi immédiate (Souffle/Vomi/Langue/Hurlement/Regard/Étreinte) : résolution
   *  directe par le résolveur moteur partagé. L'Étreinte glaciale coûte l'Action (LDB 85 l.112). */
  lancerLAttaqueDeZone: (kind: AttackKind) => void;
  /** Action « Viser » (sans jet) : +20 (Accessible) au prochain tir tant que c'est la dernière action. */
  prendreLaVisee: () => void;
  /** Recharger l'arme `weaponUid` du Tour, portée par l'actif ou pièce que sert son équipage (`rechargeDuTour`) : OUVRE
   *  la modale du Test étendu de Projectiles de son porteur. LDB 62 l.335 ; MDG 12 l.462 */
  rechargerLArme: (weaponUid?: IdDObjet) => void;
  /** Sélectionne la munition à tirer (uid d'un item `kind 'ammo'`). */
  approvisionnerLArme: (uid: IdDObjet, weaponUid?: IdDObjet) => void;
  /** Perturbante (LDB 62 l.272-274) : bascule le mode « Repousser » (1 m/DR au lieu des Dégâts). */
  basculerLaRepousse: () => void;
  /** Bascule une POSTURE DE TIR pré-armée du combattant actif (`battle.stances`, spec HUD §1a G5) :
   *  le choix se pose hors modale, le prochain `PendingAttack` le reçoit déjà armé. */
  basculerLaPosture: (stance: ShootingStanceKey) => void;
  /** « Asperger d'eau » (MDG 16 l.19, #497) — Action DIRECTE (aucune modale) : cible explicite ou
   *  1ᵉʳ candidat éligible adjacent (patron `servirLePoste`). */
  aspergerDEau: (cibleId?: IdDeCombattant) => void;
  /** « Sur la défensive » : utilise l'Action pour +20 en défense jusqu'au prochain tour. */
  prendreLaDefensive: () => void;
  /** Désengagement (LDB 15 l.43-68) : menu Sacrifier l'Avantage / Esquiver / Fuir / Renoncer. */
  rompreLEngagement: () => void;
  /** Action « cumuler l'Avantage » (LDB 09 l.305-308) : Test de la Compétence `skillId` (Intuition/
   *  Savoir/Survie/Prière) via la modale de Test standard ; sur réussite +1 Avantage plafonné. Coûte l'Action. */
  gagnerLAvantage: (skillId: IdDeCompetence) => void;
  /** Se libérer (Empêtré, Test opposé de Force) / se rouler au sol (En flammes, Athlétisme) : OUVRE la modale (LDB 16 l.66/84). */
  seRemettreDeLEtat: (etat: IdDeCondition) => void;
  /** Se relever d'À Terre (LDB 16 l.37) : consomme le Mouvement (pas l'Action) ; impossible à 0 PB (LDB 18 l.15). */
  seRelever: () => void;
  /** Battement (LDB 10 l.103 / AA 13 l.17) : Action, Test de Corps à corps NON opposé retirant de
   *  l'Avantage adverse. `foeId` absent = 1er éligible (picker via réglage `battement.adversaire`). */
  faireUnBattement: (foeId?: IdDeCombattant) => void;
  /** Distraire (LDB 10 l.364 / AA 13 l.51) : MOUVEMENT, Test opposé Athlétisme vs Calme. Sur victoire,
   *  le foe est distrait (ne gagne plus d'Avantage). `foeId` absent = 1er éligible en Ligne de vue
   *  (picker via réglage `distraire.adversaire`). */
  tenterDeDistraire: (foeId?: IdDeCombattant) => void;
  /** Entrée en Frénésie d'un héros (LDB 21 l.31) : ouvrir la modale, lancer le Test de FM, Chance/Résilience, appliquer. */
  entrerEnFrenesie: () => void;
  /** Capacité SUR SOI octroyée par un trait (Métamorphose humain↔hybride de l'Enfant d'Ulric) : résout la
   *  manœuvre `ciblage:'soi'` sur l'acteur et consomme l'Action (la 2ᵉ vient du `loseTurn` de ses effets). */
  manoeuvrerSurSoi: (maneuverId: IdDeManoeuvre) => void;
  /** Combat monté (cadre : LDB 14 l.175-187) : enfourcher une monture libre adjacente / en descendre.
   *  Coût = MOUVEMENT sans jet ni Action — MAISON [entériné 2026-07-17] (« Met les en Maison pour le
   *  moment », #526 ; aucune clause de coût citable, LDB 14/15/09 + AA 9 fouillés en entier) ;
   *  Chevaucher sans Test : LDB 09 l.112. `mountId` = la monture DÉSIGNÉE (sa pastille sur le champ) ; absent = la
   *  plus proche. */
  monterEnSelle: (mountId?: IdDeCombattant) => void;
  mettrePiedATerre: () => void;
  /** « Servir cette pièce » (MDG 12) : le héros actif sert le poste servable `posteUid` (chef s'il est libre, renfort
   *  sinon) ; omis, le 1ᵉʳ servable. Action gratuite (LDB 13 l.106, #3595). KIND-AGNOSTIQUE. */
  servirLePoste: (posteUid?: IdDePoste) => void;
  /** « Quitter la pièce » (release) : libère le poste servi pour un autre — coûte l'Action. */
  quitterLePoste: () => void;
  /** « Pousser » un engin de siège CREWÉ à roues (ADE II 8 l.258, #156) : ouvre le mode de
   *  ciblage-CASE 'poussee' (le clic-sol suivant commet la translation de formation, `targetingModes.ts`).
   *  Chef d'un poste d'engin MOBILE, Action dispo, Équipe ≥ moitié requise (sinon no-op, comme un tir
   *  sous-effectif refusé). Mouvement SIMPLE, aucun jet ; plafonné à `rule('engin-de-siege-vitesse-de-poussee')`. */
  pousserLEngin: () => void;
  /** « Diriger l'équipe » (Commandant d'équipe, AA) : Test de Commandement (+0) pour aider une équipe d'Arme
   *  d'équipe à portée de voix — sur réussite, elle tire au score de Projectiles du commandant. Coûte l'Action. */
  aiderLEquipe: () => void;
  /** Manœuvre navale (MDG 13) : ouvre la modale du Test de Navigation pour le navire que sert `crewId`. */
  manoeuvrerLeNavire: (crewId: IdDeCombattant) => void;
  /** Chanson de marin (Talent, MDG 09 l.32-40) : ouvre la modale du chanteur (choix de chanson + Test de Chant). */
  chanterLaChanson: (shipId: IdDeCombattant) => void;
  /** Annule TOUT le déplacement décomposé du Tour (R6) tant qu'aucune Action n'a été prise :
   *  restaure positions/orientation depuis `battle.moveSnapshot`. No-op après l'Action. */
  annulerLeDeplacement: () => void;
  /** FIN DU TOUR (spec §1c-bis COIN) : finir avec l'Action intacte ARME la fin (`armerLaFinDuTour`, empreinte de
   *  l'économie du tour, répliquée), le geste suivant passe la main. */
  terminerLeTour: () => void;
}

/** Les actions de JEU (#2817 D5) : tout hôte les porte ; aucune action d'interface. */
export interface ActionsDuNoyau extends VerbesDeJet, VerbeDeReglage, VerbeDeChoix, VerbesDeLaBarre {
  /** Élit (ou oublie, `null`) le porteur `porteurId` du Sort à dissiper (`dispelCarrierId`). */
  designerLeSupport: (porteurId: IdDeCombattant | null) => void;
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
  /** Le porteur du consommable `uid` (`porteurDeLObjet`) l'utilise, Action gratuite (LDB 13 l.106). */
  utiliserLObjet: (uid: IdDObjet) => void;
  /** Ramasse UN objet d'un décor à portée, sans l'équiper (`entityPickables`). En combat : le combattant actif, au prix de
   *  son Action (`ramassage` de `actions.json`), un objet posé au sol ou une feuille donneuse d'une action authorée (`key` =
   *  `<actionId>:eff:<index>`). Hors combat : un objet posé au sol seulement (un décor authoré se fouille,
   *  `jouerAction`), que le héros `heroId` reçoit, le meneur sans lui. */
  ramasserLObjet: (entityId: IdDEntiteDeScene, key: IdDObjetRamassable, heroId?: IdDeHeros) => void;
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
  /** Épingle (`epingle`) ou désépingle un indice du carnet (suivi joueur) ; refusé, et dit, si l'indice est encore
   *  caché (`carnet.refus.indiceInconnu`). */
  epinglerLIndice: (indiceId: IdDIndice, epingle: boolean) => void;
  /** Marque VUS par son siège les indices affichés au Carnet, tels qu'affichés (`marquerVus`, #2415). */
  marquerLesIndices: (affiches: readonly IndiceAffiché[]) => void;
  /** Coop : pose (`levee`) ou retire la demande de pause du prochain début de Round (fenêtre Chance), du siège qui
   *  joue le geste. */
  leverLaMain: (levee: boolean) => void;
  /** « Acquitter une Faveur » (LDB 23 l.147/149) : consomme une Activité d'interlude du héros. */
  solderLaFaveur: (heroId: IdDeHeros, favorId: IdDeFaveur) => void;
  /** Rompt une Faveur — Niveau de Carrière −1 (min 0) si la rumeur se répand (LDB 23 l.141). */
  rompreLaFaveur: (heroId: IdDeHeros, favorId: IdDeFaveur) => void;
  /** Regagne MAINTENANT les Points de Chance du groupe (LDB 17 l.47 « Longues Séances de Jeu » —
   *  règle optionnelle `chance-en-cours-de-session` en mode 'manual'). Réutilise l'Effet `restoreFortune`
   *  (logique partagée via `engine/fortune.restoreFortune`) — pas de duplication. */
  restaurerLaFortune: () => void;
  /** Ouvre le Test d'une Activité de bataille pré-combat (l.79-106). */
  menerLActionDeBataille: (heroId: IdDeHeros, activityId: IdDActivite) => void;
  /** Opérations bancaires (LDB 23 l.164-170) : `indice` choisi pour un placement (`investir`), tiré au d10 s'il est absent
   *  (LDB 23 l.168) ; refusé et dit sur un autre dépôt. */
  deposerALaBanque: (heroId: IdDeHeros, kind: GenreDeDepot, amountBrass: number, indice?: IndiceDePlacement) => void;
  retirerDeLaBanque: (depotId: IdDeDepot) => void;
  commanderLObjet: (heroId: IdDeHeros, trappingId: IdDObjetDuCatalogue) => void;
  /** Composition d'équipe : ajoute le héros que le noyau bâtit de `heros` (`herosDeLEngagement`), avec sa Richesse de
   *  départ, dans un emplacement du siège qui décide (`decidingSeat`) / retire un héros (propriétaire seul). */
  recruterLeHeros: (heros: HerosEngage) => void;
  renvoyerLeHeros: (heroId: IdDeHeros) => void;
  /** Remplace EN PLACE le héros `heroId` par celui que le noyau bâtit de `heros` (substitution atomique, possession
   *  transférée au siège qui possédait `heroId` ; ne touche pas la bourse) — créateur (édition) et bouton « Remplacer »
   *  du slot. */
  remplacerLeHeros: (heroId: IdDeHeros, heros: HerosEngage) => void;
  equiperLObjet: (uid: IdDObjet) => void;
  /** Range (`containerUid`) ou sort (null) un objet de son porteur d'un contenant (LDB 64). */
  rangerLObjet: (uid: IdDObjet, containerUid: IdDObjet | null) => void;
  creerLaPanoplie: (heroId: IdDeHeros) => void;
  supprimerLaPanoplie: (heroId: IdDeHeros, loadoutId: IdDePanoplie) => void;
  garnirLaPanoplie: (heroId: IdDeHeros, loadoutId: IdDePanoplie, slot: Main, uid: IdDObjet | null) => void;
  /** Donne un objet de son porteur à `destinataireId` (transfert d'inventaire). Arrive NON équipé chez le
   *  destinataire ; recalcule les deux loadouts. Permet de confier une arme/armure au bon porteur. */
  transmettreLObjet: (uid: IdDObjet, destinataireId: IdDePorteur) => void;
  /** Pose au sol, à la case du groupe, un objet d'un porteur du groupe et le contenu de son contenant (`objetsAuSol.ts`). */
  poserLObjet: (uid: IdDObjet) => void;
  /** Choisit un id du catalogue d’apparences admis par l’objet ; le défaut retire la clé (#2113). */
  poserLApparence: (uid: IdDObjet, apparence: IdDApparence) => void;
  /** Achète une Augmentation de Caractéristique (coût in/hors-carrière auto, recalc Blessures). */
  acheterLaCaracteristique: (heroId: IdDeHeros, char: CharKey) => void;
  /** Achète une Augmentation de Compétence (identité skillId+spec) ; acquiert la Compétence de
   *  carrière non connue à 0 ; l'achat via un slot « (Au choix) » libre le désigne. */
  acheterLaCompetence: (heroId: IdDeHeros, skill: RefDesignee<IdDeCompetence>) => void;
  /** Achète/augmente un Talent (identité talentId+spec ; refusé hors carrière l.97 / Maxi atteint). */
  acheterLeTalent: (heroId: IdDeHeros, talent: RefDesignee<IdDeTalent>) => void;
  /** Désigne GRATUITEMENT un emplacement « (Au choix) » de la carrière courante (LDB 09 l.38). */
  designerLeCreneau: (heroId: IdDeHeros, slotKey: IdDeCreneau, option: RefDesignee<IdDeCompetenceOuDeTalent>) => void;
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
  entrainerLaProthese: (uid: IdDObjet) => void;
  /** Change de Carrière/Niveau (validation LDB 07 l.137 / LDB 08 : complétion, +100 hors Classe). */
  changerDeCarriere: (heroId: IdDeHeros, newCareer: IdDeCarriere, newLevel: number) => void;
  /** Le clic de la case `pt`, sur ce que le geste y désigne (`entite`), le combat lu dans `battle`. En combat, un
   *  combattant désigné se joue par `cliquerLeCombattant` (le mode de ciblage, le Tir rapide de la pause de Round), une
   *  case libre par `cliquerLaCaseDuCombat` ; `opts` porte la confirmation et l'intention du clic (`OptionsDuClic`).
   *  En exploration, sur l'entité de scène désignée, ce qu'il joue est `intentionDuClicDExploration` (interagir, jouer
   *  l'offre, rejoindre, marcher, dire, annuler) ; la marche se joue en une passe, pas à pas, sauts compris
   *  (`marcherLeChemin`), et s'arrête au premier pas qui ne se joue plus. */
  cliquerLaCase: (pt: Pt, entite?: IdDuClic, opts?: OptionsDuClic) => void;
  /** Ouvre ou ferme la porte d'un accès que le mobile du monde emprunte (`portesDuMobile`) : en combat toute porte,
   *  en exploration une porte fermée. Rend `true` si la porte a bougé. */
  actionnerLaPorte: (porte: IdDePorte) => boolean;
  /** FRANCHIT l'arête de la case du mobile vers `vers` (case cardinale d'en face), selon la capacité qu'elle porte
   *  (`capaciteDuPas`, `aretes.ts`). Porteur = le mobile de `gesteDArete`, dont la case se lit dans l'état
   *  (exploration : le meneur, le groupe suit ; combat : l'actif que ce siège mène, héros ou ennemi mené par le siège
   *  MJ) ; tout refus est NOMMÉ (`refuserGeste`), dont une destination sans arête franchissable depuis cette case.
   *  - `escalade` (`WallSeg.climb`, LDB 15 l.53-57) : `ladder` monte d'office (pas de Test) au coût du Mouvement à
   *    ½ vitesse ; `surface` déclenche un Test d'Escalade influençable (cascade RollShell) du mobile, dont l'échec
   *    fait chuter, et consomme l'Action en combat (LDB 13 l.86-88).
   *  - `chute` (LDB 15 l.82) : vers une case plus basse, croisée franchissable comprise, ouvre le choix pré-jet
   *    (Sauter / Tenter le Test `chute`).
   *  - `fenetre` (#700 ; LDB 15 l.55, allège `WallSeg.allege`) : enjamber une croisée de plain-pied ; exploration =
   *    le pas du groupe ; combat = Mouvement seul (1 case + l'allège à ½ vitesse), aucun Test, aucune Action. */
  franchirLArete: (vers: Pt) => void;
  /** POV : pivote le REGARD du meneur d'un cran de 45° (+1 = horaire/droite, -1 = anti-horaire/gauche) —
   *  aucun déplacement (donc pas de réorientation par `orienterSelonLeChemin`). */
  pivoterLeGroupe: (turn: 1 | -1) => void;
  /** POV : un pas RELATIF au cap du meneur (avance/recul/pas latéral) — cap monde = regard tourné de
   *  0/2/4/6 crans (90° par cadran), case d'arrivée via `povStepDest`. Le regard est préservé pour tout
   *  pas ≠ avant (un pas latéral/arrière ne réoriente pas le meneur). */
  avancerDUnPas: (rel: PasRelatif) => void;
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
  /** Jeux de taverne (option `jeux-de-taverne`, NADJ 16) : ouvrir la modale / jouer une partie
   *  (choisir un jeu + un adversaire, résolution par le moteur générique). */
  ouvrirLesJeux: (entityId?: IdDEntiteDeScene) => void;
  jouerALaTaverne: (heroId: IdDeHeros, partie: tavernFlow.ReglageDePartie) => void;
  /** Évaluation (LDB 59 l.41) : Test d'Évaluation (Int) ; un succès révèle l'objet + estime son prix.
   *  `mode:'detection'` = Détection d'artefact (LDB 10 l.336) : Intuition au toucher, une tentative par détecteur.
   *  L'objet est porté (`IdDObjet`) ou une ligne d'un butin encore en fenêtre (`IdDeLigneDeButin`) ; chaque refus est
   *  dit (`refusDEvaluation`, `merchantFlow.ts`). */
  evaluerLObjet: (aEvaluer: IdDObjet | IdDeLigneDeButin, mode?: ModeDEvaluation) => void;

  /** INFIRMERIE (hors combat, noyau/medicFlow) : modale de soins persistante — patients (`fenetreChoisir('infirmerie', …)`),
   *  actes (`jetRegler('soins', 'mode', …)` sur le brouillon du soin, joué par `jetLancer('soins')`) ; le PNJ payant
   *  s'ouvre par l'effet `medicalAid`. */
  ouvrirLeMedecin: (patientId?: IdDeHeros) => void;
  /** REPOS (noyau/restFlow) : modale de nuit — réglages PAR HÉROS (couchage + pitance, `fenetreChoisir('repos', …)`,
   *  orthogonaux : on peut manger à l'auberge et dormir dehors), puis bilan globalisé ; le lieu de la nuit est celui où
   *  se tient le groupe (`reposDuLieu`). */
  ouvrirLeRepos: () => void;
  /** Retire l'aperçu armé par un premier clic (`battle.preview`). */
  effacerLApercu: () => void;
  // (Psychologie de combat (LDB 21 l.9, l.25) : passes de Round openRoundStartPsych / openRoundEndCascade,
  //  résolues par les verbes de jet de la cascade, applier 'psychologieDeCombat'.)
  ouvrirLaCarte: () => void;
  /** Rouvre l'écran du lieu où se tient le groupe (`lieuFlow`). */
  ouvrirLeLieu: () => void;
  /** « Marchander » le billet de `routeId` en `modeDeVoyage` depuis le lieu courant (`billetFlow`). */
  marchanderLeBillet: (routeId: IdDeRoute, modeDeVoyage: IdDeModeDeVoyage) => void;
  /** Démarre un voyage depuis le lieu courant le long d'une route (mode + classe + allure). */
  partirEnVoyage: (routeId: IdDeRoute, modeDeVoyage: IdDeModeDeVoyage, opts?: import('./travelFlow').OptionsDeDepart) => void;
  /** Reprend un voyage interrompu par une péripétie. */
  reprendreLeVoyage: () => void;
  /** Pose la CADENCE des ordres de la traversée en cours (couche `voyageCadence`), en valeur absolue :
   *  jour-par-jour ou commandée. */
  fixerLaCadence: (cadence: import('./voyageCadence').VoyageCadence) => void;
  /** EDOC 8 l.131. Épingle le RÔLE de marche PERSISTANT d'un héros (`travelRole`, poste d'Activité de voyage),
   *  ou le détache (`null` ⇒ rôle inféré). Réutilisé au départ de chaque trajet (0 ré-assignation/jour). */
  affecterAuRoleDeMarche: (heroId: IdDeHeros, role: { activityId: IdDActivite; freeSkill?: RefDesignee<IdDeCompetence> } | null) => void;
  /** MDG 14 l.11. Épingle (`roleId`) ou détache (`null`) le rôle d'ÉQUIPAGE naval d'un marin (`shipRole`) —
   *  interface de gestion du navire. Patche `party` ET `battle.combatants` (l'équipage vit dans la bataille en mer). */
  affecterAuRoleABord: (crewId: IdDeCombattant, roleId: IdDeRoleABord | null) => void;
  /** Épingle (`station`) ou détache (`null`) la STATION à bord d'un marin (`shipStation`, id de
   *  `ship-stations.json`) — où il se TROUVE quand un Critique frappe une présence (`MDG 13 l.680`,
   *  `MSRC 07 l.78/l.82/l.94`). Aucun défaut : détaché, il n'est visé par aucune présence. Même patron
   *  qu'`affecterAuRoleABord`. */
  affecterALaStation: (crewId: IdDeCombattant, station: IdDeStation | null) => void;
  /** Sélectionne la munition PERSISTANTE du poste `posteUid` (`ShipPoste.ammoUid`, MDG 12 l.410-424), sur le porteur
   *  qui le tient dans la bataille. `null` → retour au défaut (1re compatible). */
  approvisionnerLaPiece: (posteUid: IdDePoste, ammoUid: IdDObjet | null) => void;
  /** Renomme l'instance (`label`). */
  renommerLaPossession: (possessionUid: IdDePossession, label: TexteLibre) => void;
  /** Dépose la possession au lieu courant du groupe. */
  remiserLaPossession: (possessionUid: IdDePossession) => void;
  /** Reprend une possession déposée. */
  recupererLaPossession: (possessionUid: IdDePossession) => void;
  /** Embarque la possession sur un hôte (véhicule/navire). */
  embarquer: (possessionUid: IdDePossession, hostUid: IdDePossession) => void;
  /** Débarque une possession embarquée. */
  debarquer: (possessionUid: IdDePossession) => void;
  /** Abandon (§6, décision №4) — pose `destroyed`, confirmation côté appelant. */
  cederLaPossession: (possessionUid: IdDePossession) => void;
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
  /** Achète à quai `rations` rations-jour et `tonneaux` tonneaux d'eau douce pour la cale (MDG 14 l.248-252). */
  avitaillerLeNavire: (rations: number, tonneaux: number) => void;
  /** Ouvre l'écran Marché si le groupe est à un Lieu de commerce terrestre de la carte (`MapPlace.market`) ; ses
   *  achats, ventes et bradages sont ses choix (`fenetreChoisir('marcheDeTerre', …)`, comme au port, `cargaison.ts`). */
  ouvrirLeMarche: () => void;
  /** Transfère `enc` du lot `lotId` vers le porteur CO-LOCALISÉ `toId` (bête/véhicule/navire, #327). */
  deplacerLaCargaison: (lotId: IdDeCargaison, toId: IdDePorteurDeCargaison, enc: number) => void;
  /** Évalue la qualité secrète d'un lot de Vin proposé (Test d'Évaluation, MSRC 13 l.95) ; chaque refus est dit
   *  (`refusDEvaluerLeVin`, `landMarketFlow.ts`). */
  evaluerLeVin: (cargoId: IdDOffreDeCargaison) => void;
  /** Ouvre le Test de Ragot de l'auberge du hub de ville (#352, Activité `recueillir-informations`
   *  étendue au contexte `auberge`) : succès → rumeur commerciale (`generateTradeRumour`), échec →
   *  Exténué (EDOC 8 l.133). Avance l'horloge (`auberge-recueillir-informations-minutes`) quelle que soit l'issue. */
  recueillirLesRumeurs: () => void;
}

/** Un geste écrit en verbe du noyau et ses arguments, tel qu'un hôte le joue. */
export interface GesteDuNoyau {
  verbe: keyof ActionsDuNoyau;
  args: unknown[];
}

/** Un geste du noyau et ce qui le ferme maintenant (`null` : il se joue). */
export interface GesteFermable { geste: GesteDuNoyau; refus: string | null }

/** Le clic du champ, en combat comme en exploration : la case, et ce qu'elle porte. En combat, un premier clic pose
 *  l'aperçu, le même clic le confirme (`battle.preview`). */
export const CLIC_DU_CHAMP = 'cliquerLaCase' satisfies keyof ActionsDuNoyau;
