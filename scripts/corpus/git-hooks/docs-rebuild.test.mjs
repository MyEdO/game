import test from 'node:test'
import assert from 'node:assert/strict'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { mesurerEnRendu } from '../../docs/build-all.mjs'
import { tableTotale } from '../../../src/lib/tableTotale.ts'
import { touchesDocSources } from '../../git-hooks/selection-des-derives.mjs'

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')

/** Les générateurs dont le rendu lit chaque classe jugée ci-dessous — mémoire, workflows, fiches de
 *  l'Atlas et `scripts/raw/`, `src/`, tsconfig —, les moins coûteux à mesurer. */
const MESURES = [
  'scripts/docs/build-doctrines.mjs', 'scripts/docs/build-reprise.mjs', 'scripts/raw/build-atlas-index.mjs',
  'scripts/docs/build-usages-jets.mjs', 'scripts/docs/build-donnees.mjs',
]

test('les classes que la liste de préfixes d’avant #1773 RATAIT sont vues sur la mesure RENDUE par les générateurs', () => {
  const rendues = mesurerEnRendu(MESURES, { cwd: RACINE })
  const mesure = tableTotale(MESURES, (script) => rendues.get(script).entree)
  for (const [script, { fichiers }] of Object.entries(mesure)) assert.ok(fichiers.length > 1, `${script} : mesure aveugle`)
  // `.claude/memory/user-*.md` alimente `docs/doctrines.md` : une fiche NEUVE compte (pathspec de
  // `git ls-files`), et `.github/workflows` est un dossier mesuré — deux classes hors des préfixes.
  assert.equal(touchesDocSources(['.claude/memory/user-x.md'], mesure), true)
  assert.equal(touchesDocSources(['.github/workflows/ci.yml'], mesure), true)
  assert.equal(touchesDocSources(['tsconfig.json'], mesure), true)
  // Ce qu'aucun générateur ne lit ne périme aucun dérivé, quel que soit son dossier.
  assert.equal(touchesDocSources(['README.md'], mesure), false)
  assert.equal(touchesDocSources(['public/galeries.html'], mesure), false)
  // Et les classes que la liste voyait déjà restent vues.
  assert.equal(touchesDocSources(['src/ui/Prose.tsx'], mesure), true)
  assert.equal(touchesDocSources(['scripts\\raw\\_lib.mjs'], mesure), true)
  assert.equal(touchesDocSources(['docs/raw/4e/combat.md'], mesure), true)
})
