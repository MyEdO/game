import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync, renameSync, symlinkSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { spawn } from 'node:child_process'
import { ajouterWorktree, depotDe, retirerWorktree, reussi, worktreesDe, etatDeLArbre } from './gitPorte.mjs'
import { instanceDeDepot } from './depotGabarit.mjs'
import { ignoresAuthores, mesurerProtectionWorktree, retirerResiduelVide } from './protectionWorktree.mjs'
import { mesurerProcessusWorktrees, porteeProcessus } from './processusWorktrees.mjs'

const snapshot = { portee: 'banc', processus: [] }
function terrain(t) {
  const { racine } = instanceDeDepot({ fichiers: { '.gitignore': 'node_modules/\n.superpowers/\ndocs/\n__pycache__/\n' }, message: 'banc' })
  t.after(() => rmSync(racine, { recursive: true, force: true }))
  const depot = depotDe(racine)
  const arbre = join(racine, 'arbre')
  assert.ok(reussi(ajouterWorktree(depot, { chemin: arbre, branche: 'cote', depuis: 'main' })))
  return { racine, depot, arbre }
}
const mesurer = (chemin) => mesurerProtectionWorktree(chemin, { snapshot })

test('canonisation refusée : propriétaire courant nommé, étranger exclu, authoré encore mesuré', (t) => {
  const b = terrain(t)
  const alias = join(b.racine, 'alias')
  symlinkSync(b.arbre, alias, 'junction')
  mkdirSync(join(b.arbre, '.superpowers'))
  writeFileSync(join(b.arbre, '.superpowers/a.md'), 'authoré')
  const original = fs.realpathSync.native
  fs.realpathSync.native = (chemin) => {
    if (resolve(chemin) === resolve(alias)) throw Object.assign(new Error('banc'), { code: 'EACCES' })
    return original(chemin)
  }
  try {
    for (const proprietaire of ['courant', 'étranger', null]) {
      const vue = { utilisateur: 'courant', processus: [{ pid: 777, nom: 'témoin', proprietaire, cwd: alias, commande: 'node' }] }
      const resultat = mesurerProtectionWorktree(b.arbre, { snapshot: vue })
      assert.match(resultat.refus.join(' '), /ignoré authoré.*\.superpowers\/a.md/)
      if (proprietaire === 'courant') assert.match(resultat.refus.join(' '), /PID 777 témoin.*canonisation physique illisible.*alias.*EACCES/)
      else assert.doesNotMatch(resultat.refus.join(' '), /PID 777/)
    }
  } finally { fs.realpathSync.native = original }
})

test('status Git réellement refusé : protection indéterminée, fichier authoré conservé', (t) => {
  const b = terrain(t)
  mkdirSync(join(b.arbre, '.superpowers'))
  writeFileSync(join(b.arbre, '.superpowers/a.md'), 'authoré')
  const chemin = join(b.arbre, '.git')
  const original = join(b.arbre, '.git-mesure')
  renameSync(chemin, original)
  try {
    writeFileSync(chemin, 'gitdir: absent')
    assert.match(mesurer(b.arbre).refus.join(' '), /mesure indéterminée : git refusé/)
    assert.ok(existsSync(join(b.arbre, '.superpowers/a.md')))
  } finally { rmSync(chemin, { force: true }); renameSync(original, chemin) }
})

test('publication et cache liés : refus du lien sans descendre sa cible', (t) => {
  const b = terrain(t)
  const cible = mkdtempSync(join(tmpdir(), 'publication-lien-'))
  t.after(() => rmSync(cible, { recursive: true, force: true }))
  mkdirSync(join(b.arbre, 'node_modules/.cache'), { recursive: true })
  symlinkSync(cible, join(b.arbre, 'node_modules/.cache/publication'), 'junction')
  assert.deepEqual(ignoresAuthores(b.arbre, ['node_modules']), ['node_modules/.cache/publication'])
  assert.equal(mesurer(b.arbre).ok, false)
})

test('cache Python ignoré réel : reconstruction à profondeur arbitraire, inconnu authoré', (t) => {
  const b = terrain(t)
  mkdirSync(join(b.arbre, 'scripts/raw/lib/__pycache__'), { recursive: true })
  writeFileSync(join(b.arbre, 'scripts/raw/lib/__pycache__/module.pyc'), 'bytecode')
  assert.ok(etatDeLArbre(depotDe(b.arbre), { ignores: true }).some((e) => e.chemins.some((c) => c.includes('__pycache__'))))
  assert.deepEqual(ignoresAuthores(b.arbre, ['scripts/raw/lib/__pycache__']), [])
  assert.equal(mesurer(b.arbre).ok, true)
  mkdirSync(join(b.arbre, 'node_modules/.cache/publication/__pycache__'), { recursive: true })
  writeFileSync(join(b.arbre, 'node_modules/.cache/publication/__pycache__/run.pyc'), 'authoré')
  assert.match(mesurer(b.arbre).refus.join(' '), /publication\/__pycache__\/run.pyc/)
})

