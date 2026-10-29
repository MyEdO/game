import { ACTIVITIES, activityById, type ActivityDef } from './activities';
import { setDataset } from '../data/overrides';

/**
 * Activité de contexte 'mer' SANS résolveur, dérivée de l'entrée réelle `cartographie` d'`activities.json`
 * (résolveur retiré, id propre) : la donnée est éditable au Compendium, et le chemin réel qu'une telle
 * entrée emprunte est `sea-activity-generic` (`buildSeaGenericStep`). `over` surcharge ses champs.
 */
export const activiteMer = (over: Partial<ActivityDef> = {}): ActivityDef => {
  const { resolver: _resolver, ...reelle } = structuredClone(activityById('cartographie')!);
  return { ...reelle, id: 'veille-en-mer', label: 'Veille en mer', ...over };
};

/** Exécute `fn` avec `def` présente au catalogue — à la place de l'entrée de même id, sinon ajoutée —,
 *  posée et retirée par le seam `setDataset` quoi qu'il arrive : rien ne fuit vers les autres tests
 *  (`isolate: false`). */
export function avecActivite<T>(def: ActivityDef, fn: () => T): T {
  const avant = [...ACTIVITIES];
  setDataset('activities', avant.some((a) => a.id === def.id) ? avant.map((a) => (a.id === def.id ? def : a)) : [...avant, def]);
  try {
    return fn();
  } finally {
    setDataset('activities', avant);
  }
}
