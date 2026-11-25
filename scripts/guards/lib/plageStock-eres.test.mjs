// Tests de la porte de PLAGE (`plageStock.mjs`) : le hook de commit sous MERGE_HEAD, le geste d'un refus et les
// ÈRES de la porte (#2223, #2503). Lancé par `npm run test:hooks`.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { PORTE_DE_PLAGE, cotesLisibles, raisonDeRefusDePlage, croissancesDeLaPlage, SHA_NUL } from './plageStock.mjs'
import { GitIndisponible, TRONC, depotDe, refusDeGit } from './gitPorte.mjs'
import { instanceDeDepot } from './depotGabarit.mjs'
import { jugeDeLEre } from './porteDEre.mjs'
import { gitDe } from '../../test/gitDeBanc.mjs'
import {
  PORTEUR,
  PORTE_SUR_DISQUE,
  depotForge,
  A,
  B,
  C,
  sourceStock,
  RECLASSE,
  importeur,
  depotCss,
  depotAFusion,
  CHANTIER,
  cliquet,
  ent,
  SIX,
  depotConstruit,
  messageDeFusion,
  auHook,
} from './plageStock.testkit.mjs'

test('#2223 HOOK sous MERGE_HEAD : main ajoute +1 déclaré, la conclusion une entrée muette — seule l’entrée de la fusion se déclare, `+1`', async () => {
  const d = depotConstruit()
  try {
    d.git('checkout', '-q', '-b', 'tronc', d.debut)
    d.poser({ [PORTEUR]: sourceStock([...SIX, ent('src/tronc.ts')]) }, `tronc +1${cliquet(PORTEUR, 1)}`)
    d.git('checkout', '-q', 'chantier')
    d.poser({}, 'chantier')
    d.fusionner('tronc')
    writeFileSync(join(d.repo, PORTEUR), sourceStock([...SIX, ent('src/tronc.ts'), ent('src/muette.ts')]), 'utf8')
    d.git('add', PORTEUR)
    const { diffDuCommit } = await import('../../git-hooks/porte-du-commit.mjs')
    assert.ok(diffDuCommit(d.repo).fusion(), 'l’index sous MERGE_HEAD est lu comme une fusion')
    assert.equal(await auHook(d.repo, messageDeFusion(cliquet(PORTEUR, 1))), null, 'la ligne exacte de l’apport passe')
    for (const lignes of ['', cliquet(PORTEUR, 2)]) {
      const refus = await auHook(d.repo, messageDeFusion(lignes))
      assert.ok(refus?.reason.includes(`${PORTEUR} : +1 entrée(s) nette(s)`), JSON.stringify([lignes, refus]))
    }
    const fin = d.poser({}, `fusion de main${cliquet(PORTEUR, 1)}`)
    assert.deepEqual(await d.juger(d.debut, fin), [], 'la plage rend le même verdict sur la fusion posée')
  } finally {
    rmSync(d.repo, { recursive: true, force: true })
  }
})

test('#2223 HOOK sous MERGE_HEAD : un franchissement CSS amené par main n’est pas à la fusion — aucune ligne `RECLASSEMENT:` exigée', async () => {
  const d = depotCss()
  try {
    d.git('checkout', '-q', '-b', 'chantier')
    d.commettre({ 'notes.txt': 'travail du chantier\n' }, 'docs: notes du chantier')
    d.git('checkout', '-q', 'main')
    d.commettre({ 'src/ui/Ecran2.tsx': importeur('Ecran2') }, RECLASSE)
    d.git('checkout', '-q', 'chantier')
    d.git('merge', '-q', '--no-ff', '--no-commit', 'main')
    assert.equal(await auHook(d.racine, messageDeFusion()), null)
  } finally {
    rmSync(d.racine, { recursive: true, force: true })
  }
})

