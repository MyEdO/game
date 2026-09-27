/**
 * DESCENTE d'un schéma zod 4.4.3 composé — la seule lecture de la forme d'un nœud (`defDe`), de ses
 * enfants (`enfantsDe`, par les champs de `CHAMPS_D_ENFANTS`), du parcours de son arbre (`descendre`)
 * et de la CO-DESCENTE d'une donnée avec son schéma (`ouverts`, `pasDeDonnee`, `coDescendre`, #1463).
 *
 * Invariant (#1473 R1) : `enfantsDe` rend chaque enfant que le parse EXÉCUTE, et un `z.lazy` y descend
 * par l'instance que le parse exécute (`_zod.innerType`, `node_modules/zod/v4/core/schemas.js:2194-2206`).
 * Hors de ce module, un `_zod.def` ou un champ de `CHAMPS_D_ENFANTS` ne se lit pas à la main : garde
 * `scripts/guards/lib/lectureDefZod.mjs`.
 */

/** Forme d'un nœud zod 4.4.3 telle qu'elle se lit sur `_zod.def`. */
export type DefZod = {
  type: string;
  shape?: Record<string, unknown>;
  catchall?: unknown;
  element?: unknown;
  options?: unknown[];
  innerType?: unknown;
  in?: unknown;
  out?: unknown;
  left?: unknown;
  right?: unknown;
  values?: unknown;
  entries?: Record<string, unknown>;
  items?: unknown[];
  rest?: unknown;
  keyType?: unknown;
  valueType?: unknown;
  checks?: readonly unknown[];
  /** Champ discriminant d'une `z.discriminatedUnion`. */
  discriminator?: string;
};

type Noeud = { _zod?: { def?: DefZod; innerType?: unknown }; def?: DefZod };

/** Définition zod d'un nœud, ou `undefined` si ce n'en est pas un. */
export const defDe = (s: unknown): DefZod | undefined => (s as Noeud | null)?._zod?.def ?? (s as Noeud | null)?.def;

/** Un enfant d'un nœud, avec le SEGMENT de path qu'il ajoute (`''` pour une enveloppe transparente). */
export interface EnfantZod {
  readonly noeud: unknown;
  /** Clé d'objet quand l'enfant en est une (le doc en tire les clés déclarées). */
  readonly cle?: string;
  readonly segment: string;
}

/** L'instance qu'exécute le parse d'un `z.lazy`, `undefined` si son getter lève. */
function cibleDuLazy(noeud: unknown): unknown {
  try {
    return (noeud as Noeud)._zod?.innerType;
  } catch {
    return undefined;
  }
}

const unEnfant =
  (segment: string) =>
  (noeud: unknown): EnfantZod[] => [{ noeud, segment }];

/** Les enfants que porte chaque champ de `def`, avec leur segment, dans l'ORDRE de descente. */
const ENFANTS_PAR_CHAMP = {
  shape: (v: unknown): EnfantZod[] => Object.entries(v as Record<string, unknown>).map(([cle, noeud]) => ({ noeud, cle, segment: '.' + cle })),
  catchall: unEnfant('.*'),
  element: unEnfant('[]'),
  innerType: unEnfant(''),
  keyType: unEnfant('{clé}'),
  valueType: unEnfant('{}'),
  in: unEnfant(''),
  out: unEnfant(''),
  options: (v: unknown): EnfantZod[] => (v as unknown[]).map((noeud, i) => ({ noeud, segment: '|' + i })),
  left: unEnfant('&0'),
  right: unEnfant('&1'),
  items: (v: unknown): EnfantZod[] => (v as unknown[]).map((noeud, i) => ({ noeud, segment: '[' + i + ']' })),
  rest: unEnfant('[...]'),
} as const satisfies { readonly [K in keyof DefZod]?: (v: unknown) => EnfantZod[] };

/** Les champs de `def` qui portent des ENFANTS — la liste que lit `enfantsDe`, et la garde
 *  `scripts/guards/lib/lectureDefZod.mjs`. */
