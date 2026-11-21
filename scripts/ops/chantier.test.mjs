// CLIQUET de l'ouverture de chantier (node --test) : les décisions sont PURES, et le geste réel se
// joue sur un dépôt JETABLE sous `os.tmpdir()` — avec un VRAI `origin` nu, parce que « le chantier
// part d'origin/main » est justement ce qu'un test à `HEAD` ne verrait pas tomber.
// `npm ci` n'est JAMAIS joué : l'appelant injecte un `npm` qui enregistre l'appel.
// Lancé par `npm run test:ops`.
import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { envDeDepotForge, instanceDeDepot } from '../guards/lib/depotGabarit.mjs'
import { ECRIT_LU } from '../gates/toutes.mjs'
import {
  ATTENTE_DU_CONSOMMATEUR_MS, EQUIPEMENTS, EQUIPEMENTS_DU_CONTENEUR, GESTES_DU_CHANTIER, argumentsDe, attendreLeConsommateur, creerChantier, equipementsDesPrerequis,
  main, nomValide, ouvrirChantier, refusDeCreation, relancerChantier, resumeDeChantier,
} from './chantier.mjs'
import { brancheDe, cibleDe } from './nomsDeChantier.mjs'
import { synchroniserPrincipal } from './synchroniser.mjs'
import { gitDe, lancerGit } from '../test/gitDeBanc.mjs'
import { sousEcheanceAsync } from '../test/verrou.mjs'
import { estPidVivantDepuis } from '../guards/lib/pid.mjs'
import { IDENTITE_MESUREE } from '../test/identiteMesuree.mjs'

/** L'environnement d'un poste (hors conteneur cloud) : le régime se pose, jamais hérité de la session. */
const POSTE = {}

/** Le script du consommateur du post-merge, celui de CET arbre : un principal jetable n'en porte pas. */
const SYNCHRONISEUR = join(import.meta.dirname, 'synchroniser.mjs')

test('un nom de chantier est un numéro de ticket, avec un slug optionnel en minuscules', () => {
  for (const bon of ['1736', '42', '1732-1734-outillage', '1736-publication', '12-a', '12-a1-b2']) {
    assert.equal(nomValide(bon), true, `« ${bon} » est une forme valide`)
  }
  for (const mauvais of ['', 'publication', '1736-', '-1736', '1736-Publication', '1736 publication',
    '1736/publication', '1736--a', '../evade', undefined, 42]) {
    assert.equal(nomValide(mauvais), false, `« ${mauvais} » n’est PAS une forme valide`)
  }
})

test('argumentsDe : un nom, avec --sans-ci avant ou après', () => {
  assert.deepEqual(argumentsDe(['1736']), { nom: '1736', sansCi: false })
  assert.deepEqual(argumentsDe(['1736', '--sans-ci']), { nom: '1736', sansCi: true })
  assert.deepEqual(argumentsDe(['--sans-ci', '1736']), { nom: '1736', sansCi: true })
  assert.equal(argumentsDe([]), null, 'sans nom, il n’y a rien à ouvrir')
  assert.equal(argumentsDe(['--sans-ci']), null)
})

