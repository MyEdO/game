// #2626
import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync, openSync, closeSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { preparerPublication, publierDepuisSnapshot, lancerProcessus, ENV_PUBLICATION } from './publicationIsolee.mjs'
import { gitDe } from '../test/gitDeBanc.mjs'
import { depotDe } from '../guards/lib/gitPorte.mjs'
import { envDeDepotForge } from '../guards/lib/depotGabarit.mjs'
import { ETAPES } from './etapesDuTrain.mjs'
import { spawnSync } from 'node:child_process'
import { prendreVerrou } from '../test/verrou.mjs'
import { contexteDe, RACINE } from './publierTrain.mjs'
import { cheminsDeJournal } from './publicationDonnee.mjs'
import { pathToFileURL } from 'node:url'

const SHA = 'a'.repeat(40)
const DISTANT = 'b'.repeat(40)

test('bootstrap réel : seul le superviseur committé du snapshot est chargé malgré SOURCE indirecte puis empoisonnée', { timeout: 30000 }, async (t) => {
  const b = banc(t)
  const git = gitDe(b.source, { net: true })
  git('init', '-b', 'chantier/2626')
  git('config', 'user.name', 'Fixture')
  git('config', 'user.email', 'fixture@example.invalid')
  mkdirSync(join(b.source, 'scripts/ops'), { recursive: true })
  mkdirSync(join(b.source, 'scripts/guards/lib'), { recursive: true })
  const sourceModule = new URL('./publicationIsolee.mjs', import.meta.url)
  const bootstrap = readFileSync(sourceModule, 'utf8').replace(/from '([^']+)'/g, (texte, chemin) =>
    chemin.startsWith('.') ? "from " + JSON.stringify(new URL(chemin, sourceModule).href) : texte)
  const moduleSource = join(b.source, 'scripts/ops/publicationIsolee.mjs')
  const superviseurSource = join(b.source, 'scripts/guards/lib/superviserProcessus.mjs')
  writeFileSync(moduleSource, bootstrap)
  writeFileSync(superviseurSource, `import {spawn} from 'node:child_process';import {appendFileSync} from 'node:fs';import {join} from 'node:path';import {fileURLToPath} from 'node:url';
appendFileSync(fileURLToPath(new URL('../../../chargements.log',import.meta.url)),'committed\\n');
export async function superviserProcessus({commande,args,cwd,env,shell,stdio}){appendFileSync(join(cwd,'choix.log'),'committed\\n');const p=spawn(commande,args,{cwd,env,shell,stdio:stdio??'inherit'});return await new Promise(ok=>{p.once('error',e=>ok({status:null,signal:null,error:{code:e.code,message:e.message}}));p.once('close',(status,signal)=>ok({status,signal}))})}
export function sortieDeSupervision(vu){return vu.error?1:vu.status??1}`)
  writeFileSync(join(b.source, 'scripts/ops/npm-fixture.mjs'), "import {mkdirSync} from 'node:fs';mkdirSync('node_modules',{recursive:true})")
  writeFileSync(join(b.source, 'scripts/ops/publier.mjs'), `import {readFileSync,writeFileSync} from 'node:fs';const p=JSON.parse(process.env.${ENV_PUBLICATION});if(process.ppid!==p.pid)throw new Error('auth directe committée');const j=JSON.parse(readFileSync(p.journal));j.verdict={etat:'rouge'};writeFileSync(p.journal,JSON.stringify(j));process.exitCode=7`)
  writeFileSync(join(b.source, 'wip.txt'), 'committé')
  git('add', '--', 'scripts', 'wip.txt')
  git('commit', '-m', 'runtime committé refs #2626')
  const tete = git('rev-parse', 'HEAD')
  writeFileSync(join(b.source, 'wip.txt'), 'index')
  git('add', '--', 'wip.txt')
  writeFileSync(join(b.source, 'wip.txt'), 'WIP')
  const index = readFileSync(join(b.source, '.git/index'))
  writeFileSync(superviseurSource, `export {superviserProcessus,sortieDeSupervision} from ${JSON.stringify(new URL('../guards/lib/superviserProcessus.mjs', import.meta.url).href)}`)
  const indirect = readFileSync(superviseurSource)
  const module = await import(pathToFileURL(moduleSource).href)
  let snapshot
  const publication = (reprendre) => module.publierDepuisSnapshot({
    source: b.source, branche: 'chantier/2626', chemins: b.chemins, reprendre, args: ['--sans-fetch'],
    env: envDeDepotForge(), ecrire: () => {},
    entamer: (p) => { snapshot = p.snapshot },
    preparer: (p) => module.preparerPublication({
      ...p, uuid: () => 'runtime-committe',
      gestes: { depotDe: (cwd) => depotDe(cwd, { env: envDeDepotForge() }), shasDistants: () => new Map(), fetchOrigin: () => vert },
    }),
    lancementNpm: () => ({ executable: process.execPath, args: [join(snapshot, 'scripts/ops/npm-fixture.mjs')], shell: false }),
  })
  assert.equal(await publication(false), 7)
  assert.equal(readFileSync(join(snapshot, 'choix.log'), 'utf8'), 'committed\ncommitted\n')
  assert.equal(readFileSync(join(snapshot, 'chargements.log'), 'utf8'), 'committed\n')
  assert.deepEqual(readFileSync(superviseurSource), indirect)
  writeFileSync(superviseurSource, "throw new Error('SOURCE_SUPERVISION_INTERDITE');export {}")
  const poison = readFileSync(superviseurSource)
  assert.equal(await publication(true), 7)
  assert.equal(readFileSync(join(snapshot, 'choix.log'), 'utf8'), 'committed\ncommitted\ncommitted\n')
  assert.equal(readFileSync(join(snapshot, 'chargements.log'), 'utf8'), 'committed\n')
  assert.deepEqual(readFileSync(superviseurSource), poison)
  assert.deepEqual(readFileSync(join(b.source, '.git/index')), index)
  assert.equal(git('rev-parse', 'HEAD'), tete)
  assert.equal(readFileSync(join(b.source, 'wip.txt'), 'utf8'), 'WIP')
})

