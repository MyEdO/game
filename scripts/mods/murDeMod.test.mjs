// #2278
import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { creerBancLint } from '../guards/lib/lint.testkit.mjs'
import { lancerLint } from '../guards/lib/lintStage.mjs'
import { listerDossier } from '../guards/lib/lister.mjs'
import { estSuiteVitest } from '../guards/lib/fichierVitest.mjs'

const RACINE = fileURLToPath(new URL('../../', import.meta.url))
const MUR = 'murs/mod-sans-regle'
const lint = creerBancLint()
const HORS_COUTURE = join(RACINE, '.claude', 'skills', 'banc', 'hooks', 'module.ts')
const COUTURE = join(RACINE, '.claude', 'skills', 'banc', 'hooks', 'ops.ts')

// #2278
const module = (corps) => `import type { EngineInterface } from 'claude-code'\nimport { appel } from './ops'\nexport async function f($: EngineInterface, n: number, m: number, t: string, re: RegExp, q: unknown, lignes: string[], ids: string[], id: string, ms: number, i: number, nom: string, e: { at: string, test: string }) {\n${corps}\n}\n`

// #2278
async function messagesDuMur(source, chemin) {
  const [r] = await lint.lintText(source, { filePath: chemin })
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
  ['const valeur = parseInt(t, 10)', 'F4 parseInt'],
  ['const valeur = Number(t)', 'F4 Number'],
  ["const ok = t.startsWith('#') && t.includes('x')", 'F4 startsWith/includes'],
  ['const valeur = re.exec(t)', 'F4 exec'],
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
  ["function lire(api: any) { return api.fs.read('x') }\nawait lire($)", 'N1 `$` renommé en paramètre `any`'],
  ["function inval(api: any) { api.ui.invalidate('prompt.context') }\ninval($)", 'N1 invalidate par un paramètre renommé'],
  ["function inval({ ui }: any) { ui.invalidate('tool.describe') }\ninval($)", 'N1 invalidate par un paramètre déstructuré'],
  ["function lancer(api: any) { return api.process.run(['curl','x']) }\nawait lancer($)", 'N1 lancement hors idiome par un paramètre'],
  ["function lire(api: EngineInterface) { return api.ui.log('x') }\nawait lire($)", 'N1 paramètre `EngineInterface` renommé'],
  ["function lire({ ui }: EngineInterface) { return ui.log('x') }\nawait lire($)", 'N1 paramètre `EngineInterface` déstructuré'],
  ["function lire(api: typeof $ | null) { return api }\nawait lire($)", 'N1 paramètre `typeof $` renommé'],
  ["function lire(x: unknown) { return (x as EngineInterface).ui }\nawait lire($)", 'N1 cast vers `EngineInterface` hors liaison `$`'],
  ["function lire(x: unknown) { const api = x as EngineInterface\nreturn api.ui }\nawait lire($)", 'N1 cast lié à un autre nom'],
  ["type Moteur = EngineInterface\nfunction lire(api: Moteur) { return api.ui }\nawait lire($)", 'N1 alias de `EngineInterface`'],
  ["function lire<T extends EngineInterface>(api: T) { return api.ui }\nawait lire($)", 'N1 contrainte générique `EngineInterface`'],
  ['let r: typeof $ | null = null', 'N1 `typeof $` lié à un autre nom'],
  ['type T = typeof $', 'N1 alias de `typeof $`'],
  ['const total = n + m', 'N3 `+` entre deux non-littéraux'],
  ['const v = +t', 'N3 `+` unaire'],
  ['let c = n\nc += m', 'N3 `+=`'],
  ["let c = nom\nc += 'x'", 'N3 `+=` de chaîne'],
  ['let c = n\nc -= m', 'N3 `-=`'],
  ['let c = n\nc *= m', 'N3 `*=`'],
  ['let c = n\nc /= m', 'N3 `/=`'],
  ['let c = n\nc %= m', 'N3 `%=`'],
  ['const c = t.codePointAt(0)', 'N3 codePointAt'],
  ['const d = Date.parse(t)', 'N3 Date.parse'],
  ['const d = new Date(t)', 'N3 new Date(x)'],
  ["const u = new URL(t).searchParams.get('n')", 'N3 new URL(x)'],
  ["import { calc } from '../lib/calc'\nconst v = calc(t)", 'N5 import hors de hooks/ (`../lib`)'],
  ["import { calc } from '../../x'\nconst v = calc(t)", 'N5 import hors du mod (`../../x`)'],
  ["import { calc } from './../lib/calc'\nconst v = calc(t)", 'N5 import `./../`'],
  ["export { calc } from '../lib/calc'", 'N5 réexport hors de hooks/'],
  ["const m2 = await import('../lib/calc')", 'N5 import dynamique hors de hooks/'],
  ["const sel = ids.includes(id) ? 'actif' : ''", 'N6 `includes` appelé, receveur inconnu'],
  ['const v = lignes.slice()', 'N6 `slice` appelé, receveur inconnu'],
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
  ['async function suiviMjs($: EngineInterface, args: readonly string[]) { return $.session.id() }\nawait suiviMjs($, [t])', 'helper local `suiviMjs($, args)`'],
  ['const PERIODE_MS = 60 * 1000', 'pliage de littéraux'],
  ['const BORNE = 10 * 60 * 1000', 'pliage de littéraux en chaîne'],
  ["if (t === 'ajouter-item') q = 1", 'égalité de chaînes'],
  ["const s = 'a' + nom", 'concaténation de chaînes'],
  ["$.ui.invalidate('ui.render')", 'invalidate d’un événement de rendu'],
  ["$.ui.log('x', { to: 'debug' })\nawait $.state.get('k')\nawait $.tool.register({})\n$.clock.every(PERIODE, () => {})\nawait $.session.append({})", 'accès à liste blanche'],
  ['const PERIODE = 1', 'constante sans seuil'],
  ['const v = e.at', 'N6 lecture d’un champ nommé `at`'],
  ['const v = e.test', 'N6 lecture d’un champ nommé `test`'],
  ['const v = $.state.search', 'N6 clé d’état nommée `search`'],
  ["const opts: Parameters<typeof $.ui.log>[1] = { to: 'debug' }", 'N6 `typeof $.x` en position de type'],
  ["import type { HarnaisSuivi } from '../types'\nconst v: HarnaisSuivi | null = null", 'N5 `../types` permis'],
  ["import { h } from 'claude-code'\nconst v = h", 'N5 `claude-code` permis'],
  ["import { suivi } from './suivi'\nconst v = suivi", 'N5 `./x` permis'],
  ['const v = `${n} / ${m}`', 'gabarit d’affichage'],
  ['$.ui.status(t)', 'V6 `ui.status`, puits de rendu (#2280)'],
  ['$.ui.toast(t)', 'V6 `ui.toast`, puits de rendu (#2280)'],
  ['const racine = await $.session.root()', 'V6 `session.root`, lecture de la racine (#2280)'],
]

