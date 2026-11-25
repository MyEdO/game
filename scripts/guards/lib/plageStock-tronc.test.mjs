// Tests de la porte de PLAGE (`plageStock.mjs`) : le TRONC fusionné, le cumul en bilan d'ÉTATS, le `debut`
// NUL et l'ascendance SANS BORNE. Lancé par `npm run test:hooks`.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { lectureDeLaPlage, refusDeLaPlage, croissancesDeLaPlage, SHA_NUL } from './plageStock.mjs'
import { TRONC } from './gitPorte.mjs'
import { gitDe, lancerGit } from '../../test/gitDeBanc.mjs'
import { PORTEUR, depotForge, A, B, C, D, sourceStock, lireEtJugerLaPlage, depotAFusion, CHANTIER, refusDe, depotDeChantier } from './plageStock.testkit.mjs'

// ── La plage d'un PUSH ne rejuge pas le TRONC (#1806, stocks-nominatifs.test.mjs:33-36) ────────────

const A_BIS = "  'src/a.ts', // bis"

/** Dépôt jetable : `chantier` (déjà poussée à `debut`) fusionne un `main` qui a bougé, puis porte un
 *  commit propre. `surMain` = le porteur posé par le commit du tronc ; `dansLaFusion` = le porteur
 *  posé en RÉSOLVANT (`null` : fusion propre) ; `avant` et `apres` = le porteur des commits de la
 *  branche avant et après la fusion. `refs/remotes/origin/main` = la tête du tronc. */
function depotATronc({ surMain, dansLaFusion = null, avant = null, apres = null }) {
  const { racine: repo, sha: debut } = depotForge({ fichiers: { [PORTEUR]: sourceStock([A, B, C, D]) }, message: 'socle' })
  const git = gitDe(repo)
  const commettre = (contenu, message) => {
    writeFileSync(join(repo, PORTEUR), contenu, 'utf8')
    git('commit', '-q', '--no-verify', '-am', message)
    return git('rev-parse', 'HEAD').trim()
  }
  git('checkout', '-q', '-b', 'chantier')
  git('checkout', '-q', 'main')
  const duTronc = commettre(surMain, 'tronc, sans cliquet')
  git('update-ref', 'refs/remotes/origin/main', duTronc)
  git('checkout', '-q', 'chantier')
  const avantFusion = avant === null ? null : commettre(avant, 'chantier avant fusion, sans cliquet')
  git('merge', '-q', '--no-ff', '--no-commit', 'main')
  if (dansLaFusion !== null) {
    writeFileSync(join(repo, PORTEUR), dansLaFusion, 'utf8')
    git('add', PORTEUR)
  }
  git('commit', '-q', '--no-verify', '-m', 'fusion du tronc')
  const fusion = git('rev-parse', 'HEAD').trim()
  if (apres !== null) commettre(apres, 'chantier après fusion, sans cliquet')
  return { repo, debut, duTronc, avantFusion, fusion, fin: git('rev-parse', 'HEAD').trim() }
}

const juge = (d) => croissancesDeLaPlage({ cwd: d.repo, debut: d.debut, fin: d.fin, vers: CHANTIER })

test('TRONC : le commit du tronc fusionné n’est pas rejugé ; le commit propre à la branche est refusé', async () => {
  const d = depotATronc({ surMain: sourceStock([A, B, C, D, "  'src/e.ts',"]), apres: sourceStock([A, B, C, D, "  'src/e.ts',", "  'src/f.ts',"]) })
  try {
    const vu = await juge(d)
    assert.equal(vu.commits, 2, 'la fusion et le commit de branche : rien du tronc')
    assert.deepEqual(refusDe(vu), [[d.fin, PORTEUR, 1]])
  } finally {
    rmSync(d.repo, { recursive: true, force: true })
  }
})

test('TRONC : une fusion dont la RÉSOLUTION ajoute au stock sans sa ligne est refusée', async () => {
  const d = depotATronc({ surMain: sourceStock([A, B, C, D, "  'src/e.ts',"]), dansLaFusion: sourceStock([A, B, C, D, "  'src/e.ts',", "  'src/f.ts',"]) })
  try {
    assert.deepEqual(refusDe(await juge(d)), [[d.fusion, PORTEUR, 1]])
  } finally {
    rmSync(d.repo, { recursive: true, force: true })
  }
})

