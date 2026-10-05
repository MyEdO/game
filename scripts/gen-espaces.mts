/**
 * PHASE 2 de `npm run gen` (#1463) — l'INDEX DES IDS (`src/data/schemas/_ids.generated.ts`,
 * `IDS_PAR_ESPACE`, et le LIBELLÉ de chaque sous-liste marquée, `LIBELLES_DES_MARQUEURS`), keyé par CLÉ D'ESPACE (`src/data/schemas/grammaire/cle-d-espace.ts`), les CLÉS
 * DE DATASET (`src/data/schemas/_cles-de-dataset.generated.ts`, `CLES_DE_DATASET`), le domaine de
 * `DATASET_FICHIER_DERIVE` (`src/data/schemas/exposition-derivee.ts`), et les RACINES VIVANTES
 * (`src/data/schemas/_racines-vivantes.generated.ts`, `RACINES_VIVANTES`), son image.
 *
 * Le JSON disque de chaque document de `SCHEMA_DEFS` est CO-DESCENDU avec son schéma, sans parse
 * (`collectionsDesDocuments`, `grammaire/collection-cle.ts`) : chaque collection marquée `espace` y
 * nomme sa clé, ses paramètres `discriminant`/`marqueurs` ses espaces filtrés, et une entrée à
 * `specsSource` l'espace de ses `specs`. Les ids de chaque clé sont ceux d'`idsDeLEspace`, le calcul
 * que le régime vivant fait sur les racines vivantes (`src/data/overrides.ts`), dans l'ORDRE DE LA
 * DONNÉE. Aucune validation n'y lit l'index : un espace neuf et son premier désignateur entrent dans
 * le même commit — et une table VIDE rend le même index : un index en conflit ou sans `IDS_PAR_ESPACE`
 * est remplacé par une table vide AVANT que les modules qui l'importent (`_registry.generated` → defs →
 * `grammaire/ref.ts`) ne se chargent.
 *
 * Jouée par `genAll` (`scripts/gen-registry.mjs`), après la phase 1 : `genererCode`
 * (scripts/docs/build-all.mjs) ; `--check` compare sans écrire (`npm run docs:check`).
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import type { SchemaDef } from '../src/data/schemas/types';
import type { AccesAuxDocuments, CollectionDeFichier } from '../src/data/schemas/grammaire/collection-cle';
import { cleDesSpecs, cleFiltree, HORS_DE_LA_GRAPHIE } from '../src/data/schemas/grammaire/cle-d-espace';
import { SOURCES_DE_SPECS, type SourceDeSpecs } from '../src/data/schemas/grammaire/sourcesDeSpecs';
import { parUnitesDeCode } from './guards/lib/lister.mjs';
import { litteralJs } from './guards/lib/litteralJs.mjs';
import { ecrireOuVerifier } from './docs/lib/ecriture-derives.mjs';
import { MESSAGES_DE, SORTIES_DES_ESPACES } from './gen-registry.mjs';

const { ids: SORTIE, cles: SORTIE_CLES, racines: SORTIE_RACINES } = SORTIES_DES_ESPACES;

/** Table VIDE : ce que la phase 2 pose à la place d'un index illisible. */
export const TABLE_VIDE =
  'export const IDS_PAR_ESPACE: Readonly<Record<string, readonly string[]>> = {};\n' +
  'export const LIBELLES_DES_MARQUEURS: Readonly<Record<string, string>> = {};\n';

/** L'index en texte est-il chargeable : il exporte `IDS_PAR_ESPACE` et `LIBELLES_DES_MARQUEURS`, et ne
 *  porte aucun marqueur de conflit ? */
export function indexChargeable(texte: string): boolean {
  return /^export const IDS_PAR_ESPACE\b/m.test(texte) && /^export const LIBELLES_DES_MARQUEURS\b/m.test(texte) && !/^(<{7}|={7}|>{7})( |$)/m.test(texte);
}

const estObjet = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v);

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
  if (espace.discriminant !== undefined) {
    const champ = espace.discriminant;
    const valeurs = new Set<string>();
    for (const [el, cle] of elementsCles(c)) {
      const vaut = el[champ];
      if (typeof vaut !== 'string') continue;
      if (HORS_DE_LA_GRAPHIE.test(vaut)) throw new Error(`gen-espaces: ${c.cle} « ${cle} » : la valeur de discriminant « ${vaut} » porte ?, = ou #.`);
      valeurs.add(vaut);
    }
    if (!valeurs.size) throw new Error(`gen-espaces: ${c.cle} : discriminant « ${champ} » qu'aucun élément ne porte.`);
    for (const vaut of valeurs) cles.push(cleFiltree(c.cle, { champ, vaut }));
  }
  for (const champ of espace.marqueurs ?? []) cles.push(cleFiltree(c.cle, { champ }));
  if (c.marque.forme === 'liste') for (const [el, cle] of elementsCles(c)) if ('specsSource' in el) cles.push(cleDesSpecs(c.cle, cle));
  return cles;
}

