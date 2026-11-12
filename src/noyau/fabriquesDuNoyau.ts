/**
 * Les actions du noyau (#2817 D5, D9) : la composition UNIQUE des fabriques `(get, set) => actions`, que
 * lisent chaque propriétaire de l'état, le store web (`src/state/store.ts`) comme la partie
 * (`partie.ts`). Une fabrique ajoutée ici sert les deux.
 */
import type { Camp, Equipe, Relation } from '../engine/relations';
import type { MsgKey } from '../i18n';
import type { Flow } from '../engine/flowCore';
import type { BattleOutcome } from '../engine/massBattle';
import type { PendingBase, RollFlowSpec } from './rollFlowFactory';
import type { Station } from './stations';
import type { ActionsDuNoyau, PasRelatif } from './actionsDuNoyau';
import type { JeuDuNoyau, MachinerieDuNoyau } from './machinerieDuNoyau';
import type { Get, SetDesClesReservees } from './flowTypes';
import { creerReglageDuJet, creerVerbesDeJet, type CloturesDuJet } from './rollFlowSpecs';
import type { CorpsDesReglages, VerbeDeReglage } from './reglagesDuJet';
import type { ActionDeJet, FlowKey, NomDeVerbeDeJet, RollVerb } from './flowVerbs';
import type { Majuscule } from './intentionsDeSiege';
import type { IdsParEspace } from '../data/schemas/_ids.generated';
import type { Effect, effectTargetSchema } from '../data/schemas/defs-scenes/effets';
import { choixDuCombat, cloturesDuCombat, createCombatSlice, reglagesDuCombat, sortiesDuCombat, validationsDuCombat } from './combatSlice';
import { creerSortieDeFenetre, type SortiesDeFenetre } from './sortieDeFenetre';
import { creerValidationDeFenetre, type ValidationsDeFenetre } from './validationDeFenetre';
import { creerChoixDeFenetre } from './choixDeFenetre';
import type { AxeDuChoix, ChoixDesFenetres, CorpsDesChoix } from './choixDesFenetres';
import { creerVerbesDeLaBarre, type BattleActionMode } from './actionRegistry';
import { creerActionsDOrientation } from './orientation';
import { creerActionsDeManoeuvre } from './shipManeuver';
import { sortiesDuChapitre, validationsDuChapitre } from './chapitreRecap';
import { choixDeCampagne, creerActionsDeCampagne, sortiesDeCampagne } from './campagne';
import { creerActionsDEntreeEnScene } from './entreeEnScene';
import { choixDInterlude, cloturesDInterlude, creerActionsDInterlude, validationsDInterlude } from './interludeFlow';
import { choixDeLaBataille, creerActionsDeBatailleDeMasse, massBattleResumeCombat, sortiesDeBatailleDeMasse, validationsDeBatailleDeMasse } from './massBattleFlow';
import { creerActionsDesFaveurs } from './favorFlow';
import { choixDeLaFinDeSeance, creerActionsDuGroupe, sortiesDuGroupe, validationsDuGroupe } from './partyFlow';
import { creerActionsDesPossessions } from './possessionsFlow';
import { creerActionsDeMarche } from './marcheDuGroupe';
import { cloturesDeFranchissement, creerActionsDeFranchissement, reglagesDeFranchissement } from './gesteDArete';
import { creerActionsDInteraction } from './interactionsDExploration';
import { choixDeConversation } from './conversation';
import { choixDuMarchand, cloturesDuMarchand, creerActionsDuMarchand, sortiesDuMarchand, validationsDuMarchand, type ModeDEvaluation, type ModeDeMarche } from './merchantFlow';
import { creerActionsDeTaverne, sortiesDeLaTaverne, type TavernOpponent } from './tavernFlow';
import { creerActionsDesDes } from './battleRng';
import { choixDuButin, creerActionsDIssueDeCombat, sortiesDIssueDeCombat } from './issueDeCombat';
import { choixDuMedecin, cloturesDuMedecin, creerActionsDuMedecin, sortiesDuMedecin } from './medicFlow';
import { choixDuRepos, creerActionsDuRepos, sortiesDuRepos, validationsDuRepos } from './restFlow';
import { choixDeLEquipage, creerActionsDeLEquipage, sortiesDeLEquipage } from './shipCrew';
import { cloturesDesTestsDeScene, creerActionsDesTestsDeScene, reglagesDesTestsDeScene } from './testsDeScene';
import { cloturesDuLotDEtal } from './etalLotFlow';
import { choixDeCorruption, cloturesDeCorruption, reglagesDeCorruption } from './corruptionFlow';
import { creerActionsDuJournal } from './journal';
import { creerActionsDuReseau } from './reseau';
import { creerActionsDAvanceeDHorloge, creerActionsDHorloge } from './horloge';
import { creerFabriqueDIds } from './idsDuMonde';
import { creerActionsDuVoyage, sortiesDuVoyage, validationsDuVoyage } from './travelFlow';
import { choixDuLieu, creerActionsDuLieu, sortiesDuLieu } from './lieuFlow';
import { creerActionsDesPostesDeVoyage } from './travelPostes';
import { creerActionsDuBillet } from './billetFlow';
import { creerActionsDuPort, sortiesDuPort } from './portFlow';
import { choixDuVoyageEnMer, creerActionsDuVoyageEnMer, type SeaVoyageState } from './seaVoyageFlow';
import { creerActionsDuMarcheTerrestre, sortiesDuMarcheTerrestre } from './landMarketFlow';
import { choixDesMarches } from './cargaison';
import { creerActionsDeLAuberge } from './innFlow';
import { choixDeLaSemaineEnMer, validationsDeLaSemaineEnMer } from './seaActivities';
import type { BattleState, NetState, ShootingStanceKey } from './etat';
import type { AttackPlan, MovementResolution } from './combatFlow';
import type { CounterDeclaration, EnchainementDuCoup, IssueDEmpoignade, IssueOpposee, PendingAppraise, PendingAuContact, PendingDisengage, PendingGrapple, ReactionDeBouclier, RevealEntry } from './pendings';
import type { ZoneEnPose } from './targetingHolder';
import type { VerdictApprentissage } from '../engine/grimoire';
import type { OrientationOutcome } from '../engine/seaNavigation';
import type { VainqueurOppose } from '../engine/tests';
import type { RecapTone } from './recapLine';
import type { VainqueurDeTaverne } from '../engine/tavernGame';
import type { SellRelation } from '../engine/seaVoyage';
import type { VoyageCadence } from './voyageCadence';
import type { CharMode } from './creation/brouillon';
import type { HealMode } from '../engine/healing';
import type { bankWithdrawOutcome, EntrainementOption, GenreDeDepot, statusIncome } from '../engine/activities';
import type { CargoRaidOutcome } from '../engine/cargo';
import type { RiverPerilKind } from '../engine/riverNavigation';
import type { GenreDeFlottant } from './effetsDeLAppel';
import type { SpellAffinity, TargetingMode } from './targetingModes';
import type { Combatant, EffectSourceKind, ItemKind, Main, Weapon } from '../engine/types';
import type { GameOp } from '../engine/ops';
import type { TavernGame } from '../engine/tavernGame';
import type { psychResolution } from '../engine/psychology';
import type { weaponGroupSkillMode } from '../engine/combat';
import type { GroupeDArme, ManeuverDef, SkillData, TraitData, TrappingTypeId } from '../data/index';
import type { PorteeDAssaut } from '../data/schemas/grammaire/mecanique';
import type { ChargeDAttaque } from './bus';
import type { TypeDAttaque } from './combat/hitModifiers';
import type { CleDeRegistre } from './modalArbiter';
import type { HostJet } from './slotsDeJet';
import type { ClueState } from './monde/clues';
import type { ActorAimKind, CombatEventKind } from './combatLog';
import type { EnemyAction } from './monde/ai';
import type { FenetreDAttaque } from './fenetreDAttaque';
import type { FenetreDeDefense } from './fenetreDeDefense';
import type { RoleDAnimation } from './animation';
import type { GenreDeCascade } from './tablesPosees';
import type { PursuitPayload } from './pursuitFlow';
import type { EncounterDef } from './monde/scene';
import type { weaponUsesHand } from '../engine/trauma';
import type { CibleDEffetDeScene } from './combatEffects';
import type { Carrier } from './monde/carrier';
import type { SeatOccupant } from './monde/seating';
import type { AdvantageCamp } from '../engine/advantagePool';
import type { EffectTargeting } from '../engine/flowCore';
import type { phaseDeChute } from './fallMove';
import type { Tool } from './sceneEditLecture';
import type { ActionDArchitecture, OutilDeLEditeur } from './edition/session';
import type { ContexteDuPointeur } from './edition/pointeur';
import type { RouteObjet } from '../data/schemas/exposition-derivee';
import type { advanceCost } from '../engine/advancement';
import type { SequenceAbandon, SequenceBoard, SequenceCloseCtx, SequenceDef, SequenceRoundActors, SequenceState, SequenceVerdict } from './sequenceContract';
import type { sequenceCumulsDeLaManche } from './sequenceCore';