export const CHAMPS_D_ENFANTS = Object.keys(ENFANTS_PAR_CHAMP) as readonly (keyof typeof ENFANTS_PAR_CHAMP)[];

/**
 * Enfants d'un nœud, dans l'ORDRE de descente : clés d'objet, clés hors `shape` d'un objet (`catchall`),
 * élément de liste, enveloppes (`innerType`/`in`/`out`), clé et valeur de record, branches d'union,
 * côtés d'intersection, éléments et reste de tuple, cible d'un `lazy`.
 * Syntaxe des segments : `.clé` clé d'objet, `.*` clé hors `shape`, `[]` élément de liste, `{clé}` clé
 * de record, `{}` valeur de record, `|N` branche d'union, `&0`/`&1` côté gauche/droit d'intersection,
 * `[N]` élément de tuple, `[...]` reste de tuple, `''` enveloppe et cible d'un `lazy`.
 */
export function enfantsDe(noeud: unknown): EnfantZod[] {
  const def = defDe(noeud);
  if (!def) return [];
  const enfants: EnfantZod[] = [];
  for (const champ of CHAMPS_D_ENFANTS) {
    const v = def[champ];
    if (v !== undefined && v !== null) enfants.push(...ENFANTS_PAR_CHAMP[champ](v));
  }
  if (def.type === 'lazy') {
    const cible = cibleDuLazy(noeud);
    if (cible !== undefined) enfants.push({ noeud: cible, segment: '' });
  }
  return enfants;
}

/** Ce que la descente présente à chaque nœud visité. */
export interface Visite {
  readonly noeud: object;
  readonly def: DefZod;
  /** Path de SCHÉMA depuis la racine : la suite des segments d'`enfantsDe` (`.a[]{}`), `''` à la racine. */
  readonly path: string;
  readonly profondeur: number;
  /** Rang de la racine d'où part le chemin. */
  readonly racine: number;
}

/** `elaguer` : ne pas descendre sous ce point ; `arreter` : finir la descente. */
export type DecisionDeVisite = void | 'elaguer' | 'arreter';

type Pas = { readonly noeud: unknown; readonly path: string; readonly profondeur: number; readonly racine: number };

/**
 * Descente LARGEUR D'ABORD de schémas racines, par `enfantsDe`. Chaque nœud zod est visité UNE fois
 * par appel (identité), sous le premier chemin qui l'atteint, donc le plus court : un cycle (`z.lazy`)
 * s'arrête sur lui-même, sans borne de profondeur.
 */
export function descendre(racines: readonly unknown[], visite: (v: Visite) => DecisionDeVisite): void {
  const vus = new Set<unknown>();
  const file: Pas[] = racines.map((noeud, racine) => ({ noeud, path: '', profondeur: 0, racine }));
  for (let i = 0; i < file.length; i++) {
    const pas = file[i];
    const { noeud } = pas;
    if (!noeud || typeof noeud !== 'object' || vus.has(noeud)) continue;
    const def = defDe(noeud);
    if (!def) continue;
    vus.add(noeud);
    const suite = visite({ noeud, def, path: pas.path, profondeur: pas.profondeur, racine: pas.racine });
    if (suite === 'arreter') return;
    if (suite === 'elaguer') continue;
    for (const e of enfantsDe(noeud)) file.push({ noeud: e.noeud, path: pas.path + e.segment, profondeur: pas.profondeur + 1, racine: pas.racine });
  }
}

const estObjet = (v: unknown): v is Record<string | number, unknown> => v !== null && typeof v === 'object';

/** Une option d'une union DISCRIMINÉE admet-elle la valeur `v` de son discriminant ? */
function brancheAdmet(option: unknown, discriminant: string, v: unknown): boolean {
  const valeurs = (option as { _zod?: { propValues?: Record<string, ReadonlySet<unknown>> } })._zod?.propValues?.[discriminant];
  return valeurs?.has(v) ?? false;
}

