// Garde-fou « lien mort dans la mémoire persistante ».
//   node --test scripts/guards/lib/memoryLinks.test.mjs   (chaîné dans `npm run test:hooks`)
//
// Un lien de fiche est la seule partie de la mémoire qui soit MÉCANIQUEMENT vérifiable : une prose
// fausse se relit comme une vérité, un `[[nom]]` qui ne résout pas est un fait. La portée exacte et
// les angles morts sont DÉCLARÉS en tête de `scripts/guards/lib/memoryLinks.mjs` — en résumé :
//  - PORTÉE 1 — l'index VIVANT (`.claude/memory/*.md` à plat), `_archive/` hors index par construction.
//  - PORTÉE 2 — le RESTE du dépôt : les `[[nom]]` de fiche, les CHEMINS `.claude/memory/<nom>.md`
//    (lien markdown, chemin nu, ligne `:<n>`) et les MENTIONS NUES du nom d'une fiche disparue
//    (backtics, prose, `name: slug`) des fichiers de `src/`, `scripts/` et `docs/` VIVANTS — c'est
//    là que vivaient les 30 liens morts laissés par la refonte de mémoire de #1728, invisibles à la
//    portée 1. Exclusions motivées au site (`HORS_SCAN` : artefacts datés `docs/plans/`+
//    `docs/superpowers/`, sondes d'audit datées, et CE fichier, dont le banc forge des fiches
//    inexistantes).
//
// ANGLES MORTS de la portée 2, dits ici comme au module : un fichier IGNORÉ par git n'est pas vu
// (l'énumération est `git ls-files --cached --others --exclude-standard`), un `[[…]]` dont la
// cible n'a pas la FORME d'un nom de fiche (kebab minuscule, ≥ 5 caractères) n'est pas vu non plus,
// et une MENTION NUE n'est décidable que dans le VOCABULAIRE (arbre + HEAD) : la forme générique
// « kebab backtiqué » est mesurée à 99,95 % de faux positifs.
//
// Le contrat est POSITIF et à ZÉRO : aucune liste d'offenseurs tolérés, aucun cliquet. Un lien
// fautif fait échouer en le NOMMANT avec sa position (`fichier:ligne  [nature]  jeton`).
import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import {
  scanMemoryLinks,
  scanRepoMemoryLinks,
  fichiersHorsMemoire,
  formatMemoryLinkProblems,
  liveNotes,
  nomsDeFichesConnues,
  HORS_SCAN,
  MEMORY_DIR,
} from './memoryLinks.mjs'
import { GitIndisponible } from './gitPorte.mjs'
import { sousGitFeint } from './depotGabarit.mjs'

const ROOT = fileURLToPath(new URL('../../../', import.meta.url))

/** Monte un faux arbre mémoire et rend son chemin racine (à supprimer par l'appelant). */
function forgeMemory(files) {
  const root = mkdtempSync(join(tmpdir(), 'wfrp-mem-'))
  mkdirSync(join(root, MEMORY_DIR), { recursive: true })
  for (const [name, body] of Object.entries(files)) writeFileSync(join(root, MEMORY_DIR, name), body)
  return root
}

