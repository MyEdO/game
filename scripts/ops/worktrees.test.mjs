// CLIQUET de l'inventaire des worktrees (node --test) : le classement est PUR, les écrivains de la
// purge sont injectables, et l'inventaire se joue sur un dépôt JETABLE sous `os.tmpdir()` porteur de
// VRAIS worktrees — la seule façon de prouver qu'un arbre SALE survit à `--purger`.
// Lancé par `npm run test:ops`.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { envDeDepotForge, instanceDeDepot } from '../guards/lib/depotGabarit.mjs'
import { GitIndisponible, classer, depotDe, retirerWorktree, worktreesDe } from '../guards/lib/gitPorte.mjs'
import {
  CLASSES, GESTES_DE_L_INVENTAIRE, GESTES_DE_LA_PURGE, arbresTenus, classerWorktree, comptesParClasse, dossiersNonInscrits, indetermineesDe, inventaire as inventaireReel, ligneDeGeste, ligneDInventaire, main, pertesDeLElagage, raisonDe, purger as purgerReel,
} from './worktrees.mjs'
import { mesurerProtectionWorktree } from '../guards/lib/protectionWorktree.mjs'
import { DELAI_MESURE_PROCESSUS_MS } from '../guards/lib/processusWorktrees.mjs'
import { gitDe, lancerGit } from '../test/gitDeBanc.mjs'

const inventaire = (options) => inventaireReel({ processus: () => ({ processus: [], portee: 'banc' }), ...options })

test('#2795 inventaire : borne transmise et collecteur absent cité une fois dans le rendu complet', () => {
  let options
  const diagnostic = '[panne · non retentable] collecteur absent'
  const vu = inventaire({
    racine: '/dep', cwd: '/dep', sansFetch: true, lister: () => [], nature: () => 'repertoire',
    gestes: { worktreesDe: () => [{ chemin: '/dep', principal: true }, ...['a', 'b'].map((n) => ({ chemin: '/dep/' + n }))], etatDeLArbre: () => [] },
    processus: (o) => { options = o; throw new Error('collecteur absent') },
    mesurer: (_c, { snapshot: s }) => {
      assert.equal(s.erreurs[0].message, 'collecteur absent')
      return { ok: false, refus: [diagnostic], indeterminees: [diagnostic] }
    },
  })
  assert.equal(vu.ok, true)
  assert.deepEqual(options, { timeout: DELAI_MESURE_PROCESSUS_MS })
  const rendu = [...indetermineesDe(vu.worktrees), ...vu.worktrees.map(ligneDInventaire)].join('\n')
  assert.equal(rendu.split('collecteur absent').length - 1, 1)
  assert.equal(raisonDe(vu.worktrees[1]), diagnostic)
  assert.match(ligneDInventaire(vu.worktrees[1]), /diagnostics cités à part/)
})

const purger = (options) => purgerReel({ gestes: { ...GESTES_DE_LA_PURGE, retirerWorktree: (d, c) => retirerWorktree(d, c, { mesurer: (p, o) => mesurerProtectionWorktree(p, { ...o, snapshot: { processus: [], portee: 'banc' } }) }) }, ...options })

test('#2795 purger : chaque geste se signale à son DÉBUT, puis joué avec sa durée, avant le suivant', () => {
  const signales = []
  const joues = purger({
    principal: '/dep',
    worktrees: [{ classe: 'propre+fusionné', chemin: '/dep/.wt-a', branche: 'chantier/a' }],
    gestes: gestesFactices(),
    nature: () => 'absent',
    signaler: (g) => signales.push(ligneDeGeste(g)),
  })
  assert.deepEqual(signales.map((l) => l.trimEnd().split('\t').slice(0, 2).join(' ')), [
    'en cours git worktree remove /dep/.wt-a', 'ok git worktree remove /dep/.wt-a',
    'en cours git branch -d chantier/a', 'ok git branch -d chantier/a',
  ])
  assert.ok(joues.every((g) => Number.isInteger(g.dureeMs) && g.dureeMs >= 0))
  assert.match(signales[1], /^ok\tgit worktree remove \/dep\/\.wt-a\t\d+ ms\tcode 0\n$/)
})

