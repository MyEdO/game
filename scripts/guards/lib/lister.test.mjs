// PORTE DE RÔLE du lecteur à ordre total (#1679 L3b, incident #1620), zéro stock.
//
//  (a) PROPRIÉTÉ  : `listerDossier` rend l'ordre des unités de code, quel que soit l'ordre de création.
//      EFFET      : `listerArbre` rend le MÊME tableau quel que soit l'ordre de création.
//      Sous NTFS la preuve est TRIVIALE (le système rend déjà un listing trié) ; c'est la CI, sur
//      ext4 (ordre d'un hash), qui la porte réellement. Le test est ici pour y être JOUÉ, pas pour
//      être vert sur cette machine.
//  (b) MUR        : toute racine du registre des générateurs (`GENERATORS` ∪ `NON_GENERATOR_CHECKS`,
//      `scripts/docs/build-all.mjs`) est SOUS les globs `files:` de chaque bloc du mur « ordre total »
//      de `oxlint.config.mjs` — les globs se LISENT depuis la config, jamais recopiés ici. Chaque règle
//      du mur y est déclarée par UN seul bloc, en `error` (UNICITÉ).
//  (c), IGNORES, DIRECTIVES, (d) : `scripts/corpus/guards/lister.test.mjs`
import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { cheminAbsent, listerDossier, listerArbre, parUnitesDeCode, parLibelle, correspondGlob, motifDeGlob } from './lister.mjs'
import { norm } from '../../../src/lib/normalize.ts'
import { BLOCS_LINT as configEslint, REGLES_ORDRE_TOTAL } from '../../../oxlint.config.mjs'
import { blocDe, blocsDuMur, couvre, exempte, racinesDuRegistre } from '../../test/lib/bancLister.mjs'

test('cache glob : compilation réutilisée, FIFO borné et expressions publiques isolées', () => {
  const motifs = ['__cache2475__/a/*.ts', '__cache2475__/**/b.{md,ts}', '__cache2475__/c.[]+?.ts', '__cache2475__/**', '__cache2475__/z', '__cache2475__/{x,y}/*']
  const chemins = ['__cache2475__/a/x.ts', '__cache2475__/a/y.md', '__cache2475__/b.ts', '__cache2475__/profond/b.md', '__cache2475__/c.[]+?.ts', '__cache2475__/z', '__cache2475__/x/source', '__cache2475__\\a\\x.ts']
  const attendu = chemins.map(p => motifs.map(m => motifDeGlob(m).test(p.replace(/\\/g, '/'))))
  for (let i = 0; i < 256; i++) correspondGlob('', `__cache2475__/avant/${i}`)
  const constructeur = globalThis.RegExp
  let compilations = 0
  globalThis.RegExp = new Proxy(constructeur, { construct(cible, args, nouveau) { compilations++; return Reflect.construct(cible, args, nouveau) } })
  try {
    for (let i = 0; i < 100; i++) assert.equal(correspondGlob('__cache2475__/a/x.ts', motifs[0]), true)
    assert.equal(compilations, 1, 'le motif répété a été recompilé')
    for (let i = 0; i < 3; i++) assert.deepEqual(chemins.map(p => motifs.map(m => correspondGlob(p, m))), attendu)
    assert.equal(compilations, motifs.length)
    assert.equal(correspondGlob('__cache2475__/a/x.ts', { toString: () => motifs[0] }), true)
    assert.equal(compilations, motifs.length)
    const publique = motifDeGlob(motifs[0])
    const autrePublique = motifDeGlob(motifs[0])
    assert.notEqual(publique, autrePublique)
    publique.compile('^jamais$')
    publique.test = () => false
    publique.lastIndex = 123
    assert.equal(autrePublique.test('__cache2475__/a/x.ts'), true)
    assert.equal(correspondGlob('__cache2475__/a/x.ts', motifs[0]), true)
    for (let i = 0; i < 256; i++) correspondGlob('', `__cache2475__/purge/${i}`)
    compilations = 0
    const premier = '__cache2475__/fifo/premier'
    correspondGlob(premier, premier)
    for (let i = 0; i < 255; i++) correspondGlob('', `__cache2475__/fifo/${i}`)
    assert.equal(compilations, 256)
    assert.equal(correspondGlob(premier, premier), true)
    assert.equal(compilations, 256)
    correspondGlob('', '__cache2475__/fifo/dernier')
    assert.equal(compilations, 257)
    assert.equal(correspondGlob(premier, premier), true)
    assert.equal(compilations, 258, 'le premier motif n’a pas été évincé après 256 entrées nouvelles')
  } finally { globalThis.RegExp = constructeur }
  assert.equal(globalThis.RegExp, constructeur)
})

