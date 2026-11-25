// Tests de la porte de PLAGE (`plageStock.mjs`) : la croissance en ENTRÉES identifiées, les FUSIONS du tronc
// et des branches, et les scénarios CONSTRUITS des juges (#2223, #3023, #1463). Lancé par `npm run test:hooks`.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { croissancesDeLaPlage } from './plageStock.mjs'
import { franchisDuCommit } from './reclassementCss.mjs'
import { texteDeStock } from './stockDeSites.mjs'
import { gitDe, resultatDeGit } from '../../test/gitDeBanc.mjs'
import {
  PORTEUR,
  depotForge,
  A,
  B,
  C,
  D,
  sourceStock,
  lireEtJugerLaPlage,
  MANIFESTE,
  manifesteAvec,
  PRIMITIVE_CONSOLE,
  RECLASSE,
  importeur,
  depotCss,
  CHANTIER,
  refusDe,
  depotDeChantier,
  cliquet,
  ent,
  SIX,
  depotConstruit,
} from './plageStock.testkit.mjs'

// ── #2223 : la croissance se compte en ENTRÉES identifiées, une fusion jamais contre un texte à marqueurs ──

/** Un stock de sites JSON (`FORMAT_JSON`) de quatre champs par entrée. */
const STOCK_JSON = 'scripts/raw/x-stock.json'
const site = (fichier, ref, valeur) => ({ fichier, ref, occurrence: 1, pdfChars: valeur })
const stockJson = (entrees) => texteDeStock('test', entrees)
const SITES = [site('src/a.ts', 'r1', 1), site('src/b.ts', 'r2', 2), site('src/c.ts', 'r3', 3), site('src/b.ts', 'r4', 4)]

test('#2223 ENTRÉES : réécrire une entrée sans changer son fichier ne fait rien naître — champ d’un site, extension ajoutée dans une paire de Map', async () => {
  const REGISTRE = 'scripts/guards/lib/x.mjs'
  const paire = (valeur) => `export const TYPES = new Map([['BoneId', '${valeur}']])\n`
  const d = depotDeChantier({ [STOCK_JSON]: stockJson(SITES), [REGISTRE]: paire('src/os/bones') })
  try {
    const fin = d.poser({
      [STOCK_JSON]: stockJson([SITES[0], site('src/b.ts', 'r2', 99), SITES[2], SITES[3]]),
      [REGISTRE]: paire('src/os/bones.ts'),
    }, 'réécrit deux valeurs')
    assert.deepEqual(refusDe(await d.plage(fin)), [])
  } finally {
    rmSync(d.repo, { recursive: true, force: true })
  }
})

test('#2223 ENTRÉES : ajouter une entrée la compte +1 (contrat positif), réordonnancement compris', async () => {
  const d = depotDeChantier({ [STOCK_JSON]: stockJson(SITES) })
  try {
    const fin = d.poser({ [STOCK_JSON]: stockJson([SITES[3], site('src/d.ts', 'r5', 5), ...SITES.slice(0, 3)]) }, 'ajoute d')
    assert.deepEqual(refusDe(await d.plage(fin)), [[fin, STOCK_JSON, 1]])
  } finally {
    rmSync(d.repo, { recursive: true, force: true })
  }
})

test('#2223 FUSION : un conflit résolu sur le manifeste se lit contre les parents — aucun « illisible »', async () => {
  const MANIFESTE = 'src/data/primitives.manifest.json'
  const manifeste = (x) => `${JSON.stringify([{ id: 'a', x }], null, 2)}\n`
  const d = depotDeChantier({ [MANIFESTE]: manifeste(0) })
  try {
    d.poser({ [MANIFESTE]: manifeste(1) }, 'chantier touche le manifeste')
    d.git('checkout', '-q', '-b', 'x', d.debut)
    d.poser({ [MANIFESTE]: manifeste(2) }, 'x touche la même ligne')
    d.git('checkout', '-q', 'chantier')
    assert.throws(() => d.git('merge', '-q', '--no-ff', '--no-verify', 'x'), 'témoin : la fusion est EN CONFLIT')
    writeFileSync(join(d.repo, MANIFESTE), manifeste(3), 'utf8')
    d.git('add', MANIFESTE)
    d.git('commit', '-q', '--no-verify', '-m', 'fusion résolue')
    const fin = d.git('rev-parse', 'HEAD').trim()
    const vu = await d.plage(fin)
    assert.deepEqual([vu.indisponible, vu.reclassements, vu.refus], [null, [], []])
  } finally {
    rmSync(d.repo, { recursive: true, force: true })
  }
})

