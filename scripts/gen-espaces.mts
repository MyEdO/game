/**
 * PHASE 2 de `npm run gen` (#1463) — l'INDEX DES IDS (`src/data/_ids.generated.ts`,
 * `IDS_PAR_ESPACE`), keyé par CLÉ D'ESPACE (`src/data/schemas/grammaire/cle-d-espace.ts`), ses TYPES
 * (`src/data/schemas/_ids.generated.ts` : `IdsParEspace`, et le TYPE DE VALEUR de chaque règle optionnelle,
 * `ValeurDeRegle`), le type `Catalogue` (`src/data/schemas/_catalogue.generated.ts`, #5069), les CLÉS
 * DE DATASET (`src/data/schemas/_cles-de-dataset.generated.ts`, `CLES_DE_DATASET`), le domaine de
 * `DATASET_FICHIER_DERIVE` (`src/data/schemas/exposition-derivee.ts`), avec la CATÉGORIE CODEX de chaque
 * fichier qui en déclare exactement une (`CATEGORIE_CODEX_DU_FICHIER`, lue sur l'`exposition.codex` des
 * defs), la BIBLIOTHÈQUE et les RACINES VIVANTES (`src/data/_racines-vivantes.generated.ts`, `BIBLIOTHEQUE`,
 * chaque document de `SCHEMA_DEFS`, et `RACINES_VIVANTES`, l'image du domaine), et les FICHIERS DE
 * L'ATELIER (`src/data/schemas/_fichiers-de-l-atelier.generated.json`) : le chemin de chaque fichier d'une catégorie
 * éditable du Codex, que le dépôt servi écrit (`hotes/godot/servir.mjs`, `PUT donnees/<fichier>`).
 *
 * Le JSON disque de chaque document de `SCHEMA_DEFS` est CO-DESCENDU avec son schéma, sans parse
 * (`collectionsDesDocuments`, `grammaire/collection-cle.ts`) : chaque collection marquée `espace` y
 * nomme sa clé, ses paramètres `discriminant`/`marqueurs` ses espaces filtrés, et une entrée à
 * `specsSource` l'espace de ses `specs` ; chaque VOCABULAIRE (`grammaire/vocabulaires.ts`) qu'une source de
 * spécialisations prend pour univers ou pool, ou qu'un type de `TYPES` (`grammaire/ref.ts`) prend pour
 * espace (#2968 P-art), a son espace — celui qui ne donne à une source que ses libellés porte exactement les
 * ids de son univers —, la SOUS-LISTE MARQUÉE (`?!champ,…`) qu'une
 * source prend pour univers ou pool a la sienne, et le catalogue de spécialisations de chaque
 * entrée OUVERTE son espace de LIBELLÉS. Les ids de chaque clé sont ceux d'`idsDeLEspace`, le calcul
 * que le régime vivant fait sur les racines vivantes (`src/data/overrides.ts`), dans l'ORDRE DE LA
 * DONNÉE. Aucune validation n'y lit l'index : un espace neuf et son premier désignateur entrent dans
 * le même commit — et une table VIDE rend le même index : un index en conflit ou sans `IDS_PAR_ESPACE`
 * est remplacé par une table vide AVANT que les modules qui l'importent (`_registry.generated` → defs →
 * `grammaire/ref.ts`) ne se chargent.
 *
 * La production du registre (`scripts/gen-registry.mjs`) enchaîne cette phase après les registres.
 * Sa porte `--check` compare les cibles sans écrire (`npm run docs:check`).
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import type { SchemaDef } from '../src/data/schemas/types';
import type { AccesAuxDocuments, CollectionDeFichier, MarqueDeCollection } from '../src/data/schemas/grammaire/collection-cle';
import {
  baseDe,
  champsDiscriminants,
  cleDesLibelles,
  cleDesSpecs,
  cleDuVocabulaire,
  cleFiltree,
  cleNichee,
  HORS_DE_LA_GRAPHIE,
  lireCleDEspace,
  pasDeLaSuite,
  suiteAvecPas,
  suivreLeChemin,
  valeurDuDiscriminant,
  type PasResolu,
} from '../src/data/schemas/grammaire/cle-d-espace';
import { SOURCES_DE_SPECS, type SourceDeSpecs } from '../src/data/schemas/grammaire/sourcesDeSpecs';
import { parUnitesDeCode } from './guards/lib/lister.mjs';
import { litteralJs } from './guards/lib/litteralJs.mjs';
import type { CibleRendue } from './docs/lib/ecriture-derives.mjs';
import { RACINE_DES_CATALOGUES, REGISTRIES, SORTIES_DES_ESPACES } from './docs/lib/cibles-registres.mjs';
import { lireDefs } from './gen-registry.mjs';
import { estObjet } from '../src/lib/objet.mjs';

const { ids: SORTIE, typesDesIds: SORTIE_TYPES_DES_IDS, cles: SORTIE_CLES, racines: SORTIE_RACINES, catalogue: SORTIE_CATALOGUE, atelier: SORTIE_ATELIER } = SORTIES_DES_ESPACES;

/** Le registre des defs de document (`SCHEMA_DEFS`), dont le module de chaque def type sa collection du `Catalogue`. */
const REGISTRE_DES_DOCUMENTS = REGISTRIES.find((r) => r.arrayName === 'SCHEMA_DEFS')!;

/** Table VIDE : ce que la phase 2 pose à la place d'un index illisible. */
export const TABLE_VIDE = 'export const IDS_PAR_ESPACE: Readonly<Record<string, readonly string[]>> = {};\n';

