// node --test scripts/ops/synchroniser.test.mjs
// Matrice du verdict #2187 (`.git/suivi/2187-design-synchroniseur-verdict-2026-10-07.md`, « Matrice de
// preuves », items 1 à 15 et 17, et « Incertain → test qui tranche ») sur fixtures `instanceDeDepot`.
import assert from 'node:assert/strict'
import { spawn, spawnSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve, sep } from 'node:path'
import { after, describe, test } from 'node:test'
import { pathToFileURL } from 'node:url'
import {
  INDEX, ajouterOrigine, ajouterWorktree, avancerArbre, fetchOrigin, brancheDe, ceQuiChange, commitDe, contenuDuBlob, depotDe,
  ecrireBlob, entreesDe, poserDansIndex, poserRef, rafraichirIndex, refusDeGit, reglerDepot, reussi, shaDe,
} from '../guards/lib/gitPorte.mjs'
import { envDeDepotForge, envGitFeint, instanceDeDepot } from '../guards/lib/depotGabarit.mjs'
import { remplacerIndex, resoudreBaseVide, synchroniserPrincipal } from './synchroniser.mjs'

const ENV = envDeDepotForge()
const ATTENTE = { echeanceMs: 3_000, pasMs: 20 }
const TMP = realpathSync(tmpdir())
const jetables = []

after(() => {
  for (const racine of jetables) {
    const vrai = resolve(racine)
    if (!vrai.startsWith(TMP + sep) && !vrai.startsWith(resolve(tmpdir()) + sep)) throw new Error(`nettoyage hors de tmpdir refusé : ${racine}`)
    rmSync(racine, { recursive: true, force: true })
  }
})

const depot = (racine) => depotDe(racine, { env: ENV })
const exiger = (union, geste) => assert.ok(reussi(union), `${geste} : ${JSON.stringify(union.disponible ? union.valeur?.stderr ?? union : union.raison)}`)

/** Deux instances du même gabarit : `amont` (l'origine) et `principal` (sur B), reliés par `origin`. */
function monde(fichiers) {
  const amont = instanceDeDepot({ fichiers })
  const principal = instanceDeDepot({ fichiers })
  jetables.push(amont.racine, principal.racine)
  exiger(ajouterOrigine(depot(principal.racine), amont.racine), 'remote add')
  return { amont: amont.racine, principal: principal.racine, B: /** @type {string} */ (principal.sha) }
}

/** Les fichiers écrits (`null` = supprimé) puis committés dans `racine` : le sha du commit. */
function committer(racine, changements, message = 'amont') {
  for (const [p, contenu] of Object.entries(changements)) {
    const chemin = join(racine, p)
    if (contenu === null) rmSync(chemin, { force: true })
    else {
      mkdirSync(dirname(chemin), { recursive: true })
      writeFileSync(chemin, contenu)
    }
  }
  exiger(commitDe(depot(racine), { message, chemins: Object.keys(changements) }), 'commit')
  return /** @type {string} */ (shaDe(depot(racine), 'HEAD'))
}

const ecrireTravail = (racine, p, contenu) => {
  mkdirSync(dirname(join(racine, p)), { recursive: true })
  writeFileSync(join(racine, p), contenu)
}
const travail = (racine, p) => (existsSync(join(racine, p)) ? readFileSync(join(racine, p), 'utf8') : null)

/** `texte` posé dans l'index de `racine` à `p`, sans toucher l'arbre de travail. */
function indexer(racine, p, texte) {
  const blob = ecrireBlob(depot(racine), texte)
  exiger(blob, 'hash-object')
  exiger(poserDansIndex(depot(racine), { index: join(racine, '.git', 'index'), entrees: [{ chemin: p, mode: '100644', sha: String(blob.valeur.stdout).trim() }] }), 'update-index')
}

/** Le texte de `p` dans l'index, `null` s'il n'y est pas. */
function indexe(racine, p) {
  const e = entreesDe(depot(racine), INDEX, [p]).get(p)
  return e ? contenuDuBlob(depot(racine), e.sha).toString('utf8') : null
}

/** Ce que l'index emporte face à HEAD (`git diff --cached`, chemins). */
const stage = (racine) => ceQuiChange(depot(racine), 'HEAD', INDEX).chemins().sort()
const head = (racine) => shaDe(depot(racine), 'HEAD')
const traces = (racine) => ({ verrouIndex: existsSync(join(racine, '.git', 'index.lock')), synchro: existsSync(join(racine, '.git', 'synchro')) })

/** Le dossier des dépôts de conflit de la synchronisation vers `U`. */
const deposes = (m, U) => join(m.principal, '.git', 'synchro-conflits', U)
/** Les quatre fichiers déposés pour `p` (`null` pour un absent). */
const lireDepot = (dossier, p) => Object.fromEntries(['base', 'amont', 'locale', 'proposition'].map((nom) => {
  const chemin = join(dossier, ...p.split('/'), nom)
  return [nom, existsSync(chemin) ? readFileSync(chemin, 'utf8') : null]
}))

