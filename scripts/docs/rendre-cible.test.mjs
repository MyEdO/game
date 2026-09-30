// `rendreCible` (scripts/docs/build-all.mjs) charge un générateur comme son `runner` le lance (#2203) :
// une cible d'un générateur `runner: 'tsx'` se rend sous `node --test` nu.
// `cibleProduite` juge une cible par les clés de ce rendu.
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { syncBuiltinESMExports } from 'node:module'
import { cibleProduite, GENERATORS, rendreCible } from './build-all.mjs'

const CATALOGUE = /(^|[\\/])catalogue-[^\\/]*\.md$/

/** Joue `fn` avec les catalogues de l'Atlas ABSENTS du disque : une lecture ou un `stat` lève ENOENT,
 *  et `listerArbre` (`scripts/guards/lib/lister.mjs`), qui type chaque entrée par `lstatSync`, les
 *  saute. */
async function sansCataloguesAuDisque(fn) {
  const origines = { readFileSync: fs.readFileSync, existsSync: fs.existsSync, statSync: fs.statSync, lstatSync: fs.lstatSync }
  const absent = (chemin) => typeof chemin === 'string' && CATALOGUE.test(chemin)
  const enoent = (chemin) => Object.assign(new Error(`ENOENT: ${chemin}`), { code: 'ENOENT' })
  fs.existsSync = (c) => !absent(c) && origines.existsSync(c)
  for (const nom of ['readFileSync', 'statSync', 'lstatSync'])
    fs[nom] = (c, ...reste) => { if (absent(c)) throw enoent(c); return origines[nom](c, ...reste) }
  syncBuiltinESMExports()
  try {
    return await fn()
  } finally {
    Object.assign(fs, origines)
    syncBuiltinESMExports()
  }
}

const docTsx = GENERATORS.filter((g) => g.runner === 'tsx').flatMap((g) => g.targets).find((t) => /^docs\/[^/]+\.md$/.test(t))

test('rendreCible : la cible d’un générateur `tsx` est rendue', async () => {
  assert.ok(docTsx, 'GENERATORS ne porte aucun doc d’un générateur `tsx` — la garde serait verte à vide')
  const texte = await rendreCible(docTsx)
  assert.equal(typeof texte, 'string')
  assert.ok(texte.length > 0, `${docTsx} rendu vide`)
})

test('cibleProduite : un catalogue est vivant MÊME ABSENT du disque — son cœur est déclaré, jamais lu au chemin', async () => {
  assert.equal(await sansCataloguesAuDisque(() => cibleProduite('docs/raw/4e/catalogue-sorts.md')), true)
})

test('cibleProduite : une cible existe par le RENDU de son générateur, jamais par le seul motif de ses `targets`', async () => {
  assert.equal(await cibleProduite('docs/raw/4e/catalogue-sorts.md'), true)
  assert.equal(await cibleProduite('docs/raw/4e/catalogue-nexiste-pas.md'), false, 'le motif `catalogue-*.md` atteint ce chemin, son générateur ne le rend pas')
  assert.equal(await cibleProduite('docs/raw/9e/sous/catalogue-typo.md'), false)
})