/** Un document porteur d'une clé de dataset : son `file` et son chemin sous le dépôt (`root`/`file`). */
interface DocumentDeDataset {
  readonly fichier: string;
  readonly chemin: string;
}

/** L'INDEX DES IDS (clé d'espace → ids, dans l'ordre de la donnée), le LIBELLÉ de chaque sous-liste
 *  marquée (la `MetaChamp` du champ marqueur, dans le def de son document), les CLÉS DE DATASET et les
 *  documents de leur image. Les modules qui importent l'index se chargent ICI, par `import()` :
 *  l'appelant a déjà rendu l'index chargeable. */
export async function indexDesIds(): Promise<{ table: Map<string, readonly string[]>; libelles: Map<string, string>; clesDeDataset: string[]; racines: DocumentDeDataset[] }> {
  const { SCHEMA_DEFS } = (await import('../src/data/schemas/_registry.generated')) as { SCHEMA_DEFS: SchemaDef[] };
  const { collectionsDesDocuments, idsDeLEspace, lectureDeLEspace } = await import('../src/data/schemas/grammaire/collection-cle');
  const { DATASET_FICHIER_DERIVE } = await import('../src/data/schemas/exposition-derivee');
  const brutParNom = new Map(SCHEMA_DEFS.map((d) => [d.file, JSON.parse(readFileSync(join(d.root, d.file), 'utf8')) as unknown]));
  const schemaParNom = new Map(SCHEMA_DEFS.map((d) => [d.file, d.schema]));
  const acces: AccesAuxDocuments = (fichier) => (brutParNom.has(fichier) ? { schema: schemaParNom.get(fichier), racine: brutParNom.get(fichier) } : undefined);
  const lire = (c: string) => lectureDeLEspace(c, acces);
  const table = new Map<string, readonly string[]>();
  const libelles = new Map<string, string>();
  const metaDe = new Map(SCHEMA_DEFS.map((d) => [d.file, d.meta]));
  for (const c of collectionsDesDocuments(SCHEMA_DEFS, brutParNom))
    if (c.marque.espace) {
      for (const champ of c.marque.espace.marqueurs ?? []) {
        const libelle = c.suite === '' ? metaDe.get(c.dataset)?.[champ]?.label : undefined;
        if (!libelle) throw new Error(`gen-espaces: ${c.cle} : le marqueur « ${champ} » n'a aucun libellé (\`MetaChamp\` du champ dans le def de ${c.dataset}).`);
        libelles.set(cleFiltree(c.cle, { champ }), libelle);
      }
      for (const cle of clesDe(c)) {
        if (table.has(cle)) throw new Error(`gen-espaces: clé d'espace « ${cle} » rendue deux fois.`);
        const ids = idsDeLEspace(cle, lire);
        if (!ids) throw new Error(`gen-espaces: « ${cle} » n'est aucun espace de son document.`);
        if (cle.includes('?') && !ids.length) throw new Error(`gen-espaces: ${cle} : filtre qu'aucun élément ne retient.`);
        table.set(cle, ids);
      }
    }
  for (const [nom, source] of Object.entries(SOURCES_DE_SPECS as Record<string, SourceDeSpecs>))
    for (const cle of [source.univers, source.pool ?? source.univers])
      if (!table.has(cle)) throw new Error(`gen-espaces: SOURCES_DE_SPECS.${nom} : « ${cle} » n'est aucun espace mesuré.`);
  const defParNom = new Map(SCHEMA_DEFS.map((d) => [d.file, d]));
  const racines = [...new Set(Object.values(DATASET_FICHIER_DERIVE))].sort(parUnitesDeCode).map((fichier) => {
    const def = defParNom.get(fichier);
    if (!def) throw new Error(`gen-espaces: DATASET_FICHIER_DERIVE désigne « ${fichier} », qu'aucun def de SCHEMA_DEFS ne porte.`);
    return { fichier, chemin: join(def.root, def.file) };
  });
  return {
    table: new Map([...table].sort(([a], [b]) => parUnitesDeCode(a, b))),
    libelles: new Map([...libelles].sort(([a], [b]) => parUnitesDeCode(a, b))),
    clesDeDataset: Object.keys(DATASET_FICHIER_DERIVE).sort(parUnitesDeCode),
    racines,
  };
}

