// Porte au PUSH (#1776, #2178) — fixture : un VRAI dépôt jetable et un `origin` dont l'URL est celle du
// dépôt du projet (aucun push n'est joué : le hook est appelé directement, comme git l'appelle, refs
// sur stdin).
//
// La porte refuse les pushes directs vers `main`, les origines étrangères, les preuves distantes
// incomplètes et les croissances ou reclassements non déclarés des commits nouveaux de toute ref.
// Le fast-forward est exigé sur les refs existantes hors `chantier/**`.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { DEPOT } from '../guards/lib/ticketsGh.mjs'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { instanceDeDepot, sousGitFeint } from '../guards/lib/depotGabarit.mjs'
import { REFUS_PUSH_VERS_MAIN, REF_PROTEGEE, jugerPush as jugerPushReel, refsAPousser } from './pre-push.mjs'
import { lancerGit, lancesDeGit, sousCommande } from '../test/gitDeBanc.mjs'
import { PORTE_DE_PLAGE } from '../guards/lib/plageStock.mjs'
import { fermetureSurDisque } from '../guards/lib/porteDEre.mjs'
import { depotDe, shaDe } from '../guards/lib/gitPorte.mjs'

const ZERO = '0'.repeat(40)
const jugerPush = (options) => jugerPushReel({ lireRefs: () => new Map(), ...options })

test('#2285 famille prepush callback : origin complet', async () => {
  const racine = depot()
  try {
    const stderr = 'note origin\n'.repeat(45) + 'cause origin tardive\n'
    const stdout = 'stdout origin distinct'
    assert.ok(stderr.indexOf('cause origin tardive') > 400)
    const vu = await sousGitFeint([{ si: ['remote', 'get-url', 'origin'], status: 30, stdout, stderr }], () => jugerPush({ cwd: racine, stdin: '' }))
    assert.deepEqual(vu.refus, ['origin illisible, git indisponible : refus (status 30) — ' + stderr + '\n' + stdout])
  } finally { jeter(racine) }
})

test('#2285 famille prepush union : ascendance complète', async () => {
  const racine = depot()
  try {
    const sha = tete(racine)
    const stderr = 'note ancêtre\n'.repeat(45) + 'cause ancêtre tardive\n'
    const stdout = 'stdout ancêtre distinct'
    assert.ok(stderr.indexOf('cause ancêtre tardive') > 400)
    const stdin = 'refs/heads/feat/x ' + sha + ' refs/heads/feat/x ' + sha + '\n'
    const vu = await sousGitFeint([{ si: ['merge-base', '--is-ancestor'], status: 31, stdout, stderr }], () => jugerPush({ cwd: racine, stdin }))
    assert.deepEqual(vu.refus, ['refs/heads/feat/x → refs/heads/feat/x : ascendance illisible — refus (status 31) — ' + stderr + '\n' + stdout])
  } finally { jeter(racine) }
})

const git = (cwd) => (args) => lancerGit(args, { cwd }).trim()

/** Le socle porte la porte de plage du disque : son tronc la juge par elle (#2503). */
const PORTE_DE_PLAGE_SUR_DISQUE = Object.fromEntries(fermetureSurDisque(PORTE_DE_PLAGE.module))

/** Dépôt jetable, `origin` conforme. */
const depot = () =>
  instanceDeDepot({
    fichiers: { ...PORTE_DE_PLAGE_SUR_DISQUE, 'src/a.ts': 'export const a = 1\n' },
    origin: `https://github.com/${DEPOT}.git`,
    refs: { 'refs/remotes/origin/main': 'HEAD' },
  }).racine

const jeter = (racine) => rmSync(racine, { recursive: true, force: true })

const tete = (racine) => git(racine)(['rev-parse', 'HEAD'])

