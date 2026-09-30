// CLIQUET de l'inventaire des worktrees (node --test) : le classement est PUR, les écrivains de la
// purge sont injectables, et l'inventaire se joue sur un dépôt JETABLE sous `os.tmpdir()` porteur de
// VRAIS worktrees — la seule façon de prouver qu'un arbre SALE survit à `--purger`.
// Lancé par `npm run test:ops`.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { envDeDepotForge, instanceDeDepot } from '../guards/lib/depotGabarit.mjs'
import { GitIndisponible, depotDe, worktreesDe } from '../guards/lib/gitPorte.mjs'
import {
  CLASSES, GESTES_DE_L_INVENTAIRE, arbresTenus, classerWorktree, comptesParClasse, inventaire, ligneDInventaire, purger,
} from './worktrees.mjs'

/** Les ÉCRIVAINS de la purge, factices : `vus` journalise chaque geste, `code(geste)` rend son code
 *  de sortie. */
function gestesFactices(vus = [], code = () => 0) {
  const union = (geste) => {
    vus.push(geste)
    const status = code(geste)
    return { disponible: true, valeur: { status, stdout: '', stderr: status ? 'fatal: failed to delete: Permission denied' : '' } }
  }
  return {
    retirerWorktree: (_depot, chemin) => union(`worktree remove ${chemin}`),
    supprimerBranche: (_depot, branche) => union(`branch -d ${branche}`),
    elaguerWorktrees: () => union('worktree prune'),
  }
}

// `tenus` est l'ensemble NORMALISÉ des arbres que le processus courant tient : il est INJECTÉ ici
// (fixture locale), jamais lu du disque — le classement reste pur.
const TENUS = new Set(['/dep/.wt-tenu', '/dep/.wt-script'])

test('classerWorktree : l’ordre du RISQUE est total, une combinaison ne rend qu’une classe', () => {
  const cas = [
    [{ principal: true, sale: true, absent: true, verrouille: true, fusionne: true }, 'principal'],
    [{ chemin: '/dep/.wt-tenu', absent: true, sale: true, verrouille: true, fusionne: true }, 'tenu'],
    [{ absent: true, sale: true, verrouille: true, fusionne: true }, 'absent'],
    [{ verrouille: true, sale: true, fusionne: true }, 'verrouillé'],
    [{ sale: true, fusionne: true }, 'sale'],
    [{ sale: true, fusionne: false }, 'sale'],
    [{ fusionne: false }, 'propre+hors-main'],
    [{ fusionne: null }, 'propre+hors-main'],
    [{}, 'propre+hors-main'],
    [{ fusionne: true }, 'propre+fusionné'],
  ]
  for (const [etat, attendu] of cas) {
    assert.equal(classerWorktree(etat, { tenus: TENUS }), attendu, `${JSON.stringify(etat)} → ${attendu}`)
  }
  assert.equal(CLASSES.length, 7, 'sept classes, et le verdict vit à UN endroit')
  assert.deepEqual([...new Set(cas.map(([, c]) => c))].sort(), [...CLASSES].sort())
})