test('#2795 main --purger : le geste en cours est DÉJÀ écrit quand il se joue, le code de sortie suit les échecs', () => {
  const dits = []
  let ecritAvantLeGeste
  const code = main({
    argv: ['--purger'],
    inventorier: () => ({ ok: true, fusionLue: true, principal: '/dep', worktrees: [], nonInscrits: [] }),
    purge: ({ signaler }) => {
      signaler({ chemin: '/dep/.wt-a', geste: 'git worktree remove /dep/.wt-a', ok: null })
      ecritAvantLeGeste = dits.at(-1)
      const joue = { chemin: '/dep/.wt-a', geste: 'git worktree remove /dep/.wt-a', ok: false, detail: 'refus', dureeMs: 3 }
      signaler(joue)
      return [joue]
    },
    dire: (t) => dits.push(t),
    crier: (t) => dits.push(t),
  })
  assert.equal(ecritAvantLeGeste, 'en cours\tgit worktree remove /dep/.wt-a\n')
  assert.equal(dits.at(-1), 'ÉCHEC\tgit worktree remove /dep/.wt-a\t3 ms\trefus\n')
  assert.equal(code, 1)
})

/** Les ÉCRIVAINS de la purge, factices : `vus` journalise chaque geste, `code(geste)` rend son code
 *  de sortie ; `inscrits`, ce que relit `pertesDeLElagage` (fusion : tout est dans main). */
function gestesFactices(vus = [], code = () => 0, inscrits = []) {
  const union = (geste) => {
    vus.push(geste)
    const status = code(geste)
    return { disponible: true, valeur: { status, stdout: '', stderr: status ? 'fatal: failed to delete: Permission denied' : '' } }
  }
  return {
    retirerWorktree: (_depot, chemin) => union(`worktree remove ${chemin}`),
    supprimerBranche: (_depot, branche) => union(`branch -d ${branche}`),
    elaguerWorktrees: () => union('worktree prune'),
    worktreesDe: () => [{ chemin: '/dep', principal: true }, ...inscrits],
    estAncetre: () => ({ disponible: true, valeur: true }),
  }
}