test('#2223 HOOK sous MERGE_HEAD : le franchissement CSS que la conclusion pose elle-même est refusé, et nommé', async () => {
  const d = depotCss()
  try {
    d.git('checkout', '-q', '-b', 'chantier')
    d.commettre({ 'notes.txt': 'travail du chantier\n' }, 'docs: notes du chantier')
    d.git('checkout', '-q', 'main')
    d.commettre({ 'main.txt': 'main avance\n' }, 'docs: main avance')
    d.git('checkout', '-q', 'chantier')
    d.git('merge', '-q', '--no-ff', '--no-commit', 'main')
    writeFileSync(join(d.racine, 'src/ui/Ecran2.tsx'), importeur('Ecran2'), 'utf8')
    d.git('add', 'src/ui/Ecran2.tsx')
    const refus = await auHook(d.racine, messageDeFusion())
    assert.match(refus?.reason ?? '', /RECLASSEMENT CSS : src\/ui\/styles\/console\.css : franchi au prix 3, aucune ligne/)
  } finally {
    rmSync(d.racine, { recursive: true, force: true })
  }
})

test('#2223 REFUS d’une plage : le geste suit la sorte du commit fautif — fusion ou commit simple, jamais `rebase -i`', async () => {
  const { repo, socle, fusion } = depotAFusion(sourceStock([A, B, C]))
  try {
    const { refus } = await croissancesDeLaPlage({ cwd: repo, debut: socle, fin: fusion })
    assert.deepEqual(refus.map((r) => [r.sha, r.fusion]), [[fusion, true]])
    const raison = raisonDeRefusDePlage(refus)
    assert.ok(raison.includes(`(fusion) ${PORTEUR} +1`))
    assert.match(raison, /FUSION : `git commit --amend` de la fusion si elle est la tête ; sinon refaire la fusion/)
    assert.doesNotMatch(raison, /commit simple|rebase -i/)
  } finally {
    rmSync(repo, { recursive: true, force: true })
  }
})

// ── #2503 : chaque commit jugé par la porte de son ÈRE (`merge-base` avec le tronc) ───────────────
// Les portes forgées tiennent le CONTRAT d'entrée (`commits`, `cumul`) en quelques lignes : `porteurs`
// comptés sur les lignes de leur `diff`, au NET ou en AJOUTÉES, refusés hors d'un CLIQUET exact.

const X = 'x.txt'
const Y = 'y.txt'

/** Le stock que fait naître la sonde de VIE de la porte de plage (`vieDeLaPorte`) : toute porte forgée le compte. */
const VIE_DE_LA_PLAGE = `${['scripts', 'guards', 'vie-stock'].join('/')}.json`

/** Le texte d'une porte de plage forgée. */
const porteForgee = ({ porteurs, net }) => [
  "import './stocksNominatifs.mjs'",
  `const PORTEURS = ${JSON.stringify([...porteurs, VIE_DE_LA_PLAGE])}`,
  'export function refusDeLaPlage({ commits }) {',
  '  const refus = []',
  "  for (const { sha, message = '', diff = '' } of commits) {",
  '    for (const fichier of PORTEURS) {',
  "      const bloc = diff.split(/^diff --git /m).find((b) => b.startsWith(`a/${fichier} `))",
  '      if (!bloc) continue',
  "      const lignes = bloc.split('\\n')",
  "      const ajoutees = lignes.filter((l) => l.startsWith('+') && !l.startsWith('+++')).length",
  "      const retirees = lignes.filter((l) => l.startsWith('-') && !l.startsWith('---')).length",
  `      const n = ${net ? 'ajoutees - retirees' : 'ajoutees'}`,
  "      const lu = new RegExp(`^CLIQUET: ${fichier} \\\\+(\\\\d+)`, 'm').exec(message)",
  '      const declare = lu ? Number(lu[1]) : null',
  '      if (n > 0 && declare !== n) refus.push({ sha, fusion: false, fichier, net: n, declare, exemples: [] })',
  '    }',
  '  }',
  '  return refus',
  '}',
  'export const reclassementsDeLaPlage = () => []',
  '',
].join('\n')

