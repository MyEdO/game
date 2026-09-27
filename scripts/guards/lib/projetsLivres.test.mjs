// Contrat du corpus des projets livrés (`projetsLivres.mjs`) : il se LIT sur le dépôt, et un dossier
// absent LÈVE — un corpus vide rendrait verts, en silence, tous les tests qui le parcourent.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { listerProjetsLivres, PROJETS_LIVRES } from './projetsLivres.mjs'

test('le corpus du dépôt : des chemins relatifs au dossier, au suffixe du descripteur', () => {
  const projets = listerProjetsLivres()
  assert.ok(projets.length > 0, 'aucun projet livré lu sur le dépôt')
  for (const rel of projets) assert.ok(rel.endsWith(PROJETS_LIVRES.suffixe), rel)
})

test('une racine SANS le dossier du corpus LÈVE, jamais un corpus vide', () => {
  const racine = mkdtempSync(join(tmpdir(), 'projets-livres-'))
  try {
    assert.throws(() => listerProjetsLivres(racine))
  } finally {
    rmSync(racine, { recursive: true, force: true })
  }
})
