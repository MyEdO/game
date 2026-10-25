import type { z } from 'zod';
import { tableTotale } from '../../../../lib/tableTotale';
import { defDe, enfantsDe } from '../descente';

/**
 * PRODUIT DE FABRIQUE (#3012) — un nœud objet construit par une fonction de la grammaire, d'un
 * littéral (`ref`, `refOuSpec`, `pick`, `descRefSchemaDe`, `noeudTest`, `construire`…) ou par
 * DÉRIVATION d'un schéma reçu (`proseNommee`, `proseAdressable`, `variantOf`, la partielle de
 * `document`) : chaque appel en rend une instance NEUVE, qu'aucun export n'atteint par identité. La
 * marque dit quelle fabrique l'a construit, dans quel RÔLE, et les clés que l'APPELANT y a apportées
 * (`extra`), chacune avec son `empreinte` : la CLASSE d'un produit, que la mesure des structures
 * locales juge partagée ou non.
 *
 * L'écrivain `marquerProduit` vit sous `interne/` : seule la grammaire marque (mur `murs/interne`), un
 * def ne peut pas faire passer son nœud pour un produit. La garde de forme
 * (`produits-de-fabrique.test.ts`) exige que toute construction d'objet d'une fonction de la grammaire
 * soit le nœud marqué.
 *
 * Un CLONE qui garde les mêmes enfants (`.superRefine`, `.refine`, `.meta`) est le même produit : la
 * lecture le reconnaît à ses enfants, sans marque à reposer. Un clone qui change ses enfants
 * (`.extend`, `.partial`) est une autre forme et n'hérite de rien.
 *
 * Rétention : l'index des clones tient les enfants d'un produit tant que son premier enfant vit ; un
 * premier enfant constant de module (`charKeySchema`…) le tient pour la vie du module. Borné tant que
 * les fabriques s'appellent au chargement (`mecaniqueDe` mémoïsé), pas sous un appel en boucle.
 */
export interface ProduitDeFabrique {
  readonly fabrique: string;
  readonly role: string;
  /** Les clés apportées par l'appelant, triées, avec l'`empreinte` de chacune, calculées à la première lecture. */
  readonly clesDExtra: Readonly<Record<string, string>>;
}

const PRODUITS = new WeakMap<object, ProduitDeFabrique>();

type Enfants = ReadonlyArray<readonly [string, unknown]>;
type EnfantsDeProduit = { readonly enfants: Enfants; readonly produit: ProduitDeFabrique };

/** Les produits marqués, indexés par l'instance de leur PREMIER enfant (lecture d'un clone). */
const PAR_PREMIER_ENFANT = new WeakMap<object, EnfantsDeProduit[]>();

const enfantsNommes = (noeud: unknown): Enfants => enfantsDe(noeud).map((e) => [e.cle ?? e.segment, e.noeud] as const);

/**
 * EMPREINTE d'un nœud : son type zod, les valeurs d'un littéral ou d'une énumération, et l'empreinte
 * de chaque enfant (clés d'objet triées, autres enfants dans l'ordre de descente). Un produit s'y lit
 * par sa classe, sans descendre dans ses enfants ; la récursion se replie au `z.lazy` et au cycle.
 */
export function empreinte(noeud: unknown, chemin: ReadonlySet<object> = new Set()): string {
  const def = defDe(noeud);
  if (!def) return '';
  if (def.type === 'lazy') return 'lazy';
  const produit = produitDe(noeud);
  if (produit) return `produit(${produit.fabrique}:${produit.role})`;
  if (chemin.has(noeud as object)) return 'cycle';
  const dedans = new Set(chemin).add(noeud as object);
  const valeurs = def.type === 'literal' ? [...(def.values as Iterable<unknown>)] : def.type === 'enum' ? Object.values(def.entries ?? {}) : undefined;
  const enfants = enfantsDe(noeud);
  const cles = enfants.filter((e) => e.cle !== undefined).sort((a, b) => ((a.cle ?? '') < (b.cle ?? '') ? -1 : (a.cle ?? '') > (b.cle ?? '') ? 1 : 0));
  const lus = [...cles, ...enfants.filter((e) => e.cle === undefined)].map((e) => `${e.cle ?? e.segment}:${empreinte(e.noeud, dedans)}`);
  return `${def.type}${valeurs ? JSON.stringify(valeurs.map(String).sort()) : ''}${lus.length ? `<${lus.join(',')}>` : ''}`;
}

/** Marque `noeud`, rendu par la fabrique `fabrique` dans le rôle `role`, et le rend. */
export function marquerProduit<N extends z.ZodType>(noeud: N, fabrique: string, role: string, extra?: Readonly<Record<string, unknown>>): N {
  const apportees = extra ?? {};
  let lues: Readonly<Record<string, string>> | undefined;
  const produit: ProduitDeFabrique = {
    fabrique,
    role,
    get clesDExtra() {
      return (lues ??= tableTotale(Object.keys(apportees).sort(), (cle) => empreinte(apportees[cle])));
    },
  };
  PRODUITS.set(noeud, produit);
  const enfants = enfantsNommes(noeud);
  const premier = enfants[0]?.[1];
  if (premier !== null && typeof premier === 'object') {
    const deja = PAR_PREMIER_ENFANT.get(premier) ?? [];
    PAR_PREMIER_ENFANT.set(premier, [...deja, { enfants, produit }]);
  }
  return noeud;
}

/**
 * La marque de `noeud`, ou de l'instance dont il est le clone à enfants identiques ; `undefined` hors
 * produit. Un `z.lazy` n'est jamais lu par ses enfants : sa cible se résout au premier parse, pas au
 * chargement du module.
 */
export function produitDe(noeud: unknown): ProduitDeFabrique | undefined {
  if (noeud === null || typeof noeud !== 'object') return undefined;
  const direct = PRODUITS.get(noeud);
  if (direct) return direct;
  if (defDe(noeud)?.type === 'lazy') return undefined;
  const enfants = enfantsNommes(noeud);
  const premier = enfants[0]?.[1];
  if (premier === null || typeof premier !== 'object') return undefined;
  return PAR_PREMIER_ENFANT.get(premier)?.find(
    (c) => c.enfants.length === enfants.length && c.enfants.every(([cle, enfant], i) => enfants[i]?.[0] === cle && enfants[i]?.[1] === enfant),
  )?.produit;
}
