/**
 * KIT DE TEST du PARTAGE par identité (#2097) : ce qu'un `Combatant` atteint, et l'ensemble des
 * objets du catalogue (`src/data`). Composé par la garde des fiches de scène et par le banc des
 * invocations.
 */
import * as donnees from '../data';

/** Chaque objet littéral ou tableau atteignable depuis `racine`, avec son premier chemin de propriétés. */
export function atteignables(racine: unknown, chemin: string, vus = new Map<object, string>()): Map<object, string> {
  const pile: [unknown, string][] = [[racine, chemin]];
  while (pile.length) {
    const [o, p] = pile.pop()!;
    if (o === null || typeof o !== 'object' || vus.has(o)) continue;
    const proto = Object.getPrototypeOf(o);
    if (!Array.isArray(o) && proto !== Object.prototype && proto !== null) continue;
    vus.set(o, p);
    for (const [k, v] of Object.entries(o)) pile.push([v, `${p}.${k}`]);
  }
  return vus;
}

let catalogue: Set<object> | undefined;

/** Les objets atteignables depuis les exports de `src/data`, lus une fois. */
export function objetsDuCatalogue(): Set<object> {
  return catalogue ??= new Set(atteignables(Object.values(donnees), 'données').keys());
}

/** Les chemins de `racine` qui atteignent un objet du catalogue par identité. */
export function cheminsVersLeCatalogue(racine: unknown, chemin: string): string[] {
  const cat = objetsDuCatalogue();
  return [...atteignables(racine, chemin)].filter(([o]) => cat.has(o)).map(([, p]) => p);
}
