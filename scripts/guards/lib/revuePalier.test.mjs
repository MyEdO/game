// LA MESURE DU PALIER lance un nombre de processus git BORNÉ (#2294) : ni le nombre de revues
// archivées, ni la longueur de la fenêtre, ni ses fusions ne le font croître. Les lancements se
// comptent au PROCESSUS (`lancesDeGit`, gitDeBanc.mjs), contre git RÉEL, sans git feinte.
import test from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { depotReel, envDeDepotForge, instanceDeDepot } from './depotGabarit.mjs'
import { gitDe, lancesDeGit, sousCommande } from '../../test/gitDeBanc.mjs'
import { GitIndisponible, depotDe, grapheDe } from './gitPorte.mjs'
import { derniereRevueArchivee, histoireDeHead, mesureDuPalier, nomDArchiveDeRevue, shasDeSubstance } from './revuePalier.mjs'

const JOUR = '2026-10-05'

/** L'erreur que lève `fn`. */
const erreurDe = (fn) => {
  try { fn() } catch (e) { return e }
  throw new Error('erreurDe : fn n’a rien levé')
}

/** Un dépôt forgé dont la racine porte `fichiers`, et ses gestes : commit, revue archivée. */
function depotForge(fichiers = { 'scripts/racine.txt': 'racine\n' }) {
  const { racine: dossier, sha: racine } = instanceDeDepot({ fichiers, message: 'racine' })
  const git = gitDe(dossier, { net: true })
  const commit = (marque, dossierDuFichier = 'scripts') => {
    mkdirSync(join(dossier, dossierDuFichier), { recursive: true })
    writeFileSync(join(dossier, dossierDuFichier, `${marque}.txt`), `${marque}\n`)
    git('add', '-A')
    git('commit', '-q', '-m', marque)
    return git('rev-parse', 'HEAD')
  }
  /** Archive dans HEAD une revue de fenêtre `0000000..<tête>`, sous son nom d'archive. */
  const archiver = (...tetes) => {
    mkdirSync(join(dossier, '.claude', 'soldes'), { recursive: true })
    for (const tete of tetes) {
      const contenu = `# PALIER (${JOUR})\n\nverdict: CONFIRMÉ\n\n\`0000000..${tete}\`\n`
      writeFileSync(join(dossier, '.claude', 'soldes', nomDArchiveDeRevue(contenu)), contenu)
    }
    git('add', '-A')
    git('commit', '-q', '-m', `revues ${tetes.length}`)
  }
  return { dossier, racine, git, commit, archiver, jeter: () => rmSync(dossier, { recursive: true, force: true }) }
}

test('GARDE DE CLASSE : mesureDuPalier lance autant de processus git avec N et 2N revues archivées', () => {
  const d = depotForge()
  try {
    const tetes = ['a', 'b', 'c', 'd', 'e', 'f'].map((m) => d.commit(m))
    d.archiver(...tetes.slice(0, 3))
    d.commit('apres-n')
    const n = lancesDeGit(() => mesureDuPalier(d.dossier))
    assert.ok(n.lances.length > 0, 'témoin : le compte voit les processus de la mesure')
    assert.deepEqual(n.valeur, { compte: 4, tete: tetes[2], chemin: `.claude/soldes/revue-palier-${JOUR}-0000000-${tetes[2]}.md` }, 'témoin : la mesure lit la revue la plus proche de HEAD')

    d.archiver(...tetes.slice(3))
    d.commit('apres-2n')
    const deuxN = lancesDeGit(() => mesureDuPalier(d.dossier))
    assert.equal(deuxN.valeur.tete, tetes[5], 'témoin : les N revues de plus sont lues')
    assert.equal(deuxN.valeur.compte, 2)
    assert.deepEqual(deuxN.lances.map(sousCommande), n.lances.map(sousCommande),
      `N revues : ${n.lances.length} processus ; 2N revues : ${deuxN.lances.length} — une revue archivée de plus ne coûte aucun processus`)
  } finally { d.jeter() }
})

