import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { DOCUMENTAIRE, gatesSautables } from '../../gates/classerPush.mjs'
import { gatesDeCi } from '../../gates/gatesDeCi.mjs'
import { corpusParGate, inerte } from '../../gates/ecrivainsAtteints.mjs'
import { ECRIT_LU } from '../../gates/toutes.mjs'
import { gitDeLArbreReel } from '../../test/gitDeBanc.mjs'
import { jetonNomme } from '../../test/lib/bancClasserPush.mjs'

const RACINE = fileURLToPath(new URL('../../../', import.meta.url))

const gates = gatesDeCi({ cwd: RACINE })

const sautables = gatesSautables({ gates, ecritLu: ECRIT_LU })

// (c1) — chaque gate SAUTABLE confrontée à son CORPUS : la classe « `lit` sous-déclaré ».
//
// #1738 : une gate dont le `lit` omet un fichier que son code lit est SAUTÉE sur le push qui touche
// ce fichier. La mesure `lit` est déclarative ; ce cas la confronte au CODE ATTEINT.
//
// Un DOCUMENT de donnée importé (`src/data/**.json`, `src/scenes/**.json`) n'est pas du code : sa prose qui
// cite `CLAUDE.md` (`src/data/river-criticals.json`) ne lit aucun fichier ; un autre `.json` de la fermeture
// (configuration) reste jugé.
// ANGLES MORTS, dits : le grain est la LIGNE d'un module local, et le corpus vient de la fermeture
// transitive d'imports de `ecrivainsAtteints.mjs` — un chemin CONSTRUIT dynamiquement (`join(base,
// nom)`, une variable, un `require`) n'est pas vu, ni ce qu'un sous-processus NON-node fait de son
// côté (git, tsc, eslint, knip, vite). Même déclaration que `ecrivainsAtteints.mjs` : c'est une
// lecture statique, jamais une preuve d'absence.

test('aucune gate SAUTABLE ne nomme un chemin DOCUMENTAIRE dans le code qu’elle atteint', () => {
  const corpus = corpusParGate(RACINE)
  const trous = []
  for (const gate of sautables) {
    for (const fichier of (corpus[gate] ?? []).filter((f) => !/^src\/(data|scenes)\/.*\.json$/.test(f))) {
      const lignes = readFileSync(join(RACINE, fichier), 'utf8').split('\n')
      lignes.forEach((ligne, i) => {
        if (inerte(ligne)) return
        const jeton = jetonNomme(ligne)
        if (jeton)
          trous.push(
            `gate ${gate} est sautée mais \`${fichier}:${i + 1}\` nomme \`${jeton}\` : ` +
              'mesure son `lit` (sonde fs) et déclare-le dans ECRIT_LU',
          )
      })
    }
  }
  assert.deepEqual(trous, [])
})

// (c2) — la liste DOCUMENTAIRE confrontée à ce que le RUNTIME lit : un sens DISTINCT de (c1). Une
// gate peut ne rien lire de documentaire alors que `src/` le lirait à l'exécution — le classement
// lui-même serait faux, pas seulement le `lit` d'une gate.

/** Les sources de `src/` et `server/src/` SUIVIES par git, hors bancs de test. */
function sourcesDeProduction() {
  return gitDeLArbreReel(RACINE)('ls-files', '--', 'src', 'server/src')
    .split('\n')
    .map((l) => l.trim())
    .filter((f) => /\.(ts|tsx|mts|js|jsx)$/.test(f) && !f.includes('.test.'))
}

/**
 * Les cibles que le fichier LIT vraiment : spécificateur d'`import`/`export … from`, argument de
 * `readFileSync`/`readFile`, de `fetch(`, motif d'`import.meta.glob`. Jamais une regex sur le texte
 * nu : un chemin cité en commentaire n'est pas une lecture (mesuré 2026-09-16 — 64 mentions de
 * `.claude`/`.codex`/`CLAUDE.md` sous src/, toutes en commentaire ou classe CSS).
 */
function ciblesLues(texte) {
  const cibles = []
  const motifs = [
    /(?:^|\n)\s*(?:import|export)[^\n;]*?from\s*['"]([^'"]+)['"]/g,
    /\bimport\s*\(\s*['"]([^'"]+)['"]/g,
    /\bimport\.meta\.glob\s*\(\s*\[?\s*['"]([^'"]+)['"]/g,
    /\breadFileSync?\s*\(\s*['"]([^'"]+)['"]/g,
    /\breadFile\s*\(\s*['"]([^'"]+)['"]/g,
    /\bfetch\s*\(\s*['"]([^'"]+)['"]/g,
  ]
  for (const motif of motifs) for (const m of texte.matchAll(motif)) cibles.push(m[1])
  return cibles
}

test('aucune entrée de DOCUMENTAIRE n’est LUE par du code de production', () => {
  const prefixes = Object.keys(DOCUMENTAIRE)
  const lectures = []
  for (const fichier of sourcesDeProduction()) {
    const texte = readFileSync(join(RACINE, fichier), 'utf8')
    for (const cible of ciblesLues(texte)) {
      const nue = cible.replace(/^\.\.?\//, '').replace(/^[a-z]+:/, '')
      const fautif = prefixes.find((p) => nue.startsWith(p) || cible.includes(`/${p}`) || cible.startsWith(p))
      if (fautif) lectures.push(`${fichier} LIT « ${cible} » — « ${fautif} » n’est donc pas documentaire`)
    }
  }
  assert.deepEqual(lectures, [])
})
