// La porte de PUBLICATION des résolutions de fusion (#2328 A3, A4) : `fusionsNonJugees` et
// `verdictDePublication`, sur des dépôts forgés, et la gate `livraison:plage` qui les joue.
//   node --test scripts/guards/lib/livraison.test.mjs   (chaîné dans `npm run test:hooks`)
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { envDeDepotForge, instanceDeDepot } from './depotGabarit.mjs'
import { depotDe } from './gitPorte.mjs'
import { SUBSTANTIVE_MIN_LINES, apportDeLaResolution, fusionsNonJugees, verdictDePublication } from './livraison.mjs'

test('#2285 consommateurs livraison : diagnostic autonome et erreur programme par identité', () => {
  const sha = 'a'.repeat(40)
  const stderr = 'note livraison\n'.repeat(45) + 'cause livraison tardive\n'
  const stdout = 'stdout livraison distinct'
  assert.ok(stderr.indexOf('cause livraison tardive') > 400)
  assert.ok(stderr.endsWith('\n'))
  for (const version of ['git version 2.32.0', 'version illisible']) {
    const depot = depotDe('/fixture-consommateurs', { env: {}, spawn: (_bin, argv) => {
      if (argv.includes('merge-base')) return { status: 0, stdout: sha, stderr: '' }
      if (argv.includes('--format=%H%x1f%cd%x1f%B%x00'))
        return { status: 0, stdout: sha + '\x1f2026-10-05T00:00:00+00:00\x1fbase\0', stderr: '' }
      if (argv.includes('version')) return { status: 0, stdout: version, stderr: '' }
      return { status: 23, stdout, stderr }
    } })
    const vu = verdictDePublication(depot)
    assert.equal(vu.ok, false)
    assert.match(vu.texte, version.includes('2.32') ? /git 2\.32 ne sait pas/ : /version de git illisible/)
    assert.ok(vu.texte.includes(stderr), vu.texte)
    assert.ok(vu.texte.includes(stdout), vu.texte)
    assert.match(vu.texte, /refus \(status 23\)/)
  }
  const erreur = new TypeError('programme livraison')
  const depot = depotDe('/fixture-consommateurs', { env: {}, spawn: () => { throw erreur } })
  assert.throws(() => verdictDePublication(depot), (e) => e === erreur)
})
import { validateJugeFile, validateJugeVisionFile } from '../../hooks/solde-ticket-guard.mjs'
import { gitDe, resultatDeGit } from '../../test/gitDeBanc.mjs'

const GATE = fileURLToPath(new URL('../livraison-plage.mjs', import.meta.url))

/** `n` lignes de module numérotées. */
const lignes = (n, marque = 'l') => `${Array.from({ length: n }, (_, i) => `export const ${marque}${i} = ${i}`).join('\n')}\n`

/**
 * Un chantier qui a FUSIONNÉ main : `socle` sur `tronc`, `main` sur `amont`, `chantier` sur la branche
 * courante, puis `git merge --no-commit amont` dont la résolution écrit `resolution` et se commite.
 * Rend `{ racine, git, fusion, poser(fichiers, message), juger() }`.
 */
function chantierFusionne({ socle, main, chantier, resolution = {} }) {
  const { racine } = instanceDeDepot({ fichiers: socle, message: 'socle' })
  const git = gitDe(racine)
  const ecrire = (fichiers) => {
    for (const [chemin, texte] of Object.entries(fichiers)) {
      mkdirSync(join(racine, chemin, '..'), { recursive: true })
      writeFileSync(join(racine, chemin), texte)
    }
  }
  const poser = (fichiers, message) => {
    ecrire(fichiers)
    git('add', '-A'); git('commit', '-q', '--allow-empty', '-m', message)
    return git('rev-parse', 'HEAD').trim()
  }
  git('branch', 'tronc')
  git('checkout', '-q', '-b', 'amont'); poser(main, 'main')
  git('checkout', '-q', 'tronc'); git('checkout', '-q', '-b', 'chantier'); poser(chantier, 'chantier')
  resultatDeGit(['merge', '--no-commit', '--no-ff', 'amont'], { cwd: racine })
  ecrire(resolution)
  git('add', '-A'); git('commit', '-q', '-m', 'merge: intègre main')
  const fusion = git('rev-parse', 'HEAD').trim()
  const juger = () => fusionsNonJugees(depotDe(racine, { env: envDeDepotForge() }), { base: 'tronc' })
  return { racine, git, fusion, poser, juger }
}

