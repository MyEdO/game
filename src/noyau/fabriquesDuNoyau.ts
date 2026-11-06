/**
 * Les actions du noyau (#2817 D5, D9) : la composition UNIQUE des fabriques `(get, set) => actions`, que
 * lisent chaque propriétaire de l'état, le store web (`src/state/store.ts`) comme la partie
 * (`partie.ts`). Une fabrique ajoutée ici sert les deux.
 */
import type { ActionsDuNoyau } from './actionsDuNoyau';
import type { JeuDuNoyau, MachinerieDuNoyau } from './machinerieDuNoyau';
import type { Get, SetDesClesReservees } from './flowTypes';
import { creerReglageDuJet, creerVerbesDeJet, type CloturesDuJet } from './rollFlowSpecs';
import type { CorpsDesReglages } from './reglagesDuJet';
import type { FlowKey, NomDeVerbeDeJet, RollVerb } from './flowVerbs';
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
import { creerActionsDuGroupe, sortiesDuGroupe } from './partyFlow';
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
import { creerActionsDesConsommables } from './consumableFlow';
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
import { creerActionsDesActivitesEnMer } from './seaActivities';

/** Les actions MANUSCRITES : aucune ne porte le nom d'un verbe de jet (`NomDeVerbeDeJet`) ni un nom `<flux><Verbe>`
 *  (clé de `FLOW_VERBS`, verbe de `RollVerb`) — un geste de jet est le verbe générique de son verbe, le flux en
 *  argument ; le verbe d'un flux s'ajoute à sa ligne de `FLOW_VERBS` et à sa spec, jamais à côté. Aucune ne porte non
 *  plus un nom de réglage d'un flux (`<flux>Set…`, `<flux>Toggle…`, `<flux>Alloc…`, `<flux>Pick…`) : un jet se règle par `jetRegler`,
 *  le réglage déclaré dans `ReglagesDuJet` et son corps dans `reglagesDuJet`. Ni un nom de choix (`…Select`,
 *  `…Abandon…`, `…Choose`, `…All`, `…Choisir`) : une fenêtre fait choisir par `fenetreChoisir`, le choix déclaré dans `ChoixDesFenetres` et son corps
 *  dans `choixDesFenetres`. Ni un nom de sortie de fenêtre (`close…`, `dismiss…`, `…Cancel`, `…Skip`) : une fenêtre se
 *  ferme par `fenetreFermer`, la fenêtre déclarée dans son registre (`sortie`) et son corps dans `sortiesDeFenetre` ; ni
 *  un nom de validation (`…Ready`) : une fenêtre se valide par `fenetreValider`, la fenêtre déclarée dans son registre
 *  (`validation`) et son corps dans `validationsDeFenetre`.
 *  Une telle clé ne compile pas.
 *  Toute fabrique manuscrite s'étale DANS cet appel : hors de lui, le verrou ne la voit pas. */
type NomDeDelegue = `${FlowKey}${Capitalize<RollVerb>}` | NomDeVerbeDeJet
  | `${FlowKey}${'Set' | 'Toggle' | 'Alloc' | 'Pick'}${string}`
  | `${string}Select` | `${string}Abandon${string}` | `${string}Choose` | `${string}All` | `${string}Choisir`
  | `close${string}` | `dismiss${string}` | `${string}Cancel` | `${string}Skip` | `${string}Ready`;
function horsDelegues<T extends object>(actions: T & { [K in Extract<keyof T, NomDeDelegue>]: 'geste de jet, réglage de jet, choix, sortie ou validation de fenêtre : verbe générique' }): T {
  return actions;
}

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
    ...horsDelegues({
      ...createCombatSlice(get, set),
      ...creerActionsDuRegistre(get),
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
      ...creerActionsDesConsommables(get, set),
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
      ...creerActionsDesActivitesEnMer(get, set),
    }),
  };
}
