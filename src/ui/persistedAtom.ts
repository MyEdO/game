/**
 * ATOME PERSISTÉ — définition UNIQUE du motif « réglage UTILISATEUR hors Scène » : une valeur en
 * mémoire (source de vérité de la session), un miroir `localStorage` (elle survit au rechargement)
 * et un abonnement React (`useSyncExternalStore`) pour que toutes les vues qui la lisent restent en
 * phase. Un stockage indisponible (mode privé, quota) n'est jamais une erreur : le réglage reste
 * effectif pour la session, sans persistance.
 *
 * Le sérialiseur est fourni par l'appelant (`parse`/`write`) : la primitive ne suppose rien de la
 * forme stockée — booléen, nombre, id d'énumération ou objet JSON.
 */
import { useSyncExternalStore } from 'react';
import { stockageLocal } from '../lib/stockageLocal';

export interface PersistedAtom<T> {
  /** Valeur courante (lecture hors React : garde, sérialisation, test). */
  get(): T;
  /** Pose la valeur, la persiste et notifie les abonnés. */
  set(v: T): void;
  /** Hook React — s'abonne et re-rend à chaque `set`. */
  use(): T;
}

export function persistedAtom<T>(key: string, fallback: T, parse: (raw: string) => T, write: (v: T) => string): PersistedAtom<T> {
  let value: T = (() => {
    try {
      const raw = stockageLocal()?.getItem(key);
      return raw === null || raw === undefined ? fallback : parse(raw);
    } catch {
      return fallback;
    }
  })();
  const listeners = new Set<() => void>();
  const get = (): T => value;
  const set = (v: T): void => {
    value = v;
    try {
      stockageLocal()?.setItem(key, write(v));
    } catch {
      // stockage indisponible
    }
    for (const l of listeners) l();
  };
  const use = (): T =>
    useSyncExternalStore(
      (l) => {
        listeners.add(l);
        return () => listeners.delete(l);
      },
      get,
      () => fallback,
    );
  return { get, set, use };
}
