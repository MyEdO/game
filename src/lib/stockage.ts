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

/** La valeur JSON de `cle` dans `stockage` quand c'est un dictionnaire (objet, hors tableau) ; `null` sinon :
 *  absente, illisible, d'une autre forme, ou stockage indisponible. Ses VALEURS restent à valider par
 *  l'appelant, contre son registre (#2404). */
export function lireDictionnaire(stockage: Stockage | null, cle: string): Readonly<Record<string, unknown>> | null {
  const raw = lireLeTexte(stockage, cle);
  try {
    const o: unknown = raw ? JSON.parse(raw) : null;
    return o !== null && typeof o === 'object' && !Array.isArray(o) ? (o as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}
