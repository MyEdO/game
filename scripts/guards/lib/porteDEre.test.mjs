// La porte d'une ÈRE (`porteDEre.mjs`, #2503) : le chargement par l'arbre du tronc. Les jugements de
// plage qui en dépendent vivent dans `plageStock.test.mjs` et `stocksNominatifs.test.mjs`.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { rmSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { depotDe } from './gitPorte.mjs'
import { instanceDeDepot } from './depotGabarit.mjs'
import * as porteActuelle from './plageStock.mjs'
import { PORTE_DE_PLAGE } from './plageStock.mjs'
import { RACINE } from './bindingsVivants.mjs'
import * as stocksActuels from './stocksNominatifs.mjs'
import { fermetureSurDisque, jugeDeLEre } from './porteDEre.mjs'

test('#2503 fermeture IDENTIQUE à celle du disque : le module qui tourne, sans hooks, mémoïsé par ère', async () => {
  const { racine, sha } = instanceDeDepot({ fichiers: Object.fromEntries(fermetureSurDisque('scripts/guards/lib/plageStock.mjs')), message: 'socle' })
  try {
    const premier = jugeDeLEre(depotDe(racine), sha, PORTE_DE_PLAGE)
    assert.equal(jugeDeLEre(depotDe(racine), sha, PORTE_DE_PLAGE), premier, 'une ère se charge une fois par processus')
    const { juge, note, anterieure, source } = await premier
    assert.deepEqual([note, anterieure, source], [null, false, 'disque'])
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
