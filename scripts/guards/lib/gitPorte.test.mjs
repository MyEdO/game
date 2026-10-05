// L'UNION À TROIS ISSUES, mesurée contre git RÉEL sur un dépôt jetable — jamais sur un double :
// c'est le CLASSEMENT des sorties de git qui doit être juste, et git seul dit ce qu'il écrit.
import { after, test } from 'node:test'
import { Buffer } from 'node:buffer'
import assert from 'node:assert/strict'
import { DEPOT } from './ticketsGh.mjs'
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, relative } from 'node:path'
import { STATUS_DLL_INIT_FAILED } from './spawnResilient.mjs'
import {
  BorneAbsente, ENV_GIT_FEINT, GitIndisponible, INDEX, MARQUE_FEINTE, OPTIONS_DE_L_HOTE, SUIVI, TRAVAIL, abandonnerFusion, ajouterOrigine, ajouterWorktree, approfondir, arbrePrincipal, arbreVide, attributDe,
  baseCommune, brancheDe, branchesDe, ceQuEmporteLIndex, ceQueFaitLaFusionEnCours, ceQueFaitLeCommit, ceQueFontLesCommits, ceQuiChange, cheminGit, cheminsEnConflit, classer, combienDe, commitDe, commitsNommes, conclureFusionSansChemins,
  depotDe, divergenceDe, dossierDesHooks, elaguerWorktrees, eolsDe, estIgnore, estSuperficiel, etatDeLArbre, enfantsDirects, estAncetre, estRepertoire,
  fetchOrigin, fichiersDuGrep, fusionDeTextes, fusionnesEnCours, grapheDe, initialiserDepot, journalDe, lireEnLot, listerImage, natureDuChemin, origineDe, parentsDe, patchsParChemin, poserRef, pousser,
  fusionner, racineDe, raisonCourte, rebaseEntame, reglerDepot, retirerWorktree, reussi, shaDe, shasDe, supprimerBranche, tenter, urlOrigineAcceptee, worktreesDe,
} from './gitPorte.mjs'
import { envDeDepotForge, envDeLUtilisatrice, instanceDeDepot, sousGitFeint } from './depotGabarit.mjs'
import { sourceGit } from './cssImages.mjs'
import { listerDossier, parUnitesDeCode } from './lister.mjs'
import { gitDe, lancerGit } from '../../test/gitDeBanc.mjs'
import { histoireDeHead, shasDeSubstance } from './revuePalier.mjs'

const ZERO = '0'.repeat(40)

/** Dépôt jetable de DEUX commits : le second AJOUTE `neuf.txt` — la pre-image de ce fichier est le
 *  cas normal de la porte de stock, et c'est un ABSENT, pas une panne. */
function depot() {
  const { racine, sha: premier } = instanceDeDepot({ fichiers: { 'a.txt': 'a\n' }, message: 'un' })
  const g = gitDe(racine)
  writeFileSync(join(racine, 'neuf.txt'), 'n\n')
  g('add', '-A'); g('commit', '-q', '-m', 'deux')
  return { racine, premier, second: g('rev-parse', 'HEAD').trim(), g }
}

const jeter = (racine) => rmSync(racine, { recursive: true, force: true })

/** Le dépôt forgé de `racine` (`envDeDepotForge`). */
const forge = (racine) => depotDe(racine, { env: envDeDepotForge() })

/** Un dépôt dont le lanceur est `repondre(args)` : les arguments de git SANS `OPTIONS_DE_L_HOTE`,
 *  la réponse en résultat de `spawnSync`. Aucun git n'est lancé. */
const depotFeint = (cwd, repondre, enPanne) => depotDe(cwd, { enPanne, spawn: (_git, args) => repondre(args.slice(OPTIONS_DE_L_HOTE.length)) })

/** Un git MUET : code 1, rien sur aucun flux. */
const muet = (cwd = tmpdir()) => depotFeint(cwd, () => ({ status: 1, stdout: '', stderr: '' }))

test('env fournisseur : une résolution par interrogation, objet partagé avec les rejeux et la feinte', () => {
  let resolutions = 0
  let fourni
  const vus = []
  const d = depotDe(tmpdir(), {
    env: () => {
      resolutions += 1
      fourni = { ...envDeDepotForge(), [ENV_GIT_FEINT]: JSON.stringify([{ si: ['--git-path', 'feint'], status: 0, stdout: 'feinte\n' }]) }
      return fourni
    },
    attendre: () => {},
    spawn: (_git, _args, options) => {
      vus.push(options.env)
      return vus.length < 3 ? { status: STATUS_DLL_INIT_FAILED, stdout: '', stderr: '' } : { status: 0, stdout: 'réel\n', stderr: '' }
    },
  })
  assert.equal(cheminGit(d, 'réel'), 'réel')
  assert.equal(resolutions, 1)
  assert.equal(vus.length, 3)
  assert.ok(vus.every((env) => env === fourni))
  const avant = fourni
  assert.equal(cheminGit(d, 'feint'), 'feinte')
  assert.equal(resolutions, 2)
  assert.notEqual(fourni, avant)
  assert.equal(vus.length, 3, 'la décision de feinte lit le fournisseur, sans spawn')
})

test('env fournisseur : absence, promesse et retour invalide sont nommés sans repli ni enPanne', () => {
  for (const retour of [undefined, null, 42, 'env', [], new Date(0), new Map(), { LANG: 1 }, Promise.resolve({}), { then: () => {} }]) {
    let resolutions = 0
    const pannes = []
    const d = depotDe(tmpdir(), {
      env: () => { resolutions += 1; return retour },
      spawn: () => assert.fail('aucun processus pour un fournisseur invalide'),
      enPanne: (raison) => pannes.push(raison),
    })
    assert.throws(() => cheminGit(d, 'x'), (e) => e instanceof TypeError && /gitPorte.*fournisseur.*env/i.test(e.message))
    assert.equal(resolutions, 1)
    assert.deepEqual(pannes, [])
  }
})

const reponseDeFusion = (args, version = 'git version 2.45.1\n') => ({
  status: 0,
  stdout: args.includes('version') ? version
    : args.includes('rev-list') ? 'abc aaaa p1 p2\n'
      : args.includes('hash-object') ? 'vide\n'
        : args.includes('merge-tree') ? '1\0bbbb\0\0' : '',
  stderr: '',
})

test('env fournisseur : versions ancienne/récente dans les deux ordres, même poignée et retour hors contexte', () => {
  for (const ordre of [['2.39', '2.45'], ['2.45', '2.39']]) {
    const d = depotDe(tmpdir(), { env: envDeDepotForge, spawn: (_git, args) => reponseDeFusion(args) })
    const lireFusion = () => ceQueFaitLeCommit(d, 'abc').chemins()
    assert.deepEqual(lireFusion(), [])
    for (const version of ordre) {
      sousGitFeint([{ si: ['version'], status: 0, stdout: `git version ${version}.0\n` }], () => {
        if (version === '2.39') assert.throws(lireFusion, (e) => e instanceof GitIndisponible && /git 2\.39 ne sait pas/.test(e.raison))
        else assert.deepEqual(lireFusion(), [])
      })
      assert.deepEqual(lireFusion(), [], 'hors contexte la version du lanceur fait de nouveau foi')
    }
  }
})

test('env objet ou défaut : version et arbre vide lus une fois par dépôt, environnement de lancement conservé', () => {
  for (const env of [undefined, envDeDepotForge()]) {
    let versions = 0
    let vides = 0
    const d = depotDe(tmpdir(), { env, spawn: (_git, args, options) => {
      assert.equal(options.env, env)
      if (args.includes('version')) versions += 1
      if (args.includes('hash-object')) vides += 1
      return reponseDeFusion(args)
    } })
    assert.deepEqual(ceQueFaitLeCommit(d, 'abc').chemins(), [])
    assert.deepEqual(ceQueFaitLeCommit(d, 'abc').chemins(), [])
    assert.equal(versions, 1)
    assert.equal(vides, 1)
  }
})

// Le SPAWN QUI N'A PAS DÉMARRÉ (#1729) : node écrit le même « spawnSync git ENOENT » quand le
// binaire manque et quand le `cwd` demandé n'existe pas. Le second est le cas RÉEL mesuré : une
// porte y renvoyait « rejouer depuis un arbre où git répond » alors que git répondait.
test('un dépôt dont le cwd est INEXISTANT se nomme, il ne se confond pas avec un git absent', () => {
  const jamais = join(tmpdir(), `cwd-absent-${process.pid}`)
  const vu = estAncetre(depotDe(jamais), 'HEAD', 'HEAD')
  assert.equal(vu.disponible, false)
  assert.equal(vu.raison, raisonCourte(`cwd inexistant : ${jamais}`))

  const sansGit = classer({ error: new Error('spawnSync git ENOENT') }, { cwd: tmpdir() })
  assert.match(sansGit.raison, /git introuvable/, 'cwd répertoire → la cause restante est le binaire')
})

test('un dépôt dont le cwd EXISTE sans être un répertoire se nomme pour ce qu’il est', () => {
  const { racine } = depot()
  try {
    const fichier = join(racine, 'a.txt')
    assert.equal(natureDuChemin(fichier), 'fichier')
    assert.equal(estRepertoire(fichier), false)
    assert.equal(estRepertoire(racine), true)
    // MÊME verdict sur les deux plateformes, où l'OS ne rend PAS le même code (ENOENT sur win32,
    // ENOTDIR sur POSIX — rouge de CI Linux mesuré sur le run 34815975288).
    const vu = estAncetre(depotDe(fichier), 'HEAD', 'HEAD')
    assert.equal(vu.disponible, false)
    assert.equal(vu.raison, raisonCourte(`cwd qui n'est pas un répertoire : ${fichier}`))
  } finally { jeter(racine) }
})

// Le CODE de l'erreur de spawn ne décide de rien : c'est la NATURE du cwd qui parle. Les trois
// natures sont jouées contre le MÊME couple de codes, sonde injectée (`nature`) donc sans disque.
test('classer : le verdict d’un spawn échoué ne dépend PAS du code (ENOENT win32 / ENOTDIR POSIX)', () => {
  const echec = (code) => ({ error: Object.assign(new Error(`spawnSync git ${code}`), { code }), status: null })
  const sonde = (quoi) => () => quoi
  for (const code of ['ENOENT', 'ENOTDIR']) {
    assert.equal(
      classer(echec(code), { cwd: '/x/a.txt', nature: sonde('fichier') }).raison,
      "cwd qui n'est pas un répertoire : /x/a.txt",
      `code ${code} : un cwd-FICHIER se nomme pour ce qu'il est`,
    )
    assert.equal(classer(echec(code), { cwd: '/x/jamais', nature: sonde('absent') }).raison, 'cwd inexistant : /x/jamais')
    assert.match(
      classer(echec(code), { cwd: '/x', nature: sonde('repertoire') }).raison,
      /git introuvable/,
      `code ${code} : cwd répertoire → il ne reste que le binaire`,
    )
  }
  // Une erreur de spawn qui se nomme elle-même garde SON message : « git introuvable » serait faux.
  const acces = classer({ error: new Error('spawnSync git EACCES'), status: null }, { cwd: '/x', nature: sonde('repertoire') })
  assert.equal(acces.raison, 'spawnSync git EACCES')
})

test('status 0 rend un FAIT porteur de la sortie', () => {
  const { racine, second } = depot()
  try {
    assert.equal(shaDe(forge(racine), 'HEAD'), second)
  } finally { jeter(racine) }
})

test('un PRÉDICAT qui rend 1 sans stderr est un FAIT porteur du code, jamais une panne', () => {
  const { racine, premier, second } = depot()
  try {
    const pannes = []
    const depotSonde = depotDe(racine, { env: envDeDepotForge(), enPanne: (r) => pannes.push(r) })
    assert.deepEqual(estAncetre(depotSonde, second, premier), { disponible: true, valeur: false })
    assert.equal(shaDe(depotSonde, 'origin/main'), null, '`rev-parse --verify --quiet` : code 1, aucune panne')
    assert.deepEqual(pannes, [])
  } finally { jeter(racine) }
})

test('les six ABSENCES de la porte sont des ABSENTS, jamais des pannes (dépôt réel)', () => {
  const { racine, second } = depot()
  try {
    const pannes = []
    const d = depotDe(racine, { env: envDeDepotForge(), enPanne: (r) => pannes.push(r) })
    const absents = {
      'pre-image d’un fichier AJOUTÉ': () => lireEnLot(d, `${second}^`, ['neuf.txt']).get('neuf.txt'),
      'post-image d’un fichier absent': () => lireEnLot(d, second, ['jamais.txt']).get('jamais.txt'),
      'origin/main inconnu': () => shaDe(d, 'origin/main'),
      'sha inconnu': () => journalDe(d, [`${ZERO}^!`]),
      'origine inconnue': () => origineDe(d),
    }
    for (const [nom, question] of Object.entries(absents)) {
      assert.equal(question(), null, `${nom} : le contrat des lecteurs d’image est \`null\``)
      assert.deepEqual(pannes, [], `${nom} : une absence n’est pas une panne`)
    }
    const absent = estAncetre(d, ZERO, 'HEAD')
    assert.equal(absent.disponible && absent.absent, true, 'l’union le dit ABSENT')
    assert.equal(absent.diagnostic.status, 128)
    assert.match(absent.diagnostic.stderr, /Not a valid commit name/i)
    assert.throws(() => ceQuiChange(d, ZERO, second), BorneAbsente, 'une BORNE inconnue n’est pas l’objet demandé : elle LÈVE')
    assert.deepEqual(pannes, [])
  } finally { jeter(racine) }
})

test('HORS dépôt, c’est INDISPONIBLE — et la raison le dit : l’union la porte, une question la JETTE', () => {
  const hors = mkdtempSync(join(tmpdir(), 'git-hors-'))
  try {
    const vu = estAncetre(forge(hors), 'HEAD', 'HEAD')
    assert.equal(vu.disponible, false)
    assert.match(vu.raison, /not a git repository/i)
    assert.throws(() => shaDe(forge(hors), 'HEAD'), (e) => e instanceof GitIndisponible && /not a git repository/i.test(e.raison))
    const pannes = []
    assert.equal(shaDe(depotDe(hors, { env: envDeDepotForge(), enPanne: (r) => pannes.push(r) }), 'HEAD'), null, 'sous `enPanne`, la question rend `null`')
    assert.match(pannes.join(''), /not a git repository/i, 'et confie la raison à `enPanne`')
    assert.equal(racineDe(forge(hors)), null, 'la racine d’un répertoire HORS arbre est `null`, pas une panne')
  } finally { jeter(hors) }
})

test('`racineDe` : `null` hors d’un arbre, une PANNE de git reste une panne (JETÉE, ou confiée à `enPanne`)', () => {
  const panne = () => ({ status: 128, stdout: '', stderr: 'fatal: panne simulée' })
  assert.throws(() => racineDe(depotDe(tmpdir(), { spawn: panne })), (e) => e instanceof GitIndisponible && /panne simulée/.test(e.raison))
  const pannes = []
  assert.equal(racineDe(depotDe(tmpdir(), { spawn: panne, enPanne: (r) => pannes.push(r) })), null)
  assert.match(pannes.join(''), /panne simulée/)
  const horsArbre = () => ({ status: 128, stdout: '', stderr: 'fatal: this operation must be run in a work tree' })
  assert.equal(racineDe(depotDe(tmpdir(), { spawn: horsArbre })), null, 'un dépôt NU n’a pas d’arbre')
})

test('un git ABSENT du système (ENOENT) est INDISPONIBLE, jamais un absent', () => {
  const vu = estAncetre(depotFeint(tmpdir(), () => ({ error: new Error('spawnSync git ENOENT'), status: null })), 'HEAD', 'HEAD')
  assert.equal(vu.disponible, false)
  assert.match(vu.raison, /ENOENT/)
})

test('un processus TUÉ par un signal est INDISPONIBLE', () => {
  const vu = estAncetre(depotFeint(tmpdir(), () => ({ status: null, signal: 'SIGKILL', stdout: '', stderr: '' })), 'HEAD', 'HEAD')
  assert.equal(vu.disponible, false)
  assert.match(vu.raison, /SIGKILL/)
})