test('bootstrap : supervision snapshot absente refuse avant installation sans fallback SOURCE', async (t) => {
  const b = banc(t)
  let installations = 0; let diagnostic = ''
  const code = await publierDepuisSnapshot({
    source: b.source, branche: 'chantier/2626', chemins: b.chemins, reprendre: false, args: [],
    preparer: () => b.preparer(), lancementNpm: () => { installations += 1; throw new Error('installation interdite') },
    ecrire: (texte) => { diagnostic += texte },
  })
  assert.equal(code, 4)
  assert.equal(installations, 0)
  assert.match(diagnostic, /superviserProcessus\.mjs|Cannot find module/)
})

const vert = { disponible: true, valeur: { status: 0, stdout: '', stderr: '' } }

function banc(t) {
  const racine = mkdtempSync(join(tmpdir(), 'publication-isolee-'))
  t.after(() => rmSync(racine, { recursive: true, force: true }))
  const source = join(racine, 'codeur')
  mkdirSync(source)
  const chemins = cheminsDeJournal(source, 'chantier/2626')
  const appels = []
  let tete = SHA
  const gestes = {
    depotDe: (cwd) => ({ cwd }),
    brancheDe: (d) => d.cwd === source ? 'chantier/2626' : null,
    shaDe: () => tete,
    shasDistants: () => { appels.push('distant'); return new Map([['refs/heads/chantier/2626', DISTANT]]) },
    fetchOrigin: () => { appels.push('fetch'); tete = 'c'.repeat(40); return vert },
    estAncetre: () => ({ disponible: true, valeur: true }),
    ajouterWorktree: (_d, p) => {
      appels.push(p)
      mkdirSync(p.chemin)
      writeFileSync(join(p.chemin, '.git'), 'gitdir: fixture')
      writeFileSync(join(p.chemin, 'generateur.mjs'), 'committé')
      return vert
    },
  }
  const preparer = (p = {}) => preparerPublication({ source, branche: 'chantier/2626', chemins, reprendre: false, gestes, uuid: () => 'fixture', ...p })
  return { source, chemins, appels, gestes, preparer }
}