test('CLI #4637 : aides et refus avant tout lancement de Git ou npm', () => {
  const chantier = join(import.meta.dirname, 'chantier.mjs')
  const sentinelle = `
    import enfant from 'node:child_process'
    import { writeSync } from 'node:fs'
    import { syncBuiltinESMExports } from 'node:module'
    for (const nom of ['spawn', 'spawnSync', 'exec', 'execSync', 'execFile', 'execFileSync', 'fork']) {
      enfant[nom] = (commande) => {
        writeSync(2, 'sous-processus inattendu : ' + commande + '\\n')
        process.exit(99)
      }
    }
    syncBuiltinESMExports()
  `
  const preload = 'data:text/javascript,' + encodeURIComponent(sentinelle)
  const usage = /^\[chantier\] usage : npm run ops:chantier -- <nom> \[--sans-ci\]$/m

  for (const argv of [['--help'], ['4629', '--help'], ['--help', '4629-aide-chantier', '--sans-ci']]) {
    const vu = spawnSync(process.execPath, ['--import', preload, chantier, ...argv], { encoding: 'utf8', timeout: 10_000 })
    assert.ifError(vu.error)
    assert.equal(vu.status, 0, `${argv.join(' ')} : ${vu.stderr}`)
    assert.equal(vu.stderr, '')
    assert.match(vu.stdout, usage)
  }

  for (const { argv, diagnostic } of [
    { argv: [], diagnostic: '' },
    { argv: ['--sans-ci'], diagnostic: '' },
    { argv: ['4629', '--argument-inconnu'], diagnostic: 'option inconnue : « --argument-inconnu »' },
    { argv: ['--help', '4629', '--argument-inconnu'], diagnostic: 'option inconnue : « --argument-inconnu »' },
    { argv: ['4629', 'second', '--help'], diagnostic: 'argument surnuméraire : « second »' },
    { argv: ['4629', 'second'], diagnostic: 'argument surnuméraire : « second »' },
    { argv: ['--sans-ci', '4629', '--sans-ci'], diagnostic: 'option surnuméraire : « --sans-ci »' },
    { argv: ['--help', '--help'], diagnostic: 'option surnuméraire : « --help »' },
    { argv: ['--help=false', '4629'], diagnostic: 'option inconnue : « --help=false »' },
    { argv: ['4629', '--'], diagnostic: 'option inconnue : « -- »' },
    { argv: ['-x', '4629'], diagnostic: 'option inconnue : « -x »' },
    { argv: ['4629-Aide'], diagnostic: 'nom de chantier invalide : « 4629-Aide »' },
  ]) {
    const vu = spawnSync(process.execPath, ['--import', preload, chantier, ...argv], { encoding: 'utf8', timeout: 10_000 })
    assert.ifError(vu.error)
    assert.equal(vu.status, 1, `${argv.join(' ')} : ${vu.stderr}`)
    assert.equal(vu.stdout, '')
    assert.ok(vu.stderr.includes(diagnostic), vu.stderr)
    assert.match(vu.stderr, usage)
  }
})

test('refusDeCreation dit DISTINCTEMENT la cible et la branche : ce ne sont pas les mêmes sorties', () => {
  const base = { nom: '42', cible: '/dep/.wt-42' }
  assert.equal(refusDeCreation({ ...base, cibleExiste: false, brancheExiste: false }), null)

  const surCible = refusDeCreation({ ...base, cibleExiste: true, brancheExiste: false })
  assert.match(surCible, /\/dep\/\.wt-42 existe déjà/)
  assert.doesNotMatch(surCible, /chantier\/42/, 'la branche n’est pas en cause : ne pas la nommer')

  const surBranche = refusDeCreation({ ...base, cibleExiste: false, brancheExiste: true })
  assert.match(surBranche, /la branche chantier\/42 existe déjà/)
  assert.match(surBranche, /git worktree add \/dep\/\.wt-42 chantier\/42/, 'le refus porte le geste de reprise')

  const lesDeux = refusDeCreation({ ...base, cibleExiste: true, brancheExiste: true })
  assert.match(lesDeux, /déjà ouvert/)
  assert.match(lesDeux, /\.wt-42/)
  assert.match(lesDeux, /chantier\/42/)
})

test('resumeDeChantier imprime les quatre faits, un par ligne', () => {
  const vu = resumeDeChantier({ cible: '/dep/.wt-42', branche: 'chantier/42', base: 'abc1234', port: 5200, url: 'http://localhost:5200/' })
  assert.deepEqual(vu.split('\n'), [
    'worktree=/dep/.wt-42',
    'branche=chantier/42',
    'base=abc1234',
    'port=5200 (http://localhost:5200/)',
  ])
})

test('nom invalide : refus NOMMÉ, et aucun git n’est joué', () => {
  let joue = 0
  const compte = () => { joue += 1 }
  const vu = creerChantier({ env: POSTE, racine: '/dep', nom: 'Publication', gestes: { arbrePrincipal: compte, shaDe: compte, fetchOrigin: compte, ajouterWorktree: compte } })
  assert.equal(vu.ok, false)
  assert.match(vu.refus, /nom de chantier invalide/)
  assert.match(vu.refus, /numéro de ticket/)
  assert.equal(joue, 0, 'un nom refusé ne déclenche aucune commande')
})

/** Dépôt jetable + son `origin` NU, avec `origin/main` réellement posé. */
function depotAvecOrigin(fichiers = { 'a.txt': 'a' }) {
  const nu = mkdtempSync(join(tmpdir(), 'origin-nu-'))
  lancerGit(['init', '--bare', '-q', '-b', 'main', nu])
  const { racine } = instanceDeDepot({ fichiers, message: 'fondation' })
  const git = gitDe(racine, { net: true })
  git('remote', 'add', 'origin', nu)
  git('push', '-q', 'origin', 'main')
  return { racine, nu, git, jeter: () => { for (const d of [racine, nu]) rmSync(d, { recursive: true, force: true }) } }
}

