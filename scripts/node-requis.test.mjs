// Porte de version de Node (#1801) : la règle PURE, puis son CÂBLAGE dans chaque point d'entrée qui
// rend un verdict, tel que `package.json` le déclare, joué sur un FAUX ARBRE en dossier temporaire
// dont `engines.node` exige un Node inexistant :
//   - `.npmrc` : VRAIS `.npmrc` et porte copiés ;
//   - les modules Node (`npm run gates`, `.mjs` des hooks shell du `core.hooksPath`, pilotes
//     `merge.<nom>.driver`, hooks d'agent de `.claude/settings.json` et `.codex/hooks.json`) : chacun
//     EXÉCUTÉ avec sa clôture d'imports copiée — les hooks shell par leur VRAI script —, sous
//     `--no-experimental-strip-types` — le chargement d'un Node 22 < 22.18 ;
//     sa clôture STATIQUE et son AST : `scripts/corpus/generateurs/node-requis.test.mjs`.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { clotureDImports } from './guards/lib/importGraph.mjs'
import { CODE_DE_REFUS, refusDeVersion } from './node-requis.mjs'
import { RACINE, DOSSIER_HOOKS, HOOKS_SHELL, HOOKS_AGENT, MODULES_HOOKS_AGENT, MODULES_PAR_HOOK, MODULES_LANCES } from './test/lib/bancNodeRequis.mjs'

/** Claude Code : seul le code de sortie 2 d'un hook `PreToolUse` bloque l'outil. */
const CODE_BLOQUANT_PRETOOLUSE = 2

/** githooks(5) : un hook `post-*` ne peut pas faire échouer l'opération qui vient d'avoir lieu. */
const estPostHook = (hook) => hook.startsWith('post-')

/** Les `post-*` qui rendent le code de leur `.mjs` tel quel (#2187, verdict 6026872846 point 2) : son lecteur le lit. */
const POST_TRANSPARENTS = new Set(['post-merge'])

/** githooks(5) : les arguments que git passe au hook dans le geste qui le fait AGIR — `post-checkout`
 *  un changement de BRANCHE (`$3` = 1), `post-rewrite` un `rebase`. Les autres refusent avant de les lire. */
const ARGUMENTS_D_UN_GESTE = { 'post-checkout': ['0'.repeat(40), 'f'.repeat(40), '1'], 'post-rewrite': ['rebase'] }

const EXIGENCE_INTENABLE = '>=999.0.0'

test('refus : version inférieure sur le majeur, le mineur ou le correctif', () => {
  for (const version of ['21.99.99', '22.17.9', '22.18.0']) {
    assert.match(refusDeVersion('>=22.18.1', version), new RegExp(`Node ${version.replace(/\./g, '\\.')} .*« >=22\\.18\\.1 »`))
  }
})

test('accord : version égale ou supérieure, préfixe `v` toléré', () => {
  for (const version of ['22.18.0', '22.18.1', '22.23.2', '23.0.0', 'v24.1.0']) {
    assert.equal(refusDeVersion('>=22.18.0', version), null, version)
  }
})

test('plage absente, vide ou invalide : refus qui la nomme', () => {
  for (const plage of [undefined, '', ' ', 'invalide']) {
    assert.match(refusDeVersion(plage, '22.23.2'), /engines.node illisible/, String(plage))
  }
})

test('plage composée : seuls les moteurs compatibles avec les dépendances sont admis', () => {
  const plage = '^22.22.2 || ^24.15.0 || >=26.0.0'
  for (const version of ['22.22.2', '22.23.0', '24.15.0', '26.0.0', '27.0.0'])
    assert.equal(refusDeVersion(plage, version), null, version)
  for (const version of ['22.22.1', '24.14.0', '23.0.0', '25.0.0', '26.0.0-nightly2026'])
    assert.match(refusDeVersion(plage, version), /ne satisfait pas/, version)
  assert.match(refusDeVersion(plage, 'illisible'), /version de Node illisible/)
})

/** Arbre à l'exigence intenable : `package.json` qui la porte, `.npmrc` et porte réels. */
function arbreIntenable() {
  const racine = mkdtempSync(join(tmpdir(), 'node-requis-'))
  mkdirSync(join(racine, 'scripts', 'git-hooks'), { recursive: true })
  writeFileSync(
    join(racine, 'package.json'),
    JSON.stringify({ name: 'faux-arbre', version: '0.0.0', engines: { node: EXIGENCE_INTENABLE }, scripts: { porte: 'node -e 0' } }),
  )
  copyFileSync(join(RACINE, '.npmrc'), join(racine, '.npmrc'))
  copyFileSync(join(RACINE, 'scripts', 'node-requis.mjs'), join(racine, 'scripts', 'node-requis.mjs'))
  symlinkSync(join(RACINE, 'node_modules'), join(racine, 'node_modules'), 'junction')
  return racine
}

/** L'arbre intenable, plus la clôture d'imports de chaque module lancé, les hooks shell réels et le
 *  `node_modules` réel. */