test('GARDE DE CLASSE : shasDeSubstance lance autant de processus git sur K et 2K commits à un parent', () => {
  const d = depotForge()
  try {
    const lancesSur = (k) => {
      const socle = d.git('rev-parse', 'HEAD')
      for (let i = 0; i < k; i += 1) d.commit(`k${k}-${i}`, i % 2 ? 'scripts' : 'notes')
      const { valeur: vus, lances } = lancesDeGit(() => shasDeSubstance(depotReel(d.dossier), [`${socle}..HEAD`]))
      assert.equal(vus.length, Math.floor(k / 2), 'témoin : un commit sur deux est de substance')
      assert.ok(lances.length > 0, 'témoin : le compte voit les processus de la lecture')
      return lances.map(sousCommande)
    }
    assert.deepEqual(lancesSur(6), lancesSur(3))
  } finally { d.jeter() }
})

test('shasDeSubstance : la RACINE se lit contre l’arbre vide — elle est de substance si elle touche src', () => {
  const d = depotForge({ 'src/socle.txt': 'socle\n' })
  try {
    d.commit('doc', 'notes')
    assert.deepEqual(shasDeSubstance(depotReel(d.dossier), ['HEAD']), [d.racine])
  } finally { d.jeter() }
})

test('shasDeSubstance : une FUSION au-delà de la limite n’est jamais évaluée', () => {
  const d = depotForge()
  try {
    const socle = d.git('rev-parse', 'HEAD')
    d.git('checkout', '-q', '-b', 'cote')
    const deCote = d.commit('cote')
    d.git('checkout', '-q', 'main')
    const deMain = d.commit('main')
    d.git('merge', '-q', '--no-ff', '-m', 'fusion', 'cote')
    const pleine = lancesDeGit(() => shasDeSubstance(depotReel(d.dossier), [`${socle}..HEAD`]))
    assert.deepEqual(new Set(pleine.valeur), new Set([deCote, deMain]), 'témoin : la fusion propre n’est pas de substance')
    assert.ok(pleine.lances.some((a) => sousCommande(a) === 'merge-tree'), 'témoin : sans limite, la fusion se lit par sa fusion automatique')
    const borne = lancesDeGit(() => shasDeSubstance(depotReel(d.dossier), [`${socle}..HEAD`], { limite: 1 }))
    assert.equal(borne.valeur.length, 1)
    assert.deepEqual(borne.lances.filter((a) => sousCommande(a) === 'merge-tree'), [], 'la limite est atteinte avant la fusion : aucune fusion automatique')
  } finally { d.jeter() }
})

test('GARDE DE CLASSE : la mesure du palier lance autant de processus git sur K=2 et K=8 fusions propres dans la fenêtre', () => {
  const lancesSur = (k) => {
    const d = depotForge()
    try {
      d.archiver(d.commit('tete'))
      for (let i = 0; i < k; i += 1) {
        d.git('checkout', '-q', '-b', `b${i}`)
        d.commit(`b${i}`, 'docs')
        d.git('checkout', '-q', 'main')
        d.commit(`m${i}`, 'docs')
        d.git('merge', '-q', '--no-ff', '-m', `fusion ${i}`, `b${i}`)
      }
      const { valeur, lances } = lancesDeGit(() => mesureDuPalier(d.dossier, { seuil: 10, emportes: ['scripts/x.mjs'] }))
      assert.deepEqual({ compte: valeur.compte, erreur: valeur.erreur }, { compte: 1, erreur: undefined }, 'témoin : seul le commit en cours est de substance, aucune fusion propre')
      assert.equal(lances.filter((a) => sousCommande(a) === 'merge-tree').length, 1, `${k} fusions propres : une seule fusion automatique, en lot`)
      return lances.map(sousCommande)
    } finally { d.jeter() }
  }
  const deux = lancesSur(2)
  const huit = lancesSur(8)
  assert.deepEqual(huit, deux, `K=2 : ${deux.length} processus ; K=8 : ${huit.length}`)
})

