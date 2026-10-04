// Lanceur d'outillage LOCAL (#1679 L1c) : la décision prise AVANT tout lancement (l'outil est-il
// installé dans CET arbre ?) et l'environnement servi à l'enfant (un seul `node_modules/.bin`).
// Les cas de bout en bout jouent un FAUX ARBRE en dossier temporaire — le lanceur y calcule sa
// racine depuis sa propre position, donc c'est bien la racine du faux arbre qu'il juge.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { readFileSync } from 'node:fs'
import { binLocal, entreeBin, envIsole, pathIsole, resoudreOutilLocal } from './lancer-local.mjs'
import { clotureDImports } from './guards/lib/importGraph.mjs'

const ICI = dirname(fileURLToPath(import.meta.url))
const RACINE = fileURLToPath(new URL('..', import.meta.url)).replace(/[\\/]$/, '')

test('entrée `bin` : table nommée, forme chaîne (nom du paquet), inconnu', () => {
  assert.equal(entreeBin({ bin: { tsc: './bin/tsc', tsserver: './bin/tsserver' } }, 'tsc'), './bin/tsc')
  assert.equal(entreeBin({ name: 'tsx', bin: './dist/cli.mjs' }, 'tsx'), './dist/cli.mjs')
  assert.equal(entreeBin({ name: 'tsx', bin: './dist/cli.mjs' }, 'autre'), null)
  assert.equal(entreeBin({ bin: { tsc: './bin/tsc' } }, 'vite'), null)
  assert.equal(entreeBin({}, 'tsc'), null)
})

test('PATH de l’enfant : le `.bin` local en tête, AUCUN `.bin` d’un autre arbre', () => {
  const local = '/arbres/.wt-42/node_modules/.bin'
  const servi = pathIsole(
    ['/arbres/Game/node_modules/.bin', '/usr/bin', '/arbres/Game/.wt-9/node_modules/.bin/', '/usr/local/bin'].join(':'),
    local,
    ':',
  )
  assert.deepEqual(servi.split(':'), [local, '/usr/bin', '/usr/local/bin'])
})

test('PATH vide ou absent : le `.bin` local suffit', () => {
  assert.equal(pathIsole(undefined, '/a/node_modules/.bin', ':'), '/a/node_modules/.bin')
  assert.equal(pathIsole('', '/a/node_modules/.bin', ':'), '/a/node_modules/.bin')
})

test('env de l’enfant : le PATH est posé sur la clé EXISTANTE (win32 écrit `Path`)', () => {
  const env = envIsole({ Path: '/arbres/Game/node_modules/.bin:/usr/bin', HOME: '/h' }, '/a/node_modules/.bin', ':')
  assert.equal(env.Path, '/a/node_modules/.bin:/usr/bin')
  assert.equal(env.PATH, undefined, 'aucune seconde clé PATH : l’enfant en verrait deux')
  assert.equal(env.HOME, '/h')
})

/** Modules à copier dans le faux arbre : la CLÔTURE d'imports RELATIFS de `lancer-local.mjs`,
 *  CALCULÉE (`clotureDImports`, `scripts/guards/lib/importGraph.mjs`) — jamais une liste tenue à la
 *  main (patron de `scripts/test/run-capture.test.mjs`). Une liste à tenir ne dit rien quand elle
 *  périme : au premier module partagé neuf, l'enfant meurt en `ERR_MODULE_NOT_FOUND` et les cas
 *  rougissent sur une cause qui ne se nomme pas. */
function modulesDuLanceur() {
  return [...clotureDImports(['scripts/lancer-local.mjs'], { racine: RACINE })].sort()
}

/** Faux arbre : le lanceur et TOUT ce qu'il importe, et rien d'autre — pas de `node_modules`. */
function fauxArbre() {
  const racine = mkdtempSync(join(tmpdir(), 'lancer-local-'))
  const modules = modulesDuLanceur()
  assert.ok(modules.includes('scripts/lancer-local.mjs'), `clôture vide ou sans le lanceur : ${modules.join(', ')}`)
  for (const rel of modules) {
    const cible = join(racine, ...rel.split('/'))
    mkdirSync(dirname(cible), { recursive: true })
    copyFileSync(join(RACINE, ...rel.split('/')), cible)
  }
  return racine
}

const lancer = (racine, args, env) =>
  spawnSync(process.execPath, [join(racine, 'scripts', 'lancer-local.mjs'), ...args], {
    encoding: 'utf8',
    env: { ...process.env, ...env },
  })

