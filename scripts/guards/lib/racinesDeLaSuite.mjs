// Racines de la SUITE Vitest — source unique : `vite.config.ts` en tire `test.include`, `suiteVitest.mjs`
// en lit les fichiers. Module sans dépendance : la config Vite le charge.

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
])
