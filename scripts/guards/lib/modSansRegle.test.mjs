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
  'export type Lu<T> = { ok: true, valeur: T } | { ok: false, motif: string }',
  'export function appel(racinePlugin: string, script: string, args: string[]) {',
  "  const depot = `${racinePlugin}/../../..`",
  "  return [['node', `${depot}/scripts/ops/${script}.mjs`, ...args, '--json'], { cwd: depot, timeoutMs: 10_000 }] as const",
  '}',
  'export function lire<T>(resultat: { exitCode: number, stdout: string }): Lu<T> {',
  "  if (resultat.exitCode) return { ok: false, motif: 'script en échec' }",
  '  const valeur = JSON.parse(resultat.stdout)',
  "  return typeof valeur === 'object' && valeur ? { ok: true, valeur } : { ok: false, motif: 'forme inattendue' }",
  '}',
].join('\n')

const REGISTER_CONFORME = [
  "import type { Register } from 'claude-code'",
  "import { appel, lire } from './ops'",
  'export const register: Register = (on) => {',
  "  on('session.start', async ($, e, next) => {",
  "    $.clock.every(() => $.ui.invalidate('suivi'), 30000)",
  "    const lu = lire(await $.process.run(...appel($.plugin.root, 'suivi', ['--session', $.session.id()])))",
  "    const autre = lire(await $.process.run(",
  "      ...appel( $.plugin.root , 'suivi', ['--etat'])))",
  "    if (lu.ok) $.state.set('suivi', lu.valeur)",
  "    else $.ui.log(lu.motif)",
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
    ["$.ui.log('x')", false, '`$.ui.log`'],
    ['// if (n > 3) $.fs.read(JSON.parse(x))', false, 'commentaire'],
    ["const t = 'n > 3, $.fs.read, a.split(b)'", false, 'chaîne'],
  ]
  for (const [source, attendu, quoi] of cas) {
    assert.equal(fautesDeModule(source).length > 0, attendu, `${quoi} — source : ${source}`)
  }
})

test('fautesDeModule : un script se lance par l’IDIOME `$.process.run(...appel($.plugin.root, …)` et par lui seul', () => {
  const idiome = [
    "await $.process.run(...appel($.plugin.root, 'suivi', []))",
    "await $.process.run( ... appel ( $.plugin.root , 'suivi', []))",
    "await $.process.run(\n  ...appel($.plugin.root, 'suivi', []))",
  ]
  for (const source of idiome) assert.deepEqual(fautesDeModule(source), [], `idiome — ${source}`)
  const hors = [
    ["await $.process.run(['node', 'scripts/ops/suivi.mjs'])", 'lancement direct'],
    ['const racine = $.plugin.root', '`$.plugin.root` hors idiome'],
    ["await $.process.run(...appel(racine, 'suivi', []))", 'idiome sans `$.plugin.root`'],
    ["await $.process.run(...autre($.plugin.root, 'suivi', []))", 'idiome sur un autre formateur'],
  ]
  for (const [source, quoi] of hors) {
    assert.ok(fautesDeModule(source).some((f) => f.motif === 'lancement hors idiome'), `${quoi} — ${source}`)
  }
})

test('fautesDeModule : la couture est PURE — aucun `$`, `JSON.parse` permis là seulement', () => {
  assert.deepEqual(fautesDeModule(OPS_CONFORME, { couture: true }), [])
  const cas = [
    ["await $.process.run(['node'])", '`$.process.run`'],
    ['const r = $.plugin.root', '`$.plugin.root`'],
    ["$.ui.log('x')", '`$.ui.log`'],
    ['export function f($: Api) {}', '`$` en paramètre'],
    ['if (r.exitCode > 0) f()', 'seuil'],
    ["r.stdout.split('\\n')", 'parsing'],
    ["return { ask: 'q' }", '`ask`'],
  ]
  for (const [source, quoi] of cas) assert.ok(fautesDeModule(source, { couture: true }).length > 0, `${quoi} dans la couture — ${source}`)
  assert.deepEqual(fautesDeModule('const n = `${a}`', { couture: true }), [], 'le `${` d’un gabarit n’est pas `$`')
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
    [`mal/${COUTURE}`]: `${OPS_CONFORME}\nexport const r = ($: any) => $.plugin.root`,
    'mal/hooks/seuil.ts': 'export const f = (n: number) => n > 3',
    'mal/hooks/sous/lire.ts': "export const g = ($: any) => $.process.run(['node'])",
    'mal/hooks/vue.tsx': 'export const V = () => h("div")',
    'skill-nu/hooks/x.ts': 'if (n > 3) f()',
  })
  assert.deepEqual(
    modsSansRegle(skills).map((f) => `${f.fichier}:${f.ligne} ${f.motif}`),
    [
      'mal/hooks/ops.ts:11 `$` dans la couture : elle est pure',
      'mal/hooks/seuil.ts:1 seuil (comparaison ou arithmétique contre un littéral numérique)',
      'mal/hooks/sous/lire.ts:1 lancement hors idiome',
      'mal/hooks/vue.tsx:0 module JSX : un mod s’écrit en `.ts` avec `h()`',
    ],
  )
})

test('aucun mod de .claude/skills/ ne porte une règle du régime (#2278)', () => {
  assert.deepEqual(
    modsSansRegle(SKILLS).map((f) => `.claude/skills/${f.fichier}:${f.ligne} ${f.motif} — ${f.texte}`),
    [],
    'un mod REND, les scripts MESURENT : la mesure et sa règle vivent dans un script lancé par ' +
      `\`$.process.run(...appel($.plugin.root, …)\` et lu par la couture pure \`${COUTURE}\` (sortie --json) ; ` +
      'un accès au moteur neuf s’ajoute à ACCES_PERMIS (scripts/guards/lib/modSansRegle.mjs)',
  )
})
