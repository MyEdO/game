import { ACTIVITIES, type ActivityDef } from '../engine/activities';

/**
 * Activité de contexte 'mer' SANS résolveur, fabriquée à la forme d'`activities.json` : la donnée est
 * éditable au Compendium, et le chemin réel qu'une telle entrée emprunte est `sea-activity-generic`
 * (`buildSeaGenericStep`). `over` surcharge ses champs (compétences, compétence libre…).
 */
export const activiteMer = (over: Partial<ActivityDef> = {}): ActivityDef => ({
  id: 'veille-en-mer', type: 'activities', label: 'Veille en mer', icon: 'ui/eye', contexts: ['mer'],
  source: { book: 'mer-des-griffes', page: 130 }, skills: [{ id: 'perception' }], difficulty: 'intermediaire',
  stake: 'Réussite : la veille tient.', stakeForm: 'descripteur',
  ...over,
} as ActivityDef);

/** Exécute `fn` avec `def` présente au CATALOGUE partagé (`ACTIVITIES`, même tableau que celui des
 *  enjeux), retirée ensuite quoi qu'il arrive : rien ne fuit vers les autres tests (`isolate: false`). */
export function avecActivite<T>(def: ActivityDef, fn: () => T): T {
  ACTIVITIES.push(def);
  try {
    return fn();
  } finally {
    ACTIVITIES.splice(ACTIVITIES.indexOf(def), 1);
  }
}