/** Un conflit sur `chemin`, résolu en y ajoutant `n` lignes. */
const conflitResolu = (chemin, n) => ({
  socle: { [chemin]: lignes(3) },
  main: { [chemin]: lignes(3).replace('= 0', '= 200') },
  chantier: { [chemin]: lignes(3).replace('= 0', '= 100') },
  resolution: { [chemin]: `${lignes(3).replace('= 0', '= 300')}${n ? lignes(n, 'r') : ''}` },
})

const juge = (sha) => `JUGE: juge de diff sur la résolution de ${sha.slice(0, 9)}, verdict PUBLIABLE`
const refutation = (sha) => `REFUTATION: le juge a attaqué la résolution de ${sha.slice(0, 9)}, aucune faille`
const vision = (sha) => `JUGE-VISION: captures de l'écran que touche ${sha.slice(0, 9)} jugées conformes`

test('#2328 DoD 2 — une résolution de 15 lignes changées sous src/ sans juge est REFUSÉE en nommant son sha ; un commit postérieur qui la NOMME la fait passer', () => {
  const { racine, fusion, poser, juger } = chantierFusionne(conflitResolu('src/a.ts', 12))
  try {
    assert.deepEqual(juger().refus, [{ sha: fusion, lignesChangees: 15, manque: ['JUGE', 'REFUTATION'] }])
    const verdict = verdictDePublication(depotDe(racine, { env: envDeDepotForge() }), { base: 'tronc' })
    assert.equal(verdict.ok, false)
    assert.match(verdict.texte, new RegExp(`${fusion.slice(0, 9)} \\(15 lignes changées\\) : manque \`JUGE:\`, \`REFUTATION:\``))
    poser({}, `chore: refs #42 — juge\n\n${juge('0123456789')}\n${refutation('0123456789')}`)
    assert.equal(juger().refus.length, 1, 'test opposé : un juge qui ne NOMME pas la fusion ne la couvre pas')
    poser({}, `chore: refs #42 — juge\n\n${juge(fusion)}\n${refutation(fusion)}`)
    assert.deepEqual(juger().refus, [])
  } finally { rmSync(racine, { recursive: true, force: true }) }
})

test('#2328 — test opposé : une fusion PROPRE, ou une résolution d’UNE ligne arbitrée (#700), passe sans trailers', () => {
  const propre = chantierFusionne({ socle: { 'src/a.ts': lignes(3) }, main: { 'src/m.ts': lignes(40) }, chantier: { 'src/c.ts': lignes(40) } })
  const une = chantierFusionne(conflitResolu('src/a.ts', 0))
  try {
    assert.deepEqual(propre.juger().refus, [])
    assert.deepEqual(une.juger().refus, [])
  } finally {
    rmSync(propre.racine, { recursive: true, force: true })
    rmSync(une.racine, { recursive: true, force: true })
  }
})

test('#2328 — une résolution qui CHANGE un écran exige aussi `JUGE-VISION:`', () => {
  const { racine, fusion, poser, juger } = chantierFusionne(conflitResolu('src/ui/E.tsx', 12))
  try {
    poser({}, `chore: refs #42\n\n${juge(fusion)}\n${refutation(fusion)}`)
    assert.deepEqual(juger().refus.map((r) => r.manque), [['JUGE-VISION']])
    poser({}, `chore: refs #42\n\n${vision(fusion)}`)
    assert.deepEqual(juger().refus, [])
  } finally { rmSync(racine, { recursive: true, force: true }) }
})

test('#2328 — le solde `.claude/soldes/ref-<N>.md` d’un ticket que cite un commit postérieur nomme la fusion', () => {
  const { racine, fusion, poser, juger } = chantierFusionne(conflitResolu('src/a.ts', 12))
  try {
    const corps = (titre, texte) => `## ${titre}\n${texte}\n`
    poser({ '.claude/soldes/ref-42.md': `${corps('Juge', juge(fusion))}\n${corps('Réfutation', refutation(fusion))}` }, 'chore: refs #42 — solde')
    assert.deepEqual(juger().refus, [])
  } finally { rmSync(racine, { recursive: true, force: true }) }
})

