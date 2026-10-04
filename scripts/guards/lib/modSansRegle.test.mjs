// Garde de classe #2278 : un mod Claude Code ne porte aucune règle du régime.
// Le détecteur est prouvé sur des sources forgées, puis appliqué au dossier RÉEL `.claude/skills`.
import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ACCES_PERMIS, COUTURE, fautesDeModule, modsSansRegle, racinesDeMods } from './modSansRegle.mjs'

const SKILLS = fileURLToPath(new URL('../../../.claude/skills/', import.meta.url))

/** Un dossier `.claude/skills` forgé : `{ 'mod/chemin': contenu }`, effacé par `t.after`. */
function skillsForges(t, fichiers) {
  const racine = mkdtempSync(join(tmpdir(), 'mod-sans-regle-'))
  t.after(() => rmSync(racine, { recursive: true, force: true }))
  for (const [chemin, contenu] of Object.entries(fichiers)) {
    mkdirSync(dirname(join(racine, chemin)), { recursive: true })
    writeFileSync(join(racine, chemin), contenu)
  }
  return racine
}

const MANIFESTE = '{ "name": "m", "version": "0.0.1" }'

const OPS_CONFORME = [
  "import type { Api } from 'claude-code'",
  'export async function lire($: Api, argv: string[]) {',
  "  const r = await $.process.run(['node', `${$.plugin.root}/../../scripts/x.mjs`, ...argv, '--json'])",
  '  if (r.exitCode) $.ui.log(r.stderr)',
  '  return JSON.parse(r.stdout)',
  '}',
].join('\n')

const REGISTER_CONFORME = [
  "import type { Register } from 'claude-code'",
  "import { lire } from './ops'",
  'export const register: Register = (on) => {',
  "  on('session.start', async ($, e, next) => {",
  "    $.clock.every(() => $.ui.invalidate('suivi'), 30000)",
  "    $.state.set('suivi', await lire($, ['--session', $.session.id()]))",
  "    $.ui.log('suivi lu')",
  '    return next(e)',
  '  })',
  '}',
].join('\n')

test('fautesDeModule : un seuil, `$` affecté, un accès hors liste, du parsing, un `ask` sont des fautes ; leur MENTION ne l’est pas', () => {
  const cas = [
    ['if (n > 3) f()', true, 'seuil `>`'],
    ['if (n >= 3) f()', true, 'seuil `>=`'],
    ['if (3 < n) f()', true, 'seuil à gauche'],
    ['const pair = n % 2', true, 'modulo'],
    ['const s = ms / 1000', true, 'division par un littéral'],
    ['const f = () => 0', false, 'flèche vers un littéral'],
    ['const x = a.length', false, 'lecture de propriété'],
    ['const { ui } = $', true, 'déstructuration de `$`'],
    ['const api = $', true, 'affectation de `$`'],
    ['if (x === $) f()', false, 'comparaison à `$`'],
    ["$.ui.ask('?')", true, '`$.ui.ask(`'],
    ["return { ask: 'question' }", true, 'retour `{ ask: … }`'],
    ["const d = 'ask'", true, 'littéral `ask`'],
    ["await $.fs.read('x')", true, '`$.fs.read` hors couture'],
    ['const o = JSON.parse(t)', true, '`JSON.parse` hors couture'],
    ["await $.process.run(['node'])", true, '`$.process.run` hors couture'],
    ["t.split(',')", true, '`.split(`'],
    ['t.match(m)', true, '`.match(`'],
    ['t.replaceAll(a, b)', true, '`.replaceAll(`'],
    ["new RegExp('x')", true, '`RegExp`'],
    ['const ok = /^#\\d+/.test(t)', true, 'littéral de regexp'],
    ["$.ui.invalidate('prompt.context')", true, 'invalidation du contexte de prompt'],
    ['$.ui.invalidate("prompt.section")', true, 'invalidation d’une section de prompt'],
    ["$.ui.invalidate('suivi')", false, 'invalidation d’une vue'],
    ["$.state.get('suivi')", false, '`$.state.<méthode>`'],
    ['$.clock.every(f, 30000)', false, '`$.clock.every`'],
    ["$.session.append('x')", false, '`$.session.append`'],
    ['// if (n > 3) $.fs.read(JSON.parse(x))', false, 'commentaire'],
    ["const t = 'n > 3, $.fs.read, a.split(b)'", false, 'chaîne'],
  ]
  for (const [source, attendu, quoi] of cas) {
    assert.equal(fautesDeModule(source).length > 0, attendu, `${quoi} — source : ${source}`)
  }
})