test('#2795 pertesDeLElagage : prune ne se joue que si aucun inscrit `prunable` non verrouillé n’y perd quelque chose', () => {
  const inscrits = [
    { chemin: '/dep/.wt-branche', branche: 'chantier/b', head: 'b'.repeat(40), prunable: 'gitdir' },
    { chemin: '/dep/.wt-fusionne', branche: null, head: 'f'.repeat(40), prunable: 'gitdir' },
    { chemin: '/dep/.wt-hors-main', branche: null, head: 'c'.repeat(40), prunable: 'gitdir' },
    { chemin: '/dep/.wt-sans-verdict', branche: null, head: 'd'.repeat(40), prunable: 'gitdir' },
    { chemin: '/dep/.wt-demi', branche: 'chantier/demi', head: 'e'.repeat(40), prunable: 'gitdir' },
    { chemin: '/dep/.wt-verrou', branche: null, head: 'c'.repeat(40), prunable: 'gitdir', verrouille: true },
    { chemin: '/dep/.wt-inscrit', branche: null, head: 'c'.repeat(40), prunable: null },
  ]
  const gestes = {
    worktreesDe: () => [{ chemin: '/dep', principal: true }, ...inscrits],
    estAncetre: (_d, head) => ({ [`${'f'.repeat(40)}`]: { disponible: true, valeur: true }, [`${'c'.repeat(40)}`]: { disponible: true, valeur: false } })[head] ?? { disponible: false },
  }
  const nature = (chemin) => (chemin === '/dep/.wt-demi' ? 'repertoire' : 'absent')
  assert.deepEqual(pertesDeLElagage({}, { gestes, nature }), [
    '/dep/.wt-hors-main : détaché@ccccccc que origin/main n’a pas',
    '/dep/.wt-sans-verdict : détaché@ddddddd que origin/main n’a pas',
    '/dep/.wt-demi : dossier présent',
  ])
  assert.deepEqual(pertesDeLElagage({}, { gestes: { ...gestes, worktreesDe: () => null }, nature }), ['git worktree list illisible'])

  const vus = []
  const horsMain = { classe: 'absent', chemin: '/dep/.wt-hors-main', branche: null, fusionne: false }
  assert.deepEqual(purger({ principal: '/dep', worktrees: [horsMain], gestes: { ...gestesFactices(vus), ...gestes }, nature }), [],
    'un absent que la taille perdrait ne la déclenche pas')
  const joues = purger({ principal: '/dep', worktrees: [horsMain, { classe: 'absent', chemin: '/dep/.wt-branche', branche: 'chantier/b' }], gestes: { ...gestesFactices(vus), ...gestes }, nature })
  assert.deepEqual(vus, [], 'prune non joué')
  assert.deepEqual(joues.map((g) => [g.geste, g.ok]), [['git worktree prune', false]])
  assert.match(joues[0].detail, /^non joué, il désinscrirait en perdant : \/dep\/\.wt-hors-main : détaché@ccccccc/)
})

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
    [{ fusionne: true, protection: { ok: false, refus: ['PID vivant'] } }, 'protégé'],
    [{ fusionne: false }, 'propre+hors-main'],
    [{ fusionne: null }, 'propre+hors-main'],
    [{}, 'propre+hors-main'],
    [{ fusionne: true }, 'propre+fusionné'],
    [{ inscrit: false, vide: false, fusionne: true }, 'non-inscrit+peuplé'],
    [{ inscrit: false, vide: false, protection: { ok: false, refus: ['PID vivant'] } }, 'non-inscrit+peuplé'],
    [{ inscrit: false, vide: true, protection: { ok: false, refus: ['PID vivant'] } }, 'protégé'],
    [{ inscrit: false, vide: true, sale: true }, 'sale'],
    [{ inscrit: false, vide: true, fusionne: true }, 'non-inscrit+vide'],
    [{ chemin: '/dep/.wt-tenu', inscrit: false, vide: true }, 'tenu'],
    [{ demiRetire: true, absent: true }, 'absent'],
    [{ demiRetire: true, verrouille: true }, 'verrouillé'],
    [{ demiRetire: true, sale: true, fusionne: true }, 'sale'],
    [{ demiRetire: true, fusionne: true, protection: { ok: false, refus: ['PID vivant'] } }, 'protégé'],
    [{ demiRetire: true, fusionne: true }, 'à-demi-retiré'],
    [{ demiRetire: true, fusionne: false }, 'à-demi-retiré'],
  ]
  for (const [etat, attendu] of cas) {
    assert.equal(classerWorktree(etat, { tenus: TENUS }), attendu, `${JSON.stringify(etat)} → ${attendu}`)
  }
  assert.equal(CLASSES.length, 11, 'classes de risque, et le verdict vit à UN endroit')
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
  assert.match(perdu.split('\t')[3], /gitdir absent\) — git worktree prune$/)
  const perduHorsMain = ligneDInventaire({ classe: 'absent', chemin: '/p', branche: null, head: 'c'.repeat(40), prunable: 'gitdir absent', fusionne: false })
  assert.match(perduHorsMain.split('\t')[3], /commit détaché que origin\/main n’a pas \(hors main\) — jamais élagué : prune le perdrait$/)

  const sansVerdict = ligneDInventaire({ classe: 'propre+hors-main', chemin: '/h', branche: 'b', fusionne: null })
  assert.match(sansVerdict.split('\t')[3], /verdict de fusion indisponible/)

  const horsMain = ligneDInventaire({ classe: 'propre+hors-main', chemin: '/h', branche: 'b', fusionne: false })
  assert.match(horsMain.split('\t')[3], /commits que origin\/main/)
})

test('indetermineesDe : l’indétermination machine se cite UNE fois pour tout l’inventaire', () => {
  const protege = (indeterminees) => ({ protection: { ok: false, refus: [`mesure processus indéterminée : ${indeterminees.length} processus, cités à part`], indeterminees } })
  assert.deepEqual(indetermineesDe([
    protege(['PID 1 a.exe : cwd illisible', 'PID 2 b.exe : cwd illisible']),
    protege(['PID 2 b.exe : cwd illisible', 'PID 3 c.exe — ancêtre illisible']),
    { classe: 'absent' },
  ]), ['PID 1 a.exe : cwd illisible', 'PID 2 b.exe : cwd illisible', 'PID 3 c.exe — ancêtre illisible'])
})

