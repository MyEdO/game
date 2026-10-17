/**
 * Lecture d'un jet TOMBÉ côté test : un test qui juge le dé d'une ligne tentable l'exige, et une ligne
 * non tentable (`EchecSansJet`, LDB 09 l.30) ou pas encore lancée le fait échouer nommément.
 */
import { estJete, type EchecSansJet } from './tests';

export function jete<T extends object>(r: T | EchecSansJet | null | undefined): Exclude<T, EchecSansJet> {
  if (!estJete(r)) throw new Error(r ? 'ligne non tentable : aucun dé tombé' : 'aucun dé tombé');
  return r;
}
