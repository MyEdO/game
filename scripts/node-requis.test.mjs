// Porte de version de Node (#1801) : la règle PURE, puis son CÂBLAGE dans chaque point d'entrée qui
// rend un verdict, tel que `package.json` le déclare, joué sur un FAUX ARBRE en dossier temporaire
// dont `engines.node` exige un Node inexistant :
//   - `.npmrc` : VRAIS `.npmrc` et porte copiés ;
//   - les modules Node (`npm run gates`, `.mjs` des hooks shell du `core.hooksPath`, pilotes
//     `merge.<nom>.driver`, hooks d'agent de `.claude/settings.json` et `.codex/hooks.json`) : chacun
//     EXÉCUTÉ avec sa clôture d'imports copiée — les hooks shell par leur VRAI script —, sous
//     `--no-experimental-strip-types` — le chargement d'un Node 22 < 22.18 ;
//     sa clôture STATIQUE lue ne porte ni module TypeScript ni attribut d'import (Node < 22.18, < 20.10) ;
//     son AST pose la porte en PREMIÈRE requête de module, donc avant toute autre évaluation.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { SURFACE_CLAUDE, SURFACE_CODEX, aplatirHooks } from './agents/compat-core.mjs'
import { scriptKindDe, typescript } from './guards/lib/dialecte.mjs'
import { clotureDImports } from './guards/lib/importGraph.mjs'
import { listerDossier } from './guards/lib/lister.mjs'
import { CODE_DE_REFUS, refusDeVersion } from './node-requis.mjs'

const RACINE = fileURLToPath(new URL('..', import.meta.url))
const { scripts: SCRIPTS } = JSON.parse(readFileSync(join(RACINE, 'package.json'), 'utf8'))
/** Le dossier de hooks que `postinstall` déclare à git (`core.hooksPath`). */
const DOSSIER_HOOKS = join(RACINE, /core\.hooksPath (\S+)/.exec(SCRIPTS.postinstall)[1])
/** Les hooks shell : chaque fichier du dossier de hooks sans extension. */
const HOOKS_SHELL = listerDossier(DOSSIER_HOOKS).filter((f) => !f.includes('.'))
/** Les modules Node lancés sans hook shell : `npm run gates` et chaque pilote `merge.<nom>.driver` de
 *  `postinstall`. */