test('paquet ABSENT de l’arbre : refus NOMMÉ, exit 2, rien n’est lancé', () => {
  const racine = fauxArbre()
  try {
    const r = lancer(racine, ['typescript', '--', 'tsc', '--version'])
    assert.equal(r.status, 2)
    assert.equal(r.stdout, '')
    assert.match(r.stderr, /typescript n'est pas installé dans cet arbre/)
    assert.ok(r.stderr.includes(racine), 'le refus nomme l’arbre jugé')
    assert.match(r.stderr, /AUTRE arbre/)
  } finally {
    rmSync(racine, { recursive: true, force: true })
  }
})

test('exécutable non déclaré par le paquet local : refus NOMMÉ, exit 2', () => {
  const racine = fauxArbre()
  try {
    mkdirSync(join(racine, 'node_modules', 'sonde'), { recursive: true })
    writeFileSync(
      join(racine, 'node_modules', 'sonde', 'package.json'),
      JSON.stringify({ name: 'sonde', bin: { sonde: 'sonde.mjs' } }),
    )
    const r = lancer(racine, ['sonde', '--', 'autre'])
    assert.equal(r.status, 2)
    assert.match(r.stderr, /aucun exécutable « autre »/)
  } finally {
    rmSync(racine, { recursive: true, force: true })
  }
})

test('paquet PRÉSENT : lancé avec ses arguments, PATH isolé, code de sortie propagé', () => {
  const racine = fauxArbre()
  try {
    mkdirSync(join(racine, 'node_modules', 'sonde'), { recursive: true })
    writeFileSync(
      join(racine, 'node_modules', 'sonde', 'package.json'),
      JSON.stringify({ name: 'sonde', bin: { sonde: 'sonde.mjs' } }),
    )
    writeFileSync(
      join(racine, 'node_modules', 'sonde', 'sonde.mjs'),
      [
        'const cle = Object.keys(process.env).find((k) => k.toUpperCase() === "PATH")',
        'process.stdout.write(JSON.stringify({ args: process.argv.slice(2), path: process.env[cle] }))',
        'process.exit(Number(process.argv[2]))',
        '',
      ].join('\n'),
    )
    const etranger = join('/arbres/Game', 'node_modules', '.bin')
    const r = lancer(racine, ['sonde', '--', 'sonde', '3', 'suite'], { PATH: etranger, Path: etranger })
    assert.equal(r.status, 3, 'le code de sortie de l’enfant est le code du lanceur')
    const vu = JSON.parse(r.stdout)
    assert.deepEqual(vu.args, ['3', 'suite'])
    const segments = vu.path.split(process.platform === 'win32' ? ';' : ':')
    assert.equal(segments[0], join(racine, 'node_modules', '.bin'))
    assert.deepEqual(
      segments.filter((s) => /node_modules[\\/]\.bin$/.test(s)),
      [join(racine, 'node_modules', '.bin')],
      'aucun `.bin` d’un autre arbre ne subsiste',
    )
  } finally {
    rmSync(racine, { recursive: true, force: true })
  }
})

test('`--cwd` : l’enfant tourne dans le dossier demandé, l’outil reste celui de l’arbre', () => {
  const racine = fauxArbre()
  const ailleurs = mkdtempSync(join(tmpdir(), 'cwd-demande-'))
  try {
    mkdirSync(join(racine, 'node_modules', 'sonde'), { recursive: true })
    writeFileSync(
      join(racine, 'node_modules', 'sonde', 'package.json'),
      JSON.stringify({ name: 'sonde', bin: { sonde: 'sonde.mjs' } }),
    )
    writeFileSync(
      join(racine, 'node_modules', 'sonde', 'sonde.mjs'),
      'process.stdout.write(JSON.stringify({ cwd: process.cwd(), entree: process.argv[1] }))\n',
    )
    const vu = JSON.parse(lancer(racine, ['sonde', '--cwd', ailleurs, '--', 'sonde']).stdout)
    assert.equal(vu.cwd, ailleurs)
    assert.equal(vu.entree, join(racine, 'node_modules', 'sonde', 'sonde.mjs'))

    const defaut = JSON.parse(lancer(racine, ['sonde', '--', 'sonde']).stdout)
    assert.equal(defaut.cwd, racine, 'sans l’option, l’enfant tourne à la racine')
  } finally {
    rmSync(racine, { recursive: true, force: true })
    rmSync(ailleurs, { recursive: true, force: true })
  }
})

test('invocation mal formée : usage NOMMÉ, exit 2, rien n’est lancé', () => {
  const racine = fauxArbre()
  try {
    const r = lancer(racine, ['sonde', '--cwd', '--', 'sonde'])
    assert.equal(r.status, 2)
    assert.match(r.stderr, /usage : node scripts\/lancer-local\.mjs <paquet> \[--cwd <dossier>\] -- <bin>/)
  } finally {
    rmSync(racine, { recursive: true, force: true })
  }
})

/** Outils dont un appel PAR LE NOM se résout sur le PATH — donc, sous npm, sur un arbre ANCÊTRE. */
const OUTILS = ['vite', 'vitest', 'tsc', 'tsx', 'eslint', 'npx']

test('aucun script npm ne joue un outil par son NOM : tous passent par le lanceur', () => {
  const scripts = JSON.parse(readFileSync(join(ICI, '..', 'package.json'), 'utf8')).scripts
  const fautifs = []
  for (const [nom, commande] of Object.entries(scripts))
    for (const segment of commande.split('&&').map((c) => c.trim()))
      if (OUTILS.includes(segment.split(/\s+/)[0])) fautifs.push(`${nom} → ${segment}`)
  assert.deepEqual(fautifs, [])
})

test('résolution de l’outil : entrée locale rendue, paquet absent NOMMÉ', () => {
  const racine = fauxArbre()
  try {
    mkdirSync(join(racine, 'node_modules', 'sonde'), { recursive: true })
    writeFileSync(
      join(racine, 'node_modules', 'sonde', 'package.json'),
      JSON.stringify({ name: 'sonde', bin: { sonde: 'sonde.mjs' } }),
    )
    writeFileSync(join(racine, 'node_modules', 'sonde', 'sonde.mjs'), '')
    assert.deepEqual(resoudreOutilLocal(racine, 'sonde', 'sonde'), {
      entree: join(racine, 'node_modules', 'sonde', 'sonde.mjs'),
    })
    assert.match(resoudreOutilLocal(racine, 'tsx', 'tsx').refus, /tsx n'est pas installé dans cet arbre/)
    assert.match(resoudreOutilLocal(racine, 'sonde', 'autre').refus, /aucun exécutable « autre »/)
    assert.equal(binLocal(racine), join(racine, 'node_modules', '.bin'))
  } finally {
    rmSync(racine, { recursive: true, force: true })
  }
})
