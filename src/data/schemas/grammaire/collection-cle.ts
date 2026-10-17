/**
 * COLLECTION À CLÉ (#1897, #1463) — une collection dont chaque élément a une IDENTITÉ, DÉCLARÉE au
 * nœud qui la porte, jamais devinée. Deux instances : une LISTE (la clé se lit dans chaque élément) et
 * un RECORD (les noms de propriété). `marquerCollection(noeud, marque)` est la seule primitive : elle
 * pose sur le nœud FINAL l'UNICITÉ de la clé d'une liste (la valeur en double est le SUJET du message,
 * jamais son emplacement) et la MARQUE. `listeCle(element, cle)` construit une liste à clé ; `document()`
 * (`grammaire/document.ts`) marque la charge d'un document après son affinage.
 *
 * La marque se lit au nœud, par la CO-DESCENTE d'une donnée avec son schéma (`coDescendre`,
 * `grammaire/descente.ts`) : la résolution des fautes (`schemas/validate.ts`, `lieuDe`) nomme un élément
 * par sa clé plutôt que par son rang ; `collectionsDuDocument` rend chaque collection présente à sa
 * SUITE NICHÉE (`suiteAvecPas`, `grammaire/cle-d-espace.ts`), lue par la phase 2 de `npm run gen` ;
 * `atteindre` lit celle d'une suite (`collectionALaCle` pour les gardes), et `lectureDeLEspace` y lit les
 * ids d'une clé d'espace (phase 2 de `npm run gen` sur le JSON disque, régime vivant sur les racines
 * vivantes). La descente du schéma
 * seul (`descendre`) la retrouve.
 * Un `.min`/`.refine` posé APRÈS clone le nœud : le clone garde le CONTRÔLE de la marque sans la
 * marque, et `collectionsPerdues` le nomme.
 *
 * Une collection n'est un ESPACE DE NOMS que si sa marque porte `espace` : une clé d'unicité seule
 * (`members`, `stations`, `layers`, `walls` de `defs-scenes/scene.ts`) n'en ouvre aucun, et une clé
 * d'élément qui est une feuille `idDe` (une RÉFÉRENCE) n'en ouvre jamais.
 */
import { z } from 'zod';
import './locale-fr';
import { coDescendre, defDe, descendre, enfantsDe, ouverts, pasDeDonnee, type DecisionDeVisite, type PointDeDonnee } from './descente';
import { baseDe, cleDesSpecs, cleNichee, estPrefixeDeSuite, idsDeCollection, lireCleDEspace, pasDeLaSuite, suiteAvecPas, type FiltreDEspace } from './cle-d-espace';
import { estFeuilleDId } from './ref';
import { SOURCES_DE_SPECS, type SourceDeSpecs } from './sourcesDeSpecs';

/** Clé d'un élément : un CHAMP de l'élément, une clé COMPOSÉE nommée (`walls` : `x,y,side,z`), ou
 *  l'élément SCALAIRE lui-même (`scalaire` : `couvre`, liste de chaînes). */
export type CleDElement<T> =
  | Extract<keyof T, string>
  | { readonly nom: string; readonly de: (element: T) => string | undefined }
  | { readonly nom: string; readonly scalaire: true };

/**
 * Paramètres d'un ESPACE DE NOMS — une collection marquée `espace` en ouvre un, et chaque paramètre
 * y ajoute des espaces FILTRÉS (`grammaire/cle-d-espace.ts`) : `discriminant`, un espace par valeur du
 * champ (`materials.json?domain=prop`) ; `marqueurs`, un espace par champ, les éléments qui le PORTENT
 * (`props.json?volume`). La phase 2 de `npm run gen` (`scripts/gen-espaces.mts`) les lit au nœud.
 */
export interface EspaceDeNoms {
  readonly discriminant?: string;
  /** Second rôle du `discriminant` : les clés de CHARGE admises par valeur du champ, ce que l'atelier
   *  présente d'une entrée (`chargeDiscriminee`, `schemas/validate.ts`). Exige `discriminant`. */
  readonly chargeParDiscriminant?: Readonly<Record<string, readonly string[]>>;
  readonly marqueurs?: readonly string[];
}

/**
 * Marque d'une collection à clé. `liste` : le NOM de la clé (message, compteur) et sa lecture sur un
 * élément BRUT. `record` : les ids sont les noms de propriété de la carte, portée par le champ `sous`
 * de la valeur marquée (`entries` d'un document `record`), ou par la valeur elle-même.
 */