describe('#2187 matrice 18 : le principal synchronisé d’abord, relance sur `avance`', () => {
  const ARGS = { nom: '18', sansCi: true }
  const pas = (nom) => () => { throw new Error(`${nom} ne doit pas être appelé`) }

  test('relance RÉELLE : principal en retard → avance, une relance aux mêmes arguments, la seconde exécution mesure a-jour et crée', async () => {
    const { racine, nu, jeter } = depotAvecOrigin()
    const autre = mkdtempSync(join(tmpdir(), 'autre-clone-'))
    try {
      lancerGit(['clone', '-q', nu, autre])
      writeFileSync(join(autre, 'b.txt'), 'b')
      const gitAutre = gitDe(autre)
      gitAutre('add', 'b.txt'); gitAutre('-c', 'user.name=banc', '-c', 'user.email=banc@banc.invalid', 'commit', '-q', '-m', 'amont'); gitAutre('push', '-q', 'origin', 'main')
      const consommateurs = []
      const synchroniser = async () => {
        const vu = await synchroniserPrincipal({ depuis: racine, env: envDeDepotForge(), consommateur: SYNCHRONISEUR })
        consommateurs.push(vu.consommateurs)
        return vu
      }
      const attendreConsommateur = (c, o) => attendreLeConsommateur(c, { ...o, racine })
      const creer = (args) => creerChantier({ env: POSTE, racine, ...args })
      const relances = []
      const dits = []
      try {
        const code = await ouvrirChantier(ARGS, {
          synchroniser, attendreConsommateur, creer: pas('creer avant la relance'), dire: (t) => dits.push(t), imprimer: () => {},
          relancer: (args) => {
            relances.push(args)
            return ouvrirChantier(args, { synchroniser, attendreConsommateur, creer, relancer: pas('une seconde relance'), dire: (t) => dits.push(t), imprimer: () => {} })
          },
        })
        assert.deepEqual(relances, [ARGS])
        assert.equal(await code, 0, dits.join(''))
        assert.equal(existsSync(join(racine, 'b.txt')), true, 'le principal a avancé')
        assert.equal(existsSync(cibleDe(racine, '18')), true, 'la seconde exécution crée le chantier')
        assert.match(dits.join(''), /principal avancé .*relance `npm run ops:chantier -- 18 --sans-ci`/)
        assert.equal(consommateurs[0]?.etat, 'en-cours', 'le post-merge de l’avance court en fond')
      } finally {
        for (const { pid, depuis } of consommateurs.filter((c) => c?.pid)) {
          assert.equal(await sousEcheanceAsync({ attente: { echeanceMs: 60_000, pasMs: 50 }, essai: () => estPidVivantDepuis(pid, Date.parse(depuis), IDENTITE_MESUREE), abouti: (vit) => !vit }), false, `consommateur ${pid} vivant`)
        }
      }
    } finally {
      rmSync(autre, { recursive: true, force: true })
      jeter()
    }
  })

  test('#2493 post-merge du principal en fond : attendu AVANT la règle ; attente échue → annoncée, le chantier part d’origin/main', async () => {
    const enCours = { etat: 'en-cours', pid: 7, depuis: '2026-10-08T10:00:00.000Z', ageS: 1, de: 'a'.repeat(40), vers: 'b'.repeat(40), log: '/l/7.log' }
    const avance = { etat: 'avance', de: 'a'.repeat(40), vers: 'b'.repeat(40), configurationClientChangee: [], consommateurs: enCours }
    const attendus = []
    const relances = []
    const code = await ouvrirChantier(ARGS, {
      synchroniser: async () => avance, attendreConsommateur: (c) => { attendus.push(c); return true },
      relancer: (args) => { relances.push(args); return 0 }, creer: pas('creer'), dire: () => {}, imprimer: () => {},
    })
    assert.deepEqual([code, attendus, relances], [0, [enCours], [ARGS]])
    const dits = []
    const echu = await ouvrirChantier(ARGS, {
      synchroniser: async () => avance, attendreConsommateur: () => false, relancer: pas('relancer'),
      creer: () => ({ ok: true, resume: 'worktree=x' }), dire: (t) => dits.push(t), imprimer: () => {},
    })
    assert.equal(echu, 0)
    assert.equal(dits.join(''), `[chantier] post-merge aaaaaaaaa..bbbbbbbbb du principal toujours en cours après ${ATTENTE_DU_CONSOMMATEUR_MS / 60_000} min : le chantier part d’origin/main\n`)
  })

  test('refus nommé (divergent) : annoncé tel quel, le chantier se crée depuis origin, aucune relance', async () => {
    const dits = []
    const refus = { etat: 'divergent', de: 'a', vers: 'b', cerise: [] }
    const code = await ouvrirChantier(ARGS, {
      synchroniser: async () => refus, relancer: pas('relancer'), dire: (t) => dits.push(t), imprimer: () => {},
      creer: () => ({ ok: true, resume: 'worktree=x' }),
    })
    assert.equal(code, 0)
    assert.equal(dits.join(''), `[chantier] principal : ${JSON.stringify(refus)} ; le chantier part d’origin/main\n`)
  })

  test('exception de la synchronisation : dite à part, aucun état fabriqué ; le chantier se crée depuis origin (#2187 commentaire 6029118597, C5)', async () => {
    const dits = []
    const code = await ouvrirChantier(ARGS, {
      synchroniser: async () => { throw new Error('boum') }, relancer: pas('relancer'), dire: (t) => dits.push(t), imprimer: () => {},
      creer: () => ({ ok: true, resume: 'worktree=x' }),
    })
    assert.equal(code, 0)
    assert.equal(dits.join(''), '[chantier] synchronisation du principal en exception : boum ; le chantier part d’origin/main\n')
  })

  test('nom invalide : rien n’est synchronisé ; relance = `npm run ops:chantier -- <args>` depuis la racine, son code rendu', async () => {
    assert.equal(await ouvrirChantier({ nom: 'X', sansCi: false }, { synchroniser: pas('synchroniser'), dire: () => {} }), 1)
    const vus = []
    assert.equal(relancerChantier(ARGS, { cwd: '/r', npm: (...a) => { vus.push(a); return { status: 3 } } }), 3)
    assert.deepEqual(vus[0][1], ['run', 'ops:chantier', '--', '18', '--sans-ci'])
    assert.equal(vus[0][2].cwd, '/r')
    assert.equal(relancerChantier(ARGS, { npm: () => ({ status: 0, signal: 'SIGTERM' }) }), 1)
    assert.equal(relancerChantier(ARGS, { npm: () => ({ status: null, signal: null }) }), 1)
  })
})

