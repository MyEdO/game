/** Le SUFFIXE d'une SUITE, source de regex SANS ancre (`.test.` + tous les dialectes du dépôt) :
 *  les sites qui ont besoin d'un motif PLUS LARGE (chemin, racine, nom dans la prose) le COMPOSENT
 *  au lieu de le recopier. `EST_SUITE_VITEST` en est DÉRIVÉ. */
export const SUFFIXE_SUITE: string;

/** Le SUFFIXE d'un INSTRUMENT (suite OU banc), source de `EST_FICHIER_VITEST`. */
export const SUFFIXE_INSTRUMENT: string;

/** Un fichier joué par Vitest (ou par `node --test`) : `.test.` (suite, `scripts/guards/lib/racinesDeLaSuite.mjs`) ou
 *  `.bench.` (banc, `npm run bench`, hors suite et hors CI), dans TOUS les dialectes du dépôt
 *  (`.ts`, `.tsx`, `.js`, `.jsx`, `.mts`, `.cts`, `.mjs`, `.cjs`). En FIN de nom : un `.bak` n'en
 *  est pas un. */
export const EST_FICHIER_VITEST: RegExp;

/** Ce chemin désigne-t-il un INSTRUMENT Vitest — donc jamais de la PRODUCTION ? Le prédicat que
 *  consomme toute garde dont le périmètre est « la production » : n'exclure que les `.test.` prend
 *  le banc pour de la production et rougit sur l'index figé qu'il pose à dessein. Pourquoi, et ce
 *  qui n'en est pas (les sites qui visent « les tests seulement », `estSuiteVitest` ci-dessous) :
 *  en-tête de `fichierVitest.mjs`. */
export function estFichierVitest(rel: string): boolean;

/** Une SUITE Vitest (ou `node --test`), JAMAIS un banc : `.test.` en FIN de nom, tous dialectes. */
export const EST_SUITE_VITEST: RegExp;

/** Ce chemin désigne-t-il une SUITE Vitest ? Le prédicat des sites dont le sens est « les tests
 *  seulement » — sélectionner les suites, les compter, en refuser une dans une liste. Un banc répond
 *  NON : il n'est ni joué en suite ni de la production. */
export function estSuiteVitest(rel: string): boolean;
