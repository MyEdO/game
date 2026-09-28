// REJEU SUR EXPORT (#1613) — la mesure « rien n'a bougé » quand l'arbre rejoué N'EST PAS un dépôt.
//
// Fixture : un VRAI dépôt jetable sous `os.tmpdir()`, une migration NON IDEMPOTENTE déposée dans
// `scripts/migrations/`, et le rejeu joué sur l'EXPORT de sa tête. Le dépôt jetable est le seul git
// que ces tests écrivent.
//
// Ce que ces tests verrouillent, et que `git diff` ne peut PAS rendre hors dépôt (mesuré, sonde
// `scratchpad/t1b-sonde-6.mjs`) : `git diff --exit-code -- <a> <b> …` hors dépôt bascule en
// `--no-index`, compare les DEUX PREMIERS chemins et prend le reste en pathspec — aucun de ceux-là
// n'existant, il rend **exit 0**, soit le vert le plus fort qui soit sur un arbre pourtant réécrit.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync, spawn } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { blobsDe, comparer, empreinteDe, fichiersDe, rapportDEcart } from './empreinteRejeu.mjs'
import { PERIMETRE, mesurerParGit } from '../replay.mjs'
import { RACINE_DES_EXPORTS, effacerExport, exportsDuProcessus, rejeuSurExport } from '../replay-head.mjs'
import { instanceDeDepot } from '../../guards/lib/depotGabarit.mjs'
import { efface } from './joue.mjs'

const ICI = dirname(fileURLToPath(import.meta.url))

const git = (cwd) => (args) => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim()

function ecrire(racine, rel, texte) {
  mkdirSync(join(racine, dirname(rel)), { recursive: true })
  writeFileSync(join(racine, rel), texte)
}

/** FIXTURE (sonde v2-2d du juge, promue VERBATIM) : migration NON IDEMPOTENTE. */
const MIGRATION_NON_IDEMPOTENTE = `/**
 * FIXTURE (sonde v2-2d) : migration NON IDEMPOTENTE, deposee dans un EXPORT JETABLE.
 * ENTRÉES : \`src/data/props.json\` (elle le REECRIT a chaque passage — c'est le defaut a attraper).
 * Attendu : \`migrations:replay\` sur l'export doit sortir ROUGE (« DONNÉE RÉÉCRITE par le rejeu »).
 */
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const f = ROOT + 'src/data/props.json';
const j = JSON.parse(fs.readFileSync(f, 'utf8'));
j.__sonde_non_idempotente = Date.now();
fs.writeFileSync(f, JSON.stringify(j, null, 2) + '\\n');
console.log('fixture : props.json reecrit');
`

/** Migration qui CRÉE un document à chaque passage : invisible à un `git diff`, même en dépôt. */
const MIGRATION_QUI_CREE = `/**
 * FIXTURE : migration qui CRÉE un document neuf à chaque passage.
 * ENTRÉES : \`src/data/props.json\` (lue), \`src/data/neuf.json\` (écrite).
 */
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
const ROOT = fileURLToPath(new URL('../../', import.meta.url));
fs.writeFileSync(ROOT + 'src/data/neuf.json', JSON.stringify({ ne: Date.now() }) + '\\n');
`

/** Migration IDEMPOTENTE : elle réécrit le MÊME contenu, octet pour octet. */
const MIGRATION_IDEMPOTENTE = `/**
 * FIXTURE : migration idempotente (réécriture à l'octet du contenu déjà en place).
 * ENTRÉES : \`src/data/props.json\`.
 */
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const f = ROOT + 'src/data/props.json';
fs.writeFileSync(f, fs.readFileSync(f));
`

/** Dépôt jetable : un document du PÉRIMÈTRE, et les migrations demandées. */
function depot(migrations = {}) {
  const fichiers = { 'src/data/props.json': `${JSON.stringify({ props: [] }, null, 2)}\n` }
  for (const [nom, corps] of Object.entries(migrations)) fichiers[`scripts/migrations/${nom}`] = corps
  return instanceDeDepot({ fichiers, message: 'fondation' }).racine
}