test('progression avant fetch, création et chaque équipement ; durée après leurs retours', () => {
  const { racine, jeter } = depotAvecOrigin()
  const sorties = []
  try {
    const vu = creerChantier({ env: POSTE, racine, nom: '2329-banc', annoncer: (texte) => sorties.push(texte),
      npm: (_cmd, args) => {
        assert.match(sorties.at(-1), /début\n$/)
        assert.ok(sorties.at(-1).includes(args.includes('docs:build') ? 'npm run docs:build' : 'npm'))
        return { status: 0 }
      },
    })
    assert.equal(vu.ok, true, vu.refus)
    assert.match(sorties.join(''), /git fetch origin — début\n\[chantier\] git fetch origin — fin \(\d+ ms\)/)
    assert.match(sorties.join(''), /git worktree add — début/)
    assert.match(sorties.at(-1), /docs dérivés\) — fin \(\d+ ms\)/)
  } finally { jeter() }
})

test('création RÉELLE par la CLI depuis ORIGIN/main, avec et sans équipement, puis refus du second appel', async () => {
  const { racine, git, jeter } = depotAvecOrigin()
  try {
    // HEAD local DIVERGE d'origin/main (un commit non poussé) : un chantier parti de HEAD
    // emporterait ce commit, et le test ne le verrait pas si les deux shas étaient égaux.
    writeFileSync(join(racine, 'a.txt'), 'local non poussé')
    git('add', '-A'); git('commit', '-q', '-m', 'travail local non poussé')
    const teteLocale = git('rev-parse', 'HEAD')
    assert.notEqual(teteLocale, git('rev-parse', 'origin/main'))

    const gitLa = (cwd, ...args) => lancerGit(args, { cwd }).trim()
    for (const { nom, argv, sansCi } of [
      { nom: '42', argv: ['42', '--sans-ci'], sansCi: true },
      { nom: '43-aide', argv: ['--sans-ci', '43-aide'], sansCi: true },
      { nom: '44', argv: ['44'], sansCi: false },
    ]) {
      const appelsNpm = []
      const sorties = []
      const erreurs = []
      const code = await main(argv, {
        synchroniser: async () => ({ etat: 'a-jour' }),
        creer: (args) => creerChantier({
          ...args, env: POSTE, racine, annoncer: () => {},
          npm: (_cmd, argsNpm) => { appelsNpm.push(argsNpm); return { status: 0 } },
        }),
        dire: (texte) => erreurs.push(texte),
        imprimer: (texte) => sorties.push(texte),
      })
      assert.equal(code, 0, erreurs.join(''))
      if (sansCi) assert.deepEqual(appelsNpm, [])
      else assert.deepEqual(appelsNpm[0], ['ci', '--no-audit', '--no-fund'])
      const cible = cibleDe(racine, nom)
      const branche = brancheDe(nom)
      assert.equal(existsSync(cible), true, 'le worktree est posé sur le disque')
      assert.equal(gitLa(cible, 'rev-parse', '--abbrev-ref', 'HEAD'), branche)
      assert.equal(gitLa(cible, 'rev-parse', 'HEAD'), git('rev-parse', 'origin/main'))
      assert.notEqual(gitLa(cible, 'rev-parse', 'HEAD'), teteLocale)
      assert.match(sorties.join(''), new RegExp(`branche=${branche}`))
      assert.match(sorties.join(''), /^port=\d+ \(http:\/\/localhost:\d+\/\)$/m)
    }

    const second = creerChantier({ env: POSTE, racine, nom: '42', sansCi: true })
    assert.equal(second.ok, false)
    assert.match(second.refus, /déjà ouvert/, 'cible ET branche : le refus les nomme toutes les deux')
    assert.match(second.refus, /\.wt-42/)
  } finally { jeter() }
})