test('#2626 : le hook confirme origin sans contourner main', async () => {
  const racine = depotDeuxCommits()
  try {
    writeFileSync(join(racine, 'scripts', 'publie.test.mjs'), "const STOCK = ['src/deja.ts']\n")
    git(racine)(['add', 'scripts/publie.test.mjs'])
    git(racine)(['commit', '-m', 'stock déjà publié sans annonce'])
    let lectures = 0
    const lireRefs = () => { lectures += 1; return new Map([['refs/heads/autre', tete(racine)]]) }
    const vu = await jugerPush({ cwd: racine, stdin: pousse(racine), lireRefs })
    assert.equal(lectures, 1)
    assert.deepEqual(vu.refus, [REFUS_PUSH_VERS_MAIN])
    assert.ok(vu.notes.includes('origin confirmée : 1 commit(s) connu(s), 0 commit(s) nouveau(x) jugé(s)'))
    assert.ok(!vu.notes.some((n) => /plage.*illisible/.test(n)))
    git(racine)(['remote', 'set-url', 'origin', 'https://example.invalid/repo'])
    const refuse = await jugerPush({ cwd: racine, stdin: pousse(racine), lireRefs })
    assert.equal(lectures, 1, 'origin refusée : aucune lecture distante')
    assert.match(refuse.refus.join('\n'), /origin =/)
  } finally { jeter(racine) }
})

/** Une ligne de stdin, telle que git la sert : `<ref locale> <sha> <ref distante> <sha distant>`. */
const pousse = (racine, { refDistante = REF_PROTEGEE, sha, base = ZERO } = {}) =>
  `refs/heads/main ${sha ?? tete(racine)} ${refDistante} ${base}\n`

// ── Le refus qui MIROITE le ruleset : aucun push n'entre dans `main` ─────────────────────────────

test('un push vers `main` est REFUSÉ et NOMMÉ : main n’avance que par la file de fusion', async () => {
  const racine = depot()
  try {
    const { refus } = await jugerPush({ cwd: racine, stdin: pousse(racine) })
    assert.deepEqual(refus, [REFUS_PUSH_VERS_MAIN])
    assert.match(REFUS_PUSH_VERS_MAIN, /file de fusion — publier par `npm run ops:publier`/)
  } finally {
    jeter(racine)
  }
})

// ── Push LIBRE sur une branche de travail ──────────────────────────────────────────────────────

test('une branche `chantier/**` se pousse librement : la CI de la branche est le juge', async () => {
  const racine = depot()
  try {
    const { refus, notes } = await jugerPush({
      cwd: racine,
      stdin: pousse(racine, { refDistante: 'refs/heads/chantier/1776' }),
    })
    assert.deepEqual(refus, [], 'aucune gate locale n’est exigée d’une branche de travail')
    assert.match(notes.join('\n'), /refs\/heads\/chantier\/1776 : push libre/)
  } finally {
    jeter(racine)
  }
})

test('une branche `feat/**` se pousse librement aussi', async () => {
  const racine = depot()
  try {
    const { refus } = await jugerPush({ cwd: racine, stdin: pousse(racine, { refDistante: 'refs/heads/feat/x' }) })
    assert.deepEqual(refus, [])
  } finally {
    jeter(racine)
  }
})

// ── Fast-forward : jugé sur toute ref EXISTANTE, sauf les branches de chantier ────────────

/** Dépôt à DEUX commits : `HEAD~1` poussé sur un distant à `HEAD` est un non fast-forward. */
function depotDeuxCommits() {
  const racine = depot()
  writeFileSync(join(racine, 'src', 'b.ts'), 'export const b = 2\n')
  git(racine)(['add', 'src/b.ts'])
  git(racine)(['commit', '-m', 'second'])
  return racine
}

test('fast-forward vers une branche `chantier/**` : libre', async () => {
  const racine = depotDeuxCommits()
  try {
    const base = git(racine)(['rev-parse', 'HEAD~1'])
    const stdin = pousse(racine, { refDistante: 'refs/heads/chantier/1776', base })
    const { refus } = await jugerPush({ cwd: racine, stdin })
    assert.deepEqual(refus, [])
  } finally {
    jeter(racine)
  }
})