test('capture immuable, bail avant fetch, WIP/index/untracked intacts, générateur committé', (t) => {
  const b = banc(t)
  const fichiers = ['generateur.mjs', 'index', 'non-suivi']
  for (const fichier of fichiers) writeFileSync(join(b.source, fichier), `WIP ${fichier}`)
  const avant = fichiers.map((f) => readFileSync(join(b.source, f)))
  const p = b.preparer()
  assert.equal(p.demande, SHA)
  assert.equal(p.bail, DISTANT)
  assert.deepEqual(b.appels.slice(0, 2), ['distant', 'fetch'])
  assert.deepEqual(b.appels[2], { chemin: p.snapshot, depuis: SHA, detache: true })
  assert.equal(readFileSync(join(p.snapshot, 'generateur.mjs'), 'utf8'), 'committé')
  assert.deepEqual(fichiers.map((f) => readFileSync(join(b.source, f))), avant)
  assert.equal(JSON.parse(readFileSync(b.chemins.json)).publication.demande, SHA)
})

test('git réel : HEAD, index et WIP strictement inchangés ; snapshot depuis le générateur committé', async (t) => {
  const b = banc(t)
  const git = gitDe(b.source, { net: true })
  git('init', '-b', 'chantier/2626')
  git('config', 'user.name', 'Fixture')
  git('config', 'user.email', 'fixture@example.invalid')
  writeFileSync(join(b.source, '.git/info/exclude'), 'node_modules/\n')
  writeFileSync(join(b.source, 'generateur.mjs'), 'committé')
  git('add', '--', 'generateur.mjs')
  git('commit', '-m', 'fixture refs #2626')
  const tete = git('rev-parse', 'HEAD')
  writeFileSync(join(b.source, 'generateur.mjs'), 'index du codeur')
  git('add', '--', 'generateur.mjs')
  writeFileSync(join(b.source, 'generateur.mjs'), 'WIP du codeur')
  writeFileSync(join(b.source, 'non-suivi'), 'non suivi du codeur')
  const index = readFileSync(join(b.source, '.git/index'))
  const statut = git('status', '--porcelain=v1')
  const p = preparerPublication({
    source: b.source, branche: 'chantier/2626', chemins: b.chemins, reprendre: false,
    uuid: () => 'git-reel',
    gestes: {
      depotDe: (cwd) => depotDe(cwd, { env: envDeDepotForge() }),
      shasDistants: () => new Map(), fetchOrigin: () => vert,
    },
  })
  assert.equal(p.demande, tete)
  assert.equal(gitDe(p.snapshot, { net: true })('rev-parse', 'HEAD'), tete)
  assert.equal(gitDe(p.snapshot, { net: true })('rev-parse', '--abbrev-ref', 'HEAD'), 'HEAD')
  assert.equal(readFileSync(join(p.snapshot, 'generateur.mjs'), 'utf8'), 'committé')
  assert.equal(git('rev-parse', 'HEAD'), tete)
  assert.deepEqual(readFileSync(join(b.source, '.git/index')), index)
  assert.equal(git('status', '--porcelain=v1'), statut)
  assert.equal(readFileSync(join(b.source, 'generateur.mjs'), 'utf8'), 'WIP du codeur')
  assert.equal(readFileSync(join(b.source, 'non-suivi'), 'utf8'), 'non suivi du codeur')
  const verrou = prendreVerrou({ chemin: `${b.chemins.json}.publication.verrou`, libelle: 'banc publication', cwd: b.source })
  assert.equal(verrou.etat, 'pris')
  try {
    const code = `const {publicationDe}=await import(${JSON.stringify(new URL('./publicationIsolee.mjs', import.meta.url).href)}); console.log(publicationDe(process.env, ${JSON.stringify(p.snapshot)}).demande)`
    const enfant = (identite) => spawnSync(process.execPath, ['--input-type=module', '-e', code], { encoding: 'utf8', env: { ...envDeDepotForge(), [ENV_PUBLICATION]: JSON.stringify(identite) } })
    for (const identite of [
      { ...p, journal: join(b.source, 'journal-etranger.json') },
      { ...p, snapshot: join(b.source, 'snapshot-etranger') },
      { ...p, generation: '../traversee' },
    ]) {
      const refuse = enfant(identite)
      assert.notEqual(refuse.status, 0)
      assert.match(refuse.stderr, /identité invalide|génération invalide/)
      assert.doesNotMatch(refuse.stderr, /ENOENT/)
    }
    const valide = enfant(p)
    assert.equal(valide.status, 0, valide.stderr)
    assert.equal(valide.stdout.trim(), tete)
    const faux = enfant({ ...p, pid: process.pid + 1 })
    assert.notEqual(faux.status, 0)
    assert.match(faux.stderr, /lanceur ou verrou différent/)
    const script = join(b.source, 'auteur-publication.mjs')
    const sortie = join(b.source, 'auteur-publication.log')
    writeFileSync(script, code)
    for (const [identite, attendu] of [[p, 0], [{ ...p, pid: process.pid + 1 }, 1]]) {
      const fd = openSync(sortie, 'w')
      let execute
      try {
        execute = await lancerProcessus(process.execPath, [script], {
          cwd: p.snapshot, stdio: ['ignore', fd, fd],
          env: { ...envDeDepotForge(), [ENV_PUBLICATION]: JSON.stringify(identite) },
        })
      } finally { closeSync(fd) }
      assert.equal(execute.code, attendu, readFileSync(sortie, 'utf8'))
      assert.match(readFileSync(sortie, 'utf8'), attendu === 0 ? new RegExp(tete) : /lanceur ou verrou différent/)
    }
  } finally { verrou.liberer() }
  const divergent = git('commit-tree', `${tete}^{tree}`, '-m', 'divergent refs #2626')
  assert.throws(() => preparerPublication({
    source: b.source, branche: 'chantier/2626', chemins: { ...b.chemins, json: join(b.chemins.dossier, 'divergent.json') },
    gestes: {
      depotDe: (cwd) => depotDe(cwd, { env: envDeDepotForge() }),
      shasDistants: () => new Map([['refs/heads/chantier/2626', divergent]]), fetchOrigin: () => vert,
    },
  }), /distante a avancé/)
})

