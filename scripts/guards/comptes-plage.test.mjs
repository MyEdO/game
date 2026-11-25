// PORTE DES COMPTES (#2705, #3021, `jugerLesComptes`, scripts/guards/lib/corpusDesComptes.mts) sur un dépôt jetable :
// chaque borne de la plage mesurée dans SON image, et aucune ligne de message n'admet une hausse ni un plancher qui cède.
//   node --test scripts/guards/comptes-plage.test.mjs   (joué par `npm run test:hooks`, racine scripts/guards)
// La mesure est TypeScript : elle tourne dans un processus enfant `tsx`, sous l'env d'un dépôt forgé (`envDeDepotForge`).
// Sur une copie du dépôt réel : scripts/corpus-isole/guards/comptes-plage-depot-reel.test.mjs.
import test from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { RACINE, lancementDuJugement } from './lib/comptesPlage.testkit.mjs'
import { envDeDepotForge, forgerDepot } from './lib/depotGabarit.mjs'
import { INDEX, commitDe, depotDe, ecrireBlob, poserDansIndex, reussi, shaDe } from './lib/gitPorte.mjs'
import { gitDe, resultatDeGit } from '../test/gitDeBanc.mjs'
import { diffDuCommit } from '../git-hooks/porte-du-commit.mjs'

/** Les verdicts de `jugerLesComptes` sur chaque `[base, tete]` du dépôt `racine`, dans UN processus `tsx`. */
function jugerDansTsx(racine, plages) {
  const { argv, ...options } = lancementDuJugement(racine, plages)
  const vu = spawnSync(process.execPath, argv, { ...options, encoding: 'utf8' })
  assert.equal(vu.status, 0, `mesure tsx en échec (${vu.status ?? vu.signal}) : ${vu.stderr}`)
  return JSON.parse(vu.stdout)
}

test('un détecteur qui reclasse id-nu sans migrer la donnée refuse ; la migration emboîtée passe', { timeout: 240_000 }, () => {
  const dossier = mkdtempSync(join(tmpdir(), 'comptes-reclassement-'))
  const entree = 'scripts/guards/lib/corpusDesComptes.mts'
  const source = (signature) => [
    "import { readFileSync } from 'node:fs';",
    "const objets = JSON.parse(readFileSync('src/data/fixture.json', 'utf8'));",
    "const occurrences = objets.filter((o) => typeof o.shape === 'string').length;",
    "const signature = " + JSON.stringify(signature) + ";",
    "const sites = signature === 'id-nu' && occurrences ? [{ def: 'fixture.ts', champ: 'shape', concept: 'reference', signature, statut: 'historique', commun: '', occurrences }] : [];",
    "process.stdout.write(JSON.stringify([['STRUCTURES_REDECLARATIONS', sites]]));",
  ].join('\n')
  try {
    const fichiers = {
      'package.json': '{"type":"module"}',
      'tsconfig.json': '{}',
      'scripts/docs/build-all.mjs': 'export const genererCode = () => 0;',
      [entree]: source('id-nu'),
      'src/data/fixture.json': '[{"shape":"epee"},{"shape":"hache"}]',
    }
    const depot = forgerDepot(dossier)
    for (const [rel, texte] of Object.entries(fichiers)) {
      mkdirSync(dirname(join(dossier, rel)), { recursive: true })
      writeFileSync(join(dossier, rel), texte)
    }
    assert.ok(reussi(commitDe(depot, { message: 'fondation', chemins: Object.keys(fichiers) })))
    const base = shaDe(depot, 'HEAD')
    const blob = ecrireBlob(depot, source('id-declare'))
    assert.ok(reussi(blob))
    assert.ok(reussi(poserDansIndex(depot, { index: join(dossier, '.git/index'), entrees: [{ chemin: entree, mode: '100644', sha: blob.valeur.stdout.trim() }] })))
    writeFileSync(join(dossier, entree), source('id-nu'))
    const [indexRefuse] = jugerDansTsx(dossier, [[base, INDEX, '']])
    assert.equal(indexRefuse.ok, false, indexRefuse.texte)
    assert.match(indexRefuse.texte, /FAUX-POSITIF/)
    const donnees = ecrireBlob(depot, '[{"shape":{"id":"epee"}},{"shape":{"id":"hache"}}]')
    assert.ok(reussi(donnees))
    assert.ok(reussi(poserDansIndex(depot, { index: join(dossier, '.git/index'), entrees: [{ chemin: 'src/data/fixture.json', mode: '100644', sha: donnees.valeur.stdout.trim() }] })))
    const [indexAdmis] = jugerDansTsx(dossier, [[base, INDEX, '']])
    assert.equal(indexAdmis.ok, true, indexAdmis.texte)
    writeFileSync(join(dossier, entree), source('id-declare'))
    assert.ok(reussi(commitDe(depot, { message: 'reclasse sans migration', chemins: [entree] })))
    const reclasse = shaDe(depot, 'HEAD')
    const fauxPositif = (n) => 'FAUX-POSITIF: ' + JSON.stringify(['STRUCTURES_REDECLARATIONS', 'fixture.ts | shape | reference | id-nu | historique | ', n]) + ' — le schéma classe cette occurrence comme une valeur sans référence'
    const [exact, manque, trop] = jugerDansTsx(dossier, [
      [base, reclasse, fauxPositif(1) + '\n' + fauxPositif(2)],
      [base, reclasse, fauxPositif(1)],
      [base, reclasse, fauxPositif(1) + '\n' + fauxPositif(2) + '\n' + fauxPositif(3)],
    ])
    assert.equal(exact.ok, true, exact.texte)
    assert.equal(manque.ok, false, manque.texte)
    assert.equal(trop.ok, false, trop.texte)
    writeFileSync(join(dossier, entree), source('id-nu'))
    writeFileSync(join(dossier, 'src/data/fixture.json'), '[{"shape":{"id":"epee"}},{"shape":{"id":"hache"}}]')
    assert.ok(reussi(commitDe(depot, { message: 'migre les valeurs', chemins: [entree, 'src/data/fixture.json'] })))
    const migre = shaDe(depot, 'HEAD')
    const [refus, admis] = jugerDansTsx(dossier, [[base, reclasse], [base, migre]])
    assert.equal(refus.ok, false, refus.texte)
    assert.match(refus.texte, /FAUX-POSITIF/)
    assert.match(refus.texte, /fixture\.ts.*shape.*id-nu/)
    assert.equal(admis.ok, true, admis.texte)
    writeFileSync(join(dossier, 'src/data/fixture.json'), '[]')
    assert.ok(reussi(commitDe(depot, { message: 'retire les valeurs', chemins: ['src/data/fixture.json'] })))
    const [retrait] = jugerDansTsx(dossier, [[base, shaDe(depot, 'HEAD')]])
    assert.equal(retrait.ok, true, retrait.texte)
  } finally {
    rmSync(dossier, { recursive: true, force: true })
  }
})

