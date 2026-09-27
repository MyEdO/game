// Contrat du corpus des projets livrés (`projetsLivres.mjs`) : il se LIT sur le dépôt, et un dossier
// absent LÈVE — un corpus vide rendrait verts, en silence, tous les tests qui le parcourent.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { listerProjetsLivres, PROJETS_LIVRES } from './projetsLivres.mjs'

test('le corpus du dépôt : des chemins relatifs au dossier, au suffixe du descripteur', () => {
  const projets = listerProjetsLivres()
  assert.ok(projets.length > 0, 'aucun projet livré lu sur le dépôt')
  for (const rel of projets) assert.ok(rel.endsWith(PROJETS_LIVRES.suffixe), rel)
})

test('une racine SANS le dossier du corpus LÈVE, jamais un corpus vide', () => {
  const racine = fileURLToPath(new URL('./racine-sans-corpus-absente/', import.meta.url))
  assert.equal(existsSync(racine), false, 'la racine du contrat doit être ABSENTE')
  assert.throws(() => listerProjetsLivres(racine))
})