test('#2223 RECLASSEMENT d’une FUSION à trois voies : les DEUX côtés franchissent la console, la fusion n’ajoute rien — aucune ligne exigée', async () => {
  const d = depotCss()
  try {
    d.git('checkout', '-q', '-b', 'chantier')
    d.commettre({ 'src/ui/Ecran2.tsx': importeur('Ecran2') }, RECLASSE)
    d.git('checkout', '-q', 'main')
    d.commettre({ 'src/ui/Ecran3.tsx': importeur('Ecran3') }, RECLASSE)
    d.git('checkout', '-q', 'chantier')
    d.git('merge', '-q', '--no-ff', '--no-commit', 'main')
    const fusion = d.commettre({ [MANIFESTE]: manifesteAvec(PRIMITIVE_CONSOLE, { id: 'b' }) }, 'fusion de main, manifeste retouché')
    assert.deepEqual((await croissancesDeLaPlage({ cwd: d.racine, debut: d.base, fin: fusion })).reclassements, [])
  } finally {
    rmSync(d.racine, { recursive: true, force: true })
  }
})

test('#2223 RECLASSEMENT d’une FUSION à trois voies : une exemption RESSUSCITÉE (base exemptée, `^1` libère, `^2` garde, fusion exempte) est franchie, payée contre `^1`', () => {
  const Q = 'src/ui/styles/ecran-q.css'
  const cote = (exempte) => ({
    manifeste: [{ id: 'sans-css' }, ...(exempte ? [{ id: Q, fichier: `${Q}.tsx`, css: Q }] : [])],
    partagees: [], reutilises: new Set(exempte ? [`${Q}.tsx`] : []), lire: (f) => (f === Q ? '.e { color: red; border: 0; font-size: 3px; gap: 3px }' : null),
  })
  const [libre, exempte] = [cote(false), cote(true)]
  assert.deepEqual(franchisDuCommit({ base: exempte, commit: exempte, parents: [libre, exempte] }).map((f) => [f.module, f.n]), [[Q, 4]])
  assert.deepEqual(franchisDuCommit({ base: exempte, commit: exempte, parents: [exempte, exempte] }), [], 'témoin : gardée des deux côtés, rien n’est franchi')
  assert.deepEqual(franchisDuCommit({ base: libre, commit: exempte, parents: [libre, exempte] }), [], 'témoin : `^2` l’exempte seul, la fusion automatique aussi')
})

test('#2223 FUSION : un porteur SUPPRIMÉ par le tronc, enrichi par le chantier, gardé par la résolution — ses entrées ressuscitées sont refusées', async () => {
  const d = depotDeChantier({ [PORTEUR]: sourceStock([A, B, C]) })
  try {
    d.poser({ [PORTEUR]: sourceStock([A, B, C, D]) }, `ajoute d\n\nCLIQUET: ${PORTEUR} +1 — le chantier ajoute une entrée, refs #2223`)
    d.git('checkout', '-q', '-b', 'tronc', d.debut)
    const supprime = d.poser({ [PORTEUR]: null }, 'le tronc supprime le porteur')
    d.git('update-ref', 'refs/remotes/origin/main', supprime)
    d.git('checkout', '-q', 'chantier')
    const chantier = d.git('rev-parse', 'HEAD').trim()
    assert.throws(() => d.git('merge', '-q', '--no-ff', '--no-verify', 'tronc'), 'témoin : modify/delete EN CONFLIT')
    d.git('add', PORTEUR)
    d.git('commit', '-q', '--no-verify', '-m', 'fusion qui garde le porteur')
    const fin = d.git('rev-parse', 'HEAD').trim()
    assert.deepEqual(refusDe(await d.plage(fin)), [[fin, PORTEUR, 3]])
    d.git('checkout', '-q', '-b', 'refaite', chantier)
    assert.throws(() => d.git('merge', '-q', '--no-ff', '--no-verify', 'tronc'), 'témoin : modify/delete EN CONFLIT')
    d.git('rm', '-q', PORTEUR)
    d.git('commit', '-q', '--no-verify', '-m', 'fusion qui supprime le porteur comme le tronc')
    assert.deepEqual(refusDe(await d.plage(d.git('rev-parse', 'HEAD').trim())), [], 'témoin : la résolution identique au tronc n’apporte rien')
  } finally {
    rmSync(d.repo, { recursive: true, force: true })
  }
})

