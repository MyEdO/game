import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync, renameSync, symlinkSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { spawn } from 'node:child_process'
import { ajouterWorktree, commitDe, depotDe, retirerWorktree, reussi, worktreesDe, etatDeLArbre } from './gitPorte.mjs'
import { instanceDeDepot } from './depotGabarit.mjs'
import { ignoresAuthores, mesurerProtectionWorktree, relierFichierGit, retirerResiduelVide } from './protectionWorktree.mjs'
import { DELAI_MESURE_PROCESSUS_MS, mesurerProcessusWorktrees, porteeProcessus } from './processusWorktrees.mjs'
import { prefixeDeRefus } from './categorieDeRefus.mjs'
import { listerDossier } from './lister.mjs'
import { lancerGit } from '../../test/gitDeBanc.mjs'

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

test('#2795 protection borne le collecteur réel et conserve son expiration', (t) => {
  const b = terrain(t)
  let options
  const vu = mesurerProtectionWorktree(b.arbre, { processus: (o) => {
    options = o
    return { processus: [], code: 'MESURE_PROCESSUS_EXPIREE', erreurs: ['échéance atteinte'] }
  } })
  assert.deepEqual(options, { timeout: DELAI_MESURE_PROCESSUS_MS })
  assert.equal(vu.ok, false)
  assert.deepEqual(vu.refus, ['[transitoire · retentable] échéance atteinte'])
})

