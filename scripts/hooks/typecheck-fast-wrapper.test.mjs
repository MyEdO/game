// Tests du wrapper `scripts/typecheck-fast.mjs` sur un FAUX dépôt (tmpdir + faux
// `node_modules/typescript/bin/tsc`) : le résumé imprimé doit lister TOUTES les erreurs (jamais un
// extrait) et ne jamais annoncer « 0 erreur(s) » quand le processus sort en échec.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, copyFileSync, writeFileSync, readFileSync, rmSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const WRAPPER = join(REPO, 'scripts', 'typecheck-fast.mjs')

/** Faux dépôt : le wrapper copié + un `tsc` de substitution au chemin qu'il lance. */
function fauxDepot(sourceDuFauxTsc) {
  const base = mkdtempSync(join(tmpdir(), 'typecheck-fast-'))
  mkdirSync(join(base, 'scripts'), { recursive: true })
  copyFileSync(WRAPPER, join(base, 'scripts', 'typecheck-fast.mjs'))
  copyFileSync(join(REPO, 'scripts', 'outillage-local.mjs'), join(base, 'scripts', 'outillage-local.mjs'))
  if (sourceDuFauxTsc !== null) {
    mkdirSync(join(base, 'node_modules', 'typescript', 'bin'), { recursive: true })
    writeFileSync(join(base, 'node_modules', 'typescript', 'bin', 'tsc'), sourceDuFauxTsc, 'utf8')
  }
  return base
}

function lance(base) {
  return spawnSync(process.execPath, [join(base, 'scripts', 'typecheck-fast.mjs')], {
    encoding: 'utf8',
    cwd: base,
  })
}

// Faux tsc FIDÈLE au flux réel : les 500 erreurs sortent en 5 paquets espacés (le dernier après
// ~60 ms), donc un parent qui ne lirait qu'un chunk ou lirait sa capture avant l'exit sous-compte.
// Et il reproduit la sémantique POSIX mesurée sur le runner ubuntu (CI run 33395726501, où seules
// 172 des 500 lignes atteignaient le wrapper) : vers un TUBE les écritures sont asynchrones et le
// `process.exit()` en abandonne la queue ; vers un FICHIER régulier elles sont synchrones et rien
// n'est perdu. `fstatSync(1).isFile()` distingue les deux sur Windows comme sur POSIX.
const FAUX_TSC_500 = [
  "const { fstatSync } = require('fs')",
  'const TOTAL = 500',
  'const RETENUES_SUR_TUBE = 172',
  'let versFichier = false',
  'try { versFichier = fstatSync(1).isFile() } catch {}',
  'const limite = versFichier ? TOTAL : RETENUES_SUR_TUBE',
  'let i = 1',
  'function paquet() {',
  '  const fin = Math.min(i + 99, limite)',
  '  for (; i <= fin; i++) {',
  '    process.stdout.write(`src/f${i}.ts(1,1): error TS2322: erreur numero ${i}\\n`)',
  '  }',
  '  if (i <= limite) setTimeout(paquet, 15)',
  '  else process.exit(2)',
  '}',
  'paquet()',
  '',
].join('\n')

test('500 erreurs TS émises en paquets : toutes listées, entête exact, code de sortie propagé', () => {
  const base = fauxDepot(FAUX_TSC_500)
  try {
    const run = lance(base)
    assert.equal(run.status, 2, `code de sortie non propagé : ${run.status}`)
    assert.match(run.stdout, /typecheck:fast — 500 erreur\(s\)/)
    const listees = run.stdout.split(/\r?\n/).filter((l) => /error TS\d+/.test(l))
    assert.equal(listees.length, 500, `${listees.length} lignes listées au lieu de 500`)
    assert.match(run.stdout, /src\/f500\.ts\(1,1\): error TS2322: erreur numero 500/)
    // La capture sur disque porte le MÊME compte que le résumé : elle est la sortie complète.
    const capture = readFileSync(join(base, 'node_modules', '.cache', 'typecheck-last.txt'), 'utf8')
    const capturees = capture.split(/\r?\n/).filter((l) => /error TS\d+/.test(l))
    assert.equal(capturees.length, 500, `capture amputée : ${capturees.length} lignes sur 500`)
  } finally {
    rmSync(base, { recursive: true, force: true })
  }
})

test('erreur TS lue mais tsc sorti à 0 : le statut suit le COMPTE, jamais 0', () => {
  const base = fauxDepot('process.stdout.write("src/a.ts(1,10): error TS6133: \'x\' is declared but its value is never read.\\n")\nprocess.exit(0)\n')
  try {
    const run = lance(base)
    assert.match(run.stdout, /typecheck:fast — 1 erreur\(s\)/)
    assert.notEqual(run.status, 0, `1 erreur TS comptée, code de sortie ${run.status}`)
  } finally {
    rmSync(base, { recursive: true, force: true })
  }
})

test('échec SANS erreur TS : jamais « 0 erreur(s) », la sortie brute est rendue', () => {
  const base = fauxDepot('process.stderr.write("tsc: panne du compilateur\\n")\nprocess.exit(3)\n')
  try {
    const run = lance(base)
    assert.equal(run.status, 3)
    assert.ok(
      !/0 erreur\(s\)/.test(run.stdout),
      `résumé menteur : « 0 erreur(s) » avec un code ${run.status}\n${run.stdout}`,
    )
    assert.match(run.stdout, /ÉCHEC \(code 3\)/)
    assert.match(run.stdout, /panne du compilateur/)
  } finally {
    rmSync(base, { recursive: true, force: true })
  }
})

test('tsc absent de l’arbre : refus NOMMÉ avant tout lancement, jamais un résumé vert', () => {
  const base = fauxDepot(null)
  try {
    const run = lance(base)
    assert.equal(run.status, 2, `code de refus attendu 2, obtenu ${run.status}`)
    assert.ok(
      !/0 erreur\(s\)/.test(run.stdout),
      `résumé menteur sur tsc absent :\n${run.stdout}`,
    )
    // Le refus nomme l'outil, l'arbre et la cause — jamais un `Cannot find module` non attribué.
    assert.match(run.stderr, /\[outillage\] tsc n'est pas installé dans cet arbre/)
    assert.ok(run.stderr.includes(base), `l'arbre n'est pas nommé :\n${run.stderr}`)
    assert.match(run.stderr, /AUTRE arbre/)
  } finally {
    rmSync(base, { recursive: true, force: true })
  }
})