test('NON fast-forward vers une branche `chantier/**` : libre — un seul écrivain', async () => {
  const racine = depotDeuxCommits()
  try {
    const stdin = pousse(racine, {
      refDistante: 'refs/heads/chantier/1776',
      sha: git(racine)(['rev-parse', 'HEAD~1']),
      base: tete(racine),
    })
    const { refus, notes } = await jugerPush({ cwd: racine, stdin })
    assert.deepEqual(refus, [])
    assert.match(notes.join('\n'), /branche de chantier — fast-forward non jugé/)
  } finally {
    jeter(racine)
  }
})

test('NON fast-forward vers `main` : refusé — miroir de `non_fast_forward` du ruleset', async () => {
  const racine = depotDeuxCommits()
  try {
    const sha = git(racine)(['rev-parse', 'HEAD~1'])
    const stdin = pousse(racine, { sha, base: tete(racine) })
    const { refus } = await jugerPush({ cwd: racine, stdin })
    assert.match(refus.join('\n'), /push non fast-forward vers refs\/heads\/main/)
  } finally {
    jeter(racine)
  }
})

test('NON fast-forward vers `feat/x` : refusé aussi — seule `chantier/**` est exemptée', async () => {
  const racine = depotDeuxCommits()
  try {
    const stdin = pousse(racine, {
      refDistante: 'refs/heads/feat/x',
      sha: git(racine)(['rev-parse', 'HEAD~1']),
      base: tete(racine),
    })
    const { refus } = await jugerPush({ cwd: racine, stdin })
    assert.match(refus.join('\n'), /push non fast-forward vers refs\/heads\/feat\/x/)
  } finally {
    jeter(racine)
  }
})

test('une ref distante NEUVE n’écrase aucune histoire : fast-forward non jugé', async () => {
  const racine = depotDeuxCommits()
  try {
    const stdin = pousse(racine, { refDistante: 'refs/heads/feat/neuve', base: ZERO })
    const { refus, notes } = await jugerPush({ cwd: racine, stdin })
    assert.deepEqual(refus, [])
    assert.match(notes.join('\n'), /n’existe pas encore côté distant/)
  } finally {
    jeter(racine)
  }
})

// ── Origine ────────────────────────────────────────────────────────────────────────────────────

test('un origin ÉTRANGER est refusé, et le refus le cite', async () => {
  const racine = instanceDeDepot({
    fichiers: { 'src/a.ts': 'export const a = 1\n' },
    origin: 'https://github.com/quelquun/autre.git',
  }).racine
  try {
    const { refus } = await jugerPush({ cwd: racine, stdin: pousse(racine) })
    assert.match(refus.join('\n'), /origin = « https:\/\/github\.com\/quelquun\/autre\.git »/)
    assert.ok(refus.join('\n').includes(`github.com/${DEPOT}`))
  } finally {
    jeter(racine)
  }
})

// ── Stocks nominatifs de la PLAGE (revue du 2026-09-03) ────────────────────────────────────────

/** Un PORTEUR de stock nominatif (`scripts/guards/lib/**.mjs`), tel que `stocksNominatifs` le lit. */
const PORTEUR_DE_STOCK = 'scripts/guards/lib/exemptions.mjs'
const sourceStock = (entrees) => `export const STOCK = [\n${entrees.join('\n')}\n]\n`

for (const panne of ['annonce', 'sha', 'acquisition', 'ineffective', 'objet', 'git']) test(`#2626 : preuve distante incomplète ${panne}, refus avant lecture de plage`, async () => {
  const racine = depotDeuxCommits()
  try {
    const inconnu = 'f'.repeat(40)
    const regles = [
      { si: ['fetch'], status: panne === 'acquisition' ? 1 : 0, stderr: panne === 'acquisition' ? 'acquisition refusée au banc' : '' },
      { si: ['log'], status: 30, stderr: 'PLAGE INTERDITE' },
      ...(panne === 'objet' ? [{ si: ['cat-file', '--batch-check'], status: 0, stdout: `${inconnu} commit 1\n${inconnu}^{} missing\n` }] : []),
      ...(panne === 'git' ? [{ si: ['cat-file', '--batch-check'], status: 30, stderr: 'git indisponible au banc' }] : []),
    ]
    const lireRefs = () => panne === 'annonce' ? null : new Map([['refs/heads/inconnue', panne === 'sha' ? 'a'.repeat(41) : inconnu]])
    const vu = await sousGitFeint(regles, () => jugerPush({ cwd: racine, stdin: pousse(racine), lireRefs }))
    assert.ok(vu.refus.some((r) => /origin/.test(r)))
    assert.ok(vu.refus.includes(REFUS_PUSH_VERS_MAIN))
    assert.ok(!vu.refus.some((r) => /PLAGE INTERDITE/.test(r)))
    assert.ok(!vu.notes.some((n) => /nouveau.*jugé/.test(n)))
  } finally { jeter(racine) }
})