test('npm ci ROUGE : le worktree RESTE, et le refus dit quoi relancer où', () => {
  const { racine, jeter } = depotAvecOrigin()
  try {
    const appels = []
    const vu = creerChantier({ env: POSTE, racine, nom: '43', npm: (cmd, args, opts) => { appels.push({ cmd, args, cwd: opts.cwd }); return { status: 1 } } })
    assert.equal(vu.ok, false)
    assert.equal(appels.length, 1)
    assert.deepEqual(appels[0].args, ['ci', '--no-audit', '--no-fund'])
    assert.equal(appels[0].cwd, cibleDe(racine, '43'), 'npm ci se joue DANS le worktree neuf')
    assert.match(appels[0].cmd, /^npm(\.cmd)?$/)
    assert.equal(existsSync(cibleDe(racine, '43')), true, 'un npm ci rouge ne défait pas le worktree')
    assert.match(vu.refus, /worktree posé, npm ci rouge/)
    assert.doesNotMatch(vu.refus, /server/, 'la racine est en cause : ne pas nommer le sous-projet')
    assert.match(vu.refus, /\.wt-43/)
  } finally { jeter() }
})

// La table `EQUIPEMENTS` est DÉRIVÉE des `prerequis` d'`ECRIT_LU` : ce qu'une gate exige est posé
// par l'ouverture sans second geste.
describe('equipementsDesPrerequis', () => {
  // Fixture LOCALE au describe : deux gates portant le MÊME pose, plus un sous-projet de plus.
  const ECRIT_LU_FIXTURE = {
    'a:gate': { prerequis: [{ chemin: 'server/node_modules', pose: 'npm --prefix server ci' }] },
    'b:gate': { prerequis: [{ chemin: 'server/node_modules', pose: 'npm --prefix server ci' }] },
    'c:gate': { prerequis: [{ chemin: 'outil/node_modules', pose: 'npm --prefix outil ci' }] },
    'd:gate': { ecrit: [], lit: ['src/'] },
  }

  test('sur la table RÉELLE : la racine, puis le seul prérequis déclaré (server/), puis les docs dérivés', () => {
    assert.deepEqual(EQUIPEMENTS, [
      { args: ['ci', '--no-audit', '--no-fund'], ou: '', relance: 'npm ci', chemin: 'node_modules' },
      { args: ['--prefix', 'server', 'ci', '--no-audit', '--no-fund'], ou: ' dans server/', relance: 'npm --prefix server ci', chemin: 'server/node_modules' },
      { args: ['run', 'docs:build'], ou: ' (docs dérivés)', relance: 'npm run docs:build' },
    ])
  })

  test('en conteneur : les mêmes, plus `npm run gen` juste avant les docs dérivés', () => {
    assert.deepEqual(EQUIPEMENTS_DU_CONTENEUR.map((e) => e.relance), ['npm ci', 'npm --prefix server ci', 'npm run gen', 'npm run docs:build'])
  })

  test('un pose PARTAGÉ ne se pose qu’une fois ; un sous-projet de plus arrive en DERNIER', () => {
    const vu = [{ args: ['ci', '--no-audit', '--no-fund'], ou: '', relance: 'npm ci' }, ...equipementsDesPrerequis(ECRIT_LU_FIXTURE)]
    assert.equal(vu.length, 3)
    assert.deepEqual(vu.map((e) => e.relance), ['npm ci', 'npm --prefix server ci', 'npm --prefix outil ci'])
    assert.deepEqual(vu[2], { args: ['--prefix', 'outil', 'ci', '--no-audit', '--no-fund'], ou: ' dans outil/', relance: 'npm --prefix outil ci', chemin: 'outil/node_modules' })
  })

  test('un pose qui n’est pas du npm est REFUSÉ en nommant la gate et le pose', () => {
    assert.throws(
      () => equipementsDesPrerequis({ 'z:gate': { prerequis: [{ chemin: 'z/node_modules', pose: 'pnpm i' }] } }),
      (e) => /prérequis non posable/.test(e.message) && /z:gate/.test(e.message) && /pnpm i/.test(e.message),
    )
  })

  test('la table réelle ne déclare que des poses npm (aucun refus au chargement)', () => {
    assert.doesNotThrow(() => equipementsDesPrerequis(ECRIT_LU))
  })
})

