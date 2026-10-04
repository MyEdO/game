// Porte `mods:check` (#2278) éprouvée par un lanceur FACTICE : aucun vrai `claude` ne part.
import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { tableTotale } from '../../src/lib/tableTotale.ts'
import { racinesDeMods } from '../guards/lib/modSansRegle.mjs'
import {
  CLES_RETIREES, ENTETE_TYPES, ETAPES, TYPES, VERSION_CLAUDE, envNettoye, resoudreClaude, verifier,
} from './verifier.mjs'

/** Un dossier jetable, effacé par `t.after`. */
function jetable(t, prefixe) {
  const d = mkdtempSync(join(tmpdir(), prefixe))
  t.after(() => rmSync(d, { recursive: true, force: true }))
  return d
}

/** Un mod forgé sous `racine/nom`. */
function modForge(racine, nom) {
  const mod = join(racine, nom)
  mkdirSync(join(mod, '.claude-plugin'), { recursive: true })
  mkdirSync(join(mod, 'hooks'))
  writeFileSync(join(mod, '.claude-plugin', 'plugin.json'), `{ "name": "${nom}", "version": "0.0.1" }`)
  writeFileSync(join(mod, 'hooks', 'register.ts'), 'export const register = () => {}\n')
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
 * Lanceur factice : journalise chaque appel ; `rouge` = l'étape qui sort 1 ; `entete` = la 1re
 * ligne des types que `-p` pose (`null` : il n'en pose aucun). `-p` sort 1 comme sans identifiants (S6).
 */
function lanceurFactice({ rouge = null, entete = ENTETE_TYPES, version = `${VERSION_CLAUDE} (Claude Code)` } = {}) {
  const appels = []
  const lancer = (argv, options = {}) => {
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
  return { lancer, appels }
}

test('un mod vert : les étapes se jouent dans l’ORDRE, la sortie 1 de `claude -p` est ignorée', (t) => {
  const mod = modForge(jetable(t, 'mods-src-'), 'm')
  const { lancer, appels } = lanceurFactice()
  assert.deepEqual(verifier([mod], { lancer, racineTemp: jetable(t, 'mods-tmp-') }), [])
  assert.deepEqual(appels.map((a) => a.etape), ['version', 'validate', 'types', 'tsc', 'test'])
  assert.deepEqual(ETAPES.filter((e) => e !== 'copie'), ['validate', 'types', 'tsc', 'test'])
  assert.deepEqual(appels[1].argv.slice(-3), ['validate', '--strict', mod], '`validate` porte sur la SOURCE')
  assert.ok(appels[3].argv.includes('--project'), '`tsc --project <copie>`')
})

test('chaque étape rouge est NOMMÉE (mod, étape, sortie) et arrête ce mod', (t) => {
  for (const etape of ['validate', 'tsc', 'test']) {
    const mod = modForge(jetable(t, 'mods-src-'), 'm')
    const { lancer, appels } = lanceurFactice({ rouge: etape })
    assert.deepEqual(verifier([mod], { lancer, racineTemp: jetable(t, 'mods-tmp-') }), [{ mod: 'm', etape, sortie: `panne ${etape}` }])
    assert.equal(appels.at(-1).etape, etape, `rien ne se joue après l’étape ${etape}`)
  }
})

test('l’étape `copie` rouge est nommée : une source illisible ne se copie pas', (t) => {
  const { lancer } = lanceurFactice()
  const [r] = verifier([join(jetable(t, 'mods-src-'), 'absent')], { lancer, racineTemp: jetable(t, 'mods-tmp-') })
  assert.deepEqual([r.mod, r.etape], ['absent', 'copie'])
})

test('preuve POSITIVE des types : fichier absent → rouge ; mauvaise version en 1re ligne → rouge', (t) => {
  const cas = [
    [null, `${TYPES} absent`],
    ['// Written by Claude Code 2.1.288.', '1re ligne « // Written by Claude Code 2.1.288. »'],
  ]
  for (const [entete, attendu] of cas) {
    const mod = modForge(jetable(t, 'mods-src-'), 'm')
    const { lancer, appels } = lanceurFactice({ entete })
    const [r] = verifier([mod], { lancer, racineTemp: jetable(t, 'mods-tmp-') })
    assert.equal(r.etape, 'types')
    assert.ok(r.sortie.includes(attendu), r.sortie)
    assert.ok(r.sortie.includes('Not logged in'), 'la sortie du moteur accompagne le rouge')
    assert.equal(appels.at(-1).etape, 'types')
  }
})

test('`claude -p` part sous un env NETTOYÉ : identifiants retirés, HOME et profils vers le temporaire, cwd = ce HOME', (t) => {
  const mod = modForge(jetable(t, 'mods-src-'), 'm')
  const { lancer, appels } = lanceurFactice()
  const env = { GARDEE: 'oui', ...tableTotale(CLES_RETIREES, () => 'secret') }
  verifier([mod], { lancer, racineTemp: jetable(t, 'mods-tmp-'), env })
  const p = appels.find((a) => a.etape === 'types')
  for (const cle of CLES_RETIREES) assert.equal(p.options.env[cle], undefined, `${cle} retirée`)
  for (const cle of ['HOME', 'USERPROFILE', 'APPDATA', 'LOCALAPPDATA']) assert.equal(p.options.env[cle], p.options.cwd, cle)
  assert.equal(p.options.env.GARDEE, 'oui', 'le reste de l’env passe')
  assert.ok(p.argv.includes('--max-turns') && p.argv.includes('OK'))
  assert.equal(appels.find((a) => a.etape === 'tsc').options.env.ANTHROPIC_API_KEY, 'secret', 'seul `-p` est nettoyé')
})

test('envNettoye : le cache npm est GARDÉ, l’env de base n’est pas muté', () => {
  const base = { ANTHROPIC_API_KEY: 'k', npm_config_cache: '/cache' }
  const env = envNettoye(base, '/h')
  assert.equal(env.npm_config_cache, '/cache')
  assert.equal(env.ANTHROPIC_API_KEY, undefined)
  assert.equal(base.ANTHROPIC_API_KEY, 'k')
})

test('resoudreClaude : le `claude` du PATH à la version épinglée, sinon `npx` de la MÊME version', () => {
  assert.deepEqual(resoudreClaude(lanceurFactice().lancer), ['claude'])
  const npx = ['npx', '-y', `@anthropic-ai/claude-code@${VERSION_CLAUDE}`]
  assert.deepEqual(resoudreClaude(lanceurFactice({ version: '2.2.0 (Claude Code)' }).lancer), npx)
  assert.deepEqual(resoudreClaude(() => ({ status: null, sortie: 'ENOENT' })), npx)
})

test('découverte : une racine sans plugin.json est ignorée ; aucun mod → aucun lancement', (t) => {
  const skills = jetable(t, 'mods-skills-')
  const mod = modForge(skills, 'avec')
  mkdirSync(join(skills, 'sans', 'hooks'), { recursive: true })
  assert.deepEqual(racinesDeMods(skills), [mod])
  const { lancer, appels } = lanceurFactice()
  assert.deepEqual(verifier([], { lancer }), [])
  assert.deepEqual(appels, [])
})

test('les temporaires sont effacés, en vert comme en rouge', (t) => {
  for (const rouge of [null, 'validate', 'tsc']) {
    const racineTemp = jetable(t, 'mods-tmp-')
    const { lancer } = lanceurFactice({ rouge })
    verifier([modForge(jetable(t, 'mods-src-'), 'm')], { lancer, racineTemp })
    assert.deepEqual(readdirSync(racineTemp), [], `résidu après ${rouge ?? 'vert'}`)
  }
})
