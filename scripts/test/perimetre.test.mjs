// Banc du périmètre de tests (#2400) : un dépôt git FORGÉ par classe de lien, sous mkdtempSync.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { gitDe } from './gitDeBanc.mjs'
import { lireArguments, paliersDe, perimetreDuDepot, planDExecution } from './perimetre.mjs'

const TEMOIN = { 'scripts/temoin.test.mjs': "import './seul.mjs'\n", 'scripts/seul.mjs': 'export const seul = 1\n' }

/** Un dépôt jetable : `base` commité, puis `apres` (texte, `null` = supprimé, `{ de }` = renommé) commité
 *  si `commiter`, laissé dans l'arbre de travail sinon. */
function forger(t, base, apres, { commiter = true } = {}) {
  const racine = mkdtempSync(join(tmpdir(), 'perimetre-'))
  t.after(() => rmSync(racine, { recursive: true, force: true }))
  const git = gitDe(racine)
  git('init', '-q', '-b', 'main')
  git('config', 'user.email', 'perimetre@example.test')
  git('config', 'user.name', 'Perimetre fixture')
  const ecrire = (rel, texte) => {
    mkdirSync(dirname(join(racine, rel)), { recursive: true })
    writeFileSync(join(racine, rel), texte)
  }
  for (const [rel, texte] of Object.entries({ ...TEMOIN, ...base })) ecrire(rel, texte)
  git('add', '-A')
  git('commit', '-q', '-m', 'base')
  for (const [rel, texte] of Object.entries(apres)) {
    if (texte === null) git('rm', '-q', '--', rel)
    else if (typeof texte === 'object') {
      mkdirSync(dirname(join(racine, rel)), { recursive: true })
      git('mv', '--', texte.de, rel)
    } else ecrire(rel, texte)
  }
  if (commiter) {
    git('add', '-A')
    git('commit', '-q', '-m', 'apres')
  }
  return racine
}

const deriver = (racine, bornes = { base: 'HEAD~1', tete: 'HEAD' }) =>
  perimetreDuDepot(racine, bornes, { dossierDesMemos: join(racine, '.git', 'perimetre') })

const lienDe = (perimetre, test) => {
  const lien = perimetre.retenus.get(test)
  assert.ok(lien, `${test} non retenu ; retenus : ${[...perimetre.retenus.keys()].join(', ')}`)
  assert.equal(perimetre.retenus.has('scripts/temoin.test.mjs'), false, 'le témoin sans lien est retenu')
  return lien
}

test('import direct : le test qui importe le fichier touché est retenu, distance 1', (t) => {
  const racine = forger(t, { 'scripts/a.test.mjs': "import './lib.mjs'\n", 'scripts/lib.mjs': 'export const a = 1\n' },
    { 'scripts/lib.mjs': 'export const a = 2\n' })
  const lien = lienDe(deriver(racine), 'scripts/a.test.mjs')
  assert.deepEqual([lien.nature, lien.distance, lien.chaine], ['import', 1, ['scripts/a.test.mjs', 'scripts/lib.mjs']])
})

test('import transitif : la chaîne la plus courte et sa distance', (t) => {
  const racine = forger(t, {
    'scripts/b.test.mjs': "import './mid.mjs'\n",
    'scripts/mid.mjs': "export { f } from './feuille.mjs'\n",
    'scripts/feuille.mjs': 'export const f = 1\n',
  }, { 'scripts/feuille.mjs': 'export const f = 2\n' })
  const lien = lienDe(deriver(racine), 'scripts/b.test.mjs')
  assert.deepEqual([lien.nature, lien.distance, lien.chaine], ['import', 2, ['scripts/b.test.mjs', 'scripts/mid.mjs', 'scripts/feuille.mjs']])
})