test('migration NON IDEMPOTENTE : le rejeu sur EXPORT sort ROUGE et NOMME la donnée réécrite', () => {
  const racine = depot({ '2026-09-03-fixture-non-idempotente.mjs': MIGRATION_NON_IDEMPOTENTE })
  try {
    const { rouges, lignes } = rejeuSurExport({ cwd: racine, ecrire: () => {} })
    const dit = [...rouges, ...lignes].join('\n')
    assert.match(dit, /DONNÉE RÉÉCRITE/)
    assert.match(dit, /src\/data\/props\.json/)
  } finally {
    efface(racine)
  }
})

test('migration qui CRÉE un document : le rejeu sur EXPORT le nomme comme FICHIER NEUF', () => {
  const racine = depot({ '2026-09-03-fixture-qui-cree.mjs': MIGRATION_QUI_CREE })
  try {
    const { rouges, lignes } = rejeuSurExport({ cwd: racine, ecrire: () => {} })
    const dit = [...rouges, ...lignes].join('\n')
    assert.match(dit, /FICHIER NEUF/)
    assert.match(dit, /src\/data\/neuf\.json/)
  } finally {
    efface(racine)
  }
})

test('migration IDEMPOTENTE (réécriture à l’octet) : le rejeu sur EXPORT passe', () => {
  const racine = depot({ '2026-09-03-fixture-idempotente.mjs': MIGRATION_IDEMPOTENTE })
  try {
    const { rouges } = rejeuSurExport({ cwd: racine, ecrire: () => {} })
    assert.deepEqual(rouges, [])
  } finally {
    efface(racine)
  }
})

test('l’export est celui de l’ARBRE du sha : un fichier modifié NON COMMITÉ n’y est pas', () => {
  const racine = depot({ '2026-09-03-fixture-idempotente.mjs': MIGRATION_IDEMPOTENTE })
  try {
    // Le working tree porte une réécriture NON COMMITÉE : si l'export la prenait, l'empreinte
    // divergerait des blobs de la tête et le rejeu serait accusé d'un défaut qui n'est pas le sien.
    ecrire(racine, 'src/data/props.json', `${JSON.stringify({ props: ['wip non commité'] }, null, 2)}\n`)
    const { rouges } = rejeuSurExport({ cwd: racine, ecrire: () => {} })
    assert.deepEqual(rouges, [])
  } finally {
    efface(racine)
  }
})

// La racine des exports est un magasin PARTAGÉ : trois tests la lisent pour dire « rien n'a été
// laissé derrière ». Mesuré sur `test:hooks` (2026-09-06) : l'export `94fa18f3-13272` d'un pre-push
// VOISIN, apparu ENTRE les deux lectures, faisait rougir trois tests qui n'avaient rien fabriqué.
// C'est le PID porté par le nom qui les sépare — et cette séparation se mesure ICI, jamais par
// l'absence de voisin le jour du run.
test('un export d’un AUTRE processus est INVISIBLE : la racine est partagée, la lecture ne l’est pas', () => {
  const etranger = join(RACINE_DES_EXPORTS, 'deadbeef-99999')
  mkdirSync(etranger, { recursive: true })
  try {
    assert.ok(existsSync(etranger), 'la fixture doit être posée sous la racine réelle')
    assert.deepEqual(exportsDuProcessus(), [], 'le voisin entre dans notre lecture')
    assert.deepEqual(exportsDuProcessus(99999), ['deadbeef-99999'], 'interrogé par SON pid, le voisin doit se voir')
  } finally {
    efface(etranger)
  }
})

test('l’export est EFFACÉ à la fin, même quand le rejeu sort rouge', () => {
  const racine = depot({ '2026-09-03-fixture-non-idempotente.mjs': MIGRATION_NON_IDEMPOTENTE })
  try {
    // Le rejeu tourne DANS CE PROCESSUS : son export porte NOTRE pid. La racine étant partagée, on ne
    // lit que les nôtres — sinon l'export d'un `pre-push` voisin ferait rougir ce test.
    const avant = exportsDuProcessus()
    const { dossier, rouges } = rejeuSurExport({ cwd: racine, ecrire: () => {} })
    assert.ok(rouges.length > 0)
    assert.ok(dossier.startsWith(RACINE_DES_EXPORTS), `${dossier} doit vivre sous ${RACINE_DES_EXPORTS}`)
    assert.equal(existsSync(dossier), false)
    assert.deepEqual(exportsDuProcessus(), avant)
  } finally {
    efface(racine)
  }
})