/**
 * Deux commits de même parent `racine` dont les shas partagent leurs 7 premiers caractères au moins :
 * l'un dans HEAD, l'autre hors de HEAD. Parmi les seuls commits du graphe de HEAD, un préfixe de 7
 * est unique ; git le résout parmi TOUS les objets du dépôt (`commitsNommes`) et le dit ambigu, comme
 * `merge-base --is-ancestor` avant lui. Rend la paire posée et la longueur de son préfixe COMMUN.
 */
function poserUnePaireAmbigue(d, racine) {
  const arbre = d.git('rev-parse', 'HEAD^{tree}')
  const signature = 'mesure <mesure@example.invalid> 1700000000 +0000'
  const shaDuCommit = (message) => {
    const corps = `tree ${arbre}\nparent ${racine}\nauthor ${signature}\ncommitter ${signature}\n\n${message}\n`
    return createHash('sha1').update(`commit ${Buffer.byteLength(corps)}\0${corps}`).digest('hex')
  }
  const vus = new Map()
  let paire = null
  for (let i = 0; !paire; i += 1) {
    const sha = shaDuCommit(`m${i}`)
    const autre = vus.get(sha.slice(0, 7))
    if (autre !== undefined) paire = [autre, i]
    else vus.set(sha.slice(0, 7), i)
  }
  const env = { ...envDeDepotForge(), GIT_AUTHOR_DATE: '1700000000 +0000', GIT_COMMITTER_DATE: '1700000000 +0000' }
  const poser = (i) => gitDe(d.dossier, { env, net: true })('commit-tree', arbre, '-p', racine, '-m', `m${i}`)
  const [dansHead, horsHead] = paire.map(poser)
  assert.equal(dansHead, shaDuCommit(`m${paire[0]}`), 'témoin : le sha forgé est celui que git écrit')
  let commun = 0
  while (dansHead[commun] === horsHead[commun]) commun += 1
  assert.ok(commun >= 7, `témoin : les deux commits partagent ${commun} caractères`)
  d.git('update-ref', 'refs/heads/cote', horsHead)
  d.git('reset', '-q', '--hard', dansHead)
  return { dansHead, commun }
}

test('derniereRevueArchivee : une tête que git dit AMBIGUË ne juge rien, même unique parmi les commits de HEAD', () => {
  const d = depotForge()
  try {
    const { dansHead, commun } = poserUnePaireAmbigue(d, d.racine)
    d.archiver(dansHead.slice(0, 7))
    const depot = depotReel(d.dossier)
    assert.equal((grapheDe(depot, ['HEAD']) ?? []).filter((c) => c.sha.startsWith(dansHead.slice(0, 7))).length, 1, 'témoin : unique parmi les commits de HEAD')
    assert.equal(derniereRevueArchivee(d.dossier, { depot }).etat, 'toutes-orphelines')
    d.archiver(dansHead.slice(0, commun + 1))
    const trouvee = derniereRevueArchivee(d.dossier, { depot: depotReel(d.dossier) })
    assert.equal(trouvee.tete, dansHead.slice(0, commun + 1), 'le préfixe que git résout, lui, juge')
    assert.equal(trouvee.reste, 2)
  } finally { d.jeter() }
})

