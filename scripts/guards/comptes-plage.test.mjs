// PORTE DES COMPTES (#2705, #3021, `jugerLesComptes`, scripts/guards/lib/corpusDesComptes.mts) sur un dépôt jetable :
// chaque borne de la plage mesurée dans SON image, et aucune ligne de message n'admet une hausse ni un plancher qui cède.
//   node --test scripts/guards/comptes-plage.test.mjs   (joué par `npm run test:hooks`, racine scripts/guards)
// La mesure est TypeScript : elle tourne dans un processus enfant `tsx`, sous l'env d'un dépôt forgé (`envDeDepotForge`).
import test from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { envDeDepotForge, forgerDepot } from './lib/depotGabarit.mjs'
import { INDEX, commitDe, depotDe, ecrireBlob, listerImage, poserDansIndex, reussi, shaDe } from './lib/gitPorte.mjs'
import { cleDeSite } from './lib/stock.mjs'
import { gitDe, resultatDeGit } from '../test/gitDeBanc.mjs'
import { diffDuCommit } from '../git-hooks/porte-du-commit.mjs'

const RACINE = fileURLToPath(new URL('../../', import.meta.url))

/** Longueur maximale des chemins d'un `git add` : sous la ligne de commande de win32 (32 767 caractères). */
const LIGNE_MAX = 24_000

/** `chemins` en lots dont la somme des longueurs reste sous `LIGNE_MAX`. */
function enLots(chemins) {
  const lots = [[]]
  let longueur = 0
  for (const c of chemins) {
    if (longueur + c.length + 1 > LIGNE_MAX && lots.at(-1).length) {
      lots.push([])
      longueur = 0
    }
    lots.at(-1).push(c)
    longueur += c.length + 1
  }
  return lots
}

/** Une op du premier tableau d'ops de `donnee` qui satisfait `choisir`, et ce tableau. */
function opDe(donnee, choisir) {
  const pile = [donnee]
  while (pile.length) {
    const v = pile.pop()
    if (!v || typeof v !== 'object') continue
    if (Array.isArray(v)) {
      const op = v.find((x) => x && typeof x === 'object' && typeof x.op === 'string' && choisir(x))
      if (op) return { op, tableau: v }
    }
    pile.push(...Object.values(v))
  }
  throw new Error('aucune op ne répond au choix')
}

/** `texte` de `spells.json` où la première op qui satisfait `choisir` est doublée dans son tableau. */
const ajouterOp = (choisir) => (texte) => {
  const spells = JSON.parse(texte)
  const { op, tableau } = opDe(spells, choisir)
  tableau.push({ ...op })
  return JSON.stringify(spells)
}

/** Les verdicts de `jugerLesComptes` sur chaque `[base, tete]` du dépôt `racine`, dans UN processus `tsx` (la mesure
 *  d'un commit s'y mémoïse), sous l'env d'un dépôt forgé. Les verdicts sont sa sortie ENTIÈRE : la génération et la
 *  mesure d'une image tournent dans des processus enfants à sortie capturée. */
function jugerDansTsx(racine, plages) {
  const module = (rel) => JSON.stringify(pathToFileURL(join(RACINE, rel)).href)
  const code = [
    `import { depotDe } from ${module('scripts/guards/lib/gitPorte.mjs')};`,
    `import { jugerLesComptes } from ${module('scripts/guards/lib/corpusDesComptes.mts')};`,
    'const [racine, plages] = JSON.parse(process.argv[1]);',
    'const depot = depotDe(racine);',
    'const verdicts = plages.map(([base, tete, message]) => jugerLesComptes({ depot, base, tete, message }));',
    'process.stdout.write(JSON.stringify(verdicts));',
  ].join('\n')
  const vu = spawnSync(process.execPath, [join(RACINE, 'node_modules/tsx/dist/cli.mjs'), '--input-type=module', '-e', code, '--', JSON.stringify([racine, plages])], {
    cwd: RACINE, env: envDeDepotForge(), encoding: 'utf8', maxBuffer: 1 << 26,
  })
  assert.equal(vu.status, 0, `mesure tsx en échec (${vu.status ?? vu.signal}) : ${vu.stderr}`)
  return JSON.parse(vu.stdout)
}