test('#3023 FUSION du tronc : la résurrection d’une entrée que le TRONC a soldée naît, même identique au chantier ; le solde du tronc ne paie pas une entrée NEUVE ; identique au tronc, rien', async () => {
  const { racine: repo, sha: socle } = depotForge({ fichiers: { [PORTEUR]: sourceStock([A, B]), 'src/b.ts': 'export const b = FAUTE\n' }, message: 'socle' })
  const git = gitDe(repo)
  try {
    git('checkout', '-q', '-b', 'tronc')
    writeFileSync(join(repo, PORTEUR), sourceStock([A]), 'utf8')
    writeFileSync(join(repo, 'src/b.ts'), 'export const b = CORRIGE\n', 'utf8')
    git('commit', '-q', '--no-verify', '-am', 'le tronc solde b')
    const tronc = git('rev-parse', 'HEAD').trim()
    git('update-ref', 'refs/remotes/origin/main', tronc)
    git('checkout', '-q', '-b', 'chantier', socle)
    writeFileSync(join(repo, 'src/b.ts'), 'export const b = FAUTE // chantier\n', 'utf8')
    git('commit', '-q', '--no-verify', '-am', 'le chantier retouche b')
    const chantier = git('rev-parse', 'HEAD').trim()
    const resoudre = async (branche, entrees) => {
      git('checkout', '-q', '-b', branche, chantier)
      assert.throws(() => git('merge', '-q', '--no-ff', '--no-verify', 'tronc'), 'témoin : conflit sur src/b.ts')
      writeFileSync(join(repo, PORTEUR), sourceStock(entrees), 'utf8')
      writeFileSync(join(repo, 'src/b.ts'), 'export const b = FAUTE // chantier\n', 'utf8')
      git('add', PORTEUR, 'src/b.ts')
      git('commit', '-q', '--no-verify', '-m', `fusion du tronc (${branche})`)
      const fin = git('rev-parse', 'HEAD').trim()
      return [fin, refusDe(await croissancesDeLaPlage({ cwd: repo, debut: tronc, fin, vers: CHANTIER }))]
    }
    const [ressuscitee, refusDeLaResurrection] = await resoudre('comme-le-chantier', [A, B])
    assert.deepEqual(refusDeLaResurrection, [[ressuscitee, PORTEUR, 1]])
    const [neuve, refusDeLaNeuve] = await resoudre('neuve', [A, "  'src/neuve.ts',"])
    assert.deepEqual(refusDeLaNeuve, [[neuve, PORTEUR, 1]])
    assert.deepEqual((await resoudre('comme-le-tronc', [A]))[1], [])
  } finally {
    rmSync(repo, { recursive: true, force: true })
  }
})

test('#1463 #3023 FUSION d’une branche PÉRIMÉE que le tronc a déjà fusionnée : elle n’est pas le tronc, la résurrection d’un solde du tronc naît au commit comme au cumul', async () => {
  const { racine: repo, sha: socle } = depotForge({ fichiers: { [PORTEUR]: sourceStock([A, B, "  'src/x.ts',"]), 'autre.txt': 'o\n', 'p.txt': 'p\n' }, message: 'socle' })
  const git = gitDe(repo)
  try {
    git('checkout', '-q', '-b', 'perimee', socle)
    writeFileSync(join(repo, 'p.txt'), 'p2\n', 'utf8')
    git('commit', '-q', '--no-verify', '-am', 'la branche travaille')
    git('checkout', '-q', '-b', 'tronc', socle)
    writeFileSync(join(repo, PORTEUR), sourceStock([A, B]), 'utf8')
    git('commit', '-q', '--no-verify', '-am', 'le tronc solde x')
    const solde = git('rev-parse', 'HEAD').trim()
    git('merge', '-q', '--no-ff', '--no-verify', '-m', 'le tronc fusionne la branche', 'perimee')
    const tronc = git('rev-parse', 'HEAD').trim()
    git('update-ref', 'refs/remotes/origin/main', tronc)
    git('checkout', '-q', '-b', 'chantier', solde)
    writeFileSync(join(repo, 'autre.txt'), 'o\nq\n', 'utf8')
    git('commit', '-q', '--no-verify', '-am', 'le chantier travaille')
    git('merge', '-q', '--no-ff', '--no-commit', '--no-verify', 'perimee')
    writeFileSync(join(repo, PORTEUR), sourceStock([A, B, "  'src/x.ts',"]), 'utf8')
    git('add', PORTEUR)
    git('commit', '-q', '--no-verify', '-m', 'fusion de la branche, x ressuscité')
    const fin = git('rev-parse', 'HEAD').trim()
    const { lue, verdict } = await lireEtJugerLaPlage({ cwd: repo, debut: tronc, fin, vers: CHANTIER })
    assert.deepEqual(refusDe(verdict), [[fin, PORTEUR, 1]], 'pre-push')
    assert.deepEqual(refusDe(await croissancesDeLaPlage({ cwd: repo, fin })), [[fin, PORTEUR, 1]], 'fenêtre de la CI')
    assert.ok([...lue.cumul.find((b) => b.fichier === PORTEUR).parCle.values()].every((n) => n > 0), 'le cumul part de l’arbre vide')
    assert.match(lue.notes.join('\n'), /sans état unique .*fusion croisée.*ne filtre aucun refus/)
  } finally {
    rmSync(repo, { recursive: true, force: true })
  }
})

