// Filet des citations des docs PURS (#2203) : chaque `fichier:ligne` qu'un générateur de `GENERATORS`
// rend porte, à ±2 lignes du site SUR LE DISQUE, l'un des identifiants backtiqués de sa ligne. Le doc
// n'est pas commité : ce qu'on juge est son RENDU (`renduDe`), jamais un fichier de `docs/`.
//   node --test scripts/corpus/docs/citations-rendues.test.mjs  (chaîné dans `npm run test:corpus`)
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { GENERATORS, renduDe } from '../../docs/build-all.mjs'
import { estUnDocMarkdown } from '../../docs/lib/ecriture-derives.mjs'
import { fautesDeCitations } from '../../test/lib/bancGenerateurs.mjs'

const RACINE = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..')

const lireDuDisque = (chemin) => {
  try { return readFileSync(path.join(RACINE, chemin), 'utf8') } catch { return null }
}

test('chaque doc RENDU par `GENERATORS` cite des sites qui portent leur symbole (±2 lignes)', async () => {
  const fautes = []
  let docs = 0
  for (const g of GENERATORS.filter((x) => x.targets.some(estUnDocMarkdown))) {
    for (const [cible, texte] of await renduDe(g)) {
      if (!estUnDocMarkdown(cible)) continue
      docs++
      fautes.push(...fautesDeCitations(cible, texte, lireDuDisque))
    }
  }
  assert.ok(docs > 20, `${docs} doc(s) rendu(s) : le balayage est aveugle`)
  assert.deepEqual(fautes, [])
})