/** `texte` où `avant`, présent, devient `apres`. */
const remplacer = (avant, apres) => (texte) => {
  assert.ok(texte.includes(avant), `motif absent : ${avant}`)
  return texte.replace(avant, apres)
}

/** `texte` suivi de `ajout`. */
const ajouter = (ajout) => (texte) => `${texte}${ajout}`

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

test('jugerLesComptes : une op ajoutée à la donnée, typée ou non, passe ; un schéma qui régresse et une op inscrite à `OPS_NON_TYPEES` sont refusés, MÊME sous `CLIQUET:` ; un générateur et le src, ou le détecteur, qui lit sa sortie, changés ensemble, se lient',{ timeout: 600_000 }, () => {
  const dossier = mkdtempSync(join(tmpdir(), 'comptes-plage-'))
  try {
    const reel = depotDe(RACINE, { env: envDeDepotForge() })
    const suivis = listerImage(reel, 'HEAD', 'src', 'Source', 'scripts', 'package.json', 'tsconfig.json')
    for (const rel of suivis) {
      mkdirSync(dirname(join(dossier, rel)), { recursive: true })
      writeFileSync(join(dossier, rel), readFileSync(join(RACINE, rel)))
    }
    const depot = forgerDepot(dossier)
    for (const lot of enLots(suivis)) assert.ok(reussi(commitDe(depot, { message: 'fondation', chemins: lot })), 'commit de fondation')
    const commiter = (muter, message) => {
      for (const [rel, f] of Object.entries(muter)) writeFileSync(join(dossier, rel), f(readFileSync(join(dossier, rel), 'utf8')), 'utf8')
      assert.ok(reussi(commitDe(depot, { message, chemins: Object.keys(muter) })), message)
      return shaDe(depot, 'HEAD')
    }
    const fondation = shaDe(depot, 'HEAD')
    const typee = commiter({ 'src/data/spells.json': (t) => ajouterOp((o) => o.op === 'freeReroll')(ajouterOp((o) => o.op === 'reduceDiseaseDays')(t)) }, 'ops de donnée')
    const lache = commiter({
      'src/data/schemas/defs/creatures.ts': (t) => t.replace('skills: z.array(competenceChiffreeAEmplacementSchema),', 'skills: z.array(z.any()),').replace("spells: refs('spell'),", 'spells: z.array(z.string()),'),
      'src/data/schemas/grammaire/mecanique.ts': remplacer("  'actGate', 'ap',", "  'actGate', 'sondeNonTypee', 'ap',"),
    }, 'schéma et op\n\nCLIQUET: scripts/guards/lib/structuresStock.mjs +1 — op de plus, déclarée au message')
    // Le générateur de la tête importe du src que la base n'a pas, et le src de la tête lit une sortie que le
    // générateur de la base ne produit pas : seule la génération de CHAQUE image par son propre code lie une paire.
    const croisee = commiter({
      'src/data/schemas/grammaire/cle-d-espace.ts': ajouter('\nexport const MARQUE_DE_LA_TETE = 2705;\n'),
      'scripts/gen-espaces.mts': (t) => [
        remplacer("= {};\\n';", "= {};\\nexport const MARQUE_DE_LA_TETE = ' + MARQUE_DE_LA_TETE + ';\\n';"),
        remplacer('= IDS;\\n\\n` +', '= IDS;\\n\\n` +\n    `export const MARQUE_DE_LA_TETE = ${MARQUE_DE_LA_TETE};\\n\\n` +'),
      ].reduce((texte, f) => f(texte), `import { MARQUE_DE_LA_TETE } from '../src/data/schemas/grammaire/cle-d-espace';\n${t}`),
      'src/data/schemas/grammaire/ref.ts': ajouter("\nimport { MARQUE_DE_LA_TETE } from '../_ids.generated';\nexport const MARQUE_LUE = MARQUE_DE_LA_TETE;\n"),
    }, 'générateur et src croisés')
    // Un générateur et le module du DÉTECTEUR qui lit sa sortie, renommés ensemble : le détecteur de la base lit une
    // sortie que le générateur de la tête ne produit plus, et seule la régénération par SES générateurs lie sa paire.
    const lecteur = commiter({
      'scripts/gen-espaces.mts': remplacer('= IDS;\\n\\n` +', '= IDS;\\n\\n` +\n    `export const MARQUE_DU_DETECTEUR = 2705;\\n\\n` +'),
      'scripts/docs/lib/structures-scan.mts': ajouter("\nimport { MARQUE_DU_DETECTEUR } from '../../../src/data/schemas/_ids.generated';\nexport const MARQUE_LUE_PAR_LE_DETECTEUR = MARQUE_DU_DETECTEUR;\n"),
    }, 'générateur et détecteur qui lit sa sortie')
    const renommee = commiter({
      'scripts/gen-espaces.mts': remplacer('MARQUE_DU_DETECTEUR', 'MARQUE_RENOMMEE'),
      'scripts/docs/lib/structures-scan.mts': (t) => remplacer('MARQUE_DU_DETECTEUR', 'MARQUE_RENOMMEE')(t).replaceAll('MARQUE_DU_DETECTEUR', 'MARQUE_RENOMMEE'),
    }, 'générateur et détecteur renommés ensemble')

    const [passe, refus, liee, symetrique] = jugerDansTsx(dossier, [[fondation, typee], [typee, lache], [lache, croisee], [lecteur, renommee]])
    assert.equal(passe.ok, true, passe.texte)
    assert.doesNotMatch(passe.texte, /paire sautée/, passe.texte)
    assert.equal(refus.ok, false, refus.texte)
    const lignes = refus.texte.split('\n').filter((l) => l.startsWith('  ['))
    const site = (volet, champs, suffixes) => [
      { fichier: 'src/data#creatures', ref: '[].' },
      { fichier: 'src/scenes#projet', ref: '.narratif.presetsPnj[].profil.' },
    ].flatMap((s) => champs.flatMap((c) => suffixes.map((x) => `${volet} : ${cleDeSite({ ...s, ref: s.ref + c + x, occurrence: 1 })}`)))
    const feuilles = site('FEUILLES_D_ID', ['skills', 'spells'], ['', '[]'])
    const locales = site('STRUCTURES_LOCALES', ['skills'], ['[]'])
    const attendues = ['DETTE_OPS : sondeNonTypee | non typée', ...feuilles, ...locales]
    const deLaBase = `détecteur de la base (${typee.slice(0, 9)})`
    assert.deepEqual(lignes.map((l) => l.replace(/ — .*/, '')), ['détecteur de la tête', deLaBase].flatMap((d) => attendues.map((a) => `  [${d}] ${a}`)), refus.texte)
    assert.equal(liee.ok, true, liee.texte)
    assert.doesNotMatch(liee.texte, /paire sautée/, liee.texte)
    assert.equal(symetrique.ok, true, symetrique.texte)
    assert.doesNotMatch(symetrique.texte, /paire sautée/, symetrique.texte)
    assert.match(refus.texte, /DETTE_OPS : sondeNonTypee \| non typée — site NEUF : la dette NAÎT\. Typer le payload/)
    for (const l of feuilles) assert.ok(refus.texte.includes(`${l} — feuille \`idDe\` RELÂCHÉE : le chemin n’est plus \`idDe\` à la tête (\`libre\`).`), refus.texte)
    for (const l of locales) assert.ok(refus.texte.includes(`${l} — site NEUF : la dette NAÎT. Typer le nœud`), refus.texte)
    assert.match(refus.texte, /aucun `CLIQUET:` ne les couvre/)
  } finally {
    rmSync(dossier, { recursive: true, force: true })
  }
})
