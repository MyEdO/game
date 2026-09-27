// Contrat de l'EMPREINTE DE SOURCES (#1679 L1b) : ce qu'un générateur lit se MESURE, le pied du doc
// porte l'empreinte des sources du DISQUE, `--empreinte` la recalcule sur l'INDEX.
//   node --test scripts/docs/lib/enregistreur-lectures.test.mjs
//
// Chaque mesure de générateur ci-dessous est une MORSURE : elle rougit si l'une des trois mécaniques
// est débranchée — `module.syncBuiltinESMExports()` (les liaisons ESM figées rendent l'enveloppe de
// `fs` invisible), la propagation par `NODE_OPTIONS` (les dumpers lancés en sous-processus), et
// l'entrée `tsx/esm` (l'exécutable `tsx` re-spawne un processus qui perd le préchargeur).
import test from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { installer } from './enregistreur-lectures.mjs'
import { listerDossier } from '../../guards/lib/lister.mjs'
import { instanceDeDepot } from '../../guards/lib/depotGabarit.mjs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import {
  avecPied, ecrireDoc, empreinteDuDisque, empreinteDeLIndex, existeFichier, fusionnerLectures, hashListing,
  indexGit, lirePied, retirerPied, serialiserSourcesLues, sha1Corps,
} from './empreinte-sources.mjs'
import { ignoresGit } from './chemin-mesure.mjs'
import { ciblesNonSignees, refusSourcesInsuffisantes } from '../build-all.mjs'
import { ciblesDesArmes, generateursArmes } from '../../guards/lib/empreinteStage.mjs'

const ICI = path.dirname(fileURLToPath(import.meta.url))
const RACINE = path.resolve(ICI, '..', '..', '..')
const ENREGISTREUR = pathToFileURL(path.join(ICI, 'enregistreur-lectures.mjs')).href
const TSX_ESM = path.join(RACINE, 'node_modules', 'tsx', 'dist', 'esm', 'index.mjs')

/** Joue un générateur en `--check` sous l'enregistreur et rend son set de lectures fusionné. */
function mesurer(script, cible, { tsx = false } = {}) {
  const sortie = mkdtempSync(path.join(tmpdir(), 'lectures-'))
  try {
    const ignores = path.join(sortie, 'ignores')
    writeFileSync(ignores, JSON.stringify([...ignoresGit(RACINE)]))
    execFileSync(process.execPath, [...(tsx ? ['--import', pathToFileURL(TSX_ESM).href] : []), script, '--check'], {
      cwd: RACINE,
      stdio: 'ignore',
      env: {
        ...process.env,
        NODE_OPTIONS: `${process.env.NODE_OPTIONS ?? ''} --import ${ENREGISTREUR}`.trim(),
        WFRP_LECTURES_RACINE: RACINE,
        WFRP_LECTURES_SORTIE: path.join(sortie, 'l'),
        WFRP_LECTURES_IGNORES: ignores,
        WFRP_LECTURES_CIBLE: cible,
      },
    })
    return fusionnerLectures(sortie)
  } finally {
    rmSync(sortie, { recursive: true, force: true })
  }
}

test('témoin : build-index-moteur mesure plus de 100 sources (liaisons ESM synchronisées)', () => {
  const lues = mesurer('scripts/docs/build-index-moteur.mjs', 'docs/index-moteur.md')
  assert.ok(lues.fichiers.length > 100, `sources mesurées : ${lues.fichiers.length}`)
  assert.ok(lues.fichiers.includes('src/engine/combat.ts'), 'src/engine/combat.ts absent du set')
  assert.ok(!lues.fichiers.includes('docs/index-moteur.md'), 'le doc CIBLE ne peut pas être sa propre source')
})

