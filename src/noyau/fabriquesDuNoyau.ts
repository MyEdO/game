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
import type { ActionDeJet, NomDeVerbeDeJet } from './flowVerbs';
import type { Majuscule } from './intentionsDeSiege';
import { choixDuCombat, cloturesDuCombat, createCombatSlice, reglagesDuCombat, sortiesDuCombat, validationsDuCombat } from './combatSlice';
import { creerSortieDeFenetre, type SortiesDeFenetre } from './sortieDeFenetre';
import { creerValidationDeFenetre, type ValidationsDeFenetre } from './validationDeFenetre';
import { creerChoixDeFenetre } from './choixDeFenetre';
import type { AxeDuChoix, ChoixDesFenetres, CorpsDesChoix } from './choixDesFenetres';
import { creerVerbesDeLaBarre } from './actionRegistry';
import { creerActionsDOrientation } from './orientation';
import { creerActionsDeManoeuvre } from './shipManeuver';
import { sortiesDuChapitre, validationsDuChapitre } from './chapitreRecap';
import { choixDeCampagne, creerActionsDeCampagne, sortiesDeCampagne } from './campagne';
import { creerActionsDEntreeEnScene } from './entreeEnScene';
import { choixDInterlude, cloturesDInterlude, creerActionsDInterlude, validationsDInterlude } from './interludeFlow';
import { choixDeLaBataille, creerActionsDeBatailleDeMasse, sortiesDeBatailleDeMasse, validationsDeBatailleDeMasse } from './massBattleFlow';
import { creerActionsDesFaveurs } from './favorFlow';
import { choixDeLaFinDeSeance, creerActionsDuGroupe, sortiesDuGroupe, validationsDuGroupe } from './partyFlow';
import { creerActionsDesPossessions } from './possessionsFlow';
import { creerActionsDeMarche } from './marcheDuGroupe';
import { cloturesDeFranchissement, creerActionsDeFranchissement, reglagesDeFranchissement } from './gesteDArete';
import { creerActionsDInteraction } from './interactionsDExploration';
import { choixDeConversation } from './conversation';
import { choixDuMarchand, cloturesDuMarchand, creerActionsDuMarchand, sortiesDuMarchand, validationsDuMarchand } from './merchantFlow';
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
import { choixDuVoyageEnMer, creerActionsDuVoyageEnMer } from './seaVoyageFlow';
import { creerActionsDuMarcheTerrestre, sortiesDuMarcheTerrestre } from './landMarketFlow';
import { choixDesMarches } from './cargaison';
import { creerActionsDeLAuberge } from './innFlow';
import { choixDeLaSemaineEnMer, validationsDeLaSemaineEnMer } from './seaActivities';

/** Les actions du lexique des verbes (#3371 §3.1) : un verbe manuscrit se nomme `<action>` ou `<action><Complément>`, ou
 *  à la forme pronominale (`seRelever`). */
type ActionDuLexique = 'acheter' | 'actionner' | 'affecter' | 'aider' | 'annuler' | 'approvisionner'
  | 'armer' | 'asperger' | 'avancer' | 'basculer' | 'carener' | 'ceder' | 'changer' | 'chanter'
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
/** Les mots d'un id d'un domaine de verbe (littéral, axe) : les actions du lexique, et les mots que ses domaines
 *  nomment (#3614). */
type MotDuLexique = ActionDuLexique | ActionDeLaMachinerie | ActionDeFenetre
  | 'a' | 'abandon' | 'accepter' | 'activite' | 'alea' | 'ambition' | 'arriere' | 'au' | 'avant' | 'baisser'
  | 'cacher' | 'chercher' | 'cible' | 'couchage' | 'courte' | 'de' | 'depecer' | 'droite' | 'du' | 'encombrement'
  | 'entrainement' | 'eviter' | 'gauche' | 'heros' | 'investir' | 'issue' | 'jeter' | 'la' | 'le' | 'ligne' | 'longue'
  | 'motivation' | 'objet' | 'offre' | 'oter' | 'ouvrage' | 'paie' | 'panier' | 'patient' | 'payer' | 'personnelle'
  | 'pitance' | 'plaie' | 'pnj' | 'porteur' | 'poste' | 'pratiquer' | 'prix' | 'profil' | 'promouvoir'
  | 'psychologique' | 'qualite' | 'quantite' | 'rallier' | 'recevoir' | 'refuser' | 'renier' | 'repartition'
  | 'reponse' | 'scene' | 'sort' | 'survivre' | 'talent' | 'trait' | 'troc' | 'troquer' | 'vendre' | 'vente' | 'vider'
  | 'viser';
/** Les mots de `S`, coupé à chaque tiret et avant chaque majuscule, en minuscules (`traitPsychologique` : `trait`,
 *  `psychologique`). */
type Mots<S extends string, Cur extends string = ''> = S extends `${infer C}${infer R}`
  ? C extends '-' ? (Cur extends '' ? never : Cur) | Mots<R, ''>
    : C extends Majuscule ? (Cur extends '' ? never : Cur) | Mots<R, Lowercase<C>>
      : Mots<R, `${Cur}${C}`>
  : Cur extends '' ? never : Cur;
/** VERROU : tout verbe du noyau se nomme dans le lexique des verbes, toute machinerie dans le sien ; chaque domaine de
 *  verbe vidé de ses mots étrangers ne prend que des mots du lexique (#3614). */
const verrousDuLexique: [
  VerrouDuLexique<keyof ActionsDuNoyau>,
  VerrouDeLaMachinerie<keyof MachinerieDuNoyau>,
  Verrou<Mots<PasRelatif>, MotDuLexique>,
  Verrou<Mots<ChoixDesFenetres['fateSave']['issue']>, MotDuLexique>,
  Verrou<Mots<TavernOpponent['kind']>, MotDuLexique>,
  Verrou<Mots<AxeDuChoix>, MotDuLexique>,
] = [true, true, true, true, true, true];
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
