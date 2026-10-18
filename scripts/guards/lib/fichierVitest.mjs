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
// n'écrit un littéral `\.test\.`, `\.bench\.` ni `\.testkit\.` (garde de balayage, `fichierVitest.test.mjs`).
//
// TROISIÈME FORME, le KIT de test (`*.testkit.*`) : un module que seul l'OUTILLAGE de test importe —
// suites, setup (`src/test-setup.ts`), fixtures (`scripts/test/fixtures/`). Il n'est pas joué (ni suite
// ni banc), mais il n'est pas de la production : `estKitDeTest`, en UN exemplaire.
//
// La FORME du cliquet, jamais une liste de fichiers : le banc N+1 est couvert sans qu'on y revienne.

import { EXTENSIONS_DE_SCRIPT } from './dialecte.mjs';

/** Le MOTIF d'une extension de script, source de regex SANS ancre : un groupe NON CAPTURANT construit depuis
 *  la liste unique `EXTENSIONS_DE_SCRIPT` (`dialecte.mjs`), la plus longue d'abord, pour qu'un motif non ancré
 *  prenne `.tsx` entier plutôt que `.ts`. Les trois suffixes le COMPOSENT, et aucun site du dépôt ne
 *  recopie le fragment littéral des dialectes (garde de balayage, `fichierVitest.test.mjs`). */
export const MOTIF_D_EXTENSION = `(?:${[...EXTENSIONS_DE_SCRIPT]
  .sort((a, b) => b.length - a.length)
  .map((ext) => ext.replaceAll('.', String.raw`\.`))
  .join('|')})`;

/** Le SUFFIXE d'une SUITE, source de regex SANS ancre : `.test.` puis un `MOTIF_D_EXTENSION`. Exporté NU pour
 *  que les sites qui ont besoin d'un motif PLUS LARGE (un chemin, une racine, un nom dans la prose) le
 *  COMPOSENT au lieu de le recopier. */
export const SUFFIXE_SUITE = String.raw`\.test` + MOTIF_D_EXTENSION;

/** Le SUFFIXE d'un INSTRUMENT (suite OU banc), même usage que `SUFFIXE_SUITE`. */
export const SUFFIXE_INSTRUMENT = String.raw`\.(test|bench)` + MOTIF_D_EXTENSION;

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

/** Le SUFFIXE d'un KIT de test, `.testkit.` puis un `MOTIF_D_EXTENSION` : `src/**` en `.ts`, `scripts/**` en
 *  `.mjs` (`lint.testkit.mjs`). Sa déclaration `.testkit.d.mts` n'en est pas un : l'ancre de fin la refuse. */
export const SUFFIXE_KIT = String.raw`\.testkit` + MOTIF_D_EXTENSION;

/** Un KIT de test, en FIN de nom — DÉRIVÉ de `SUFFIXE_KIT`. Une suite du kit (`x.testkit.test.ts`) est
 *  une suite, pas un kit. */
export const EST_KIT_DE_TEST = new RegExp(`${SUFFIXE_KIT}$`);

/**
 * Ce chemin (ou ce nom de fichier) désigne-t-il un KIT de test — ni joué, ni de la production ?
 * @param {string} rel chemin POSIX depuis la racine, ou nom nu.
 * @returns {boolean}
 */
export const estKitDeTest = (rel) => EST_KIT_DE_TEST.test(rel);