test('comptesParClasse compte dans l’ordre des CLASSES, sans les classes vides', () => {
  const comptes = comptesParClasse([
    { classe: 'propre+fusionné' }, { classe: 'principal' }, { classe: 'propre+fusionné' }, { classe: 'sale' },
  ])
  assert.deepEqual(Object.entries(comptes), [['principal', 1], ['sale', 1], ['propre+fusionné', 2]])
})

test('purger : un worktree ABSENT seul suffit à jouer `git worktree prune` (écrivains injectés)', () => {
  const vus = []
  const gestes = purger({ principal: '/dep', worktrees: [{ classe: 'absent', chemin: '/dep/.wt-perdu', branche: 'chantier/perdu' }], gestes: gestesFactices(vus) })
  assert.deepEqual(vus, ['worktree prune'])
  assert.deepEqual(gestes.map((g) => g.geste), ['git worktree prune'])
  assert.equal(gestes[0].ok, true)
})

for (const nom of ['retirerWorktree', 'supprimerBranche', 'elaguerWorktrees']) {
  test(`#2285 purger : ${nom} conserve le diagnostic complet de chaque échec`, () => {
    const stdout = `${'note stdout\n'.repeat(50)}cause stdout tardive\n`
    for (const resultat of [
      { status: 17, stdout, stderr: '' },
      { status: 128, stdout, stderr: 'fatal: bad object abc\n' },
      { status: null, stdout, stderr: 'avant interruption\n', signal: 'SIGTERM' },
      { status: 0, stdout: '', stderr: '' },
    ]) {
      const union = classer(resultat)
      const gestes = {
        ...gestesFactices(),
        [nom]: () => union,
      }
      const joues = purger({
        principal: '/dep',
        worktrees: [{ classe: 'propre+fusionné', chemin: '/dep/.wt-propre', branche: 'chantier/propre' }, { classe: 'absent', chemin: '/dep/.wt-perdu', branche: 'chantier/perdu' }],
        gestes,
        nature: () => 'absent',
      })
      const prefixe = { retirerWorktree: 'git worktree remove', supprimerBranche: 'git branch -d', elaguerWorktrees: 'git worktree prune' }[nom]
      const vu = joues.find((g) => g.geste.startsWith(prefixe))
      assert.ok(vu)
      assert.equal(vu.ok, resultat.status === 0)
      if (resultat.status !== 0) {
        assert.ok(vu.detail.includes(stdout), `${nom} : stdout intégral`)
        if (resultat.stderr) assert.ok(vu.detail.includes(resultat.stderr), `${nom} : stderr intégral`)
        assert.match(vu.detail, resultat.signal ? /signal SIGTERM/ : new RegExp(`status ${resultat.status}`))
      }
    }
  })
}

test('purger : sans absent NI fusionné, aucun geste — la taille ne se joue pas sur rien', () => {
  const vus = []
  const gestes = purger({ principal: '/dep', worktrees: [{ classe: 'sale', chemin: '/dep/.wt-sale' }, { classe: 'principal', chemin: '/dep' }], gestes: gestesFactices(vus) })
  assert.deepEqual(vus, [])
  assert.deepEqual(gestes, [])
})

