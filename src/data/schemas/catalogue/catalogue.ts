/**
 * LECTURES du catalogue composé (#5069, `docs/plans/2026-11-25-composition-d-un-jeu.md` § 5.1) : une règle reçoit le
 * `Catalogue` en argument et ne lit que lui.
 */
import type { Catalogue, CollectionDuDataset } from '../_catalogue.generated';
import { DATASET_DE_L_ESPACE } from '../_cles-de-dataset.generated';
import type { ValeurDeRegle } from '../_ids.generated';
import { suivreLeChemin } from '../grammaire/cle-d-espace';
import { entreeEffective, type LectureDeRegle, type VarianteReglee } from '../../../engine/variantes';
import type { RegleOptionnelleId, RuleValue } from '../../../engine/policy';
import { memoParIdentiteEtDeps } from '../../../lib/memoParIdentite';
import { estObjet } from '../../../lib/objet.mjs';
import { t } from '../../../i18n';

export type { Catalogue };

/** Ce que retient une partie : les règles optionnelles qu'elle a choisies, sur tous les livres de la bibliothèque. */
export interface Composition {
  readonly regles: Catalogue['regles'];
}

/** Une clé de dataset dont la collection est une liste d'entrées à `id`. */
export type CleDeListe = { [K in keyof CollectionDuDataset]: CollectionDuDataset[K] extends readonly { readonly id: string }[] ? K : never }[keyof CollectionDuDataset];

/** Une entrée du dataset `K`, au type de sa collection dans le `Catalogue`. */
export type EntreeDuDataset<K extends CleDeListe> = CollectionDuDataset[K][number];

const AUCUNE: readonly never[] = Object.freeze([]);

/** Le dataset de chaque collection-LISTE, par sa clé : son fichier et le chemin de sa collection dans sa racine. */
const DATASET_DE_LA_CLE = new Map(Object.values(DATASET_DE_L_ESPACE).map((d) => [d.cle, d] as const));

/** La collection du dataset `K` dans `cat`, au bout de son chemin (`suivreLeChemin`) ; un document absent se lit comme
 *  une collection vide. */
export function collectionDuCatalogue<K extends CleDeListe>(cle: K, cat: Catalogue): CollectionDuDataset[K] {
  const { fichier, chemin } = DATASET_DE_LA_CLE.get(cle)!;
  return (suivreLeChemin(Reflect.get(cat, fichier), chemin) ?? AUCUNE) as CollectionDuDataset[K];
}

/** L'index par `id` d'une collection, mémoïsé par son identité et par celle du catalogue : le fossile 1
 *  (`src/data/catalogueDuProcessus.ts`) compose sur la base que `src/data/overrides.ts` mute en place. */
const indexDe = memoParIdentiteEtDeps<readonly { readonly id: string }[], ReadonlyMap<string, unknown>>();

/** L'entrée `id` du dataset `cle` de `cat`, `undefined` si aucune. */
export function entreeDe<K extends CleDeListe>(cle: K, id: string | null | undefined, cat: Catalogue): EntreeDuDataset<K> | undefined {
  if (id == null) return undefined;
  const collection: readonly EntreeDuDataset<K>[] = collectionDuCatalogue(cle, cat);
  const index = indexDe(collection, [cat], () => new Map(collection.map((e) => [e.id, e])));
  return index.get(id) as EntreeDuDataset<K> | undefined;
}

/** Valeur EFFECTIVE de la règle optionnelle `id` sous `cat` : le choix de sa composition, sinon le défaut du registre
 *  des règles de `cat`. Un id hors du registre LÈVE. */
export function regle<I extends RegleOptionnelleId>(id: I, cat: Catalogue): ValeurDeRegle[I];
export function regle(id: RegleOptionnelleId, cat: Catalogue): RuleValue {
  const def = entreeDe('reglesOptionnelles', id, cat);
  if (!def) throw new Error(t('houseRules.refus.inconnue', { id }));
  return cat.regles[id] ?? def.default;
}

/** Entrée OUVERTE au joueur (carrière, espèce, objet) sous `cat` : sans `gatedByRule`, ou sa règle optionnelle active.
 *  ADE I 07 l.9 ; NADJ 14 l.5 ; ADE II 02 l.110 ; #4208 */
export const ouvertParSaRegle = (
  entree: Pick<EntreeDuDataset<'careers'> | EntreeDuDataset<'species'> | EntreeDuDataset<'trappings'>, 'gatedByRule'>,
  cat: Catalogue,
): boolean =>
  !entree.gatedByRule || !!regle(entree.gatedByRule.id, cat);

/** L'entrée porte-t-elle des variantes réglées ? */
const aDesVariantes = (e: unknown): e is { readonly variants: readonly VarianteReglee[] } => estObjet(e) && Array.isArray(e.variants);

/** Les documents et les règles, au type du `Catalogue` : la bibliothèque est validée par ses schémas
 *  (`src/data/schemas/validate.test.ts`), une suite déclare ses documents à leur type (`LivreDeTest`). */
const enCatalogue = (documents: Readonly<Record<string, unknown>>, regles: Catalogue['regles']): Catalogue =>
  ({ ...documents, regles }) as Catalogue;

/**
 * Le CATALOGUE de `composition` sur `bibliotheque` (fichier → racine) : une valeur neuve, dont l'identité tient lieu de
 * version. Chaque entrée à variantes d'une liste de racine y est EFFECTIVE (`entreeEffective`) sous les règles de la
 * composition ; aucune entrée n'est retirée.
 */
export function composer(bibliotheque: Readonly<Record<string, unknown>>, composition: Composition): Catalogue {
  const brut = enCatalogue(bibliotheque, composition.regles);
  const lire: LectureDeRegle = (id) => regle(id, brut);
  const effectifs = Object.fromEntries(
    Object.entries(bibliotheque).map(([fichier, racine]) => [
      fichier,
      Array.isArray(racine) && racine.some(aDesVariantes) ? racine.map((e: unknown) => (aDesVariantes(e) ? entreeEffective(e, lire) : e)) : racine,
    ]),
  );
  return enCatalogue(effectifs, composition.regles);
}
