/**
 * MÉTA D'ÉDITION d'un champ de document (#1466 L1a) — le libellé FR et l'aide d'atelier vivent AU
 * MÊME ENDROIT que la forme du champ : `document()` exige une `MetaChamp` par clé de `champs`, si
 * bien qu'un champ ne peut pas exister sans son nom lisible.
 */
import { defDe, enfantsDe } from './descente';
import { z } from 'zod';
import './locale-fr';

/** Méta d'édition d'UN champ de premier niveau d'un document. */
export interface MetaChamp {
  texte?: {
    regime: 'narration' | 'document' | 'designation' | 'technique' | 'atelier';
    usage?: string;
    horsContrat?: { motif: 'catalogue' | 'sans-saisie-campagne' | 'sans-rendu-joueur'; preuve: string };
  };
  transparent?: true;
  /** Libellé FR affiché par l'atelier (Codex/Compendium) à la place de la clé technique. */
  label: string;
  /** Aide d'atelier — jamais une prose de document (règle stricte 5 : la prose du RAW vit dans `desc`). */
  hint?: string;
  /** Widget de saisie demandé, quand la forme zod n'en désigne pas un seul (dérivation : lot L6). */
  widget?: string;
  /** Rang d'affichage dans le formulaire ; à défaut, l'ordre de déclaration des `champs`. */
  ordre?: number;
  /** RENDU PUR : la valeur ne sert qu'à l'apparence. Une instance ne la recopie jamais, son dessin la
   *  résout au catalogue courant (#2113) — garde `src/engine/rendu-pur-jamais-recopie.test.ts`. */
  renduPur?: true;
}

/** Méta EXIGÉE pour chaque clé de `champs` d'un document — une clé de moins = erreur de type. */
export type MetaDesChamps<C> = { [K in keyof C]: MetaChamp };

export interface NomDeNoeud {
  readonly label?: string;
  readonly nom?: string;
  readonly element?: string;
  readonly opacite?: { nature: 'dispatch-op'; raison: string };
}

function verifierChamps(noeud: unknown, champs: Readonly<Record<string, MetaChamp>> | undefined): asserts champs is Readonly<Record<string, MetaChamp>> {
  if (champs === undefined) throw new Error('métas de champs absentes');
  const cles = enfantsDe(noeud).flatMap(e => e.cle === undefined ? [] : [e.cle]);
  for (const cle of cles) if (!champs[cle]?.label?.trim()) throw new Error(`champ sans nom : ${cle}`);
  for (const cle of Object.keys(champs)) if (!cles.includes(cle)) throw new Error(`méta sans champ : ${cle}`);
}

export function nommerChamps<N extends z.ZodObject>(noeud: N, champs: MetaDesChamps<N['shape']>, nom: NomDeNoeud = {}): N {
  verifierChamps(noeud, champs);
  z.globalRegistry.add(noeud, { ...noeud.meta(), champs, ...nom });
  return noeud;
}

export function metaDesChamps<N extends z.ZodObject>(noeud: N, options: { exigees: true }): MetaDesChamps<N['shape']>;
export function metaDesChamps<N extends z.ZodObject>(noeud: N): MetaDesChamps<N['shape']> | undefined;
export function metaDesChamps(noeud: unknown): Readonly<Record<string, MetaChamp>> | undefined;
export function metaDesChamps(noeud: unknown, options?: { exigees: true }): Readonly<Record<string, MetaChamp>> | undefined {
  const champs = (noeud as { meta?: () => { champs?: Readonly<Record<string, MetaChamp>> } } | null)?.meta?.()?.champs;
  if (options?.exigees) verifierChamps(noeud, champs);
  return champs;
}

export function nomDeNoeud(noeud: unknown): NomDeNoeud | undefined {
  return (noeud as { meta?: () => NomDeNoeud } | null)?.meta?.();
}

export function nommerNoeud<N extends z.ZodType>(noeud: N, nom: NomDeNoeud): N {
  z.globalRegistry.add(noeud, { ...noeud.meta(), ...nom });
  return noeud;
}