// #2603 constat 26
test('dossiersNonInscrits : seuls les `.wt-*` répertoires que git ne nomme pas, vides ou peuplés, illisibles compris', () => {
  const disque = {
    '/dep': ['.wt-inscrit', '.wt-vide', '.wt-peuple', '.wt-fichier', '.wt-illisible', 'autre', '.WT-casse'],
    '/dep/.wt-vide': [],
    '/dep/.wt-peuple': ['a.txt'],
    '/dep/autre': [],
  }
  const lister = (chemin) => {
    const cle = chemin.replace(/\\/g, '/')
    if (cle === '/dep/.wt-illisible') throw Object.assign(new Error('refusé'), { code: 'EPERM' })
    return disque[cle]
  }
  const nature = (chemin) => (chemin.replace(/\\/g, '/') === '/dep/.wt-fichier' ? 'fichier' : 'repertoire')
  // L'inscrit est rendu par git sous une autre forme (`\`, casse) : la comparaison est normalisée.
  const vus = dossiersNonInscrits({ principal: '/dep', inscrits: [{ chemin: '/dep' }, { chemin: '\\DEP\\.wt-inscrit' }], lister, nature })
  assert.deepEqual(vus.map((d) => [d.chemin.replace(/\\/g, '/'), d.classe]), [
    ['/dep/.wt-vide', 'non-inscrit+vide'],
    ['/dep/.wt-peuple', 'non-inscrit+peuplé'],
    ['/dep/.wt-illisible', 'non-inscrit+peuplé'],
  ])
  const [vide, peuple, illisible] = vus
  assert.deepEqual(ligneDInventaire(vide).split('\t').slice(2), ['hors git', 'dossier non inscrit et vide — purgeable (rmdir)'])
  assert.match(ligneDInventaire(peuple), /NON vide — jamais touché : il porte peut-être du travail/)
  assert.match(ligneDInventaire(illisible), /illisible \(EPERM\) — jamais touché/)
  assert.deepEqual(comptesParClasse([{ classe: 'principal' }, ...vus]), { principal: 1, 'non-inscrit+peuplé': 2, 'non-inscrit+vide': 1 })
})

test('purger : `rmdir` le non-inscrit VIDE, jamais le peuplé, et un rmdir ROUGE se rend ÉCHEC avec son code', () => {
  const vus = []
  const gestes = purger({
    principal: '/dep',
    worktrees: [
      { classe: 'non-inscrit+vide', chemin: '/dep/.wt-vide', inscrit: false },
      { classe: 'non-inscrit+peuplé', chemin: '/dep/.wt-peuple', inscrit: false },
      { classe: 'non-inscrit+vide', chemin: '/dep/.wt-rempli-depuis', inscrit: false },
    ],
    gestes: {
      ...gestesFactices(vus),
      retirerDossierVide: (chemin) => {
        vus.push(`rmdir ${chemin}`)
        if (chemin === '/dep/.wt-rempli-depuis') throw Object.assign(new Error(`ENOTEMPTY: directory not empty, rmdir '${chemin}'`), { code: 'ENOTEMPTY' })
      },
    },
  })
  assert.deepEqual(vus, ['rmdir /dep/.wt-vide', 'rmdir /dep/.wt-rempli-depuis'], 'ni git ni le peuplé')
  assert.deepEqual(gestes.map((g) => [g.geste, g.ok]), [['rmdir /dep/.wt-vide', true], ['rmdir /dep/.wt-rempli-depuis', false]])
  assert.match(gestes[1].detail, /^ENOTEMPTY — /)
})

/** Dépôt jetable + son `origin` NU, avec `origin/main` réellement posé. */
function depotAvecOrigin() {
  const nu = mkdtempSync(join(tmpdir(), 'origin-nu-'))
  lancerGit(['init', '--bare', '-q', '-b', 'main', nu])
  const { racine } = instanceDeDepot({ fichiers: { 'a.txt': 'a' }, message: 'fondation' })
  const git = gitDe(racine, { net: true })
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
      ['git worktree remove', 'git branch -d'])
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