test('sous-processus : build-donnees mesure les schémas lus par son dumper tsx (NODE_OPTIONS)', () => {
  const lues = mesurer('scripts/docs/build-donnees.mjs', 'docs/donnees.md')
  const schemas = lues.fichiers.filter((f) => f.startsWith('src/data/schemas/'))
  assert.ok(schemas.length > 100, `schémas mesurés : ${schemas.length} (le dumper est un sous-processus)`)
  assert.ok(lues.fichiers.includes('tsconfig.json'), 'tsconfig.json absent : le thread des hooks du dumper n\'est pas mesuré')
})

test('runner tsx : build-structures mesure src/data ET src/scenes (entrée tsx/esm)', () => {
  const lues = mesurer('scripts/docs/build-structures.mts', 'docs/structures-donnees.md', { tsx: true })
  assert.ok(lues.fichiers.some((f) => f.startsWith('src/data/')), 'aucune source src/data')
  assert.ok(lues.fichiers.some((f) => f.startsWith('src/scenes/')), 'aucune source src/scenes')
})

// Le chargement du TypeScript par tsx LIT `tsconfig.json` depuis le thread des hooks, sur les deux
// OS. Sans l'enveloppe de `fs` de `enregistreur-hooks.mjs`, ce chemin ne rentre que sous Linux (la
// CI ubuntu 33791873905 le rendait en +1 par générateur tsx) et le dérivé cesse d'être cross-OS.
test('thread des hooks : un générateur chargé par tsx mesure tsconfig.json (dérivé cross-OS)', () => {
  const lues = mesurer('scripts/docs/build-structures.mts', 'docs/structures-donnees.md', { tsx: true })
  assert.ok(
    lues.fichiers.includes('tsconfig.json'),
    `tsconfig.json absent du set (${lues.fichiers.length} sources) : les lectures du thread des hooks ne sont pas enregistrées`,
  )
  // Le hook `load` voit aussi des spécificateurs sans chemin sur le disque : un `node:child_process`
  // pris pour un chemin relatif fait échouer le hachage de l'empreinte (ENOENT sur `<racine>/node:…`).
  assert.deepEqual(lues.fichiers.filter((f) => /^[a-z]+:/.test(f)), [], 'un spécificateur non-fichier est entré dans le set')
})

test('un set vide ou minuscule ARRÊTE la génération, en nommant le générateur', () => {
  assert.match(refusSourcesInsuffisantes('scripts/docs/build-x.mjs', 0), /build-x\.mjs.*0 source\(s\).*AVEUGLE/)
  assert.match(refusSourcesInsuffisantes('scripts/docs/build-x.mjs', 1), /1 source\(s\)/)
  assert.equal(refusSourcesInsuffisantes('scripts/docs/build-x.mjs', 2), null)
  // Le refus dit AUSSI ce qui est sorti de la mesure : 0 source mesurée et 7 chemins écartés n'est pas
  // le même défaut que 0 source mesurée tout court.
  assert.match(refusSourcesInsuffisantes('scripts/docs/build-x.mjs', 0, 7), /7 chemin\(s\) lu\(s\) hors racine/)
})

test('un fichier AJOUTÉ à un dossier lu change l\'empreinte, sans qu\'aucun contenu ne soit lu', () => {
  const racine = mkdtempSync(path.join(tmpdir(), 'empreinte-'))
  try {
    mkdirSync(path.join(racine, 'd'))
    writeFileSync(path.join(racine, 'd', 'a.json'), '{}')
    const lues = () => ({ fichiers: ['d/a.json'], dossiers: new Map([['d', listerDossier(path.join(racine, 'd'))]]) })
    const avant = empreinteDuDisque(racine, lues(), new Set()).empreinte
    writeFileSync(path.join(racine, 'd', 'b.json'), '{}')
    const apres = empreinteDuDisque(racine, lues(), new Set()).empreinte
    assert.notEqual(avant, apres, 'le listing du dossier n\'entre pas dans l\'empreinte')
    assert.notEqual(hashListing(['a.json']), hashListing(['a.json', 'b.json']))
  } finally {
    rmSync(racine, { recursive: true, force: true })
  }
})