/** L'index en texte est-il chargeable : il exporte `IDS_PAR_ESPACE` et ne porte aucun marqueur de conflit ? */
export function indexChargeable(texte: string): boolean {
  return /^export const IDS_PAR_ESPACE\b/m.test(texte) && !/^(<{7}|={7}|>{7})( |$)/m.test(texte);
}

/** Les éléments d'une collection-LISTE marquée, avec leur clé. */
function elementsCles(c: CollectionDeFichier): [Record<string, unknown>, string][] {
  if (c.marque.forme !== 'liste' || !Array.isArray(c.valeur))
    throw new Error(`gen-espaces: ${c.cle} : un filtre d'espace (\`discriminant\`, \`marqueurs\`) exige une collection-LISTE.`);
  const de = c.marque.de;
  return c.valeur.flatMap((el) => {
    const cle = de(el);
    return estObjet(el) && cle !== undefined ? [[el, cle] as [Record<string, unknown>, string]] : [];
  });
}

/** Les clés d'espace d'une collection marquée `espace` : la sienne, ses espaces filtrés, et l'espace des
 *  `specs` de chaque élément à `specsSource`. */
function clesDe(c: CollectionDeFichier): string[] {
  const espace = c.marque.espace!;
  const cles = [c.cle];
  for (const champ of champsDiscriminants(espace)) {
    const valeurs = new Set<string>();
    for (const [el, cle] of elementsCles(c)) {
      const vaut = valeurDuDiscriminant(el, champ);
      if (vaut === undefined) continue;
      if (HORS_DE_LA_GRAPHIE.test(vaut)) throw new Error(`gen-espaces: ${c.cle} « ${cle} » : la valeur de discriminant « ${vaut} » porte ?, =, # ou !.`);
      valeurs.add(vaut);
    }
    if (!valeurs.size) throw new Error(`gen-espaces: ${c.cle} : discriminant « ${champ} » qu'aucun élément ne porte.`);
    for (const vaut of valeurs) cles.push(cleFiltree(c.cle, { champ, vaut }));
  }
  for (const champ of espace.marqueurs ?? []) cles.push(cleFiltree(c.cle, { champ }));
  if (c.marque.forme === 'liste') for (const [el, cle] of elementsCles(c)) if ('specsSource' in el) cles.push(cleDesSpecs(c.cle, cle));
  return cles;
}

/** Les espaces de LIBELLÉS que la grammaire lit (`refusDeSpec`, `grammaire/ref.ts`) : ceux du catalogue de
 *  spécialisations de chaque entrée OUVERTE (marqueur `specsOpen`) qui en porte un. */
function libellesDesEntreesOuvertes(table: ReadonlyMap<string, readonly string[]>): string[] {
  return [...table].flatMap(([cle, ids]) => {
    const lue = lireCleDEspace(cle);
    if (lue.filtre?.champ !== 'specsOpen' || lue.filtre.vaut !== undefined) return [];
    return ids.map((id) => cleDesSpecs(baseDe(lue), id)).filter((specs) => table.has(specs)).map((specs) => cleDesLibelles(specs));
  });
}

/** Le registre des règles optionnelles (`engine/policy.ts`), dont chaque règle a son TYPE DE VALEUR. */
const FICHIER_DES_REGLES = 'reglesOptionnelles.json';

/** Ce que le type de valeur d'une règle lit sur son entrée. */
interface RegleDuRegistre {
  readonly id: string;
  readonly kind: 'flag' | 'param' | 'mode';
  readonly options?: readonly string[];
}

/** Le TYPE DE VALEUR de la règle `r`, en texte TS : `boolean` (flag), `number` (param), l'union de ses `options` (mode). */
function typeDeValeur(r: RegleDuRegistre): string {
  switch (r.kind) {
    case 'flag':
      return 'boolean';
    case 'param':
      return 'number';
    case 'mode':
      return (r.options ?? []).map(litteralJs).join(' | ');
  }
}

/** Un document de `SCHEMA_DEFS` : son `file` et son chemin sous le dépôt (`root`/`file`). */
interface DocumentDeDataset {
  readonly fichier: string;
  readonly chemin: string;
}

/** Un document de `SCHEMA_DEFS` et le chemin sous le dépôt du module de son def, sans extension. */
interface DocumentDeLaBibliotheque extends DocumentDeDataset {
  readonly def: string;
}

/** La collection d'une catégorie Codex lue par la porte `entreeDeCategorie` : sa clé de dataset, son
 *  fichier et le chemin RÉSOLU de sa suite dans la racine vivante de ce fichier. */
interface CollectionDeCategorie {
  readonly categorie: string;
  readonly cle: string;
  readonly fichier: string;
  readonly chemin: readonly PasResolu[];
}

/** Tête du module des clés : le type d'une rangée de `DATASET_DE_LA_CATEGORIE` et de `DATASET_DE_L_ESPACE`
 *  (import de type seul, le module reste sans import exécutable). */
const TYPE_DATASET_DE_CATEGORIE =
  `import type { PasResolu } from './grammaire/cle-d-espace';\n\n` +
  `/** Une rangée de \`DATASET_DE_LA_CATEGORIE\` et de \`DATASET_DE_L_ESPACE\` : un dataset et le chemin de sa collection. */\n` +
  `export interface DatasetDeCategorie {\n  readonly cle: CleDeDataset;\n  readonly fichier: string;\n  readonly chemin: readonly PasResolu[];\n}\n\n`;