test('ignoré : canon généré, node_modules reconstructible, unknown et publication protégés', (t) => {
  const b = terrain(t)
  mkdirSync(join(b.arbre, 'node_modules'), { recursive: true })
  writeFileSync(join(b.arbre, 'node_modules/x'), 'installable')
  assert.equal(mesurer(b.arbre).ok, true)
  mkdirSync(join(b.arbre, '.superpowers'))
  writeFileSync(join(b.arbre, '.superpowers/x.md'), 'authoré')
  assert.match(mesurer(b.arbre).refus.join(' '), /\.superpowers\/x.md/)
  assert.equal(reussi(retirerWorktree(b.depot, b.arbre, { mesurer })), false)
  assert.ok(existsSync(join(b.arbre, '.superpowers/x.md')))
  rmSync(join(b.arbre, '.superpowers'), { recursive: true })
  mkdirSync(join(b.arbre, 'node_modules/.cache/publication'), { recursive: true })
  writeFileSync(join(b.arbre, 'node_modules/.cache/publication/run.json'), '{"verdict":{"etat":"vert"}}')
  assert.match(mesurer(b.arbre).refus.join(' '), /publication\/run.json/)
  assert.equal(reussi(retirerWorktree(b.depot, b.arbre, { mesurer })), false)
  writeFileSync(join(b.arbre, 'node_modules/.cache/publication/run.json'), '{')
  assert.equal(reussi(retirerWorktree(b.depot, b.arbre, { mesurer })), false)
  assert.deepEqual(ignoresAuthores(b.arbre, ['docs/primitives.md']), [])
  assert.deepEqual(etatDeLArbre(depotDe(b.arbre)), [])
  assert.ok(etatDeLArbre(depotDe(b.arbre), { ignores: true }).some((e) => e.etat === '!!'))
})

test('porte commune réelle : vivant refuse zéro perte puis retrait node_modules complet', async (t) => {
  const b = terrain(t)
  mkdirSync(join(b.arbre, 'node_modules'))
  writeFileSync(join(b.arbre, 'node_modules/x'), 'installable')
  const enfant = spawn(process.execPath, ['-e', 'setInterval(()=>{},1000)'], { cwd: b.arbre, stdio: 'ignore' })
  await new Promise((r) => setTimeout(r, 200))
  const protection = () => mesurerProtectionWorktree(b.arbre, { processus: () => mesurerProcessusWorktrees({ pids: [enfant.pid] }) })
  try {
  const refuse = retirerWorktree(b.depot, b.arbre, { mesurer: protection })
  assert.equal(reussi(refuse), false)
  assert.match(refuse.raison, new RegExp('PID ' + enfant.pid + '.*cwd'))
  assert.ok(existsSync(b.arbre))
  assert.ok(worktreesDe(b.depot).some((w) => resolve(w.chemin) === b.arbre))
  console.log('TEMOIN porte réelle refus ' + refuse.raison)
  } finally {
    const sortie = new Promise((r) => enfant.once('exit', r))
    enfant.kill()
    await sortie
  }
  const retire = retirerWorktree(b.depot, b.arbre, { mesurer: protection })
  assert.ok(reussi(retire), retire.raison)
  assert.equal(existsSync(b.arbre), false)
  assert.equal(worktreesDe(b.depot).some((w) => resolve(w.chemin) === b.arbre), false)
  console.log('TEMOIN vivant refusé puis retrait : dossier absent et enregistrement absent')
})

test('sessions : non terminale, identité vivante, PID recyclé, corruption sans writer', (t) => {
  const b = terrain(t)
  const dossier = join(b.racine, '.git/sessions')
  mkdirSync(dossier)
  const fichier = join(dossier, 'carte.json')
  writeFileSync(fichier, JSON.stringify({ worktree: b.arbre, etat: 'vivante' }))
  assert.match(mesurer(b.arbre).refus.join(' '), /session.*vivante/)
  writeFileSync(fichier, JSON.stringify({ worktree: b.arbre, etat: 'fermee', controleur: {pid: 100, creation: 'mort'}, jobHost: {pid:101, creation: 'mort'}, agentProcessus: { pid: 99, creation: 'a' } }))
  const vue = (creation) => mesurerProtectionWorktree(b.arbre, { snapshot: { processus: [{ pid: 99, creation, cwd: b.racine, commande: 'agent' }] } })
  assert.match(vue('a').refus.join(' '), /PID 99/)
  assert.equal(vue('b').ok, true)
  const indetermine = mesurerProtectionWorktree(b.arbre, { snapshot: { processus: [{ pid: 99, creation: null }] } })
  assert.match(indetermine.refus.join(' '), /identité session indéterminée/)
  writeFileSync(fichier, '{')
  const refuse = retirerWorktree(b.depot, b.arbre, { mesurer })
  assert.match(refuse.raison, /indéterminée/)
  assert.ok(existsSync(b.arbre))
})

test('protection : utilisateur illisible refuse ; système illisible exclu ; mesure lisible étrangère sous arbre refuse', (t) => {
  const b = terrain(t)
  const utilisateur = 'courant'
  const vue = (p) => mesurerProtectionWorktree(b.arbre, { snapshot: porteeProcessus({ utilisateur, processus: [p] }) })
  assert.match(vue({ pid: 10, nom: 'illisible', proprietaire: utilisateur, creation: 'a', commande: 'node', cwd: null }).refus.join(' '), /PID 10 illisible.*cwd illisible/)
  const horsPortee = vue({ pid: 11, nom: 'système', proprietaire: null, creation: null, commande: null, cwd: null })
  assert.equal(horsPortee.ok, true)
  assert.match(horsPortee.portee, /hors portée : 1.*système/)
  assert.match(vue({ pid: 12, nom: 'autre compte', proprietaire: 'autre', creation: 'b', commande: 'node', cwd: b.arbre }).refus.join(' '), /PID 12.*cwd/)
})

test('résidu : vide seul, non vide conservé', (t) => {
  const b = terrain(t)
  const vide = join(b.racine, 'vide')
  mkdirSync(vide)
  retirerResiduelVide(vide)
  assert.equal(existsSync(vide), false)
  assert.throws(() => retirerResiduelVide(b.arbre), /ENOTEMPTY|EEXIST|EPERM/)
  assert.ok(existsSync(b.arbre))
})
