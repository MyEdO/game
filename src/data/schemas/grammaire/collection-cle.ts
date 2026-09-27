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
 * `collectionALaCle` atteint celle d'une suite. La descente du schéma seul (`descendre`) la retrouve.
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
import { cleNichee, estPrefixeDeSuite, pasDeLaSuite, suiteAvecPas } from './cle-d-espace';
import { estFeuilleDId } from './ref';

/** Clé d'un élément : un CHAMP de l'élément, ou une clé COMPOSÉE nommée (`walls` : `x,y,side,z`). */
export type CleDElement<T> =
  | Extract<keyof T, string>
  | { readonly nom: string; readonly de: (element: T) => string | undefined };

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
  const lecture =
    typeof cle === 'string'
      ? { nom: cle, de: (el: unknown) => (estObjet(el) ? texteDeCle(el[cle]) : undefined) }
      : { nom: cle.nom, de: (el: unknown) => (estObjet(el) ? cle.de(el as T) : undefined) };
  return espace ? { forme: 'liste', ...lecture, espace } : { forme: 'liste', ...lecture };
}

/** Marque d'un RECORD dont les noms de propriété sont les ids — la carte au champ `sous`, s'il est donné. */
export function marqueDeRecord(options: { readonly sous?: string; readonly espace?: EspaceDeNoms } = {}): MarqueDeCollection {
  return { forme: 'record', ...options };
}

/** Les ids d'une collection marquée, dans l'ordre de la donnée (un élément sans clé lisible n'en porte pas). */
export function idsDeCollection(marque: MarqueDeCollection, valeur: unknown): string[] {
  if (marque.forme === 'liste') return Array.isArray(valeur) ? valeur.map(marque.de).filter((c): c is string => c !== undefined) : [];
  const carte = marque.sous === undefined ? valeur : estObjet(valeur) ? valeur[marque.sous] : undefined;
  return estObjet(carte) ? Object.keys(carte) : [];
}

/** Les nœuds de schéma qui portent la CLÉ d'un élément de la collection marquée. */
function noeudsDeCle(noeud: unknown, marque: MarqueDeCollection): unknown[] {
  if (marque.forme === 'liste') return ouverts(pasDeDonnee(ouverts(pasDeDonnee(ouverts([noeud]), 0)), marque.nom));
  const cartes = marque.sous === undefined ? ouverts([noeud]) : ouverts(pasDeDonnee(ouverts([noeud]), marque.sous));
  return cartes.flatMap((n) => enfantsDe(n).filter((e) => e.segment === '{clé}').map((e) => e.noeud));
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
 *  `suiteAvecPas`), son chemin de donnée, sa marque, sa valeur, ses ids, et les rangs de ses éléments
 *  ANONYMES (liste marquée dont la marque ne lit aucune clé : sous-arbre élagué). */
export interface CollectionDuDocument {
  readonly suite: string;
  readonly chemin: readonly (string | number)[];
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
      out.push({ collection: { suite, chemin: p.chemin, marque, valeur: p.valeur, ids: idsDeCollection(marque, p.valeur) }, anonymes });
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

/** Une collection à clé atteinte par sa suite : sa marque et sa valeur (`undefined` : absente de la donnée). */
export interface CollectionALaCle {
  readonly marque: MarqueDeCollection;
  readonly valeur: unknown;
}

/**
 * La collection à clé de `racine` au bout de `suite` (`''` : la racine ; `[art].specs`, `rangedMod`) :
 * la co-descente des collections, élaguée hors du chemin de `suite`. Une collection absente de la donnée
 * (`null` ou `undefined`) rend `valeur: undefined`, le reste de sa suite se lisant alors sur le schéma
 * seul. LÈVE si la suite ne mène à aucune collection marquée, si elle porte un pas `[]` (un point par
 * élément sous une liste non marquée, graphie étrangère à une liste marquée), ou si plusieurs points
 * de la donnée ont cette suite.
 */
export function collectionALaCle(schema: unknown, racine: unknown, suite: string): CollectionALaCle {
  const leve = (raison: string): never => {
    throw new Error(`collectionALaCle : « ${suite || '(racine)'} » ${raison}.`);
  };
  if (pasDeLaSuite(suite).some((pas) => 'rang' in pas)) leve('porte un pas « [] », qui ne désigne pas UN point');
  let atteint: { point: PointDeDonnee; collection: PointDeCollection } | undefined;
  let exacts = 0;
  coDescendreLesCollections(schema, racine, (point, collection) => {
    if (!estPrefixeDeSuite(collection.suite, suite)) return 'elaguer';
    if (!atteint || collection.suite.length > atteint.collection.suite.length) atteint = { point, collection };
    if (collection.suite !== suite) return undefined;
    exacts++;
    return 'elaguer';
  });
  const aucune = (): never => leve('ne mène à aucune collection à clé du schéma');
  if (exacts > 1) leve(`désigne ${exacts} points de la donnée`);
  if (!atteint) return aucune();
  if (atteint.collection.suite === suite) return atteint.collection.marque ? { marque: atteint.collection.marque, valeur: atteint.point.valeur ?? undefined } : aucune();
  let noeuds: readonly unknown[] = atteint.point.noeuds;
  for (const pas of pasDeLaSuite(suite.slice(atteint.collection.suite.length))) {
    const marque = noeuds.map(collectionDe).find((m) => m !== undefined);
    if ('cle' in pas && marque?.forme !== 'liste') return aucune();
    noeuds = ouverts(pasDeDonnee(noeuds, 'champ' in pas ? pas.champ : 0));
  }
  const marque = noeuds.map(collectionDe).find((m) => m !== undefined);
  return marque ? { marque, valeur: undefined } : aucune();
}
