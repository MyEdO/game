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

import { bancclasserPushtestmjs } from '../../gates/bancClasserPush.mjs'
const { jetonNomme } = bancclasserPushtestmjs

const RACINE = fileURLToPath(new URL('../../../', import.meta.url))

const gates = gatesDeCi({ cwd: RACINE })

const sautables = gatesSautables({ gates, ecritLu: ECRIT_LU })

test('aucune gate SAUTABLE ne nomme un chemin DOCUMENTAIRE dans le code qu’elle atteint', () => {
  const corpus = corpusParGate(RACINE)
  const trous = []
  for (const gate of sautables) {
    for (const fichier of corpus[gate] ?? []) {
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

function sourcesDeProduction() {
  return gitDeLArbreReel(RACINE)('ls-files', '--', 'src', 'server/src')
    .split('\n')
    .map((l) => l.trim())
    .filter((f) => /\.(ts|tsx|mts|js|jsx)$/.test(f) && !f.includes('.test.'))
}

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
