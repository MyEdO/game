/** Le MOTIF d'une extension de script, source de regex SANS ancre : groupe NON CAPTURANT construit depuis
 *  `EXTENSIONS_DE_SCRIPT` (`dialecte.mjs`), qui reconnaît exactement ces 8 fins. `SUFFIXE_SUITE`,
 *  `SUFFIXE_INSTRUMENT` et `SUFFIXE_KIT` le composent. */
export const MOTIF_D_EXTENSION: string;

/** Le SUFFIXE d'une SUITE, source de regex SANS ancre (`.test.` + `MOTIF_D_EXTENSION`) :
 *  les sites qui ont besoin d'un motif PLUS LARGE (chemin, racine, nom dans la prose) le COMPOSENT
 *  au lieu de le recopier. `EST_SUITE_VITEST` en est DÉRIVÉ. */
export const SUFFIXE_SUITE: string;

/** Le SUFFIXE d'un INSTRUMENT (suite OU banc), source de `EST_FICHIER_VITEST`. */
export const SUFFIXE_INSTRUMENT: string;

/** Un fichier joué par Vitest (ou par `node --test`) : `.test.` (suite, `test.include` tiré de `scripts/guards/lib/racinesDeLaSuite.mjs`) ou
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

/** Le SUFFIXE d'un KIT de test (`.testkit.` + `MOTIF_D_EXTENSION`), source de `EST_KIT_DE_TEST`. */
export const SUFFIXE_KIT: string;

/** Un KIT de test en FIN de nom : ni une suite (`x.testkit.test.ts`), ni sa déclaration (`.testkit.d.mts`). */
export const EST_KIT_DE_TEST: RegExp;

/** Ce chemin désigne-t-il un KIT de test — ni joué, ni de la PRODUCTION ? */
export function estKitDeTest(rel: string): boolean;