/** Les actions du lexique des verbes (#3371 §3.1) : un verbe manuscrit se nomme `<action>` ou `<action><Complément>`, ou
 *  à la forme pronominale (`seRelever`). */
type ActionDuLexique = 'acheter' | 'actionner' | 'affecter' | 'aider' | 'annuler' | 'approvisionner'
  | 'armer' | 'asperger' | 'avancer' | 'avitailler' | 'basculer' | 'carener' | 'ceder' | 'changer' | 'chanter'
  | 'cliquer' | 'commander' | 'creer' | 'debarquer' | 'depenser' | 'deplacer' | 'deposer' | 'desarmer' | 'designer'
  | 'dissiper' | 'ecrire' | 'effacer' | 'embarquer' | 'engager' | 'entrainer' | 'entrer' | 'epingler' | 'equiper'
  | 'evaluer' | 'faire' | 'fixer' | 'focaliser' | 'fouiller' | 'franchir' | 'gagner' | 'garnir'
  | 'incanter' | 'installer' | 'jouer' | 'lancer' | 'lever' | 'manoeuvrer' | 'marchander' | 'marquer'
  | 'mener' | 'mettre' | 'monter' | 'ouvrir' | 'partir' | 'pivoter' | 'poser' | 'pousser'
  | 'prendre' | 'quitter' | 'ramasser' | 'ranger' | 'recharger' | 'recruter' | 'recueillir' | 'recuperer'
  | 'relever' | 'remettre' | 'remiser' | 'remplacer' | 'renommer' | 'renvoyer' | 'reparer' | 'reprendre'
  | 'restaurer' | 'retirer' | 'rompre' | 'servir' | 'solder' | 'supprimer' | 'tenter' | 'terminer'
  | 'transmettre' | 'utiliser';
/** Les actions des verbes de fenêtre, `fenetre<Action>` (`VerbeDeChoix`, `fenetreValider`, `fenetreFermer`). */
type ActionDeFenetre = 'choisir' | 'valider' | 'fermer';

/** Les noms du lexique : un verbe manuscrit, à la forme pronominale comprise, un verbe de jet ou de réglage de jet, un
 *  verbe de fenêtre. */