export type MarqueDeCollection =
  | {
      readonly forme: 'liste';
      readonly nom: string;
      readonly de: (element: unknown) => string | undefined;
      readonly espace?: EspaceDeNoms;
    }
  | { readonly forme: 'record'; readonly sous?: string; readonly espace?: EspaceDeNoms };

const COLLECTIONS = new WeakMap<object, MarqueDeCollection>();
/** Le contrôle que `marquerCollection` pose, et sa marque : un clone du nœud marqué le recopie. */
const CONTROLES = new WeakMap<object, MarqueDeCollection>();

/** La clé LISIBLE d'une valeur : une chaîne vide ne nomme rien (sa forme est refusée par l'élément). */
const texteDeCle = (v: unknown): string | undefined =>
  typeof v === 'string' && v !== '' ? v : typeof v === 'number' ? String(v) : undefined;

const estObjet = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object';

/** Marque d'une LISTE dont `cle` identifie les éléments. */
export function marqueDeListe<T>(cle: CleDElement<T>, espace?: EspaceDeNoms): MarqueDeCollection {
  if (espace && typeof cle === 'object' && 'scalaire' in cle)
    throw new Error('marqueDeListe : `espace` refusé — une liste de scalaires est une liste de RÉFÉRENCES.');
  const lecture =
    typeof cle === 'string'
      ? { nom: cle, de: (el: unknown) => (estObjet(el) ? texteDeCle(el[cle]) : undefined) }
      : 'scalaire' in cle
        ? { nom: cle.nom, de: texteDeCle }
        : { nom: cle.nom, de: (el: unknown) => (estObjet(el) ? cle.de(el as T) : undefined) };
  return espace ? { forme: 'liste', ...lecture, espace } : { forme: 'liste', ...lecture };
}

/** Marque d'un RECORD dont les noms de propriété sont les ids — la carte au champ `sous`, s'il est donné. */
export function marqueDeRecord(options: { readonly sous?: string; readonly espace?: EspaceDeNoms } = {}): MarqueDeCollection {
  return { forme: 'record', ...options };
}

/** Les CARTES d'un record marqué parmi `noeuds` : les nœuds eux-mêmes, ou ceux de leur champ `sous`. */
const cartesDuRecord = (noeuds: readonly unknown[], marque: Extract<MarqueDeCollection, { forme: 'record' }>): unknown[] =>
  marque.sous === undefined ? ouverts(noeuds) : ouverts(pasDeDonnee(ouverts(noeuds), marque.sous));

/** Les nœuds de schéma d'un ÉLÉMENT de la collection marquée `marque` portée par `noeuds` : l'élément
 *  d'une liste, la valeur d'un record — à ouvrir par la valeur de l'élément (`ouverts`). */
export function noeudsDeLElement(noeuds: readonly unknown[], marque: MarqueDeCollection): unknown[] {
  if (marque.forme === 'liste') return pasDeDonnee(ouverts(noeuds), 0);
  return cartesDuRecord(noeuds, marque).flatMap((n) => enfantsDe(n).filter((e) => e.segment === '{}').map((e) => e.noeud));
}

/** Les nœuds de schéma qui portent la CLÉ d'un élément de la collection marquée. */
function noeudsDeCle(noeud: unknown, marque: MarqueDeCollection): unknown[] {
  if (marque.forme === 'liste') return ouverts(pasDeDonnee(ouverts(noeudsDeLElement([noeud], marque)), marque.nom));
  return cartesDuRecord([noeud], marque).flatMap((n) => enfantsDe(n).filter((e) => e.segment === '{clé}').map((e) => e.noeud));
}

/** Une feuille `idDe` est-elle atteinte depuis `noeud`, à travers ses seules enveloppes ? */
function porteUneFeuilleDId(noeud: unknown): boolean {
  if (estFeuilleDId(noeud)) return true;
  return enfantsDe(noeud).some((e) => e.segment === '' && porteUneFeuilleDId(e.noeud));
}