/** Dépôt jetable : une source, un doc dérivé signé, un `docs/.sources-lues.json`. */
function depotFixture() {
  const { racine } = instanceDeDepot({
    commit: false,
    fichiers: {
      'src/source.ts': 'export const x = 1\n',
      'docs/reprise-apres-pause.md': '# doc\n',
      'docs/.sources-lues.json': serialiserSourcesLues({
        'scripts/docs/build-reprise.mjs': { cibles: ['docs/reprise-apres-pause.md'], fichiers: ['src/source.ts'], dossiers: ['src'] },
      }),
    },
  })
  const git = (...args) => execFileSync('git', args, { cwd: racine, encoding: 'utf8' })
  return { racine, git }
}

/** Signe le doc comme le ferait `build-all` : empreinte des sources TELLES QUE LE DISQUE les porte. */
function signer(racine) {
  const lues = { fichiers: ['src/source.ts'], dossiers: new Map([['src', listerDossier(path.join(racine, 'src'))]]) }
  const { empreinte } = empreinteDuDisque(racine, lues, new Set())
  const doc = path.join(racine, 'docs', 'reprise-apres-pause.md')
  writeFileSync(doc, avecPied(readFileSync(doc, 'utf8'), { empreinte, fichiers: 1, dossiers: 1 }))
}

function empreinter(racine) {
  try {
    return { code: 0, sortie: execFileSync(process.execPath, [path.join(RACINE, 'scripts', 'docs', 'build-all.mjs'), '--empreinte'], { cwd: racine, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }) }
  } catch (e) {
    return { code: e.status, sortie: `${e.stdout ?? ''}${e.stderr ?? ''}` }
  }
}

test('--empreinte : tout stagé passe, une source régénérée hors index est REFUSÉE par son nom', () => {
  const { racine, git } = depotFixture()
  try {
    signer(racine)
    git('add', '-A')
    const vert = empreinter(racine)
    assert.equal(vert.code, 0, vert.sortie)
    assert.match(vert.sortie, /docs:empreinte — OK/)

    // La source change sur le DISQUE et n'est PAS stagée ; le doc est régénéré sur cet arbre-là.
    writeFileSync(path.join(racine, 'src', 'source.ts'), 'export const x = 2\n')
    signer(racine)
    git('add', 'docs/reprise-apres-pause.md')
    const rouge = empreinter(racine)
    assert.equal(rouge.code, 1)
    assert.match(rouge.sortie, /docs\/reprise-apres-pause\.md : doc régénéré depuis un arbre ≠ index/)
    assert.match(rouge.sortie, /src\/source\.ts/)
  } finally {
    rmSync(racine, { recursive: true, force: true })
  }
})

test('--empreinte : une source NON SUIVIE est nommée, jamais hashée à vide', () => {
  const { racine, git } = depotFixture()
  try {
    signer(racine)
    git('add', '-A')
    git('rm', '--cached', '-q', 'src/source.ts')
    const rouge = empreinter(racine)
    assert.equal(rouge.code, 1)
    assert.match(rouge.sortie, /source non suivie « src\/source\.ts »/)
  } finally {
    rmSync(racine, { recursive: true, force: true })
  }
})

test('le pied se pose et se retire À L\'OCTET, en un seul exemplaire', () => {
  const corps = '# doc\n\ncontenu\n\n'
  const signe = avecPied(corps, { empreinte: 'a'.repeat(40), fichiers: 3, dossiers: 1 })
  assert.equal(retirerPied(signe), corps)
  // Le pied signe AUSSI le corps (#1679 T1d) : `avecPied` calcule ce sha1 sur le texte qu'il signe.
  assert.deepEqual(lirePied(signe), {
    empreinte: 'a'.repeat(40),
    fichiers: 3,
    dossiers: 1,
    corps: sha1Corps(signe),
  })
  assert.equal(retirerPied(avecPied(signe, { empreinte: 'b'.repeat(40), fichiers: 1, dossiers: 0 })), corps)
  assert.equal(lirePied(corps), null)
  // La graphie d'AVANT T1d se relit (son `corps` est `null`) et se RETIRE : une re-signature n'empile
  // pas deux pieds.
  const ancien = `${corps}<!-- sources-empreinte: ${'a'.repeat(40)} (3 fichiers, 1 dossiers) -->\n`
  assert.equal(lirePied(ancien).corps, null)
  assert.equal(retirerPied(ancien), corps)
  assert.equal(retirerPied(avecPied(ancien, { empreinte: 'b'.repeat(40), fichiers: 1, dossiers: 0 })), corps)
})