type NomDeVerbe = NomPronominal<ActionDuLexique>
  | Extract<NomDeVerbeDeJet | keyof VerbeDeReglage, `jet${Capitalize<ActionDeJet>}${string}`>
  | `fenetre${Capitalize<ActionDeFenetre>}`;

/** Les actions propres à la machinerie (#3605) : une écriture du noyau se nomme dans le lexique des verbes ou par l'une
 *  d'elles, chacune l'action d'un membre de `MachinerieDuNoyau`. Un verbe ne les prend pas. */
type ActionDeLaMachinerie = ActionDuLexique | 'accorder' | 'ajouter' | 'amorcer' | 'apprendre' | 'charger' | 'declencher'
  | 'denouer' | 'enfoncer' | 'ensemencer' | 'forger' | 'frapper' | 'interagir' | 'offrir' | 'orienter' | 'reposer' | 'sauter' | 'tirer'
  | 'virer';

/** Un nom formé sur les actions `A` : `<action>` ou `<action><Complément>`. */
type NomDAction<A extends string> = A | `${A}${Majuscule}${string}`;
/** Un nom formé sur les actions `A`, ou sa forme pronominale (`seRelever`), avec ou sans complément. */
type NomPronominal<A extends string> = NomDAction<A> | `se${Capitalize<NomDAction<A>>}`;
/** Les noms de la machinerie. */
type NomDeMachinerie = NomPronominal<ActionDeLaMachinerie>;

/** `true` si et seulement si chaque nom de `Noms` est de `Lexique` ; sinon, les noms en faute. */
type Verrou<Noms extends string, Lexique extends string> = [Exclude<Noms, Lexique>] extends [never] ? true : { horsLexique: Exclude<Noms, Lexique> };
/** `true` si et seulement si `Noms` est du lexique des verbes ; sinon, les noms en faute. */
export type VerrouDuLexique<Noms extends string> = Verrou<Noms, NomDeVerbe>;
/** `true` si et seulement si `Noms` est du lexique de la machinerie ; sinon, les noms en faute. */
export type VerrouDeLaMachinerie<Noms extends string> = Verrou<Noms, NomDeMachinerie>;
/** `true` si et seulement si chaque mot de `S` (`Mots`), hors les nombres, est du lexique ; sinon, les mots en faute : le
 *  verrou d'un domaine hors du noyau (les ids de raccourci et leurs rangs, `src/state/clavier/keybindings.ts`). */
export type VerrouDesMots<S extends string> = Verrou<Exclude<Mots<S>, `${number}`>, MotDuLexique>;
/** Les mots d'un id d'un domaine de verbe (littéral, axe), d'un id d'offre et d'un littéral de paramètre de verbe (lu par
 *  `partieLue`, scripts/docs/lib/verbesDeLaPartie.mjs) : les actions du lexique, et les mots que ses domaines nomment
 *  (#3614), et ceux des littéraux du noyau, du moteur, des ids de raccourci et des clés `codex.op.*` (#3924, #3928, #3938). */
