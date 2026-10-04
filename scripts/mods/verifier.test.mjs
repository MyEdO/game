// Garde `mods:check` (#2278) éprouvée par un lanceur FACTICE : aucun vrai `claude` ne part. Le lancement
// réel (`lancer`, par l'hôte de processus) n'est joué que sur `node`, pour l'argument à espace.
import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { racinesDeMods, racinesDeModsParmi } from './racines.mjs'
import {
  ENTETE_TYPES, ETAPES, PAQUET_CLAUDE, PROFILS, TYPES, VERSION_CLAUDE, envBlanc, lancer, npxCli, resoudreClaude, verifier,
} from './verifier.mjs'

/** Un dossier jetable, effacé par `t.after`. */
function jetable(t, prefixe) {
  const d = mkdtempSync(join(tmpdir(), prefixe))
  t.after(() => rmSync(d, { recursive: true, force: true }))
  return d
}

/** Un mod forgé sous `racine/nom`, avec un banc sauf `{ banc: false }`. */
function modForge(racine, nom, { banc = true } = {}) {
  const mod = join(racine, nom)
  mkdirSync(join(mod, '.claude-plugin'), { recursive: true })
  mkdirSync(join(mod, 'hooks'))
  writeFileSync(join(mod, '.claude-plugin', 'plugin.json'), `{ "name": "${nom}", "version": "0.0.1" }`)
  writeFileSync(join(mod, 'hooks', 'register.ts'), 'export const register = () => {}\n')
  if (banc) writeFileSync(join(mod, 'hooks', 'register.test.ts'), 'export {}\n')
  return mod
}

/** L'étape d'un argv lancé, lue à sa forme. */
function etapeDe(argv) {
  if (argv.includes('--version')) return 'version'
  if (argv.includes('validate')) return 'validate'
  if (argv.includes('-p')) return 'types'
  if (argv.some((a) => a.endsWith('tsc'))) return 'tsc'
  if (argv.includes('test')) return 'test'
  return '?'
}

/**
 * Lanceur factice : journalise chaque appel ; `rouge` = l'étape qui sort 1 ; `entete` = la 1re ligne des
 * types que `-p` pose (`null` : il n'en pose aucun). `-p` sort 1 comme sans identifiants (S6).
 */
function lanceurFactice({ rouge = null, entete = ENTETE_TYPES, version = `${VERSION_CLAUDE} (Claude Code)` } = {}) {
  const appels = []
  const lanceur = (argv, options) => {
    const etape = etapeDe(argv)
    appels.push({ etape, argv, options })
    if (etape === 'version') return { status: 0, sortie: version }
    if (etape === 'types') {
      const copie = argv[argv.indexOf('--plugin-dir') + 1]
      if (entete !== null) {
        mkdirSync(dirname(join(copie, TYPES)), { recursive: true })
        writeFileSync(join(copie, TYPES), `${entete}\n// suite\n`)
      }
      return { status: 1, sortie: 'Not logged in' }
    }
    return etape === rouge ? { status: 1, sortie: `panne ${etape}` } : { status: 0, sortie: 'ok' }
  }
  return { lanceur, appels }
}

test('un mod vert : les étapes se jouent dans l’ORDRE, toutes sur la COPIE, la sortie 1 de `claude -p` ignorée', (t) => {
  const mod = modForge(jetable(t, 'mods-src-'), 'm')
  const { lanceur, appels } = lanceurFactice()
  assert.deepEqual(verifier([mod], { lanceur, racineTemp: jetable(t, 'mods-tmp-') }), [])
  assert.deepEqual(appels.map((a) => a.etape), ['version', 'validate', 'types', 'tsc', 'test'])
  assert.deepEqual(ETAPES, ['bancs', 'copie', 'validate', 'types', 'tsc', 'test'])
  for (const { etape, argv } of appels.slice(1)) assert.ok(!argv.includes(mod), `${etape} ne nomme pas la source`)
  assert.deepEqual(appels[1].argv.slice(-3, -1), ['validate', '--strict'])
  assert.equal(appels[1].argv.at(-1), appels[2].argv[appels[2].argv.indexOf('--plugin-dir') + 1], '`validate` porte sur la copie')
  assert.ok(appels[3].argv.includes('--project'), '`tsc --project <copie>`')
})

