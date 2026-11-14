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
 *
 * Une liste à clé SANS `espace` est le catalogue d'une PORTÉE LOCALE (#2968 P-local) quand l'objet qui la
 * porte l'ouvre (`ouvrirPortees`) : les références `ref(portee)` de son arbre y résolvent.
 */
import { z } from 'zod';
import '../../../lib/zodEnFrancais';
import { estObjet } from '../../../lib/objet.mjs';
import { coDescendre, defDe, descendre, enfantsDe, ouverts, pasDeDonnee, type DecisionDeVisite, type PointDeDonnee } from './descente';
import {
  baseDe,
  champsDiscriminants,
  cleDesLibelles,
  cleDesSpecs,
  cleDuVocabulaire,
  cleNichee,
  estPrefixeDeSuite,
  idsDeCollection,
  libellesDeCollection,
  lireCleDEspace,
  pasDeLaSuite,
  retenuParFiltre,
  suiteAvecPas,
  type CleLue,
  type FiltreDEspace,
} from './cle-d-espace';
import { declarationDeFeuilleDId, estFeuilleDId, estUneFaute, jugerRefLocale, porteeDuJugementLocal, refusDeLaRefLocale, type PorteeLocale } from './ref';
import { LIBELLE_AU_LABEL, SOURCES_DE_SPECS, type SourceDeSpecs } from './sourcesDeSpecs';

/** Clé d'un élément : un CHAMP de l'élément, une clé COMPOSÉE nommée (`walls` : `x,y,side,z`), ou
 *  l'élément SCALAIRE lui-même (`scalaire` : `couvre`, liste de chaînes). */
export type CleDElement<T> =
  | Extract<keyof T, string>
  | { readonly nom: string; readonly de: (element: T) => string | undefined }
  | { readonly nom: string; readonly scalaire: true };

/**
 * Paramètres d'un ESPACE DE NOMS — une collection marquée `espace` en ouvre un, et chaque paramètre
 * y ajoute des espaces FILTRÉS (`grammaire/cle-d-espace.ts`) : `discriminant`, un espace par valeur du
 * champ (`materials.json?domain=prop`), ou de CHACUN des champs d'une liste (`weaponGroups.json?combat=melee`,
 * `weaponGroups.json?kind=armour`) ; `marqueurs`, un espace par champ, les éléments qui le PORTENT
 * (`props.json?volume`). La phase 2 de `npm run gen` (`scripts/gen-espaces.mts`) les lit au nœud.
 */