test('docs/.sources-lues.json est DÉTERMINISTE : l\'ordre de mesure ne le change pas', () => {
  const entree = (n) => ({ cibles: [`docs/${n}.md`], fichiers: [`src/b/${n}.ts`, `src/a/${n}.ts`], dossiers: ['src/b', 'src/a'] })
  const direct = serialiserSourcesLues({ 'scripts/a.mjs': entree('a'), 'scripts/b.mjs': entree('b') })
  const inverse = serialiserSourcesLues({ 'scripts/b.mjs': entree('b'), 'scripts/a.mjs': entree('a') })
  assert.equal(direct, inverse)
  assert.match(direct, /"src\/a\/a\.ts",\n {6}"src\/b\/a\.ts"/)
})

test('un fichier NON SUIVI dans un dossier lu écarte l\'empreinte du disque de celle de l\'index', () => {
  const { racine, git } = depotFixture()
  try {
    git('add', '-A')
    const lues = () => ({ fichiers: ['src/source.ts'], dossiers: new Map([['src', listerDossier(path.join(racine, 'src'))]]) })
    const blobs = indexGit(racine)
    const parLIndex = empreinteDeLIndex(blobs, { fichiers: ['src/source.ts'], dossiers: new Map([['src', []]]) }).empreinte
    assert.equal(empreinteDuDisque(racine, lues(), new Set()).empreinte, parLIndex)
    writeFileSync(path.join(racine, 'src', 'intrus.ts'), 'export const y = 2\n')
    assert.notEqual(empreinteDuDisque(racine, lues(), new Set()).empreinte, parLIndex)
    // Le même fichier IGNORÉ par git ne sort pas du listing de l'index : l'empreinte ne bouge pas.
    assert.equal(empreinteDuDisque(racine, lues(), new Set(['src/intrus.ts'])).empreinte, parLIndex)
  } finally {
    rmSync(racine, { recursive: true, force: true })
  }
})

test('indexGit rend les chemins NON-ASCII tels quels (core.quotepath neutralisé)', () => {
  const blobs = indexGit(RACINE)
  const accentue = 'Source/WH - V4 - Aux Armes/01 - CREDITS.md'
  assert.ok(blobs.has(accentue), `« ${accentue} » absent de l'index lu : git l'a rendu échappé en octal`)
  assert.ok([...blobs.keys()].every((p) => !p.startsWith('"')), 'un chemin est rendu entre guillemets')
  assert.match(blobs.get(accentue), /^[0-9a-f]{40}$/)
})