const MODULE_PORTE = PORTE_DE_PLAGE.module
const STOCKS_VIVANTS = 'scripts/guards/lib/stocksNominatifs.mjs'
/** La lib que sonde la VIE d'une porte forgée : une entrée sur toute image. */
const VIE = "export const entreesNominatives = () => [{ ligne: 1, nomme: 1, cle: 'vie' }]\n"
const PORTE_V1 = porteForgee({ porteurs: [Y], net: false })
const PORTE_V2 = porteForgee({ porteurs: [Y, X], net: true })

/** Dépôt jetable dont le socle porte `porte` ; `poser(fichiers, message)` commet sur la branche
 *  courante et rend le sha ; `tronc(sha)` pose `origin/main`. */
function depotDEres(porte, autres = {}) {
  const { racine: repo, sha: socle } = instanceDeDepot({
    fichiers: { [MODULE_PORTE]: porte, [STOCKS_VIVANTS]: VIE, [X]: 'x0\n', [Y]: 'y0\ny1\n', ...autres },
    message: 'socle',
  })
  const git = gitDe(repo)
  git('update-ref', 'refs/remotes/origin/main', socle)
  const poser = (aPoser, message) => {
    for (const [rel, texte] of Object.entries(aPoser)) {
      mkdirSync(dirname(join(repo, rel)), { recursive: true })
      writeFileSync(join(repo, rel), texte, 'utf8')
      git('add', rel)
    }
    git('commit', '-q', '--no-verify', '-m', message)
    return git('rev-parse', 'HEAD').trim()
  }
  const tronc = (sha) => git('update-ref', 'refs/remotes/origin/main', sha)
  const plage = async (fin) => croissancesDeLaPlage({ cwd: repo, debut: SHA_NUL, fin, vers: CHANTIER })
  return { repo, socle, git, poser, tronc, plage }
}

test('#2503 ÈRE, compte qui MONTE : un commit né sous T0 garde sa porte quand T1 compte son porteur ; après la fusion de T1, la croissance muette est refusée', async () => {
  const d = depotDEres(PORTE_V1)
  try {
    d.git('checkout', '-q', '-b', 'chantier')
    const avant = d.poser({ [X]: 'x0\nx1\n' }, 'x grandit sous T0, muet')
    d.git('checkout', '-q', 'main')
    const t1 = d.poser({ [MODULE_PORTE]: PORTE_V2 }, 'T1 : la porte compte x')
    d.tronc(t1)
    d.git('checkout', '-q', 'chantier')
    const vu = await d.plage(avant)
    assert.deepEqual(vu.refus, [], 'jugé par la porte de son ère T0')
    assert.deepEqual(vu.eres.map((e) => [e.ere, e.commits, e.note]), [[d.socle, [avant], null]])
    d.git('merge', '-q', '--no-ff', '-m', 'fusion de T1', 'main')
    const apres = d.poser({ [X]: 'x0\nx1\nx2\n' }, 'x grandit sous T1, muet')
    const refus = (await d.plage(apres)).refus
    assert.deepEqual(refus.map((r) => [r.sha, r.fichier, r.net, r.ere]), [[apres, X, 1, t1]])
    assert.match(raisonDeRefusDePlage(refus), new RegExp(`${apres.slice(0, 9)} jugé par la porte de son ère ${t1.slice(0, 9)}, ${X} \\+1`))
  } finally {
    rmSync(d.repo, { recursive: true, force: true })
  }
})