test('derniereRevueArchivee : une paire qui partage 9 caractères laisse le préfixe de 9 AMBIGU — seul un préfixe plus long que le commun juge', () => {
  const d = depotForge()
  try {
    // La racine de date 1600000164 donne une paire qui partage 9 caractères.
    const identite = { GIT_AUTHOR_NAME: 'mesure', GIT_AUTHOR_EMAIL: 'mesure@example.invalid', GIT_COMMITTER_NAME: 'mesure', GIT_COMMITTER_EMAIL: 'mesure@example.invalid' }
    const env = { ...envDeDepotForge(), ...identite, GIT_AUTHOR_DATE: '1600000164 +0000', GIT_COMMITTER_DATE: '1600000164 +0000' }
    const racine = gitDe(d.dossier, { env, net: true })('commit-tree', d.git('rev-parse', 'HEAD^{tree}'), '-m', 'racine')
    const { dansHead, commun } = poserUnePaireAmbigue(d, racine)
    assert.equal(commun, 9, 'témoin : la paire partage 9 caractères')
    d.archiver(dansHead.slice(0, 9))
    assert.equal(derniereRevueArchivee(d.dossier, { depot: depotReel(d.dossier) }).etat, 'toutes-orphelines', 'un préfixe de 9 reste ambigu')
    d.archiver(dansHead.slice(0, commun + 1))
    const trouvee = derniereRevueArchivee(d.dossier, { depot: depotReel(d.dossier) })
    assert.equal(trouvee.tete, dansHead.slice(0, commun + 1))
    assert.equal(trouvee.reste, 2)
  } finally { d.jeter() }
})

test('histoireDeHead : la tête de 1 ou de 3 revues neuves se juge dans HEAD en autant de processus git', () => {
  const d = depotForge()
  try {
    const tetes = ['a', 'b'].map((m) => d.commit(m))
    d.git('checkout', '-q', '-b', 'cote', d.racine)
    const horsHead = d.commit('cote')
    d.git('checkout', '-q', 'main')
    const juger = (shas) => {
      const { valeur: dedans, lances } = lancesDeGit(() => histoireDeHead(depotReel(d.dossier)).dansHead(shas))
      assert.ok(lances.length > 0, 'témoin : le compte voit les processus du jugement')
      return { lances: lances.map(sousCommande), dedans }
    }
    const une = juger([tetes[0]])
    const trois = juger([tetes[1].slice(0, 9), horsHead, 'deadbee'])
    assert.deepEqual(une.dedans, [true])
    assert.deepEqual(trois.dedans, [true, false, false], 'témoin : dans HEAD, hors de HEAD, inconnu')
    assert.deepEqual(trois.lances, une.lances, `1 tête : ${une.lances.length} processus ; 3 têtes : ${trois.lances.length}`)
  } finally { d.jeter() }
})

test('mesureDuPalier : une erreur de PROGRAMME remonte ; une lecture git indisponible rend le palier INMESURABLE', () => {
  const d = depotForge()
  try {
    d.archiver(d.commit('a'))
    const bug = depotDe(d.dossier, { env: envDeDepotForge(), spawn: () => { throw new TypeError('bug injecté') } })
    assert.throws(() => mesureDuPalier(d.dossier, { depot: bug }), (e) => e instanceof TypeError && e.message === 'bug injecté')
    // Une erreur INTERNE de Node porte un `code` (`ERR_INVALID_ARG_TYPE`) : c'est une erreur de programme.
    const interne = erreurDe(() => Buffer.from(123))
    assert.equal(interne.code, 'ERR_INVALID_ARG_TYPE', 'témoin : une vraie erreur interne de Node')
    const parInterne = depotDe(d.dossier, { env: envDeDepotForge(), spawn: () => { throw interne } })
    assert.throws(() => mesureDuPalier(d.dossier, { depot: parInterne }), (e) => e === interne)
    // Une erreur SYSTÈME (`ENOENT`) dit qu'une lecture n'a pas eu lieu.
    const systeme = erreurDe(() => readFileSync(join(d.dossier, 'jamais-la.txt')))
    assert.equal(systeme.code, 'ENOENT', 'témoin : une vraie erreur système')
    const parSysteme = depotDe(d.dossier, { env: envDeDepotForge(), spawn: () => { throw systeme } })
    assert.match(mesureDuPalier(d.dossier, { depot: parSysteme }).erreur, /^histoire illisible depuis .*ENOENT/)
    const stderr = 'note initiale\n'.repeat(45) + 'cause initiale tardive\n'
    const stdout = 'stdout initial distinct'
    assert.ok(stderr.indexOf('cause initiale tardive') > 400)
    assert.ok(stderr.endsWith('\n'))
    const panne = depotDe(d.dossier, { env: envDeDepotForge(), spawn: () => ({ status: 128, stdout, stderr }) })
    const mesure = mesureDuPalier(d.dossier, { depot: panne })
    assert.deepEqual({ ...mesure, erreur: undefined }, { compte: 0, tete: null, chemin: null, erreur: undefined })
    assert.equal(mesure.erreur, 'histoire illisible depuis ' + d.dossier + ' — refus (status 128) — ' + stderr + '\n' + stdout)
  } finally { d.jeter() }
})

