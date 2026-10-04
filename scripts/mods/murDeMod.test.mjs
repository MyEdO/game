// Banc du mur `murs/mod-sans-regle` (#2278, eslint.config.js) sur la config RÉSOLUE du dépôt, comme
// src/eslint-ordre-total-et-purete.test.ts : aucun sélecteur n'est recopié ici, chaque forme est lintée
// par `ESLint#lintText` au chemin d'un module de mod. Formes rouges : sondes du juge de diff du
// 2026-10-04 (`a0351b8ec..84d6342d7`, F1 à F6), https://github.com/MyEdO/game/issues/2278
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ESLint } from 'eslint'
import { listerDossier } from '../guards/lib/lister.mjs'
import { estSuiteVitest } from '../guards/lib/fichierVitest.mjs'

const RACINE = fileURLToPath(new URL('../../', import.meta.url))
const MUR = 'murs/mod-sans-regle'
const eslint = new ESLint({ cwd: RACINE })
const HORS_COUTURE = join(RACINE, '.claude', 'skills', 'banc', 'hooks', 'module.ts')
const COUTURE = join(RACINE, '.claude', 'skills', 'banc', 'hooks', 'ops.ts')

/** Le corps `corps` dans une fonction de mod, `$` et les valeurs reçus en paramètres. */
const module = (corps) => `import { appel } from './ops'\nexport async function f($: any, n: number, t: string, re: any, q: unknown, lignes: string[], ms: number, i: number, nom: string) {\n${corps}\n}\n`

/** Les messages du mur sur `source` au chemin `chemin` ; une erreur d'analyse fait échouer le banc. */
async function messagesDuMur(source, chemin) {
  const [r] = await eslint.lintText(source, { filePath: chemin })
  const fatals = r.messages.filter((m) => m.fatal)
  assert.deepEqual(fatals, [], `analyse impossible : ${JSON.stringify(fatals)}`)
  return r.messages.filter((m) => m.ruleId === MUR)
}