function arbreDesModules() {
  const racine = arbreIntenable()
  for (const rel of clotureDImports(MODULES_LANCES, { racine: RACINE })) {
    mkdirSync(dirname(join(racine, rel)), { recursive: true })
    copyFileSync(join(RACINE, rel), join(racine, rel))
  }
  for (const hook of HOOKS_SHELL) copyFileSync(join(DOSSIER_HOOKS, hook), join(racine, 'scripts', 'git-hooks', hook))
  return racine
}

/** Environnement sans ce que `npm run` pose à l'appelant (`npm_config_*` serait lu comme configuration). */
function envNu() {
  return Object.fromEntries(Object.entries(process.env).filter(([cle]) => !/^npm_/i.test(cle)))
}

const REFUS = new RegExp(`Node ${process.versions.node.replace(/\./g, '\\.')} ne satisfait pas package\\.json engines\\.node « ${EXIGENCE_INTENABLE} »`)

test('câblage `.npmrc` : `npm install` refuse le Node courant, exit 1, EBADENGINE', () => {
  const racine = arbreIntenable()
  try {
    const r = spawnSync('npm', ['install', '--dry-run', '--ignore-scripts', '--no-audit', '--no-fund'], {
      cwd: racine,
      env: envNu(),
      encoding: 'utf8',
      shell: process.platform === 'win32',
    })
    assert.equal(r.status, 1, r.stdout + r.stderr)
    assert.match(r.stderr, new RegExp(`EBADENGINE[\\s\\S]*${EXIGENCE_INTENABLE.replace(/\./g, '\\.')}`))
  } finally {
    rmSync(racine, { recursive: true, force: true })
  }
})

test('câblage des hooks shell de `scripts/git-hooks/` : chacun lance un `.mjs` dont la porte refuse — `CODE_DE_REFUS`, ou 0 pour un `post-*` ; stdout vide', () => {
  for (const [hook, modules] of MODULES_PAR_HOOK) assert.ok(modules.length, `${hook} ne lance aucun \`.mjs\` lisible`)
  const racine = arbreDesModules()
  try {
    const sonde = spawnSync('sh', ['-c', 'node -p process.versions.node'], {
      cwd: racine,
      env: { ...envNu(), NODE_OPTIONS: '--no-experimental-strip-types' },
      encoding: 'utf8',
    })
    assert.equal(sonde.status, 0, sonde.stdout + sonde.stderr)
    const versionShell = sonde.stdout.trim()
    assert.match(versionShell, /^\d+\.\d+\.\d+$/)
    const refusShell = new RegExp(`Node ${versionShell.replace(/\./g, '\\.')} ne satisfait pas package\\.json engines\\.node « ${EXIGENCE_INTENABLE} »`)
    for (const hook of HOOKS_SHELL) {
      const r = spawnSync('sh', [join('scripts', 'git-hooks', hook), ...(ARGUMENTS_D_UN_GESTE[hook] ?? [])], {
        cwd: racine,
        env: { ...envNu(), NODE_OPTIONS: '--no-experimental-strip-types' },
        encoding: 'utf8',
      })
      assert.equal(r.status, estPostHook(hook) && !POST_TRANSPARENTS.has(hook) ? 0 : CODE_DE_REFUS, `${hook} : ${r.stdout}${r.stderr}`)
      assert.match(r.stderr, refusShell, hook)
      assert.equal(r.stdout, '', hook)
    }
  } finally {
    rmSync(racine, { recursive: true, force: true })
  }
})

test('la porte refuse sous le code qui BLOQUE un hook d’agent `PreToolUse`', () => {
  const racine = arbreIntenable()
  try {
    const r = spawnSync(process.execPath, [join('scripts', 'node-requis.mjs')], { cwd: racine, env: envNu(), encoding: 'utf8' })
    assert.equal(r.status, CODE_BLOQUANT_PRETOOLUSE, r.stdout + r.stderr)
    assert.match(r.stderr, REFUS)
  } finally {
    rmSync(racine, { recursive: true, force: true })
  }
})

test('hooks d’agent : lus sur `.claude/settings.json` et `.codex/hooks.json`, chaque commande lance un module de `scripts/hooks/`', () => {
  assert.deepEqual(HOOKS_AGENT.filter((h) => !h.script).map((h) => h.path), [])
  assert.ok(MODULES_HOOKS_AGENT.includes('scripts/hooks/repartiteur.mjs'), MODULES_HOOKS_AGENT.join('\n'))
})

test('chargement de `npm run gates`, des `.mjs` des hooks shell, des pilotes de fusion et des hooks d’agent sous un Node sans retrait de types : la porte refuse — `CODE_DE_REFUS`, son message, stdout vide', () => {
  const racine = arbreDesModules()
  try {
    for (const module of MODULES_LANCES) {
      const r = spawnSync(process.execPath, ['--no-experimental-strip-types', module], { cwd: racine, env: envNu(), encoding: 'utf8' })
      assert.equal(r.status, CODE_DE_REFUS, `${module} : ${r.stdout}${r.stderr}`)
      assert.match(r.stderr, REFUS, module)
      assert.equal(r.stdout, '', module)
    }
  } finally {
    rmSync(racine, { recursive: true, force: true })
  }
})