test('#2503 ÈRE, compte qui BAISSE : l’annonce au compte d’ajoutées passe dans l’ère T0, la même est refusée dans l’ère T1', async () => {
  const d = depotDEres(PORTE_V1)
  try {
    const message = `y : une retirée, trois ajoutées\n\nCLIQUET: ${Y} +3 — compte de la porte de l’ère, en ajoutées`
    d.git('checkout', '-q', '-b', 'chantier')
    const sousT0 = d.poser({ [Y]: 'y0\na\nb\nc\n' }, message)
    assert.deepEqual((await d.plage(sousT0)).refus, [])
    d.git('checkout', '-q', 'main')
    const t1 = d.poser({ [MODULE_PORTE]: PORTE_V2 }, 'T1 : la porte compte au net')
    d.tronc(t1)
    d.git('checkout', '-q', '-b', 'chantier-t1')
    const sousT1 = d.poser({ [Y]: 'y0\na\nb\nc\n' }, message)
    const vu = await croissancesDeLaPlage({ cwd: d.repo, debut: SHA_NUL, fin: sousT1, vers: 'refs/heads/chantier-t1' })
    assert.deepEqual(vu.refus.map((r) => [r.sha, r.fichier, r.net, r.declare, r.ere]), [[sousT1, Y, 2, 3, t1]])
  } finally {
    rmSync(d.repo, { recursive: true, force: true })
  }
})

test('#2503 ÈRE : une branche qui AFFAIBLIT la porte (c1), grossit en silence (c2) puis la RESTAURE (c3) voit c2 refusé', async () => {
  const d = depotDEres(PORTE_V2)
  try {
    d.git('checkout', '-q', '-b', 'chantier')
    d.poser({ [MODULE_PORTE]: porteForgee({ porteurs: [], net: true }) }, 'c1 : la porte ne compte plus rien')
    const c2 = d.poser({ [X]: 'x0\nx1\n' }, 'c2 : x grandit, muet')
    const c3 = d.poser({ [MODULE_PORTE]: PORTE_V2 }, 'c3 : la porte restaurée')
    const vu = await d.plage(c3)
    assert.deepEqual(vu.refus.map((r) => [r.sha, r.fichier, r.net, r.ere]), [[c2, X, 1, d.socle]])
  } finally {
    rmSync(d.repo, { recursive: true, force: true })
  }
})

test('#2503 ÈRE, file puis tronc : la PR qui change la porte rend le même verdict dans la file (`HEAD ^base`) et sur le push du tronc (`before..after`)', async () => {
  const d = depotDEres(PORTE_V1)
  try {
    d.git('checkout', '-q', '-b', 'chantier')
    d.poser({ [MODULE_PORTE]: PORTE_V2 }, 'b1 : la porte compte au net')
    const b2 = d.poser({ [Y]: 'y0\na\nb\n' }, `b2 : y, une retirée, deux ajoutées\n\nCLIQUET: ${Y} +1 — le net, faux sous T0`)
    d.git('checkout', '-q', 'main')
    d.git('merge', '-q', '--no-ff', '-m', 'M : la file fusionne la PR', 'chantier')
    const m = d.git('rev-parse', 'HEAD').trim()
    const file = await croissancesDeLaPlage({ cwd: d.repo, debut: SHA_NUL, fin: m, vers: 'refs/heads/gh-readonly-queue/main/pr-1' })
    d.tronc(m)
    const tronc = await croissancesDeLaPlage({ cwd: d.repo, debut: d.socle, fin: m, vers: TRONC.branche })
    const verdict = (vu) => vu.refus.map((r) => [r.sha, r.fichier, r.net, r.declare, r.ere])
    assert.deepEqual(verdict(file), [[b2, Y, 2, 1, d.socle]], 'b2 jugé par la porte de T0, en ajoutées')
    assert.deepEqual(verdict(tronc), verdict(file))
  } finally {
    rmSync(d.repo, { recursive: true, force: true })
  }
})