test('importeur pendu vers un fichier SUPPRIMÉ : la résolution contre la base garde l’arc', (t) => {
  const racine = forger(t, {
    'scripts/c.test.mjs': "import './importeur.mjs'\n",
    'scripts/importeur.mjs': "import './parti.mjs'\n",
    'scripts/parti.mjs': 'export const p = 1\n',
  }, { 'scripts/parti.mjs': null })
  const lien = lienDe(deriver(racine), 'scripts/c.test.mjs')
  assert.deepEqual([lien.nature, lien.distance, lien.touche], ['import', 2, 'scripts/parti.mjs'])
})

test('fichier AJOUTÉ, non suivi, sous une racine balayée littérale', (t) => {
  const racine = forger(t, { 'scripts/d.test.mjs': "listerArbre('donnees')\n", 'donnees/un.json': '{}' },
    { 'donnees/deux.json': '{}' }, { commiter: false })
  const lien = lienDe(deriver(racine, { base: 'HEAD' }), 'scripts/d.test.mjs')
  assert.deepEqual([lien.nature, lien.racine, lien.site, lien.touche], ['racine balayée', 'donnees', 'scripts/d.test.mjs:1 listerArbre', 'donnees/deux.json'])
})

test('racine portée par une constante IMPORTÉE', (t) => {
  const racine = forger(t, {
    'scripts/e.test.mjs': "import { RACINES_SCAN } from './scan.mjs'\nreadCorpus(RACINES_SCAN)\n",
    'scripts/scan.mjs': "export const RACINES_SCAN = ['corpus']\n",
    'corpus/x.ts': 'export const x = 1\n',
  }, { 'corpus/x.ts': 'export const x = 2\n' })
  const lien = lienDe(deriver(racine), 'scripts/e.test.mjs')
  assert.deepEqual([lien.nature, lien.racine, lien.site], ['racine balayée', 'corpus', 'scripts/e.test.mjs:2 readCorpus'])
})

test('import.meta.glob à motif littéral : arc vers chaque fichier visé', (t) => {
  const racine = forger(t, {
    'src/f.test.ts': "const jeux = import.meta.glob('./jeux/*.json', { eager: true })\nexport default jeux\n",
    'src/jeux/a.json': '{}',
  }, { 'src/jeux/a.json': '{"a":1}' })
  const lien = lienDe(deriver(racine), 'src/f.test.ts')
  assert.deepEqual([lien.nature, lien.distance, lien.chaine], ['import', 1, ['src/f.test.ts', 'src/jeux/a.json']])
})

test('setupFiles : chaque test Vitest est retenu au rang `setup`, sans distance propagée par eux', (t) => {
  const racine = forger(t, {
    'vite.config.ts': "import { fileURLToPath } from 'node:url'\nexport default { test: { setupFiles: [fileURLToPath(new URL('./src/setup.ts', import.meta.url))] } }\n",
    'src/setup.ts': "import './store'\n",
    'src/store.ts': 'export const s = 1\n',
    'src/g.test.ts': 'export const g = 1\n',
    'src/h.test.ts': "import './store'\n",
  }, { 'src/store.ts': 'export const s = 2\n' })
  const perimetre = deriver(racine)
  const g = lienDe(perimetre, 'src/g.test.ts')
  assert.deepEqual([g.nature, g.touche], ['setup', 'src/store.ts'])
  const h = lienDe(perimetre, 'src/h.test.ts')
  assert.deepEqual([h.nature, h.distance, h.chaine], ['import', 1, ['src/h.test.ts', 'src/store.ts']])
  assert.deepEqual(planDExecution(perimetre.retenus, { seuil: 1 }), { lances: ['src/h.test.ts'], aLaCI: ['src/g.test.ts'], ciParRang: [['setup', 1]] })
  assert.deepEqual(paliersDe(perimetre.retenus), { 'touché': 0, 'racine balayée': 0, 'import d=1': 1, 'import d=2': 0, 'import d=3': 0, 'import d≥4': 0, 'setup seul': 1, 'toolchain seule': 0 })
})

