// Contrat du détecteur de modules substitués sous test (#2586) : une fixture par forme, par liaison, le cas
// opaque et chacune des exclusions par définition. Les fixtures vivent en JSON : écrites ici en littéraux,
// elles seraient du code porté en chaîne que le détecteur lit.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { sitesDeSubstitution, sitesDuDepot } from './modulesSubstitues.mjs'

const FIXTURES = JSON.parse(readFileSync(new URL('./fixtures/modules-substitues.json', import.meta.url), 'utf8'))
const FICHIER_DE_TEST = 'scripts/x/cas.test.mjs'

const projeter = (sites) => sites.map(({ fichier, ligne, effets, enChaine }) => ({ fichier, ligne, effets, enChaine }))

for (const [famille, cas] of Object.entries(FIXTURES)) {
  for (const { cas: nom, fichier = FICHIER_DE_TEST, texte, sites } of cas) {
    // #2586
    test(`${famille} : ${nom}`, () => {
      assert.deepEqual(projeter(sitesDeSubstitution(fichier, texte.join('\n'))), sites.map((s) => ({ fichier, ...s })))
    })
  }
}

// #2586
test('corpus : seul le code de test de scripts/ porte des sites', () => {
  const [forme] = FIXTURES.formes
  const texte = forme.texte.join('\n')
  const corpus = [
    { rel: 'scripts/x/precharge.mjs', text: texte },
    { rel: 'scripts/x/banc.testkit.mjs', text: texte },
    { rel: 'scripts/x/cas.test.mjs', text: texte },
    { rel: 'src/x/cas.test.ts', text: texte },
  ]
  assert.deepEqual(sitesDuDepot(corpus).map(({ fichier, ligne }) => `${fichier}:${ligne}`), ['scripts/x/banc.testkit.mjs:3', 'scripts/x/cas.test.mjs:3'])
})