// Le sous-projet `server/` a ses PROPRES dépendances, et `server:typecheck` les déclare en prérequis
// (`prerequis` d'`ECRIT_LU`, scripts/gates/toutes.mjs) : un chantier équipé de la seule racine rend
// cette gate ROUGE après la série entière (mesuré le 2026-09-14, 3ᵉ train réel). L'ordre est le
// sujet : `npm --prefix server ci` ne peut pas précéder le `npm ci` de la racine.
test('équipement : npm ci à la RACINE puis dans server/, puis docs:build, dans cet ordre, tous DANS le worktree', () => {
  const { racine, jeter } = depotAvecOrigin()
  try {
    const appels = []
    const vu = creerChantier({ env: POSTE, racine, nom: '47', npm: (cmd, args, opts) => { appels.push({ cmd, args, cwd: opts.cwd }); return { status: 0 } } })
    assert.equal(vu.ok, true, vu.refus)
    assert.equal(vu.npmJoue, true)
    assert.deepEqual(appels.map((a) => a.args), [
      ['ci', '--no-audit', '--no-fund'],
      ['--prefix', 'server', 'ci', '--no-audit', '--no-fund'],
      ['run', 'docs:build', '--', '--perimes'],
    ])
    assert.deepEqual([...new Set(appels.map((a) => a.cwd))], [cibleDe(racine, '47')],
      'tous se jouent DANS le worktree neuf (le sous-projet par --prefix, jamais par un cwd)')
  } finally { jeter() }
})

test('docs:build rouge : les npm ci restent faits, et le refus NOMME le geste qui le rejoue', () => {
  const { racine, jeter } = depotAvecOrigin()
  try {
    const vu = creerChantier({ env: POSTE, racine, nom: '49', npm: (cmd, args) => ({ status: args.includes('docs:build') ? 1 : 0 }) })
    assert.equal(vu.ok, false)
    assert.match(vu.refus, /worktree posé, npm run docs:build rouge \(docs dérivés\) — relancer `npm run docs:build`/)
    assert.equal(existsSync(cibleDe(racine, '49')), true, 'un docs:build rouge ne défait pas le worktree')
  } finally { jeter() }
})