test('racine balayée dont le site n’est atteint que par les setupFiles : rang `setup`', (t) => {
  const racine = forger(t, {
    'vite.config.ts': "export default { test: { setupFiles: ['src/setup.ts'] } }\n",
    'src/setup.ts': "listerArbre('donnees')\n",
    'donnees/x.json': '{}',
    'src/g.test.ts': 'export const g = 1\n',
  }, { 'donnees/x.json': '{"x":1}' })
  const g = lienDe(deriver(racine), 'src/g.test.ts')
  assert.deepEqual([g.nature, g.racine, g.site, g.touche], ['setup', 'donnees', 'src/setup.ts:1 listerArbre', 'donnees/x.json'])
})

test('toolchain touchée (lectures des dépendances comprises) ⇒ suite entière', (t) => {
  const racine = forger(t, { 'tsconfig.json': '{}', 'server/package.json': '{}', 'src/h.test.ts': 'export const h = 1\n' },
    { 'tsconfig.json': '{ "compilerOptions": {} }', 'server/package.json': '{ "private": true }' })
  const perimetre = deriver(racine)
  assert.deepEqual(perimetre.toolchain, ['server/package.json', 'tsconfig.json'])
  assert.deepEqual([...perimetre.retenus.keys()].sort(), ['scripts/temoin.test.mjs', 'src/h.test.ts'])
  assert.equal(perimetre.retenus.get('src/h.test.ts').nature, 'toolchain')
})

test('renommage : le chemin QUITTÉ reste touché sous la racine qui le balayait', (t) => {
  const racine = forger(t, { 'scripts/i.test.mjs': "listerArbre('anciens')\n", 'anciens/a.md': 'a\n', 'anciens/b.md': 'b\n' },
    { 'nouveaux/a.md': { de: 'anciens/a.md' } })
  const lien = lienDe(deriver(racine), 'scripts/i.test.mjs')
  assert.deepEqual([lien.nature, lien.racine, lien.touche], ['racine balayée', 'anciens', 'anciens/a.md'])
})

/** Rangs : touché 0, racine balayée 1, import d=1 2, import d=2 3. */
const RETENUS = new Map([['t.test.mjs', { rang: 0 }], ['r.test.mjs', { rang: 1 }], ['b.test.mjs', { rang: 2 }], ['a.test.mjs', { rang: 2 }], ['z.test.mjs', { rang: 3 }]])

test('planDExecution : un rang qui tient s’ajoute ENTIER', () => {
  assert.deepEqual(planDExecution(RETENUS, { seuil: 4 }), { lances: ['t.test.mjs', 'r.test.mjs', 'a.test.mjs', 'b.test.mjs'], aLaCI: ['z.test.mjs'], ciParRang: [['import d=2', 1]] })
})

test('planDExecution : le rang qui déborde part à la CI ENTIER, avec tous les suivants', () => {
  assert.deepEqual(planDExecution(RETENUS, { seuil: 3 }), { lances: ['t.test.mjs', 'r.test.mjs'], aLaCI: ['a.test.mjs', 'b.test.mjs', 'z.test.mjs'], ciParRang: [['import d=1', 2], ['import d=2', 1]] })
})

test('planDExecution : touché et racine balayée toujours lancés, même au-delà du seuil', () => {
  assert.deepEqual(planDExecution(RETENUS, { seuil: 1 }).lances, ['t.test.mjs', 'r.test.mjs'])
})

test('planDExecution : seuil 0 = touché et racine balayée seuls', () => {
  assert.deepEqual(planDExecution(RETENUS, { seuil: 0 }), { lances: ['t.test.mjs', 'r.test.mjs'], aLaCI: ['a.test.mjs', 'b.test.mjs', 'z.test.mjs'], ciParRang: [['import d=1', 2], ['import d=2', 1]] })
})

test('lireArguments : --tete exige --base, --seuil exige un entier', () => {
  assert.deepEqual(lireArguments(['--liste', '--base', 'b', '--tete', 't', '--seuil', '40', '--docs']), { liste: true, base: 'b', tete: 't', seuil: 40, docs: true })
  assert.throws(() => lireArguments(['--tete', 't']), /--tete exige --base/)
  assert.throws(() => lireArguments(['--seuil', 'beaucoup']), /--seuil attend un entier/)
})