/**
 * Marque la collection `noeud` et rend le nœud FINAL qui porte la marque. Une liste y gagne l'UNICITÉ
 * de sa clé (un élément sans clé lisible n'entre pas dans le compte : sa forme est refusée ailleurs,
 * par le schéma de l'élément). FAIL-FAST à la CONSTRUCTION : `espace` sur une collection dont la clé
 * d'élément est une feuille `idDe` — une liste de RÉFÉRENCES n'est jamais un espace de noms.
 */
export function marquerCollection<N extends z.ZodType>(noeud: N, marque: MarqueDeCollection): N {
  if (marque.espace?.chargeParDiscriminant && marque.espace.discriminant === undefined)
    throw new Error('marquerCollection : `chargeParDiscriminant` sans `discriminant` — la charge se partitionne par les valeurs d’un champ discriminant.');
  if (marque.espace && noeudsDeCle(noeud, marque).some(porteUneFeuilleDId)) {
    const cle = marque.forme === 'liste' ? `la clé « ${marque.nom} »` : 'la clé de record';
    throw new Error(`marquerCollection : \`espace\` refusé — ${cle} est une feuille \`idDe\`, la collection est une liste de RÉFÉRENCES.`);
  }
  const marquee = noeud.superRefine((valeur, ctx) => {
    if (marque.forme !== 'liste' || !Array.isArray(valeur)) return;
    const vues = new Set<string>();
    valeur.forEach((el, i) => {
      const cle = marque.de(el);
      if (cle === undefined) return;
      if (vues.has(cle))
        ctx.addIssue({
          code: 'custom',
          path: [i],
          message: `« ${cle} » dupliqué : « ${marque.nom} » identifie l’élément dans sa liste, il y est unique.`,
        });
      vues.add(cle);
    });
  }) as N;
  COLLECTIONS.set(marquee, marque);
  const controles = defDe(marquee)?.checks ?? [];
  const controle = controles[controles.length - 1];
  if (typeof controle === 'object' && controle !== null) CONTROLES.set(controle, marque);
  return marquee;
}

/** Options de FORME de la liste, posées AVANT la marque (un `.min` posé après clonerait le nœud). */
export interface OptionsDeListeCle {
  readonly min?: { readonly taille: number; readonly message: string };
  readonly espace?: EspaceDeNoms;
}

/** Liste d'éléments IDENTIFIÉS par `cle`, unique dans la liste. */
export function listeCle<E extends z.ZodType>(
  element: E,
  cle: CleDElement<z.output<E>>,
  options: OptionsDeListeCle = {},
): z.ZodArray<E> {
  const base = z.array(element);
  const bornee = options.min ? base.min(options.min.taille, options.min.message) : base;
  return marquerCollection(bornee, marqueDeListe(cle, options.espace));
}

/** Marque de collection portée par un nœud, `undefined` sinon. */
export const collectionDe = (noeud: unknown): MarqueDeCollection | undefined => (estObjet(noeud) ? COLLECTIONS.get(noeud) : undefined);

/** Collections à clé RETROUVÉES par la descente d'un schéma (`descendre`). */
export function collectionsRetrouvees(schema: unknown): Set<object> {
  const trouvees = new Set<object>();
  descendre([schema], ({ noeud }) => {
    if (COLLECTIONS.has(noeud)) trouvees.add(noeud);
  });
  return trouvees;
}

/** Collections à clé PERDUES dans un schéma : les nœuds qui portent le contrôle d'une marque sans la
 *  marque — le clone d'une collection marquée, par un `.min`/`.refine` posé APRÈS `marquerCollection`. */
export function collectionsPerdues(schema: unknown): MarqueDeCollection[] {
  const perdues: MarqueDeCollection[] = [];
  descendre([schema], ({ noeud, def }) => {
    if (COLLECTIONS.has(noeud)) return;
    for (const c of def.checks ?? []) {
      const marque = typeof c === 'object' && c !== null ? CONTROLES.get(c) : undefined;
      if (marque) perdues.push(marque);
    }
  });
  return perdues;
}

/** Une collection marquée PRÉSENTE dans un document : sa suite nichée (`''` à la racine, graphie de
 *  `suiteAvecPas`), sa marque, sa valeur, ses ids, et les rangs de ses éléments ANONYMES (liste
 *  marquée dont la marque ne lit aucune clé : sous-arbre élagué). */
export interface CollectionDuDocument {
  readonly suite: string;
  readonly marque: MarqueDeCollection;
  readonly valeur: unknown;
  readonly ids: readonly string[];
  readonly anonymes: readonly number[];
}