test('#1463 FUSION CROISÉE au pre-push : sans état unique du tronc, le cumul ne filtre rien, et l’entrée ajoutée sans CLIQUET reste refusée', async () => {
  const { racine: repo, sha: socle } = depotForge({ fichiers: { [PORTEUR]: sourceStock([A, B, "  'src/c.ts',"]), 't.txt': 't\n', 'c.txt': 'c\n' }, message: 'socle' })
  const git = gitDe(repo)
  const tete = () => git('rev-parse', 'HEAD').trim()
  try {
    git('checkout', '-q', '-b', 'tronc', socle)
    writeFileSync(join(repo, 't.txt'), 't1\n', 'utf8'); git('commit', '-q', '--no-verify', '-am', 'T1')
    const t1 = tete()
    git('checkout', '-q', '-b', 'chantier', socle)
    writeFileSync(join(repo, 'c.txt'), 'c1\n', 'utf8'); git('commit', '-q', '--no-verify', '-am', 'C1')
    const c1 = tete()
    git('merge', '-q', '--no-ff', '--no-verify', '-m', 'le chantier fusionne T1', t1)
    const pousse = tete()
    git('checkout', '-q', 'tronc'); git('merge', '-q', '--no-ff', '--no-verify', '-m', 'le tronc fusionne C1', c1)
    writeFileSync(join(repo, PORTEUR), sourceStock([A, "  'src/c.ts',"]), 'utf8'); git('commit', '-q', '--no-verify', '-am', 'le tronc solde b')
    const solde = tete()
    git('merge', '-q', '--no-ff', '--no-verify', '-m', 'le tronc fusionne le bout poussé', pousse)
    git('update-ref', 'refs/remotes/origin/main', tete())
    git('checkout', '-q', 'chantier'); git('merge', '-q', '--no-ff', '--no-verify', '-m', 'le chantier fusionne le solde', solde)
    writeFileSync(join(repo, PORTEUR), sourceStock([A, "  'src/c.ts',", "  'src/n.ts',"]), 'utf8'); git('commit', '-q', '--no-verify', '-am', 'n sans cliquet')
    const fin = tete()
    const vu = await croissancesDeLaPlage({ cwd: repo, debut: pousse, fin, vers: CHANTIER })
    assert.deepEqual(refusDe(vu), [[fin, PORTEUR, 1]])
    assert.match(vu.notes.join('\n'), /sans état unique .*fusion croisée.*ne filtre aucun refus/)
  } finally {
    rmSync(repo, { recursive: true, force: true })
  }
})

