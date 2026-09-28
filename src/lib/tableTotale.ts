/**
 * Table TOTALE keyée par les éléments d'une liste (#1903) : pour chaque clé de `cles`, dans l'ordre de la
 * liste, la valeur `f(cle, indice)`, `indice` étant la position de la clé dans la liste, à partir de 0.
 * SOURCE UNIQUE de la construction, en TypeScript comme en `.mjs` (importée par son chemin, extension
 * comprise) : elle porte le seul cast du concept, `Record<K, T>`, que la liste de ses clés rend vrai.
 */
export function tableTotale<K extends string, T>(cles: readonly K[], f: (cle: K, indice: number) => T): Record<K, T> {
  return Object.fromEntries(cles.map((cle, indice) => [cle, f(cle, indice)])) as Record<K, T>;
}