const sync = (racine, gestes = {}) => synchroniserPrincipal({ depuis: racine, env: ENV, gestes: { attente: ATTENTE, ...gestes } })

describe('resoudreBaseVide (règle « base vide + sous-suite », PURE)', () => {
  test('local ⊋ amont : le plus long, octets littéraux', () => {
    const texte = 'titre\nligne a\n<<<<<<< local\nligne b\najout local\n||||||| base\n=======\nligne b\n>>>>>>> amont\n'
    assert.equal(resoudreBaseVide(texte), 'titre\nligne a\nligne b\najout local\n')
  })
  test('amont ⊋ local : le plus long', () => {
    const texte = 'titre\nligne a\n<<<<<<< local\nligne b\n||||||| base\n=======\nligne b\nsuite amont\n>>>>>>> amont\n'
    assert.equal(resoudreBaseVide(texte), 'titre\nligne a\nligne b\nsuite amont\n')
  })
  test('sous-suite NON contiguë', () => {
    const texte = '<<<<<<< local\na\nc\n||||||| base\n=======\na\nb\nc\n>>>>>>> amont\n'
    assert.equal(resoudreBaseVide(texte), 'a\nb\nc\n')
  })
  test('ni l’un ni l’autre sous-suite : conflit', () => {
    assert.equal(resoudreBaseVide('<<<<<<< local\nx\n||||||| base\n=======\ny\n>>>>>>> amont\n'), null)
  })
  test('base NON vide : conflit', () => {
    assert.equal(resoudreBaseVide('<<<<<<< local\na\nb\n||||||| base\na\n=======\na\n>>>>>>> amont\n'), null)
  })
  test('bloc non fermé : conflit', () => {
    assert.equal(resoudreBaseVide('<<<<<<< local\na\n||||||| base\n=======\n'), null)
  })
})