type MotDuLexique = ActionDuLexique | ActionDeLaMachinerie | ActionDeFenetre | ActionDeJet
  | 'a' | 'abandon' | 'abandonner' | 'abregee' | 'abri' | 'absent' | 'accepter' | 'achat' | 'acheteur' | 'acquise'
  | 'acteur' | 'action' | 'active' | 'activite' | 'activites' | 'adapte' | 'adversaire' | 'adversaires' | 'adverse' | 'affaler' | 'aggrave' | 'agir'
  | 'aide' | 'alea' | 'aleatoire' | 'allie' | 'allies' | 'alors' | 'ambition' | 'amis' | 'amputer' | 'aneantissement' | 'animosite'
  | 'anneau' | 'annulation' | 'apercu' | 'approche' | 'apres' | 'architecture' | 'arete' | 'argent' | 'arme' | 'armee' | 'armes' | 'armure' | 'arriere'
  | 'aspersion' | 'asphyxie' | 'attaquant' | 'attaque' | 'attaques' | 'atteints' | 'attenuation' | 'attenue' | 'attribut' | 'au' | 'auberge' | 'aucun' | 'aucune' | 'aucun' | 'aucune'
  | 'augmentee' | 'auto' | 'autour' | 'avant' | 'avantage' | 'b' | 'baisser' | 'balayage' | 'bandages' | 'bande' | 'bannissement' | 'bas'
  | 'bataille' | 'battement' | 'batterie' | 'benediction' | 'bilan' | 'blessures' | 'bloque' | 'bois' | 'boisson'
  | 'bonus' | 'bord' | 'bordee' | 'bouclier' | 'bourse' | 'bras' | 'breche' | 'brisee' | 'briser' | 'butin' | 'cacher'
  | 'cadre' | 'camera' | 'camp' | 'campagne' | 'camps' | 'canons' | 'capacite' | 'car' | 'caracteristique' | 'cargaison'
  | 'carriere' | 'carte' | 'cascade' | 'cases' | 'casse' | 'categorie' | 'cauchemar' | 'caudale' | 'chaine' | 'chanson'
  | 'chapitre' | 'charge' | 'chavirage' | 'chef' | 'chemin' | 'chercher' | 'chirurgie' | 'choisie' | 'choix' | 'chute'
  | 'cible' | 'cibles' | 'cle' | 'clore' | 'close' | 'codex' | 'colere' | 'coller' | 'collision' | 'combat' | 'commandant' | 'commande'
  | 'commandes' | 'commission' | 'commune' | 'competence' | 'complet' | 'concernes' | 'condition' | 'confirmer' | 'conjuree'
  | 'connecte' | 'connexion' | 'connu' | 'conseil' | 'constructeur' | 'contact' | 'contagion' | 'contamine' | 'contour'
  | 'contractee' | 'contre' | 'controle' | 'convalescence' | 'copier' | 'corde' | 'cornes' | 'corps' | 'correct'
  | 'corruption' | 'couchage' | 'coucher' | 'coup' | 'coups' | 'course' | 'courte' | 'cout' | 'creature' | 'crenelage' | 'critique'
  | 'critiques' | 'cumuls' | 'curseur' | 'd' | 'dans' | 'de' | 'debout' | 'debris' | 'debut' | 'decaler' | 'declaration'
  | 'declenche' | 'decor' | 'defaite' | 'defense' | 'defenseur' | 'defensive' | 'definition' | 'degagement' | 'degats' | 'degrade' | 'dehors'
  | 'deja' | 'delestage' | 'demande' | 'depart' | 'depecer' | 'depense' | 'deplacement' | 'depot' | 'derive' | 'des'
  | 'desarmement' | 'desengagement' | 'desertion' | 'designation' | 'dessoulage' | 'destin' | 'detail' | 'detection'
  | 'determination' | 'deux' | 'deviation' | 'dexterite' | 'dialogue' | 'dieux' | 'differe' | 'direction' | 'discret'
  | 'dissipation' | 'distance' | 'distraire' | 'divin' | 'divinite' | 'document' | 'dome' | 'double' | 'droite' | 'du' | 'dupliquer'
  | 'duree' | 'eau' | 'echap' | 'echec' | 'echelle' | 'echouage' | 'ecran' | 'editeur' | 'effacement' | 'effet'
  | 'egalite' | 'eligible' | 'eloigne' | 'embuscade' | 'empetrer' | 'emplacement' | 'empoignade' | 'empoigne' | 'empoigner' | 'en' | 'encaisse'
  | 'encombrement' | 'endommage' | 'endommagee' | 'engage' | 'engages' | 'ennemi' | 'ennemis' | 'ensanglantee' | 'entite' | 'entrainement' | 'entree'
  | 'entretien' | 'epargne' | 'epuise' | 'epuisement' | 'equipage' | 'equipe' | 'equipement' | 'escale' | 'escalier' | 'espace'
  | 'esquive' | 'et' | 'etal' | 'etape' | 'etapes' | 'etat' | 'etendu' | 'etreinte' | 'evaluation' | 'evenement'
  | 'eviter' | 'exact' | 'exclusion' | 'exploration' | 'expose' | 'exposition' | 'extermination' | 'f' | 'facade' | 'facteur' | 'facultatifs'
  | 'faim' | 'fatigue' | 'fer' | 'feu' | 'file' | 'fin' | 'fini' | 'fixe' | 'fleches' | 'fleuve' | 'flux' | 'focalisation' | 'force'
  | 'forcee' | 'forcer' | 'forme' | 'fortune' | 'fouille' | 'foule' | 'fracture' | 'frappe' | 'frenesie' | 'fuir'
  | 'fuite' | 'fumee' | 'g' | 'gagne' | 'gain' | 'galop' | 'gangrene' | 'gatees' | 'gauche' | 'generique' | 'gomme' | 'gratuite'
  | 'greement' | 'groupe' | 'guerison' | 'gueule' | 'hasard' | 'haut' | 'hauteur' | 'hemorragie' | 'heros' | 'hors' | 'hostile' | 'hote'
  | 'hurlement' | 'hydrique' | 'ignorer' | 'illimite' | 'immobile' | 'immuniser' | 'imparfaite' | 'imposee'
  | 'incantation' | 'inconscient' | 'ineluctable' | 'infection' | 'infestation' | 'infirmerie' | 'information'
  | 'inspecter' | 'instance' | 'intention' | 'interaction' | 'interdit' | 'interlude' | 'interrompue' | 'inverse'
  | 'inversion' | 'investir' | 'invite' | 'invocation' | 'iso' | 'issue' | 'ivresse' | 'jambe' | 'jet' | 'jeter'
  | 'jeton' | 'jets' | 'jeu' | 'jeux' | 'joueur' | 'jour' | 'journal' | 'jours' | 'l' | 'la' | 'lame' | 'lanceur'
  | 'langue' | 'le' | 'les' | 'liberation' | 'liberer' | 'lieu' | 'ligne' | 'local' | 'localisation' | 'longue' | 'lot'
  | 'lumiere' | 'm' | 'magie' | 'magique' | 'main' | 'mains' | 'maison' | 'maj' | 'majeure' | 'mal' | 'maladie'
  | 'maladresse' | 'malus' | 'manann' | 'manche' | 'manches' | 'manoeuvre' | 'marchand' | 'marchandage' | 'marche' | 'marin' | 'martyr'
  | 'masse' | 'max' | 'mecenat' | 'medicale' | 'melee' | 'membre' | 'menu' | 'mer' | 'mes' | 'metal' | 'meteo' | 'mineure' | 'mise'
  | 'mode' | 'modificateur' | 'moitie' | 'monde' | 'monture' | 'moral' | 'morsure' | 'mort' | 'mortelle' | 'mot'
  | 'motivation' | 'mouvement' | 'munition' | 'mur' | 'mutation' | 'narratif' | 'natation' | 'nature' | 'naturelle' | 'naufrage'
  | 'navigation' | 'navire' | 'negatifs' | 'neutre' | 'nocturne' | 'nombre' | 'non' | 'normal' | 'objet' | 'obstacle'
  | 'octroi' | 'offre' | 'op' | 'operations' | 'oppose' | 'opposition' | 'option' | 'options' | 'or' | 'orientation' | 'oter' | 'oui' | 'ouverture'
  | 'ouvrage' | 'p' | 'pa' | 'paie' | 'panier' | 'panoplie' | 'panoramique' | 'par' | 'parade' | 'parametres' | 'pas' | 'passer'
  | 'patient' | 'pause' | 'pave' | 'payer' | 'peche' | 'pendant' | 'penurie' | 'perce' | 'perception' | 'perd' | 'perdants' | 'perdu'
  | 'perdue' | 'perdus' | 'peril' | 'permanente' | 'persistance' | 'persistante' | 'personne' | 'personnelle' | 'perte'
  | 'peur' | 'phare' | 'phase' | 'physique' | 'piece' | 'pied' | 'piege' | 'pietinement' | 'pirates' | 'pires' | 'pitance'
  | 'pivot' | 'place' | 'plaie' | 'plancher' | 'planque' | 'plateau' | 'plein' | 'pnj' | 'polymorphie' | 'port'
  | 'porte' | 'portee' | 'porteur' | 'porteurs' | 'pose' | 'possession' | 'possible' | 'poste' | 'posture' | 'pot' | 'pourcentage' | 'poursuite'
  | 'poursuivre' | 'poussee' | 'pratiquer' | 'precedente' | 'present' | 'prevention' | 'priere' | 'privee' | 'prix'
  | 'production' | 'profil' | 'progression' | 'prolonge' | 'promouvoir' | 'protecteur' | 'protection' | 'provisions'
  | 'psychologie' | 'psychologique' | 'puissance' | 'qualite' | 'quantite' | 'quotidien' | 'r' | 'raccourci' | 'ragot'
  | 'rallier' | 'ramassage' | 'rangees' | 'rapide' | 'rate' | 'ration' | 'rations' | 'reaction' | 'reapparition'
  | 'reassigne' | 'recentrer' | 'recevoir' | 'rechargement' | 'recit' | 'reconnexion' | 'recu' | 'recuperation'
  | 'redressement' | 'reduction' | 'reduit' | 'reeducation' | 'refus' | 'refuser' | 'refute' | 'regard' | 'regle' | 'relache'
  | 'relance' | 'relevement' | 'remise' | 'rencontre' | 'renier' | 'renoncement' | 'reparation' | 'repartition'
  | 'repas' | 'repli' | 'reponse' | 'repos' | 'repousse' | 'repousser' | 'requise' | 'resistance' | 'resoudre'
  | 'ressource' | 'resultat' | 'retablir' | 'retenir' | 'retour' | 'retrait' | 'reussie' | 'reussite' | 'revele' | 'reveler'
  | 'rien' | 'riposte' | 'role' | 'roulade' | 'round' | 'rumeur' | 'rythme' | 'sacrifier' | 'salissures' | 'sans'
  | 'saturation' | 'sauvegarde' | 'scene' | 'scorbut' | 'seance' | 'secondaire' | 'seconde' | 'section' | 'selecteur' | 'selection'
  | 'selle' | 'sequence' | 'service' | 'ses' | 'seuil' | 'si' | 'siege' | 'simple' | 'sinon' | 'social' | 'soi' | 'soif' | 'soin'
  | 'soins' | 'sol' | 'solde' | 'solo' | 'sommation' | 'sort' | 'sortie' | 'sorts' | 'souffle' | 'source' | 'sous' | 'soutenu'
  | 'spirituelle' | 'statut' | 'stock' | 'stupefiant' | 'subi' | 'subie' | 'subies' | 'subit' | 'subjectif' | 'suite' | 'suivante' | 'supplement'
  | 'supplementaires' | 'suppression' | 'sur' | 'surincantation' | 'surplus' | 'survie' | 'survitesse' | 'survivre'
  | 'suspendre' | 'symptome' | 'systeme' | 'table' | 'tableau' | 'talent' | 'talents' | 'tapi' | 'tas' | 'taverne' | 'teleportation'
  | 'temporaire' | 'tentacules' | 'terrain' | 'terre' | 'terreur' | 'test' | 'testeur' | 'tete' | 'tir' | 'tirage' | 'tire' | 'toit'
  | 'tonneau' | 'touche' | 'tour' | 'tourbillon' | 'tous' | 'tout' | 'toutes' | 'trait' | 'transformation' | 'traumatisme'
  | 'tribut' | 'troc' | 'troquer' | 'trot' | 'un' | 'une' | 'unique' | 'usage' | 'utile' | 'vainqueurs' | 'validation' | 'vapeur' | 'variable' | 'vdm' | 'vendre'
  | 'vent' | 'vente' | 'victime' | 'victoire' | 'vider' | 'vie' | 'vin' | 'virage' | 'virement' | 'visee' | 'viser' | 'vol'
  | 'volontaire' | 'volontaires' | 'vomi' | 'voyage' | 'vue' | 'zero' | 'zone';
