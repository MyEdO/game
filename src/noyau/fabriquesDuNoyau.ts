/**
 * Les actions du noyau (#2817 D5, D9) : la composition UNIQUE des fabriques `(get, set) => actions`, que
 * lisent chaque propriétaire de l'état, le store web (`src/state/store.ts`) comme la partie
 * (`partie.ts`). Une fabrique ajoutée ici sert les deux.
 */
import type { ActionsDuNoyau, PasRelatif } from './actionsDuNoyau';
import type { JeuDuNoyau, MachinerieDuNoyau } from './machinerieDuNoyau';
import type { Get, SetDesClesReservees } from './flowTypes';
import { creerReglageDuJet, creerVerbesDeJet, type CloturesDuJet } from './rollFlowSpecs';
import type { CorpsDesReglages, VerbeDeReglage } from './reglagesDuJet';
import type { ActionDeJet, FlowKey, NomDeVerbeDeJet } from './flowVerbs';
import type { Majuscule } from './intentionsDeSiege';
import type { IdsParEspace } from '../data/schemas/_ids.generated';
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
import type { CounterDeclaration, IssueDEmpoignade, PendingAppraise, ReactionDeBouclier } from './pendings';
import type { VoyageCadence } from './voyageCadence';
import type { CharMode } from './creation/brouillon';
import type { HealMode } from '../engine/healing';
import type { bankWithdrawOutcome, GenreDeDepot } from '../engine/activities';
import type { CargoRaidOutcome } from '../engine/cargo';
import type { RiverPerilKind } from '../engine/riverNavigation';
import type { GenreDeFlottant } from './effetsDeLAppel';
import type { TargetingMode } from './targetingModes';
import type { Main } from '../engine/types';
import type { CleDeRegistre } from './modalArbiter';
import type { HostJet } from './slotsDeJet';
import type { ClueState } from './monde/clues';
import type { CombatEventKind } from './combatLog';
import type { FenetreDAttaque } from './fenetreDAttaque';
import type { FenetreDeDefense } from './fenetreDeDefense';
import type { RoleDAnimation } from './animation';

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
 *  (#3614), et ceux des littéraux du noyau, du moteur et des ids de raccourci (#3924, #3928). */
type MotDuLexique = ActionDuLexique | ActionDeLaMachinerie | ActionDeFenetre
  | 'a' | 'abandon' | 'accepter' | 'achat' | 'activite' | 'activites' | 'adversaire' | 'alea' | 'ambition'
  | 'aneantissement' | 'annulation' | 'apercu' | 'approche' | 'arme' | 'armes' | 'arriere' | 'aspersion' | 'attaque'
  | 'au' | 'avant' | 'avantage' | 'baisser' | 'balayage' | 'bandages' | 'bande' | 'bas' | 'bataille' | 'battement'
  | 'batterie' | 'benediction' | 'blessures' | 'bord' | 'bordee' | 'bouclier' | 'bras' | 'briser' | 'butin' | 'cacher'
  | 'camera' | 'campagne' | 'capacite' | 'carte' | 'cascade' | 'caudale' | 'chanson' | 'chapitre' | 'charge'
  | 'chercher' | 'chirurgie' | 'choix' | 'chute' | 'cible' | 'cibles' | 'coller' | 'combat' | 'commande' | 'commandes'
  | 'commune' | 'conjuree' | 'connecte' | 'connexion' | 'conseil' | 'contact' | 'contre' | 'copier' | 'corde' | 'cornes'
  | 'corps' | 'corruption' | 'couchage' | 'coup' | 'coups' | 'course' | 'courte' | 'critique' | 'critiques' | 'curseur'
  | 'd' | 'dans' | 'de' | 'debout' | 'debut' | 'decaler' | 'declaration' | 'decor' | 'defaite' | 'defense' | 'defensive'
  | 'degats' | 'dehors' | 'depart' | 'depecer' | 'deplacement' | 'depot' | 'desengagement' | 'designation' | 'destin'
  | 'detail' | 'detection' | 'determination' | 'deux' | 'dexterite' | 'dialogue' | 'direction' | 'discret'
  | 'dissipation' | 'distraire' | 'document' | 'droite' | 'du' | 'dupliquer' | 'duree' | 'echap' | 'echec' | 'ecran'
  | 'editeur' | 'effet' | 'empetrer' | 'empoignade' | 'empoigner' | 'en' | 'encaisse' | 'encombrement' | 'ensanglantee'
  | 'entrainement' | 'entree' | 'equipe' | 'espace' | 'esquive' | 'etal' | 'etat' | 'etendu' | 'etreinte' | 'evaluation'
  | 'eviter' | 'exploration' | 'f' | 'file' | 'fin' | 'focalisation' | 'forme' | 'frappe' | 'frenesie' | 'fuir'
  | 'fuite' | 'g' | 'galop' | 'gauche' | 'guerison' | 'haut' | 'hemorragie' | 'heros' | 'hors' | 'hurlement' | 'ignorer'
  | 'immobile' | 'immuniser' | 'incantation' | 'ineluctable' | 'infirmerie' | 'information' | 'inspecter' | 'intention'
  | 'interaction' | 'interlude' | 'investir' | 'issue' | 'jambe' | 'jeter' | 'jets' | 'jeux' | 'jour' | 'journal' | 'la'
  | 'langue' | 'le' | 'les' | 'liberation' | 'liberer' | 'lieu' | 'ligne' | 'localisation' | 'longue' | 'lot' | 'm'
  | 'main' | 'maison' | 'maj' | 'maladresse' | 'manoeuvre' | 'marchand' | 'marchandage' | 'marche' | 'marin' | 'masse'
  | 'mecenat' | 'melee' | 'menu' | 'mer' | 'mise' | 'mode' | 'monde' | 'monture' | 'morsure' | 'mort' | 'mortelle'
  | 'motivation' | 'mouvement' | 'munition' | 'nature' | 'navigation' | 'navire' | 'normal' | 'objet' | 'obstacle'
  | 'offre' | 'opposition' | 'oter' | 'ouverture' | 'ouvrage' | 'paie' | 'panier' | 'panoplie' | 'panoramique' | 'par'
  | 'parade' | 'pas' | 'passer' | 'patient' | 'pause' | 'pave' | 'payer' | 'perception' | 'perdu' | 'personnelle'
  | 'peur' | 'physique' | 'piece' | 'pied' | 'pietinement' | 'pitance' | 'pivot' | 'place' | 'plaie' | 'planque'
  | 'plein' | 'pnj' | 'port' | 'porte' | 'portee' | 'porteur' | 'pose' | 'poste' | 'posture' | 'poussee' | 'pratiquer'
  | 'precedente' | 'priere' | 'privee' | 'prix' | 'profil' | 'promouvoir' | 'protection' | 'psychologie'
  | 'psychologique' | 'puissance' | 'qualite' | 'quantite' | 'raccourci' | 'rallier' | 'ramassage' | 'rapide' | 'rate'
  | 'ration' | 'reaction' | 'reassigne' | 'recentrer' | 'recevoir' | 'rechargement' | 'recit' | 'reconnexion' | 'recu'
  | 'recuperation' | 'reeducation' | 'refuser' | 'refute' | 'regard' | 'relache' | 'relevement' | 'renier'
  | 'renoncement' | 'repartition' | 'repas' | 'repli' | 'reponse' | 'repos' | 'repousse' | 'repousser' | 'retablir'
  | 'retenir' | 'retour' | 'reussite' | 'revele' | 'reveler' | 'rien' | 'riposte' | 'roulade' | 'round' | 'sacrifier'
  | 'sans' | 'scene' | 'seance' | 'secondaire' | 'seconde' | 'section' | 'selle' | 'service' | 'ses' | 'siege'
  | 'social' | 'soi' | 'soin' | 'soins' | 'solo' | 'sort' | 'sortie' | 'souffle' | 'soutenu' | 'spirituelle'
  | 'subjectif' | 'suivante' | 'supplementaires' | 'sur' | 'surincantation' | 'survivre' | 'suspendre' | 'systeme'
  | 'table' | 'talent' | 'tapi' | 'tas' | 'taverne' | 'teleportation' | 'tentacules' | 'terre' | 'test' | 'testeur'
  | 'tete' | 'tir' | 'tirage' | 'tire' | 'touche' | 'tour' | 'trait' | 'traumatisme' | 'troc' | 'troquer' | 'trot'
  | 'un' | 'usage' | 'validation' | 'vapeur' | 'vendre' | 'vente' | 'victoire' | 'vider' | 'virage' | 'visee' | 'viser'
  | 'vomi' | 'voyage' | 'vue' | 'zone';
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
] = [true, true, true, true, true, true, true, true, true, true, true, true, true, true, true, true, true, true, true, true, true, true, true, true, true, true, true, true, true, true, true, true, true, true, true, true, true];
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
