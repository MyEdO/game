// Banc de la garde `check-renvois` (node --test, joué par `npm run test:raw`). Le stock COMMITTÉ est
// exactement le rendu des renvois non résolus mesurés sur l'arbre, dans les deux sens ; la clé ne
// porte aucune ligne ; un renvoi non résolu NEUF est rouge, et la régénération le REFUSE sans lot.
// Aucun livre n'est nommé ici : le corpus se prend au REGISTRE (`livresCouverts`).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  FAMILLES, STOCK_PATH, ecartDuStock, entreesDe, livresCouverts, livreIndexe, refDeRenvoi, scanAll, sitesDuLivre, stockDe,
} from './check-renvois.mjs'
import { readStock } from './stockNominatif.mjs'
import { champsAveugles, cleDeSite, ecrireStockSousLot } from '../guards/lib/stock.mjs'

/** PLAFOND du stock — il vit ICI, jamais dans la garde ni dans la lib (`guards/lib/stock.mjs`) :
 *  servi depuis la lib, il se relèverait dans le même geste que l'append qu'il doit rendre visible. */
const PLAFOND = 23

test('COUVERTURE : au moins un livre couvert, et chacun a sa langue dans la table de motifs', () => {
  const livres = livresCouverts()
  assert.ok(livres.length > 0, 'aucun livre couvert : la garde serait muette')
  for (const l of livres) assert.ok(l.dir, `${l.id} sans dossier`)
})

test('SITES : famille = niveau non résolu, fichier POSIX sous Source/, réf `slug#occ :: p.N :: rang R`', () => {
  const sites = scanAll()
  assert.ok(sites.length > 0)
  for (const s of sites) {
    assert.ok(FAMILLES.includes(s.famille), s.famille)
    assert.match(s.file, /^Source\/[^\\]+\/[^\\]+\.md$/)
    assert.match(s.ref, /^[a-z0-9-]*#\d+ :: p\.\d+ :: rang \d+$/)
  }
})

test('la RÉF ne porte aucune ligne : le rang compte les renvois de la SECTION vers le même folio', () => {
  const r = { slug: 'fear-rating', occ: 1, rang: 2, renvoi: { folio: 183 } }
  assert.equal(refDeRenvoi(r), 'fear-rating#1 :: p.183 :: rang 2')
})

test('stock COMMITTÉ : chaque renvoi non résolu y a son entrée, et aucune entrée n’est soldée', () => {
  const { neuves, perimees } = ecartDuStock(scanAll(), readStock(STOCK_PATH))
  assert.deepEqual(neuves, [], `renvoi(s) hors du stock :\n${neuves.join('\n')}`)
  assert.deepEqual(perimees, [], `entrée(s) SOLDÉE(s) à retirer :\n${perimees.join('\n')}`)
})

test('stock COMMITTÉ : le rendu EXACT et ORDONNÉ des sites mesurés sur l’arbre', () => {
  const attendu = entreesDe(scanAll(), { lot: '', date: '' })
  assert.deepEqual(readStock(STOCK_PATH).map(cleDeSite), attendu.map(cleDeSite))
})

test('le stock est PLAFONNÉ : il ne décroît que quand un renvoi se résout', () => {
  assert.ok(readStock(STOCK_PATH).length <= PLAFOND, `stock ${readStock(STOCK_PATH).length} > plafond ${PLAFOND}`)
})

test('la CLÉ observe tout ce qui localise une entrée — aucun champ aveugle', () => {
  assert.deepEqual(champsAveugles(readStock(STOCK_PATH), cleDeSite, ['famille', 'fichier', 'ref', 'occurrence']), [])
})

test('REFUS DE CROISSANCE : un renvoi non résolu NEUF est rouge, et la régénération sans lot n’écrit rien', () => {
  const [livre] = livresCouverts()
  const sites = sitesDuLivre(livre.dir, livreIndexe(livre))
  const neuf = { famille: 'ambigu', file: `${livre.dir}/999 - Fixture.md`, ref: 'fixture#1 :: p.1 :: rang 1' }
  const stock = readStock(STOCK_PATH)
  const { neuves } = ecartDuStock([...sites, neuf], stock)
  assert.equal(neuves.length, 1)
  assert.match(neuves[0], /999 - Fixture\.md :: fixture#1 :: p\.1 :: rang 1 :: 1 — site NEUF/)

  let ecrit = null
  const rendre = (lot, date) => ({
    entrees: entreesDe([...sites, neuf], { lot, date, ancien: stock }),
    texte: stockDe([...sites, neuf], { lot, date, ancien: stock }),
  })
  const refus = ecrireStockSousLot(['--ecrire-stock'], rendre, (t) => { ecrit = t }, 'renvois-stock.json')
  assert.equal(refus.code, 1)
  assert.match(refus.message, /1 entrée\(s\) NEUVE\(s\).*fixture#1/)
  assert.equal(ecrit, null, 'rien n’est écrit sans lot')

  const accepte = ecrireStockSousLot(['--ecrire-stock', '--lot', '#0 banc'], rendre, (t) => { ecrit = t }, 'renvois-stock.json')
  assert.equal(accepte.code, 0)
  assert.match(ecrit, /"lot": "#0 banc"/)
})
