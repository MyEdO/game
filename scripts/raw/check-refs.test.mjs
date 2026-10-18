// Test du garde `check-refs` (node --test) : une réf plantée hors borne du chapitre résolu est
// détectée, une réf valide reste silencieuse. Lancé par `npm run test:raw`.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { regenerations, scanDeadRefs, sitesMorts, STOCK_PATH } from './check-refs.mjs'
import { avecAtlasFixture, coeurDeBanc } from './atlasFixture.mjs'
import { RAWDOC_META_GENERATED } from './_lib.mjs'
import { cleDeSite, ecartDuVolet } from '../guards/lib/stock.mjs'
import { ecartDeRegeneration, lireEntreesDeSite, texteEnPlace } from '../guards/lib/stockDeSites.mjs'

// LDB 06 (Source/Warhammer v4 - Livre de base version corrigee/06 - Classes.md) fait 6 lignes
// (split('\n').length) — chapitre réel, court, stable : sert d'ancrage pour planter une réf hors
// borne sans toucher au vrai docs/raw/. La fiche vit SOUS un cœur : l'Atlas est partitionné.
const withTempRawDir = (content, fn) => avecAtlasFixture({ 'fixture.md': content }, fn, { prefixe: 'check-refs-' })

// Chemins RELATIFS à l'Atlas, cœur pris au registre — un site de cliquet PORTE son cœur.
const FICHE = `${coeurDeBanc()}/combat.md`
const AUTRE_FICHE = `${coeurDeBanc()}/magie.md`
const NOM_GENEREE = [...RAWDOC_META_GENERATED][0]

test('réf morte (ligne hors borne du chapitre résolu) → détectée', () => {
  withTempRawDir('Une citation LDB 6 l.999 hors borne.\n', (dir) => {
    const dead = scanDeadRefs(dir)
    assert.equal(dead.length, 1)
    assert.equal(dead[0].ref, 'LDB 6')
    assert.equal(dead[0].hi, 999)
    assert.ok(dead[0].chapterLines < 999)
  })
})

test('réf valide (ligne dans les bornes du chapitre résolu) → silence', () => {
  withTempRawDir('Une citation LDB 6 l.2 dans les bornes.\n', (dir) => {
    const dead = scanDeadRefs(dir)
    assert.equal(dead.length, 0)
  })
})

test('livre/chapitre introuvable → hors sujet, jamais compté (Sens A de reconcile.mjs)', () => {
  withTempRawDir('Une citation LDB 9999 l.5 vers un chapitre qui n\'existe pas.\n', (dir) => {
    const dead = scanDeadRefs(dir)
    assert.equal(dead.length, 0)
  })
})

test('plage l.X-Y : la borne HAUTE est vérifiée', () => {
  withTempRawDir('Plage LDB 6 l.1-999 qui déborde.\n', (dir) => {
    const dead = scanDeadRefs(dir)
    assert.equal(dead.length, 1)
    assert.equal(dead[0].hi, 999)
  })
})

test('réf « autre livre » en PLAGE (AA 1 l.5-9999) : la borne HAUTE de la plage est vérifiée, pas juste la borne basse (#583 jumeau)', () => {
  withTempRawDir('Plage AA 1 l.5-9999 qui déborde par le HAUT.\n', (dir) => {
    const dead = scanDeadRefs(dir)
    assert.equal(dead.length, 1)
    assert.equal(dead[0].ref, 'AA 1')
    assert.equal(dead[0].hi, 9999)
  })
})

test('rapport GÉNÉRÉ de la racine de l’Atlas → jamais scanné (acceptation déclarée)', () => {
  avecAtlasFixture({
    'fixture.md': 'placeholder\n',
    [`/${NOM_GENEREE}`]: 'LDB 6 l.999 hors borne, mais dans un rapport généré.\n',
  }, (dir) => {
    assert.equal(scanDeadRefs(dir).length, 0)
  }, { prefixe: 'check-refs-' })
})

test('sitesMorts : un site NOMME sa fiche et la réf citée, borne HAUTE comprise — jamais sa ligne', () => {
  const sites = sitesMorts([{ doc: FICHE, row: 12, ref: 'LDB 6', hi: 999 }])
  assert.deepEqual(sites, [{ file: `docs/raw/${FICHE}`, ref: 'LDB 6 l.999' }])
  assert.equal(/:\d+$/.test(sites[0].file), false, 'la fiche se nomme sans numéro de ligne')
  assert.ok(sites[0].file.split('/').length > 3, 'le site PORTE le cœur de sa fiche')
})

test('écart : un site hors du stock est NEUF, une entrée sans site est SOLDÉE', () => {
  const { neuves, perimees } = ecartDuVolet({
    sites: sitesMorts([{ doc: FICHE, ref: 'LDB 6', hi: 999 }]),
    stock: [{ fichier: `docs/raw/${AUTRE_FICHE}`, ref: 'AA 1 l.42', occurrence: 1 }],
    ou: 'dead-refs-stock.json',
  })
  assert.equal(neuves.length, 1)
  assert.ok(neuves[0].startsWith(cleDeSite({ fichier: `docs/raw/${FICHE}`, ref: 'LDB 6 l.999', occurrence: 1 })), neuves[0])
  assert.match(neuves[0], /site NEUF/)
  assert.match(neuves[0], /CLIQUET:/)
  assert.equal(perimees.length, 1)
  assert.match(perimees[0], new RegExp(AUTRE_FICHE.replace('.', '\\.')))
  assert.match(perimees[0], /entrée SOLDÉE/)
})

test('stock ABSENT → tolérance ZÉRO : tout site mort est neuf, et l’Atlas réel n’en porte aucun', () => {
  const dead = scanDeadRefs()
  for (const r of regenerations(dead)) assert.equal(ecartDeRegeneration(r, texteEnPlace(r.chemin)), null)
  const { neuves, perimees } = ecartDuVolet({
    sites: sitesMorts(dead), stock: lireEntreesDeSite(STOCK_PATH), ou: 'dead-refs-stock.json',
  })
  assert.deepEqual(neuves, [], `site(s) de réf morte dans docs/raw :\n${neuves.join('\n')}`)
  assert.deepEqual(perimees, [], `entrée(s) SOLDÉE(s) :\n${perimees.join('\n')}`)
})
