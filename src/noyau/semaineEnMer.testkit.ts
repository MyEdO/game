import type { ActionsDuNoyau } from './actionsDuNoyau';
import type { SeaActivityPick } from './seaActivities';

/** Joue la semaine en mer (MDG 15 l.268) comme un siège : chaque choix par `fenetreChoisir('seaActivities', axe, valeur,
 *  héros)` — l'Activité, puis la mise et la planque qu'elle ouvre —, puis la validation de l'hôte. */
export function jouerLaSemaine(get: () => Pick<ActionsDuNoyau, 'fenetreChoisir' | 'fenetreValider'>, choix: Readonly<Record<string, SeaActivityPick>>): void {
  for (const [pid, { activityId, investGold, stashGold }] of Object.entries(choix)) {
    get().fenetreChoisir('seaActivities', 'activite', activityId, pid);
    if (investGold !== undefined) get().fenetreChoisir('seaActivities', 'investir', investGold, pid);
    if (stashGold !== undefined) get().fenetreChoisir('seaActivities', 'cacher', stashGold, pid);
  }
  get().fenetreValider('seaActivities');
}