test('#2328 — une fusion que git ne rejoue pas (octopus) : le verdict est un refus NOMMÉ', () => {
  const { racine } = instanceDeDepot({ fichiers: { 'src/a.ts': lignes(1) }, message: 'socle' })
  const git = gitDe(racine)
  try {
    git('branch', 'tronc')
    for (const b of ['un', 'deux']) {
      git('checkout', '-q', '-b', b, 'tronc'); writeFileSync(join(racine, `${b}.txt`), b); git('add', '-A'); git('commit', '-q', '-m', b)
    }
    git('checkout', '-q', '-b', 'chantier', 'tronc')
    git('merge', '-q', '--no-ff', '-m', 'octopus', 'un', 'deux')
    const verdict = verdictDePublication(depotDe(racine, { env: envDeDepotForge() }), { base: 'tronc' })
    assert.equal(verdict.ok, false)
    assert.match(verdict.texte, /^⛔ lecture git indisponible : mesure \(status \?\) — fusion [0-9a-f]{9} à 3 parents/)
  } finally { rmSync(racine, { recursive: true, force: true }) }
})

test('#2328 A4 — les lignes AJOUTÉES et SUPPRIMÉES sous src/ comptent, hors marqueurs de conflit ; un écran compte s’il en change', () => {
  const patch = (chemin, plus, moins, marqueurs = []) => [chemin, [`diff --git a/${chemin} b/${chemin}`, `--- a/${chemin}`, `+++ b/${chemin}`, '@@ -1 +1 @@', ...marqueurs, ...Array(moins).fill('---x'), ...Array(plus).fill('+++y')].join('\n')]
  assert.deepEqual(apportDeLaResolution(new Map([patch('src/a.ts', 2, 40), patch('README.md', 30, 0)])), { lignesChangees: 42, ecran: false })
  assert.deepEqual(apportDeLaResolution(new Map([patch('src/ui/E.tsx', 0, 9)])), { lignesChangees: 9, ecran: true })
  assert.deepEqual(apportDeLaResolution(new Map([patch('src/ui/E.tsx', 1, 0)])), { lignesChangees: 1, ecran: true })
  const marqueurs = ['-<<<<<<< 0123456789abcdef', '-||||||| 0123456789abcdef', '-=======', '->>>>>>> fedcba9876543210', '+<<<<<<<', '+=======']
  assert.deepEqual(apportDeLaResolution(new Map([patch('src/a.ts', 0, 0, marqueurs)])), { lignesChangees: 0, ecran: false })
  assert.deepEqual(apportDeLaResolution(new Map([patch('src/a.ts', 0, 0, ['-======== x', '-<<<<<<<< x'])])), { lignesChangees: 2, ecran: false }, 'test opposé : un contenu qui RESSEMBLE à un marqueur compte')
  assert.equal(SUBSTANTIVE_MIN_LINES, 10)
})

test('#2328 A4 — une résolution qui garde « ours » et SUPPRIME l’apport de main sous src/ est refusée sans juge, acceptée avec', () => {
  const avant = lignes(3)
  const { racine, fusion, poser, juger } = chantierFusionne({
    socle: { 'src/a.ts': avant },
    main: { 'src/a.ts': `${avant.replace('= 0', '= 200')}${lignes(200, 'm')}` },
    chantier: { 'src/a.ts': avant.replace('= 0', '= 100') },
    resolution: { 'src/a.ts': avant.replace('= 0', '= 100') },
  })
  try {
    assert.deepEqual(juger().refus, [{ sha: fusion, lignesChangees: 201, manque: ['JUGE', 'REFUTATION'] }])
    poser({}, `chore: refs #42 — juge\n\n${juge(fusion)}\n${refutation(fusion)}`)
    assert.deepEqual(juger().refus, [])
  } finally { rmSync(racine, { recursive: true, force: true }) }
})

test('#2328 — test opposé : un juge qui nomme la fusion sur une branche SŒUR, non descendante, ne la couvre pas', () => {
  const { racine, git, fusion, poser, juger } = chantierFusionne(conflitResolu('src/a.ts', 12))
  try {
    git('checkout', '-q', '-b', 'soeur', `${fusion}^1`)
    poser({}, `chore: refs #42 — juge\n\n${juge(fusion)}\n${refutation(fusion)}`)
    git('checkout', '-q', 'chantier'); git('merge', '-q', '--no-ff', '-m', 'merge: soeur', 'soeur')
    assert.deepEqual(juger().refus, [{ sha: fusion, lignesChangees: 15, manque: ['JUGE', 'REFUTATION'] }])
    poser({}, `chore: refs #42 — juge\n\n${juge(fusion)}\n${refutation(fusion)}`)
    assert.deepEqual(juger().refus, [], 'témoin : le même juge, DESCENDANT, la couvre')
  } finally { rmSync(racine, { recursive: true, force: true }) }
})