// Le tronc RETIRE une entrée, la branche en ajoute une sous la MÊME clé sans cliquet : le cumul
// retranche ce que le tronc a changé, la clé reste à +1 et le commit de branche est refusé.
test('TRONC : une baisse faite par le tronc ne paie pas la croissance non déclarée de la branche', async () => {
  const d = depotATronc({ surMain: sourceStock([B, C, D]), avant: sourceStock([A, B, C, D, A_BIS]) })
  try {
    assert.deepEqual(refusDe(await juge(d)), [[d.avantFusion, PORTEUR, 1]])
  } finally {
    rmSync(d.repo, { recursive: true, force: true })
  }
})

test('TRONC : un push VERS le tronc juge ses commits, et le dit', async () => {
  const { racine: repo, sha: debut } = depotForge({ fichiers: { [PORTEUR]: sourceStock([A]) }, message: 'socle' })
  const git = gitDe(repo)
  try {
    writeFileSync(join(repo, PORTEUR), sourceStock([A, B]), 'utf8')
    git('commit', '-q', '--no-verify', '-am', 'tronc, sans cliquet')
    const fin = git('rev-parse', 'HEAD').trim()
    git('update-ref', 'refs/remotes/origin/main', fin)
    const vu = await croissancesDeLaPlage({ cwd: repo, debut, fin, vers: TRONC.branche })
    assert.deepEqual([vu.commits, refusDe(vu)], [1, [[fin, PORTEUR, 1]]], '`origin/main` = `fin` (la CI après fetch) n’efface rien')
    assert.deepEqual(vu.notes, ["push vers le tronc (`refs/heads/main`) : `debut` est le tronc d'avant, rien d'autre n'est exclu"])
  } finally {
    rmSync(repo, { recursive: true, force: true })
  }
})

test('TRONC : un tronc ILLISIBLE est nommé, et n’exclut rien', async () => {
  const d = depotATronc({ surMain: sourceStock([A, B, C, D, "  'src/e.ts',"]), apres: sourceStock([A, B, C, D, "  'src/e.ts',", "  'src/f.ts',"]) })
  try {
    lancerGit(['update-ref', '-d', 'refs/remotes/origin/main'], { cwd: d.repo })
    const vu = await juge(d)
    assert.deepEqual(vu.notes, [
      `tronc \`origin/main\` illisible depuis ${d.fin.slice(0, 9)} : ses commits ne sont PAS exclus de la plage`,
      `${[d.duTronc, d.fusion, d.fin].map((s) => s.slice(0, 9)).join(', ')} sans ère (tronc \`origin/main\` illisible) : jugé(s) par la porte actuelle`,
    ])
    assert.equal(vu.commits, 3, 'le commit du tronc est jugé, et la note le dit')
  } finally {
    rmSync(d.repo, { recursive: true, force: true })
  }
})

// ── Le cumul est un bilan d'ÉTATS : un changement porté par deux parents compte une fois ─────────

/** Branche latérale `x` partie de `debut` qui commet `aPoser`, fusionnée proprement dans `chantier`. */
function fusionLaterale(d, aPoser) {
  d.git('checkout', '-q', '-b', 'x', d.debut)
  d.poser(aPoser, 'latérale (même changement)')
  d.git('checkout', '-q', 'chantier')
  d.git('merge', '-q', '--no-ff', '--no-verify', '-m', 'fusion latérale', 'x')
}

const verifierCumulAvecOrigine = (options, historique, publie) => {
  assert.ok(historique.commits.some(({ sha }) => sha === publie), 'la lecture sans exclusion garde le commit publié')
  const lu = lectureDeLaPlage({ ...options, origineConfirmee: [publie] })
  assert.deepEqual(lu.cumul, historique.cumul)
  assert.deepEqual(lu.commits.map((c) => c.sha), historique.commits.filter((c) => c.sha !== publie).map((c) => c.sha))
  assert.deepEqual(refusDeLaPlage(lu), refusDeLaPlage(historique).filter((r) => r.sha !== publie))
}

