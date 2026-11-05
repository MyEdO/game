/**
 * Les actions du noyau (#2817 D5, D9) : la composition UNIQUE des fabriques `(get, set) => actions`, que
 * lisent chaque propriétaire de l'état, le store web (`src/state/store.ts`) comme la partie
 * (`partie.ts`). Une fabrique ajoutée ici sert les deux.
 */
import type { ActionsDuNoyau } from './actionsDuNoyau';
import type { Get, SetDesClesReservees } from './flowTypes';
import { creerVerbesDeJet, type CloturesDuJet } from './rollFlowSpecs';
import type { FlowKey, NomDeVerbeDeJet, RollVerb } from './flowVerbs';
import { cloturesDuCombat, createCombatSlice } from './combatSlice';
import { creerActionsDuRegistre } from './actionRegistry';
import { creerActionsDOrientation } from './orientation';
import { creerActionsDeManoeuvre } from './shipManeuver';
import { creerActionsDuChapitre } from './chapitreRecap';
import { creerActionsDeCampagne } from './campagne';
import { creerActionsDEntreeEnScene } from './entreeEnScene';
import { cloturesDInterlude, creerActionsDInterlude } from './interludeFlow';
import { creerActionsDeBatailleDeMasse } from './massBattleFlow';
import { creerActionsDesFaveurs } from './favorFlow';
import { creerActionsDuGroupe } from './partyFlow';
import { creerActionsDesPossessions } from './possessionsFlow';
import { creerActionsDeMarche } from './marcheDuGroupe';
import { cloturesDeFranchissement, creerActionsDeFranchissement } from './gesteDArete';
import { creerActionsDInteraction } from './interactionsDExploration';
import { creerActionsDeConversation } from './conversation';
import { cloturesDuMarchand, creerActionsDuMarchand } from './merchantFlow';
import { creerActionsDeTaverne } from './tavernFlow';
import { creerActionsDesDes } from './battleRng';
import { creerActionsDIssueDeCombat } from './issueDeCombat';
import { cloturesDuMedecin, creerActionsDuMedecin } from './medicFlow';
import { creerActionsDuRepos } from './restFlow';
import { creerActionsDeLEquipage } from './shipCrew';
import { creerActionsDesConsommables } from './consumableFlow';
import { cloturesDesTestsDeScene, creerActionsDesTestsDeScene } from './testsDeScene';
import { cloturesDuLotDEtal } from './etalLotFlow';
import { cloturesDeCorruption, creerActionsDeCorruption } from './corruptionFlow';
import { creerActionsDuJournal } from './journal';
import { creerActionsDAvanceeDHorloge, creerActionsDHorloge } from './horloge';
import { creerActionsDuVoyage } from './travelFlow';
import { creerActionsDesPostesDeVoyage } from './travelPostes';
import { creerActionsDuBillet } from './billetFlow';
import { creerActionsDuPort } from './portFlow';
import { creerActionsDuVoyageEnMer } from './seaVoyageFlow';
import { creerActionsDuMarcheTerrestre } from './landMarketFlow';
import { creerActionsDeLAuberge } from './innFlow';
import { creerActionsDesActivitesEnMer } from './seaActivities';

/** Les actions MANUSCRITES : aucune ne porte le nom d'un verbe de jet (`NomDeVerbeDeJet`) ni un nom `<flux><Verbe>`
 *  (clé de `FLOW_VERBS`, verbe de `RollVerb`) — un geste de jet est le verbe générique de son verbe, le flux en
 *  argument ; le verbe d'un flux s'ajoute à sa ligne de `FLOW_VERBS` et à sa spec, jamais à côté. Une telle clé ne
 *  compile pas. Toute fabrique manuscrite s'étale DANS cet appel : hors de lui, le verrou ne la voit pas. */
type NomDeDelegue = `${FlowKey}${Capitalize<RollVerb>}` | NomDeVerbeDeJet;
function horsDelegues<T extends object>(actions: T & { [K in Extract<keyof T, NomDeDelegue>]: 'geste de jet : verbe générique de creerVerbesDeJet' }): T {
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

/** Les actions du noyau sur le propriétaire `get`/`set` (le `set` brut, qui écrit aussi les clés
 *  réservées de leurs seuls écrivains), une fabrique par concept. */
export function creerActionsDuNoyau(get: Get, set: SetDesClesReservees): ActionsDuNoyau {
  return {
    // Les verbes de jet, le flux en argument : leur SEUL écrivain.
    ...creerVerbesDeJet(get, set, cloturesDuJet(get, set)),
    ...horsDelegues({
      ...createCombatSlice(get, set),
      ...creerActionsDuRegistre(get),
      ...creerActionsDOrientation(get, set),
      ...creerActionsDeManoeuvre(get, set),
      ...creerActionsDuChapitre(get, set),
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
      ...creerActionsDeConversation(get, set),
      ...creerActionsDuMarchand(get, set),
      ...creerActionsDeTaverne(get, set),
      ...creerActionsDesDes(get, set),
      ...creerActionsDIssueDeCombat(get, set),
      ...creerActionsDuMedecin(get, set),
      ...creerActionsDuRepos(get, set),
      ...creerActionsDeLEquipage(get, set),
      ...creerActionsDesConsommables(get, set),
      ...creerActionsDesTestsDeScene(get, set),
      ...creerActionsDeCorruption(get, set),
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