test('photographie typée : nature avant/après, lien, dossier vide et absence restent distincts', () => {
  const dir = mkdtempSync(join(tmpdir(), 'listing-type-'))
  try {
    writeFileSync(join(dir, 'A'), 'a')
    mkdirSync(join(dir, 'Cible'))
    symlinkSync(join(dir, 'Cible'), join(dir, 'Lien'), process.platform === 'win32' ? 'junction' : 'dir')
    const avant = listerDossier(dir, { avecTypes: true })
    assert.deepEqual(avant, { nature: 'directory', entrees: [{ nom: 'A', nature: 'file' }, { nom: 'Cible', nature: 'directory' }, { nom: 'Lien', nature: 'link' }] })
    assert.deepEqual(listerDossier(dir), ['A', 'Cible', 'Lien'])
    assert.deepEqual(listerDossier(join(dir, 'A'), { absent: 'vide', avecTypes: true }), { nature: 'other', entrees: [] })
    assert.deepEqual(listerDossier(join(dir, 'absent'), { absent: 'vide', avecTypes: true }), { nature: 'absent', entrees: [] })
    assert.deepEqual(listerDossier(join(dir, 'Cible'), { avecTypes: true }), { nature: 'directory', entrees: [] })
    rmSync(join(dir, 'A'))
    mkdirSync(join(dir, 'A'))
    assert.equal(listerDossier(dir, { avecTypes: true }).entrees[0].nature, 'directory')
    assert.equal(avant.entrees[0].nature, 'file')
  } finally { rmSync(dir, { recursive: true, force: true }) }
})

/** Sous le mur ENTIER (chaque règle l'arme) : la clôture des générateurs. */
const sousLeMurEntier = (rel) => blocsDuMur().every((c) => couvre(c, rel) && !exempte(c, rel))

// --- (a) PROPRIÉTÉ et EFFET -------------------------------------------------------------------