/** Le type TS de la collection au bout de `chemin` depuis le type `racine` : un pas `champ` lit le champ, un pas `[clé]` un
 *  élément de la liste. */
const typeDuChemin = (racine: string, chemin: readonly PasResolu[]): string =>
  `NonNullable<${chemin.reduce((t, pas) => ('champ' in pas ? `NonNullable<${t}>[${litteralJs(pas.champ)}]` : `NonNullable<${t}>[number]`), racine)}>`;

/** Littéral JS d'un pas résolu. */
const litteralDePas = (pas: PasResolu): string =>
  'champ' in pas ? `{ champ: ${litteralJs(pas.champ)} }` : `{ cle: ${litteralJs(pas.cle)}, par: ${litteralJs(pas.par)} }`;

/** Catégories à dataset dont la collection n'est pas une liste d'entrées `{ id, label }`, et pourquoi :
 *  hors de la porte `entreeDeCategorie`. */
const HORS_DE_LA_PORTE: Readonly<Record<string, string>> = {
  dispersion: 'rangées sans `label` : une face du dé, que son décalage désigne (LDB 14 l.146-149)',
  navalProgression: 'entrées sans `label`',
  obsessions: 'rangées sans `label` : leur `id` est un Groupe (`groups.json`), qui porte le libellé',
  reactionAuStatut: 'rangées sans `label` : leur `issue` (`issueDeReactionSchema`) porte le libellé (LDB 08 l.43-45)',
  shipConstructionTraits: 'entrées sans `label`',
  shipHullSizes: 'entrées sans `label`',
  tableauCapricieux: 'rangées sans `label` : une fourchette du dé, que son modificateur de DR désigne (MSRC 15 l.153-159)',
};

/** `suite` résolue contre `schema` en pas lisibles sans lui (`suivreLeChemin`) : un pas `[clé]` y porte
 *  le nom de la clé de la liste marquée qu'il traverse. LÈVE sur un pas `[]`, ou sur un pas `[clé]` hors
 *  d'une liste marquée dont la clé se lit au champ de son nom. */
function cheminResolu(
  schema: unknown,
  racine: unknown,
  suite: string,
  atteindre: (schema: unknown, racine: unknown, suite: string) => { readonly marque: MarqueDeCollection; readonly valeur: unknown } | undefined,
  dit: string,
): PasResolu[] {
  const chemin: PasResolu[] = [];
  let prefixe = '';
  for (const pas of pasDeLaSuite(suite)) {
    if ('rang' in pas) throw new Error(`gen-espaces: ${dit} : pas « [] », qui ne désigne pas UN point.`);
    if ('cle' in pas) {
      const liste = atteindre(schema, racine, prefixe);
      const marque = liste?.marque;
      if (marque?.forme !== 'liste' || !Array.isArray(liste!.valeur)) throw new Error(`gen-espaces: ${dit} : le pas « [${pas.cle}] » ne traverse pas une liste marquée.`);
      for (const el of liste!.valeur as unknown[])
        if (marque.de(el) !== (el as Record<string, unknown>)[marque.nom]) throw new Error(`gen-espaces: ${dit} : la clé de la liste traversée par « [${pas.cle}] » ne se lit pas au champ « ${marque.nom} ».`);
      chemin.push({ cle: pas.cle, par: marque.nom });
    } else chemin.push({ champ: pas.champ });
    prefixe = suiteAvecPas(prefixe, pas);
  }
  return chemin;
}

/** L'INDEX DES IDS (clé d'espace → ids, dans l'ordre de la donnée), les CLÉS DE DATASET et les documents
 *  de leur image. Les modules qui importent l'index se chargent ICI, par `import()` : l'appelant a déjà
 *  rendu l'index chargeable. */
