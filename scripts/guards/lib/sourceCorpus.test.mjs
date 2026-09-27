// PORTE DE RÔLE du corpus source (#1709 C1) — la lib LIT UNE FOIS PAR CLÉ, et ce qu'elle rend est
// IMMUABLE. Cinq propriétés, mesurées sur une fixture de `os.tmpdir()` (jamais le `src/` réel) :
//  (a) MÉMO      : même clé = MÊME tableau (identité), et le disque n'est pas retouché — une écriture
//      faite APRÈS la première lecture reste invisible jusqu'à `viderCorpus()`.
//  (b) CLÉ       : dossiers, extensions et `tests` font partie de la clé — trois corpus distincts.
//  (c) IMMUABLE  : tableau et entrées gelés — un mémo partagé entre fichiers de test d'un worker
//      (`isolate: false`, `vite.config.ts`) ne peut être licite qu'à cette condition.
//  (d) NORMALISÉE : la clé porte le dossier en chemin POSIX depuis la racine — absolu, relatif et
//      séparateur final désignent le MÊME corpus, là où les appelants mélangent les formes
//      (`src/state/cascade-step-stake-guard.test.ts` passe des absolus, `src/engine/grid.test.ts`
//      un relatif).
//  (e) PORTE     : `viderCorpus()` est la sortie de la condition de licéité — après elle, un fichier
//      AJOUTÉ entre deux lectures est vu, et le tableau rendu est NEUF.
//  (f) PÉRIMÈTRE : sur l'arbre RÉEL de `src/**`, l'ensemble rendu est EXACTEMENT celui d'une marche
//      naïve écrite dans ce test comme ORACLE. C'est le seul filet contre une régression de périmètre
//      de la primitive : ses appelants ont chacun troqué leur propre marche contre elle (#1709 C2),
//      aucun ne peut donc plus servir de témoin — une exclusion de trop ou de moins ici rendrait
//      toutes les gardes de corpus vertes sur un corpus amputé, sans qu'aucune ne le dise.
//  (g) REFUS DU VIDE : une clé qui rend 0 fichier LÈVE, en nommant les dossiers et les extensions
//      demandés. `listerArbre` lève déjà sur un dossier ABSENT ; ici le dossier EXISTE et ne porte
//      aucun fichier des extensions demandées — ce `[]` muet rendrait toute garde de corpus verte
//      par vacuité.
//  (h) VACUITÉ PAR BASE : le refus se mesure BASE PAR BASE, jamais sur le total agrégé. Les clés
//      multi-dossiers sont la norme (`STRICT_DIRS`/`RATCHET_DIRS` de `labelLogic.mjs`,
//      `['src','scripts']`) : sur un total, une base évaporée resterait muette derrière une base
//      peuplée — la moitié perdue du corpus ne dirait rien.
//  (i) DÉCLARATION : un `*.d.ts` est hors corpus, quelles que soient les `exts` et `tests` demandés —
//      il n'a aucun corps, donc aucun des motifs qu'une garde cherche, et il fausse tout compte de
//      modules de production.
//  (j) UN TEXTE PAR CHEMIN : deux clés qui lisent le même fichier rendent la MÊME entrée (#1801).
import test from 'node:test'
import assert from 'node:assert/strict'
// eslint-disable-next-line murs/ordre-total-imports -- ORACLE du cas (f) : marche naïve TÉMOIN, indépendante de `listerArbre` par construction (sinon le test ne prouverait rien) ; son rendu est trié par unités de code avant comparaison, l’ordre du système de fichiers n’en sort jamais.
import { mkdtempSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { readCorpus, viderCorpus } from './sourceCorpus.mjs'

/** La même racine que celle contre laquelle `sourceCorpus.mjs` normalise ses clés. */
const ROOT = fileURLToPath(new URL('../../../', import.meta.url)).replace(/[\\/]$/, '')

/** Fixture : deux `.ts` (dont un test), un `.tsx`, un `.md`, une DÉCLARATION `.d.ts`, un
 *  sous-dossier — et un dossier VOISIN. La déclaration est hors corpus : toutes les attentes de
 *  texte de ce fichier la mesurent par son ABSENCE, en plus du cas (i) qui la nomme. */
function fixture() {
  const racine = mkdtempSync(join(tmpdir(), 'corpus-'))
  const a = join(racine, 'a')
  const b = join(racine, 'b')
  mkdirSync(join(a, 'sous'), { recursive: true })
  mkdirSync(b)
  writeFileSync(join(a, 'un.ts'), 'un')
  writeFileSync(join(a, 'un.test.ts'), 'un-test')
  writeFileSync(join(a, 'sous', 'deux.tsx'), 'deux')
  writeFileSync(join(a, 'notes.md'), 'notes')
  writeFileSync(join(a, 'types.d.ts'), 'declaration')
  writeFileSync(join(b, 'trois.ts'), 'trois')
  return { racine, a, b }
}

test('une DÉCLARATION `.d.ts` est hors corpus, `tests` et `exts` quels qu’ils soient', () => {
  const { racine, a } = frais()
  try {
    assert.deepEqual(readCorpus([a]).map((f) => f.text), ['deux', 'un'])
    assert.deepEqual(readCorpus([a], { tests: true }).map((f) => f.text), ['deux', 'un-test', 'un'])
    assert.deepEqual(readCorpus([a], { exts: ['.ts'] }).map((f) => f.text), ['un'])
    // Demander l'extension elle-même ne la fait pas entrer : la base ne rend alors AUCUN fichier,
    // et c'est le refus du vide qui parle.
    assert.throws(() => readCorpus([a], { exts: ['.d.ts'], tests: true }), /CORPUS VIDE/)
  } finally {
    viderCorpus()
    rmSync(racine, { recursive: true, force: true })
  }
})

/** Chaque test part d'un mémo VIDE : le mémo vit aussi longtemps que le module. */
function frais() {
  viderCorpus()
  return fixture()
}

test('même clé = même tableau, et plus aucune lecture disque', () => {
  const { racine, a } = frais()
  try {
    const premier = readCorpus([a])
    const second = readCorpus([a])
    assert.equal(premier, second, 'deux appels de même clé doivent rendre le MÊME tableau')
    assert.equal(premier[0], second[0], 'les ENTRÉES aussi (les mémos par identité des appelants en dépendent)')
    assert.deepEqual(premier.map((f) => f.text), ['deux', 'un'])

    writeFileSync(join(a, 'un.ts'), 'un-MODIFIÉ')
    writeFileSync(join(a, 'neuf.ts'), 'neuf')
    const apres = readCorpus([a])
    assert.equal(apres, premier, 'le disque a changé : si le tableau change, c’est qu’il a été relu')
    assert.deepEqual(apres.map((f) => f.text), ['deux', 'un'])
  } finally {
    rmSync(racine, { recursive: true, force: true })
  }
})

test('`viderCorpus()` relit le disque', () => {
  const { racine, a } = frais()
  try {
    const premier = readCorpus([a])
    writeFileSync(join(a, 'un.ts'), 'un-MODIFIÉ')
    viderCorpus()
    const relu = readCorpus([a])
    assert.notEqual(relu, premier)
    assert.deepEqual(relu.map((f) => f.text), ['deux', 'un-MODIFIÉ'])
  } finally {
    rmSync(racine, { recursive: true, force: true })
  }
})

test('la clé porte les dossiers, leur ORDRE, les extensions et `tests`', () => {
  const { racine, a, b } = frais()
  try {
    const surA = readCorpus([a])
    assert.notEqual(readCorpus([b]), surA, 'dossier différent')
    assert.deepEqual(readCorpus([b]).map((f) => f.text), ['trois'])
    assert.notEqual(readCorpus([a, b]), surA, 'jeu de dossiers différent')
    assert.deepEqual(readCorpus([a, b]).map((f) => f.text), ['deux', 'un', 'trois'])
    assert.notEqual(readCorpus([b, a]), readCorpus([a, b]), 'l’ORDRE décide de l’ordre du résultat')
    assert.deepEqual(readCorpus([b, a]).map((f) => f.text), ['trois', 'deux', 'un'])
    assert.notEqual(readCorpus([a], { exts: ['.ts'] }), surA, 'extensions différentes')
    assert.deepEqual(readCorpus([a], { exts: ['.ts'] }).map((f) => f.text), ['un'])
    assert.notEqual(readCorpus([a], { tests: true }), surA, '`tests` différent')
    assert.deepEqual(readCorpus([a], { tests: true }).map((f) => f.text), ['deux', 'un-test', 'un'])
    assert.equal(readCorpus([a], { exts: ['.tsx', '.ts'] }), readCorpus([a], { exts: ['.ts', '.tsx'] }),
      'la clé est le CONTENU des extensions, pas leur ordre d’écriture')
  } finally {
    rmSync(racine, { recursive: true, force: true })
  }
})

test('deux clés qui lisent le même chemin rendent la MÊME entrée, donc un seul texte', () => {
  const { racine, a, b } = frais()
  try {
    const surA = readCorpus([a])
    const surAB = readCorpus([a, b])
    const avecTests = readCorpus([a], { tests: true })
    const un = (corpus) => corpus.find((f) => f.rel.endsWith('/un.ts'))
    assert.notEqual(surAB, surA, 'deux clés, deux tableaux')
    assert.equal(un(surAB), un(surA), 'clé `[a, b]` : la même entrée que clé `[a]`')
    assert.equal(un(avecTests), un(surA), 'clé `tests` : la même entrée que clé `[a]`')
  } finally {
    rmSync(racine, { recursive: true, force: true })
  }
})

test('le tableau rendu et ses entrées sont GELÉS', () => {
  const { racine, a } = frais()
  try {
    const corpus = readCorpus([a])
    assert.ok(Object.isFrozen(corpus), 'le tableau doit être gelé')
    assert.ok(corpus.every((f) => Object.isFrozen(f)), 'chaque entrée doit être gelée')
    assert.throws(() => corpus.push({ abs: '', rel: 'x', text: '' }), TypeError)
    assert.throws(() => { corpus[0] = { abs: '', rel: 'x', text: '' } }, TypeError)
    assert.throws(() => { corpus[0].text = 'usurpé' }, TypeError)
  } finally {
    rmSync(racine, { recursive: true, force: true })
  }
})

test('la clé est NORMALISÉE : absolu ≡ relatif ≡ séparateur final', () => {
  const { racine, a } = frais()
  try {
    const parAbsolu = readCorpus([a])
    const rel = relative(ROOT, a)
    assert.equal(readCorpus([rel]), parAbsolu, 'le MÊME dossier écrit en relatif doit rendre le MÊME tableau')
    assert.equal(readCorpus([`${rel}/`]), parAbsolu, 'un slash final ne fabrique pas un second corpus')
    assert.equal(readCorpus([a + sep]), parAbsolu, 'ni un séparateur final sur la forme absolue')
    assert.deepEqual(readCorpus([rel]).map((f) => f.text), ['deux', 'un'])
  } finally {
    rmSync(racine, { recursive: true, force: true })
  }
})

/**
 * ORACLE de périmètre : la marche la plus bête qui puisse répondre à la même question — descente
 * récursive de `readdirSync`, filtre d'extension sur le nom, motif d'INSTRUMENT Vitest (suite OU
 * banc) RÉÉCRIT à la main — le témoin n'IMPORTE pas `estFichierVitest` : partager le prédicat
 * rendrait l'oracle circulaire, il ne pourrait plus contredire le corpus. Écrite ICI et nulle part
 * ailleurs : c'est le témoin indépendant de `listerArbre` + `readCorpus`. Aucun cardinal n'est
 * attendu — l'oracle est la MARCHE, jamais un nombre, qui périmerait au fichier suivant.
 * @param {string} dir @param {string[]} exts @param {boolean} tests
 * @returns {string[]} chemins POSIX depuis la racine du dépôt, triés.
 */
function marcheNaive(dir, exts, tests) {
  const out = []
  const descendre = (d) => {
    for (const nom of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, nom.name)
      if (nom.isDirectory()) { descendre(p); continue }
      if (!exts.some((e) => nom.name.endsWith(e))) continue
      if (!tests && /\.(test|bench)\.[cm]?[jt]sx?$/.test(nom.name)) continue
      if (/\.d\.ts$/.test(nom.name)) continue
      out.push(relative(ROOT, p).split('\\').join('/'))
    }
  }
  descendre(dir)
  return out.sort()
}

