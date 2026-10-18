// COLLECTIONS À COMPTE (#2705) : leur déclaration couvre tout stock qui porte un compte, et aucun stock n'écrit
// l'histoire de ses comptes en commentaire.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { listerDossier } from './lister.mjs'
import { COLLECTIONS_A_COMPTE, collectionsACompteDe, estDetteDOp, histoiresDeCompte } from './occurrencesStock.mjs'

const RACINE = fileURLToPath(new URL('../../..', import.meta.url))
const DOSSIER = 'scripts/guards/lib'

test('COUVERTURE : tout tableau exporté d’un `*Stock.mjs` dont les entrées portent un compte est une collection à compte déclarée', async () => {
  const modules = await Promise.all(listerDossier(join(RACINE, DOSSIER)).filter((f) => f.endsWith('Stock.mjs')).map(async (f) => ({
    fichier: `${DOSSIER}/${f}`,
    module: await import(pathToFileURL(join(RACINE, DOSSIER, f)).href),
  })))
  assert.deepEqual(
    collectionsACompteDe(modules).sort(),
    COLLECTIONS_A_COMPTE.map((c) => `${c.fichier} : ${c.nom}`).sort(),
    'une collection qui porte un compte hors de `COLLECTIONS_A_COMPTE` échappe à la porte `comptes:plage` et au refus de `--write`.',
  )
})

test('COUVERTURE : l’ordinal `occurrence` n’est pas un compte, tout autre champ numérique l’est', () => {
  assert.deepEqual(collectionsACompteDe([{ fichier: 'x.mjs', module: {
    ORDINAL: [{ fichier: 'a', ref: 'r', occurrence: 2 }],
    COMPTE: [{ dataset: 'a.json', champ: 'b', occurrences: 3 }],
    TEXTE: [{ dataset: 'a.json' }],
    OBJET: { occurrences: 1 },
  } }]), ['x.mjs : COMPTE'])
})

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

test('DETTE D’OP (L1c #1468) : une op typée sans référence à plat n’en est pas ; non typée, inconnue, ou dont une clé est une feuille `idDe` du payload (`aPlat`), si', () => {
  const typage = {
    types: ['reduceDiseaseDays', 'contractDisease', 'freeReroll', 'grantWeapon'],
    nonTypees: ['freeReroll'],
    aPlat: { reduceDiseaseDays: ['disease'], contractDisease: ['disease'], grantWeapon: ['form'] },
  }
  assert.equal(estDetteDOp({ op: 'reduceDiseaseDays', signature: 'days,oncePerDisease,op' }, typage), false, 'typée, sans clé à plat dans la signature')
  assert.equal(estDetteDOp({ op: 'freeReroll', signature: 'op' }, typage), true, 'payload non typé (`OPS_NON_TYPEES`)')
  assert.equal(estDetteDOp({ op: 'inconnue', signature: 'op' }, typage), true, 'op que `OP_DEFS` ne connaît pas')
  assert.equal(estDetteDOp({ op: 'contractDisease', signature: 'disease,op' }, typage), true, 'typée, `disease` feuille `idDe` à plat : le NOM de la clé n’y est pour rien')
  assert.equal(estDetteDOp({ op: 'grantWeapon', signature: 'damage,label,op,qualities' }, typage), false, 'typée, aucune clé de la signature n’est une feuille `idDe` à plat')
  assert.equal(estDetteDOp({ op: 'grantWeapon', signature: 'damage,form,label,op' }, typage), true, 'typée, `form` feuille `idDe` à plat')
})