test('le processus qui n’a pas DÉMARRÉ est REJOUÉ (spawnResilient), pas classé indisponible', () => {
  let essais = 0
  const attentes = []
  const d = depotDe(tmpdir(), {
    attendre: (ms) => attentes.push(ms),
    spawn: () => {
      essais += 1
      return essais < 3
        ? { status: STATUS_DLL_INIT_FAILED, stdout: '', stderr: '' }
        : { status: 0, stdout: 'abc1234\n', stderr: '' }
    },
  })
  assert.equal(shaDe(d, 'HEAD'), 'abc1234')
  assert.equal(essais, 3)
  assert.deepEqual(attentes, [2000, 5000])
})

test('estAncetre : vrai, faux, et un sha inconnu qui rend ABSENT', () => {
  const { racine, premier, second } = depot()
  try {
    assert.deepEqual(estAncetre(forge(racine), premier, second), { disponible: true, valeur: true })
    assert.deepEqual(estAncetre(forge(racine), second, premier), { disponible: true, valeur: false })
    const absent = estAncetre(forge(racine), ZERO, 'HEAD')
    assert.equal(absent.disponible && absent.absent, true)
    assert.equal(absent.diagnostic.status, 128)
  } finally { jeter(racine) }
})

test('fetchOrigin : une origine LOCALE réelle met `origin/main` à jour ; sans origine, INDISPONIBLE', () => {
  const amont = depot()
  const aval = mkdtempSync(join(tmpdir(), 'git-aval-'))
  try {
    lancerGit(['clone', '-q', '--no-local', amont.racine, aval])
    // La ref distante est SUPPRIMÉE localement : seul un fetch réel peut la remettre.
    lancerGit(['update-ref', '-d', 'refs/remotes/origin/main'], { cwd: aval })
    assert.equal(shaDe(forge(aval), 'origin/main'), null)
    const vu = fetchOrigin(forge(aval))
    assert.equal(vu.disponible, true, vu.raison)
    assert.equal(shaDe(forge(aval), 'origin/main'), amont.second)

    const sansOrigine = fetchOrigin(forge(amont.racine))
    assert.equal(sansOrigine.disponible, false)
  } finally {
    jeter(amont.racine)
    jeter(aval)
  }
})

// L'ARBRE PRINCIPAL : la résolution que trois outils re-posaient à la main. Les formes de réponse
// sont jouées avec un lanceur INJECTÉ (aucun sous-module à fabriquer sur le disque pour cela), puis le
// fait qui compte est mesuré contre git RÉEL : depuis un WORKTREE, la réponse est l'arbre principal.
test('arbrePrincipal : le PARENT du .git commun, séparateurs POSIX, casse CONSERVÉE', () => {
  const gitQuiRend = (cwd, stdout) => depotFeint(cwd, (args) => {
    assert.deepEqual(args, ['rev-parse', '--path-format=absolute', '--git-common-dir'])
    return { status: 0, stdout, stderr: '' }
  })
  assert.deepEqual(arbrePrincipal(gitQuiRend('/x/Game/.wt-42', '/x/Game/.git\n')),
    { disponible: true, valeur: '/x/Game' })
  // La casse rendue sert de `cwd` et de préfixe de cible : l'abaisser casserait un chemin
  // case-sensible (les fixtures `mkdtemp` de ce dépôt en portent, et `test:ops` tourne sur ubuntu).
  assert.deepEqual(arbrePrincipal(gitQuiRend('/tmp/depot-Ab9Z/.wt-42', '/tmp/depot-Ab9Z/.git')),
    { disponible: true, valeur: '/tmp/depot-Ab9Z' })
  assert.deepEqual(arbrePrincipal(gitQuiRend('\\x\\Game', '\\x\\Game\\.git\n')),
    { disponible: true, valeur: '/x/Game' })
})