test('PÉRIMÈTRE sur l’arbre RÉEL : `readCorpus([\'src\'])` rend EXACTEMENT la marche naïve, tests exclus puis inclus', () => {
  viderCorpus()
  const SRC = join(ROOT, 'src')
  for (const tests of [false, true]) {
    const attendu = marcheNaive(SRC, ['.ts', '.tsx'], tests)
    const rendu = readCorpus(['src'], { tests }).map((f) => f.rel)
    assert.ok(attendu.length > 0, 'l’oracle lui-même ne voit rien : la comparaison ne prouverait rien')
    const trie = [...rendu].sort()
    const oracle = new Set(attendu)
    const vus = new Set(trie)
    const enTrop = trie.filter((x) => !oracle.has(x))
    const manquants = attendu.filter((x) => !vus.has(x))
    assert.deepEqual(enTrop, [], `tests:${tests} — fichiers VUS que l’oracle ne voit pas`)
    assert.deepEqual(manquants, [], `tests:${tests} — fichiers de l’oracle PERDUS par readCorpus`)
    assert.deepEqual(trie, rendu, 'le corpus est rendu en ORDRE TOTAL : il est déjà trié')
  }
  const horsTests = readCorpus(['src']).map((f) => f.rel)
  const avecTests = readCorpus(['src'], { tests: true }).map((f) => f.rel)
  assert.ok(avecTests.length > horsTests.length, '`tests: true` doit ÉLARGIR le corpus')
  assert.ok(
    avecTests.some((r) => /\.test\.tsx?$/.test(r)) && horsTests.every((r) => !/\.test\./.test(r)),
    'le filtre `tests` ne discrimine plus les fichiers de test',
  )
  assert.ok(
    avecTests.some((r) => /\.bench\.tsx?$/.test(r)) && horsTests.every((r) => !/\.bench\./.test(r)),
    '`tests: true` INCLUT exactement ce que le filtre exclut : les BANCS aussi, pas les seules suites',
  )
})

