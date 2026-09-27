/**
 * VERSION DES DATASETS (#1692) — le témoin d'ÉDITION porté par le SEAM de mutation, et rien d'autre.
 *
 * `src/data/overrides.ts` remplace le CONTENU d'un dataset sans jamais réassigner son binding
 * (`arr.splice(0, arr.length, …)`) : l'identité du tableau ne dit donc RIEN d'une édition, et tout
 * index construit une fois à l'import sert l'ancien monde jusqu'au rechargement de la page. Ce module
 * porte le compteur qu'un lecteur indexé consulte pour savoir si son index est encore juste.
 *
 * Il est une FEUILLE : il n'importe RIEN d'exécutable (le seul import est un `import type`, effacé à
 * la compilation). C'est ce qui le rend consommable par `src/data/index.ts`, que le seam ne peut pas
 * atteindre (`overrides.ts` importe `./index` : y poser le compteur fermerait le cycle et le lirait
 * en TDZ). Même patron que `schemas/grammaire/idsVivants.ts`, l'autre module feuille posé par la
 * couche donnée.
 */
import type { CleDeDataset } from './schemas/_cles-de-dataset.generated';

/** Le compteur d'UN dataset, dans une CELLULE que le mémo capture UNE fois : une lecture chaude n'est
 *  plus une recherche par chaîne dans une `Map` mais une lecture de champ. */
type Cellule = { v: number };

const VERSIONS = new Map<string, Cellule>();

function cellule(cle: CleDeDataset): Cellule {
  let c = VERSIONS.get(cle);
  if (!c) VERSIONS.set(cle, (c = { v: 0 }));
  return c;
}

/** Version courante d'un dataset — 0 tant qu'aucune édition n'a eu lieu, +1 par écriture au seam. */
export function versionDuDataset(cle: CleDeDataset): number {
  return VERSIONS.get(cle)?.v ?? 0;
}

/** Version de TOUS les datasets à la fois : la somme de leurs compteurs, qui croît strictement à chaque
 *  écriture au seam sur n'importe quelle clé (`bumperDataset` n'incrémente jamais que d'un). Le témoin
 *  d'une valeur dérivée d'un document qui référence le catalogue ENTIER — le verdict de schéma d'une
 *  scène (`state/validateScene.ts`). */
export function versionDesDatasets(): number {
  let v = 0;
  for (const c of VERSIONS.values()) v += c.v;
  return v;
}

/** Marque un dataset comme ÉDITÉ — appelée par le seam d'écriture (`setDataset`/`setObjectDataset`/
 *  `resetData`), jamais par un lecteur. Tout index mémoïsé sur cette clé se reconstruira à sa
 *  prochaine lecture. */
export function bumperDataset(cle: CleDeDataset): void {
  cellule(cle).v += 1;
}

/**
 * Mémo d'une valeur DÉRIVÉE d'un dataset, invalidé par sa version — le NOYAU partagé de tout index
 * vivant (`indexParId`/`indexParChamp`, `src/data/index.ts`) et de toute vue dérivée (`TRAITS`,
 * `siegeEngines`, `indexDesTerrains`, `defsGlobaux`). Le calcul est PARESSEUX : rien ne se construit à
 * l'import, la première lecture paie.
 */
export function memoParVersion<T>(cle: CleDeDataset | readonly CleDeDataset[], calcul: () => T): () => T {
  const cellules = (typeof cle === 'string' ? [cle] : cle).map(cellule);
  // Le témoin est un NOMBRE, jamais une chaîne fabriquée à la lecture : `bumperDataset` n'INCRÉMENTE
  // (jamais de remise à zéro), donc la SOMME des versions croît strictement à chaque écriture sur
  // l'une quelconque des clés — aucune collision possible, et le chemin chaud n'alloue rien.
  const somme = (): number => {
    let v = 0;
    for (let i = 0; i < cellules.length; i++) v += cellules[i].v;
    return v;
  };
  let version = -1;
  let valeur: T;
  return () => {
    const v = somme();
    if (v !== version) {
      valeur = calcul();
      version = v;
    }
    return valeur;
  };
}

/**
 * INDEX VIVANT par un CHAMP quelconque (libellé, libellé minuscule, Vent, manœuvre octroyée…) : rend
 * l'ACCESSEUR, jamais la `Map` — l'index se reconstruit tout seul à la première lecture qui suit une
 * écriture au seam. `entrees` est le binding VIVANT du dataset (muté en place, identité stable) ;
 * une clef `undefined` écarte l'entrée de l'index (filtre porté par la clef, jamais par un
 * `entrees.filter(…)` qui figerait un tableau).
 */
export function indexParChamp<T, K>(
  cle: CleDeDataset,
  entrees: readonly T[],
  clef: (e: T) => K | undefined,
): (k: K | null | undefined) => T | undefined {
  const index = memoParVersion(cle, () => {
    const m = new Map<K, T>();
    for (const e of entrees) {
      const c = clef(e);
      if (c !== undefined) m.set(c, e);
    }
    return m;
  });
  return (k) => (k == null ? undefined : index().get(k));
}

/** INDEX VIVANT par `id` STABLE — la forme de très loin la plus fréquente d'`indexParChamp`. */
export function indexParId<T extends { id: string }>(
  cle: CleDeDataset,
  entrees: readonly T[],
): (id: string | null | undefined) => T | undefined {
  return indexParChamp(cle, entrees, (e) => e.id);
}
