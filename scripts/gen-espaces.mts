/**
 * PHASE 2 de `npm run gen` (#1463) — l'INDEX DES IDS (`src/data/schemas/_ids.generated.ts`,
 * `IDS_PAR_ESPACE`), keyé par CLÉ D'ESPACE (`src/data/schemas/grammaire/cle-d-espace.ts`).
 *
 * Le JSON disque de chaque document de `SCHEMA_DEFS` est CO-DESCENDU avec son schéma, sans parse
 * (`collectionsDesDocuments`, `grammaire/collection-cle.ts`) : chaque collection marquée `espace` y rend
 * sa clé et ses ids, et ses paramètres `discriminant`/`marqueurs` ses espaces filtrés. Une entrée à
 * `specsSource` a pour espace de ses `specs` l'univers de sa source (`grammaire/sourcesDeSpecs.ts`).
 * Aucune validation n'y lit l'index : un espace neuf et son premier désignateur entrent dans le même
 * commit — et une table VIDE rend le même index : un index en conflit ou sans `IDS_PAR_ESPACE` est
 * remplacé par une table vide AVANT que les modules qui l'importent (`_registry.generated` → defs →
 * `grammaire/ref.ts`) ne se chargent.
 *
 * Jouée par `genAll` (`scripts/gen-registry.mjs`), après la phase 1 : `npm run gen` et `buildStart`
 * (`vite.config.ts`).
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { SchemaDef } from '../src/data/schemas/types';
import type { CollectionDeFichier } from '../src/data/schemas/grammaire/collection-cle';
import { cleDesSpecs, cleFiltree, HORS_DE_LA_GRAPHIE, retenuParFiltre } from '../src/data/schemas/grammaire/cle-d-espace';
import { SOURCES_DE_SPECS, type SourceDeSpecs } from '../src/data/schemas/grammaire/sourcesDeSpecs';
import { parUnitesDeCode } from './guards/lib/lister.mjs';

const SORTIE = 'src/data/schemas/_ids.generated.ts';

/** Table VIDE : ce que la phase 2 pose à la place d'un index illisible. */
export const TABLE_VIDE = 'export const IDS_PAR_ESPACE: Readonly<Record<string, readonly string[]>> = {};\n';

