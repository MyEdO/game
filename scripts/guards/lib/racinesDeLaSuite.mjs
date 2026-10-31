// Racines de la SUITE Vitest — source unique : `vite.config.ts` en tire `test.include` et `test.exclude`,
// `vitest.noyau.config.ts` son `include` (`SUITES_VITEST_DE_CI`), `suiteVitest.mjs` en lit les fichiers. Module sans
// autre dépendance du dépôt que la table `COUCHES` (`couches.mjs`, sans dépendance) : les configs Vite et la garde
// Vitest d'avant import le chargent.
import picomatch from 'picomatch'
import { HOTES_DU_NOYAU, dossierDe } from './couches.mjs'

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
  racine('scripts/personnage-3d', ['.ts']),
  racine('scripts/qc', ['.ts']),
])

/** Les tests HORS STORE (#2817) : joués par la seule suite du noyau (`vitest.noyau.config.ts`, `isolate: true`), sans
 *  le store ni le socle de test de la suite principale — ceux du noyau et ceux de ses hôtes (`HOTES_DU_NOYAU`, #2898,
 *  #2928). Un `*.hors-store.test.ts` posé hors de leurs dossiers n'est pas exclu : la suite principale le joue. */
export const MOTIF_HORS_STORE = `{${['noyau', ...HOTES_DU_NOYAU].map(dossierDe).join(',')}}/**/*.hors-store.test.ts`

/** Les suites Vitest qu'un step `npm run <nom>` de la CI joue hors de la suite principale : `config` = la config que
 *  lance le script `package.json` du même nom (`vitest run --config <config>`), `motif` = son `include`. La liste
 *  qu'elles jouent est tenue ici, comme celle des gates `node --test` (`scripts/gates/testsParGate.mjs`). */
export const SUITES_VITEST_DE_CI = Object.freeze({
  'test:noyau': Object.freeze({ config: 'vitest.noyau.config.ts', motif: MOTIF_HORS_STORE }),
})

const HORS_DU_DEPOT = Object.freeze(['**/node_modules/**', '**/.git/**'])

/** Les motifs de `test.exclude`. */
export const EXCLUSIONS_DE_LA_SUITE = Object.freeze([...HORS_DU_DEPOT, MOTIF_HORS_STORE])

/** Le chemin POSIX relatif `rel` est-il une suite que Vitest joue ? Le matcher de Vitest (#2651) : `picomatch`, `dot`,
 *  sur les `motif` de `test.include`, hors `EXCLUSIONS_DE_LA_SUITE`. */
export const estDeLaSuiteVitest = picomatch(RACINES_DE_LA_SUITE.map((r) => r.motif), { dot: true, ignore: [...EXCLUSIONS_DE_LA_SUITE] })

/** Le chemin POSIX relatif `rel` est-il une suite que joue la suite du noyau (`MOTIF_HORS_STORE`) ? Même matcher. */
export const estDeLaSuiteDuNoyau = picomatch([MOTIF_HORS_STORE], { dot: true, ignore: [...HORS_DU_DEPOT] })
