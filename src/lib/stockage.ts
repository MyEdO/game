/** Un stockage clé → chaîne, synchrone : le sous-ensemble de `Storage` que lisent et écrivent ses sites (#3041). */
export type Stockage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

/** La valeur JSON de `cle` dans `stockage` quand c'est un dictionnaire (objet, hors tableau) ; `null` sinon :
 *  absente, illisible, d'une autre forme, ou stockage indisponible. Ses VALEURS restent à valider par
 *  l'appelant, contre son registre (#2404). */
export function lireDictionnaire(stockage: Stockage | null, cle: string): Readonly<Record<string, unknown>> | null {
  try {
    const raw = stockage?.getItem(cle);
    const o: unknown = raw ? JSON.parse(raw) : null;
    return o !== null && typeof o === 'object' && !Array.isArray(o) ? (o as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/** Une base asynchrone de documents : valeurs `V`, clés `K` (#3041). `accesBase` (`web/indexedDb.ts`) en rend
 *  l'implémentation web, un magasin par base. */
export interface Base<V, K> {
  /** La valeur de `cle` ; `null` si absente. */
  lire(cle: K): Promise<V | null>;
  lireTout(): Promise<V[]>;
  /** Pose `valeur`, sous `cle` pour une base à clés externes. */
  ecrire(valeur: V, cle?: K): Promise<void>;
  supprimer(cle: K): Promise<void>;
}