/** L'index en texte est-il chargeable : il exporte `IDS_PAR_ESPACE` et ne porte aucun marqueur de conflit ? */
export function indexChargeable(texte: string): boolean {
  return /^export const IDS_PAR_ESPACE\b/m.test(texte) && !/^(<{7}|={7}|>{7})( |$)/m.test(texte);
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

/** Les espaces d'une collection marquée `espace` : le sien, puis ses espaces filtrés. */
function espacesDe(c: CollectionDeFichier): [string, readonly string[]][] {
  const espace = c.marque.espace!;
  const out: [string, readonly string[]][] = [[c.cle, c.ids]];
  if (espace.discriminant !== undefined) {
    const champ = espace.discriminant;
    const parValeur = new Map<string, string[]>();
    for (const [el, cle] of elementsCles(c)) {
      const vaut = el[champ];
      if (typeof vaut !== 'string') continue;
      if (HORS_DE_LA_GRAPHIE.test(vaut)) throw new Error(`gen-espaces: ${c.cle} « ${cle} » : la valeur de discriminant « ${vaut} » porte ?, = ou #.`);
      parValeur.set(vaut, [...(parValeur.get(vaut) ?? []), cle]);
    }
    if (!parValeur.size) throw new Error(`gen-espaces: ${c.cle} : discriminant « ${champ} » qu'aucun élément ne porte.`);
    for (const [vaut, ids] of parValeur) out.push([cleFiltree(c.cle, { champ, vaut }), ids]);
  }
  for (const champ of espace.marqueurs ?? []) {
    const ids = elementsCles(c).filter(([el]) => retenuParFiltre({ champ }, el)).map(([, cle]) => cle);
    if (!ids.length) throw new Error(`gen-espaces: ${c.cle} : marqueur « ${champ} » qu'aucun élément ne porte.`);
    out.push([cleFiltree(c.cle, { champ }), ids]);
  }
  return out;
}

/** L'espace des `specs` d'une entrée à `specsSource` : l'univers de sa source, par clé. */
function specsDesSources(c: CollectionDeFichier): [string, string][] {
  if (c.cle !== c.dataset || c.marque.forme !== 'liste') return [];
  return elementsCles(c).flatMap(([el, cle]): [string, string][] => {
    if (typeof el.specsSource !== 'string') return [];
    const source: SourceDeSpecs | undefined = (SOURCES_DE_SPECS as Record<string, SourceDeSpecs>)[el.specsSource];
    if (!source) throw new Error(`gen-espaces: ${c.dataset} « ${cle} » : specsSource « ${el.specsSource} » inconnue de SOURCES_DE_SPECS.`);
    if (el.specs !== undefined) throw new Error(`gen-espaces: ${c.dataset} « ${cle} » : \`specs\` ET \`specsSource\` — l'espace de ses spécialisations serait double.`);
    return [[cleDesSpecs(c.dataset, cle), source.univers]];
  });
}

/** L'INDEX DES IDS : clé d'espace → ids triés. Les modules qui importent l'index se chargent ICI, par
 *  `import()` : l'appelant a déjà rendu l'index chargeable. */
export async function indexDesIds(): Promise<Map<string, readonly string[]>> {
  const { SCHEMA_DEFS } = (await import('../src/data/schemas/_registry.generated')) as { SCHEMA_DEFS: SchemaDef[] };
  const { collectionsDesDocuments } = await import('../src/data/schemas/grammaire/collection-cle');
  const brutParNom = new Map(SCHEMA_DEFS.map((d) => [d.file, JSON.parse(readFileSync(join(d.root, d.file), 'utf8')) as unknown]));
  const collections = collectionsDesDocuments(SCHEMA_DEFS, brutParNom);
  const table = new Map<string, readonly string[]>();
  const poser = (cle: string, ids: readonly string[]) => {
    if (table.has(cle)) throw new Error(`gen-espaces: clé d'espace « ${cle} » rendue deux fois.`);
    table.set(cle, [...new Set(ids)].sort(parUnitesDeCode));
  };
  for (const c of collections) if (c.marque.espace) for (const [cle, ids] of espacesDe(c)) poser(cle, ids);
  for (const [cle, univers] of collections.flatMap(specsDesSources)) {
    const ids = table.get(univers);
    if (!ids) throw new Error(`gen-espaces: ${cle} : l'univers « ${univers} » n'est aucun espace mesuré.`);
    poser(cle, ids);
  }
  for (const [nom, source] of Object.entries(SOURCES_DE_SPECS as Record<string, SourceDeSpecs>))
    for (const cle of [source.univers, source.pool ?? source.univers])
      if (!table.has(cle)) throw new Error(`gen-espaces: SOURCES_DE_SPECS.${nom} : « ${cle} » n'est aucun espace mesuré.`);
  return new Map([...table].sort(([a], [b]) => parUnitesDeCode(a, b)));
}

const lit = (v: string) => `'${v.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;

/** Écrit l'INDEX DES IDS — seulement si son contenu change. Un index illisible est d'abord remplacé
 *  par la table vide. */
async function genEspaces(): Promise<{ changed: boolean; espaces: number; ids: number }> {
  let prev = '';
  try {
    prev = readFileSync(SORTIE, 'utf8');
  } catch {
    /* nouveau */
  }
  if (!indexChargeable(prev)) writeFileSync(SORTIE, (prev = TABLE_VIDE));
  const table = await indexDesIds();
  const body =
    `// GÉNÉRÉ par scripts/gen-espaces.mts (phase 2 de \`npm run gen\`) — NE PAS ÉDITER À LA MAIN.\n` +
    `// Régénérer : \`npm run gen\` (deux exécutions successives rendent le même octet).\n\n` +
    `/**\n` +
    ` * INDEX DES IDS : les ids de chaque ESPACE DE NOMS de \`src/data\`, par CLÉ D'ESPACE\n` +
    ` * (\`grammaire/cle-d-espace.ts\`) — la cible de tout \`idDe\` (\`grammaire/ref.ts\`), qui refine l'id AU PARSE.\n` +
    ` *\n` +
    ` * Deux RÉGIMES de lecture, tous deux déclarés :\n` +
    ` *  - CI / DEV / test : ce fichier généré, figé au commit — une référence morte casse au parse ;\n` +
    ` *  - APPLICATION (éditeur compris, \`CodexEdit.save\` → \`validateDataset\`) : les ids se lisent sur les\n` +
    ` *    datasets EN MÉMOIRE (\`src/data/overrides.ts\` pose la source vivante, \`grammaire/idsVivants.ts\`\n` +
    ` *    la sert à \`ref.ts\`).\n` +
    ` */\n` +
    `export const IDS_PAR_ESPACE: Readonly<Record<string, readonly string[]>> = {\n` +
    [...table].map(([cle, ids]) => `  ${lit(cle)}: [${ids.map(lit).join(', ')}],\n`).join('') +
    `};\n`;
  const changed = prev !== body;
  if (changed) writeFileSync(SORTIE, body);
  return { changed, espaces: table.size, ids: [...table.values()].reduce((n, l) => n + l.length, 0) };
}

// Point d'entrée seulement. `--silencieux` (appel de `buildStart`) : n'imprime que si l'index change.
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const r = await genEspaces();
  if (r.changed || !process.argv.includes('--silencieux'))
    console.log(`gen-espaces: IDS_PAR_ESPACE ← ${r.ids} ids / ${r.espaces} espaces (${SORTIE})${r.changed ? '' : ' [inchangé]'}`);
}