test('#1463 FUSION CROISÉE au BOUT du pre-push : un `debut` sans état unique du tronc fait partir le cumul de l’arbre vide, et l’entrée ajoutée sans CLIQUET reste refusée', async () => {
  const [C, N] = ["  'src/c.ts',", "  'src/n.ts',"]
  const { racine: repo, sha: socle } = depotForge({ fichiers: { [PORTEUR]: sourceStock([A, B, C]), 't.txt': 't\n', 'c.txt': 'c\n' }, message: 'socle' })
  const git = gitDe(repo)
  const tete = () => git('rev-parse', 'HEAD').trim()
  try {
    git('checkout', '-q', '-b', 'tronc', socle)
    writeFileSync(join(repo, 't.txt'), 't1\n', 'utf8'); git('commit', '-q', '--no-verify', '-am', 'T1')
    const t1 = tete()
    git('checkout', '-q', '-b', 'chantier', socle)
    writeFileSync(join(repo, 'c.txt'), 'c1\n', 'utf8'); git('commit', '-q', '--no-verify', '-am', 'C1')
    const c1 = tete()
    git('merge', '-q', '--no-ff', '--no-verify', '-m', 'le chantier fusionne T1', t1)
    const croise = tete()
    git('checkout', '-q', 'tronc'); git('merge', '-q', '--no-ff', '--no-verify', '-m', 'le tronc fusionne C1', c1)
    writeFileSync(join(repo, PORTEUR), sourceStock([A, C]), 'utf8'); git('commit', '-q', '--no-verify', '-am', 'le tronc solde b')
    const soldeB = tete()
    git('merge', '-q', '--no-ff', '--no-verify', '-m', 'le tronc fusionne le chantier croisé', croise)
    git('checkout', '-q', 'chantier'); git('merge', '-q', '--no-ff', '--no-verify', '-m', 'le chantier fusionne le solde de b', soldeB)
    const debut = tete()
    git('checkout', '-q', 'tronc')
    writeFileSync(join(repo, PORTEUR), sourceStock([A]), 'utf8'); git('commit', '-q', '--no-verify', '-am', 'le tronc solde c')
    const soldeC = tete()
    git('update-ref', 'refs/remotes/origin/main', soldeC)
    git('checkout', '-q', 'chantier')
    writeFileSync(join(repo, PORTEUR), sourceStock([A, C, N]), 'utf8'); git('commit', '-q', '--no-verify', '-am', 'n sans cliquet')
    const ajout = tete()
    resultatDeGit(['merge', '--no-ff', '--no-commit', '--no-verify', soldeC], { cwd: repo })
    writeFileSync(join(repo, PORTEUR), sourceStock([A, N]), 'utf8'); git('add', PORTEUR)
    git('commit', '-q', '--no-verify', '-m', 'le chantier fusionne le solde de c')
    const fin = tete()
    assert.equal(git('merge-base', '--all', debut, soldeC).trim().split('\n').length, 2, 'témoin : le bout poussé a deux bases avec le tronc')
    assert.equal(git('merge-base', '--all', fin, soldeC).trim(), soldeC, 'témoin : la fin en connaît un état unique')
    const vu = await croissancesDeLaPlage({ cwd: repo, debut, fin, vers: CHANTIER })
    assert.deepEqual(refusDe(vu), [[ajout, PORTEUR, 1]])
    assert.deepEqual(vu.notes, [`\`${debut.slice(0, 9)}\` sans état unique de \`origin/main\` (fusion croisée) : le cumul part de l'arbre vide, il ne filtre aucun refus`])
    assert.deepEqual(refusDe(await croissancesDeLaPlage({ cwd: repo, fin })), [[ajout, PORTEUR, 1]], 'fenêtre de la CI')
  } finally {
    rmSync(repo, { recursive: true, force: true })
  }
})

// ── #2223 : la porte publiée sur les scénarios CONSTRUITS des juges (issuecomment-5933197112) ─────────

const corpsDe = (s) => `${Array.from({ length: 30 }, (_, i) => `export const v${i} = '${s}${i}'`).join('\n')}\n`