/** Un point de la co-descente vu par les collections : sa suite, sa marque, et le chemin de la
 *  première liste NON marquée qu'il traverse. */
type PointDeCollection = { readonly suite: string; readonly marque?: MarqueDeCollection; readonly sousListe?: readonly (string | number)[] };

const cheminLu = (chemin: readonly (string | number)[]): string => chemin.map(String).join('.') || '(racine)';

/**
 * Co-descente d'un document par les COLLECTIONS : chaque point reçoit sa suite, composée par
 * `suiteAvecPas`, et sa marque. Faits de SCHÉMA, qui LÈVENT : deux marques différentes sur un même
 * point ; un espace de noms sous une liste non marquée. Fait de DONNÉE : l'élément d'une liste marquée
 * dont la marque ne lit aucune clé n'est pas un pas `[]` — son sous-arbre est élagué, et `anonyme` le
 * reçoit.
 */
function coDescendreLesCollections(
  schema: unknown,
  donnee: unknown,
  visite: (p: PointDeDonnee, c: PointDeCollection) => DecisionDeVisite,
  anonyme: (liste: PointDeDonnee, rang: number) => void = () => undefined,
): void {
  const vus = new Map<PointDeDonnee, PointDeCollection>();
  coDescendre(schema, donnee, (p) => {
    const parent = p.parent && vus.get(p.parent);
    const cle = p.chemin[p.chemin.length - 1];
    let suite = '';
    let sousListe = parent?.sousListe;
    if (parent && typeof cle === 'string') suite = suiteAvecPas(parent.suite, { champ: cle });
    else if (parent && typeof cle === 'number') {
      if (parent.marque?.forme === 'liste') {
        const lue = parent.marque.de(p.valeur);
        if (lue === undefined) {
          anonyme(p.parent!, cle);
          return 'elaguer';
        }
        suite = suiteAvecPas(parent.suite, { cle: lue });
      } else {
        suite = suiteAvecPas(parent.suite, { rang: true });
        sousListe ??= p.parent!.chemin;
      }
    }
    const marques = [...new Set(p.noeuds.map(collectionDe).filter((m): m is MarqueDeCollection => m !== undefined))];
    if (marques.length > 1) throw new Error(`collection à clé : ${marques.length} marques différentes au point « ${cheminLu(p.chemin)} ».`);
    const [marque] = marques;
    if (marque?.espace && sousListe)
      throw new Error(
        `clé d'espace : l'espace de noms « ${cheminLu(p.chemin)} » est sous la liste NON marquée « ${cheminLu(sousListe)} » — le rang d'un élément n'identifie rien.`,
      );
    const point: PointDeCollection = { suite, marque, sousListe };
    vus.set(p, point);
    return visite(p, point);
  });
}

/** Les collections marquées PRÉSENTES dans `donnee` (ni `null` ni `undefined`), dans l'ordre de la
 *  donnée — par co-descente, sans parse : un arbre invalide a ses collections (pose transactionnelle,
 *  copie modifiée). */
export function collectionsDuDocument(schema: unknown, donnee: unknown): CollectionDuDocument[] {
  const out: { collection: Omit<CollectionDuDocument, 'anonymes'>; anonymes: number[] }[] = [];
  const parPoint = new Map<PointDeDonnee, number[]>();
  coDescendreLesCollections(
    schema,
    donnee,
    (p, { suite, marque }) => {
      if (!marque || p.valeur === null || p.valeur === undefined) return;
      const anonymes: number[] = [];
      parPoint.set(p, anonymes);
      out.push({ collection: { suite, marque, valeur: p.valeur, ids: idsDeCollection(marque, p.valeur) }, anonymes });
    },
    (liste, rang) => parPoint.get(liste)?.push(rang),
  );
  return out.map(({ collection, anonymes }) => ({ ...collection, anonymes }));
}

/** Une collection d'un document NOMMÉ, à sa CLÉ DE COLLECTION (`fichier`, `fichier#<suite nichée>`). */
export type CollectionDeFichier = CollectionDuDocument & { readonly dataset: string; readonly cle: string };

/** Les collections des documents de `defs` présents dans `brutParNom`, à leur clé de collection. Une
 *  levée de `collectionsDuDocument` nomme son document. */
