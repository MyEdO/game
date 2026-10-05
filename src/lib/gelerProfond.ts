/** Le GEL DE LA DONNÉE, ASSERTÉ en développement et en test (`import.meta.env?.DEV` ; `?.` car
 *  `import.meta.env` n'existe pas sous `tsx`) : une écriture en place dans une donnée gelée LÈVE au
 *  site fautif. En production, la donnée n'est pas gelée. Composé par `memoByRef` (`state/sceneMemo.ts`,
 *  clés de scène) et par le seam des datasets (`data/overrides.ts`, entrées du catalogue, #2097). Une
 *  CONSTANTE DE MODULE (`gelerLaConstante`) est gelée sans condition, en production comprise. */
export const GELER_LA_DONNEE = import.meta.env?.DEV === true;

/** Objets déjà gelés en profondeur : une donnée éditée partage presque tout avec la précédente
 *  (spread), seul le neuf se parcourt. */
const gelesEnProfondeur = new WeakSet<object>();

/** Gèle en profondeur les objets littéraux et tableaux atteignables depuis `racine`, en les marquant
 *  comme donnée si `marquer`. Une instance de classe (`Map`, `Set`, tableau typé, objet three.js…)
 *  n'est ni gelée ni parcourue ; un objet déjà gelé (marqué, ou constante) n'est pas reparcouru. */
function gelerEnProfondeur(racine: object, marquer: boolean): void {
  const pile: object[] = [racine];
  while (pile.length) {
    const o = pile.pop()!;
    if (Object.isFrozen(o)) continue;
    const proto = Object.getPrototypeOf(o);
    if (!Array.isArray(o) && proto !== Object.prototype && proto !== null) continue;
    if (marquer) gelesEnProfondeur.add(o);
    Object.freeze(o);
    for (const v of Object.values(o)) if (v !== null && typeof v === 'object') pile.push(v);
  }
}

/** Gèle la DONNÉE, marquée pour `estUneDonneeGelee`. Une constante déjà gelée à sa définition
 *  (`EMPTY_FLOW`) n'est pas de la donnée et reste hors de `estUneDonneeGelee`. */
export function gelerProfond(racine: object): void {
  gelerEnProfondeur(racine, true);
}

/** Gèle en profondeur une CONSTANTE DE MODULE que l'état peut tenir par référence (#2097), sans la
 *  marquer comme donnée : immuable par construction, son partage n'est pas une faute. Rend `racine`. */
export function gelerLaConstante<T extends object>(racine: T): T {
  gelerEnProfondeur(racine, false);
  return racine;
}

/** Cet objet a-t-il été gelé COMME DONNÉE par `gelerProfond` (clé de scène, entrée du catalogue) ? */
export function estUneDonneeGelee(o: object): boolean {
  return gelesEnProfondeur.has(o);
}