/** Les scénarios des juges : chacun construit son histoire et rend `[debut, fin, attendu, vers?]`. */
const CONSTRUITS = {
  'F1 porteur renommé après une croissance déclarée': (d) => {
    d.poser({ [PORTEUR]: sourceStock([...SIX, ent('src/neuf.ts')]) }, `ajoute neuf${cliquet(PORTEUR, 1)}`)
    d.git('mv', PORTEUR, 'scripts/y.test.mjs')
    return [d.debut, d.poser({}, 'renomme le porteur'), () => []]
  },
  'F2 main renomme le porteur, la branche y ajoute une entrée déclarée ; plage de file': (d) => {
    d.poser({ [PORTEUR]: sourceStock([...SIX, ent('src/neuf.ts')]) }, `ajoute neuf${cliquet(PORTEUR, 1)}`)
    d.git('checkout', '-q', '-b', 'tronc', d.debut)
    d.git('mv', PORTEUR, 'scripts/y.test.mjs')
    const t = d.poser({}, 'tronc : renomme le porteur')
    d.git('checkout', '-q', 'chantier')
    d.fusionner('tronc')
    d.poser({}, 'fusion de main')
    d.git('checkout', '-q', 'tronc')
    d.fusionner('chantier')
    return [t, d.poser({}, 'Merge pull request'), () => []]
  },
  'F3 fichier nommé renommé avec son entrée, puis réécrit': (d) => {
    const debut = d.poser({ [PORTEUR]: sourceStock([...SIX, ent('src/a.ts')]) }, `entrée a${cliquet(PORTEUR, 1)}`)
    d.git('mv', 'src/a.ts', 'src/b.ts')
    d.poser({ [PORTEUR]: sourceStock([...SIX, ent('src/b.ts')]) }, 'renomme a -> b, entrée suivie')
    return [debut, d.poser({ 'src/b.ts': corpsDe('zz') }, 'réécrit b'), () => []]
  },
  'R1 les deux côtés retirent k1': (d) => {
    d.poser({ [PORTEUR]: sourceStock(SIX.slice(1)) }, 'chantier retire k1')
    d.git('checkout', '-q', '-b', 'cote', d.debut)
    d.poser({ [PORTEUR]: sourceStock(SIX.slice(1)) }, 'cote retire k1')
    d.git('checkout', '-q', 'chantier')
    d.fusionner('cote')
    return [d.debut, d.poser({}, 'fusion'), () => []]
  },
  'N1 fusion propre : chaque côté ajoute une entrée distincte de même clé, déclarée': (d) => {
    d.poser({ [PORTEUR]: sourceStock([ent('src/k1.ts:10'), ...SIX]) }, `chantier +k1:10${cliquet(PORTEUR, 1)}`)
    d.git('checkout', '-q', '-b', 'cote', d.debut)
    d.poser({ [PORTEUR]: sourceStock([...SIX, ent('src/k1.ts:20')]) }, `cote +k1:20${cliquet(PORTEUR, 1)}`)
    d.git('checkout', '-q', 'chantier')
    d.fusionner('cote')
    return [d.debut, d.poser({}, 'fusion propre'), () => []]
  },
  'N4b porteur créé des deux côtés (add/add), même clé, union': (d) => {
    const R = 'scripts/r.test.mjs'
    d.poser({ [R]: sourceStock([ent('src/a.ts:1')]) }, `chantier crée r${cliquet(R, 1)}`)
    d.git('checkout', '-q', '-b', 'cote', d.debut)
    d.poser({ [R]: sourceStock([ent('src/a.ts:2')]) }, `cote crée r${cliquet(R, 1)}`)
    d.git('checkout', '-q', 'chantier')
    d.fusionner('cote')
    return [d.debut, d.poser({ [R]: sourceStock([ent('src/a.ts:1'), ent('src/a.ts:2')]) }, 'fusion add/add, union'), () => []]
  },
  'M1 croissance déclarée puis retirée, fusion muette': (d) => {
    d.poser({ [PORTEUR]: sourceStock([...SIX, ent('src/e.ts')]) }, `ajoute e${cliquet(PORTEUR, 1)}`)
    d.poser({ [PORTEUR]: sourceStock(SIX) }, 'retire e')
    d.git('checkout', '-q', '-b', 'cote', d.debut)
    d.poser({}, 'côté vide')
    d.git('checkout', '-q', 'chantier')
    d.fusionner('cote')
    const fin = d.poser({ [PORTEUR]: sourceStock([...SIX, ent('src/muette.ts')]) }, 'fusion qui ajoute muette')
    return [d.debut, fin, () => [[fin, PORTEUR, 1]]]
  },
  'M2 retrait puis remise déclarée, fusion muette sous la même clé': (d) => {
    d.poser({ [PORTEUR]: sourceStock(SIX.slice(1)) }, 'retire k1')
    d.poser({ [PORTEUR]: sourceStock(SIX) }, `remet k1${cliquet(PORTEUR, 1)}`)
    d.git('checkout', '-q', '-b', 'cote', d.debut)
    d.poser({}, 'côté vide')
    d.git('checkout', '-q', 'chantier')
    d.fusionner('cote')
    const fin = d.poser({ [PORTEUR]: sourceStock([...SIX, ent('src/k1.ts', 'bis')]) }, 'fusion qui ajoute k1 bis')
    return [d.debut, fin, () => [[fin, PORTEUR, 1]]]
  },
  'M3 ligne tampon sur un commit qui ne grandit pas, fusion muette +3': (d) => {
    d.poser({}, `commit vide${cliquet(PORTEUR, 3)}`)
    d.git('checkout', '-q', '-b', 'cote', d.debut)
    d.poser({}, 'côté vide')
    d.git('checkout', '-q', 'chantier')
    d.fusionner('cote')
    const fin = d.poser({ [PORTEUR]: sourceStock([...SIX, ent('src/m1.ts'), ent('src/m2.ts'), ent('src/m3.ts')]) }, 'fusion +3 muette')
    return [d.debut, fin, () => [[fin, PORTEUR, 3]]]
  },
  'R2 ajout double déclaré, fusion muette sous la même clé': (d) => {
    d.poser({ [PORTEUR]: sourceStock([...SIX, ent('src/z.ts')]) }, `chantier +z${cliquet(PORTEUR, 1)}`)
    d.git('checkout', '-q', '-b', 'cote', d.debut)
    d.poser({ [PORTEUR]: sourceStock([...SIX, ent('src/z.ts')]) }, `cote +z${cliquet(PORTEUR, 1)}`)
    d.git('checkout', '-q', 'chantier')
    d.fusionner('cote')
    const fin = d.poser({ [PORTEUR]: sourceStock([...SIX, ent('src/z.ts'), ent('src/z.ts:2')]) }, 'fusion + z:2 muette')
    return [d.debut, fin, () => [[fin, PORTEUR, 1]]]
  },
  'N2c main retire k2, la fusion de main reprend le porteur de la branche ; plage de file': (d) => {
    d.poser({}, 'chantier : travail')
    d.git('checkout', '-q', '-b', 'tronc', d.debut)
    const t = d.poser({ [PORTEUR]: sourceStock(SIX.filter((l) => !l.includes('k2'))) }, 'main retire k2')
    d.git('checkout', '-q', 'chantier')
    d.fusionner('tronc')
    const fusion = d.poser({ [PORTEUR]: sourceStock(SIX) }, 'fusion de main : porteur pris à la branche')
    d.git('checkout', '-q', 'tronc')
    d.fusionner('chantier')
    return [t, d.poser({}, 'Merge pull request'), () => [[fusion, PORTEUR, 1]], 'refs/heads/tronc']
  },
  'N2 main retire k2, la résolution reprend la branche ; cumul nul': (d) => {
    d.poser({}, 'chantier : travail')
    d.git('checkout', '-q', '-b', 'cote', d.debut)
    d.poser({ [PORTEUR]: sourceStock(SIX.filter((l) => !l.includes('k2'))) }, 'main retire k2')
    d.git('checkout', '-q', 'chantier')
    d.fusionner('cote')
    return [d.debut, d.poser({ [PORTEUR]: sourceStock(SIX) }, 'fusion : porteur pris à la branche'), () => []]
  },
  'N2b main retire k2, fusion ours ; cumul nul': (d) => {
    d.poser({}, 'chantier : travail')
    d.git('checkout', '-q', '-b', 'cote', d.debut)
    d.poser({ [PORTEUR]: sourceStock(SIX.filter((l) => !l.includes('k2'))) }, 'main retire k2')
    d.git('checkout', '-q', 'chantier')
    d.git('merge', '-q', '--no-ff', '--no-verify', '-s', 'ours', '-m', 'fusion ours', 'cote')
    return [d.debut, d.git('rev-parse', 'HEAD').trim(), () => []]
  },
  'N3 la fusion renomme le fichier nommé et suit son entrée': (d) => {
    const debut = d.poser({ 'src/k1.ts': corpsDe('a') }, 'k1 existe')
    d.poser({}, 'chantier : travail')
    d.git('checkout', '-q', '-b', 'cote', debut)
    d.poser({}, 'côté')
    d.git('checkout', '-q', 'chantier')
    d.fusionner('cote')
    d.git('mv', 'src/k1.ts', 'src/kk.ts')
    return [debut, d.poser({ [PORTEUR]: sourceStock(SIX.map((l) => l.replace('k1.ts', 'kk.ts'))) }, 'fusion qui renomme'), () => []]
  },
  'N4 porteur créé des deux côtés (add/add), clés distinctes, union': (d) => {
    const R = 'scripts/r.test.mjs'
    d.poser({ [R]: sourceStock([ent('src/a.ts')]) }, `chantier crée r${cliquet(R, 1)}`)
    d.git('checkout', '-q', '-b', 'cote', d.debut)
    d.poser({ [R]: sourceStock([ent('src/b.ts')]) }, `cote crée r${cliquet(R, 1)}`)
    d.git('checkout', '-q', 'chantier')
    d.fusionner('cote')
    return [d.debut, d.poser({ [R]: sourceStock([ent('src/a.ts'), ent('src/b.ts')]) }, 'fusion add/add, union'), () => []]
  },
  'N5 multiplicités différentes, retouche de k3 ; fusion propre': (d) => {
    d.poser({ [PORTEUR]: sourceStock([...SIX, ent('src/k1.ts:9')]) }, `chantier +k1:9${cliquet(PORTEUR, 1)}`)
    d.git('checkout', '-q', '-b', 'cote', d.debut)
    d.poser({ [PORTEUR]: sourceStock(SIX.map((l) => l.replace('k3.ts', 'k3.ts:1'))) }, 'cote retouche k3')
    d.git('checkout', '-q', 'chantier')
    d.fusionner('cote')
    return [d.debut, d.poser({}, 'fusion propre'), () => []]
  },
  'N3b main renomme k1 -> kk, la branche ajoute k1:5, la résolution la suit en kk': (d) => {
    const ren = (l) => l.replace('k1.ts', 'kk.ts')
    const debut = d.poser({ 'src/k1.ts': corpsDe('a') }, 'k1 existe')
    d.poser({ [PORTEUR]: sourceStock([...SIX, ent('src/k1.ts:5')]) }, `chantier +k1:5${cliquet(PORTEUR, 1)}`)
    d.git('checkout', '-q', '-b', 'cote', debut)
    d.git('mv', 'src/k1.ts', 'src/kk.ts')
    d.poser({ [PORTEUR]: sourceStock(SIX.map(ren)) }, 'main renomme k1 -> kk')
    d.git('checkout', '-q', 'chantier')
    d.fusionner('cote')
    const fin = d.poser({ [PORTEUR]: sourceStock([...SIX.map(ren), ent('src/kk.ts:5')]) }, 'fusion : entrée suivie en kk')
    return [debut, fin, () => []]
  },
  'N7 chantier retire k1, cote ajoute k1:7 déclaré, la fusion garde k1 et k1:7': (d) => {
    d.poser({ [PORTEUR]: sourceStock(SIX.slice(1)) }, 'chantier retire k1')
    d.git('checkout', '-q', '-b', 'cote', d.debut)
    d.poser({ [PORTEUR]: sourceStock([...SIX, ent('src/k1.ts:7')]) }, `cote +k1:7${cliquet(PORTEUR, 1)}`)
    d.git('checkout', '-q', 'chantier')
    d.fusionner('cote')
    const fin = d.poser({ [PORTEUR]: sourceStock([...SIX, ent('src/k1.ts:7')]) }, 'fusion : k1 ressuscité')
    return [d.debut, fin, () => [[fin, PORTEUR, 1]]]
  },
}