const PILOTES = [...new Set([...SCRIPTS.postinstall.matchAll(/merge\.[\w-]+\.driver "node (\S+)/g)].map((m) => m[1]))]
/** Les hooks d'agent : chaque commande des deux configurations, aplatie par le lecteur de la parité. */
const HOOKS_AGENT = [SURFACE_CLAUDE, SURFACE_CODEX].flatMap((surface) =>
  aplatirHooks(JSON.parse(readFileSync(join(RACINE, surface), 'utf8')), surface),
)
const MODULES_HOOKS_AGENT = [...new Set(HOOKS_AGENT.filter((h) => h.script).map((h) => `scripts/hooks/${h.script}`))]
/** Les `.mjs` qu'un hook shell lance à côté de lui, `"$(dirname "$0")/<nom>.mjs"`. */
const modulesDuHook = (texte) => [...texte.matchAll(/"\$\(dirname "\$0"\)\/([\w-]+\.mjs)"/g)].map((m) => m[1])
/** Hook shell → les `.mjs` qu'il lance, relatifs à `RACINE`. */
const MODULES_PAR_HOOK = new Map(HOOKS_SHELL.map((hook) => [
  hook,
  modulesDuHook(readFileSync(join(DOSSIER_HOOKS, hook), 'utf8')).map((m) => relative(RACINE, join(DOSSIER_HOOKS, m)).replaceAll('\\', '/')),
]))
const MODULES_DES_HOOKS_SHELL = [...new Set([...MODULES_PAR_HOOK.values()].flat())]
const MODULES_LANCES = [/^node (\S+)/.exec(SCRIPTS.gates)[1], ...MODULES_DES_HOOKS_SHELL, ...PILOTES, ...MODULES_HOOKS_AGENT]
/** Claude Code : seul le code de sortie 2 d'un hook `PreToolUse` bloque l'outil. */
const CODE_BLOQUANT_PRETOOLUSE = 2
/** githooks(5) : un hook `post-*` ne peut pas faire échouer l'opération qui vient d'avoir lieu. */
const estPostHook = (hook) => hook.startsWith('post-')
/** githooks(5) : les arguments que git passe au hook dans le geste qui le fait AGIR — `post-checkout`
 *  un changement de BRANCHE (`$3` = 1), `post-rewrite` un `rebase`. Les autres refusent avant de les lire. */
const ARGUMENTS_D_UN_GESTE = { 'post-checkout': ['0'.repeat(40), 'f'.repeat(40), '1'], 'post-rewrite': ['rebase'] }
const EXIGENCE_INTENABLE = '>=999.0.0'

test('refus : version inférieure sur le majeur, le mineur ou le correctif', () => {
  for (const version of ['21.99.99', '22.17.9', '22.18.0']) {
    assert.match(refusDeVersion('>=22.18.1', version), new RegExp(`Node ${version.replace(/\./g, '\\.')} .*« >=22\\.18\\.1 »`))
  }
})

test('accord : version égale ou supérieure, préfixe `v` et suffixe de pré-version tolérés', () => {
  for (const version of ['22.18.0', '22.18.1', '22.23.2', '23.0.0', 'v24.1.0', '25.0.0-nightly2026']) {
    assert.equal(refusDeVersion('>=22.18.0', version), null, version)
  }
})

test('plage absente ou hors forme `>=M.m.p` : refus qui la nomme', () => {
  for (const plage of [undefined, '^22.18.0', '>=22.18', '>=22.18.0 <23', '22.18.0']) {
    assert.match(refusDeVersion(plage, '22.23.2'), /forme `>=M\.m\.p`/, String(plage))
  }
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
  return racine
}

/** Chemin POSIX relatif à `RACINE` d'un membre de clôture (rendu relatif au cwd s'il y vit). */
const depuisRacine = (membre) => relative(RACINE, resolve(membre)).replaceAll('\\', '/')

/** L'arbre intenable, plus la clôture d'imports de chaque module lancé, les hooks shell réels et le
 *  `node_modules` réel. */
function arbreDesModules() {
  const racine = arbreIntenable()
  for (const membre of clotureDImports(MODULES_LANCES.map((m) => join(RACINE, m)))) {
    const rel = depuisRacine(membre)
    mkdirSync(dirname(join(racine, rel)), { recursive: true })
    copyFileSync(join(RACINE, rel), join(racine, rel))
  }
  for (const hook of HOOKS_SHELL) copyFileSync(join(DOSSIER_HOOKS, hook), join(racine, 'scripts', 'git-hooks', hook))
  symlinkSync(join(RACINE, 'node_modules'), join(racine, 'node_modules'), 'junction')
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
    for (const hook of HOOKS_SHELL) {
      const r = spawnSync('sh', [join('scripts', 'git-hooks', hook), ...(ARGUMENTS_D_UN_GESTE[hook] ?? [])], {
        cwd: racine,
        env: { ...envNu(), NODE_OPTIONS: '--no-experimental-strip-types' },
        encoding: 'utf8',
      })
      assert.equal(r.status, estPostHook(hook) ? 0 : CODE_DE_REFUS, `${hook} : ${r.stdout}${r.stderr}`)
      assert.match(r.stderr, REFUS, hook)
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
  for (const entree of ['scripts/hooks/repartiteur.mjs', 'scripts/hooks/solde-ticket-hook.mjs'])
    assert.ok(MODULES_HOOKS_AGENT.includes(entree), MODULES_HOOKS_AGENT.join('\n'))
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

test('clôture STATIQUE de `npm run gates`, des `.mjs` des hooks shell, des pilotes de fusion et des hooks d’agent : aucun module TypeScript, aucun attribut d’import', () => {
  const ts = typescript()
  const cache = new Map()
  const fautes = []
  for (const module of MODULES_LANCES) {
    for (const membre of clotureDImports([join(RACINE, module)], { cache, dynamiques: false })) {
      const rel = depuisRacine(membre)
      if (/\.[cm]?tsx?$/.test(rel)) {
        fautes.push(`${module} > ${rel} : module TypeScript`)
        continue
      }
      if (!/\.[cm]?js$/.test(rel)) continue
      const chemin = join(RACINE, rel)
      const source = ts.createSourceFile(chemin, readFileSync(chemin, 'utf8'), ts.ScriptTarget.Latest, true, scriptKindDe(chemin))
      for (const s of source.statements) {
        if ((ts.isImportDeclaration(s) || ts.isExportDeclaration(s)) && s.attributes) {
          fautes.push(`${module} > ${rel}:${source.getLineAndCharacterOfPosition(s.getStart()).line + 1} : attribut d’import`)
        }
      }
    }
  }
  assert.deepEqual(fautes, [])
})

test('câblage de `npm run gates`, des `.mjs` des hooks shell, des pilotes de fusion et des hooks d’agent : la PREMIÈRE requête de module de chacun est la porte', () => {
  assert.ok(PILOTES.length, `aucun pilote de fusion lu dans postinstall : ${SCRIPTS.postinstall}`)
  const ts = typescript()
  for (const module of MODULES_LANCES) {
    const chemin = join(RACINE, module)
    const source = ts.createSourceFile(chemin, readFileSync(chemin, 'utf8'), ts.ScriptTarget.Latest, true, scriptKindDe(chemin))
    const premiere = source.statements.find((s) => (ts.isImportDeclaration(s) || ts.isExportDeclaration(s)) && s.moduleSpecifier)
    const porte = relative(dirname(chemin), join(RACINE, 'scripts', 'node-requis.mjs')).replaceAll('\\', '/')
    assert.equal(premiere?.moduleSpecifier.text, porte.startsWith('.') ? porte : `./${porte}`, module)
    assert.equal(premiere.importClause, undefined, `${module} : la porte s’importe pour son seul effet d’évaluation`)
  }
})
