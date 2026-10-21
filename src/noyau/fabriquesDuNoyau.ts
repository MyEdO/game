/**
 * Les actions du noyau (#2817 D5, D9) : la composition UNIQUE des fabriques `(get, set) => actions`, que
 * lisent chaque propriétaire de l'état, le store web (`src/state/store.ts`) comme la partie
 * (`partie.ts`). Une fabrique ajoutée ici sert les deux.
 */
import type { ActionsDuNoyau } from './actionsDuNoyau';
import type { Get, SetDesClesReservees } from './flowTypes';
import { buildRollFlowActions, creerActionsDuJetDActivite } from './rollFlowSpecs';
import { createCombatSlice } from './combatSlice';
import { creerActionsDuRegistre } from './actionRegistry';
import { creerActionsDOrientation } from './orientation';
import { creerActionsDeManoeuvre } from './shipManeuver';
import { creerActionsDuChapitre } from './chapitreRecap';
import { creerActionsDeCampagne } from './campagne';
import { creerActionsDeVision } from './visionState';
import { creerActionsDEntreeEnScene } from './entreeEnScene';
import { creerActionsDInterlude } from './interludeFlow';
import { creerActionsDeBatailleDeMasse } from './massBattleFlow';
import { creerActionsDesFaveurs } from './favorFlow';
import { creerActionsDuGroupe } from './partyFlow';
import { creerActionsDesPossessions } from './possessionsFlow';
import { creerActionsDeMarche } from './marcheDuGroupe';
import { creerActionsDeFranchissement } from './gesteDArete';
import { creerActionsDInteraction } from './interactionsDExploration';
import { creerActionsDeConversation } from './conversation';
import { creerActionsDuMarchand } from './merchantFlow';
import { creerActionsDeTaverne } from './tavernFlow';
import { creerActionsDesDes } from './battleRng';
import { creerActionsDIssueDeCombat } from './issueDeCombat';
import { creerActionsDuMedecin } from './medicFlow';
import { creerActionsDuRepos } from './restFlow';
import { creerActionsDeLEquipage } from './shipCrew';
import { creerActionsDesConsommables } from './consumableFlow';
import { creerActionsDesTestsDeScene } from './testsDeScene';
import { creerActionsDuLotDEtal } from './etalLotFlow';
import { creerActionsDeCorruption } from './corruptionFlow';
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

/** Les actions du noyau sur le propriétaire `get`/`set` (le `set` brut, qui écrit aussi les clés
 *  réservées de leurs seuls écrivains), une fabrique par concept. */
export function creerActionsDuNoyau(get: Get, set: SetDesClesReservees): ActionsDuNoyau {
  return {
    ...createCombatSlice(get, set),
    ...creerActionsDuRegistre(get),
    // Les délégués de jet (mono et multi), dérivés de `FLOW_WIRING`.
    ...buildRollFlowActions(get, set),
    ...creerActionsDuJetDActivite(get, set),
    ...creerActionsDOrientation(get, set),
    ...creerActionsDeManoeuvre(get, set),
    ...creerActionsDuChapitre(get, set),
    ...creerActionsDeCampagne(get, set),
    ...creerActionsDeVision(get, set),
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
    ...creerActionsDuLotDEtal(get, set),
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
  };
}