test('une cible SANS pied est nommée par l\'auto-contrôle de fin de génération', () => {
  const racine = mkdtempSync(path.join(tmpdir(), 'signature-'))
  try {
    mkdirSync(path.join(racine, 'docs'))
    const doc = path.join(racine, 'docs', 'systemes.md')
    writeFileSync(doc, '# corps\n')
    const par = { 'scripts/docs/build-systemes.mjs': { cibles: ['docs/systemes.md'], fichiers: [], dossiers: [] } }
    assert.deepEqual(ciblesNonSignees(racine, par), ['docs/systemes.md (écrit par scripts/docs/build-systemes.mjs)'])
    writeFileSync(doc, avecPied(readFileSync(doc, 'utf8'), { empreinte: 'c'.repeat(40), fichiers: 1, dossiers: 0 }))
    assert.deepEqual(ciblesNonSignees(racine, par), [])
    // Un générateur joué SEUL réécrit sa cible : `ecrireDoc` lui rend son pied, la cible reste signée.
    ecrireDoc(doc, '# corps RÉGÉNÉRÉ\n')
    assert.deepEqual(ciblesNonSignees(racine, par), [])
    assert.match(
      readFileSync(doc, 'utf8'),
      /^# corps RÉGÉNÉRÉ\n<!-- sources-empreinte: c{40} \(1 fichiers, 0 dossiers\) corps: [0-9a-f]{40} -->\n$/,
    )
    // Le corps signé SUIT le corps écrit : c'est ce qui rend une édition à la main visible.
    assert.equal(lirePied(readFileSync(doc, 'utf8')).corps, sha1Corps(readFileSync(doc, 'utf8')))
    // À rendu IDENTIQUE, `ecrireDoc` n'écrit PAS : la mtime ne bouge pas (les trois rapports d'Atlas
    // réécrivaient leur .md à chaque run, pendant que la suite lit docs/raw/ dans une autre lane).
    const avant = statSync(doc).mtimeMs
    ecrireDoc(doc, '# corps RÉGÉNÉRÉ\n')
    assert.equal(statSync(doc).mtimeMs, avant, '`ecrireDoc` a réécrit un fichier inchangé')
  } finally {
    rmSync(racine, { recursive: true, force: true })
  }
})

test('le hook n\'arme QUE les générateurs dont un DOC est stagé — jamais une source', () => {
  const lues = {
    'scripts/docs/build-index-moteur.mjs': { cibles: ['docs/index-moteur.md'], fichiers: ['src/engine/combat.ts'], dossiers: [] },
    'scripts/docs/build-systemes.mjs': { cibles: ['docs/systemes.md'], fichiers: ['src/state/store.ts'], dossiers: [] },
  }
  assert.deepEqual(generateursArmes(lues, ['docs\\index-moteur.md']), ['scripts/docs/build-index-moteur.mjs'])
  assert.deepEqual(generateursArmes(lues, ['docs/index-moteur.md', 'docs/systemes.md']), ['scripts/docs/build-index-moteur.mjs', 'scripts/docs/build-systemes.mjs'])
  // Une SOURCE stagée seule n'arme rien : le doc qu'elle périme ne part pas dans ce commit.
  assert.deepEqual(generateursArmes(lues, ['src/engine/combat.ts', 'src/state/store.ts']), [])
  // Le dérivé des sets stagé SEUL non plus (il n'est la cible d'aucun générateur).
  assert.deepEqual(generateursArmes(lues, ['docs/.sources-lues.json']), [])
  assert.deepEqual(generateursArmes(lues, ['src/ui/Prose.tsx']), [])
})

test('le refus NOMME les cibles des générateurs armés — un sha1 nu ne dit pas quoi régénérer', () => {
  const lues = {
    'scripts/docs/build-index-moteur.mjs': { cibles: ['docs/index-moteur.md'], fichiers: [], dossiers: [] },
    'scripts/raw/build-catalogs.mjs': { cibles: ['docs/raw/4e/catalogue-sorts.md', 'docs/index-moteur.md'], fichiers: [], dossiers: [] },
  }
  // Triées, dédupliquées (deux générateurs peuvent nommer la même cible dans un refus).
  assert.deepEqual(
    ciblesDesArmes(lues, ['scripts/raw/build-catalogs.mjs', 'scripts/docs/build-index-moteur.mjs']),
    ['docs/index-moteur.md', 'docs/raw/4e/catalogue-sorts.md'],
  )
  // Un générateur que la mesure ne porte pas ne fabrique pas de cible fantôme.
  assert.deepEqual(ciblesDesArmes(lues, ['scripts/docs/build-inconnu.mjs']), [])
  assert.deepEqual(ciblesDesArmes(lues, []), [])
})