export async function indexDesIds(): Promise<{ table: Map<string, readonly string[]>; clesDeDataset: string[]; categories: [string, string][]; clesCodex: string[]; collections: CollectionDeCategorie[]; datasetsDeLEspace: [string, { readonly cle: string; readonly fichier: string; readonly chemin: readonly PasResolu[] }][]; racines: DocumentDeDataset[]; documents: DocumentDeLaBibliotheque[]; fichiersDeLAtelier: [string, string][]; valeursDeRegle: [string, string][] }> {
  const { SCHEMA_DEFS } = (await import('../src/data/schemas/_registry.generated')) as { SCHEMA_DEFS: SchemaDef[] };
  const { atteindre, cleDesLibellesDeLaSource, collectionsDesDocuments, idsDeLEspace, lectureDeLEspace } = await import('../src/data/schemas/grammaire/collection-cle');
  const { lectureDuVocabulaire } = await import('../src/data/schemas/grammaire/vocabulaires');
  const { TYPES } = await import('../src/data/schemas/grammaire/ref');
  const { CATEGORY_DATASET_DERIVE, DATASET_FICHIER_DERIVE, DATASET_SUITE_DERIVE, OBJECT_CATEGORY_DERIVE } = await import('../src/data/schemas/exposition-derivee');
  const brutParNom = new Map(SCHEMA_DEFS.map((d) => [d.file, JSON.parse(readFileSync(join(RACINE_DES_CATALOGUES, d.file), 'utf8')) as unknown]));
  const schemaParNom = new Map(SCHEMA_DEFS.map((d) => [d.file, d.schema]));
  const acces: AccesAuxDocuments = (fichier) => (brutParNom.has(fichier) ? { schema: schemaParNom.get(fichier), racine: brutParNom.get(fichier) } : undefined);
  const lire = (c: string) => lectureDuVocabulaire(c) ?? lectureDeLEspace(c, acces);
  const table = new Map<string, readonly string[]>();
  const poser = (cle: string): void => {
    if (table.has(cle)) throw new Error(`gen-espaces: clé d'espace « ${cle} » rendue deux fois.`);
    const ids = idsDeLEspace(cle, lire);
    if (!ids) throw new Error(`gen-espaces: « ${cle} » n'est aucun espace de son document.`);
    if (cle.includes('?') && !ids.length) throw new Error(`gen-espaces: ${cle} : filtre qu'aucun élément ne retient.`);
    table.set(cle, ids);
  };
  const sources = Object.entries(SOURCES_DE_SPECS as Record<string, SourceDeSpecs>);
  const designes = [...sources.flatMap(([, source]) => [source.univers, source.pool ?? source.univers]), ...Object.values(TYPES).map((t) => t.espace)];
  for (const cle of new Set(designes)) if (lectureDuVocabulaire(cle)) poser(cle);
  for (const c of collectionsDesDocuments(SCHEMA_DEFS, brutParNom)) if (c.marque.espace) for (const cle of clesDe(c)) poser(cle);
  for (const [nom, source] of sources) {
    for (const cle of [source.univers, source.pool ?? source.univers]) {
      if (table.has(cle)) continue;
      if (!lireCleDEspace(cle).filtre?.horsMarqueurs) throw new Error(`gen-espaces: SOURCES_DE_SPECS.${nom} : « ${cle} » n'est aucun espace mesuré.`);
      poser(cle);
    }
    if (!idsDeLEspace(cleDesLibellesDeLaSource(source), lire)?.length) throw new Error(`gen-espaces: SOURCES_DE_SPECS.${nom} : son libellé ne se lit sur aucun élément de son univers.`);
    if (!('vocabulaire' in source.libelle)) continue;
    const univers = new Set(table.get(source.univers));
    const libelles = new Set(lectureDuVocabulaire(cleDuVocabulaire(source.libelle.vocabulaire))!.ids);
    const ecart = [...[...univers].filter((id) => !libelles.has(id)).map((id) => `« ${id} » sans libellé`), ...[...libelles].filter((id) => !univers.has(id)).map((id) => `« ${id} » hors de l'univers`)];
    if (ecart.length) throw new Error(`gen-espaces: SOURCES_DE_SPECS.${nom} : le vocabulaire « ${source.libelle.vocabulaire} » et l'univers « ${source.univers} » n'ont pas les mêmes ids — ${ecart.join(', ')}.`);
  }
  for (const cle of libellesDesEntreesOuvertes(table)) poser(cle);
  const defParNom = new Map(SCHEMA_DEFS.map((d) => [d.file, d]));
  const moduleDuDef = new Map(lireDefs(REGISTRE_DES_DOCUMENTS.dir, ['file']).flatMap((d) => (typeof d.file === 'string' ? [[d.file, d.module] as const] : [])));
  const documents = SCHEMA_DEFS.map((d) => d.file).sort(parUnitesDeCode).map((fichier): DocumentDeLaBibliotheque => {
    const def = defParNom.get(fichier)!;
    const module = moduleDuDef.get(fichier);
    if (!module) throw new Error(`gen-espaces: « ${fichier} » n'est le \`file\` d'aucun module de ${REGISTRE_DES_DOCUMENTS.dir}.`);
    return { fichier, chemin: join(def.root, def.file), def: join(REGISTRE_DES_DOCUMENTS.dir, module.replace(/\.tsx?$/, '')) };
  });
  const racines = [...new Set(Object.values(DATASET_FICHIER_DERIVE))].sort(parUnitesDeCode).map((fichier) => {
    const def = defParNom.get(fichier);
    if (!def) throw new Error(`gen-espaces: DATASET_FICHIER_DERIVE désigne « ${fichier} », qu'aucun def de SCHEMA_DEFS ne porte.`);
    return { fichier, chemin: join(def.root, def.file) };
  });
  const categories = SCHEMA_DEFS.flatMap((d): [string, string][] => {
    const codex = d.exposition?.codex;
    return codex && 'keys' in codex && codex.keys.length === 1 ? [[d.file, codex.keys[0]]] : [];
  }).sort(([a], [b]) => parUnitesDeCode(a, b));
  const clesCodex = [...new Set(SCHEMA_DEFS.flatMap((d) => {
    const codex = d.exposition?.codex;
    return codex && 'keys' in codex ? [...codex.keys] : [];
  }))].sort(parUnitesDeCode);
  // Dataset d'une catégorie : sa route d'édition, sinon l'UNIQUE clé de dataset du fichier dont elle est
  // l'unique catégorie (route `none` + `dataset`) ; sa collection, au bout de sa suite (`DATASET_SUITE_DERIVE`).
  const datasetDe = new Map(Object.entries(CATEGORY_DATASET_DERIVE));
  for (const [fichier, categorie] of categories) {
    const cles = Object.keys(DATASET_FICHIER_DERIVE).filter((k) => DATASET_FICHIER_DERIVE[k] === fichier);
    const route = datasetDe.get(categorie);
    if (cles.length !== 1) continue;
    if (route !== undefined && route !== cles[0]) throw new Error(`gen-espaces: la catégorie « ${categorie} » route vers « ${route} », son fichier « ${fichier} » ne porte que « ${cles[0]} ».`);
    datasetDe.set(categorie, cles[0]);
  }
  const collections: CollectionDeCategorie[] = [];
  for (const [categorie, cle] of datasetDe) {
    const fichier = DATASET_FICHIER_DERIVE[cle];
    const suite = DATASET_SUITE_DERIVE[cle];
    if (suite === undefined) continue; // dataset-OBJET : sa collection est la racine, une configuration (`OBJECT_CATEGORY_DERIVE`)
    const schema = schemaParNom.get(fichier);
    const racine = brutParNom.get(fichier);
    const chemin = cheminResolu(schema, racine, suite, atteindre, `« ${cle} » (${fichier}#${suite})`);
    const valeur = atteindre(schema, racine, suite)?.valeur;
    if (suivreLeChemin(racine, chemin) !== valeur) throw new Error(`gen-espaces: le chemin résolu de « ${cle} » (${fichier}#${suite}) n'atteint pas sa collection.`);
    const entrees = Array.isArray(valeur) && valeur.every((e) => typeof e?.id === 'string' && typeof e?.label === 'string');
    const exclue = HORS_DE_LA_PORTE[categorie];
    if (entrees && exclue !== undefined) throw new Error(`gen-espaces: « ${categorie} » est exclue de la porte (${exclue}) mais sa collection est une liste d'entrées { id, label }.`);
    if (!entrees && exclue === undefined) throw new Error(`gen-espaces: la collection de « ${categorie} » (${fichier}#${suite}) n'est pas une liste d'entrées { id, label } : la conformer, ou l'exclure avec sa raison (\`HORS_DE_LA_PORTE\`).`);
    if (entrees) collections.push({ categorie, cle, fichier, chemin });
  }
  for (const categorie of Object.keys(HORS_DE_LA_PORTE))
    if (!datasetDe.has(categorie)) throw new Error(`gen-espaces: \`HORS_DE_LA_PORTE\` nomme « ${categorie} », qui n'est aucune catégorie à dataset.`);
  collections.sort((a, b) => parUnitesDeCode(a.categorie, b.categorie));
  // Dataset de chaque ESPACE : celui dont la collection est au bout de la suite de l'espace (`cleNichee`) —
  // la racine (suite `''`), ou une collection nichée (les rangées d'un document mono-table, `fichier#entries`).
  const datasetsDeLEspace = new Map<string, { readonly cle: string; readonly fichier: string; readonly chemin: readonly PasResolu[] }>();
  for (const cle of Object.keys(DATASET_FICHIER_DERIVE).sort(parUnitesDeCode)) {
    const suite = DATASET_SUITE_DERIVE[cle];
    if (suite === undefined) continue; // dataset-OBJET : aucune collection
    const fichier = DATASET_FICHIER_DERIVE[cle];
    const espace = cleNichee(fichier, suite);
    if (datasetsDeLEspace.has(espace)) throw new Error(`gen-espaces: l'espace « ${espace} » porte deux clés de dataset, « ${datasetsDeLEspace.get(espace)!.cle} » et « ${cle} ».`);
    datasetsDeLEspace.set(espace, { cle, fichier, chemin: cheminResolu(schemaParNom.get(fichier), brutParNom.get(fichier), suite, atteindre, `« ${cle} » (${espace})`) });
  }
  for (const [nom, source] of Object.entries(SOURCES_DE_SPECS as Record<string, SourceDeSpecs>)) {
    if (!('champs' in source.libelle)) continue;
    const lue = lireCleDEspace(source.univers);
    if (lue.niche !== undefined || !datasetsDeLEspace.has(lue.fichier)) throw new Error(`gen-espaces: SOURCES_DE_SPECS.${nom} : le libellé se lit aux champs d'une entrée de la collection de RACINE de son univers (« ${source.univers} »), qui n'en a pas.`);
  }
  const regles = brutParNom.get(FICHIER_DES_REGLES) as readonly RegleDuRegistre[] | undefined;
  if (!regles) throw new Error(`gen-espaces: « ${FICHIER_DES_REGLES} » n'est le fichier d'aucun def de SCHEMA_DEFS.`);
  return {
    table: new Map([...table].sort(([a], [b]) => parUnitesDeCode(a, b))),
    clesDeDataset: Object.keys(DATASET_FICHIER_DERIVE).sort(parUnitesDeCode),
    categories,
    clesCodex,
    collections,
    datasetsDeLEspace: [...datasetsDeLEspace].sort(([a], [b]) => parUnitesDeCode(a, b)),
    racines,
    documents,
    fichiersDeLAtelier: [...new Set([...Object.values(CATEGORY_DATASET_DERIVE), ...Object.values(OBJECT_CATEGORY_DERIVE).map((r) => r.ds)].map((ds) => DATASET_FICHIER_DERIVE[ds]))]
      .sort(parUnitesDeCode).map((fichier): [string, string] => { const def = defParNom.get(fichier)!; return [fichier, join(def.root, def.file).split('\\').join('/')]; }),
    valeursDeRegle: regles.map((r) => [r.id, typeDeValeur(r)]),
  };
}