test('arbrePrincipal : deux refus NOMMÉS, jamais un repli sur le cwd', () => {
  const gitQuiRend = (cwd, stdout) => depotFeint(cwd, () => ({ status: 0, stdout, stderr: '' }))

  // Git MUET : la seule forme que le premier refus garde, et elle s'injecte (git ne la produit pas).
  for (const vide of ['', '   ']) {
    const vu = arbrePrincipal(gitQuiRend('/x/nu.git', vide))
    assert.equal(vu.disponible, false, `« ${JSON.stringify(vide)} » : rien ne se déduit d'une réponse vide`)
    assert.match(vu.raison, /rend une réponse vide/)
    assert.equal(vu.valeur, undefined, 'aucune valeur : surtout pas le cwd')
  }

  // Le DÉPÔT NU est mesuré contre git RÉEL : sous `--path-format=absolute` il rend son chemin ABSOLU
  // (`…/depot.git`), jamais `.` — c'est le second refus qui le NOMME.
  const base = mkdtempSync(join(tmpdir(), 'nu-'))
  const nu = join(base, 'depot.git')
  try {
    lancerGit(['init', '-q', '--bare', nu])
    const vuNu = arbrePrincipal(forge(nu))
    assert.equal(vuNu.disponible, false, "un dépôt nu n'a pas d'arbre principal")
    assert.match(vuNu.raison, /hors d'un arbre/)
    assert.match(vuNu.raison, /dépôt nu/, 'le refus NOMME le dépôt nu')
    assert.equal(vuNu.valeur, undefined, 'aucune valeur : surtout pas le cwd')
  } finally { jeter(base) }

  const sousModule = arbrePrincipal(gitQuiRend('/x/Game/sub', '/x/Game/.git/modules/sub\n'))
  assert.equal(sousModule.disponible, false)
  assert.match(sousModule.raison, /hors d'un arbre/)
  assert.match(sousModule.raison, /sous-module ou --separate-git-dir/)
  assert.match(sousModule.raison, /modules\/sub/, 'le refus porte ce que git a rendu')

  const jamais = join(tmpdir(), `arbre-absent-${process.pid}`)
  const enPanne = arbrePrincipal(depotFeint(jamais, () => ({ error: new Error('spawnSync git ENOENT'), status: null })))
  assert.equal(enPanne.disponible, false)
  assert.match(enPanne.raison, /cwd inexistant : /)
  const court = `/inexistant-${process.pid}`
  const nommeParLeMotif = arbrePrincipal(depotFeint(court, () => ({ error: new Error('spawnSync git ENOENT'), status: null })))
  assert.equal(nommeParLeMotif.raison.split(court).length - 1, 1, `le cwd se nomme une fois : ${nommeParLeMotif.raison}`)

  const horsDepot = arbrePrincipal(depotFeint('/x', () => ({ status: 128, stdout: '', stderr: 'fatal: bad revision' })))
  assert.equal(horsDepot.disponible, false)
  assert.match(horsDepot.raison, /git n'y connaît pas de dépôt/)

  const code = arbrePrincipal(depotFeint('/x', () => ({ status: 128, stdout: '', stderr: '' })))
  assert.equal(code.disponible, false)
  assert.match(code.raison, /rend 128/)
})

for (const [nom, reponse, issue, motif] of [
  ['objet absent', { status: 128, stdout: `${'note stdout\n'.repeat(50)}cause stdout tardive`, stderr: `${'note stderr\n'.repeat(50)}fatal: bad revision — cause stderr tardive` }, 'refus', "git n'y connaît pas de dépôt"],
  ['code nonzero et stderr vide', { status: 17, stdout: `${'note stdout\n'.repeat(50)}cause stdout tardive`, stderr: '' }, 'refus', 'rend 17'],
  ['lancement', { status: null, stdout: 'flux de lancement', stderr: 'cause de lancement', error: new Error('spawnSync git ENOENT') }, 'lancement', 'git introuvable'],
  ['interruption', { status: null, stdout: 'flux interrompu', stderr: 'cause interruption', signal: 'SIGTERM' }, 'interruption', 'SIGTERM'],
]) test(`arbrePrincipal : diagnostic complet — ${nom}`, () => {
  const vu = arbrePrincipal(depotFeint(tmpdir(), () => reponse))
  assert.equal(vu.disponible, false)
  assert.equal(vu.issue, issue)
  assert.ok(vu.raison.startsWith('arbre principal non résolu :'))
  assert.ok(vu.raison.includes(motif))
  assert.equal(vu.diagnostic.status, reponse.status)
  for (const flux of ['stdout', 'stderr']) {
    assert.equal(vu.diagnostic[flux], reponse[flux])
    if (reponse[flux]) assert.ok(vu.raison.includes(reponse[flux]), `${flux} intégral dans le refus`)
  }
  if (reponse.error) assert.equal(vu.diagnostic.error, reponse.error)
  if (reponse.signal) assert.equal(vu.diagnostic.signal, reponse.signal)
})

test('arbrePrincipal : refus structurel sans fait de processus inventé', () => {
  for (const reponse of [undefined, { status: 0, stdout: '', stderr: '' }, { status: 0, stdout: '/depot.git', stderr: '' }]) {
    const vu = arbrePrincipal(depotFeint(tmpdir(), () => reponse))
    assert.equal(vu.disponible, false)
    assert.equal(vu.issue, 'mesure')
    assert.equal(Object.hasOwn(vu, 'diagnostic'), false)
  }
})

test('arbrePrincipal : sous un cwd de plus de 200 caractères, le refus garde son MOTIF (git réel)', () => {
  const base = mkdtempSync(join(tmpdir(), 'profond-'))
  // 210 : au-delà de RAISON_MAX (gitPorte.mjs), en deçà de MAX_PATH (win32) avec les fichiers d'un `git init --bare`.
  const profond = join(base, 'a'.repeat(209 - join(base, 'depot.git').length))
  const nu = join(profond, 'depot.git')
  try {
    mkdirSync(profond, { recursive: true })
    lancerGit(['init', '-q', '--bare', nu])
    assert.equal(nu.length, 210, `cwd de ${nu.length} caractères`)
    const vuNu = arbrePrincipal(forge(nu))
    assert.equal(vuNu.disponible, false)
    assert.match(vuNu.raison, /^arbre principal non résolu : répertoire git hors d'un arbre — dépôt nu/)

    const vide = arbrePrincipal(depotFeint(nu, () => ({ status: 0, stdout: '', stderr: '' })))
    assert.match(vide.raison, /^arbre principal non résolu : git rev-parse --git-common-dir rend une réponse vide/)

    const jamais = join(profond, 'absent')
    const enPanne = arbrePrincipal(depotFeint(jamais, () => ({ error: new Error('spawnSync git ENOENT'), status: null })))
    assert.match(enPanne.raison, /^arbre principal non résolu : cwd inexistant :/)
  } finally { jeter(base) }
})

test('arbrePrincipal : depuis un WORKTREE RÉEL, la réponse est l’arbre PRINCIPAL (git réel)', () => {
  const { racine, g } = depot()
  const lie = join(racine, '.wt-sonde')
  try {
    g('worktree', 'add', '-q', '-b', 'sonde', lie)
    const depuisLie = arbrePrincipal(forge(lie))
    const depuisPrincipal = arbrePrincipal(forge(racine))
    assert.equal(depuisLie.disponible, true, depuisLie.raison)
    assert.equal(depuisLie.valeur, depuisPrincipal.valeur, 'le worktree et le principal répondent le MÊME arbre')
    assert.equal(depuisLie.valeur.toLowerCase(), racine.replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase())
    assert.equal(natureDuChemin(depuisLie.valeur), 'repertoire', 'la valeur est utilisable comme cwd')
  } finally { jeter(racine) }
})

test('#2285 classer : diagnostic multiligne intégral et flux distincts', () => {
  const ligne = `fatal: ${'mot '.repeat(100).trimEnd()}`
  const stderr = `\n\n${ligne}\nune seconde ligne\ncause concrète au-delà de quatre cents caractères`
  const stdout = 'note sur stdout\nune autre note'
  const vu = classer({ status: 128, stdout, stderr })
  assert.equal(vu.disponible, false)
  assert.equal(vu.raison, stderr)
  assert.equal(vu.issue, 'refus')
  assert.deepEqual(vu.diagnostic, { status: 128, stdout, stderr })
  assert.equal(reussi(vu), false)
})

test('#2285 lecture : exception et callback portent le même diagnostic complet', () => {
  const resultat = { status: 128, stdout: 'notes stdout', stderr: `${'note\n'.repeat(110)}cause de refus` }
  let diagnostic
  assert.throws(() => racineDe(depotDe(tmpdir(), { spawn: () => resultat })), (e) => {
    diagnostic = e.diagnostic
    return e instanceof GitIndisponible && e.issue === 'refus' && e.raison === resultat.stderr
  })
  assert.deepEqual(diagnostic, resultat)
  const pannes = []
  assert.equal(racineDe(depotDe(tmpdir(), { spawn: () => resultat, enPanne: (raison, vu) => pannes.push({ raison, vu }) })), null)
  assert.equal(pannes.length, 1)
  assert.equal(pannes[0].raison, resultat.stderr)
  assert.deepEqual(pannes[0].vu.diagnostic, diagnostic)
})

test('#2285 classer : lancement, interruption, mesure et absence conservent leur distinction', () => {
  const error = Object.assign(new Error('spawnSync git ENOENT'), { code: 'ENOENT' })
  const lancement = classer({ status: null, error, stdout: 'avant', stderr: 'détail' }, { cwd: tmpdir() })
  assert.equal(lancement.issue, 'lancement')
  assert.equal(lancement.diagnostic.error, error)
  assert.equal(lancement.diagnostic.stdout, 'avant')
  const interruption = classer({ status: null, signal: 'SIGTERM', stdout: 'sortie', stderr: 'erreur' })
  assert.equal(interruption.issue, 'interruption')
  assert.equal(interruption.diagnostic.signal, 'SIGTERM')
  assert.equal(classer(null).issue, 'mesure')
  const absence = classer({ status: 128, stdout: 'note', stderr: 'fatal: bad object abc' })
  assert.equal(absence.absent, true)
  assert.deepEqual(absence.diagnostic, { status: 128, stdout: 'note', stderr: 'fatal: bad object abc' })
  assert.deepEqual(classer({ status: 1, stdout: '', stderr: '' }), { disponible: true, valeur: { status: 1, stdout: '', stderr: '' } })
  assert.deepEqual(classer({ status: 0, stdout: 'ok', stderr: 'warning' }), { disponible: true, valeur: { status: 0, stdout: 'ok', stderr: 'warning' } })
})

test('raisonCourte : présentation explicitement abrégée', () => {
  assert.equal(raisonCourte('   \n  premier mot  \nsuite'), 'premier mot')
  const tient = `${'mot '.repeat(49)}motx`
  assert.equal(tient.length, 200)
  assert.equal(raisonCourte(tient), tient, 'une raison de 200 caractères se rend entière')
})

test('#2285 mesure : tenter conserve les sorties complètes et les détails réellement connus', () => {
  const stdout = `${'note stdout\n'.repeat(420)}cause stdout tardive\n`
  const stderr = `${'note stderr\n'.repeat(420)}cause stderr tardive\n`
  const erreur = Object.assign(new Error('mesure levée'), { stdout: Buffer.from(stdout), stderr, status: 13 })
  const vu = tenter(() => { throw erreur })
  assert.equal(vu.disponible, false)
  assert.equal(vu.issue, 'mesure')
  assert.equal(vu.raison, `mesure levée — ${stdout}\n${stderr}`)
  assert.deepEqual(vu.diagnostic, { status: 13, stdout, stderr, error: erreur })
  assert.deepEqual(tenter(() => 'mesuré'), { disponible: true, valeur: 'mesuré' })
  assert.deepEqual(tenter(() => null), { disponible: true, valeur: null })
})

for (const issue of ['refus', 'lancement', 'interruption']) test(`#2285 intégration tenter : GitIndisponible structurée — ${issue}`, () => {
  const diagnostic = { status: issue === 'refus' ? 17 : null, stdout: `${'note stdout\n'.repeat(50)}cause stdout tardive\n`, stderr: `${'note stderr\n'.repeat(50)}cause stderr tardive\n`, ...(issue === 'interruption' ? { signal: 'SIGTERM' } : {}) }
  const erreur = new GitIndisponible({ disponible: false, raison: 'lecture refusée', issue, diagnostic })
  const vu = tenter(() => { throw erreur })
  assert.equal(vu.disponible, false)
  assert.equal(vu.issue, issue)
  assert.equal(vu.diagnostic, diagnostic)
  assert.ok(vu.raison.includes(diagnostic.stdout))
  assert.ok(vu.raison.includes(diagnostic.stderr))
})

test('#2285 intégration tenter : consommation réelle shasDeSubstance', () => {
  const stderr = `${'note stderr\n'.repeat(50)}fatal: cause tardive\n`
  const stdout = 'flux distinct complet\n'
  const d = depotFeint(tmpdir(), () => ({ status: 17, stdout, stderr }))
  const vu = tenter(() => shasDeSubstance(d, ['HEAD']))
  assert.equal(vu.disponible, false)
  assert.equal(vu.issue, 'refus')
  assert.equal(vu.diagnostic.status, 17)
  assert.equal(vu.diagnostic.stdout, stdout)
  assert.equal(vu.diagnostic.stderr, stderr)
  assert.ok(vu.raison.includes(stdout))
  assert.ok(vu.raison.includes(stderr))
})

test('#2285 intégration tenter : erreur système sans processus inventé', () => {
  const erreur = Object.assign(new Error('lecture système refusée'), { errno: -13, syscall: 'read', code: 'EACCES' })
  const vu = tenter(() => { throw erreur })
  assert.equal(vu.disponible, false)
  assert.equal(vu.issue, 'mesure')
  assert.equal(vu.raison, erreur.message)
  assert.equal(Object.hasOwn(vu, 'diagnostic'), false)
})

test('#2285 intégration tenter : erreur de programme remontée par identité', () => {
  for (const erreur of [new TypeError('programme'), Object.assign(new Error('interne'), { code: 'ERR_INTERNE' })]) {
    assert.throws(() => tenter(() => { throw erreur }), (e) => e === erreur)
  }
})

for (const [lecteur, commande, jouer] of [
  ['commits', 'diff-tree', (d) => ceQueFontLesCommits(d, [{ sha: 'a'.repeat(40), arbre: 'b'.repeat(40), parents: [] }]).chemins()],
  ['fusion en cours', 'merge-tree', (d) => ceQueFaitLaFusionEnCours(d, ['a'.repeat(40), 'b'.repeat(40)], INDEX)],
]) for (const [nom, reponse, issue] of [
  ['absence', { status: 128, stdout: `${'note stdout\n'.repeat(50)}cause stdout tardive\n`, stderr: `${'note stderr\n'.repeat(50)}fatal: bad object — cause tardive\n` }, 'mesure'],
  ['nonzero', { status: 17, stdout: `${'note stdout\n'.repeat(50)}cause stdout tardive\n`, stderr: '' }, 'refus'],
  ['panne', { status: 17, stdout: `${'note stdout\n'.repeat(50)}cause stdout tardive\n`, stderr: `${'note stderr\n'.repeat(50)}fatal: cause tardive\n` }, 'refus'],
  ['interruption', { status: null, stdout: 'avant interruption\n', stderr: 'cause interruption\n', signal: 'SIGTERM' }, 'interruption'],
]) test(`#2285 intégration lot : ${lecteur} — ${nom}`, () => {
  const pannes = []
  const d = depotFeint(tmpdir(), (args) => args.includes(commande) ? reponse : { status: 0, stdout: args.includes('version') ? 'git version 2.45.1\n' : args.includes('hash-object') ? `${ZERO}\n` : '', stderr: '' }, (r) => pannes.push(r))
  assert.throws(() => jouer(d), (e) => {
    assert.ok(e instanceof GitIndisponible)
    assert.equal(e.issue, issue)
    assert.ok(e.raison.includes('illisible'))
    assert.equal(e.diagnostic.status, reponse.status)
    for (const flux of ['stdout', 'stderr']) {
      assert.equal(e.diagnostic[flux], reponse[flux])
      if (reponse[flux]) assert.ok(e.raison.includes(reponse[flux]))
    }
    if (reponse.signal) assert.equal(e.diagnostic.signal, reponse.signal)
    return true
  })
  assert.deepEqual(pannes, [], 'un lot lève même avec enPanne')
})

test('#2285 intégration lot : succès et conflit amont gardent leur arbre', () => {
  for (const propre of ['0', '1']) {
    const d = depotFeint(tmpdir(), (args) => ({ status: 0, stdout: args.includes('version') ? 'git version 2.45.1\n' : args.includes('hash-object') ? `${ZERO}\n` : args.includes('merge-tree') ? `${propre}\0${'b'.repeat(40)}\0\0` : '', stderr: '' }))
    const change = ceQueFaitLaFusionEnCours(d, ['a'.repeat(40), 'c'.repeat(40)], INDEX)
    assert.equal(change.base, 'b'.repeat(40))
    assert.deepEqual(change.chemins(), [])
    assert.deepEqual([...ceQueFontLesCommits(d, []).chemins()], [])
  }
})

test('#2285 mesure fs : lecteur réel, exception et callback, sans processus inventé', () => {
  const cwd = mkdtempSync(join(tmpdir(), 'mesure-fs-2285-'))
  try {
    const chemin = join(cwd, 'MERGE_HEAD')
    mkdirSync(chemin)
    let erreur
    try { readFileSync(chemin, 'utf8') } catch (e) { erreur = e }
    assert.ok(erreur instanceof Error)
    const commandes = []
    const repondre = (args) => {
      commandes.push(args)
      assert.deepEqual(args, ['rev-parse', '--git-path', 'MERGE_HEAD'])
      return { status: 0, stdout: 'MERGE_HEAD\n', stderr: '' }
    }
    const raison = `MERGE_HEAD illisible : ${erreur.message}`
    assert.throws(() => fusionnesEnCours(depotFeint(cwd, repondre)), (e) =>
      e instanceof GitIndisponible && e.issue === 'mesure' && e.raison === raison && e.diagnostic === undefined)
    const pannes = []
    const d = depotFeint(cwd, repondre, (message, vu) => pannes.push({ message, vu }))
    assert.deepEqual(fusionnesEnCours(d), [])
    assert.equal(pannes.length, 1)
    assert.equal(pannes[0].message, raison)
    assert.equal(pannes[0].vu.issue, 'mesure')
    assert.equal(pannes[0].vu.diagnostic, undefined)
    assert.equal(commandes.length, 2)
    assert.equal(tenter(() => natureDuChemin(join(cwd, 'absent'))).valeur, 'absent')
  } finally { jeter(cwd) }
})

test('listerImage : l’unique listeur d’image — ref, INDEX, SUIVI et TRAVAIL rendent chacun LEURS fichiers ; enfantsDirects en projette les noms', () => {
  const { racine } = instanceDeDepot({ fichiers: { 'd/a.txt': 'a\n', 'd/s/b.txt': 'b\n', 'x.txt': 'x\n' }, message: 'socle' })
  const d = forge(racine)
  try {
    lancerGit(['rm', '-q', '--cached', 'd/a.txt'], { cwd: racine })
    writeFileSync(join(racine, 'd/neuf.txt'), 'n\n')
    assert.deepEqual(listerImage(d, 'HEAD', 'd'), ['d/a.txt', 'd/s/b.txt'])
    assert.deepEqual(listerImage(d, INDEX, 'd'), ['d/s/b.txt'], 'retiré de l’index : hors de ce que le commit emporte')
    assert.deepEqual(listerImage(d, SUIVI, 'd'), ['d/s/b.txt'], 'les chemins suivis : ni le retiré ni le non-suivi')
    assert.deepEqual(listerImage(d, TRAVAIL, 'd').sort(), ['d/a.txt', 'd/neuf.txt', 'd/s/b.txt'], 'l’arbre de travail : non suivis compris')
    assert.deepEqual(enfantsDirects(listerImage(d, 'HEAD', 'd'), 'd'), ['a.txt', 's'])
    assert.deepEqual(listerImage(muet(), 'HEAD', 'd'), [], 'git muet : []')
    assert.deepEqual(listerImage(d, 'HEAD', 'd', 'x.txt'), ['d/a.txt', 'd/s/b.txt', 'x.txt'], 'plusieurs dossiers')
    assert.deepEqual(listerImage(d, 'HEAD'), ['d/a.txt', 'd/s/b.txt', 'x.txt'], 'sans dossier : tout l’arbre')
  } finally {
    rmSync(racine, { recursive: true, force: true })
  }
})

test('listerImage : un suivi SUPPRIMÉ du disque sort de SUIVI et de TRAVAIL (`git commit -a` le supprime), pas de l’INDEX', () => {
  const { racine } = instanceDeDepot({ fichiers: { 'd/a.txt': 'a\n', 'd/Console.tsx': 'c\n' }, message: 'socle' })
  const d = forge(racine)
  try {
    rmSync(join(racine, 'd/Console.tsx'))
    assert.deepEqual(listerImage(d, INDEX, 'd'), ['d/Console.tsx', 'd/a.txt'], 'l’index le porte encore')
    assert.deepEqual(listerImage(d, SUIVI, 'd'), ['d/a.txt'])
    assert.deepEqual(listerImage(d, TRAVAIL, 'd'), ['d/a.txt'])
  } finally {
    rmSync(racine, { recursive: true, force: true })
  }
})

test('lireEnLot : un seul `cat-file --batch` rend le texte de chaque chemin, multi-octet compris, `null` pour un absent — ref et INDEX', () => {
  const textes = { 'src/a.ts': 'const é = "→"\n\nexport {}\n', 'src/b.ts': 'const z = 2' }
  const { racine, sha } = instanceDeDepot({ fichiers: textes, message: 'un' })
  try {
    const appels = []
    const d = depotDe(racine, {
      env: envDeDepotForge(),
      spawn: (commande, args, opts) => { appels.push(args[OPTIONS_DE_L_HOTE.length]); return spawnSync(commande, args, opts) },
    })
    for (const arbre of [sha, INDEX]) {
      assert.deepEqual([...lireEnLot(d, arbre, ['src/a.ts', 'src/absent.ts', 'src/b.ts'])],
        [['src/a.ts', textes['src/a.ts']], ['src/absent.ts', null], ['src/b.ts', textes['src/b.ts']]], arbre)
    }
    assert.deepEqual(appels, ['cat-file', 'cat-file'], 'une lecture par lot, pas une par chemin')
    assert.deepEqual([...lireEnLot(d, sha, [])], [], 'lot vide : aucun processus')
    assert.equal(appels.length, 2)
  } finally {
    jeter(racine)
  }
})

test('lireEnLot : une sortie de `cat-file` dont le bloc ne finit pas à sa taille LÈVE en nommant le chemin', () => {
  const rendant = (stdout) => depotFeint(tmpdir(), () => ({ status: 0, stdout, stderr: '' }))
  assert.throws(() => lireEnLot(rendant('abc blob 3\nabcX'), 'HEAD', ['src/a.ts']), /illisible à HEAD:src\/a\.ts : « abc blob 3 »/)
  assert.deepEqual([...lireEnLot(rendant('abc blob 3\nabc\n'), 'HEAD', ['src/a.ts'])], [['src/a.ts', 'abc']], 'témoin : le bloc bien formé')
})

test('lireEnLot : un `cat-file` qui ne rend pas son lot est une PANNE — `GitIndisponible`, ou `enPanne` et tout `null` — jamais un fichier absent', () => {
  assert.throws(() => lireEnLot(muet(), 'HEAD', ['src/a.ts']), (e) => e instanceof GitIndisponible && e.raison === '`git cat-file --batch` sans lot (status 1)')
  const pannes = []
  const enPanne = depotFeint(tmpdir(), () => ({ status: 1, stdout: '', stderr: '' }), (r) => pannes.push(r))
  assert.deepEqual([...lireEnLot(enPanne, 'HEAD', ['src/a.ts'])], [['src/a.ts', null]])
  assert.deepEqual(pannes, ['`git cat-file --batch` sans lot (status 1)'])
})

test('listerImage, ceQuiChange, eolsDe, fichiersDuGrep : un chemin non-ASCII ou à espace est rendu EN CLAIR — ls-files, ls-tree, diff-index, numstat, grep -l, --eol', () => {
  const E = 'src/ui/Écran.tsx'
  const B = 'src/mon module.ts'
  const { racine, sha } = instanceDeDepot({ fichiers: { [E]: 'const e = 1\n', [B]: 'const b = 1\n', 'src/a.ts': 'const a = 1\n' }, message: 'socle' })
  const d = forge(racine)
  const g = gitDe(racine)
  try {
    assert.match(g('ls-files'), /^"src\/ui\/\\303\\211cran\.tsx"$/m, 'témoin : hors de l’hôte, la forme ligne CITE le chemin')
    assert.deepEqual(listerImage(d, INDEX, 'src').sort(), [B, 'src/a.ts', E].sort())
    assert.deepEqual(listerImage(d, sha, 'src').sort(), [B, 'src/a.ts', E].sort())
    writeFileSync(join(racine, E), 'const e = 2\n')
    g('mv', B, 'src/renommé.ts')
    const change = ceQuiChange(d, 'HEAD', SUIVI)
    assert.deepEqual(change.chemins().sort(), [B, 'src/renommé.ts', E].sort())
    assert.deepEqual(change.numstat(),
      [{ plus: 0, moins: 0, chemins: [B, 'src/renommé.ts'] }, { plus: 1, moins: 1, chemins: [E] }], 'un renommage : ses deux bouts')
    assert.deepEqual([...change.renommages()], [[B, 'src/renommé.ts']])
    assert.deepEqual(eolsDe(d, [E, 'src/renommé.ts']),
      [{ index: 'lf', travail: 'lf', attr: '', chemin: 'src/renommé.ts' }, { index: 'lf', travail: 'lf', attr: '', chemin: E }], 'la TABULATION coupe, pas l’espace')
    assert.deepEqual(fichiersDuGrep(d, [sha], 'const e', ['src']), [E], 'le préfixe `<ref>:` est retiré')
    assert.deepEqual(fichiersDuGrep(d, ['--cached'], 'const', ['src']).sort(), ['src/a.ts', 'src/renommé.ts', E].sort())
    assert.deepEqual(fichiersDuGrep(d, [], 'rien de tel', ['src']), [], 'aucun match : sortie 1, liste vide')
  } finally {
    jeter(racine)
  }
})

test('etatDeLArbre : `status --porcelain=v2` en `{ etat, chemins }`, renommage en ses deux bouts, non-suivi et chemin non-ASCII EN CLAIR', () => {
  const E = 'src/ui/Écran.tsx'
  const B = 'src/mon module.ts'
  const { racine } = instanceDeDepot({ fichiers: { [E]: 'const e = 1\n', [B]: 'const b = 1\n' }, message: 'socle' })
  const d = forge(racine)
  const g = gitDe(racine)
  try {
    writeFileSync(join(racine, E), 'const e = 2\n')
    g('mv', B, 'src/renommé.ts')
    writeFileSync(join(racine, 'src/neuf é.ts'), 'n\n')
    assert.deepEqual(etatDeLArbre(d), [
      { etat: 'D ', chemins: [B] },
      { etat: 'A ', chemins: ['src/renommé.ts'] },
      { etat: ' M', chemins: [E] },
      { etat: '??', chemins: ['src/neuf é.ts'] },
    ])
    assert.deepEqual(etatDeLArbre(muet()), [], 'git muet : []')
  } finally {
    jeter(racine)
  }
})

test('sourceGit : `citants` ne rend que les MODULES de code de `src/`, `lireTout` leur texte par lot — ref, INDEX, suivi et travail', () => {
  const texte = "import {\n  C,\n} from\n  './Cible'\n"
  const { racine, sha } = instanceDeDepot({
    fichiers: { 'src/a.ts': texte, 'src/n.md': "from './Cible'\n", 'src/d.json': '"./Cible"\n', 'src/z.ts': 'const z = 1\n' },
    message: 'un',
  })
  try {
    for (const arbre of [sha, INDEX, SUIVI, TRAVAIL]) {
      const source = sourceGit({ cwd: racine, arbre })
      const citants = source.citants('/Cible')
      assert.deepEqual(citants, ['src/a.ts'], arbre)
      assert.deepEqual([...source.lireTout(citants)], [['src/a.ts', texte]], arbre)
    }
  } finally {
    jeter(racine)
  }
})

// ── CE QUE FAIT LE COMMIT (`ceQueFaitLeCommit`, contre sa base) : des fusions FORGÉES ──────

/** Dépôt jetable de trois fusions sur `main` : une PROPRE (la branche `cote` ajoute `h.txt`), une qui
 *  RÉSOUT un conflit sur `f.txt`, une « maléfique » qui ajoute à `g.txt` une ligne qu'aucun parent ne
 *  porte. `shas` nomme chaque fusion et le commit de branche qui a écrit `h.txt`. */
function depotDeFusions() {
  const { racine } = instanceDeDepot({ fichiers: { 'f.txt': 'a\nb\nc\n', 'g.txt': 'x\n' }, message: 'socle' })
  const g = gitDe(racine)
  const ecrire = (rel, texte) => writeFileSync(join(racine, rel), texte)
  const tete = () => g('rev-parse', 'HEAD').trim()
  g('checkout', '-q', '-b', 'cote')
  ecrire('h.txt', 'h1\nh2\n'); g('add', 'h.txt'); g('commit', '-q', '-m', 'cote : h')
  const auteurDeH = tete()
  g('checkout', '-q', 'main')
  ecrire('x.txt', 'x\n'); g('add', 'x.txt'); g('commit', '-q', '-m', 'main : x')
  g('merge', '-q', '--no-ff', '-m', 'fusion propre', 'cote')
  const propre = tete()
  g('checkout', '-q', 'cote')
  ecrire('f.txt', 'a\nB-cote\nc\n'); g('commit', '-q', '-am', 'cote : f')
  g('checkout', '-q', 'main')
  ecrire('f.txt', 'a\nB-main\nc\n'); g('commit', '-q', '-am', 'main : f')
  try { g('merge', '-q', 'cote') } catch { /* conflit attendu, résolu ci-dessous */ }
  ecrire('f.txt', 'a\nB-resolu\nc\n'); g('commit', '-q', '-am', 'fusion résolue')
  const resolue = tete()
  g('checkout', '-q', 'cote')
  ecrire('g.txt', 'x\ny\n'); g('commit', '-q', '-am', 'cote : g')
  g('checkout', '-q', 'main')
  g('merge', '-q', '--no-commit', 'cote')
  ecrire('g.txt', 'x\ny\nMAL\n'); g('add', 'g.txt'); g('commit', '-q', '-m', 'fusion maléfique')
  return { racine, auteurDeH, propre, resolue, malefique: tete() }
}

test('ceQueFaitLeCommit : une fusion PROPRE n’apporte rien — ni le fichier ni les lignes de la branche fusionnée', () => {
  const { racine, auteurDeH, propre } = depotDeFusions()
  try {
    const d = forge(racine)
    assert.deepEqual(ceQueFaitLeCommit(d, propre).chemins(), [])
    assert.equal(ceQueFaitLeCommit(d, propre).diff(['h.txt']), '')
    assert.deepEqual(ceQueFaitLeCommit(d, auteurDeH).chemins(), ['h.txt'], 'le commit d’ORIGINE, lui, porte h.txt')
  } finally {
    jeter(racine)
  }
})

test('ceQueFaitLeCommit : une fusion qui RÉSOUT un conflit apporte sa résolution, lue contre la fusion automatique', () => {
  const { racine, resolue } = depotDeFusions()
  try {
    const fait = ceQueFaitLeCommit(forge(racine), resolue)
    assert.deepEqual(fait.chemins(), ['f.txt'])
    assert.match(fait.diff(['f.txt']), /^\+B-resolu$/m)
    const deBase = fait.lirePreImage('f.txt')
    assert.match(deBase, /^<<<<<<< /m, 'la base est la fusion AUTOMATIQUE, marqueurs de conflit compris')
    assert.match(deBase, /^B-main$/m)
    assert.match(deBase, /^B-cote$/m)
    assert.equal(fait.lirePreImage('g.txt'), 'x\n', 'un fichier que le commit ne touche pas a dans la base son texte du commit')
  } finally {
    jeter(racine)
  }
})

test('ceQueFaitLeCommit : une fusion « maléfique » apporte la ligne qu’aucun parent ne porte, et seulement elle', () => {
  const { racine, malefique } = depotDeFusions()
  try {
    const fait = ceQueFaitLeCommit(forge(racine), malefique)
    assert.deepEqual(fait.chemins(), ['g.txt'])
    assert.deepEqual(fait.diff().split('\n').filter((l) => /^[+-][^+-]/.test(l)), ['+MAL'])
    assert.equal(fait.lirePreImage('g.txt'), 'x\ny\n')
  } finally {
    jeter(racine)
  }
})

test('ceQueFaitLeCommit : la base d’une fusion se lit SANS pilote de fusion ni attribut — aucun processus lancé, rien écrit dans l’arbre', () => {
  const { racine } = depotDeFusions()
  try {
    const g = gitDe(racine)
    writeFileSync(join(racine, '.gitattributes'), 'f.txt merge=pilote\n'); g('add', '.gitattributes'); g('commit', '-q', '-m', 'attributs')
    g('checkout', '-q', '-b', 'pilotee')
    writeFileSync(join(racine, 'f.txt'), 'a\nB-pilotee\nc\n'); g('commit', '-q', '-am', 'pilotee : f')
    g('checkout', '-q', 'main')
    writeFileSync(join(racine, 'f.txt'), 'a\nB-tronc\nc\n'); g('commit', '-q', '-am', 'tronc : f')
    try { g('merge', '-q', 'pilotee') } catch { /* conflit attendu, résolu ci-dessous */ }
    writeFileSync(join(racine, 'f.txt'), 'a\nB-fusion\nc\n'); g('commit', '-q', '-am', 'fusion pilotée')
    const fusion = g('rev-parse', 'HEAD').trim()
    const marque = join(racine, 'MARQUE')
    g('config', 'merge.pilote.driver', `echo JOUE >> '${marque}'; exit 1`)
    const fait = ceQueFaitLeCommit(forge(racine), fusion)
    assert.deepEqual(fait.chemins(), ['f.txt'])
    assert.equal(existsSync(marque), false, 'le pilote de fusion de la configuration a été JOUÉ')
    assert.deepEqual(listerDossier(racine).filter((n) => n.startsWith('.merge_file_')), [])
    assert.match(fait.lirePreImage('f.txt'), /^<<<<<<< /m, 'la base est la fusion AUTOMATIQUE de git, sans le pilote')
  } finally {
    jeter(racine)
  }
})

test('ceQueFaitLeCommit : une fusion SANS ANCÊTRE COMMUN se lit comme `git show --remerge-diff` — chemins et patch', () => {
  const { racine, g } = depot()
  try {
    const blob = lancerGit(['hash-object', '-w', '--stdin'], { cwd: racine, input: 'o\n' }).trim()
    const arbre = lancerGit(['mktree'], { cwd: racine, input: `100644 blob ${blob}\to.txt\n` }).trim()
    const racineEtrangere = lancerGit(['commit-tree', arbre, '-m', 'autre histoire'], { cwd: racine, input: '' }).trim()
    g('merge', '-q', '--no-commit', '--allow-unrelated-histories', racineEtrangere)
    writeFileSync(join(racine, 'mal.txt'), 'MAL\n'); g('add', 'mal.txt'); g('commit', '-q', '-m', 'fusion sans ancêtre')
    const fusion = g('rev-parse', 'HEAD').trim()
    const remerge = (...forme) => g('show', '--remerge-diff', '--format=', ...forme, fusion)
    const fait = ceQueFaitLeCommit(forge(racine), fusion)
    assert.deepEqual(fait.chemins(), remerge('--name-only').split('\n').filter(Boolean))
    assert.deepEqual(fait.chemins(), ['mal.txt'], 'o.txt vient de la fusion automatique, mal.txt de la fusion seule')
    const lignes = (patch) => patch.split('\n').filter((l) => /^[+-][^+-]/.test(l))
    assert.deepEqual(lignes(fait.diff()), lignes(remerge('-U0')))
  } finally {
    jeter(racine)
  }
})

test('ceQueFaitLeCommit : un commit à un parent se lit contre lui — chemins, texte de base, naissance et renommage', () => {
  const { racine, premier, second, g } = depot()
  try {
    g('mv', 'a.txt', 'b.txt'); g('commit', '-q', '-m', 'trois')
    const d = forge(racine)
    assert.deepEqual(ceQueFaitLeCommit(d, second).chemins(), ['neuf.txt'])
    assert.equal(ceQueFaitLeCommit(d, second).lirePreImage('neuf.txt'), null, 'un fichier qui NAÎT est absent de la base')
    const trois = ceQueFaitLeCommit(d, g('rev-parse', 'HEAD').trim())
    assert.deepEqual(trois.chemins().sort(), ['a.txt', 'b.txt'], '`--no-renames` : les deux bouts')
    assert.deepEqual([...trois.renommages()], [['a.txt', 'b.txt']])
    assert.equal(trois.lirePreImage('a.txt'), 'a\n')
    assert.deepEqual(ceQueFaitLeCommit(d, premier).chemins(), ['a.txt'], 'une racine se lit contre l’arbre vide')
  } finally {
    jeter(racine)
  }
})

test('ceQueFaitLeCommit : sous git 2.39, un commit ordinaire se lit, une FUSION lève une raison NOMMÉE', () => {
  const lecteur = (version, parents) => depotFeint(tmpdir(), (args) => {
    const stdout = args[0] === 'version' ? version : args[0] === 'rev-list' ? `abc arbre-de-abc ${parents}\n` : args[0] === 'diff-tree' ? '1\t0\ta.txt\0' : null
    return stdout === null ? { status: 1, stdout: '', stderr: '' } : { status: 0, stdout, stderr: '' }
  })
  assert.deepEqual(ceQueFaitLeCommit(lecteur('git version 2.39.0\n', 'p1'), 'abc').chemins(), ['a.txt'])
  assert.throws(() => ceQueFaitLeCommit(lecteur('git version 2.39.0\n', 'p1 p2'), 'abc'), (e) => e instanceof GitIndisponible && /git 2\.39 ne sait pas git merge-tree --write-tree --stdin \(git 2\.40 ou plus\)/.test(e.raison))
  assert.throws(() => ceQueFaitLeCommit(lecteur(null, 'p1 p2'), 'abc'), (e) => e instanceof GitIndisponible && /version de git illisible/.test(e.raison))
  assert.throws(() => ceQueFaitLeCommit(lecteur('git version 2.45.1.windows.1\n', 'p1 p2'), 'abc'), (e) => e instanceof GitIndisponible && /illisible/.test(e.raison), 'windows lu ; git muet : la fusion illisible se NOMME, jamais « sans apport »')
  assert.deepEqual(ceQueFaitLeCommit(muet(), 'abc').chemins(), [], 'sha inconnu : rien, sans lire la version')
  assert.throws(() => ceQueFaitLeCommit(lecteur('git version 2.43.0', 'p1 p2 p3'), 'abc'), (e) => e instanceof GitIndisponible && /à 3 parents/.test(e.raison))
})

// ── Les lecteurs nommés sur leurs formes rares (#1806, juge des commits 8 et 9, Q7) ─────────────

test('ceQuiChange.numstat : un chemin à TABULATION entier, un binaire en `null` (git réel)', () => {
  const T = 'src/f\tg.test.ts'
  const { racine } = instanceDeDepot({ fichiers: { 'a.txt': 'a\n' }, message: 'socle' })
  try {
    const g = gitDe(racine)
    // Le nom à tabulation vit dans l'INDEX seul, sous `core.protectNTFS=false` (git help config) : NTFS le refuse sur le disque.
    g('config', '--local', 'core.protectNTFS', 'false')
    const indexer = (chemin, contenu) => {
      const blob = lancerGit(['hash-object', '-w', '--stdin'], { cwd: racine, input: contenu }).trim()
      g('update-index', '--add', '--cacheinfo', `100644,${blob},${chemin}`)
    }
    indexer(T, 'un\ndeux\n')
    writeFileSync(join(racine, 'image.bin'), Buffer.from([0, 1, 2, 0, 255]))
    g('add', 'image.bin')
    const d = forge(racine)
    const vu = ceQuiChange(d, 'HEAD', INDEX).numstat().sort((x, y) => parUnitesDeCode(x.chemins[0], y.chemins[0]))
    assert.deepEqual(vu, [
      { plus: null, moins: null, chemins: ['image.bin'] },
      { plus: 2, moins: 0, chemins: [T] },
    ])
    g('commit', '-q', '-m', 'deux')
    g('update-index', '--remove', T)
    indexer('src/h\ti.test.ts', 'un\ndeux\n')
    assert.deepEqual(ceQuiChange(d, 'HEAD', INDEX).numstat(), [{ plus: 0, moins: 0, chemins: [T, 'src/h\ti.test.ts'] }])
  } finally {
    jeter(racine)
  }
})

test('etatDeLArbre : un renommage de l’ARBRE (colonne Y) rend ses deux bouts, `status.renames` n’y fait rien (git réel, `add -N`)', () => {
  const { racine } = instanceDeDepot({ fichiers: { 'a.txt': 'contenu assez long pour un renommage\n' }, message: 'socle' })
  try {
    const g = gitDe(racine)
    renameSync(join(racine, 'a.txt'), join(racine, 'b.txt'))
    g('add', '-N', 'b.txt')
    const vu = etatDeLArbre(forge(racine))
    assert.deepEqual(vu, [{ etat: ' D', chemins: ['a.txt'] }, { etat: ' A', chemins: ['b.txt'] }])
  } finally {
    jeter(racine)
  }
})

test('eolsDe : un attribut à ESPACES (`attr/text eol=lf`) est lu entier, un enregistrement hors forme LÈVE en se nommant', () => {
  const { racine } = instanceDeDepot({ fichiers: { '.gitattributes': '*.txt text eol=lf\n', 'a.txt': 'a\n' }, message: 'socle' })
  try {
    const vu = eolsDe(forge(racine), ['a.txt'])
    assert.deepEqual(vu, [{ index: 'lf', travail: 'lf', attr: 'text eol=lf', chemin: 'a.txt' }])
  } finally {
    jeter(racine)
  }
  assert.throws(() => eolsDe(depotFeint(tmpdir(), () => ({ status: 0, stdout: 'pas une colonne\0', stderr: '' })), []), /git ls-files --eol illisible : « pas une colonne »/)
})

/** Les réglages de l'utilisateur qui changent ce que rend une PORCELAINE, mesurés au jugement du lot
 *  #85 (#1806) : chaque lecteur de l'hôte doit rendre sous eux ce qu'il rend sous une config vide.
 *  `ATTRIBUTS` et `ORDRE` sont remplacés par des fichiers du dossier de la mesure. */
const REGLAGES_HOSTILES = [
  '[color]', '\tui = always', '\tdiff = always', '\tgrep = always', '\tstatus = always',
  '[diff]', '\texternal = false', '\tnoprefix = true', '\tmnemonicPrefix = true', '\trelative = true',
  '\tinterHunkContext = 50', '\trenames = copies', '\tindentHeuristic = false', '\talgorithm = patience',
  '\tsuppressBlankEmpty = true', '\tcontext = 7', '\torderFile = ORDRE',
  '[diff "tc"]', '\ttextconv = false',
  '[core]', '\tattributesFile = ATTRIBUTS', '\tquotePath = true',
  '[log]', '\tshowSignature = true',
  '[grep]', '\tfullName = true', '\tpatternType = fixed', '\tlineNumber = true',
  '[status]', '\tshowUntrackedFiles = no', '\trenames = copies',
  '[merge]', '\tconflictStyle = diff3', '\trenames = false',
  '[i18n]', '\tlogOutputEncoding = ISO-8859-1',
]

/** Ce que rend CHAQUE lecteur de l'hôte sur `racine`, lu depuis `cwd`, sous `env`. */
function toutCeQueLisentLesLecteurs(racine, cwd, env, shas) {
  const d = depotDe(cwd, { env })
  const change = (c) => ({ base: c.base, chemins: c.chemins(), ad: c.chemins('AD'), numstat: c.numstat(), diff: c.diff(), diffM: c.diff([], { renommages: true }), renommages: [...c.renommages()], pre: c.lirePreImage('f.txt') })
  return {
    fusion: change(ceQueFaitLeCommit(d, shas.resolue)),
    renommage: change(ceQueFaitLeCommit(d, shas.renomme)),
    index: change(ceQuiChange(d, 'HEAD', INDEX)),
    suivi: change(ceQuiChange(d, 'HEAD', SUIVI)),
    plage: change(ceQuiChange(d, shas.propre, 'HEAD')),
    journal: journalDe(d, [`${shas.propre}..HEAD`]),
    grep: ['', '--untracked', '--cached', 'HEAD'].map((p) => fichiersDuGrep(d, p ? [p] : [], 'B-.*', [])),
    etat: etatDeLArbre(d),
    images: ['HEAD', INDEX, SUIVI, TRAVAIL].map((a) => listerImage(d, a, '.')),
    textes: [...lireEnLot(d, 'HEAD', ['f.txt', 'Écran é.txt', 'absent.txt'])],
    eols: eolsDe(d, ['f.txt', 'Écran é.txt']),
    vide: arbreVide(d),
    emporte: change(ceQuEmporteLIndex(d)),
    shas: [shasDe(d, [`${shas.propre}..HEAD`])],
    comptes: [combienDe(d, [`${shas.propre}..HEAD`]), divergenceDe(d, shas.propre, 'HEAD'), baseCommune(d, shas.propre, 'HEAD')],
    refs: [shaDe(d, 'HEAD'), shaDe(d, 'HEAD', { court: true }), brancheDe(d), branchesDe(d)?.map((b) => b.nom)],
    lieux: [racineDe(d), cheminGit(d, 'rebase-merge'), origineDe(d), dossierDesHooks(d), estSuperficiel(d)],
    ignore: [estIgnore(d, 'sous/neuf.txt'), cheminsEnConflit(d)],
    worktrees: worktreesDe(d)?.map((w) => [w.branche, w.principal]),
    racine: relative(racine, cwd),
  }
}

test('config HOSTILE : chaque lecteur de l’hôte rend sous les réglages de l’utilisateur ce qu’il rend sous une config vide', () => {
  const { racine, resolue, propre } = depotDeFusions()
  const mesure = mkdtempSync(join(tmpdir(), 'config-hostile-'))
  try {
    const g = gitDe(racine)
    writeFileSync(join(racine, 'r.txt'), 'une ligne assez longue pour qu’un renommage se détecte\n')
    writeFileSync(join(racine, 'Écran é.txt'), 'é\n')
    g('add', '-A'); g('commit', '-q', '-m', 'pose')
    g('mv', 'r.txt', 'r2.txt'); g('commit', '-q', '-m', 'renommé, déplacé')
    const renomme = g('rev-parse', 'HEAD').trim()
    writeFileSync(join(racine, 'g.txt'), 'x\ny\nMAL\nindexé\n'); g('add', 'g.txt')
    writeFileSync(join(racine, 'x.txt'), 'x\ntravail\n')
    mkdirSync(join(racine, 'sous'))
    writeFileSync(join(racine, 'sous', 'neuf.txt'), 'B-neuf\n')
    writeFileSync(join(mesure, 'attributs'), '* diff=tc\n')
    writeFileSync(join(mesure, 'ordre'), 'x.txt\n')
    const hostile = join(mesure, 'hostile.gitconfig')
    writeFileSync(hostile, `${REGLAGES_HOSTILES.join('\n').replace('ATTRIBUTS', join(mesure, 'attributs').replace(/\\/g, '/')).replace('ORDRE', join(mesure, 'ordre').replace(/\\/g, '/'))}\n`)
    const shas = { resolue, propre, renomme }
    for (const cwd of [racine, join(racine, 'sous')]) {
      const vide = toutCeQueLisentLesLecteurs(racine, cwd, envDeDepotForge(), shas)
      const sous = toutCeQueLisentLesLecteurs(racine, cwd, { ...envDeDepotForge(), GIT_CONFIG_GLOBAL: hostile }, shas)
      assert.deepEqual(sous, vide, `depuis ${relative(racine, cwd) || '.'}`)
      assert.match(vide.fusion.pre, /^<<<<<<< [^\n]*\nB-main\n=======\nB-cote\n>>>>>>> /m, 'la base d’une fusion en conflit : le style `merge`')
      assert.match(vide.suivi.diff, /^\+\+\+ b\/x\.txt$/m, 'les préfixes a/ b/ du patch')
      assert.match(vide.plage.diff, /^\+\+\+ b\/Écran é\.txt\t?$/m, 'un chemin non-ASCII en clair dans le patch')
      assert.deepEqual(vide.journal.at(-1).message, 'renommé, déplacé\n', 'le message en UTF-8')
      assert.ok(vide.etat.some((e) => e.etat === '??' && e.chemins[0] === 'sous/neuf.txt'), 'le non-suivi est dans l’état')
    }
    assert.ok(g('-c', `include.path=${hostile}`, 'grep', '-l', '-e', 'B-').includes('\u001b['), 'témoin : la porcelaine, elle, se colore sous ces réglages')
  } finally {
    jeter(racine)
    jeter(mesure)
  }
})

// ── Les ÉCRIVAINS : la configuration de l'utilisateur fait foi (#1806, juge du lot #85, H2 point 5) ──

/** Le cwd de l'ESPION : un répertoire neuf et vide, propre à ce banc, jeté en fin de fichier. */
let cwdEspion
/** Un dépôt ESPION : chaque argv reçu par git est journalisé dans `vus`, et git répond 0 à vide. */
function espion(cwd) {
  if (!cwd) {
    if (!cwdEspion) { cwdEspion = mkdtempSync(join(tmpdir(), 'espion-')); after(() => jeter(cwdEspion)) }
    cwd = cwdEspion
  }
  const vus = []
  const d = depotDe(cwd, { spawn: (_git, args) => { vus.push(args); return { status: 0, stdout: '', stderr: '' } } })
  return { d, vus }
}

test('ÉCRIVAINS : l’argv EXACT que git reçoit de chacun — aucune option de l’hôte, aucun geste forçant', () => {
  const { racine } = instanceDeDepot({ fichiers: {}, commit: false })
  try {
    const { d, vus } = espion(racine)
    assert.equal(existsSync(join(racine, 'a.txt')), false)
    const ecrivains = [
      ['fetchOrigin', () => fetchOrigin(d), [['fetch', '--quiet', '--no-tags', 'origin', '+refs/heads/main:refs/remotes/origin/main']]],
      ['approfondir', () => approfondir(d), [['fetch', '--unshallow', 'origin']]],
      ['initialiserDepot', () => initialiserDepot(d, { branche: 'main' }), [['init', '-q', '-b', 'main']]],
      ['reglerDepot', () => reglerDepot(d, 'user.name', 'x'), [['config', '--local', '--', 'user.name', 'x']]],
      ['ajouterOrigine', () => ajouterOrigine(d, '/o'), [['remote', 'add', '--', 'origin', '/o']]],
      ['poserRef', () => poserRef(d, 'refs/x', 'abc'), [['update-ref', '--', 'refs/x', 'abc']]],
      ['commitDe', () => commitDe(d, { message: 'm', chemins: ['a.txt'] }), [[...OPTIONS_DE_L_HOTE, 'ls-files', '-z', '--cached', '--', 'a.txt'], ['--literal-pathspecs', 'add', '--', 'a.txt'], ['--literal-pathspecs', 'commit', '-q', '-F', '-', '--', 'a.txt']]],
      ['commitDe vide', () => commitDe(d, { message: 'm', chemins: [], vide: true }), [['commit', '-q', '--allow-empty', '--only', '-F', '-']]],
      ['fusionner', () => fusionner(d, { de: 'origin/main', message: 'm #1' }), [['merge', '--no-ff', '-m', 'm #1', 'origin/main']]],
      ['abandonnerFusion', () => abandonnerFusion(d), [['merge', '--abort']]],
      ['conclureFusionSansChemins', () => conclureFusionSansChemins(d, { chemins: ['a.txt'], message: 'm' }), [['--literal-pathspecs', 'rm', '-q', '--cached', '--', 'a.txt'], ['commit', '-q', '-F', '-']]],
      ['pousser', () => pousser(d, { vers: 'refs/heads/x', bail: true }), [['push', '--force-with-lease', 'origin', 'HEAD:refs/heads/x']]],
      ['ajouterWorktree', () => ajouterWorktree(d, { chemin: '/w', branche: 'b', depuis: 'origin/main' }), [['worktree', 'add', '-b', 'b', '--', '/w', 'origin/main']]],
      ['retirerWorktree', () => retirerWorktree(d, '/w'), [['worktree', 'remove', '--', '/w']]],
      ['supprimerBranche', () => supprimerBranche(d, 'b'), [['branch', '-d', '--', 'b']]],
      ['elaguerWorktrees', () => elaguerWorktrees(d), [['worktree', 'prune']]],
    ]
    for (const [nom, ecrire, argv] of ecrivains) {
      vus.length = 0
      assert.equal(reussi(ecrire()), true, nom)
      assert.deepEqual(vus, argv, nom)
    }
  } finally { jeter(racine) }
})

test('commitDe : sans `chemins`, ou à chemins vides hors `vide`, LÈVE avant tout spawn — ni `add -A`, ni commit de tout l’index', () => {
  const { d, vus } = espion()
  for (const p of [{ message: 'm' }, { message: 'm', chemins: null }, { message: 'm', chemins: [] }, { message: 'm', vide: true }]) {
    assert.throws(() => commitDe(d, p), /commitDe : un commit porte des `chemins` explicites/, JSON.stringify(p))
  }
  assert.deepEqual(vus, [])
})

test('commitDe : un chemin qui n’est pas un FICHIER — `.`, `:/`, `*`, un répertoire (sur le disque ou supprimé), `…/` — ne committe jamais l’arbre ; `vide` ne committe pas l’index', () => {
  const { racine } = instanceDeDepot({ fichiers: { 'a.txt': 'a\n', 'src/x.ts': 'x\n' }, message: 'socle' })
  try {
    const g = gitDe(racine, { net: true })
    const vus = []
    const d = depotDe(racine, { env: envDeDepotForge(), spawn: (git, args, o) => { vus.push(args); return spawnSync(git, args, o) } })
    const fichiersDeTete = () => g('show', '--name-only', '--format=', 'HEAD').split('\n').filter(Boolean)
    for (const chemins of [['.'], [':/'], ['src'], ['src/'], [''], ['a.txt', 'src']]) {
      assert.throws(() => commitDe(d, { message: 'm', chemins }), /commitDe : un chemin nomme un FICHIER/, JSON.stringify(chemins))
    }
    assert.deepEqual(vus, [], 'aucun spawn avant le refus')
    writeFileSync(join(racine, 'a.txt'), 'a2\n')
    writeFileSync(join(racine, 'non-suivi-secret.txt'), 's\n')
    const tete = g('rev-parse', 'HEAD')
    for (const motif of ['*', '?.txt']) {
      const vu = commitDe(d, { message: 'motif', chemins: [motif] })
      assert.equal(reussi(vu), false, `${motif} est un NOM de fichier, absent : rien n’est stagé`)
      assert.equal(g('rev-parse', 'HEAD'), tete, motif)
    }
    assert.equal(g('diff', '--cached', '--name-only'), '', 'l’index est intact')
    g('add', 'a.txt')
    assert.equal(reussi(commitDe(d, { message: 'vide\n', chemins: [], vide: true })), true)
    assert.deepEqual(fichiersDeTete(), [], 'le commit `vide` n’emporte pas l’index chargé')
    assert.equal(g('diff', '--cached', '--name-only'), 'a.txt', 'l’index reste chargé')
    rmSync(join(racine, 'src'), { recursive: true })
    const avantRepertoire = g('rev-parse', 'HEAD')
    assert.throws(() => commitDe(d, { message: 'm', chemins: ['src'] }), /commitDe : un chemin nomme un FICHIER.*\["src"\]/, 'un répertoire SUPPRIMÉ du disque reste un répertoire de l’index')
    assert.equal(g('rev-parse', 'HEAD'), avantRepertoire)
    assert.equal(g('diff', '--cached', '--name-only'), 'a.txt', 'rien n’est stagé du répertoire')
    rmSync(join(racine, 'a.txt'))
    assert.equal(reussi(commitDe(d, { message: 'suppression\n', chemins: ['a.txt'] })), true, 'témoin : un FICHIER supprimé du disque, entrée exacte de l’index, se committe')
    assert.deepEqual(fichiersDeTete(), ['a.txt'])
  } finally {
    jeter(racine)
  }
})

test('ÉCRIVAINS sous config HOSTILE : l’identité de l’UTILISATEUR signe le commit et la fusion', () => {
  const { racine } = instanceDeDepot({ fichiers: { 'a.txt': 'a\n' }, message: 'socle' })
  const mesure = mkdtempSync(join(tmpdir(), 'ecrivain-hostile-'))
  try {
    const g = gitDe(racine, { net: true })
    g('config', '--local', '--unset', 'user.name')
    g('config', '--local', '--unset', 'user.email')
    const globale = join(mesure, 'globale.gitconfig')
    writeFileSync(globale, `${REGLAGES_HOSTILES.filter((l) => !/ATTRIBUTS|ORDRE/.test(l)).join('\n')}\n[user]\n\tname = Utilisatrice Hostile\n\temail = hostile@example.invalid\n[commit]\n\tgpgsign = false\n`)
    const d = depotDe(racine, { env: envDeLUtilisatrice(globale) })
    writeFileSync(join(racine, 'a.txt'), 'a2\n')
    assert.equal(reussi(commitDe(d, { message: 'deux\n', chemins: ['a.txt'] })), true)
    assert.equal(g('log', '-1', '--format=%an <%ae>|%s'), 'Utilisatrice Hostile <hostile@example.invalid>|deux')
    g('branch', 'b', 'HEAD~1')
    g('checkout', '-q', 'b')
    writeFileSync(join(racine, 'b.txt'), 'b\n')
    assert.equal(reussi(commitDe(d, { message: 'b\n', chemins: ['b.txt'] })), true)
    assert.equal(reussi(fusionner(d, { de: 'main', message: 'fusion #1' })), true)
    assert.equal(g('log', '-1', '--format=%an|%cn|%s'), 'Utilisatrice Hostile|Utilisatrice Hostile|fusion #1', 'la fusion signe sous l’identité de l’utilisatrice')
    assert.equal(g('rev-parse', 'HEAD^2'), g('rev-parse', 'main'))
  } finally {
    jeter(racine)
    jeter(mesure)
  }
})

// #2203
test('conclureFusionSansChemins : une fusion en CONFLIT sur des chemins nommés se conclut en les retirant de l’index — le disque les garde', () => {
  const { racine } = instanceDeDepot({ fichiers: { 'gen.md': 'base\n', 'a.txt': 'a\n' }, message: 'socle' })
  try {
    const g = gitDe(racine, { net: true })
    const d = depotDe(racine, { env: envDeDepotForge() })
    g('branch', 'b')
    writeFileSync(join(racine, 'gen.md'), 'main\n')
    g('commit', '-qam', 'main')
    g('checkout', '-q', 'b')
    writeFileSync(join(racine, 'gen.md'), 'b\n')
    g('commit', '-qam', 'b')
    assert.equal(reussi(fusionner(d, { de: 'main', message: 'fusion #1' })), false, 'la fixture n’a pas mis gen.md en conflit')
    assert.deepEqual(cheminsEnConflit(d), ['gen.md'])
    assert.throws(() => conclureFusionSansChemins(d, { chemins: [], message: 'fusion #1' }), /des `chemins` explicites/)
    assert.equal(reussi(conclureFusionSansChemins(d, { chemins: ['gen.md'], message: 'fusion #1\n' })), true)
    assert.equal(g('log', '-1', '--format=%s'), 'fusion #1')
    assert.equal(g('rev-parse', 'HEAD^2'), g('rev-parse', 'main'), 'un commit de FUSION, second parent = main')
    assert.equal(g('ls-files', '--', 'gen.md'), '', 'gen.md est sorti de l’index')
    assert.equal(g('ls-files', '--', 'a.txt'), 'a.txt')
    assert.equal(existsSync(join(racine, 'gen.md')), true, 'le disque garde le fichier')
  } finally {
    jeter(racine)
  }
})

test('pousser : tout push vers le tronc est REFUSÉ avant tout spawn, sous ses deux noms, bail ou non', () => {
  const d = depotDe(tmpdir(), { spawn: () => assert.fail('aucun git ne doit partir') })
  for (const vers of ['main', 'refs/heads/main']) for (const bail of [true, false]) assert.throws(() => pousser(d, { vers, bail }), /main n’avance que par la file de fusion/)
})

for (const [nom, reponse, issue, motif] of [
  ['objet absent', { status: 128, stdout: `${'note stdout\n'.repeat(50)}cause stdout tardive`, stderr: `${'note stderr\n'.repeat(50)}fatal: bad object — cause stderr tardive` }, 'refus', 'objet absent'],
  ['255 et stderr vide', { status: 255, stdout: `${'note stdout\n'.repeat(50)}cause stdout tardive`, stderr: '' }, 'refus', '255'],
  ['256 avec stderr', { status: 256, stdout: `${'note stdout\n'.repeat(50)}cause stdout tardive`, stderr: `${'note stderr\n'.repeat(50)}cause stderr tardive` }, 'refus', 'cause stderr tardive'],
  ['interruption', { status: null, stdout: 'flux interrompu', stderr: 'cause interruption', signal: 'SIGTERM' }, 'interruption', 'SIGTERM'],
]) test(`fusionDeTextes : diagnostic complet — ${nom}`, () => {
  const d = depotFeint(tmpdir(), () => reponse)
  assert.throws(() => fusionDeTextes(d, { ours: 'o', base: 'b', theirs: 't' }, { ours: 'nous', base: 'base', theirs: 'eux' }), (e) => {
    assert.ok(e instanceof Error)
    assert.ok(e instanceof GitIndisponible)
    assert.equal(e.issue, issue)
    assert.ok(e.message.includes(motif))
    assert.equal(e.diagnostic.status, reponse.status)
    for (const flux of ['stdout', 'stderr']) {
      assert.equal(e.diagnostic[flux], reponse[flux])
      if (reponse[flux]) assert.ok(e.message.includes(reponse[flux]), `${flux} intégral dans l'erreur`)
    }
    if (reponse.signal) assert.equal(e.diagnostic.signal, reponse.signal)
    return true
  })
})

test('fusionDeTextes : codes propre et conflictuels inchangés', () => {
  for (const status of [0, 1, 254]) {
    const d = depotFeint(tmpdir(), () => ({ status, stdout: 'texte fusionné complet', stderr: '' }))
    assert.deepEqual(fusionDeTextes(d, { ours: 'o', base: 'b', theirs: 't' }, { ours: 'nous', base: 'base', theirs: 'eux' }), { texte: 'texte fusionné complet', conflit: status > 0 })
  }
})

test('fusionDeTextes : la fusion à trois de `merge-file`, conflit dit par le code de sortie, style `merge`', () => {
  const dossier = mkdtempSync(join(tmpdir(), 'fusion-textes-'))
  try {
    const poser = (nom, texte) => { writeFileSync(join(dossier, nom), texte); return join(dossier, nom) }
    const labels = { ours: 'nous', base: 'base', theirs: 'eux' }
    const propre = fusionDeTextes(depotDe(dossier), { ours: poser('o', 'a\nB\nc\n'), base: poser('b', 'a\nb\nc\n'), theirs: poser('t', 'a\nb\nc\n') }, labels)
    assert.deepEqual(propre, { texte: 'a\nB\nc\n', conflit: false })
    const conflit = fusionDeTextes(depotDe(dossier), { ours: poser('o', 'a\nX\nc\n'), base: poser('b', 'a\nb\nc\n'), theirs: poser('t', 'a\nY\nc\n') }, labels)
    assert.equal(conflit.conflit, true)
    assert.match(conflit.texte, /^<<<<<<< nous\nX\n=======\nY\n>>>>>>> eux$/m)
  } finally {
    jeter(dossier)
  }
})

// ── Les BORNES : ni drapeau, ni absence confondue avec le vide (#1806) ──────────────────────────

test('parentsDe : les parents de fusion sont ordonnés et un commit racine n’a pas de parent', () => {
  const { racine, sha: socle } = instanceDeDepot({ fichiers: { 'v.txt': 'V = 60\n', 'a.txt': 'a\n' }, message: 'socle' })
  try {
    const g = gitDe(racine, { net: true })
    const ecrire = (fichier, texte, message) => { writeFileSync(join(racine, fichier), texte); g('add', fichier); g('commit', '-q', '-m', message); return g('rev-parse', 'HEAD') }
    const d = forge(racine)
    g('checkout', '-q', '-b', 'cote')
    ecrire('v.txt', 'V = 61\n', 'cote')
    const autre = ecrire('a.txt', 'b\n', 'autre')
    g('checkout', '-q', 'main')
    const tronc = ecrire('v.txt', 'V = 62\n', 'tronc')
    g('checkout', '-q', 'cote')
    try { g('merge', '-q', '--no-ff', 'main') } catch {}
    const fusion = ecrire('v.txt', 'V = 62\n', 'fusion résolue côté tronc')
    assert.deepEqual(parentsDe(d, fusion), [autre, tronc])
    assert.deepEqual(parentsDe(d, socle), [], 'un commit racine n’a pas de parent')
  } finally { jeter(racine) }
})

/** Chaque question et chaque écrivain de l'hôte à qui l'on passe `b` pour révision, ref, nom ou
 *  chemin positionnel. */
const gestesALaBorne = (d, b) => ({
  shasDe: () => shasDe(d, [b]),
  journalDe: () => journalDe(d, [b]),
  combienDe: () => combienDe(d, [b]),
  divergenceDe: () => divergenceDe(d, b, 'HEAD'),
  baseCommune: () => baseCommune(d, b, 'HEAD'),
  shaDe: () => shaDe(d, b),
  estAncetre: () => estAncetre(d, b, 'HEAD'),
  'histoireDeHead dansHead': () => histoireDeHead(d).dansHead([b])[0],
  'ceQuiChange avant': () => ceQuiChange(d, b, 'HEAD'),
  'ceQuiChange apres': () => ceQuiChange(d, 'HEAD', b),
  'ceQuiChange INDEX': () => ceQuiChange(d, b, INDEX),
  'ceQuiChange SUIVI': () => ceQuiChange(d, b, SUIVI),
  ceQueFaitLeCommit: () => ceQueFaitLeCommit(d, b),
  listerImage: () => listerImage(d, b),
  lireEnLot: () => lireEnLot(d, b, ['a.txt']),
  parentsDe: () => parentsDe(d, b),
  fichiersDuGrep: () => fichiersDuGrep(d, [b], 'a', []),
  initialiserDepot: () => initialiserDepot(d, { branche: b }),
  reglerDepot: () => reglerDepot(d, b, 'x'),
  poserRef: () => poserRef(d, b, 'HEAD'),
  'poserRef sha': () => poserRef(d, 'refs/x', b),
  fusionner: () => fusionner(d, { de: b, message: 'm' }),
  'ajouterWorktree branche': () => ajouterWorktree(d, { chemin: '/w', branche: b, depuis: 'HEAD' }),
  'ajouterWorktree depuis': () => ajouterWorktree(d, { chemin: '/w', branche: 'x', depuis: b }),
  supprimerBranche: () => supprimerBranche(d, b),
  pousser: () => pousser(d, { vers: b }),
  fetchOrigin: () => fetchOrigin(d, { branche: b }),
})

test('une BORNE qui commence par `-` est REFUSÉE par chaque question et chaque écrivain, avant d’atteindre git', () => {
  const { racine } = depot()
  try {
    const argv = []
    const d = depotDe(racine, { env: envDeDepotForge(), spawn: (git, args, o) => { argv.push(args); return spawnSync(git, args, o) } })
    for (const [nom, geste] of Object.entries(gestesALaBorne(d, '--output=/dev/null'))) {
      argv.length = 0
      assert.throws(geste, /ni vide ni un drapeau|portée « --output=\/dev\/null » inconnue/, nom)
      assert.ok(argv.every((a) => !a.includes('--output=/dev/null')), `${nom} : « git ${argv.at(-1)?.join(' ')} »`)
    }
  } finally { jeter(racine) }
})

test('une BORNE à caractère de CONTRÔLE ou à `@{` est REFUSÉE par chaque question et chaque écrivain, avant d’atteindre git', () => {
  const { racine } = depot()
  try {
    const argv = []
    const d = depotDe(racine, { env: envDeDepotForge(), spawn: (git, args, o) => { argv.push(args); return spawnSync(git, args, o) } })
    for (const borne of [`HEAD\n${'f'.repeat(40)}`, 'HEAD\r', 'HEAD\0', 'main@{upstream}', 'HEAD@{0}']) {
      for (const [nom, geste] of Object.entries(gestesALaBorne(d, borne))) {
        argv.length = 0
        assert.throws(geste, /caractère de contrôle ou `@\{`|portée « [^»]* » inconnue/s, `${nom} ${JSON.stringify(borne)}`)
        assert.ok(argv.every((a) => !a.some((x) => x.includes(borne))), `${nom} : « git ${argv.at(-1)?.join(' ')} »`)
      }
    }
  } finally { jeter(racine) }
})

test('un CHEMIN à caractère de CONTRÔLE est REFUSÉ par `lireEnLot` avant d’atteindre git : il lirait un autre objet que le fichier', () => {
  const { racine } = depot()
  try {
    const entrees = []
    const d = depotDe(racine, { env: envDeDepotForge(), spawn: (git, args, o) => { entrees.push(o.input); return spawnSync(git, args, o) } })
    assert.equal(lireEnLot(d, 'HEAD', ['a.txt']).get('a.txt'), 'a\n', 'témoin : un chemin sain se lit')
    for (const arbre of ['HEAD', INDEX]) {
      for (const rel of ['nope\nHEAD', 'a.txt\r', 'a\0.txt', 'a\x7f', 'a\t.txt']) {
        entrees.length = 0
        assert.throws(() => lireEnLot(d, arbre, [rel, 'a.txt']), /lireEnLot : un chemin tient sur une ligne du lot/, `${arbre} ${JSON.stringify(rel)}`)
        assert.deepEqual(entrees, [], `${arbre} ${JSON.stringify(rel)} : aucun spawn`)
      }
    }
  } finally { jeter(racine) }
})

test('un `{ cwd }` écrit à la main n’est pas un dépôt : chaque question LÈVE `TypeError` à l’exécution', () => {
  const { racine } = depot()
  try {
    assert.equal(typeof racineDe(depotDe(racine, { env: envDeDepotForge() })), 'string', 'témoin : la poignée de `depotDe` répond')
    for (const faux of [{ cwd: racine }, Object.freeze({ cwd: racine }), null])
      assert.throws(() => racineDe(faux), (e) => e instanceof TypeError && /un dépôt se construit par `depotDe\(cwd\)`/.test(e.message), JSON.stringify(faux))
  } finally { jeter(racine) }
})

test('un NOM dont l’objet MANQUE (dépôt corrompu, refs intactes) : `GitIndisponible` nommée, jamais une absence ni `BorneAbsente`', () => {
  for (const [quoi, cible] of [['commit de tête', 'HEAD'], ['arbre de tête', 'HEAD^{tree}']]) {
    const { racine, premier, g } = depot()
    try {
      const d = forge(racine)
      const blob = g('rev-parse', 'HEAD:a.txt').trim()
      assert.throws(() => listerImage(d, blob), (e) => e.name === 'BorneAbsente', 'témoin : un blob n’est pas un arbre, c’est une absence')
      const sha = g('rev-parse', cible).trim()
      rmSync(join(racine, '.git', 'objects', sha.slice(0, 2), sha.slice(2)), { force: true })
      const questions = {
        listerImage: () => listerImage(d, 'main'),
        'ceQuiChange(…).chemins': () => ceQuiChange(d, premier, 'main').chemins(),
        fichiersDuGrep: () => fichiersDuGrep(d, ['main'], 'a', []),
        ...(cible === 'HEAD' ? {
          shaDe: () => shaDe(d, 'main'),
          baseCommune: () => baseCommune(d, premier, 'main'),
          divergenceDe: () => divergenceDe(d, premier, 'main'),
          combienDe: () => combienDe(d, [`${premier}..main`]),
          shasDe: () => shasDe(d, [`${premier}..main`]),
          journalDe: () => journalDe(d, [`${premier}..main`]),
          'histoireDeHead dansHead': () => histoireDeHead(d).dansHead([premier]),
        } : {}),
      }
      for (const [nom, question] of Object.entries(questions))
        assert.throws(question, (e) => e instanceof GitIndisponible && /dépôt corrompu : (main|HEAD) → [0-9a-f]{40}(\^\{\}\^\{tree\})? manquant|unable to read tree/.test(e.raison), `${quoi} — ${nom}`)
      const pannes = []
      const confie = depotDe(racine, { env: envDeDepotForge(), enPanne: (r) => pannes.push(r) })
      assert.deepEqual(listerImage(confie, 'main'), [], `${quoi} : sous \`enPanne\`, la panne est confiée`)
      assert.match(pannes.join('\n'), /dépôt corrompu : main/, quoi)
    } finally { jeter(racine) }
  }
})

test('une ÉTIQUETTE annotée dont le commit cible MANQUE : `GitIndisponible` nommée, sous son nom comme sous `^{commit}`, `~n` et `^n`', () => {
  const { racine, g } = depot()
  try {
    const d = forge(racine)
    g('commit', '-q', '--allow-empty', '-m', 'trois')
    g('tag', '-a', 'v1', '-m', 'etiquette')
    assert.deepEqual(listerImage(d, 'v1'), ['a.txt', 'neuf.txt'], 'témoin : une étiquette intacte se lit')
    const cible = g('rev-parse', 'HEAD').trim()
    g('reset', '-q', '--soft', 'HEAD~1')
    rmSync(join(racine, '.git', 'objects', cible.slice(0, 2), cible.slice(2)))
    const questions = {
      listerImage: () => listerImage(d, 'v1'),
      'ceQuiChange(…).chemins': () => ceQuiChange(d, 'HEAD', 'v1').chemins(),
      'shaDe v1^{commit}': () => shaDe(d, 'v1^{commit}'),
      'shaDe v1~1': () => shaDe(d, 'v1~1'),
      'shaDe v1^1': () => shaDe(d, 'v1^1'),
      baseCommune: () => baseCommune(d, 'HEAD', 'v1'),
    }
    for (const [nom, question] of Object.entries(questions))
      assert.throws(question, (e) => e instanceof GitIndisponible && /dépôt corrompu : v1 → [0-9a-f]{40}\^\{\} manquant/.test(e.raison), nom)
  } finally { jeter(racine) }
})

test('un CHEMIN positionnel qui commence par `-` passe APRÈS `--` : git le lit comme un chemin, jamais comme une option', () => {
  const { d, vus } = espion()
  const gestes = {
    retirerWorktree: [() => retirerWorktree(d, '-f'), ['worktree', 'remove', '--', '-f']],
    ajouterWorktree: [() => ajouterWorktree(d, { chemin: '-f', branche: 'b', depuis: 'HEAD' }), ['worktree', 'add', '-b', 'b', '--', '-f', 'HEAD']],
    ajouterOrigine: [() => ajouterOrigine(d, '-u'), ['remote', 'add', '--', 'origin', '-u']],
    commitDe: [() => commitDe(d, { message: 'm', chemins: ['-A'] }), ['--literal-pathspecs', 'commit', '-q', '-F', '-', '--', '-A']],
    fusionDeTextes: [() => fusionDeTextes(d, { ours: '-o', base: '-b', theirs: '-t' }, { ours: 'o', base: 'b', theirs: 't' }), ['merge-file', '-p', '-L', 'o', '-L', 'b', '-L', 't', '--', '-o', '-b', '-t']],
    estIgnore: [() => estIgnore(d, '-v'), ['check-ignore', '--stdin', '-z']],
    attributDe: [() => attributDe(d, '-v', 'merge'), ['check-attr', '-z', 'merge', '--', '-v']],
    eolsDe: [() => eolsDe(d, ['-z']), ['ls-files', '-z', '--eol', '--cached', '--', '-z']],
  }
  for (const [nom, [geste, attendu]] of Object.entries(gestes)) {
    vus.length = 0
    geste()
    assert.deepEqual(vus.at(-1).slice(vus.at(-1)[0] === '-c' ? OPTIONS_DE_L_HOTE.length : 0), attendu, nom)
  }
})

test('une BORNE ABSENTE : `null` (ou `absent`, `false`) pour une question qui le porte, `BorneAbsente` levée pour une collection — jamais le vide', () => {
  const { racine } = depot()
  try {
    const pannes = []
    const d = depotDe(racine, { env: envDeDepotForge(), enPanne: (r) => pannes.push(r) })
    const F = 'f'.repeat(40)
    const attendus = {
      shasDe: null, journalDe: null, combienDe: null, divergenceDe: null, baseCommune: null, shaDe: null, parentsDe: null,
      estAncetre: { disponible: true, absent: true }, 'histoireDeHead dansHead': false,
    }
    const questions = Object.entries(gestesALaBorne(d, F)).filter(([nom]) => !/^(initialiserDepot|reglerDepot|poserRef|fusionner|ajouterWorktree|supprimerBranche|pousser|fetchOrigin)/.test(nom))
    assert.equal(questions.length, 17)
    for (const [nom, question] of questions) {
      if (nom === 'estAncetre') {
        const absent = question()
        assert.equal(absent.disponible && absent.absent, true)
        assert.equal(absent.diagnostic.status, 128)
      } else if (nom in attendus) assert.deepEqual(question(), attendus[nom], nom)
      else assert.throws(question, (e) => e instanceof BorneAbsente && e.bornes.includes(F), nom)
    }
    assert.deepEqual(pannes, [], 'une borne absente n’est pas une panne')
    assert.deepEqual(listerImage(d, 'HEAD'), ['a.txt', 'neuf.txt'], 'témoin : une borne présente se lit')
    assert.deepEqual(lireEnLot(d, 'HEAD', ['jamais.txt']).get('jamais.txt'), null, 'témoin : un chemin absent d’une borne présente est un fait')
  } finally { jeter(racine) }
})

// ── Oracles de VALEUR des questions, sur dépôt forgé (#1806) ─────────────────────────────────

test('divergenceDe, combienDe, branchesDe, journalDe : les VALEURS — la gauche en RETARD, la droite en AVANCE, message sur plusieurs lignes', () => {
  const { racine } = instanceDeDepot({ fichiers: { 'a.txt': 'a\n' }, message: 'socle' })
  try {
    const g = gitDe(racine, { net: true })
    const d = forge(racine)
    g('checkout', '-q', '-b', 'cote')
    for (const f of ['b', 'c']) { writeFileSync(join(racine, f), `${f}\n`); g('add', f); g('commit', '-q', '-m', `sujet ${f}\n\ncorps ${f}\nsuite ${f}`) }
    g('checkout', '-q', 'main')
    writeFileSync(join(racine, 'm'), 'm\n'); g('add', 'm'); g('commit', '-q', '-m', 'tronc')
    assert.deepEqual(divergenceDe(d, 'main', 'cote'), { avance: 2, retard: 1 })
    assert.deepEqual(divergenceDe(d, 'cote', 'main'), { avance: 1, retard: 2 })
    assert.equal(combienDe(d, ['main..cote']), 2)
    assert.deepEqual(journalDe(d, ['main..cote']).map((c) => c.message), ['sujet b\n\ncorps b\nsuite b\n', 'sujet c\n\ncorps c\nsuite c\n'])
    const branches = branchesDe(d)
    assert.deepEqual(branches.map((b) => b.nom), ['cote', 'main'])
    for (const b of branches) assert.equal(b.sha, g('rev-parse', b.nom))
  } finally { jeter(racine) }
})

test('journalDe, branchesDe : la date ISO 8601 stricte en `±hh:mm`, UTC compris, sous toute version de git', () => {
  const { racine } = instanceDeDepot({ fichiers: { 'a.txt': 'a\n' }, message: 'socle' })
  try {
    const d = forge(racine)
    const dates = { utc: '2026-09-27T21:47:00+00:00', est: '2026-09-27T23:47:00+02:00', ouest: '2026-09-27T16:17:00-05:30' }
    for (const [branche, date] of Object.entries(dates)) {
      lancerGit(['checkout', '-q', '-b', branche, 'main'], { cwd: racine })
      lancerGit(['commit', '-q', '--allow-empty', '-m', branche], { cwd: racine, env: { ...envDeDepotForge(), GIT_COMMITTER_DATE: date } })
    }
    const lues = Object.fromEntries(branchesDe(d).map((b) => [b.nom, b.dernierCommitISO]))
    for (const [branche, date] of Object.entries(dates)) {
      assert.equal(lues[branche], date, `branchesDe ${branche}`)
      assert.equal(journalDe(d, [`${branche}^!`])[0].date, date, `journalDe ${branche}`)
    }
    assert.match(lues.main, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/)
  } finally { jeter(racine) }
})

test('branchesDe, divergenceDe, combienDe : une sortie en fin de ligne CRLF rend les mêmes valeurs', () => {
  const sha = 'a'.repeat(40)
  const reponses = {
    'for-each-ref': `main\u00002026-09-14T09:12:33+0200\u0000${sha}\r\ncote\u00002026-09-01T18:00:00+0200\u0000${sha}\r\n`,
    'rev-list --left-right': '17\t1\r\n',
    'rev-list --count': '3\r\n',
  }
  const d = depotFeint(tmpdir(), (args) => ({ status: 0, stderr: '', stdout: reponses[`${args[0]} ${args[1]}`] ?? reponses[args[0]] }))
  assert.deepEqual(branchesDe(d), [
    { nom: 'main', dernierCommitISO: '2026-09-14T09:12:33+02:00', sha },
    { nom: 'cote', dernierCommitISO: '2026-09-01T18:00:00+02:00', sha },
  ])
  assert.deepEqual(divergenceDe(d, 'main', 'cote'), { retard: 17, avance: 1 })
  assert.equal(combienDe(d, ['main..cote']), 3)
})

test('urlOrigineAcceptee : le dépôt MyEdO/game (#2178), en https comme en ssh, avec ou sans `.git`, casse ignorée', () => {
  for (const url of ['https://github.com/MyEdO/game.git', 'git@github.com:MyEdO/game.git', 'https://github.com/myedo/game', ' https://github.com/MyEdO/game\n'])
    assert.equal(urlOrigineAcceptee(url), true, url)
  for (const url of ['https://github.com/cgauche/game.git', 'https://github.com/MyEdO/game2.git', 'https://github.com/xMyEdO/game', 'https://github.com/MyEdO/game.git/x', '', undefined])
    assert.equal(urlOrigineAcceptee(url), false, String(url))
})

test('estSuperficiel, dossierDesHooks, estIgnore, attributDe, cheminGit, brancheDe, racineDe, origineDe : les VALEURS sur dépôt forgé', () => {
  const origine = `https://github.com/${DEPOT}.git`
  const { racine } = instanceDeDepot({ fichiers: { 'a.txt': 'a\n', '.gitignore': '*.log\n', '.gitattributes': '*.txt merge=stocks\n' }, origin: origine })
  const clone = mkdtempSync(join(tmpdir(), 'superficiel-'))
  try {
    const g = gitDe(racine, { net: true })
    const d = forge(racine)
    assert.equal(estSuperficiel(d), false)
    assert.equal(dossierDesHooks(d), 'hooks-absents')
    assert.deepEqual([estIgnore(d, 'x.log'), estIgnore(d, 'a.txt')], [true, false])
    assert.deepEqual([attributDe(d, 'a.txt', 'merge'), attributDe(d, 'x.log', 'merge')], ['stocks', 'unspecified'])
    assert.equal(cheminGit(d, 'rebase-merge'), '.git/rebase-merge')
    assert.equal(brancheDe(d), 'main')
    assert.equal(racineDe(d), g('rev-parse', '--show-toplevel'))
    assert.equal(origineDe(d), origine)
    g('checkout', '-q', '--detach')
    g('config', '--local', '--unset', 'core.hooksPath')
    g('remote', 'remove', 'origin')
    assert.deepEqual([brancheDe(d), dossierDesHooks(d), origineDe(d)], [null, null, null])
    lancerGit(['clone', '-q', '--depth', '1', `file://${racine}`, join(clone, 'c')])
    assert.equal(estSuperficiel(forge(join(clone, 'c'))), true)
  } finally {
    jeter(racine)
    jeter(clone)
  }
})

test('#1803 : `dossierDesHooks` ne lit que stdout — sous un bruit stderr, les hooks vivants se lisent vivants', () => {
  const d = depotFeint(tmpdir(), () => ({ status: 0, stdout: 'scripts/git-hooks\n', stderr: 'warning: bruit\n' }))
  assert.equal(dossierDesHooks(d), 'scripts/git-hooks')
})

/** Dépôt jetable arrêté dans une fusion `--no-commit` de `branches` (une par fichier ajouté) : deux
 *  branches, c'est une fusion octopus. `fusionnes` : le sha de tête de chaque branche, dans l'ordre. */
function depotEnFusion(branches) {
  const { racine } = instanceDeDepot({ fichiers: { 'a.txt': 'a\n' }, message: 'socle' })
  const g = gitDe(racine, { net: true })
  const fusionnes = branches.map((branche) => {
    g('checkout', '-q', '-b', branche, 'main')
    writeFileSync(join(racine, `${branche}.txt`), `${branche}\n`)
    g('add', `${branche}.txt`); g('commit', '-q', '-m', branche)
    return g('rev-parse', 'HEAD')
  })
  g('checkout', '-q', 'main')
  g('merge', '-q', '--no-commit', '--no-ff', ...branches)
  return { racine, fusionnes, mergeHead: join(racine, '.git', 'MERGE_HEAD') }
}

test('fusionnesEnCours : hors fusion, `[]`', () => {
  const { racine } = depot()
  try {
    assert.deepEqual(fusionnesEnCours(forge(racine)), [])
  } finally { jeter(racine) }
})

test('fusionnesEnCours : une fusion simple rend le commit fusionné', () => {
  const { racine, fusionnes } = depotEnFusion(['cote'])
  try {
    assert.deepEqual(fusionnesEnCours(forge(racine)), fusionnes)
  } finally { jeter(racine) }
})

test('fusionnesEnCours : une fusion OCTOPUS rend ses deux lignes de `MERGE_HEAD`, dans l’ordre', () => {
  const { racine, fusionnes, mergeHead } = depotEnFusion(['un', 'deux'])
  try {
    assert.equal(readFileSync(mergeHead, 'utf8'), `${fusionnes.join('\n')}\n`, 'témoin : git écrit une ligne par commit')
    assert.deepEqual(fusionnesEnCours(forge(racine)), fusionnes)
  } finally { jeter(racine) }
})

test('fusionnesEnCours : une ligne de `MERGE_HEAD` qui ne nomme aucun commit est un dépôt CORROMPU, jamais filtrée', () => {
  const { racine, fusionnes, mergeHead } = depotEnFusion(['cote'])
  try {
    for (const ligne of [ZERO, 'pas-un-commit', '', '-x']) {
      writeFileSync(mergeHead, `${fusionnes[0]}\n${ligne}\n`)
      assert.throws(() => fusionnesEnCours(forge(racine)), (e) => e instanceof GitIndisponible && e.raison.startsWith('dépôt corrompu : MERGE_HEAD'), JSON.stringify(ligne))
      const pannes = []
      assert.deepEqual(fusionnesEnCours(depotDe(racine, { env: envDeDepotForge(), enPanne: (r) => pannes.push(r) })), [], JSON.stringify(ligne))
      assert.deepEqual(pannes, [`dépôt corrompu : MERGE_HEAD, « ${ligne} » ne nomme aucun commit`], JSON.stringify(ligne))
    }
  } finally { jeter(racine) }
})

test('fusionnesEnCours : un `MERGE_HEAD` illisible est INDISPONIBLE, jamais « hors fusion »', () => {
  const { racine, mergeHead } = depotEnFusion(['cote'])
  try {
    rmSync(mergeHead)
    mkdirSync(mergeHead)
    assert.throws(() => fusionnesEnCours(forge(racine)), (e) => e instanceof GitIndisponible && /^MERGE_HEAD illisible : EISDIR/.test(e.raison))
    const pannes = []
    assert.deepEqual(fusionnesEnCours(depotDe(racine, { env: envDeDepotForge(), enPanne: (r) => pannes.push(r) })), [])
    assert.equal(pannes.length, 1, JSON.stringify(pannes))
    assert.match(pannes[0], /^MERGE_HEAD illisible : EISDIR/)
  } finally { jeter(racine) }
})

test('fusionnesEnCours : git EN PANNE sur les lignes de `MERGE_HEAD` — UNE requête, UNE panne, la sienne', () => {
  const cwd = mkdtempSync(join(tmpdir(), 'merge-head-panne-'))
  try {
    writeFileSync(join(cwd, 'MERGE_HEAD'), `${'a'.repeat(40)}\n${'b'.repeat(40)}\n`)
    const requetes = []
    const repondre = (args) => {
      requetes.push(args.slice(0, 2))
      return args[1] === '--git-path' ? { status: 0, stdout: `${args[2]}\n`, stderr: '' } : { status: 128, stdout: '', stderr: 'fatal: boum\n' }
    }
    assert.throws(() => fusionnesEnCours(depotFeint(cwd, repondre)), (e) => e instanceof GitIndisponible && e.raison === 'fatal: boum\n')
    const pannes = []
    requetes.length = 0
    assert.deepEqual(fusionnesEnCours(depotFeint(cwd, repondre, (r) => pannes.push(r))), [])
    assert.deepEqual(pannes, ['fatal: boum\n'])
    assert.deepEqual(requetes, [['rev-parse', '--git-path'], ['cat-file', '--batch-check']])
  } finally { jeter(cwd) }
})

test('rebaseEntame : `null` hors rebase, puis le NOM du chemin d’état présent sous le répertoire git', () => {
  const { racine } = depot()
  try {
    const d = forge(racine)
    assert.equal(rebaseEntame(d), null)
    for (const nom of ['rebase-merge', 'rebase-apply']) {
      mkdirSync(join(racine, '.git', nom))
      assert.equal(rebaseEntame(d), nom)
      rmSync(join(racine, '.git', nom), { recursive: true })
    }
  } finally { jeter(racine) }
})

test('ENV_GIT_FEINT : la règle qui s’applique répond SANS processus, git répond au reste ; une valeur mal formée est une panne NOMMÉE, sans processus', () => {
  const lances = []
  const spawn = (_git, args) => { lances.push(args.slice(OPTIONS_DE_L_HOTE.length)); return { status: 0, stdout: 'vrai\n', stderr: '' } }
  const sous = (valeur) => depotDe(tmpdir(), { spawn, env: { [ENV_GIT_FEINT]: valeur } })
  const regles = JSON.stringify([{ si: ['--git-path', 'rebase-merge'], status: 0, stdout: 'feint\n' }])
  const journal = []
  const ecrire = process.stderr.write
  process.stderr.write = (texte) => journal.push(String(texte))
  let feint
  try { feint = cheminGit(sous(regles), 'rebase-merge') } finally { process.stderr.write = ecrire }
  assert.equal(feint, 'feint')
  assert.deepEqual(journal, [`${MARQUE_FEINTE} : git rev-parse (0)\n`], 'la réponse feinte se MARQUE sur stderr')
  assert.deepEqual(lances, [])
  assert.equal(cheminGit(sous(regles), 'rebase-apply'), 'vrai')
  assert.deepEqual(lances, [['rev-parse', '--git-path', 'rebase-apply']])
  for (const [valeur, raison] of [
    ['{', /^WFRP_GIT_FEINT illisible : /],
    ['[{"si":"--git-path","status":0}]', /^WFRP_GIT_FEINT : une liste de règles/],
    ['[{"si":[],"status":"0"}]', /^WFRP_GIT_FEINT : une liste de règles/],
    ['[{"si":[],"absent":true,"status":0}]', /^WFRP_GIT_FEINT : une liste de règles/],
  ]) {
    assert.throws(() => cheminGit(sous(valeur), 'x'), (e) => e instanceof GitIndisponible && raison.test(e.raison), valeur)
  }
  assert.equal(lances.length, 1, 'une valeur mal formée ne lance pas git')
  const introuvable = classer({ error: Object.assign(new Error('spawnSync git ENOENT'), { code: 'ENOENT' }), status: null }, { cwd: tmpdir() })
  process.stderr.write = () => true
  try {
    assert.throws(() => cheminGit(sous(JSON.stringify([{ si: [], absent: true }])), 'x'),
      (e) => e instanceof GitIndisponible && e.raison === introuvable.raison && /^git introuvable/.test(e.raison), 'absent : la raison d’un git introuvable')
  } finally { process.stderr.write = ecrire }
  assert.equal(lances.length, 1, 'un binaire absent ne lance rien')
})

/** Un FAUX git (`process.execPath` sur un script du banc) qui sort en `code` avec `stderr` SANS lire son
 *  entrée : `fn(depot)`, sous 8 Mo d'entrée, perd TOUJOURS la course de l'écriture (pas de course). */
function sousUnGitQuiNeLitPas(code, stderr, fn) {
  const dossier = mkdtempSync(join(tmpdir(), 'faux-git-'))
  try {
    const script = join(dossier, 'faux-git.mjs')
    writeFileSync(script, `process.stderr.write(${JSON.stringify(stderr)})\nprocess.exit(${code})\n`)
    const vus = []
    const spawn = (_git, _args, options) => {
      const vu = spawnSync(process.execPath, [script], options)
      vus.push(vu.error?.code)
      return vu
    }
    return fn(depotDe(dossier, { env: envDeDepotForge(), spawn }), vus)
  } finally { jeter(dossier) }
}

test('une ENTRÉE que git ne lit pas (EPIPE, EOF) ne masque jamais son statut : sorti en 128, la cause est son stderr ; sorti en 0, l’entrée non lue se NOMME', () => {
  const revisions = Array.from({ length: 100000 }, (_, i) => i.toString(16).padStart(40, 'a'))
  sousUnGitQuiNeLitPas(128, 'fatal: not a git repository (faux git)\n', (d, vus) => {
    assert.throws(() => commitsNommes(d, revisions), (e) => e instanceof GitIndisponible && /^fatal: not a git repository \(faux git\)/.test(e.raison), 'la cause est le stderr de git')
    assert.ok(['EPIPE', 'EOF'].includes(vus[0]), `témoin : l'écriture de l'entrée a perdu la course (${vus[0]})`)
  })
  sousUnGitQuiNeLitPas(0, '', (d, vus) => {
    assert.throws(() => commitsNommes(d, revisions), (e) => e instanceof GitIndisponible && /sorti en 0 sans lire son entrée en entier \((EPIPE|EOF)\)/.test(e.raison))
    assert.ok(['EPIPE', 'EOF'].includes(vus[0]), `témoin : l'écriture de l'entrée a perdu la course (${vus[0]})`)
  })
})

for (const [nom, repondre, raison] of [
  ['panne newline', () => ({ status: 128, stdout: '', stderr: 'fatal: boum\n' }), /^fatal: boum\n$/],
  ['panne cause tardive', () => ({ status: 128, stdout: '', stderr: `${'note de refus\n'.repeat(50)}fatal: cause tardive\n` }), /^note de refus\n(?:note de refus\n){49}fatal: cause tardive\n$/],
  ['NUL', (args) => ({ status: 0, stdout: `x\0/${args[2]}\n`, stderr: '' }), /^rebase-merge illisible : octet nul dans le chemin que git rend/],
]) test(`rebaseEntame : git en panne ou chemin d’état ILLISIBLE — ${nom}`, () => {
    assert.throws(() => rebaseEntame(depotFeint(tmpdir(), repondre)), (e) => e instanceof GitIndisponible && raison.test(e.raison), String(raison))
    const pannes = []
    assert.equal(rebaseEntame(depotFeint(tmpdir(), repondre, (r) => pannes.push(r))), null)
    assert.equal(pannes.length, 1, JSON.stringify(pannes))
    assert.match(pannes[0], raison)
})


// #2294

/** Le dépôt des cas bords, et chaque commit nommé. */
function depotDesBords() {
  const { racine, sha: socle } = instanceDeDepot({ fichiers: { 'src/a.txt': 'a\n', README: 'r\n' }, message: 'racine' })
  const ecrire = (rel, texte) => { mkdirSync(join(racine, rel, '..'), { recursive: true }); writeFileSync(join(racine, rel), texte) }
  const g = gitDe(racine, { net: true }); g('config', 'core.fileMode', 'false') // le mode ne vit que dans l'index (`update-index --chmod`) : même banc sous win32 et Linux
  const commit = (message) => { g('add', '-A'); g('commit', '-q', '--no-verify', '-m', message); return g('rev-parse', 'HEAD') }
  const c = { racine: socle }
  g('mv', 'src/a.txt', 'src/b.txt'); c.renommage = commit('renommage')
  g('update-index', '--chmod=+x', 'src/b.txt'); g('commit', '-q', '--no-verify', '-m', 'mode'); c.mode = g('rev-parse', 'HEAD')
  g('commit', '-q', '--no-verify', '--allow-empty', '-m', 'vide'); c.vide = g('rev-parse', 'HEAD')
  ecrire('src/dossier é/fi chier.txt', 'z\n'); ecrire('scripts/ü ñ.md', 'n\n'); c.espaces = commit('espaces')
  g('update-index', '--add', '--cacheinfo', `160000,${c.racine},src/sub`); g('commit', '-q', '--no-verify', '-m', 'gitlink'); c.gitlink = g('rev-parse', 'HEAD')
  g('checkout', '-q', '-b', 'cote'); ecrire('src/x.txt', 'x\n'); c.cote = commit('cote')
  g('checkout', '-q', 'main'); ecrire('notes/z.md', 'z\n'); c.principal = commit('principal')
  g('merge', '-q', '--no-ff', '--no-verify', '-m', 'propre', 'cote'); c.fusionPropre = g('rev-parse', 'HEAD')
  g('checkout', '-q', '-b', 'retouche'); ecrire('notes/r.md', 'r\n'); c.retouche = commit('retouche')
  g('checkout', '-q', 'main'); g('merge', '-q', '--no-ff', '--no-commit', 'retouche'); ecrire('src/ajout.txt', 'e\n'); c.fusionRetouchee = commit('retouchée')
  g('checkout', '-q', '--orphan', 'orpheline'); g('rm', '-rqf', '--cached', '.')
  for (const d of ['src', 'notes', 'scripts', 'README']) rmSync(join(racine, d), { recursive: true, force: true })
  ecrire('autre/o.txt', 'o\n'); c.orpheline = commit('racine orpheline')
  g('checkout', '-q', '-f', 'main'); g('clean', '-qfdx')
  g('merge', '-q', '--no-verify', '--allow-unrelated-histories', '-m', 'sans ancêtre', 'orpheline'); c.fusionSansAncetre = g('rev-parse', 'HEAD')
  for (const n of [1, 2]) { g('checkout', '-q', '-b', `o${n}`, c.fusionSansAncetre); ecrire(`notes/o${n}.md`, `${n}\n`); c[`o${n}`] = commit(`o${n}`) }
  g('checkout', '-q', 'main'); ecrire('notes/o3.md', '3\n'); c.o3 = commit('o3')
  g('merge', '-q', '--no-verify', '-m', 'octopus', 'o1', 'o2'); c.octopus = g('rev-parse', 'HEAD')
  g('tag', '-a', '-m', 'étiquette', 'v1', c.fusionPropre)
  return { racine, c, g }
}

/** Le dépôt des cas bords, forgé une fois pour les bancs qui ne font que le LIRE. */
let bords = null
const lesBords = () => (bords ??= depotDesBords())
after(() => bords && jeter(bords.racine))

test('grapheDe : arbre et parents de chaque commit, racine, fusion sans ancêtre commun et octopus compris (#2294)', () => {
  const { racine, c, g } = lesBords()
  const graphe = grapheDe(forge(racine), ['main'])
  const tous = g('rev-list', '--reverse', 'main').split('\n')
  assert.deepEqual(graphe.map((x) => x.sha), tous, 'du plus ancien au plus récent, comme rev-list --reverse')
  for (const commit of graphe) {
    assert.equal(commit.arbre, g('rev-parse', `${commit.sha}^{tree}`), commit.sha)
    assert.deepEqual(commit.parents, g('rev-parse', `${commit.sha}^@`).split('\n').filter(Boolean), commit.sha)
  }
  const de = (sha) => graphe.find((x) => x.sha === sha)
  assert.deepEqual(de(c.racine).parents, [])
  assert.deepEqual(de(c.orpheline).parents, [])
  assert.deepEqual(de(c.fusionSansAncetre).parents, [c.fusionRetouchee, c.orpheline])
  assert.deepEqual(de(c.octopus).parents, [c.o3, c.o1, c.o2])
  assert.equal(grapheDe(forge(racine), ['deadbeef..main']), null, 'une plage que git ne rend pas : null')
})

test('ceQueFontLesCommits : gitlink, mode seul, renommage, commit vide, espaces et non-ASCII — les VALEURS (#2294)', () => {
  const { racine, c } = lesBords()
  const d = forge(racine)
  const simples = grapheDe(d, ['main']).filter((x) => x.parents.length <= 1)
  const chemins = ceQueFontLesCommits(d, simples).chemins()
  const trie = (sha) => [...chemins.get(sha)].sort(parUnitesDeCode)
  assert.deepEqual(trie(c.racine), ['README', 'src/a.txt'])
  assert.deepEqual(trie(c.renommage), ['src/a.txt', 'src/b.txt'], 'un renommage en ses deux bouts')
  assert.deepEqual(trie(c.mode), ['src/b.txt'], 'un changement de mode seul est un chemin touché')
  assert.deepEqual(trie(c.vide), [])
  assert.deepEqual(trie(c.espaces), ['scripts/ü ñ.md', 'src/dossier é/fi chier.txt'])
  assert.deepEqual(trie(c.gitlink), ['src/sub'], 'un gitlink est un chemin')
  assert.deepEqual(trie(c.orpheline), ['autre/o.txt'], 'une seconde racine se lit contre l’arbre vide')
  for (const commit of simples) assert.deepEqual(trie(commit.sha), [...ceQueFaitLeCommit(d, commit.sha).chemins()].sort(parUnitesDeCode), commit.sha)
})

test('ceQueFontLesCommits : fusions et commits simples d’UN lot rendent ce que ceQueFaitLeCommit rend de chacun ; l’octopus LÈVE (#2294)', () => {
  const { racine, c } = lesBords()
  const d = forge(racine)
  const graphe = grapheDe(d, ['main'])
  const lot = graphe.filter((x) => x.parents.length <= 2)
  assert.ok(lot.filter((x) => x.parents.length === 2).length >= 3, 'témoin : propre, sans ancêtre commun, retouchée')
  const fait = ceQueFontLesCommits(d, lot)
  for (const commit of lot) {
    const seul = ceQueFaitLeCommit(d, commit)
    assert.deepEqual([...fait.chemins().get(commit.sha)].sort(parUnitesDeCode), [...seul.chemins()].sort(parUnitesDeCode), commit.sha)
    assert.deepEqual(fait.patchs().get(commit.sha), patchsParChemin(seul.diff()), commit.sha)
  }
  assert.deepEqual(fait.chemins().get(c.fusionRetouchee), ['src/ajout.txt'], 'seule la retouche est l’apport de la fusion')
  assert.throws(() => ceQueFontLesCommits(d, graphe).chemins(), (e) => e instanceof GitIndisponible && /3 parents/.test(e.raison))
})

test('ceQueFaitLeCommit d’une FUSION lue dans le graphe : propre, sans ancêtre commun, retouchée, octopus (#2294)', () => {
  const { racine, c } = lesBords()
  const d = forge(racine)
  const graphe = new Map(grapheDe(d, ['main']).map((x) => [x.sha, x]))
  assert.deepEqual(ceQueFaitLeCommit(d, graphe.get(c.fusionPropre)).chemins(), [])
  assert.deepEqual(ceQueFaitLeCommit(d, graphe.get(c.fusionSansAncetre)).chemins(), [])
  assert.deepEqual(ceQueFaitLeCommit(d, graphe.get(c.fusionRetouchee)).chemins(), ['src/ajout.txt'], 'seule la retouche est l’apport de la fusion')
  assert.throws(() => ceQueFaitLeCommit(d, graphe.get(c.octopus)), (e) => e instanceof GitIndisponible && /3 parents/.test(e.raison))
})

test('commitsNommes : sha complet ou abrégé, étiquette pelée ; arbre, blob et inconnu ne nomment aucun commit (#2294)', () => {
  const { racine, c, g } = lesBords()
  const noms = [c.principal, c.principal.slice(0, 7), 'v1', g('rev-parse', `${c.octopus}^{tree}`), g('rev-parse', 'HEAD:notes/z.md'), 'deadbee']
  assert.deepEqual(commitsNommes(forge(racine), noms), [c.principal, c.principal, c.fusionPropre, null, null, null])
  assert.deepEqual(commitsNommes(forge(racine), []), [])
})

test('ceQueFontLesCommits, patchs : le patch de chaque commit découpé par chemin, espaces et non-ASCII compris (#2294)', () => {
  const { racine, c } = lesBords()
  const d = forge(racine)
  const graphe = new Map(grapheDe(d, ['main']).map((x) => [x.sha, x]))
  const patchs = ceQueFontLesCommits(d, [graphe.get(c.espaces), graphe.get(c.fusionPropre)]).patchs()
  assert.deepEqual([...patchs.get(c.espaces).keys()].sort(parUnitesDeCode), ['scripts/ü ñ.md', 'src/dossier é/fi chier.txt'])
  assert.match(patchs.get(c.espaces).get('src/dossier é/fi chier.txt'), /\n@@ -0,0 \+1 @@\n\+z(?:\n|$)/)
  assert.deepEqual([...patchs.get(c.fusionPropre)], [], 'une fusion propre n’a aucun patch')
})

test('patchsParChemin : un en-tête CITÉ (core.quotePath) se décode, un changement de type joint ses deux sections, un en-tête hors forme LÈVE (#2294)', () => {
  const cite = 'diff --git "a/x\\"y\\303\\251" "b/x\\"y\\303\\251"\nnew file mode 100644\n@@ -0,0 +1 @@\n+q'
  assert.deepEqual([...patchsParChemin(cite)], [['x"yé', cite]])
  const type = 'diff --git a/l b/l\ndeleted file mode 100644\n@@ -1 +0,0 @@\n-a\ndiff --git a/l b/l\nnew file mode 120000\n@@ -0,0 +1 @@\n+cible'
  assert.deepEqual([...patchsParChemin(type)], [['l', type]])
  assert.throws(() => patchsParChemin('diff --git a/x b/y\n'), /patch illisible/)
})

test('clone SUPERFICIEL : la borne se lit comme une racine (#2294)', () => {
  const { racine } = lesBords()
  const clone = mkdtempSync(join(tmpdir(), 'superficiel-'))
  try {
    lancerGit(['clone', '-q', '--no-local', '--depth', '2', `file://${racine.replace(/\\/g, '/')}`, join(clone, 'c')], { cwd: tmpdir() })
    const d = forge(join(clone, 'c'))
    const graphe = grapheDe(d, ['HEAD'])
    const borne = graphe.find((x) => x.parents.length === 0)
    assert.ok(borne, `graphe : ${JSON.stringify(graphe)}`)
    const tout = lancerGit(['ls-tree', '-r', '-z', '--name-only', borne.sha], { cwd: join(clone, 'c') }).split('\0').filter(Boolean).sort(parUnitesDeCode)
    assert.deepEqual([...ceQueFontLesCommits(d, [borne]).chemins().get(borne.sha)].sort(parUnitesDeCode), tout, 'la borne apporte tout son arbre')
  } finally { jeter(clone) }
})