describe('synchroniserPrincipal — matrice', () => {
  test('1 FF sans WIP : avance, ORIG_HEAD = B, aucune trace', async () => {
    const m = monde({ 'a.md': 'un\n' })
    const U = committer(m.amont, { 'a.md': 'deux\n' })
    const vu = await sync(m.principal)
    assert.deepEqual(vu, { etat: 'avance', de: m.B, vers: U, configurationClientChangee: [] })
    assert.equal(head(m.principal), U)
    assert.equal(brancheDe(depot(m.principal)), 'main')
    assert.equal(shaDe(depot(m.principal), 'ORIG_HEAD'), m.B)
    assert.equal(travail(m.principal, 'a.md'), 'deux\n')
    assert.deepEqual(stage(m.principal), [])
    assert.deepEqual(traces(m.principal), { verrouIndex: false, synchro: false })
    assert.deepEqual(await sync(m.principal), { etat: 'a-jour', sha: U })
  })

  test('2 non indexé : W = U, W ⊋ U, W ⊊ U', async () => {
    const cas = [
      ['W = U', 'titre\nligne a\nligne b\n', 'titre\nligne a\nligne b\n', 'titre\nligne a\nligne b\n'],
      ['W ⊋ U', 'titre\nligne a\nligne b\najout local\n', 'titre\nligne a\nligne b\n', 'titre\nligne a\nligne b\najout local\n'],
      ['W ⊊ U', 'titre\nligne a\nligne b\n', 'titre\nligne a\nligne b\nsuite amont\n', 'titre\nligne a\nligne b\nsuite amont\n'],
    ]
    for (const [nom, w, u, attendu] of cas) {
      const m = monde({ 'm.md': 'titre\nligne a\n', 'autre.md': 'x\n' })
      const U = committer(m.amont, { 'm.md': u, 'autre.md': 'y\n' })
      ecrireTravail(m.principal, 'm.md', w)
      ecrireTravail(m.principal, 'etranger.md', 'non suivi\n')
      const vu = await sync(m.principal)
      assert.equal(vu.etat, 'avance', nom)
      assert.equal(head(m.principal), U, nom)
      assert.equal(travail(m.principal, 'm.md'), attendu, nom)
      assert.equal(indexe(m.principal, 'm.md'), u, nom)
      assert.equal(travail(m.principal, 'autre.md'), 'y\n', nom)
      assert.equal(travail(m.principal, 'etranger.md'), 'non suivi\n', nom)
      assert.deepEqual(stage(m.principal), [], nom)
    }
  })

  test('3 indexé chevauchant (S ≠ W) : S′ = fusion(S, B, U), W′ = fusion(W, S, S′)', async () => {
    const m = monde({ 'f.md': 'a\nb\nc\n', 'g.md': 'g\n' })
    const U = committer(m.amont, { 'f.md': 'A\nb\nc\n' })
    indexer(m.principal, 'f.md', 'a\nb\nC\n')
    indexer(m.principal, 'g.md', 'g indexé\n')
    ecrireTravail(m.principal, 'f.md', 'a\nb\nC\nw\n')
    const vu = await sync(m.principal)
    assert.equal(vu.etat, 'avance')
    assert.equal(head(m.principal), U)
    assert.equal(indexe(m.principal, 'f.md'), 'A\nb\nC\n')
    assert.equal(travail(m.principal, 'f.md'), 'A\nb\nC\nw\n')
    assert.equal(indexe(m.principal, 'g.md'), 'g indexé\n')
    assert.deepEqual(stage(m.principal), ['f.md', 'g.md'])
  })

  test('4 non suivi ajouté en amont : base = blob du dernier commit qui l’ajoute', async () => {
    const publie = 'titre\nligne a\n'
    const cas = [
      ['W = U', 'titre\nligne a\nligne b\n', 'titre\nligne a\nligne b\n', 'titre\nligne a\nligne b\n'],
      ['W ⊋ U', 'titre\nligne a\nligne b\najout local\n', 'titre\nligne a\nligne b\n', 'titre\nligne a\nligne b\najout local\n'],
      ['W ⊊ U', 'titre\nligne a\nligne b\n', 'titre\nligne a\nligne b\nsuite amont\n', 'titre\nligne a\nligne b\nsuite amont\n'],
    ]
    for (const [nom, w, u, attendu] of cas) {
      const m = monde({ 'a.md': 'a\n' })
      committer(m.amont, { '.claude/memory/fiche.md': publie }, 'publie')
      const U = committer(m.amont, { '.claude/memory/fiche.md': u }, 'complete')
      ecrireTravail(m.principal, '.claude/memory/fiche.md', w)
      const vu = await sync(m.principal)
      assert.equal(vu.etat, 'avance', `${nom} : ${JSON.stringify(vu)}`)
      assert.equal(head(m.principal), U, nom)
      assert.equal(travail(m.principal, '.claude/memory/fiche.md'), attendu, nom)
      assert.equal(indexe(m.principal, '.claude/memory/fiche.md'), u, nom)
      assert.deepEqual(stage(m.principal), [], nom)
    }
  })

  test('5 suppressions : chez nous × amont modifié → conflit ; × amont supprimé → absent ; amont supprimé × modifié chez nous → conflit', async () => {
    {
      const m = monde({ 'd.md': 'd\n' })
      const U = committer(m.amont, { 'd.md': 'd modifié\n' })
      rmSync(join(m.principal, 'd.md'))
      const vu = await sync(m.principal)
      assert.deepEqual(vu, { etat: 'conflit', chemins: [{ chemin: 'd.md', raison: 'supprimé chez nous, modifié en amont' }], depot: deposes(m, U) })
      assert.deepEqual(lireDepot(deposes(m, U), 'd.md'), { base: 'd\n', amont: 'd modifié\n', locale: null, proposition: 'supprimé chez nous, modifié en amont' })
      assert.equal(head(m.principal), m.B)
      assert.equal(travail(m.principal, 'd.md'), null)
      assert.deepEqual(traces(m.principal), { verrouIndex: false, synchro: false })
    }
    {
      const m = monde({ 'd.md': 'd\n', 'e.md': 'e\n' })
      const U = committer(m.amont, { 'd.md': null })
      rmSync(join(m.principal, 'd.md'))
      const vu = await sync(m.principal)
      assert.equal(vu.etat, 'avance')
      assert.equal(head(m.principal), U)
      assert.equal(travail(m.principal, 'd.md'), null)
      assert.equal(indexe(m.principal, 'd.md'), null)
      assert.deepEqual(stage(m.principal), [])
    }
    {
      const m = monde({ 'd.md': 'd\n' })
      const U = committer(m.amont, { 'd.md': null })
      ecrireTravail(m.principal, 'd.md', 'd local\n')
      const vu = await sync(m.principal)
      assert.deepEqual(vu, { etat: 'conflit', chemins: [{ chemin: 'd.md', raison: 'supprimé en amont, modifié chez nous' }], depot: deposes(m, U) })
      assert.equal(travail(m.principal, 'd.md'), 'd local\n')
      assert.equal(head(m.principal), m.B)
    }
  })

  test('6 vrai conflit : refus nommé, rien appliqué', async () => {
    const m = monde({ 'c.md': 'x\n', 'n.md': 'n\n' })
    const U = committer(m.amont, { 'c.md': 'amont\n', 'n.md': 'n2\n' })
    ecrireTravail(m.principal, 'c.md', 'local\n')
    const vu = await sync(m.principal)
    assert.deepEqual(vu, { etat: 'conflit', chemins: [{ chemin: 'c.md', raison: 'fusion de c.md en conflit' }], depot: deposes(m, U) })
    assert.equal(head(m.principal), m.B)
    assert.equal(travail(m.principal, 'c.md'), 'local\n')
    assert.equal(travail(m.principal, 'n.md'), 'n\n')
    assert.deepEqual(stage(m.principal), [])
    assert.deepEqual(traces(m.principal), { verrouIndex: false, synchro: false })
    assert.deepEqual(lireDepot(deposes(m, U), 'c.md'), {
      base: 'x\n', amont: 'amont\n', locale: 'local\n',
      proposition: '<<<<<<< local\nlocal\n||||||| base\nx\n=======\namont\n>>>>>>> amont\n',
    })
    ecrireTravail(m.principal, 'c.md', 'amont\n')
    assert.equal((await sync(m.principal)).etat, 'avance')
    assert.equal(existsSync(join(m.principal, '.git', 'synchro-conflits')), false)
  })

  test('7 binaire, attribut merge= : conflit', async () => {
    {
      const m = monde({ 'b.bin': '\u0000\u0001\u0002\n' })
      const B = m.B
      const U = committer(m.amont, { 'b.bin': Buffer.from([0, 1, 4, 10]) })
      ecrireTravail(m.principal, 'b.bin', Buffer.from([0, 1, 3, 10]))
      const vu = await sync(m.principal)
      assert.deepEqual(vu, { etat: 'conflit', chemins: [{ chemin: 'b.bin', raison: 'binaire' }], depot: deposes(m, U) })
      assert.equal(lireDepot(deposes(m, U), 'b.bin').proposition, 'binaire')
      assert.equal(head(m.principal), B)
      assert.deepEqual([...readFileSync(join(m.principal, 'b.bin'))], [0, 1, 3, 10])
    }
    {
      const m = monde({ '.gitattributes': '*.txt merge=union\n', 'u.txt': 'a\n' })
      const U = committer(m.amont, { 'u.txt': 'a\namont\n' })
      ecrireTravail(m.principal, 'u.txt', 'a\nlocal\n')
      const vu = await sync(m.principal)
      assert.deepEqual(vu, { etat: 'conflit', chemins: [{ chemin: 'u.txt', raison: 'attribut merge=union' }], depot: deposes(m, U) })
      assert.equal(head(m.principal), m.B)
    }
  })

  test('8 ignoré en collision : collision-ignore ; incertain read-tree -m -u sur un ignoré (2.51) : ÉCRASE', async () => {
    const m = monde({ '.gitignore': '*.log\n', 'a.md': 'a\n' })
    const U = committer(m.amont, { '.gitignore': '', 'x.log': 'amont\n' })
    ecrireTravail(m.principal, 'x.log', 'IGNORÉ LOCAL\n')
    const vu = await sync(m.principal)
    assert.deepEqual(vu, { etat: 'collision-ignore', chemins: ['x.log'] })
    assert.equal(travail(m.principal, 'x.log'), 'IGNORÉ LOCAL\n')
    assert.equal(head(m.principal), m.B)
    exiger(fetchOrigin(depot(m.principal)), 'fetch')
    const transport = join(m.principal, '.git', 'transport-sonde')
    copyFileSync(join(m.principal, '.git', 'index'), transport)
    exiger(rafraichirIndex(depot(m.principal), { index: transport }), 'update-index --refresh')
    const sonde = avancerArbre(depot(m.principal), { index: transport, de: m.B, vers: U })
    assert.ok(reussi(sonde), refusDeGit(sonde))
    assert.equal(travail(m.principal, 'x.log'), 'amont\n')
  })

  test('9 divergent : refus portant git cherry U B (+ et -)', async () => {
    const m = monde({ 'a.md': 'a\n' })
    const equivalent = committer(m.principal, { 'c.md': 'meme\n' }, 'local equivalent')
    const unique = committer(m.principal, { 'l.md': 'local\n' }, 'local unique')
    const U = committer(m.amont, { 'c.md': 'meme\n' }, 'amont equivalent')
    const vu = await sync(m.principal)
    assert.deepEqual(vu, { etat: 'divergent', de: unique, vers: U, cerise: [{ signe: '-', sha: equivalent }, { signe: '+', sha: unique }] })
    assert.equal(head(m.principal), unique)
  })

  test('10 branche étrangère ; opération en cours ; index.lock transitoire ; index.lock tenu ; origin absent', async () => {
    {
      const m = monde({ 'a.md': 'a\n' })
      committer(m.amont, { 'a.md': 'b\n' })
      exiger(poserRef(depot(m.principal), 'refs/heads/autre', m.B), 'branche')
      writeFileSync(join(m.principal, '.git', 'HEAD'), 'ref: refs/heads/autre\n')
      assert.deepEqual(await sync(m.principal), { etat: 'branche-etrangere', branche: 'autre' })
    }
    {
      const m = monde({ 'a.md': 'a\n' })
      committer(m.amont, { 'a.md': 'b\n' })
      writeFileSync(join(m.principal, '.git', 'MERGE_HEAD'), `${m.B}\n`)
      assert.deepEqual(await sync(m.principal), { etat: 'operation-en-cours', operations: ['MERGE_HEAD'] })
      assert.equal(head(m.principal), m.B)
    }
    {
      const m = monde({ 'a.md': 'a\n' })
      const U = committer(m.amont, { 'a.md': 'b\n' })
      const verrou = join(m.principal, '.git', 'index.lock')
      writeFileSync(verrou, '')
      const annonces = []
      const liberer = setTimeout(() => rmSync(verrou), 300)
      const vu = await synchroniserPrincipal({ depuis: m.principal, env: ENV, gestes: { attente: ATTENTE }, annoncer: (t) => annonces.push(t) })
      clearTimeout(liberer)
      assert.equal(vu.etat, 'avance')
      assert.equal(head(m.principal), U)
      assert.ok(annonces.some((t) => t.includes('index.lock tenu')))
    }
    {
      const m = monde({ 'a.md': 'a\n' })
      committer(m.amont, { 'a.md': 'b\n' })
      writeFileSync(join(m.principal, '.git', 'index.lock'), '')
      const vu = await sync(m.principal, { attente: { echeanceMs: 200, pasMs: 20 } })
      assert.equal(vu.etat, 'operation-en-cours')
      assert.match(vu.raison, /index\.lock': File exists/)
      assert.equal(head(m.principal), m.B)
      assert.ok(existsSync(join(m.principal, '.git', 'index.lock')))
    }
    {
      const m = monde({ 'a.md': 'a\n' })
      exiger(reglerDepot(depot(m.principal), 'remote.origin.url', join(m.principal, 'absent')), 'url')
      const vu = await sync(m.principal)
      assert.equal(vu.etat, 'origin-indisponible')
      assert.equal(head(m.principal), m.B)
    }
  })

  test('11 deux synchronisations concurrentes : une avance, l’autre mesure a-jour', async () => {
    const m = monde({ 'a.md': 'a\n' })
    const U = committer(m.amont, { 'a.md': 'b\n' })
    const vus = await Promise.all([sync(m.principal), sync(m.principal)])
    assert.deepEqual(vus.map((v) => v.etat).sort(), ['a-jour', 'avance'])
    assert.equal(head(m.principal), U)
  })

  test('12 merge.autoStash=true sans effet', async () => {
    const m = monde({ 'm.md': 'titre\n' })
    exiger(reglerDepot(depot(m.principal), 'merge.autoStash', 'true'), 'config')
    const U = committer(m.amont, { 'm.md': 'titre\namont\n' })
    ecrireTravail(m.principal, 'm.md', 'titre\namont\nlocal\n')
    assert.equal((await sync(m.principal)).etat, 'avance')
    assert.equal(head(m.principal), U)
    assert.equal(travail(m.principal, 'm.md'), 'titre\namont\nlocal\n')
    assert.equal(shaDe(depot(m.principal), 'refs/stash'), null)
  })

  test('13 écriture concurrente : sur p (CAS) et sur D\\P (« not uptodate ») ; zéro application', async () => {
    {
      const m = monde({ 'm.md': 'titre\n', 'n.md': 'n\n' })
      committer(m.amont, { 'm.md': 'titre\namont\n', 'n.md': 'n2\n' })
      ecrireTravail(m.principal, 'm.md', 'titre\namont\nlocal\n')
      const vu = await sync(m.principal, { etape: (nom) => { if (nom === 'transaction') ecrireTravail(m.principal, 'm.md', 'tiers\n') } })
      assert.deepEqual(vu, { etat: 'ecriture-concurrente', chemins: ['m.md'] })
      assert.equal(head(m.principal), m.B)
      assert.equal(indexe(m.principal, 'm.md'), 'titre\n')
      assert.equal(travail(m.principal, 'm.md'), 'tiers\n')
      assert.equal(travail(m.principal, 'n.md'), 'n\n')
      assert.deepEqual(stage(m.principal), [])
      assert.deepEqual(traces(m.principal), { verrouIndex: false, synchro: false })
    }
    {
      const m = monde({ 'm.md': 'titre\n', 'n.md': 'n\n' })
      committer(m.amont, { 'm.md': 'titre\namont\n', 'n.md': 'n2\n' })
      ecrireTravail(m.principal, 'm.md', 'titre\namont\nlocal\n')
      const vu = await sync(m.principal, { etape: (nom) => { if (nom === 'travail') ecrireTravail(m.principal, 'n.md', 'n tiers\n') } })
      assert.equal(vu.etat, 'ecriture-concurrente')
      assert.match(vu.raison, /not uptodate/)
      assert.equal(head(m.principal), m.B)
      assert.equal(travail(m.principal, 'm.md'), 'titre\namont\nlocal\n')
      assert.equal(travail(m.principal, 'n.md'), 'n tiers\n')
      assert.equal(indexe(m.principal, 'n.md'), 'n\n')
      assert.deepEqual(traces(m.principal), { verrouIndex: false, synchro: false })
    }
  })

  test('revalidation après prepare : HEAD basculé sur une autre branche au même sha → branche-etrangere, autre intacte', async () => {
    const m = monde({ 'a.md': 'a\n' })
    committer(m.amont, { 'a.md': 'b\n' })
    exiger(poserRef(depot(m.principal), 'refs/heads/autre', m.B), 'branche')
    const vu = await sync(m.principal, { etape: (nom) => { if (nom === 'capture') writeFileSync(join(m.principal, '.git', 'HEAD'), 'ref: refs/heads/autre\n') } })
    assert.deepEqual(vu, { etat: 'branche-etrangere', branche: 'autre' })
    assert.equal(shaDe(depot(m.principal), 'refs/heads/autre'), m.B)
    assert.equal(shaDe(depot(m.principal), 'refs/heads/main'), m.B)
    assert.deepEqual(traces(m.principal), { verrouIndex: false, synchro: false })
  })

  test('15 post-merge en échec : avance-non-prete, code lu', async () => {
    const m = monde({ 'a.md': 'a\n' })
    const U = committer(m.amont, { 'a.md': 'b\n' })
    mkdirSync(join(m.principal, 'hooks-fixture'))
    writeFileSync(join(m.principal, 'hooks-fixture', 'post-merge'), '#!/bin/sh\necho "post-merge $1" >&2\nexit 3\n')
    exiger(reglerDepot(depot(m.principal), 'core.hooksPath', 'hooks-fixture'), 'hooksPath')
    const vu = await sync(m.principal)
    assert.equal(vu.etat, 'avance-non-prete')
    assert.equal(vu.code, 3)
    assert.match(vu.sortie, /post-merge 0/)
    assert.equal(head(m.principal), U)
    assert.deepEqual(traces(m.principal), { verrouIndex: false, synchro: false })
  })

  test('configurationClientChangee : chemins B..U de configuration client', async () => {
    const m = monde({ 'a.md': 'a\n' })
    committer(m.amont, { '.claude/settings.json': '{}\n', '.claude/skills/harnais/x.ts': 'x\n', 'b.md': 'b\n' })
    const vu = await sync(m.principal)
    assert.deepEqual(vu.configurationClientChangee, ['.claude/settings.json', '.claude/skills/harnais/x.ts'])
  })

  test('git muet avant toute application : git-indisponible, verrous libérés, rien appliqué', async () => {
    const m = monde({ 'm.md': 'titre\n' })
    committer(m.amont, { 'm.md': 'titre\namont\n' })
    const env = { ...ENV, ...envGitFeint([{ si: ['diff-tree'], status: 128, stderr: 'fatal: feinte diff-tree' }]) }
    const vu = await synchroniserPrincipal({ depuis: m.principal, env, gestes: { attente: ATTENTE } })
    assert.equal(vu.etat, 'git-indisponible')
    assert.match(vu.raison, /feinte diff-tree/)
    assert.equal('journal' in vu, false)
    assert.equal(head(m.principal), m.B)
    assert.deepEqual(traces(m.principal), { verrouIndex: false, synchro: false })
    assert.equal(existsSync(join(m.principal, '.git', 'synchro.verrou')), false)
  })

  test('git muet après l’avance : git-indisponible portant le journal, puis la reprise conclut', async () => {
    const m = monde({ 'm.md': 'titre\n' })
    const U = committer(m.amont, { 'm.md': 'titre\namont\n' })
    const env = { ...ENV, ...envGitFeint([{ si: ['update-ref', 'ORIG_HEAD'], status: 1, stderr: 'fatal: feinte ORIG_HEAD' }]) }
    const vu = await synchroniserPrincipal({ depuis: m.principal, env, gestes: { attente: ATTENTE } })
    assert.equal(vu.etat, 'git-indisponible')
    assert.match(vu.raison, /feinte ORIG_HEAD/)
    assert.ok(existsSync(vu.journal))
    assert.equal(head(m.principal), U)
    assert.equal(traces(m.principal).verrouIndex, true)
    assert.equal((await sync(m.principal)).etat, 'avance')
    assert.equal(shaDe(depot(m.principal), 'ORIG_HEAD'), m.B)
    assert.deepEqual(traces(m.principal), { verrouIndex: false, synchro: false })
  })

  test('annonces espacées : une seule annonce par verrou tenu sous l’intervalle', async () => {
    const m = monde({ 'a.md': 'a\n' })
    committer(m.amont, { 'a.md': 'b\n' })
    writeFileSync(join(m.principal, '.git', 'index.lock'), '')
    const annonces = []
    const liberer = setTimeout(() => rmSync(join(m.principal, '.git', 'index.lock')), 400)
    const vu = await synchroniserPrincipal({ depuis: m.principal, env: ENV, gestes: { attente: { echeanceMs: 3_000, pasMs: 20 } }, annoncer: (t) => annonces.push(t) })
    clearTimeout(liberer)
    assert.equal(vu.etat, 'avance')
    assert.equal(annonces.length, 1)
    writeFileSync(join(m.principal, '.git', 'synchro.verrou'), JSON.stringify({ pid: 999_999 }))
    const occupe = await synchroniserPrincipal({ depuis: m.principal, env: ENV, gestes: { attente: { echeanceMs: 400, pasMs: 20 }, estVivant: () => true }, annoncer: (t) => annonces.push(t) })
    assert.equal(occupe.etat, 'occupe')
    assert.deepEqual(annonces.slice(1), ['[synchroniser] verrou tenu par le PID 999999'])
  })

  test('17 appel depuis un WT : le principal avance, HEAD du WT inchangé', async () => {
    const m = monde({ 'a.md': 'a\n' })
    const U = committer(m.amont, { 'a.md': 'b\n' })
    const wt = join(m.principal, '.wt-x')
    exiger(ajouterWorktree(depot(m.principal), { chemin: wt, branche: 'chantier/x', depuis: 'HEAD' }), 'worktree')
    const vu = await sync(wt)
    assert.equal(vu.etat, 'avance')
    assert.equal(head(m.principal), U)
    assert.equal(head(wt), m.B)
    assert.equal(brancheDe(depot(wt)), 'chantier/x')
  })
})

/** Le script d'un processus synchroniseur réel : s'arrête (SIGKILL) après l'étape `argv[3]`. */
const ENFANT = `
import { synchroniserPrincipal } from ${JSON.stringify(pathToFileURL(join(import.meta.dirname, 'synchroniser.mjs')).href)}
const [principal, arret] = process.argv.slice(2)
const vu = await synchroniserPrincipal({ depuis: principal, env: process.env, gestes: {
  attente: { echeanceMs: 10000, pasMs: 20 },
  etape: (nom) => { if (nom === arret) process.kill(process.pid, 'SIGKILL') },
} })
process.stdout.write(JSON.stringify(vu))
`

describe('14 mort réelle à chaque étape 4 à 10, puis reprise par un processus NEUF', () => {
  const script = join(TMP, `synchro-enfant-${process.pid}.mjs`)
  writeFileSync(script, ENFANT)
  jetables.push(script)
  const lancer = (principal, arret = '') => spawnSync(process.execPath, [script, principal, arret], { env: ENV, encoding: 'utf8', timeout: 60_000 })

  for (const arret of ['transaction', 'travail', 'arbre', 'index', 'commit', 'consommateurs', 'liberation']) {
    test(`mort après « ${arret} »`, () => {
      const m = monde({ 'm.md': 'titre\n', 'f.md': 'a\nb\nc\n', 'n.md': 'n\n' })
      const U = committer(m.amont, { 'm.md': 'titre\namont\n', 'f.md': 'A\nb\nc\n', 'n.md': 'n2\n', 'neuf.md': 'neuf\n' })
      ecrireTravail(m.principal, 'm.md', 'titre\namont\nlocal\n')
      indexer(m.principal, 'f.md', 'a\nb\nC\n')
      ecrireTravail(m.principal, 'f.md', 'a\nb\nC\nw\n')
      const mort = lancer(m.principal, arret)
      assert.notEqual(mort.status, 0, `le processus devait mourir : ${mort.stdout} ${mort.stderr}`)
      assert.equal(mort.stdout, '')
      const reprise = lancer(m.principal)
      assert.equal(reprise.status, 0, reprise.stderr)
      const vu = JSON.parse(reprise.stdout)
      assert.equal(vu.etat, 'avance', reprise.stdout)
      assert.equal(head(m.principal), U)
      assert.equal(shaDe(depot(m.principal), 'ORIG_HEAD'), m.B)
      assert.equal(travail(m.principal, 'm.md'), 'titre\namont\nlocal\n')
      assert.equal(indexe(m.principal, 'm.md'), 'titre\namont\n')
      assert.equal(indexe(m.principal, 'f.md'), 'A\nb\nC\n')
      assert.equal(travail(m.principal, 'f.md'), 'A\nb\nC\nw\n')
      assert.equal(travail(m.principal, 'n.md'), 'n2\n')
      assert.equal(travail(m.principal, 'neuf.md'), 'neuf\n')
      assert.deepEqual(stage(m.principal), ['f.md'])
      assert.deepEqual(traces(m.principal), { verrouIndex: false, synchro: false })
    })
  }

  test('main.lock périmé sans jeton → reprise-impossible, verrou nommé et conservé', async () => {
    const m = monde({ 'm.md': 'titre\n' })
    committer(m.amont, { 'm.md': 'titre\namont\n' })
    ecrireTravail(m.principal, 'm.md', 'titre\namont\nlocal\n')
    assert.notEqual(lancer(m.principal, 'travail').status, 0)
    const perime = join(m.principal, '.git', 'refs', 'heads', 'main.lock')
    writeFileSync(perime, `${m.B}\n`)
    const vu = await sync(m.principal, { attente: { echeanceMs: 300, pasMs: 20 } })
    assert.equal(vu.etat, 'reprise-impossible')
    assert.deepEqual(vu.verrous, [perime])
    assert.ok(existsSync(perime))
    assert.equal(head(m.principal), m.B)
    assert.ok(existsSync(vu.journal))
  })
})

describe('incertains', () => {
  test('PID recyclé : estVivant toujours vrai → occupe à échéance, jamais de reprise', async () => {
    const m = monde({ 'm.md': 'titre\n' })
    committer(m.amont, { 'm.md': 'titre\namont\n' })
    ecrireTravail(m.principal, 'm.md', 'titre\namont\nlocal\n')
    const mort = spawnSync(process.execPath, [join(TMP, `synchro-enfant-${process.pid}.mjs`), m.principal, 'travail'], { env: ENV, encoding: 'utf8', timeout: 60_000 })
    assert.notEqual(mort.status, 0)
    const tenant = JSON.parse(readFileSync(join(m.principal, '.git', 'synchro.verrou'), 'utf8'))
    const vu = await sync(m.principal, { estVivant: () => true, attente: { echeanceMs: 300, pasMs: 20 } })
    assert.equal(vu.etat, 'occupe')
    assert.equal(vu.tenant.pid, tenant.pid)
    assert.equal(head(m.principal), m.B)
    assert.ok(existsSync(join(m.principal, '.git', 'index.lock')))
    assert.ok(existsSync(join(m.principal, '.git', 'synchro')))
  })

  test('rename de .git/index contre une boucle git status concurrente : 1000 renommages', async (t) => {
    const m = monde({ 'a.md': 'a\n' })
    const arret = join(m.principal, '.git', 'arret-boucle')
    const boucle = spawn(process.execPath, ['--input-type=module', '-e', `
      import { existsSync } from 'node:fs'
      import { depotDe, etatDeLArbre } from ${JSON.stringify(pathToFileURL(join(import.meta.dirname, '..', 'guards', 'lib', 'gitPorte.mjs')).href)}
      const d = depotDe(${JSON.stringify(m.principal)})
      const fin = Date.now() + 120000
      let n = 0
      process.stdout.write('pret ')
      while (!existsSync(${JSON.stringify(arret)}) && Date.now() < fin) { etatDeLArbre(d); n += 1 }
      process.stdout.write(String(n))
    `], { env: ENV, stdio: ['ignore', 'pipe', 'inherit'] })
    let lus = ''
    boucle.stdout.on('data', (d) => { lus += d })
    const fini = new Promise((ok) => boucle.on('close', ok))
    const limite = Date.now() + 30_000
    while (!lus.startsWith('pret ') && boucle.exitCode === null && Date.now() < limite) await new Promise((ok) => setTimeout(ok, 10))
    assert.ok(lus.startsWith('pret '), `la boucle git status n'a pas démarré (sortie ${boucle.exitCode})`)
    try {
      const source = join(m.principal, '.git', 'index')
      const refus = []
      for (let i = 0; i < 1000; i += 1) {
        const candidat = join(m.principal, '.git', 'index.candidat')
        copyFileSync(source, candidat)
        refus.push(...remplacerIndex(candidat, source))
      }
      writeFileSync(arret, '')
      await fini
      t.diagnostic(`renommages refusés puis rejoués : ${refus.length} (${[...new Set(refus)].join(', ') || 'aucun'}) ; git status concurrents : ${lus.slice(5)}`)
      const statuts = Number(lus.slice('pret '.length))
      assert.ok(statuts > 0)
      assert.equal(stage(m.principal).length, 0)
    } finally {
      writeFileSync(arret, '')
      if (boucle.exitCode === null) boucle.kill()
    }
  })
})
