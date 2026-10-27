/**
 * LE TÉMOIN PERSISTÉ d'un hôte (#3041, #1463 LD.1) : ce qu'un chargement a retiré d'un document persisté s'écrit sous
 * sa clé dans le même `Stockage`, CUMULÉ aux témoins déjà posés, jusqu'à sa prise unique. La forme d'un témoin (sa
 * relecture défensive, son cumul) est à son propriétaire ; celle des retraits d'élagage est au noyau
 * (`noyau/persistance/elagage.ts`). Un stockage absent (`null`) ou qui lève : aucun témoin, le chargement ne casse pas.
 */
import { cumulerLesRetraits, lireLesRetraits, type RetraitsDElagage } from '../noyau/index';
import { lireLeTexte, retirerLaCle, type Stockage } from '../lib/stockage';

/** La forme d'un témoin : sa relecture d'une valeur JSON (`null` si illisible), et son cumul à un témoin déjà posé. */
export interface FormeDeTemoin<T> {
  lire(v: unknown): T | null;
  cumuler(avant: T | null, nouveau: T): T;
}

/** Le témoin des retraits d'élagage. */
export const TEMOIN_DES_RETRAITS: FormeDeTemoin<RetraitsDElagage> = {
  lire: lireLesRetraits,
  cumuler: (avant, nouveau) => cumulerLesRetraits(avant, nouveau) ?? nouveau,
};

/** Cumule `nouveau` au témoin déjà posé sous `cle` dans `stockage`. */
export function temoigner<T>(stockage: Stockage | null, cle: string, forme: FormeDeTemoin<T>, nouveau: T): void {
  const cumul = forme.cumuler(lire(stockage, cle, forme), nouveau);
  try {
    stockage?.setItem(cle, JSON.stringify(cumul));
  } catch {
    // quota plein / stockage indisponible : le témoin ne casse pas le chargement
  }
}

/** Le témoin cumulé sous `cle` dans `stockage`, RETIRÉ du stockage : `null` sans témoin depuis la dernière prise. */
export function prendreLeTemoin<T>(stockage: Stockage | null, cle: string, forme: FormeDeTemoin<T>): T | null {
  const temoin = lire(stockage, cle, forme);
  if (temoin === null) return null;
  retirerLaCle(stockage, cle);
  return temoin;
}

function lire<T>(stockage: Stockage | null, cle: string, forme: FormeDeTemoin<T>): T | null {
  const brut = lireLeTexte(stockage, cle);
  try {
    return brut ? forme.lire(JSON.parse(brut)) : null;
  } catch {
    return null;
  }
}
