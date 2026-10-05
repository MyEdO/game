// LA MESURE DU PALIER lance un nombre de processus git BORNÉ (#2294) : ni le nombre de revues
// archivées, ni la longueur de la fenêtre ne le font croître. Les lancements se comptent par le
// `spawn` injecté (`depotCompte`, depotGabarit.mjs), contre git RÉEL, sans git feinte.
import test from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { execFileSync, spawnSync } from 'node:child_process'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { depotCompte, envDeDepotForge, instanceDeDepot } from './depotGabarit.mjs'
import { depotDe, grapheDe } from './gitPorte.mjs'
import { derniereRevueArchivee, histoireDeHead, mesureDuPalier, nomDArchiveDeRevue, shasDeSubstance } from './revuePalier.mjs'

const JOUR = '2026-10-05'

/** `git <args>` dans `cwd`, sous l'environnement forgé (`envDeDepotForge`) complété de `env` : le
 *  lancement brut de git de ce banc. */
const gitDuBanc = (cwd, args, { env = {} } = {}) =>
  execFileSync('git', args, { cwd, env: { ...envDeDepotForge(), ...env }, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()

/** Un dépôt forgé dont la racine porte `fichiers`, et ses gestes : commit, revue archivée. */
function depotForge(fichiers = { 'scripts/racine.txt': 'racine\n' }) {
  const { racine: dossier, sha: racine } = instanceDeDepot({ fichiers, message: 'racine' })
  const git = (...args) => gitDuBanc(dossier, args)
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

/** La sous-commande git d'une liste d'arguments lancée (après `-c <réglage>` et `--<option>`). */
const sousCommande = (args) => {
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === '-c') { i += 1; continue }
    if (!args[i].startsWith('-')) return args[i]
  }
  return null
}

test('GARDE DE CLASSE : mesureDuPalier lance autant de processus git avec N et 2N revues archivées', () => {
  const d = depotForge()
  try {
    const tetes = ['a', 'b', 'c', 'd', 'e', 'f'].map((m) => d.commit(m))
    d.archiver(...tetes.slice(0, 3))
    d.commit('apres-n')
    const n = depotCompte(d.dossier)
    const avecN = mesureDuPalier(d.dossier, { depot: n.depot })
    assert.deepEqual(avecN, { compte: 4, tete: tetes[2], chemin: `.claude/soldes/revue-palier-${JOUR}-0000000-${tetes[2]}.md` }, 'témoin : la mesure lit la revue la plus proche de HEAD')

    d.archiver(...tetes.slice(3))
    d.commit('apres-2n')
    const deuxN = depotCompte(d.dossier)
    const avec2N = mesureDuPalier(d.dossier, { depot: deuxN.depot })
    assert.equal(avec2N.tete, tetes[5], 'témoin : les N revues de plus sont lues')
    assert.equal(avec2N.compte, 2)
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
      const compte = depotCompte(d.dossier)
      const vus = shasDeSubstance(compte.depot, [`${socle}..HEAD`])
      assert.equal(vus.length, Math.floor(k / 2), 'témoin : un commit sur deux est de substance')
      return compte.lances.map(sousCommande)
    }
    assert.deepEqual(lancesSur(6), lancesSur(3))
  } finally { d.jeter() }
})

test('shasDeSubstance : la RACINE se lit contre l’arbre vide — elle est de substance si elle touche src', () => {
  const d = depotForge({ 'src/socle.txt': 'socle\n' })
  try {
    d.commit('doc', 'notes')
    const { depot } = depotCompte(d.dossier)
    assert.deepEqual(shasDeSubstance(depot, ['HEAD']), [d.racine])
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
    const pleine = depotCompte(d.dossier)
    assert.deepEqual(new Set(shasDeSubstance(pleine.depot, [`${socle}..HEAD`])), new Set([deCote, deMain]), 'témoin : la fusion propre n’est pas de substance')
    assert.ok(pleine.lances.some((a) => sousCommande(a) === 'merge-tree'), 'témoin : sans limite, la fusion se lit par sa fusion automatique')
    const borne = depotCompte(d.dossier)
    assert.equal(shasDeSubstance(borne.depot, [`${socle}..HEAD`], { limite: 1 }).length, 1)
    assert.deepEqual(borne.lances.filter((a) => sousCommande(a) === 'merge-tree'), [], 'la limite est atteinte avant la fusion : aucune fusion automatique')
  } finally { d.jeter() }
})

test('derniereRevueArchivee : une tête que git dit AMBIGUË ne juge rien, même unique parmi les commits de HEAD', () => {
  // Deux commits de même parent dont les shas partagent leurs 7 premiers caractères : l'un dans HEAD,
  // l'autre hors de HEAD. Parmi les seuls commits du graphe de HEAD, le préfixe est unique ; git le
  // résout parmi TOUS les objets du dépôt (`commitsNommes`) et le dit ambigu, comme
  // `merge-base --is-ancestor` avant lui.
  const d = depotForge()
  try {
    const arbre = d.git('rev-parse', 'HEAD^{tree}')
    const signature = 'mesure <mesure@example.invalid> 1700000000 +0000'
    const shaDuCommit = (message) => {
      const corps = `tree ${arbre}\nparent ${d.racine}\nauthor ${signature}\ncommitter ${signature}\n\n${message}\n`
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
    const env = { GIT_AUTHOR_DATE: '1700000000 +0000', GIT_COMMITTER_DATE: '1700000000 +0000' }
    const poser = (i) => gitDuBanc(d.dossier, ['commit-tree', arbre, '-p', d.racine, '-m', `m${i}`], { env })
    const [dansHead, horsHead] = paire.map(poser)
    assert.equal(dansHead, shaDuCommit(`m${paire[0]}`), 'témoin : le sha forgé est celui que git écrit')
    assert.equal(horsHead.slice(0, 7), dansHead.slice(0, 7), 'témoin : les deux commits partagent 7 caractères')
    d.git('update-ref', 'refs/heads/cote', horsHead)
    d.git('reset', '-q', '--hard', dansHead)
    d.archiver(dansHead.slice(0, 7))
    const { depot } = depotCompte(d.dossier)
    assert.equal((grapheDe(depot, ['HEAD']) ?? []).filter((c) => c.sha.startsWith(dansHead.slice(0, 7))).length, 1, 'témoin : unique parmi les commits de HEAD')
    assert.equal(derniereRevueArchivee(d.dossier, { depot }).etat, 'toutes-orphelines')
    d.archiver(dansHead.slice(0, 9))
    const trouvee = derniereRevueArchivee(d.dossier, { depot: depotCompte(d.dossier).depot })
    assert.equal(trouvee.tete, dansHead.slice(0, 9), 'le préfixe que git résout, lui, juge')
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
      const { depot, lances } = depotCompte(d.dossier)
      return { lances, dedans: histoireDeHead(depot).dansHead(shas) }
    }
    const une = juger([tetes[0]])
    const trois = juger([tetes[1].slice(0, 9), horsHead, 'deadbee'])
    assert.deepEqual(une.dedans, [true])
    assert.deepEqual(trois.dedans, [true, false, false], 'témoin : dans HEAD, hors de HEAD, inconnu')
    assert.deepEqual(trois.lances, une.lances, `1 tête : ${une.lances.length} processus ; 3 têtes : ${trois.lances.length}`)
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
    assert.match(mesure.erreur, /^ascendance indisponible : git 2\.30 ne sait pas git rev-list --no-commit-header \(git 2\.33 ou plus\)/)
  } finally { d.jeter() }
})
