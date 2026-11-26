import { GELER_LA_DONNEE, gelerProfond } from '../../lib/gelerProfond';
import { versionDesDatasets } from '../../data/versionDataset';
import { memoParIdentite, memoParIdentiteEtDeps } from '../../lib/memoParIdentite';

/**
 * Mémoïsation par IDENTITÉ de référence — le patron CANONIQUE de tout cache dérivé de la `Scene`
 * (opacité de vision, arêtes de murs, empreintes de décor…). Sûr car TOUTE mutation de la donnée
 * observée renvoie une NOUVELLE réf (jamais une mutation en place) : un pas d'exploration/combat
 * qui ne change rien ne change pas la réf → zéro reconstruction ; une mutation réelle (porte,
 * décor, structure) passe TOUJOURS par un spread `{ ...x, … }` qui invalide le cache pour l'appel
 * suivant. AUCUNE invalidation manuelle : une garde de synchronisation est un smell (credo) — la
 * seule source de vérité est l'identité de la réf observée, et la version des datasets (`versionDesDatasets`), que
 * l'identité ne dit pas : une écriture au catalogue remplace le contenu d'un dataset sans changer son binding, et toute
 * valeur retenue avant elle est oubliée. UN SEUL patron — ne pas en recréer un second à côté. En développement, la clé
 * est gelée à son entrée (`gelerProfond`).
 */
export function memoByRef<K extends object, V>(build: (key: K) => V): (key: K) => V {
  const construire = (key: K): V => {
    if (GELER_LA_DONNEE) gelerProfond(key);
    return build(key);
  };
  let version = versionDesDatasets();
  let memo = memoParIdentite(construire);
  return (key: K) => {
    const courante = versionDesDatasets();
    if (courante !== version) {
      memo = memoParIdentite(construire);
      version = courante;
    }
    return memo(key);
  };
}

/**
 * Mémoïsation par identité de référence ET par identité d'un jeu de DÉPENDANCES — un `memoByDeps` par
 * élément, tenu par `memoByRef` (donc daté par la version des datasets comme lui), pour les caches qui ne
 * dépendent pas que de la clef mais aussi d'un contexte extérieur (dimensions d'écran, options de détail, cran de
 * LOD…).
 * UNE SEULE variante est retenue par élément (la dernière) : un changement de dépendance (rotation,
 * zoom…) touche généralement TOUS les éléments mémoïsés à la fois, donc en garder plusieurs par
 * élément n'éviterait aucun recalcul et ferait seulement enfler la mémoire.
 */
export function memoByRefDeps<K extends object, V>(): (key: K, deps: readonly unknown[], build: () => V) => V {
  return memoParIdentiteEtDeps<K, V>(memoByRef);
}