/** Une clé de libellé, ses segments joints par des tirets. */
export type Segments<S extends string> = S extends `${infer A}.${infer B}` ? `${A}-${Segments<B>}` : S;
/** Les clés de chaque membre de l'union `U`. */
type ClesDeLUnion<U> = U extends unknown ? keyof U & string : never;
/** Les mots de `S`, coupé à chaque tiret et avant chaque majuscule, en minuscules (`traitPsychologique` : `trait`,
 *  `psychologique`). */
type Mots<S extends string, Cur extends string = ''> = S extends `${infer C}${infer R}`
  ? C extends '-' ? (Cur extends '' ? never : Cur) | Mots<R, ''>
    : C extends Majuscule ? (Cur extends '' ? never : Cur) | Mots<R, Lowercase<C>>
      : Mots<R, `${Cur}${C}`>
  : Cur extends '' ? never : Cur;
/** VERROU : tout verbe du noyau se nomme dans le lexique des verbes, toute machinerie dans le sien ; chaque domaine de
 *  verbe vidé de ses mots étrangers, et chaque id d'offre (`actions.json`), ne prend que des mots du lexique (#3614). */
const verrousDuLexique: [
  VerrouDuLexique<keyof ActionsDuNoyau>,
  VerrouDeLaMachinerie<keyof MachinerieDuNoyau>,
  Verrou<Mots<PasRelatif>, MotDuLexique>,
  Verrou<Mots<ChoixDesFenetres['destin']['issue']>, MotDuLexique>,
  Verrou<Mots<TavernOpponent['kind']>, MotDuLexique>,
  Verrou<Mots<AxeDuChoix>, MotDuLexique>,
  Verrou<Mots<ModeDeMarche>, MotDuLexique>,
  Verrou<Mots<CharMode>, MotDuLexique>,
  Verrou<Mots<VoyageCadence>, MotDuLexique>,
  Verrou<Mots<ModeDEvaluation>, MotDuLexique>,
  Verrou<Mots<CounterDeclaration>, MotDuLexique>,
  Verrou<Mots<HealMode>, MotDuLexique>,
  Verrou<Mots<GenreDeDepot>, MotDuLexique>,
  Verrou<Mots<Main>, MotDuLexique>,
  Verrou<Mots<ReactionDeBouclier>, MotDuLexique>,
  Verrou<Mots<IssueDEmpoignade>, MotDuLexique>,
  Verrou<Mots<ShootingStanceKey>, MotDuLexique>,
  Verrou<Mots<BattleActionMode>, MotDuLexique>,
  Verrou<Mots<NonNullable<BattleState['over']>>, MotDuLexique>,
  Verrou<Mots<CleDeRegistre>, MotDuLexique>,
  Verrou<Mots<ClueState['statut']>, MotDuLexique>,
  Verrou<Mots<FlowKey>, MotDuLexique>,
  Verrou<Mots<RollVerb>, MotDuLexique>,
  Verrou<Mots<HostJet>, MotDuLexique>,
  Verrou<Mots<IdsParEspace['actions.json']>, MotDuLexique>,
  Verrou<Mots<ReturnType<typeof bankWithdrawOutcome>>, MotDuLexique>,
  Verrou<Mots<GenreDeFlottant>, MotDuLexique>,
  Verrou<Mots<CargoRaidOutcome>, MotDuLexique>,
  Verrou<Mots<NonNullable<PendingAppraise['gear']>['scope']>, MotDuLexique>,
  Verrou<Mots<RiverPerilKind>, MotDuLexique>,
  Verrou<Mots<TargetingMode['id']>, MotDuLexique>,
  Verrou<Mots<NetState['connection']>, MotDuLexique>,
  Verrou<Mots<NonNullable<Parameters<typeof massBattleResumeCombat>[3]>>, MotDuLexique>,
  Verrou<Mots<NonNullable<SeaVoyageState['paceToday']>>, MotDuLexique>,
  Verrou<Mots<CombatEventKind>, MotDuLexique>,
  Verrou<Mots<NonNullable<FenetreDAttaque['issue']>['genre']>, MotDuLexique>,
  Verrou<Mots<NonNullable<FenetreDeDefense['issue']>['genre']>, MotDuLexique>,
  Verrou<Mots<RoleDAnimation>, MotDuLexique>,
  Verrou<Mots<GenreDeCascade>, MotDuLexique>,
  Verrou<Mots<RevealEntry['kind']>, MotDuLexique>,
  Verrou<Mots<ActorAimKind>, MotDuLexique>,
  Verrou<Mots<EnemyAction['kind']>, MotDuLexique>,
  Verrou<Mots<NetState['mode'] | NetState['presence'][number]>, MotDuLexique>,
  Verrou<Mots<Extract<EnemyAction, { kind: 'empoignade' }>['resolution']>, MotDuLexique>,
  Verrou<Mots<Extract<EnemyAction, { kind: 'depenseDeRessource' }>['resource' | 'via']>, MotDuLexique>,
  Verrou<Mots<IssueOpposee>, MotDuLexique>,
  Verrou<Mots<ZoneEnPose['source']>, MotDuLexique>,
  Verrou<Mots<VerdictApprentissage>, MotDuLexique>,
  Verrou<Mots<OrientationOutcome>, MotDuLexique>,
  Verrou<Mots<SellRelation>, MotDuLexique>,
  Verrou<Mots<VainqueurOppose>, MotDuLexique>,
  Verrou<Mots<RecapTone>, MotDuLexique>,
  Verrou<Mots<MovementResolution['status'] | Extract<MovementResolution, { status: 'possible' }>['kind'] | Extract<MovementResolution, { status: 'bloque' }>['reason']>, MotDuLexique>,
  Verrou<Mots<AttackPlan['kind'] | NonNullable<BattleState['preview']>['kind']>, MotDuLexique>,
  Verrou<Mots<NonNullable<Extract<Effect, { type: 'castSpell' }>['mode']>>, MotDuLexique>,
  Verrou<Mots<Equipe | BattleOutcome | Station['faction']>, MotDuLexique>,
  Verrou<Mots<Flow['kind'] | Exclude<ClesDeLUnion<Flow>, 'kind' | 'icon'>>, MotDuLexique>, // #3977
  Verrou<Mots<keyof NonNullable<RollFlowSpec<PendingBase>['caps']>>, MotDuLexique>,
  Verrou<Mots<Segments<Extract<MsgKey, `codex.op.${string}`>>>, MotDuLexique>,
  Verrou<Mots<VainqueurDeTaverne>, MotDuLexique>,
  Verrou<Mots<EffectSourceKind>, MotDuLexique>,
  Verrou<Mots<Extract<GameOp, { op: 'weaponRollMod' }>['phase']>, MotDuLexique>,
  Verrou<Mots<NonNullable<Parameters<typeof statusIncome>[3]>>, MotDuLexique>,
  Verrou<Mots<NonNullable<TavernGame['mode']> | NonNullable<ReturnType<typeof psychResolution>['mode']>>, MotDuLexique>,
  Verrou<Mots<ReturnType<typeof weaponGroupSkillMode> | ChargeDAttaque['defense']>, MotDuLexique>,
  Verrou<Mots<Weapon['type'] | TypeDAttaque | NonNullable<GroupeDArme['combat']>>, MotDuLexique>,
  Verrou<Mots<Exclude<ItemKind, 'armor' | 'ammo' | 'misc'> | Exclude<TrappingTypeId, 'ammunition' | 'armor' | 'trapping'> | Exclude<PorteeDAssaut, 'all'>>, MotDuLexique>, // #3977
  Verrou<Mots<Combatant['kind'] | Camp | Relation | SpellAffinity>, MotDuLexique>,
  Verrou<Mots<NonNullable<PursuitPayload['pris']>['laggard']['side'] | NonNullable<EncounterDef['surprise']>>, MotDuLexique>,
  Verrou<Mots<Parameters<typeof weaponUsesHand>[1]>, MotDuLexique>,
  Verrou<Mots<CibleDEffetDeScene | (typeof effectTargetSchema)['options'][number] | Carrier['kind'] | EnchainementDuCoup['mode'] | SeatOccupant['kind']>, MotDuLexique>, // #3977
  Verrou<Mots<AdvantageCamp | NonNullable<NonNullable<TraitData['aura']>['affects']> | Extract<EffectTargeting, string> | Extract<EffectTargeting, { near: string }>['near']
    | Extract<EffectTargeting, { pick: string }>['pick'] | NonNullable<Extract<EffectTargeting, { pick: string }>['sizeAtMost']>>, MotDuLexique>, // #3977
  Verrou<Mots<NonNullable<ManeuverDef['modeDAvantage']> | ManeuverDef['ciblage']>, MotDuLexique>, // #3977
  Verrou<Mots<NonNullable<SkillData['combatSubstitute']>['role'] | NonNullable<SkillData['combatSubstitute']>['gate']>, MotDuLexique>, // #3977
  Verrou<Mots<PendingDisengage['phase'] | PendingAuContact['phase'] | PendingGrapple['phase'] | ReturnType<typeof phaseDeChute>>, MotDuLexique>, // #3977
  Verrou<Mots<Tool['mode'] | OutilDeLEditeur['mode'] | ActionDArchitecture | NonNullable<ContexteDuPointeur['architecture']>['action']>, MotDuLexique>, // #3977
  Verrou<Mots<RouteObjet['mode'] | EntrainementOption['kind'] | Parameters<typeof advanceCost>[1]>, MotDuLexique>, // #3977
  Verrou<Mots<keyof SequenceState | Exclude<ClesDeLUnion<SequenceVerdict<unknown>>, 'log'> | SequenceVerdict<unknown>['suite'] | keyof SequenceRoundActors
    | Exclude<keyof SequenceCloseCtx<unknown>, 'get' | 'seq' | 'rng'> | keyof SequenceDef | Exclude<keyof SequenceBoard, 'title' | 'unit'> | Exclude<keyof SequenceAbandon, 'label' | 'title'>
    | keyof ReturnType<typeof sequenceCumulsDeLaManche>>, MotDuLexique>, // #3977
] = [true, true, true, true, true, true, true, true, true, true, true, true, true, true, true, true, true, true, true, true, true, true, true, true, true, true, true, true, true, true, true, true, true, true, true, true, true, true, true, true, true, true, true, true, true, true, true, true, true, true, true, true, true, true, true, true, true, true, true, true, true, true, true, true, true, true, true, true, true, true, true, true, true, true, true, true, true, true];
void verrousDuLexique;

