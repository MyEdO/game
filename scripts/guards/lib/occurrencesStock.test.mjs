// Les commentaires de compte des stocks nominatifs (#2705).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { listerDossier } from './lister.mjs'
import { histoiresDeCompte } from './occurrencesStock.mjs'

const RACINE = fileURLToPath(new URL('../../..', import.meta.url))
const DOSSIER = 'scripts/guards/lib'

test('HISTOIRE DE COMPTE : aucun tableau exporté d’un `*Stock.mjs` ne raconte un compte en commentaire', async () => {
  const histoires = []
  for (const f of listerDossier(join(RACINE, DOSSIER)).filter((x) => x.endsWith('Stock.mjs'))) {
    const fichier = `${DOSSIER}/${f}`
    const module = await import(pathToFileURL(join(RACINE, fichier)).href)
    const texte = readFileSync(join(RACINE, fichier), 'utf8')
    for (const nom of Object.keys(module).filter((n) => Array.isArray(module[n])))
      histoires.push(...histoiresDeCompte(texte, nom, fichier).map(({ ligne, commentaire }) => `${fichier}:${ligne} ${commentaire}`))
  }
  assert.deepEqual(histoires, [], 'le compte vit dans l’entrée, son histoire dans git : retirer le commentaire.')
})

test('HISTOIRE DE COMPTE : fin de ligne et bloc sont vus, dans la collection seulement, jamais dans une chaîne', () => {
  const texte = [
    '// 1 → 2 hors de la collection',
    'export const C = [',
    '  { dataset: "a.json", champ: "x", occurrences: 34 }, // 33 → 34',
    '  // 7->8 : un bloc',
    '  { dataset: "a.json", champ: "y", occurrences: 8, motif: "9 → 10" },',
    '  { dataset: "a.json", champ: "z", occurrences: 1 }, // #1902',
    '  { dataset: "a.json", champ: "w", occurrences: 2 }, // +1 : un delta',
    '  // +1 (#862) : un delta en bloc',
    '];',
    'export const D = [{ occurrences: 1 }, // 3 → 4',
    '];',
  ].join('\n')
  assert.deepEqual(histoiresDeCompte(texte, 'C', 'x.mjs'), [
    { ligne: 3, commentaire: '// 33 → 34' },
    { ligne: 4, commentaire: '// 7->8 : un bloc' },
    { ligne: 7, commentaire: '// +1 : un delta' },
    { ligne: 8, commentaire: '// +1 (#862) : un delta en bloc' },
  ])
  assert.deepEqual(histoiresDeCompte(texte, 'D', 'x.mjs').map((h) => h.ligne), [10])
})
