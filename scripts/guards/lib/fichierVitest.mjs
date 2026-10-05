// INSTRUMENT VITEST (#1788) — le prédicat « ce fichier est joué PAR Vitest, il n'est donc pas de la
// PRODUCTION ». Module ESM pur, exécutable par `node` nu, sans état ni lecture disque — même patron
// que `codeSeul.mjs`.
//
// POURQUOI UN MODULE À LUI : l'instrument a DEUX formes — le `.test.` (`vitest run`, seul nommé
// par `test.include`, tiré de `scripts/guards/lib/racinesDeLaSuite.mjs`) et le `.bench.` (`vitest bench`, `npm run bench`, hors suite et hors CI).
// Une garde qui n'exclut que la première prend le banc pour de la production et rougit sur ce qu'il
// fait À DESSEIN — l'index FIGÉ d'un banc est le témoin qu'il compare au vivant —, ce qui pousse à
// l'exempter par son NOM : une garde qui valide des défauts. Le prédicat vit donc en UN exemplaire,
// et chaque garde qui distingue production / instrument le consomme. Aucun bundle n'embarque un
// banc : il importe l'API `bench` de vitest par construction.
//
// L'AUTRE SENS, ici AUSSI : un site dont le sens est « les tests SEULEMENT » (sélectionner les
// suites, compter les suites, refuser une suite dans une liste) parle des tests, pas de la
// production — il consomme `estSuiteVitest`, qui dit VRAI sur une suite et FAUX sur un banc. Les
// deux concepts vivent donc dans CE module, en UN exemplaire chacun : aucun autre fichier du dépôt
// n'écrit un littéral `\.test\.` ni `\.bench\.` (garde de balayage, `fichierVitest.test.mjs`).
//
// La FORME du cliquet, jamais une liste de fichiers : le banc N+1 est couvert sans qu'on y revienne.
//
// SECOND CONCEPT, la LECTURE d'un glob de `test.include` : les racines de `npm test` vivent dans
// `racinesDeLaSuite.mjs`, d'où `vite.config.ts` tire ses globs ; une garde qui confronte un glob au
// prédicat de suite le DÉPLIE par `finsDuGlob`, jamais par une copie locale.

/** Le SUFFIXE d'une SUITE, source de regex SANS ancre : `.test.` puis un dialecte du dépôt — `.ts`,
 *  `.tsx`, `.js`, `.jsx`, et les formes de module explicites `.mts`/`.cts`/`.mjs`/`.cjs`
 *  (`scripts/**` écrit ses gardes et leurs tests en `.mjs`, ses planches en `.mts`). Un dialecte
 *  manquant ferait rentrer l'instrument dans un corpus de PRODUCTION selon l'extension, ce qui est
 *  exactement le défaut qu'on ferme. Exporté NU pour que les sites qui ont besoin d'un motif PLUS
 *  LARGE (un chemin, une racine, un nom dans la prose) le COMPOSENT au lieu de le recopier. */
export const SUFFIXE_SUITE = String.raw`\.test\.[cm]?[jt]sx?`;

/** Le SUFFIXE d'un INSTRUMENT (suite OU banc), même usage et mêmes dialectes que `SUFFIXE_SUITE`. */
export const SUFFIXE_INSTRUMENT = String.raw`\.(test|bench)\.[cm]?[jt]sx?`;

/** Un fichier joué par Vitest (ou par `node --test`) : `.test.` (suite) ou `.bench.` (banc), en FIN
 *  de nom, DANS TOUS LES DIALECTES du dépôt — DÉRIVÉ de `SUFFIXE_INSTRUMENT`, jamais réécrit.
 *  Un `.bak` ou un `.fixture.ts` n'en est pas un : l'ancre de fin le refuse. */
export const EST_FICHIER_VITEST = new RegExp(`${SUFFIXE_INSTRUMENT}$`);

/**
 * Ce chemin (ou ce nom de fichier) désigne-t-il un INSTRUMENT Vitest — donc jamais de la production ?
 * @param {string} rel chemin POSIX depuis la racine, ou nom nu.
 * @returns {boolean}
 */
export const estFichierVitest = (rel) => EST_FICHIER_VITEST.test(rel);

/** Une SUITE Vitest (ou `node --test`), JAMAIS un banc : `.test.` en FIN de nom, dans tous les
 *  dialectes du dépôt — DÉRIVÉ de `SUFFIXE_SUITE`. Le prédicat des sites « les tests seulement ». */
export const EST_SUITE_VITEST = new RegExp(`${SUFFIXE_SUITE}$`);

/**
 * Ce chemin (ou ce nom de fichier) désigne-t-il une SUITE Vitest — un banc répond NON ?
 * @param {string} rel chemin POSIX depuis la racine, ou nom nu.
 * @returns {boolean}
 */
export const estSuiteVitest = (rel) => EST_SUITE_VITEST.test(rel);

/** Le séparateur d'un glob d'`include` : ce qui précède est le DOSSIER, ce qui suit la FIN de nom. */
export const SEPARATEUR_GLOB = '/**/*';

/**
 * Les FINS DE NOM qu'un glob d'`include` accepte, l'accolade dépliée en une fin par dialecte. Aucune
 * forme de nom de suite n'est réécrite ici : c'est le glob qui la porte.
 * @param {string} motif un glob d'`include`.
 * @returns {string[]}
 */
export function finsDuGlob(motif) {
  const [dir, suffixe] = motif.split(SEPARATEUR_GLOB);
  if (!dir || !suffixe) throw new Error(`finsDuGlob : glob d'include non reconnu — ${motif}`);
  const accolade = /\{([a-z,]+)\}$/.exec(suffixe);
  return accolade ? accolade[1].split(',').map((d) => suffixe.replace(accolade[0], d)) : [suffixe];
}
