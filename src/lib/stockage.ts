/** Un stockage clé → chaîne, synchrone : le sous-ensemble de `Storage` que lisent et écrivent ses sites (#3041). */
export type Stockage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

/** Le texte stocké sous `cle` ; `null` s'il est absent, ou si le stockage est indisponible (absent ou qui lève). */
export function lireLeTexte(stockage: Stockage | null, cle: string): string | null {
  try {
    return stockage?.getItem(cle) ?? null;
  } catch {
    return null;
  }
}

/** Retire `cle` de `stockage` ; un stockage indisponible (absent ou qui lève) n'a rien à retirer. */
export function retirerLaCle(stockage: Stockage | null, cle: string): void {
  try {
    stockage?.removeItem(cle);
  } catch {
    // stockage indisponible : rien à retirer
  }
}

/** La valeur JSON de `cle` dans `stockage` ; `undefined` si elle est absente, illisible, ou si le stockage est
 *  indisponible. */
function lireLeJson(stockage: Stockage | null, cle: string): unknown {
  const raw = lireLeTexte(stockage, cle);
  try {
    return raw ? (JSON.parse(raw) as unknown) : undefined;
  } catch {
    return undefined;
  }
}

/** La valeur JSON de `cle` dans `stockage` quand c'est un dictionnaire (objet, hors tableau) ; `null` sinon :
 *  absente, illisible, d'une autre forme, ou stockage indisponible. Ses VALEURS restent à valider par
 *  l'appelant, contre son registre (#2404). */
export function lireDictionnaire(stockage: Stockage | null, cle: string): Readonly<Record<string, unknown>> | null {
  const o = lireLeJson(stockage, cle);
  return o !== null && typeof o === 'object' && !Array.isArray(o) ? (o as Record<string, unknown>) : null;
}

/** La valeur JSON de `cle` dans `stockage` quand c'est un tableau ; `null` sinon : absente, illisible, d'une autre
 *  forme, ou stockage indisponible. Ses ÉLÉMENTS restent à valider par l'appelant (#2404). */
export function lireTableau(stockage: Stockage | null, cle: string): readonly unknown[] | null {
  const a = lireLeJson(stockage, cle);
  return Array.isArray(a) ? a : null;
}

/** Les chaînes de `v`, une valeur relue d'un stockage : ses éléments chaînes si c'est un tableau, `[]` sinon. */
export function lesChaines(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
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