test('#2795 inventaire RÉEL puis --purger : l’arbre À DEMI RETIRÉ se lit par SON dossier d’administration ; propre et fusionné il part, l’intrus et l’hors-main restent inscrits', () => {
  const { racine, git, jeter } = depotAvecOrigin()
  try {
    writeFileSync(join(racine, '.gitignore'), 'node_modules/\n')
    git('add', '.gitignore')
    git('commit', '-q', '-m', 'règles')
    git('push', '-q', 'origin', 'main')
    git('worktree', 'add', '-q', '--detach', join(racine, '.wt-demi'), 'origin/main')
    git('worktree', 'add', '-q', '--detach', join(racine, '.wt-intrus'), 'origin/main')
    git('worktree', 'add', '-q', '--detach', join(racine, '.wt-ignore'), 'origin/main')
    git('worktree', 'add', '-q', '--detach', join(racine, '.wt-hm'), 'origin/main')
    git('worktree', 'add', '-q', '-b', 'chantier/parti', join(racine, '.wt-parti'), 'origin/main')
    git('-C', join(racine, '.wt-hm'), 'commit', '-q', '--allow-empty', '-m', 'travail hors main')
    const travail = git('-C', join(racine, '.wt-hm'), 'rev-parse', 'HEAD')
    rmSync(join(racine, '.wt-parti'), { recursive: true, force: true })
    writeFileSync(join(racine, 'non-suivi-du-principal.txt'), 'au principal')
    for (const nom of ['.wt-demi', '.wt-intrus', '.wt-ignore', '.wt-hm']) rmSync(join(racine, nom, '.git'))
    rmSync(join(racine, '.wt-demi', 'a.txt'))
    rmSync(join(racine, '.wt-demi', '.gitignore'))
    mkdirSync(join(racine, '.wt-demi', 'node_modules'))
    writeFileSync(join(racine, '.wt-demi', 'node_modules', 'x'), 'ignoré par le .gitignore supprimé')
    writeFileSync(join(racine, '.wt-intrus', 'intrus.txt'), 'authoré')
    writeFileSync(join(racine, '.git', 'info', 'exclude'), 'build/\n')
    mkdirSync(join(racine, '.wt-ignore', 'build'))
    writeFileSync(join(racine, '.wt-ignore', 'build', 'notes.md'), 'authoré, ignoré')

    const vu = inventaire({ racine })
    const ligne = (nom) => ligneDInventaire(parNom(vu.worktrees, nom))
    const demi = parNom(vu.worktrees, '.wt-demi')
    assert.deepEqual([demi.classe, demi.fusionne], ['à-demi-retiré', true], ligne('.wt-demi'))
    assert.match(raisonDe(demi), /^à demi retiré \(gitdir file points to non-existent location\) — purgeable/)
    assert.equal(parNom(vu.worktrees, '.wt-intrus').classe, 'sale', ligne('.wt-intrus'))
    assert.match(raisonDe(parNom(vu.worktrees, '.wt-intrus')), /^à demi retiré \(.*\) — \[métier · non retentable\] modifications non commitées \(1\) : intrus\.txt$/)
    assert.equal(parNom(vu.worktrees, '.wt-ignore').classe, 'protégé', ligne('.wt-ignore'))
    assert.match(raisonDe(parNom(vu.worktrees, '.wt-ignore')), /ignoré authoré \(1\) : build\/notes\.md/)
    assert.equal(parNom(vu.worktrees, '.wt-hm').classe, 'à-demi-retiré', ligne('.wt-hm'))
    assert.match(ligne('.wt-hm'), /des commits que origin\/main n’a pas — pas encore purgeable/)
    for (const nom of ['.wt-demi', '.wt-intrus', '.wt-hm']) assert.doesNotMatch(ligne(nom), /non-suivi-du-principal/)
    assert.match(ligne('.wt-parti'), /^absent\t.*— git worktree prune$/, 'l’absent élagable déclenche la taille')

    const gestes = purger({ principal: racine, worktrees: vu.worktrees })
    const enSlash = (texte) => texte.replace(/\\/g, '/')
    assert.deepEqual(gestes.map((g) => `${g.ok ? 'ok' : 'ÉCHEC'} ${enSlash(g.geste).replace(enSlash(racine), '<r>')}`), [
      'ok relier .git, checkout-index, git worktree remove <r>/.wt-demi',
      'ÉCHEC git worktree prune',
    ], JSON.stringify(gestes))
    assert.match(enSlash(gestes[1].detail), /^non joué, il désinscrirait en perdant : .*\/\.wt-hm : dossier présent/)
    assert.equal(existsSync(join(racine, '.wt-demi')), false)
    for (const nom of ['.wt-intrus', '.wt-ignore', '.wt-hm']) assert.equal(existsSync(join(racine, nom, '.git')), false, `${nom} : rien n’y est écrit`)
    assert.ok(existsSync(join(racine, '.wt-intrus', 'intrus.txt')))
    assert.ok(existsSync(join(racine, 'non-suivi-du-principal.txt')))
    const apres = inventaire({ racine })
    assert.equal(parNom(apres.worktrees, '.wt-demi'), undefined)
    assert.deepEqual(['.wt-intrus', '.wt-ignore', '.wt-hm'].map((nom) => parNom(apres.worktrees, nom)?.demiRetire), [true, true, true], 'toujours inscrits')
    assert.equal(parNom(apres.worktrees, '.wt-parti')?.classe, 'absent', 'la taille refusée ne l’a pas désinscrit non plus')
    assert.ok(git('worktree', 'list', '--porcelain').includes(`HEAD ${travail}`), 'le commit hors main reste tenu par son inscription')
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
  const sansGit = mkdtempSync(join(tmpdir(), 'wt-sans-git-'))
  writeFileSync(join(illisible, '.git'), `gitdir: ${join(illisible, 'nulle-part')}\n`)
  try {
    const bruts = [
      { chemin: racine, head: null, branche: 'main', principal: true, nu: false, verrouille: false, verrouillePour: null, prunable: null },
      { chemin: illisible, head: 'a'.repeat(40), branche: 'chantier/illisible', principal: false, nu: false, verrouille: false, verrouillePour: null, prunable: null },
      { chemin: sansGit, head: 'a'.repeat(40), branche: 'chantier/sans-git', principal: false, nu: false, verrouille: false, verrouillePour: null, prunable: null },
    ]
    const vu = inventaire({ racine, gestes: {
      ...GESTES_DE_L_INVENTAIRE,
      worktreesDe: () => bruts,
      fetchOrigin: () => ({ disponible: true, valeur: { status: 0, stdout: '', stderr: '' } }),
      estAncetre: () => ({ disponible: true, valeur: true }),
    } })
    const w = vu.worktrees.find((x) => x.chemin === illisible)
    assert.deepEqual([w.sale, w.fusionne, w.classe], [true, true, 'sale'])
    assert.equal(w.illisible, 'git en panne sur son dossier')
    // #2795 : sans `.git` ni `prunable` de git, l'arbre n'est ni à demi retiré ni interrogé.
    const s = vu.worktrees.find((x) => x.chemin === sansGit)
    assert.deepEqual([s.sale, s.demiRetire, s.classe, s.illisible], [true, false, 'sale', 'fichier .git absent, que git ne dit pas prunable'])
    assert.match(raisonDe(s), /fichier \.git absent de .* : git y lirait le dépôt parent, et aucun dossier unique de /)
  } finally {
    jeter()
    for (const d of [illisible, sansGit]) rmSync(d, { recursive: true, force: true })
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

// #1736
test('purger : un remove ROUGE dont le dossier RESTE se dit, avec le geste à la main et la branche', () => {
  const vus = []
  const gestes = purger({
    principal: '/dep',
    worktrees: [{ classe: 'propre+fusionné', chemin: '/dep/.wt-bloque', branche: 'chantier/bloque' }],
    gestes: gestesFactices(vus, (geste) => (geste.startsWith('worktree remove') ? 1 : 0)),
    nature: (chemin) => (chemin === '/dep/.wt-bloque' ? 'repertoire' : 'absent'),
  })
  // #2494
  assert.deepEqual(vus, ['worktree remove /dep/.wt-bloque'])
  assert.deepEqual(gestes.map((g) => [g.geste, g.ok]), [
    ['git worktree remove /dep/.wt-bloque', false],
    ['re-mesure /dep/.wt-bloque', false],
  ])
  assert.match(gestes[1].detail, /dossier présent.*branche chantier\/bloque conservée/)
  assert.doesNotMatch(gestes[1].detail, /rm -rf/)
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
    ['re-mesure /dep/.wt-reste', false],
  ])
  assert.match(gestes[1].detail, /dossier présent, désinscrit de git.*branche chantier\/reste conservée — l'inventaire suivant le classe non-inscrit/)
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

// #2603 constat 26
test('inventaire RÉEL puis --purger : le `.wt-*` non inscrit VIDE part ; le caché, le peuplé, l’inscrit vidé et l’étranger restent', () => {
  const { racine, git, jeter } = depotAvecOrigin()
  try {
    git('worktree', 'add', '-q', '-b', 'chantier/sale', join(racine, '.wt-sale'), 'origin/main')
    writeFileSync(join(racine, '.wt-sale', 'a.txt'), 'modifié, non commité')
    // Inscrit à git, puis vidé sur disque (son `.git` en fichier compris) : jamais un `rmdir` de cette voie.
    git('worktree', 'add', '-q', '-b', 'chantier/vide-inscrit', join(racine, '.wt-vide-inscrit'), 'origin/main')
    for (const nom of readdirSync(join(racine, '.wt-vide-inscrit'))) rmSync(join(racine, '.wt-vide-inscrit', nom), { recursive: true, force: true })
    assert.deepEqual(readdirSync(join(racine, '.wt-vide-inscrit')), [])
    mkdirSync(join(racine, '.wt-vide'))
    mkdirSync(join(racine, '.wt-peuple'))
    writeFileSync(join(racine, '.wt-peuple', 'travail.txt'), 'peut-être du travail')
    mkdirSync(join(racine, '.wt-cache'))
    writeFileSync(join(racine, '.wt-cache', '.gitkeep'), '')
    mkdirSync(join(racine, 'etranger'))

    const vu = inventaire({ racine })
    assert.equal(vu.ok, true, vu.refus)
    assert.deepEqual(vu.worktrees.map((w) => w.chemin.replace(/\\/g, '/').split('/').pop()).slice(1).sort(),
      ['.wt-sale', '.wt-vide-inscrit'], 'worktrees = ce que git nomme')
    assert.deepEqual(vu.nonInscrits.map((d) => [d.chemin.replace(/\\/g, '/').split('/').pop(), d.classe]),
      [['.wt-cache', 'non-inscrit+peuplé'], ['.wt-peuple', 'non-inscrit+peuplé'], ['.wt-vide', 'non-inscrit+vide']],
      'un fichier caché suffit à peupler ; l’inscrit vidé n’est pas un non-inscrit')

    const gestes = purger({ principal: racine, worktrees: [...vu.worktrees, ...vu.nonInscrits] })
    assert.deepEqual(gestes.filter((g) => g.geste.startsWith('rmdir')).map((g) => [g.geste.replace(/\\/g, '/').split('/').pop(), g.ok]),
      [['.wt-vide', true]], JSON.stringify(gestes))
    assert.equal(existsSync(join(racine, '.wt-vide')), false, 'le vide est retiré')
    assert.ok(gestes.some((g) => g.ok && g.geste.replace(/\\/g, '/').endsWith('checkout-index, git worktree remove ' + join(racine, '.wt-vide-inscrit').replace(/\\/g, '/'))), JSON.stringify(gestes))
    assert.equal(existsSync(join(racine, '.wt-vide-inscrit')), false, '#2795 : l’inscrit vidé, à demi retiré et fusionné, part par `worktree remove`')
    assert.equal(existsSync(join(racine, '.wt-cache', '.gitkeep')), true, 'le caché est intact')
    assert.equal(existsSync(join(racine, '.wt-peuple', 'travail.txt')), true, 'le peuplé est intact')
    assert.equal(existsSync(join(racine, '.wt-sale', 'a.txt')), true, 'le sale est intact')
    assert.equal(existsSync(join(racine, 'etranger')), true, 'hors préfixe : jamais vu')
    assert.deepEqual(inventaire({ racine }).nonInscrits.map((d) => d.classe), ['non-inscrit+peuplé', 'non-inscrit+peuplé'])

    // Un dossier rempli entre l'inventaire et la purge : `rmdir` refuse, rien n'est perdu.
    mkdirSync(join(racine, '.wt-tardif'))
    const avant = inventaire({ racine })
    writeFileSync(join(racine, '.wt-tardif', 'venu-entre-temps.txt'), 'x')
    const tardif = purger({ principal: racine, worktrees: [...avant.worktrees, ...avant.nonInscrits] }).filter((g) => g.geste.startsWith('rmdir'))
    assert.deepEqual(tardif.map((g) => g.ok), [false])
    assert.match(tardif[0].detail, /^ENOTEMPTY/)
    assert.equal(existsSync(join(racine, '.wt-tardif', 'venu-entre-temps.txt')), true)
  } finally { jeter() }
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
