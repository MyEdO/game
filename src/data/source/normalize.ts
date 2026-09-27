// Normalisation pour le MATCH EXACT des citations : replie tout le cosmétique (espaces, guillemets,
// apostrophes, tirets, emphase markdown, casse) MAIS conserve les accents (le match français doit être
// exact : « blessure » ≠ « blessuré »). \s couvre les espaces insécables (U+00A0 / U+202F).
// Les ellipses (…, ..., [...], […]) → sentinelle U+2026, point de coupe pour le split des citations.
//
// Module FEUILLE (zéro import) chargé tel quel par Node nu (`scripts/raw/_lib.mjs`, les scripts de
// `scripts/source/`) et par vitest ; sa syntaxe effaçable et son absence de dépendance le laissent
// chargeable par tsx et par le navigateur.
const SENT = '…';

export function normalize(s: string): string {
  return s
    .replace(/[*_`]/g, '')                          // emphase / code markdown
    .replace(/[«»“”„]/g, '')         // guillemets (la frontière est gérée par le parser)
    .replace(/[’＇´]/g, "'")          // variantes d'apostrophe → '
    .replace(/\[\s*(?:…|\.\.\.)\s*\]/g, ` ${SENT} `) // [...] / […] (élision)
    .replace(/\.\.\./g, SENT)                       // ... → sentinelle
    .replace(/[–—−-]/g, '-')         // tirets (en/em/moins/trait) → -
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

export const ELLIPSIS_SENTINEL = SENT;

/**
 * Une vraie balise HTML NOMMÉE (`<br>`, `<b>`, `<div>`…) — jamais un simple « < » (les formules
 * « PV < 5 » n'en sont pas). DÉFINITION UNIQUE de la règle 5 (« prose en Markdown, jamais en
 * HTML ») : la garde des datasets app-owned (`src/data/no-html-in-prose.test.ts`) et le volet E de
 * la garde de résolution des `descRef` (`src/data/prose-resolution.test.ts`) la lisent ICI — deux
 * définitions divergeraient, et la prose ADRESSÉE échapperait à la moitié de la règle.
 * Sans drapeau `/g` : le prédicat est SANS ÉTAT, partageable entre appelants.
 */
export const HTML_TAG =
  /<(\/?)(b|i|em|strong|br|p|ul|ol|li|table|thead|tbody|tr|td|th|span|div|h[1-6]|a|code|pre|blockquote|sup|sub|hr)\b[^>]*>/i;

/**
 * La balise `<br>` telle que l'extraction Marker l'écrit dans une cellule de table (`<br>`, `<br/>`,
 * `<BR />`) : forme UNIQUE dont dérivent `sansBr` et `brEnSaut` ci-dessous, ses SEULS lecteurs (elle
 * n'est pas exportée — un consommateur qui voudrait la tester se sert d'une des deux fonctions).
 * Elle encode un saut de ligne IMPRIMÉ à l'intérieur d'une cellule (GFM n'a pas d'autre forme) —
 * ce n'est PAS du sens, c'est de la forme, et la lib l'absorbe au lieu de réécrire `Source/`.
 * Balayante (`/g`) : `String.replace` remet `lastIndex` à zéro de part et d'autre, l'état ne fuit pas.
 */
const BR_ALL = /<br\s*\/?>/gi;

/**
 * ADRESSAGE : le `<br>` d'une cellule compte pour une ESPACE, les blancs qui l'entourent sont
 * recollés. C'est la forme qui sert à COMPARER (clé de ligne, en-tête de colonne, empreinte) : une
 * clé imprimée sur deux lignes (`Nombre de sorts<br>connus`) devient adressable telle qu'elle se
 * lit, et le jour où `Source/` la recolle à la main, l'adresse ne bouge pas.
 */
export function sansBr(texte: string): string {
  return texte.replace(BR_ALL, ' ').replace(/[^\S\n]{2,}/g, ' ');
}

/**
 * RENDU d'une cellule : le `<br>` redevient le saut de ligne qu'il imprime (`\n`), les blancs de
 * bord sont tombés. La coupure imprimée est ainsi conservée dans la DONNÉE (la chaîne rendue), sans
 * porter de HTML (règle 5) — pas À L'ÉCRAN : `<Prose>` ne monte que `remarkGfm` (`src/ui/Prose.tsx:173`),
 * où le `\n` d'une cellule se rend en espace.
 */
export function brEnSaut(texte: string): string {
  return texte.replace(BR_ALL, '\n').split('\n').map((l) => l.trim()).join('\n').trim();
}