/** Spécificateur d'import de `chemin` (sous le dépôt) depuis le module généré `sortie`. */
function specificateur(sortie: string, chemin: string): string {
  const rel = relative(dirname(sortie), chemin).split('\\').join('/');
  return rel.startsWith('.') ? rel : `./${rel}`;
}

/** Les sorties de la phase 2, rendues sans écrire, et ce dont leurs statistiques sont faites. */
async function rendu(): Promise<{ textes: Map<string, string>; table: Map<string, readonly string[]>; clesDeDataset: string[]; racines: DocumentDeDataset[]; documents: DocumentDeLaBibliotheque[] }> {
  const { table, clesDeDataset, categories, clesCodex, collections, datasetsDeLEspace, racines, documents, fichiersDeLAtelier, valeursDeRegle } = await indexDesIds();
  const GENERE = `// GÉNÉRÉ par scripts/gen-espaces.mts (phase 2 de \`npm run gen\`) — NE PAS ÉDITER À LA MAIN.\n`;
  const banniere =
    GENERE +
    `// Régénérer : \`npm run gen\` (deux exécutions successives rendent le même octet).\n\n`;
  const enTete =
    banniere +
    `/**\n` +
    ` * INDEX DES IDS : les ids de chaque ESPACE DE NOMS de \`src/data\`, par CLÉ D'ESPACE\n` +
    ` * (\`grammaire/cle-d-espace.ts\`) — la cible de tout \`idDe\` (\`grammaire/ref.ts\`), qui refine l'id AU PARSE.\n` +
    ` *\n` +
    ` * Deux RÉGIMES de lecture, tous deux déclarés :\n` +
    ` *  - CI / DEV / test : ce fichier généré, figé au commit — une référence morte casse au parse ;\n` +
    ` *  - APPLICATION (éditeur compris) : les ids se lisent sur les RACINES VIVANTES, recalculés par version\n` +
    ` *    du dataset à toute écriture du seam (\`src/data/overrides.ts\` pose le régime vivant,\n` +
    ` *    \`grammaire/idsVivants.ts\` le sert à \`ref.ts\`), par le même calcul (\`idsDeLEspace\`), dans l'ordre\n` +
    ` *    de la donnée.\n` +
    ` */\n`;
  const entrees = [...table].map(([cle, ids]) => `  ${litteralJs(cle)}: [${ids.map(litteralJs).join(', ')}],\n`).join('');
  const body = enTete + `export const IDS_PAR_ESPACE: Readonly<Record<string, readonly string[]>> = {\n` + entrees + `};\n`;
  const typesDesIds =
    banniere +
    `/** Union LITTÉRALE des ids de chaque espace : un id absent de la donnée ne compile pas. */\n` +
    `export type IdsParEspace = {\n` +
    [...table].map(([cle, ids]) => `  readonly ${litteralJs(cle)}: ${ids.length ? ids.map(litteralJs).join(' | ') : 'never'};\n`).join('') +
    `};\n\n` +
    `/** TYPE DE VALEUR de chaque règle optionnelle (\`${FICHIER_DES_REGLES}\`), que rend \`rule(id)\` (\`engine/policy.ts\`) :\n` +
    ` *  \`boolean\` (flag), \`number\` (param), l'union littérale de ses \`options\` (mode). */\n` +
    `export type ValeurDeRegle = {\n` +
    valeursDeRegle.map(([id, type]) => `  readonly ${litteralJs(id)}: ${type};\n`).join('') +
    `};\n`;
  const cles =
    banniere +
    TYPE_DATASET_DE_CATEGORIE +
    `/** CLÉS DE DATASET : le domaine de \`DATASET_FICHIER_DERIVE\` (\`exposition-derivee.ts\`), une clé par\n` +
    ` *  collection que le seam mute EN PLACE (\`src/data/overrides.ts\`). */\n` +
    `export const CLES_DE_DATASET = [\n` +
    clesDeDataset.map((c) => `  ${litteralJs(c)},\n`).join('') +
    `] as const;\n\n` +
    `/** Une clé de dataset. */\n` +
    `export type CleDeDataset = (typeof CLES_DE_DATASET)[number];\n\n` +
    `/** CATÉGORIE CODEX de chaque fichier qui en déclare exactement une (\`exposition.codex.keys\` de son def) :\n` +
    ` *  celle où s'ouvre la fiche d'une de ses entrées (\`cibleCodex\`, \`src/data/index.ts\`). */\n` +
    `const CATEGORIES = {\n` +
    categories.map(([f, c]) => `  ${litteralJs(f)}: ${litteralJs(c)},\n`).join('') +
    `} as const;\n\n` +
    `export const CATEGORIE_CODEX_DU_FICHIER: Readonly<Record<string, string>> = CATEGORIES;\n\n` +
    `/** Table LITTÉRALE fichier → catégorie, dont \`RenvoiCodex\` (\`grammaire/ref.ts\`) dérive ses renvois typés. */\n` +
    `export type CategorieCodexDuFichier = typeof CATEGORIES;\n\n` +
    `/** CLÉS DE CATÉGORIE CODEX : l'union des \`exposition.codex.keys\` des defs, le domaine EXHAUSTIF du\n` +
    ` *  registre du Codex (\`CODEX_SPECS\`, \`src/noyau/codex/registry.ts\`, \`satisfies Record<CleCodex, …>\`). */\n` +
    `export const CLES_CODEX = [\n` +
    clesCodex.map((c) => `  ${litteralJs(c)},\n`).join('') +
    `] as const;\n\n` +
    `/** Une clé de catégorie Codex. */\n` +
    `export type CleCodex = (typeof CLES_CODEX)[number];\n\n` +
    `/** DATASET de chaque catégorie Codex dont la collection est une liste d'entrées { id, label } : sa clé (index\n` +
    ` *  vivant, \`indexParId\`), son fichier (\`RACINES_VIVANTES\`) et le chemin de sa collection dans sa racine\n` +
    ` *  (\`suivreLeChemin\`) — la porte \`entreeDeCategorie\` (\`src/data/index.ts\`). */\n` +
    `export const DATASET_DE_LA_CATEGORIE: Readonly<Record<string, DatasetDeCategorie>> = {\n` +
    collections.map(({ categorie, cle, fichier, chemin }) => `  ${litteralJs(categorie)}: { cle: ${litteralJs(cle)}, fichier: ${litteralJs(fichier)}, chemin: [${chemin.map(litteralDePas).join(', ')}] },\n`).join('') +
    `};\n\n` +
    `/** DATASET DE CHAQUE ESPACE dont la collection est celle d'une clé de dataset (\`cleNichee\` de son fichier et\n` +
    ` *  de sa suite \`DATASET_SUITE_DERIVE\`) : sa clé (index vivant, \`indexParId\`) et le chemin de sa collection\n` +
    ` *  dans la racine — lus par le libellé d'une source de spécialisations (\`SPEC_SOURCES\`) et par l'espace\n` +
    ` *  d'un type (\`datasetDeLEspaceDuType\`, \`src/data/index.ts\`). */\n` +
    `export const DATASET_DE_L_ESPACE: Readonly<Record<string, DatasetDeCategorie>> = {\n` +
    datasetsDeLEspace.map(([e, { cle, fichier, chemin }]) => `  ${litteralJs(e)}: { cle: ${litteralJs(cle)}, fichier: ${litteralJs(fichier)}, chemin: [${chemin.map(litteralDePas).join(', ')}] },\n`).join('') +
    `};\n`;
  const rang = new Map(documents.map((d, i) => [d.fichier, i]));
  const modRacines =
    GENERE +
    `// Régénérer : \`npm run gen\` (un import par document de \`SCHEMA_DEFS\`).\n` +
    documents.map((d, i) => `import r${i} from ${litteralJs(specificateur(SORTIE_RACINES, d.chemin))};\n`).join('') +
    `\n` +
    `/** BIBLIOTHÈQUE : fichier → racine du document, pour chaque document de \`SCHEMA_DEFS\` (#5069). */\n` +
    `export const BIBLIOTHEQUE: Readonly<Record<string, unknown>> = {\n` +
    documents.map((d, i) => `  ${litteralJs(d.fichier)}: r${i},\n`).join('') +
    `};\n\n` +
    `/** RACINES VIVANTES : fichier → racine du document, pour chaque document qui porte une clé de dataset\n` +
    ` *  (l'image de \`DATASET_FICHIER_DERIVE\`, \`exposition-derivee.ts\`) — le module JSON singleton que le\n` +
    ` *  seam mute EN PLACE (\`src/data/overrides.ts\`). */\n` +
    `export const RACINES_VIVANTES: Readonly<Record<string, unknown>> = {\n` +
    racines.map((r) => `  ${litteralJs(r.fichier)}: r${rang.get(r.fichier)},\n`).join('') +
    `};\n`;
  const catalogue =
    GENERE +
    `// Régénérer : \`npm run gen\` (une collection par document de \`SCHEMA_DEFS\`).\n` +
    `import type { DatasetDe } from ${litteralJs(specificateur(SORTIE_CATALOGUE, 'src/data/datasets'))};\n` +
    `import type { RuleValue } from ${litteralJs(specificateur(SORTIE_CATALOGUE, 'src/engine/policy'))};\n` +
    documents.map((d, i) => `import type * as d${i} from ${litteralJs(specificateur(SORTIE_CATALOGUE, d.def))};\n`).join('') +
    `\n` +
    `/** CATALOGUE : fichier → dataset, une collection par document de \`SCHEMA_DEFS\`, au type de son def (\`DatasetDe\`), et les\n` +
    ` *  règles optionnelles choisies par sa composition (#5069). */\n` +
    `export interface Catalogue {\n` +
    documents.map((d, i) => `  readonly ${litteralJs(d.fichier)}: DatasetDe<typeof d${i}>;\n`).join('') +
    `  readonly regles: Readonly<Record<string, RuleValue>>;\n` +
    `}\n\n` +
    `/** COLLECTION de chaque clé de dataset-LISTE dans le \`Catalogue\` : au bout du chemin de sa collection (\`DATASET_DE_L_ESPACE\`),\n` +
    ` *  dont un pas \`[clé]\` lit un élément de la liste qu'il traverse (#5069). */\n` +
    `export interface CollectionDuDataset {\n` +
    [...datasetsDeLEspace].sort(([, a], [, b]) => parUnitesDeCode(a.cle, b.cle)).map(([, { cle, fichier, chemin }]) => `  readonly ${litteralJs(cle)}: ${typeDuChemin(`Catalogue[${litteralJs(fichier)}]`, chemin)};\n`).join('') +
    `}\n`;
  const atelier = `${JSON.stringify(Object.fromEntries(fichiersDeLAtelier), null, 2)}\n`;
  return { textes: new Map([[SORTIE, body], [SORTIE_TYPES_DES_IDS, typesDesIds], [SORTIE_CLES, cles], [SORTIE_RACINES, modRacines], [SORTIE_CATALOGUE, catalogue], [SORTIE_ATELIER, atelier]]), table, clesDeDataset, racines, documents };
}

