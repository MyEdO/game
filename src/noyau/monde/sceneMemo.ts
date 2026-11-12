import { GELER_LA_DONNEE, gelerProfond } from '../../lib/gelerProfond';

/**
 * Mémoïsation par IDENTITÉ de référence — le patron CANONIQUE de tout cache dérivé de la `Scene`
 * (opacité de vision, arêtes de murs, empreintes de décor…). Sûr car TOUTE mutation de la donnée
 * observée renvoie une NOUVELLE réf (jamais une mutation en place) : un pas d'exploration/combat
 * qui ne change rien ne change pas la réf → zéro reconstruction ; une mutation réelle (porte,
 * décor, structure) passe TOUJOURS par un spread `{ ...x, … }` qui invalide le cache pour l'appel
 * suivant. AUCUNE invalidation manuelle : une garde de synchronisation est un smell (credo) — la
 * seule source de vérité est l'identité de la réf observée. UN SEUL patron — ne pas en recréer un
 * second à côté. En développement, la clé est gelée à son entrée (`gelerProfond`).
 */
export function memoByRef<K extends object, V>(build: (key: K) => V): (key: K) => V {
  const cache = new WeakMap<K, V>();
  return (key: K) => {
    if (cache.has(key)) return cache.get(key)!;
    if (GELER_LA_DONNEE) gelerProfond(key);
    const value = build(key);
    cache.set(key, value);
    return value;
  };
}

/**
 * Mémoïsation d'UNE variante par identité d'un jeu de DÉPENDANCES, comparées par identité (`===`),
 * position par position, longueur comprise — AUCUNE invalidation manuelle, même raison que
 * `memoByRef`. Un jeu différent rebâtit la valeur ; le constructeur reçoit la variante précédente
 * (`null` la première fois), d'où il peut reprendre. Les dépendances ne sont pas gelées : elles
 * peuvent porter des instances (objets three, `GameStage3D.tsx`).
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

/**
 * Mémoïsation par identité de référence ET par identité d'un jeu de DÉPENDANCES — un `memoByDeps` par
 * élément, tenu par `memoByRef`, pour les caches qui ne dépendent pas que de la
 * clef mais aussi d'un contexte extérieur (dimensions d'écran, options de détail, cran de LOD…).
 * UNE SEULE variante est retenue par élément (la dernière) : un changement de dépendance (rotation,
 * zoom…) touche généralement TOUS les éléments mémoïsés à la fois, donc en garder plusieurs par
 * élément n'éviterait aucun recalcul et ferait seulement enfler la mémoire.
 */
export function memoByRefDeps<K extends object, V>(): (key: K, deps: readonly unknown[], build: () => V) => V {
  const memoDe = memoByRef((_key: K) => memoByDeps<V>());
  return (key, deps, build) => memoDe(key)(deps, build);
}
