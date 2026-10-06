// GARDE de la résolution d'objet (#2324) : la mécanique sur des formes NUES, puis le code de
// production de `src/`, où aucun site hors `src/data/` ne résout ni ne nomme un objet par le catalogue seul.
import test from 'node:test'
import assert from 'node:assert/strict'
import { EXCEPTIONS, sitesDansLeTexte, sitesHorsDuFoyer } from './resolutionDObjet.mjs'

const lignes = (texte) => sitesDansLeTexte(texte).map((s) => s.line)

test('un import et un appel sont des sites ; un commentaire, une chaîne ou un nom voisin non', () => {
  const texte = [
    "import { findTrappingById } from '../data';",
    'const t = findTrappingById(id);',
    '// findTrappingById en prose',
    "const s = 'findTrappingById';",
    'const u = findTrappingByIdx(id);',
  ].join('\n')
  assert.deepEqual(lignes(texte), [1, 2])
})

test('canal par catégorie : `trappings` littérale, ou `refLabel` dynamique, importés de data', () => {
  const texte = [
    "import { refLabel, findById } from '../../data';",
    "refLabel('trappings', { id });",
    "refLabel('skills', { id });",
    'refLabel(src.category, { id: src.id });',
    "findById('trapping', id);",
    'findById(src.category, src.id) ? src : undefined;',
    'findById(src.category, src.id)?.label;',
  ].join('\n')
  assert.deepEqual(lignes(texte), [2, 4, 5, 7])
})

test('un `byId`/`refLabel` LOCAL (non importé de data) n’est pas le canal', () => {
  const texte = ['const byId = (l) => (id) => l.some((e) => e.id === id);', 'byId(trappings);', 'byId(pending.attackerId);'].join('\n')
  assert.deepEqual(lignes(texte), [])
})

test('la COUTURE déclarée délègue à `refLabel` dans son corps ; hors de son corps, le même appel est un site', () => {
  const texte = [
    "import { refLabel } from '../data';",
    'export function libelleDeRef(category, ref) {',
    '  return refLabel(category, ref);',
    '}',
    'const x = refLabel(category, ref);',
  ].join('\n')
  assert.deepEqual(sitesDansLeTexte(texte, { couture: 'libelleDeRef' }).map((s) => s.line), [5])
  assert.deepEqual(lignes(texte), [3, 5])
})

test('le nom d’un objet relu à la main : `resoudreObjet(…).label`', () => {
  const texte = ['resoudreObjet(id)?.label ?? id;', 'resoudreObjet(id)?.passive;', 'garanti(resoudreObjet(id), id).label;'].join('\n')
  assert.deepEqual(lignes(texte), [1])
})

test('le foyer `src/data/` est hors mesure ; ailleurs, le site est rendu à sa ligne', () => {
  const corpus = [
    { rel: 'src/data/index.ts', text: 'return findTrappingById(id);' },
    { rel: 'src/engine/trauma.ts', text: 'a;\nfor (const op of findTrappingById(it.trappingId)?.passive ?? []) {}' },
  ]
  assert.deepEqual(sitesHorsDuFoyer(corpus).map((s) => s.site), ['src/engine/trauma.ts:2'])
})

test('la table d’exceptions est VIDE', () => {
  assert.deepEqual(EXCEPTIONS, [])
})

test('code de production de src/ : aucun site hors src/data/ ne résout ni ne nomme un objet par le catalogue seul', () => {
  const sites = sitesHorsDuFoyer()
  assert.deepEqual(sites, [], `résoudre par resoudreObjet, nommer par itemLabel / libelleDeRef (src/engine/items.ts) :\n${sites.map((s) => `${s.site}  ${s.detail}`).join('\n')}`)
})