test('#2795 catégories : tirées du code de la cause, jamais de son texte, une fois au retrait', (t) => {
  const b = terrain(t)
  for (const [cause, categorie] of [
    ['cwd illisible : [win32 5] Accès refusé', 'permission'],
    ['propriétaire illisible : [EACCES] permission denied', 'permission'],
    ['commande illisible : [win32 299] Seule une partie d’une requête ReadProcessMemory a été effectuée', 'transitoire'],
    ['cwd illisible : [instable] Parametres modifies pendant inspection', 'transitoire'],
    ['identité illisible : [instable] identité modifiée pendant inspection', 'transitoire'],
    ['proprietaire illisible : [win32 87] Paramètre incorrect', 'panne'],
    ['cwd illisible : accès refusé (EACCES, EPERM)', 'panne'],
    ['ancêtre illisible : // Windows may deny ancestor metadata (EPERM, EACCES) — UNKNOWN', 'panne'],
    ['creation illisible', 'panne'],
    [{ message: 'panne nommée', code: 'EACCES' }, 'permission'],
    [{ message: 'accès refusé', code: 'EACCES', categorie: 'transitoire' }, 'transitoire'],
    [{ message: 'accès refusé', code: 'EINVAL' }, 'validation'],
    [{ message: 'ReadProcessMemory partiel', code: 'EIO' }, 'panne'],
    [Object.assign(new Error('ancêtre illisible : x — EPERM'), { cause: { code: 'EPERM' } }), 'permission'],
    [Object.assign(new Error('ancêtre illisible : x — EPERM, EACCES'), { cause: { code: 'UNKNOWN' } }), 'panne'],
  ]) {
    const vu = mesurerProtectionWorktree(b.arbre, { snapshot: { processus: [{ pid: 701, nom: 'étranger', cwd: b.racine, commande: 'node', creation: 'a', erreurs: [cause] }] } })
    assert.equal(vu.ok, false)
    assert.equal(vu.horsMesure.length, 0)
    assert.match(vu.indeterminees[0], new RegExp('^' + prefixeDeRefus(categorie).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
    const refuse = retirerWorktree(b.depot, b.arbre, { mesurer: () => vu })
    assert.equal(refuse.raison, vu.refus.join(' ; '))
  }
  const vu = mesurerProtectionWorktree(b.arbre, { snapshot: { processus: [], erreurs: ['collecteur absent'] } })
  assert.equal(retirerWorktree(b.depot, b.arbre, { mesurer: () => vu }).raison, '[panne · non retentable] collecteur absent')
  const metier = mesurerProtectionWorktree(b.arbre, { snapshot: { processus: [{ pid: 702, cwd: b.arbre, commande: 'node', creation: 'a' }] } })
  assert.match(metier.refus[0], /^\[métier · non retentable\]/)
})

test('#2795 cwd illisible : panne indépendante et entrée invalide refusent sans preuve de lien', (t) => {
  const b = terrain(t)
  for (const p of [
    { cwd: null, erreurs: ['collecteur cassé'] },
    { cwd: null, erreurs: ['canonisation physique illisible : EACCES'] },
    { cwd: null, erreurs: [{ message: 'cwd illisible : collecteur absent', categorie: 'panne', code: 'ECOLLECTEUR' }] },
    { cwd: null, erreurs: [{ message: 'cwd illisible : accès refusé', code: 'EINVAL' }] },
    { cwd: null, erreurs: [{ message: 'cwd illisible', categorie: 'métier' }] },
    { cwd: null, erreurs: ['cwd illisible : canonisation physique illisible : EACCES'] },
    { erreurs: ['entrée invalide'] },
  ]) {
    const vu = mesurerProtectionWorktree(b.arbre, { snapshot: { processus: [{ pid: 703, commande: 'node', creation: 'a', ...p }] } })
    assert.equal(vu.ok, false)
    assert.deepEqual(vu.horsMesure, [])
  }
})

test('#2795 exclusion bornée : cwd absent et toutes les causes de lecture en permission, rien d’autre', (t) => {
  const b = terrain(t)
  const refuse = (champ) => champ + ' illisible : [win32 5] Accès refusé'
  const vue = (erreurs, p = {}) => mesurerProtectionWorktree(b.arbre, { snapshot: { processus: [{ pid: 704, nom: 'élevé', cwd: null, commande: null, creation: 'a', erreurs, ...p }] } })
  for (const erreurs of [[refuse('cwd'), refuse('commande')], [refuse('proprietaire'), refuse('image'), refuse('cwd'), refuse('commande')], ['cwd illisible : [EACCES] permission denied', 'commande illisible : [EPERM] operation not permitted']]) {
    const vu = vue(erreurs)
    assert.equal(vu.ok, true, erreurs.join('; '))
    assert.match(vu.horsMesure.join(' '), /^\[permission · non retentable\] PID 704 élevé : .*cwd illisible/)
  }
  for (const [erreurs, categorie] of [
    [[refuse('commande')], 'panne'],
    [[refuse('cwd'), refuse('commande'), 'proprietaire illisible : [win32 87] Paramètre incorrect'], 'panne'],
    [['cwd illisible : [instable] Parametres modifies pendant inspection', refuse('commande')], 'transitoire'],
    [['cwd illisible : [win32 299] lecture partielle', refuse('commande')], 'transitoire'],
    [['cwd illisible : accès refusé', refuse('commande')], 'panne'],
    [[refuse('cwd'), refuse('commande'), Object.assign(new Error('canonisation physique illisible'), { code: 'EACCES' })], 'permission'],
  ]) {
    const vu = vue(erreurs)
    assert.equal(vu.ok, false, erreurs.join('; '))
    assert.deepEqual(vu.horsMesure, [])
    assert.ok(vu.indeterminees.some((d) => d.startsWith(prefixeDeRefus(categorie))), vu.indeterminees.join('\n'))
  }
  assert.equal(vue([refuse('cwd'), refuse('commande')], { cwd: '' }).ok, false)
  assert.match(vue([refuse('cwd'), refuse('commande')], { image: join(b.arbre, 'eleve.exe') }).refus.join(' '), /^\[métier · non retentable\] processus liés \(1\) : PID 704 élevé — .* — image[ …]/)
})

test('canonisation refusée de cwd lisible : indéterminée quel que soit le propriétaire', (t) => {
  const b = terrain(t)
  const alias = join(b.racine, 'alias')
  symlinkSync(b.arbre, alias, 'junction')
  const original = fs.realpathSync.native
  fs.realpathSync.native = (chemin) => {
    if (resolve(chemin) === resolve(alias)) throw Object.assign(new Error('banc'), { code: 'EACCES' })
    return original(chemin)
  }
  try {
    for (const proprietaire of ['courant', 'étranger', null]) {
      const vue = { utilisateur: 'courant', processus: [{ pid: 777, nom: 'témoin', proprietaire, cwd: alias, commande: 'node' }] }
      const resultat = mesurerProtectionWorktree(b.arbre, { snapshot: vue })
      assert.equal(resultat.ok, false)
      assert.match(resultat.indeterminees.join(' | '), /(?:^| \| )\[permission · non retentable\] PID 777 témoin : canonisation physique illisible :[ …]/)
      assert.deepEqual(resultat.horsMesure, [])
    }
  } finally { fs.realpathSync.native = original }
})

test('#2795 arguments réels qui ne désignent aucun chemin du worktree : ni lien ni indétermination', async (t) => {
  const b = terrain(t)
  const ailleurs = mkdtempSync(join(tmpdir(), 'argument-texte-'))
  t.after(() => rmSync(ailleurs, { recursive: true, force: true }))
  const enfants = [
    ['--eval', '// Windows may deny ancestor metadata (EPERM, EACCES).\nconst parties = "a/b".split("/")\nsetInterval(() => {}, 1000)'],
    ['-e', 'setInterval(() => {}, 1000)', '//serveur-inexistant/partage/x'],
  ].map((args) => spawn(process.execPath, args, { cwd: ailleurs, stdio: 'ignore' }))
  try {
    await new Promise((r) => setTimeout(r, 300))
    const vu = mesurerProtectionWorktree(b.arbre, { processus: (o) => mesurerProcessusWorktrees({ ...o, pids: enfants.map((e) => e.pid) }) })
    assert.deepEqual(vu.refus, [])
    assert.deepEqual(vu.horsMesure, [])
  } finally {
    await Promise.all(enfants.map((e) => { const sortie = new Promise((r) => e.once('exit', r)); e.kill(); return sortie }))
  }
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

test('#2795 un dossier ignoré VIDE n’est pas authoré, son premier fichier l’est', (t) => {
  const b = terrain(t)
  mkdirSync(join(b.arbre, 'node_modules/.cache/publication'), { recursive: true })
  mkdirSync(join(b.arbre, '.superpowers'))
  assert.deepEqual(ignoresAuthores(b.arbre, ['node_modules', '.superpowers']), [])
  assert.equal(mesurer(b.arbre).ok, true)
  writeFileSync(join(b.arbre, '.superpowers/x.md'), 'authoré')
  assert.deepEqual(ignoresAuthores(b.arbre, ['node_modules', '.superpowers']), ['.superpowers/x.md'])
})

test('#2795 sans fichier .git, l’arbre se mesure par SON dossier d’administration, jamais par le dépôt PARENT', (t) => {
  const b = terrain(t)
  const commun = join(b.racine, '.git')
  const mesurerDemi = (chemin) => mesurerProtectionWorktree(chemin, { snapshot, commun })
  writeFileSync(join(b.racine, 'non-suivi-du-principal.txt'), 'au principal')
  writeFileSync(join(b.arbre, 'suivi-de-l-arbre.txt'), 'que l’index du principal ignore')
  writeFileSync(join(b.arbre, '.gitignore'), 'node_modules/\nnotes/\n*.log\ndist/*\n')
  mkdirSync(join(b.arbre, 'sous'))
  writeFileSync(join(b.arbre, 'sous', '.gitignore'), '!garde.log\n')
  mkdirSync(join(b.arbre, 'outils'))
  writeFileSync(join(b.arbre, 'outils', '.gitignore'), '*.tmp\n')
  assert.ok(reussi(commitDe(depotDe(b.arbre), { message: 'arbre', chemins: ['suivi-de-l-arbre.txt', '.gitignore', 'sous/.gitignore', 'outils/.gitignore'] })))
  rmSync(join(b.arbre, '.git'))
  const validation = prefixeDeRefus('validation') + ' mesure indéterminée : '
  assert.deepEqual(mesurer(b.arbre).refus, [validation + 'fichier .git absent de ' + b.arbre + ' : git y lirait le dépôt parent'])
  const etranger = join(b.racine, 'etranger')
  mkdirSync(etranger)
  assert.deepEqual(mesurerDemi(etranger).refus, [validation + 'fichier .git absent de ' + etranger + ' : git y lirait le dépôt parent, et aucun dossier unique de ' + join(commun, 'worktrees') + ' ne le nomme'])
  mkdirSync(join(b.arbre, 'node_modules', 'paquet'), { recursive: true })
  writeFileSync(join(b.arbre, 'node_modules', 'paquet', 'index.js'), 'reconstructible')
  rmSync(join(b.arbre, '.gitignore'))
  rmSync(join(b.arbre, 'outils', '.gitignore'))
  const temporaire = mkdtempSync(join(tmpdir(), 'temp-du-banc-'))
  const variables = ['TEMP', 'TMP', 'TMPDIR'].map((v) => [v, process.env[v]])
  for (const [v] of variables) process.env[v] = temporaire
  let propre
  try {
    propre = mesurerDemi(b.arbre)
  } finally {
    for (const [v, valeur] of variables) if (valeur === undefined) delete process.env[v]; else process.env[v] = valeur
  }
  assert.equal(propre.ok, true, 'ses suivis supprimés ne comptent pas, ce qu’ignoraient ses .gitignore supprimés non plus, le non-suivi du principal non plus, ses propres suivis restent suivis : ' + propre.refus.join(' ; '))
  assert.deepEqual(listerDossier(temporaire), [], 'la copie des règles est effacée')
  rmSync(temporaire, { recursive: true })
  mkdirSync(join(b.arbre, 'notes'))
  writeFileSync(join(b.arbre, 'notes', 'note.md'), 'authoré sous un motif du .gitignore supprimé')
  assert.deepEqual(mesurerDemi(b.arbre).refus, [prefixeDeRefus('métier') + ' ignoré authoré (1) : notes/note.md'], 'ignoré par la règle de l’index, il se juge comme tout ignoré')
  rmSync(join(b.arbre, 'notes'), { recursive: true })
  writeFileSync(join(b.arbre, 'outils', 'cache.tmp'), 'authoré sous le motif du .gitignore imbriqué supprimé')
  assert.deepEqual(mesurerDemi(b.arbre).refus, [prefixeDeRefus('métier') + ' ignoré authoré (1) : outils/cache.tmp'], 'la règle imbriquée supprimée se lit à l’index comme la racine')
  rmSync(join(b.arbre, 'outils', 'cache.tmp'))
  writeFileSync(join(b.arbre, 'sous', 'garde.log'), 'authoré, réinclus par le .gitignore resté')
  assert.deepEqual(mesurerDemi(b.arbre).refus, [prefixeDeRefus('métier') + ' modifications non commitées (1) : sous/garde.log'], 'la règle restée sur le disque prime sur celle de l’index')
  rmSync(join(b.arbre, 'sous', 'garde.log'))
  mkdirSync(join(b.arbre, 'dist'))
  writeFileSync(join(b.arbre, 'dist', '.gitignore'), '!travail.txt\n')
  writeFileSync(join(b.arbre, 'dist', 'travail.txt'), 'authoré, réinclus par un .gitignore non suivi')
  assert.deepEqual(mesurerDemi(b.arbre).refus, [prefixeDeRefus('métier') + ' modifications non commitées (1) : dist/travail.txt'], 'un .gitignore non suivi resté sur le disque compte aussi')
  rmSync(join(b.arbre, 'dist'), { recursive: true })
  writeFileSync(join(b.arbre, 'intrus.txt'), 'authoré')
  assert.deepEqual(mesurerDemi(b.arbre).refus, [prefixeDeRefus('métier') + ' modifications non commitées (1) : intrus.txt'])
  rmSync(join(b.arbre, 'intrus.txt'))
  writeFileSync(join(b.racine, '.git', 'info', 'exclude'), 'build/\n')
  mkdirSync(join(b.arbre, 'build'))
  writeFileSync(join(b.arbre, 'build', 'notes.md'), 'authoré, ignoré')
  assert.deepEqual(mesurerDemi(b.arbre).refus, [prefixeDeRefus('métier') + ' ignoré authoré (1) : build/notes.md'])
  assert.equal(existsSync(join(b.arbre, '.git')), false, 'la mesure n’écrit rien')
})

test('#2795 sans fichier .git, un .gitignore indexé puis supprimé du disque reste un refus métier, jamais une règle lue', (t) => {
  const b = terrain(t)
  const mesurerDemi = (chemin) => mesurerProtectionWorktree(chemin, { snapshot, commun: join(b.racine, '.git') })
  mkdirSync(join(b.arbre, 'sous'))
  writeFileSync(join(b.arbre, 'sous', '.gitignore'), '*.a\n')
  assert.ok(reussi(commitDe(depotDe(b.arbre), { message: 'arbre', chemins: ['sous/.gitignore'] })))
  writeFileSync(join(b.arbre, 'sous', '.gitignore'), '*.b\n')
  lancerGit(['add', '--', 'sous/.gitignore'], { cwd: b.arbre })
  rmSync(join(b.arbre, 'sous', '.gitignore'))
  mkdirSync(join(b.arbre, 'node_modules'))
  writeFileSync(join(b.arbre, 'node_modules', 'x'), 'ignoré par le .gitignore supprimé')
  rmSync(join(b.arbre, '.git'))
  rmSync(join(b.arbre, '.gitignore'))
  assert.deepEqual(mesurerDemi(b.arbre).refus, [prefixeDeRefus('métier') + ' modifications non commitées (1) : sous/.gitignore'])
})

test('#2795 relierFichierGit : SON dossier d’administration seul, en création exclusive, sinon null', (t) => {
  const b = terrain(t)
  const commun = join(b.racine, '.git')
  const avant = fs.readFileSync(join(b.arbre, '.git'), 'utf8')
  rmSync(join(b.arbre, '.git'))
  assert.equal(relierFichierGit(b.arbre, commun), 'arbre')
  assert.equal(fs.readFileSync(join(b.arbre, '.git'), 'utf8'), avant)
  assert.throws(() => relierFichierGit(b.arbre, commun), (e) => e.code === 'EEXIST')
  const etranger = join(b.racine, 'etranger')
  mkdirSync(etranger)
  assert.equal(relierFichierGit(etranger, commun), null)
  assert.equal(existsSync(join(etranger, '.git')), false)
})

test('#2795 retrait d’un arbre À DEMI RETIRÉ : relié, suivis supprimés restaurés, retiré ; un intrus refuse et reste', (t) => {
  const mesurerBanc = (chemin, options) => mesurerProtectionWorktree(chemin, { ...options, snapshot })
  const b = terrain(t)
  writeFileSync(join(b.racine, 'non-suivi-du-principal.txt'), 'au principal')
  mkdirSync(join(b.arbre, 'node_modules'))
  writeFileSync(join(b.arbre, 'node_modules', 'x'), 'ignoré par le .gitignore supprimé')
  rmSync(join(b.arbre, '.git'))
  rmSync(join(b.arbre, '.gitignore'))
  const retire = retirerWorktree(b.depot, b.arbre, { mesurer: mesurerBanc })
  assert.ok(reussi(retire), JSON.stringify(retire))
  assert.equal(existsSync(b.arbre), false)
  assert.ok(existsSync(join(b.racine, 'non-suivi-du-principal.txt')), 'le non-suivi du principal ne lui est pas attribué')

  const c = terrain(t)
  rmSync(join(c.arbre, '.git'))
  writeFileSync(join(c.arbre, 'intrus.txt'), 'authoré')
  const refuse = retirerWorktree(c.depot, c.arbre, { mesurer: mesurerBanc })
  assert.equal(reussi(refuse), false)
  assert.match(refuse.raison, /modifications non commitées \(1\) : intrus\.txt/)
  assert.ok(existsSync(join(c.arbre, 'intrus.txt')))
  assert.equal(existsSync(join(c.arbre, '.git')), false, 'mesuré avant reliure : rien n’y est écrit')
})

test('#2795 reliure d’un arbre À DEMI RETIRÉ : chaque refus laisse l’arbre et dit pourquoi', (t) => {
  const tente = (b, mesurerAvant) => retirerWorktree(b.depot, b.arbre, { mesurer: (chemin, options) => options?.commun ? mesurerAvant(chemin) : mesurerProtectionWorktree(chemin, { ...options, snapshot }) })
  const ok = () => ({ ok: true, refus: [] })

  const protege = terrain(t)
  rmSync(join(protege.arbre, '.git'))
  const vivant = tente(protege, () => ({ ok: false, refus: ['PID 7 vivant'] }))
  assert.deepEqual([reussi(vivant), vivant.raison], [false, 'PID 7 vivant'])
  assert.equal(existsSync(join(protege.arbre, '.git')), false, 'protégé : jamais relié')

  const course = terrain(t)
  rmSync(join(course.arbre, '.git'))
  const pris = tente(course, (chemin) => { writeFileSync(join(chemin, '.git'), 'posé entre-temps\n'); return ok() })
  assert.match(pris.raison, /^arbre à demi retiré non relié : .* — EEXIST$/)
  assert.equal(fs.readFileSync(join(course.arbre, '.git'), 'utf8'), 'posé entre-temps\n')

  const orphelin = terrain(t)
  rmSync(join(orphelin.arbre, '.git'))
  rmSync(join(orphelin.racine, '.git', 'worktrees', 'arbre', 'gitdir'))
  assert.match(tente(orphelin, ok).raison, /^arbre à demi retiré non relié : aucun dossier unique de .*\/worktrees ne nomme /)
  assert.equal(existsSync(join(orphelin.arbre, '.git')), false)

  const ailleurs = terrain(t)
  const autre = terrain(t)
  rmSync(join(ailleurs.arbre, '.git'))
  writeFileSync(join(ailleurs.racine, '.git', 'worktrees', 'arbre', 'commondir'), join(autre.racine, '.git') + '\n')
  assert.match(tente(ailleurs, ok).raison, /^arbre à demi retiré relié à arbre, mais git n’y lit pas /)
  assert.ok(existsSync(ailleurs.arbre))

  const tardif = terrain(t)
  rmSync(join(tardif.arbre, '.git'))
  writeFileSync(join(tardif.arbre, 'intrus.txt'), 'apparu après la mesure')
  assert.match(tente(tardif, ok).raison, /^arbre à demi retiré relié, mais modifié hors suppressions : \?\? intrus\.txt$/)
  assert.deepEqual(etatDeLArbre(depotDe(tardif.arbre)).map((e) => e.etat + ' ' + e.chemins[0]), ['?? intrus.txt'], 'relié, il se mesure comme les autres')
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
  const refuse = (champ) => champ + ' illisible : [win32 5] Accès refusé'
  const vue = (p) => mesurerProtectionWorktree(b.arbre, { snapshot: porteeProcessus({ utilisateur, processus: [p] }) })
  const illisible = vue({ pid: 10, nom: 'illisible', proprietaire: utilisateur, creation: 'a', commande: null, cwd: null, erreurs: [refuse('cwd'), refuse('commande')] })
  assert.equal(illisible.ok, true)
  assert.match(illisible.horsMesure.join(' '), /PID 10 illisible.*cwd illisible/)
  assert.equal(vue({ pid: 10, nom: 'muet', proprietaire: utilisateur, creation: 'a', commande: null, cwd: null }).ok, false)
  const horsPortee = vue({ pid: 11, nom: 'système', proprietaire: null, creation: 'b', commande: null, cwd: null, erreurs: ['proprietaire', 'image', 'cwd', 'commande'].map(refuse) })
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
    { pid: 14, nom: 'cachotier.exe', proprietaire: utilisateur, creation: 'b', commande: null, cwd: null, erreurs: ['cwd illisible : [win32 5] Accès refusé', 'commande illisible : [win32 5] Accès refusé'] },
  ] }) })
  assert.equal(vu.ok, false)
  assert.match(vu.refus[0], /^\[métier · non retentable\] processus liés \(1\) : PID 13 powershell\.exe — powershell\.exe -NoProfile -EncodedCommand… — cwd, argument /)
  assert.ok(vu.refus.includes('[métier · non retentable] modifications non commitées (7) : sale-0.txt, sale-1.txt, sale-2.txt, sale-3.txt, sale-4.txt, +2 autres'), vu.refus.join('\n'))
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
    { pid: 20, nom: 'DefenderSessionHelper.exe', image: join(b.racine, 'systeme.exe'), creation: '2026-10-18T00:00:00Z', commande: null, cwd: null, erreurs: ['cwd illisible : [win32 5] Accès refusé', 'commande illisible : [win32 5] Accès refusé'] },
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
  assert.match(vu.indeterminees.join(' '), /\[panne · non retentable\].*cwd illisible/)
})

test('#2741 image absolue et ancêtres chronologiques prouvent le lien, basename et PID recyclé exclus', (t) => {
  const b = terrain(t)
  const parent = { pid: 30, ppid: 0, cwd: b.arbre, commande: 'node', creation: '2026-10-18T00:00:00Z' }
  const enfant = { pid: 31, ppid: 30, nom: 'node', cwd: null, commande: 'node', creation: '2026-10-18T00:00:01Z', erreurs: ['cwd illisible : [win32 5] Accès refusé'] }
  const protection = (p, parents = []) => mesurerProtectionWorktree(b.arbre, { snapshot: { processus: [p, ...parents] } })
  assert.match(protection({ ...enfant, image: join(b.arbre, 'node.exe') }).refus.join(' '), /^\[métier · non retentable\] processus liés \(1\) : PID 31 node — node — image[ …]/)
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