for (const [nom, construire] of Object.entries(CONSTRUITS)) {
  test(`#2223 CONSTRUIT ${nom}`, async () => {
    const d = depotConstruit({ 'src/a.ts': corpsDe('a') })
    try {
      const [debut, fin, attendu, vers] = construire(d)
      assert.deepEqual(await d.juger(debut, fin, vers), attendu())
    } finally {
      rmSync(d.repo, { recursive: true, force: true })
    }
  })
}

for (const muette of [false, true]) {
  test(`#2223 CONSTRUIT N6${muette ? 'b' : ''} : octopus résolu, trois parents et indisponibilité nommée`, async () => {
    const d = depotConstruit()
    try {
      for (const [branche, cle] of [['o1', 'src/o1.ts'], ['o2', 'src/o2.ts']]) {
        d.git('checkout', '-q', '-b', branche, d.debut)
        d.poser({ [PORTEUR]: sourceStock([...SIX, ent(cle)]) }, `${branche}${cliquet(PORTEUR, 1)}`)
      }
      d.git('checkout', '-q', 'chantier')
      d.poser(muette ? {} : { [PORTEUR]: sourceStock([ent('src/o0.ts'), ...SIX]) }, `o0${muette ? '' : cliquet(PORTEUR, 1)}`)
      assert.throws(() => d.git('merge', '-q', '--no-ff', '--no-verify', '--no-commit', 'o1', 'o2'))
      const entrees = muette ? [...SIX, ent('src/o1.ts'), ent('src/o2.ts'), ent('src/o9.ts')]
        : [ent('src/o0.ts'), ...SIX, ent('src/o1.ts'), ent('src/o2.ts')]
      const fin = d.poser({ [PORTEUR]: sourceStock(entrees) }, 'conclusion après échec octopus')
      const parents = d.git('show', '-s', '--format=%P', fin).trim().split(' ')
      assert.equal(parents.length, 3)
      const vu = await d.plage(fin)
      assert.match(vu.indisponible, /3 parents/)
      assert.deepEqual([vu.refus, vu.reclassements], [[], []])
    } finally {
      rmSync(d.repo, { recursive: true, force: true })
    }
  })
}