test('#3884 la liste de découpe est une DÉCLARATION de l’image : le chapitre sans folio et la liste qui le déclare, ajoutés ensemble, passent sous le détecteur de la base ; le chapitre seul refuse', { timeout: 240_000 }, () => {
  const dossier = mkdtempSync(join(tmpdir(), 'comptes-declaration-'))
  const entree = 'scripts/guards/lib/corpusDesComptes.mts'
  const liste = 'scripts/raw/decoupes/livre.json'
  const chapitre = 'Source/Livre/01 - X.md'
  const source = [
    "import { existsSync, readFileSync } from 'node:fs';",
    `const sansFolio = existsSync(${JSON.stringify(liste)}) && JSON.parse(readFileSync(${JSON.stringify(liste)}, 'utf8')).sansFolio === true;`,
    `const occurrences = existsSync(${JSON.stringify(chapitre)}) && !sansFolio ? 1 : 0;`,
    "const sites = occurrences ? [{ def: 'livre', champ: 'folio', concept: 'reference', signature: 'id-nu', statut: 'historique', commun: '', occurrences }] : [];",
    "process.stdout.write(JSON.stringify([['STRUCTURES_REDECLARATIONS', sites]]));",
  ].join('\n')
  try {
    const fichiers = {
      'package.json': '{"type":"module"}',
      'tsconfig.json': '{}',
      'scripts/docs/build-all.mjs': 'export const genererCode = () => 0;',
      [entree]: source,
      'src/data/fixture.json': '[]',
    }
    const depot = forgerDepot(dossier)
    const poser = (rel, texte) => {
      mkdirSync(dirname(join(dossier, rel)), { recursive: true })
      writeFileSync(join(dossier, rel), texte)
    }
    for (const [rel, texte] of Object.entries(fichiers)) poser(rel, texte)
    assert.ok(reussi(commitDe(depot, { message: 'fondation', chemins: Object.keys(fichiers) })))
    const base = shaDe(depot, 'HEAD')
    poser(chapitre, '# X\n')
    assert.ok(reussi(commitDe(depot, { message: 'chapitre seul', chemins: [chapitre] })))
    const seul = shaDe(depot, 'HEAD')
    poser(liste, '{"sansFolio":true,"entrees":[]}')
    assert.ok(reussi(commitDe(depot, { message: 'sa liste', chemins: [liste] })))
    const declare = shaDe(depot, 'HEAD')
    const [refus, admis] = jugerDansTsx(dossier, [[base, seul], [base, declare]])
    assert.equal(refus.ok, false, refus.texte)
    assert.match(refus.texte, /détecteur de la base/)
    assert.equal(admis.ok, true, admis.texte)
  } finally {
    rmSync(dossier, { recursive: true, force: true })
  }
})