test('`viderCorpus()` fait VOIR un fichier AJOUTÉ entre deux lectures', () => {
  const { racine, a } = frais()
  try {
    const premier = readCorpus([a])
    writeFileSync(join(a, 'neuf.ts'), 'neuf')
    assert.equal(readCorpus([a]), premier, 'sans la porte, l’ajout reste invisible')
    viderCorpus()
    const relu = readCorpus([a])
    assert.notEqual(relu, premier, 'après la porte, le tableau rendu est NEUF')
    assert.deepEqual([...relu.map((f) => f.text)].sort(), ['deux', 'neuf', 'un'])
  } finally {
    rmSync(racine, { recursive: true, force: true })
  }
})

test('REFUS DU VIDE : dossier PRÉSENT sans fichier des extensions demandées → refus NOMMÉ', () => {
  const { racine, a } = frais()
  const nom = racine.split(sep).pop()
  try {
    assert.deepEqual(readCorpus([a]).map((f) => f.text), ['deux', 'un'], 'le dossier peuplé se lit normalement')

    assert.throws(
      () => readCorpus([a], { exts: ['.css'] }),
      (err) => {
        assert.match(err.message, new RegExp(`${nom}/a`), 'le refus nomme le dossier demandé')
        assert.match(err.message, /\.css/, 'le refus nomme les extensions demandées')
        assert.match(err.message, /vacuité/, 'le refus dit POURQUOI un corpus vide est refusé')
        return true
      },
    )

    // Le dossier existe et ne porte AUCUN fichier : `listerArbre` ne lève pas (il ne lève que sur
    // l'ABSENT), c'est ce refus-ci qui parle.
    const vide = join(racine, 'vide')
    mkdirSync(vide)
    assert.throws(() => readCorpus([vide]), /CORPUS VIDE/)

    // Un `tests: false` qui vide la population est refusé comme le reste : le corpus RENDU est vide.
    const quTests = join(racine, 'qu-tests')
    mkdirSync(quTests)
    writeFileSync(join(quTests, 'seul.test.ts'), 'seul')
    assert.throws(() => readCorpus([quTests]), /CORPUS VIDE/)
    assert.deepEqual(readCorpus([quTests], { tests: true }).map((f) => f.text), ['seul'])
  } finally {
    viderCorpus()
    rmSync(racine, { recursive: true, force: true })
  }
})