/** Le texte d'un module de l'index des ids sur disque, `''` s'il n'existe pas encore. */
function indexSurDisque(chemin: string): string {
  try {
    return readFileSync(chemin, 'utf8');
  } catch {
    return '';
  }
}

/**
 * La phase 2 importe les registres de phase 1 et `grammaire/ref.ts`, qui dépend de l'index qu'elle
 * rend. En écriture, le lanceur pose les amorces nécessaires avant ces imports.
 */
export const AMORCAGE_EN_DEUX_TEMPS = 'amorçage en deux temps de la phase 2 (TABLE_VIDE, puis rendu)';

/** Les deux autres modules de la phase 2, importés par `src/data/overrides.ts`,
 *  `src/data/versionDataset.ts` et `src/data/index.ts` que la phase 2 charge : posés VIDES quand ils
 *  manquent (clone neuf, #2203 A2) ou ne se chargent pas (`moduleChargeable`, #4161), puis rendus. */
const AMORCES_DES_MODULES = [
  { chemin: SORTIE_CLES, amorce: TYPE_DATASET_DE_CATEGORIE + 'export const CLES_DE_DATASET = [] as const;\nexport type CleDeDataset = (typeof CLES_DE_DATASET)[number];\nconst CATEGORIES = {} as const;\nexport const CATEGORIE_CODEX_DU_FICHIER: Readonly<Record<string, string>> = CATEGORIES;\nexport type CategorieCodexDuFichier = typeof CATEGORIES;\nexport const CLES_CODEX = [] as const;\nexport type CleCodex = (typeof CLES_CODEX)[number];\nexport const DATASET_DE_LA_CATEGORIE: Readonly<Record<string, DatasetDeCategorie>> = {};\nexport const DATASET_DE_L_ESPACE: Readonly<Record<string, DatasetDeCategorie>> = {};\n' },
  { chemin: SORTIE_RACINES, amorce: 'export const BIBLIOTHEQUE: Readonly<Record<string, unknown>> = {};\nexport const RACINES_VIVANTES: Readonly<Record<string, unknown>> = {};\n' },
];