// Un arbre TENU par ce processus est second dans l'ordre du risque : il passe devant `sale` comme
// devant `propre+fusionné`. La question « que perdrait-on à le retirer ? » a ici une réponse propre :
// le retrait se joue sous le processus qui l'occupe, et git le refuse ou le laisse à moitié fait.
test('classerWorktree : un arbre TENU par ce processus n’est JAMAIS purgeable, et la raison le dit', () => {
  const tenu = { chemin: '/dep/.wt-tenu', fusionne: true }
  assert.equal(classerWorktree(tenu, { tenus: TENUS }), 'tenu')
  assert.equal(classerWorktree(tenu), 'propre+fusionné', 'sans `tenus`, rien ne le distingue — c’est CE processus qui le sait')
  // La casse et les séparateurs ne changent pas le verdict (Windows rend les deux formes).
  assert.equal(classerWorktree({ chemin: '\\Dep\\.wt-tenu', fusionne: true }, { tenus: new Set(['/dep/.wt-tenu']) }), 'tenu')

  const ligne = ligneDInventaire({ ...tenu, classe: 'tenu', branche: 'chantier/tenu' })
  assert.deepEqual(ligne.split('\t').slice(0, 3), ['tenu', '/dep/.wt-tenu', 'chantier/tenu'])
  assert.match(ligne.split('\t')[3], /tenu par ce processus \(script ou cwd\)/)
  assert.match(ligne.split('\t')[3], /rejouer depuis un autre worktree/)
  assert.deepEqual(comptesParClasse([{ classe: 'tenu' }, { classe: 'principal' }, { classe: 'tenu' }]),
    { principal: 1, tenu: 2 }, 'il se COMPTE comme les autres, à sa place dans l’ordre')

  // Et la purge ne le voit pas : elle ne retire que `propre+fusionné`.
  const vus = []
  const gestes = purger({
    principal: '/dep',
    worktrees: [{ classe: 'tenu', chemin: '/dep/.wt-tenu', branche: 'chantier/tenu' }],
    gestes: gestesFactices(vus),
  })
  assert.deepEqual(vus, [])
  assert.deepEqual(gestes, [])
})

test('arbresTenus : l’arbre du SCRIPT et celui qui contient le cwd — le plus PROCHE, pas l’englobant', () => {
  const worktrees = [{ chemin: '/dep' }, { chemin: '/dep/.wt-42' }, { chemin: '/dep/.wt-43' }]
  // Le cwd est SOUS `.wt-42` : c'est cet arbre-là qui est tenu, pas `/dep` qui le préfixe aussi.
  assert.deepEqual([...arbresTenus({ worktrees, racine: '/dep/.wt-43', cwd: '/dep/.wt-42/scripts/ops' })].sort(),
    ['/dep/.wt-42', '/dep/.wt-43'])
  assert.deepEqual([...arbresTenus({ worktrees, racine: '/dep', cwd: '/dep' })], ['/dep'])
  // Un cwd hors du dépôt ne tient rien de plus que l'arbre du script.
  assert.deepEqual([...arbresTenus({ worktrees, racine: '/dep/.wt-42', cwd: '/ailleurs' })], ['/dep/.wt-42'])
  // Le préfixe se compare par SEGMENT : `/dep/.wt-42x` n'est pas dans `.wt-42` — c'est l'arbre
  // principal qui le contient.
  assert.deepEqual([...arbresTenus({ worktrees, racine: '/dep/.wt-42', cwd: '/dep/.wt-42x' })].sort(),
    ['/dep', '/dep/.wt-42'])
  // Séparateurs `\` et casse : les deux formes que Windows rend entrent dans le MÊME espace comparable.
  assert.deepEqual([...arbresTenus({ worktrees, racine: '\\Dep\\.WT-42', cwd: '\\Dep' })].sort(), ['/dep', '/dep/.wt-42'])
})

test('un verdict de fusion INCONNU ne rend JAMAIS purgeable', () => {
  assert.notEqual(classerWorktree({ fusionne: null }), 'propre+fusionné')
  assert.notEqual(classerWorktree({ fusionne: undefined }), 'propre+fusionné')
})