test('une tête distante hors de la cible est refusée avant création du snapshot', (t) => {
  const b = banc(t)
  b.gestes.estAncetre = () => ({ disponible: true, valeur: false })
  assert.throws(() => b.preparer(), /distante a avancé/)
  assert.equal(b.appels.length, 2)
})

test('ascendance indisponible ou objet absent : refus nommé avant snapshot', (t) => {
  const b = banc(t)
  for (const vu of [{ disponible: false, raison: 'git cassé' }, { disponible: true, absent: true }]) {
    b.gestes.estAncetre = () => vu
    assert.throws(() => b.preparer(), /ascendance indéterminée/)
  }
})

test('reprise retrouve le même snapshot et le bail malgré HEAD codeur avancé', (t) => {
  const b = banc(t)
  const p = b.preparer()
  const repris = b.preparer({ reprendre: true })
  assert.equal(repris.demande, SHA)
  assert.equal(repris.bail, DISTANT)
  assert.equal(repris.snapshot, p.snapshot)
  assert.equal(b.appels.filter((a) => typeof a === 'object').length, 1)
  b.gestes.shaDe = () => SHA
  assert.throws(() => b.preparer(), /utiliser --reprendre/)
})

test('reprise refuse un snapshot disparu ou attaché à une branche', (t) => {
  const b = banc(t)
  b.preparer()
  b.gestes.brancheDe = () => 'chantier/2626'
  assert.throws(() => b.preparer({ reprendre: true }), /snapshot de reprise déplacé/)
})

test('reprise refuse journal étranger, snapshot étranger et génération traversante', (t) => {
  const b = banc(t)
  const p = b.preparer()
  const journal = JSON.parse(readFileSync(b.chemins.json))
  mkdirSync(join(b.source, 'snapshot-etranger'))
  writeFileSync(join(b.source, 'snapshot-etranger', '.git'), 'gitdir: fixture')
  for (const alteration of [
    { journal: join(b.source, 'journal-etranger.json') },
    { snapshot: join(b.source, 'snapshot-etranger') },
    { generation: '../traversee' },
  ]) {
    writeFileSync(b.chemins.json, JSON.stringify({ ...journal, publication: { ...p, ...alteration } }))
    assert.throws(() => b.preparer({ reprendre: true }), /snapshot de reprise absent ou incohérent|génération invalide/)
  }
})