test('#1463 une fusion EN COURS se mesure sur l’arbre réel de sa base, jamais sur sa fusion automatique à marqueurs : refusé ce qui monte contre elle', { timeout: 240_000 }, () => {
  const dossier = mkdtempSync(join(tmpdir(), 'comptes-fusion-'))
  const entree = 'scripts/guards/lib/corpusDesComptes.mts'
  const detecteur = [
    "import { readFileSync } from 'node:fs';",
    "const occurrences = JSON.parse(readFileSync('src/data/fixture.json', 'utf8')).length;",
    "const sites = occurrences ? [{ def: 'fixture.ts', champ: 'shape', concept: 'reference', signature: 'id-nu', statut: 'historique', commun: '', occurrences }] : [];",
    "process.stdout.write(JSON.stringify([['STRUCTURES_REDECLARATIONS', sites]]));",
  ].join('\n')
  const git = gitDe(dossier)
  const ecrire = (rel, texte) => {
    mkdirSync(dirname(join(dossier, rel)), { recursive: true })
    writeFileSync(join(dossier, rel), texte)
  }
  try {
    const fichiers = {
      'package.json': '{"type":"module"}',
      'tsconfig.json': '{}',
      'scripts/docs/build-all.mjs': 'export const genererCode = () => 0;',
      [entree]: detecteur,
      'src/data/fixture.json': '["epee","hache"]\n',
    }
    const depot = forgerDepot(dossier)
    for (const [rel, texte] of Object.entries(fichiers)) ecrire(rel, texte)
    assert.ok(reussi(commitDe(depot, { message: 'fondation', chemins: Object.keys(fichiers) })))
    git('branch', 'amont')
    ecrire('src/data/fixture.json', '["epee"]\n')
    assert.ok(reussi(commitDe(depot, { message: 'chantier', chemins: ['src/data/fixture.json'] })))
    git('checkout', '-q', 'amont')
    ecrire('src/data/fixture.json', '["hache"]\n')
    assert.ok(reussi(commitDe(depot, { message: 'amont', chemins: ['src/data/fixture.json'] })))
    git('checkout', '-q', 'main')
    assert.notEqual(resultatDeGit(['merge', '--no-commit', '--no-ff', 'amont'], { cwd: dossier }).status, 0, 'témoin : la fusion s’arrête sur un conflit')
    assert.match(readFileSync(join(dossier, 'src/data/fixture.json'), 'utf8'), /^<<<<<<< /m, 'témoin : marqueurs dans la donnée mesurée')
    const commune = git('merge-base', 'HEAD', 'MERGE_HEAD').trim()
    const juger = (resolution) => {
      ecrire('src/data/fixture.json', resolution)
      git('add', 'src/data/fixture.json')
      return jugerDansTsx(dossier, [[commune, INDEX, '']])[0]
    }
    const garde = juger('["epee"]\n')
    assert.equal(garde.ok, true, garde.texte)
    assert.match(garde.texte, new RegExp(`\\(base ${commune.slice(0, 9)}\\)`))
    const vide = juger('[]\n')
    assert.equal(vide.ok, true, vide.texte)
    const accrue = juger('["epee","hache","lance"]\n')
    assert.equal(accrue.ok, false, accrue.texte)
    assert.match(accrue.texte, /HAUSSE 3 > 2/)
    assert.doesNotMatch(accrue.texte, /paire sautée/)
  } finally {
    rmSync(dossier, { recursive: true, force: true })
  }
})

