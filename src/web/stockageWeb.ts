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