test('deux trains de même branche sont sérialisés avant snapshot et installation', async (t) => {
  const b = banc(t)
  const p = b.preparer()
  mkdirSync(join(p.snapshot, 'node_modules'))
  p.dependancesInstallees = true
  let entrer
  let sortir
  const entre = new Promise((r) => { entrer = r })
  const attente = new Promise((r) => { sortir = r })
  const options = {
    source: b.source, branche: 'chantier/2626', chemins: b.chemins, reprendre: true, args: [],
    preparer: () => p, ecrire: () => {},
    lancer: async () => { entrer(); await attente; const j = JSON.parse(readFileSync(b.chemins.json)); j.verdict = { etat: 'rouge', etape: 'file' }; writeFileSync(b.chemins.json, JSON.stringify(j)); return { code: 1 } },
  }
  const premier = publierDepuisSnapshot(options)
  await entre
  let lance = false
  const second = await publierDepuisSnapshot({ ...options, preparer: () => { lance = true; return p } })
  assert.equal(second, 1)
  assert.equal(lance, false)
  sortir()
  assert.equal(await premier, 1)
  assert.ok(existsSync(p.snapshot))
})

test('cleanup refusé après fusion : snapshot et archive conservés, nouvelle tête publiable', async (t) => {
  const b = banc(t)
  const p = b.preparer()
  p.dependancesInstallees = true
  mkdirSync(join(p.snapshot, 'node_modules'))
  const code = await publierDepuisSnapshot({
    source: b.source, branche: p.branche, chemins: b.chemins, reprendre: true, args: [],
    preparer: () => p, fusionDansMain: () => true,
    retirer: () => ({ disponible: false, raison: 'cleanup refusé' }), ecrire: () => {},
    lancer: async () => {
      const j = JSON.parse(readFileSync(b.chemins.json))
      j.publication.publie = SHA
      j.verdict = { etat: 'vert' }
      j.etapes.file = { detail: { fusion: 'f'.repeat(40) } }
      writeFileSync(b.chemins.json, JSON.stringify(j))
      return { code: 0 }
    },
  })
  assert.equal(code, 0)
  assert.ok(existsSync(p.snapshot))
  const suivant = b.preparer({ uuid: () => 'suivant' })
  assert.equal(suivant.demande, 'c'.repeat(40))
  assert.notEqual(suivant.snapshot, p.snapshot)
  assert.ok(existsSync(p.snapshot))
  assert.equal(JSON.parse(readFileSync(suivant.precedente)).publication.snapshot, p.snapshot)
})

test('nouvelle tête après CI rouge : ancien snapshot archivé ; --reprendre garde sa cible', (t) => {
  const b = banc(t)
  const p = b.preparer()
  const j = JSON.parse(readFileSync(b.chemins.json))
  j.verdict = { etat: 'rouge', etape: 'file' }
  writeFileSync(b.chemins.json, JSON.stringify(j))
  assert.equal(b.preparer({ reprendre: true }).demande, SHA)
  const suivant = b.preparer({ uuid: () => 'correctif' })
  assert.equal(suivant.demande, 'c'.repeat(40))
  assert.ok(existsSync(p.snapshot))
  assert.equal(JSON.parse(readFileSync(suivant.precedente)).verdict.etat, 'rouge')
})

test('ancien propre bail soldé dans main accepté ; autre bail divergent refusé', (t) => {
  const b = banc(t)
  const p = b.preparer()
  const j = JSON.parse(readFileSync(b.chemins.json))
  j.verdict = { etat: 'vert' }; j.etapes.file = { detail: { fusion: 'f'.repeat(40) } }
  j.publication.publie = DISTANT
  writeFileSync(b.chemins.json, JSON.stringify(j))
  b.gestes.estAncetre = (_d, _a, vers) => ({ disponible: true, valeur: vers === 'origin/main' })
  const suivant = b.preparer({ uuid: () => 'apres-solde' })
  assert.equal(suivant.bail, DISTANT)
  assert.ok(existsSync(p.snapshot))
})