test('#2626 : la confirmation d’origin lance autant de git pour un objet annoncé que pour cinquante', async () => {
  const racines = [depotDeuxCommits(), depotDeuxCommits()]
  try {
    const [un, tous] = racines.map((racine, i) => {
      const head = tete(racine)
      const autres = git(racine)(['ls-tree', '-r', '-t', 'HEAD']).split('\n').map((l) => l.split(/\s+/)[2])
      const annonce = i === 0 ? [head] : [head, ...autres]
      const lireRefs = () => new Map(annonce.map((sha, n) => [`refs/tags/t${n}`, sha]))
      return { annonce, ...lancesDeGit(() => jugerPush({ cwd: racine, stdin: pousse(racine, { refDistante: 'refs/heads/feat/neuve' }), lireRefs })) }
    })
    assert.ok(tous.annonce.length >= 50, `témoin : ${tous.annonce.length} objets annoncés`)
    for (const { valeur } of [un, tous]) assert.ok((await valeur).notes.includes('origin confirmée : 1 commit(s) connu(s), 0 commit(s) nouveau(x) jugé(s)'))
    assert.equal(tous.lances.length, un.lances.length, `lancements : ${JSON.stringify(tous.lances.map(sousCommande))}`)
  } finally { racines.forEach(jeter) }
})

for (const tronc of ['absent', 'disjoint']) test(`#2626 hook sans borne : B médian non publié est refusé, tronc ${tronc}`, async () => {
  const racine = depot()
  try {
    const fichier = 'scripts/publie.test.mjs'
    writeFileSync(join(racine, fichier), sourceStock(["'src/publie.ts',"]))
    git(racine)(['add', fichier]); git(racine)(['commit', '-m', 'A publié'])
    const a = tete(racine)
    git(racine)(['update-ref', '-d', 'refs/remotes/origin/main'])
    if (tronc === 'disjoint') {
      const tree = git(racine)(['rev-parse', 'HEAD^{tree}'])
      const autre = git(racine)(['commit-tree', tree, '-m', 'tronc disjoint'])
      git(racine)(['update-ref', 'refs/remotes/origin/main', autre])
    }
    writeFileSync(join(racine, fichier), sourceStock(["'src/publie.ts',", "'src/neuf.ts',"]))
    git(racine)(['add', fichier]); git(racine)(['commit', '-m', 'B non publié'])
    const b = tete(racine)
    writeFileSync(join(racine, 'src/a.ts'), 'export const a = 3\n')
    git(racine)(['add', 'src/a.ts']); git(racine)(['commit', '-m', 'C anodin'])
    const c = tete(racine)
    const vu = await jugerPush({
      cwd: racine, stdin: pousse(racine, { refDistante: 'refs/heads/chantier/neuve' }),
      lireRefs: () => new Map([['refs/heads/publie', a]]),
    })
    assert.ok(vu.notes.includes('origin confirmée : 1 commit(s) connu(s), 2 commit(s) nouveau(x) jugé(s)'))
    assert.match(vu.refus.join('\n'), new RegExp(b.slice(0, 9)))
    assert.doesNotMatch(vu.refus.join('\n'), new RegExp(a.slice(0, 9)))
    assert.doesNotMatch(vu.refus.join('\n'), new RegExp(c.slice(0, 9)))
  } finally { jeter(racine) }
})