test('--empreinte sans aucun doc à juger sort 0, en le disant', () => {
  const { racine, git } = depotFixture()
  try {
    signer(racine)
    git('add', '-A')
    const seul = execFileSync(process.execPath, [path.join(RACINE, 'scripts', 'docs', 'build-all.mjs'), '--empreinte', '--only', 'scripts/docs/build-inconnu.mjs'], { cwd: racine, encoding: 'utf8' })
    assert.match(seul, /aucun doc stagé/)
  } finally {
    rmSync(racine, { recursive: true, force: true })
  }
})

// #1721 : NTFS est INSENSIBLE à la casse. Tant que la décision « sous la racine » se prenait sur des
// octets (`abs.startsWith(base + sep)`), une lecture dont le disque ou un segment ne portait pas la
// casse de la racine sortait de la mesure, et rien ne le disait.
test('casse : une lecture par un chemin à casse différente est COMPTÉE, une lecture hors racine est REJETÉE', (t) => {
  const racine = realpathSync.native(mkdtempSync(path.join(tmpdir(), 'casse-')))
  const dehors = realpathSync.native(mkdtempSync(path.join(tmpdir(), 'dehors-')))
  try {
    mkdirSync(path.join(racine, 'notes'))
    writeFileSync(path.join(racine, 'notes', 'x.md'), '# x\n')
    writeFileSync(path.join(dehors, 'y.md'), '# y\n')
    // Le MÊME fichier, désigné avec la casse changée sur le disque ET sur un segment sous la racine.
    const autreCasse = path.join(racine.replace(/^[A-Za-z]:/, (d) => d.toLowerCase()), 'NOTES', 'x.md')
    let insensible = true
    try {
      readFileSync(autreCasse)
    } catch {
      insensible = false
    }

    const collecteur = installer({ racine, ignores: new Set() })
    try {
      if (insensible) readFileSync(autreCasse)
      readFileSync(path.join(dehors, 'y.md'))
      // Le MÊME fichier hors racine, désigné par une autre casse : un seul chemin rejeté.
      if (insensible) readFileSync(path.join(dehors, 'Y.md'))
    } finally {
      collecteur.restaurer()
    }
    const rendu = collecteur.rendu()

    // Sur un système de fichiers SENSIBLE à la casse, `autreCasse` ne désigne aucun fichier : il n'y
    // a pas de lecture à mesurer, et le contrat de rejet, lui, se juge sur les deux OS.
    if (!insensible) t.diagnostic(`système de fichiers sensible à la casse : « ${autreCasse} » ne désigne aucun fichier`)
    assert.deepEqual(
      rendu.fichiers, insensible ? ['notes/x.md'] : [],
      `lecture par « ${autreCasse} » : set rendu ${JSON.stringify(rendu.fichiers)} (attendu la casse du DISQUE)`,
    )
    assert.ok(!rendu.fichiers.some((f) => f.endsWith('y.md')), 'une lecture hors racine est entrée dans le set')
    assert.equal(
      rendu.cheminsRejetes, 1,
      `chemins rejetés : ${rendu.cheminsRejetes} — attendu le seul « ${path.join(dehors, 'y.md')} », quelle que soit la casse et le nombre d'appels à « fs »`,
    )
  } finally {
    rmSync(racine, { recursive: true, force: true })
    rmSync(dehors, { recursive: true, force: true })
  }
})

