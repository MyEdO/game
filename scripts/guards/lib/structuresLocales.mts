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
 * POINT CONJOINT (`pointsConjoints`) : les nœuds qui jugent ensemble la MÊME valeur, comme la co-descente les
 * ferme (`ouverts`) — côtés d'une intersection (`&0`/`&1` ne sont pas des positions de la donnée, `segmentDeCle`),
 * enveloppes, côtés d'un pipe —, puis, de proche en proche, les enfants de même segment de nœuds conjoints
 * (intersection implicite). Un point est UN site, de la classe la plus lourde de ses nœuds objets ou non validants
 * (`D5` > `L` > `G1` > `G`), d'empreinte les champs fusionnés de ses objets. Le reste (`.*`) d'un objet conjoint
 * n'est pas un site quand son point est déjà `D5` ou qu'un autre objet y ferme le reste (`catchall` `never`).
 *
 * L'EMPREINTE d'un site (ses clés déclarées et le type zod de chaque enfant) vit dans la mesure, hors du
 * stock : la porte des comptes (`occurrencesStock.mjs`, `renommagesDeStructure`) apparie par elle un site
 * disparu et un site né d'un même document (`nomDuDocument`).
 *
 * CHEMINS DE DOCUMENT (`cheminsDeDocument`, plancher `FEUILLES_D_ID` de `occurrencesStock.mjs`) : chaque chemin de
 * schéma d'un document, sous le même nom de document et les mêmes noms de branche, avec son ÉTAT (`admisDe`) : `idDe`
 * quand il porte une référence (`estFeuilleDId`, `grammaire/ref.ts`) et qu'aucune alternative n'y admet une valeur
 * libre, `ferme` quand il n'admet que des valeurs closes (enum, littéral, nombre…), `libre` sinon. Le plancher cède sur
 * tout chemin `idDe` qui ne l'est plus à la tête, `ferme` compris.
 */
import { fileURLToPath, pathToFileURL } from 'node:url';
import { SCHEMA_DEFS } from '../../../src/data/schemas/_registry.generated';
import { SCHEMA_DEFS_SCENES } from '../../../src/data/schemas/_registry-scenes.generated';
import type { SchemaDef } from '../../../src/data/schemas/types';
import { declarationDEnfants, defDe, descendre, enfantsDe, ouverts, valeursAdmises } from '../../../src/data/schemas/grammaire/descente';
import { CLES_ENVELOPPE } from '../../../src/data/schemas/grammaire/document';
import { famillesConstruites, OP_DEFS } from '../../../src/data/schemas/grammaire/mecanique';
import { classeDeProduit } from '../../../src/data/schemas/grammaire/produits';
import { estFeuilleDId } from '../../../src/data/schemas/grammaire/ref';
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
/** Le POIDS d'une classe dans un point conjoint : la plus lourde fait la classe du site. */
const POIDS: Readonly<Record<ClasseDeStructure, number>> = { G: 0, G1: 1, L: 2, D5: 3 };
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

/** Le segment de CLÉ d'un enfant de `parent` : le nom de branche d'une option d'union (`nomDeBranche`), `''` pour un
 *  côté d'intersection, nommé au chemin de l'intersection ; le segment de descente sinon. */
const segmentDeCle = (parent: unknown, e: { readonly noeud: unknown; readonly segment: string }): string =>
  e.segment.startsWith('|') ? nomDeBranche(parent, e.noeud) : e.segment.startsWith('&') ? '' : e.segment;

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
      const s = segmentDeCle(p.n, e);
      pousser({ n: e.noeud, path: p.path + s, cout: p.cout + (s === '' ? 0 : 1) });
    }
  }
  return meilleurs;
}