export interface EspaceDeNoms {
  readonly discriminant?: string | readonly string[];
  /** Second rôle du `discriminant` : les clés de CHARGE admises par valeur du champ, ce que l'atelier
   *  présente d'une entrée (`chargeDiscriminee`, `schemas/validate.ts`) et ce que `document()` borne au
   *  parse (`refusDeCharge`). Le champ qui partitionne la charge est le `discriminant` unique, ou, d'une
   *  LISTE de discriminants, celui que nomme `champDeCharge`. */
  readonly chargeParDiscriminant?: Readonly<Record<string, readonly string[]>>;
  readonly champDeCharge?: string;
  /** Clés de la charge EXIGÉES par valeur du champ de charge, sous-ensemble de sa charge ; une valeur
   *  absente de cette table exige toute sa charge. */
  readonly requisesParDiscriminant?: Readonly<Record<string, readonly string[]>>;
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

/** Le champ discriminant qui partitionne la CHARGE d'un espace : son `discriminant` unique, ou le
 *  `champDeCharge` qu'il nomme parmi sa liste ; `undefined` sinon. */
export function champDeCharge(espace: EspaceDeNoms): string | undefined {
  const { discriminant, champDeCharge: nomme } = espace;
  if (typeof discriminant === 'string') return nomme === undefined || nomme === discriminant ? discriminant : undefined;
  return nomme !== undefined && discriminant?.includes(nomme) ? nomme : undefined;
}

/**
 * Refus de CHARGE d'une entrée d'un document dont l'`espace` déclare `chargeParDiscriminant` : une clé
 * de charge d'un AUTRE cas que celui de l'entrée, une clé EXIGÉE de son cas absente
 * (`requisesParDiscriminant`, toute la charge du cas par défaut). `undefined` sans charge déclarée.
 * FAIL-FAST à la CONSTRUCTION : une clé de charge ou d'exigence hors des champs de l'entrée, une
 * exigence hors de la charge de son cas.
 */
export function refusDeCharge(
  type: string,
  espace: EspaceDeNoms,
  clesEntree: readonly string[],
): ((entree: Record<string, unknown>, ctx: z.RefinementCtx) => void) | undefined {
  const table = espace.chargeParDiscriminant;
  const champ = champDeCharge(espace);
  if (!table || champ === undefined) return undefined;
  const toutes = [...new Set(Object.values(table).flat())];
  for (const cle of toutes)
    if (!clesEntree.includes(cle)) throw new Error(`refusDeCharge('${type}') : la clé de charge « ${cle} » n’est aucun champ de l’entrée.`);
  const requises = espace.requisesParDiscriminant ?? {};
  for (const [cas, cles] of Object.entries(requises)) {
    const charge = table[cas];
    if (!charge) throw new Error(`refusDeCharge('${type}') : \`requisesParDiscriminant\` nomme le cas « ${cas} », absent de \`chargeParDiscriminant\`.`);
    for (const cle of cles)
      if (!charge.includes(cle)) throw new Error(`refusDeCharge('${type}') : « ${cle} » est exigée du cas « ${cas} » sans appartenir à sa charge.`);
  }
  const porteurs = (cle: string) => Object.keys(table).filter((cas) => table[cas].includes(cle)).join(', ');
  return (entree, ctx) => {
    const cas = entree[champ];
    const charge = typeof cas === 'string' ? table[cas] : undefined;
    if (!charge) return;
    const nom = `« ${String(entree.id)} » (${champ} « ${cas} »)`;
    for (const cle of requises[cas as string] ?? charge)
      if (entree[cle] === undefined) ctx.addIssue({ code: 'custom', path: [cle], message: `${type} : ${nom} exige « ${cle} ».` });
    for (const cle of toutes)
      if (!charge.includes(cle) && entree[cle] !== undefined)
        ctx.addIssue({ code: 'custom', path: [cle], message: `${type} : « ${cle} » n’appartient qu’au(x) cas ${champ} « ${porteurs(cle)} » — refusée sur ${nom}.` });
  };
}

/**
 * Marque la collection `noeud` et rend le nœud FINAL qui porte la marque. Une liste y gagne l'UNICITÉ
 * de sa clé (un élément sans clé lisible n'entre pas dans le compte : sa forme est refusée ailleurs,
 * par le schéma de l'élément). FAIL-FAST à la CONSTRUCTION : `espace` sur une collection dont la clé
 * d'élément est une feuille `idDe` — une liste de RÉFÉRENCES n'est jamais un espace de noms.
 */
export function marquerCollection<N extends z.ZodType>(noeud: N, marque: MarqueDeCollection): N {
  if (marque.espace?.chargeParDiscriminant && champDeCharge(marque.espace) === undefined)
    throw new Error('marquerCollection : `chargeParDiscriminant` sans `discriminant` unique ni `champDeCharge` parmi ses discriminants — la charge se partitionne par les valeurs d’UN champ discriminant.');
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

/** D'où un ouvreur (`ouvrirPortees`) tire les ids de ses portées : de la collection `portee.collection` de ses champs,
 *  ou d'aucune, la portée déclarée VIDE (un objet hors de tout porteur de la collection). */
export type SourceDesPortees = 'collections' | 'vide';

/** Un jugement de la co-descente d'un ouvreur (`ouvrirPortees`), au chemin de DONNÉE `chemin` depuis sa valeur : une référence
 *  `id` de la portée `portee` (`parCle` : la clé d'un record), admise sans `refus` ; ou la faute `message` d'un contrôle
 *  sous portée (`controlerSousPortee`). */
type JugementSousPortee =
  | { readonly chemin: readonly (string | number)[]; readonly portee: PorteeLocale; readonly id: string; readonly parCle: boolean; readonly refus: string | undefined }
  | { readonly chemin: readonly (string | number)[]; readonly message: string };

/** Un objet construit par `ouvrirPortees` : la marque de la collection de chaque portée qu'il ouvre (`'vide'` pour une portée
 *  déclarée vide), et sa co-descente, qui rend les jugements de sa valeur ; `acceptee` y rend l'entrée de la collection que
 *  son propre nœud accepte, `undefined` sinon. */
interface Ouvreur {
  readonly marques: ReadonlyMap<PorteeLocale, MarqueDeCollection | 'vide'>;
  readonly juger: (valeur: unknown, acceptee: (entree: unknown) => unknown) => readonly JugementSousPortee[];
}

const OUVREURS = new WeakMap<object, Ouvreur>();

/** Les portées locales qu'ouvre un objet construit par `ouvrirPortees`, aucune pour tout autre nœud. */
export const porteesOuvertes = (noeud: unknown): readonly PorteeLocale[] => (estObjet(noeud) ? [...(OUVREURS.get(noeud)?.marques.keys() ?? [])] : []);

/** L'objet qui ouvre la portée `portee` (`ouvrirPortees`) parmi les nœuds de `schema` que sa valeur `valeur` ouvre (`ouverts`). */
const ouvreurDeLaPortee = (schema: unknown, valeur: unknown, portee: PorteeLocale): Ouvreur | undefined =>
  ouverts([schema], valeur).map((n) => (estObjet(n) ? OUVREURS.get(n) : undefined)).find((o) => o?.marques.has(portee));

/** Les entrées qu'admet la portée `portee` sous le schéma `schema`, de valeur `valeur`, par id : celles de sa collection,
 *  sous l'objet qui l'ouvre (`ouvreurDeLaPortee`), que chacun de ses filtres retient (`entreesSousLaMarque`) ; aucune pour
 *  une portée déclarée vide ; `undefined` si aucun ne l'ouvre, ou si sa collection n'est pas une liste. SEULE lecture des
 *  entrées d'une portée, celle du parse. */
export function entreesDeLaPortee(schema: unknown, valeur: unknown, portee: PorteeLocale): ReadonlyMap<string, unknown> | undefined {
  return entreesSousLaMarque(ouvreurDeLaPortee(schema, valeur, portee)?.marques.get(portee), valeur, portee);
}

/** Les ids des entrées qu'admet la portée `portee` sous le schéma `schema`, de valeur `valeur` (`entreesDeLaPortee`). */
export function idsDeLaPortee(schema: unknown, valeur: unknown, portee: PorteeLocale): readonly string[] | undefined {
  const entrees = entreesDeLaPortee(schema, valeur, portee);
  return entrees && [...entrees.keys()];
}

/** Les sites de la portée `portee` sous le schéma `schema`, de valeur `valeur`, telle quelle, fautive ou non : les
 *  références que l'objet qui l'ouvre (`ouvreurDeLaPortee`) ADMET, par la co-descente même de son jugement au parse ;
 *  aucun sous un ouvreur intérieur de la même portée. Chacun : la valeur, ou la clé de record (`parCle`, dernier segment
 *  de `chemin`), `id` d'une entrée de sa collection, au chemin de DONNÉE `chemin` depuis `valeur`. Aucun si rien ne
 *  l'ouvre. SEULE lecture des sites d'une portée. */
export function sitesDeLaPortee(
  schema: unknown,
  valeur: unknown,
  portee: PorteeLocale,
): readonly { readonly chemin: readonly (string | number)[]; readonly id: string; readonly parCle: boolean }[] {
  return (ouvreurDeLaPortee(schema, valeur, portee)?.juger(valeur, (e) => e) ?? []).flatMap((j) =>
    'portee' in j && j.portee === portee && j.refus === undefined ? [{ chemin: j.chemin, id: j.id, parCle: j.parCle }] : []);
}

/** La valeur au chemin `chemin` de `valeur`, `undefined` dès qu'un segment n'est le champ d'aucun objet. */
const valeurAuChemin = (valeur: unknown, chemin: readonly string[]): unknown => chemin.reduce<unknown>((v, cle) => (estObjet(v) ? v[cle] : undefined), valeur);

/** Les entrées de la collection de la portée `portee`, de marque `marque`, par id, dans la valeur `valeur` de l'objet qui
 *  l'ouvre : celles que chacun de ses filtres retient (`retenuParFiltre`) ; aucune pour une portée déclarée vide. La
 *  collection se lit au chemin pointé `portee.collection` de `valeur` (`narratif.objets`). */
function entreesSousLaMarque(marque: MarqueDeCollection | 'vide' | undefined, valeur: unknown, portee: PorteeLocale): ReadonlyMap<string, unknown> | undefined {
  if (marque === 'vide') return new Map();
  const collection = valeurAuChemin(valeur, portee.collection.split('.'));
  if (!marque || !Array.isArray(collection)) return undefined;
  const retenues = collection.filter((e) => (portee.retient ?? []).every((f) => estObjet(e) && retenuParFiltre(f, e)));
  return new Map(retenues.flatMap((e) => {
    const [id] = idsDeCollection(marque, [e]);
    return id === undefined ? [] : [[id, e] as const];
  }));
}

/** Le nœud du champ au chemin pointé `chemin` (`narratif.objets`) des champs de `objet` : chaque segment, un champ d'un
 *  objet que le nœud du segment précédent ouvre (`ouverts`). `undefined` si un segment n'est le champ d'aucun. */
function champAuChemin(objet: z.ZodObject<z.ZodRawShape>, chemin: string): unknown {
  return chemin.split('.').reduce<unknown>(
    (noeud, cle) => (noeud === undefined ? undefined : ouverts([noeud]).flatMap(enfantsDe).find((e) => e.segment === `.${cle}`)?.noeud),
    objet,
  );
}

/** Un CONTRÔLE SOUS PORTÉE : les fautes de la valeur `valeur` d'un nœud qui dépendent des entrées de la collection d'une
 *  portée, que `entree` résout par id (`undefined` pour un id hors de la collection, ou dont l'entrée est refusée par son
 *  propre nœud), chacune à son path relatif. */
export type ControleSousPortee = (valeur: unknown, entree: (id: string) => unknown) => readonly { readonly path: readonly (string | number)[]; readonly message: string }[];

/** Les nœuds construits par `controlerSousPortee`, avec leur portée et leur contrôle. */
const CONTROLES_SOUS_PORTEE = new WeakMap<object, { readonly portee: PorteeLocale; readonly controle: ControleSousPortee }>();

/** Déclare sur `noeud` le contrôle `controle` de sa valeur sous la portée `portee` : l'objet qui l'ouvre (`ouvrirPortees`)
 *  l'exécute à chaque valeur du nœud, avec les entrées de sa collection ; hors de tout ouvreur, il ne s'exécute pas. Le
 *  nœud doit porter une référence de la portée (`porteeDuJugementLocal`), sans quoi la co-descente l'élague. */
export function controlerSousPortee<N extends z.ZodType>(noeud: N, portee: PorteeLocale, controle: ControleSousPortee): N {
  CONTROLES_SOUS_PORTEE.set(noeud, { portee, controle });
  return noeud;
}

/**
 * Ouvre les PORTÉES LOCALES `portees` sur `objet` : chaque référence `ref(portee)` de son arbre est jugée
 * (`jugerRefLocale`) contre les ids de la collection `portee.collection` de la MÊME valeur. FAIL-FAST à la
 * CONSTRUCTION : collection absente des champs ou qui n'est pas une liste à clé, collection marquée `espace`
 * (un id local n'entre dans aucun espace de l'INDEX DES IDS), portée qu'aucune référence de l'arbre ne désigne.
 * Le jugement court même quand une issue de l'arbre avorte les raffinements de l'objet (`when`) : au parse de
 * mesure, le repère d'une feuille `idDe` de l'arbre en est une (`mesureDuParse`), et une référence locale non
 * jugée ne serait pas comptée. Une collection qui n'est pas une liste, refusée par son propre nœud, ne juge
 * aucune référence de sa portée. La co-descente élague, par portée, toute valeur dont aucun nœud ne mène à une
 * référence de cette portée (ses PORTEURS, relevés à la construction), et toute valeur dont un nœud est un ouvreur
 * intérieur de la même portée : ce qu'il porte, lui seul le juge. UNE co-descente rend les jugements du parse et les
 * sites de la portée (`sitesDeLaPortee`). Sous la source `'vide'`, chaque portée est déclarée
 * VIDE, sans collection : toute référence de l'arbre à l'une d'elles est absente de son catalogue, et une feuille
 * `idDe(…, { portee })` y vaut son catalogue seul (`refusDeLaRefLocale`).
 */
export function ouvrirPortees<N extends z.ZodObject<z.ZodRawShape>>(objet: N, portees: readonly PorteeLocale[], source: SourceDesPortees = 'collections'): N {
  const marques = new Map<PorteeLocale, MarqueDeCollection | 'vide'>(
    portees.map((portee) => {
      if (source === 'vide') return [portee, 'vide'] as const;
      const champ = champAuChemin(objet, portee.collection);
      const marque = champ === undefined ? undefined : ouverts([champ]).map(collectionDe).find((m) => m !== undefined);
      if (marque?.forme !== 'liste')
        throw new Error(`ouvrirPortees : « ${portee.collection} » n’est aucune liste à clé (\`listeCle\`) des champs de l’objet — la portée des ${portee.catalogue} n’a pas de collection.`);
      if (marque.espace)
        throw new Error(`ouvrirPortees : la collection « ${portee.collection} » ouvre un espace de l’INDEX DES IDS — un id local n’entre dans aucun catalogue global.`);
      return [portee, marque] as const;
    }),
  );
  const designees = new Set<PorteeLocale>();
  const porteurs = new Map<PorteeLocale, Set<unknown>>(portees.map((portee) => [portee, new Set()]));
  const parents = new Map<unknown, unknown[]>();
  descendre([objet], ({ noeud }) => {
    const portee = porteeDuJugementLocal(noeud);
    const siens = portee === undefined ? undefined : porteurs.get(portee);
    if (portee !== undefined && siens) {
      designees.add(portee);
      siens.add(noeud);
    }
    for (const { noeud: enfant } of enfantsDe(noeud)) parents.set(enfant, [...(parents.get(enfant) ?? []), noeud]);
  });
  for (const siens of porteurs.values()) for (const porteur of siens) for (const parent of parents.get(porteur) ?? []) siens.add(parent);
  for (const portee of portees)
    if (!designees.has(portee)) throw new Error(`ouvrirPortees : la portée des ${portee.catalogue} (« ${portee.collection} ») n’a aucune référence \`ref\` dans l’arbre de l’objet.`);
  const refus = (noeud: unknown, portee: PorteeLocale, id: string, admises: ReadonlyMap<string, unknown>): string | undefined =>
    admises.has(id) ? undefined : refusDeLaRefLocale(noeud, portee, id, marques.get(portee) === 'vide');
  const juger = (valeur: unknown, acceptee: (entree: unknown) => unknown): readonly JugementSousPortee[] => {
    if (!estObjet(valeur)) return [];
    const entrees = new Map(portees.flatMap((portee) => {
      const admises = entreesSousLaMarque(marques.get(portee), valeur, portee);
      return admises ? [[portee, admises] as const] : [];
    }));
    const jugements: JugementSousPortee[] = [];
    // Les portées que chaque point juge encore : celles de son parent, hors des ouvreurs intérieurs qui les rouvrent.
    const actives = new Map<PointDeDonnee, readonly PorteeLocale[]>();
    coDescendre(objet, valeur, (point) => {
      const { noeuds, valeur: id, chemin, parent } = point;
      const rouvertes = parent ? noeuds.flatMap(porteesOuvertes) : [];
      const ici = (parent ? actives.get(parent)! : [...entrees.keys()]).filter(
        (portee) => !rouvertes.includes(portee) && noeuds.some((noeud) => porteurs.get(portee)!.has(noeud)),
      );
      if (!ici.length) return 'elaguer';
      actives.set(point, ici);
      for (const noeud of noeuds) {
        const sous = estObjet(noeud) ? CONTROLES_SOUS_PORTEE.get(noeud) : undefined;
        const admises = sous && ici.includes(sous.portee) ? entrees.get(sous.portee) : undefined;
        if (sous && admises)
          for (const f of sous.controle(id, (cle) => acceptee(admises.get(cle)))) jugements.push({ chemin: [...chemin, ...f.path], message: f.message });
        const cles = defDe(noeud)?.type === 'record' ? enfantsDe(noeud).find((e) => e.segment === '{clé}')?.noeud : undefined;
        if (cles !== undefined && estObjet(id))
          for (const cle of Object.keys(id)) {
            const portee = porteeDuJugementLocal(cles, cle);
            const admisesDeCle = portee && ici.includes(portee) ? entrees.get(portee) : undefined;
            if (portee && admisesDeCle) jugements.push({ chemin: [...chemin, cle], portee, id: cle, parCle: true, refus: refus(cles, portee, cle, admisesDeCle) });
          }
      }
      if (typeof id !== 'string') return;
      for (const noeud of noeuds) {
        const portee = porteeDuJugementLocal(noeud, id);
        const admises = portee !== undefined && ici.includes(portee) ? entrees.get(portee) : undefined;
        if (portee !== undefined && admises !== undefined) {
          jugements.push({ chemin, portee, id, parCle: false, refus: refus(noeud, portee, id, admises) });
          return;
        }
      }
    });
    return jugements;
  };
  const ouvreur = objet.superRefine((valeur, ctx) => {
    if (!estObjet(valeur)) return;
    // Les entrées que leur propre nœud refuse : une faute de l'arbre (jamais un repère) sous leur chemin.
    const refusees = new Set(ctx.issues.filter(estUneFaute).flatMap(({ path = [] }) =>
      portees.flatMap((portee) => {
        const chemin = portee.collection.split('.');
        const rang = path[chemin.length];
        const collection = chemin.every((cle, i) => path[i] === cle) ? valeurAuChemin(valeur, chemin) : undefined;
        return Array.isArray(collection) && typeof rang === 'number' ? [collection[rang]] : [];
      })));
    for (const j of juger(valeur, (e) => (refusees.has(e) ? undefined : e)))
      if ('message' in j) ctx.addIssue({ code: 'custom', path: [...j.chemin], message: j.message });
      else jugerRefLocale(ctx, j.chemin, j.portee, j.id, j.refus, j.parCle);
  }, { when: () => true });
  OUVREURS.set(ouvreur, { marques, juger });
  return ouvreur;
}

/** `schema` où les portées que désigne une feuille `idDe(…, { portee })` de son arbre, et qu'aucun ouvreur de cet arbre
 *  n'ouvre, sont ouvertes VIDES (`ouvrirPortees(…, 'vide')`) : un document qui les désigne sans en porter la collection
 *  (`document()`, `grammaire/document.ts`). FAIL-FAST à la CONSTRUCTION : un tel `schema` qui n'est pas un objet. */
export function ouvrirLesPorteesSansCollection(schema: z.ZodType, site: string): z.ZodType {
  const designees = new Set<PorteeLocale>();
  const ouvertes = new Set<PorteeLocale>();
  descendre([schema], ({ noeud }) => {
    const portee = declarationDeFeuilleDId(noeud)?.portee;
    if (portee !== undefined) designees.add(portee);
    for (const p of porteesOuvertes(noeud)) ouvertes.add(p);
  });
  const vides = [...designees].filter((p) => !ouvertes.has(p));
  if (!vides.length) return schema;
  if (!(schema instanceof z.ZodObject))
    throw new Error(`${site} : la portée des ${vides[0].catalogue} est désignée sans être ouverte, et l’entrée n’est pas un objet qui l’ouvre.`);
  return ouvrirPortees(schema, vides, 'vide');
}

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

/** Le pas `[cle]` résolu par la marque de la LISTE au bout de `prefixe` dans `racine` : l'élément dont la
 *  clé vaut `cle` (`undefined` si aucun), et `par`, le nom de la clé de la liste ; `undefined` quand
 *  `prefixe` ne mène à aucune liste marquée. */
export function elementDeLaListe(schema: unknown, racine: unknown, prefixe: string, cle: string): { readonly element: unknown; readonly par: string } | undefined {
  const liste = atteindre(schema, racine, prefixe);
  const marque = liste?.marque;
  if (marque?.forme !== 'liste' || !Array.isArray(liste?.valeur)) return undefined;
  return { element: liste.valeur.find((e) => marque.de(e) === cle), par: marque.nom };
}

/** Le document d'un FICHIER, tel qu'un lecteur d'espace le reçoit : son schéma et sa racine (le JSON
 *  disque en phase 2 de `npm run gen`, la racine vivante au régime vivant) ; `undefined` : aucun. */
export type AccesAuxDocuments = (fichier: string) => { readonly schema: unknown; readonly racine: unknown } | undefined;

/** Lecture d'un espace : ses ids, dans l'ordre de la donnée, ou l'espace UNIVERS qui en tient lieu. */
export type LectureDEspace = { readonly ids: readonly string[] } | { readonly univers: string };

/** Le filtre est-il un paramètre `espace` déclaré par la marque ? */
const filtreDeclare = (espace: EspaceDeNoms, filtre: FiltreDEspace): boolean =>
  filtre.horsMarqueurs
    ? filtre.horsMarqueurs.every((m) => (espace.marqueurs ?? []).includes(m))
    : filtre.vaut === undefined ? (espace.marqueurs ?? []).includes(filtre.champ) : champsDiscriminants(espace).includes(filtre.champ);

/** La SOURCE de spécialisations (`grammaire/sourcesDeSpecs.ts`) dont l'espace lu `lue` est l'espace des
 *  `specs` d'une entrée, `undefined` s'il ne l'est pas. */
function sourceDesSpecs(lue: CleLue, doc: { readonly schema: unknown; readonly racine: unknown }, cle: string): SourceDeSpecs | undefined {
  const pas = pasDeLaSuite(lue.niche ?? '');
  const [element] = pas.slice(-2);
  const prefixe = pas.slice(0, -2).reduce(suiteAvecPas, '');
  if (pas.length < 2 || !('cle' in element) || baseDe(lue) !== cleDesSpecs(cleNichee(lue.fichier, prefixe), element.cle)) return undefined;
  const el = elementDeLaListe(doc.schema, doc.racine, prefixe, element.cle)?.element;
  const source = estObjet(el) ? el.specsSource : undefined;
  if (typeof source !== 'string') return undefined;
  const declaration: SourceDeSpecs | undefined = (SOURCES_DE_SPECS as Record<string, SourceDeSpecs>)[source];
  if (!declaration) throw new Error(`${cle} : specsSource « ${source} » inconnue de SOURCES_DE_SPECS.`);
  if (estObjet(el) && el.specs !== undefined) throw new Error(`${cle} : \`specs\` ET \`specsSource\` — l'espace de ses spécialisations serait double.`);
  if (lue.filtre) throw new Error(`${cle} : un filtre ne se pose pas sur l'univers d'une specsSource.`);
  return declaration;
}

/** L'espace des LIBELLÉS (`cleDesLibelles`) de l'univers d'une source, tels que la source les déclare. */
export const cleDesLibellesDeLaSource = (source: SourceDeSpecs): string =>
  'vocabulaire' in source.libelle ? cleDesLibelles(cleDuVocabulaire(source.libelle.vocabulaire)) : cleDesLibelles(source.univers, source.libelle.champs);


/**
 * Lecture de l'espace `cle` (`grammaire/cle-d-espace.ts`) sur les documents d'`acces` : la collection
 * atteinte par sa suite nichée, qui doit être marquée `espace`, son filtre, qui doit être un paramètre
 * de la marque ; l'espace des `specs` d'une entrée à `specsSource` est l'UNIVERS de sa source
 * (`grammaire/sourcesDeSpecs.ts`). Une clé de LIBELLÉS lit les libellés de ces éléments : pour les `specs`
 * d'une entrée à `specsSource`, ceux que sa source déclare ; ailleurs, ceux des champs de la clé, ou du
 * `label`. `undefined` : l'espace n'existe pas.
 */
export function lectureDeLEspace(cle: string, acces: AccesAuxDocuments): LectureDEspace | undefined {
  const lue = lireCleDEspace(cle);
  const doc = acces(lue.fichier);
  if (!doc) return undefined;
  const source = sourceDesSpecs(lue, doc, cle);
  if (source) {
    if (lue.libelles?.length) throw new Error(`${cle} : les libellés des \`specs\` d'une entrée à specsSource sont ceux que sa source déclare.`);
    return { univers: lue.libelles ? cleDesLibellesDeLaSource(source) : source.univers };
  }
  const collection = atteindre(doc.schema, doc.racine, lue.niche ?? '');
  const espace = collection?.marque.espace;
  if (!collection || !espace || (lue.filtre && !filtreDeclare(espace, lue.filtre))) return undefined;
  if (!lue.libelles) return { ids: idsDeCollection(collection.marque, collection.valeur, lue.filtre) };
  const libelles = libellesDeCollection(collection.marque, collection.valeur, lue.libelles.length ? lue.libelles : LIBELLE_AU_LABEL.champs, lue.filtre);
  return libelles && { ids: libelles };
}

/** Les ids de l'espace `cle` par `lire` (`lectureDeLEspace`, ou sa lecture mémorisée), l'univers d'une
 *  `specsSource` suivi. SEUL suivi de l'univers : phase 2 de `npm run gen` (JSON disque) et régime vivant
 *  (`src/data/overrides.ts`, racines vivantes). */
export function idsDeLEspace<Ids>(cle: string, lire: (cle: string) => { readonly ids: Ids } | { readonly univers: string } | undefined): Ids | undefined {
  const lecture = lire(cle);
  return lecture && ('ids' in lecture ? lecture.ids : idsDeLEspace(lecture.univers, lire));
}
