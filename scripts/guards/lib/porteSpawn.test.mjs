// Contrat de ce qu'une porte du pre-commit REÇOIT en argv, et de ce que son échec VEUT DIRE (#1699).
// Le cas qui a menti en vrai : 467 chemins stagés = 33 181 caractères d'argv, au-dessus du plafond
// Windows (~32 767) — `execFileSync` part en `ENAMETOOLONG`, et un `catch` nu rendait un VERDICT pour
// une porte qui n'a jamais tourné.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { codeDePanne, paquetsDArgv, PLAFOND_SUR_ARGV } from './porteSpawn.mjs'

const HOOK = fileURLToPath(new URL('../../git-hooks/pre-commit.mjs', import.meta.url))

/** Un diff de gros renommage : 500 chemins longs, posés par GABARIT sur un segment. */
const diffDeGrosRenommage = () => {
  const src = 'src'
  return Array.from({ length: 500 }, (_, i) => `${src}/engine/sous-systeme/module-au-nom-de-chapitre-tres-tres-long-${i}.ts`)
}

test('paquets : quand le consommateur EXIGE les chemins, aucun paquet ne dépasse le plafond', () => {
  const staged = diffDeGrosRenommage()
  const paquets = paquetsDArgv(staged)
  assert.ok(paquets.length > 1, 'un diff de 33 k caractères ne tient pas en un seul argv')
  for (const p of paquets) assert.ok(p.join(' ').length <= PLAFOND_SUR_ARGV)
  assert.deepEqual(paquets.flat(), staged, 'aucun chemin perdu ni dupliqué')
  assert.deepEqual(paquetsDArgv([]), [])
  // Un chemin plus long que le plafond part seul : la porte tranche, elle ne le fait pas disparaître.
  const enorme = 'x'.repeat(PLAFOND_SUR_ARGV + 10)
  const seul = [enorme]
  assert.deepEqual(paquetsDArgv(seul), [seul])
})

test('un VERDICT (`status`) et une PANNE (`code`) ne se confondent pas', () => {
  assert.equal(codeDePanne({ status: 1, code: 1 }), null) // le garde a tourné et a jugé
  assert.equal(codeDePanne({ status: 0 }), null)
  assert.equal(codeDePanne({ code: 'ENAMETOOLONG', errno: -4064 }), 'ENAMETOOLONG') // il n'a pas démarré
  assert.equal(codeDePanne({ code: 'ENOENT' }), 'ENOENT')
  assert.equal(codeDePanne(undefined), null)
})

test('CÂBLAGE : la porte des fins de ligne lit l’index PAR PAQUETS, et aucune porte ne déroule le diff entier en argv', () => {
  const texte = readFileSync(HOOK, 'utf8')
  assert.match(texte, /paquetsDArgv\(staged\)\.flatMap\(\(paquet\) => eolsDe\(depot, paquet\)\)/)
  assert.equal(/\.\.\.staged\]/.test(texte), false, 'aucune porte ne déroule la liste stagée entière en argv')
  assert.ok(texte.includes('codeDePanne(e)'), 'la panne de la porte des fins de ligne est lue comme une PANNE')
})