/** Le corps de la clôture de chaque flux, que seul `jetValider(flux)` appelle : un flux sans clôture ne compile pas. */
function cloturesDuJet(get: Get, set: SetDesClesReservees): CloturesDuJet {
  return {
    ...cloturesDuCombat(get, set),
    ...cloturesDeCorruption(get, set),
    ...cloturesDuLotDEtal(get, set),
    ...cloturesDeFranchissement(get, set),
    ...cloturesDInterlude(get, set),
    ...cloturesDuMedecin(get, set),
    ...cloturesDuMarchand(get, set),
    ...cloturesDesTestsDeScene(get, set),
  } satisfies CloturesDuJet;
}

/** Le corps de chaque réglage d'un jet, que seul `jetRegler(flux, reglage, …)` appelle : un réglage déclaré
 *  (`ReglagesDuJet`) sans corps ne compile pas. */
function reglagesDuJet(get: Get, set: SetDesClesReservees): CorpsDesReglages {
  return {
    ...reglagesDuCombat(get, set),
    ...reglagesDeFranchissement(get, set),
    ...reglagesDeCorruption(get, set),
    ...reglagesDesTestsDeScene(get, set),
  } satisfies CorpsDesReglages;
}

/** Le corps de chaque choix d'une fenêtre, que seul `fenetreChoisir(fenetre, axe, …)` appelle : un choix déclaré
 *  (`ChoixDesFenetres`) sans corps ne compile pas. */
