import test from 'node:test'
import assert from 'node:assert/strict'
import { fautesDeCitations } from '../test/lib/bancGenerateurs.mjs'

test('fautesDeCitations : le symbole à ±2 lignes du site passe ; au-delà, ou site hors fichier, faute nommée', () => {
  const source = ['a', 'b', 'function cible() {', 'c', 'd', 'e', 'f'].join('\n')
  const [doc, x, y] = ['d.md', 'src/x.ts', 'src/y.ts']
  // Un site `fichier:ligne` se COMPOSE : la garde `refsDeLigne` refuse sa forme littérale.
  const site = (fichier, ligne) => [fichier, ligne].join(':')
  const lire = (c) => (c === x ? source : null)
  assert.deepEqual(fautesDeCitations(doc, `\`cible\` vit en \`${site(x, 1)}\``, lire), [])
  assert.deepEqual(fautesDeCitations(doc, `\`cible\` vit en \`${site(x, 5)}\``, lire), [])
  assert.deepEqual(fautesDeCitations(doc, `\`cible\` vit en \`${site(x, 6)}\``, lire), [`${site(doc, 1)} — \`${site(x, 6)}\` ne porte aucun de \`cible\` à ±2 lignes`])
  assert.deepEqual(fautesDeCitations(doc, `site \`${site(x, 9)}\``, lire), [`${site(doc, 1)} — cite \`${site(x, 9)}\`, hors des 7 lignes du fichier`])
  assert.deepEqual(fautesDeCitations(doc, `site \`${site(y, 1)}\``, lire), [`${site(doc, 1)} — cite \`${site(y, 1)}\`, absent du disque`])
})