for (const [corps, forme] of VERTS)
  test(`VERT hors couture — ${forme}`, async () => {
    assert.deepEqual(await messagesDuMur(module(corps), HORS_COUTURE), [])
  })

test('LIMITES dites au bloc du mur : l’évasion délibérée, l’appelé IMPORTÉ et les prédicats de receveur passent', async () => {
  for (const corps of [
    "const d = 'a' + 'sk'",
    "const r = new (globalThis as unknown as Record<string, new (s: string) => object>)['Reg' + 'Exp']('x')",
    "import { lire } from './lire'\nawait lire($)",
    "const fini = lignes.every((l) => l === 'x')",
    'if (lignes.length === ids.length) q = 1',
    'if (Object.is(n, 3)) q = 1',
    "const premier = t[0]\nif (premier === '#') q = 1",
    "const [tete] = t\nif (tete === '#') q = 1",
  ]) assert.deepEqual(await messagesDuMur(module(corps), HORS_COUTURE), [], corps)
})

const couture = (corps) => `import type { ProcessRunResult } from 'claude-code'\nexport function lire(resultat: ProcessRunResult, valeur: number) {\n${corps}\n}\n`

test('COUTURE `hooks/ops.ts` : `JSON.parse`, la véracité et l’égalité de chaînes passent', async () => {
  for (const corps of ['if (resultat.exitCode) return null', "if (resultat.stdout === '') return null", 'return JSON.parse(resultat.stdout)', 'const BORNE_MS = 20 * 1000'])
    assert.deepEqual(await messagesDuMur(couture(corps), COUTURE), [], corps)
})