test('ligneDInventaire : quatre colonnes tabulées, et LA raison de toucher ou non', () => {
  const fusionne = ligneDInventaire({ classe: 'propre+fusionné', chemin: '/dep/.wt-42', branche: 'chantier/42', fusionne: true })
  assert.deepEqual(fusionne.split('\t'), ['propre+fusionné', '/dep/.wt-42', 'chantier/42', 'fusionné dans origin/main — purgeable'])

  const detache = ligneDInventaire({ classe: 'sale', chemin: '/dep/.wt-d', branche: null, head: '3333333333333333333333333333333333333333' })
  assert.deepEqual(detache.split('\t').slice(2), ['détaché@3333333', 'modifications non commitées — rien ne se retire sous elles'])

  const verrou = ligneDInventaire({ classe: 'verrouillé', chemin: '/v', branche: 'b', verrouillePour: 'recette' })
  assert.match(verrou.split('\t')[3], /verrouillé : recette/)

  const perdu = ligneDInventaire({ classe: 'absent', chemin: '/p', branche: 'b', prunable: 'gitdir absent' })
  assert.match(perdu.split('\t')[3], /gitdir absent/)

  const sansVerdict = ligneDInventaire({ classe: 'propre+hors-main', chemin: '/h', branche: 'b', fusionne: null })
  assert.match(sansVerdict.split('\t')[3], /verdict de fusion indisponible/)

  const horsMain = ligneDInventaire({ classe: 'propre+hors-main', chemin: '/h', branche: 'b', fusionne: false })
  assert.match(horsMain.split('\t')[3], /commits que origin\/main/)
})

test('comptesParClasse compte dans l’ordre des CLASSES, sans les classes vides', () => {
  const comptes = comptesParClasse([
    { classe: 'propre+fusionné' }, { classe: 'principal' }, { classe: 'propre+fusionné' }, { classe: 'sale' },
  ])
  assert.deepEqual(Object.entries(comptes), [['principal', 1], ['sale', 1], ['propre+fusionné', 2]])
})

test('purger : un worktree ABSENT seul suffit à jouer `git worktree prune` (écrivains injectés)', () => {
  const vus = []
  // Aucun `propre+fusionné` : sans le déclencheur `absent`, la taille ne se jouait pas et
  // l'inventaire répétait le worktree disparu à chaque passage.
  const gestes = purger({ principal: '/dep', worktrees: [{ classe: 'absent', chemin: '/dep/.wt-perdu', branche: 'chantier/perdu' }], gestes: gestesFactices(vus) })
  assert.deepEqual(vus, ['worktree prune'])
  assert.deepEqual(gestes.map((g) => g.geste), ['git worktree prune'])
  assert.equal(gestes[0].ok, true)
})

test('purger : sans absent NI fusionné, aucun geste — la taille ne se joue pas sur rien', () => {
  const vus = []
  const gestes = purger({ principal: '/dep', worktrees: [{ classe: 'sale', chemin: '/dep/.wt-sale' }, { classe: 'principal', chemin: '/dep' }], gestes: gestesFactices(vus) })
  assert.deepEqual(vus, [])
  assert.deepEqual(gestes, [])
})

/** Dépôt jetable + son `origin` NU, avec `origin/main` réellement posé. */
function depotAvecOrigin() {
  const nu = mkdtempSync(join(tmpdir(), 'origin-nu-'))
  execFileSync('git', ['init', '--bare', '-q', '-b', 'main', nu], { env: envDeDepotForge(), encoding: 'utf8' })
  const { racine } = instanceDeDepot({ fichiers: { 'a.txt': 'a' }, message: 'fondation' })
  const git = (...args) => execFileSync('git', args, { cwd: racine, env: envDeDepotForge(), encoding: 'utf8' }).trim()
  git('remote', 'add', 'origin', nu)
  git('push', '-q', 'origin', 'main')
  return { racine, git, jeter: () => { for (const d of [racine, nu]) rmSync(d, { recursive: true, force: true }) } }
}

/** Le worktree inventorié dont le chemin finit par `nom` (git rend des chemins en `/`). */
const parNom = (worktrees, nom) => worktrees.find((w) => w.chemin.replace(/\\/g, '/').endsWith(`/${nom}`))

