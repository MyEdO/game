/**
 * Cœur d'IDENTITÉ de la mémoïsation par référence (#5069) : une valeur retenue par clé, comparée par `===`, sans version
 * ni gel. `src/noyau/monde/sceneMemo.ts` le compose avec la version des datasets et le gel en développement.
 */

/** Mémoïsation par IDENTITÉ de la clé : une valeur par référence, bâtie à sa première lecture. */
export function memoParIdentite<K extends object, V>(build: (key: K) => V): (key: K) => V {
  const cache = new WeakMap<K, V>();
  return (key: K) => {
    if (cache.has(key)) return cache.get(key)!;
    const value = build(key);
    cache.set(key, value);
    return value;
  };
}

/**
 * Mémoïsation d'UNE variante par identité d'un jeu de DÉPENDANCES, comparées par identité (`===`),
 * position par position, longueur comprise — AUCUNE invalidation manuelle. Un jeu différent rebâtit la valeur ; le
 * constructeur reçoit la variante précédente (`null` la première fois), d'où il peut reprendre. Les dépendances ne sont
 * pas gelées : elles peuvent porter des instances (objets three, `GameStage3D.tsx`).
 */
export function memoByDeps<V>(): (
  deps: readonly unknown[],
  build: (previous: { deps: readonly unknown[]; value: V } | null) => V,
) => V {
  let retenue: { deps: readonly unknown[]; value: V } | null = null;
  return (deps, build) => {
    if (retenue !== null && retenue.deps.length === deps.length && retenue.deps.every((d, i) => d === deps[i])) {
      return retenue.value;
    }
    retenue = { deps, value: build(retenue) };
    return retenue.value;
  };
}

/** Un mémo par clé, tel que `memoParIdentite` le rend. */
export type MemoParCle = <K extends object, V>(build: (key: K) => V) => (key: K) => V;

/** Un `memoByDeps` par clé, tenu par le mémo par clé `parCle` (`memoParIdentite` à défaut) : UNE variante retenue par clé. */
export function memoParIdentiteEtDeps<K extends object, V>(parCle: MemoParCle = memoParIdentite): (key: K, deps: readonly unknown[], build: () => V) => V {
  const memoDe = parCle((_key: K) => memoByDeps<V>());
  return (key, deps, build) => memoDe(key)(deps, build);
}