test('COUTURE `hooks/ops.ts` : `$`, `any`, seuil, égalité numérique, `Math`, parsing, `ask` et import hors mod sont rouges', async () => {
  for (const corps of [
    'if (resultat.exitCode !== 0) return null',
    'const v: any = valeur',
    "return { decision: valeur ? 'ask' : 'allow' }",
    'return valeur + valeur',
    "return import('../lib/x')",
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
      const source = ext === 'cjs' ? 'module.exports = 1\n' : 'export const a = 1\n'
      const msgs = await messagesDuMur(source, join(RACINE, '.claude', 'skills', 'banc', ...rel.split('/')))
      assert.equal(msgs.length, 1, rel)
      assert.match(msgs[0].message, /#2278/)
      assert.match(msgs[0].message, /un mod s'écrit en `\.ts`/)
    }
  })

test('PÉRIMÈTRE natif : modules et workflows lus, bancs TS et reste de `.claude/` ignorés en chemins explicites et découverte', () => {
  const lus = ['hooks/a.ts', 'hooks/sous/a.mts', 'types/index.d.ts', 'tests/a.ts', 'hooks/ops.ts']
  const ignores = ['hooks/a.test.ts', 'hooks/hooks.json', 'a.ts', 'scripts/a.ts', 'SKILL.md']
  const modules = lus.map((rel) => `.claude/skills/m/${rel}`)
  for (const ext of ['js', 'mjs', 'cjs', 'cts', 'jsx', 'tsx'])
    for (const rel of [`hooks/vue.${ext}`, `hooks/vue.test.${ext}`, `types/vue.${ext}`, `tests/vue.${ext}`])
      modules.push(`.claude/skills/m/${rel}`)
  const workflows = ['.claude/workflows/a.mjs', '.claude/workflows/sous/a.js']
  const exclus = [
    ...ignores.map((rel) => `.claude/skills/m/${rel}`),
    '.claude/skills/m/hooks/sous/a.test.ts',
    '.claude/skills/m/types/a.test.ts',
    '.claude/skills/m/tests/a.test.ts',
    '.claude/hooks/a.ts', '.claude/memory/a.mjs', '.claude/agents/a.ts', '.claude/a.ts',
  ]
  const cwd = mkdtempSync(join(tmpdir(), 'lint-mod-perimetre-'))
  try {
    const selectionnes = [...modules, ...workflows]
    const fichiers = [...selectionnes, ...exclus]
    for (const fichier of fichiers) {
      const chemin = join(cwd, fichier)
      mkdirSync(dirname(chemin), { recursive: true })
      const source = fichier.endsWith('.d.ts') ? 'declare var a: number;' :
        fichier.endsWith('.cjs') ? 'module.exports = 1; debugger;' : 'export const a = 1; debugger;'
      writeFileSync(chemin, source)
    }
    for (const selection of [fichiers, ['.']]) {
      const resultat = lancerLint(RACINE, selection, { cwd })
      const rapport = JSON.parse(resultat.stdout)
      assert.equal(rapport.number_of_files, selectionnes.length, resultat.brut)
      assert.equal(resultat.codeSortie, 1, resultat.brut)
      assert.ok(!resultat.defauts.some((defaut) => ['(outillage)', '(parse)'].includes(defaut.regle)), resultat.brut)
      const debug = resultat.defauts.filter((defaut) => defaut.regle === 'no-debugger')
      assert.equal(debug.length, selectionnes.filter((fichier) => !fichier.endsWith('.d.ts')).length, resultat.brut)
      for (const fichier of selectionnes) {
        const regle = fichier.endsWith('.d.ts') ? 'no-var' : 'no-debugger'
        assert.equal(resultat.defauts.filter((defaut) => defaut.site.startsWith(`${fichier}:`) && defaut.regle === regle).length, 1, fichier)
      }
      for (const fichier of exclus) {
        assert.ok(!resultat.defauts.some((defaut) => defaut.site.startsWith(`${fichier}:`)), fichier)
      }
      for (const fichier of modules.filter((fichier) => /\.(js|mjs|cjs|cts|jsx|tsx)$/.test(fichier))) {
        const defauts = resultat.defauts.filter((defaut) => defaut.site.startsWith(`${fichier}:`) && defaut.regle === MUR)
        assert.equal(defauts.length, 1, fichier)
        assert.match(defauts[0].message, /#2278/)
      }
    }
  } finally {
    rmSync(cwd, { recursive: true, force: true })
  }
})

test('les modules RÉELS du mod `harnais` et les workflows passent le lint natif', async () => {
  const hooks = join(RACINE, '.claude', 'skills', 'harnais', 'hooks')
  const modules = listerDossier(hooks).filter((nom) => nom.endsWith('.ts') && !estSuiteVitest(nom))
  assert.ok(['suivi.ts', 'vigie.ts', 'ops.ts', 'register.ts'].every((nom) => modules.includes(nom)), 'le corpus réel est lu')
  const types = join(RACINE, '.claude', 'skills', 'harnais', 'types')
  const workflows = join(RACINE, '.claude', 'workflows')
  const declarations = listerDossier(types).filter((nom) => nom.endsWith('.d.ts'))
  const scripts = listerDossier(workflows).filter((nom) => nom.endsWith('.js'))
  assert.ok(declarations.includes('index.d.ts'), 'le contrat réel du mod est lu')
  assert.ok(scripts.includes('dossier-de-chapitre.js') && scripts.includes('table-simulee.js'), 'les workflows réels sont lus')
  const chemins = [
    ...modules.map((nom) => join(hooks, nom)),
    ...declarations.map((nom) => join(types, nom)),
    ...scripts.map((nom) => join(workflows, nom)),
  ]
  for (const chemin of chemins) {
    const [r] = await lint.lintText(readFileSync(chemin, 'utf8'), { filePath: chemin })
    assert.deepEqual(r.messages, [], chemin)
  }
})
