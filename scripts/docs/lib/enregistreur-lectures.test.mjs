// Contrat de la MESURE DES SOURCES (#1679 L1b) : ce qu'un générateur lit se MESURE, et part dans le
// dérivé local `docs/.sources-lues.json` (#2203).
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
import { fileURLToPath } from 'node:url'
import { ecrireDoc, existeFichier, fusionnerLectures, serialiserSourcesLues } from './ecriture-derives.mjs'
import { ignoresGit } from './chemin-mesure.mjs'
import { GENERATORS, mesurerGenerateur, preparerLectures, refusSourcesInsuffisantes } from '../build-all.mjs'

const ICI = path.dirname(fileURLToPath(import.meta.url))
const RACINE = path.resolve(ICI, '..', '..', '..')
const TSX_ESM = fileURLToPath(import.meta.resolve('tsx/esm'))

/** Les lectures de `script` (un générateur de `GENERATORS`) par LA mesure de `docs:build`
 *  (`mesurerGenerateur`), en mode `rendre` : aucune cible écrite ni comparée. */
function mesurer(script) {
  const g = GENERATORS.find((x) => x.script === script)
  const racineLectures = mkdtempSync(path.join(tmpdir(), 'lectures-'))
  try {
    const ignores = preparerLectures(RACINE, racineLectures)
    const tsxEsm = g.runner === 'tsx' ? TSX_ESM : null
    return mesurerGenerateur(g, { cwd: RACINE, mode: 'rendre', quiet: true, tsxEsm, ignores, lectures: path.join(racineLectures, 'l') }).lues
  } finally {
    rmSync(racineLectures, { recursive: true, force: true })
  }
}

test('témoin : build-index-moteur mesure plus de 100 sources (liaisons ESM synchronisées)', () => {
  const lues = mesurer('scripts/docs/build-index-moteur.mjs')
  assert.ok(lues.fichiers.length > 100, `sources mesurées : ${lues.fichiers.length}`)
  assert.ok(lues.fichiers.includes('src/engine/combat.ts'), 'src/engine/combat.ts absent du set')
  assert.ok(!lues.fichiers.includes('docs/index-moteur.md'), 'le doc CIBLE ne peut pas être sa propre source')
})

test('sous-processus : build-donnees mesure les schémas lus par son dumper tsx (NODE_OPTIONS)', () => {
  const lues = mesurer('scripts/docs/build-donnees.mjs')
  const schemas = lues.fichiers.filter((f) => f.startsWith('src/data/schemas/'))
  assert.ok(schemas.length > 100, `schémas mesurés : ${schemas.length} (le dumper est un sous-processus)`)
  assert.ok(lues.fichiers.includes('tsconfig.json'), 'tsconfig.json absent : le thread des hooks du dumper n\'est pas mesuré')
})

test('runner tsx : build-structures mesure src/data ET src/scenes (entrée tsx/esm)', () => {
  const lues = mesurer('scripts/docs/build-structures.mts')
  assert.ok(lues.fichiers.some((f) => f.startsWith('src/data/')), 'aucune source src/data')
  assert.ok(lues.fichiers.some((f) => f.startsWith('src/scenes/')), 'aucune source src/scenes')
})

// Le chargement du TypeScript par tsx LIT `tsconfig.json` depuis le thread des hooks, sur les deux
// OS. Sans l'enveloppe de `fs` de `enregistreur-hooks.mjs`, ce chemin ne rentre que sous Linux (la
// CI ubuntu 33791873905 le rendait en +1 par générateur tsx) et le dérivé cesse d'être cross-OS.
test('thread des hooks : un générateur chargé par tsx mesure tsconfig.json (dérivé cross-OS)', () => {
  const lues = mesurer('scripts/docs/build-structures.mts')
  assert.ok(
    lues.fichiers.includes('tsconfig.json'),
    `tsconfig.json absent du set (${lues.fichiers.length} sources) : les lectures du thread des hooks ne sont pas enregistrées`,
  )
  // Le hook `load` voit aussi des spécificateurs sans chemin sur le disque : un `node:child_process`
  // pris pour un chemin relatif fait échouer la lecture (ENOENT sur `<racine>/node:…`).
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

test('docs/.sources-lues.json est DÉTERMINISTE : l\'ordre de mesure ne le change pas', () => {
  const entree = (n) => ({ cibles: [`docs/${n}.md`], fichiers: [`src/b/${n}.ts`, `src/a/${n}.ts`], dossiers: ['src/b', 'src/a'] })
  const direct = serialiserSourcesLues({ 'scripts/a.mjs': entree('a'), 'scripts/b.mjs': entree('b') })
  const inverse = serialiserSourcesLues({ 'scripts/b.mjs': entree('b'), 'scripts/a.mjs': entree('a') })
  assert.equal(direct, inverse)
  assert.match(direct, /"src\/a\/a\.ts",\n {6}"src\/b\/a\.ts"/)
})

test('`ecrireDoc` écrit le rendu, et n’écrit RIEN à rendu identique (la mtime ne bouge pas)', () => {
  const racine = mkdtempSync(path.join(tmpdir(), 'ecriture-'))
  try {
    const doc = path.join(racine, 'systemes.md')
    ecrireDoc(doc, '# corps\n')
    assert.equal(readFileSync(doc, 'utf8'), '# corps\n')
    // Les trois rapports d'Atlas réécrivaient leur .md à chaque run, pendant que la suite lit docs/raw/
    // dans une autre lane.
    const avant = statSync(doc).mtimeMs
    ecrireDoc(doc, '# corps\n')
    assert.equal(statSync(doc).mtimeMs, avant, '`ecrireDoc` a réécrit un fichier inchangé')
    ecrireDoc(doc, '# corps RÉGÉNÉRÉ\n')
    assert.equal(readFileSync(doc, 'utf8'), '# corps RÉGÉNÉRÉ\n')
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
// listent. Enregistré, il faisait dépendre la mesure de l'état local du disque.
test('un dossier IGNORÉ par git, posé dans un dossier lu, ne change ni le listing ni les dossiers', () => {
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
      return { rendu }
    }

    const propre = mesurerLib()
    assert.deepEqual(propre.rendu.fichiers, ['lib/geometrie.py', 'lib/suivi.log'], 'le fichier SUIVI sous motif ignoré est sorti de la mesure')
    assert.deepEqual(propre.rendu.dossiers, { lib: ['geometrie.py', 'suivi.log'] })

    mkdirSync(cache)
    writeFileSync(path.join(cache, 'geometrie.pyc'), 'bytecode')
    const salie = mesurerLib()
    assert.deepEqual(salie.rendu.dossiers, propre.rendu.dossiers, 'le dossier ignoré est entré dans les dossiers ou le listing mesurés')
    assert.deepEqual(salie.rendu.fichiers, propre.rendu.fichiers, 'un fichier du dossier ignoré est entré dans la mesure')
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
