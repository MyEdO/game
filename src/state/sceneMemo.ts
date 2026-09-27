/** Le contrat d'identité de `memoByRef` (ci-dessous), ASSERTÉ : en développement et en test
 *  (`import.meta.env?.DEV` ; `?.` car `import.meta.env` n'existe pas sous `tsx`), toute clé mémorisée
 *  est gelée en profondeur à son entrée, et une écriture en place LÈVE au site fautif au lieu de servir
 *  un cache périmé en silence. En production, rien. */
const GELER_LES_CLES = import.meta.env?.DEV === true;

/** Objets déjà gelés en profondeur : une scène éditée partage presque tout avec la précédente (spread),
 *  seul le neuf se parcourt. */
const gelesEnProfondeur = new WeakSet<object>();

/** Gèle la DONNÉE — objets littéraux et tableaux —, récursivement. Une instance de classe (`Map`,
 *  `Set`, tableau typé, objet three.js…) n'est pas de la donnée de scène : elle n'est ni gelée ni
 *  parcourue. */
function gelerProfond(racine: object): void {
  const pile: object[] = [racine];
  while (pile.length) {
    const o = pile.pop()!;
    if (gelesEnProfondeur.has(o)) continue;
    const proto = Object.getPrototypeOf(o);
    if (!Array.isArray(o) && proto !== Object.prototype && proto !== null) continue;
    gelesEnProfondeur.add(o);
    Object.freeze(o);
    for (const v of Object.values(o)) if (v !== null && typeof v === 'object') pile.push(v);
  }
}

/**
 * Mémoïsation par IDENTITÉ de référence — le patron CANONIQUE de tout cache dérivé de la `Scene`
 * (opacité de vision, arêtes de murs, empreintes de décor…). Sûr car TOUTE mutation de la donnée
 * observée renvoie une NOUVELLE réf (jamais une mutation en place) : un pas d'exploration/combat
 * qui ne change rien ne change pas la réf → zéro reconstruction ; une mutation réelle (porte,
 * décor, structure) passe TOUJOURS par un spread `{ ...x, … }` qui invalide le cache pour l'appel
 * suivant. AUCUNE invalidation manuelle : une garde de synchronisation est un smell (credo) — la
 * seule source de vérité est l'identité de la réf observée. UN SEUL patron — ne pas en recréer un
 * second à côté.
 */
export function memoByRef<K extends object, V>(build: (key: K) => V): (key: K) => V {
  const cache = new WeakMap<K, V>();
  return (key: K) => {
    if (cache.has(key)) return cache.get(key)!;
    if (GELER_LES_CLES) gelerProfond(key);
    const value = build(key);
    cache.set(key, value);
    return value;
  };
}

/**
 * Mémoïsation par identité de référence ET par identité d'un jeu de DÉPENDANCES — bâtie sur
 * `memoByRef` (le slot par élément, ci-dessus), pour les caches qui ne dépendent pas que de la
 * clef mais aussi d'un contexte extérieur (dimensions d'écran, options de détail, cran de LOD…).
 * UNE SEULE variante est retenue par élément (la dernière) : un changement de dépendance (rotation,
 * zoom…) touche généralement TOUS les éléments mémoïsés à la fois, donc en garder plusieurs par
 * élément n'éviterait aucun recalcul et ferait seulement enfler la mémoire. Les dépendances sont
 * comparées par identité (`===`), position par position — AUCUNE invalidation manuelle, même
 * raison que `memoByRef`.
 */
export function memoByRefDeps<K extends object, V>(): (key: K, deps: readonly unknown[], build: () => V) => V {
  const slotOf = memoByRef((_key: K) => ({ deps: null as readonly unknown[] | null, value: undefined as V | undefined }));
  return (key, deps, build) => {
    const slot = slotOf(key);
    if (slot.deps !== null && slot.deps.length === deps.length && slot.deps.every((d, i) => d === deps[i])) {
      return slot.value as V;
    }
    const value = build();
    slot.value = value;
    slot.deps = deps;
    return value;
  };
}
