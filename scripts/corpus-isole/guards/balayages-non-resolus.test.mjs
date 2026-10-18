// CLIQUET des balayages NON RÉSOLUS (#2400) : toute valeur de site de lecture ou de listage que la dérivation du
// périmètre de tests ne rattache à aucune racine est une lecture qui échappe à la dérivation. Elle se rend
// résoluble, ou elle est au stock (`scripts/guards/balayages-non-resolus-stock.json`), qui ne fait que DÉCROÎTRE :
// l'écart nominatif dans les deux sens (`ecartDuVolet`), le stock point fixe de sa régénération.
//   node --test scripts/corpus-isole/guards/balayages-non-resolus.test.mjs   (gate `test:corpus-isole`)
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { cleDeSite, ecartDuVolet, remedeNomme } from '../../guards/lib/stock.mjs'
import { ecartDeRegeneration, lireEntreesDeSite, texteEnPlace } from '../../guards/lib/stockDeSites.mjs'
import { STOCK, mesure, regenerations } from '../../guards/lib/balayagesNonResolus.mjs'

const dossierDesMemos = mkdtempSync(join(tmpdir(), 'balayages-memos-'))

let sites

try { ({ sites } = await mesure(undefined, { dossierDesMemos })) }
finally { rmSync(dossierDesMemos, { recursive: true, force: true }) }

const stock = lireEntreesDeSite(join(fileURLToPath(new URL('../../..', import.meta.url)), STOCK))

test('aucun balayage NON RÉSOLU neuf hors du stock — le rendre résoluble, jamais le stocker', () => {
  const { neuves } = ecartDuVolet({ sites, stock, ou: STOCK })
  assert.deepEqual(neuves, [], `balayage(s) NEUF(S) que la dérivation ne rattache à aucune racine :\n${neuves.join('\n')}`)
})

test('le stock ne peut que DÉCROÎTRE — toute entrée devenue résoluble en sort', () => {
  const { perimees } = ecartDuVolet({ sites, stock, ou: STOCK })
  assert.deepEqual(perimees, [], `entrée(s) soldée(s) — régénérer : npx tsx scripts/guards/lib/regenStock.mts scripts/guards/lib/balayagesNonResolus.mjs\n${perimees.join('\n')}`)
})

test('le stock committé est le point fixe de sa régénération', async () => {
  for (const r of await regenerations(sites)) assert.equal(ecartDeRegeneration(r, texteEnPlace(r.chemin)), null)
})

test('une SUBSTITUTION à compte constant rougit des deux côtés', () => {
  const substitue = [...stock.slice(1), { famille: 'autre', fichier: 'scripts/inexistant.mjs', ref: 'readFileSync : forme Bidon', occurrence: 1 }]
  const ecart = ecartDuVolet({ sites, stock: substitue, ou: STOCK })
  assert.ok(remedeNomme(ecart.neuves, cleDeSite(stock[0])), 'le site retiré du stock doit ressortir NEUF')
  assert.ok(remedeNomme(ecart.perimees, cleDeSite(substitue[substitue.length - 1])), "l'entrée bidon doit ressortir SOLDÉE")
})
