/** Les deux stockages web du navigateur, par leur nom de propriété globale. */
export type GenreDeStockage = 'localStorage' | 'sessionStorage';

/** Le stockage web du genre demandé ; `null` s'il manque ou si son accès lève (mode privé strict,
 *  iframe sandbox, module chargé hors navigateur). */
export function stockageWeb(genre: GenreDeStockage): Storage | null {
  try {
    return globalThis[genre] ?? null;
  } catch {
    return null;
  }
}

/** La valeur JSON de `cle` dans le stockage `genre` quand c'est un dictionnaire (objet, hors tableau) ;
 *  `null` sinon : absente, illisible, d'une autre forme, ou stockage indisponible. Ses VALEURS restent à
 *  valider par l'appelant, contre son registre. */
export function lireDictionnaire(genre: GenreDeStockage, cle: string): Readonly<Record<string, unknown>> | null {
  try {
    const raw = stockageWeb(genre)?.getItem(cle);
    const o: unknown = raw ? JSON.parse(raw) : null;
    return o !== null && typeof o === 'object' && !Array.isArray(o) ? (o as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}