test('#2328 — une fusion de FUSION : main fusionné dans une branche intermédiaire, elle-même fusionnée dans le chantier, voit la résolution', () => {
  const { racine, git, fusion, poser, juger } = chantierFusionne(conflitResolu('src/a.ts', 12))
  try {
    git('checkout', '-q', '-b', 'final', `${fusion}^1`)
    poser({ 'src/c.ts': lignes(3, 'c') }, 'chantier: suite')
    git('merge', '-q', '--no-ff', '-m', 'merge: intermédiaire', 'chantier')
    assert.deepEqual(juger().refus, [{ sha: fusion, lignesChangees: 15, manque: ['JUGE', 'REFUTATION'] }])
    poser({}, `chore: refs #42 — juge\n\n${juge(fusion)}\n${refutation(fusion)}`)
    assert.deepEqual(juger().refus, [])
  } finally { rmSync(racine, { recursive: true, force: true }) }
})

test('gate `livraison:plage` : rend 1 et nomme la fusion non jugée, 0 quand elle est jugée ; chaque ligne nomme la BORNE, un refus local le geste de fraîcheur', () => {
  const { racine, git, fusion, poser } = chantierFusionne(conflitResolu('src/a.ts', 12))
  const jouer = (ci) => spawnSync(process.execPath, [GATE, '--base', 'tronc'], { cwd: racine, env: { ...envDeDepotForge(), CI: ci }, encoding: 'utf8', timeout: 60_000 })
  try {
    const [borne, date] = git('log', '-1', '--format=%H %cd', '--date=format:%Y-%m-%dT%H:%M:%S', 'tronc').trim().split(' ')
    const enClair = new RegExp(`tronc \\(base ${borne.slice(0, 9)} du ${date}[+-]\\d{2}:\\d{2}\\)\\.\\.HEAD`)
    const rouge = jouer('false')
    assert.equal(rouge.status, 1, rouge.stderr)
    assert.match(rouge.stderr, new RegExp(fusion.slice(0, 9)))
    assert.match(rouge.stderr, enClair, 'le refus nomme la borne de sa plage')
    assert.match(rouge.stderr, /Geste : `git fetch origin` si cette base est antérieure à la dernière publication/)
    assert.doesNotMatch(jouer('true').stderr, /git fetch origin/, 'en CI, la base vient d’être lue : aucun geste de fraîcheur')
    poser({}, `chore: refs #42\n\n${juge(fusion)}\n${refutation(fusion)}`)
    const vert = jouer('false')
    assert.equal(vert.status, 0, vert.stderr)
    assert.match(vert.stdout, enClair, 'la ligne de succès nomme la borne de sa plage')
  } finally { rmSync(racine, { recursive: true, force: true }) }
})

test('#2328 L1 — UNE grammaire de section : un même solde rend le même verdict au commit et à la publication', () => {
  const { racine, fusion, poser, juger } = chantierFusionne(conflitResolu('src/ui/E.tsx', 12))
  try {
    const section = (titre, ligne) => `## ${titre}\nverdict : PUBLIABLE\n\n${ligne}\n`
    const solde = [section('Juge', juge(fusion)), section('Réfutation', refutation(fusion)), section('Juge-Vision', vision(fusion))].join('\n')
    poser({ '.claude/soldes/ref-42.md': solde }, 'chore: refs #42 — solde en deux paragraphes')
    assert.deepEqual(juger().refus, [], 'publication : la section court jusqu’au titre suivant')
    assert.equal(validateJugeFile(solde).ok, true, 'commit : la même section, le même verdict')
    assert.equal(validateJugeVisionFile(solde).ok, true)
    const maigre = '## Juge\nverdict : PUBLIABLE\n'
    assert.match(validateJugeFile(maigre).problems.join(), /"## Juge" trop maigre/, 'témoin : une section maigre reste refusée au commit')
  } finally { rmSync(racine, { recursive: true, force: true }) }
})
