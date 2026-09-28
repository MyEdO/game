// Porte des hooks post-merge / post-rewrite et de l'étape docs de `ops:publier` : « ce lot peut-il
// avoir périmé un doc dérivé ? ». La réponse se DÉRIVE de la mesure, donc elle se teste sur une
// mesure FORGÉE (volet pur) puis sur celle de l'arbre (volet classes, #1773).
//   node --test scripts/git-hooks/docs-rebuild.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { envDeDepotForge, instanceDeDepot } from '../guards/lib/depotGabarit.mjs'
import { tmpdir } from 'node:os'
import { sourcesMesurees, touchedFiles, touchesDocSources } from './docs-rebuild.mjs'

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..', '..')

/** Une mesure FORGÉE : un fichier lu, un dossier LISTÉ, une cible signée. */
const MESURE = {
  'g/a.mjs': { cibles: ['docs/a.md'], fichiers: ['src/ui/Prose.tsx', 'notes/lue.md'], dossiers: ['.github/workflows'] },
}

test('une SOURCE LUE, une CIBLE signée, un dossier LISTÉ : les trois font régénérer', () => {
  assert.equal(touchesDocSources(['src/ui/Prose.tsx'], MESURE), true)
  assert.equal(touchesDocSources(['docs/a.md'], MESURE), true)
  // Un fichier neuf sous un dossier LISTÉ : c'est le listing hashé qui bouge.
  assert.equal(touchesDocSources(['.github/workflows/neuf.yml'], MESURE), true)
  // Graphie Windows comprise (le hook reçoit ce que git rend).
  assert.equal(touchesDocSources(['src\\ui\\Prose.tsx'], MESURE), true)
})

test('le FRÈRE d’une source lue fait régénérer ; un chemin sans parent mesuré, non', () => {
  // `notes/lue.md` est mesurée : une voisine AJOUTÉE dans le même dossier alimente le même doc, et
  // aucun générateur qui énumère sans lister ne le dirait autrement.
  assert.equal(touchesDocSources(['notes/voisine.md'], MESURE), true)
  assert.equal(touchesDocSources(['public/x.svg'], MESURE), false)
  // À la RACINE, le voisinage ne prouve rien : un fichier de racine n'est lu que s'il est mesuré.
  assert.equal(touchesDocSources(['README.md'], { 'g/a.mjs': { cibles: [], fichiers: ['package.json'], dossiers: [] } }), false)
  assert.equal(touchesDocSources(['package.json'], { 'g/a.mjs': { cibles: [], fichiers: ['package.json'], dossiers: [] } }), true)
})

test('FAIL-CLOSED : lot inconnu ou mesure illisible → on régénère ; lot vide → silence', () => {
  assert.equal(touchesDocSources(null, MESURE), true, 'sans ORIG_HEAD, le lot est inconnu')
  assert.equal(touchesDocSources(['README.md'], null), true, 'sans mesure, rien n’est jugeable')
  assert.equal(touchesDocSources(null, null), true)
  assert.equal(touchesDocSources([], MESURE), false)
})

test('les classes que la liste de préfixes d’avant #1773 RATAIT sont vues sur la mesure de l’arbre', () => {
  const mesure = sourcesMesurees(RACINE)
  assert.ok(mesure && Object.keys(mesure).length > 10, 'la mesure de l’arbre doit être lisible')
  // `.claude/memory/user-*.md` alimente `docs/doctrines.md` : une fiche NEUVE compte (frère d'une
  // source lue), et `.github/workflows` est un dossier mesuré — deux classes hors des préfixes.
  assert.equal(touchesDocSources(['.claude/memory/user-x.md'], mesure), true)
  assert.equal(touchesDocSources(['.github/workflows/ci.yml'], mesure), true)
  assert.equal(touchesDocSources(['tsconfig.json'], mesure), true)
  // Ce qu'aucun générateur ne lit ne périme aucun pied, quel que soit son dossier.
  assert.equal(touchesDocSources(['README.md'], mesure), false)
  assert.equal(touchesDocSources(['public/galeries.html'], mesure), false)
  // Et les classes que la liste voyait déjà restent vues.
  assert.equal(touchesDocSources(['src/ui/Prose.tsx'], mesure), true)
  assert.equal(touchesDocSources(['scripts\\raw\\build-implemente.mjs'], mesure), true)
  assert.equal(touchesDocSources(['docs/raw/4e/combat.md'], mesure), true)
})

test('FAIL-CLOSED : git INDISPONIBLE sur la lecture du lot, le lot est INCONNU (`null`, on régénère), jamais vide', () => {
  const { racine } = instanceDeDepot({ fichiers: { 'a.txt': 'a\n' } })
  const g = (...a) => execFileSync('git', a, { cwd: racine, env: envDeDepotForge(), encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
  writeFileSync(join(racine, 'b.txt'), 'b\n'); g('add', 'b.txt'); g('commit', '-q', '-m', 'b')
  g('update-ref', 'ORIG_HEAD', 'HEAD~1')
  const cale = mkdtempSync(join(tmpdir(), 'git-diff-tree-en-panne-'))
  const vrai = execFileSync('sh', ['-c', 'command -v git'], { encoding: 'utf8' }).trim()
  writeFileSync(join(cale, 'git'), `#!/bin/sh\nfor a in "$@"; do [ "$a" = diff-tree ] && { echo 'fatal: panne simulée' >&2; exit 128; }; done\nexec '${vrai}' "$@"\n`, { mode: 0o755 })
  const chemin = process.env.PATH
  try {
    assert.deepEqual(touchedFiles(racine), ['b.txt'], 'témoin : git répond, le lot se lit')
    process.env.PATH = `${cale}:${chemin}`
    assert.equal(touchedFiles(racine), null)
  } finally {
    process.env.PATH = chemin
    rmSync(racine, { recursive: true, force: true })
    rmSync(cale, { recursive: true, force: true })
  }
})