/** Écrit `chemin` seulement si son contenu change — en `check`, compare sans écrire ; rend `true` s'il a changé. */
function ecrire(chemin: string, body: string, check: boolean): boolean {
  return !ecrireOuVerifier({ out: body, path: chemin, check, ...MESSAGES_DE(chemin) });
}

/** Spécificateur d'import de `chemin` (sous le dépôt) depuis le module généré `sortie`. */
function specificateur(sortie: string, chemin: string): string {
  const rel = relative(dirname(sortie), chemin).split('\\').join('/');
  return rel.startsWith('.') ? rel : `./${rel}`;
}

/** Les trois modules de la phase 2, rendus sans écrire, et ce dont leurs statistiques sont faites. */
async function rendu(): Promise<{ textes: Map<string, string>; table: Map<string, readonly string[]>; clesDeDataset: string[]; racines: DocumentDeDataset[] }> {
  const { table, libelles, clesDeDataset, racines } = await indexDesIds();
  const body =
    `// GÉNÉRÉ par scripts/gen-espaces.mts (phase 2 de \`npm run gen\`) — NE PAS ÉDITER À LA MAIN.\n` +
    `// Régénérer : \`npm run gen\` (deux exécutions successives rendent le même octet).\n\n` +
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
    ` */\n` +
    `const IDS = {\n` +
    [...table].map(([cle, ids]) => `  ${litteralJs(cle)}: [${ids.map(litteralJs).join(', ')}],\n`).join('') +
    `} as const;\n\n` +
    `export const IDS_PAR_ESPACE: Readonly<Record<string, readonly string[]>> = IDS;\n\n` +
    `/** Union LITTÉRALE des ids de chaque espace, dérivée de \`IDS\` : un id absent de la donnée ne compile pas. */\n` +
    `export type IdsParEspace = { readonly [E in keyof typeof IDS]: (typeof IDS)[E][number] };\n\n` +
    `/** LIBELLÉ de chaque sous-liste MARQUÉE (\`<espace>?<marqueur>\`) : la \`MetaChamp\` du champ marqueur, dans le\n` +
    ` *  def de son document — ce qu'un refus de sous-liste dit à l'auteur (\`grammaire/ref.ts\`), jamais le nom du champ. */\n` +
    `export const LIBELLES_DES_MARQUEURS: Readonly<Record<string, string>> = {\n` +
    [...libelles].map(([cle, libelle]) => `  ${litteralJs(cle)}: ${litteralJs(libelle)},\n`).join('') +
    `};\n`;
  const cles =
    `// GÉNÉRÉ par scripts/gen-espaces.mts (phase 2 de \`npm run gen\`) — NE PAS ÉDITER À LA MAIN.\n` +
    `// Régénérer : \`npm run gen\` (deux exécutions successives rendent le même octet).\n\n` +
    `/** CLÉS DE DATASET : le domaine de \`DATASET_FICHIER_DERIVE\` (\`exposition-derivee.ts\`), une clé par\n` +
    ` *  collection que le seam mute EN PLACE (\`src/data/overrides.ts\`). */\n` +
    `export const CLES_DE_DATASET = [\n` +
    clesDeDataset.map((c) => `  ${litteralJs(c)},\n`).join('') +
    `] as const;\n\n` +
    `/** Une clé de dataset. */\n` +
    `export type CleDeDataset = (typeof CLES_DE_DATASET)[number];\n`;
  const modRacines =
    `// GÉNÉRÉ par scripts/gen-espaces.mts (phase 2 de \`npm run gen\`) — NE PAS ÉDITER À LA MAIN.\n` +
    `// Régénérer : \`npm run gen\` (un import par document de l'image de \`DATASET_FICHIER_DERIVE\`).\n` +
    racines.map((r, i) => `import r${i} from ${litteralJs(specificateur(SORTIE_RACINES, r.chemin))};\n`).join('') +
    `\n` +
    `/** RACINES VIVANTES : fichier → racine du document, pour chaque document qui porte une clé de dataset\n` +
    ` *  (l'image de \`DATASET_FICHIER_DERIVE\`, \`exposition-derivee.ts\`) — le module JSON singleton que le\n` +
    ` *  seam mute EN PLACE (\`src/data/overrides.ts\`). */\n` +
    `export const RACINES_VIVANTES: Readonly<Record<string, unknown>> = {\n` +
    racines.map((r, i) => `  ${litteralJs(r.fichier)}: r${i},\n`).join('') +
    `};\n`;
  return { textes: new Map([[SORTIE, body], [SORTIE_CLES, cles], [SORTIE_RACINES, modRacines]]), table, clesDeDataset, racines };
}