function choixDesFenetres(get: Get, set: SetDesClesReservees): CorpsDesChoix {
  return {
    ...choixDuCombat(get, set),
    ...choixDeCorruption(get, set),
    ...choixDuMedecin(get, set),
    ...choixDeConversation(get, set),
    ...choixDeCampagne(get, set),
    ...choixDeLEquipage(get, set),
    ...choixDuVoyageEnMer(get, set),
    ...choixDeLaSemaineEnMer(get, set),
    ...choixDeLaFinDeSeance(get, set),
    ...choixDuMarchand(get, set),
    ...choixDuButin(get, set),
    ...choixDuRepos(get, set),
    ...choixDInterlude(get, set),
    ...choixDeLaBataille(get, set),
    ...choixDesMarches(get, set),
    ...choixDuLieu(get, set),
  } satisfies CorpsDesChoix;
}

/** Le corps de la sortie de chaque fenêtre qui se ferme, que seul `fenetreFermer` appelle : une fenêtre qui déclare sa
 *  `sortie` sans corps ne compile pas. */
function sortiesDeFenetre(get: Get, set: SetDesClesReservees): SortiesDeFenetre {
  return {
    ...sortiesDuCombat(get, set),
    ...sortiesDuChapitre(get, set),
    ...sortiesDeCampagne(get, set),
    ...sortiesDeBatailleDeMasse(get, set),
    ...sortiesDuGroupe(get, set),
    ...sortiesDuMarchand(get, set),
    ...sortiesDeLaTaverne(get, set),
    ...sortiesDIssueDeCombat(get, set),
    ...sortiesDuMedecin(get, set),
    ...sortiesDuRepos(get, set),
    ...sortiesDeLEquipage(get, set),
    ...sortiesDuVoyage(get, set),
    ...sortiesDuLieu(get, set),
    ...sortiesDuPort(get, set),
    ...sortiesDuMarcheTerrestre(get, set),
  } satisfies SortiesDeFenetre;
}