export function collectionsDesDocuments(
  defs: readonly { readonly file: string; readonly schema: unknown }[],
  brutParNom: ReadonlyMap<string, unknown>,
): CollectionDeFichier[] {
  const duDocument = (d: { readonly file: string; readonly schema: unknown }): CollectionDuDocument[] => {
    try {
      return collectionsDuDocument(d.schema, brutParNom.get(d.file));
    } catch (e) {
      throw new Error(`${d.file} — ${e instanceof Error ? e.message : String(e)}`, { cause: e });
    }
  };
  return defs
    .filter((d) => brutParNom.has(d.file))
    .flatMap((d) => duDocument(d).map((c) => ({ ...c, dataset: d.file, cle: cleNichee(d.file, c.suite) })));
}

/** Une collection à clé atteinte par sa suite : sa marque, sa valeur (`undefined` : absente de la donnée)
 *  et ses nœuds de schéma (`ouverts` par sa valeur quand la donnée l'atteint). */
export interface CollectionALaCle {
  readonly marque: MarqueDeCollection;
  readonly valeur: unknown;
  readonly noeuds: readonly unknown[];
}

/** La graphie d'une suite dans un message. */
const suiteDite = (suite: string): string => `« ${suite || '(racine)'} »`;

/**
 * La co-descente des collections de `racine`, élaguée hors du chemin de `suite` (`''` : la racine ;
 * `[art].specs`, `rangedMod`) : la collection à clé atteinte au PREMIER point de la donnée qui a cette
 * suite, et le nombre de ces points. Une collection absente de la donnée (`null` ou `undefined`) rend
 * `valeur: undefined`, le reste de sa suite se lisant alors sur le schéma seul ; `atteinte: undefined` si
 * la suite ne mène à aucune collection marquée. LÈVE si la suite porte un pas `[]` (un point par élément
 * sous une liste non marquée, graphie étrangère à une liste marquée).
 */
function parcourirLaSuite(schema: unknown, racine: unknown, suite: string): { readonly atteinte: CollectionALaCle | undefined; readonly points: number } {
  if (pasDeLaSuite(suite).some((pas) => 'rang' in pas)) throw new Error(`Suite ${suiteDite(suite)} porte un pas « [] », qui ne désigne pas UN point.`);
  let atteint: { point: PointDeDonnee; collection: PointDeCollection } | undefined;
  let exacts = 0;
  coDescendreLesCollections(schema, racine, (point, collection) => {
    if (!estPrefixeDeSuite(collection.suite, suite)) return 'elaguer';
    if (!atteint || collection.suite.length > atteint.collection.suite.length) atteint = { point, collection };
    if (collection.suite !== suite) return undefined;
    exacts++;
    return 'elaguer';
  });
  if (!atteint) return { atteinte: undefined, points: exacts };
  if (atteint.collection.suite === suite)
    return {
      atteinte: atteint.collection.marque && { marque: atteint.collection.marque, valeur: atteint.point.valeur ?? undefined, noeuds: atteint.point.noeuds },
      points: exacts,
    };
  let noeuds: readonly unknown[] = atteint.point.noeuds;
  for (const pas of pasDeLaSuite(suite.slice(atteint.collection.suite.length))) {
    const marque = noeuds.map(collectionDe).find((m) => m !== undefined);
    if ('cle' in pas && marque?.forme !== 'liste') return { atteinte: undefined, points: exacts };
    noeuds = ouverts(pasDeDonnee(noeuds, 'champ' in pas ? pas.champ : 0));
  }
  const marque = noeuds.map(collectionDe).find((m) => m !== undefined);
  return { atteinte: marque && { marque, valeur: undefined, noeuds }, points: exacts };
}

/**
 * LECTURE de la collection à clé de `racine` au bout de `suite` : celle du premier point quand plusieurs
 * points de la donnée ont cette suite — la co-descente ne valide pas, et la pose transactionnelle navigue
 * un arbre invalide (deux éléments de même clé). `undefined` si la suite ne mène à aucune collection
 * marquée.
 */
export function atteindre(schema: unknown, racine: unknown, suite: string): CollectionALaCle | undefined {
  return parcourirLaSuite(schema, racine, suite).atteinte;
}

/** `atteindre` des GARDES : LÈVE aussi quand plusieurs points de la donnée ont la suite, ou quand elle
 *  ne mène à aucune collection à clé du schéma. */
