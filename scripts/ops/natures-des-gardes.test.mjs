// Le COMPTE PAR NATURE des modules de garde (node --test) : lecture de l'annexe A, classement, ligne stable, et
// l'annexe RÉELLE du plan de #2724. Lancé par `npm run test:ops`.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { compter, ligneDuCompte, modulesComptes, MODULES_DE_LA_STRUCTURE, NATURES_HORS_ANNEXE, naturesDeLAnnexe } from './natures-des-gardes.mjs'

const PLAN = `# Plan

| \`horsAnnexe.mjs\` | F1 | non | - | - | - |

## Annexe A — inventaire classé

| Module | Nature | Stock | Forme structurelle (F1) | Coût | Note |
|---|---|---|---|---|---|
| \`outil.mjs\` | OUTIL | non | - | - | - |
| \`garde.mjs\` | F1->F2 | oui (2) | - | - | - |
| \`mursLint.mjs\` | OUTIL | non | - | - | - |
| \`invariant.test.ts\` | F1 | non | - | - | - |

## Annexe B — invariants

| \`apres.mjs\` | F2 | non | - | - | - |
`

test('naturesDeLAnnexe ne lit que les lignes de module de l’annexe A', () => {
  assert.deepEqual([...naturesDeLAnnexe(PLAN)], [['outil.mjs', 'OUTIL'], ['garde.mjs', 'F1->F2'], ['mursLint.mjs', 'OUTIL']])
  assert.throws(() => naturesDeLAnnexe('# sans annexe'), /annexe A introuvable/)
})

test('compter : OUTIL est un outil, toute autre nature une garde, la structure prime sur l’annexe, un module sans nature est nommé', () => {
  const c = compter(modulesComptes(['garde.mjs', 'outil.mjs', 'mursLint.mjs', 'gdscript.mjs', 'inconnu.mjs', 'garde.test.mjs', 'garde.d.mts']), naturesDeLAnnexe(PLAN))
  assert.deepEqual(c, { modules: 5, gardes: ['garde.mjs'], outils: ['gdscript.mjs', 'outil.mjs'], structure: ['mursLint.mjs'], sansNature: ['inconnu.mjs'] })
  assert.equal(ligneDuCompte('arbre', c), 'arbre : modules=5 gardes=1 outils=2 structure=1 sans-nature=1 (inconnu.mjs)')
})

test('l’annexe réelle : un module hors annexe n’y a pas de ligne, et la structure n’est classée que par sa table', () => {
  const natures = naturesDeLAnnexe(readFileSync(new URL('../../docs/plans/2026-10-18-gardes-vers-structure.md', import.meta.url), 'utf8'))
  assert.ok(natures.size > 100, `annexe A lue : ${natures.size} lignes`)
  for (const m of Object.keys(NATURES_HORS_ANNEXE)) assert.equal(natures.has(m), false, `${m} a une ligne dans l’annexe : retire-le de NATURES_HORS_ANNEXE`)
  for (const m of MODULES_DE_LA_STRUCTURE) assert.equal(Object.hasOwn(NATURES_HORS_ANNEXE, m), false, `${m} est de la structure : retire-le de NATURES_HORS_ANNEXE`)
})