test('PROPRIÉTÉ — `listerDossier` rend l’ordre des unités de code, jamais celui de la création', () => {
  const dir = mkdtempSync(join(tmpdir(), 'lister-'))
  try {
    // Pas deux noms qui ne diffèrent QUE par la casse : NTFS les confondrait (un seul fichier).
    for (const nom of ['z.md', 'b.md', 'A.md', '_x.md', 'c.md']) writeFileSync(join(dir, nom), '')
    // 'A'=0x41 < '_'=0x5F < 'b'=0x62 : l'ordre des unités de code, pas celui — insensible à la casse —
    // que NTFS rendrait ('_x.md', 'A.md', 'b.md', …).
    assert.deepEqual(listerDossier(dir), ['A.md', '_x.md', 'b.md', 'c.md', 'z.md'])
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('EFFET — `listerArbre` rend le MÊME tableau quel que soit l’ordre de création des entrées', () => {
  const poser = (ordre) => {
    const dir = mkdtempSync(join(tmpdir(), 'lister-'))
    for (const rel of ordre) {
      const parts = rel.split('/')
      if (parts.length > 1) mkdirSync(join(dir, ...parts.slice(0, -1)), { recursive: true })
      writeFileSync(join(dir, ...parts), '')
    }
    return dir
  }
  const chemins = ['b/z.ts', 'a.ts', 'b/a.ts', 'c.ts', 'b/c/d.ts']
  const d1 = poser(chemins)
  const d2 = poser([...chemins].reverse())
  try {
    assert.deepEqual(listerArbre(d1), ['a.ts', 'b/a.ts', 'b/c/d.ts', 'b/z.ts', 'c.ts'])
    assert.deepEqual(listerArbre(d2), listerArbre(d1))
  } finally {
    rmSync(d1, { recursive: true, force: true })
    rmSync(d2, { recursive: true, force: true })
  }
})

test('EFFET — `listerArbre` honore `filtre` (fichiers) et `descendre` (dossiers)', () => {
  const dir = mkdtempSync(join(tmpdir(), 'lister-'))
  try {
    mkdirSync(join(dir, 'node_modules'))
    writeFileSync(join(dir, 'node_modules', 'p.ts'), '')
    writeFileSync(join(dir, 'a.ts'), '')
    writeFileSync(join(dir, 'a.md'), '')
    assert.deepEqual(
      listerArbre(dir, { filtre: (r) => r.endsWith('.ts'), descendre: (r) => r !== 'node_modules' }),
      ['a.ts'],
    )
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('EFFET — `listerArbre` ne descend aucun lien (vers un dossier, vers un fichier, mort) : chacun est rendu comme un fichier (#2603)', () => {
  const dir = mkdtempSync(join(tmpdir(), 'lister-liens-'))
  const lier = (cible, nom, type) => symlinkSync(join(dir, cible), join(dir, nom), process.platform === 'win32' ? 'junction' : type)
  try {
    mkdirSync(join(dir, 'Cible'))
    writeFileSync(join(dir, 'Cible', 'dedans.md'), '')
    writeFileSync(join(dir, 'f.md'), '')
    lier('Cible', 'LienDossier', 'dir')
    lier('f.md', 'LienFichier', 'file')
    lier('nulle-part', 'LienMort', 'file')
    assert.deepEqual(listerArbre(dir), ['Cible/dedans.md', 'LienDossier', 'LienFichier', 'LienMort', 'f.md'])
    assert.deepEqual(listerArbre(dir, { filtre: (rel) => !rel.startsWith('Lien'), descendre: () => true }), ['Cible/dedans.md', 'f.md'])
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('`parLibelle` — alphabétique ACCENTS et CASSE ignorés, là où `parUnitesDeCode` les fait décider', () => {
  // Les trois désalphabétisations mesurées sur les docs routés par CLAUDE.md quand un libellé est trié
  // en unités de code : accent APRÈS la lettre nue, majuscule AVANT toute minuscule.
  assert.deepEqual(['Transformation', 'États'].sort(parLibelle), ['États', 'Transformation'])
  assert.deepEqual(['Transformation', 'États'].sort(parUnitesDeCode), ['Transformation', 'États'])
  assert.deepEqual(['Magie Mineure', 'Magie des Arcanes'].sort(parLibelle), ['Magie des Arcanes', 'Magie Mineure'])
  assert.deepEqual(['activityById', 'ACTIVITIES'].sort(parLibelle), ['ACTIVITIES', 'activityById'])
  assert.deepEqual(['zeta', 'ACTIVITIES'].sort(parLibelle), ['ACTIVITIES', 'zeta'])
  assert.deepEqual(['zeta', 'ACTIVITIES'].sort(parUnitesDeCode), ['ACTIVITIES', 'zeta'])
})

test('`parLibelle` — ordre TOTAL et DÉTERMINISTE : deux libellés de même clé sont départagés, jamais égaux', () => {
  // Sans le départage par unités de code brutes, « Béni » et « beni » seraient ÉGAUX : l'ordre
  // retomberait sur celui de l'entrée, c'est-à-dire sur la machine.
  assert.equal(parLibelle('Béni', 'beni') === 0, false)
  assert.equal(Math.sign(parLibelle('Béni', 'beni')), -Math.sign(parLibelle('beni', 'Béni')))
  const mots = ['beni', 'Béni', 'Bénédiction', 'Beni', 'États', 'Etats', 'zeta', 'ACTIVITIES']
  const attendu = [...mots].sort(parLibelle)
  assert.deepEqual([...mots].reverse().sort(parLibelle), attendu, 'l’ordre dépend encore de l’entrée : il n’est pas TOTAL')
  assert.deepEqual([...mots].sort(parUnitesDeCode).sort(parLibelle), attendu)
})

test('`parLibelle` — les LIGATURES que NFD ne décompose pas se replient (`œ` → `oe`), `norm` compose le même repli', () => {
  assert.deepEqual(['Orateur', 'Œil du chasseur', 'Obstiné'].sort(parLibelle), ['Obstiné', 'Œil du chasseur', 'Orateur'])
  assert.deepEqual(['Criminel', 'Combat déloyal', 'Cœur vaillant'].sort(parLibelle), ['Cœur vaillant', 'Combat déloyal', 'Criminel'])
  assert.equal(norm('  Cœur '), 'coeur')
})

test('`parLibelle` — la PONCTUATION se classe après l’espace, avant tout chiffre et toute lettre (apostrophe, guillemets, tiret demi-cadratin, barre)', () => {
  assert.deepEqual(['Le Prévôt arrive', 'L’étreinte de Morr'].sort(parLibelle), ['L’étreinte de Morr', 'Le Prévôt arrive'])
  assert.deepEqual(['Rat géant', '« Prototype » du Clan Skryre'].sort(parLibelle), ['« Prototype » du Clan Skryre', 'Rat géant'])
  assert.deepEqual(['61–65', '6–10'].sort(parLibelle), ['6–10', '61–65'])
  assert.deepEqual(['Lire/Écrire', 'Lire sur les lèvres'].sort(parLibelle), ['Lire sur les lèvres', 'Lire/Écrire'], 'la ponctuation suit l’espace')
  assert.deepEqual(['Lire/Écrire', 'Lire\u202Fsur les lèvres'].sort(parLibelle), ['Lire\u202Fsur les lèvres', 'Lire/Écrire'], 'une espace fine insécable est une espace')
})

test('`absent` — `vide` rend `[]` sur un dossier absent, `lever` (défaut) lève', () => {
  const absent = join(tmpdir(), 'lister-absent-' + process.pid)
  assert.deepEqual(listerDossier(absent, { absent: 'vide' }), [])
  assert.throws(() => listerDossier(absent))
})

test('`cheminAbsent` — ENOENT, ENOTDIR et ENAMETOOLONG sont absents ; une lecture refusée ne l’est pas (#2603)', () => {
  for (const code of ['ENOENT', 'ENOTDIR', 'ENAMETOOLONG']) assert.equal(cheminAbsent(Object.assign(new Error(code), { code })), true, code)
  for (const code of ['EACCES', 'EPERM', 'ELOOP', 'EIO', undefined]) assert.equal(cheminAbsent(Object.assign(new Error('banc'), { code })), false, String(code))
  assert.equal(cheminAbsent(undefined), false)
  const dir = mkdtempSync(join(tmpdir(), 'lister-nom-long-'))
  try {
    assert.deepEqual(listerDossier(join(dir, 'JAB'.repeat(100)), { absent: 'vide', avecTypes: true }), { nature: 'absent', entrees: [] })
    assert.deepEqual(listerDossier(join(dir, 'JAB'.repeat(100)), { absent: 'vide' }), [])
  } finally { rmSync(dir, { recursive: true, force: true }) }
})

// --- (b) MUR : la portée du lint COUVRE le registre ---------------------------------------------

test('MUR — toute racine du registre des générateurs est sous les globs de chaque bloc du mur « ordre total »', () => {
  const hors = racinesDuRegistre().filter((r) => !sousLeMurEntier(r))
  assert.deepEqual(
    hors,
    [],
    `générateur N+1 hors du mur : ajoute son glob à \`GLOBS_GENERATEURS\` d’oxlint.config.mjs (il arme les deux blocs du mur) —\n  ${hors.join('\n  ')}`,
  )
})

test('UNICITÉ — chaque règle du mur est déclarée par UN SEUL bloc d’oxlint.config.mjs, en `error`, avec ses options', () => {
  for (const [regle, valeur] of Object.entries(REGLES_ORDRE_TOTAL)) {
    const blocs = configEslint.flatMap((c, i) => (c?.rules && regle in c.rules
      ? [`bloc ${i} [${(c.files ?? ['(tous les fichiers)']).join(', ')}] → ${JSON.stringify(c.rules[regle]).slice(0, 60)}`]
      : []))
    assert.equal(blocs.length, 1, `\`${regle}\` déclarée par ${blocs.length} blocs — un bloc postérieur qui la redéclare (\`off\`, \`warn\`, d’autres options) éteint le mur :\n  ${blocs.join('\n  ')}`)
    assert.equal(blocDe(regle).rules[regle], valeur, `\`${regle}\` : son bloc ne pose pas la valeur de \`REGLES_ORDRE_TOTAL\``)
    assert.equal(valeur[0], 'error', `\`${regle}\` n’est pas en \`error\``)
  }
})
