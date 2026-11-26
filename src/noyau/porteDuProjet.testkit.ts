/** La porte `parseProject` éprouvée : un gel profond de l'entrée et son refus `ProjetRefuse`, partagés par le commun
 *  (`parseProject-porte.test.ts`) et par chaque projet sur ses paquets. */
import { parseProject, ProjetRefuse } from './worldMap';

/** Gel PROFOND : toute écriture de la porte sur son entrée lève (module ESM = mode strict). */
export function gele<T>(o: T): T {
  if (o && typeof o === 'object' && !Object.isFrozen(o)) {
    Object.freeze(o);
    for (const v of Object.values(o)) gele(v);
  }
  return o;
}

/** Le refus de la porte pour ce document (échoue le test s'il passe ou lève autre chose). */
export function refusDe(doc: unknown): ProjetRefuse {
  try {
    parseProject(doc);
  } catch (e) {
    if (e instanceof ProjetRefuse) return e;
    throw e;
  }
  throw new Error('la porte a laissé passer le document');
}
