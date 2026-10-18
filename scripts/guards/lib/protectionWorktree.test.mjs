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
import { prefixeDeRefus } from './categorieDeRefus.mjs'

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

test('canonisation refusée sans preuve de lien : diagnostic nommé quel que soit le propriétaire', (t) => {
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
      assert.match(resultat.horsMesure.join(' '), /PID 777 témoin.*canonisation physique illisible.*alias.*EACCES/)
      assert.deepEqual(resultat.indeterminees, [])
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

test('protection : processus illisible sans preuve exclu ; mesure lisible étrangère sous arbre refuse', (t) => {
  const b = terrain(t)
  const utilisateur = 'courant'
  const vue = (p) => mesurerProtectionWorktree(b.arbre, { snapshot: porteeProcessus({ utilisateur, processus: [p] }) })
  const illisible = vue({ pid: 10, nom: 'illisible', proprietaire: utilisateur, creation: 'a', commande: 'node', cwd: null })
  assert.equal(illisible.ok, true)
  assert.match(illisible.horsMesure.join(' '), /PID 10 illisible.*cwd illisible/)
  const horsPortee = vue({ pid: 11, nom: 'système', proprietaire: null, creation: null, commande: null, cwd: null })
  assert.equal(horsPortee.ok, true)
  assert.match(horsPortee.portee, /hors portée : 1.*système/)
  assert.match(vue({ pid: 12, nom: 'autre compte', proprietaire: 'autre', creation: 'b', commande: 'node', cwd: b.arbre }).refus.join(' '), /PID 12.*cwd/)
})

test('protection : un processus se nomme sur UNE ligne bornée, l’indétermination machine se cite à part', (t) => {
  const b = terrain(t)
  const utilisateur = 'courant'
  for (let i = 0; i < 7; i++) writeFileSync(join(b.arbre, `sale-${i}.txt`), 'non commité')
  const prompt = 'powershell.exe -NoProfile -EncodedCommand ' + 'JAB'.repeat(2000) + '\nReprise du lot\n\n' + 'consigne '.repeat(400)
  const vu = mesurerProtectionWorktree(b.arbre, { snapshot: porteeProcessus({ utilisateur, processus: [
    { pid: 13, nom: 'powershell.exe', proprietaire: utilisateur, creation: 'a', commande: prompt, cwd: b.arbre },
    { pid: 14, nom: 'cachotier.exe', proprietaire: utilisateur, creation: 'b', commande: 'cachotier', cwd: null },
  ] }) })
  assert.equal(vu.ok, false)
  assert.match(vu.refus[0], /^\[métier · non retentable\] processus liés \(1\) : PID 13 powershell\.exe — powershell\.exe -NoProfile -EncodedCommand… — cwd, argument /)
  assert.ok(vu.refus.includes('modifications non commitées (7) : sale-0.txt, sale-1.txt, sale-2.txt, sale-3.txt, sale-4.txt, +2 autres'), vu.refus.join('\n'))
  assert.deepEqual(vu.indeterminees, [])
  assert.match(vu.horsMesure.join(' '), /PID 14 cachotier.exe : cwd illisible/)
  for (const ligne of [...vu.refus, ...vu.indeterminees, ...vu.horsMesure]) assert.ok(!ligne.includes('\n') && ligne.length < 200 + prefixeDeRefus('métier').length + 1, ligne)
  const refuse = retirerWorktree(b.depot, b.arbre, { mesurer: () => vu })
  assert.match(refuse.raison, /PID 13 powershell\.exe/)
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

test('protection : un dossier de sessions qui est un FICHIER refuse en le nommant', (t) => {
  const b = terrain(t)
  const sessions = join(b.racine, 'sessions-fichier')
  writeFileSync(sessions, 'pas un dossier')
  const vu = mesurerProtectionWorktree(b.arbre, { snapshot, sessions })
  assert.equal(vu.ok, false)
  assert.ok(vu.refus.includes('[panne · non retentable] mesure indéterminée : dossier sessions non répertoire : ' + sessions), vu.refus.join('\n'))
})

test('#2741 système illisible sans preuve : retrait réel accepté et diagnostic nommé', (t) => {
  const b = terrain(t)
  const protection = () => mesurerProtectionWorktree(b.arbre, { snapshot: porteeProcessus({ utilisateur: 'moi', processus: [
    { pid: 20, nom: 'DefenderSessionHelper.exe', image: join(b.racine, 'systeme.exe'), creation: '2026-10-18T00:00:00Z', commande: 'systeme.exe', cwd: null, erreurs: ['cwd illisible : accès refusé'] },
  ] }) })
  const vu = protection()
  assert.equal(vu.ok, true)
  assert.match(vu.horsMesure.join(' '), /\[permission · non retentable\].*DefenderSessionHelper.exe.*image=.*systeme.exe.*cwd illisible/)
  assert.ok(reussi(retirerWorktree(b.depot, b.arbre, { mesurer: protection })))
  assert.equal(existsSync(b.arbre), false)
})

test('#2741 commande du snapshot sans cwd : retrait refusé', (t) => {
  const b = terrain(t)
  const vu = mesurerProtectionWorktree(b.arbre, { snapshot: { processus: [{ pid: 21, nom: 'node', commande: 'node "' + join(b.arbre, 'run.mjs') + '"', cwd: null }] } })
  assert.equal(vu.ok, false)
  assert.match(vu.refus.join(' '), /\[métier · non retentable\].*PID 21.*argument/)
  assert.match(vu.indeterminees.join(' '), /\[permission · non retentable\].*cwd illisible/)
})

test('#2741 image absolue et ancêtres chronologiques prouvent le lien, basename et PID recyclé exclus', (t) => {
  const b = terrain(t)
  const parent = { pid: 30, ppid: 0, cwd: b.arbre, commande: 'node', creation: '2026-10-18T00:00:00Z' }
  const enfant = { pid: 31, ppid: 30, nom: 'node', cwd: null, commande: 'node', creation: '2026-10-18T00:00:01Z' }
  const protection = (p, parents = []) => mesurerProtectionWorktree(b.arbre, { snapshot: { processus: [p, ...parents] } })
  assert.match(protection({ ...enfant, image: join(b.arbre, 'node.exe') }).refus.join(' '), /image .*node.exe/)
  assert.equal(protection({ ...enfant, image: 'node.exe' }).ok, true)
  assert.match(protection(enfant, [parent]).refus.join(' '), /ancêtre PID 30 cwd/)
  const recycle = { ...parent, creation: '2026-10-18T00:00:02Z' }
  assert.doesNotMatch(protection(enfant, [recycle]).refus.join(' '), /ancêtre PID 30/)
})

test('#2741 échéance dépassée et erreur globale restent des mesures impossibles', (t) => {
  const b = terrain(t)
  const vue = { utilisateur: 'moi', processus: [], erreurs: ['échéance de 5000 ms atteinte'], indeterminee: 'échéance', code: 'MESURE_PROCESSUS_EXPIREE' }
  const expiree = mesurerProtectionWorktree(b.arbre, { snapshot: porteeProcessus(vue) })
  assert.equal(expiree.ok, false)
  assert.match(expiree.refus.join(' '), /\[transitoire · retentable\].*5000 ms/)
  const impossible = mesurerProtectionWorktree(b.arbre, { snapshot: porteeProcessus({ processus: [], erreurs: ['collecteur absent'] }) })
  assert.equal(impossible.ok, false)
  assert.match(impossible.refus.join(' '), /\[panne · non retentable\].*collecteur absent/)
})

test('#2741 erreur de canonisation ancêtre : preuves conservées et ascendance poursuivie', (t) => {
  const b = terrain(t)
  const alias = join(b.racine, 'alias')
  symlinkSync(b.arbre, alias, 'junction')
  const original = fs.realpathSync.native
  fs.realpathSync.native = (chemin) => {
    if (resolve(chemin) === resolve(alias)) throw Object.assign(new Error('banc ancêtre'), { code: 'EACCES' })
    return original(chemin)
  }
  try {
    for (const cwds of [[b.arbre, alias], [alias, b.arbre]]) {
      const vue = mesurerProtectionWorktree(b.arbre, { snapshot: { processus: [
        { pid: 40, ppid: 41, creation: '2026-10-18T00:00:02Z', commande: 'node', cwd: null },
        { pid: 41, ppid: 42, creation: '2026-10-18T00:00:01Z', commande: 'node', cwd: cwds[0] },
        { pid: 42, ppid: 0, creation: '2026-10-18T00:00:00Z', commande: 'node', cwd: cwds[1] },
      ] } })
      assert.equal(vue.ok, false)
      assert.match(vue.refus.join(' '), new RegExp('PID 40.*ancêtre PID ' + (cwds[0] === b.arbre ? '41' : '42') + ' cwd'))
      assert.match(vue.indeterminees.join(' '), /PID 40.*cwd illisible.*ancêtre PID/)
    }
  } finally { fs.realpathSync.native = original }
})

test('#2741 cache documentaire reconstructible ; inconnus et liens protégés', (t) => {
  const b = terrain(t)
  mkdirSync(join(b.arbre, 'docs/.cache/lectures'), { recursive: true })
  writeFileSync(join(b.arbre, 'docs/.cache/docs-fraicheur.json'), '{}')
  assert.equal(mesurer(b.arbre).ok, true)
  writeFileSync(join(b.arbre, 'docs/manuscrit.txt'), 'authoré')
  assert.match(mesurer(b.arbre).refus.join(' '), /docs\/manuscrit.txt/)
  rmSync(join(b.arbre, 'docs/.cache'), { recursive: true })
  symlinkSync(b.racine, join(b.arbre, 'docs/.cache'), 'junction')
  assert.ok(ignoresAuthores(b.arbre, ['docs']).includes('docs/.cache'))
})
