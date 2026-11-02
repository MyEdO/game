// Le lecteur de chapitres résout le `dir` d'un livre à la racine du dépôt, d'où que le processus soit
// lancé (#3120). Lancé par `npm run test:raw`.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { realpathSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { isAbsolute } from 'node:path'

const sonde = `
  const { readFileSync } = await import('node:fs')
  const { cheminChapitre, lireChapitre } = await import(${JSON.stringify(new URL('./lecteur-fs.mjs', import.meta.url).href)})
  const { resoudreProse } = await import(${JSON.stringify(new URL('./resoudre.mjs', import.meta.url).href)})
  const donnee = JSON.parse(readFileSync(new URL(${JSON.stringify(new URL('../../src/data/psychology.json', import.meta.url).href)}), 'utf8'))
  const entree = donnee.find((e) => e.descRef)
  const { book, ch } = entree.descRef
  const { livreDuReleve } = await import(${JSON.stringify(new URL('../raw/releve.mjs', import.meta.url).href)})
  console.log(JSON.stringify({ cwd: process.cwd(), chemin: cheminChapitre(book, ch), lu: Boolean(lireChapitre(book, ch)), prose: resoudreProse(entree).etat, index: livreDuReleve('core-rulebook-5e').index.length }))`

test('#3120 — un chapitre se liste, se lit et se résout depuis un cwd hors du dépôt, son consommateur `releve` aussi, sans déplacer le cwd', () => {
  const etranger = tmpdir()
  const r = spawnSync(process.execPath, ['--input-type=module', '-e', sonde], { cwd: etranger, encoding: 'utf8' })
  assert.equal(r.status, 0, r.stderr)
  const vu = JSON.parse(r.stdout)
  assert.ok(vu.chemin && !isAbsolute(vu.chemin), `chemin de chapitre relatif à la racine : ${vu.chemin}`)
  assert.equal(vu.lu, true, `chapitre lu depuis ${etranger}`)
  assert.equal(vu.prose, 'resolue', 'l’adresse d’une entrée de `psychology.json` se résout depuis un cwd étranger')
  assert.ok(vu.index > 0, 'le relevé lit l’index imprimé du livre, listé et lu à la racine comme ses chapitres')
  assert.equal(realpathSync(vu.cwd), realpathSync(etranger), 'le lecteur ne déplace pas le cwd de son appelant')
})