/**
 * Les POINTS CONJOINTS des nœuds de `chemins` : le représentant du point de chaque nœud. Un point part de la
 * fermeture d'une intersection par la co-descente (`ouverts`), restreinte à son chemin (une branche d'union est
 * une alternative, à son propre chemin) ; puis les enfants de même segment de nœuds d'un même point y forment un
 * point, fermé de même. Sans intersection, chaque nœud est seul en son point. PURE.
 */
export function pointsConjoints(chemins: ReadonlyMap<object, Chemin>): (n: object) => object {
  const parent = new Map<object, object>();
  const rep = (n: object): object => {
    let r = n;
    while (parent.has(r)) r = parent.get(r)!;
    return r;
  };
  const unir = (a: object, b: object): boolean => {
    const [ra, rb] = [rep(a), rep(b)];
    if (ra !== rb) parent.set(rb, ra);
    return ra !== rb;
  };
  const fermer = (racines: readonly object[], path: string): boolean =>
    ouverts(racines)
      .filter((m): m is object => estNoeud(m) && chemins.get(m)?.path === path)
      .concat(racines.slice(1))
      .reduce((change, m) => unir(racines[0], m) || change, false);
  for (const [n, { path }] of chemins) if (defDe(n)!.type === 'intersection') fermer([n], path);
  for (let change = true; change; ) {
    change = false;
    const membres = new Map<object, object[]>();
    for (const n of chemins.keys()) membres.set(rep(n), [...(membres.get(rep(n)) ?? []), n]);
    for (const [r, point] of membres) {
      if (point.length < 2) continue;
      const path = chemins.get(r)!.path;
      const parSegment = new Map<string, object[]>();
      for (const m of point)
        for (const e of enfantsDe(m)) {
          const s = segmentDeCle(m, e);
          if (s === '' || s.startsWith('|') || !estNoeud(e.noeud) || chemins.get(e.noeud)?.path !== path + s) continue;
          parSegment.set(s, [...(parSegment.get(s) ?? []), e.noeud]);
        }
      for (const [s, enfants] of parSegment) if (new Set(enfants.map(rep)).size > 1) change = fermer(enfants, path + s) || change;
    }
  }
  return rep;
}

/** L'EMPREINTE d'un site : `clé:type` de chaque enfant d'un objet, triés ; le type d'un nœud non validant. */
export function empreinteDeSite(noeud: unknown): string {
  const def = defDe(noeud);
  if (def?.type !== 'object') return def?.type ?? '';
  return empreinteDeChamps(enfantsDe(noeud).map((e) => [e.segment.slice(1), defDe(e.noeud)?.type ?? '']));
}

/** L'EMPREINTE d'un point conjoint (`empreinteDeChamps`) : les champs fusionnés de ses objets, une clé portée par
 *  plusieurs au type `intersection` ; sans objet, celle de son premier nœud (`empreinteDeSite`). */
