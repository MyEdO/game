// #2278
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { creerBancLint } from '../../guards/lib/lint.testkit.mjs'
import { listerDossier } from '../../guards/lib/lister.mjs'
import { estSuiteVitest } from '../../guards/lib/fichierVitest.mjs'

const RACINE = fileURLToPath(new URL('../../../', import.meta.url))

const lint = creerBancLint()

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
