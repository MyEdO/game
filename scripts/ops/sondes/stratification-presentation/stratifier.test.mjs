// CONTRAT des fonctions pures de la stratification de la présentation (#2792) : rangement par la
// première règle, comptes `wc -l`, lecture du `--numstat`, imports relatifs résolus, échantillon
// déterministe. Lancé par `npm run test:ops`.
import { test } from 'node:test'
import { execFileSync } from 'node:child_process'
import assert from 'node:assert/strict'
import { CATEGORIES, REGLES } from './regles.mjs'
import { cheminDestination, compterLignes, importsRelatifs, lireNumstat, ranger, resoudreImport, tirerEchantillon } from './stratifier.mjs'

const REGLES_BANC = [
  { motif: /^src\/ui\/editor\/Canvas\./, categorie: 'moteur-generique' },
  { motif: /^src\/ui\/editor\//, categorie: 'outillage' },
  { motif: /^src\/ui\/icons\//, categorie: 'douteux', famille: 'contenu-art' },
  { motif: /^src\/ui\//, categorie: 'interface-wfrp' },
]

test('ranger : la PREMIÈRE règle qui correspond gagne, même si une suivante correspond aussi', () => {
  assert.deepEqual(ranger('src/ui/editor/Canvas.tsx', REGLES_BANC), { categorie: 'moteur-generique', indice: 0 })
  assert.deepEqual(ranger('src/ui/editor/Palette.tsx', REGLES_BANC), { categorie: 'outillage', indice: 1 })
  assert.deepEqual(ranger('src/ui/RollShell.tsx', REGLES_BANC), { categorie: 'interface-wfrp', indice: 3 })
})

test('ranger : une règle douteuse rend sa famille', () => {
  assert.deepEqual(ranger('src/ui/icons/index.ts', REGLES_BANC), { categorie: 'douteux', famille: 'contenu-art', indice: 2 })
})

test('ranger : aucun motif ne correspond → null', () => {
  assert.equal(ranger('src/engine/combat.ts', REGLES_BANC), null)
})

test('REGLES : chaque catégorie est un id de CATEGORIES ou douteux, et seule une règle douteuse porte une famille', () => {
  const ids = new Set(CATEGORIES.map((c) => c.id))
  for (const r of REGLES) {
    assert.ok(r.motif instanceof RegExp)
    assert.ok(ids.has(r.categorie) || r.categorie === 'douteux', r.motif.source)
    assert.equal(r.famille !== undefined, r.categorie === 'douteux', r.motif.source)
    assert.ok(r.raison && r.preuve, r.motif.source)
  }
})

test('REGLES : chaque règle range au moins un fichier de l\'arbre — une règle qui ne gagne plus aucun fichier se retire', () => {
  const racine = new URL('../../../..', import.meta.url)
  const fichiers = execFileSync('git', ['ls-files', 'src/state', 'src/ui', 'src/gameIso'], { cwd: racine, encoding: 'utf8' })
    .split('\n').filter((f) => /\.(ts|tsx|css)$/.test(f))
  const gagnantes = new Set(fichiers.map((f) => ranger(f, REGLES)?.indice).filter((i) => i !== undefined))
  const mortes = REGLES.flatMap((r, i) => (gagnantes.has(i) ? [] : [r.motif.source]))
  assert.deepEqual(mortes, [], `règle(s) sans fichier : ${mortes.join(' · ')}`)
})

test('compterLignes : le nombre de \\n, comme wc -l — la dernière ligne sans \\n final ne compte pas', () => {
  assert.equal(compterLignes(''), 0)
  assert.equal(compterLignes('a'), 0)
  assert.equal(compterLignes('a\nb'), 1)
  assert.equal(compterLignes('a\nb\n'), 2)
  assert.equal(compterLignes('\n\n\n'), 3)
})

test('lireNumstat : commits, fichiers, et lignes binaires mises à part', () => {
  const texte = [
    '@@commit aaa',
    '',
    '3\t1\tsrc/state/store.ts',
    '-\t-\tsrc/gameIso/rig/quad.test.ts',
    '@@commit bbb',
    '',
    '0\t7\tsrc/ui/Modal.tsx',
    '10\t0\tsrc/ui/Cadre.tsx',
    '',
  ].join('\n')
  assert.deepEqual(lireNumstat(texte), [
    { sha: 'aaa', fichiers: [{ chemin: 'src/state/store.ts', ajouts: 3, suppressions: 1 }], binaires: ['src/gameIso/rig/quad.test.ts'] },
    { sha: 'bbb', fichiers: [{ chemin: 'src/ui/Modal.tsx', ajouts: 0, suppressions: 7 }, { chemin: 'src/ui/Cadre.tsx', ajouts: 10, suppressions: 0 }], binaires: [] },
  ])
})

test('lireNumstat : un renommage se rend sous son chemin destination', () => {
  const [c] = lireNumstat('@@commit ccc\n\n2\t2\tsrc/state/{vieux.ts => neuf.ts}\n')
  assert.deepEqual(c.fichiers, [{ chemin: 'src/state/neuf.ts', ajouts: 2, suppressions: 2 }])
  assert.equal(cheminDestination('src/{ => ui}/a.ts'), 'src/ui/a.ts')
  assert.equal(cheminDestination('src/{ui => }/a.ts'), 'src/a.ts')
  assert.equal(cheminDestination('src/a.ts => src/b.ts'), 'src/b.ts')
})

test('importsRelatifs : import … from, export … from, import nu, import(), vi.mock(), sans doublon ni spécificateur de paquet', () => {
  const texte = [
    "import { a } from './a'",
    'import {',
    '  b,',
    "} from '../b/index'",
    "export * from './c'",
    "import './d.css'",
    "const e = await import('./e')",
    "vi.mock('../f', () => ({}))",
    "import React from 'react'",
    "import { a as a2 } from './a'",
  ].join('\n')
  assert.deepEqual(importsRelatifs(texte), ['./a', '../b/index', './c', './d.css', './e', '../f'])
})

test('resoudreImport : chemin tel quel, .ts, .tsx, index.ts, index.tsx ; null si rien n’existe', () => {
  const existe = (c) => new Set(['src/ui/a.tsx', 'src/state/b/index.ts', 'src/ui/d.css', 'src/state/x.ts']).has(c)
  assert.equal(resoudreImport('src/ui/t.test.tsx', './a', existe), 'src/ui/a.tsx')
  assert.equal(resoudreImport('src/ui/t.test.tsx', '../state/b', existe), 'src/state/b/index.ts')
  assert.equal(resoudreImport('src/ui/t.test.tsx', './d.css', existe), 'src/ui/d.css')
  assert.equal(resoudreImport('src/ui/t.test.tsx', '../state/x.ts?raw', existe), 'src/state/x.ts')
  assert.equal(resoudreImport('src/ui/t.test.tsx', './absent', existe), null)
})

test('tirerEchantillon : déterministe pour une graine, indépendant de l’ordre d’entrée, sans doublon', () => {
  const chemins = Array.from({ length: 40 }, (_, i) => `src/ui/f${i}.ts`)
  const tirage = tirerEchantillon(chemins, 6, 2792)
  assert.equal(tirage.length, 6)
  assert.equal(new Set(tirage).size, 6)
  assert.ok(tirage.every((c) => chemins.includes(c)))
  assert.deepEqual(tirerEchantillon([...chemins].reverse(), 6, 2792), tirage)
  assert.notDeepEqual(tirerEchantillon(chemins, 6, 'autre'), tirage)
  assert.deepEqual(tirerEchantillon(['b', 'a', 'a'], 10, 1).sort(), ['a', 'b'])
})