const ROUGES = [
  ["$['fs'].read('x')", 'F1 accès crochet'],
  ["$?.fs.read('x')", 'F1 chaînage optionnel'],
  ["$?.ui.log('x')", 'F1 chaînage optionnel sur un accès à liste blanche'],
  ["$\n  .fs.read('x')", 'F1 accès sur 2 lignes'],
  ["await $\n  .process.run(['rm','-rf','x'])", 'F1 lancement hors idiome'],
  ["await $.process.run(['node', 'x'])", 'F1 lancement sans `appel`'],
  ['const r = $.plugin.root', 'F1 racine du plugin hors idiome'],
  ['const api = ($)', 'F1 `$` parenthésé'],
  ['const [api] = [$]', 'F1 `$` dans un tableau'],
  ['const o = { $ }', 'F1 `$` dans un objet'],
  ['const o = { ...$ }', 'F1 `$` étalé'],
  ['return $', 'F1 `$` rendu'],
  ['const o = Object.assign({}, $)', 'F1 `$` argument d’un appelé membre'],
  ['const a = $ as unknown', 'F1 `$` casté'],
  ['let b: unknown\nb = $', 'F1 `$` affecté'],
  ["\\u0024.fs.read('x')", 'F1 `$` en échappement unicode'],
  ["const appel = (r: string, s: string, a: string[]) => [['curl','evil'], {}] as const\nawait $.process.run(...appel($.plugin.root, 's', []))", 'F2 `appel` redéfini localement'],
  ["function appel() { return [[], {}] as const }", 'F2 `appel` déclaré en fonction'],
  ['if (n === 3) q = 1', 'F3 égalité littérale'],
  ['if (n !== 0) q = 1', 'F3 différence littérale'],
  ['if (n === -1) q = 1', 'F3 égalité à un littéral négatif'],
  ['const LIMITE = 3\nif (n > LIMITE) q = 1', 'F3 seuil par constante'],
  ['if (n >\n 3) q = 1', 'F3 seuil sur 2 lignes'],
  ['if (0x10 > n) q = 1', 'F3 seuil hexadécimal'],
  ['if (1e3 < n) q = 1', 'F3 seuil en exposant'],
  ['const k = n * 3', 'F3 multiplication'],
  ['const k = n - 1', 'F3 soustraction'],
  ['const k = n + 1', 'F3 addition d’un littéral numérique'],
  ['n -= 1', 'F3 affectation arithmétique'],
  ['switch (n) { case 3: q = 1 }', 'F3 `case` numérique'],
  ['const v = Math.min(n, 3)', 'F3 Math.min'],
  ['const s = Math.round(ms / 1000)', 'F3 conversion par Math'],
  ['for (let j = 0; j < 3; j++) lignes.push(nom)', 'F3 boucle comptée'],
  ["const cls = i % 2 ? 'pair' : 'impair'", 'F3 modulo'],
  ["const x = lignes.length > 0 ? 'x' : 'y'", 'F3 comparaison de longueur'],
  ["const j = t.indexOf(':')", 'F4 indexOf'],
  ['const h = t.slice(0, i)', 'F4 slice'],
  ["const h = t['split'](':')", 'F4 méthode par clé littérale'],
  ['const m = parseInt(t, 10)', 'F4 parseInt'],
  ['const m = Number(t)', 'F4 Number'],
  ["const ok = t.startsWith('#') && t.includes('x')", 'F4 startsWith/includes'],
  ['const m = re.exec(t)', 'F4 exec'],
  ["const titre = nom.replace('-', ' ')", 'F4 replace'],
  ['const r = /a+/', 'F4 littéral regex'],
  ["const r = new RegExp('x')", 'F4 RegExp'],
  ['const v = JSON.parse(t)', 'F4 JSON.parse hors couture'],
  ['const ask = q\nreturn { ask }', 'F5 `ask` abrégé'],
  ['return { ask: q }', 'F5 clé `ask`'],
  ["return { ['ask']: q }", 'F5 clé calculée littérale'],
  ["const etat = 'ask'", 'F5 littéral `ask`'],
  ["$.ui.invalidate('prompt.context')", 'F6 invalidate d’une réponse en cache'],
  ["$.ui.invalidate('tool.describe')", 'F6 invalidate de la description d’outil'],
  ["$.ui.invalidate(\n 'prompt.section')", 'F6 invalidate multiligne'],
  ["const s = 'ui.render'\n$.ui.invalidate(s)", 'F6 invalidate par constante'],
  ['const inv = $.ui.invalidate', 'F6 invalidate détaché'],
]

