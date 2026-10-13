// La sonde d'une commande de fond (#2596 A2) : lecture du code, borne, ligne de commande réelle.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { BORNE_DE_SONDE_S, CODE_EN_COURS, CODE_USAGE, codeDe, executer, optionsDe, sonder } from './sonde.mjs'

const SONDE = fileURLToPath(new URL('./sonde.mjs', import.meta.url))

/** Une horloge factice que `dormir` avance. */
const temps = () => {
  let t = 0
  return { horloge: () => t, dormir: (ms) => { t += ms } }
}

test('codeDe : un entier, BOM ôté ; vide ou partiel → null', () => {
  assert.equal(codeDe('0\n'), 0)
  assert.equal(codeDe('\uFEFF1\r\n'), 1)
  for (const contenu of ['', '  ', 'x', null]) assert.equal(codeDe(contenu), null)
})

test('optionsDe : un fichier, `--borne` entière ≤ BORNE_DE_SONDE_S, rien d’autre', () => {
  assert.deepEqual(optionsDe(['f.code']), { fichier: 'f.code', borneS: BORNE_DE_SONDE_S })
  assert.deepEqual(optionsDe(['f.code', '--borne', '5']), { fichier: 'f.code', borneS: 5 })
  for (const argv of [[], ['--borne', '5'], ['f.code', '--borne', String(BORNE_DE_SONDE_S + 1)], ['f.code', '--borne', 'x'], ['f.code', '--autre', '5'], ['f.code', '--borne', '5', 'x']]) {
    assert.equal(optionsDe(argv), null, JSON.stringify(argv))
  }
})

test('sonder : rend DÈS que le code paraît, sinon EN COURS à la borne exacte', () => {
  const t = temps()
  let lectures = 0
  assert.deepEqual(sonder({ fichier: 'f', borneMs: 10_000, lire: () => (++lectures >= 3 ? 7 : null), ...t }), { etat: 'terminee', code: 7 })
  assert.equal(t.horloge(), 2000, 'deux périodes dormies avant la troisième lecture')
  const u = temps()
  assert.deepEqual(sonder({ fichier: 'f', borneMs: 2500, lire: () => null, ...u }), { etat: 'en-cours', attenduMs: 2500 })
})

test('executer : terminée → code de la commande et fin du journal ; en cours → CODE_EN_COURS ; usage → CODE_USAGE', () => {
  const lignes = []
  const ecrire = (l) => lignes.push(l)
  assert.equal(executer({ argv: ['x/a.code'], ecrire, sonde: () => ({ etat: 'terminee', code: 3 }), lireJournal: (c) => (c === 'x/a.log' ? 'l1\nl2\n' : null) }), 3)
  assert.deepEqual(lignes, ['[sonde] fin de x/a.log :', 'l1', 'l2', '[sonde] TERMINÉE — code 3'])
  assert.equal(executer({ argv: ['x/a.code'], ecrire, sonde: () => ({ etat: 'en-cours', attenduMs: 240_000 }) }), CODE_EN_COURS)
  assert.match(lignes.at(-1), /EN COURS après 240 s — relance la même sonde : node scripts\/ops\/sonde\.mjs "x\/a\.code"/)
  assert.equal(executer({ argv: [], ecrire }), CODE_USAGE)
})

test('ligne de commande réelle : code écrit → sort sur lui ; absent → CODE_EN_COURS à la borne', () => {
  const dossier = mkdtempSync(join(tmpdir(), 'sonde-'))
  try {
    const code = join(dossier, 'a.code')
    const absent = spawnSync(process.execPath, [SONDE, code, '--borne', '1'], { encoding: 'utf8' })
    assert.equal(absent.status, CODE_EN_COURS, absent.stdout + absent.stderr)
    writeFileSync(code, '5\n')
    writeFileSync(join(dossier, 'a.log'), 'fin du run\n')
    const fini = spawnSync(process.execPath, [SONDE, code], { encoding: 'utf8' })
    assert.equal(fini.status, 5, fini.stdout + fini.stderr)
    assert.match(fini.stdout, /fin du run\n\[sonde\] TERMINÉE — code 5/)
  } finally {
    rmSync(dossier, { recursive: true, force: true })
  }
})
