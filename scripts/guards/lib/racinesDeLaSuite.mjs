// Racines de la SUITE Vitest — source unique : `vite.config.ts` en tire `test.include` et `test.exclude`,
// `suiteVitest.mjs` en lit les fichiers. Module sans dépendance du dépôt : la config Vite et la garde Vitest d'avant
// import le chargent.
import picomatch from 'picomatch'

/** Une racine : `dir` = dossier, `exts` = extensions de ses suites, `motif` = glob de `test.include`. */
const racine = (dir, exts) =>
  Object.freeze({
    dir,
    exts: Object.freeze(exts),
    motif: `${dir}/**/*.test.${exts.length > 1 ? `{${exts.map((e) => e.slice(1)).join(',')}}` : exts[0].slice(1)}`,
  })

export const RACINES_DE_LA_SUITE = Object.freeze([
  racine('src', ['.ts', '.tsx']),
  racine('server/src', ['.ts']),
  racine('scripts/map', ['.ts']),
  racine('scripts/qc', ['.ts']),
  racine('scripts/source', ['.ts']),
])

/** Les motifs de `test.exclude`. */
export const EXCLUSIONS_DE_LA_SUITE = Object.freeze(['**/node_modules/**', '**/.git/**'])

/** Le chemin POSIX relatif `rel` est-il une suite que Vitest joue ? Le matcher de Vitest (#2651) : `picomatch`, `dot`,
 *  sur les `motif` de `test.include`, hors `EXCLUSIONS_DE_LA_SUITE`. */
export const estDeLaSuiteVitest = picomatch(RACINES_DE_LA_SUITE.map((r) => r.motif), { dot: true, ignore: [...EXCLUSIONS_DE_LA_SUITE] })