test('CUMUL (E) : un retrait porté par les DEUX parents d’une fusion ne paie pas deux ajouts non déclarés', async () => {
  const d = depotDeChantier({ [PORTEUR]: sourceStock([A, B]) })
  try {
    const publie = d.poser({ [PORTEUR]: sourceStock([B]) }, 'retire A')
    fusionLaterale(d, { [PORTEUR]: sourceStock([B]) })
    const fin = d.poser({ [PORTEUR]: sourceStock([B, A_BIS, "  'src/a.ts', // ter"]) }, 'deux sous a, sans cliquet')
    const options = d.optionsDePlage(fin)
    const { lue, verdict } = await lireEtJugerLaPlage(options)
    assert.deepEqual(refusDe(verdict), [[fin, PORTEUR, 2]])
    verifierCumulAvecOrigine(options, lue, publie)
  } finally {
    rmSync(d.repo, { recursive: true, force: true })
  }
})

test('CUMUL (E2) : un ajout porté par les DEUX parents puis retiré une fois ne refuse rien', async () => {
  const d = depotDeChantier({ [PORTEUR]: sourceStock([B]) })
  try {
    const publie = d.poser({ [PORTEUR]: sourceStock([A, B]) }, 'ajoute A')
    fusionLaterale(d, { [PORTEUR]: sourceStock([A, B]) })
    const fin = d.poser({ [PORTEUR]: sourceStock([B]) }, 'retire A')
    const options = { ...d.optionsDePlage(fin), origineConfirmee: [] }
    const { lue, verdict } = await lireEtJugerLaPlage(options)
    assert.deepEqual(verdict.refus, [])
    verifierCumulAvecOrigine(options, lue, publie)
  } finally {
    rmSync(d.repo, { recursive: true, force: true })
  }
})

test('CUMUL (B) : une clé renommée sur deux commits (`git mv`, puis le stock suit) ne grandit rien', async () => {
  const d = depotDeChantier({ [PORTEUR]: sourceStock([A]), 'src/a.ts': 'export const a = 1\n' })
  try {
    d.git('mv', 'src/a.ts', 'src/z.ts')
    const publie = d.poser({}, 'git mv a -> z')
    const fin = d.poser({ [PORTEUR]: sourceStock(["  'src/z.ts',"]) }, 'le stock suit')
    const options = d.optionsDePlage(fin)
    const { lue, verdict } = await lireEtJugerLaPlage(options)
    assert.deepEqual(verdict.refus, [])
    verifierCumulAvecOrigine(options, lue, publie)
  } finally {
    rmSync(d.repo, { recursive: true, force: true })
  }
})

test('CUMUL (C) : un stock DÉPLACÉ d’un porteur à un autre sur deux commits ne grandit rien', async () => {
  const P2 = 'scripts/y.test.mjs'
  const d = depotDeChantier({ [PORTEUR]: sourceStock([A, B]) })
  try {
    const publie = d.poser({ [PORTEUR]: null }, 'supprime le porteur')
    const fin = d.poser({ [P2]: sourceStock([A, B]) }, 'recrée le porteur ailleurs')
    const options = d.optionsDePlage(fin)
    const { lue, verdict } = await lireEtJugerLaPlage(options)
    assert.deepEqual(verdict.refus, [])
    verifierCumulAvecOrigine(options, lue, publie)
  } finally {
    rmSync(d.repo, { recursive: true, force: true })
  }
})

test('#2626 CUMUL : une migration prouvée conserve son bilan avec exclusions', async () => {
  const ancien = 'src/ancien.test.ts'
  const nouveau = 'src/nouveau.test.ts'
  const titre = "it('titre conservé', () => {});\n"
  const stock = (fichier, neuf = false) => `const PREUVES = [
    { fichier: '${fichier}', it: 'titre conservé' },
    ${neuf ? "{ fichier: 'src/neuf.test.ts', it: 'dette neuve' }," : ''}
  ];\n`
  for (const neuf of [false, true]) {
    const d = depotDeChantier({ [PORTEUR]: stock(ancien), [ancien]: titre })
    try {
      const publie = d.poser({ 'anodin.txt': 'publié\n' }, 'publié anodin')
      const fin = d.poser({ [PORTEUR]: stock(nouveau, neuf), [ancien]: null, [nouveau]: titre }, 'migration prouvée')
      const options = d.optionsDePlage(fin)
      const { lue, verdict } = await lireEtJugerLaPlage(options)
      assert.deepEqual(refusDe(verdict), neuf ? [[fin, PORTEUR, 1]] : [])
      const bilan = lue.cumul.find(({ fichier }) => fichier === PORTEUR)
      assert.deepEqual([...bilan.parCle.values()].filter((n) => n !== 0), neuf ? [1] : [])
      verifierCumulAvecOrigine(options, lue, publie)
    } finally { rmSync(d.repo, { recursive: true, force: true }) }
  }
})

