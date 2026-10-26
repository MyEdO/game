/**
 * STRUCTURES LOCALES (#1463, #3012 N1) : la dette de STRUCTURE mesurée sur le SCHÉMA. Un site est un
 * nœud de schéma d'un document authoré, énuméré sans la donnée : ajouter une donnée conforme n'en crée
 * aucun (#2995). Seuls les defs (`SCHEMA_DEFS`, `SCHEMA_DEFS_SCENES`), la grammaire et `OP_DEFS` sont lus.
 *
 * Énumération : chaque schéma DISTINCT, sous le nom de son DOCUMENT (`nomDuDocument`), chaque nœud à son plus court
 * chemin de schéma (`cheminsDeSchema`). Sont des sites les nœuds
 * objets et les nœuds non validants (`unknown`, `any`, `custom`) ; ne le sont pas la racine, l'entrée d'un
 * document `entite` et les objets d'enveloppe (`CLES_ENVELOPPE`) qu'y pose `document()`.
 *
 * Classes, jugées dans cet ordre (`classeDuNoeud`) :
 *   D5  nœud non validant ;
 *   G   nœud DE LA GRAMMAIRE (atteint par identité depuis un export de `grammaire/*` ou `OP_DEFS`, ou
 *       produit de fabrique) PARTAGÉ : composé par au moins deux schémas de def ou par une déclaration
 *       d'op ; un produit se juge sur sa CLASSE (fabrique, rôle, clés d'extra et leur empreinte) ;
 *   G1  nœud de la grammaire composé par un seul def ;
 *   L   tout autre nœud objet.
 * Le STOCK (`STRUCTURES_LOCALES`, `horsStrateStock.mjs`) porte D5, G1 et L ; G en sort. La valeur d'un
 * `record` se classe comme tout nœud, le record lui-même n'est pas un objet.
 *
 * CLÉ d'un site : `(nom du document, chemin de schéma normalisé)`. Une branche d'union se nomme par
 * les valeurs de son discriminant, sinon par ses clés déclarées triées et leurs valeurs littérales, sinon
 * par son type ; une union imbriquée se replie dans sa mère, sauf sous une option `z.lazy`, nommée
 * `|<lazy>`. Deux nœuds d'un même type à la même clé LÈVENT (injectivité).
 *
 * L'EMPREINTE d'un site (ses clés déclarées et le type zod de chaque enfant) vit dans la mesure, hors du
 * stock : la porte des comptes (`occurrencesStock.mjs`, `renommagesDeStructure`) apparie par elle un site
 * disparu et un site né d'un même document (`nomDuDocument`).
 */
import { fileURLToPath, pathToFileURL } from 'node:url';
import { SCHEMA_DEFS } from '../../../src/data/schemas/_registry.generated';
import { SCHEMA_DEFS_SCENES } from '../../../src/data/schemas/_registry-scenes.generated';
import type { SchemaDef } from '../../../src/data/schemas/types';
import { defDe, descendre, enfantsDe, valeursAdmises } from '../../../src/data/schemas/grammaire/descente';
import { CLES_ENVELOPPE } from '../../../src/data/schemas/grammaire/document';
import { famillesConstruites, OP_DEFS } from '../../../src/data/schemas/grammaire/mecanique';
import { classeDeProduit } from '../../../src/data/schemas/grammaire/produits';
import { estFichierVitest, estKitDeTest } from './fichierVitest.mjs';
import { listerEntrees, parUnitesDeCode } from './lister.mjs';
import { empreinteDeChamps } from './occurrencesStock.mjs';
import { PORTEURS } from './porteursDesComptes.mjs';
import type { Site } from './stock.mjs';
import { DECROISSANT, type RegenerationDeStock } from './stockDeSites.mjs';

/** Les classes d'un nœud de site ; `D5`, `G1` et `L` sont au stock. */
export type ClasseDeStructure = 'D5' | 'G' | 'G1' | 'L';

/** Un nœud de site, classé : le nom de son document (`nomDuDocument`), sa clé de schéma, sa classe et son empreinte. */
export interface NoeudDeStructure {
  readonly fichier: string;
  readonly ref: string;
  readonly noeud: object;
  readonly classe: ClasseDeStructure;
  readonly empreinte: string;
}