for (const sens of ['le chantier reçoit le tronc', 'le tronc reçoit le chantier', 'sans tronc']) test(`#1463 fusion EN COURS, ${sens} : la porte lit, comme la CI après la fusion, les FAUX-POSITIF que le chantier a déclarés`, { timeout: 240_000 }, () => {
  const dossier = mkdtempSync(join(tmpdir(), 'comptes-faux-positif-'))
  const entree = 'scripts/guards/lib/corpusDesComptes.mts'
  const source = (signature, note) => [
    "import { readFileSync } from 'node:fs';",
    "const objets = JSON.parse(readFileSync('src/data/fixture.json', 'utf8'));",
    "const occurrences = objets.filter((o) => typeof o.shape === 'string').length;",
    "const signature = " + JSON.stringify(signature) + ";",
    `// ${note}`,
    "const sites = signature === 'id-nu' && occurrences ? [{ def: 'fixture.ts', champ: 'shape', concept: 'reference', signature, statut: 'historique', commun: '', occurrences }] : [];",
    "process.stdout.write(JSON.stringify([['STRUCTURES_REDECLARATIONS', sites]]));",
  ].join('\n')
  const fauxPositif = (n) => 'FAUX-POSITIF: ' + JSON.stringify(['STRUCTURES_REDECLARATIONS', 'fixture.ts | shape | reference | id-nu | historique | ', n]) + ' — le schéma classe cette occurrence comme une valeur sans référence'
  const git = gitDe(dossier)
  const ecrire = (rel, texte) => {
    mkdirSync(dirname(join(dossier, rel)), { recursive: true })
    writeFileSync(join(dossier, rel), texte)
  }
  try {
    const fichiers = {
      'package.json': '{"type":"module"}',
      'tsconfig.json': '{}',
      'scripts/docs/build-all.mjs': 'export const genererCode = () => 0;',
      [entree]: source('id-nu', 'socle'),
      'src/data/fixture.json': '[{"shape":"epee"},{"shape":"hache"}]',
    }
    const depot = forgerDepot(dossier)
    for (const [rel, texte] of Object.entries(fichiers)) ecrire(rel, texte)
    assert.ok(reussi(commitDe(depot, { message: 'fondation', chemins: Object.keys(fichiers) })))
    git('branch', 'amont')
    ecrire(entree, source('id-declare', 'chantier'))
    assert.ok(reussi(commitDe(depot, { message: `reclasse\n\n${fauxPositif(1)}\n${fauxPositif(2)}`, chemins: [entree] })))
    git('checkout', '-q', 'amont')
    ecrire(entree, source('id-nu', 'tronc'))
    assert.ok(reussi(commitDe(depot, { message: 'le tronc retouche le détecteur', chemins: [entree] })))
    const tronc = shaDe(depot, 'HEAD')
    git('update-ref', 'refs/remotes/origin/main', sens === 'sans tronc' ? 'amont~1' : tronc)
    if (sens === 'le tronc reçoit le chantier') assert.notEqual(resultatDeGit(['merge', '--no-commit', '--no-ff', 'main'], { cwd: dossier }).status, 0, 'témoin : le détecteur est en conflit')
    else {
      git('checkout', '-q', 'main')
      assert.notEqual(resultatDeGit(['merge', '--no-commit', '--no-ff', 'amont'], { cwd: dossier }).status, 0, 'témoin : le détecteur est en conflit')
    }
    ecrire(entree, source('id-declare', 'résolu'))
    git('add', entree)
    const [porte] = jugerDansTsx(dossier, [[git('merge-base', 'origin/main', 'HEAD', 'MERGE_HEAD').trim(), INDEX, 'fusion']])
    git('commit', '-q', '--no-verify', '-m', 'fusion du tronc')
    const [ci] = jugerDansTsx(dossier, [['origin/main', 'HEAD']])
    assert.equal(porte.ok, true, porte.texte)
    assert.equal(ci.ok, true, ci.texte)
  } finally {
    rmSync(dossier, { recursive: true, force: true })
  }
})