test('chaque étape rouge est NOMMÉE (mod, étape, sortie) et arrête ce mod', (t) => {
  for (const etape of ['validate', 'tsc', 'test']) {
    const mod = modForge(jetable(t, 'mods-src-'), 'm')
    const { lanceur, appels } = lanceurFactice({ rouge: etape })
    assert.deepEqual(verifier([mod], { lanceur, racineTemp: jetable(t, 'mods-tmp-') }), [{ mod: 'm', etape, sortie: `panne ${etape}` }])
    assert.equal(appels.at(-1).etape, etape, `rien ne se joue après l’étape ${etape}`)
  }
})

test('un mod SANS banc `*.test.ts` est rouge à l’étape `bancs`, avant tout lancement', (t) => {
  const mod = modForge(jetable(t, 'mods-src-'), 'm', { banc: false })
  const { lanceur, appels } = lanceurFactice()
  const [r] = verifier([mod], { lanceur, racineTemp: jetable(t, 'mods-tmp-') })
  assert.deepEqual([r.mod, r.etape], ['m', 'bancs'])
  assert.deepEqual(appels.map((a) => a.etape), ['version'])
})

test('preuve POSITIVE des types : fichier absent → rouge ; mauvaise version en 1re ligne → rouge', (t) => {
  const cas = [
    [null, `${TYPES} absent`],
    ['// Written by Claude Code 2.1.288.', '1re ligne « // Written by Claude Code 2.1.288. »'],
  ]
  for (const [entete, attendu] of cas) {
    const mod = modForge(jetable(t, 'mods-src-'), 'm')
    const { lanceur, appels } = lanceurFactice({ entete })
    const [r] = verifier([mod], { lanceur, racineTemp: jetable(t, 'mods-tmp-') })
    assert.equal(r.etape, 'types')
    assert.ok(r.sortie.includes(attendu), r.sortie)
    assert.ok(r.sortie.includes('Not logged in'), 'la sortie du moteur accompagne le rouge')
    assert.equal(appels.at(-1).etape, 'types')
  }
})

test('COPIE FILTRÉE : des types et un tsconfig restés dans la source, et un `-p` qui ne pose rien → rouge', (t) => {
  const mod = modForge(jetable(t, 'mods-src-'), 'm')
  mkdirSync(dirname(join(mod, TYPES)), { recursive: true })
  writeFileSync(join(mod, TYPES), `${ENTETE_TYPES}\n`)
  writeFileSync(join(mod, 'tsconfig.json'), '{}\n')
  const { lanceur, appels } = lanceurFactice({ entete: null })
  const [r] = verifier([mod], { lanceur, racineTemp: jetable(t, 'mods-tmp-') })
  assert.equal(r?.etape, 'types', 'les types de la source ne prouvent rien de CE run')
  const copie = appels[1].argv.at(-1)
  assert.ok(appels.length > 0 && !existsSync(copie), 'le temporaire est effacé')
})

test('ENV en liste BLANCHE pour chaque appel : aucune `CLAUDE*`, `ANTHROPIC*` ni `XDG_CONFIG_HOME`, profils vers le temporaire', (t) => {
  const mod = modForge(jetable(t, 'mods-src-'), 'm')
  const { lanceur, appels } = lanceurFactice()
  const env = {
    PATH: '/bin', GARDEE_NON: 'x', XDG_CONFIG_HOME: '/x', CLAUDE_CONFIG_DIR: '/vrai/.claude', CLAUDECODE: '1',
    CLAUDE_CODE_MESSAGING_TOKEN: 't', CLAUDE_CODE_SESSION_ID: 's', CLAUDE_CODE_USE_FOUNDRY: '1',
    ANTHROPIC_API_KEY: 'k', ANTHROPIC_BASE_URL: 'http://x',
  }
  verifier([mod], { lanceur, racineTemp: jetable(t, 'mods-tmp-'), env })
  assert.equal(appels.length, 5)
  for (const { etape, options } of appels) {
    const fuites = Object.keys(options.env).filter((cle) => /^(CLAUDE|ANTHROPIC)/.test(cle) || cle === 'XDG_CONFIG_HOME' || cle === 'GARDEE_NON')
    assert.deepEqual(fuites, [], `${etape} : variables héritées hors liste blanche`)
    assert.equal(options.env.PATH, '/bin', `${etape} : PATH passe`)
    for (const cle of PROFILS) assert.notEqual(options.env[cle], undefined, `${etape} : ${cle} posé`)
  }
  const p = appels.find((a) => a.etape === 'types')
  for (const cle of PROFILS) assert.equal(p.options.env[cle], p.options.cwd, `\`-p\` : ${cle} = son cwd temporaire`)
})

