/**
 * L'ÉVÉNEMENT RACONTÉ DU JOUR en cours d'un trajet, quel que soit le milieu (#4005) : son seul lieu est
 * `TravelPlan.evenements`, son seul écrivain `noteEvent`, son seul chemin vers l'hôte `voyageEnVue`, et
 * chaque sortie de jour le range dans le `TravelRecapDay` clos par `rangerLesEvenements`. Feuille par la
 * valeur (imports de types seuls) : la mer (`seaVoyageFlow.ts`) et la terre (`travelPostes.ts`,
 * `travelFlow.ts`) l'importent sans cycle.
 */
import type { Get, Set } from './flowTypes';
import type { RecapEvent } from './recapLine';
import type { TravelRecapDay } from './travelFlow';

/** POSE un événement au jour en cours du trajet et REND la ligne qui le nomme au lieu de l'écrire : depuis
 *  un applier de cascade, cette ligne est la CONSÉQUENCE de l'étape (`commitStep` la journalise et la garde
 *  dans `outcome`) ; hors cascade, l'appelant la passe à `ecrireAuJournal`. */
export function noteEvent(get: Get, set: Set, event: RecapEvent): string {
  const plan = get().travelPlan;
  if (plan) set({ travelPlan: { ...plan, evenements: [...(plan.evenements ?? []), event] } });
  return `${event.title} — ${event.text}`;
}

/** Une SORTIE de jour : recopie les événements du trajet dans le jour clos `jour`, puis les vide. */
export function rangerLesEvenements(get: Get, set: Set, jour: TravelRecapDay): void {
  const plan = get().travelPlan;
  if (!plan?.evenements?.length) return;
  jour.events = [...(jour.events ?? []), ...plan.evenements];
  set({ travelPlan: { ...plan, evenements: undefined } });
}