test('inventaire RÉEL puis --purger : le fusionné PROPRE part, le SALE reste et se dit', () => {
  const { racine, git, jeter } = depotAvecOrigin()
  try {
    git('worktree', 'add', '-q', '-b', 'chantier/propre', join(racine, '.wt-propre'), 'origin/main')
    git('worktree', 'add', '-q', '-b', 'chantier/sale', join(racine, '.wt-sale'), 'origin/main')
    writeFileSync(join(racine, '.wt-sale', 'a.txt'), 'modifié, non commité')

    const vu = inventaire({ racine })
    assert.equal(vu.ok, true, vu.refus)
    assert.equal(vu.fusionLue, true)
    assert.equal(vu.worktrees[0].classe, 'principal', 'le premier bloc est l’arbre principal')
    assert.equal(parNom(vu.worktrees, '.wt-propre').classe, 'propre+fusionné')
    assert.equal(parNom(vu.worktrees, '.wt-sale').classe, 'sale', 'même fusionné, un arbre SALE n’est pas purgeable')
    assert.match(ligneDInventaire(parNom(vu.worktrees, '.wt-sale')), /modifications non commitées/)

    const gestes = purger({ principal: racine, worktrees: vu.worktrees })
    assert.deepEqual(gestes.filter((g) => !g.ok), [], JSON.stringify(gestes))
    assert.deepEqual(gestes.map((g) => g.geste.split(' ').slice(0, 3).join(' ')),
      ['git worktree remove', 'git branch -d', 'git worktree prune'])
    assert.equal(existsSync(join(racine, '.wt-propre')), false, 'le fusionné propre est retiré')
    assert.equal(existsSync(join(racine, '.wt-sale')), true, 'le sale est intact')
    assert.equal(existsSync(join(racine, '.wt-sale', 'a.txt')), true)
    assert.equal(git('branch', '--list', 'chantier/propre'), '', 'sa branche fusionnée est retirée aussi')
    assert.match(git('branch', '--list', 'chantier/sale'), /chantier\/sale/, 'celle du sale est gardée')

    const apres = inventaire({ racine })
    assert.equal(apres.worktrees.length, 2, 'principal + le sale')
    assert.equal(parNom(apres.worktrees, '.wt-propre'), undefined)
  } finally { jeter() }
})

test('un worktree dont le RÉPERTOIRE a disparu se classe absent, et la purge le TAILLE (prune seul)', () => {
  const { racine, git, jeter } = depotAvecOrigin()
  try {
    git('worktree', 'add', '-q', '-b', 'chantier/perdu', join(racine, '.wt-perdu'), 'origin/main')
    rmSync(join(racine, '.wt-perdu'), { recursive: true, force: true })

    const vu = inventaire({ racine })
    const perdu = parNom(vu.worktrees, '.wt-perdu')
    assert.equal(perdu.classe, 'absent')
    assert.match(ligneDInventaire(perdu), /git worktree prune/)
    const gestes = purger({ principal: racine, worktrees: vu.worktrees })
    assert.deepEqual(gestes.map((g) => g.geste), ['git worktree prune'], 'la taille se joue, et ELLE SEULE')
    assert.deepEqual(gestes.filter((g) => !g.ok), [], JSON.stringify(gestes))
    // Ni retrait ni suppression de branche : seule l'INSCRIPTION du worktree disparu est taillée.
    assert.equal(parNom(inventaire({ racine }).worktrees, '.wt-perdu'), undefined)
    assert.match(git('branch', '--list', 'chantier/perdu'), /chantier\/perdu/, 'sa branche survit à la taille')
  } finally { jeter() }
})