for (const annote of [false, true]) test(`#2626 : noncommit ${annote ? 'tag annoté' : 'blob'} présent ne masque aucun commit`, async () => {
  const racine = depotDeuxCommits()
  try {
    let objet = git(racine)(['rev-parse', 'HEAD:src/a.ts'])
    if (annote) {
      git(racine)(['tag', '-a', 'blob', '-m', 'blob', objet])
      objet = git(racine)(['rev-parse', 'refs/tags/blob'])
    }
    const vu = await jugerPush({ cwd: racine, stdin: pousse(racine, { refDistante: 'refs/heads/feat/neuve' }), lireRefs: () => new Map([['refs/tags/blob', objet]]) })
    assert.deepEqual(vu.refus, [])
    assert.ok(vu.notes.includes('origin confirmée : 0 commit(s) connu(s), 1 commit(s) nouveau(x) jugé(s)'))
  } finally { jeter(racine) }
})

for (const support of ['refs/heads/avancee', 'refs/tags/avancee', 'refs/pull/42/head']) test(`#2626 : origine avancée ${support}, A publié juge zéro puis C neuf juge un`, async () => {
  const racine = depot()
  const distant = mkdtempSync(join(tmpdir(), '2626-avancee-'))
  try {
    const fichier = 'scripts/publie.test.mjs'
    writeFileSync(join(racine, fichier), sourceStock(["'src/publie.ts',"]))
    git(racine)(['add', fichier]); git(racine)(['commit', '-m', 'A publié'])
    const a = tete(racine)
    lancerGit(['clone', '--bare', '--no-local', '-q', racine, distant])
    const tree = git(distant)(['rev-parse', 'HEAD^{tree}'])
    const creer = (...args) => git(distant)(['-c', 'user.name=Banc', '-c', 'user.email=banc@example.invalid', 'commit-tree', tree, ...args])
    const autre = creer('-m', 'main autre lignée')
    const b = creer('-p', a, '-m', 'B descendant publié')
    git(distant)(['update-ref', 'refs/heads/main', autre])
    if (support.startsWith('refs/tags/')) {
      git(distant)(['-c', 'user.name=Banc', '-c', 'user.email=banc@example.invalid', 'tag', '-a', 'avancee', '-m', 'B annoté', b])
    } else git(distant)(['update-ref', support, b])
    git(racine)(['remote', 'set-url', 'origin', distant])
    assert.equal(shaDe(depotDe(racine), b), null)
    writeFileSync(join(racine, 'WIP.txt'), 'travail non suivi\n')
    writeFileSync(join(racine, 'src/a.ts'), 'travail suivi non indexé\n')
    writeFileSync(join(racine, 'indexe.txt'), 'travail indexé\n')
    git(racine)(['add', 'indexe.txt'])
    const mesurer = () => ({
      head: tete(racine), index: readFileSync(join(racine, '.git/index')).toString('hex'),
      wip: readFileSync(join(racine, 'WIP.txt'), 'utf8'), suivi: readFileSync(join(racine, 'src/a.ts'), 'utf8'),
      indexe: readFileSync(join(racine, 'indexe.txt'), 'utf8'),
      refs: git(racine)(['for-each-ref', '--format=%(refname) %(objectname)']),
      fetch: existsSync(join(racine, '.git/FETCH_HEAD')) ? readFileSync(join(racine, '.git/FETCH_HEAD'), 'utf8') : null,
    })
    const avant = mesurer()
    const juger = () => sousGitFeint([{ si: ['remote', 'get-url', 'origin'], status: 0, stdout: `https://github.com/${DEPOT}.git\n` }],
      () => jugerPushReel({ cwd: racine, stdin: pousse(racine, { refDistante: 'refs/heads/feat/neuve' }) }))
    const ancien = await juger()
    assert.deepEqual(ancien.refus, [])
    assert.ok(ancien.notes.includes('origin confirmée : 2 commit(s) connu(s), 0 commit(s) nouveau(x) jugé(s)'))
    assert.deepEqual(mesurer(), avant, 'HEAD/index brut/WIP/refs/FETCH_HEAD restent identiques')
    writeFileSync(join(racine, fichier), sourceStock(["'src/publie.ts',", "'src/neuf.ts',"]))
    git(racine)(['add', fichier]); git(racine)(['commit', '-m', 'C local neuf'])
    const nouveau = await juger()
    assert.match(nouveau.refus.join('\n'), new RegExp(tete(racine).slice(0, 9)))
    assert.ok(nouveau.notes.includes('origin confirmée : 2 commit(s) connu(s), 1 commit(s) nouveau(x) jugé(s)'))
  } finally { jeter(racine); jeter(distant) }
})