test('fautesDeModule : dans la couture, seuls `$.process.run`, `$.plugin.root`, `$.ui.log` et `JSON.parse`', () => {
  assert.deepEqual(fautesDeModule(OPS_CONFORME, { couture: true }), [])
  const cas = [
    ["$.ui.resolve('x')", '`$.ui.resolve`'],
    ["$.state.set('x', 1)", '`$.state`'],
    ["await $.fs.read('x')", '`$.fs.read`'],
    ['if (r.exitCode > 0) f()', 'seuil'],
    ["r.stdout.split('\\n')", 'parsing'],
    ["return { ask: 'q' }", '`ask`'],
  ]
  for (const [source, quoi] of cas) assert.ok(fautesDeModule(source, { couture: true }).length > 0, `${quoi} dans la couture — ${source}`)
})

test('fautesDeModule : chaque faute est rapportée à SA ligne, texte source et motif inclus', () => {
  assert.deepEqual(fautesDeModule('// en-tête\nif (n > 3) f()'), [
    { ligne: 2, texte: 'if (n > 3) f()', motif: 'seuil (comparaison ou arithmétique contre un littéral numérique)' },
  ])
})

test('ANGLE MORT, dit : `codeSeul` blanchit les chaînes — un nom de section porté par une constante ou un gabarit échappe à la garde', () => {
  assert.deepEqual(fautesDeModule("const S = 'prompt.context'\n$.ui.invalidate(S)"), [])
  assert.deepEqual(fautesDeModule('$.ui.invalidate(`prompt.${"context"}`)'), [])
})

test('ACCES_PERMIS porte une ligne par accès, sans doublon', () => {
  assert.equal(new Set(ACCES_PERMIS).size, ACCES_PERMIS.length)
  assert.ok(ACCES_PERMIS.every((a) => /^[a-z]+\.(?:[a-z]+|\*)$/i.test(a)), ACCES_PERMIS.join(', '))
})

test('modsSansRegle : un mod conforme est VERT, ses bancs `*.test.ts` sont hors champ', (t) => {
  const skills = skillsForges(t, {
    'bon/.claude-plugin/plugin.json': MANIFESTE,
    'bon/hooks/hooks.json': '{ "modules": ["./register.ts"] }',
    [`bon/${COUTURE}`]: OPS_CONFORME,
    'bon/hooks/register.ts': REGISTER_CONFORME,
    'bon/hooks/register.test.ts': "on('process.run', async () => ({ value: JSON.parse('{}') }))\nif (n > 3) f()",
  })
  assert.deepEqual(racinesDeMods(skills), [join(skills, 'bon')])
  assert.deepEqual(modsSansRegle(skills), [])
})

test('modsSansRegle : les fautes d’un mod sont NOMMÉES (fichier, ligne) ; un `.tsx` est refusé ; une racine sans plugin.json est hors champ', (t) => {
  const skills = skillsForges(t, {
    'mal/.claude-plugin/plugin.json': MANIFESTE,
    [`mal/${COUTURE}`]: OPS_CONFORME,
    'mal/hooks/seuil.ts': 'export const f = (n: number) => n > 3',
    'mal/hooks/sous/lire.ts': "export const g = ($: any) => $.process.run(['node'])",
    'mal/hooks/vue.tsx': 'export const V = () => h("div")',
    'skill-nu/hooks/x.ts': 'if (n > 3) f()',
  })
  assert.deepEqual(
    modsSansRegle(skills).map((f) => `${f.fichier}:${f.ligne}`),
    ['mal/hooks/seuil.ts:1', 'mal/hooks/sous/lire.ts:1', 'mal/hooks/vue.tsx:0'],
  )
})

test('aucun mod de .claude/skills/ ne porte une règle du régime (#2278)', () => {
  assert.deepEqual(
    modsSansRegle(SKILLS).map((f) => `.claude/skills/${f.fichier}:${f.ligne} ${f.motif} — ${f.texte}`),
    [],
    'un mod REND, les scripts MESURENT : la mesure et sa règle vivent dans un script lu par la couture ' +
      `\`${COUTURE}\` (sortie --json) ; un accès au moteur neuf s’ajoute à ACCES_PERMIS (scripts/guards/lib/modSansRegle.mjs)`,
  )
})