test('worktreesDe lit les cinq formes de worktree sur git RÉEL, et le PREMIER est l’arbre principal', () => {
  const { racine, git, jeter } = depotAvecOrigin()
  try {
    git('worktree', 'add', '-q', '-b', 'chantier/42', join(racine, '.wt-42'), 'origin/main')
    git('worktree', 'add', '-q', '--detach', join(racine, '.wt-detache'), 'origin/main')
    git('worktree', 'add', '-q', '-b', 'chantier/verrou', join(racine, '.wt-verrou'), 'origin/main')
    git('worktree', 'lock', '--reason', 'recette en cours', join(racine, '.wt-verrou'))
    git('worktree', 'add', '-q', '-b', 'chantier/nu-verrou', join(racine, '.wt-nu-verrou'), 'origin/main')
    git('worktree', 'lock', join(racine, '.wt-nu-verrou'))
    git('worktree', 'add', '-q', '-b', 'chantier/perdu', join(racine, '.wt-perdu'), 'origin/main')
    rmSync(join(racine, '.wt-perdu'), { recursive: true, force: true })
    const vus = worktreesDe(depotDe(racine, { env: envDeDepotForge() }))
    const nom = (w) => w.chemin.split('/').pop()
    const par = Object.fromEntries(vus.slice(1).map((w) => [nom(w), w]))
    assert.deepEqual(vus.map((w) => w.principal), [true, false, false, false, false, false])
    assert.deepEqual(Object.entries(par).map(([n, w]) => [n, w.branche]).sort(), [
      ['.wt-42', 'chantier/42'], ['.wt-detache', null], ['.wt-nu-verrou', 'chantier/nu-verrou'],
      ['.wt-perdu', 'chantier/perdu'], ['.wt-verrou', 'chantier/verrou'],
    ])
    assert.match(par['.wt-detache'].head, /^[0-9a-f]{40}$/)
    assert.deepEqual([par['.wt-verrou'].verrouille, par['.wt-verrou'].verrouillePour], [true, 'recette en cours'])
    assert.deepEqual([par['.wt-nu-verrou'].verrouille, par['.wt-nu-verrou'].verrouillePour], [true, null])
    assert.equal(par['.wt-42'].verrouille, false)
    assert.match(par['.wt-perdu'].prunable, /gitdir file points to non-existent location/)
    assert.equal(par['.wt-42'].prunable, null)
    assert.equal(vus.some((w) => w.nu), false)
  } finally { jeter() }
})

test('un arbre ILLISIBLE (git en panne sur son dossier) est SALE : il ne se purge pas', () => {
  const { racine, jeter } = depotAvecOrigin()
  const illisible = mkdtempSync(join(tmpdir(), 'wt-illisible-'))
  try {
    const bruts = [
      { chemin: racine, head: null, branche: 'main', principal: true, nu: false, verrouille: false, verrouillePour: null, prunable: null },
      { chemin: illisible, head: 'a'.repeat(40), branche: 'chantier/illisible', principal: false, nu: false, verrouille: false, verrouillePour: null, prunable: null },
    ]
    const vu = inventaire({ racine, gestes: {
      ...GESTES_DE_L_INVENTAIRE,
      worktreesDe: () => bruts,
      fetchOrigin: () => ({ disponible: true, valeur: { status: 0, stdout: '', stderr: '' } }),
      estAncetre: () => ({ disponible: true, valeur: true }),
    } })
    const w = vu.worktrees.find((x) => x.chemin === illisible)
    assert.deepEqual([w.sale, w.fusionne, w.classe], [true, true, 'sale'])
  } finally {
    jeter()
    rmSync(illisible, { recursive: true, force: true })
  }
})

test('origin non lu : l’inventaire s’imprime SANS verdict de fusion, et rien n’est purgeable', () => {
  const { racine, git, jeter } = depotAvecOrigin()
  try {
    git('worktree', 'add', '-q', '-b', 'chantier/propre', join(racine, '.wt-propre'), 'origin/main')
    const vu = inventaire({ racine, gestes: { ...GESTES_DE_L_INVENTAIRE, fetchOrigin: () => ({ disponible: false, raison: 'réseau coupé' }) } })
    assert.equal(vu.fusionLue, false)
    const propre = parNom(vu.worktrees, '.wt-propre')
    assert.equal(propre.fusionne, null)
    assert.equal(propre.classe, 'propre+hors-main', 'sans origin/main lu, on ne purge pas sur rien')
    assert.deepEqual(purger({ principal: racine, worktrees: vu.worktrees }), [])
    assert.equal(existsSync(join(racine, '.wt-propre')), true)
  } finally { jeter() }
})