for (const support of ['tags', 'refs/pull/42/head']) test(`#2626 : origin conserve un commit seulement par ${support}, seul le descendant neuf est jugé`, async () => {
  const racine = depot()
  const distant = mkdtempSync(join(tmpdir(), '2626-tags-origin-'))
  try {
    const base = tete(racine)
    const fichier = 'scripts/publie.test.mjs'
    writeFileSync(join(racine, fichier), sourceStock(["'src/publie.ts',"]))
    git(racine)(['add', fichier]); git(racine)(['commit', '-m', 'ancien stock publié'])
    const publie = tete(racine)
    if (support === 'tags') git(racine)(['tag', '-a', 'connu', '-m', 'connu', publie])
    lancerGit(['clone', '--bare', '-q', racine, distant])
    git(distant)(['update-ref', 'refs/heads/main', base])
    if (support === 'tags') git(distant)(['-c', 'user.name=Banc', '-c', 'user.email=banc@example.invalid', 'tag', '-a', 'inconnu', '-m', 'objet tag absent localement', publie])
    else git(distant)(['update-ref', support, publie])
    git(racine)(['remote', 'set-url', 'origin', distant])
    const juger = () => sousGitFeint([{ si: ['remote', 'get-url', 'origin'], status: 0, stdout: `https://github.com/${DEPOT}.git\n` }],
      () => jugerPushReel({ cwd: racine, stdin: pousse(racine, { refDistante: 'refs/heads/chantier/tag-only' }) }))
    const ancien = await juger()
    assert.deepEqual(ancien.refus, [])
    assert.ok(ancien.notes.includes('origin confirmée : 2 commit(s) connu(s), 0 commit(s) nouveau(x) jugé(s)'))
    writeFileSync(join(racine, fichier), sourceStock(["'src/publie.ts',", "'src/nouveau.ts',"]))
    git(racine)(['add', fichier]); git(racine)(['commit', '-m', 'nouveau stock fautif'])
    const nouveau = await juger()
    assert.match(nouveau.refus.join('\n'), new RegExp(tete(racine).slice(0, 9)))
    assert.ok(nouveau.notes.includes('origin confirmée : 2 commit(s) connu(s), 1 commit(s) nouveau(x) jugé(s)'))
  } finally { jeter(racine); jeter(distant) }
})

test('un STOCK nominatif qui grandit dans la plage sans `CLIQUET:` au commit est refusé', async () => {
  const racine = depot()
  try {
    const commettre = (contenu, message) => {
      mkdirSync(join(racine, 'scripts', 'guards', 'lib'), { recursive: true })
      writeFileSync(join(racine, PORTEUR_DE_STOCK), contenu)
      git(racine)(['add', '--', PORTEUR_DE_STOCK])
      git(racine)(['commit', '-m', message])
      return tete(racine)
    }
    const base = commettre(sourceStock([]), 'chore: socle du stock')
    commettre(sourceStock(["  'src/a.ts',", "  'src/b.ts',"]), 'chore: deux entrées de plus, sans le dire')
    const { refus } = await jugerPush({
      cwd: racine,
      stdin: pousse(racine, { refDistante: 'refs/heads/chantier/x', base }),
    })
    // La porte vaut pour TOUTE ref : un stock qui grandit en silence n'est pas moins faux sur une
    // branche de travail, et la CI de cette branche ne le mesure pas commit par commit.
    assert.ok(refus.length, 'un stock qui grandit en silence dans la plage doit refuser, branche comprise')
    assert.match(refus.join('\n'), new RegExp(PORTEUR_DE_STOCK.replace(/[/.]/g, '\\$&')))
  } finally {
    jeter(racine)
  }
})

