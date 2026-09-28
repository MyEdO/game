// Test du garde `check-entity-in-chapter` (#600, node --test) : une entrée dont le NOM est absent
// du texte du chapitre cité est détectée (réf syntaxiquement conforme mais cible fausse — la classe
// « réf fausse blanchie par la normalisation »), une entrée dont le nom est présent reste silencieuse.
// Lancé par `npm run test:raw`.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  scanMissingEntities, scanAll, sitesEntites, STOCK_PATH, regenerations,
  normalizeLoose, stripArticles, entityNameFromHeader,
} from './check-entity-in-chapter.mjs'
import { cleDeSite, ecartDuVolet } from '../guards/lib/stock.mjs'
import { ecartDeRegeneration, lireEntreesDeSite, texteEnPlace } from '../guards/lib/stockDeSites.mjs'

// LDB 06 (Source/…/06 - Classes.md) : chapitre réel, court et stable, contient le mot « Classes ».
function withTempDoc(content, fn) {
  const dir = mkdtempSync(join(tmpdir(), 'check-entity-in-chapter-'))
  const path = join(dir, 'fixture.md')
  writeFileSync(path, content, 'utf8')
  try { fn(path) } finally { rmSync(dir, { recursive: true, force: true }) }
}

test('nom PRÉSENT dans le chapitre cité → silence', () => {
  withTempDoc('### Classes\n**Source :** LDB 6 p.48  \n**Maxi :** 1\n\nDesc.\n', (path) => {
    assert.equal(scanMissingEntities(path).length, 0)
  })
})

test('nom ABSENT du chapitre cité → détecté (réf syntaxiquement conforme, cible fausse)', () => {
  withTempDoc('### Talent Totalement Absent\n**Source :** LDB 6 p.48  \n**Maxi :** 1\n\nDesc.\n', (path) => {
    const v = scanMissingEntities(path)
    assert.equal(v.length, 1)
    assert.equal(v[0].name, 'Talent Totalement Absent')
    assert.equal(v[0].ref, 'LDB 6')
  })
})

test('réf sans chapitre numérique résoluble (AA Annexe III) → hors sujet, jamais compté', () => {
  withTempDoc('### Artilleur (mise à jour AA)\n**Source :** AA Annexe III l.4457-4460  \n', (path) => {
    assert.equal(scanMissingEntities(path).length, 0)
  })
})

test('chapitre INTROUVABLE → hors sujet ici (périmètre check-refs/check-code-refs)', () => {
  withTempDoc('### Nawak\n**Source :** LDB 9999 p.1  \n', (path) => {
    assert.equal(scanMissingEntities(path).length, 0)
  })
})

test('parenthèse finale du titre retirée avant comparaison (annotation d\'édition, pas le nom RAW)', () => {
  withTempDoc('### Classes (mise à jour AA)\n**Source :** LDB 6 p.48  \n', (path) => {
    assert.equal(scanMissingEntities(path).length, 0)
  })
})

test('titre SANS ligne Source dans les 4 lignes suivantes → pas une entrée, ignoré', () => {
  withTempDoc('### Un titre de section\n\nDu texte qui ne cite rien.\n\n### Classes\n**Source :** LDB 6 p.48  \n', (path) => {
    assert.equal(scanMissingEntities(path).length, 0)
  })
})

test('entityNameFromHeader : parenthèse finale retirée, reste conservé tel quel', () => {
  assert.equal(entityNameFromHeader('Artilleur (mise à jour AA)'), 'Artilleur')
  assert.equal(entityNameFromHeader('Commandant d\'équipe (NOUVEAU AA)'), 'Commandant d\'équipe')
  assert.equal(entityNameFromHeader('Lire/Écrire'), 'Lire/Écrire')
})

test('normalizeLoose : markdown, accents et casse dépouillés', () => {
  assert.equal(normalizeLoose('**Empreint d\'*Ulgu***'), "empreint d'ulgu")
  assert.equal(normalizeLoose('Magié'), 'magie')
})

test('stripArticles : tolère « Empreint de la Magie » vs « Empreint de Magie » (#600, EDOC 13 l.254)', () => {
  assert.equal(stripArticles('empreint de la magie'), stripArticles('empreint de magie'))
  assert.equal(stripArticles(normalizeLoose("Empreint d'Ulgu")), stripArticles(normalizeLoose("Empreint d'Ulgu")))
})

test('sitesEntites : un site = le DOC et le NOM de l’entité, deux homonymes → deux occurrences', () => {
  const sites = sitesEntites([
    { doc: 'docs/raw/4e/talents.md', row: 12, name: 'X' },
    { doc: 'docs/raw/4e/talents.md', row: 40, name: 'X' },
    { doc: 'docs/raw/4e/talents.md', row: 51, name: 'Y' },
  ])
  assert.deepEqual(sites, [
    { file: 'docs/raw/4e/talents.md', ref: 'X' },
    { file: 'docs/raw/4e/talents.md', ref: 'X' },
    { file: 'docs/raw/4e/talents.md', ref: 'Y' },
  ], 'la ligne du doc ne fait pas partie du site')
  const { neuves } = ecartDuVolet({ sites, stock: [], ou: 'entity-in-chapter-stock.json' })
  assert.equal(neuves.length, 3)
  const deuxieme = cleDeSite({ fichier: 'docs/raw/4e/talents.md', ref: 'X', occurrence: 2 })
  assert.ok(neuves.some((n) => n.startsWith(deuxieme)), `les homonymes se distinguent par leur occurrence :\n${neuves.join('\n')}`)
})

test('stock ABSENT → tolérance ZÉRO : la VRAIE docs/raw/4e/talents.md ne porte aucune entité hors chapitre (#600 solde)', () => {
  assert.equal(STOCK_PATH.endsWith('entity-in-chapter-stock.json'), true)
  const violations = scanAll()
  for (const r of regenerations(violations)) assert.equal(ecartDeRegeneration(r, texteEnPlace(r.chemin)), null)
  const { neuves, perimees } = ecartDuVolet({
    sites: sitesEntites(violations), stock: lireEntreesDeSite(STOCK_PATH), ou: 'entity-in-chapter-stock.json',
  })
  assert.deepEqual(neuves, [], `entité(s) dont le nom est absent du chapitre cité :\n${neuves.join('\n')}`)
  assert.deepEqual(perimees, [], `entrée(s) SOLDÉE(s) à retirer :\n${perimees.join('\n')}`)
})