test('envBlanc : le cache npm est GARDÉ, l’env de base n’est pas muté', () => {
  const base = { ANTHROPIC_API_KEY: 'k', npm_config_cache: '/cache', PATH: '/bin' }
  const env = envBlanc(base, '/h')
  assert.equal(env.npm_config_cache, '/cache')
  assert.equal(env.ANTHROPIC_API_KEY, undefined)
  assert.equal(env.HOME, '/h')
  assert.equal(base.ANTHROPIC_API_KEY, 'k')
})

test('resoudreClaude : le `claude` du PATH à la version EXACTE, sinon `npx` de la MÊME version, sinon rien', () => {
  const options = { cwd: '.', env: {} }
  assert.deepEqual(resoudreClaude(lanceurFactice().lanceur, options, '/npx-cli.js'), ['claude'])
  const npx = [process.execPath, '/npx-cli.js', '-y', PAQUET_CLAUDE]
  assert.deepEqual(resoudreClaude(lanceurFactice({ version: `${VERSION_CLAUDE}0 (Claude Code)` }).lanceur, options, '/npx-cli.js'), npx)
  assert.deepEqual(resoudreClaude(lanceurFactice({ version: '2.2.0 (Claude Code)' }).lanceur, options, '/npx-cli.js'), npx)
  assert.deepEqual(resoudreClaude(() => ({ status: null, sortie: 'ENOENT' }), options, '/npx-cli.js'), npx)
  assert.equal(resoudreClaude(() => ({ status: null, sortie: 'ENOENT' }), options, null), null)
})

test('sans CLI résoluble, chaque mod est rouge à l’étape `cli`', (t) => {
  const mod = modForge(jetable(t, 'mods-src-'), 'm')
  const [r] = verifier([mod], { lanceur: () => ({ status: null, sortie: 'ENOENT' }), racineTemp: jetable(t, 'mods-tmp-'), npx: null })
  assert.deepEqual([r.mod, r.etape], ['m', 'cli'])
})

test('npxCli : le `npx-cli.js` de la distribution de node qui tourne, lancé par node (ni `.cmd` ni shell)', (t) => {
  const cli = npxCli()
  assert.ok(cli && existsSync(cli), `npx-cli.js introuvable près de ${process.execPath}`)
  assert.equal(npxCli(join(jetable(t, 'mods-node-'), 'node')), null)
})

test('lancer : un argument à ESPACE survit, sans shell, par l’hôte de processus', (t) => {
  const dossier = join(jetable(t, 'mods-espace-'), 'avec espace')
  mkdirSync(dossier)
  const script = join(dossier, 'echo argv.mjs')
  writeFileSync(script, 'process.stdout.write(JSON.stringify(process.argv.slice(2)))\n')
  const r = lancer([process.execPath, script, dossier, 'a b'], { cwd: dossier, env: envBlanc(process.env, dossier) })
  assert.equal(r.status, 0, r.sortie)
  assert.deepEqual(JSON.parse(r.sortie), [dossier, 'a b'])
  const ko = lancer([process.execPath, '-e', 'process.exit(3)'], { cwd: dossier, env: envBlanc(process.env, dossier) })
  assert.equal(ko.status, 3, 'un code non nul est un résultat')
})

test('découverte : une racine sans plugin.json est ignorée ; aucun mod → aucun lancement', (t) => {
  const skills = jetable(t, 'mods-skills-')
  const mod = modForge(skills, 'avec')
  mkdirSync(join(skills, 'sans', 'hooks'), { recursive: true })
  assert.deepEqual(racinesDeMods(skills), [mod])
  const { lanceur, appels } = lanceurFactice()
  assert.deepEqual(verifier([], { lanceur }), [])
  assert.deepEqual(appels, [])
})

test('racinesDeModsParmi : profondeur 4 seule, `.claude-plugin` imbriqué exclu, `mod2/` distinct de `mod/`', () => {
  assert.deepEqual(racinesDeModsParmi([
    '.claude/skills/mod/.claude-plugin/plugin.json',
    '.claude/skills/mod/hooks/a.ts',
    '.claude/skills/skill/sous/.claude-plugin/plugin.json',
    '.claude/skills/mod2/SKILL.md',
    '.claude/autre/x/.claude-plugin/plugin.json',
  ]), ['.claude/skills/mod/'])
})

test('les temporaires sont effacés, en vert comme en rouge', (t) => {
  for (const rouge of [null, 'validate', 'tsc']) {
    const racineTemp = jetable(t, 'mods-tmp-')
    const { lanceur } = lanceurFactice({ rouge })
    verifier([modForge(jetable(t, 'mods-src-'), 'm')], { lanceur, racineTemp })
    assert.deepEqual(readdirSync(racineTemp), [], `résidu après ${rouge ?? 'vert'}`)
  }
})
