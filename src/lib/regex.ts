/**
 * Échapper une chaîne pour une regex et construire une alternation. Module PUR, sans import : Node nu
 * le charge aussi depuis `scripts/`, par son chemin relatif, extension comprise.
 */

/**
 * Échappe exactement les `SyntaxCharacter` d'ECMAScript (`^ $ \ . * + ? ( ) [ ] { } |`). La sortie
 * vaut la chaîne telle quelle sous les drapeaux `''`, `u` et `v`, hors d'une classe de caractères.
 */
export const echapperRegex = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Ne matche rien, pas même la chaîne vide ; valide sous `v`. */
const RIEN = '(?!)';

const nommer = (x: unknown): string => {
  try {
    return JSON.stringify(x) ?? String(x);
  } catch {
    return String(x);
  }
};

/**
 * Alternation nue de CHAÎNES cherchées telles quelles : dédoublonnées, la plus longue d'abord (#434),
 * par un tri stable sur la chaîne d'origine (à longueur égale, l'ordre de l'appelant), puis chacune
 * échappée par `echapperRegex`. `parChaine` transforme chaque chaîne échappée sans changer le tri.
 * L'appelant choisit son groupe. Lève sur un élément qui n'est pas une chaîne ; une liste vide rend
 * `(?!)`.
 */
export function alternationDe(
  chaines: Iterable<string>,
  options: { parChaine?: (echappee: string) => string } = {},
): string {
  const liste: string[] = [];
  for (const c of chaines as Iterable<unknown>) {
    if (typeof c !== 'string') throw new TypeError(`alternationDe : élément non chaîne ${nommer(c)}`);
    liste.push(c);
  }
  const uniques = [...new Set(liste)];
  if (uniques.length === 0) return RIEN;
  const parChaine = options.parChaine ?? ((e: string) => e);
  return uniques
    .sort((a, b) => b.length - a.length)
    .map((c) => parChaine(echapperRegex(c)))
    .join('|');
}

/**
 * Alternation nue de FRAGMENTS de regex, dans l'ordre de l'appelant : une `RegExp` par sa `.source`,
 * une chaîne telle quelle, chacun entouré de `(?:…)`. Lève sur une `RegExp` qui porte des drapeaux :
 * les drapeaux sont ceux de l'appelant. Une liste vide rend `(?!)`.
 */
export function alternationDeRegex(fragments: Iterable<RegExp | string>): string {
  const sources: string[] = [];
  for (const f of fragments) {
    if (f instanceof RegExp) {
      if (f.flags) throw new TypeError(`alternationDeRegex : fragment à drapeaux /${f.source}/${f.flags}`);
      sources.push(f.source);
    } else {
      sources.push(f);
    }
  }
  if (sources.length === 0) return RIEN;
  return sources.map((s) => `(?:${s})`).join('|');
}

/** Chaque espace d'une chaîne échappée par `echapperRegex` accepte une suite de blancs (`\s+`). */
export const espacesExtensibles = (echappee: string): string => echappee.replace(/ /g, '\\s+');