// #1769 : un script Python pose `__pycache__/` (ignoré par git) dans un dossier que les générateurs
// listent. Enregistré, il faisait dépendre l'empreinte committée de l'état local du disque.
test('un dossier IGNORÉ par git, posé dans un dossier lu, ne change ni le listing, ni les dossiers, ni l\'empreinte', () => {
  const { racine: brute } = instanceDeDepot({
    fichiers: { '.gitignore': '__pycache__/\n*.log\n', 'lib/geometrie.py': 'x = 1\n' },
  })
  const racine = realpathSync.native(brute)
  try {
    // Un fichier SUIVI qui répond pourtant à un motif de `.gitignore` : il reste dans le plan git.
    writeFileSync(path.join(racine, 'lib', 'suivi.log'), 'trace\n')
    execFileSync('git', ['add', '-f', 'lib/suivi.log'], { cwd: racine, stdio: 'pipe' })
    const cache = path.join(racine, 'lib', '__pycache__')
    const mesurerLib = () => {
      const ignores = ignoresGit(racine)
      const collecteur = installer({ racine, ignores })
      try {
        listerDossier(path.join(racine, 'lib'))
        readFileSync(path.join(racine, 'lib', 'geometrie.py'))
        readFileSync(path.join(racine, 'lib', 'suivi.log'))
        if (existeFichier(path.join(cache, 'geometrie.pyc'))) {
          listerDossier(cache)
          readFileSync(path.join(cache, 'geometrie.pyc'))
        }
      } finally {
        collecteur.restaurer()
      }
      const rendu = collecteur.rendu()
      const lues = { fichiers: rendu.fichiers, dossiers: new Map(Object.entries(rendu.dossiers)) }
      return { rendu, empreinte: empreinteDuDisque(racine, lues, ignores).empreinte }
    }

    const propre = mesurerLib()
    assert.deepEqual(propre.rendu.fichiers, ['lib/geometrie.py', 'lib/suivi.log'], 'le fichier SUIVI sous motif ignoré est sorti de la mesure')
    assert.deepEqual(propre.rendu.dossiers, { lib: ['geometrie.py', 'suivi.log'] })

    mkdirSync(cache)
    writeFileSync(path.join(cache, 'geometrie.pyc'), 'bytecode')
    const salie = mesurerLib()
    assert.deepEqual(salie.rendu.dossiers, propre.rendu.dossiers, 'le dossier ignoré est entré dans les dossiers ou le listing mesurés')
    assert.deepEqual(salie.rendu.fichiers, propre.rendu.fichiers, 'un fichier du dossier ignoré est entré dans la mesure')
    assert.equal(salie.empreinte, propre.empreinte, 'l\'empreinte dépend d\'un dossier ignoré par git')
    // Celle de l'INDEX, recalculée par `--empreinte` au commit, est la même.
    const parLIndex = empreinteDeLIndex(indexGit(racine), { fichiers: salie.rendu.fichiers, dossiers: new Map([['lib', []]]) })
    assert.equal(parLIndex.empreinte, salie.empreinte)
  } finally {
    rmSync(racine, { recursive: true, force: true })
  }
})

test('un `installer` SANS ensemble `ignores` refuse de s\'installer, au lieu d\'écarter chaque lecture en silence', async () => {
  const fs = await import('node:fs')
  const avant = fs.default.readFileSync
  for (const ignores of [undefined, ['node_modules']]) {
    assert.throws(() => installer({ racine: RACINE, ignores }), /`ignores` \(ensemble `ignoresGit`\) absent/)
    assert.equal(fs.default.readFileSync, avant, 'l\'enveloppe de `fs` a été posée malgré le refus')
  }
})

test('le compteur de rejets voyage avec la mesure fusionnée (un rejet muet = une absence de lecture)', () => {
  const sortie = mkdtempSync(path.join(tmpdir(), 'fusion-'))
  try {
    writeFileSync(path.join(sortie, 'l.1.json'), JSON.stringify({ fichiers: ['a.ts'], dossiers: {}, ecrits: [], cheminsRejetes: 2 }))
    writeFileSync(path.join(sortie, 'l.2.json'), JSON.stringify({ fichiers: ['b.ts'], dossiers: {}, ecrits: [], cheminsRejetes: 3 }))
    const lues = fusionnerLectures(sortie)
    // Des chemins distincts PAR PID, sommés : deux processus qui lisent le même chemin hors racine
    // comptent 2.
    assert.equal(lues.cheminsRejetes, 5)
    assert.deepEqual(lues.fichiers, ['a.ts', 'b.ts'])
  } finally {
    rmSync(sortie, { recursive: true, force: true })
  }
})
