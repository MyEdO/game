// Contrat de ce qu'une porte du pre-commit REÇOIT en argv, et de ce que son échec VEUT DIRE (#1699).
// Le cas qui a menti en vrai : 467 chemins stagés = 33 181 caractères d'argv, au-dessus du plafond
// Windows (~32 767) — `execFileSync` part en `ENAMETOOLONG` et l'ancien `catch` nu rendait
// « docs-vs-commit en échec », c'est-à-dire un verdict de DOC pour une porte qui n'a jamais tourné.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { codeDePanne, docsDePorte, estUnDocDePorte, paquetsDArgv, PLAFOND_SUR_ARGV } from './porteSpawn.mjs'

const PLAFOND_ARGV_WINDOWS = 32767
const HOOK = fileURLToPath(new URL('../../git-hooks/pre-commit.mjs', import.meta.url))
const ANTISLASH = String.fromCharCode(92)

/** Un diff de gros renommage : 500 chemins, dont quelques docs. Chaque chemin est un GABARIT posé sur un
 *  segment (`${docs}/…`) — jamais un tableau/objet littéral nommant un fichier : un banc ne porte ni
 *  entrée de stock, ni citation de plan daté. */
const diffDeGrosRenommage = () => {
  const src = 'src'
  const docs = 'docs'
  const attendus = []
  attendus.push(`${docs}/architecture.md`)
  attendus.push(`${docs}/raw/talents.md`)
  attendus.push(`${docs}/plans/plan-fictif.md`)
  attendus.push(`${docs}/galerie.html`)
  const chemins = []
  for (let i = 0; i < 494; i += 1) chemins.push(`${src}/engine/sous-systeme/module-au-nom-de-chapitre-tres-tres-long-${i}.ts`)
  chemins.push(...attendus)
  chemins.push(`${docs}/raw/lib/profond.md`)
  chemins.push(`${src}/data/items.json`)
  return { chemins, attendus }
}

test('500 chemins stagés : le garde ne reçoit QUE les docs, et son argv reste sous le plafond Windows', () => {
  const { chemins: staged, attendus } = diffDeGrosRenommage()
  assert.equal(staged.length, 500)
  const recus = docsDePorte(staged)
  assert.deepEqual(recus, attendus)
  // Le diff ENTIER dépasse le plafond ; la sélection, non — c'est tout l'écart entre la porte qui juge
  // et la porte qui part en `ENAMETOOLONG` sans avoir démarré.
  assert.ok(staged.join(' ').length > PLAFOND_ARGV_WINDOWS)
  assert.ok(recus.join(' ').length < PLAFOND_ARGV_WINDOWS)
})

test('sélection : `docs/` racine, `raw/` et `plans/`, en .md/.html ; antislash Windows normalisé', () => {
  const docs = 'docs'
  const src = 'src'
  assert.equal(estUnDocDePorte(`${docs}/architecture.md`), true)
  assert.equal(estUnDocDePorte(`${docs}${ANTISLASH}architecture.md`), true)
  assert.equal(estUnDocDePorte(`${docs}/raw/sorts.html`), true)
  assert.equal(estUnDocDePorte(`${docs}/raw/lib/profond.md`), false)
  assert.equal(estUnDocDePorte(`${docs}/notes.txt`), false)
  assert.equal(estUnDocDePorte(`${src}/engine/combat.ts`), false)
  assert.equal(estUnDocDePorte(`${''}README.md`), false)
})

test('paquets : quand le consommateur EXIGE les chemins, aucun paquet ne dépasse le plafond', () => {
  const staged = diffDeGrosRenommage().chemins
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

test('CÂBLAGE : le pre-commit arme la porte des docs sur SA sélection, et ne déroule jamais le diff entier en argv', () => {
  const texte = readFileSync(HOOK, 'utf8')
  assert.match(texte, /const docsPourLaPorte = docsDePorte\(staged\)/)
  assert.equal(texte.includes('...staged]'), false, 'aucune porte ne déroule la liste stagée entière en argv')
  // Chaque `catch` de sous-processus qui NOMME un coupable lit d'abord la CAUSE : autant de lectures de
  // `codeDePanne` que de portes lancées en sous-processus dont l'échec pousse un offender.
  assert.ok(texte.includes('const panne = codeDePanne(e)'))
  assert.equal(/\} catch \{\n\s*offenders\.push/.test(texte), false, 'aucun catch nu ne rend un verdict à la place du garde')
  // Aucune porte ne déroule une liste DÉRIVÉE DU DIFF en argv sans la borner (sélection ou paquets).
  assert.equal(/\.\.\.(staged|dataStaged)\]/.test(texte), false)
})