export function metasExtra(extra: Record<string, z.ZodType> | undefined): Readonly<Record<string, MetaChamp>> {
  return Object.fromEntries(Object.entries(extra ?? {}).map(([cle, noeud]) => {
    const label = nomDeNoeud(noeud)?.nom;
    if (!label) throw new Error(`champ ajouté sans nom : ${cle}`);
    return [cle, { label }];
  }));
}

/** Nœud énuméré tel que `meta.ts` le lit : la `.meta()` que `enumNomme` y a posée. */
type NoeudEnum = { meta?: () => unknown };

/**
 * NOYAU d'enum d'un nœud — le nœud `z.enum` lui-même, `undefined` si le nœud n'est pas énuméré. Le
 * déroulé descend d'un nœud à son enfant quand `enfantsDe` (`grammaire/descente.ts`) en rend UN seul,
 * de segment `''` ou `[]`, sans lire le type du nœud : il traverse donc optionnel, nullable, défaut,
 * lecture seule, cible d'un `lazy`, élément de liste, et aussi `.catch`, `z.promise` et `z.success`,
 * dont l'univers de valeurs n'est pas celui de leur enfant. Il s'arrête sur tout nœud à plusieurs
 * enfants (union, pipe, intersection), sur tout autre segment, et sur un nœud déjà traversé. UNIQUE
 * déroulé du dépôt : `optionsEnum` (`grammaire/document.ts`) le compose, la lecture des libellés
 * ci-dessous aussi.
 */
export function noyauEnum(noeud: unknown): NoeudEnum | undefined {
  return derouleEnum(noeud)?.noyau;
}

/** Le déroulé lui-même : le noyau d'enum, et `liste` quand un élément de liste (segment `[]`) a été
 *  traversé — le champ porte alors PLUSIEURS valeurs de l'enum, jamais une seule. */
export function derouleEnum(noeud: unknown): { noyau: NoeudEnum; liste: boolean } | undefined {
  const traverses = new Set<unknown>();
  let liste = false;
  for (let n = noeud; n && !traverses.has(n); ) {
    if (defDe(n)?.type === 'enum') return { noyau: n as NoeudEnum, liste };
    traverses.add(n);
    const enfants = enfantsDe(n);
    if (enfants.length !== 1 || (enfants[0].segment !== '' && enfants[0].segment !== '[]')) return undefined;
    if (enfants[0].segment === '[]') liste = true;
    n = enfants[0].noeud;
  }
  return undefined;
}

/**
 * Valeurs NOMMÉES d'un nœud énuméré (`valeur → libellé FR`), telles que `enumNomme` les a posées SUR
 * LE NŒUD (`grammaire/valeurs.ts`) — `undefined` si le nœud n'est pas un enum, ou si son enum n'est
 * pas nommé (stock décroissant, `valeurs-de-champ.test.ts`). L'ordre des clés EST celui des options :
 * elles en sont la source. C'est ce qui fait d'un champ un `select` : ses options ET leurs noms
 * viennent de la déclaration du nœud.
 */
export function valeursDe(noeud: unknown): Readonly<Record<string, string>> | undefined {
  const valeurs = (noyauEnum(noeud)?.meta?.() as { valeurs?: Readonly<Record<string, string>> } | undefined)?.valeurs;
  return valeurs && Object.keys(valeurs).length ? valeurs : undefined;
}

/**
 * LIBELLÉ FR d'une VALEUR d'un nœud énuméré — lecture canonique de l'enum nommé (#1694), partagée par
 * le Codex (groupe/sous-titre/fait), le `select` de l'atelier et tout site d'affichage. Repli sur la
 * valeur BRUTE : la donnée reste lisible tant qu'un nœud n'est pas nommé.
 */
export function libelleDeValeur(noeud: unknown, valeur: string): string {
  return valeursDe(noeud)?.[valeur] ?? valeur;
}

/**
 * HINT MÉCANIQUE d'une VALEUR d'un nœud énuméré — ce que la règle FAIT quand cette valeur est choisie,
 * tel que `enumNomme` l'a posé SUR LE NŒUD ; `undefined` quand la valeur n'en porte pas (une option
 * sans conséquence mécanique n'invente pas d'infobulle).
 */
export function hintDeValeur(noeud: unknown, valeur: string): string | undefined {
  return (noyauEnum(noeud)?.meta?.() as { hints?: Readonly<Record<string, string>> } | undefined)?.hints?.[valeur];
}