function empreinteConjointe(noeuds: readonly object[]): string {
  const objets = noeuds.filter((n) => defDe(n)?.type === 'object');
  if (!objets.length) return empreinteDeSite(noeuds[0]);
  const types = new Map<string, Set<string>>();
  for (const o of objets) for (const e of enfantsDe(o)) types.set(e.segment.slice(1), (types.get(e.segment.slice(1)) ?? new Set()).add(defDe(e.noeud)?.type ?? ''));
  return empreinteDeChamps([...types].map(([cle, t]) => [cle, t.size === 1 ? [...t][0] : 'intersection']));
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

/** Un schéma DISTINCT des `defs` : le nom de son document (`nomDuDocument`), sa famille et le plus court chemin de chacun
 *  de ses nœuds (`cheminsDeSchema`). */
type SchemaNomme = { readonly fichier: string; readonly schema: unknown; readonly famille: SchemaDef['famille']; readonly chemins: Map<object, Chemin> };

/** Les schémas DISTINCTS des `defs`, chacun sous le nom de son document. PURE sur les defs. Lève sur deux schémas d'un
 *  même nom. */
function schemasNommes(defs: readonly SchemaDef[]): SchemaNomme[] {
  const types = new Map<unknown, SchemaDef[]>();
  for (const d of defs) types.set(d.schema, [...(types.get(d.schema) ?? []), d]);
  const noms = new Map<string, readonly SchemaDef[]>();
  return [...types].map(([schema, documents]) => {
    const chemins = cheminsDeSchema(schema);
    const fichier = nomDuDocument(documents, chemins);
    const homonyme = noms.get(fichier);
    if (homonyme) throw new Error(`structures locales : ${fichier} nomme deux schémas (${[...homonyme, ...documents].map((x) => x.file).join(', ')})`);
    noms.set(fichier, documents);
    return { fichier, schema, famille: documents[0].famille, chemins };
  });
}

/**
 * Les nœuds de site des `defs`, classés, dans l'ordre des defs puis des clés. PURE sur les defs : aucune
 * donnée n'est lue. Lève sur deux nœuds d'un même type à la même clé.
 */
export function noeudsDeStructure(defs: readonly SchemaDef[] = [...SCHEMA_DEFS, ...SCHEMA_DEFS_SCENES]): NoeudDeStructure[] {
  const nommes = schemasNommes(defs);
  const grammaire = atteints([...EXPORTS_DE_GRAMMAIRE, ...Object.values(OP_DEFS)]);
  const payloads = atteints(famillesConstruites().flatMap((f) => Object.values(f.opDefs)));
  const composeurs = new Map<object, Set<unknown>>();
  for (const { schema } of nommes) for (const n of atteints([schema])) composeurs.set(n, (composeurs.get(n) ?? new Set()).add(schema));
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
  const estDeSite = (n: object): boolean => defDe(n)!.type === 'object' || NON_VALIDANTS.has(defDe(n)!.type);
  const out: NoeudDeStructure[] = [];
  for (const { fichier, famille, chemins } of nommes) {
    const point = pointsConjoints(chemins);
    const membres = new Map<object, object[]>();
    const parentDuReste = new Map<object, object>();
    for (const n of chemins.keys()) {
      if (estDeSite(n)) membres.set(point(n), [...(membres.get(point(n)) ?? []), n]);
      for (const e of enfantsDe(n)) if (e.segment === '.*' && estNoeud(e.noeud)) parentDuReste.set(e.noeud, n);
    }
    /** Le point est-il D5, ou un de ses objets ferme-t-il le reste (`catchall` `never`) ? */
    const resteJuge = (p: readonly object[]): boolean =>
      p.some((m) => NON_VALIDANTS.has(defDe(m)!.type) || defDe(enfantsDe(m).find((e) => e.segment === '.*')?.noeud)?.type === 'never');
    const parCle = new Map<string, object>();
    for (const [r, noeuds] of membres) {
      const { path } = chemins.get(noeuds[0])!;
      if (horsSite(path, famille)) continue;
      const porteur = noeuds.map((n) => parentDuReste.get(n)).find((p) => p !== undefined && `${chemins.get(p)?.path}.*` === path);
      if (porteur !== undefined && resteJuge(membres.get(point(porteur)) ?? [])) continue;
      const deja = parCle.get(path);
      if (deja !== undefined && deja !== r) throw new Error(`structures locales : deux nœuds à la même clé ${fichier} :: ${path}`);
      parCle.set(path, r);
      out.push(noeuds.length === 1
        ? { fichier, ref: path, noeud: noeuds[0], classe: classe(noeuds[0]), empreinte: empreinteDeSite(noeuds[0]) }
        : { fichier, ref: path, noeud: noeuds[0], classe: noeuds.map(classe).reduce((a, b) => (POIDS[b] > POIDS[a] ? b : a)), empreinte: empreinteConjointe(noeuds) });
    }
  }
  return out.sort((a, b) => parUnitesDeCode(a.fichier, b.fichier) || parUnitesDeCode(a.ref, b.ref));
}

/** L'ÉTAT d'un chemin de schéma de document (`classeDuNoeud`) : `idDe` quand il porte une référence et qu'aucune de ses
 *  alternatives n'admet une valeur libre ; `ferme` quand il n'admet que des valeurs closes ; `libre` sinon. */
export type EtatDeChemin = 'idDe' | 'ferme' | 'libre';
/** Un CHEMIN de schéma de document : le nom du document, son chemin de schéma, et son état. */
export type CheminDeDocument = Site & { readonly etat: EtatDeChemin };

/** Ce qu'un nœud admet : une RÉFÉRENCE (`ref`), des valeurs CLOSES seules (`clos`), ou une valeur LIBRE (`libre`). */
type Admis = 'ref' | 'clos' | 'libre';
/** Les types zod d'une valeur CLOSE : aucune chaîne libre ni structure n'y entre. */
const FERMES: ReadonlySet<string> = new Set(['enum', 'literal', 'number', 'int', 'boolean', 'null', 'undefined', 'nan', 'bigint', 'date', 'void', 'never']);
/** Les enveloppes qui admettent ce qu'admet leur nœud intérieur. */
const ENVELOPPES: ReadonlySet<string> = new Set(['optional', 'nullable', 'default', 'prefault', 'readonly', 'nonoptional', 'lazy']);
const RANG: Readonly<Record<Admis, number>> = { clos: 0, ref: 1, libre: 2 };
/** Des ALTERNATIVES : la plus large l'emporte (`libre` > `ref` > `clos`), `clos` sans alternative. */
const auMoins = (admis: readonly Admis[]): Admis => admis.reduce<Admis>((a, b) => (RANG[b] > RANG[a] ? b : a), 'clos');
/** Des contraintes CONJOINTES (pipe, intersection) : une référence suffit, puis une valeur close. */
const auPlus = (admis: readonly Admis[]): Admis => (admis.includes('ref') ? 'ref' : admis.includes('clos') ? 'clos' : 'libre');

const enfantsAuSegment = (n: unknown, garde: (segment: string) => boolean): unknown[] =>
  enfantsDe(n).filter((e) => garde(e.segment)).map((e) => e.noeud);

/**
 * Ce qu'admet `n` (`Admis`). LIBRE : chaîne hors feuille `idDe`, nœud non validant, `transform` hors d'un pipe, `catch`,
 * record, objet dont l'`id` n'est pas une référence, objet sans `id` dont un champ n'est pas clos (hors tirage `pick`,
 * `grammaire/ref.ts`), liste ou ensemble dont un élément admet une valeur libre, pipe dont l'ENTRÉE est un `transform`
 * (`z.preprocess`). Un pipe dont la SORTIE est un `transform` admet ce qu'admet son entrée. Un nœud déjà en cours de
 * descente (récursion `z.lazy`) n'ajoute rien.
 */
function admisDe(n: unknown, descente: Descente = { enCours: new Set(), boucle: false }): Admis {
  const def = defDe(n);
  if (!def) return 'libre';
  if (estFeuilleDId(n)) return 'ref';
  const connu = ADMIS.get(n as object);
  if (connu) return connu;
  if (descente.enCours.has(n)) {
    descente.boucle = true;
    return 'clos';
  }
  const boucleAvant = descente.boucle;
  descente.boucle = false;
  descente.enCours.add(n);
  const admis = admisSansMemoire(n, def, (m) => admisDe(m, descente));
  descente.enCours.delete(n);
  if (!descente.boucle) ADMIS.set(n as object, admis);
  descente.boucle ||= boucleAvant;
  return admis;
}

/** La descente d'`admisDe` : les nœuds en cours, et si l'un d'eux a été revu (le résultat ne se mémorise pas). */
type Descente = { readonly enCours: Set<unknown>; boucle: boolean };
/** `admisDe` des nœuds dont la descente n'a revu aucun nœud en cours. */
const ADMIS = new WeakMap<object, Admis>();

/** Ce qu'admet `n` selon son type, ses enfants lus par `de`. */
function admisSansMemoire(n: unknown, def: NonNullable<ReturnType<typeof defDe>>, de: (m: unknown) => Admis): Admis {
  const declares = declarationDEnfants(n);
  if (declares) return auMoins(declares.enfants.map((e) => de(e.noeud)));
  const type = def.type;
  if (FERMES.has(type)) return 'clos';
  if (ENVELOPPES.has(type)) return auMoins(enfantsAuSegment(n, (s) => s === '').map(de));
  if (type === 'union') return auMoins(enfantsAuSegment(n, (s) => s.startsWith('|')).map(de));
  if (type === 'intersection') return auPlus(enfantsAuSegment(n, (s) => s.startsWith('&')).map(de));
  if (type === 'pipe') {
    const [entree, sortie] = enfantsAuSegment(n, (s) => s === '');
    if (defDe(entree)?.type === 'transform') return 'libre';
    return defDe(sortie)?.type === 'transform' ? de(entree) : auPlus([de(entree), de(sortie)]);
  }
  if (type === 'object') {
    const id = enfantsDe(n).find((e) => e.cle === 'id');
    if (id !== undefined) return de(id.noeud) === 'ref' ? 'ref' : 'libre';
    const champs = enfantsAuSegment(n, (s) => s.startsWith('.')).map(de);
    if (classeDeProduit(n)?.fabrique === 'pick') return auMoins(champs);
    return champs.every((a) => a === 'clos') ? 'clos' : 'libre';
  }
  if (type === 'array' || type === 'tuple') return auMoins(enfantsAuSegment(n, (s) => s.startsWith('[')).map(de));
  if (type === 'set') return auMoins(enfantsAuSegment(n, (s) => s === '{}').map(de));
  return 'libre';
}

const ETAT_DE: Readonly<Record<Admis, EtatDeChemin>> = { ref: 'idDe', clos: 'ferme', libre: 'libre' };
/** L'état (`EtatDeChemin`) des nœuds d'un chemin, par point conjoint de leur parent : conjoints dans un point
 *  (`auPlus`), alternatives d'un point à l'autre (`auMoins`). */
const etatDuChemin = (parPoint: Iterable<readonly unknown[]>): EtatDeChemin =>
  ETAT_DE[auMoins([...parPoint].map((noeuds) => auPlus(noeuds.map((n) => admisDe(n)))))];

/**
 * Les CHEMINS de schéma de document des `defs` (#3021) : chaque chemin qu'une arête d'un nœud nommé (`cheminsDeSchema`)
 * ouvre, sous le nom de son document et les noms de branche des structures locales, avec son état (`etatDuChemin`).
 * PURE sur les defs, triés par document puis chemin.
 */
export function cheminsDeDocument(defs: readonly SchemaDef[] = [...SCHEMA_DEFS, ...SCHEMA_DEFS_SCENES]): CheminDeDocument[] {
  const out: CheminDeDocument[] = [];
  for (const { fichier, chemins } of schemasNommes(defs)) {
    const point = pointsConjoints(chemins);
    const parChemin = new Map<string, Map<object, unknown[]>>();
    for (const [n, { path }] of chemins)
      for (const e of enfantsDe(n)) {
        const s = segmentDeCle(n, e);
        if (s === '') continue;
        const ref = path + s;
        const parPoint = parChemin.get(ref) ?? new Map<object, unknown[]>();
        parPoint.set(point(n), [...(parPoint.get(point(n)) ?? []), e.noeud]);
        parChemin.set(ref, parPoint);
      }
    for (const [ref, parPoint] of parChemin) out.push({ file: fichier, ref, etat: etatDuChemin(parPoint.values()) });
  }
  return out.sort((a, b) => parUnitesDeCode(a.file, b.file) || parUnitesDeCode(a.ref, b.ref));
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
