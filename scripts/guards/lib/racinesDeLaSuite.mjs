// Racines partagées par la configuration Vitest, les tranches de CI et les gardes de corpus.
import picomatch from 'picomatch'

const racine = (dir) => Object.freeze({ dir, exts: Object.freeze(['.ts']), motif: `${dir}/**/*.test.ts` })

export const RACINES_DE_LA_SUITE = Object.freeze([
  racine('src'),
  racine('hotes'),
  racine('server/src'),
  racine('scripts/map'),
  racine('scripts/personnage-3d'),
  racine('projets'),
])

export const EXCLUSIONS_DE_LA_SUITE = Object.freeze(['**/node_modules/**', '**/.git/**'])

export const estDeLaSuiteVitest = picomatch(RACINES_DE_LA_SUITE.map((r) => r.motif), { dot: true, ignore: [...EXCLUSIONS_DE_LA_SUITE] })