test('mesure par `git diff` HORS dépôt : ROUGE NOMMÉ, jamais « INCHANGÉ » ni « rien n’a bougé »', () => {
  const dehors = mkdtempSync(join(tmpdir(), 'hors-depot-'))
  try {
    // L'arbre porte les deux premiers chemins du périmètre : c'est le cas qui fait basculer
    // `git diff` en `--no-index` et lui fait rendre **0** — le faux vert le plus fort.
    mkdirSync(join(dehors, 'src/data'), { recursive: true })
    mkdirSync(join(dehors, 'src/scenes'), { recursive: true })
    writeFileSync(join(dehors, 'src/data/props.json'), '{}\n')
    const { rouges, lignes } = mesurerParGit({ racine: dehors, perimetre: PERIMETRE, diffAvant: '', neufsAvant: new Set() })
    const dit = [...rouges, ...lignes].join('\n')
    assert.match(dit, /mesure git impossible/)
    assert.match(dit, /n’est pas un dépôt/)
    assert.equal(rouges.length > 0, true)
    assert.ok(!/INCHANGÉ/.test(dit), 'un arbre hors dépôt ne se déclare pas « INCHANGÉ »')
    assert.ok(!/rien n’a bougé/.test(dit), 'un arbre hors dépôt ne se déclare pas « rien n’a bougé »')
  } finally {
    efface(dehors)
  }
})

test('empreinteDe / blobsDe : mêmes chemins, mêmes sha sur un arbre non touché', () => {
  const racine = depot()
  try {
    const blobs = blobsDe(racine, git(racine)(['rev-parse', 'HEAD']), PERIMETRE)
    const empreinte = empreinteDe(racine, PERIMETRE)
    assert.deepEqual([...empreinte.keys()], ['src/data/props.json'])
    assert.deepEqual([...blobs.keys()], ['src/data/props.json'])
    assert.equal(empreinte.get('src/data/props.json'), blobs.get('src/data/props.json'))
    assert.deepEqual(comparer(blobs, empreinte), { reecrits: [], neufs: [], disparus: [] })
  } finally {
    efface(racine)
  }
})

test('comparer : réécrit, neuf et disparu se distinguent, et le rapport les NOMME', () => {
  const avant = new Map([
    ['src/data/a.json', 'aaa'],
    ['src/data/parti.json', 'ppp'],
  ])
  const apres = new Map([
    ['src/data/a.json', 'zzz'],
    ['src/data/neuf.json', 'nnn'],
  ])
  assert.deepEqual(comparer(avant, apres), {
    reecrits: ['src/data/a.json'],
    neufs: ['src/data/neuf.json'],
    disparus: ['src/data/parti.json'],
  })
  const { rouges, lignes } = rapportDEcart(comparer(avant, apres))
  const dit = [...rouges, ...lignes].join('\n')
  assert.match(dit, /DONNÉE RÉÉCRITE/)
  assert.match(dit, /FICHIER NEUF/)
  assert.match(dit, /DOCUMENT DISPARU/)
  assert.equal(rouges.length, 3)
})

test('fichiersDe : chemins en « / », TRIÉS en unités de code, dossiers absents ignorés', () => {
  const racine = mkdtempSync(join(tmpdir(), 'liste-'))
  try {
    mkdirSync(join(racine, 'src/data/sous'), { recursive: true })
    for (const f of ['src/data/b.json', 'src/data/a.json', 'src/data/sous/c.json']) writeFileSync(join(racine, f), '{}\n')
    assert.deepEqual(fichiersDe(racine, PERIMETRE), ['src/data/a.json', 'src/data/b.json', 'src/data/sous/c.json'])
  } finally {
    efface(racine)
  }
})