test('npm ci rouge dans server/ : la racine reste faite, et le refus NOMME le sous-projet', () => {
  const { racine, jeter } = depotAvecOrigin()
  try {
    const appels = []
    const vu = creerChantier({
      env: POSTE,
      racine,
      nom: '48',
      npm: (cmd, args, opts) => { appels.push(args); return { status: args.includes('--prefix') ? 1 : 0, cwd: opts.cwd } },
    })
    assert.equal(vu.ok, false)
    assert.equal(appels.length, 2, 'la racine a été équipée avant que server/ ne tombe')
    assert.match(vu.refus, /npm ci rouge dans server\//)
    assert.match(vu.refus, /npm --prefix server ci/, 'le refus porte la commande qui rejoue CE ci')
    assert.match(vu.refus, /\.wt-48/)
    assert.equal(existsSync(cibleDe(racine, '48')), true, 'un npm ci rouge ne défait pas le worktree')
  } finally { jeter() }
})

// Une session travaille DANS son worktree : c'est de là qu'elle ouvre le chantier suivant. La cible
// ne se calcule donc pas sur le `racine` reçu mais sur l'ARBRE PRINCIPAL résolu par git — le worktree
// neuf se pose À CÔTÉ des autres, jamais SOUS celui d'où part l'appel.
test('lancé depuis un WORKTREE : la cible se pose sous l’ARBRE PRINCIPAL, à côté des autres', () => {
  const { racine, jeter } = depotAvecOrigin()
  try {
    assert.equal(creerChantier({ env: POSTE, racine, nom: '44', sansCi: true }).ok, true)
    const depuisLeWorktree = cibleDe(racine, '44')

    const vu = creerChantier({ env: POSTE, racine: depuisLeWorktree, nom: '45', sansCi: true })
    assert.equal(vu.ok, true, vu.refus)
    assert.equal(vu.cible, cibleDe(racine, '45'), 'la cible est calculée sur l’arbre principal, pas sur le cwd')
    assert.equal(existsSync(cibleDe(racine, '45')), true, 'le worktree neuf est posé là')
    assert.equal(existsSync(join(depuisLeWorktree, '.wt-45')), false, 'rien n’est posé SOUS le worktree appelant')
    const gitLa = (cwd, ...args) => lancerGit(args, { cwd })
    assert.equal(gitLa(cibleDe(racine, '45'), 'rev-parse', '--abbrev-ref', 'HEAD').trim(), 'chantier/45')
    // Et git le compte comme un arbre du MÊME dépôt, à plat : trois worktrees, aucun imbriqué.
    const listes = gitLa(racine, 'worktree', 'list', '--porcelain')
    const chemins = listes.split(/\r?\n/).filter((l) => l.startsWith('worktree ')).map((l) => l.slice('worktree '.length))
    assert.equal(chemins.length, 3, listes)
    assert.equal(chemins.filter((c) => c.replace(/\\/g, '/').includes('/.wt-44/')).length, 0, 'aucun arbre sous .wt-44')
  } finally { jeter() }
})

test('origin injoignable : refus qui NOMME la raison, et aucun worktree posé', () => {
  const { racine, jeter } = depotAvecOrigin()
  try {
    const vu = creerChantier({ env: POSTE, racine, nom: '46', sansCi: true, gestes: { ...GESTES_DU_CHANTIER, fetchOrigin: () => ({ disponible: false, raison: 'réseau coupé' }) } })
    assert.equal(vu.ok, false)
    assert.match(vu.refus, /réseau coupé/)
    assert.equal(existsSync(cibleDe(racine, '46')), false)
  } finally { jeter() }
})

test('docs ciblés : copie puis docs:build --perimes, ordre et cwd conservés', () => {
  const { racine, jeter } = depotAvecOrigin()
  try {
    const appels = []
    const scripts = ['scripts/docs/build-primitives.mjs', 'scripts/docs/build-doctrines.mjs']
    const vu = creerChantier({
      env: POSTE, racine, nom: '2456-selection',
      npm: (_cmd, args, opts) => { appels.push({ args, cwd: opts.cwd }); return { status: 0 } },
      copierDocs: () => ({ ok: true, copies: 30, scriptsARegenerer: scripts }),
    })
    assert.equal(vu.ok, true, vu.refus)
    assert.equal(appels.length, 3)
    assert.deepEqual(appels[2], { args: ['run', 'docs:build', '--', '--perimes'], cwd: cibleDe(racine, '2456-selection') })
  } finally { jeter() }
})

test('docs frais : copie équipée après npm ci, aucun npm docs:build ; repli rouge conserve son diagnostic', () => {
  for (const frais of [true, false]) {
    const { racine, jeter } = depotAvecOrigin()
    try {
      const appels = []
      const annonces = []
      let copieVue
      const vu = creerChantier({
        env: POSTE, racine, nom: '2456-banc', annoncer: (texte) => annonces.push(texte),
        npm: (_cmd, args) => {
          appels.push(args)
          return { status: args.includes('docs:build') ? 9 : 0 }
        },
        copierDocs: (params) => {
          assert.equal(appels.length, 2)
          copieVue = params
          return frais ? { ok: true, copies: 12 } : { ok: false, raison: 'docs absents' }
        },
      })
      assert.equal(copieVue.principal.replaceAll('\\', '/'), racine.replaceAll('\\', '/'))
      assert.equal(copieVue.cible, cibleDe(racine, '2456-banc'))
      assert.equal(typeof copieVue.ciblesPures, 'function')
      assert.equal(vu.ok, frais)
      assert.equal(appels.length, frais ? 2 : 3)
      if (frais) assert.match(annonces.join(''), /docs dérivés copiés : 12/)
      else {
        assert.match(annonces.join(''), /repli docs:build : docs absents/)
        assert.match(vu.refus, /docs:build rouge.*code 9/)
      }
    } finally { jeter() }
  }
})

// #4339 : en conteneur cloud (`CLAUDE_CODE_REMOTE=true`), le worktree se pose sans hooks et chaque
// `node_modules` RÉPERTOIRE du principal se lie en dur (`cp -al`) si les `package-lock.json` sont égaux.
describe('#4339 conteneur cloud', () => {
  const CONTENEUR = { CLAUDE_CODE_REMOTE: 'true' }
  const LOCK = '{"lockfileVersion":3}\n'

  /** Dépôt dont le principal porte un `node_modules` racine (pas de `server/node_modules`). */
  function depotEquipe() {
    const depot = depotAvecOrigin({ 'a.txt': 'a', 'package-lock.json': LOCK })
    mkdirSync(join(depot.racine, 'node_modules', 'paquet'), { recursive: true })
    writeFileSync(join(depot.racine, 'node_modules', 'paquet', 'index.js'), 'export {}\n')
    for (const cachee of ['.bin', '.cache']) {
      mkdirSync(join(depot.racine, 'node_modules', cachee))
      writeFileSync(join(depot.racine, 'node_modules', cachee, 'f'), cachee)
    }
    return depot
  }

  test('lock égal : worktree sans hooks, node_modules lié en dur, server/ par npm ci, puis gen et docs', () => {
    const { racine, jeter } = depotEquipe()
    try {
      const ajouts = []
      const appels = []
      const vu = creerChantier({
        env: CONTENEUR, racine, nom: '4339',
        gestes: { ...GESTES_DU_CHANTIER, ajouterWorktree: (d, p) => { ajouts.push(p); return GESTES_DU_CHANTIER.ajouterWorktree(d, p) } },
        npm: (_cmd, args, opts) => { appels.push({ args, cwd: opts.cwd }); return { status: 0 } },
      })
      assert.equal(vu.ok, true, vu.refus)
      assert.equal(ajouts[0].sansHooks, true, 'git worktree add sous core.hooksPath=/dev/null')
      const cible = cibleDe(racine, '4339')
      const fichier = (arbre) => statSync(join(arbre, 'node_modules', 'paquet', 'index.js'))
      assert.equal(fichier(cible).ino, fichier(racine).ino, 'le fichier de la cible est un lien EN DUR vers celui du principal')
      assert.deepEqual(readdirSync(join(cible, 'node_modules')).sort(), ['.bin', 'paquet'],
        'le cache d’outil (.cache) n’est pas lié : réécrit en place, il changerait aussi dans le principal')
      assert.deepEqual(appels.map((a) => a.args), [
        ['--prefix', 'server', 'ci', '--no-audit', '--no-fund'],
        ['run', 'gen'],
        ['run', 'docs:build', '--', '--perimes'],
      ])
      assert.deepEqual([...new Set(appels.map((a) => a.cwd))], [cible])
    } finally { jeter() }
  })

  test('lock différent : refus NOMMÉ, worktree laissé, ni lien ni npm', () => {
    const { racine, jeter } = depotEquipe()
    try {
      writeFileSync(join(racine, 'package-lock.json'), '{"lockfileVersion":3,"avance":true}\n')
      let joue = 0
      const vu = creerChantier({ env: CONTENEUR, racine, nom: '4340', lier: () => { joue += 1 }, npm: () => { joue += 1; return { status: 0 } } })
      assert.equal(vu.ok, false)
      assert.match(vu.refus, /worktree posé, node_modules non lié : package-lock\.json du principal diffère de celui de la cible/)
      assert.match(vu.refus, /relancer `npm ci`/)
      assert.equal(joue, 0)
      assert.equal(existsSync(cibleDe(racine, '4340')), true)
    } finally { jeter() }
  })
})
