import type { ActionsDuNoyau } from './actionsDuNoyau';
import type { SeaActivityPick } from './seaActivities';

/** Joue la semaine en mer (MDG 15 l.268) comme un siège : chaque choix par `fenetreChoisir('activitesEnMer', axe, valeur,
 *  héros)` — l'Activité, puis la mise et la planque qu'elle ouvre —, puis la validation de l'hôte. */
export function jouerLaSemaine(get: () => Pick<ActionsDuNoyau, 'fenetreChoisir' | 'fenetreValider'>, choix: Readonly<Record<string, SeaActivityPick>>): void {
  for (const [pid, { activityId, investGold, stashGold }] of Object.entries(choix)) {
    get().fenetreChoisir('activitesEnMer', 'activite', activityId, pid);
    if (investGold !== undefined) get().fenetreChoisir('activitesEnMer', 'investir', investGold, pid);
    if (stashGold !== undefined) get().fenetreChoisir('activitesEnMer', 'cacher', stashGold, pid);
  }
  get().fenetreValider('activitesEnMer');
}
