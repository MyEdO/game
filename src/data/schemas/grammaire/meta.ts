/**
 * MÉTA D'ÉDITION d'un champ de document (#1466 L1a) — le libellé FR et l'aide d'atelier vivent AU
 * MÊME ENDROIT que la forme du champ : `document()` exige une `MetaChamp` par clé de `champs`, si
 * bien qu'un champ ne peut pas exister sans son nom lisible (aujourd'hui l'éditeur affiche la clé
 * technique, `src/ui/compendium/editFields.ts`).
 */

/** Méta d'édition d'UN champ de premier niveau d'un document. */
export interface MetaChamp {
  /** Libellé FR affiché par l'atelier (Codex/Compendium) à la place de la clé technique. */
  label: string;
  /** Aide d'atelier — jamais une prose de document (règle stricte 5 : la prose du RAW vit dans `desc`). */
  hint?: string;
  /** Widget de saisie demandé, quand la forme zod n'en désigne pas un seul (dérivation : lot L6). */
  widget?: string;
  /** Rang d'affichage dans le formulaire ; à défaut, l'ordre de déclaration des `champs`. */
  ordre?: number;
}

/** Méta EXIGÉE pour chaque clé de `champs` d'un document — une clé de moins = erreur de type. */
export type MetaDesChamps<C> = { [K in keyof C]: MetaChamp };

/** Profondeur du DÉROULÉ d'enveloppes vers le noyau d'enum — `optional`/`default`/`array`/`nullable`
 *  s'empilent, jamais au-delà. */
const DEROULE_MAX = 8;

/** Forme lue sur un nœud zod 4.4.3 : sa `def`, et la `.meta()` que `enumNomme` y a posée. */
type NoeudZod = { _zod?: { def?: { type?: string; entries?: Record<string, string>; innerType?: unknown; element?: unknown } }; meta?: () => unknown };

/**
 * NOYAU d'enum d'un nœud — le nœud `z.enum` lui-même, à travers les enveloppes qui ne changent pas son
 * univers de valeurs (`optional`, `nullable`, `default`, `array`), `undefined` si le nœud n'est pas
 * énuméré. UNIQUE déroulé du dépôt : `optionsEnum` (`grammaire/document.ts`) le compose, la lecture des
 * libellés ci-dessous aussi — deux déroulés divergeraient sur la première enveloppe neuve.
 */
export function noyauEnum(noeud: unknown): NoeudZod | undefined {
  return deroule(noeud, (n) => n._zod?.def?.type === 'enum') as NoeudZod | undefined;
}

/** Premier nœud qui satisfait `arret`, du nœud lui-même à travers ses enveloppes (`optional`, `nullable`,
 *  `default`, `array`) ; `undefined` sinon. Le déroulé UNIQUE du dépôt (`noyauEnum`, `regimesDuChamp`). */
export function deroule(noeud: unknown, arret: (n: NoeudZod) => boolean): unknown {
  let n = noeud as NoeudZod | undefined;
  for (let i = 0; i < DEROULE_MAX && n; i++) {
    const d = n._zod?.def;
    if (!d) return undefined;
    if (arret(n)) return n;
    n = (d.innerType ?? d.element) as NoeudZod | undefined;
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
