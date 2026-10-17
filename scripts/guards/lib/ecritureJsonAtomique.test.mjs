// Contrat de l'ÉCRITURE JSON ATOMIQUE : la cible porte la valeur, le dossier se crée, aucun temporaire ne reste,
// et le fichier qu'un lecteur tient n'est jamais réécrit en place (`ecrireTexteAtomique`, #2603).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { linkSync, mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { ecrireJsonAtomique, ecrireTexteAtomique } from './ecritureJsonAtomique.mjs'
import { listerDossier } from './lister.mjs'

test('ecrireJsonAtomique : la cible porte la valeur, son dossier se crée, aucun temporaire ne reste', (t) => {
  const racine = mkdtempSync(join(tmpdir(), 'ecriture-json-'))
  t.after(() => rmSync(racine, { recursive: true, force: true }))
  const dossier = join(racine, 'sous', 'dossier')
  ecrireJsonAtomique(join(dossier, 'a.json'), { a: 1 })
  ecrireJsonAtomique(join(dossier, 'a.json'), { a: 2, b: [3] })
  assert.deepEqual(JSON.parse(readFileSync(join(dossier, 'a.json'), 'utf8')), { a: 2, b: [3] })
  assert.deepEqual(listerDossier(dossier), ['a.json'])
})

test('écriture JSON : un ancien temporaire du même PID reste intact', (t) => {
  const racine = mkdtempSync(join(tmpdir(), 'ecriture-json-'))
  t.after(() => rmSync(racine, { recursive: true, force: true }))
  const cible = join(racine, 'a.json'), ancien = `${cible}.${process.pid}.tmp`
  writeFileSync(ancien, 'preuve ancienne')
  ecrireJsonAtomique(cible, { a: 1 })
  assert.equal(readFileSync(ancien, 'utf8'), 'preuve ancienne')
  assert.deepEqual(JSON.parse(readFileSync(cible, 'utf8')), { a: 1 })
})

test('écriture JSON : échec du renommage purge seulement le temporaire propre', (t) => {
  const racine = mkdtempSync(join(tmpdir(), 'ecriture-json-'))
  t.after(() => rmSync(racine, { recursive: true, force: true }))
  const cible = join(racine, 'occupee.json'); mkdirSync(cible)
  assert.throws(() => ecrireJsonAtomique(cible, { a: 1 }))
  assert.deepEqual(listerDossier(racine), ['occupee.json'])
})

test('#2603 — ecrireTexteAtomique : le fichier lu n’est jamais réécrit en place — un lien dur vers l’ancienne cible garde l’ancien contenu ENTIER', (t) => {
  const racine = mkdtempSync(join(tmpdir(), 'ecriture-texte-'))
  t.after(() => rmSync(racine, { recursive: true, force: true }))
  const cible = join(racine, 'registre.js'), ancienne = join(racine, 'ancienne.js')
  ecrireTexteAtomique(cible, 'v1\n')
  linkSync(cible, ancienne)
  ecrireTexteAtomique(cible, 'v2\n')
  assert.equal(readFileSync(cible, 'utf8'), 'v2\n')
  assert.equal(readFileSync(ancienne, 'utf8'), 'v1\n', 'un lecteur qui tient l’ancienne cible la lit entière : rien ne l’a tronquée ni réécrite')
  assert.deepEqual(listerDossier(racine), ['ancienne.js', 'registre.js'])
})