for (const tronc of ['absent', 'disjoint']) test(`#2626 sans borne : retrait commun aux parents puis ajout, tronc ${tronc}`, () => {
  const d = depotDeChantier({ [PORTEUR]: sourceStock([A]) })
  try {
    d.poser({ [PORTEUR]: sourceStock([]) }, 'retire A')
    fusionLaterale(d, { [PORTEUR]: sourceStock([]) })
    const fin = d.poser({ [PORTEUR]: sourceStock([A_BIS]) }, 'ajoute A sans cliquet')
    if (tronc === 'absent') d.git('update-ref', '-d', 'refs/remotes/origin/main')
    else {
      const arbre = d.git('rev-parse', `${d.debut}^{tree}`).trim()
      const autre = d.git('commit-tree', arbre, '-m', 'tronc disjoint').trim()
      d.git('update-ref', 'refs/remotes/origin/main', autre)
    }
    const options = { cwd: d.repo, debut: SHA_NUL, fin, vers: CHANTIER }
    const historique = lectureDeLaPlage(options)
    const bilan = historique.cumul.find(({ fichier }) => fichier === PORTEUR)
    assert.equal([...bilan.parCle.values()].reduce((a, b) => a + b, 0), 1)
    assert.deepEqual(refusDeLaPlage(historique).filter((r) => r.fichier === PORTEUR).map((r) => [r.sha, r.net]), [[d.debut, 1], [fin, 1]])
    const lu = lectureDeLaPlage({ ...options, origineConfirmee: [d.debut] })
    assert.deepEqual(lu.cumul, historique.cumul)
    assert.deepEqual(refusDeLaPlage(lu).filter((r) => r.fichier === PORTEUR).map((r) => [r.sha, r.net]), [[fin, 1]])
  } finally { rmSync(d.repo, { recursive: true, force: true }) }
})

// ── `debut` NUL : ce que la tête apporte au tronc, quelle que soit la ref poussée ────────────────

/** Tronc local `main` en avance de deux commits sur `origin/main`, le second sans cliquet. */
function depotEnAvance() {
  const { racine: repo, sha: socle } = depotForge({ fichiers: { [PORTEUR]: sourceStock([A]) }, message: 'socle' })
  const git = gitDe(repo)
  git('update-ref', 'refs/remotes/origin/main', socle)
  writeFileSync(join(repo, PORTEUR), sourceStock([A, B]), 'utf8')
  git('commit', '-q', '--no-verify', '-am', 'non poussé, sans cliquet')
  const milieu = git('rev-parse', 'HEAD').trim()
  writeFileSync(join(repo, PORTEUR), `${sourceStock([A, B])}// tête anodine\n`, 'utf8')
  git('commit', '-q', '--no-verify', '-am', 'tête')
  return { repo, git, milieu, fin: git('rev-parse', 'HEAD').trim() }
}

test('DEBUT NUL : vers le tronc (HEAD sur `main` hors CI, canari) comme en tête détachée, la plage est `fin ^origin/main`', async () => {
  const d = depotEnAvance()
  try {
    for (const vers of [TRONC.branche, null]) {
      const vu = await croissancesDeLaPlage({ cwd: d.repo, debut: SHA_NUL, fin: d.fin, vers })
      assert.deepEqual([vu.commits, vu.notes, refusDe(vu)], [2, [], [[d.milieu, PORTEUR, 1]]], String(vers))
    }
  } finally {
    rmSync(d.repo, { recursive: true, force: true })
  }
})

test('DEBUT NUL : une branche NEUVE juge son apport au tronc, et le cumul le compte', async () => {
  const d = depotATronc({ surMain: sourceStock([A, B, C, D, "  'src/e.ts',"]), apres: sourceStock([A, B, C, D, "  'src/e.ts',", "  'src/f.ts',"]) })
  try {
    const vu = await croissancesDeLaPlage({ cwd: d.repo, debut: SHA_NUL, fin: d.fin, vers: CHANTIER })
    assert.deepEqual([vu.commits, vu.notes, refusDe(vu)], [2, [], [[d.fin, PORTEUR, 1]]])
  } finally {
    rmSync(d.repo, { recursive: true, force: true })
  }
})

