/**
 * Les actions du noyau (#2817 D5, D9) : la composition UNIQUE des fabriques `(get, set) => actions`, que
 * lisent chaque propriétaire de l'état, le store web (`src/state/store.ts`) comme la partie
 * (`partie.ts`). Une fabrique ajoutée ici sert les deux.
 */
import type { ActionsDuNoyau } from './actionsDuNoyau';
import type { JeuDuNoyau, MachinerieDuNoyau } from './machinerieDuNoyau';
import type { Get, SetDesClesReservees } from './flowTypes';
import { creerReglageDuJet, creerVerbesDeJet, type CloturesDuJet } from './rollFlowSpecs';
import type { CorpsDesReglages, VerbeDeReglage } from './reglagesDuJet';
import type { NomDeVerbeDeJet } from './flowVerbs';
import type { Majuscule } from './intentionsDeSiege';
import { choixDuCombat, cloturesDuCombat, createCombatSlice, reglagesDuCombat, sortiesDuCombat, validationsDuCombat } from './combatSlice';
import { creerSortieDeFenetre, type SortiesDeFenetre } from './sortieDeFenetre';
import { creerValidationDeFenetre, type ValidationsDeFenetre } from './validationDeFenetre';
import { creerChoixDeFenetre } from './choixDeFenetre';
import type { CorpsDesChoix } from './choixDesFenetres';
import { creerActionsDuRegistre } from './actionRegistry';
import { creerActionsDOrientation } from './orientation';
import { creerActionsDeManoeuvre } from './shipManeuver';
import { sortiesDuChapitre, validationsDuChapitre } from './chapitreRecap';
import { choixDeCampagne, creerActionsDeCampagne, sortiesDeCampagne } from './campagne';
import { creerActionsDEntreeEnScene } from './entreeEnScene';
import { cloturesDInterlude, creerActionsDInterlude, validationsDInterlude } from './interludeFlow';
import { creerActionsDeBatailleDeMasse, sortiesDeBatailleDeMasse } from './massBattleFlow';
import { creerActionsDesFaveurs } from './favorFlow';
import { choixDeLaFinDeSeance, creerActionsDuGroupe, sortiesDuGroupe, validationsDuGroupe } from './partyFlow';
import { creerActionsDesPossessions } from './possessionsFlow';
import { creerActionsDeMarche } from './marcheDuGroupe';
import { cloturesDeFranchissement, creerActionsDeFranchissement, reglagesDeFranchissement } from './gesteDArete';
import { creerActionsDInteraction } from './interactionsDExploration';
import { choixDeConversation } from './conversation';
import { cloturesDuMarchand, creerActionsDuMarchand, sortiesDuMarchand, validationsDuMarchand } from './merchantFlow';
import { creerActionsDeTaverne, sortiesDeLaTaverne } from './tavernFlow';
import { creerActionsDesDes } from './battleRng';
import { creerActionsDIssueDeCombat, sortiesDIssueDeCombat } from './issueDeCombat';
import { choixDuMedecin, cloturesDuMedecin, creerActionsDuMedecin, sortiesDuMedecin } from './medicFlow';
import { creerActionsDuRepos, sortiesDuRepos, validationsDuRepos } from './restFlow';
import { choixDeLEquipage, creerActionsDeLEquipage, sortiesDeLEquipage } from './shipCrew';
import { cloturesDesTestsDeScene, creerActionsDesTestsDeScene, reglagesDesTestsDeScene } from './testsDeScene';
import { cloturesDuLotDEtal } from './etalLotFlow';
import { choixDeCorruption, cloturesDeCorruption, reglagesDeCorruption } from './corruptionFlow';
import { creerActionsDuJournal } from './journal';
import { creerActionsDAvanceeDHorloge, creerActionsDHorloge } from './horloge';
import { creerActionsDuVoyage, sortiesDuVoyage, validationsDuVoyage } from './travelFlow';
import { creerActionsDesPostesDeVoyage } from './travelPostes';
import { creerActionsDuBillet } from './billetFlow';
import { creerActionsDuPort, sortiesDuPort } from './portFlow';
import { choixDuVoyageEnMer, creerActionsDuVoyageEnMer } from './seaVoyageFlow';
import { creerActionsDuMarcheTerrestre, sortiesDuMarcheTerrestre } from './landMarketFlow';
import { creerActionsDeLAuberge } from './innFlow';
import { choixDeLaSemaineEnMer, validationsDeLaSemaineEnMer } from './seaActivities';

