import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { envDeDepotForge, instanceDeDepot } from './depotGabarit.mjs'
import { repoProgram } from './tsProgram.mjs'

const RACINE = resolve(import.meta.dirname, '../../..')
const FICHIER = 'src/collision.ts'
const FORMES = [
  { nom: 'SAVES', valeur: (n, branche) => `'#${n} ${branche}'`, forme: 'as const' },
  { nom: 'ROSTER', valeur: (_n, branche) => `(doc) => ({ ...doc, branche: '${branche}' })`, forme: 'satisfies MigrationMap' },
  { nom: 'IDB', valeur: (_n, branche) => `(db) => { db.createObjectStore('${branche}') }`, forme: 'satisfies MigrationsIdb' },
]

const texteDe = (ajout) => [
  "import { versionCourante } from './lib/versionCourante';",
  "import type { MigrationMap } from './state/migrateDoc';",
  "import type { MigrationsIdb } from './lib/indexedDb';",
  ...FORMES.flatMap(({ nom, valeur, forme }) => [
    `const ${nom} = {`,
    ...(ajout?.position === 'debut' ? [`  7: ${valeur(7, ajout.branche)},`] : []),
    ...Array.from({ length: 7 }, (_, n) => `  ${n}: ${valeur(n, `base-${n}`)},`),
    ...(ajout?.position === 'fin' ? [`  7: ${valeur(7, ajout.branche)},`] : []),
    `} ${forme};`,
    `export const V_${nom} = versionCourante(${nom});`,
  ]),
  '',
].join('\n')

const collisionsDe = (texte) => {
  const virtuel = resolve(RACINE, FICHIER)
  const programme = repoProgram(RACINE, () => [virtuel], { [FICHIER]: texte })
  return programme.getSemanticDiagnostics(programme.getSourceFile(virtuel)).filter((d) => d.code === 1117)
}

for (const cas of [
  { nom: 'conflit Git', a: { position: 'fin', branche: 'a' }, b: { position: 'fin', branche: 'b' }, statut: 1, collisions: 0 },
  { nom: 'fusion sans conflit avec clés dupliquées', a: { position: 'debut', branche: 'a' }, b: { position: 'fin', branche: 'b' }, statut: 0, collisions: 3 },
  { nom: 'ajouts identiques', a: { position: 'fin', branche: 'identique' }, b: { position: 'fin', branche: 'identique' }, statut: 0, collisions: 0 },
]) test(`deux branches : ${cas.nom}, trois formes réelles de tables`, (t) => {
  const { racine, sha: base } = instanceDeDepot({ fichiers: { [FICHIER]: texteDe() } })
  const git = (args, statut = 0) => {
    const vu = spawnSync('git', args, { cwd: racine, env: envDeDepotForge(), encoding: 'utf8' })
    assert.ifError(vu.error)
    assert.equal(vu.status, statut, `${args.join(' ')}\n${vu.stdout}\n${vu.stderr}`)
    return vu.stdout.trim()
  }
  try {
    const branche = (nom, ajout) => {
      git(['switch', '-c', nom, base])
      writeFileSync(join(racine, FICHIER), texteDe(ajout))
      git(['add', '--', FICHIER])
      git(['commit', '-q', '-m', nom])
      return git(['rev-parse', 'HEAD'])
    }
    const a = branche('a', cas.a)
    const b = branche('b', cas.b)
    assert.notEqual(a, b)
    assert.equal(git(['merge-base', 'a', 'b']), base)
    git(['switch', 'a'])
    git(['merge', '--no-edit', 'b'], cas.statut)
    const tete = git(['rev-parse', 'HEAD'])
    if (cas.statut === 1) {
      assert.equal(tete, a)
      assert.equal(git(['rev-parse', 'MERGE_HEAD']), b)
      assert.equal(git(['diff', '--name-only', '--diff-filter=U']), FICHIER)
      assert.match(readFileSync(join(racine, FICHIER), 'utf8'), /^<<<<<<< /m)
      t.diagnostic(`exit=1 HEAD=${tete} MERGE_HEAD=${b} base=${base}`)
    } else {
      const parents = git(['rev-parse', 'HEAD^1', 'HEAD^2']).split(/\r?\n/)
      assert.deepEqual(parents, [a, b])
      assert.equal(git(['status', '--porcelain']), '')
      const fusion = readFileSync(join(racine, FICHIER), 'utf8')
      assert.equal(collisionsDe(fusion).length, cas.collisions)
      assert.equal((fusion.match(/^ {2}7:/gm) ?? []).length, cas.collisions ? 6 : 3)
      t.diagnostic(`exit=0 HEAD=${tete} parents=${parents.join(' ')} TS1117=${cas.collisions}`)
    }
  } finally {
    rmSync(racine, { recursive: true, force: true })
  }
})
