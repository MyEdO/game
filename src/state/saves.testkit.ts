/**
 * LA SAUVEGARDE QUE LE WEB A ÉCRITE (#3058) : ce que porte le stockage des sauvegardes du web (`stockageDesSauvegardes`)
 * à un emplacement, lu à sa clé persistée et relu par la porte du noyau (`lireSave`), sans la procédure des
 * emplacements (`hote/sauvegardes.ts`), que `src/hote/sauvegardes.hors-store.test.ts` joue.
 */
import { lireSave, type SaveGame } from '../noyau/persistance/save';
import { stockageDesSauvegardes } from './saves';
import { cleDEmplacement, type AnySlot } from '../hote/sauvegardes';

/** La save de l'emplacement `slot` du stockage des sauvegardes, ou `null` s'il est vide ; lève si la porte la refuse. */
export function saveDuStockage(slot: AnySlot): SaveGame | null {
  const brut = stockageDesSauvegardes()?.getItem(cleDEmplacement(slot)) ?? null;
  if (brut == null) return null;
  const lue = lireSave(brut);
  if (typeof lue === 'string') throw new Error(`save refusée : ${lue}`);
  return lue;
}