test('le rejeu sur export ne LAISSE aucune trace dans le dépôt source', () => {
  const racine = depot({ '2026-09-03-fixture-non-idempotente.mjs': MIGRATION_NON_IDEMPOTENTE })
  try {
    const avant = readFileSync(join(racine, 'src/data/props.json'), 'utf8')
    rejeuSurExport({ cwd: racine, ecrire: () => {} })
    assert.equal(readFileSync(join(racine, 'src/data/props.json'), 'utf8'), avant)
    assert.equal(git(racine)(['status', '--porcelain']), '')
  } finally {
    efface(racine)
  }
})

// Sonde A du juge de diff, PROMUE — le préfixe daté seul remplaçait un faux vert par un autre : une
// migration NON IDEMPOTENTE au nom mal formé sortait « 0 migration(s) … (hors rejeu, modules de la
// porte : corrige-props.mjs) », verdict VERT, sans avoir jamais été jouée.
const MIGRATION_MAL_NOMMEE = `/**
 * FIXTURE : migration NON IDEMPOTENTE, SANS préfixe daté (nom oublié par l'auteur).
 * ENTRÉES : \`src/data/props.json\`.
 */
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
const f = fileURLToPath(new URL('../../', import.meta.url)) + 'src/data/props.json';
const j = JSON.parse(fs.readFileSync(f, 'utf8'));
j.__casse = Date.now();
fs.writeFileSync(f, JSON.stringify(j, null, 2) + '\\n');
`

test('un `.mjs` du dossier SANS préfixe daté est ROUGE et NOMMÉ — jamais sauté en silence', () => {
  const racine = depot({ 'corrige-props.mjs': MIGRATION_MAL_NOMMEE })
  try {
    const { rouges, lignes } = rejeuSurExport({ cwd: racine, ecrire: () => {} })
    const dit = [...rouges, ...lignes].join('\n')
    assert.match(dit, /corrige-props\.mjs/)
    assert.match(dit, /sans préfixe daté — ni migration, ni module de la porte/)
    assert.ok(!dit.includes('modules de la porte : corrige-props.mjs'), 'un inclassable n’est pas un module de la porte')
  } finally {
    efface(racine)
  }
})

test('les modules de la porte, eux, sont HORS rejeu sans rougir', () => {
  const racine = depot({ '2026-09-03-fixture-idempotente.mjs': MIGRATION_IDEMPOTENTE, 'replay.mjs': '// module de la porte\n' })
  try {
    const lues = []
    const { rouges } = rejeuSurExport({ cwd: racine, ecrire: (l) => lues.push(l) })
    assert.deepEqual(rouges, [])
    assert.match(lues.join('\n'), /\(hors rejeu, modules de la porte : replay\.mjs\)/)
  } finally {
    efface(racine)
  }
})

// Sonde D du juge de diff, PROMUE — deux rejeux du MÊME sha en même temps (un `pre-push` pendant un
// `migrations:replay:head` à la main, deux worktrees au même commit). Sous un dossier d'export nommé
// par le seul sha8, mesuré : le second mourait en `EBUSY rmdir`, et l'ordre inverse rendait un faux
// rouge « DOCUMENT DISPARU ». Les deux process sont RÉELS : c'est la concurrence qu'on mesure.
const MIGRATION_LENTE = `/** ENTRÉES : \`src/data/props.json\`. */
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
const f = fileURLToPath(new URL('../../', import.meta.url)) + 'src/data/props.json';
const fin = Date.now() + 3000; while (Date.now() < fin) {}
fs.writeFileSync(f, fs.readFileSync(f));
`