test('#2503 ÈRE non chargeable : la porte actuelle juge, et la note le dit', async () => {
  for (const [cas, autres, raison] of [
    ['vie négative', { [STOCKS_VIVANTS]: 'export const entreesNominatives = () => []\n' }, 'sonde de vie négative'],
    ['porte muette', { [MODULE_PORTE]: "import './stocksNominatifs.mjs'\nexport const refusDeLaPlage = () => []\nexport const reclassementsDeLaPlage = () => []\n" }, 'sonde de vie négative'],
    ['export absent', { [MODULE_PORTE]: "import './stocksNominatifs.mjs'\nexport const refusDeLaPlage = () => []\n" }, 'export(s) absent(s) de `scripts/guards/lib/plageStock.mjs` : reclassementsDeLaPlage'],
    ['module qui ne se parse pas', { [MODULE_PORTE]: "import './stocksNominatifs.mjs'\nexport const refusDeLaPlage = (\n" }, 'arbre illisible .sitesDeModule : .* ne se parse pas'],
  ]) {
    const d = depotDEres(PORTE_V2, autres)
    try {
      d.git('checkout', '-q', '-b', 'chantier')
      const muet = d.poser({ [PORTEUR]: sourceStock([A]) }, 'un stock réel naît, muet')
      const vu = await d.plage(muet)
      assert.deepEqual(vu.refus.map((r) => [r.sha, r.fichier, r.net, r.ere]), [[muet, PORTEUR, 1, d.socle]], cas)
      assert.equal(vu.notes.length, 1, cas)
      assert.match(vu.notes[0], new RegExp(`^${d.socle.slice(0, 9)} non chargeable : .*(${raison.replace(/[`()]/g, '.')})`), cas)
      assert.deepEqual(vu.eres.map((e) => e.note), vu.notes, cas)
    } finally {
      rmSync(d.repo, { recursive: true, force: true })
    }
  }
})

test('#2503 ÈRE SANS la porte : la porte actuelle juge, un stock qui naît muet est refusé, et la note le dit', async () => {
  const { racine: repo, sha: socle } = instanceDeDepot({ fichiers: { 'a.txt': 'a\n' }, message: 'socle' })
  try {
    const git = gitDe(repo)
    git('update-ref', 'refs/remotes/origin/main', socle)
    git('checkout', '-q', '-b', 'chantier')
    mkdirSync(dirname(join(repo, PORTEUR)), { recursive: true })
    writeFileSync(join(repo, PORTEUR), sourceStock([A]), 'utf8')
    git('add', PORTEUR)
    git('commit', '-q', '--no-verify', '-m', 'un stock naît, muet, sur une base sans la porte')
    const muet = git('rev-parse', 'HEAD').trim()
    const vu = await croissancesDeLaPlage({ cwd: repo, debut: SHA_NUL, fin: muet, vers: CHANTIER })
    assert.deepEqual(vu.refus.map((r) => [r.sha, r.fichier, r.net, r.ere]), [[muet, PORTEUR, 1, socle]])
    assert.deepEqual(vu.notes, [`${socle.slice(0, 9)} sans la porte \`${MODULE_PORTE}\` : jugé(s) par la porte actuelle`])
  } finally {
    rmSync(repo, { recursive: true, force: true })
  }
})

test('#2503 GitIndisponible entre modules : une lecture en panne sous le juge d’une ère CHARGÉE rend un refus `illisible` au texte de `refusDeGit`', async () => {
  const { racine: repo, sha: socle } = depotForge({
    fichiers: { [MODULE_PORTE]: `${PORTE_SUR_DISQUE[MODULE_PORTE]}\n// ère forgée : une autre instance du module\n` },
    message: 'socle',
  })
  try {
    const { juge, note, source } = await jugeDeLEre(depotDe(repo), socle, PORTE_DE_PLAGE)
    assert.deepEqual([note, source], [null, 'arbre'])
    const panne = new GitIndisponible({ disponible: false, raison: 'cause de la panne\n', issue: 'refus', diagnostic: { status: 35, stdout: 'sortie', stderr: 'cause de la panne\n' } })
    const commits = [{ sha: socle, message: '', cotes: cotesLisibles(() => { throw panne }) }]
    assert.deepEqual(juge.reclassementsDeLaPlage({ commits }), [{ sha: socle, fusion: false, illisible: refusDeGit(panne) }])
  } finally {
    rmSync(repo, { recursive: true, force: true })
  }
})
