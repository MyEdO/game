// Garde du pilote de fusion des docs dérivés (scripts/git-hooks/merge-docs.mjs) et de la liste
// UNIQUE des générateurs (scripts/docs/build-all.mjs). `npm run test:hooks`.
import { execFileSync } from 'node:child_process'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import test from 'node:test'
import assert from 'node:assert/strict'
import { catalogueConflicts, mergeFicheRaw, restoreImplemente, sentinelFor, stripImplemente, threeWay } from './merge-docs.mjs'
import { GENERATORS, ciblesSignees } from '../docs/build-all.mjs'
import { pagesDeLAtlas, RAWDOC_META_GENERATED } from '../raw/_lib.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')

const FICHE = [
  '# Combat',
  '',
  '## Parade',
  'Prose manuscrite de la parade.',
  '',
  '**Implémente :** _(généré — `npm run raw:implemente`)_',
  '- LDB 13 l.142 : `parry` (`src/engine/combat.ts`)',
  '',
  '## Esquive',
  'Prose manuscrite de l esquive.',
  '',
  '**Implémente :** (non implémenté)',
  '- dette : #0',
  '',
].join('\n')

test('strip — sans champ Implémente : texte inchangé, aucun bloc', () => {
  const sansChamp = '# Titre\n\nProse seule.\n'
  const r = stripImplemente(sansChamp)
  assert.equal(r.text, sansChamp)
  assert.equal(r.blocks.size, 0)
})

test('strip — remplace chaque bloc par une sentinelle, et est idempotent', () => {
  const r = stripImplemente(FICHE)
  assert.equal(r.blocks.size, 2)
  assert.equal(r.blocks.get('parade')[0], '**Implémente :** _(généré — `npm run raw:implemente`)_')
  assert.equal(r.blocks.get('esquive').length, 2)
  assert.deepEqual([...r.blocks.keys()], ['parade', 'esquive'])
  assert.equal(r.text.split('\n').filter((l) => /merge-docs:implemente/.test(l)).length, 2)
  assert.ok(!r.text.includes('**Implémente'))
  // Idempotence : re-stripper un texte déjà neutralisé ne change rien.
  const again = stripImplemente(r.text)
  assert.equal(again.text, r.text)
  assert.equal(again.blocks.size, 0)
  // Aller-retour sans perte.
  assert.equal(restoreImplemente(r.text, r.blocks), FICHE)
})

test('fusion — fiche SANS champ Implemente : fusion de prose pure, aucun champ invente', () => {
  const base = ['# Fiche', '', 'Prose de base.', ''].join('\n')
  const ours = base.replace('Prose de base.', 'Prose courante.')
  const r = mergeFicheRaw(ours, base, base)
  assert.equal(r.conflict, false)
  assert.equal(r.text, ours)
  assert.ok(!r.text.includes('Implémente'))
})

test('restore — une sentinelle sans bloc « ours » retombe sur la forme non implémentée', () => {
  assert.equal(restoreImplemente(`a\n${sentinelFor('x#parade')}\nb`, new Map(), new Map()), 'a\n**Implémente :** (non implémenté)\nb')
})

test('fusion — seul le champ Implémente diverge : pas de conflit, champ « ours » conservé', () => {
  const ours = FICHE.replace('- LDB 13 l.142 : `parry` (`src/engine/combat.ts`)', '- LDB 13 l.142 : `parry`, `dodge` (`src/engine/combat.ts`)')
  const theirs = FICHE.replace('- LDB 13 l.142 : `parry` (`src/engine/combat.ts`)', '- LDB 13 l.142 : `parry` (`src/engine/combat.ts`, `src/state/combatFlow.ts`)')
  const r = mergeFicheRaw(ours, FICHE, theirs)
  assert.equal(r.conflict, false)
  assert.ok(!r.text.includes('<<<<<<<'))
  assert.equal(r.text, ours)
  // Le champ SURVIT à la fusion : `regenerateFiche` (build-implemente.mjs) ne recrée jamais un
  // champ absent — cf. `if (!fields.length) return content`.
  assert.equal(stripImplemente(r.text).blocks.size, 2)
})

const SECTION_ASSAUT = [
  '## Assaut',
  'Prose manuscrite de l assaut.',
  '',
  '**Implémente :** (non implémenté)',
  '- dette : #0',
  '',
].join('\n')

test('fusion — section AJOUTEE par l entrant AVANT une autre : chaque champ reste sous SON heading', () => {
  const theirs = FICHE.replace('## Parade', SECTION_ASSAUT + '## Parade')
  const r = mergeFicheRaw(FICHE, FICHE, theirs)
  assert.equal(r.conflict, false)
  assert.equal(r.text, theirs) // aucun champ deplace, aucune ligne de dette perdue
  const blocs = stripImplemente(r.text).blocks
  assert.deepEqual([...blocs.keys()], ['assaut', 'parade', 'esquive'])
  assert.deepEqual(blocs.get('assaut'), ['**Implémente :** (non implémenté)', '- dette : #0'])
  assert.equal(blocs.get('parade')[0], '**Implémente :** _(généré — `npm run raw:implemente`)_')
})

test('fusion — section SUPPRIMEE par l entrant : son champ part avec elle', () => {
  const base = FICHE.replace('## Parade', SECTION_ASSAUT + '## Parade')
  const theirs = FICHE
  const r = mergeFicheRaw(base, base, theirs)
  assert.equal(r.conflict, false)
  assert.equal(r.text, FICHE)
  assert.deepEqual([...stripImplemente(r.text).blocks.keys()], ['parade', 'esquive'])
})