test('git réel : CI rouge avec docs C, correctif D fusionné dans snapshot sous bail C ; source intacte', (t) => {
  const b = banc(t)
  const git = gitDe(b.source, { net: true })
  git('init', '-b', 'chantier/2626')
  for (const [cle, valeur] of [['user.name', 'Fixture'], ['user.email', 'fixture@example.invalid'], ['commit.gpgsign', 'false'], ['core.hooksPath', 'hooks-absents']]) git('config', cle, valeur)
  for (const nom of ['code', 'docs', 'memoire']) writeFileSync(join(b.source, nom), 'base')
  git('add', '--', 'code', 'docs', 'memoire')
  git('commit', '-m', 'fixture refs #2626')
  const base = git('rev-parse', 'HEAD')
  const gestes = { depotDe: (cwd) => depotDe(cwd, { env: envDeDepotForge() }), shasDistants: () => new Map(), fetchOrigin: () => vert }
  const preparer = (plus = {}) => preparerPublication({ source: b.source, branche: 'chantier/2626', chemins: b.chemins, gestes, ...plus })
  const ancien = preparer()
  const gitAncien = gitDe(ancien.snapshot, { net: true })
  writeFileSync(join(ancien.snapshot, 'docs'), 'docs C')
  gitAncien('add', '--', 'docs')
  gitAncien('commit', '-m', 'chore(docs): refs #2626')
  const c = gitAncien('rev-parse', 'HEAD')
  const journalAncien = JSON.parse(readFileSync(b.chemins.json))
  journalAncien.publication.publie = c; journalAncien.publication.bail = c
  journalAncien.verdict = { etat: 'rouge', etape: 'file' }
  writeFileSync(b.chemins.json, JSON.stringify(journalAncien))
  writeFileSync(join(b.source, 'code'), 'correctif D')
  git('add', '--', 'code')
  git('commit', '-m', 'fix(ops): refs #2626')
  const d = git('rev-parse', 'HEAD')
  writeFileSync(join(b.source, 'memoire'), 'index codeur')
  git('add', '--', 'memoire')
  writeFileSync(join(b.source, 'memoire'), 'WIP codeur')
  writeFileSync(join(b.source, 'non-suivi'), 'untracked codeur')
  const index = readFileSync(join(b.source, '.git/index'))
  gestes.shasDistants = () => new Map([['refs/heads/chantier/2626', c]])
  const p = preparer()
  assert.equal(p.rattraper, c)
  assert.equal(p.bail, c)
  const ctx = contexteDe({ racine: p.snapshot, branche: p.branche, publication: p, options: {}, journaliser: () => {}, fdLog: 'ignore' })
  ctx.racine = RACINE
  Object.defineProperty(ctx, 'filtresDePush', { value: ['chantier/**'] })
  ctx.questions = {
    ...ctx.questions, origineDe: () => 'https://github.com/MyEdO/game.git', verdictDesFusions: () => ({ ok: true }),
    combienDe: () => 1, baseAuTronc: () => base,
    commitsDeLaPlage: () => [{ sha: d, message: 'fix(ops): refs #2626' }],
  }
  ctx.attendreReconstruction = () => ({ etat: 'soldee' })
  ctx.tronc = () => ({ disponible: true, sha: base })
  const journal = JSON.parse(readFileSync(b.chemins.json))
  const preflight = ETAPES.find((e) => e.nom === 'preflight').jouer(ctx, journal)
  assert.equal(preflight.ok, true, preflight.raison)
  const gitSnapshot = gitDe(p.snapshot, { net: true })
  assert.equal(gitSnapshot('merge-base', '--is-ancestor', c, 'HEAD'), '')
  assert.equal(gitSnapshot('merge-base', '--is-ancestor', d, 'HEAD'), '')
  assert.equal(readFileSync(join(p.snapshot, 'docs'), 'utf8'), 'docs C')
  assert.equal(readFileSync(join(p.snapshot, 'code'), 'utf8'), 'correctif D')
  let pousse
  ctx.pousser = (args) => { pousse = args; return vert }
  assert.equal(ETAPES.find((e) => e.nom === 'push-branche').jouer(ctx, journal).ok, true)
  assert.equal(pousse.bail, c)
  assert.equal(git('rev-parse', 'HEAD'), d)
  assert.deepEqual(readFileSync(join(b.source, '.git/index')), index)
  assert.equal(readFileSync(join(b.source, 'memoire'), 'utf8'), 'WIP codeur')
  assert.equal(readFileSync(join(b.source, 'non-suivi'), 'utf8'), 'untracked codeur')
})