/**
 * Fermeture de `noeuds` par leurs enfants TRANSPARENTS pour un même pas de donnée : `''` (optionnel,
 * nullable, défaut, lecture seule, `lazy`, côtés d'un `pipe`), `&0`/`&1`, `|N` ; départs compris. Une
 * union DISCRIMINÉE ne garde que les branches dont le discriminant admet celui de `valeur`, TOUTES sans
 * valeur lisible : la co-descente ne valide pas (`schemas.js:1171-1187`, zod ne se replie pas). Une
 * union simple garde toutes ses branches. Sans `valeur`, la fermeture est celle du schéma seul.
 */
export function ouverts(noeuds: readonly unknown[], valeur?: unknown): unknown[] {
  const vus = new Set<unknown>();
  const file = [...noeuds];
  for (let i = 0; i < file.length; i++) {
    const n = file[i];
    if (!estObjet(n) || vus.has(n)) continue;
    vus.add(n);
    const discriminant = defDe(n)?.discriminator;
    const lu = discriminant !== undefined && estObjet(valeur) ? valeur[discriminant] : undefined;
    for (const e of enfantsDe(n)) {
      if (e.segment === '' || e.segment.startsWith('&')) file.push(e.noeud);
      else if (e.segment.startsWith('|') && (lu === undefined || brancheAdmet(e.noeud, discriminant!, lu))) file.push(e.noeud);
    }
  }
  return [...vus];
}

/** Les nœuds de l'enfant de donnée `cle` de `noeuds` : une clé de propriété passe par `.clé`, `{}` ou
 *  `.*` (clé hors `shape`) ; un rang `i` par `[]`, `[i]` ou `[...]` (rang hors des éléments du tuple). */
export function pasDeDonnee(noeuds: readonly unknown[], cle: string | number): unknown[] {
  return noeuds.flatMap((n) => {
    const def = defDe(n);
    const horsShape = typeof cle === 'string' && !Object.prototype.hasOwnProperty.call(def?.shape ?? {}, cle);
    const horsItems = typeof cle === 'number' && cle >= (def?.items?.length ?? 0);
    return enfantsDe(n)
      .filter((e) =>
        typeof cle === 'number'
          ? e.segment === '[]' || e.segment === `[${cle}]` || (e.segment === '[...]' && horsItems)
          : e.segment === `.${cle}` || e.segment === '{}' || (e.segment === '.*' && horsShape),
      )
      .map((e) => e.noeud);
  });
}

/** Ce que la co-descente présente à chaque point de la DONNÉE. */
export interface PointDeDonnee {
  /** Les nœuds de schéma du point, déjà `ouverts` par sa valeur. */
  readonly noeuds: readonly unknown[];
  readonly valeur: unknown;
  /** Chemin de DONNÉE depuis la racine (`[]` à la racine). */
  readonly chemin: readonly (string | number)[];
  readonly parent: PointDeDonnee | undefined;
}

/**
 * CO-DESCENTE — parcours en profondeur, dans l'ordre de la DONNÉE, qui présente à chaque point ses
 * nœuds de schéma, sa valeur et son chemin. Elle ne VALIDE PAS : une clé que le schéma ignore donne un
 * ensemble vide, et la descente ne s'y engage pas ; `null` et `undefined` n'ont pas d'enfant. Elle
 * termine parce que la donnée est finie.
 */
export function coDescendre(schema: unknown, donnee: unknown, visite: (p: PointDeDonnee) => DecisionDeVisite): void {
  let fini = false;
  const parcourir = (point: PointDeDonnee): void => {
    const decision = visite(point);
    if (decision === 'arreter') fini = true;
    if (decision || !estObjet(point.valeur)) return;
    const cles: (string | number)[] = Array.isArray(point.valeur) ? point.valeur.map((_, i) => i) : Object.keys(point.valeur);
    for (const cle of cles) {
      if (fini) return;
      const noeuds = pasDeDonnee(point.noeuds, cle);
      if (!noeuds.length) continue;
      const valeur = point.valeur[cle];
      parcourir({ noeuds: ouverts(noeuds, valeur), valeur, chemin: [...point.chemin, cle], parent: point });
    }
  };
  parcourir({ noeuds: ouverts([schema], donnee), valeur: donnee, chemin: [], parent: undefined });
}