/** Les noms exportés d'un module en texte (`export const|type <nom>`). */
const exportsDe = (texte: string): Set<string> => new Set([...texte.matchAll(/^export (?:const|type) (\w+)/gm)].map((m) => m[1]));

/** Le module en texte se charge-t-il : il porte chaque export de son `amorce` (module rendu avant que la phase 2
 *  n'en rende un de plus), et chaque document JSON qu'il importe `existe` encore, au chemin relatif à lui (dataset
 *  supprimé depuis son rendu) ? */
export function moduleChargeable(texte: string, amorce: string, existe: (relatif: string) => boolean): boolean {
  const presents = exportsDe(texte);
  return [...exportsDe(amorce)].every((nom) => presents.has(nom))
    && [...texte.matchAll(/^import \w+ from '([^']+\.json)';$/gm)].every((m) => existe(m[1]));
}

function amorcesNecessaires(): [string, string][] {
  const amorces: [string, string][] = [];
  if (!indexChargeable(indexSurDisque(SORTIE))) amorces.push([SORTIE, TABLE_VIDE]);
  for (const { chemin, amorce } of AMORCES_DES_MODULES) {
    const present = existsSync(chemin) && moduleChargeable(readFileSync(chemin, 'utf8'), amorce, (relatif) => existsSync(join(dirname(chemin), relatif)));
    if (!present) amorces.push([chemin, amorce]);
  }
  return amorces;
}