/** Ce qu'un site de structure porte HORS de sa clé : sa classe et son empreinte. */
export type ChampsDeStructure = { readonly classe: ClasseDeStructure; readonly empreinte: string };
/** Un site du stock, tel que la mesure le rend : la forme de `sitesEnEntrees`, sa classe et son empreinte hors clé. */
export type SiteDeStructure = Site & ChampsDeStructure;

/** Les types de nœud non validants (D5). */
const NON_VALIDANTS: ReadonlySet<string> = new Set(['unknown', 'any', 'custom']);
/** Les classes portées au stock. */
const AU_STOCK: ReadonlySet<ClasseDeStructure> = new Set(['D5', 'G1', 'L']);

const estNoeud = (x: unknown): x is object => typeof x === 'object' && x !== null && defDe(x) !== undefined;

/** Les nœuds atteints depuis `racines` (`descendre`), racines comprises. */
function atteints(racines: readonly unknown[]): Set<object> {
  const vus = new Set<object>();
  descendre(racines, ({ noeud }) => {
    vus.add(noeud);
  });
  return vus;
}

/** `noeud` ouvert de ses enveloppes à un enfant (`optional`, `default`, `lazy`…) jusqu'à un objet, une
 *  union, un record ou une liste. */
function ouvert(noeud: unknown): unknown {
  const vus = new Set<unknown>();
  for (let x = noeud; ; ) {
    if (vus.has(x)) return x;
    vus.add(x);
    const def = defDe(x);
    if (!def || ['object', 'union', 'record', 'array'].includes(def.type)) return x;
    const dedans = enfantsDe(x).filter((e) => e.segment === '');
    if (dedans.length !== 1) return x;
    x = dedans[0].noeud;
  }
}

/** Le SEGMENT d'une option d'union dans une clé : `''` pour une union imbriquée (repliée), `|<lazy>` pour
 *  une option `z.lazy`, `|disc=v1,v2` sous un discriminant, `|{a,b=v}` pour un objet, `|<type>` sinon. */
export function nomDeBranche(union: unknown, option: unknown): string {
  if (defDe(option)?.type === 'lazy') return '|<lazy>';
  const o = ouvert(option);
  const def = defDe(o);
  if (def?.type === 'union') return '';
  const discriminant = defDe(union)?.discriminator as string | undefined;
  if (discriminant) {
    const v = valeursAdmises(option)[discriminant];
    return `|${discriminant}=${v ? [...v].map(String).sort().join(',') : '?'}`;
  }
  if (def?.type === 'object') {
    const pv = valeursAdmises(o);
    const cles = enfantsDe(o).flatMap((e) => (e.cle === undefined ? [] : [e.cle])).sort();
    return `|{${cles.map((k) => (pv[k] ? `${k}=${[...pv[k]].map(String).sort().join('/')}` : k)).join(',')}}`;
  }
  return `|<${def?.type ?? '?'}>`;
}

type Chemin = { readonly path: string; readonly cout: number };
const avant = (a: Chemin, b: Chemin): boolean => a.cout < b.cout || (a.cout === b.cout && a.path < b.path);

/** Le plus court chemin de chaque nœud de `schema` : segments NON vides comptés, puis ordre lexical. Un
 *  nœud déjà nommé ne se renomme pas, ce qui replie la récursion au premier `z.lazy`. */
export function cheminsDeSchema(schema: unknown): Map<object, Chemin> {
  const meilleurs = new Map<object, Chemin>();
  const tas: (Chemin & { readonly n: unknown })[] = [];
  const echanger = (i: number, j: number): void => { [tas[i], tas[j]] = [tas[j], tas[i]]; };
  const pousser = (x: (typeof tas)[number]): void => {
    tas.push(x);
    for (let i = tas.length - 1; i > 0; ) {
      const p = (i - 1) >> 1;
      if (!avant(tas[i], tas[p])) break;
      echanger(i, p);
      i = p;
    }
  };
  const tirer = (): (typeof tas)[number] => {
    const haut = tas[0];
    const dernier = tas.pop()!;
    if (tas.length) {
      tas[0] = dernier;
      for (let i = 0; ; ) {
        const [g, d] = [2 * i + 1, 2 * i + 2];
        let m = i;
        if (g < tas.length && avant(tas[g], tas[m])) m = g;
        if (d < tas.length && avant(tas[d], tas[m])) m = d;
        if (m === i) break;
        echanger(i, m);
        i = m;
      }
    }
    return haut;
  };
  pousser({ n: schema, path: '', cout: 0 });
  while (tas.length) {
    const p = tirer();
    if (!estNoeud(p.n) || meilleurs.has(p.n)) continue;
    meilleurs.set(p.n, { path: p.path, cout: p.cout });
    for (const e of enfantsDe(p.n)) {
      if (meilleurs.has(e.noeud as object)) continue;
      const s = e.segment.startsWith('|') ? nomDeBranche(p.n, e.noeud) : e.segment;
      pousser({ n: e.noeud, path: p.path + s, cout: p.cout + (s === '' ? 0 : 1) });
    }
  }
  return meilleurs;
}