/** Le texte de l'index des ids sur disque, `''` s'il n'existe pas encore. */
function indexSurDisque(): string {
  try {
    return readFileSync(SORTIE, 'utf8');
  } catch {
    return '';
  }
}

/**
 * EXCEPTION NOMMÉE au contrat `rendre()` PUR de `GENERATORS` (#2203 A2) : la phase 2 IMPORTE les defs
 * (`_registry.generated`, sortie de la phase 1) et `grammaire/ref.ts`, qui importe l'index qu'elle rend.
 * `rendre()` exige donc l'index sur disque ; seul `genEspaces` l'amorce par `TABLE_VIDE`. Mesure du
 * 2026-09-30 : 90 importeurs de `grammaire/ref`, 55 de `schemas/_registry.generated` — l'injection
 * de la table ne rendrait pas la phase 2 pure (la phase 1 reste importée).
 */
export const AMORCAGE_EN_DEUX_TEMPS = 'amorçage en deux temps de la phase 2 (TABLE_VIDE, puis rendu)';

/** Les deux autres modules de la phase 2, importés par `src/data/overrides.ts` et
 *  `src/data/versionDataset.ts` que la phase 2 charge : posés VIDES quand ils manquent (clone neuf,
 *  #2203 A2), puis rendus. */
const AMORCES_DES_MODULES: ReadonlyMap<string, string> = new Map([
  [SORTIE_CLES, 'export const CLES_DE_DATASET = [] as const;\nexport type CleDeDataset = (typeof CLES_DE_DATASET)[number];\n'],
  [SORTIE_RACINES, 'export const RACINES_VIVANTES: Readonly<Record<string, unknown>> = {};\n'],
]);

/** Contrat `rendre()` de `GENERATORS` (scripts/docs/build-all.mjs), phase 2 : module → texte, sans
 *  écrire. LÈVE sur un index illisible (`AMORCAGE_EN_DEUX_TEMPS`). */
export async function rendre(): Promise<Map<string, string>> {
  if (!indexChargeable(indexSurDisque())) throw new Error(`gen-espaces — ${SORTIE} est illisible ou absent, ${AMORCAGE_EN_DEUX_TEMPS} : relancer \`npm run gen\`.`);
  return (await rendu()).textes;
}

/** Écrit l'INDEX DES IDS, les CLÉS DE DATASET et les RACINES VIVANTES — seulement si leur contenu change.
 *  Un index illisible est d'abord remplacé par la table vide ; en `check`, il est un rouge et rien ne se calcule. */
async function genEspaces(check: boolean): Promise<{ changed: boolean; espaces: number; ids: number; clesDeDataset: number; racines: number } | null> {
  if (!indexChargeable(indexSurDisque())) {
    if (check) {
      console.error(`gen-espaces — ${SORTIE} est illisible (conflit ou sans IDS_PAR_ESPACE) : relancer \`npm run gen\`.`);
      process.exitCode = (Number(process.exitCode) || 0) | 1;
      return null;
    }
    writeFileSync(SORTIE, TABLE_VIDE);
  }
  for (const [chemin, amorce] of AMORCES_DES_MODULES) if (!existsSync(chemin)) writeFileSync(chemin, amorce);
  const { textes, table, clesDeDataset, racines } = await rendu();
  let changed = false;
  for (const [chemin, texte] of textes) changed = ecrire(chemin, texte, check) || changed;
  return {
    changed,
    espaces: table.size,
    ids: [...table.values()].reduce((n, l) => n + l.length, 0),
    clesDeDataset: clesDeDataset.length,
    racines: racines.length,
  };
}

// Point d'entrée seulement. `--silencieux` (appel de `buildStart`) : n'imprime que si l'index change.
if (import.meta.main) {
  const r = await genEspaces(process.argv.includes('--check'));
  if (r && (r.changed || !process.argv.includes('--silencieux')))
    console.log(
      `gen-espaces: IDS_PAR_ESPACE ← ${r.ids} ids / ${r.espaces} espaces (${SORTIE}), CLES_DE_DATASET ← ${r.clesDeDataset} clés (${SORTIE_CLES}), RACINES_VIVANTES ← ${r.racines} documents (${SORTIE_RACINES})${r.changed ? '' : ' [inchangé]'}`,
    );
}