test('fusion — prose divergente des deux côtés : marqueurs et conflit signalé', () => {
  const ours = FICHE.replace('Prose manuscrite de la parade.', 'Prose COURANTE de la parade.')
  const theirs = FICHE.replace('Prose manuscrite de la parade.', 'Prose ENTRANTE de la parade.')
  const r = mergeFicheRaw(ours, FICHE, theirs)
  assert.equal(r.conflict, true)
  assert.ok(r.text.includes('<<<<<<<') && r.text.includes('>>>>>>>'))
  assert.ok(r.text.includes('Prose COURANTE de la parade.'))
  assert.ok(r.text.includes('Prose ENTRANTE de la parade.'))
  assert.ok(!/merge-docs:implemente/.test(r.text))
})

test('fusion — prose divergente d un seul côté : reprise sans conflit', () => {
  const theirs = FICHE.replace('Prose manuscrite de l esquive.', 'Prose ENTRANTE de l esquive.')
  const r = mergeFicheRaw(FICHE, FICHE, theirs)
  assert.equal(r.conflict, false)
  assert.ok(r.text.includes('Prose ENTRANTE de l esquive.'))
})

test('threeWay — délègue à git merge-file (aucun diff3 réimplémenté)', () => {
  assert.deepEqual(threeWay('a\nX\n', 'a\nb\n', 'a\nb\n'), { text: 'a\nX\n', conflict: false })
})

const BLOC = (tag, corps) => ['', '---', '', '<!-- ' + tag + ' -->', corps, '<!-- /' + tag + ' -->', ''].join('\n')
const CAT = '# Catalogue' + '\n' + '\n' + 'Chapitres concatenes.' + '\n'

/** Écrit les trois versions dans un dossier jetable, retourne les chemins pour `catalogueConflicts`. */
function versions(base, ours, theirs) {
  const dir = mkdtempSync(join(tmpdir(), 'merge-docs-test-'))
  const put = (n, c) => { const f = join(dir, n); writeFileSync(f, c); return f }
  return { base: put('o', base), ours: put('a', ours), theirs: put('b', theirs) }
}

test('catalogue — aucun bloc X-INTEGRATION : rien a perdre', () => {
  assert.deepEqual(catalogueConflicts(versions(CAT, CAT + 'ours', CAT + 'theirs')), [])
})

test('catalogue — bloc IDENTIQUE des deux cotes : pas de conflit', () => {
  const b = BLOC('MDG-INTEGRATION', 'correctif manuel')
  assert.deepEqual(catalogueConflicts(versions(CAT + b, CAT + 'ours' + b, CAT + 'theirs' + b)), [])
})

test('catalogue — bloc NEUF cote entrant : conflit nomme', () => {
  const b = BLOC('MDG-INTEGRATION', 'correctif manuel neuf')
  assert.deepEqual(catalogueConflicts(versions(CAT, CAT, CAT + b)), ['MDG-INTEGRATION'])
})

test('catalogue — bloc MODIFIE cote courant SEUL : pas de conflit', () => {
  const o = BLOC('ZI-INTEGRATION', 'version ancetre')
  const a = BLOC('ZI-INTEGRATION', 'version courante')
  assert.deepEqual(catalogueConflicts(versions(CAT + o, CAT + a, CAT + o)), [])
})

test('catalogue — bloc MODIFIE cote entrant seul : conflit nomme', () => {
  const o = BLOC('ZI-INTEGRATION', 'version ancetre')
  const b = BLOC('ZI-INTEGRATION', 'version entrante')
  assert.deepEqual(catalogueConflicts(versions(CAT + o, CAT + o, CAT + b)), ['ZI-INTEGRATION'])
})

/** `git check-attr merge` pour un lot de chemins → Map(chemin → famille). */
function famillesDe(paths) {
  const out = execFileSync('git', ['check-attr', 'merge', '--stdin'], { cwd: ROOT, input: paths.join('\n'), encoding: 'utf8' })
  const map = new Map()
  for (const ln of out.split('\n').filter(Boolean)) {
    const m = /^(.*): merge: (.*)$/.exec(ln)
    if (m) map.set(m[1], m[2])
  }
  return map
}

test('taxonomie — tout DOC ecrit en entier par un generateur est genere ou catalogue', () => {
  const paths = GENERATORS.flatMap((g) => ciblesSignees(g, ROOT))
  assert.ok(paths.length >= 18, `cibles depliees : ${paths.length}`)
  const fam = famillesDe(paths)
  const hors = paths.filter((p) => !['docs-generes', 'docs-catalogue'].includes(fam.get(p)))
  assert.deepEqual(hors, [])
})

test('taxonomie — les rapports RAWDOC_META_GENERATED sont en famille generee', () => {
  const paths = [...RAWDOC_META_GENERATED].map((f) => 'docs/raw/' + f)
  const fam = famillesDe(paths)
  assert.deepEqual(paths.filter((p) => fam.get(p) !== 'docs-generes'), [])
})

test('taxonomie — toute FICHE énumérée par la couture de l’Atlas est en famille fiche-raw', () => {
  const paths = pagesDeLAtlas(join(ROOT, 'docs', 'raw'), { classes: ['fiche'] }).map((p) => `docs/raw/${p.relatif}`)
  assert.ok(paths.length >= 20, `fiches : ${paths.length}`)
  const fam = famillesDe(paths)
  assert.deepEqual(paths.filter((p) => fam.get(p) !== 'docs-fiche-raw'), [])
})