test('un git plus ancien que 2.33 ne lit pas le graphe : la mesure du palier NOMME la version requise', () => {
  const d = depotForge()
  try {
    d.archiver(d.commit('a'))
    // git 2.30 ne connaît pas `rev-list --no-commit-header` : il rend son usage, code 129.
    const spawn = (commande, args, options) => (args.includes('--no-commit-header')
      ? { status: 129, stdout: '', stderr: 'usage: git rev-list [<options>] <commit>... [--] [<path>...]\n' }
      : args.includes('version') ? { status: 0, stdout: 'git version 2.30.2\n', stderr: '' }
        : spawnSync(commande, args, options))
    const depot = depotDe(d.dossier, { env: envDeDepotForge(), spawn })
    const mesure = mesureDuPalier(d.dossier, { depot })
    assert.deepEqual({ ...mesure, erreur: undefined }, { compte: 0, tete: null, chemin: null, erreur: undefined })
    assert.equal(mesure.erreur, 'ascendance indisponible : refus (status 129) — git 2.30 ne sait pas git rev-list --no-commit-header (git 2.33 ou plus) : le graphe des commits n’est pas lisible\nusage: git rev-list [<options>] <commit>... [--] [<path>...]\n — le palier ne se mesure pas sans git')
  } finally { d.jeter() }
})

test('#2285 legacy ascendance : diagnostic entier de la dernière archive', () => {
  const d = depotForge()
  try {
    d.archiver(d.commit('a'))
    const stderr = 'note ascendance\n'.repeat(45) + 'cause ascendance tardive\n'
    const stdout = 'stdout ascendance distinct'
    assert.ok(stderr.indexOf('cause ascendance tardive') > 400)
    assert.ok(stderr.endsWith('\n'))
    const erreur = new GitIndisponible({ disponible: false, raison: stderr, issue: 'refus', diagnostic: { status: 30, stdout, stderr } })
    const histoire = { restes: () => { throw erreur } }
    assert.deepEqual(derniereRevueArchivee(d.dossier, { depot: depotReel(d.dossier), histoire }),
      { etat: 'ascendance-indisponible', raison: 'refus (status 30) — ' + stderr + '\n' + stdout })
  } finally { d.jeter() }
})

test('#2285 legacy substance : refus final conserve tête et chemin', () => {
  const d = depotForge()
  try {
    const tete = d.commit('a')
    d.archiver(tete)
    const stderr = 'note substance\n'.repeat(45) + 'cause substance tardive\n'
    const stdout = 'stdout substance distinct'
    assert.ok(stderr.indexOf('cause substance tardive') > 400)
    assert.ok(stderr.endsWith('\n'))
    const spawn = (commande, args, options) => args.includes('rev-list')
      ? { status: 31, stdout, stderr } : spawnSync(commande, args, options)
    const depot = depotDe(d.dossier, { env: envDeDepotForge(), spawn })
    const histoire = { restes: (revisions) => {
      assert.deepEqual(revisions, [tete])
      return [0]
    } }
    assert.deepEqual(mesureDuPalier(d.dossier, { depot, histoire }), {
      compte: 0, tete, chemin: '.claude/soldes/revue-palier-' + JOUR + '-0000000-' + tete + '.md',
      erreur: 'ce que font les commits depuis ' + tete + ' est illisible : refus (status 31) — ' + stderr + '\n' + stdout,
    })
  } finally { d.jeter() }
})
