// La porte d'une ÈRE (`porteDEre.mjs`, #2503) : le chargement par l'arbre du tronc. Les jugements de
// plage qui en dépendent vivent dans `plageStock.test.mjs` et `stocksNominatifs.test.mjs`.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { depotDe } from './gitPorte.mjs'
import { instanceDeDepot } from './depotGabarit.mjs'
import * as porteActuelle from './plageStock.mjs'
import { PORTE_DE_PLAGE } from './plageStock.mjs'
import { RACINE } from './bindingsVivants.mjs'
import * as stocksActuels from './stocksNominatifs.mjs'
import { fermetureSurDisque, groupesParEre, jugeDeLEre } from './porteDEre.mjs'
import { lancesDeGit, sousCommande } from '../../test/gitDeBanc.mjs'

test('fermeture disque : hits des spécificateurs conservent textes et refont les priorités de résolution', () => {
  const { racine } = instanceDeDepot({ fichiers: {
    'a.mjs': "export { x } from './x.mjs'", 'x.mts': 'export const x=1',
  } })
  try {
    const cache = new Map()
    let ecritures = 0
    const specificateurs = {
      lire: (abs, texte) => cache.get(`${abs}:${texte}`),
      ecrire: (abs, texte, sites) => { ecritures++; cache.set(`${abs}:${texte}`, sites) },
    }
    const froid = fermetureSurDisque('a.mjs', racine, { specificateurs })
    const avant = ecritures
    assert.deepEqual(fermetureSurDisque('a.mjs', racine, { specificateurs }), froid)
    assert.equal(ecritures, avant)
    assert.ok(froid.some(([f, texte]) => f === 'x.mts' && texte === 'export const x=1'))
    writeFileSync(join(racine, 'x.mjs'), 'export const x=2')
    const neuf = fermetureSurDisque('a.mjs', racine, { specificateurs })
    assert.ok(neuf.some(([f, texte]) => f === 'x.mjs' && texte === 'export const x=2'))
    assert.equal(neuf.some(([f]) => f === 'x.mts'), false)
  } finally { rmSync(racine, { recursive: true, force: true }) }
})

test('#2586 porteDEre : inventaire et lectures groupées par frontière, absents sans lecture', async (t) => {
  const module = 'scripts/porte.mjs'
  const fichiers = {
    [module]: "import { A } from './a.mjs'; import { B } from './b.mjs'; export const juge = () => A + B",
    'scripts/a.mjs': 'export const A = 1',
    'scripts/b.mjs': 'export const B = 2',
  }
  const { racine, sha } = instanceDeDepot({ fichiers })
  try {
    const porte = { racine, module, exports: ['juge'], vie: () => true }
    const mesure = lancesDeGit(() => jugeDeLEre(depotDe(racine), sha, porte))
    const vu = await mesure.valeur
    assert.deepEqual([vu.note, vu.source, vu.juge.juge()], [null, 'disque', 3])
    assert.equal(mesure.lances.filter((a) => sousCommande(a) === 'ls-tree').length, 1)
    assert.equal(mesure.lances.filter((a) => sousCommande(a) === 'cat-file').length, 2)
    t.diagnostic(JSON.stringify({ processus: mesure.lances.length, commandes: mesure.lances.map(sousCommande) }))
    const absent = lancesDeGit(() => jugeDeLEre(depotDe(racine), sha, { ...porte, module: 'scripts/absent.mjs', vie: () => true }))
    assert.equal((await absent.valeur).juge, null)
    assert.equal(absent.lances.filter((a) => sousCommande(a) === 'cat-file').length, 0)
  } finally { rmSync(racine, { recursive: true, force: true }) }
})

test('#2503 fermeture IDENTIQUE à celle du disque : le module qui tourne, sans hooks, mémoïsé par ère', async () => {
  const { racine, sha } = instanceDeDepot({ fichiers: Object.fromEntries(fermetureSurDisque('scripts/guards/lib/plageStock.mjs')), message: 'socle' })
  try {
    const premier = jugeDeLEre(depotDe(racine), sha, PORTE_DE_PLAGE)
    assert.equal(jugeDeLEre(depotDe(racine), sha, PORTE_DE_PLAGE), premier, 'une ère se charge une fois par processus')
    const { juge, note, source } = await premier
    assert.deepEqual([note, source], [null, 'disque'])
    assert.equal(juge, porteActuelle, 'le module déjà chargé')
  } finally {
    rmSync(racine, { recursive: true, force: true })
  }
})