/** L'EMPREINTE d'un site : `clé:type` de chaque enfant d'un objet, triés ; le type d'un nœud non validant. */
export function empreinteDeSite(noeud: unknown): string {
  const def = defDe(noeud);
  if (def?.type !== 'object') return def?.type ?? '';
  return empreinteDeChamps(enfantsDe(noeud).map((e) => [e.segment.slice(1), defDe(e.noeud)?.type ?? '']));
}

/** Les exports zod de chaque module de `grammaire/` (hors tests). */
const GRAMMAIRE = new URL('../../../src/data/schemas/grammaire/', import.meta.url);
const EXPORTS_DE_GRAMMAIRE: readonly unknown[] = (await Promise.all(
  listerEntrees(fileURLToPath(GRAMMAIRE)).entrees
    .filter((f) => f.nature === 'file' && /\.ts$/.test(f.nom) && !/\.d\.ts$/.test(f.nom) && !estFichierVitest(f.nom) && !estKitDeTest(f.nom))
    .map(async (f) => Object.values(await import(pathToFileURL(fileURLToPath(new URL(f.nom, GRAMMAIRE))).href) as Record<string, unknown>)),
)).flat().filter(estNoeud);

/** Le chemin de schéma où `document()` pose l'enveloppe : l'entrée d'un document `entite`, sinon la racine. */
const cheminDEnveloppe = (famille: SchemaDef['famille']): string => (famille === 'entite' ? '[]' : '');

/** La position d'un chemin qui n'est pas un site : racine, entrée d'un document `entite`, objet d'enveloppe. */
function horsSite(path: string, famille: SchemaDef['famille']): boolean {
  const entree = cheminDEnveloppe(famille);
  if (path === '' || path === entree) return true;
  const m = /^\.([A-Za-z]+)(\[\])?$/.exec(path.slice(entree.length));
  return path.startsWith(entree) && m !== null && (CLES_ENVELOPPE as readonly string[]).includes(m[1]);
}

/** La CLASSE d'un produit de fabrique, clé de son partage. */
const classeDeFabrique = (noeud: unknown): string | undefined => {
  const p = classeDeProduit(noeud);
  return p && `${p.fabrique}:${p.role}:${JSON.stringify(p.clesDExtra)}`;
};

/** Le NOM d'un schéma de document, `‹racine›#‹type›` : la racine et la famille, communes à ses documents, et la
 *  valeur unique du littéral `type` de son enveloppe (`cheminDEnveloppe`). Il ne dépend ni du nombre de ses documents
 *  ni de leurs fichiers ; un schéma sans racine ou famille commune, ou sans `type` unique, LÈVE. PURE. */
function nomDuDocument(documents: readonly SchemaDef[], chemins: ReadonlyMap<object, Chemin>): string {
  const fichiers = documents.map((x) => x.file).join(', ');
  const [racines, familles] = [new Set(documents.map((x) => x.root)), new Set(documents.map((x) => x.famille))];
  if (racines.size !== 1) throw new Error(`structures locales : schéma de ${fichiers} sous plusieurs racines`);
  if (familles.size !== 1) throw new Error(`structures locales : schéma de ${fichiers} sous plusieurs familles`);
  const enveloppe = cheminDEnveloppe([...familles][0]);
  const types = new Set([...chemins].flatMap(([n, { path }]) => (path === enveloppe ? [...(valeursAdmises(n).type ?? [])] : [])));
  if (types.size !== 1 || typeof [...types][0] !== 'string') throw new Error(`structures locales : schéma de ${fichiers} sans \`type\` unique`);
  return `${[...racines][0]}#${[...types][0]}`;
}

/**
 * Les nœuds de site des `defs`, classés, dans l'ordre des defs puis des clés. PURE sur les defs : aucune
 * donnée n'est lue. Lève sur deux nœuds d'un même type à la même clé.
 */