test('inventaire : UN fetch par défaut (ops:worktrees), AUCUN sous sansFetch — le verdict se lit sur les refs PRÉSENTES', () => {
  const { racine, git, jeter } = depotAvecOrigin()
  try {
    git('worktree', 'add', '-q', '-b', 'chantier/propre', join(racine, '.wt-propre'), 'origin/main')
    let fetchs = 0
    const gestes = {
      ...GESTES_DE_L_INVENTAIRE,
      fetchOrigin: (...args) => { fetchs += 1; return GESTES_DE_L_INVENTAIRE.fetchOrigin(...args) },
    }
    const defaut = inventaire({ racine, gestes })
    assert.deepEqual([fetchs, defaut.fusionLue, parNom(defaut.worktrees, '.wt-propre').classe], [1, true, 'propre+fusionné'])
    const sans = inventaire({ racine, gestes, sansFetch: true })
    assert.deepEqual([fetchs, sans.fusionLue, parNom(sans.worktrees, '.wt-propre').classe], [1, true, 'propre+fusionné'])

    git('update-ref', '-d', 'refs/remotes/origin/main')
    const sansOrigin = inventaire({ racine, gestes, sansFetch: true })
    const propre = parNom(sansOrigin.worktrees, '.wt-propre')
    assert.deepEqual([fetchs, sansOrigin.fusionLue, propre.fusionne, propre.classe], [1, true, null, 'propre+hors-main'])
    assert.match(ligneDInventaire(propre), /verdict de fusion indisponible — origin\/main non lu/)
  } finally { jeter() }
})

// Le `remove` qui ÉCHOUE laisse un dossier sur le disque (EPERM d'un arbre tenu par un autre
// processus, mesuré sur `.wt-1736`). Sans re-mesure, la sortie annonçait le retrait et personne ne
// savait qu'il restait un dossier à retirer à la main. Les écrivains et la sonde de disque sont INJECTÉS.
test('purger : un remove ROUGE dont le dossier RESTE se dit, avec le geste à la main et la branche', () => {
  const vus = []
  const gestes = purger({
    principal: '/dep',
    worktrees: [{ classe: 'propre+fusionné', chemin: '/dep/.wt-bloque', branche: 'chantier/bloque' }],
    gestes: gestesFactices(vus, (geste) => (geste.startsWith('worktree remove') ? 1 : 0)),
    nature: (chemin) => (chemin === '/dep/.wt-bloque' ? 'repertoire' : 'absent'),
  })
  // La branche n'est PAS supprimée (le remove a échoué) ; la taille se joue ; puis la re-mesure parle.
  assert.deepEqual(vus, ['worktree remove /dep/.wt-bloque', 'worktree prune'])
  assert.deepEqual(gestes.map((g) => [g.geste, g.ok]), [
    ['git worktree remove /dep/.wt-bloque', false],
    ['git worktree prune', true],
    ['re-mesure /dep/.wt-bloque', false],
  ])
  assert.match(gestes[2].detail, /dossier présent : à retirer à la main \(`rm -rf \/dep\/\.wt-bloque`\)/)
  assert.match(gestes[2].detail, /branche `chantier\/bloque` conservée/)
})