/** Une ère du tronc dont la fermeture de la porte diffère du disque : son chargement passe par les hooks. */
const ERE_ANCIENNE = 'bf79a00ad07d45d1f15509461db7079fa81e4b30'

/** Une suite qui forge un dépôt : ses fixtures ne sont pas des entrées (`estAppelDeclare` → `moduleDe` →
 *  `RACINE` de `bindingsVivants.mjs`, dérivée de `import.meta.url`). */
const SUITE_QUI_FORGE = {
  chemin: 'src/sonde/forge.test.ts',
  source: [
    "import { it } from 'vitest'",
    "import { instanceDeDepot } from '../../scripts/guards/lib/depotGabarit.mjs'",
    "export const FORGE = instanceDeDepot({ fichiers: { 'src/a.ts': 'x', 'src/b.ts': 'y' } })",
    "export const STOCK = ['src/c.ts']",
    '',
  ].join('\n'),
}

test('#2503 ère chargée par HOOKS : servie sous les URL du dépôt, ses racines dérivées de `import.meta.url` restent celles du dépôt', async () => {
  let charger
  const vu = await jugeDeLEre(depotDe(RACINE), ERE_ANCIENNE, { ...PORTE_DE_PLAGE, vie: (p) => { charger = p.charger; return true } })
  assert.deepEqual([vu.note, vu.source], [null, 'arbre'])
  const paquet = new URL('../../../package.json', import.meta.url)
  assert.equal(fileURLToPath(`${paquet.href}?ere=${ERE_ANCIENNE}`), fileURLToPath(paquet), '`fileURLToPath` ignore la requête')
  const stocksDeLEre = await charger('scripts/guards/lib/stocksNominatifs.mjs')
  const bindingsDeLEre = await charger('scripts/guards/lib/bindingsVivants.mjs')
  assert.notEqual(stocksDeLEre, stocksActuels, 'une autre instance du module')
  assert.equal(bindingsDeLEre.RACINE, RACINE)
  const cles = (lib) => lib.entreesNominatives(SUITE_QUI_FORGE.source, SUITE_QUI_FORGE.chemin).map((e) => e.cle)
  assert.deepEqual(cles(stocksDeLEre), cles(stocksActuels))
  assert.deepEqual(cles(stocksDeLEre), ['src/c.ts'])
  await assert.rejects(charger('scripts/guards/lib/absent-de-l-ere.mjs'), new RegExp(`absent-de-l-ere\\.mjs\` absent de l'arbre de l'ère ${ERE_ANCIENNE.slice(0, 9)}`))
})

test('#2503 un membre `.ts` de l’ère, ABSENT du disque, est servi par l’ère et dépouillé de ses types', async () => {
  const { racine, sha } = instanceDeDepot({
    fichiers: {
      [PORTE_DE_PLAGE.module]: [
        "import { DEUX } from './seulementDansLEre.ts'",
        'export const refusDeLaPlage = () => []',
        'export const reclassementsDeLaPlage = () => []',
        'export const VU = DEUX',
        '',
      ].join('\n'),
      'scripts/guards/lib/seulementDansLEre.ts': 'export const DEUX: number = 2\n',
    },
    message: 'socle',
  })
  try {
    const { juge, note, source } = await jugeDeLEre(depotDe(racine), sha, { ...PORTE_DE_PLAGE, vie: () => true })
    assert.deepEqual([note, source, juge?.VU], [null, 'arbre', 2])
  } finally {
    rmSync(racine, { recursive: true, force: true })
  }
})

test('#2503 porte DÉPLACÉE : l’ère sans la porte au chemin de `module` rend un juge nul et sa note — le groupe est jugé par la porte actuelle, jamais laissé sans porte', async () => {
  const { racine, sha } = instanceDeDepot({ fichiers: Object.fromEntries(fermetureSurDisque(PORTE_DE_PLAGE.module)), message: 'socle' })
  try {
    const module = ['scripts', 'guards', 'lib', 'plage', 'stock.mjs'].join('/')
    const vu = await groupesParEre(depotDe(racine), [{ sha }], sha, { ...PORTE_DE_PLAGE, module })
    assert.deepEqual(vu, [{ ere: sha, commits: [{ sha }], juge: null, note: `${sha.slice(0, 9)} sans la porte \`${module}\` : jugé(s) par la porte actuelle` }])
  } finally {
    rmSync(racine, { recursive: true, force: true })
  }
})