/** Le rendu seul exige que les modules importés soient déjà chargeables. */
export async function rendre(): Promise<Map<string, string>> {
  const amorces = amorcesNecessaires();
  if (amorces.length) {
    const chemins = amorces.map(([chemin]) => chemin).join(', ');
    throw new Error(`gen-espaces — modules illisibles ou absents : ${chemins}. ${AMORCAGE_EN_DEUX_TEMPS} : relancer \`npm run gen\`.`);
  }
  return (await rendu()).textes;
}

export async function* produire(
  { check }: { check: boolean },
  messagesDe: (chemin: string) => Pick<CibleRendue, 'staleMsg' | 'rerunMsg'>,
): AsyncGenerator<CibleRendue, void, boolean> {
  const amorces = amorcesNecessaires();
  for (const [path, out] of amorces) {
    yield {
      path,
      out,
      amorce: true,
      staleMsg: `gen-espaces — ${path} est illisible ou absent (${AMORCAGE_EN_DEUX_TEMPS}).`,
      rerunMsg: messagesDe(path).rerunMsg,
    };
  }
  if (check && amorces.length) return;

  const { textes, table, clesDeDataset, racines, documents } = await rendu();
  let changed = false;
  for (const [path, out] of textes) {
    const aJour = yield { path, out, ...messagesDe(path) };
    changed = !aJour || changed;
  }
  const ids = [...table.values()].reduce((n, l) => n + l.length, 0);
  console.log(
    `gen-espaces: IDS_PAR_ESPACE ← ${ids} ids / ${table.size} espaces (${SORTIE}), CLES_DE_DATASET ← ${clesDeDataset.length} clés (${SORTIE_CLES}), BIBLIOTHEQUE ← ${documents.length} documents, RACINES_VIVANTES ← ${racines.length} documents (${SORTIE_RACINES}), Catalogue ← ${documents.length} collections (${SORTIE_CATALOGUE})${changed ? '' : ' [inchangé]'}`,
  );
}