// Le `remove` VERT qui laisse le dossier : git a désenregistré le worktree et rendu 0, mais un
// fichier tenu par un autre processus a survécu à la suppression. La re-mesure porte donc sur TOUS
// les chemins tentés, verts compris — sinon la sortie est « ok » et le dossier reste, muet.
test('purger : un remove VERT dont le dossier RESTE est nommé lui aussi', () => {
  const gestes = purger({
    principal: '/dep',
    worktrees: [{ classe: 'propre+fusionné', chemin: '/dep/.wt-reste', branche: 'chantier/reste' }],
    gestes: gestesFactices(),
    nature: (chemin) => (chemin === '/dep/.wt-reste' ? 'repertoire' : 'absent'),
  })
  assert.deepEqual(gestes.map((g) => [g.geste, g.ok]), [
    ['git worktree remove /dep/.wt-reste', true],
    ['git branch -d chantier/reste', true],
    ['git worktree prune', true],
    ['re-mesure /dep/.wt-reste', false],
  ])
  assert.match(gestes[3].detail, /retiré par git, dossier présent : à retirer à la main \(`rm -rf \/dep\/\.wt-reste`\)/)
})

test('purger : un remove rouge dont le dossier a bel et bien DISPARU ne dit rien de plus', () => {
  const gestes = purger({
    principal: '/dep',
    worktrees: [{ classe: 'propre+fusionné', chemin: '/dep/.wt-parti', branche: 'chantier/parti' }],
    gestes: gestesFactices([], (geste) => (geste.startsWith('worktree remove') ? 1 : 0)),
    nature: () => 'absent',
  })
  assert.deepEqual(gestes.map((g) => g.geste), ['git worktree remove /dep/.wt-parti', 'git worktree prune'])
  assert.equal(gestes.some((g) => g.geste.startsWith('re-mesure')), false)
})

// La classe `tenu` sur un dépôt RÉEL : le `cwd` du processus vit dans un worktree fusionné, donc
// purgeable en tout point — sauf qu'il se scierait la branche. C'est le contrat de l'outil joué
// depuis un worktree.
test('inventaire RÉEL depuis un WORKTREE : cet arbre-là est `tenu`, et la purge ne le touche pas', () => {
  const { racine, git, jeter } = depotAvecOrigin()
  try {
    git('worktree', 'add', '-q', '-b', 'chantier/ici', join(racine, '.wt-ici'), 'origin/main')
    git('worktree', 'add', '-q', '-b', 'chantier/la', join(racine, '.wt-la'), 'origin/main')

    // Lancé DEPUIS `.wt-ici` : c'est le `cwd` du processus qui désigne l'arbre tenu.
    const vu = inventaire({ racine: join(racine, '.wt-ici'), cwd: join(racine, '.wt-ici', 'scripts') })
    assert.equal(vu.ok, true, vu.refus)
    assert.equal(vu.principal.replace(/\\/g, '/'), racine.replace(/\\/g, '/'), 'les gestes partent de l’arbre principal')
    assert.equal(vu.worktrees[0].classe, 'principal')
    assert.equal(parNom(vu.worktrees, '.wt-ici').classe, 'tenu')
    assert.equal(parNom(vu.worktrees, '.wt-la').classe, 'propre+fusionné', 'l’autre reste purgeable')

    const gestes = purger({ principal: vu.principal, worktrees: vu.worktrees })
    assert.deepEqual(gestes.filter((g) => !g.ok), [], JSON.stringify(gestes))
    assert.equal(existsSync(join(racine, '.wt-ici')), true, 'l’arbre tenu est intact')
    assert.equal(existsSync(join(racine, '.wt-la')), false, 'l’autre est parti')
    assert.match(git('branch', '--list', 'chantier/ici'), /chantier\/ici/, 'et sa branche avec')
  } finally { jeter() }
})

test('git worktree list illisible : refus NOMMÉ, jamais un inventaire vide', () => {
  const vu = inventaire({
    racine: '/dep',
    gestes: { ...GESTES_DE_L_INVENTAIRE, worktreesDe: () => { throw new GitIndisponible('git introuvable (binaire absent du PATH)') } },
  })
  assert.equal(vu.ok, false)
  assert.match(vu.refus, /git introuvable/)
})