export function noeudsDeStructure(defs: readonly SchemaDef[] = [...SCHEMA_DEFS, ...SCHEMA_DEFS_SCENES]): NoeudDeStructure[] {
  const types = new Map<unknown, SchemaDef[]>();
  for (const d of defs) types.set(d.schema, [...(types.get(d.schema) ?? []), d]);
  const grammaire = atteints([...EXPORTS_DE_GRAMMAIRE, ...Object.values(OP_DEFS)]);
  const payloads = atteints(famillesConstruites().flatMap((f) => Object.values(f.opDefs)));
  const composeurs = new Map<object, Set<unknown>>();
  for (const schema of types.keys()) for (const n of atteints([schema])) composeurs.set(n, (composeurs.get(n) ?? new Set()).add(schema));
  const parClasse = new Map<string, Set<unknown>>();
  for (const [n, c] of composeurs) {
    const k = classeDeFabrique(n);
    if (k !== undefined) parClasse.set(k, new Set([...(parClasse.get(k) ?? []), ...c]));
  }
  const classesDOp = new Set([...payloads].map(classeDeFabrique).filter((k) => k !== undefined));
  const classe = (n: object): ClasseDeStructure => {
    const type = defDe(n)!.type;
    if (NON_VALIDANTS.has(type)) return 'D5';
    const fabrique = classeDeFabrique(n);
    if (fabrique === undefined && !grammaire.has(n)) return 'L';
    const partage = fabrique !== undefined
      ? (parClasse.get(fabrique)?.size ?? 0) >= 2 || classesDOp.has(fabrique)
      : (composeurs.get(n)?.size ?? 0) >= 2 || payloads.has(n);
    return partage ? 'G' : 'G1';
  };
  const out: NoeudDeStructure[] = [];
  const noms = new Map<string, readonly SchemaDef[]>();
  for (const [schema, documents] of types) {
    const chemins = cheminsDeSchema(schema);
    const fichier = nomDuDocument(documents, chemins);
    const homonyme = noms.get(fichier);
    if (homonyme) throw new Error(`structures locales : ${fichier} nomme deux schémas (${[...homonyme, ...documents].map((x) => x.file).join(', ')})`);
    noms.set(fichier, documents);
    const d = documents[0];
    const parCle = new Map<string, object>();
    for (const [n, { path }] of chemins) {
      const type = defDe(n)!.type;
      if (type !== 'object' && !NON_VALIDANTS.has(type)) continue;
      if (horsSite(path, d.famille)) continue;
      const deja = parCle.get(path);
      if (deja !== undefined && deja !== n) throw new Error(`structures locales : deux nœuds à la même clé ${fichier} :: ${path}`);
      parCle.set(path, n);
      out.push({ fichier, ref: path, noeud: n, classe: classe(n), empreinte: empreinteDeSite(n) });
    }
  }
  return out.sort((a, b) => parUnitesDeCode(a.fichier, b.fichier) || parUnitesDeCode(a.ref, b.ref));
}

/** Les sites du stock des structures locales : D5, G1 et L, en `{ file, ref }` avec classe et empreinte. */
export const sitesDeStructure = (noeuds: readonly NoeudDeStructure[] = noeudsDeStructure()): SiteDeStructure[] =>
  noeuds.filter((n) => AU_STOCK.has(n.classe)).map(({ fichier, ref, classe, empreinte }) => ({ file: fichier, ref, classe, empreinte }));

/** Le MOTIF du stock, dernière phrase du refus de sa régénération. */
export const MOTIF_STRUCTURES_LOCALES =
  'Une structure neuve compose un nœud PARTAGÉ de la grammaire (`src/data/schemas/grammaire/`) : elle ne s’inscrit pas ici.';

/** La RÉGÉNÉRATION du stock (`PORTEURS.STRUCTURES_LOCALES`), sites sans classe ni empreinte. Commande :
 *  `npx tsx scripts/guards/lib/regenStock.mts scripts/guards/lib/structuresLocales.mts [--check]`. */
export const regenerations = (noeuds: readonly NoeudDeStructure[] = noeudsDeStructure()): RegenerationDeStock[] => [{
  chemin: fileURLToPath(new URL(`../../../${PORTEURS.STRUCTURES_LOCALES}`, import.meta.url)),
  politique: DECROISSANT,
  collections: [{ nom: 'STRUCTURES_LOCALES', sites: sitesDeStructure(noeuds).map(({ file, ref }) => ({ file, ref })), motif: MOTIF_STRUCTURES_LOCALES }],
}];