for (const declaree of [true, false]) for (const tronc of [true, false]) test(`#1463 fusion EN COURS sans parent tronc, ${tronc ? 'contre la base de la CI' : 'en repli sans `origin/main`'}, une baisse de détecteur portée par un seul parent ${declaree ? 'déclarée' : 'NON déclarée'} au journal : la porte rend le verdict de la CI`, { timeout: 240_000 }, () => {
  const dossier = mkdtempSync(join(tmpdir(), 'comptes-base-ci-'))
  const entree = 'scripts/guards/lib/corpusDesComptes.mts'
  const source = (signature, note) => [
    "import { readFileSync } from 'node:fs';",
    "const objets = JSON.parse(readFileSync('src/data/fixture.json', 'utf8'));",
    "const occurrences = objets.filter((o) => typeof o.shape === 'string').length;",
    "const signature = " + JSON.stringify(signature) + ";",
    `// ${note}`,
    "const sites = signature === 'id-nu' && occurrences ? [{ def: 'fixture.ts', champ: 'shape', concept: 'reference', signature, statut: 'historique', commun: '', occurrences }] : [];",
    "process.stdout.write(JSON.stringify([['STRUCTURES_REDECLARATIONS', sites]]));",
  ].join('\n')
  const fauxPositif = (n) => 'FAUX-POSITIF: ' + JSON.stringify(['STRUCTURES_REDECLARATIONS', 'fixture.ts | shape | reference | id-nu | historique | ', n]) + ' — le schéma classe cette occurrence comme une valeur sans référence'
  const git = gitDe(dossier)
  const ecrire = (rel, texte) => {
    mkdirSync(dirname(join(dossier, rel)), { recursive: true })
    writeFileSync(join(dossier, rel), texte)
  }
  try {
    const fichiers = {
      'package.json': '{"type":"module"}',
      'tsconfig.json': '{}',
      'scripts/docs/build-all.mjs': 'export const genererCode = () => 0;',
      [entree]: source('id-nu', 'socle'),
      'src/data/fixture.json': '[{"shape":"epee"},{"shape":"hache"}]',
      'autre.txt': 'o',
    }
    const depot = forgerDepot(dossier)
    for (const [rel, texte] of Object.entries(fichiers)) ecrire(rel, texte)
    assert.ok(reussi(commitDe(depot, { message: 'fondation', chemins: Object.keys(fichiers) })))
    const socle = shaDe(depot, 'HEAD')
    git('update-ref', 'refs/remotes/origin/main', socle)
    git('branch', 'amont')
    ecrire('autre.txt', 'p')
    assert.ok(reussi(commitDe(depot, { message: 'le chantier travaille', chemins: ['autre.txt'] })))
    git('checkout', '-q', 'amont')
    ecrire(entree, source('id-declare', 'amont relâche'))
    assert.ok(reussi(commitDe(depot, { message: declaree ? `relâche\n\n${fauxPositif(1)}\n${fauxPositif(2)}` : 'relâche sans déclarer', chemins: [entree] })))
    git('checkout', '-q', 'main')
    resultatDeGit(['merge', '--no-commit', '--no-ff', 'amont'], { cwd: dossier })
    assert.equal(git('merge-base', 'origin/main', 'HEAD', 'MERGE_HEAD').trim(), socle, 'témoin : aucun parent n’est le tronc')
    if (!tronc) git('update-ref', '-d', 'refs/remotes/origin/main')
    const { base, repli } = diffDuCommit(dossier, { depot: depotDe(dossier, { env: envDeDepotForge() }) }).baseDesComptes()
    assert.equal(base, socle, 'la base de la CI, ou en repli la base commune des parents')
    assert.equal(repli !== null, !tronc, repli ?? 'aucun repli')
    const [porte] = jugerDansTsx(dossier, [[base, INDEX, 'fusion']])
    git('commit', '-q', '--no-verify', '-m', 'fusion')
    git('update-ref', 'refs/remotes/origin/main', socle)
    const [ci] = jugerDansTsx(dossier, [['origin/main', 'HEAD']])
    assert.equal(porte.ok, declaree, porte.texte)
    assert.equal(ci.ok, declaree, ci.texte)
  } finally {
    rmSync(dossier, { recursive: true, force: true })
  }
})

test('#1463 `--base` sans ref, ou suivi d’un drapeau, est une erreur nommée', { timeout: 120_000 }, () => {
  for (const argv of [['--base', '--index'], ['--base']]) {
    const vu = spawnSync(process.execPath, [join(RACINE, 'node_modules/tsx/dist/cli.mjs'), join(RACINE, 'scripts/guards/comptes-plage.mts'), ...argv], { cwd: RACINE, encoding: 'utf8', input: '' })
    assert.notEqual(vu.status, 0, argv.join(' '))
    assert.match(vu.stderr, /`--base` attend une ref, reçu (`--index`|rien)/, vu.stderr)
  }
})