/** Les actions du lexique des verbes (#3371 §3.1) : un verbe manuscrit se nomme `<action>` ou `<action><Complément>`. */
type ActionDuLexique = 'acheter' | 'actionner' | 'affecter' | 'affronter' | 'approvisionner' | 'armer' | 'attribuer' | 'avancer'
  | 'carener' | 'ceder' | 'changer' | 'chercher' | 'cliquer' | 'commander' | 'creer' | 'debarquer' | 'depecer'
  | 'depenser' | 'deplacer' | 'deposer' | 'desarmer' | 'designer' | 'dissiper' | 'ecrire' | 'effacer' | 'embarquer'
  | 'engager' | 'entrainer' | 'epingler' | 'equiper' | 'evaluer' | 'fabriquer' | 'fixer' | 'focaliser' | 'fouiller'
  | 'franchir' | 'garnir' | 'incanter' | 'installer' | 'jeter' | 'jouer' | 'lever' | 'marchander' | 'marquer'
  | 'mener' | 'ouvrir' | 'partir' | 'payer' | 'pivoter' | 'poser' | 'pratiquer' | 'prendre' | 'promouvoir'
  | 'quitter' | 'rallier' | 'ranger' | 'recruter' | 'recueillir' | 'recuperer' | 'refuser' | 'remiser'
  | 'remplacer' | 'renommer' | 'renvoyer' | 'reparer' | 'reprendre' | 'restaurer' | 'retirer' | 'rompre'
  | 'signaler' | 'soigner' | 'solder' | 'suivre' | 'supprimer' | 'transmettre' | 'troquer' | 'utiliser' | 'vendre';
/** Les actions des verbes de jet, `jet<Action>…` (`VerbesDeJet`, `VerbeDeReglage`). */
type ActionDeJet = 'lancer' | 'relancer' | 'ajouter' | 'pactiser' | 'forcer' | 'imposer' | 'resister' | 'depenser'
  | 'annuler' | 'inverser' | 'valider' | 'regler';
/** Les actions des verbes de fenêtre, `fenetre<Action>` (`VerbeDeChoix`, `fenetreValider`, `fenetreFermer`). */
type ActionDeFenetre = 'choisir' | 'valider' | 'fermer';

/** Les noms du lexique : un verbe manuscrit, un verbe de jet ou de réglage de jet, un verbe de fenêtre. */
type NomDeVerbe = ActionDuLexique | `${ActionDuLexique}${Majuscule}${string}`
  | Extract<NomDeVerbeDeJet | keyof VerbeDeReglage, `jet${Capitalize<ActionDeJet>}${string}`>
  | `fenetre${Capitalize<ActionDeFenetre>}`;

