// Banc de la garde `check-renvois` (node --test, joué par `npm run test:raw`). Le stock COMMITTÉ est
// le point fixe de sa régénération sur les renvois non résolus mesurés sur l'arbre, dans les deux sens ; la clé ne
// porte aucune ligne ; un renvoi non résolu NEUF est rouge, et la régénération le REFUSE sans lot.
// Aucun livre n'est nommé ici : le corpus se prend au REGISTRE (`livresCouverts`).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  FAMILLES, STOCK_PATH, livresCouverts, livreIndexe, refDeRenvoi, regenerations, scanAll, sitesDuLivre,
} from './check-renvois.mjs'
import { ecartDeRegeneration, lireEntreesDeSite, texteEnPlace, texteRegenere } from '../guards/lib/stockDeSites.mjs'
import { CHAMPS_DE_CLE, champsAveugles, cleDeSite, ecartDuVolet } from '../guards/lib/stock.mjs'

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
  const { neuves, perimees } = ecartDuVolet({ sites: scanAll(), stock: lireEntreesDeSite(STOCK_PATH), ou: 'renvois-stock.json' })
  assert.deepEqual(neuves, [], `renvoi(s) hors du stock :\n${neuves.join('\n')}`)
  assert.deepEqual(perimees, [], `entrée(s) SOLDÉE(s) à retirer :\n${perimees.join('\n')}`)
})

test('stock COMMITTÉ : le rendu EXACT et ORDONNÉ des sites mesurés sur l’arbre', () => {
  for (const r of regenerations(scanAll())) assert.equal(ecartDeRegeneration(r, texteEnPlace(r.chemin)), null)
})

test('le stock est PLAFONNÉ : il ne décroît que quand un renvoi se résout', () => {
  const taille = lireEntreesDeSite(STOCK_PATH).length
  assert.ok(taille <= PLAFOND, `stock ${taille} > plafond ${PLAFOND}`)
})

test('la CLÉ observe tout ce qui localise une entrée — aucun champ aveugle', () => {
  assert.deepEqual(champsAveugles(lireEntreesDeSite(STOCK_PATH), cleDeSite, CHAMPS_DE_CLE), [])
})

test('REFUS DE CROISSANCE : un renvoi non résolu NEUF est rouge, et la régénération sans lot n’écrit rien', () => {
  const [livre] = livresCouverts()
  const sites = sitesDuLivre(livre.dir, livreIndexe(livre))
  const neuf = { famille: 'ambigu', file: `${livre.dir}/999 - Fixture.md`, ref: 'fixture#1 :: p.1 :: rang 1' }
  const { neuves } = ecartDuVolet({ sites: [...sites, neuf], stock: lireEntreesDeSite(STOCK_PATH), ou: 'renvois-stock.json' })
  assert.equal(neuves.length, 1)
  assert.ok(neuves[0].startsWith(cleDeSite({ famille: neuf.famille, fichier: neuf.file, ref: neuf.ref, occurrence: 1 })), neuves[0])
  assert.match(neuves[0], /site NEUF/)

  const [r] = regenerations([...sites, neuf])
  const enPlace = texteEnPlace(STOCK_PATH)
  const refus = texteRegenere(r, { enPlace, lot: null, date: '2026-09-27' })
  assert.match(refus.refus, /1 entrée\(s\) NEUVE\(S\).*fixture#1/s)
  assert.equal(refus.texte, undefined, 'rien n’est écrit sans lot')

  const accepte = texteRegenere(r, { enPlace, lot: '#0 banc', date: '2026-09-27' })
  assert.match(accepte.texte, /"lot": "#0 banc"/)
})