/** Le corps de la validation de chaque fenêtre qui se valide, que seul `fenetreValider` appelle : une fenêtre qui déclare
 *  sa `validation` sans corps ne compile pas. */
function validationsDeFenetre(get: Get, set: SetDesClesReservees): ValidationsDeFenetre {
  return {
    ...validationsDuCombat(get, set),
    ...validationsDuChapitre(get, set),
    ...validationsDInterlude(get, set),
    ...validationsDuMarchand(get, set),
    ...validationsDuRepos(get, set),
    ...validationsDuVoyage(get, set),
    ...validationsDeLaSemaineEnMer(get, set),
    ...validationsDuGroupe(get, set),
    ...validationsDeBatailleDeMasse(get, set),
  } satisfies ValidationsDeFenetre;
}

/** Les actions du noyau sur le propriétaire `get`/`set` (le `set` brut, qui écrit aussi les clés
 *  réservées de leurs seuls écrivains), une fabrique par concept. */
export function creerActionsDuNoyau(get: Get<JeuDuNoyau>, set: SetDesClesReservees): ActionsDuNoyau & MachinerieDuNoyau {
  const combat = createCombatSlice(get, set);
  return {
    // Les verbes de jet, le flux en argument : leur SEUL écrivain.
    ...creerVerbesDeJet(get, set, cloturesDuJet(get, set)),
    // Le réglage d'un jet, le flux et le réglage en arguments : son SEUL écrivain.
    ...creerReglageDuJet(get, set, reglagesDuJet(get, set)),
    // Le choix d'une fenêtre, la fenêtre et l'axe en arguments : son SEUL écrivain.
    ...creerChoixDeFenetre(get, set, choixDesFenetres(get, set)),
    // La sortie d'une fenêtre, la fenêtre en argument : son SEUL écrivain.
    ...creerSortieDeFenetre(get, set, sortiesDeFenetre(get, set)),
    // La validation d'une fenêtre, la fenêtre en argument : son SEUL écrivain.
    ...creerValidationDeFenetre(get, set, validationsDeFenetre(get, set)),
    ...combat,
    // Les verbes de la barre, chacun jugé par l'offre qui le déclare, puis joué par son corps du combat.
    ...creerVerbesDeLaBarre(get, set, combat),
    ...creerActionsDOrientation(get, set),
    ...creerActionsDeManoeuvre(get, set),
    ...creerActionsDeCampagne(get, set),
    ...creerActionsDEntreeEnScene(get, set),
    ...creerActionsDInterlude(get, set),
    ...creerActionsDeBatailleDeMasse(get, set),
    ...creerActionsDesFaveurs(get, set),
    ...creerActionsDuGroupe(get, set),
    ...creerActionsDesPossessions(get, set),
    ...creerActionsDeMarche(get, set),
    ...creerActionsDeFranchissement(get, set),
    ...creerActionsDInteraction(get, set),
    ...creerActionsDuMarchand(get, set),
    ...creerActionsDeTaverne(get, set),
    ...creerActionsDesDes(get, set),
    ...creerActionsDIssueDeCombat(get, set),
    ...creerActionsDuMedecin(get, set),
    ...creerActionsDuRepos(get, set),
    ...creerActionsDeLEquipage(get, set),
    ...creerActionsDesTestsDeScene(get, set),
    ...creerActionsDuJournal(get, set),
    ...creerActionsDuReseau(get, set),
    ...creerActionsDAvanceeDHorloge(get, set),
    ...creerFabriqueDIds(get, set),
    ...creerActionsDHorloge(get, set),
    ...creerActionsDuVoyage(get, set),
    ...creerActionsDuLieu(get, set),
    ...creerActionsDesPostesDeVoyage(get, set),
    ...creerActionsDuBillet(get, set),
    ...creerActionsDuPort(get, set),
    ...creerActionsDuVoyageEnMer(get, set),
    ...creerActionsDuMarcheTerrestre(get, set),
    ...creerActionsDeLAuberge(get, set),
  };
}