test('MORSURE : un [[nom]] sans fiche et un lien MEMORY.md sans fichier sont nommés avec leur position', () => {
  const root = forgeMemory({
    'MEMORY.md': '# Index\n- [vivante](fiche-vivante.md)\n- [fantome](fiche-fantome.md)\n',
    'fiche-vivante.md': 'Prolonge [[fiche-vivante]].\nVoir [[fiche-jamais-ecrite]].\n',
  })
  try {
    const problems = scanMemoryLinks(root)
    // L'ordre est celui de `parUnitesDeCode` (`scripts/guards/lib/lister.mjs`), donc le MÊME sur
    // toute machine : `MEMORY.md` précède `fiche-vivante.md` (`M` 0x4D < `f` 0x66).
    assert.deepEqual(problems, [
      { file: `${MEMORY_DIR}/MEMORY.md`, line: 3, kind: 'fichier absent', tok: 'fiche-fantome.md' },
      { file: `${MEMORY_DIR}/fiche-vivante.md`, line: 2, kind: 'fiche inexistante', tok: '[[fiche-jamais-ecrite]]' },
    ])
    assert.ok(formatMemoryLinkProblems(problems).includes('fiche-vivante.md:2'))
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('les formes saines résolvent : alias, ancre, suffixe .md, et un exemple en bloc de code est ignoré', () => {
  const root = forgeMemory({
    'MEMORY.md': '[a](fiche-a.md) et [b](fiche-b.md#section)\n',
    'fiche-a.md': 'Voir [[fiche-b|le libellé]], [[fiche-b#ancre]], [[fiche-b.md]].\n',
    'fiche-b.md': 'Exemple de syntaxe :\n```\n[[une-fiche-qui-nexiste-pas]]\n```\nFin.\n',
  })
  try {
    assert.deepEqual(scanMemoryLinks(root), [])
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('un [[…]] vers une fiche ARCHIVÉE est mort : `_archive/` est hors index vivant', () => {
  const root = forgeMemory({ 'fiche-a.md': 'Voir [[fiche-close]].\n' })
  mkdirSync(join(root, MEMORY_DIR, '_archive'), { recursive: true })
  writeFileSync(join(root, MEMORY_DIR, '_archive', 'fiche-close.md'), 'close\n')
  try {
    assert.deepEqual(scanMemoryLinks(root), [
      { file: `${MEMORY_DIR}/fiche-a.md`, line: 1, kind: 'fiche inexistante', tok: '[[fiche-close]]' },
    ])
    assert.deepEqual(liveNotes(root), ['fiche-a.md'])
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('ARBRE RÉEL : aucun lien mort dans `.claude/memory/`', () => {
  const problems = scanMemoryLinks(ROOT)
  assert.deepEqual(problems, [], `\n${formatMemoryLinkProblems(problems)}\n`)
})

test("ARBRE RÉEL : l'index cite CHAQUE fiche non-`user` une fois et une seule, et aucune `user-*`", () => {
  // Une fiche que l'index ne cite pas est INTROUVABLE ; citée deux fois, elle a deux déclencheurs
  // concurrents. Les `user-*` sont PORTÉES par le bloc généré « Doctrines utilisateur » de
  // `CLAUDE.md` (`scripts/docs/build-doctrines.mjs`) : les redoubler ici ferait deux sources.
  const index = readFileSync(join(ROOT, MEMORY_DIR, 'MEMORY.md'), 'utf8')
  const cites = [...index.matchAll(/\]\(([a-z0-9][a-z0-9-]*\.md)(?:#[^)\s]*)?\)/g)].map((m) => m[1])
  const fiches = liveNotes(ROOT).filter((f) => f !== 'MEMORY.md')
  const nonUser = fiches.filter((f) => !f.startsWith('user-'))

  assert.deepEqual([...new Set(nonUser)].filter((f) => !cites.includes(f)), [])
  assert.deepEqual(cites.filter((f, i) => cites.indexOf(f) !== i), [])
  assert.deepEqual(cites.filter((f) => f.startsWith('user-')), [])
})

test('PORTÉE 2 — MORSURE : un `[[slug]]` mort et un lien `](.claude/memory/…)` mort sont nommés', () => {
  const root = forgeMemory({ 'fiche-a.md': 'a\n' })
  const forge = join(root, 'src')
  mkdirSync(forge, { recursive: true })
  // Un JSDoc qui cite une fiche VIVANTE, une DISPARUE, et un lien markdown vers une disparue.
  writeFileSync(
    join(forge, 'temoin.ts'),
    '/** Cf. [[fiche-a]] et [[fiche-inexistante]]. */\n// et [ici](.claude/memory/fiche-partie.md)\n',
  )
  try {
    // `vocabulaire` = ce que le dépôt a CONNU (arbre + HEAD) : sans lui, un chemin vers un nom
    // jamais connu est une fixture de banc, pas un lien mort (cf. en-tête du module).
    const vocabulaire = ['fiche-a', 'fiche-partie']
    assert.deepEqual(scanRepoMemoryLinks(root, { fichiers: ['src/temoin.ts'], vocabulaire }), [
      { file: 'src/temoin.ts', line: 1, kind: 'fiche inexistante', tok: '[[fiche-inexistante]]' },
      { file: 'src/temoin.ts', line: 2, kind: 'fichier absent', tok: `${MEMORY_DIR}/fiche-partie.md` },
    ])
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('PORTÉE 2 — MORSURE : la MENTION NUE d’une fiche disparue est vue sous toutes ses décorations', () => {
  const root = forgeMemory({ 'fiche-a.md': 'a\n' })
  mkdirSync(join(root, 'src'), { recursive: true })
  // Les quatre écritures réelles mesurées sur l'arbre : backtics, prose, chemin `:<n>`, valeur YAML.
  writeFileSync(
    join(root, 'src', 'temoin.ts'),
    [
      '// Cf. `game-temoin-disparu`.',
      '// Cf. game-temoin-disparu, en prose.',
      '// .claude/memory/game-temoin-disparu.md:22',
      "const y = 'name: game-temoin-disparu';",
      '// `fiche-a` vivante et `game-temoin-disparu-plus-long` hors vocabulaire : muets.',
      '',
    ].join('\n'),
  )
  try {
    const vocabulaire = ['fiche-a', 'game-temoin-disparu']
    assert.deepEqual(scanRepoMemoryLinks(root, { fichiers: ['src/temoin.ts'], vocabulaire }), [
      { file: 'src/temoin.ts', line: 1, kind: 'fiche inexistante', tok: 'game-temoin-disparu' },
      { file: 'src/temoin.ts', line: 2, kind: 'fiche inexistante', tok: 'game-temoin-disparu' },
      // Le CHEMIN est jugé une fois, par sa propre forme : aucune double comptée à la ligne 3.
      { file: 'src/temoin.ts', line: 3, kind: 'fichier absent', tok: `${MEMORY_DIR}/game-temoin-disparu.md` },
      { file: 'src/temoin.ts', line: 4, kind: 'fiche inexistante', tok: 'game-temoin-disparu' },
    ])
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('PORTÉE 2 — le VOCABULAIRE réel joint l’arbre et HEAD, sans quoi la mention serait indécidable', () => {
  const connues = nomsDeFichesConnues(ROOT)
  // Toute fiche VIVANTE y est ; le vocabulaire déborde l'arbre (HEAD porte aussi les supprimées).
  for (const f of liveNotes(ROOT)) assert.equal(connues.has(f.replace(/\.md$/, '')), true)
  assert.ok(connues.size >= liveNotes(ROOT).length)
})

test('PORTÉE 2 — HORS dépôt, le vocabulaire est l’arbre seul ; une PANNE de git LÈVE, jamais un vocabulaire amputé', () => {
  const root = forgeMemory({ 'fiche-a.md': 'a\n' })
  try {
    assert.deepEqual([...nomsDeFichesConnues(root)], ['fiche-a'], 'hors dépôt : l’arbre, sans lever')
    sousGitFeint([{ si: [], status: 128, stderr: 'fatal: panne simulée\n' }], () =>
      assert.throws(() => nomsDeFichesConnues(ROOT), (e) => e instanceof GitIndisponible && /panne simulée/.test(e.raison)))
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test("PORTÉE 2 — la FORME d'un nom de fiche discrimine : un littéral `[[a, b]]` n'est pas un lien", () => {
  const root = forgeMemory({ 'fiche-a.md': 'a\n' })
  mkdirSync(join(root, 'src'), { recursive: true })
  // Trois faux positifs mesurés sur le dépôt réel : paires, classe de regex, cible trop courte.
  writeFileSync(join(root, 'src', 'bruit.ts'), "const m = [['ligne-de-mire', 1]];\nconst r = /[[^\\]]/;\n// [[nom]]\n")
  try {
    assert.deepEqual(scanRepoMemoryLinks(root, { fichiers: ['src/bruit.ts'] }), [])
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('PORTÉE 2 — CÂBLAGE : l’énumération réelle prend `src/`+`scripts/`+`docs/` et écarte `HORS_SCAN`', () => {
  const fichiers = fichiersHorsMemoire(ROOT)
  assert.ok(fichiers.includes('src/engine/magic.ts'))
  assert.ok(fichiers.includes('scripts/guards/lib/memoryLinks.mjs'))
  for (const exclu of HORS_SCAN) {
    assert.deepEqual(fichiers.filter((f) => f === exclu || f.startsWith(exclu)), [])
  }
  // Les binaires et les verrous n’ont pas de prose : filtre d’extension effectif.
  assert.deepEqual(fichiers.filter((f) => /\.(png|jpg|glb|woff2?)$/.test(f)), [])
})

test('ARBRE RÉEL : aucun lien mort vers une fiche dans `src/`, `scripts/`, `docs/` vivants', () => {
  const problems = scanRepoMemoryLinks(ROOT)
  assert.deepEqual(problems, [], `\n${formatMemoryLinkProblems(problems)}\n`)
})