test('npm ci partiel : reprise réinstalle jusqu’au code zéro avant le train', async (t) => {
  const b = banc(t)
  const p = b.preparer()
  let installations = 0
  const options = {
    source: b.source, branche: p.branche, chemins: b.chemins, reprendre: true, args: [],
    preparer: () => p, ecrire: () => {},
    lancementNpm: () => ({ executable: 'npm', args: ['ci'] }),
    lancer: async (exe) => {
      if (exe === 'npm') {
        installations++
        mkdirSync(join(p.snapshot, 'node_modules'), { recursive: true })
        return { code: installations === 1 ? 1 : 0 }
      }
      const j = JSON.parse(readFileSync(b.chemins.json))
      j.verdict = { etat: 'rouge', etape: 'file' }
      writeFileSync(b.chemins.json, JSON.stringify(j))
      return { code: 1 }
    },
  }
  assert.equal(await publierDepuisSnapshot(options), 4)
  assert.equal(p.dependancesInstallees, undefined)
  assert.ok(existsSync(join(p.snapshot, 'node_modules')))
  assert.equal(await publierDepuisSnapshot(options), 1)
  assert.equal(installations, 2)
  assert.equal(JSON.parse(readFileSync(b.chemins.json)).publication.dependancesInstallees, true)
})

test('le train pousse sous bail capturé et ne le renouvelle que sur son propre push réussi', () => {
  const etape = ETAPES.find((e) => e.nom === 'push-branche')
  const appels = []
  let resultat = vert
  const ctx = { branche: 'chantier/2626', pousser: (args) => { appels.push(args); return resultat } }
  const journal = { tete: SHA, publication: { bail: DISTANT, publie: null } }
  assert.equal(etape.jouer(ctx, journal).ok, true)
  assert.deepEqual(appels[0], { vers: 'refs/heads/chantier/2626', bail: DISTANT })
  assert.equal(journal.publication.bail, SHA)
  assert.equal(journal.publication.publie, SHA)
  resultat = { disponible: true, valeur: { status: 1, stderr: 'stale info', stdout: '' } }
  journal.tete = 'c'.repeat(40)
  assert.equal(etape.jouer(ctx, journal).ok, false)
  assert.equal(appels[1].bail, SHA)
  assert.equal(journal.publication.publie, SHA)
  assert.equal(journal.publication.bail, SHA)
})

test('preflight accepte HEAD détaché uniquement avec identité de publication validée', () => {
  const etape = ETAPES.find((e) => e.nom === 'preflight')
  const ctx = {
    racine: '/nulle-part', branche: 'chantier/2626', filtresDePush: ['chantier/**'],
    attendreReconstruction: () => ({ etat: 'soldee' }), journaliser: () => {}, generators: [],
    questions: { rebaseEntame: () => null, brancheDe: () => null, cheminsSales: () => [], origineDe: () => 'étranger' },
  }
  assert.match(etape.jouer(ctx, {}).raison, /HEAD DÉTACHÉ/)
  assert.match(etape.jouer({ ...ctx, publication: { demande: SHA } }, {}).raison, /origin étranger/)
})

test('installation et train sont exécutés dans le snapshot, journal original conservé au rouge', async (t) => {
  const b = banc(t)
  const p = b.preparer()
  const appels = []
  const code = await publierDepuisSnapshot({
    source: b.source, branche: p.branche, chemins: b.chemins, reprendre: true, args: ['--file-timeout-min', '5'],
    preparer: () => p, ecrire: () => {}, lancementNpm: () => ({ executable: 'npm', args: ['ci'], shell: false }),
    lancer: async (exe, args, options) => { appels.push({ exe, args, options }); if (appels.length > 1) { const j = JSON.parse(readFileSync(b.chemins.json)); j.verdict = { etat: 'rouge', etape: 'file' }; writeFileSync(b.chemins.json, JSON.stringify(j)) } return { code: appels.length === 1 ? 0 : 1 } },
  })
  assert.equal(code, 1)
  assert.deepEqual(appels[0].args, ['ci'])
  assert.ok(appels.every((a) => a.options.cwd === p.snapshot))
  assert.equal(appels[1].args[0], join(p.snapshot, 'scripts/ops/publier.mjs'))
  assert.deepEqual(JSON.parse(appels[1].options.env[ENV_PUBLICATION]), p)
  assert.ok(existsSync(p.snapshot))
})