test('deux rejeux CONCURRENTS sur le même sha : deux exits 0, deux dossiers, tous deux effacés', async () => {
  const racine = depot({ '2026-09-03-lente.mjs': MIGRATION_LENTE })
  const porte = join(ICI, '..', 'replay-head.mjs')
  try {
    const lancer = () =>
      new Promise((res) => {
        const p = spawn(process.execPath, [porte], { cwd: racine })
        let sortie = ''
        p.stdout.on('data', (d) => (sortie += d))
        p.stderr.on('data', (d) => (sortie += d))
        p.on('close', (code) => res({ code, sortie }))
      })
    const premier = lancer()
    await new Promise((r) => setTimeout(r, 1500))
    const second = lancer()
    const [a, b] = await Promise.all([premier, second])
    assert.equal(a.code, 0, `premier rejeu :\n${a.sortie}`)
    assert.equal(b.code, 0, `second rejeu (concurrent) :\n${b.sortie}`)
    const dossiers = [a, b].map((r) => /sous (\S+) \(/.exec(r.sortie)?.[1])
    assert.ok(dossiers.every(Boolean), `chaque rejeu nomme son export : ${JSON.stringify(dossiers)}`)
    assert.notEqual(dossiers[0], dossiers[1], 'deux rejeux concurrents ne partagent pas un dossier')
    for (const d of dossiers) assert.equal(existsSync(d), false, `${d} doit être effacé`)
    // Les deux exports sont ceux des ENFANTS : leur pid se lit dans le nom du dossier
    // (`<sha8>-<pid>`). On n'interroge que ces deux processus-là — la racine est partagée, et le
    // dossier entier porterait aussi les exports d'un `pre-push` voisin.
    for (const d of dossiers) {
      const pid = Number(basename(d).split('-').at(-1))
      assert.ok(Number.isInteger(pid), `${d} ne porte pas le pid de son rejeu`)
      assert.deepEqual(exportsDuProcessus(pid), [], `le rejeu ${pid} laisse un export derrière lui`)
    }
  } finally {
    efface(racine)
  }
})

// Sonde F du juge de diff, PROMUE — une entrée FICHIER du périmètre rendait un `disparus` FANTÔME :
// `blobsDe` la voyait (pathspec de `ls-tree`), `fichiersDe` non.
test('une entrée FICHIER du périmètre est vue des DEUX côtés — aucun « disparu » fantôme', () => {
  const racine = depot()
  try {
    const perimetre = ['src/data', 'package.json']
    writeFileSync(join(racine, 'package.json'), '{"name":"jetable"}\n')
    git(racine)(['add', '-A'])
    git(racine)(['commit', '-m', 'entrée FICHIER au périmètre'])
    const sha = git(racine)(['rev-parse', 'HEAD'])
    assert.deepEqual(fichiersDe(racine, perimetre), ['package.json', 'src/data/props.json'])
    const ecart = comparer(blobsDe(racine, sha, perimetre), empreinteDe(racine, perimetre))
    assert.deepEqual(ecart, { reecrits: [], neufs: [], disparus: [] })
  } finally {
    efface(racine)
  }
})

// Sonde E du juge de diff, PROMUE — le garde de préfixe de l'effacement. Il ne se mesure pas en
// recopiant son expression : il se mesure en LUI DEMANDANT d'effacer un voisin. `…/wr-sauvegarde` et
// `…/wrangler-cache` passaient un `startsWith` sans séparateur (mesuré).
test('l’effacement d’un export REFUSE tout voisin de `…/wr` — préfixe de CHEMIN, pas de chaîne', () => {
  const voisins = [`${RACINE_DES_EXPORTS}-sauvegarde`, join(tmpdir(), 'wrangler-cache'), join(tmpdir(), 'autre')]
  for (const voisin of voisins) {
    mkdirSync(voisin, { recursive: true })
    writeFileSync(join(voisin, 'temoin.txt'), 'ne doit pas disparaître\n')
    try {
      assert.throws(() => effacerExport(voisin), /refus d’effacer/, `${voisin} doit être refusé`)
      assert.equal(existsSync(join(voisin, 'temoin.txt')), true, `${voisin} doit être intact`)
    } finally {
      efface(voisin)
    }
  }
  // …et il accepte bien un export réel, sous la racine.
  const vrai = join(RACINE_DES_EXPORTS, 'abc12345-999999')
  mkdirSync(vrai, { recursive: true })
  effacerExport(vrai)
  assert.equal(existsSync(vrai), false)
})
