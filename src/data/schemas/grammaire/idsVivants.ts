/**
 * IDS VIVANTS (#1686 lot 3a-2) — le SECOND régime du registre d'ids, celui de la MÉMOIRE.
 *
 * `_ids.generated.ts` déclare deux régimes : le fichier figé au commit (`npm run gen`), et le
 * recalcul depuis les datasets EN MÉMOIRE, seul régime juste dès qu'une entité est créée ou renommée
 * à l'atelier — sans lui, une entité neuve est invalide pour toute donnée qui la référence tant que
 * le générateur n'a pas tourné.
 *
 * Ce module est une FEUILLE : il n'importe que les feuilles `sourcesDeSpecs.ts` et `cle-d-espace.ts`. C'est ce qui le rend consommable par `ref.ts`, que
 * le registre généré ne peut pas atteindre (`_registry.generated.ts` importe les defs, qui appellent
 * `idDe` à l'initialisation — lire le registre depuis `ref.ts` fermerait le cycle). La couche DONNÉE
 * (`src/data/overrides.ts`, propriétaire des bindings mutés en place) POSE sa source ici ; sans
 * source posée (scripts, gardes, `npm run gen` : aucun état d'application), tout rend `undefined` et
 * l'appelant retombe sur le fichier généré.
 *
 * Chaque liste rendue est un `Set` MÉMORISÉ par (fichier, version) : la version vient de la source
 * (`SourceDIdsVivants.version`), seul témoin d'une écriture au seam — un binding muté en place garde
 * son identité. Poser une source vide le mémo.
 */

import { SOURCES_DE_SPECS, type SourceDeSpecs } from './sourcesDeSpecs.ts';
import { idsSurLaRacine, lireCleDEspace, type CleLue } from './cle-d-espace.ts';

/** Ce que la couche donnée fournit : les entrées VIVES d'un document et sa version. */
export interface SourceDIdsVivants {
  /** Entrées en mémoire d'un document, par nom de fichier (`materials.json`) — `undefined` si ce
   *  document n'a pas de binding mutable (il n'a alors rien qui puisse diverger du fichier généré). */
  readonly entrees: (fichier: string) => readonly Record<string, unknown>[] | undefined;
  /** Version des entrées d'un document : change à chaque écriture au seam, jamais entre deux. */
  readonly version: (fichier: string) => number;
}

let source: SourceDIdsVivants | undefined;

/** Mémo des listes vives : clé d'espace → (version du document, ids). */
const memo = new Map<string, { readonly version: number; readonly ids: ReadonlySet<string> }>();

/** Pose la source vivante — appelée UNE fois par la couche donnée au chargement de ses bindings — et
 *  REND la source précédente (`undefined` = aucune) : c'est la couture par laquelle un test repose
 *  celle qu'il a trouvée au lieu de muter le registre généré. */
export function poserSourceDIdsVivants(s: SourceDIdsVivants | undefined): SourceDIdsVivants | undefined {
  const precedente = source;
  source = s;
  memo.clear();
  memoSpecs.clear();
  return precedente;
}

/** Ids des entrées VIVES d'un espace de RACINE, filtré ou non, dans l'ordre de la donnée —
 *  `undefined` hors de ce régime (aucune source, aucun binding, espace niché). */
function entreesRetenues(cle: string, lue: CleLue): readonly string[] | undefined {
  if (!source || lue.niche !== undefined) return undefined;
  const entrees = source.entrees(lue.fichier);
  return entrees && idsSurLaRacine(cle, entrees);
}

/**
 * Ids d'un espace, par sa CLÉ D'ESPACE (`grammaire/cle-d-espace.ts`), tels que la MÉMOIRE les porte —
 * `undefined` si aucune source n'est posée, si le document n'a pas de binding mutable, ou si l'espace
 * est niché : l'appelant lit alors l'INDEX DES IDS généré.
 */
export function idsVivants(cle: string): ReadonlySet<string> | undefined {
  const lue = lireCleDEspace(cle);
  if (!source) return undefined;
  const version = source.version(lue.fichier);
  const connu = memo.get(cle);
  if (connu && connu.version === version) return connu.ids;
  const ids = entreesRetenues(cle, lue);
  if (!ids) return undefined;
  const set = new Set(ids);
  memo.set(cle, { version, ids: set });
  return set;
}

/** Mémo des catalogues de spécialisations vivants : (fichier, id) → (versions lues, catalogue). */
const memoSpecs = new Map<string, { readonly versions: string; readonly specs: readonly string[] }>();

/**
 * Catalogue de SPÉCIALISATIONS de l'entrée `id` du document `fichier` tel que la mémoire le porte : ses
 * `specs[].id`, ou l'UNIVERS de sa `specsSource` (`sourcesDeSpecs.ts`), lu à sa clé d'espace — même
 * calcul que l'espace `<fichier>#[<id>].specs` de l'INDEX DES IDS (`npm run gen`). `undefined` si aucune
 * source, si le document (ou l'univers de la source) n'a pas de binding-liste mutable : l'appelant lit
 * alors l'INDEX DES IDS généré.
 */
export function specsVivantesDe(fichier: string, id: string): readonly string[] | undefined {
  if (!source) return undefined;
  const entrees = source.entrees(fichier);
  if (!entrees) return undefined;
  const e = entrees.find((x) => x.id === id);
  const declaration: SourceDeSpecs | undefined =
    typeof e?.specsSource === 'string' ? (SOURCES_DE_SPECS as Record<string, SourceDeSpecs>)[e.specsSource] : undefined;
  const univers = declaration ? lireCleDEspace(declaration.univers) : undefined;
  const universVivant = declaration && univers ? entreesRetenues(declaration.univers, univers) : undefined;
  if (univers && !universVivant) return undefined;
  const versions = `${source.version(fichier)}/${univers ? source.version(univers.fichier) : ''}`;
  const cle = `${fichier}\u0000#${id}`;
  const connu = memoSpecs.get(cle);
  if (connu && connu.versions === versions) return connu.specs;
  const specs =
    universVivant ??
    (Array.isArray(e?.specs)
      ? (e.specs as unknown[]).flatMap((x) => (x && typeof (x as { id?: unknown }).id === 'string' ? [(x as { id: string }).id] : []))
      : []);
  memoSpecs.set(cle, { versions, specs });
  return specs;
}