test('un stock SOUS LA PORTE `comptes:plage` qui grandit dans la plage est refusé MÊME sous un `CLIQUET:` au compte exact (#2705)', async () => {
  const racine = depot()
  const porteur = 'scripts/guards/lib/slotsStock.mjs'
  try {
    const commettre = (contenu, message) => {
      mkdirSync(join(racine, 'scripts', 'guards', 'lib'), { recursive: true })
      writeFileSync(join(racine, porteur), contenu)
      git(racine)(['add', '--', porteur])
      git(racine)(['commit', '-m', message])
      return tete(racine)
    }
    const base = commettre(sourceStock([]), 'chore: socle du stock')
    commettre(sourceStock(["  'src/a.ts',", "  'src/b.ts',"]), `chore: deux entrées\n\nCLIQUET: ${porteur} +2 — deux sites déclarés au message, compte exact`)
    const { refus } = await jugerPush({ cwd: racine, stdin: pousse(racine, { refDistante: 'refs/heads/chantier/x', base }) })
    assert.match(refus.join('\n'), /STOCK SOUS LA PORTE `comptes:plage` qui NAÎT ou GRANDIT : .*scripts\/guards\/lib\/slotsStock\.mjs \+2 entrée/)
    assert.match(refus.join('\n'), /aucun `CLIQUET:` ne l'admet/)
  } finally {
    jeter(racine)
  }
})

test('un module qui FRANCHIT la frontière sans `RECLASSEMENT:` au commit est refusé (#1806 D2″)', async () => {
  const racine = depot()
  try {
    const manifeste = 'src/data/primitives.manifest.json'
    const ecrire = (rel, texte) => {
      mkdirSync(join(racine, dirname(rel)), { recursive: true })
      writeFileSync(join(racine, rel), texte)
    }
    const commettre = (message) => {
      git(racine)(['add', '-A'])
      git(racine)(['commit', '-m', message])
      return tete(racine)
    }
    ecrire('src/ui/styles/console.css', '.c { color: red }\n')
    ecrire('src/ui/Console.tsx', 'export const Console = 1\n')
    ecrire('src/ui/Ecran1.tsx', "import { Console } from './Console'\nexport const E1 = Console\n")
    ecrire(manifeste, JSON.stringify([{ id: 'console', fichier: 'src/ui/Console.tsx', css: 'src/ui/styles/console.css' }]))
    const base = commettre('chore: socle')
    ecrire('src/ui/Ecran2.tsx', "import { Console } from './Console'\nexport const E2 = Console\n")
    commettre('feat: second écran')
    const { refus } = await jugerPush({
      cwd: racine,
      stdin: pousse(racine, { refDistante: 'refs/heads/chantier/x', base }),
    })
    assert.match(refus.join('\n'), /RECLASSEMENT CSS : [0-9a-f]{9} src\/ui\/styles\/console\.css : franchi au prix 1, aucune ligne/)
  } finally {
    jeter(racine)
  }
})

// ── Forme de stdin ─────────────────────────────────────────────────────────────────────────────

test('une SUPPRESSION de branche (sha local nul) n’est pas une ref à juger', () => {
  assert.deepEqual(refsAPousser(`(delete) ${ZERO} refs/heads/vieille ${'a'.repeat(40)}\n`), [])
})

test('deux refs sur stdin donnent deux refs jugées', () => {
  const lignes =
    `refs/heads/main ${'a'.repeat(40)} refs/heads/main ${ZERO}\n` +
    `refs/heads/x ${'b'.repeat(40)} refs/heads/x ${ZERO}\n`
  assert.deepEqual(refsAPousser(lignes).map((r) => r.refDistante), ['refs/heads/main', 'refs/heads/x'])
})

test('git INDISPONIBLE (hors dépôt) : un refus NOMMÉ qui porte la raison de git, jamais « origin absent »', async () => {
  const hors = mkdtempSync(join(tmpdir(), 'pre-push-hors-'))
  try {
    const { refus } = await jugerPush({ cwd: hors, stdin: '' })
    assert.equal(refus.length, 1)
    assert.match(refus[0], /^origin illisible, git indisponible : .*not a git repository/i)
  } finally {
    rmSync(hors, { recursive: true, force: true })
  }
})