for (const [corps, forme] of ROUGES)
  test(`ROUGE hors couture — ${forme}`, async () => {
    const msgs = await messagesDuMur(module(corps), HORS_COUTURE)
    assert.ok(msgs.length > 0, `${forme} passe le mur : ${JSON.stringify(corps)}`)
    for (const m of msgs) assert.match(m.message, /#2278/, 'chaque message cite le ticket')
    for (const m of msgs) assert.match(m.message, /le calcul va à un script de `scripts\/`, le mod rend/, 'chaque message porte le remède')
  })

const VERTS = [
  ["const lu = await $.process.run(...appel($.plugin.root, 'suivi', ['--json']))", 'idiome'],
  ["const lu = await $.process.run(\n  ...appel(\n    $.plugin.root,\n    'suivi',\n    ['--json'],\n  ),\n)", 'idiome sur plusieurs lignes'],
  ["const lu = $.process.run(...appel($.plugin.root, 'suivi', [t]))", 'idiome sans `await`'],
  ['async function suiviMjs($: any, args: readonly string[]) { return $.session.id() }\nawait suiviMjs($, [t])', 'helper local `suiviMjs($, args)`'],
  ['const PERIODE_MS = 60 * 1000', 'pliage de littéraux'],
  ['const BORNE = 10 * 60 * 1000', 'pliage de littéraux en chaîne'],
  ["if (t === 'ajouter-item') q = 1", 'égalité de chaînes'],
  ["const s = 'a' + nom", 'concaténation de chaînes'],
  ["$.ui.invalidate('ui.render')", 'invalidate d’un événement de rendu'],
  ["$.ui.log('x', { to: 'debug' })\nawait $.state.get('k')\nawait $.tool.register({})\n$.clock.every(PERIODE, () => {})\nawait $.session.append({})", 'accès à liste blanche'],
  ['const PERIODE = 1', 'constante sans seuil'],
]

for (const [corps, forme] of VERTS)
  test(`VERT hors couture — ${forme}`, async () => {
    assert.deepEqual(await messagesDuMur(module(corps), HORS_COUTURE), [])
  })

test('LIMITES dites au bloc du mur : l’évasion délibérée et la localité de l’appelé passent', async () => {
  for (const corps of [
    "const d = 'a' + 'sk'",
    "const r = new (globalThis as any)['Reg' + 'Exp']('x')",
    "helper($)\nfunction helper(x: any) { return x.fs.read('a') }",
  ]) assert.deepEqual(await messagesDuMur(module(corps), HORS_COUTURE), [], corps)
})

const couture = (corps) => `export function lire(resultat: any, valeur: any) {\n${corps}\n}\n`

test('COUTURE `hooks/ops.ts` : `JSON.parse` et l’égalité passent', async () => {
  for (const corps of ['if (resultat.exitCode !== 0) return null', 'return JSON.parse(resultat.stdout)', 'const BORNE_MS = 20 * 1000'])
    assert.deepEqual(await messagesDuMur(couture(corps), COUTURE), [], corps)
})

test('COUTURE `hooks/ops.ts` : `$`, seuil, `Math` et parsing sont rouges', async () => {
  for (const corps of [
    'return $.plugin.root',
    'if (valeur.version >= 1) return valeur',
    "const lignes = resultat.stdout.split('\\n')",
    'return Math.max(valeur, 1)',
    'return parseInt(valeur, 10)',
  ]) assert.ok((await messagesDuMur(couture(corps), COUTURE)).length > 0, corps)
})

for (const ext of ['js', 'mjs', 'cjs', 'cts', 'jsx', 'tsx'])
  test(`ROUGE — un module \`.${ext}\` sous un mod est refusé, banc compris, et LU (non ignoré)`, async () => {
    for (const rel of [`hooks/vue.${ext}`, `hooks/vue.test.${ext}`, `types/vue.${ext}`, `tests/vue.${ext}`]) {
      assert.equal(await eslint.isPathIgnored(`.claude/skills/m/${rel}`), false, `${rel} est ignoré`)
      const msgs = await messagesDuMur('export const a = 1\n', join(RACINE, '.claude', 'skills', 'banc', ...rel.split('/')))
      assert.equal(msgs.length, 1, rel)
      assert.match(msgs[0].message, /#2278/)
      assert.match(msgs[0].message, /un mod s'écrit en `\.ts`/)
    }
  })

test('PÉRIMÈTRE : l’`include` du moteur (hooks, types, tests) hors bancs ; le reste de `.claude/` reste ignoré', async () => {
  const lus = ['hooks/a.ts', 'hooks/sous/a.mts', 'types/index.d.ts', 'tests/a.ts', 'hooks/ops.ts']
  const ignores = ['hooks/a.test.ts', 'hooks/hooks.json', 'a.ts', 'scripts/a.ts', 'SKILL.md']
  for (const rel of lus) assert.equal(await eslint.isPathIgnored(`.claude/skills/m/${rel}`), false, rel)
  for (const rel of ignores) assert.equal(await eslint.isPathIgnored(`.claude/skills/m/${rel}`), true, rel)
  for (const chemin of ['.claude/hooks/a.ts', '.claude/memory/a.mjs', '.claude/agents/a.ts', '.claude/a.ts'])
    assert.equal(await eslint.isPathIgnored(chemin), true, chemin)
})

test('les modules RÉELS du mod `harnais` passent le mur', async () => {
  const hooks = join(RACINE, '.claude', 'skills', 'harnais', 'hooks')
  const modules = listerDossier(hooks).filter((nom) => nom.endsWith('.ts') && !estSuiteVitest(nom))
  assert.ok(modules.includes('suivi.ts') && modules.includes('ops.ts'), 'le corpus réel est lu')
  for (const nom of modules) {
    const chemin = join(hooks, nom)
    const [r] = await eslint.lintText(readFileSync(chemin, 'utf8'), { filePath: chemin })
    assert.deepEqual(r.messages, [], nom)
  }
})