/** Les verbes vivants hors lexique, chacun renommé par un lot de #3371 (§4). */
type NomEnAttente =
  'abandonPossession' | 'addToCart' | 'addToSellCart' | 'appraiseGear' | 'appraiseItem' | 'armPreempt'
  | 'assignDistribution' | 'assignLootGear' | 'assignVictoryGear' | 'barterExchange' | 'battleArmIntent'
  | 'battleClearPreview' | 'buyCharAdvance' | 'buySkillAdvance' | 'buySpell'
  | 'buySpellComponent' | 'buyTalent' | 'changeCareer' | 'choisirApparence' | 'clearCart' | 'clearSellCart'
  | 'climbAcross' | 'confirmSell' | 'createLoadout' | 'decFromCart' | 'deleteLoadout' | 'designateCareerSlot'
  | 'disembark' | 'dispelSelectCarrier' | 'embark' | 'fallAcross' | 'favorBreak' | 'favorSettle' | 'gatherInnInfo'
  | 'harvestCreature' | 'interludeActivity' | 'interludeBank' | 'interludeCraftStart' | 'interludeEntrainement'
  | 'interludeOrder' | 'interludeWithdraw' | 'jetBonusSL' | 'jetCancel' | 'jetConfirm' | 'jetDarkPact'
  | 'jetDetermine' | 'jetForceSuccess' | 'jetReroll' | 'jetResist' | 'jetReverse' | 'jetRoll' | 'jetSetForcedRoll'
  | 'landBuyCargo' | 'landDumpCargo' | 'landEvalWine' | 'landSellCargo' | 'lowerHand' | 'markCluesSeen'
  | 'massBattleActivity' | 'massBattleAdvance' | 'massBattleClash' | 'massBattleHazard' | 'massBattleRally'
  | 'massBattleScene' | 'medicAct' | 'moveCargo' | 'openLandMarket' | 'openMedic' | 'openPlaceMerchant' | 'openPort'
  | 'openRest' | 'openSurgeryPass' | 'openTavernGames' | 'openWorldMap' | 'partyAddHero' | 'partyRemoveHero'
  | 'partyReplaceHero' | 'payCart' | 'pivotParty' | 'playTavernGame' | 'portBuyCargo' | 'portCareen'
  | 'portDismissCrew' | 'portDumpCargo' | 'portHireCrew' | 'portInstallUpgrade' | 'portRepair' | 'portSellCargo'
  | 'raiseHand' | 'refuseBargain' | 'removeFromCart' | 'removeFromSellCart' | 'removeSpellComponent'
  | 'renamePossession' | 'repairItem' | 'restSet' | 'restoreFortuneNow' | 'resumeTravel' | 'retrievePossession'
  | 'roundStartPromote' | 'searchAvailability' | 'setHeroBackground' | 'setLoadoutSlot' | 'setMassBattleHero'
  | 'setPosteAmmo' | 'setSellHalving' | 'setShipRole' | 'setShipStation' | 'setTravelRole' | 'setVoyageCadence'
  | 'stablePossession' | 'startBargain' | 'startBilletBargain' | 'startTravel' | 'stepPartyRelative' | 'stowItem'
  | 'toggleCluePin' | 'toggleEquip' | 'trainProsthesis' | 'transferItem' | 'transitionTo' | 'windowAcross';

/** Un nom de `Noms` ni du lexique ni en attente. */
type HorsLexique<Noms extends string> = Exclude<Noms, NomDeVerbe | NomEnAttente>;
/** Un nom en attente absent de `Noms`, ou déjà du lexique. */
type AttenteMorte<Noms extends string> = Exclude<NomEnAttente, Noms> | Extract<NomEnAttente, NomDeVerbe>;
/** `true` si et seulement si `Noms` est du lexique, `NomEnAttente` exceptés, et que chaque nom en attente y vit ; sinon,
 *  les noms en faute. */
export type VerrouDuLexique<Noms extends string> = [HorsLexique<Noms> | AttenteMorte<Noms>] extends [never] ? true
  : { horsLexique: HorsLexique<Noms>; attenteMorte: AttenteMorte<Noms> };
/** VERROU : tout verbe du noyau se nomme dans le lexique. */
const verrouDuLexique: VerrouDuLexique<keyof ActionsDuNoyau> = true;
void verrouDuLexique;

/** Le corps de la clôture de chaque flux, que seul `jetConfirm(flux)` appelle : un flux sans clôture ne compile pas. */
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
  } satisfies ValidationsDeFenetre;
}

/** Les actions du noyau sur le propriétaire `get`/`set` (le `set` brut, qui écrit aussi les clés
 *  réservées de leurs seuls écrivains), une fabrique par concept. */
export function creerActionsDuNoyau(get: Get<JeuDuNoyau>, set: SetDesClesReservees): ActionsDuNoyau & MachinerieDuNoyau {
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
    ...createCombatSlice(get, set),
    ...creerActionsDuRegistre(get, set),
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
    ...creerActionsDHorloge(get, set),
    ...creerActionsDuVoyage(get, set),
    ...creerActionsDesPostesDeVoyage(get, set),
    ...creerActionsDuBillet(get, set),
    ...creerActionsDuPort(get, set),
    ...creerActionsDuVoyageEnMer(get, set),
    ...creerActionsDuMarcheTerrestre(get, set),
    ...creerActionsDeLAuberge(get, set),
  };
}