test('SANS BORNE : l’ascendance d’une fusion est jugée, chaque commit garde son apport propre', async () => {
  const { repo, socle, fusion } = depotAFusion(sourceStock([A, B, C]))
  try {
    const vu = await croissancesDeLaPlage({ cwd: repo, debut: SHA_NUL, fin: fusion })
    assert.equal(vu.commits, 4)
    assert.deepEqual(refusDe(vu).filter(([, fichier]) => fichier === PORTEUR), [[socle, PORTEUR, 1], [fusion, PORTEUR, 1]])
    assert.ok(vu.refus.filter((r) => r.fichier !== PORTEUR).every((r) => r.sha === socle))
  } finally {
    rmSync(repo, { recursive: true, force: true })
  }
})

test('CUMUL : un `debut` sans ancêtre commun avec le tronc est NOMMÉ, et rien n’est retranché', async () => {
  const { racine: repo, sha: socle } = depotForge({ fichiers: { [PORTEUR]: sourceStock([A]) }, message: 'socle' })
  const git = gitDe(repo)
  try {
    git('update-ref', 'refs/remotes/origin/main', socle)
    git('checkout', '-q', '--orphan', 'orpheline')
    git('rm', '-q', '-f', PORTEUR)
    writeFileSync(join(repo, 'autre.txt'), 'o\n', 'utf8')
    git('add', 'autre.txt')
    git('commit', '-q', '--no-verify', '-m', 'racine orpheline')
    const debut = git('rev-parse', 'HEAD').trim()
    git('merge', '-q', '--no-verify', '--allow-unrelated-histories', '-m', 'rejoint le tronc', 'main')
    writeFileSync(join(repo, PORTEUR), sourceStock([A, B]), 'utf8')
    git('commit', '-q', '--no-verify', '-am', 'sans cliquet')
    const fin = git('rev-parse', 'HEAD').trim()
    const vu = await croissancesDeLaPlage({ cwd: repo, debut, fin, vers: CHANTIER })
    assert.deepEqual(vu.notes, [`\`${debut.slice(0, 9)}\` sans ancêtre commun avec \`origin/main\` : le cumul ne retranche rien du tronc`])
    assert.deepEqual(refusDe(vu), [[fin, PORTEUR, 1]])
  } finally {
    rmSync(repo, { recursive: true, force: true })
  }
})

test('SANS BORNE : la fusion qui rétablit une entrée garde son apport propre dans le cumul de l’ascendance', async () => {
  const { racine: repo, sha: socle } = depotForge({ fichiers: { [PORTEUR]: sourceStock([A, B]), 'autre.txt': 'o\n' }, message: 'socle' })
  const git = gitDe(repo)
  try {
    git('checkout', '-q', '-b', 'cote')
    writeFileSync(join(repo, PORTEUR), sourceStock([A]), 'utf8')
    git('commit', '-q', '--no-verify', '-am', 'cote retire b')
    git('checkout', '-q', 'main')
    writeFileSync(join(repo, 'autre.txt'), 'o\np\n', 'utf8')
    git('commit', '-q', '--no-verify', '-am', 'main')
    git('merge', '-q', '--no-ff', '--no-commit', 'cote')
    writeFileSync(join(repo, PORTEUR), sourceStock([A, "  'src/b.ts', // bis"]), 'utf8')
    git('add', PORTEUR)
    git('commit', '-q', '--no-verify', '-m', 'fusion qui remet b, sans cliquet')
    const fusion = git('rev-parse', 'HEAD').trim()
    const vu = await croissancesDeLaPlage({ cwd: repo, debut: SHA_NUL, fin: fusion })
    assert.equal(vu.commits, 4)
    assert.deepEqual(refusDe(vu).filter(([, fichier]) => fichier === PORTEUR), [[socle, PORTEUR, 2], [fusion, PORTEUR, 1]])
    assert.ok(vu.refus.filter((r) => r.fichier !== PORTEUR).every((r) => r.sha === socle))
  } finally {
    rmSync(repo, { recursive: true, force: true })
  }
})