export function collectionALaCle(schema: unknown, racine: unknown, suite: string): CollectionALaCle {
  const { atteinte, points } = parcourirLaSuite(schema, racine, suite);
  if (points > 1) throw new Error(`collectionALaCle : ${suiteDite(suite)} désigne ${points} points de la donnée.`);
  if (!atteinte) throw new Error(`collectionALaCle : ${suiteDite(suite)} ne mène à aucune collection à clé du schéma.`);
  return atteinte;
}

/** Le document d'un FICHIER, tel qu'un lecteur d'espace le reçoit : son schéma et sa racine (le JSON
 *  disque en phase 2 de `npm run gen`, la racine vivante au régime vivant) ; `undefined` : aucun. */
export type AccesAuxDocuments = (fichier: string) => { readonly schema: unknown; readonly racine: unknown } | undefined;

/** Lecture d'un espace : ses ids, dans l'ordre de la donnée, ou l'espace UNIVERS qui en tient lieu. */
export type LectureDEspace = { readonly ids: readonly string[] } | { readonly univers: string };

/** Le filtre est-il un paramètre `espace` déclaré par la marque ? */
const filtreDeclare = (espace: EspaceDeNoms, filtre: FiltreDEspace): boolean =>
  filtre.vaut === undefined ? (espace.marqueurs ?? []).includes(filtre.champ) : espace.discriminant === filtre.champ;

/**
 * Lecture de l'espace `cle` (`grammaire/cle-d-espace.ts`) sur les documents d'`acces` : la collection
 * atteinte par sa suite nichée, qui doit être marquée `espace`, son filtre, qui doit être un paramètre
 * de la marque ; l'espace des `specs` d'une entrée à `specsSource` est l'UNIVERS de sa source
 * (`grammaire/sourcesDeSpecs.ts`). `undefined` : l'espace n'existe pas.
 */
export function lectureDeLEspace(cle: string, acces: AccesAuxDocuments): LectureDEspace | undefined {
  const lue = lireCleDEspace(cle);
  const doc = acces(lue.fichier);
  if (!doc) return undefined;
  const pas = pasDeLaSuite(lue.niche ?? '');
  const [element] = pas.slice(-2);
  const prefixe = pas.slice(0, -2).reduce(suiteAvecPas, '');
  if (pas.length >= 2 && 'cle' in element && baseDe(lue) === cleDesSpecs(cleNichee(lue.fichier, prefixe), element.cle)) {
    const liste = atteindre(doc.schema, doc.racine, prefixe);
    const marque = liste?.marque;
    const el = marque?.forme === 'liste' && Array.isArray(liste?.valeur) ? liste.valeur.find((e) => marque.de(e) === element.cle) : undefined;
    const source = estObjet(el) ? el.specsSource : undefined;
    if (typeof source === 'string') {
      const declaration: SourceDeSpecs | undefined = (SOURCES_DE_SPECS as Record<string, SourceDeSpecs>)[source];
      if (!declaration) throw new Error(`${cle} : specsSource « ${source} » inconnue de SOURCES_DE_SPECS.`);
      if (estObjet(el) && el.specs !== undefined) throw new Error(`${cle} : \`specs\` ET \`specsSource\` — l'espace de ses spécialisations serait double.`);
      if (lue.filtre) throw new Error(`${cle} : un filtre ne se pose pas sur l'univers d'une specsSource.`);
      return { univers: declaration.univers };
    }
  }
  const collection = atteindre(doc.schema, doc.racine, lue.niche ?? '');
  const espace = collection?.marque.espace;
  if (!collection || !espace || (lue.filtre && !filtreDeclare(espace, lue.filtre))) return undefined;
  return { ids: idsDeCollection(collection.marque, collection.valeur, lue.filtre) };
}

/** Les ids de l'espace `cle` par `lire` (`lectureDeLEspace`, ou sa lecture mémorisée), l'univers d'une
 *  `specsSource` suivi. SEUL suivi de l'univers : phase 2 de `npm run gen` (JSON disque) et régime vivant
 *  (`src/data/overrides.ts`, racines vivantes). */
export function idsDeLEspace<Ids>(cle: string, lire: (cle: string) => { readonly ids: Ids } | { readonly univers: string } | undefined): Ids | undefined {
  const lecture = lire(cle);
  return lecture && ('ids' in lecture ? lecture.ids : idsDeLEspace(lecture.univers, lire));
}