test('REFUS DU VIDE : la vacuité se mesure PAR BASE — une base vide ne se cache pas derrière une base peuplée', () => {
  const { racine, a } = frais()
  const nom = racine.split(sep).pop()
  try {
    const vide = join(racine, 'vide')
    mkdirSync(vide)
    // La clé multi-dossiers est la norme (`STRICT_DIRS`/`RATCHET_DIRS`, `['src','scripts']`) : sur un
    // total agrégé, `a` (peuplé) couvrirait `vide`, et la moitié évaporée du corpus resterait muette.
    // La base fautive est nommée entre crochets, en chemin POSIX depuis la racine du dépôt.
    const nomme = `${nom}/vide] pour les extensions`
    assert.throws(
      () => readCorpus([a, vide]),
      (err) => {
        assert.ok(err.message.includes(nomme), `le refus doit nommer la BASE fautive — reçu : ${err.message}`)
        return true
      },
    )
    assert.throws(
      () => readCorpus([vide, a]),
      (err) => {
        assert.ok(err.message.includes(nomme), 'quel que soit son rang dans la clé')
        return true
      },
    )
    assert.deepEqual(readCorpus([a]).map((f) => f.text), ['deux', 'un'], 'la base peuplée seule se lit toujours')
  } finally {
    viderCorpus()
    rmSync(racine, { recursive: true, force: true })
  }
})
